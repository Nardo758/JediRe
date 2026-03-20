/**
 * Capital Structure Engine — Mock Data
 *
 * Rich mock data for all 7 sections of the Capital Structure Engine.
 * Includes 4 strategy templates with realistic defaults, debt products,
 * waterfall structures, rate environment, and comparison scenarios.
 */

import type {
  StrategyType,
  StrategyCapitalTemplate,
  CapitalStack,
  CapitalLayer,
  CapitalUses,
  DebtProduct,
  RateEnvironmentData,
  RateForecast,
  LockVsFloatAnalysis,
  SpreadAnalysis,
  EquityWaterfall,
  WaterfallResult,
  CapitalScenario,
  ScenarioComparison,
  DebtTimeline,
  TimelineEvent,
  MetricInsight,
  StrategyMismatchWarning,
} from '../types/capital-structure.types';

// ============================================================================
// Strategy Capital Templates
// ============================================================================

export const strategyTemplates: Record<StrategyType, StrategyCapitalTemplate> = {
  build_to_sell: {
    strategy: 'build_to_sell',
    label: 'Build-to-Sell',
    description: 'Ground-up development sold at stabilization',
    defaultStack: {
      seniorDebt: {
        ltvOrLtc: 0.63,
        rateRange: { min: 7.75, max: 9.50 },
        term: '18-30mo + ext',
        amortization: 'IO',
        productType: 'construction',
      },
      mezzanine: { percentage: 12, rate: 14, term: '18-30mo' },
      equityStructure: { lpPct: 80, gpPct: 20, prefReturn: 8 },
    },
    keyMetric: 'Yield on Cost',
    holdPeriod: '24-36 months',
    exitStrategy: 'Sell stabilized or refi to perm',
    typicalPromote: '8% pref → 70/30 → 60/40',
    color: 'blue',
  },
  flip: {
    strategy: 'flip',
    label: 'Flip',
    description: 'Quick buy-renovate-sell at ARV',
    defaultStack: {
      seniorDebt: {
        ltvOrLtc: 0.78,
        rateRange: { min: 10, max: 14 },
        term: '6-18mo',
        amortization: 'IO',
        productType: 'hard_money',
      },
      equityStructure: { lpPct: 0, gpPct: 100, prefReturn: 0 },
    },
    keyMetric: 'Annualized ROI',
    holdPeriod: '3-12 months',
    exitStrategy: 'Sell at ARV',
    typicalPromote: 'N/A (solo) or 50/50 JV',
    color: 'orange',
  },
  rental_value_add: {
    strategy: 'rental_value_add',
    label: 'Rental (Value-Add)',
    description: 'Bridge → renovate → refi to perm → hold',
    defaultStack: {
      seniorDebt: {
        ltvOrLtc: 0.77,
        rateRange: { min: 7.50, max: 10.50 },
        term: '24-36mo bridge → 5-10yr perm',
        amortization: 'IO → 30yr',
        productType: 'bridge',
      },
      equityStructure: { lpPct: 80, gpPct: 20, prefReturn: 8 },
    },
    keyMetric: 'Cash-on-Cash at Stabilization',
    holdPeriod: '3-5 years (value-add period)',
    exitStrategy: 'Refi to perm + hold',
    typicalPromote: '8% pref → 70/30',
    color: 'green',
  },
  rental_stabilized: {
    strategy: 'rental_stabilized',
    label: 'Rental (Stabilized)',
    description: 'Acquire stabilized asset with permanent financing',
    defaultStack: {
      seniorDebt: {
        ltvOrLtc: 0.70,
        rateRange: { min: 5.0, max: 6.5 },
        term: '5/7/10yr',
        amortization: '30yr',
        productType: 'agency',
      },
      equityStructure: { lpPct: 80, gpPct: 20, prefReturn: 7.5 },
    },
    keyMetric: 'DSCR + Cash-on-Cash',
    holdPeriod: '5-10 years',
    exitStrategy: 'Hold → sell or 1031',
    typicalPromote: '7-8% pref → 80/20',
    color: 'purple',
  },
  str: {
    strategy: 'str',
    label: 'Short-Term Rental',
    description: 'Acquire for Airbnb/VRBO with DSCR-based financing',
    defaultStack: {
      seniorDebt: {
        ltvOrLtc: 0.70,
        rateRange: { min: 7.0, max: 9.0 },
        term: '5-7yr',
        amortization: '30yr',
        productType: 'dscr_loan',
      },
      equityStructure: { lpPct: 50, gpPct: 50, prefReturn: 0 },
    },
    keyMetric: 'RevPAR-based DSCR',
    holdPeriod: '3-7 years',
    exitStrategy: 'Hold → sell',
    typicalPromote: 'Varies — often solo/small JV',
    color: 'teal',
  },
};

