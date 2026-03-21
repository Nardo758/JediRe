/**
 * M28 Cycle Intelligence - Type Definitions
 * All data structures for market cycle tracking and predictions
 */

// ═══════════════════════════════════════════════════════════════
// Core Enums
// ═══════════════════════════════════════════════════════════════

export type CyclePhase = 'recovery' | 'expansion' | 'hypersupply' | 'recession';
export type PolicyStance = 'easing' | 'tightening' | 'neutral' | 'emergency';
export type SignalType = 'positive' | 'negative' | 'neutral' | 'mixed';
export type TrendDirection = 'rising' | 'falling' | 'stable' | 'volatile';

// ═══════════════════════════════════════════════════════════════
// M28 Outputs (what M28 produces for other modules)
// ═══════════════════════════════════════════════════════════════

export interface CycleSnapshot {
  market_id: string;
  snapshot_date: string;
  lag_phase: CyclePhase;
  lag_position: number;  // 0-1
  lead_phase: CyclePhase;
  lead_position: number; // 0-1
  divergence: number;    // -25 to +25
  confidence: number;    // 0-1
  classified_by?: Record<string, any>;
}

export interface RateEnvironment {
  snapshot_date: string;
  ffr: number;
  sofr: number;
  t10y: number;
  t30y_mtg: number;
  cap_spread_10y: number;
  m2_yoy: number;
  m2_level: number;
  fed_balance_sheet: number;
  dxy: number;
  forward_2y: number;
  forward_direction: 'rising' | 'falling' | 'flat';
  policy_stance: PolicyStance;
}

export interface LeadingIndicator {
  snapshot_date: string;
  category: 'supply' | 'demand' | 'macro' | 'sentiment';
  indicator_name: string;
  value: string;
  signal: SignalType;
  trend: TrendDirection;
  lag_to_re: string;
  source: string;
  source_url?: string;
}

export interface HistoricalEvent {
  id: string;
  name: string;
  category: 'recession' | 'rate_shock' | 'policy' | 'external';
  origin: 'domestic' | 'global';
  date_start: string;
  date_end?: string;
  severity: number; // 1-10
  tags: string[];
  trigger_desc: string;
  economic_effects?: Record<string, any>;
  fed_reaction?: Record<string, any>;
  re_impact?: Record<string, any>;
  fl_specific?: string;
}

export interface PatternMatch {
  computed_date: string;
  event_id: string;
  event: HistoricalEvent;
  similarity_pct: number; // 0-100
  match_factors: string[];
  diverge_factors: string[];
  predicted_re_impact: Record<string, any>;
  confidence: number; // 0-1
}

export interface MarketMetricsHistory {
  market_id: string;
  quarter: string; // '2024Q1'
  rent_growth?: number;
  vacancy?: number;
  cap_rate?: number;
  ppu?: number;
  txn_velocity?: number;
  dom?: number;
  absorption?: number;
  deliveries?: number;
  concessions?: number;
  classified_phase?: CyclePhase;
}

export interface DealPerformanceByPhase {
  market_id: string;
  phase: CyclePhase;
  avg_irr?: number;
  avg_em?: number;
  avg_hold?: number;
  deal_count: number;
  best_strategy?: string;
  worst_strategy?: string;
  strategy_performance?: Record<string, {
    irr: number;
    em: number;
    count: number;
  }>;
  data_range: string; // '2015-2023'
}

// ═══════════════════════════════════════════════════════════════
// Composite Outputs (derived from multiple tables)
// ═══════════════════════════════════════════════════════════════

export interface DivergenceResult {
  market_id: string;
  current_date: string;
  divergence: number;
  signal: 'ACQUIRE' | 'HOLD' | 'EXIT';
  lag_phase: CyclePhase;
  lead_phase: CyclePhase;
  confidence: number;
  narrative: string; // Human-readable explanation
}

export interface ConstructionCostIndex {
  market_id: string;
  base_index: number;
  tariff_premium_pct: number;
  yoy_change: number;
  forecast_12mo: number;
  updated_at: string;
}

export interface ValueForecast {
  market_id: string;
  horizon_months: number;
  bull_12mo: number;    // +15%
  base_12mo: number;    // +8%
  bear_12mo: number;    // +2%
  confidence: number;
  method: string;       // 'M2-derived' | 'cap-rate-model' | 'ensemble'
  as_of_date: string;
}

