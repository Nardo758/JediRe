/**
 * Deal Capsule Models (Updated with Training Integration)
 * Complete 3-layer architecture with module outputs
 */

export interface DealCapsule {
  id: string;
  user_id: string;
  
  // Three core layers
  deal_data: DealData; // Layer 1: Preserved broker claims
  platform_intel: PlatformIntel; // Layer 2: Market comparison
  user_adjustments: UserAdjustments; // Layer 3: User's final model
  
  // Module outputs (separate from layers)
  module_outputs: ModuleOutputs;
  
  // Metadata
  property_address: string | null;
  asset_class: string | null;
  status: CapsuleStatus;
  jedi_score: number | null;
  collision_score: number | null;
  
  // Tracking
  last_module_run: Record<string, string>; // { "financial": "2026-02-17T14:30:00Z" }
  version: number;
  
  created_at: Date;
  updated_at: Date;
}

export type CapsuleStatus = 
  | 'DISCOVER'
  | 'RESEARCH' 
  | 'ANALYZE'
  | 'MODEL'
  | 'EXECUTE'
  | 'TRACK';

// Layer 1: Deal Data (Original broker/seller claims - PRESERVED)
export interface DealData {
  // Property basics
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  parcel_id?: string;
  
  // Financial basics
  asking_price?: number;
  units?: number;
  year_built?: number;
  lot_size_acres?: number;
  
  // Broker's claims (PRESERVED AS-IS)
  broker_rent_1br?: number;
  broker_rent_2br?: number;
  broker_rent_3br?: number;
  broker_occupancy?: number;
  broker_noi?: number;
  broker_cap_rate?: number;
  
  broker_claims?: {
    rent_upside?: string;
    occupancy_stabilized?: string;
    capex_deferred?: string;
    major_tenant?: string;
    [key: string]: any;
  };
  
  // Source
  broker_name?: string;
  broker_contact?: string;
  source_type?: 'email' | 'manual' | 'om_upload' | 'mls';
  
  [key: string]: any;
}

// Layer 2: Platform Intelligence (Market data for comparison - NOT override)
export interface PlatformIntel {
  // Market rents (for comparison)
  market_rent_1br?: number;
  market_rent_2br?: number;
  market_rent_3br?: number;
  
  // Market metrics
  submarket?: string;
  submarket_vacancy?: number;
  market_occupancy?: number;
  market_cap_rate_avg?: number;
  
  // Supply analysis
  supply_risk_score?: number;
  nearby_developments?: number;
  units_under_construction?: number;
  delivery_schedule?: Array<{
    units: number;
    delivery_date: string;
    distance_miles: number;
  }>;
  
  // Demand signals
  employment_growth?: number;
  job_growth_yoy?: number;
  population_growth?: number;
  major_employers?: string[];
  
  // Comparable sales
  comp_sales?: Array<{
    address: string;
    price_per_unit: number;
    cap_rate: number;
    sale_date: string;
    distance_miles: number;
  }>;
  
  // Property-specific intel
  zoning?: string;
  far?: number;
  adjacent_parcels?: Array<{
    parcel_id: string;
    owner: string;
    assessed_value: number;
    for_sale: boolean;
  }>;
  
  // Environmental
  environmental_flags?: string[];
  
  [key: string]: any;
}

// Layer 3: User Adjustments (User's final assumptions - PRO FORMA INPUT)
export interface UserAdjustments {
  // Adjusted financial assumptions (what user chooses to use)
  adjusted_rent_1br?: number;
  adjusted_rent_2br?: number;
  adjusted_rent_3br?: number;
  adjusted_occupancy?: number;
  adjusted_noi?: number;
  adjusted_expenses?: number;
  adjusted_rent_growth?: number;
  
  // Investment criteria
  target_irr?: number;
  preferred_hold_period?: number;
  exit_cap_assumption?: number;
  max_ltv?: number;
  
  // Portfolio context
  portfolio_exposure?: Record<string, number>; // { "Buckhead": 28 }
  past_acquisitions?: number;
  avg_performance_metrics?: Record<string, number>;
  
  // User's reasoning
  adjustment_notes?: string;
  risk_tolerance?: 'low' | 'medium' | 'high';
  
  [key: string]: any;
}

// Module Outputs (Results from analysis modules)
export interface ModuleOutputs {
  financial?: FinancialOutput;
  traffic?: TrafficOutput;
  development?: DevelopmentOutput;
  market_research?: MarketResearchOutput;
  due_diligence?: DueDiligenceOutput;
  ai_conversations?: AIConversation[];
}

