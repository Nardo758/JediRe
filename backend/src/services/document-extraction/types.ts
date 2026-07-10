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
  | 'LEASING_STATS'
  | 'COSTAR_SUBMARKET_EXPORT'
  | 'COSTAR_SALE_COMPS'
  | 'COSTAR_RENT_COMPS'
  | 'YARDI_MATRIX_RENT_SURVEY'
  | 'YARDI_MATRIX_SUPPLY_PIPELINE'
  | 'BPI_FINANCIAL'
  | 'TRIAL_BALANCE'
  | 'AMORTIZATION_SCHEDULE'
  | 'MORTGAGE_STATEMENT'
  | 'WEEKLY_REPORT'
  | 'UNKNOWN';

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  hints: string[];
  /**
   * Present when the classifier matched a vendor-registry pattern.
   * Consumers can use this to look up the full VendorDeclaration via
   * `vendorRegistry.getVendorById(vendorId)`.
   */
  vendorId?: string;
}

export type ExtractionData = T12Data | RentRollData | AgedReceivablesData | BoxScoreData | ConcessionBurnoffData | LTOData | TaxBillData | OtherIncomeData | LeasingStatsData | CoStarSubmarketData | CoStarSaleCompsData | CoStarRentCompsData | BPIFinancialData | TrialBalanceData | AmortizationScheduleData | MortgageStatementData | WeeklyReportData;

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

export interface LeasingStatsLease {
  signed_date: string | null;
  unit: string;
  floor_plan: string | null;
  term_months: number | null;
  market_rent: number | null;
  lease_rent: number | null;
  effective_rent: number | null;
  concession: number | null;
  source: string | null;
  tenant_name: string | null;
}

export interface LeasingStatsActivity {
  floor_plan: string;
  units: number;
  move_ins: number;
  move_outs: number;
  net_change: number;
  units_reserved: number;
  signed_renewals: number;
  transferring: number;
  cancelled_denied: number;
  net_leases: number;
  waitlist: number;
  waitlist_cancelled: number;
  net_waitlist: number;
}

export interface LeasingStatsData {
  reporting_period: { start: string; end: string };
  new_leases: LeasingStatsLease[];
  activity: LeasingStatsActivity[];
  summary: {
    total_move_ins: number;
    total_move_outs: number;
    net_absorption: number;
    total_new_leases: number;
    total_renewals: number;
    total_cancelled: number;
    total_waitlist: number;
    total_units: number;
    total_occupied: number;
    occupancy_pct: number;
  };
}

// ─── CoStar Document Types ───────────────────────────────────────────────────

export interface CoStarSubmarketRow {
  periodDate: string;
  vacancyRate: number | null;
  askingRentPerUnit: number | null;
  yoyRentGrowth: number | null;
  inventoryUnits: number | null;
  underConstructionUnits: number | null;
  absorption12mo: number | null;
  capRate: number | null;
  salePricePerUnit: number | null;
}

export interface CoStarSubmarketData {
  rows: CoStarSubmarketRow[];
  skippedRows: number;
  skipReasons: string[];
}

export interface CoStarSaleCompsData {
  rowCount: number;
}

export interface CoStarRentCompsData {
  rowCount: number;
}

export interface BPIFinancialData {
  propertyCode: string;
  reportMonth: string;
  grossPotentialRent: number | null;
  lossToLease: number | null;
  vacancyLoss: number | null;
  concessions: number | null;
  badDebt: number | null;
  otherIncome: number | null;
  effectiveGrossIncome: number | null;
  payroll: number | null;
  repairsMaintenance: number | null;
  turnoverCosts: number | null;
  contractServices: number | null;
  utilities: number | null;
  marketing: number | null;
  adminGeneral: number | null;
  managementFee: number | null;
  propertyTax: number | null;
  insurance: number | null;
  totalOpex: number | null;
  noi: number | null;
  debtService: number | null;
  capex: number | null;
  cashFlowBeforeTax: number | null;
  cash: number | null;
  accountsReceivable: number | null;
  prepaidExpenses: number | null;
  totalAssets: number | null;
  accountsPayable: number | null;
  securityDeposits: number | null;
  totalLiabilities: number | null;
  equity: number | null;
  totalUnits: number | null;
  occupiedUnits: number | null;
  occupancyRate: number | null;
  avgEffectiveRent: number | null;
  avgMarketRent: number | null;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  debit: number | null;
  credit: number | null;
  netBalance: number | null;
  category: string | null;
}

