/**
 * Property Type Strategy Matrix Types
 * 
 * Type definitions for property type investment strategies.
 * Supports 4 core strategies: Build-to-Sell, Flip, Rental, Airbnb/STR
 */

/**
 * Investment strategy names
 */
export type StrategyName = 'Build-to-Sell' | 'Flip' | 'Rental' | 'Airbnb/STR';

/**
 * Strategy strength/viability ratings
 */
export type StrategyStrength = 'Strong' | 'Moderate' | 'Weak' | 'Rare' | 'N/A';

/**
 * Property categories
 */
export type PropertyCategory = 
  | 'Residential'
  | 'Multifamily'
  | 'Commercial'
  | 'Retail'
  | 'Industrial'
  | 'Hospitality'
  | 'Special Purpose'
  | 'Land'
  | 'Mixed-Use';

/**
 * Property Type Strategy entity
 */
export interface PropertyTypeStrategy {
  /** Strategy ID */
  id: number;
  
  /** Property type ID (foreign key) */
  type_id: number;
  
  /** Strategy name */
  strategy_name: StrategyName;
  
  /** Strategy viability for this property type */
  strength: StrategyStrength;
  
  /** Detailed notes about this strategy for this property type */
  notes: string | null;
  
  /** Minimum hold period in months */
  hold_period_min: number | null;
  
  /** Maximum hold period in months */
  hold_period_max: number | null;
  
  /** Array of key metrics for this strategy (JSON) */
  key_metrics: string[];
  
  /** Is this the primary/recommended strategy? */
  is_primary: boolean;
  
  /** Sort order */
  sort_order: number;
  
  /** Created timestamp */
  created_at: Date;
  
  /** Updated timestamp */
  updated_at: Date;
}

/**
 * Property type with strategies
 */
export interface PropertyTypeWithStrategies {
  /** Property type ID */
  id: number;
  
  /** Type key (e.g., 'single_family') */
  type_key: string;
  
  /** Display name */
  display_name: string;
  
  /** Category */
  category: PropertyCategory;
  
  /** Description */
  description: string | null;
  
  /** Icon name */
  icon: string | null;
  
  /** Sort order */
  sort_order: number;
  
  /** Associated strategies */
  strategies: PropertyTypeStrategy[];
}

/**
 * Strategy comparison data for a property
 */
export interface StrategyComparison {
  /** Strategy name */
  strategy_name: StrategyName;
  
  /** Strength rating */
  strength: StrategyStrength;
  
  /** Detailed notes */
  notes: string | null;
  
  /** Hold period display (e.g., "3-5 years") */
  hold_period: string | null;
  
  /** Key metrics for this strategy */
  key_metrics: string[];
  
  /** Is this the primary strategy? */
  is_primary: boolean;
  
  /** Projected ROI (calculated separately) */
  projected_roi?: number;
  
  /** Estimated annual return (calculated separately) */
  estimated_annual_return?: number;
  
  /** Risk level (calculated separately) */
  risk_level?: 'Low' | 'Medium' | 'High';
}

/**
 * Strategy analysis for a specific property
 */
export interface PropertyStrategyAnalysis {
  /** Property ID */
  property_id: string;
  
  /** Property type */
  property_type: string;
  
  /** Property type display name */
  property_type_name: string;
  
  /** All available strategies for this property type */
  strategies: StrategyComparison[];
  
  /** Primary/recommended strategy */
  primary_strategy: StrategyComparison | null;
  
  /** Strategy with highest ROI */
  best_roi_strategy: StrategyComparison | null;
  
  /** Arbitrage opportunity (if difference > 15%) */
  arbitrage_opportunity: {
    exists: boolean;
    spread_percentage?: number;
    recommended_strategy?: StrategyName;
    current_strategy?: StrategyName;
    monthly_gain?: number;
  };
}

/**
 * Strategy matrix summary
 */
export interface StrategyMatrixSummary {
  /** Total property types */
  total_property_types: number;
  
  /** Total strategies */
  total_strategies: number;
  
  /** Average strategies per type */
  avg_strategies_per_type: number;
  
  /** Breakdown by category */
  by_category: {
    category: PropertyCategory;
    type_count: number;
    strategy_count: number;
  }[];
  
  /** Breakdown by strategy */
  by_strategy: {
    strategy_name: StrategyName;
    property_type_count: number;
    strong_count: number;
    moderate_count: number;
    weak_count: number;
  }[];
}

/**
 * Query params for strategy endpoints
 */
export interface StrategyQueryParams {
  /** Filter by property type */
  property_type?: string;
  
  /** Filter by category */
  category?: PropertyCategory;
  
