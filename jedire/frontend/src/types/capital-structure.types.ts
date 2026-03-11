/**
 * Capital Structure Engine Types
 *
 * Type definitions for the Capital Structure Engine (M11+).
 * Covers all 7 sections: Capital Stack, Debt Selector, Rate Environment,
 * Equity Waterfall, Scenario Comparison, Lifecycle Timeline, Cross-Module Integration.
 */

// ============================================================================
// Strategy Types
// ============================================================================

export type StrategyType = 'build_to_sell' | 'flip' | 'rental_value_add' | 'rental_stabilized' | 'str';

export type DealStatusMode = 'pipeline' | 'owned';

// ============================================================================
// Capital Stack
// ============================================================================

export type LayerType =
  | 'senior'
  | 'mezz'
  | 'prefEquity'
  | 'gpEquity'
  | 'lpEquity'
  | 'incentive';

export interface CapitalLayer {
  id: string;
  name: string;
  layerType: LayerType;
  amount: number;
  percentage: number; // of total stack
  rate: number; // interest rate or pref return (%)
  term: number; // months
  source: string; // lender name or equity source
  notes?: string;
  color: string; // Tailwind color for visualization
}

export interface CapitalStack {
  dealId: string;
  strategy: StrategyType;
  totalSources: number;
  totalUses: number;
  layers: CapitalLayer[];
  isBalanced: boolean; // totalSources === totalUses
  imbalance: number; // totalSources - totalUses
  uses: CapitalUses;
  metrics: StackMetrics;
}

export interface CapitalUses {
  acquisitionPrice: number;
  closingCosts: number;
  renovationBudget: number;
  carryingCosts: number;
  reserves: number;
  developerFee: number;
  total: number;
}

export interface StackMetrics {
  ltv: number;
  ltc: number;
  dscr: number;
  debtYield: number;
  equityRequired: number;
  totalDebt: number;
  totalEquity: number;
  weightedAvgCostOfCapital: number;
  cocReturn: number;
}

// ============================================================================
// Debt Products
// ============================================================================

export type DebtProductType =
  | 'agency'
  | 'cmbs'
  | 'bank'
  | 'life_company'
  | 'bridge'
  | 'hard_money'
  | 'construction'
  | 'dscr_loan'
  | 'debt_fund'
  | 'mezz';

export interface DebtProduct {
  id: string;
  name: string;
  productType: DebtProductType;
  lender: string;
  rateType: 'fixed' | 'floating';
  rateRange: { min: number; max: number };
  spreadOverIndex?: number; // bps over SOFR/Treasury
  indexName?: string;
  ltvMax: number;
  ltcMax?: number;
  term: { min: number; max: number }; // months
  amortization: number; // years, 0 = IO
  recourse: 'non-recourse' | 'partial' | 'full';
  prepaymentPenalty: string;
  dscrMin: number;
  assumable: boolean;
  closingTimeline: number; // days
  fees: {
    origination: number; // %
    closing: number; // %
    legal: number; // $
  };
  bestForStrategies: StrategyType[];
  keyBenefit: string;
  keyRisk: string;
}

// ============================================================================
// Rate Environment
// ============================================================================

export type CyclePhase = 'easing' | 'trough' | 'tightening' | 'peak';

export interface RateEnvironmentData {
  fedFunds: number;
  treasury10Y: number;
  treasury2Y: number;
  sofr: number;
  prime: number;
  cmbsSpread: number; // bps
  agencySpread: number; // bps
  bridgeSpread: number; // bps
  lastUpdated: string;
  cyclePhase: CyclePhase;
  fedDirection: 'hiking' | 'holding' | 'cutting';
  nextFedMeeting: string;
  marketSentiment: string;
  cutProbability6mo: number; // 0-100
}

export interface RateForecast {
  months: number;
  treasury10Y: number;
  sofr: number;
  confidence: number; // 0-100
}

export interface LockVsFloatAnalysis {
  lockNow: {
    rate: number;
    totalCost: number;
    npv: number;
  };
  floatAndWait: {
    expectedRate: number;
    bestCase: number;
    worstCase: number;
    totalCost: number;
    npv: number;
  };
  recommendation: 'lock' | 'float';
  rationale: string;
  breakEvenMonths: number;
}

export interface SpreadAnalysis {
  productType: string;
  currentSpread: number; // bps
  fiveYearAvg: number; // bps
  position: 'tight' | 'average' | 'wide';
  percentile: number; // 0-100
}

