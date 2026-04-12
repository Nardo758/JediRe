import axios from 'axios';

export interface PropertyEvent {
  property_id: string;
  event_type: 'search_impression' | 'map_click' | 'detail_view' | 'analysis_run' | 'saved' | 'shared';
  metadata?: Record<string, any>;
  session_id?: string;
  referrer?: string;
  timestamp?: string;
}

export interface DigitalTrafficScore {
  property_id: string;
  score: number;
  weekly_views: number;
  weekly_saves: number;
  trending_velocity: number;
  institutional_interest_flag: boolean;
  unique_users_7d: number;
  calculated_at: string;
}

export interface TrendingProperty {
  property_id: string;
  score: number;
  trending_velocity: number;
  recent_views: number;
}

export async function trackEvent(_event: PropertyEvent): Promise<void> {
}

export async function trackBatch(_events: PropertyEvent[]): Promise<void> {
}

export async function getDigitalScore(_propertyId: string): Promise<DigitalTrafficScore | null> {
  return null;
}

export async function getTrendingProperties(_limit: number = 10): Promise<TrendingProperty[]> {
  return [];
}

export async function getEngagementHistory(_propertyId: string, _days: number = 30): Promise<any[]> {
  return [];
}
