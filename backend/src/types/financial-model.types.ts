// ═══════════════════════════════════════════════════════════════════════════════
// JEDI RE — Financial Model Type System
// Three-Model Architecture: Acquisition | Development | Redevelopment
// Claude Compute Engine Schema Definitions
// ═══════════════════════════════════════════════════════════════════════════════
//
// ARCHITECTURE:
//   Layer 1 — Financial Primitives (shared math, types, enums)
//   Layer 2 — Model Type Schemas (Assumptions + Output per type)
//   Layer 3 — Prompt Template + Validation (Claude instruction contracts)
//
// PATTERN:
//   DealContext → modelType inferred → correct schema selected →
//   assumptions assembled → Claude prompt template injected →
//   structured JSON output → validation → cache → render/export
//
// ═══════════════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1: FINANCIAL PRIMITIVES — Shared across all model types
// ─────────────────────────────────────────────────────────────────────────────

/** The three model types. Determines which schema Claude receives. */
export type ModelType = 'acquisition' | 'development' | 'redevelopment';

/** Source attribution for every assumption — the audit trail */
export type AssumptionSource =
  | { layer: 'broker';   origin: string; confidence: number }    // Layer 1: Broker OM/T-12
  | { layer: 'platform'; origin: string; confidence: number;     // Layer 2: Platform intelligence
      module: string; formula?: string }
  | { layer: 'user';     origin: 'manual_override' }             // Layer 3: User override
  | { layer: 'default';  origin: 'market_benchmark' };           // Fallback defaults

/** A single assumption value with full provenance */
export interface TrackedAssumption<T = number> {
  value: T;
  source: AssumptionSource;
  /** Platform-suggested value (shown even when user overrides) */
  platformSuggested?: T;
  /** Delta from platform suggestion, if user overrode */
  overrideDelta?: number;
  /** Human-readable explanation of why this value */
  rationale?: string;
}

/** Debt structure — shared across all model types (permanent financing) */
export interface DebtTerms {
  loanAmount: number;
  /** LTV for acquisition/refi, LTC for construction */
  leverageMetric: { type: 'LTV' | 'LTC'; value: number };
  interestRate: number;
  /** Fixed or floating. If floating, spread over index */
  rateType: 'fixed' | 'floating';
  floatingSpread?: number;
  floatingIndex?: 'SOFR' | 'prime' | 'treasury';
  amortizationYears: number;
  /** Interest-only period in months (0 = fully amortizing from day 1) */
  ioMonths: number;
  loanTermMonths: number;
  /** Extension options */
  extensions?: { months: number; fee: number; conditions: string }[];
  /** Lender requirements */
  minDSCR?: number;
  maxLTV?: number;
}

/** Equity waterfall structure */
export interface WaterfallTerms {
  totalEquity: number;
  gpCoinvest: number;
  /** Preferred return (annual, compounding) */
  preferredReturn: number;
  /** Promote tiers: [{ threshold: IRR hurdle, gpShare: GP split above this tier }] */
  promoteTiers: { threshold: number; gpShare: number }[];
  /** Catch-up provision for GP */
  catchUp?: { enabled: boolean; percentage: number };
  /** Clawback provision */
  clawback?: boolean;
}

/** Single year of operating projections — the core output row */
export interface AnnualProjection {
  year: number;
  // Revenue
  grossPotentialRent: number;
  vacancyLoss: number;
  concessions: number;
  badDebt: number;
  lossToLease?: number;
  otherIncome: number;
  effectiveGrossRevenue: number;
  // Expenses
  operatingExpenses: number;
  /** Phase 2: expense breakdown by category */
  expenseDetail?: {
    repairMaintenance?: number;
    contractServices?: number;
    landscaping?: number;
    personnel?: number;
    marketing?: number;
    administrative?: number;
    turnover?: number;
    waterSewer?: number;
    electric?: number;
    gasFuel?: number;
    insurance: number;
    propertyTax: number;
    managementFee: number;
  };
  // NOI
  netOperatingIncome: number;
  replacementReserves: number;
  noiAfterReserves: number;
  // Debt Service
  interestExpense: number;
  principalAmortization: number;
  totalDebtService: number;
  // Cash Flow
  cashFlowBeforeDistributions: number;
  netCashFlowToPartners: number;
  // Metrics
  dscr: number;
  cashOnCash: number;
  debtYield: number;
  yieldOnCost: number;
  occupancy: number;
  expenseRatio: number;
  noiMargin: number;
  revenuePerUnit: number;
  expensePerUnit: number;
}

/** Disposition analysis at exit */
export interface DispositionAnalysis {
  exitYear: number;
  exitNOI: number;
  exitCapRate: number;
  grossSalePrice: number;
  sellingCosts: number;
  loanPayoff: number;
  netDispositionProceeds: number;
  totalEquityInvested: number;
  totalDistributionsPlusProceeds: number;
  netProfit: number;
  irr: number;
  equityMultiple: number;
}

/** Sensitivity table cell */
export interface SensitivityCell {
  rowVariable: string;
  rowValue: number;
  colVariable: string;
  colValue: number;
  irr: number;
  equityMultiple: number;
  isBaseCase: boolean;
}

/** LP/GP waterfall distribution for a single year */
export interface WaterfallDistribution {
  year: number;
  cashAvailable: number;
  preferredToLP: number;
  returnOfCapital: number;
  gpCatchUp?: number;
  excessToLP: number;
  excessToGP: number;
  cumulativeLPDistributions: number;
  cumulativeGPDistributions: number;
  lpIRRToDate: number;
}

/** Computation trace — Claude shows its work for audit */
export interface ComputationTrace {
  lineItem: string;
  year: number;
  formula: string;
  inputs: Record<string, number>;
  result: number;
  /** If result triggered a validation flag */
  flag?: string;
}

/** Validation result from the output validator */
export interface ValidationResult {
  valid: boolean;
  errors: { field: string; message: string; severity: 'error' | 'warning' }[];
  /** Flagged for manual review (e.g., IRR > 50%) */
  requiresReview: boolean;
  reviewReasons: string[];
}


// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2A: ACQUISITION MODEL
// Stabilized asset. One cash flow period. T-12 baseline.
// ─────────────────────────────────────────────────────────────────────────────

export interface AcquisitionAssumptions {
  modelType: 'acquisition';
  modelVersion: string;

  // ── Property ──
  property: {
    name: string;
    address: string;
    city: string;
    state: string;
    msa: string;
    submarket: string;
    units: number;
    yearBuilt: number;
    propertyClass: 'A' | 'B' | 'C' | 'D';
    propertyType: 'garden' | 'midrise' | 'highrise' | 'townhome' | 'btr';
    grossSF: number;
    avgUnitSF: number;
    /** Lat/lng for Location Math and module lookups */
    coordinates: { lat: number; lng: number };
  };

  // ── Acquisition ──
  acquisition: {
    purchasePrice: TrackedAssumption;
    closingCostsPct: TrackedAssumption;
    /** Upfront reserves (capex, opex, interest) */
    reserves: TrackedAssumption;
    /** CapEx budget for day-1 renovations (value-add light) */
    capexBudget?: TrackedAssumption;
    /** Per-unit capex if value-add */
    capexPerUnit?: TrackedAssumption;
    closingDate: string; // ISO date
  };