// ============================================================================
// Default Capital Stack (Rental Value-Add — $45M deal)
// ============================================================================

const defaultUses: CapitalUses = {
  acquisitionPrice: 38500000,
  closingCosts: 770000,
  renovationBudget: 4200000,
  carryingCosts: 850000,
  reserves: 380000,
  developerFee: 300000,
  total: 45000000,
};

const defaultLayers: CapitalLayer[] = [
  {
    id: 'layer-senior',
    name: 'Senior Debt (Bridge)',
    layerType: 'senior',
    amount: 33750000,
    percentage: 75,
    rate: 8.75,
    term: 36,
    source: 'Arbor Realty Trust',
    color: 'bg-blue-500',
  },
  {
    id: 'layer-mezz',
    name: 'Mezzanine Debt',
    layerType: 'mezz',
    amount: 2250000,
    percentage: 5,
    rate: 14.0,
    term: 36,
    source: 'Advantage Capital',
    color: 'bg-yellow-500',
  },
  {
    id: 'layer-lp',
    name: 'LP Equity',
    layerType: 'lpEquity',
    amount: 7200000,
    percentage: 16,
    rate: 8.0,
    term: 60,
    source: 'Institutional LP Fund',
    color: 'bg-green-500',
  },
  {
    id: 'layer-gp',
    name: 'GP Co-Invest',
    layerType: 'gpEquity',
    amount: 1800000,
    percentage: 4,
    rate: 0,
    term: 60,
    source: 'Sponsor Equity',
    color: 'bg-purple-500',
  },
];

export const defaultCapitalStack: CapitalStack = {
  dealId: 'deal-001',
  strategy: 'rental_value_add',
  totalSources: 45000000,
  totalUses: 45000000,
  layers: defaultLayers,
  isBalanced: true,
  imbalance: 0,
  uses: defaultUses,
  metrics: {
    ltv: 75,
    ltc: 80,
    dscr: 1.32,
    debtYield: 8.4,
    equityRequired: 9000000,
    totalDebt: 36000000,
    totalEquity: 9000000,
    weightedAvgCostOfCapital: 8.95,
    cocReturn: 9.8,
  },
};

// ============================================================================
// Debt Products (3+ per strategy)
// ============================================================================

