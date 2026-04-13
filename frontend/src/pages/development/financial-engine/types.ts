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
    year1: Array<{ field: string; label: string; broker: number|null; platform: number|null; t12: number|null; rentRoll: number|null; taxBill: number|null; resolved: number|null; resolution: string|null; perUnit: number|null }>;
    integrityChecks: Array<{ id: string; status: 'ok'|'warn'|'error'; message: string; detail?: Record<string, unknown> }>;
    unitEconomics: Record<string, number|null>;
  };
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
