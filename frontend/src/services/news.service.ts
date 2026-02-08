/**
 * News Intelligence API Service
 * Frontend client for news events, alerts, and market intelligence
 */

import { apiClient } from './api.client';

export interface NewsEvent {
  id: string;
  event_category: string;
  event_type: string;
  event_status: string;
  source_type: string;
  source_name: string;
  source_url?: string;
  source_credibility_score: number;
  extracted_data: any;
  location_raw: string;
  city?: string;
  state?: string;
  impact_analysis?: any;
  impact_severity?: string;
  extraction_confidence: number;
  corroboration_count: number;
  early_signal_days?: number;
  published_at: string;
  affected_deals_count?: number;
  affected_properties_count?: number;
}

export interface NewsAlert {
  id: string;
  event_id: string;
  alert_type: string;
  headline: string;
  summary: string;
  suggested_action?: string;
  severity: string;
  is_read: boolean;
  is_dismissed: boolean;
  linked_deal_id?: number;
  linked_property_id?: number;
  deal_name?: string;
  property_name?: string;
  created_at: string;
  event_category?: string;
  event_type?: string;
  location_raw?: string;
}

export interface MarketDashboard {
  demand_momentum: {
    inbound_jobs: number;
    outbound_jobs: number;
    layoff_jobs: number;
    net_jobs: number;
    estimated_housing_demand: number;
    momentum_pct: number;
  };
  supply_pressure: {
    pipeline_units: number;
    project_count: number;
    pressure_pct: number;
  };
  transaction_activity: {
    count: number;
    avg_cap_rate: number | null;
    avg_price_per_unit: number | null;
  };
}

export interface ContactCredibility {
  contact_name: string;
  contact_company: string;
  contact_role?: string;
  total_signals: number;
  corroborated_signals: number;
  credibility_score: number;
  specialties?: any;
  last_signal_at: string;
}

export interface NetworkIntelligence {
  contacts: ContactCredibility[];
  avg_early_signal_days: number;
}

export const newsService = {
  /**
   * Get news events with filtering
   */
  async getEvents(filters: {
    category?: string;
    source_type?: string;
    severity?: string;
    limit?: number;
    offset?: number;
    include_private?: boolean;
  } = {}) {
    const params = new URLSearchParams();
    
    if (filters.category) params.append('category', filters.category);
    if (filters.source_type) params.append('source_type', filters.source_type);
    if (filters.severity) params.append('severity', filters.severity);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());
    if (filters.include_private !== undefined) 
      params.append('include_private', filters.include_private.toString());

    const response = await apiClient.get(`/news/events?${params.toString()}`);
    return response.data;
  },

  /**
   * Get single event with full details
   */
  async getEvent(id: string): Promise<{ success: boolean; data: NewsEvent }> {
    const response = await apiClient.get(`/news/events/${id}`);
    return response.data;
  },

  /**
   * Get market dashboard metrics
   */
  async getDashboard(filters: {
    trade_area_id?: number;
    submarket_id?: number;
  } = {}): Promise<{ success: boolean; data: MarketDashboard }> {
    const params = new URLSearchParams();
    
    if (filters.trade_area_id) params.append('trade_area_id', filters.trade_area_id.toString());
    if (filters.submarket_id) params.append('submarket_id', filters.submarket_id.toString());

    const response = await apiClient.get(`/news/dashboard?${params.toString()}`);
    return response.data;
  },

  /**
   * Get user's alerts
   */
  async getAlerts(filters: {
    unread_only?: boolean;
    severity?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ success: boolean; data: NewsAlert[]; unread_count: number }> {
    const params = new URLSearchParams();
    
    if (filters.unread_only) params.append('unread_only', 'true');
    if (filters.severity) params.append('severity', filters.severity);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const response = await apiClient.get(`/news/alerts?${params.toString()}`);
    return response.data;
  },

  /**
   * Update alert (mark read, dismissed, or snoozed)
   */
  async updateAlert(id: string, updates: {
    is_read?: boolean;
    is_dismissed?: boolean;
    snooze_hours?: number;
  }) {
    const response = await apiClient.patch(`/news/alerts/${id}`, updates);
    return response.data;
  },

  /**
   * Get network intelligence (contact credibility)
   */
  async getNetworkIntelligence(): Promise<{ success: boolean; data: NetworkIntelligence }> {
    const response = await apiClient.get('/news/network');
    return response.data;
  },
};