export const debtProducts: DebtProduct[] = [
  // Agency
  {
    id: 'dp-agency-fannie',
    name: 'Fannie Mae DUS',
    productType: 'agency',
    lender: 'Fannie Mae',
    rateType: 'fixed',
    rateRange: { min: 5.25, max: 6.25 },
    ltvMax: 75,
    term: { min: 60, max: 120 },
    amortization: 30,
    recourse: 'non-recourse',
    prepaymentPenalty: 'Yield Maintenance (term)',
    dscrMin: 1.25,
    assumable: true,
    closingTimeline: 60,
    fees: { origination: 1.5, closing: 0.5, legal: 75000 },
    bestForStrategies: ['rental_stabilized', 'rental_value_add'],
    keyBenefit: 'Lowest rates, non-recourse, assumable — gold standard for stabilized multifamily',
    keyRisk: 'Yield maintenance makes early exit expensive',
  },
  {
    id: 'dp-agency-freddie',
    name: 'Freddie Mac Optigo',
    productType: 'agency',
    lender: 'Freddie Mac',
    rateType: 'fixed',
    rateRange: { min: 5.15, max: 6.15 },
    ltvMax: 80,
    term: { min: 60, max: 120 },
    amortization: 30,
    recourse: 'non-recourse',
    prepaymentPenalty: 'Defeasance',
    dscrMin: 1.25,
    assumable: true,
    closingTimeline: 60,
    fees: { origination: 1.25, closing: 0.5, legal: 70000 },
    bestForStrategies: ['rental_stabilized', 'rental_value_add'],
    keyBenefit: 'Slightly higher LTV, defeasance more flexible than yield maintenance',
    keyRisk: 'Defeasance cost varies with rate environment',
  },
  // CMBS
  {
    id: 'dp-cmbs',
    name: 'CMBS Conduit',
    productType: 'cmbs',
    lender: 'Goldman Sachs',
    rateType: 'fixed',
    rateRange: { min: 6.50, max: 7.50 },
    spreadOverIndex: 275,
    indexName: '10Y Treasury',
    ltvMax: 75,
    term: { min: 60, max: 120 },
    amortization: 30,
    recourse: 'non-recourse',
    prepaymentPenalty: 'Defeasance',
    dscrMin: 1.20,
    assumable: true,
    closingTimeline: 45,
    fees: { origination: 2.0, closing: 1.0, legal: 125000 },
    bestForStrategies: ['rental_stabilized'],
    keyBenefit: 'Non-recourse, higher proceeds than agency for some asset types',
    keyRisk: 'Lockbox requirements, inflexible loan documents, special servicer risk',
  },
  // Bridge
  {
    id: 'dp-bridge-arbor',
    name: 'Bridge Loan',
    productType: 'bridge',
    lender: 'Arbor Realty Trust',
    rateType: 'floating',
    rateRange: { min: 7.50, max: 10.50 },
    spreadOverIndex: 350,
    indexName: 'SOFR',
    ltvMax: 80,
    ltcMax: 85,
    term: { min: 24, max: 36 },
    amortization: 0,
    recourse: 'partial',
    prepaymentPenalty: 'Lockout 12mo, then open',
    dscrMin: 1.0,
    assumable: false,
    closingTimeline: 30,
    fees: { origination: 2.0, closing: 0.75, legal: 50000 },
    bestForStrategies: ['rental_value_add', 'build_to_sell'],
    keyBenefit: 'IO period maximizes cash flow during renovation, high leverage',
    keyRisk: 'Floating rate risk, maturity default if stabilization delayed',
  },
  {
    id: 'dp-bridge-mesa',
    name: 'Heavy Rehab Bridge',
    productType: 'bridge',
    lender: 'Mesa West Capital',
    rateType: 'floating',
    rateRange: { min: 8.50, max: 11.00 },
    spreadOverIndex: 450,
    indexName: 'SOFR',
    ltvMax: 75,
    ltcMax: 90,
    term: { min: 18, max: 36 },
    amortization: 0,
    recourse: 'partial',
    prepaymentPenalty: 'None after 6mo',
    dscrMin: 0,
    assumable: false,
    closingTimeline: 21,
    fees: { origination: 2.5, closing: 1.0, legal: 40000 },
    bestForStrategies: ['rental_value_add', 'build_to_sell'],
    keyBenefit: 'Up to 90% LTC, renovation holdback structure, fast close',
    keyRisk: 'Higher cost of capital, recourse risk, tight renovation timeline',
  },
  // Hard Money
  {
    id: 'dp-hard-money',
    name: 'Fix & Flip Loan',
    productType: 'hard_money',
    lender: 'Lima One Capital',
    rateType: 'fixed',
    rateRange: { min: 10, max: 13 },
    ltvMax: 85,
    ltcMax: 90,
    term: { min: 6, max: 18 },
    amortization: 0,
    recourse: 'full',
    prepaymentPenalty: 'None',
    dscrMin: 0,
    assumable: false,
    closingTimeline: 10,
    fees: { origination: 2.5, closing: 1.0, legal: 5000 },
    bestForStrategies: ['flip'],
    keyBenefit: 'Fast close (7-10 days), no DSCR requirement, funds renovation',
    keyRisk: 'Full recourse, high rates, short term — must execute quickly',
  },
  {
    id: 'dp-hard-money-2',
    name: 'Bridge to Rent',
    productType: 'hard_money',
    lender: 'Kiavi',
    rateType: 'fixed',
    rateRange: { min: 9.5, max: 12 },
    ltvMax: 80,
    ltcMax: 85,
    term: { min: 12, max: 24 },
    amortization: 0,
    recourse: 'full',
    prepaymentPenalty: 'None',
    dscrMin: 0,
    assumable: false,
    closingTimeline: 14,
    fees: { origination: 2.0, closing: 0.5, legal: 3000 },
    bestForStrategies: ['flip', 'str'],
    keyBenefit: 'Can convert to DSCR loan after stabilization, flexible exit',
    keyRisk: 'Full recourse, conversion not guaranteed',
  },
  // Construction
  {
    id: 'dp-construction',
    name: 'Construction Loan',
    productType: 'construction',
    lender: 'Pacific Western Bank',
    rateType: 'floating',
    rateRange: { min: 7.75, max: 9.50 },
    spreadOverIndex: 350,
    indexName: 'SOFR',
    ltvMax: 65,
    ltcMax: 75,
    term: { min: 24, max: 36 },
    amortization: 0,
    recourse: 'partial',
    prepaymentPenalty: 'None',
    dscrMin: 0,
    assumable: false,
    closingTimeline: 60,
    fees: { origination: 1.5, closing: 1.0, legal: 100000 },
    bestForStrategies: ['build_to_sell'],
    keyBenefit: 'Draw-based funding, interest reserve included, takeout flexibility',
    keyRisk: 'Cost overrun risk, completion guarantee, personal guarantee on recourse',
  },
  // DSCR
  {
    id: 'dp-dscr',
    name: 'DSCR Rental Loan',
    productType: 'dscr_loan',
    lender: 'New Western / Visio',
    rateType: 'fixed',
    rateRange: { min: 7.0, max: 9.0 },
    ltvMax: 75,
    term: { min: 60, max: 84 },
    amortization: 30,
    recourse: 'partial',
    prepaymentPenalty: 'Step-down (5-4-3-2-1)',
    dscrMin: 1.0,
    assumable: false,
    closingTimeline: 21,
    fees: { origination: 1.5, closing: 0.5, legal: 5000 },
    bestForStrategies: ['str', 'rental_stabilized'],
    keyBenefit: 'No personal income verification, based on property income only',
    keyRisk: 'Higher rates than agency, prepayment penalty, some recourse',
  },
  // Life Company
  {
    id: 'dp-life-co',
    name: 'Life Company Permanent',
    productType: 'life_company',
    lender: 'MetLife Investment Management',
    rateType: 'fixed',
    rateRange: { min: 5.50, max: 6.50 },
    ltvMax: 65,
    term: { min: 84, max: 180 },
    amortization: 30,
    recourse: 'non-recourse',
    prepaymentPenalty: 'Yield Maintenance',
    dscrMin: 1.30,
    assumable: true,
    closingTimeline: 90,
    fees: { origination: 1.25, closing: 0.5, legal: 60000 },
    bestForStrategies: ['rental_stabilized'],
    keyBenefit: 'Lowest rates, longest terms (up to 15yr), non-recourse',
    keyRisk: 'Low leverage (65% max), slow close, conservative underwriting',
  },
  // Mezzanine
  {
    id: 'dp-mezz',
    name: 'Mezzanine Loan',
    productType: 'mezz',
    lender: 'Advantage Capital',
    rateType: 'fixed',
    rateRange: { min: 12, max: 16 },
    ltvMax: 85,
    term: { min: 24, max: 60 },
    amortization: 0,
    recourse: 'non-recourse',
    prepaymentPenalty: 'Lockout 12mo, then 1%',
    dscrMin: 1.0,
    assumable: false,
    closingTimeline: 30,
    fees: { origination: 2.0, closing: 0.5, legal: 35000 },
    bestForStrategies: ['build_to_sell', 'rental_value_add'],
    keyBenefit: 'Fills gap between senior debt and equity, reduces equity check',
    keyRisk: 'Expensive, intercreditor complexity, acceleration risk',
  },
];