  // ── Revenue ──
  revenue: {
    /** Current in-place rent per unit (from T-12 or rent roll) */
    inPlaceRentPerUnit: TrackedAssumption;
    /** Market rent per unit (from M05/M15 comps) */
    marketRentPerUnit: TrackedAssumption;
    /** Annual rent growth rate per year (can be array for year-specific) */
    rentGrowth: TrackedAssumption<number | number[]>;
    /** Year-by-year vacancy schedule (allows ramp from current to stabilized) */
    vacancySchedule: TrackedAssumption<number[]>;
    concessionsPct: TrackedAssumption;
    badDebtPct: TrackedAssumption;
    lossToLeasePct?: TrackedAssumption;
    /** Other income per unit per month */
    otherIncomePerUnit: TrackedAssumption;
    otherIncomeGrowth: TrackedAssumption;
  };

  // ── Expenses ──
  expenses: {
    /** Phase 1: aggregate per-unit operating expense */
    opexPerUnit: TrackedAssumption;
    /** Annual expense escalation */
    expenseGrowth: TrackedAssumption;
    managementFeePct: TrackedAssumption;
    /** Phase 2: category-level expense breakdown */
    categoryBreakdown?: {
      repairMaintenance: TrackedAssumption;
      contractServices: TrackedAssumption;
      landscaping: TrackedAssumption;
      personnel: TrackedAssumption;
      marketing: TrackedAssumption;
      administrative: TrackedAssumption;
      turnover: TrackedAssumption;
      waterSewer: TrackedAssumption;
      electric: TrackedAssumption;
      gasFuel: TrackedAssumption;
      insurance: TrackedAssumption;
      propertyTax: TrackedAssumption;
    };
    /** Replacement reserves per unit per year */
    reservesPerUnit: TrackedAssumption;
  };

  // ── Debt ──
  debt: {
    /** Primary loan — permanent or agency financing */
    primary: DebtTerms;
    /** Comparison loans for debt tab (optional) */
    comparisons?: DebtTerms[];
  };

  // ── Disposition ──
  disposition: {
    holdYears: TrackedAssumption;
    exitCapRate: TrackedAssumption;
    sellingCostsPct: TrackedAssumption;
  };

  // ── Waterfall ──
  waterfall?: WaterfallTerms;

  // ── Platform Intelligence Overlays (from M02–M08) ──
  platformOverlays?: {
    /** F32: News-adjusted rent growth */
    adjustedRentGrowth?: { value: number; events: string[]; formula: string };
    /** F33: News-adjusted vacancy */
    adjustedVacancy?: { value: number; events: string[]; formula: string };
    /** M08: Recommended strategy and score */
    strategyRecommendation?: {
      recommended: 'BTS' | 'Flip' | 'Rental' | 'STR';
      scores: Record<string, number>;
      arbitrageDelta: number;
    };
    /** M14: Risk score breakdown */
    riskScores?: {
      supply: number; demand: number; regulatory: number;
      market: number; execution: number; climate: number;
    };
    /** M25: JEDI Score */
    jediScore?: { composite: number; demand: number; supply: number;
      momentum: number; position: number; risk: number };
  };
}

export interface AcquisitionOutput {
  modelType: 'acquisition';
  modelVersion: string;
  computedAt: string; // ISO timestamp
  assumptionsHash: string; // for cache invalidation

  // ── Sources & Uses ──
  sourcesAndUses: {
    sources: {
      seniorDebt: number;
      mezzanine?: number;
      equity: number;
      total: number;
    };
    uses: {
      purchasePrice: number;
      closingCosts: number;
      capexBudget?: number;
      reserves: number;
      total: number;
    };
  };

  // ── Annual Projections ──
  projections: AnnualProjection[];

  // ── Disposition ──
  disposition: DispositionAnalysis;

  // ── Debt Schedule (monthly for precision, summarized annually) ──
  debtScheduleAnnual: {
    year: number;
    beginningBalance: number;
    interest: number;
    principal: number;
    endingBalance: number;
    isIO: boolean;
  }[];

  // ── Waterfall (if terms provided) ──
  waterfallDistributions?: WaterfallDistribution[];

  // ── Sensitivity Tables ──
  sensitivityIRR: SensitivityCell[];  // Exit Cap × Rent Growth
  sensitivityEM: SensitivityCell[];   // Exit Cap × Hold Period

  // ── Summary Metrics ──
  summaryMetrics: {
    irr: number;
    equityMultiple: number;
    cashOnCashYear1: number;
    avgCashOnCash: number;
    noiYear1: number;
    goingInCapRate: number;
    exitCapRate: number;
    minDSCR: number;
    avgDSCR: number;
    yieldOnCost: number;
    totalProfit: number;
    peakEquityExposure: number;
  };

  // ── Cash Flow Vector (for external IRR verification) ──
  cashFlowVector: number[];

  // ── Computation Trace (audit trail — Claude shows its work) ──
  trace: ComputationTrace[];

  // ── Validation ──
  validation: ValidationResult;
}


// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2B: DEVELOPMENT MODEL
// Ground-up. Two cash flow periods: Construction → Operating.
// No T-12. Everything is forward-looking.
// ─────────────────────────────────────────────────────────────────────────────

/** Construction budget line item */
export interface ConstructionLineItem {
  category: 'land' | 'hard_costs' | 'soft_costs' | 'financing' | 'developer_fee' | 'contingency';
  subcategory: string;
  description: string;
  amount: number;
  /** Per-unit or per-SF cost (for scaling) */
  unitCost?: { amount: number; basis: 'per_unit' | 'per_sf' | 'per_parking' | 'lump_sum' };
  /** Draw schedule: which months this cost is incurred */
  drawSchedule?: {
    method: 'straight_line' | 's_curve' | 'front_loaded' | 'back_loaded' | 'custom';
    startMonth: number;
    endMonth: number;
    /** Custom monthly percentages (must sum to 1.0) */
    customCurve?: number[];
  };
}

/** Monthly draw period detail */
export interface MonthlyDraw {
  month: number;
  hardCostDraw: number;
  softCostDraw: number;
  totalDraw: number;
  cumulativeDrawn: number;
  /** Equity vs debt funding split for this month */
  equityFunded: number;
  debtFunded: number;
  /** Interest on outstanding construction loan balance */
  interestAccrued: number;
  cumulativeInterest: number;
  /** Running equity and debt balances */
  equityDeployed: number;
  debtOutstanding: number;
}

/** Lease-up schedule (post-completion) */
export interface LeaseUpMonth {
  month: number;
  /** Months since certificate of occupancy */
  monthsSinceCO: number;
  unitsLeased: number;
  cumulativeLeased: number;
  occupancyPct: number;
  /** Concessions during lease-up (e.g., 1 month free) */
  concessionValue: number;
  grossRentalIncome: number;
  effectiveIncome: number;
  operatingExpenses: number;
  noi: number;
  isStabilized: boolean;
}

export interface DevelopmentAssumptions {
  modelType: 'development';
  modelVersion: string;

  // ── Property / Site ──
  property: {
    name: string;
    address: string;
    city: string;
    state: string;
    msa: string;
    submarket: string;
    coordinates: { lat: number; lng: number };
    /** From M02 Zoning Agent */
    zoning: {
      code: string;
      maxDensity: number;
      far: number;
      maxHeight: number;
      setbacks: { front: number; side: number; rear: number };
      parkingRatio: number;
      source: string; // Municode link
    };
    /** From M03 Building Envelope */
    envelope?: {
      maxUnits: number;
      maxGFA: number;
      buildableArea: number;
    };
  };

