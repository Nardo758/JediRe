/**
 * Enhanced Strategy Arbitrage Mock Data (M08)
 *
 * 4-strategy comparison matrix with signal-level detail,
 * ROI head-to-head, signal heatmap, and arbitrage alerts.
 * Follows Data → Insight → Action pattern.
 */

// ============================================================================
// Strategy Scores (F23 per strategy)
// ============================================================================

export interface StrategyScore {
  id: string;
  label: string;
  score: number;
  rank: number;
  color: string;
  bgColor: string;
  borderColor: string;
  roiLabel: string;
  roiValue: string;
  holdPeriod: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export const strategyScores: StrategyScore[] = [
  {
    id: 'bts',
    label: 'Build-to-Sell',
    score: 84,
    rank: 1,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-400',
    roiLabel: 'Yield on Cost',
    roiValue: '7.2%',
    holdPeriod: '18-24 mo',
    riskLevel: 'medium',
  },
  {
    id: 'rental',
    label: 'Rental',
    score: 69,
    rank: 2,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-400',
    roiLabel: 'Cash-on-Cash',
    roiValue: '8.5%',
    holdPeriod: '5-7 yr',
    riskLevel: 'low',
  },
  {
    id: 'flip',
    label: 'Flip',
    score: 58,
    rank: 3,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-400',
    roiLabel: 'Profit Margin',
    roiValue: '18%',
    holdPeriod: '6-12 mo',
    riskLevel: 'high',
  },
  {
    id: 'str',
    label: 'STR (Airbnb)',
    score: 45,
    rank: 4,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-400',
    roiLabel: 'RevPAR Premium',
    roiValue: '1.4x',
    holdPeriod: '3-5 yr',
    riskLevel: 'high',
  },
];

// ============================================================================
// Signal Heatmap (5 signals × 4 strategies)
// ============================================================================

export interface HeatmapCell {
  signal: string;
  strategy: string;
  weightedScore: number;
  rawScore: number;
  weight: number;
  intensity: 'strong' | 'moderate' | 'weak' | 'negative';
  tooltip: string;
}

export const signalNames = ['Demand', 'Supply', 'Momentum', 'Position', 'Risk'];
export const strategyNames = ['BTS', 'Rental', 'Flip', 'STR'];

// Signal weights per strategy (from Strategy Matrix Sheet 6)
const weights: Record<string, Record<string, number>> = {
  BTS:    { Demand: 0.30, Supply: 0.25, Momentum: 0.20, Position: 0.15, Risk: 0.10 },
  Rental: { Demand: 0.30, Supply: 0.25, Momentum: 0.20, Position: 0.15, Risk: 0.10 },
  Flip:   { Demand: 0.15, Supply: 0.20, Momentum: 0.30, Position: 0.20, Risk: 0.15 },
  STR:    { Demand: 0.25, Supply: 0.20, Momentum: 0.25, Position: 0.20, Risk: 0.10 },
};

const rawScores: Record<string, number> = {
  Demand: 88,
  Supply: 72,
  Momentum: 85,
  Position: 79,
  Risk: 81,
};

function getIntensity(weighted: number): 'strong' | 'moderate' | 'weak' | 'negative' {
  if (weighted >= 20) return 'strong';
  if (weighted >= 14) return 'moderate';
  if (weighted >= 8) return 'weak';
  return 'negative';
}

export const heatmapData: HeatmapCell[] = signalNames.flatMap(signal =>
  strategyNames.map(strategy => {
    const weight = weights[strategy][signal];
    const raw = rawScores[signal];
    const weighted = parseFloat((raw * weight).toFixed(1));
    return {
      signal,
      strategy,
      weightedScore: weighted,
      rawScore: raw,
      weight,
      intensity: getIntensity(weighted),
      tooltip: `${signal} × ${strategy}: ${raw} × ${(weight * 100).toFixed(0)}% = ${weighted}`,
    };
  })
);

// ============================================================================
// ROI Head-to-Head
// ============================================================================

export interface ROIMetric {
  label: string;
  bts: string;
  rental: string;
  flip: string;
  str: string;
  bestStrategy: string;
}

export const roiHeadToHead: ROIMetric[] = [
  { label: 'Primary ROI', bts: '7.2% YoC', rental: '8.5% CoC', flip: '18% margin', str: '1.4x RevPAR', bestStrategy: 'flip' },
  { label: 'IRR', bts: '22%', rental: '16.8%', flip: '35%', str: '14%', bestStrategy: 'flip' },
  { label: 'Equity Multiple', bts: '1.6x', rental: '2.1x', flip: '1.3x', str: '1.8x', bestStrategy: 'rental' },
  { label: 'Capital Recycled', bts: '24 mo', rental: '84 mo', flip: '9 mo', str: '48 mo', bestStrategy: 'flip' },
  { label: 'Risk-Adj Return', bts: '18%', rental: '14.2%', flip: '12%', str: '8%', bestStrategy: 'bts' },
];

// ============================================================================
// Arbitrage Alert
// ============================================================================

export interface ArbitrageAlert {
  show: boolean;
  recommended: string;
  recommendedLabel: string;
  defaultAssumption: string;
  defaultLabel: string;
  delta: number;
  missedROI: string;
  keyUnlock: string;
  insight: string;
}

export const arbitrageAlert: ArbitrageAlert = {
  show: true,
  recommended: 'bts',
  recommendedLabel: 'Build-to-Sell',
  defaultAssumption: 'rental',
  defaultLabel: 'Rental Value-Add',
  delta: 15,
  missedROI: '~210bps yield difference',
  keyUnlock: 'Zoning allows 3x current density — most investors won\'t see the development play.',
  insight: 'If you default to the typical rental value-add play, you\'re leaving ~210bps of yield on the table. The zoning unlock is the key.',
};
