/**
 * Type definitions for JediRe API
 */

export interface JediReConfig {
  baseUrl?: string;
  token?: string;
  email?: string;
  password?: string;
  requestTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  logRequests?: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface Deal {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  property_type?: string;
  status?: string;
  purchase_price?: number;
  closing_date?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  property_type?: string;
  square_footage?: number;
  bedrooms?: number;
  bathrooms?: number;
  year_built?: number;
  lot_size?: number;
  zoning?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface Market {
  id: string;
  name: string;
  region?: string;
  population?: number;
  median_income?: number;
  unemployment_rate?: number;
  [key: string]: any;
}

export interface MarketIntelligence {
  market_id: string;
  market_name?: string;
  median_price?: number;
  price_trend?: string;
  inventory_levels?: number;
  days_on_market?: number;
  absorption_rate?: number;
  foreclosure_rate?: number;
  updated_at?: string;
  [key: string]: any;
}

export interface Ranking {
  id: string;
  market_id: string;
  property_id?: string;
  deal_id?: string;
  pcs_score?: number;
  rank?: number;
  category?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface Analysis {
  id: string;
  deal_id: string;
  type: string;
  status: string;
  results?: any;
  created_at?: string;
  completed_at?: string;
  [key: string]: any;
}

export interface ApiError {
  id: string;
  endpoint: string;
  method: string;
  status_code?: number;
  error_message: string;
  stack_trace?: string;
  timestamp: string;
  [key: string]: any;
}

export interface ListFilters {
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  [key: string]: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
