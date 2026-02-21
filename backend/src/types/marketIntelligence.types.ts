// Market Intelligence Types
// Created: 2026-02-20
// Purpose: TypeScript types for unified market system

export interface UserMarketPreference {
  id: number;
  user_id: string;
  market_id: string;
  display_name: string;
  is_active: boolean;
  priority: number;
  notification_settings: {
    alerts_enabled: boolean;
    new_data_points: boolean;
    opportunities: boolean;
    market_updates: boolean;
  };
  created_at: Date;
  updated_at: Date;
}

export interface MarketCoverageStatus {
  id: number;
  market_id: string;
  display_name: string;
  state_code: string | null;
  total_parcels: number | null;
  covered_parcels: number | null;
  coverage_percentage: number | null;
  data_points_count: number;
  total_units: number;
  last_import_date: Date | null;
  next_scheduled_import: Date | null;
  status: 'active' | 'pending' | 'inactive';
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface MarketVitals {
  id: number;
  market_id: string;
  date: Date;
  population: number | null;
  population_growth_yoy: number | null;
  job_growth_yoy: number | null;
  median_income: number | null;
  median_home_price: number | null;
  rent_growth_yoy: number | null;
  avg_rent_per_unit: number | null;
  occupancy_rate: number | null;
  vacancy_rate: number | null;
  absorption_rate: number | null;
  new_supply_units: number | null;
  jedi_score: number | null;
  jedi_rating: string | null;
  source: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}

// API Request/Response types

export interface CreateMarketPreferenceRequest {
  market_id: string;
  display_name: string;
  priority?: number;
  notification_settings?: Partial<UserMarketPreference['notification_settings']>;
}

export interface UpdateMarketPreferenceRequest {
  is_active?: boolean;
  priority?: number;
  notification_settings?: Partial<UserMarketPreference['notification_settings']>;
}

export interface MarketOverviewResponse {
  active_markets_count: number;
  total_data_points: number;
  active_deals_count: number;
  markets: MarketCardData[];
  alerts: MarketAlert[];
}

export interface MarketCardData {
  market_id: string;
  display_name: string;
  state_code: string | null;
  coverage_percentage: number;
  data_points_count: number;
  total_units: number;
  active_deals_count: number;
  status: 'active' | 'pending' | 'inactive';
  vitals: {
    rent_growth_yoy: number | null;
    occupancy_rate: number | null;
    jedi_score: number | null;
    jedi_rating: string | null;
  } | null;
  last_import_date: Date | null;
}

export interface MarketSummaryResponse {
  market: MarketCoverageStatus;
  vitals: MarketVitals | null;
  active_deals_count: number;
  is_tracked: boolean;
  user_preference: UserMarketPreference | null;
}

export interface MarketAlert {
  id: string;
  market_id: string;
  market_name: string;
  type: 'new_data' | 'opportunity' | 'market_update' | 'threshold_met';
  severity: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  action_url?: string;
  created_at: Date;
}

export interface MarketComparisonResponse {
  markets: Array<{
    market_id: string;
    display_name: string;
    vitals: MarketVitals | null;
    coverage: MarketCoverageStatus;
    active_deals_count: number;
  }>;
  comparison_date: Date;
}

// Service types

export interface GenerateMarketAlertsOptions {
  user_id: string;
  market_id?: string;
  since?: Date;
}

export interface MarketDataAggregation {
  market_id: string;
  data_points_count: number;
  total_units: number;
  avg_unit_size: number;
  avg_value_per_unit: number;
  properties_with_sales_history: number;
  properties_with_owner_info: number;
}
