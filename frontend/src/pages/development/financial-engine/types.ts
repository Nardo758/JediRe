export type DealType = 'existing' | 'development' | 'redevelopment';

export type InputSource = 'broker' | 'platform' | 'user' | 'agent' | 'capsule';

export interface SourcedValue<T = number> {
  value: T;
  source: InputSource;
  agentName?: string;
  linkedFrom?: string;
}

export interface UnitMixRow {
  floorPlan: string;
  unitSize: number;
  beds: number;
  units: number;
  occupied: number;
  vacant: number;
  marketRent: number;
  inPlaceRent: number;
}

export interface OtherIncomeItem {
  perUnitMonth: number;
  penetration: number;
}

export interface ExpenseItem {
  amount: number;
  type: 'perUnit' | 'total' | 'pctEGR';
  growthRate: number;
}

export interface CapexLineItem {
  description: string;
  amount: number;
}

export interface WaterfallHurdle {
  hurdleRate: number;
  promoteToGP: number;
  lpSplit: number;
}

export interface LoanOption {
  id: string;
  name: string;
  type: string;
  amount: number;
  rate: number;
  spread: number;
  term: number;
  amortization: number;
  ioPeriod: number;
  originationFee: number;
  rateCapCost: number;
  prepayPenalty: number;
  loanType: 'Fixed' | 'Floating';
  source: InputSource;
  selected?: boolean;
}

export interface ModelAssumptions {
  dealInfo: {
    dealName: string;
    totalUnits: number;
    netRentableSF: number;
    vintage: number;
    address: string;
    city: string;
    state: string;
  };
  modelType: 'existing' | 'development';
  holdPeriod: number;
  unitMix: UnitMixRow[];
  acquisition: {
    purchasePrice: number;
    capRate: number;
    closingCosts: Record<string, number>;
  };
  disposition: {
    exitCapRate: number;
    sellingCosts: number;
    saleNOIMethod: string;
  };
  revenue: {
    rentGrowth: number[];
    lossToLease: number;
    stabilizedOccupancy: number;
    collectionLoss: number;
    otherIncome: Record<string, OtherIncomeItem>;
  };
  expenses: Record<string, ExpenseItem>;
  financing: {
    loanAmount: number;
    loanType: string;
    interestRate: number;
    spread: number;
    term: number;
    amortization: number;
    ioPeriod: number;
    originationFee: number;
    rateCapCost: number;
    prepayPenalty: number;
  };
  capex: {
    lineItems: CapexLineItem[];
    contingencyPct: number;
    reservesPerUnit: number;
  };
  waterfall: {
    lpShare: number;
    gpShare: number;
    hurdles: WaterfallHurdle[];
    equityContribution: number;
  };
  development?: {
    landCost: number;
    hardCostPerSF: number;
    hardCostContingency: number;
    softCostPct: number;
    developerFee: number;
    constructionPeriod: number;
    leaseUpVelocity: number;
    constructionLoanLTC: number;
    constructionLoanRate: number;
  };
}

export interface ModelResults {
  summary: {
    irr?: number;
    equityMultiple?: number;
    cashOnCash?: number;
    noi?: number;
    dscr?: number;
    yieldOnCost?: number;
    exitValue?: number;
    totalProfit?: number;
    lpIrr?: number;
    lpEm?: number;
    lpCoC?: number;
    lpTotalDistributions?: number;
    lpProfit?: number;
    gpIrr?: number;
    gpEm?: number;
    gpCoC?: number;
    gpTotalDistributions?: number;
    gpPromoteEarned?: number;
  };
  annualCashFlow: AnnualCashFlowRow[];
  sourcesAndUses: {
    sources: { label: string; amount: number }[];
    uses: { label: string; amount: number }[];
  };
  debtMetrics: any;
  sensitivityAnalysis: any;
  waterfallDistributions: WaterfallDistribution[];
  projections?: ProjectionRow[];
}

export interface AnnualCashFlowRow {
  year: number;
  gpr: number;
  vacancy: number;
  egr: number;
  otherIncome: number;
  totalRevenue: number;
  opex: number;
  noi: number;
  debtService: number;
  cashFlow: number;
  lpDistribution?: number;
  gpDistribution?: number;
  cumulativeReturn?: number;
  runningEM?: number;
}

export interface ProjectionRow {
  label: string;
  section: 'revenue' | 'expense' | 'noi' | 'debt' | 'cashflow' | 'metrics' | 'exit';
  isHeader?: boolean;
  isTotal?: boolean;
  values: (number | null)[];
  monthly?: (number | null)[];
}

export interface WaterfallDistribution {
  tier: string;
  hurdleRate: number;
  lpAmount: number;
  gpAmount: number;
  lpSplit: number;
  gpSplit: number;
  promotePct: number;
}

export interface ModelVersion {
  id: string;
  name: string;
  timestamp: number;
  source: 'user' | string;
  dealType: DealType;
  assumptions: ModelAssumptions;
  results?: ModelResults;
}

// ─── F9 DealFinancials types (shared across tabs) ────────────────────────────