  // ── Unit Mix Program ──
  unitMix: {
    totalUnits: number;
    mix: {
      type: string;       // 'Studio' | '1BR' | '2BR' | '3BR' | etc
      count: number;
      avgSF: number;
      targetRent: TrackedAssumption;
    }[];
    avgUnitSF: number;
    totalGrossSF: number;
  };

  // ── Construction Budget ──
  constructionBudget: {
    landCost: TrackedAssumption;
    hardCosts: {
      totalHardCost: TrackedAssumption;
      /** Per-SF hard cost for benchmarking */
      hardCostPerSF: number;
      lineItems: ConstructionLineItem[];
    };
    softCosts: {
      totalSoftCost: TrackedAssumption;
      lineItems: ConstructionLineItem[];
    };
    developerFee: TrackedAssumption;
    contingency: TrackedAssumption;
    interestReserve: TrackedAssumption;
    totalDevelopmentCost: number;
    totalCostPerUnit: number;
    totalCostPerSF: number;
  };

  // ── Timeline ──
  timeline: {
    /** Months from close to construction start (entitlement/permitting) */
    preDevelopmentMonths: number;
    /** Construction duration in months */
    constructionMonths: number;
    /** Months from CO to stabilized occupancy */
    leaseUpMonths: TrackedAssumption;
    /** Total project timeline = pre-dev + construction + lease-up */
    totalProjectMonths: number;
    /** Target stabilized occupancy */
    stabilizedOccupancy: TrackedAssumption;
    /** Units absorbed per month during lease-up */
    absorptionRate: TrackedAssumption;
  };

  // ── Construction Financing ──
  constructionDebt: {
    /** Loan-to-cost ratio */
    ltc: TrackedAssumption;
    loanAmount: number;
    /** Floating rate: index + spread */
    index: 'SOFR' | 'prime';
    spread: number;
    /** Current index rate */
    indexRate: number;
    allInRate: number;
    /** Interest reserve (months of capitalized interest) */
    interestReserveMonths: number;
    loanTermMonths: number;
    /** Extension options */
    extensions?: { months: number; fee: number }[];
    /** Equity-first requirement: how much equity before first draw? */
    equityRequiredBeforeFirstDraw: number;
    /** Draw schedule method for total budget */
    drawMethod: 'straight_line' | 's_curve' | 'custom';
  };

  // ── Permanent Financing (post-stabilization takeout) ──
  permanentDebt: {
    /** Estimated takeout based on stabilized NOI and cap rate */
    estimatedLoanAmount: TrackedAssumption;
    leverageMetric: { type: 'LTV' | 'DSCR_constrained'; value: number };
    interestRate: TrackedAssumption;
    rateType: 'fixed' | 'floating';
    amortizationYears: number;
    ioMonths: number;
    loanTermMonths: number;
  };

  // ── Revenue (Post-Stabilization) ──
  revenue: {
    /** Weighted average rent per unit from unit mix */
    weightedAvgRent: number;
    rentGrowth: TrackedAssumption<number | number[]>;
    stabilizedVacancy: TrackedAssumption;
    concessionsPct: TrackedAssumption;
    badDebtPct: TrackedAssumption;
    otherIncomePerUnit: TrackedAssumption;
    otherIncomeGrowth: TrackedAssumption;
    /** Lease-up concessions (more aggressive than stabilized) */
    leaseUpConcessions: TrackedAssumption;
  };

  // ── Expenses (Post-Stabilization) ──
  expenses: {
    opexPerUnit: TrackedAssumption;
    expenseGrowth: TrackedAssumption;
    managementFeePct: TrackedAssumption;
    reservesPerUnit: TrackedAssumption;
    /** During lease-up, expenses as % of stabilized (buildings still cost $ when empty) */
    leaseUpExpensePct: TrackedAssumption;
  };

  // ── Disposition ──
  disposition: {
    /** Hold years measured from stabilization (not from construction start) */
    holdYearsPostStabilization: TrackedAssumption;
    exitCapRate: TrackedAssumption;
    sellingCostsPct: TrackedAssumption;
  };

  // ── Waterfall ──
  waterfall?: WaterfallTerms;

  // ── Platform Intelligence ──
  platformOverlays?: AcquisitionAssumptions['platformOverlays'] & {
    /** M03: Development capacity analysis */
    developmentCapacity?: {
      maxUnitsByRight: number;
      capacityGap: number;
      tenYearSupplyGap: number;
    };
    /** M04: Supply pipeline threat to lease-up */
    competingPipeline?: {
      unitsDelivering: number;
      overlapWindow: string;
      threatLevel: 'low' | 'moderate' | 'high';
    };
  };
}

export interface DevelopmentOutput {
  modelType: 'development';
  modelVersion: string;
  computedAt: string;
  assumptionsHash: string;

  // ── Sources & Uses (Development-specific: more granular) ──
  sourcesAndUses: {
    sources: {
      constructionLoan: number;
      developerEquity: number;
      lpEquity: number;
      /** Any grants, tax credits, etc. */
      otherSources?: { name: string; amount: number }[];
      total: number;
    };
    uses: {
      land: number;
      hardCosts: number;
      softCosts: number;
      developerFee: number;
      contingency: number;
      interestReserve: number;
      operatingReserve?: number;
      total: number;
    };
  };

  // ── Construction Period (Monthly) ──
  constructionDrawSchedule: MonthlyDraw[];

  // ── Lease-Up Period (Monthly) ──
  leaseUpSchedule: LeaseUpMonth[];

  // ── Operating Period (Annual, post-stabilization) ──
  projections: AnnualProjection[];

  // ── Construction-to-Perm Conversion ──
  constructionToPerm: {
    conversionMonth: number;
    constructionLoanPayoff: number;
    permanentLoanProceeds: number;
    /** Net cash: positive = equity returned, negative = more equity needed */
    netCashAtConversion: number;
    /** If positive, equity returned to investors */
    equityReturnedAtRefi: number;
  };

  // ── Disposition ──
  disposition: DispositionAnalysis;

  // ── Debt Schedules ──
  constructionDebtSchedule: {
    month: number;
    draw: number;
    interestAccrued: number;
    balance: number;
  }[];
  permanentDebtScheduleAnnual: AcquisitionOutput['debtScheduleAnnual'];

  // ── Waterfall ──
  waterfallDistributions?: WaterfallDistribution[];

  // ── Sensitivity ──
  sensitivityIRR: SensitivityCell[];
  sensitivityEM: SensitivityCell[];

  // ── Development-Specific Metrics ──
  developmentMetrics: {
    /** Stabilized NOI / Total Development Cost */
    developmentYield: number;
    /** Development Yield minus Market Cap Rate — the spread is the profit signal */
    developmentSpread: number;
    /** Total cost per unit */
    totalCostPerUnit: number;
    /** Implied value at stabilization (stabilized NOI / market cap rate) */
    impliedStabilizedValue: number;
    /** Margin: (Implied Value - Total Cost) / Total Cost */
    developmentMargin: number;
    /** Months to breakeven (from first equity dollar) */
    monthsToBreakeven: number;
    /** Peak equity exposure (before any cash flows) */
    peakEquityExposure: number;
    /** Month of peak exposure */
    peakExposureMonth: number;
  };

