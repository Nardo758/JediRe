export type DocumentType =
  | 'T12'
  | 'RENT_ROLL'
  | 'AGED_RECEIVABLES'
  | 'BOX_SCORE'
  | 'CONCESSION_BURNOFF'
  | 'T30_LTO'
  | 'TAX_BILL'
  | 'OTHER_INCOME'
  | 'OM'
  | 'UNKNOWN';

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  hints: string[];
}

export type ExtractionData = T12Data | RentRollData | AgedReceivablesData | BoxScoreData | ConcessionBurnoffData | LTOData | TaxBillData | OtherIncomeData;

export interface ExtractionResult {
  documentType: DocumentType;
  success: boolean;
  error?: string;
  data: ExtractionData | null;
  summary: Record<string, unknown>;
  warnings: string[];
  documentId?: string;
  chartFormat?: ChartFormat;
  capsuleExtras?: Record<string, unknown>;
}

export interface T12Data {
  months: T12Month[];
  summary: {
    t12Revenue: number;
    t12OpEx: number;
    t12NOI: number;
    expenseRatio: number;
    impliedOccupancy: number | null;
    totalUnits: number | null;
    periodStart: string;
    periodEnd: string;
  };
}

export interface T12Month {
  reportMonth: string;
  grossPotentialRent: number | null;
  lossToLease: number | null;
  vacancyLoss: number | null;
  concessions: number | null;
  badDebt: number | null;
  netRentalIncome: number | null;
  otherIncome: number | null;
  utilityReimbursement: number | null;
  lateFees: number | null;
  miscIncome: number | null;
  effectiveGrossIncome: number | null;
  payroll: number | null;
  repairsMaintenance: number | null;
  turnoverCosts: number | null;
  marketing: number | null;
  adminGeneral: number | null;
  managementFee: number | null;
  utilities: number | null;
  contractServices: number | null;
  propertyTax: number | null;
  insurance: number | null;
  totalOpex: number | null;
  noi: number | null;
  totalUnits: number | null;
  occupiedUnits: number | null;
}

export interface RentRollUnit {
  unitNumber: string;
  unitType: string;
  sqft: number | null;
  status: string;
  tenantName: string | null;
  marketRent: number | null;
  leaseRent: number | null;
  effectiveRent: number | null;
  charges: Record<string, number>;
  totalCharges: number;
  deposit: number | null;
  balance: number | null;
  moveInDate: string | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  moveOutDate: string | null;
  isFutureResident: boolean;
}

export interface RentRollData {
  units: RentRollUnit[];
  summary: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
    totalMarketRent: number;
    totalLeaseCharges: number;
    lossToLease: number;
    lossToLeasePct: number;
    avgMarketRent: number;
    avgEffectiveRent: number;
    futureResidents: number;
    floorPlanMix: Record<string, { count: number; avgRent: number; avgSqft: number }>;
  };
}

export interface AgingRecord {
  unitNumber: string;
  tenantName: string | null;
  currentBalance: number;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  prepaid: number;
  totalBalance: number;
  leaseStatus: string | null;
}

export interface AgedReceivablesData {
  records: AgingRecord[];
  summary: {
    totalAR: number;
    total_0_30: number;
    total_31_60: number;
    total_61_90: number;
    total_90_plus: number;
    totalPrepaid: number;
    seriousDelinquencyRate: number;
    unitsDelinquent: number;
    totalUnits: number;
  };
}

export interface BoxScoreAvailability {
  floorPlan: string;
  occupied: number;
  vacant: number;
  notice: number;
  rented: number;
  model: number;
  down: number;
  admin: number;
  total: number;
  occupancyPct: number;
  leasedPct: number;
}

export interface BoxScoreActivity {
  moveIns: number;
  moveOuts: number;
  notices: number;
  renewals: number;
  transfers: number;
  mtmConversions: number;
  evictions: number;
  skips: number;
}