export interface F9TrafficYear {
  year: number; vacancyPct: number|null; occupancyPct: number|null;
  effRent: number|null; rentGrowthPct: number|null;
  t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null;
}

export interface F9GprDecomposition {
  brokerAnnual: number|null; platformAnnual: number|null; t12Annual: number|null;
  rentRollAnnual: number|null; resolvedAnnual: number|null;
  brokerPerUnitMo: number|null; platformPerUnitMo: number|null;
  t12PerUnitMo: number|null; resolvedPerUnitMo: number|null;
}

export interface F9DealFinancials {
  dealId: string; dealName: string; totalUnits: number;
  proforma: {
    year1: Array<{
      field: string; label: string;
      broker: number|null; platform: number|null; t12: number|null;
      rentRoll: number|null; taxBill: number|null;
      resolved: number|null; resolution: string|null; perUnit: number|null;
      source?: string|null; confidence?: number|null;
      benchmarkPosition: 'above' | 'below' | 'within' | null;
    }>;
    integrityChecks: Array<{ id: string; status: 'ok'|'warn'|'error'; message: string; detail?: Record<string, unknown> }>;
    unitEconomics: Record<string, number|null>;
  };
  /** Hold-period returns computed from the F9 projection engine */
  returns: { irr: number|null; equityMultiple: number|null; cashOnCash: number|null } | null;
  capitalStack: {
    purchasePrice: number|null; loanAmount: number|null; equityAtClose: number|null;
    ltcPct: number|null; interestRate: number|null; ioPeriodMonths: number|null;
    amortizationYears: number|null; dscrMin: number|null;
    originationFeePct: number|null; pricePerUnit: number|null;
  };
  rentRollSummary: { avgInPlaceRent: number|null; weightedOccupancyPct: number|null }|null;
  trafficProjection: {
    yearly: F9TrafficYear[];
    leaseUp: { weeksTo90: number|null; weeksTo93: number|null; weeksTo95: number|null }|null;
    calibrated: { vacancyPct: number|null; rentGrowthPct: number|null; exitCap: number|null; lastCalibrated: string|null };
    leasingSignals: { t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null; t07LeaseUpWeeksTo95: number|null; stabilizedOccupancyPct: number|null; confidence: number|null }|null;
  }|null;
  assumptions: {
    holdYears: number; exitCap: number|null; rentGrowthYr1: number|null;
    rentGrowthStabilized: number|null;
    perYear: Array<{ year: number; rentGrowthPct: number|null; vacancyPct: number|null; exitCapIfLastYear: number|null }>;
    gprDecomposition: F9GprDecomposition|null;
    narrative: string|null;
  };
  userOverrides: Record<string, Record<number, number|null>>;
  meta: { seeded: boolean; updatedAt: string|null };
  taxes: F9TaxData | null;
  /** Debt stack — senior + mezz/B-Note loans (v2) */
  debt: F9DebtStack | null;
  /** Sources & Uses — capital deployment at close */
  sourcesUses: {
    sources: Array<{ id: string; label: string; amount: number | null; pct: number | null; sub: string | null; userOverridable?: boolean }>;
    uses: Array<{ id: string; label: string; amount: number | null; pct: number | null; sub: string | null; userOverridable: boolean }>;
    totalSources: number | null;
    totalUses: number | null;
    delta: number | null;
    balanced: boolean;
    benchmarks: {
      totalCostPerUnit: number | null;
      totalCostPerSf: number | null;
      closingCostsPct: number | null;
      debtPct: number | null;
      equityPct: number | null;
      capexPerUnit: number | null;
    };
    userOverrides: {
      closingCosts: number | null;
      capexTotal: number | null;
      workingCapital: number | null;
      preopeningCosts: number | null;
      otherUses: number | null;
      sellerFinancing: number | null;
    };
  } | null;
}

export type F9ProFormaRow = F9DealFinancials['proforma']['year1'][number];
export type F9IntegrityCheck = F9DealFinancials['proforma']['integrityChecks'][number];

// ─── F9 Tax data ──────────────────────────────────────────────────────────────

export interface F9TaxYear {
  year: number;
  assessedValue: number;
  millageRate: number;
  taxAmount: number;
  sohCapBinding: boolean;
  reassessmentEvent: boolean;
}

export interface F9TaxData {
  reTax: {
    t12AssessedValue: number | null;
    t12MillageRate: number | null;
    t12AnnualTax: number | null;
    platformAssessedValue: number | null;
    platformAnnualTax: number | null;
    isMiamiDade: boolean;
    sohCapPct: number;
    perYear: F9TaxYear[];
    deltaVsT12Pct: number | null;
  };
  tpp: {
    broker: number | null;
    platform: number | null;
  };
  incomeTax: {
    purchasePrice: number | null;
    landValuePct: number;
    depreciableBase: number | null;
    annualDepreciation: number | null;
    bonusDepreciationCurrentYearPct: number;
    costSegAvailablePct: number;
  };
  transferTax: {
    purchasePrice: number | null;
    isMiamiDade: boolean;
    miamiDadeRatePct: number;
    statewideFlatRatePct: number;
    appliedRatePct: number;
    docStampAmount: number | null;
    intangibleTaxAmount: number | null;
    loanAmount: number | null;
    totalTransferTax: number | null;
    refi: {
      enabled: boolean;
      triggerYear: number;
      newLoanType: string | null;
      refiLoanAmount: number | null;
      refiDocStampAmount: number | null;
      refiIntangibleTaxAmount: number | null;
      refiTotalTax: number | null;
    } | null;
  };
  userOverrides: {
    taxAssessedValue: number | null;
    taxMillageRate: number | null;
    tppAmount: number | null;
    taxCounty: boolean | null;
  };
}