  // ── Summary Metrics ──
  summaryMetrics: {
    irr: number;
    equityMultiple: number;
    developmentYield: number;
    developmentSpread: number;
    developmentMargin: number;
    stabilizedNOI: number;
    totalDevelopmentCost: number;
    impliedStabilizedValue: number;
    goingInYieldOnCost: number;
    exitCapRate: number;
    peakEquityExposure: number;
    monthsToStabilization: number;
    constructionLoanMaxBalance: number;
    permanentLoanAmount: number;
    equityReturnedAtRefi: number;
  };

  // ── Full Cash Flow Vector (monthly, from month 0 through exit) ──
  cashFlowVector: number[];
  /** Monthly granularity: negative during construction, ramping during lease-up, positive operating */
  monthlyCashFlowDetail: {
    month: number;
    phase: 'pre_development' | 'construction' | 'lease_up' | 'stabilized';
    equityContribution: number;
    debtDraw: number;
    operatingCashFlow: number;
    netCashFlow: number;
  }[];

  trace: ComputationTrace[];
  validation: ValidationResult;
}


// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2C: REDEVELOPMENT MODEL
// Existing asset + phased renovation. Overlapping cash flows.
// Bridge debt → Refi to perm. Rolling rent conversion.
// ─────────────────────────────────────────────────────────────────────────────

/** A single renovation phase (e.g., "Building A" or "Phase 1: 40 units") */
export interface RenovationPhase {
  phaseName: string;
  /** Units being renovated in this phase */
  unitCount: number;
  /** Which month this phase starts (from acquisition) */
  startMonth: number;
  /** Duration per unit (days of downtime) */
  downtimeDaysPerUnit: number;
  /** Renovation cost per unit */
  costPerUnit: TrackedAssumption;
  /** Total phase cost */
  totalPhaseCost: number;
  /** Post-renovation rent premium over vintage rent */
  rentPremium: TrackedAssumption;
  /** Expected post-renovation rent per unit */
  postRenovationRent: TrackedAssumption;
  /** Scope description */
  scope: string;
}

/** Monthly redevelopment detail — the hybrid cash flow */
export interface RedevelopmentMonthDetail {
  month: number;
  phase: 'acquisition' | 'renovation' | 'stabilization' | 'hold';

  // ── Unit Status ──
  unitsVintage: number;          // Still at old rents
  unitsInRenovation: number;     // Offline, zero income
  unitsRenovated: number;        // At premium rents
  totalOccupied: number;
  occupancyPct: number;

  // ── Revenue ──
  vintageRentalIncome: number;
  renovatedRentalIncome: number;
  otherIncome: number;
  totalRevenue: number;

  // ── Expenses & NOI ──
  operatingExpenses: number;
  noi: number;

  // ── Renovation Spend ──
  renovationCapex: number;
  cumulativeCapex: number;

  // ── Debt ──
  debtService: number;
  loanBalance: number;

  // ── Net Cash Flow ──
  netCashFlow: number;
}

export interface RedevelopmentAssumptions {
  modelType: 'redevelopment';
  modelVersion: string;

  // ── Property (Existing) ──
  property: {
    name: string;
    address: string;
    city: string;
    state: string;
    msa: string;
    submarket: string;
    units: number;
    yearBuilt: number;
    propertyClass: 'A' | 'B' | 'C' | 'D';
    /** Class the property is being repositioned TO */
    targetClass: 'A' | 'B' | 'C';
    propertyType: 'garden' | 'midrise' | 'highrise' | 'townhome';
    grossSF: number;
    avgUnitSF: number;
    coordinates: { lat: number; lng: number };
  };

  // ── Acquisition ──
  acquisition: {
    purchasePrice: TrackedAssumption;
    /** Going-in price per unit */
    pricePerUnit: number;
    closingCostsPct: TrackedAssumption;
    reserves: TrackedAssumption;
    closingDate: string;
  };

  // ── Current Operating Performance (T-12 Baseline) ──
  currentPerformance: {
    /** Current in-place average rent (vintage units) */
    inPlaceRentPerUnit: TrackedAssumption;
    currentOccupancy: TrackedAssumption;
    /** T-12 NOI (for going-in cap rate calc) */
    trailingNOI: TrackedAssumption;
    /** T-12 operating expenses per unit */
    currentOpexPerUnit: TrackedAssumption;
  };

  // ── Renovation Plan ──
  renovation: {
    /** Total renovation budget */
    totalBudget: TrackedAssumption;
    /** Per-unit interior renovation cost */
    interiorPerUnit: TrackedAssumption;
    /** Common area / amenity / exterior budget */
    commonAreaBudget: TrackedAssumption;
    /** Deferred maintenance / structural */
    deferredMaintenanceBudget?: TrackedAssumption;
    /** Contingency as % of renovation budget */
    contingencyPct: TrackedAssumption;
    /** Phased renovation schedule */
    phases: RenovationPhase[];
    /** Total months from first renovation to last unit complete */
    totalRenovationMonths: number;
    /** Average downtime per unit (days offline for renovation) */
    avgDowntimeDays: TrackedAssumption;
  };

  // ── Rent Structure (Dual) ──
  revenue: {
    /** Current vintage rent per unit */
    vintageRentPerUnit: TrackedAssumption;
    /** Target post-renovation rent per unit */
    renovatedRentPerUnit: TrackedAssumption;
    /** Rent premium: renovated vs vintage */
    renovationPremium: TrackedAssumption;
    /** Vintage rent growth (existing unrenovated units) */
    vintageRentGrowth: TrackedAssumption;
    /** Renovated rent growth (post-renovation units) */
    renovatedRentGrowth: TrackedAssumption;
    /** Vacancy for vintage units */
    vintageVacancy: TrackedAssumption;
    /** Vacancy for newly renovated units (lease-up after rehab) */
    renovatedLeaseUpVacancy: TrackedAssumption;
    /** Stabilized vacancy (post-all-renovation) */
    stabilizedVacancy: TrackedAssumption;
    concessionsPct: TrackedAssumption;
    badDebtPct: TrackedAssumption;
    otherIncomePerUnit: TrackedAssumption;
    otherIncomeGrowth: TrackedAssumption;
  };

  // ── Expenses ──
  expenses: {
    /** Current opex per unit (will escalate) */
    opexPerUnit: TrackedAssumption;
    /** Post-renovation opex delta (new units may have lower/higher costs) */
    postRenovationOpexDelta?: TrackedAssumption;
    expenseGrowth: TrackedAssumption;
    managementFeePct: TrackedAssumption;
    reservesPerUnit: TrackedAssumption;
  };

  // ── Bridge Debt (Short-term, for acquisition + renovation) ──
  bridgeDebt: {
    /** Loan amount: typically covers acquisition + renovation + reserves */
    loanAmount: TrackedAssumption;
    /** LTC (loan-to-cost including renovation budget) */
    ltc: number;
    interestRate: number;
    rateType: 'fixed' | 'floating';
    floatingSpread?: number;
    floatingIndex?: 'SOFR' | 'prime';
    /** Bridge loans are typically IO */
    ioMonths: number;
    loanTermMonths: number;
    /** Extension options (common in bridge: 2 × 6-month extensions) */
    extensions?: { months: number; fee: number; conditions: string }[];
    /** Interest reserve months */
    interestReserveMonths: number;
    /** Exit test: must achieve this DSCR/occupancy for refi */
    exitTest?: {
      minDSCR?: number;
      minOccupancy?: number;
      minNOI?: number;
    };
  };

