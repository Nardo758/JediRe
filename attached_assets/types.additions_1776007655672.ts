// ============================================================================
// types.ts — ADDITIONS
// Add these to backend/src/services/document-extraction/types.ts
// (Keeps existing types; only adds new ones.)
// ============================================================================

/**
 * Chart-of-accounts format detected during parsing.
 * Drives downstream normalization and tells the capsule which conventions
 * to apply (Yardi indents, RealPage hierarchy depth, etc.).
 */
export type ChartFormat =
  | 'yardi_accrual'      // Yardi Voyager IS export, GL-coded with indented descriptions
  | 'yardi_cash'
  | 'realpage'           // RealPage OneSite Financials
  | 'appfolio'           // AppFolio Property Manager
  | 'entrata'
  | 'mri'
  | 'generic_columnar'   // single-row-per-period, no GL codes
  | 'unknown';

/**
 * Rent-roll layout variant.
 */
export type RentRollLayout =
  | 'yardi_rrwlc'        // Rent Roll with Lease Charges — stacked charge-code sub-rows per unit
  | 'yardi_rr'           // Standard rent roll, one row per unit
  | 'realpage_unit_grid'
  | 'appfolio_unit_grid'
  | 'generic_flat'
  | 'unknown';

/**
 * Three-layer assumption value with full provenance.
 * `platform` = baseline derived from APIs (FRED, Census, RentCast, comp set, etc.)
 * `t12`, `rent_roll`, `tax_bill`, `box_score`, `aged_ar`, `om` = property-specific extractions
 * `override` = explicit user edit; always wins if non-null
 *
 * `resolved` = the value the proforma actually uses
 * `resolution` = which layer won
 */
export interface LayeredValue<T = number> {
  platform: T | null;
  t12?: T | null;
  rent_roll?: T | null;
  tax_bill?: T | null;
  box_score?: T | null;
  aged_ar?: T | null;
  om?: T | null;
  override: T | null;
  resolved: T | null;
  resolution:
    | 'platform'
    | 't12'
    | 'rent_roll'
    | 'tax_bill'
    | 'box_score'
    | 'aged_ar'
    | 'om'
    | 'override'
    | 'platform_fallback';
  warning?: string;
  scenarios?: Record<string, T>;       // e.g. { downside: 2040293, upside: 1500000 }
  updated_at: string;                  // ISO timestamp
  updated_by?: string;                 // user id when override
}

/**
 * Year-1 ProForma seed shape — the canonical contract between extraction and M09.
 * Stored on `deal_assumptions.year1` as JSONB.
 */
export interface ProFormaYear1Seed {
  // Revenue
  gpr: LayeredValue<number>;                          // annual gross potential rent
  loss_to_lease_pct: LayeredValue<number>;
  vacancy_pct: LayeredValue<number>;
  concessions_pct: LayeredValue<number>;
  bad_debt_pct: LayeredValue<number>;
  non_revenue_units_pct: LayeredValue<number>;        // employee/courtesy/model
  net_rental_income: LayeredValue<number>;            // derived
  other_income_per_unit: LayeredValue<number>;
  other_income_breakdown: {
    parking: LayeredValue<number>;
    pet: LayeredValue<number>;
    storage: LayeredValue<number>;
    laundry: LayeredValue<number>;
    rubs: LayeredValue<number>;                       // utility reimbursement
    fees: LayeredValue<number>;                       // late, app, admin
    insurance_admin: LayeredValue<number>;
    other: LayeredValue<number>;
  };
  egi: LayeredValue<number>;                          // derived
  // OpEx
  payroll: LayeredValue<number>;
  repairs_maintenance: LayeredValue<number>;
  turnover: LayeredValue<number>;
  amenities: LayeredValue<number>;
  contract_services: LayeredValue<number>;
  marketing: LayeredValue<number>;
  office: LayeredValue<number>;
  g_and_a: LayeredValue<number>;
  hoa_dues: LayeredValue<number>;
  utilities: LayeredValue<number>;
  management_fee_pct: LayeredValue<number>;
  insurance: LayeredValue<number>;                    // CRITICAL — often missing from T12
  real_estate_tax: LayeredValue<number>;
  personal_property_tax: LayeredValue<number>;
  total_opex: LayeredValue<number>;                   // derived
  // Result
  noi: LayeredValue<number>;                          // derived
  noi_per_unit: LayeredValue<number>;                 // derived
  // Provenance summary
  source_docs: {
    t12_doc_id?: string;
    rent_roll_doc_id?: string;
    tax_bill_doc_id?: string;
    box_score_doc_id?: string;
    aged_ar_doc_id?: string;
    om_doc_id?: string;
  };
  last_seeded_at: string;
}

