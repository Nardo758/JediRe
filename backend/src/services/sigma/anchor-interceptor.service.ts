/**
 * Anchor Interceptor
 *
 * Sits between user-provided expense growth rates and the financial model engine.
 * Takes flat growth rates and replaces them with per-line-item anchor-computed rates
 * based on the macro series + state rules + geography.
 *
 * Pure functions — no I/O. Uses hardcoded macro fallbacks (no DB dependency).
 * The macro fetcher can be wired in a future phase for live FRED/BLS values.
 *
 * Phase B2 — see M36_PROFORMA_LINE_ITEM_ANCHORS.md
 */

import { getAnchorsByDealType, getStateRules, type LineItemAnchor, type StateRule } from './proforma-anchors.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnchorInterceptorInput {
  /** Expense list from user assumptions (or composed financials) */
  expenses: Record<string, { amount: number; type: string; growthRate: number }>;
  /** Two-letter state code */
  stateCode: string;
  /** Deal type tags for anchor filtering */
  dealTypeTags?: string[];
  /** Purchase price (for tax reassessment calculations) */
  purchasePrice?: number;
  /** Total unit count */
  totalUnits?: number;
}

export interface AnchorBreakdownEntry {
  lineItemId: string;
  originalGrowth: number;
  anchorGrowth: number;
  macroSeriesId: string | null;
  stateRuleApplied: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface AnchorInterceptorResult {
  /** Modified expense list with anchor-corrected growth rates */
  expenses: Record<string, { amount: number; type: string; growthRate: number }>;
  /** Per-line breakdown for audit/provenance */
  anchorBreakdown: AnchorBreakdownEntry[];
  /** State rules that were applied (de-duped) */
  stateRulesApplied: string[];
}

// ─── Mapping: financial model expense keys → anchor lineItemIds ──────────────

const EXPENSE_TO_ANCHOR_KEY: Record<string, string> = {
  'insurance':            'insurance',
  'real_estate_tax':      'taxes',
  'personal_property_tax':'taxes',
  'utilities':            'utilities',
  'repairs_maintenance':  'repairs_maint',
  'management_fee':       'mgmt_fees',
  'replacement_reserves': 'reserves',
  'payroll':              'mgmt_fees',       // labor — management proxy
  'contract_services':    'utilities',       // contracted — utilities proxy
  'turnover':             'repairs_maint',   // turnover — repairs proxy
  'marketing':            'other_income',    // no direct anchor
  'g_and_a':              'other_income',    // no direct anchor
  'hoa_dues':             'utilities',       // HOA — utilities proxy
};

const REVENUE_TO_ANCHOR_KEY: Record<string, string> = {
  'rent':         'rent_income',
  'rentincome':   'rent_income',
  'other_income': 'other_income',
  'otherincome':  'other_income',
};

// ─── Hardcoded Macro Growth Fallbacks ───────────────────────────────────────

/**
 * Default macro growth rates (Phase B1 — hardcoded).
 * Phase B2+ will replace these with live FRED/BLS values from macro-fetcher.
 */
export const MACRO_GROWTH_FALLBACKS: Record<string, number> = {
  'CUSR0000SEHC': 0.032,   // CPI-OER ~3.2%
  'ECIWAG':       0.042,   // ECI wages ~4.2%
  'WPSFD49207':   0.035,   // PPI residential ~3.5%
};

export const DEFAULT_COUNTY_GROWTH_RATE = 0.015;  // default millage rate growth

// ─── Core: Compute Anchor Growth Rate ───────────────────────────────────────

/**
 * Compute the anchor-informed growth rate for a single expense line.
 * Pure function — no I/O.
 *
 * @param anchor       - the line-item anchor config
 * @param stateCode    - two-letter state code
 * @param stateRules   - applicable state rules (from getStateRules)
 * @param expenseKey   - the financial model expense key (for logging)
 * @param amount       - current expense amount (for proportional calculations)
 * @param purchasePrice - deal purchase price (for tax reassessment scenarios)
 * @param totalUnits   - unit count (for per-unit calculations)
 * @returns            - the anchor-computed annual growth rate
 */
export function computeAnchorGrowthRate(
  anchor: LineItemAnchor,
  stateCode: string,
  stateRules: StateRule[],
  expenseKey: string,
  amount: number,
  purchasePrice?: number,
  totalUnits?: number,
): number {
  const stateUpper = stateCode.toUpperCase();

  // Resolve macro growth rate
  let macroGrowth = 0.025; // default fallback
  if (anchor.macroSeriesId && MACRO_GROWTH_FALLBACKS[anchor.macroSeriesId]) {
    macroGrowth = MACRO_GROWTH_FALLBACKS[anchor.macroSeriesId];
  }

  // Resolve state cap
  const caps = stateRules.filter(
    r => r.lineItemId === anchor.lineItemId
      && r.stateCode === stateUpper
      && r.ruleType === 'cap'
  );
  const capValues = caps.map(r => r.ruleValue).filter((v): v is number => v !== null);
  const stateCap = capValues.length > 0 ? Math.min(...capValues) : null;

  switch (anchor.lineItemId) {
    case 'insurance': {
      // Insurance = PPI × zone_mult + structural premium, capped by state
      const zoneMult = anchor.geoModifiers.insuranceZoneMultiplier;
      const rawGrowth = macroGrowth * zoneMult + anchor.structuralPremium;
      return stateCap != null ? Math.min(rawGrowth, stateCap) : rawGrowth;
    }

    case 'taxes': {
      // Taxes = county growth rate + premium, capped by state
      const rawGrowth = DEFAULT_COUNTY_GROWTH_RATE + anchor.structuralPremium;
      return stateCap != null ? Math.min(rawGrowth, stateCap) : rawGrowth;
    }

    case 'mgmt_fees': {
      // Management = ECI wages + premium
      return macroGrowth + anchor.structuralPremium;
    }

    case 'utilities':
    case 'repairs_maint': {
      // Utilities/repairs = macro growth + premium
      return macroGrowth + anchor.structuralPremium;
    }

    case 'reserves': {
      // Reserves = PPI + premium
      return macroGrowth + anchor.structuralPremium;
    }

    case 'rent_income': {
      // Rent = CPI-OER + premium
      return macroGrowth + anchor.structuralPremium;
    }

    default: {
      // Generic fallback: macro + premium, or just premium for prev_year types
      if (anchor.anchorType === 'prev_year_plus_premium') {
        return anchor.structuralPremium;
      }
      if (anchor.anchorType === 'per_unit_fixed') {
        return anchor.structuralPremium;
      }
      return macroGrowth + anchor.structuralPremium;
    }
  }
}

// ─── Main Interceptor ────────────────────────────────────────────────────────

/**
 * Apply the anchor interceptor to a set of expense assumptions.
 *
 * For each expense key that has a registered anchor, replaces the flat
 * growthRate with the anchor-computed rate (macro series + premium + state cap).
 * Unknown expense keys pass through unchanged.
 */
export function applyAnchorInterceptor(input: AnchorInterceptorInput): AnchorInterceptorResult {
  const { expenses, stateCode, dealTypeTags, purchasePrice, totalUnits } = input;
  const anchors = getAnchorsByDealType(dealTypeTags || []);
  const stateRules = getStateRules(stateCode.toUpperCase());
  const stateRulesApplied = [...new Set(stateRules.map(r => r.ruleText))];

  const breakdown: AnchorBreakdownEntry[] = [];
  const result: Record<string, { amount: number; type: string; growthRate: number }> = {};

  for (const [expenseKey, expConfig] of Object.entries(expenses)) {
    const anchorId = EXPENSE_TO_ANCHOR_KEY[expenseKey];
    const anchor = anchorId ? anchors.find(a => a.lineItemId === anchorId) : null;
    const originalGrowth = expConfig.growthRate;

    let anchorGrowth: number;

    if (anchor) {
      anchorGrowth = computeAnchorGrowthRate(
        anchor, stateCode, stateRules, expenseKey,
        expConfig.amount, purchasePrice, totalUnits
      );
    } else {
      // No anchor mapping — keep original
      anchorGrowth = originalGrowth;
    }

    // Derive confidence from divergence between original and anchor
    const difference = Math.abs(anchorGrowth - originalGrowth);
    const confidence: 'high' | 'medium' | 'low' =
      difference < 0.01 ? 'high' :
      difference < 0.02 ? 'medium' : 'low';

    // Find the most relevant state rule text
    const appliedRule = stateRules
      .filter(r => r.lineItemId === anchorId)
      .map(r => r.ruleText)
      [0] ?? null;

    breakdown.push({
      lineItemId: expenseKey,
      originalGrowth,
      anchorGrowth,
      macroSeriesId: anchor?.macroSeriesId ?? null,
      stateRuleApplied: appliedRule,
      confidence,
    });

    result[expenseKey] = {
      ...expConfig,
      growthRate: anchorGrowth,
    };
  }

  return {
    expenses: result,
    anchorBreakdown: breakdown,
    stateRulesApplied,
  };
}

/**
 * Convenience wrapper: apply to both revenue and expense line items.
 * Revenue items (rent growth, other income) also get anchored.
 */
export function applyFullAnchorInterceptor(
  revenueAssumptions: Record<string, number>,
  expenseAssumptions: Record<string, { amount: number; type: string; growthRate: number }>,
  stateCode: string,
  dealTypeTags?: string[],
): {
  revenue: Record<string, number>;
  expenses: Record<string, { amount: number; type: string; growthRate: number }>;
  breakdown: AnchorBreakdownEntry[];
  stateRules: string[];
} {
  const expenseResult = applyAnchorInterceptor({
    expenses: expenseAssumptions,
    stateCode,
    dealTypeTags,
  });

  const anchors = getAnchorsByDealType(dealTypeTags || []);
  const stateRules = getStateRules(stateCode.toUpperCase());
  const revenueBreakdown: AnchorBreakdownEntry[] = [];
  const revenueResult: Record<string, number> = {};

  for (const [revKey, originalRate] of Object.entries(revenueAssumptions)) {
    const anchorId = REVENUE_TO_ANCHOR_KEY[revKey.toLowerCase()];
    const anchor = anchorId ? anchors.find(a => a.lineItemId === anchorId) : null;

    let anchoredRate = originalRate;
    if (anchor) {
      anchoredRate = computeAnchorGrowthRate(
        anchor, stateCode, stateRules, revKey, 0
      );
    }

    revenueResult[revKey] = anchoredRate;
    revenueBreakdown.push({
      lineItemId: revKey,
      originalGrowth: originalRate,
      anchorGrowth: anchoredRate,
      macroSeriesId: anchor?.macroSeriesId ?? null,
      stateRuleApplied: null,
      confidence: Math.abs(anchoredRate - originalRate) < 0.01 ? 'high' : 'medium',
    });
  }

  return {
    revenue: revenueResult,
    expenses: expenseResult.expenses,
    breakdown: [...revenueBreakdown, ...expenseResult.anchorBreakdown],
    stateRules: expenseResult.stateRulesApplied,
  };
}

// ─── Normalization Helpers: Display names → snake_case keys ─────────────

/**
 * Display-name-to-snake-key mapping for expense line items.
 * The frontend sends human-readable names like "Repairs & Maintenance";
 * the interceptor expects snake_case keys like "repairs_maintenance".
 */
const DISPLAY_TO_SNAKE_KEY: Record<string, string> = {
  'insurance': 'insurance',
  'real estate taxes': 'real_estate_tax',
  'personal property tax': 'personal_property_tax',
  'water / sewer': 'utilities',
  'electric': 'utilities',
  'gas': 'utilities',
  'trash': 'utilities',
  'utilities': 'utilities',
  'repairs & maintenance': 'repairs_maintenance',
  'repairs and maintenance': 'repairs_maintenance',
  'repairs_maintenance': 'repairs_maintenance',
  'maintenance': 'repairs_maintenance',
  'turnover': 'turnover',
  'contract services': 'contract_services',
  'contract_services': 'contract_services',
  'personnel / payroll': 'payroll',
  'payroll': 'payroll',
  'marketing': 'marketing',
  'administrative / g&a': 'g_and_a',
  'administrative / ga': 'g_and_a',
  'g_and_a': 'g_and_a',
  'hoa dues': 'hoa_dues',
  'management fee': 'management_fee',
  'management_fee': 'management_fee',
  'replacement reserves': 'replacement_reserves',
  'replacement_reserves': 'replacement_reserves',
};

/**
 * Normalize frontend expense records (display-name keys like "Repairs & Maintenance")
 * to interceptor-friendly snake_case keys.
 */
export function normalizeExpensesForInterceptor(
  expenses: Record<string, { amount: number; type?: string; growthRate: number }>
): Record<string, { amount: number; type: string; growthRate: number }> {
  const result: Record<string, { amount: number; type: string; growthRate: number }> = {};
  for (const [key, val] of Object.entries(expenses)) {
    const normalizedKey = key.toLowerCase().trim();
    const snakeKey = DISPLAY_TO_SNAKE_KEY[normalizedKey] || normalizedKey.replace(/[\s&\/]+/g, '_');
    // Merge multiple display names that map to the same snake key (e.g., "Water/Sewer" + "Electric" → "utilities")
    if (result[snakeKey]) {
      result[snakeKey].amount += val.amount;
    } else {
      result[snakeKey] = {
        amount: val.amount,
        type: val.type || 'total',
        growthRate: val.growthRate ?? 0.03,
      };
    }
  }
  return result;
}

/**
 * Reverse: convert interceptor's snake_case output back to original display-name keys
 * preserving the original key set so the financial engine sees the keys it expects.
 */
export function rekeyExpensesFromInterceptor(
  intercepted: Record<string, { amount: number; type: string; growthRate: number }>,
): Record<string, { amount: number; type: string; growthRate: number }> {
  // intercepted already uses snake_case — they're the right keys for the engine
  return intercepted;
}

export default { applyAnchorInterceptor, applyFullAnchorInterceptor, computeAnchorGrowthRate, EXPENSE_TO_ANCHOR_KEY, MACRO_GROWTH_FALLBACKS, normalizeExpensesForInterceptor, rekeyExpensesFromInterceptor };