export interface BoxScoreConversion {
  channel: string;
  firstContacts: number;
  shows: number;
  applied: number;
  approved: number;
  leased: number;
  conversionRate: number;
}

export interface BoxScoreData {
  availability: BoxScoreAvailability[];
  activity: BoxScoreActivity;
  conversions: BoxScoreConversion[];
  summary: {
    totalUnits: number;
    totalOccupied: number;
    totalVacant: number;
    occupancyPct: number;
    leasedPct: number;
    netAbsorption: number;
    overallConversionRate: number;
  };
}

export interface ConcessionRecord {
  unitNumber: string;
  tenantName: string | null;
  unitType: string | null;
  totalRecurring: number;
  currentConcession: number;
  remainingAmount: number;
  endDate: string | null;
  leaseTerm: number | null;
  marketRent: number | null;
  leaseRent: number | null;
}

export interface ConcessionBurnoffData {
  records: ConcessionRecord[];
  summary: {
    totalActiveConcessions: number;
    totalLiability: number;
    totalRemainingLiability: number;
    avgConcessionDepth: number;
    burnoffCalendar: Array<{ month: string; expiringAmount: number; expiringUnits: number }>;
    byFloorPlan: Record<string, { count: number; avgConcession: number; totalLiability: number }>;
  };
}

export interface LTORecord {
  unitNumber: string;
  unitType: string | null;
  transactionType: string;
  leaseRent: number;
  concession: number;
  effectiveRent: number;
  marketRent: number | null;
  priorRent: number | null;
  rentChange: number | null;
  rentChangePct: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  tenantName: string | null;
}

export interface LTOData {
  records: LTORecord[];
  summary: {
    totalTransactions: number;
    newLeases: number;
    renewals: number;
    avgNewLeaseRent: number;
    avgRenewalRent: number;
    avgTradeOutGain: number;
    avgTradeOutGainPct: number;
    avgNewTradeOut: number;
    avgRenewalTradeOut: number;
  };
}

export interface TaxBillData {
  parcelId: string | null;
  assessedValue: number | null;
  assessedLand: number | null;
  assessedImprovement: number | null;
  assessedValueAppeal: number | null;
  fairMarketValue: number | null;
  totalAnnualTax: number;
  millageRate: number | null;
  taxingAuthority: string | null;
  ownerName: string | null;
  ownerAddress: string | null;
  appealStatus: string | null;
  taxYear: number | null;
  unappealedTaxAmount?: number | null;
  appealAssessment?: number | null;
  authorities: Array<{
    name: string;
    rate?: number;
    amount?: number;
    taxableAssessment?: number | null;
    millage?: number | null;
    grossTax?: number | null;
    netTax?: number | null;
    units?: number;
  }>;
}

export interface OtherIncomeCategory {
  category: string;
  description: string | null;
  unitCount: number | null;
  perUnitAmount: number | null;
  totalAnnual: number;
  totalMonthly: number;
  assumptions: string | null;
}

export interface OtherIncomeData {
  categories: OtherIncomeCategory[];
  summary: {
    totalAnnual: number;
    totalMonthly: number;
    categoryCount: number;
    perUnitTotal: number | null;
  };
}

export type ChartFormat =
  | 'yardi_accrual'
  | 'yardi_cash'
  | 'realpage'
  | 'appfolio'
  | 'entrata'
  | 'mri'
  | 'generic_columnar'
  | 'unknown';

export type RentRollLayout =
  | 'yardi_rrwlc'
  | 'yardi_rr'
  | 'realpage_unit_grid'
  | 'appfolio_unit_grid'
  | 'generic_flat'
  | 'unknown';

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
    | 'platform_fallback'
    | 'tax_service_computed'
    | 'tax_bill_parsed'
    | 'attom'
    | 'agent_research';
  warning?: string;
  scenarios?: Record<string, T>;
  updated_at: string;
  updated_by?: string;
}