/**
 * Expanded capsule key for T12 extraction.
 * Replaces the existing `extraction_t12` shape in deals.deal_data.
 */
export interface ExtractionT12Capsule {
  source: 'platform';
  updatedAt: string;
  chart_format: ChartFormat;
  document_id: string;
  period_start: string;        // YYYY-MM
  period_end: string;
  months_captured: number;
  // Revenue
  gpr: number;
  loss_to_lease: number;
  loss_to_lease_pct: number;
  concessions: { one_time: number; renewal: number; total: number };
  vacancy_loss: number;
  vacancy_loss_pct: number;
  non_revenue_units: number;   // employee + courtesy + model
  bad_debt: { gross: number; recovery: number; net: number };
  net_rental_income: number;
  other_income: {
    total: number;
    breakdown: Record<string, number>;   // raw GL-mapped categories
  };
  egi: number;
  // OpEx
  opex: {
    payroll: number;
    r_and_m: number;
    turnover: number;
    amenities: number;
    contract: number;
    marketing: number;
    office: number;
    g_and_a: number;
    hoa_dues: number;            // pulled out of g_and_a if found
    utilities: number;
    mgmt_fee: number;
    real_estate_tax: number;
    personal_property_tax: number;
    insurance: number | null;    // null if not broken out — flag for platform fallback
    total: number;
  };
  noi: number;
  // Derived ratios
  expense_ratio: number;
  noi_margin: number;
  mgmt_fee_pct_of_egi: number;
  warnings: string[];            // e.g. ["No insurance line in T12"]
}

/**
 * Expanded capsule key for Rent Roll extraction.
 */
export interface ExtractionRentRollCapsule {
  source: 'platform';
  updatedAt: string;
  layout: RentRollLayout;
  document_id: string;
  as_of_date: string;
  source_system_id: string | null;       // e.g. "gaaltpor" for Yardi
  // Counts
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  non_revenue_units: number;
  future_residents: number;              // pre-leased pipeline
  // Income aggregates (monthly)
  gpr_monthly: number;
  in_place_rent_monthly: number;
  loss_to_lease_monthly: number;
  loss_to_lease_pct: number;
  vacancy_loss_monthly: number;
  concessions_monthly: number;
  total_billings_monthly: number;        // EGI proxy
  // Income aggregates (annualized × 12)
  egi_in_place_annualized: number;
  // Per-unit metrics
  avg_market_rent: number;
  avg_effective_rent: number;
  avg_unit_sqft: number;
  total_rentable_sqft: number;
  // Occupancy
  occupancy_by_unit_pct: number;
  occupancy_by_sqft_pct: number;
  // Charge code breakdown (aggregated monthly $)
  charge_codes: Record<string, number>;
  // Other income inferred from charge codes
  other_income_monthly: {
    parking: number;
    pet_rent: number;
    storage: number;
    rubs: number;                        // pestctrl + trash + utility rebill
    fees: number;                        // mtm + termination + misc
    insurance_admin: number;             // liability insurance fees
    concessions_other: number;           // empdisc, otconc, patrol, renew
    other: number;
  };
  // Floor plan / unit mix breakdown
  floor_plan_mix: Record<string, {
    count: number;
    avg_sqft: number;
    total_sqft: number;
    avg_market_rent: number;
    avg_effective_rent: number;
    occupancy_pct: number;
  }>;
  // Bedroom rollup (Studio/1BR/2BR/3BR/4BR+)
  bedroom_mix: Record<string, { count: number; pct: number; avg_rent: number }>;
  // Risk metrics
  outstanding_balance_total: number;
  outstanding_balance_ratio: number;     // / monthly billings — AR exposure proxy
  security_deposits_held: number;
  pre_lease_ratio: number;               // future / vacant
  // Lease expiration roll
  expiration_curve: {
    months_0_3: number;
    months_3_6: number;
    months_6_12: number;
    months_12_plus: number;
    mtm: number;
  };
  // Quality flags
  warnings: string[];
}

/**
 * Cross-document variance alert payload (written to platform_intel).
 */
export interface CrossDocVariance {
  metric: string;                       // e.g. "annual_property_tax"
  doc_a: { source: string; value: number; doc_id: string };
  doc_b: { source: string; value: number; doc_id: string };
  delta_abs: number;
  delta_pct: number;
  severity: 'info' | 'warning' | 'critical';
  scenarios?: Record<string, number>;   // e.g. { proforma_downside: 2040293 }
  message: string;
}
