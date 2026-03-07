/**
 * M28 Cycle Intelligence - Frontend Types
 */

export type CyclePhase = 'recession' | 'recovery' | 'expansion' | 'hypersupply';
export type PolicyStance = 'easing' | 'neutral' | 'tightening' | 'emergency';
export type SignalType = 'positive' | 'negative' | 'neutral';
export type DivergenceSignal = 'ACQUIRE' | 'HOLD' | 'EXIT';

export interface CycleSnapshot {
  market_id: string;
  snapshot_date: string;
  lag_phase: CyclePhase;
  lag_position: number;
  lead_phase: CyclePhase;
  lead_position: number;
  divergence: number;
  confidence: number;
}

export interface RateEnvironment {
  snapshot_date: string;
  ffr: string;
  sofr: string;
  policy_stance: PolicyStance;
  t10y: string;
  t30y_mtg: string;
  cap_spread_10y: string | null;
  m2_yoy: string;
  m2_level: string;
  fed_balance_sheet: string;
  dxy: string;
  forward_2y: string | null;
  forward_direction: string;
}

export interface LeadingIndicator {
  id: number;
  snapshot_date: string;
  category: string;
  indicator_name: string;
  value: string;
  signal: SignalType;
  trend: string;
  lag_to_re: string;
  source: string;
  source_url: string;
}

export interface DivergenceResult {
  market_id: string;
  divergence: number;
  signal: DivergenceSignal;
  lag_phase: CyclePhase;
  lag_position: number;
  lead_phase: CyclePhase;
  lead_position: number;
  confidence: number;
}

export interface ValueForecast {
  market_id: string;
  baseline_change_pct: number;
  bull_change_pct: number;
  bear_change_pct: number;
  confidence: number;
  drivers: string[];
}

export interface PhaseStrategy {
  market_id: string;
  phase: CyclePhase;
  optimal_strategy: string;
  expected_irr: number;
  expected_em: number;
  rationale: string;
}

export interface PatternMatch {
  id: number;
  snapshot_date: string;
  event_id: string;
  event_name: string;
  similarity_score: number;
  matching_indicators: string[];
  event_category: string;
}

export interface MacroRiskScore {
  score: number;
  category: 'low' | 'moderate' | 'elevated' | 'high';
  drivers: string[];
  rate_shock_risk: number;
  recession_risk: number;
  policy_uncertainty: number;
}