  // ── Permanent Financing (Post-Stabilization Refi) ──
  permanentDebt: {
    /** Target refi month (from acquisition) */
    targetRefiMonth: TrackedAssumption;
    estimatedLoanAmount: TrackedAssumption;
    leverageMetric: { type: 'LTV' | 'DSCR_constrained'; value: number };
    interestRate: TrackedAssumption;
    rateType: 'fixed' | 'floating';
    amortizationYears: number;
    ioMonths: number;
    loanTermMonths: number;
  };

  // ── Disposition ──
  disposition: {
    /** Hold years from acquisition (includes renovation period) */
    holdYears: TrackedAssumption;
    exitCapRate: TrackedAssumption;
    sellingCostsPct: TrackedAssumption;
  };

  // ── Waterfall ──
  waterfall?: WaterfallTerms;

  // ── Platform Intelligence ──
  platformOverlays?: AcquisitionAssumptions['platformOverlays'] & {
    /** Comp-based renovation premium validation */
    renovationPremiumComps?: {
      avgPremiumInSubmarket: number;
      comparableRenovations: { property: string; premium: number; scope: string }[];
    };
  };
}

export interface RedevelopmentOutput {
  modelType: 'redevelopment';
  modelVersion: string;
  computedAt: string;
  assumptionsHash: string;

  // ── Sources & Uses ──
  sourcesAndUses: {
    sources: {
      bridgeLoan: number;
      equity: number;
      total: number;
    };
    uses: {
      purchasePrice: number;
      closingCosts: number;
      renovationBudget: number;
      contingency: number;
      reserves: number;
      interestReserve: number;
      total: number;
    };
  };

  // ── Monthly Detail (the hybrid cash flow — the core of redevelopment) ──
  monthlyDetail: RedevelopmentMonthDetail[];

  // ── Renovation Tracking ──
  renovationTracker: {
    phase: string;
    startMonth: number;
    endMonth: number;
    unitsCompleted: number;
    costIncurred: number;
    rentLiftAchieved: number;
  }[];

  // ── Refinance Event ──
  refinanceEvent: {
    refiMonth: number;
    /** NOI at refi (stabilized or near-stabilized) */
    noiAtRefi: number;
    /** Appraised value = NOI / market cap rate */
    appraisedValue: number;
    bridgeLoanPayoff: number;
    permanentLoanProceeds: number;
    closingCosts: number;
    /** Net: positive = equity returned to investors */
    netRefiProceeds: number;
    equityReturnedPct: number;
    /** Post-refi basis = original equity - equity returned */
    remainingEquityBasis: number;
  };

  // ── Post-Refi Annual Projections ──
  projections: AnnualProjection[];

  // ── Disposition ──
  disposition: DispositionAnalysis;

  // ── Debt Schedules ──
  bridgeDebtSchedule: {
    month: number;
    interestPayment: number;
    balance: number;
    fundedFromReserve: boolean;
  }[];
  permanentDebtScheduleAnnual: AcquisitionOutput['debtScheduleAnnual'];

  // ── Waterfall ──
  waterfallDistributions?: WaterfallDistribution[];

  // ── Sensitivity ──
  sensitivityIRR: SensitivityCell[];
  sensitivityEM: SensitivityCell[];

  // ── Redevelopment-Specific Metrics ──
  redevelopmentMetrics: {
    /** Going-in cap rate on T-12 NOI */
    goingInCapRate: number;
    /** Stabilized yield on total cost (acquisition + renovation) */
    stabilizedYieldOnCost: number;
    /** Value created = stabilized value - total cost */
    valueCreated: number;
    /** Value creation margin = value created / total cost */
    valueCreationMargin: number;
    /** Avg renovation premium achieved ($/unit) */
    avgRenovationPremium: number;
    /** Renovation ROI = premium × 12 / cost per unit */
    renovationROI: number;
    /** Months from acquisition to stabilization */
    monthsToStabilization: number;
    /** Months from acquisition to refi */
    monthsToRefi: number;
    /** % of equity returned at refi */
    equityReturnedAtRefi: number;
    /** Post-refi cash-on-cash (on remaining equity basis) */
    postRefiCashOnCash: number;
    /** Cost basis per unit (acquisition + renovation) */
    totalBasisPerUnit: number;
    /** Implied exit price per unit at disposition cap rate */
    impliedExitPricePerUnit: number;
  };

  // ── Summary Metrics ──
  summaryMetrics: {
    irr: number;
    equityMultiple: number;
    goingInCapRate: number;
    stabilizedYieldOnCost: number;
    exitCapRate: number;
    valueCreated: number;
    totalCostBasis: number;
    stabilizedNOI: number;
    minDSCR: number;
    equityReturnedAtRefi: number;
    renovationROI: number;
    peakEquityExposure: number;
  };

  // ── Cash Flow Vector (monthly, full lifecycle) ──
  cashFlowVector: number[];
  monthlyCashFlowDetail: {
    month: number;
    phase: 'acquisition' | 'renovation' | 'stabilization' | 'hold';
    vintageIncome: number;
    renovatedIncome: number;
    renovationSpend: number;
    debtService: number;
    netCashFlow: number;
  }[];

  trace: ComputationTrace[];
  validation: ValidationResult;
}


// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3: PROMPT TEMPLATE + VALIDATION CONTRACTS
// These interfaces define the contract between the platform and Claude
// ─────────────────────────────────────────────────────────────────────────────

/** The envelope sent to Claude for computation */
export interface ClaudeComputeRequest<
  T extends AcquisitionAssumptions | DevelopmentAssumptions | RedevelopmentAssumptions
> {
  /** System prompt template (selected by modelType) */
  systemPrompt: string;
  /** Complete assumptions — the ONLY input Claude uses */
  assumptions: T;
  /** Output schema (JSON Schema format) — Claude must conform to this exactly */
  outputSchema: object;
  /** Validation rules applied post-generation */
  validationRules: ValidationRule[];
  /** Request metadata */
  meta: {
    requestId: string;
    dealId: string;
    userId: string;
    /** If this is a re-run with modified assumptions, reference the prior run */
    priorRunId?: string;
    /** Which assumptions changed (for cache optimization) */
    changedAssumptions?: string[];
  };
}

/** Validation rule applied to Claude's output */
export interface ValidationRule {
  field: string;
  rule: 'range' | 'positive' | 'negative' | 'sum_equals' | 'monotonic' | 'ratio' | 'custom';
  params: Record<string, number | string | boolean>;
  severity: 'error' | 'warning';
  message: string;
}

