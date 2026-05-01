/**
 * Tool: fetch_anchor_growth_rates
 *
 * Returns per-line-item anchor growth rates for proforma projections.
 * Maps financial model expense/revenue keys to their macro-anchored growth
 * rates, state law caps, and timing rules.
 *
 * Phase B4 — see M36_PROFORMA_LINE_ITEM_ANCHORS.md
 *
 * The agent calls this in Phase 6 after deriving per-line assumptions,
 * to compare its own rates against what the anchor system suggests.
 */

import { z } from 'zod';
import { logger } from '../../utils/logger';
import {
  getAnchorsByDealType,
  getStateRules,
  getCapRate,
  projectAllLineItems,
  type LineItemAnchor,
  type StateRule,
} from '../../services/sigma/proforma-anchors.service';

const InputSchema = z.object({
  stateCode: z.string().describe('Two-letter state code (GA, FL, CA, TX, NY, etc.)'),
  dealType: z.string().optional().describe('Deal type tag (existing, value-add, development, etc.)'),
  lineItems: z.array(z.string()).optional().describe(
    'Specific line items to fetch anchors for. If omitted, returns all.'
  ),
  horizonYears: z.number().optional().default(5).describe('Projection horizon (default 5)'),
  isSaleTrigger: z.boolean().optional().default(false).describe(
    'Is this an acquisition year? Affects on-sale reassessment timing.'
  ),
});

// ─── Anchor Descriptions ────────────────────────────────────────────────────

const SERIES_NAMES: Record<string, string> = {
  'CUSR0000SEHC': 'CPI-OER (Owner\'s Equivalent Rent)',
  'ECIWAG': 'ECI Wages & Salaries',
  'DGS10': '10-Year Treasury Yield',
  'T10YIE': '10-Year Breakeven Inflation',
  'WPSFD49207': 'PPI Residential Construction',
};

function describeAnchor(anchor: LineItemAnchor): string {
  const series = anchor.macroSeriesId ? SERIES_NAMES[anchor.macroSeriesId] ?? anchor.macroSeriesId : null;
  const parts: string[] = [];
  if (series) parts.push(series);
  if (anchor.structuralPremium > 0) parts.push(`+${(anchor.structuralPremium * 100).toFixed(1)}% premium`);
  parts.push(`(${anchor.timing?.changeType ?? 'annual_step'})`);
  return parts.join(' ');
}

// ─── Output Types ───────────────────────────────────────────────────────────

const AnchorGrowthOutputSchema = z.object({
  success: z.boolean(),
  items: z.array(z.object({
    lineItemId: z.string(),
    label: z.string(),
    baseGrowthRate: z.number(),
    premiumGrowthRate: z.number(),
    totalGrowthRate: z.number(),
    description: z.string(),
    macroSeriesId: z.string().nullable(),
    timingChangeType: z.string(),
    category: z.string(),
  })),
  stateRules: z.array(z.object({
    stateCode: z.string(),
    lineItemId: z.string(),
    ruleType: z.string(),
    ruleText: z.string(),
  })).optional(),
  projectedValues: z.array(z.object({
    lineItemId: z.string(),
    label: z.string(),
    baseValue: z.number(),
    projections: z.record(z.string(), z.number()).describe('YearKey -> ProjectedValue'),
  })).optional(),
  summary: z.string(),
});

// ─── EXECUTION ──────────────────────────────────────────────────────────────

export async function fetchAnchorGrowthRates(input: unknown) {
  const parsed = InputSchema.parse(input);
  const stateCode = parsed.stateCode.toUpperCase();
  const tags = parsed.dealType ? [parsed.dealType] : ['existing'];
  const horizon = parsed.horizonYears;

  // 1. Get anchors for this deal type
  const anchors = getAnchorsByDealType(tags);

  // 2. Filter to requested line items, or return all
  const filtered = parsed.lineItems?.length
    ? anchors.filter(a => parsed.lineItems!.includes(a.lineItemId))
    : anchors;

  // 3. Compute base growth rates (macro + premium)
  const items = filtered.map(a => {
    const baseGrowthRate = a.macroSeriesId ? 0.032 : 0.03; // default macro baseline
    const totalGrowthRate = baseGrowthRate + a.structuralPremium;
    return {
      lineItemId: a.lineItemId,
      label: a.lineItemLabel || a.lineItemId,
      baseGrowthRate,
      premiumGrowthRate: a.structuralPremium,
      totalGrowthRate,
      description: describeAnchor(a),
      macroSeriesId: a.macroSeriesId ?? null,
      timingChangeType: a.timing?.changeType ?? 'annual_step',
      category: a.category ?? 'opex',
    };
  });

  // 4. Get state rules
  const stateRules = getStateRules(stateCode);

  // 5. Compute projections if base values provided
  let projectedValues: any[] | undefined;
  try {
    // Use $1/unit as default base values for demonstration
    const baseValues = new Map(filtered.map(a => [a.lineItemId, 1000]));
    const macroRates = new Map();
    const results = projectAllLineItems(filtered, baseValues, macroRates, horizon, stateCode, parsed.isSaleTrigger, 100000);
    projectedValues = results.map(r => ({
      lineItemId: r.lineItemId,
      label: r.label ?? r.lineItemId,
      baseValue: r.value ?? 0,
      projections: Object.fromEntries(
        Object.entries(r).filter(([k]) => /^year\d+$/i.test(k)).map(([k, v]) => [k, Number(v)])
      ),
    }));
  } catch (err: any) {
    logger.warn('[anchor-rates] Projection skipped', { error: err.message });
  }

  // 6. Build summary
  const anchored = items.filter(i => i.macroSeriesId).length;
  const total = items.length;
  const hasStateRules = stateRules.length > 0;
  const summary = hasStateRules
    ? `${anchored}/${total} line items anchored to macro series. ${stateRules.length} state-specific rule(s) apply in ${stateCode}.`
    : `${anchored}/${total} line items anchored to macro series. No state-specific rules for ${stateCode}.`;

  return {
    success: true,
    items,
    stateRules: stateRules.length > 0 ? stateRules.map(r => ({
      stateCode: r.stateCode,
      lineItemId: r.lineItemId,
      ruleType: r.ruleType,
      ruleText: r.ruleText,
    })) : undefined,
    projectedValues,
    summary,
  };
}

// ─── Tool Registration ──────────────────────────────────────────────────────

export const fetchAnchorGrowthRatesTool = {
  name: 'fetch_anchor_growth_rates',
  description: `Fetch per-line-item anchor growth rates for proforma projections.

Each property expense line (insurance, taxes, management, utilities, etc.) has an
anchor growth rate driven by macro series (CPI-OER, ECI Wages, PPI Residential,
Treasury, Breakeven) plus a structural premium. State law caps override the base
rate where applicable (e.g., FL insurance 3% cap, CA Prop 13 2% tax cap, GA on-sale
reassessment, TX 10% homestead cap).

Call this in Phase 6 after you've derived your per-line assumptions. Compare
your growth rate vs. the anchor rate. If they diverge by >1%, flag it as a risk.`,
  inputSchema: InputSchema,
  outputSchema: AnchorGrowthOutputSchema,
  handler: fetchAnchorGrowthRates,
};

export default fetchAnchorGrowthRatesTool;