export interface TrialBalanceData {
  propertyCode: string;
  reportPeriod: string;
  rows: TrialBalanceRow[];
  summary: {
    totalDebits: number;
    totalCredits: number;
    netEquity: number;
    totalAssets: number | null;
    totalLiabilities: number | null;
    rowCount: number;
  };
}

export interface AmortizationRow {
  period: number;
  paymentDate: string | null;
  beginningBalance: number | null;
  scheduledPayment: number | null;
  principal: number | null;
  interest: number | null;
  endingBalance: number | null;
  escrow: number | null;
}

export interface AmortizationScheduleData {
  propertyCode: string;
  loanAmount: number | null;
  interestRate: number | null;
  termMonths: number | null;
  startDate: string | null;
  monthlyPayment: number | null;
  rows: AmortizationRow[];
  summary: {
    totalPayments: number;
    totalInterest: number;
    totalPrincipal: number;
    remainingBalance: number | null;
    periodsFound: number;
  };
}

export interface MortgageStatementData {
  loanNumber: string | null;
  dealName: string | null;
  currentPrincipalBalance: number | null;
  payRate: number | null;
  contractRate: number | null;
  currentIndex: number | null;
  daysInBillingCycle: number | null;
  currentInterestDue: number | null;
  taxEscrowDue: number | null;
  insuranceEscrowDue: number | null;
  miscAmountDue: number | null;
  currentTotalDue: number | null;
  pastDueAmount: number | null;
  totalPaymentDue: number | null;
  dateDue: string | null;
  dateIssued: string | null;
  taxEscrowBalance: number | null;
  insuranceEscrowBalance: number | null;
  reserveEscrowBalance: number | null;
  interestPaidYTD: number | null;
  taxesDisbursedYTD: number | null;
  servicer: string | null;
}

export interface WeeklyReportKPI {
  week: string | null;
  newLeases: number | null;
  renewals: number | null;
  moveIns: number | null;
  moveOuts: number | null;
  netTraffic: number | null;
  occupancy: number | null;
  avgEffectiveRent: number | null;
  leasedPct: number | null;
  concessions: number | null;
  notices: number | null;
}