export interface PhaseOptimalStrategy {
  market_id: string;
  current_phase: CyclePhase;
  best_strategy: string;          // 'Value-Add' | 'Core-Plus' | 'Opportunistic'
  expected_irr: number;
  expected_em: number;
  expected_hold: number;
  confidence: number;
  historical_sample_size: number;
  alternatives: Array<{
    strategy: string;
    irr: number;
    em: number;
    rank: number;
  }>;
}

export interface MacroRiskScore {
  score: number; // 0-100
  components: {
    geopolitical_risk: number;
    trade_policy_uncertainty: number;
    consumer_confidence: number;
    banking_stress: number;
  };
  level: 'low' | 'medium' | 'high' | 'extreme';
  narrative: string;
  as_of_date: string;
}

// ═══════════════════════════════════════════════════════════════
// Transmission Chain Types
// ═══════════════════════════════════════════════════════════════

export interface TransmissionChain {
  id: string;
  name: string;
  category: 'rates' | 'demand' | 'activity' | 'values' | 'supply' | 'cost';
  input: {
    metric: string;
    unit: string;
  };
  output: {
    metric: string;
    unit: string;
  };
  coefficient: {
    ratio: string;
    passThrough: number;
    lag: string;
    confidence: number;
    note: string;
  };
  historicalProof: Array<{
    period: string;
    ffrChange?: number;
    mtgChange?: number;
    ratio: number;
    lag: string;
    note: string;
  }>;
}

export interface PredictionInput {
  market_id: string;
  horizon_months: number;
  scenario?: 'bull' | 'base' | 'bear';
}

export interface RentGrowthForecast {
  market_id: string;
  horizon_months: number;
  baseline: number;
  bull: number;
  bear: number;
  confidence: number;
  contributing_factors: Array<{
    factor: string;
    impact: number;
    weight: number;
  }>;
  as_of_date: string;
}

export interface CapRateForecast {
  market_id: string;
  horizon_months: number;
  current_cap: number;
  predicted_cap: number;
  change_bps: number;
  direction: 'compression' | 'expansion' | 'stable';
  confidence: number;
  drivers: string[];
  as_of_date: string;
}

export interface FullChainPrediction {
  market_id: string;
  scenario: {
    name: string;
    ffr_change_bps: number;
    timeline: string;
  };
  predictions: {
    mortgage_change_bps: number;
    purchasing_power_change_pct: number;
    txn_volume_change_pct: number;
    cap_change_bps: number;
    value_change_pct: number;
  };
  confidence: number;
  as_of_date: string;
}

// ═══════════════════════════════════════════════════════════════
// Widget Data Types (for frontend components)
// ═══════════════════════════════════════════════════════════════

export interface CyclePhaseBadgeData {
  market: string;
  phase: CyclePhase;
  position: number; // 0-1
  color: string;
}

export interface DivergenceChipData {
  value: number;
  market: string;
  signal: 'ACQUIRE' | 'HOLD' | 'EXIT';
  color: string;
}

export interface ExitWindowData {
  divergence: number;
  months_until_convergence: number;
  window_status: 'OPEN' | 'CLOSING' | 'CLOSED';
  confidence: number;
}

// ═══════════════════════════════════════════════════════════════
// Service Layer Types
// ═══════════════════════════════════════════════════════════════

export interface M28ServiceConfig {
  fredApiKey?: string;
  censusApiKey?: string;
  defaultConfidence: number;
  cacheTTL: number; // seconds
}

export interface CycleClassificationInput {
  market_id: string;
  metrics: {
    rent_growth?: number;
    vacancy?: number;
    cap_rate?: number;
    txn_velocity?: number;
    absorption?: number;
    deliveries?: number;
  };
  weights?: {
    rent_growth?: number;
    vacancy?: number;
    cap_rate?: number;
    // ...
  };
}

export interface CycleClassificationResult {
  phase: CyclePhase;
  position: number;
  confidence: number;
  breakdown: Record<string, {
    value: number;
    weight: number;
    signal: 'expansion' | 'contraction' | 'neutral';
  }>;
}
