/**
 * Calibration Models
 * Accuracy validation system - learns from actual performance
 */

export interface PropertyActuals {
  id: string;
  property_id: string;
  user_id: string;
  measurement_date: Date;
  measurement_type: 'monthly' | 'quarterly' | 'annual';
  
  // Financial actuals
  actual_noi: number | null;
  actual_rent_avg: number | null;
  actual_occupancy: number | null;
  actual_expenses: number | null;
  actual_revenue: number | null;
  
  // Traffic actuals
  actual_traffic_weekly: number | null;
  actual_traffic_data_source: string | null;
  
  // Development actuals
  actual_construction_cost: number | null;
  actual_months_to_complete: number | null;
  actual_cost_overrun_percentage: number | null;
  
  // Metadata
  data_source: string;
  quality_score: number; // 0-100
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ForecastValidation {
  id: string;
  user_id: string;
  module_id: string;
  property_id: string;
  capsule_id: string | null;
  
  // Forecast
  forecast_metric: string;
  forecast_value: number;
  forecast_made_at: Date;
  forecast_timeframe: string | null;
  
  // Actual
  actual_value: number;
  actual_measured_at: Date;
  actual_data_source: string | null;
  
  // Accuracy (calculated columns)
  error_absolute: number; // actual - forecast
  error_percentage: number; // (actual - forecast) / forecast * 100
  
  // Context
  deal_context: Record<string, any> | null;
  quality_score: number;
  created_at: Date;
}

export interface CalibrationFactors {
  id: string;
  user_id: string;
  module_id: string;
  calibration_data: CalibrationData;
  sample_size: number;
  confidence: number; // 0-100
  mean_absolute_error: number | null;
  root_mean_square_error: number | null;
  last_updated: Date;
  created_at: Date;
}

export interface CalibrationData {
  // Financial module
  noi_factor?: number; // e.g., 0.975 if user is 2.5% optimistic
  rent_factor?: number;
  occupancy_bias?: number;
  expense_bias?: number;
  
  // Traffic module
  traffic_factor?: number; // e.g., 0.79 if properties generate 21% less than forecast
  property_type_adjustments?: Record<string, number>;
  
  // Development module
  cost_overrun_factor?: number;
  timeline_factor?: number;
  
  // Generic calibration
  [key: string]: any;
}

export interface SubmitActualsRequest {
  property_id: string;
  measurement_date: string; // ISO date
  measurement_type: 'monthly' | 'quarterly' | 'annual';
  actuals: {
    noi?: number;
    rent_avg?: number;
    occupancy?: number;
    expenses?: number;
    revenue?: number;
    traffic_weekly?: number;
    construction_cost?: number;
    months_to_complete?: number;
  };
  data_source: string;
  quality_score?: number;
  notes?: string;
}

export interface CalibrationStatus {
  module_id: string;
  is_calibrated: boolean;
  calibration_factor: number | null;
  sample_size: number;
  confidence: number | null;
  last_updated: Date | null;
  calibration_data: CalibrationData | null;
}

export interface RecalibrateRequest {
  module_id: string;
  user_id?: string; // If not provided, use current user
  force?: boolean; // Force recalculation even if recent
}

export interface RecalibrateResponse {
  success: boolean;
  calibration_data: CalibrationData;
  sample_size: number;
  confidence: number;
  mean_absolute_error: number;
  validations_used: number;
}

export interface ValidationSummary {
  module_id: string;
  total_validations: number;
  avg_error_percentage: number;
  stddev_error: number;
  min_error: number;
  max_error: number;
  pct_optimistic: number; // 0-1 (percentage that were overestimates)
}

export interface CompareRequest {
  capsule_id: string;
  property_id: string; // Live property to compare against
  metrics: string[]; // ['noi', 'occupancy', 'traffic']
}

export interface CompareResponse {
  capsule_id: string;
  property_id: string;
  comparisons: Array<{
    metric: string;
    forecast: number;
    actual: number;
    error_percentage: number;
    status: 'better' | 'worse' | 'on_target';
  }>;
  overall_accuracy: number;
}

export interface PropertySyncRequest {
  property_id: string;
  sync_source: 'yardi' | 'manual' | 'import';
  api_credentials?: Record<string, any>;
}

export interface PropertySyncResponse {
  success: boolean;
  synced_records: number;
  latest_data: PropertyActuals | null;
  errors: string[];
}