/** Predefined validation rule sets per model type */
export const VALIDATION_RULES: Record<ModelType, ValidationRule[]> = {
  acquisition: [
    { field: 'summaryMetrics.irr', rule: 'range', params: { min: -0.5, max: 1.0 }, severity: 'warning', message: 'IRR outside typical range (-50% to 100%). Flagged for review.' },
    { field: 'summaryMetrics.irr', rule: 'range', params: { min: -1.0, max: 5.0 }, severity: 'error', message: 'IRR outside plausible range. Likely computation error.' },
    { field: 'summaryMetrics.equityMultiple', rule: 'range', params: { min: 0, max: 10 }, severity: 'warning', message: 'Equity multiple >10x is unusual. Verify assumptions.' },
    { field: 'summaryMetrics.minDSCR', rule: 'range', params: { min: 0.5, max: 5.0 }, severity: 'warning', message: 'DSCR outside normal range.' },
    { field: 'projections', rule: 'monotonic', params: { field: 'grossPotentialRent', direction: 'increasing' }, severity: 'warning', message: 'GPR should generally increase year-over-year.' },
    { field: 'sourcesAndUses.sources.total', rule: 'sum_equals', params: { target: 'sourcesAndUses.uses.total', tolerance: 1 }, severity: 'error', message: 'Sources must equal Uses.' },
    { field: 'projections.*.netOperatingIncome', rule: 'positive', params: {}, severity: 'warning', message: 'Negative NOI in operating period. Verify vacancy/expense assumptions.' },
    { field: 'cashFlowVector', rule: 'custom', params: { check: 'first_element_negative' }, severity: 'error', message: 'First cash flow must be negative (equity investment).' },
  ],
  development: [
    { field: 'summaryMetrics.irr', rule: 'range', params: { min: -0.5, max: 1.5 }, severity: 'warning', message: 'Development IRR outside typical range.' },
    { field: 'developmentMetrics.developmentYield', rule: 'range', params: { min: 0.03, max: 0.15 }, severity: 'warning', message: 'Development yield outside 3-15% range.' },
    { field: 'developmentMetrics.developmentSpread', rule: 'range', params: { min: -0.02, max: 0.06 }, severity: 'warning', message: 'Development spread outside typical range. Negative spread means building below market value.' },
    { field: 'constructionDrawSchedule', rule: 'custom', params: { check: 'equity_before_debt' }, severity: 'error', message: 'Equity must be drawn before construction debt per funding waterfall.' },
    { field: 'sourcesAndUses.sources.total', rule: 'sum_equals', params: { target: 'sourcesAndUses.uses.total', tolerance: 1 }, severity: 'error', message: 'Sources must equal Uses.' },
    { field: 'leaseUpSchedule', rule: 'monotonic', params: { field: 'cumulativeLeased', direction: 'increasing' }, severity: 'error', message: 'Cumulative leased units cannot decrease.' },
    { field: 'summaryMetrics.monthsToStabilization', rule: 'range', params: { min: 12, max: 60 }, severity: 'warning', message: 'Stabilization timeline outside 12-60 month range.' },
  ],
  redevelopment: [
    { field: 'summaryMetrics.irr', rule: 'range', params: { min: -0.5, max: 1.5 }, severity: 'warning', message: 'Redevelopment IRR outside typical range.' },
    { field: 'redevelopmentMetrics.renovationROI', rule: 'range', params: { min: 0.05, max: 0.50 }, severity: 'warning', message: 'Renovation ROI outside 5-50% range.' },
    { field: 'redevelopmentMetrics.goingInCapRate', rule: 'range', params: { min: 0.03, max: 0.15 }, severity: 'warning', message: 'Going-in cap rate outside 3-15% range.' },
    { field: 'refinanceEvent.netRefiProceeds', rule: 'range', params: { min: -Infinity, max: Infinity }, severity: 'warning', message: 'Negative refi proceeds means additional equity needed at refi.' },
    { field: 'sourcesAndUses.sources.total', rule: 'sum_equals', params: { target: 'sourcesAndUses.uses.total', tolerance: 1 }, severity: 'error', message: 'Sources must equal Uses.' },
    { field: 'monthlyDetail', rule: 'custom', params: { check: 'units_sum_to_total' }, severity: 'error', message: 'Vintage + InRenovation + Renovated must equal total units each month.' },
    { field: 'monthlyDetail', rule: 'custom', params: { check: 'renovation_downtime_no_income' }, severity: 'error', message: 'Units in renovation should generate zero rental income.' },
  ],
};


