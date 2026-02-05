// Analysis API types for JEDI RE market analysis

export type VerdictType = 'STRONG_OPPORTUNITY' | 'MODERATE_OPPORTUNITY' | 'NEUTRAL' | 'CAUTION' | 'AVOID';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type DemandStrength = 'STRONG' | 'MODERATE' | 'WEAK';
export type SupplyVerdict = 'CRITICALLY_UNDERSUPPLIED' | 'UNDERSUPPLIED' | 'BALANCED' | 'OVERSUPPLIED' | 'CRITICALLY_OVERSUPPLIED';

export interface AnalysisInput {
  // Submarket data
  name: string;
  population: number;
  population_growth_rate?: number;
  net_migration_annual?: number;
  employment?: number;
  employment_growth_rate?: number;
  median_income?: number;
  existing_units: number;
  pipeline_units?: number;
  future_permitted_units?: number;
  
  // Demand signal data
  rent_timeseries: number[];
  search_trend_change?: number;
}

export interface DemandSignal {
  strength: DemandStrength;
  score: number;
  confidence: number;
  rent_growth_rate: number;
  rent_growth_confidence: number;
  search_trend_change?: number;
  migration_annual?: number;
  summary: string;
}

export interface SupplySignal {
  demand_units: number;
  demand_growth_annual: number;
  total_supply: number;
  existing_units: number;
  pipeline_units: number;
  saturation_pct: number;
  equilibrium_quarters: number;
  verdict: SupplyVerdict;
  confidence: number;
  summary: string;
}

export interface KeyFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface AnalysisResult {
  submarket: string;
  verdict: VerdictType;
  composite_score: number;
  confidence: number;
  demand_signal: DemandSignal;
  supply_signal: SupplySignal;
  recommendation: string;
  key_factors: string[];
  risks: string[];
}

export interface AnalysisResponse {
  success: boolean;
  result?: AnalysisResult;
  error?: string;
}

// Available Atlanta neighborhoods
export const ATLANTA_NEIGHBORHOODS = [
  'Atkins Park',
  'Candler Park',
  'Druid Hills',
  'East Atlanta',
  'East Lake',
  'Edgewood',
  'Edmund Park',
  'Emory',
  'Kirkwood',
  'Lake Claire',
  'Morningside/Lenox Park',
  'The Villages at East Lake',
  'Virginia Highland'
] as const;

export type AtlantaNeighborhood = typeof ATLANTA_NEIGHBORHOODS[number];