  /** Filter by strategy name */
  strategy?: StrategyName;
  
  /** Filter by strength */
  strength?: StrategyStrength;
  
  /** Only show primary strategies */
  primary_only?: boolean;
  
  /** Include ROI calculations */
  include_calculations?: boolean;
}

/**
 * DTO for creating/updating a strategy
 */
export interface CreatePropertyTypeStrategyDto {
  /** Property type ID */
  type_id: number;
  
  /** Strategy name */
  strategy_name: StrategyName;
  
  /** Strength rating */
  strength: StrategyStrength;
  
  /** Notes */
  notes?: string;
  
  /** Min hold period (months) */
  hold_period_min?: number;
  
  /** Max hold period (months) */
  hold_period_max?: number;
  
  /** Key metrics */
  key_metrics?: string[];
  
  /** Is primary strategy */
  is_primary?: boolean;
  
  /** Sort order */
  sort_order?: number;
}

/**
 * DTO for updating a strategy
 */
export interface UpdatePropertyTypeStrategyDto {
  /** Strength rating */
  strength?: StrategyStrength;
  
  /** Notes */
  notes?: string;
  
  /** Min hold period (months) */
  hold_period_min?: number;
  
  /** Max hold period (months) */
  hold_period_max?: number;
  
  /** Key metrics */
  key_metrics?: string[];
  
  /** Is primary strategy */
  is_primary?: boolean;
  
  /** Sort order */
  sort_order?: number;
}

/**
 * Strategy ROI calculation inputs
 */
export interface StrategyROIInputs {
  /** Purchase price */
  purchase_price: number;
  
  /** Renovation/improvement cost */
  renovation_cost?: number;
  
  /** After-repair value (for flip/BTS) */
  arv?: number;
  
  /** Monthly rent (for rental/STR) */
  monthly_rent?: number;
  
  /** Average daily rate (for STR) */
  adr?: number;
  
  /** Occupancy rate % (for rental/STR) */
  occupancy_rate?: number;
  
  /** Operating expenses (monthly) */
  monthly_expenses?: number;
  
  /** Hold period (months) */
  hold_period?: number;
  
  /** Down payment % */
  down_payment_percent?: number;
  
  /** Interest rate % */
  interest_rate?: number;
}

/**
 * Strategy ROI calculation results
 */
export interface StrategyROIResults {
  /** Strategy name */
  strategy_name: StrategyName;
  
  /** Total investment */
  total_investment: number;
  
  /** Annual ROI % */
  annual_roi: number;
  
  /** Cash-on-cash return % */
  cash_on_cash_return: number;
  
  /** Net profit (BTS/Flip) or annual NOI (Rental) */
  net_profit_or_noi: number;
  
  /** Monthly cash flow (Rental/STR) */
  monthly_cash_flow?: number;
  
  /** Equity multiple (over hold period) */
  equity_multiple?: number;
  
  /** IRR % (if hold period provided) */
  irr?: number;
  
  /** Risk level */
  risk_level: 'Low' | 'Medium' | 'High';
}

/**
 * Strategy arbitrage detection
 */
export interface StrategyArbitrageOpportunity {
  /** Property ID */
  property_id: string;
  
  /** Current strategy (what market expects) */
  current_strategy: StrategyName;
  
  /** Current strategy ROI */
  current_roi: number;
  
  /** Recommended strategy */
  recommended_strategy: StrategyName;
  
  /** Recommended strategy ROI */
  recommended_roi: number;
  
  /** ROI spread % */
  spread_percentage: number;
  
  /** Monthly NOI gain (if rental strategies) */
  monthly_noi_gain?: number;
  
  /** Additional investment required */
  additional_investment?: number;
  
  /** Risk adjustment factor */
  risk_adjustment: number;
}

/**
 * Bulk strategy comparison response
 */
export interface BulkStrategyComparisonResponse {
  /** Properties analyzed */
  properties: PropertyStrategyAnalysis[];
  
  /** Summary statistics */
  summary: {
    total_properties: number;
    properties_with_arbitrage: number;
    avg_arbitrage_spread: number;
    top_opportunities: {
      property_id: string;
      spread_percentage: number;
      recommended_strategy: StrategyName;
    }[];
  };
}

export default {
  PropertyTypeStrategy,
  PropertyTypeWithStrategies,
  StrategyComparison,
  PropertyStrategyAnalysis,
  StrategyMatrixSummary,
  StrategyQueryParams,
  CreatePropertyTypeStrategyDto,
  UpdatePropertyTypeStrategyDto,
  StrategyROIInputs,
  StrategyROIResults,
  StrategyArbitrageOpportunity,
  BulkStrategyComparisonResponse,
};