// ─────────────────────────────────────────────────────────────────────────────
// PROMPT TEMPLATE SKELETONS
// These are the system prompt structures. The actual prompt inserts the
// assumptions JSON and output schema dynamically.
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPT_TEMPLATES: Record<ModelType, string> = {
  acquisition: `You are computing an ACQUISITION financial model for a stabilized multifamily property.

## INPUT
You will receive a complete AcquisitionAssumptions JSON. Use ONLY these values. Do not infer, guess, or use external data.

## COMPUTATION INSTRUCTIONS

### Sources & Uses
- Uses: purchasePrice + closingCosts (price × closingCostsPct) + capexBudget (if any) + reserves
- Sources: debt.primary.loanAmount + equity (uses - debt)

### Annual Projections (Year 1 through holdYears)
For each year Y:
1. GPR = marketRentPerUnit × units × 12 × (1 + rentGrowth)^(Y-1)
   - If rentGrowth is array, use rentGrowth[Y-1]
2. Vacancy = GPR × vacancySchedule[Y-1]
3. Concessions = GPR × concessionsPct
4. Bad Debt = GPR × badDebtPct
5. Other Income = otherIncomePerUnit × units × 12 × (1 + otherIncomeGrowth)^(Y-1)
6. EGR = GPR - Vacancy - Concessions - Bad Debt + Other Income
7. OpEx = opexPerUnit × units × (1 + expenseGrowth)^(Y-1)
8. Management Fee = EGR × managementFeePct
9. Total OpEx = OpEx + Management Fee
10. NOI = EGR - Total OpEx
11. Reserves = reservesPerUnit × units
12. NOI After Reserves = NOI - Reserves
13. Debt Service: compute monthly, sum to annual
    - During IO: interest only = balance × rate / 12
    - After IO: standard amortization P&I
14. CFADS = NOI After Reserves - Total Debt Service

### Disposition (Exit Year)
1. Exit NOI = Year N+1 NOI (forward 12-month)
2. Gross Sale = Exit NOI / exitCapRate
3. Net Proceeds = Gross Sale - (Gross Sale × sellingCostsPct) - Loan Payoff

### Returns
1. Cash Flow Vector: [-equity, CF_Y1, CF_Y2, ..., CF_Yn + Net Proceeds]
2. IRR: Newton-Raphson on cash flow vector
3. EM: (Sum of all CFs + Net Proceeds) / Equity

### Sensitivity
- IRR grid: exitCapRate (±100bps in 25bp steps) × rentGrowth (±150bps in 50bp steps)
- EM grid: exitCapRate (±100bps) × holdYears (±2 years)

## OUTPUT
Return ONLY valid JSON conforming to the AcquisitionOutput schema. Include computationTrace for every NOI and IRR calculation.

## VALIDATION
- Sources must equal Uses (±$1 tolerance)
- First cash flow must be negative
- DSCR > 0 if debt service exists
- If IRR > 50%, set validation.requiresReview = true`,

  development: `You are computing a DEVELOPMENT financial model for a ground-up multifamily construction project.

## INPUT
You will receive a complete DevelopmentAssumptions JSON. Use ONLY these values.

## COMPUTATION INSTRUCTIONS

### Sources & Uses
- Uses: land + hardCosts + softCosts + developerFee + contingency + interestReserve
- Sources: constructionLoan + equity (uses - constructionLoan)

### Construction Period (Monthly, Month 0 through constructionMonths)
For each month M:
1. Compute draw amount based on drawMethod:
   - straight_line: totalHardCost / constructionMonths (hard costs); soft costs per their schedule
   - s_curve: S-curve distribution peaking at month constructionMonths/2
2. Funding waterfall: equity FIRST until equityRequiredBeforeFirstDraw exhausted, then debt
3. Interest accrual: debtOutstanding × allInRate / 12
4. Track cumulative equity deployed and debt outstanding

### Lease-Up Period (Monthly, post-CO)
For each month M after certificate of occupancy:
1. New leases = min(absorptionRate, totalUnits - cumulativeLeased)
2. Revenue = cumulativeLeased × weightedAvgRent × (1 - leaseUpConcessions)
3. Expenses = stabilizedExpenses × leaseUpExpensePct (buildings cost money when empty)
4. NOI = Revenue - Expenses
5. Stabilized when occupancyPct >= stabilizedOccupancy

### Construction-to-Perm Conversion
At stabilization month:
1. Stabilized NOI (annualized)
2. Permanent loan amount based on leverageMetric (LTV or DSCR-constrained)
3. Payoff construction loan balance (principal + accrued interest)
4. Net cash = permanent loan - construction payoff - refi costs
5. If positive, equity returned to investors

### Operating Period (Annual, post-stabilization through exit)
Same calculation as Acquisition model, using permanent debt terms.

### Disposition
Same as Acquisition, applied at holdYearsPostStabilization after stabilization.

### Returns
Cash Flow Vector: monthly from Month 0 through exit month. Convert to monthly IRR, annualize.

### Development-Specific Metrics
- Development Yield = Stabilized NOI / Total Development Cost
- Development Spread = Development Yield - Market Cap Rate
- Development Margin = (Implied Value - Total Cost) / Total Cost

## OUTPUT
Return ONLY valid JSON conforming to the DevelopmentOutput schema.

## VALIDATION
- Equity must fund before debt draws begin
- Cumulative leased units cannot decrease
- Sources must equal Uses
- Construction loan balance cannot exceed loanAmount`,

  redevelopment: `You are computing a REDEVELOPMENT financial model for a distressed multifamily asset undergoing phased renovation and repositioning.

## INPUT
You will receive a complete RedevelopmentAssumptions JSON. Use ONLY these values.

## KEY CONCEPT: OVERLAPPING CASH FLOWS
Unlike Acquisition (one period) or Development (two sequential periods), Redevelopment has SIMULTANEOUS income from occupied units AND renovation spend on units being rehabbed. The model must track three unit states every month:
- Vintage: occupied at old rents
- In Renovation: offline, zero income, incurring capex
- Renovated: re-leased at premium rents

## COMPUTATION INSTRUCTIONS

### Sources & Uses
- Uses: purchasePrice + closingCosts + renovationBudget + contingency + reserves + interestReserve
- Sources: bridgeLoan + equity

### Monthly Detail (Month 0 through exit)
For each month M:
1. Determine unit states from renovation.phases:
   - For each phase: startMonth to startMonth + (unitCount × downtimeDaysPerUnit / 30)
   - Units entering renovation come from vintage pool
   - Units completing renovation enter renovated pool
   - CONSTRAINT: vintageUnits + inRenovation + renovatedUnits = totalUnits (always)

2. Revenue:
   - Vintage income = vintageUnits × vintageRentPerUnit × (1 - vintageVacancy)
   - Renovated income = renovatedUnits × renovatedRentPerUnit × (1 - renovatedLeaseUpVacancy)
     - renovatedLeaseUpVacancy decays to stabilizedVacancy over 2-3 months per unit
   - Other income = totalOccupied × otherIncomePerUnit

3. Apply rent growth:
   - Vintage: vintageRentGrowth annually
   - Renovated: renovatedRentGrowth annually (starting from renovation completion)

4. Expenses = opexPerUnit × totalUnits (building costs don't decrease when units are offline)

5. NOI = Total Revenue - Expenses

6. Renovation capex: per phase schedule, costPerUnit × units being renovated that month

7. Bridge debt service: IO payment = bridgeLoanBalance × interestRate / 12
   - If operating CF covers debt service, funded from operations
   - If not, funded from interest reserve (track reserve burn)

8. Net CF = NOI - Debt Service - Renovation Capex

### Refinance Event
At targetRefiMonth (or when exitTest conditions are met):
1. Trailing NOI (annualized from prior 3 months)
2. Appraised value = trailing NOI / market cap rate
3. Permanent loan sized to leverageMetric
4. Payoff bridge loan
5. Net proceeds = permanent loan - bridge payoff - refi costs
6. If positive → equity returned to investors (KEY IRR DRIVER)

### Post-Refi Operating Period
Annual projections using permanent debt terms. All units now at renovated rents (with ongoing growth).

### Disposition
Exit NOI / exitCapRate at holdYears from acquisition.

### Returns
Monthly cash flow vector from Month 0 through exit. Refi equity return is a positive cash flow at refi month.

### Redevelopment-Specific Metrics
- Going-in Cap = T-12 NOI / Purchase Price
- Stabilized Yield on Cost = Stabilized NOI / (Purchase + Renovation + Closing)
- Value Created = Stabilized Value - Total Cost Basis
- Renovation ROI = (Annual Rent Premium × 12) / Renovation Cost Per Unit
- Equity Returned at Refi = net refi proceeds / total equity invested

## OUTPUT
Return ONLY valid JSON conforming to the RedevelopmentOutput schema.

## VALIDATION
- Vintage + InRenovation + Renovated = Total Units every month
- Units in renovation generate zero rental income
- Bridge loan balance never exceeds bridgeDebt.loanAmount
- Sources must equal Uses
- Interest reserve depletion tracked accurately`,
};


// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED MODEL TYPE — Discriminated union for type-safe switching
// ─────────────────────────────────────────────────────────────────────────────

export type FinancialAssumptions =
  | AcquisitionAssumptions
  | DevelopmentAssumptions
  | RedevelopmentAssumptions;

export type FinancialOutput =
  | AcquisitionOutput
  | DevelopmentOutput
  | RedevelopmentOutput;

/** Type guard: narrow assumptions by modelType */
export function isAcquisition(a: FinancialAssumptions): a is AcquisitionAssumptions {
  return a.modelType === 'acquisition';
}
export function isDevelopment(a: FinancialAssumptions): a is DevelopmentAssumptions {
  return a.modelType === 'development';
}
export function isRedevelopment(a: FinancialAssumptions): a is RedevelopmentAssumptions {
  return a.modelType === 'redevelopment';
}

/** Type guard: narrow output by modelType */
export function isAcquisitionOutput(o: FinancialOutput): o is AcquisitionOutput {
  return o.modelType === 'acquisition';
}
export function isDevelopmentOutput(o: FinancialOutput): o is DevelopmentOutput {
  return o.modelType === 'development';
}
export function isRedevelopmentOutput(o: FinancialOutput): o is RedevelopmentOutput {
  return o.modelType === 'redevelopment';
}


// ─────────────────────────────────────────────────────────────────────────────
// MODEL TYPE INFERENCE — From DealContext or user signals
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelTypeInferenceSignals {
  /** Does the property currently exist? */
  existingProperty: boolean;
  /** Is there a T-12 / rent roll available? */
  hasHistoricalFinancials: boolean;
  /** Is significant renovation planned? (>$15k/unit or >30% of acquisition) */
  significantRenovation: boolean;
  /** Is this ground-up construction? */
  groundUpConstruction: boolean;
  /** User's explicit selection (overrides inference) */
  userSelection?: ModelType;
  /** Bridge/construction financing indicated? */
  shortTermDebt: boolean;
  /** Lease-up period required? */
  requiresLeaseUp: boolean;
}