// ============================================================================
// Rate Environment
// ============================================================================

export const currentRates: RateEnvironmentData = {
  fedFunds: 4.50,
  treasury10Y: 4.28,
  treasury2Y: 4.15,
  sofr: 4.33,
  prime: 7.50,
  cmbsSpread: 275,
  agencySpread: 185,
  bridgeSpread: 400,
  lastUpdated: '2026-02-25',
  cyclePhase: 'easing',
  fedDirection: 'cutting',
  nextFedMeeting: '2026-03-18',
  marketSentiment: 'Cautiously optimistic — cuts expected but pace uncertain',
  cutProbability6mo: 72,
};

export const rateForecast: RateForecast[] = [
  { months: 3, treasury10Y: 4.15, sofr: 4.10, confidence: 75 },
  { months: 6, treasury10Y: 3.95, sofr: 3.85, confidence: 60 },
  { months: 12, treasury10Y: 3.75, sofr: 3.50, confidence: 45 },
  { months: 24, treasury10Y: 3.65, sofr: 3.25, confidence: 30 },
];

export const lockVsFloatAnalysis: LockVsFloatAnalysis = {
  lockNow: {
    rate: 6.35,
    totalCost: 4826000,
    npv: 4315000,
  },
  floatAndWait: {
    expectedRate: 5.90,
    bestCase: 5.50,
    worstCase: 6.80,
    totalCost: 4512000,
    npv: 4042000,
  },
  recommendation: 'float',
  rationale: 'Fed in easing cycle with 72% probability of further cuts within 6 months. Expected savings of ~$273K NPV by floating 3-6 months. Risk: if cuts don\'t materialize, worst case adds $185K vs locking today.',
  breakEvenMonths: 4,
};