export interface ProFormaYear1Seed {
  gpr: LayeredValue<number>;
  loss_to_lease_pct: LayeredValue<number>;
  vacancy_pct: LayeredValue<number>;
  concessions_pct: LayeredValue<number>;
  bad_debt_pct: LayeredValue<number>;
  non_revenue_units_pct: LayeredValue<number>;
  net_rental_income: LayeredValue<number>;
  other_income_per_unit: LayeredValue<number>;
  other_income_breakdown: {
    parking: LayeredValue<number>;
    pet: LayeredValue<number>;
    storage: LayeredValue<number>;
    laundry: LayeredValue<number>;
    rubs: LayeredValue<number>;
    fees: LayeredValue<number>;
    insurance_admin: LayeredValue<number>;
    other: LayeredValue<number>;
  };
  /**
   * User-added ancillary income lines that don't fit the canonical categories
   * (e.g. "Solar revenue", "Cell tower lease"). Each line carries its own
   * monthly $ amount and contributes to EGI alongside the per-category
   * breakdown. Survives re-seed because `buildSeed` copies it verbatim from
   * `existingSeed`. Task #519.
   */
  other_income_user_lines?: Array<{
    id: string;
    label: string;
    /**
     * Resolved total $/month for this line. ALWAYS authoritative — the
     * EGI/NOI math reads `monthly` directly. When `qty` and `rate` are also
     * supplied, the API derives `monthly = qty * rate` server-side so the
     * three fields stay in lock-step (no client-side drift). Legacy lines
     * created before per-unit pricing only carry `monthly`.
     */
    monthly: number;
    /** Optional per-unit billing model (e.g. "200 of 232 units billed cable @ $30/mo"). */
    qty?: number;
    /** Per-unit $ at the chosen frequency. */
    rate?: number;
    /** Whether `rate` is per-unit/month (default) or per-unit/year. */
    frequency?: 'monthly' | 'annual';
    note?: string;
    created_by?: string;
    created_at: string;
    updated_at?: string;
  }>;
  egi: LayeredValue<number>;
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
  /** Utility sub-lines — sub-components of the compound `utilities` field.
   *  Null from T12 today (parser aggregates to `utilities`); available for
   *  user override. When any sub-line is resolved, total_opex uses their sum
   *  in place of `utilities`. Task #672. */
  water_sewer?: LayeredValue<number>;
  electric?: LayeredValue<number>;
  gas_fuel?: LayeredValue<number>;
  /** Landscaping / grounds — parser rolls this into contract_services from T12;
   *  available as a standalone line for user override. Task #672. */
  landscaping?: LayeredValue<number>;
  management_fee_pct: LayeredValue<number>;
  insurance: LayeredValue<number>;
  real_estate_tax: LayeredValue<number>;
  personal_property_tax: LayeredValue<number>;
  replacement_reserves: LayeredValue<number>;
  total_opex: LayeredValue<number>;
  noi: LayeredValue<number>;
  noi_per_unit: LayeredValue<number>;
  source_docs: {
    t12_doc_id?: string;
    rent_roll_doc_id?: string;
    tax_bill_doc_id?: string;
    box_score_doc_id?: string;
    aged_ar_doc_id?: string;
    om_doc_id?: string;
  };
  _unit_count: number;
  last_seeded_at: string;
}

export interface ExtractionT12Capsule {
  source: 'platform';
  updatedAt: string;
  chart_format: ChartFormat;
  document_id: string;
  period_start: string;
  period_end: string;
  months_captured: number;
  gpr: number;
  loss_to_lease: number;
  loss_to_lease_pct: number;
  concessions: { one_time: number; renewal: number; total: number };
  vacancy_loss: number;
  vacancy_loss_pct: number;
  non_revenue_units: number;
  bad_debt: { gross: number; recovery: number; net: number };
  net_rental_income: number;
  other_income: {
    total: number;
    breakdown: Record<string, number>;
  };
  egi: number;
  opex: {
    payroll: number;
    r_and_m: number;
    turnover: number;
    amenities: number;
    contract: number;
    marketing: number;
    office: number;
    g_and_a: number;
    hoa_dues: number;
    utilities: number;
    mgmt_fee: number;
    real_estate_tax: number;
    personal_property_tax: number;
    insurance: number | null;
    total: number;
  };
  noi: number;
  expense_ratio: number;
  noi_margin: number;
  mgmt_fee_pct_of_egi: number;
  warnings: string[];
}