export function inferModelType(signals: ModelTypeInferenceSignals): ModelType {
  // User override always wins
  if (signals.userSelection) return signals.userSelection;

  // Ground-up = Development
  if (signals.groundUpConstruction || (!signals.existingProperty && signals.requiresLeaseUp)) {
    return 'development';
  }

  // Existing + heavy renovation = Redevelopment
  if (signals.existingProperty && signals.significantRenovation && signals.shortTermDebt) {
    return 'redevelopment';
  }

  // Existing + minor/no renovation = Acquisition
  if (signals.existingProperty && signals.hasHistoricalFinancials) {
    return 'acquisition';
  }

  // Fallback: if existing but unclear renovation scope
  if (signals.existingProperty && signals.significantRenovation) {
    return 'redevelopment';
  }

  // Default
  return 'acquisition';
}


// ─────────────────────────────────────────────────────────────────────────────
// DEALCONTEXT → ASSUMPTIONS ASSEMBLY
// Maps the Research Agent's DealContext into the correct assumptions schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The DealContext assembled by the Research Agent. This is the "Deal Capsule born from chat."
 * It contains everything the platform knows about a deal from all data sources.
 * The Cashflow Agent maps this into the correct model type's assumptions schema.
 */
export interface DealContext {
  dealId: string;
  /** Inferred or user-selected model type */
  modelType: ModelType;
  /** Raw property data from Research Agent */
  property: {
    address: string;
    coordinates: { lat: number; lng: number };
    units?: number;
    yearBuilt?: number;
    sf?: number;
    // ... extended by Research Agent
  };
  /** Platform module outputs (cached) */
  moduleOutputs: {
    M02_zoning?: object;
    M03_devCapacity?: object;
    M04_supply?: object;
    M05_market?: object;
    M06_demand?: object;
    M07_traffic?: object;
    M08_strategy?: object;
    M14_risk?: object;
    M25_jediScore?: object;
    M26_tax?: object;
    M27_saleComps?: object;
  };
  /** Broker-provided data (from email intake or manual upload) */
  brokerData?: {
    askingPrice?: number;
    t12?: object;
    rentRoll?: object;
    offeringMemorandum?: object;
  };
  /** User overrides and preferences */
  userOverrides?: Record<string, unknown>;
  /** Cache metadata */
  cache: {
    assembledAt: string;
    expiresAt: string;
    version: number;
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// CACHE PATTERN — For follow-up turns (60-70% credit cost reduction)
// ─────────────────────────────────────────────────────────────────────────────

export interface CachedModelRun {
  runId: string;
  dealId: string;
  modelType: ModelType;
  /** Hash of assumptions JSON — if unchanged, serve cached output */
  assumptionsHash: string;
  assumptions: FinancialAssumptions;
  output: FinancialOutput;
  /** Token usage for billing */
  tokenUsage: { input: number; output: number; totalCredits: number };
  /** Timestamp */
  computedAt: string;
  /** TTL: 24 hours default */
  expiresAt: string;
}

/**
 * Determine if a follow-up request can use cached output or needs re-computation.
 * Only re-run Claude if the changed assumptions actually affect the output.
 */
export function canUseCachedRun(
  cached: CachedModelRun,
  newAssumptions: FinancialAssumptions,
  changedFields: string[]
): { useCached: boolean; reason: string } {
  // If hash matches exactly, use cache
  if (cached.assumptionsHash === hashAssumptions(newAssumptions)) {
    return { useCached: true, reason: 'Assumptions unchanged' };
  }

  // If only display/metadata fields changed, use cache
  const nonMaterialFields = ['property.name', 'property.address', 'modelVersion'];
  if (changedFields.every(f => nonMaterialFields.includes(f))) {
    return { useCached: true, reason: 'Only non-material fields changed' };
  }

  // Otherwise, re-compute
  return { useCached: false, reason: `Material assumptions changed: ${changedFields.join(', ')}` };
}

/** Placeholder: actual implementation uses crypto.createHash('sha256') */
function hashAssumptions(assumptions: FinancialAssumptions): string {
  return JSON.stringify(assumptions); // Replace with real hash in production
}


// ─────────────────────────────────────────────────────────────────────────────
// FORMULA REGISTRY — Maps to existing F16–F34 from Module Wiring Blueprint
// ─────────────────────────────────────────────────────────────────────────────

export const FORMULA_REGISTRY = {
  // Shared across all model types
  F16: { name: 'NOI', formula: 'EGI - OpEx', models: ['acquisition', 'development', 'redevelopment'] },
  F17: { name: 'Cap Rate (Going-In)', formula: 'NOI / Purchase Price', models: ['acquisition', 'redevelopment'] },
  F18: { name: 'Cash-on-Cash', formula: 'BTCF / Equity', models: ['acquisition', 'development', 'redevelopment'] },
  F19: { name: 'IRR', formula: 'Newton-Raphson on CF vector', models: ['acquisition', 'development', 'redevelopment'] },
  F20: { name: 'Equity Multiple', formula: '(Distributions + Exit) / Equity', models: ['acquisition', 'development', 'redevelopment'] },
  F21: { name: 'DSCR', formula: 'NOI / Debt Service', models: ['acquisition', 'development', 'redevelopment'] },
  F22: { name: 'Debt Yield', formula: 'NOI / Loan Balance', models: ['acquisition', 'development', 'redevelopment'] },
  F32: { name: 'News-Adjusted Rent Growth', formula: 'baseline + Σ(event_impact)', models: ['acquisition', 'redevelopment'] },
  F33: { name: 'News-Adjusted Vacancy', formula: 'baseline - net_demand_adjustment', models: ['acquisition', 'redevelopment'] },
  F34: { name: 'Optimal Exit Year', formula: 'max(hold_value) across years', models: ['acquisition', 'development', 'redevelopment'] },

  // Development-specific
  F50: { name: 'Development Yield', formula: 'Stabilized NOI / Total Dev Cost', models: ['development'] },
  F51: { name: 'Development Spread', formula: 'Dev Yield - Market Cap Rate', models: ['development'] },
  F52: { name: 'Capitalized Interest', formula: 'Σ(monthly_balance × rate / 12)', models: ['development'] },
  F53: { name: 'Construction Draw (S-Curve)', formula: 'CDF of logistic function', models: ['development'] },
  F54: { name: 'Lease-Up Absorption', formula: 'min(rate, remaining_units)', models: ['development'] },

  // Redevelopment-specific
  F60: { name: 'Renovation ROI', formula: '(Premium × 12) / Cost Per Unit', models: ['redevelopment'] },
  F61: { name: 'Blended Rent (Monthly)', formula: '(vintage × vintageRent + renovated × renovatedRent) / occupied', models: ['redevelopment'] },
  F62: { name: 'Value Created', formula: 'Stabilized Value - Total Cost Basis', models: ['redevelopment'] },
  F63: { name: 'Equity Returned at Refi', formula: 'Perm Loan - Bridge Payoff - Costs', models: ['redevelopment'] },
  F64: { name: 'Renovation Vacancy Loss', formula: 'inRenovation × avgRent × downtimeDays / 30', models: ['redevelopment'] },
} as const;