export const spreadAnalysis: SpreadAnalysis[] = [
  { productType: 'Agency', currentSpread: 185, fiveYearAvg: 165, position: 'wide', percentile: 72 },
  { productType: 'CMBS', currentSpread: 275, fiveYearAvg: 225, position: 'wide', percentile: 80 },
  { productType: 'Bridge', currentSpread: 400, fiveYearAvg: 325, position: 'wide', percentile: 85 },
  { productType: 'Life Co', currentSpread: 155, fiveYearAvg: 145, position: 'average', percentile: 55 },
];

// ============================================================================
// Equity Waterfall
// ============================================================================

export const defaultWaterfall: EquityWaterfall = {
  dealId: 'deal-001',
  lpCapital: 7200000,
  gpCapital: 1800000,
  totalEquity: 9000000,
  lpPercentage: 80,
  gpPercentage: 20,
  preferredReturn: 8.0,
  tiers: [
    {
      id: 'tier-1',
      name: 'Return of Capital + Preferred',
      hurdleRate: 0.08,
      lpSplit: 1.0,
      gpSplit: 0.0,
      description: 'LP receives 100% of distributions until 8% pref + return of capital',
    },
    {
      id: 'tier-2',
      name: 'GP Catch-Up',
      hurdleRate: 0.12,
      lpSplit: 0.0,
      gpSplit: 1.0,
      description: '100% to GP until GP has received 30% of total profits above pref',
    },
    {
      id: 'tier-3',
      name: 'Tier 1 Promote (8-15% IRR)',
      hurdleRate: 0.15,
      lpSplit: 0.70,
      gpSplit: 0.30,
      description: '70/30 split (LP/GP) on distributions between 8% and 15% IRR',
    },
    {
      id: 'tier-4',
      name: 'Tier 2 Promote (15%+ IRR)',
      hurdleRate: 1.0,
      lpSplit: 0.60,
      gpSplit: 0.40,
      description: '60/40 split (LP/GP) on all distributions above 15% IRR',
    },
  ],
  catchUpProvision: true,
  catchUpPercentage: 100,
  clawbackProvision: true,
};

export const waterfallResult: WaterfallResult = {
  distributions: [
    {
      tierId: 'tier-1',
      tierName: 'Return of Capital + Preferred',
      lpDistribution: 9360000,
      gpDistribution: 0,
      totalDistribution: 9360000,
      cumulativeLPReturn: 9360000,
      cumulativeGPReturn: 0,
      irr: 8.0,
    },
    {
      tierId: 'tier-2',
      tierName: 'GP Catch-Up',
      lpDistribution: 0,
      gpDistribution: 1215000,
      totalDistribution: 1215000,
      cumulativeLPReturn: 9360000,
      cumulativeGPReturn: 1215000,
      irr: 12.0,
    },
    {
      tierId: 'tier-3',
      tierName: 'Tier 1 Promote (8-15% IRR)',
      lpDistribution: 1890000,
      gpDistribution: 810000,
      totalDistribution: 2700000,
      cumulativeLPReturn: 11250000,
      cumulativeGPReturn: 2025000,
      irr: 15.0,
    },
    {
      tierId: 'tier-4',
      tierName: 'Tier 2 Promote (15%+ IRR)',
      lpDistribution: 1080000,
      gpDistribution: 720000,
      totalDistribution: 1800000,
      cumulativeLPReturn: 12330000,
      cumulativeGPReturn: 2745000,
      irr: 16.8,
    },
  ],
  lpTotalReturn: 12330000,
  gpTotalReturn: 2745000,
  lpIRR: 14.2,
  gpIRR: 28.5,
  lpEquityMultiple: 1.71,
  gpEquityMultiple: 1.53,
  gpEffectiveShare: 0.34,
  totalDistributed: 15075000,
  exitProceeds: 52500000,
};