export interface WeeklyReportData {
  propertyCode: string;
  reportDate: string | null;
  currentWeek: WeeklyReportKPI;
  weeklyHistory: WeeklyReportKPI[];
  tabsSeen: string[];
  warnings: string[];
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
  /**
   * Agent-written value that has been CONFIRMED by the operator or
   * system.  This layer sits ABOVE Engine A computed values and BELOW
   * per-year / operator overrides.  It is the canonical slot for agent
   * assumption writes (D3 seam).
   *
   * Resolution order: storedResolved < Engine A < agent_confirmed < perYearOverride < override
   */
  agent_confirmed?: T | null;
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
    | 'agent_research'
    | 'unresolved_no_priority';
  warning?: string;
  scenarios?: Record<string, T>;
  updated_at: string;
  updated_by?: string;
  /**
   * Provenance label indicating which source layer won the resolution.
   * Used by the frontend to color-code the source badge (broker=amber,
   * platform=green, user=purple).
   */
  resolvedFrom?: 'broker' | 'platform' | 'user' | 't12' | 'rent_roll' | 'tax_bill' | 'om' | 'agent' | 'computed' | string;
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
     * When `adoption` is set, `monthly` mirrors `adoption.steady_state_monthly`
     * for display purposes but the projection math uses the ramp formula.
     */
    monthly: number;
    /** Optional per-unit billing model (e.g. "200 of 232 units billed cable @ $30/mo"). */
    qty?: number;
    /** Per-unit $ at the chosen frequency. */
    rate?: number;
    /** Whether `rate` is per-unit/month (default) or per-unit/year. */
    frequency?: 'monthly' | 'annual';
    note?: string;
    /**
     * Optional provenance tag (e.g. 'program_suggestion:ev_charging').
     * Set when the line is created from a Program tab suggestion.
     */
    source_tag?: string;
    created_by?: string;
    created_at: string;
    updated_at?: string;
    /**
     * Adoption / ramp-up timeline for new income sources that don't exist
     * at acquisition (e.g. EV charging after renovation completion).
     * When null/absent, income is projected flat as `monthly × 12` per year.
     * When set, the ramp formula is applied per year:
     *   period_month = (Y - 1) * 12 + 6   // midpoint of year Y
     *   if period_month < ramp_start_period → income = 0
     *   elif ramping → income = steady_state_monthly × ramp_fraction × 12 × probability_adopted
     *   else → income = steady_state_monthly × 12 × probability_adopted
     * Task #1147.
     */
    adoption?: {
      /** Months from acquisition/completion when income first appears (0 = immediately). */
      ramp_start_period: number;
      /** Months from first revenue to steady state (0 = instant; 12 = gradual ramp). */
      ramp_duration_months: number;
      /** Full run-rate $/mo at steady state — the source-of-truth for this line's ceiling. */
      steady_state_monthly: number;
      /** Probability 0–1 that the program is actually implemented; applied as a multiplier. */
      probability_adopted: number;
    } | null;
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
  /** Interest rate for debt financing — LayeredValue-resolved from deal_assumptions.year1.
   *  Arbiter: user override > agent_confirmed > platform > bridge default (R6).
   *  Added in B1 (DEBT_LAYER_PHASE2_GO). */
  rate: LayeredValue<number>;
  /** Loan-to-Value ratio (decimal, e.g. 0.65 = 65%) — LayeredValue-resolved from deal_assumptions.year1.
   *  Arbiter: user override > agent_confirmed > platform > bridge default (R9).
   *  Added in B2 (DEBT_LAYER_PHASE2_GO). */
  ltv: LayeredValue<number>;
  /** Loan term in years — LayeredValue-resolved from deal_assumptions.year1.
   *  Arbiter: user override > agent_confirmed > platform > bridge default (R9).
   *  Added in B2 (DEBT_LAYER_PHASE2_GO). */
  term: LayeredValue<number>;
  /** Amortization period in years — LayeredValue-resolved from deal_assumptions.year1.
   *  Arbiter: user override > agent_confirmed > platform > bridge default (R9).
   *  Added in B2 (DEBT_LAYER_PHASE2_GO). */
  amort: LayeredValue<number>;
  /** Interest-Only period in months — LayeredValue-resolved from deal_assumptions.year1.
   *  Arbiter: user override > agent_confirmed > platform > bridge default (R9).
   *  Added in B2 (DEBT_LAYER_PHASE2_GO). */
  io_period: LayeredValue<number>;
  /** DSCR floor constraint — LayeredValue-resolved from deal_assumptions.year1.
   *  Used by M11 for sizing in future B3/B4 steps.
   *  Added in B2 (DEBT_LAYER_PHASE2_GO). */
  dscr_floor: LayeredValue<number>;
  /** Debt yield floor constraint — LayeredValue-resolved from deal_assumptions.year1.
   *  Used by M11 for sizing in future B3/B4 steps.
   *  Added in B2 (DEBT_LAYER_PHASE2_GO). */
  debt_yield_floor: LayeredValue<number>;
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
  /** Boundary context — non-field metadata telling the system where actuals end
   *  and projection begins. Added by Phase 1 (Boundary Facts). Optional for
   *  backward compatibility with pre-boundary seeds. */
  _boundary_context?: {
    actuals_through_month: string | null;
    acquisition_date: string | null;
    has_actuals: boolean;
    has_projection: boolean;
    gap_start_month: string | null;
    gap_end_month: string | null;
  };
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
