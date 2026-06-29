/**
 * Periodic field model types — Phase 2 of the timeline infrastructure.
 *
 * Replaces the single-value-per-field `ProFormaYear1Seed` with a period-indexed
 * series where each month carries its own resolved value, resolution, and zone
 * type (actual / gap / projection / override).
 *
 * The periodic model is backward-compatible: existing `ProFormaYear1Seed` seeds
 * can be converted to `ProFormaPeriodicSeed` via `buildPeriodicSeed()`.
 */

import type { LayeredValue } from '../document-extraction/types';
import type { BoundaryContext, PeriodZoneType } from './boundary.types';

// ─────────────────────────────────────────────────────────────────────────────
// Core periodic types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single period (month) in a field's timeline.
 */
export interface PeriodLayeredValue {
  /** Period index: 0 = first month of the timeline (e.g., T12-start or acquisition - 12mo). */
  periodIndex: number;

  /** Month in ISO format: YYYY-MM. */
  month: string;

  /** Resolved value for this field at this period. */
  resolved: number | null;

  /** How this value was determined at this period. */
  resolution: 'actual' | 'derived_gap' | 'assumption_trend' | 'platform_default' | 'operator_override' | 'agent' | 'computed' | 'unresolved' | 'year1_accrual';

  /** Source tag for provenance tracking. */
  source: string | null;

  /** Which timeline zone this period belongs to. */
  zone: PeriodZoneType;

  /** Raw extraction value if this period came from T12 (actuals zone). */
  raw?: number | null;

  /** Timestamp when this period value was set. */
  updated_at?: string;
}

/**
 * A field's full timeline — one `PeriodLayeredValue` per month.
 */
export interface PeriodicFieldSeries {
  /** Canonical field name (e.g., 'gpr', 'noi', 'vacancy_pct'). */
  fieldName: string;

  /** Ordered array of period values (month 0 → N). */
  periods: PeriodLayeredValue[];

  /** The single "best" resolved value for display when period is not specified. */
  fallbackResolved: number | null;

  /** The single "best" resolution for display. */
  fallbackResolution: string;

  /** The single "best" source for display. */
  fallbackSource: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ProFormaPeriodicSeed — replaces ProFormaYear1Seed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Period-aware seed that replaces the single-value `ProFormaYear1Seed`.
 * Every field is a `PeriodicFieldSeries` with per-month granularity.
 */
export interface ProFormaPeriodicSeed {
  /** Each canonical field as a full timeline. */
  fields: Record<string, PeriodicFieldSeries>;

  /** Boundary context: where actuals end, projection begins, gap lives. */
  boundary: BoundaryContext;

  /** Total unit count (used for per-unit calculations). */
  unitCount: number;

  /** Document provenance (same as ProFormaYear1Seed.source_docs). */
  sourceDocs: {
    t12_doc_id?: string;
    rent_roll_doc_id?: string;
    tax_bill_doc_id?: string;
    om_doc_id?: string;
  };

  /** When this periodic seed was built. */
  last_seeded_at: string;

  /** Metadata for the seeder / DQA. */
  _meta?: {
    warnings: string[];
    fields_seeded: number;
    resolved_noi: number | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion / builder types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input for building a periodic seed from a single-value year1 seed.
 */
export interface BuildPeriodicSeedInput {
  /** The existing single-value seed (from buildSeed). */
  year1Seed: Record<string, unknown>;

  /** T12 month array (from Phase 0 — extraction_t12.months). */
  t12Months?: Array<Record<string, unknown>>;

  /** Boundary context (from Phase 1). */
  boundary: BoundaryContext;

  /** Total unit count. */
  unitCount: number;

  /** Number of projection months to generate (default: 120 = 10 years). */
  projectionMonths?: number;

  /** Document provenance. */
  sourceDocs?: ProFormaPeriodicSeed['sourceDocs'];
}

/**
 * Map from canonical field name to T12 month column name.
 * Used when extracting actuals from T12 months array.
 */
export const FIELD_TO_T12_COLUMN: Record<string, string> = {
  gpr: 'grossPotentialRent',
  loss_to_lease: 'lossToLease',
  vacancy_loss: 'vacancyLoss',
  concessions: 'concessions',
  bad_debt: 'badDebt',
  net_rental_income: 'netRentalIncome',
  other_income: 'otherIncome',
  effective_gross_income: 'effectiveGrossIncome',
  egi: 'effectiveGrossIncome',          // canonical name → same T12 column
  payroll: 'payroll',
  repairs_maintenance: 'repairsMaintenance',
  turnover: 'turnoverCosts',
  amenities: 'amenities',
  marketing: 'marketing',
  contract_services: 'contractServices',
  office: 'adminGeneral',  // T12 uses adminGeneral, we use office
  g_and_a: 'adminGeneral',
  hoa_dues: 'hoaDues',
  utilities: 'utilities',
  management_fee_pct: 'managementFee',
  insurance: 'insurance',
  property_tax: 'propertyTax',
  real_estate_tax: 'propertyTax',       // canonical name → same T12 column
  total_opex: 'totalOpex',
  noi: 'noi',
  total_units: 'totalUnits',
  occupied_units: 'occupiedUnits',
};

/**
 * Fields that are stored as percentages in the seed but as raw numbers in T12.
 * These need to be divided by GPR or EGI when extracting from T12.
 */
export const PERCENTAGE_FIELDS = new Set([
  'loss_to_lease_pct',
  'vacancy_pct',
  'concessions_pct',
  'bad_debt_pct',
  'non_revenue_units_pct',
  'management_fee_pct',
]);

/**
 * Dollar fields whose annual grid value is a SUM of monthly values (not an AVG).
 *
 * When a month in the actual zone has no T12/actuals coverage, the seeder
 * falls back to the year1 seed's resolved value — which is an ANNUAL figure.
 * Writing that annual figure verbatim into a monthly slot causes 12× inflation
 * when the grid sums 12 slots for the year column.
 *
 * For every field in this set, the NULL-coverage fallback writes
 * `year1_annual ÷ 12` (monthly accrual) tagged as `resolution: 'year1_accrual'`,
 * so the annual SUM of 12 accruals equals the year1 annual figure — not 12×.
 *
 * Rate fields (vacancy_pct, bad_debt_pct, etc.) and per-unit AVG fields
 * (noi_per_unit, other_income_per_unit) are intentionally excluded: a constant
 * rate in → AVG rollup → correct rate out, no ÷12 needed.
 */
export const SUM_ROLLUP_DOLLAR_FIELDS = new Set([
  'gpr',
  'net_rental_income',
  'egi',
  'payroll',
  'repairs_maintenance',
  'turnover',
  'amenities',
  'contract_services',
  'marketing',
  'office',
  'g_and_a',
  'hoa_dues',
  'utilities',
  'water_sewer',
  'electric',
  'gas_fuel',
  'landscaping',
  'insurance',
  'real_estate_tax',
  'personal_property_tax',
  'replacement_reserves',
  'total_opex',
  'noi',
]);
