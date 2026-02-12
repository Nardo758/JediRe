export type DefinitionMethod = 'radius' | 'drive_time' | 'traffic_informed' | 'custom_draw';

export type GeographicScope = 'trade_area' | 'submarket' | 'msa';

export interface TradeArea {
  id: number;
  name: string;
  user_id: number;
  team_id?: number;
  geometry: GeoJSON.Polygon;
  definition_method: DefinitionMethod;
  method_params: {
    radius_miles?: number;
    traffic_adjusted?: boolean;
    drive_time_minutes?: number;
    profile?: 'driving' | 'walking';
  };
  confidence_score?: number;
  parent_submarket_id?: number;
  parent_msa_id?: number;
  stats_snapshot?: TradeAreaStats;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface TradeAreaStats {
  population: number;
  existing_units: number;
  pipeline_units: number;
  avg_rent: number;
  properties_count?: number;
  occupancy?: number;
}

export interface Submarket {
  id: number;
  name: string;
  msa_id: number;
  geometry: GeoJSON.MultiPolygon;
  source: string;
  properties_count: number;
  avg_occupancy: number;
  avg_rent: number;
  updated_at: string;
}

export interface MSA {
  id: number;
  name: string;
  cbsa_code: string;
  state_codes: string[];
  geometry: GeoJSON.MultiPolygon;
  population: number;
  median_household_income: number;
  updated_at: string;
}

export interface GeographicContext {
  deal_id: number;
  trade_area?: TradeArea;
  submarket: Submarket;
  msa: MSA;
  active_scope: GeographicScope;
}

export interface CreateTradeAreaInput {
  name: string;
  geometry: GeoJSON.Polygon;
  definition_method: DefinitionMethod;
  method_params: Record<string, any>;
  confidence_score?: number;
  parent_submarket_id?: number;
  parent_msa_id?: number;
}
