/**
 * Module Training Models
 * Pattern training system - learns user's underwriting style
 */

export interface UserModuleTraining {
  id: string;
  user_id: string;
  module_id: ModuleType;
  learned_patterns: LearnedPatterns;
  accuracy: number; // 0-100
  confidence: number; // 0-100
  sample_size: number;
  last_trained: Date | null;
  training_duration_minutes: number | null;
  model_version: string;
  created_at: Date;
  updated_at: Date;
}

export type ModuleType = 
  | 'financial' 
  | 'traffic' 
  | 'development' 
  | 'market_research' 
  | 'due_diligence';

export interface LearnedPatterns {
  // Financial module patterns
  rent_growth_avg?: number;
  rent_growth_behavior?: 'conservative' | 'moderate' | 'aggressive';
  exit_cap_spread?: number;
  hold_period_mode?: number;
  stress_test_defaults?: {
    occupancy: number;
    rent_reduction: number;
  };
  expense_ratio_avg?: number;
  
  // Development module patterns
  preferred_unit_mix?: {
    studio?: number;
    '1br'?: number;
    '2br'?: number;
    '3br'?: number;
  };
  amenity_preferences?: {
    must_have: string[];
    nice_to_have: string[];
    never: string[];
  };
  construction_quality?: string;
  cost_buffer_avg?: number;
  timeline_buffer_months?: number;
  
  // Traffic engine patterns (typically none - calibration only)
  
  // Market research patterns
  trusted_sources?: Array<{
    source: string;
    weight: number;
  }>;
  submarket_preferences?: Record<string, {
    rating: string;
    notes: string;
  }>;
  research_depth?: 'quick' | 'standard' | 'deep';
  
  // Due diligence patterns
  checklist_template?: string;
  deal_breakers?: string[];
  inspection_depth?: 'basic' | 'standard' | 'thorough';
  
  // Generic pattern storage
  [key: string]: any;
}

export interface TrainingExample {
  id: string;
  training_id: string;
  deal_characteristics: Record<string, any>;
  user_output: Record<string, any>;
  quality_score: number; // 0-100
  source_type: 'uploaded_proforma' | 'past_deal' | 'manual_entry';
  source_file_name: string | null;
  created_at: Date;
}

export interface ModuleSuggestion {
  id: string;
  capsule_id: string;
  module_id: ModuleType;
  suggested_field: string;
  suggested_value: any;
  suggestion_reason: string | null;
  confidence: number | null; // 0-100
  user_response: 'accepted' | 'rejected' | 'modified' | null;
  user_final_value: any | null;
  feedback_notes: string | null;
  feedback_timestamp: Date | null;
  created_at: Date;
}

export interface TrainingUploadRequest {
  module_id: ModuleType;
  examples: Array<{
    deal_characteristics: Record<string, any>;
    user_output: Record<string, any>;
    source_type?: string;
    source_file_name?: string;
  }>;
}

export interface TrainingStatus {
  module_id: ModuleType;
  is_trained: boolean;
  accuracy: number | null;
  confidence: number | null;
  sample_size: number;
  last_trained: Date | null;
  learned_patterns: LearnedPatterns | null;
}

export interface SuggestionRequest {
  capsule_id: string;
  module_id: ModuleType;
  deal_data: Record<string, any>;
  platform_intel: Record<string, any>;
}

export interface SuggestionResponse {
  suggestions: Array<{
    field: string;
    value: any;
    reason: string;
    confidence: number;
  }>;
  training_applied: boolean;
  training_confidence: number | null;
}

export interface TrainModuleRequest {
  module_id: ModuleType;
  force_retrain?: boolean; // If true, retrain even if recently trained
}

export interface TrainModuleResponse {
  success: boolean;
  accuracy: number;
  confidence: number;
  sample_size: number;
  learned_patterns: LearnedPatterns;
  training_duration_minutes: number;
}