export interface F9NarrativeBlock {
  id: string;
  label: string;
  summary: string;
  detail: string | null;
  status: 'ok' | 'warn' | 'info';
}

export interface FinancialEngineTabProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType: DealType;
  assumptions: ModelAssumptions | null;
  modelResults: ModelResults | null;
  onAssumptionsChange?: (a: Partial<ModelAssumptions>) => void;
  onBuildModel?: () => void;
  building?: boolean;
  versions?: ModelVersion[];
  activeVersion?: ModelVersion | null;
  /** Fires when Pro Forma integrity checks load; hasErrors=true blocks Projections tab */
  onIntegrityChange?: (hasErrors: boolean) => void;
  /** F9 DealFinancials (from /api/v1/deals/:id/financials) shared across F1/F8/F10 tabs */
  f9Financials?: F9DealFinancials | null;
  /** True when Pro Forma integrity checks contain errors — tab shows warning banner but remains accessible */
  integrityWarning?: boolean;
  /** Navigate to a sibling tab by index */
  onTabChange?: (tabIndex: number) => void;
  /** Refetch f9Financials from the server (e.g. after a PATCH override) */
  onF9Refresh?: () => void;
}

// ─── F9 Debt Stack (v2) ───────────────────────────────────────────────────────

export type PrepayType = 'lockout' | 'yield_maintenance' | 'defeasance' | 'stepdown' | 'open';

export interface F9DebtLoan {
  /** Unique id within the stack, e.g. 'senior' | 'mezz' */
  id: string;
  /** Display label */
  name: string;
  /** Bridge | Agency | CMBS | HUD | LifeCo | Mezz */
  loanTypeLabel: string;
  /** Fixed | Floating */
  rateType: 'Fixed' | 'Floating';
  /** 4-column values — null means source has no data for this field */
  loanAmount: { broker: number|null; platform: number|null };
  ltcPct:     { broker: number|null; platform: number|null };
  ltv:        { platform: number|null };
  interestRate: { broker: number|null; platform: number|null };
  sofr:       { platform: number|null };
  spread:     { broker: number|null; platform: number|null };
  capRate:    { broker: number|null; platform: number|null };
  termYears:  { broker: number|null; platform: number|null };
  amortYears: { broker: number|null; platform: number|null };
  ioMonths:   { broker: number|null; platform: number|null };
  origFee:    { broker: number|null; platform: number|null };
  exitFee:    { platform: number|null };
  rateCapCost:{ broker: number|null; platform: number|null };
  minDscr:    { platform: number|null };
  minDebtYield: { platform: number|null };
  minOccupancy: { platform: number|null };
  maxLtv:     { platform: number|null };
  cashTrapDscr: { platform: number|null };
  tiEscrowMonths:      { platform: number|null };
  replacementReserve:  { platform: number|null };
  operatingReserveMonths: { platform: number|null };
  prepayType: PrepayType;
  /** Derived annual DS at platform rate/amount */
  derivedAnnualDS: number | null;
  /** SOFR forward curve (5 years), pct decimal e.g. 0.05 */
  sofrCurve: number[];
  /** Extension options text (persisted, senior only) */
  extensionOptions: string | null;
  /** Refi event configuration (persisted, senior only) */
  refiEnabled: boolean;
  refiTriggerYear: number;
  refiNewLoanType: string | null;
}

export interface F9DebtStack {
  loans: F9DebtLoan[];
  /** Aggregate totals across all loans */
  aggregate: {
    totalLoanAmount: number|null;
    blendedRatePct:  number|null;
    combinedLtcPct:  number|null;
    totalAnnualDS:   number|null;
    aggregateDscr:   number|null;
  };
}

export const fmt$ = (n: number): string => {
  const v = Number(n);
  if (isNaN(v)) return '—';
  if (v === 0) return '$0';
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString()}`;
};

export const fmtPct = (n: number): string => { const v = Number(n); return isNaN(v) ? '—' : `${v.toFixed(1)}%`; };
export const fmtPctRaw = (n: number): string => { const v = Number(n); return isNaN(v) ? '—' : `${(v * 100).toFixed(2)}%`; };
export const fmtX = (n: number): string => { const v = Number(n); return isNaN(v) ? '—' : `${v.toFixed(2)}×`; };
export const fmtN = (n: number): string => { const v = Number(n); return isNaN(v) ? '—' : v.toLocaleString(); };