// ============================================================================
// Scenario Comparison
// ============================================================================

export const scenarioA: CapitalScenario = {
  id: 'scenario-conservative',
  name: 'Conservative (Agency Perm)',
  description: 'Lower leverage agency financing — safer, lower returns',
  stack: {
    ...defaultCapitalStack,
    layers: [
      { id: 's-a-senior', name: 'Agency Permanent', layerType: 'senior', amount: 31500000, percentage: 70, rate: 5.85, term: 120, source: 'Fannie Mae DUS', color: 'bg-blue-500' },
      { id: 's-a-lp', name: 'LP Equity', layerType: 'lpEquity', amount: 10800000, percentage: 24, rate: 8.0, term: 120, source: 'Institutional LP', color: 'bg-green-500' },
      { id: 's-a-gp', name: 'GP Co-Invest', layerType: 'gpEquity', amount: 2700000, percentage: 6, rate: 0, term: 120, source: 'Sponsor', color: 'bg-purple-500' },
    ],
    metrics: { ...defaultCapitalStack.metrics, ltv: 70, dscr: 1.52, cocReturn: 7.8, weightedAvgCostOfCapital: 6.2, equityRequired: 13500000, totalDebt: 31500000, totalEquity: 13500000, ltc: 70, debtYield: 10.5 },
  },
  waterfall: defaultWaterfall,
  returns: { irr: 12.5, equityMultiple: 1.62, cocReturn: 7.8, dscr: 1.52 },
  risks: { refinanceRisk: 'low', interestRateRisk: 'low', recourseExposure: 0, covenantHeadroom: 27 },
  isActive: false,
};

export const scenarioB: CapitalScenario = {
  id: 'scenario-aggressive',
  name: 'Aggressive (Bridge + Mezz)',
  description: 'Higher leverage with mezzanine — higher returns, more risk',
  stack: {
    ...defaultCapitalStack,
    layers: defaultLayers,
    metrics: { ...defaultCapitalStack.metrics, ltv: 80, dscr: 1.18, cocReturn: 14.2, weightedAvgCostOfCapital: 9.8, equityRequired: 9000000, totalDebt: 36000000, totalEquity: 9000000, ltc: 80, debtYield: 7.9 },
  },
  waterfall: defaultWaterfall,
  returns: { irr: 16.8, equityMultiple: 1.84, cocReturn: 14.2, dscr: 1.18 },
  risks: { refinanceRisk: 'high', interestRateRisk: 'high', recourseExposure: 2250000, covenantHeadroom: -7 },
  isActive: true,
};

export const scenarioC: CapitalScenario = {
  id: 'scenario-balanced',
  name: 'Balanced (Bridge, No Mezz)',
  description: 'Bridge financing without mezzanine — moderate risk/return',
  stack: {
    ...defaultCapitalStack,
    layers: [
      { id: 's-c-senior', name: 'Bridge Loan', layerType: 'senior', amount: 33750000, percentage: 75, rate: 8.75, term: 36, source: 'Arbor Realty Trust', color: 'bg-blue-500' },
      { id: 's-c-lp', name: 'LP Equity', layerType: 'lpEquity', amount: 9000000, percentage: 20, rate: 8.0, term: 60, source: 'Institutional LP', color: 'bg-green-500' },
      { id: 's-c-gp', name: 'GP Co-Invest', layerType: 'gpEquity', amount: 2250000, percentage: 5, rate: 0, term: 60, source: 'Sponsor', color: 'bg-purple-500' },
    ],
    metrics: { ...defaultCapitalStack.metrics, ltv: 75, dscr: 1.32, cocReturn: 11.5, weightedAvgCostOfCapital: 8.4, equityRequired: 11250000, totalDebt: 33750000, totalEquity: 11250000, ltc: 75, debtYield: 8.9 },
  },
  waterfall: defaultWaterfall,
  returns: { irr: 14.8, equityMultiple: 1.72, cocReturn: 11.5, dscr: 1.32 },
  risks: { refinanceRisk: 'medium', interestRateRisk: 'medium', recourseExposure: 0, covenantHeadroom: 7 },
  isActive: false,
};

