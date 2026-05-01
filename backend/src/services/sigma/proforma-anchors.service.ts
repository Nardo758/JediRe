/**
 * Proforma Line-Item Anchor Service
 *
 * Maps every proforma line item to its growth driver, timing rules, and
 * state-specific legal/regulatory overrides. Pure functions + DB-backed
 * lookups with fallback defaults.
 *
 * Key insight: each line item has its own macro anchor and timing.
 * Insurance ≠ taxes ≠ management. Each follows its own series.
 * Timing matters: GA reassesses on sale, FL caps insurance at 3%, etc.
 *
 * Phase B1 — see M36_PROFORMA_LINE_ITEM_ANCHORS.md for design.
 */

import { logger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LineItemAnchor {
  lineItemId: string;
  lineItemLabel: string;
  category: 'revenue' | 'opex' | 'capex' | 'summary';
  anchorType: 'macro_series' | 'fixed_rate' | 'prev_year_plus_premium' | 'per_unit_fixed' | 'pct_of_egi';
  macroSeriesId: string | null;
  structuralPremium: number;
  timing: {
    changeType: 'annual_step' | 'locked' | 'trigger_once' | 'cycle' | 'market';
    effective: string;
    cycleYears?: number;
  };
  triggers: {
    onSale: boolean;
    onRefinance: boolean;
    onRenovation: boolean;
    onReassessment: boolean;
  };
  geoModifiers: {
    insuranceZoneMultiplier: number;
    taxBurdenIndex: number;
  };
  sortOrder: number;
  dealTypeTags: string[];
  defaultValue: number | null;
}

export interface StateRule {
  stateCode: string;
  lineItemId: string;
  ruleType: string;
  ruleValue: number | null;
  ruleText: string;
}

export interface ProjectedLineItem {
  lineItemId: string;
  label: string;
  year: number;
  value: number;
  anchorValue: number;         // macro series value or base
  premiumApplied: number;
  triggerApplied: string | null;  // e.g., 'sale_reassessment', 'annual_step'
  confidence: 'high' | 'medium' | 'low';
  ruleOverride: string | null;    // e.g., 'FL insurance cap 3%'
}

export interface AnchorProjectionInput {
  anchor: LineItemAnchor;
  baseValue: number;           // Y0 value (known at acquisition)
  macroGrowthRate: number;     // from macro series lookup
  year: number;                // 0-based year index
  isSaleTrigger: boolean;      // sale occurred this year
  egiValue?: number;           // effective gross income (for pct_of_egi)
  stateRules: StateRule[];     // applicable per-state rules
}

// ─── Default Fallback Anchors ────────────────────────────────────────────────

export const DEFAULT_ANCHORS: LineItemAnchor[] = [
  // Revenue
  {
    lineItemId: 'rent_income', lineItemLabel: 'Gross Rent Income', category: 'revenue',
    anchorType: 'macro_series', macroSeriesId: 'CUSR0000SEHC', structuralPremium: 0.008,
    timing: { changeType: 'annual_step', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 10, dealTypeTags: [], defaultValue: null,
  },
  {
    lineItemId: 'other_income', lineItemLabel: 'Other Income', category: 'revenue',
    anchorType: 'prev_year_plus_premium', macroSeriesId: null, structuralPremium: 0.020,
    timing: { changeType: 'annual_step', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 20, dealTypeTags: [], defaultValue: null,
  },
  {
    lineItemId: 'vacancy_loss', lineItemLabel: 'Vacancy & Concessions', category: 'revenue',
    anchorType: 'pct_of_egi', macroSeriesId: null, structuralPremium: 0,
    timing: { changeType: 'locked', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 30, dealTypeTags: [], defaultValue: null,
  },
  {
    lineItemId: 'gross_potential', lineItemLabel: 'Gross Potential Rent', category: 'revenue',
    anchorType: 'pct_of_egi', macroSeriesId: null, structuralPremium: 0,
    timing: { changeType: 'annual_step', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 40, dealTypeTags: [], defaultValue: null,
  },
  {
    lineItemId: 'effective_gross', lineItemLabel: 'Effective Gross Income', category: 'revenue',
    anchorType: 'pct_of_egi', macroSeriesId: null, structuralPremium: 0,
    timing: { changeType: 'locked', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 50, dealTypeTags: [], defaultValue: null,
  },
  // OPEX
  {
    lineItemId: 'mgmt_fees', lineItemLabel: 'Management Fees', category: 'opex',
    anchorType: 'pct_of_egi', macroSeriesId: 'ECIWAG', structuralPremium: 0.005,
    timing: { changeType: 'annual_step', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 100, dealTypeTags: [], defaultValue: null,
  },
  {
    lineItemId: 'insurance', lineItemLabel: 'Insurance', category: 'opex',
    anchorType: 'macro_series', macroSeriesId: 'WPSFD49207', structuralPremium: 0.010,
    timing: { changeType: 'annual_step', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 110, dealTypeTags: [], defaultValue: 700,
  },
  {
    lineItemId: 'taxes', lineItemLabel: 'Property Taxes', category: 'opex',
    anchorType: 'prev_year_plus_premium', macroSeriesId: null, structuralPremium: 0.030,
    timing: { changeType: 'trigger_once', effective: 'next_calendar_year' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: true },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 120, dealTypeTags: [], defaultValue: null,
  },
  {
    lineItemId: 'utilities', lineItemLabel: 'Utilities', category: 'opex',
    anchorType: 'macro_series', macroSeriesId: 'CUSR0000SEHC', structuralPremium: 0.005,
    timing: { changeType: 'annual_step', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 130, dealTypeTags: [], defaultValue: 400,
  },
  {
    lineItemId: 'repairs_maint', lineItemLabel: 'Repairs & Maintenance', category: 'opex',
    anchorType: 'macro_series', macroSeriesId: 'WPSFD49207', structuralPremium: 0.005,
    timing: { changeType: 'annual_step', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 140, dealTypeTags: [], defaultValue: 350,
  },
  {
    lineItemId: 'reserves', lineItemLabel: 'Replacement Reserves', category: 'opex',
    anchorType: 'prev_year_plus_premium', macroSeriesId: 'WPSFD49207', structuralPremium: 0.025,
    timing: { changeType: 'annual_step', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 150, dealTypeTags: [], defaultValue: 300,
  },
  {
    lineItemId: 'total_opex', lineItemLabel: 'Total Operating Expenses', category: 'summary',
    anchorType: 'pct_of_egi', macroSeriesId: null, structuralPremium: 0,
    timing: { changeType: 'locked', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 160, dealTypeTags: [], defaultValue: null,
  },
  // Capex
  {
    lineItemId: 'capex', lineItemLabel: 'Capital Expenditures', category: 'capex',
    anchorType: 'per_unit_fixed', macroSeriesId: null, structuralPremium: 0.030,
    timing: { changeType: 'annual_step', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 200, dealTypeTags: [], defaultValue: 800,
  },
  // Summary
  {
    lineItemId: 'noi', lineItemLabel: 'Net Operating Income', category: 'summary',
    anchorType: 'pct_of_egi', macroSeriesId: null, structuralPremium: 0,
    timing: { changeType: 'locked', effective: 'at_close' },
    triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false },
    geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 },
    sortOrder: 300, dealTypeTags: [], defaultValue: null,
  },
];

export const DEFAULT_STATE_RULES: StateRule[] = [
  { stateCode: 'GA', lineItemId: 'taxes', ruleType: 'reassessment', ruleValue: null,
    ruleText: 'Georgia reassesses on sale. New bill issued within 6 months.' },
  { stateCode: 'FL', lineItemId: 'insurance', ruleType: 'cap', ruleValue: 0.03,
    ruleText: 'Florida 3% cap on insurance rate increases (homestead).' },
  { stateCode: 'FL', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.10,
    ruleText: 'Florida non-homestead 10% cap.' },
  { stateCode: 'CA', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.02,
    ruleText: 'California Prop 13: 2% annual cap.' },
  { stateCode: 'TX', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.10,
    ruleText: 'Texas 10% homestead cap.' },
  { stateCode: 'IL', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.05,
    ruleText: 'Illinois 5% cap (Cook County).' },
  { stateCode: 'LA', lineItemId: 'insurance', ruleType: 'cap', ruleValue: 0.10,
    ruleText: 'Louisiana 10% insurance rate cap.' },
  { stateCode: 'NC', lineItemId: 'taxes', ruleType: 'reassessment', ruleValue: null,
    ruleText: 'North Carolina reassesses on sale AND at county revaluation (4-8 year cycle).' },
];

// ─── Anchor Lookup (pure, with fallback) ─────────────────────────────────────

/**
 * Get anchors for a set of deal type tags.
 * Falls back to DEFAULT_ANCHORS if the DB is unavailable.
 */
export function getAnchorsByDealType(dealTypeTags: string[] = []): LineItemAnchor[] {
  if (dealTypeTags.length === 0) return DEFAULT_ANCHORS.map(a => ({ ...a }));

  // Filter: find anchors that match any of the provided tags,
  // or have no tags (generic). Tags are AND-join: an anchor matches
  // if ALL its tags are present in the input.
  return DEFAULT_ANCHORS
    .filter(a => {
      if (a.dealTypeTags.length === 0) return true;
      return a.dealTypeTags.every(tag => dealTypeTags.includes(tag));
    })
    .map(a => ({ ...a }));
}

/**
 * Get anchor for a specific line item id.
 */
export function getAnchor(lineItemId: string, dealTypeTags?: string[]): LineItemAnchor | null {
  const anchors = getAnchorsByDealType(dealTypeTags);
  return anchors.find(a => a.lineItemId === lineItemId) ?? null;
}

/**
 * Get state rules for a given state code + line item.
 */
export function getStateRules(stateCode: string, lineItemId?: string): StateRule[] {
  return DEFAULT_STATE_RULES
    .filter(r => r.stateCode === stateCode && (!lineItemId || r.lineItemId === lineItemId))
    .map(r => ({ ...r }));
}

/**
 * Get all caps (rate limits) for a state + line item.
 */
export function getCapRate(stateCode: string, lineItemId: string): number | null {
  const caps = getStateRules(stateCode, lineItemId).filter(r => r.ruleType === 'cap');
  if (caps.length === 0) return null;
  // Return the most restrictive (lowest) cap
  const values = caps.map(c => c.ruleValue).filter((v): v is number => v !== null);
  return values.length > 0 ? Math.min(...values) : null;
}

// ─── Growth Computation ──────────────────────────────────────────────────────

/**
 * Apply macro_series anchor growth: base × (1 + macroGrowthRate + structuralPremium)
 * for year N.
 */
export function projectMacroSeries(
  baseValue: number,
  macroGrowthRate: number,
  structuralPremium: number,
  year: number,
  stateCap?: number
): { value: number; growthApplied: number } {
  const annualGrowth = macroGrowthRate + structuralPremium;
  // For trigger_once timing, growth applies only in Y1
  // For annual_step, compounded
  // For locked, no growth
  const cappedGrowth = stateCap != null ? Math.min(annualGrowth, stateCap) : annualGrowth;
  const value = baseValue * Math.pow(1 + cappedGrowth, year);
  return { value, growthApplied: cappedGrowth };
}

/**
 * Apply prev_year_plus_premium: base × (1 + premium)^year
 * Used for items that grow relative to their own prior value
 * (e.g., taxes where the anchor is "last year's taxes + premium").
 */
export function projectPrevYearPlusPremium(
  baseValue: number,
  premium: number,
  year: number,
  stateCap?: number
): { value: number; growthApplied: number } {
  const cappedGrowth = stateCap != null ? Math.min(premium, stateCap) : premium;
  const value = baseValue * Math.pow(1 + cappedGrowth, year);
  return { value, growthApplied: cappedGrowth };
}

/**
 * Compute insurance growth with climate zone multiplier and state cap.
 * Insurance = base * (1 + PPI_rate * zone_mult + premium)^year, capped.
 */
export function projectInsurance(
  baseValue: number,
  ppiGrowthRate: number,        // from PPI insurance (or PPI residential proxy)
  zoneMultiplier: number,       // 1.0 = national avg, >1.0 = coastal/high risk
  structuralPremium: number,
  year: number,
  stateCap?: number
): ProjResult {
  const annualGrowth = ppiGrowthRate * zoneMultiplier + structuralPremium;
  const cappedGrowth = stateCap != null ? Math.min(annualGrowth, stateCap) : annualGrowth;
  const value = baseValue * Math.pow(1 + cappedGrowth, year);
  return { value, growthApplied: cappedGrowth };
}

interface ProjResult { value: number; growthApplied: number }

/**
 * Compute management fees as % of EGI, growing with wage index.
 * Management = EGI * base_rate + wage_growth_passthrough
 */
export function projectManagementFees(
  egiValue: number,
  baseRate: number,          // e.g., 0.05 for 5%
  wageGrowth: number,        // from ECI wages
  year: number
): ProjResult {
  // Base rate compounds with wage growth (management contracts often
  // have escalators tied to CPI or ECI)
  const rate = baseRate * Math.pow(1 + wageGrowth, year);
  const value = egiValue * rate;
  return { value, growthApplied: wageGrowth };
}

/**
 * Compute taxes with state-specific reassessment logic.
 *
 * If the state reassesses on sale AND it's the acquisition year,
 * taxes reset to (purchase_price * effective_tax_rate).
 * Otherwise, they grow at the county's millage rate trend.
 */
export function projectTaxes(
  baseValue: number,           // seller's known tax bill in Y0
  purchasePrice: number,       // for sale-year reassessment
  effectiveTaxRate: number,    // county-specific: taxes / assessed_value
  countyGrowthRate: number,    // historical millage rate change
  year: number,
  stateCode: string,
  isSaleTrigger: boolean,
  stateRules: StateRule[]
): ProjResult {
  const assessmentRules = stateRules.filter(
    r => r.lineItemId === 'taxes' && r.ruleType === 'reassessment'
  );
  const reassessesOnSale = assessmentRules.some(
    r => r.stateCode === stateCode && r.ruleText.toLowerCase().includes('on sale')
  );

  const cap = getCapRate(stateCode, 'taxes');

  if (year === 1 && reassessesOnSale && isSaleTrigger) {
    // Sale triggered reassessment — taxes reset to new basis
    // For GA-style: new assessment at purchase price
    const newValue = purchasePrice * effectiveTaxRate;
    const actualGrowth = newValue / baseValue - 1;
    const cappedGrowth = cap != null ? Math.min(actualGrowth, cap) : actualGrowth;
    return { value: newValue, growthApplied: cappedGrowth };
  }

  // Normal annual growth
  const cappedGrowth = cap != null ? Math.min(countyGrowthRate, cap) : countyGrowthRate;
  const value = baseValue * Math.pow(1 + cappedGrowth, year);
  return { value, growthApplied: cappedGrowth };
}

// ─── Unified Projection ──────────────────────────────────────────────────────

/**
 * Project a single line item for a given year.
 * Pure function, no I/O.
 */
export function projectLineItem(input: AnchorProjectionInput): ProjectedLineItem {
  const { anchor, baseValue, macroGrowthRate, year, isSaleTrigger, egiValue, stateRules } = input;

  const stateCap = getCapRate(
    stateRules.find(r => r.lineItemId === anchor.lineItemId)?.stateCode || '',
    anchor.lineItemId
  );

  const stateReassessmentNote = stateRules
    .filter(r => r.lineItemId === anchor.lineItemId && r.ruleType === 'reassessment')
    .map(r => r.ruleText)
    .join('; ');

  // Determine which trigger fired
  let triggerApplied: string | null = null;

  // For taxes: check if sale triggers reassessment
  if (anchor.lineItemId === 'taxes' && isSaleTrigger && year === 1) {
    triggerApplied = 'sale_reassessment';
  }

  // For trigger_once timing: apply growth in Y1 then lock
  const isPostTriggerYear = anchor.timing.changeType === 'trigger_once' && year > 1;

  let result: ProjResult;

  switch (anchor.anchorType) {
    case 'macro_series': {
      if (anchor.lineItemId === 'insurance') {
        // Insurance uses geo modifier
        result = projectInsurance(
          baseValue, macroGrowthRate,
          anchor.geoModifiers.insuranceZoneMultiplier,
          anchor.structuralPremium,
          isPostTriggerYear ? 0 : year,
          stateCap
        );
      } else {
        result = projectMacroSeries(
          baseValue, macroGrowthRate, anchor.structuralPremium,
          isPostTriggerYear ? 0 : year, stateCap
        );
      }
      break;
    }
    case 'prev_year_plus_premium': {
      result = projectPrevYearPlusPremium(
        baseValue, anchor.structuralPremium,
        isPostTriggerYear ? 0 : year, stateCap
      );
      break;
    }
    case 'pct_of_egi': {
      // EGI-proportional items grow with EGI naturally
      result = { value: (egiValue ?? baseValue) * (anchor.structuralPremium + 1), growthApplied: 0 };
      break;
    }
    case 'per_unit_fixed': {
      // Fixed per-unit, grows with anchor.structuralPremium
      result = projectMacroSeries(baseValue, 0, anchor.structuralPremium, isPostTriggerYear ? 0 : year, stateCap);
      break;
    }
    case 'fixed_rate': {
      result = { value: baseValue, growthApplied: 0 };
      break;
    }
    default:
      result = { value: baseValue, growthApplied: 0 };
  }

  const confidence: 'high' | 'medium' | 'low' =
    result.growthApplied <= 0.02 ? 'high' :
    result.growthApplied <= 0.05 ? 'medium' : 'low';

  return {
    lineItemId: anchor.lineItemId,
    label: anchor.lineItemLabel,
    year,
    value: result.value,
    anchorValue: baseValue,
    premiumApplied: anchor.structuralPremium,
    triggerApplied: triggerApplied || null,
    confidence,
    ruleOverride: stateReassessmentNote || (stateCap != null ? `${stateCap * 100}% cap` : null),
  };
}

/**
 * Project all line items for all years.
 */
export function projectAllLineItems(
  anchors: LineItemAnchor[],
  baseValues: Map<string, number>,     // lineItemId → Y0 value
  macroGrowthRates: Map<string, number>, // lineItemId → macro growth rate
  horizonYears: number,
  stateCode: string,
  isSaleTrigger: boolean,
  egiValue: number
): ProjectedLineItem[] {
  const stateRules = getStateRules(stateCode);
  const results: ProjectedLineItem[] = [];

  for (const anchor of anchors) {
    const baseValue = baseValues.get(anchor.lineItemId) ?? anchor.defaultValue ?? 0;
    const macroGrowth = macroGrowthRates.get(anchor.lineItemId) ?? 0.02; // default 2%

    for (let year = 0; year <= horizonYears; year++) {
      // Skip Y0 for computed items
      if (year === 0 && anchor.category === 'summary') continue;

      const projected = projectLineItem({
        anchor,
        baseValue: year === 0 ? baseValue : results
          .filter(r => r.lineItemId === anchor.lineItemId)
          .sort((a, b) => b.year - a.year)[0]?.value ?? baseValue,
        macroGrowthRate: macroGrowth,
        year,
        isSaleTrigger: isSaleTrigger && year === 1,
        egiValue: year === 0 ? egiValue :
          results.filter(r => r.lineItemId === 'effective_gross' && r.year === year).map(r => r.value)[0] ?? egiValue,
        stateRules,
      });

      results.push(projected);
    }
  }

  return results;
}
