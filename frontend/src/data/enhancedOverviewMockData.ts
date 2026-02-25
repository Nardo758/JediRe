/**
 * Enhanced Deal Overview Mock Data
 *
 * Intelligence-driven overview data following the Data → Insight → Action pattern.
 * Provides JEDI Score, 5-signal breakdown, strategy verdict, risk alerts,
 * and contextual quick stats for single-glance deal assessment.
 */

// ============================================================================
// JEDI Score
// ============================================================================

export interface JEDIScoreData {
  score: number;
  delta30d: number;
  verdict: string;
  verdictColor: string;
  confidence: number;
  confidenceLabel: string;
  dataCompleteness: number;
  lastUpdated: string;
}

export const jediScore: JEDIScoreData = {
  score: 82,
  delta30d: 4,
  verdict: 'OPPORTUNITY',
  verdictColor: 'text-amber-600',
  confidence: 87,
  confidenceLabel: 'High',
  dataCompleteness: 87,
  lastUpdated: '2 hours ago',
};

// ============================================================================
// 5-Signal Breakdown
// ============================================================================

export interface SignalScore {
  id: string;
  name: string;
  weight: number;
  score: number;
  weighted: number;
  trend: 'up' | 'down' | 'flat';
  trendDelta: number;
  color: string;
  bgColor: string;
  description: string;
  moduleLink: string;
}

export const signalScores: SignalScore[] = [
  {
    id: 'demand',
    name: 'Demand',
    weight: 30,
    score: 88,
    weighted: 26.4,
    trend: 'up',
    trendDelta: 5,
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    description: 'Amazon announced 2,000 jobs in trade area. Net absorption exceeds pipeline.',
    moduleLink: 'demand',
  },
  {
    id: 'supply',
    name: 'Supply',
    weight: 25,
    score: 72,
    weighted: 18.0,
    trend: 'down',
    trendDelta: -3,
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    description: '1,200 units in pipeline within 3mi. But demand absorbing at 1.3x rate.',
    moduleLink: 'supply',
  },
  {
    id: 'momentum',
    name: 'Momentum',
    weight: 20,
    score: 85,
    weighted: 17.0,
    trend: 'up',
    trendDelta: 2,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    description: 'Rent growth accelerating at +3.2% YoY. DOM declining — market tightening.',
    moduleLink: 'market',
  },
  {
    id: 'position',
    name: 'Position',
    weight: 15,
    score: 79,
    weighted: 11.85,
    trend: 'flat',
    trendDelta: 0,
    color: 'bg-violet-500',
    bgColor: 'bg-violet-50',
    description: '78th percentile submarket rank. Top quartile for amenity density.',
    moduleLink: 'market',
  },
  {
    id: 'risk',
    name: 'Risk',
    weight: 10,
    score: 81,
    weighted: 8.1,
    trend: 'up',
    trendDelta: 3,
    color: 'bg-stone-500',
    bgColor: 'bg-stone-50',
    description: 'Low demand risk (32). Supply risk elevated but offset by absorption.',
    moduleLink: 'risk',
  },
];

// ============================================================================
// Strategy Verdict
// ============================================================================

export interface StrategyVerdictData {
  recommended: string;
  recommendedLabel: string;
  score: number;
  secondBest: string;
  secondBestLabel: string;
  secondBestScore: number;
  arbitrageGap: number;
  isArbitrage: boolean;
  roiEstimate: string;
  roiLabel: string;
  insight: string;
}

export const strategyVerdict: StrategyVerdictData = {
  recommended: 'build_to_sell',
  recommendedLabel: 'Build-to-Sell',
  score: 84,
  secondBest: 'rental',
  secondBestLabel: 'Rental',
  secondBestScore: 69,
  arbitrageGap: 15,
  isArbitrage: true,
  roiEstimate: '7.2%',
  roiLabel: 'Yield on Cost',
  insight: 'Zoning allows 3x current density. Most brokers would pitch Rental — you\'d miss the development upside.',
};

// ============================================================================
// Top Risk Alert
// ============================================================================

export interface RiskAlertData {
  show: boolean;
  category: string;
  score: number;
  maxScore: number;
  detail: string;
  mitigationAvailable: boolean;
  mitigationText: string;
  severity: 'low' | 'medium' | 'high';
}

export const topRiskAlert: RiskAlertData = {
  show: true,
  category: 'Supply Risk',
  score: 68,
  maxScore: 100,
  detail: '1,200 units delivering 2026-2027 within 3mi radius',
  mitigationAvailable: true,
  mitigationText: 'Demand absorption rate exceeds pipeline at 1.3x. Net supply pressure: MANAGEABLE.',
  severity: 'medium',
};

// ============================================================================
// Quick Stats (Enhanced with Context)
// ============================================================================

export interface EnhancedQuickStat {
  label: string;
  value: string;
  context: string;
  contextColor: 'green' | 'amber' | 'red' | 'gray';
  moduleLink?: string;
}

export const enhancedQuickStats: EnhancedQuickStat[] = [
  {
    label: 'Price/Unit',
    value: '$160,714',
    context: '12% above submarket median',
    contextColor: 'amber',
    moduleLink: 'competition',
  },
  {
    label: 'Cap Rate (Going-In)',
    value: '6.0%',
    context: 'In line with market — no hidden discount',
    contextColor: 'gray',
    moduleLink: 'financial',
  },
  {
    label: 'DSCR',
    value: '1.32x',
    context: '7bps above 1.25x minimum',
    contextColor: 'amber',
    moduleLink: 'capital-structure',
  },
  {
    label: 'Days in Pipeline',
    value: '23 days',
    context: 'LOI stage — 37 days to close deadline',
    contextColor: 'green',
  },
];