export const scenarioComparison: ScenarioComparison = {
  scenarios: [scenarioA, scenarioB, scenarioC],
  bestIRR: 'scenario-aggressive',
  bestCoC: 'scenario-aggressive',
  lowestRisk: 'scenario-conservative',
  recommendation: 'Balanced structure (Scenario C) offers best risk-adjusted return. 14.8% IRR with manageable refinance risk and no mezzanine complexity.',
  delta: {
    irr: 4.3,
    equityMultiple: 0.22,
    dscr: 0.34,
  },
};

// ============================================================================
// Debt Lifecycle Timeline
// ============================================================================

export const debtTimeline: DebtTimeline = {
  events: [
    { id: 'tl-1', date: '2026-03-15', type: 'origination', title: 'Bridge Loan Close', description: '$33.75M bridge from Arbor Realty at SOFR+350', amount: 33750000, isPast: false, isKeyEvent: true },
    { id: 'tl-2', date: '2026-04-01', type: 'draw', title: 'Initial Draw — Acquisition', description: 'Fund acquisition + closing costs', amount: 39270000, isPast: false, isKeyEvent: false },
    { id: 'tl-3', date: '2026-06-01', type: 'draw', title: 'Renovation Draw #1', description: 'Phase 1 renovation (units 1-50)', amount: 1400000, isPast: false, isKeyEvent: false },
    { id: 'tl-4', date: '2026-09-01', type: 'draw', title: 'Renovation Draw #2', description: 'Phase 2 renovation (units 51-100)', amount: 1400000, isPast: false, isKeyEvent: false },
    { id: 'tl-5', date: '2026-12-01', type: 'draw', title: 'Renovation Draw #3', description: 'Phase 3 renovation (units 101-150)', amount: 1400000, isPast: false, isKeyEvent: false },
    { id: 'tl-6', date: '2027-06-01', type: 'milestone', title: 'Stabilization Target', description: 'Target 93% occupancy for refinance', isPast: false, isKeyEvent: true },
    { id: 'tl-7', date: '2027-03-15', type: 'extension', title: 'Extension Option #1', description: '12-month extension at +25bps (fee: 0.25%)', amount: 84375, isPast: false, isKeyEvent: false },
    { id: 'tl-8', date: '2027-09-01', type: 'refinance', title: 'Agency Refi Target', description: 'Refinance to Fannie Mae permanent at ~5.5-6.0%', amount: 33750000, isPast: false, isKeyEvent: true },
    { id: 'tl-9', date: '2028-03-15', type: 'maturity', title: 'Bridge Maturity (w/ ext)', description: 'Final maturity — must refi or sell by this date', isPast: false, isKeyEvent: true },
  ],
  totalDrawn: 0,
  totalRepaid: 0,
  interestReserve: 850000,
  nextKeyEvent: null,
  constructionProgress: 0,
};

// ============================================================================
// Insights
// ============================================================================

export const stackInsights: MetricInsight[] = [
  {
    metric: 'DSCR',
    value: '1.32x',
    insight: '7bps above lender minimum of 1.25x — tight. A 50bps rate increase drops DSCR below covenant.',
    severity: 'warning',
    action: { label: 'Run Rate Sensitivity →', handler: 'rate-sensitivity' },
  },
  {
    metric: 'LTV',
    value: '80%',
    insight: 'At max LTV for bridge. No room for additional senior debt without equity increase.',
    severity: 'info',
  },
  {
    metric: 'Weighted Avg Cost',
    value: '8.95%',
    insight: 'Mezzanine at 14% is driving blended cost up. Removing mezz drops WACC to 8.4% but requires $2.25M more equity.',
    severity: 'warning',
    action: { label: 'Compare Without Mezz →', handler: 'remove-mezz-scenario' },
  },
  {
    metric: 'GP Effective Share',
    value: '34%',
    insight: 'At projected 16.8% IRR, GP earns 34% effective share on 20% equity — strong promote. LP still nets 14.2% IRR.',
    severity: 'success',
  },
];