export interface FinancialOutput {
  pro_forma_10_year: Array<{
    year: number;
    revenue: number;
    expenses: number;
    noi: number;
    debt_service: number;
    cash_flow: number;
  }>;
  irr: number;
  cash_on_cash: number;
  equity_multiple: number;
  debt_coverage_ratio: number;
  assumptions_used: {
    layer_1: Partial<DealData>;
    layer_2: Partial<PlatformIntel>;
    layer_3: Partial<UserAdjustments>;
    training_applied?: boolean;
    calibration_applied?: boolean;
  };
  sensitivity_analysis?: Record<string, any>;
  excel_export_ready: boolean;
  last_calculated: string;
}

export interface TrafficOutput {
  weekly_walk_ins: number;
  monthly_walk_ins: number;
  revenue_estimate_weekly: number;
  revenue_estimate_monthly: number;
  base_forecast: number;
  calibrated_forecast: number;
  calibration_factor: number | null;
  confidence: number;
  confidence_range: {
    min: number;
    max: number;
  };
  last_calculated: string;
}

export interface DevelopmentOutput {
  building_design: {
    stories: number;
    total_units: number;
    unit_mix: Record<string, number>;
    amenities: string[];
    parking_ratio: number;
  };
  cost_estimate: {
    land: number;
    construction: number;
    soft_costs: number;
    total: number;
    cost_per_unit: number;
  };
  timeline_months: number;
  development_proforma: FinancialOutput;
  horizontal_vs_vertical?: {
    horizontal_option: any;
    vertical_option: any;
    recommendation: string;
  };
  last_calculated: string;
}

export interface MarketResearchOutput {
  submarket_analysis: Record<string, any>;
  supply_demand_analysis: Record<string, any>;
  demographic_analysis: Record<string, any>;
  confidence_score: number;
  data_sources: string[];
  last_updated: string;
}

export interface DueDiligenceOutput {
  checklist: {
    total_items: number;
    completed: number;
    flagged: number;
    progress: number;
  };
  red_flags: Array<{
    category: string;
    severity: 'high' | 'medium' | 'low';
    issue: string;
    recommendation: string;
  }>;
  documents_uploaded: number;
  deal_killers_found: number;
  recommendation: string;
  last_updated: string;
}

export interface AIConversation {
  agent_type: 'financial' | 'development' | 'redevelopment';
  timestamp: string;
  user_query: string;
  agent_response: string;
  assumptions_used?: Record<string, any>;
  suggested_adjustments?: Record<string, any>;
}

// Capsule documents
export interface CapsuleDocument {
  id: string;
  capsule_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  extracted_data: Record<string, any> | null;
  extraction_status: 'pending' | 'processing' | 'complete' | 'failed';
  uploaded_by: string | null;
  created_at: Date;
}

// Capsule sharing
export interface CapsuleShare {
  id: string;
  capsule_id: string;
  shared_by: string;
  shared_with: string | null; // null = public link
  permission_tier: 'basic' | 'intel' | 'full' | 'collaborative';
  share_token: string | null;
  expires_at: Date | null;
  created_at: Date;
}

// Capsule activity
export interface CapsuleActivity {
  id: string;
  capsule_id: string;
  user_id: string | null;
  activity_type: string;
  activity_data: Record<string, any> | null;
  created_at: Date;
}

// Request/Response types
export interface CreateCapsuleRequest {
  deal_data: DealData;
  source_type?: string;
}

export interface UpdateLayer3Request {
  user_adjustments: Partial<UserAdjustments>;
  notes?: string;
}

export interface RunModuleRequest {
  module_id: string;
  force_rerun?: boolean;
}

export interface RunModuleResponse {
  success: boolean;
  module_id: string;
  output: any;
  training_used: boolean;
  calibration_used: boolean;
  confidence: number | null;
  last_calculated: string;
}

export interface CollisionAnalysisRequest {
  capsule_id: string;
}

export interface CollisionAnalysisResponse {
  overall_score: number;
  analyses: {
    strategy_arbitrage: CollisionAnalysis;
    portfolio_fit: CollisionAnalysis;
    broker_validation: CollisionAnalysis;
    risk_assessment: CollisionAnalysis;
    execution_confidence: CollisionAnalysis;
  };
}

export interface CollisionAnalysis {
  score: number; // 0-100
  insight: string;
  recommended_action: string;
  supporting_data?: Record<string, any>;
}