export interface ExtractionRentRollCapsule {
  source: 'platform';
  updatedAt: string;
  layout: RentRollLayout;
  document_id: string;
  as_of_date: string;
  source_system_id: string | null;
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  non_revenue_units: number;
  future_residents: number;
  gpr_monthly: number;
  in_place_rent_monthly: number;
  loss_to_lease_monthly: number;
  loss_to_lease_pct: number;
  vacancy_loss_monthly?: number;
  concessions_monthly?: number;
  total_billings_monthly: number;
  egi_in_place_annualized: number;
  avg_market_rent: number;
  avg_effective_rent: number;
  avg_unit_sqft: number;
  total_rentable_sqft: number;
  occupancy_by_unit_pct: number;
  occupancy_by_sqft_pct: number;
  charge_codes: Record<string, number>;
  other_income_monthly: {
    parking: number;
    pet_rent: number;
    storage: number;
    rubs: number;
    fees: number;
    insurance_admin: number;
    concessions_other: number;
    other: number;
  };
  floor_plan_mix: Record<string, {
    count: number;
    avg_sqft: number;
    total_sqft: number;
    avg_market_rent: number;
    avg_effective_rent: number;
    occupancy_pct: number;
    /** Per-floor-plan expiration roll-up. Optional for backward compat. */
    expiration_curve?: {
      months_0_3: number; months_3_6: number; months_6_12: number;
      months_12_plus: number; mtm: number; unknown?: number;
    };
    /** Per-floor-plan extraction quality flag (Task #514). Optional for legacy. */
    expiration_extraction_status?: 'ok' | 'partial' | 'failed';
  }>;
  bedroom_mix: Record<string, { count: number; pct: number; avg_rent: number }>;
  outstanding_balance_total: number;
  outstanding_balance_ratio: number;
  security_deposits_held: number;
  pre_lease_ratio: number;
  expiration_curve: {
    months_0_3: number;
    months_3_6: number;
    months_6_12: number;
    months_12_plus: number;
    mtm: number;
    /** Units whose lease_expiration could not be parsed. Added in Task #514;
     *  legacy capsules omit this field — readers should default to 0. */
    unknown?: number;
  };
  /** Deal-wide extraction status for the lease-expiration column. Task #514. */
  expiration_extraction_status?: 'ok' | 'partial' | 'failed';
  /** Per-critical-column extraction scorecard. Task #514. */
  column_coverage?: Record<string, 'ok' | 'fallback' | 'all_null' | 'missing' | 'not_supported'>;
  /** True when the extraction needs human review (missing critical columns or
   *  ≥50% rows missing lease_expiration / effective_rent). Task #514. */
  human_review_needed?: boolean;
  warnings: string[];
}

export interface CrossDocVariance {
  metric: string;
  doc_a: { source: string; value: number; doc_id: string };
  doc_b: { source: string; value: number; doc_id: string };
  delta_abs: number;
  delta_pct: number;
  severity: 'info' | 'warning' | 'critical';
  scenarios?: Record<string, number>;
  message: string;
}

export interface PipelineResult {
  dealId: string;
  documentsProcessed: number;
  results: Array<{
    filename: string;
    documentType: DocumentType;
    success: boolean;
    error?: string;
    rowsInserted?: number;
  }>;
  capsuleUpdated: boolean;
  libraryUpdated: boolean;
  alerts: string[];
}