export const strategyMismatchWarnings: StrategyMismatchWarning[] = [
  {
    strategy: 'flip',
    debtProduct: 'Agency Permanent (10yr fixed)',
    issue: 'Using a 10yr fixed loan for a 6-12mo flip. Yield maintenance penalty will eat 3-5% of profit on early payoff.',
    suggestion: 'Switch to hard money or bridge with no prepayment penalty.',
  },
  {
    strategy: 'rental_stabilized',
    debtProduct: 'Bridge Loan (SOFR+350)',
    issue: 'Floating rate bridge for a stabilized hold. Rate volatility creates cash flow uncertainty on a buy-and-hold.',
    suggestion: 'Refinance to agency permanent with fixed rate to lock in stable debt service.',
  },
  {
    strategy: 'str',
    debtProduct: 'Agency Permanent',
    issue: 'Agency loans often prohibit short-term rental use. May trigger a covenant violation.',
    suggestion: 'Use DSCR loan specifically structured for STR properties.',
  },
];

// ============================================================================
// Formula Utilities (F40-F66, frontend-side for Phase 1)
// ============================================================================

/** F40: Senior Debt Sizing — min(max_LTC × cost, DSCR constraint, LTV constraint) */
export function calcSeniorDebtSizing(
  totalCost: number,
  maxLTC: number,
  noi: number,
  dscrMin: number,
  propertyValue: number,
  maxLTV: number,
  interestRate: number,
  amortYears: number,
): number {
  const ltcConstraint = totalCost * maxLTC;
  const ltvConstraint = propertyValue * maxLTV;
  const monthlyRate = interestRate / 100 / 12;
  const n = amortYears * 12;
  const maxPayment = noi / 12 / dscrMin;
  const dscrConstraint = amortYears > 0
    ? maxPayment * (Math.pow(1 + monthlyRate, n) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, n))
    : noi / (interestRate / 100) / dscrMin;
  return Math.min(ltcConstraint, ltvConstraint, dscrConstraint);
}

/** F46: Sources = Uses validation */
export function calcSourcesEqualsUses(sources: number, uses: number): { balanced: boolean; imbalance: number } {
  const imbalance = sources - uses;
  return { balanced: Math.abs(imbalance) < 1, imbalance };
}

/** F47: Cycle Phase classification */
export function classifyCyclePhase(fedDirection: string, durationMonths: number, yieldCurveSlope: number): string {
  if (fedDirection === 'hiking') return durationMonths > 12 ? 'peak' : 'tightening';
  if (fedDirection === 'cutting') return durationMonths > 12 ? 'trough' : 'easing';
  return yieldCurveSlope < 0 ? 'peak' : 'trough';
}

/** F51: Rate Sensitivity — impact of rate change on annual debt service */
export function calcRateSensitivity(loanAmount: number, rateChangeBps: number, holdYears: number): number {
  return loanAmount * (rateChangeBps / 10000) * holdYears;
}

/** F52: LP Capital */
export function calcLPCapital(totalEquity: number, lpPct: number): number {
  return totalEquity * (lpPct / 100);
}

/** F53: GP Co-Invest */
export function calcGPCapital(totalEquity: number, gpPct: number): number {
  return totalEquity * (gpPct / 100);
}

/** F54: Preferred Return */
export function calcPreferredReturn(lpCapital: number, prefRate: number, years: number): number {
  return lpCapital * (prefRate / 100) * years;
}

/** F58: GP Effective Percentage */
export function calcGPEffectiveShare(gpDistributions: number, totalDistributions: number): number {
  if (totalDistributions === 0) return 0;
  return gpDistributions / totalDistributions;
}

/** F61: Scenario Delta */
export function calcScenarioDelta(scenarioA_irr: number, scenarioB_irr: number): number {
  return scenarioA_irr - scenarioB_irr;
}

/** F65: Refi Proceeds */
export function calcRefiProceeds(stabilizedValue: number, refiLTV: number, existingDebt: number): number {
  return stabilizedValue * refiLTV - existingDebt;
}
