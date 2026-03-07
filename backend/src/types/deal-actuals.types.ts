/**
 * Deal Actuals & Flywheel Types
 */

export interface DealActual {
  id: number;
  deal_id: string;
  period_start: string;
  period_end: string;
  
  // NOI
  actual_noi?: number;
  projected_noi?: number;
  
  // Occupancy
  actual_occupancy?: number;
  projected_occupancy?: number;
  
  // Rent
  actual_avg_rent?: number;
  projected_avg_rent?: number;
  
  // Expenses
  actual_opex?: number;
  projected_opex?: number;
  
  // Revenue
  actual_revenue?: number;
  projected_revenue?: number;
  
  // Units
  units_occupied?: number;
  total_units?: number;
  
  // Additional
  lease_renewals?: number;
  new_leases?: number;
  move_outs?: number;
  avg_days_vacant?: number;
  
  // Metadata
  notes?: string;
  data_source?: string;
  verified?: boolean;
  verified_by?: string;
  verified_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TrafficLog {
  id: number;
  deal_id: string;
  period_start: string;
  period_end: string;
  
  // Walk-in Traffic
  actual_walkins?: number;
  predicted_walkins?: number;
  
  // Digital Traffic
  website_visitors?: number;
  email_inquiries?: number;
  phone_calls?: number;
  digital_index?: number;
  
  // FDOT AADT
  fdot_aadt?: number;
  real_aadt?: number;
  
  // Conversions
  lease_conversions?: number;
  tour_to_lease_rate?: number;
  
  // Metadata
  notes?: string;
  data_source?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface FlywheelFeed {
  id: number;
  deal_id: string;
  target_module: string;
  
  // Contribution
  contribution_type?: string;
  data_points?: number;
  impact_level?: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: 'FEEDING' | 'VALIDATED' | 'PENDING' | 'UNDER_REVIEW' | 'LIVE' | 'VALIDATING';
  
  // Calibration
  calibration_description?: string;
  calibration_applied?: boolean;
  calibration_applied_at?: string;
  
  // Metrics
  accuracy_before?: number;
  accuracy_after?: number;
  deals_affected?: number;
  
  // Metadata
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DealActualsInput {
  deal_id: string;
  period_start: string;
  period_end: string;
  actual_noi?: number;
  projected_noi?: number;
  actual_occupancy?: number;
  projected_occupancy?: number;
  actual_avg_rent?: number;
  projected_avg_rent?: number;
  actual_opex?: number;
  projected_opex?: number;
  actual_revenue?: number;
  projected_revenue?: number;
  units_occupied?: number;
  total_units?: number;
  lease_renewals?: number;
  new_leases?: number;
  move_outs?: number;
  avg_days_vacant?: number;
  notes?: string;
  data_source?: string;
}

export interface TrafficLogInput {
  deal_id: string;
  period_start: string;
  period_end: string;
  actual_walkins?: number;
  predicted_walkins?: number;
  website_visitors?: number;
  email_inquiries?: number;
  phone_calls?: number;
  digital_index?: number;
  fdot_aadt?: number;
  real_aadt?: number;
  lease_conversions?: number;
  tour_to_lease_rate?: number;
  notes?: string;
  data_source?: string;
}

export interface FlywheelFeedInput {
  deal_id: string;
  target_module: string;
  contribution_type?: string;
  data_points?: number;
  impact_level?: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: string;
  calibration_description?: string;
  calibration_applied?: boolean;
  accuracy_before?: number;
  accuracy_after?: number;
  deals_affected?: number;
  notes?: string;
}
