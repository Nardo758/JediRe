/**
 * F9 Pro Forma — Capsule Blueprint
 * =================================
 *
 * Canonical machine-readable summary of the F9 Pro Forma architecture
 * (see docs/architecture/f9-proforma-spec.md).
 *
 * This blueprint is the SINGLE SOURCE OF TRUTH consumed by:
 *   - Opus (LLM) at prompt-build time, so it never invents fields, modules, or
 *     formulas that don't exist
 *   - The runtime payload validator that gates any pro forma JSON Opus emits
 *   - The drift test that asserts the registry stays in sync with the spec
 *
 * Anytime the spec changes, this object must be updated and the JSON snapshot
 * (./proforma-blueprint.snapshot.json) regenerated.
 */

import type { ModuleId } from '../../module-wiring/module-registry';

// ────────────────────────────────────────────────────────────────────────────
// 1. F-Key map (spec §1)
// ────────────────────────────────────────────────────────────────────────────

export const FKEY_MAP = {
  F1: { module: 'M01', label: 'Overview' },
  F2: { module: 'M02', label: 'Zoning' },
  F3: { module: 'M05', label: 'Market', notes: 'required for M09' },
  F4: { module: 'M04', label: 'Supply' },
  F5: { module: 'M08', label: 'Strategy', notes: 'required + reshape driver for M09' },
  F6: { module: 'M07', label: 'Traffic', notes: 'required only for Construction deals' },
  F7: { module: null, label: 'reserved' },
  F8: { module: 'M11', label: 'Debt/Cap', notes: 'two-pass cycle with F9' },
  F9: { module: 'M09', label: 'Pro Forma', notes: 'HUB — ProForma engine' },
  F10: { module: 'M14', label: 'Risk', notes: 'two-pass cycle with F9' },
  F11: { module: 'M21', label: 'Tools', notes: 'utilities tab (chat / docs / settings); M21 = Opus chat anchor' },
} as const;

export type FKey = keyof typeof FKEY_MAP;

// Backend-only feeders that have no F-key tab
export const HEADLESS_FEEDERS: ModuleId[] = ['M03', 'M06', 'M15', 'M18', 'M19', 'M26', 'M27'];

// ────────────────────────────────────────────────────────────────────────────
// 2. M09 Pro Forma wiring (spec §2)
// ────────────────────────────────────────────────────────────────────────────

/** Modules that MUST or MAY feed into M09 (Pro Forma). */
export const M09_INPUTS: Array<{
  moduleId: ModuleId;
  strength: 'required' | 'optional';
  requiredByDealType?: Array<'existing' | 'development' | 'redevelopment'>;
  dataKeys: string[];
  notes?: string;
}> = [
  { moduleId: 'M01', strength: 'required', dataKeys: ['units', 'property_type', 'address'] },
  { moduleId: 'M02', strength: 'optional', dataKeys: ['zoning_code', 'max_density'] },
  { moduleId: 'M03', strength: 'optional', dataKeys: ['envelope_dimensions', 'max_units_by_right'] },
  { moduleId: 'M04', strength: 'required', dataKeys: ['absorption_rate', 'months_of_supply', 'supply_pressure_score'] },
  { moduleId: 'M05', strength: 'required', dataKeys: ['avg_rent_psf', 'vacancy_rate', 'rent_growth_pct', 'submarket_rank'] },
  { moduleId: 'M06', strength: 'optional', dataKeys: ['demand_units_total', 'demand_score'] },
  { moduleId: 'M07', strength: 'required', requiredByDealType: ['development'], dataKeys: ['absorption_rate', 'capture_rate', 'predicted_leases_week'] },
  { moduleId: 'M08', strength: 'required', dataKeys: ['recommended_strategy', 'template', 'sections', 'horizon', 'periodicity'] },
  { moduleId: 'M10', strength: 'optional', dataKeys: ['probability_weighted_returns', 'monte_carlo_distribution'], notes: 'risk-weighted return inputs' },
  { moduleId: 'M11', strength: 'required', dataKeys: ['loan_terms', 'debt_service', 'effective_interest_rate'], notes: 'two-pass cycle: M09 emits stub NOI -> M11 sizes debt -> M09 finalises' },
  { moduleId: 'M14', strength: 'optional', dataKeys: ['composite_risk_score', 'cap_rate_adjustment_bps', 'reserve_overrides'], notes: 'two-pass cycle: M09 emits NOI -> M14 stress-tests -> M09 absorbs adjustments' },
  { moduleId: 'M15', strength: 'optional', dataKeys: ['rent_comp_data', 'competitive_positioning'] },
  { moduleId: 'M18', strength: 'optional', dataKeys: ['ocr_extracted_data', 'document_index'] },
  { moduleId: 'M26', strength: 'optional', dataKeys: ['projected_total_tax', 'effective_tax_rate'] },
  { moduleId: 'M27', strength: 'optional', dataKeys: ['median_implied_cap_rate', 'median_price_per_unit'] },
  { moduleId: 'M29', strength: 'optional', dataKeys: ['unit_mix_program', 'total_units', 'avg_unit_size_sf', 'rent_by_type'], notes: 'Unit Mix Intelligence — preferred over raw M01.units when available' },
];