// ============================================================================
// Equity Waterfall
// ============================================================================

export interface WaterfallTier {
  id: string;
  name: string;
  hurdleRate: number; // IRR hurdle (e.g., 0.08 = 8%)
  gpSplit: number; // 0-1 (e.g., 0.30 = 30%)
  lpSplit: number; // 0-1 (e.g., 0.70 = 70%)
  description: string;
}

export interface EquityWaterfall {
  dealId: string;
  lpCapital: number;
  gpCapital: number;
  totalEquity: number;
  lpPercentage: number;
  gpPercentage: number;
  preferredReturn: number; // annual % (e.g., 8)
  tiers: WaterfallTier[];
  catchUpProvision: boolean;
  catchUpPercentage: number; // GP catch-up %
  clawbackProvision: boolean;
}

export interface WaterfallDistribution {
  tierId: string;
  tierName: string;
  lpDistribution: number;
  gpDistribution: number;
  totalDistribution: number;
  cumulativeLPReturn: number;
  cumulativeGPReturn: number;
  irr: number;
}

export interface WaterfallResult {
  distributions: WaterfallDistribution[];
  lpTotalReturn: number;
  gpTotalReturn: number;
  lpIRR: number;
  gpIRR: number;
  lpEquityMultiple: number;
  gpEquityMultiple: number;
  gpEffectiveShare: number;
  totalDistributed: number;
  exitProceeds: number;
}

// ============================================================================
// Scenario Comparison
// ============================================================================

export interface CapitalScenario {
  id: string;
  name: string;
  description: string;
  stack: CapitalStack;
  waterfall: EquityWaterfall;
  returns: {
    irr: number;
    equityMultiple: number;
    cocReturn: number;
    dscr: number;
  };
  risks: {
    refinanceRisk: 'low' | 'medium' | 'high';
    interestRateRisk: 'low' | 'medium' | 'high';
    recourseExposure: number;
    covenantHeadroom: number; // bps above min DSCR
  };
  isActive: boolean;
}

export interface ScenarioComparison {
  scenarios: CapitalScenario[];
  bestIRR: string; // scenario id
  bestCoC: string;
  lowestRisk: string;
  recommendation: string;
  delta: {
    irr: number;
    equityMultiple: number;
    dscr: number;
  };
}

// ============================================================================
// Debt Lifecycle Timeline
// ============================================================================

export type TimelineEventType =
  | 'origination'
  | 'draw'
  | 'interest_payment'
  | 'rate_reset'
  | 'extension'
  | 'refinance'
  | 'maturity'
  | 'payoff'
  | 'milestone';

export interface TimelineEvent {
  id: string;
  date: string;
  type: TimelineEventType;
  title: string;
  description: string;
  amount?: number;
  isPast: boolean;
  isKeyEvent: boolean;
}

export interface DebtTimeline {
  events: TimelineEvent[];
  totalDrawn: number;
  totalRepaid: number;
  interestReserve: number;
  nextKeyEvent: TimelineEvent | null;
  constructionProgress?: number; // 0-100 draw percentage
}

// ============================================================================
// Strategy Capital Templates
// ============================================================================

export interface StrategyCapitalTemplate {
  strategy: StrategyType;
  label: string;
  description: string;
  defaultStack: {
    seniorDebt: { ltvOrLtc: number; rateRange: { min: number; max: number }; term: string; amortization: string; productType: DebtProductType };
    mezzanine?: { percentage: number; rate: number; term: string };
    equityStructure: { lpPct: number; gpPct: number; prefReturn: number };
  };
  keyMetric: string;
  holdPeriod: string;
  exitStrategy: string;
  typicalPromote: string;
  color: string; // theme color
}

// ============================================================================
// Cross-Module Integration Events
// ============================================================================

export interface CapitalStructureEvent {
  type:
    | 'capital.stack.updated'
    | 'capital.structure.risk'
    | 'capital.returns.updated';
  dealId: string;
  data: Record<string, any>;
  timestamp: Date;
}

// ============================================================================
// Insight System (Data → Insight → Action)
// ============================================================================

export interface MetricInsight {
  metric: string;
  value: string;
  insight: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
  action?: {
    label: string;
    handler: string; // action id
  };
}

export interface StrategyMismatchWarning {
  strategy: StrategyType;
  debtProduct: string;
  issue: string;
  suggestion: string;
}