/** Bidirectional cycles M09 participates in. */
export const M09_CYCLES: Array<{
  partner: ModuleId;
  description: string;
  passes: string[];
}> = [
  {
    partner: 'M11',
    description: 'Debt sizing two-pass loop',
    passes: [
      'M09 emits stub NOI with placeholder debt service',
      'M11 sizes debt against stub NOI (LTV / DSCR / debt yield)',
      'M11 returns final loan terms',
      'M09 finalises debt service and recomputes cash-on-cash & DSCR',
    ],
  },
  {
    partner: 'M14',
    description: 'Risk validation two-pass loop',
    passes: [
      'M09 emits stabilized NOI and exit cap',
      'M14 stress-tests assumptions; emits cap-rate adjustment basis points and reserve overrides',
      'M09 absorbs adjustments; final returns reflect risk-adjusted view',
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// 3. F5 → F9 template selection (spec §4)
// ────────────────────────────────────────────────────────────────────────────

export type ProFormaTemplateId =
  | 'acquisition_stabilized'
  | 'acquisition_value_add'
  | 'development_ground_up'
  | 'redevelopment'
  | 'flip'
  | 'str_shortterm'
  | 'land_hold';

export interface ProFormaSection {
  id: string;
  title: string;
  /** Whether this section is mandatory for the template or optional. */
  required: boolean;
  /** Field keys that must appear inside the section. */
  fields: string[];
}

export interface ProFormaTemplateSpec {
  id: ProFormaTemplateId;
  label: string;
  /** Strategy (M08) that triggers this template. */
  strategyTriggers: string[];
  /** Hold horizon in months. */
  defaultHorizonMonths: number;
  /** Cash-flow periodicity. */
  periodicity: 'monthly' | 'quarterly' | 'annual';
  /** Ordered list of sections that drive the F9 sub-tab renderer. */
  sections: ProFormaSection[];
}

export const PROFORMA_TEMPLATES: Record<ProFormaTemplateId, ProFormaTemplateSpec> = {
  acquisition_stabilized: {
    id: 'acquisition_stabilized',
    label: 'Acquisition — Stabilized',
    strategyTriggers: ['rental', 'core', 'core_plus'],
    defaultHorizonMonths: 60,
    periodicity: 'annual',
    sections: [
      { id: 'basis', title: 'Acquisition Basis', required: true, fields: ['purchasePrice', 'closingCosts', 'goingInCapRate', 'pricePerUnit'] },
      { id: 'revenue', title: 'Revenue', required: true, fields: ['grossPotentialRent', 'lossToLease', 'concessions', 'effectiveGrossIncome', 'otherIncome'] },
      { id: 'opex', title: 'Operating Expenses', required: true, fields: ['propertyTax', 'insurance', 'utilities', 'repairsMaintenance', 'managementFee', 'payroll', 'marketingAdmin', 'replacementReserves', 'other'] },
      { id: 'noi', title: 'NOI & Cash Flow', required: true, fields: ['netOperatingIncome', 'debtService', 'cashFlowBeforeTax'] },
      { id: 'exit', title: 'Exit', required: true, fields: ['exitCapRate', 'exitValue', 'sellingCosts', 'netSaleProceeds'] },
      { id: 'returns', title: 'Returns', required: true, fields: ['leveredIRR', 'cashOnCash', 'equityMultiple', 'dscr'] },
    ],
  },
  acquisition_value_add: {
    id: 'acquisition_value_add',
    label: 'Acquisition — Value Add',
    strategyTriggers: ['value_add', 'rental_value_add'],
    defaultHorizonMonths: 84,
    periodicity: 'annual',
    sections: [
      { id: 'basis', title: 'Acquisition Basis', required: true, fields: ['purchasePrice', 'closingCosts', 'pricePerUnit'] },
      { id: 'capex', title: 'Renovation Budget', required: true, fields: ['hardCosts', 'softCosts', 'contingency', 'capexPerUnit', 'renovationTimelineMonths'] },
      { id: 'revenue', title: 'Revenue (rent ramp)', required: true, fields: ['inPlaceRent', 'newLeaseRent', 'renewalRent', 'lossToLease', 'concessions', 'rentRampSchedule'] },
      { id: 'opex', title: 'Operating Expenses', required: true, fields: ['propertyTax', 'insurance', 'utilities', 'repairsMaintenance', 'managementFee', 'payroll', 'marketingAdmin', 'replacementReserves', 'other'] },
      { id: 'noi', title: 'NOI & Cash Flow', required: true, fields: ['netOperatingIncome', 'debtService', 'cashFlowBeforeTax'] },
      { id: 'exit', title: 'Exit', required: true, fields: ['exitCapRate', 'exitValue', 'sellingCosts'] },
      { id: 'returns', title: 'Returns', required: true, fields: ['leveredIRR', 'cashOnCash', 'equityMultiple', 'dscr', 'developmentSpread'] },
    ],
  },
  development_ground_up: {
    id: 'development_ground_up',
    label: 'Development — Ground-Up',
    strategyTriggers: ['bts', 'bts_for_rent', 'build_to_sell', 'development', 'ground_up'],
    defaultHorizonMonths: 120,
    periodicity: 'monthly',
    sections: [
      { id: 'land', title: 'Land Acquisition', required: true, fields: ['landCost', 'closingCosts', 'predevelopment'] },
      { id: 'hard_costs', title: 'Hard Costs', required: true, fields: ['residential', 'parking', 'amenities', 'siteWork', 'contingency'] },
      { id: 'soft_costs', title: 'Soft Costs', required: true, fields: ['architectureEngineering', 'legalPermitting', 'financing', 'marketing', 'developerFee'] },
      { id: 'construction_schedule', title: 'Construction Schedule', required: true, fields: ['constructionMonths', 'leaseUpMonths', 'absorptionUnitsPerMonth', 'stabilizationMonth'] },
      { id: 'revenue', title: 'Revenue at Stabilization', required: true, fields: ['marketRent', 'concessions', 'effectiveGrossIncome', 'otherIncome'] },
      { id: 'opex', title: 'Stabilized Operating Expenses', required: true, fields: ['propertyTax', 'insurance', 'utilities', 'repairsMaintenance', 'managementFee', 'payroll', 'marketingAdmin', 'replacementReserves', 'other'] },
      { id: 'noi', title: 'Stabilized NOI', required: true, fields: ['netOperatingIncome', 'debtService', 'cashFlowBeforeTax'] },
      { id: 'exit', title: 'Exit (sell or refinance)', required: true, fields: ['exitCapRate', 'exitValue', 'sellingCosts', 'refinanceProceeds'] },
      { id: 'returns', title: 'Returns', required: true, fields: ['leveredIRR', 'unleveredIRR', 'yieldOnCost', 'developmentSpread', 'equityMultiple'] },
    ],
  },
  redevelopment: {
    id: 'redevelopment',
    label: 'Redevelopment',
    strategyTriggers: ['redevelopment', 'reposition', 'gut_rehab'],
    defaultHorizonMonths: 96,
    periodicity: 'monthly',
    sections: [
      { id: 'basis', title: 'Acquisition Basis', required: true, fields: ['purchasePrice', 'closingCosts'] },
      { id: 'demo_capex', title: 'Demo & Renovation Budget', required: true, fields: ['demoCosts', 'hardCosts', 'softCosts', 'contingency'] },
      { id: 'phasing', title: 'Phasing & Lease-Up', required: true, fields: ['phasingPlan', 'unitsOnlinePerPhase', 'lossOfRentDuringRenovation'] },
      { id: 'revenue', title: 'Revenue', required: true, fields: ['inPlaceRent', 'marketRent', 'newLeaseRent', 'concessions', 'effectiveGrossIncome'] },
      { id: 'opex', title: 'Operating Expenses', required: true, fields: ['propertyTax', 'insurance', 'utilities', 'repairsMaintenance', 'managementFee', 'payroll', 'marketingAdmin', 'replacementReserves', 'other'] },
      { id: 'noi', title: 'NOI & Cash Flow', required: true, fields: ['netOperatingIncome', 'debtService', 'cashFlowBeforeTax'] },
      { id: 'exit', title: 'Exit', required: true, fields: ['exitCapRate', 'exitValue', 'sellingCosts'] },
      { id: 'returns', title: 'Returns', required: true, fields: ['leveredIRR', 'unleveredIRR', 'equityMultiple', 'developmentSpread'] },
    ],
  },
  flip: {
    id: 'flip',
    label: 'Flip — Acquisition + Resale',
    strategyTriggers: ['flip'],
    defaultHorizonMonths: 18,
    periodicity: 'monthly',
    sections: [
      { id: 'basis', title: 'Acquisition Basis', required: true, fields: ['purchasePrice', 'closingCosts'] },
      { id: 'capex', title: 'Renovation Budget', required: true, fields: ['hardCosts', 'softCosts', 'contingency', 'renovationTimelineMonths'] },
      { id: 'carry', title: 'Holding Costs', required: true, fields: ['propertyTax', 'insurance', 'utilities', 'debtService'] },
      { id: 'exit', title: 'Resale', required: true, fields: ['exitPrice', 'sellingCosts', 'netSaleProceeds'] },
      { id: 'returns', title: 'Returns', required: true, fields: ['profitMargin', 'cashOnCash', 'leveredIRR', 'monthsHeld'] },
    ],
  },
  str_shortterm: {
    id: 'str_shortterm',
    label: 'Short-Term Rental',
    strategyTriggers: ['str', 'short_term_rental'],
    defaultHorizonMonths: 60,
    periodicity: 'monthly',
    sections: [
      { id: 'basis', title: 'Acquisition Basis', required: true, fields: ['purchasePrice', 'closingCosts', 'furnishingBudget'] },
      { id: 'revenue', title: 'STR Revenue', required: true, fields: ['adr', 'occupancyRate', 'revPar', 'cleaningFees', 'platformFees', 'effectiveGrossIncome'] },
      { id: 'opex', title: 'Operating Expenses', required: true, fields: ['propertyTax', 'insurance', 'utilities', 'repairsMaintenance', 'managementFee', 'cleaningPayroll', 'marketingAdmin', 'replacementReserves', 'other'] },
      { id: 'noi', title: 'NOI & Cash Flow', required: true, fields: ['netOperatingIncome', 'debtService', 'cashFlowBeforeTax'] },
      { id: 'returns', title: 'Returns', required: true, fields: ['leveredIRR', 'cashOnCash', 'equityMultiple', 'revPar'] },
    ],
  },
  land_hold: {
    id: 'land_hold',
    label: 'Land Hold',
    strategyTriggers: ['land', 'land_hold'],
    defaultHorizonMonths: 60,
    periodicity: 'annual',
    sections: [
      { id: 'basis', title: 'Land Acquisition', required: true, fields: ['landCost', 'closingCosts'] },
      { id: 'carry', title: 'Holding Costs', required: true, fields: ['propertyTax', 'insurance', 'debtService', 'maintenance'] },
      { id: 'exit', title: 'Exit', required: true, fields: ['exitPrice', 'sellingCosts'] },
      { id: 'returns', title: 'Returns', required: true, fields: ['leveredIRR', 'profitMargin'] },
    ],
  },
};

// ────────────────────────────────────────────────────────────────────────────
// 4. Rent terminology (spec §5)
// ────────────────────────────────────────────────────────────────────────────

export const RENT_TERMS = {
  grossPotentialRent: 'Sum of contracted rent across all units at full occupancy.',
  marketRent: 'What a unit would lease for today on a new lease, no concessions.',
  inPlaceRent: 'Rent currently being paid by existing tenants.',
  effectiveRent: 'Market rent net of concessions and free rent.',
  concessions: 'Free months, gift cards, look-and-lease, amortised over lease term.',
  lossToLease: 'Market rent minus in-place rent, expressed as % of GPR.',
  newLeaseRent: 'Rent on a brand-new lease (move-in).',
  renewalRent: 'Rent on a renewing tenant (typically below new-lease).',
  rentRampSchedule: 'Month-by-month schedule of rent increases for value-add deals.',
} as const;

export type RentTerm = keyof typeof RENT_TERMS;

// ────────────────────────────────────────────────────────────────────────────
// 5. OPEX 9-line stack (spec §7)
// ────────────────────────────────────────────────────────────────────────────

/**
 * OPEX line items with their cycle drivers — concrete external indicator
 * mappings per spec §14 calibration TBD. Each line carries:
 *   - `growthDriver`: legacy short string (kept for back-compat)
 *   - `cycleDriver`: structured indicator metadata for the cycle component
 *
 * Mapping rationale:
 *   - propertyTax     → M26 county millage projections (intra-platform)
 *   - insurance       → reinsurance hardening (Guy Carpenter property
 *                       reinsurance index — calibrate annually)
 *   - utilities       → BLS CPI Energy Services (CUUR0000SEHF)
 *   - repairsMaint    → BLS PPI maintenance & repair services (PCU8113)
 *   - managementFee   → couples to revenue (no external driver)
 *   - payroll         → BLS Employment Cost Index, services (CIU2010000000000A)
 *   - marketingAdmin  → BLS CPI All-Items (CUSR0000SA0)
 *   - replacementRes  → BLS CPI All-Items + age curve
 *   - other           → BLS CPI All-Items
 */
export const OPEX_LINE_ITEMS = [
  {
    key: 'propertyTax',
    label: 'Property Tax',
    growthDriver: 'M26.tax_growth',
    cycleDriver: {
      code: 'm26_county_millage',
      label: 'County Millage Projections (M26)',
      source: 'platform_intra',
      seriesId: null,
    },
  },
  {
    key: 'insurance',
    label: 'Insurance',
    growthDriver: 'platform.insurance_growth',
    cycleDriver: {
      code: 'reinsurance_hardening',
      label: 'Property Reinsurance Hardening Index (Guy Carpenter)',
      source: 'gc_reinsurance_index',
      seriesId: null,
    },
  },
  {
    key: 'utilities',
    label: 'Utilities',
    growthDriver: 'cpi',
    cycleDriver: {
      code: 'bls_cpi_energy_services',
      label: 'BLS CPI Energy Services',
      source: 'bls',
      seriesId: 'CUUR0000SEHF',
    },
  },
  {
    key: 'repairsMaintenance',
    label: 'Repairs & Maintenance',
    growthDriver: 'cpi',
    cycleDriver: {
      code: 'bls_ppi_maintenance_repair',
      label: 'BLS PPI Maintenance & Repair Services',
      source: 'bls',
      seriesId: 'PCU8113',
    },
  },
  {
    key: 'managementFee',
    label: 'Property Management',
    growthDriver: 'pct_of_egi',
    cycleDriver: {
      code: 'couples_to_revenue',
      label: 'Auto-couples to revenue (no external driver)',
      source: 'derived',
      seriesId: null,
    },
  },
  {
    key: 'payroll',
    label: 'On-site Payroll',
    growthDriver: 'wage_index',
    cycleDriver: {
      code: 'bls_eci_services',
      label: 'BLS Employment Cost Index — Services',
      source: 'bls',
      seriesId: 'CIU2010000000000A',
    },
  },
  {
    key: 'marketingAdmin',
    label: 'Marketing & Admin',
    growthDriver: 'cpi',
    cycleDriver: {
      code: 'bls_cpi_all_items',
      label: 'BLS CPI All-Items',
      source: 'bls',
      seriesId: 'CUSR0000SA0',
    },
  },
  {
    key: 'replacementReserves',
    label: 'Replacement Reserves',
    growthDriver: 'cpi',
    cycleDriver: {
      code: 'bls_cpi_all_items',
      label: 'BLS CPI All-Items + age curve',
      source: 'bls',
      seriesId: 'CUSR0000SA0',
    },
  },
  {
    key: 'other',
    label: 'Other / Misc',
    growthDriver: 'cpi',
    cycleDriver: {
      code: 'bls_cpi_all_items',
      label: 'BLS CPI All-Items',
      source: 'bls',
      seriesId: 'CUSR0000SA0',
    },
  },
] as const;

export type OpexLineKey = typeof OPEX_LINE_ITEMS[number]['key'];

export const OPEX_CYCLE_DRIVER_CALIBRATION = {
  asOf: '2026-04-29',
  source: 'spec §14: per-line cycle driver mapping',
  calibrationStatus: 'partial' as const,
  notes:
    'BLS series IDs are upstream-stable; insurance reinsurance index requires ' +
    'a paid Guy Carpenter feed and is currently a calibration TBD.',
} as const;

/**
 * Mapping from each blueprint OPEX line (camelCase) to one or more keys the
 * financial-model engine / proforma-seeder emit (snake_case). This is the
 * adapter the engine drift test exercises: every blueprint line MUST map to
 * at least one engine key, and every engine key MUST be claimed by at least
 * one blueprint line. If a renamed engine key breaks the mapping, the drift
 * test fails immediately.
 */
export const BLUEPRINT_TO_ENGINE_OPEX_MAP: Record<OpexLineKey, readonly string[]> = {
  propertyTax: ['real_estate_tax', 'personal_property_tax'],
  insurance: ['insurance'],
  utilities: ['utilities'],
  repairsMaintenance: ['repairs_maintenance', 'turnover'],
  managementFee: ['management_fee'],
  payroll: ['payroll'],
  marketingAdmin: ['marketing', 'g_and_a'],
  replacementReserves: ['replacement_reserves'],
  other: ['contract_services', 'hoa_dues'],
};

// ────────────────────────────────────────────────────────────────────────────
// 5b. Per-strategy template tuning (spec §15 Tier 3)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Strategy-specific knobs that fine-tune the generic template behaviour.
 * Each template has either a tuning record or `null` (no special tuning).
 *
 *   - BTS (development_ground_up): `growthTruncationYear` — most BTS deals
 *     model exit by Y3, so rent + OPEX growth are flat / zero past that
 *     year (no perpetual compounding).
 *
 *   - STR (str_shortterm): `seasonalOccupancyFactors` — 12-month
 *     multipliers around 1.0 (peak summer >1, shoulder seasons <1) to
 *     replace flat occupancy assumptions. Anchor metric is
 *     ADR × occupancy × 365.
 *
 * Other templates currently have no special tuning and are listed as `null`
 * so the registry remains exhaustive.
 */
export interface StrategyTemplateTuning {
  /** Year past which rent + OPEX growth is truncated (set to 0). */
  growthTruncationYear?: number;
  /**
   * 12-element array of monthly occupancy multipliers (Jan..Dec).
   * Multipliers should average ~1.0 across the year. Used by STR to
   * project ADR × occupancy × days.
   */
  seasonalOccupancyFactors?: ReadonlyArray<number>;
  /** Optional notes — surfaced in F9 for transparency. */
  notes?: string;
}

export const STRATEGY_TEMPLATE_TUNING: Record<
  ProFormaTemplateId,
  StrategyTemplateTuning | null
> = {
  acquisition_stabilized: null,
  acquisition_value_add: null,
  development_ground_up: {
    growthTruncationYear: 3,
    notes:
      'BTS deals typically exit by Y3 — growth past that year is held at 0 ' +
      'to avoid stacking optimistic perpetual growth onto an exit value.',
  },
  redevelopment: null,
  flip: {
    growthTruncationYear: 1,
    notes: 'Flips have ~12-18mo holds; growth is effectively a single-period delta.',
  },
  str_shortterm: {
    // Default seasonal pattern: gulf-coast / sun-belt vacation profile —
    // peak Mar-Jul, dip Sep-Nov. Average across the 12 months ≈ 1.00.
    seasonalOccupancyFactors: [
      0.92, 0.95, 1.10, 1.15, 1.20, 1.18,  // Jan-Jun
      1.10, 1.05, 0.85, 0.82, 0.85, 0.83,  // Jul-Dec
    ],
    notes:
      'Seasonal occupancy multipliers replace flat occupancy. Pattern is a ' +
      'sun-belt default; calibrate per-market when bookings data is available.',
  },
  land_hold: null,
};

/**
 * Apply template-specific growth tuning. Today this implements the BTS /
 * Flip Y{N}+ truncation rule: any year strictly greater than
 * `growthTruncationYear` returns 0; earlier years pass through unchanged.
 *
 * Returns the input growth verbatim when no tuning applies.
 */
export function applyTemplateGrowthTuning(
  templateId: ProFormaTemplateId,
  year: number,
  growth: number,
): number {
  const tuning = STRATEGY_TEMPLATE_TUNING[templateId];
  if (!tuning) return growth;
  if (
    typeof tuning.growthTruncationYear === 'number' &&
    year > tuning.growthTruncationYear
  ) {
    return 0;
  }
  return growth;
}

/**
 * Resolve the seasonal occupancy multiplier for an STR template at the
 * given month (1-12). Returns 1.0 (flat occupancy) when no seasonal series
 * is configured.
 */
export function resolveSeasonalOccupancyFactor(
  templateId: ProFormaTemplateId,
  month: number,
): number {
  const tuning = STRATEGY_TEMPLATE_TUNING[templateId];
  const factors = tuning?.seasonalOccupancyFactors;
  if (!factors || factors.length !== 12) return 1.0;
  const idx = Math.min(11, Math.max(0, month - 1));
  return factors[idx] ?? 1.0;
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Revenue formulas (spec §11)
// ────────────────────────────────────────────────────────────────────────────

export type RevenueFormulaId =
  | 'mark_to_market'         // DEFAULT — every unit re-rents at market on turnover
  | 'in_place_compounding'   // legacy: in-place rent grown by rent_growth
  | 'renewal_aware'          // splits new-lease vs renewal rent (Tier 3)
  | 'rent_ramp_value_add'    // explicit month-by-month ramp (value-add)
  | 'gpr_minus_loss_to_lease'; // GPR adjusted for loss-to-lease

export interface RevenueFormulaSpec {
  id: RevenueFormulaId;
  label: string;
  description: string;
  inputs: string[];
  isDefault: boolean;
  /** Asset-class strategies the formula is sensible for. */
  appropriateFor: string[];
}

export const REVENUE_FORMULAS: Record<RevenueFormulaId, RevenueFormulaSpec> = {
  mark_to_market: {
    id: 'mark_to_market',
    label: 'Mark-to-Market (default)',
    description: 'New leases at market rent, weighted by turnover. Closes the loss-to-lease gap as turnover progresses.',
    inputs: ['marketRent', 'inPlaceRent', 'turnoverRatePerYear', 'rentGrowth', 'concessions', 'vacancy'],
    isDefault: true,
    appropriateFor: ['rental', 'value_add', 'development', 'redevelopment'],
  },
  in_place_compounding: {
    id: 'in_place_compounding',
    label: 'In-Place Compounding (legacy)',
    description: 'Year-1 in-place rent compounded by rent_growth. Ignores loss-to-lease.',
    inputs: ['inPlaceRent', 'rentGrowth', 'vacancy'],
    isDefault: false,
    appropriateFor: ['rental'],
  },
  renewal_aware: {
    id: 'renewal_aware',
    label: 'Renewal-Aware (Tier 3)',
    description: 'Splits new-lease rent and renewal rent with separate growth rates.',
    inputs: ['newLeaseRent', 'renewalRent', 'turnoverRatePerYear', 'newLeaseGrowth', 'renewalGrowth', 'concessions', 'vacancy'],
    isDefault: false,
    appropriateFor: ['rental', 'value_add'],
  },
  rent_ramp_value_add: {
    id: 'rent_ramp_value_add',
    label: 'Rent Ramp (Value-Add)',
    description: 'Explicit month-by-month rent schedule following the renovation timeline.',
    inputs: ['inPlaceRent', 'postRenoRent', 'renovationTimelineMonths', 'unitsRenovatedPerMonth', 'concessions', 'vacancy'],
    isDefault: false,
    appropriateFor: ['value_add', 'redevelopment'],
  },
  gpr_minus_loss_to_lease: {
    id: 'gpr_minus_loss_to_lease',
    label: 'GPR − Loss-to-Lease',
    description: 'Top-down: gross potential rent reduced by an explicit loss-to-lease percentage.',
    inputs: ['grossPotentialRent', 'lossToLeasePct', 'concessions', 'vacancy'],
    isDefault: false,
    appropriateFor: ['rental', 'redevelopment'],
  },
};

export const DEFAULT_REVENUE_FORMULA: RevenueFormulaId = 'mark_to_market';

// ────────────────────────────────────────────────────────────────────────────
// 7. Provenance + confidence (spec §9, §12)
// ────────────────────────────────────────────────────────────────────────────

export const PROVENANCE_RULES = {
  resolutionOrder: ['user', 'platform', 'broker'] as const,
  qualityBands: {
    green: { minConfidence: 0.75, behaviour: 'use as-is' },
    yellow: { minConfidence: 0.45, behaviour: 'use with warning banner' },
    red: { minConfidence: 0, behaviour: 'reject — surface "missing" until upgraded' },
  },
  refusalThreshold: 0.45,
};

// ────────────────────────────────────────────────────────────────────────────
// 8. Composite blueprint object
// ────────────────────────────────────────────────────────────────────────────

export const PROFORMA_BLUEPRINT = {
  version: '2.1.0',
  specPath: 'docs/architecture/f9-proforma-spec.md',
  generatedAt: '2026-04-29T00:00:00.000Z',
  fkeyMap: FKEY_MAP,
  headlessFeeders: HEADLESS_FEEDERS,
  m09Inputs: M09_INPUTS,
  m09Cycles: M09_CYCLES,
  templates: PROFORMA_TEMPLATES,
  templateTuning: STRATEGY_TEMPLATE_TUNING,
  rentTerms: RENT_TERMS,
  opexLineItems: OPEX_LINE_ITEMS,
  opexCycleDriverCalibration: OPEX_CYCLE_DRIVER_CALIBRATION,
  revenueFormulas: REVENUE_FORMULAS,
  defaultRevenueFormula: DEFAULT_REVENUE_FORMULA,
  provenanceRules: PROVENANCE_RULES,
} as const;

export type ProFormaBlueprint = typeof PROFORMA_BLUEPRINT;
