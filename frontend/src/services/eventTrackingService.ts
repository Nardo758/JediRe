/**
 * Event Tracking Service
 * 
 * API client for tracking user interactions with properties and fetching
 * digital traffic scores. Supports batching and offline queuing.
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

/**
 * Track a single property interaction event
 */
export async function trackEvent(event: PropertyEvent): Promise<void> {
  try {
    await axios.post(`${API_BASE}/events/track`, event, {
      timeout: 5000,
    });
  } catch (error) {
    console.error('Failed to track event:', error);
    // Don't throw - tracking failures shouldn't break the app
  }
}

/**
 * Track multiple events in a single batch request
 * More efficient than individual tracking calls
 */
export async function trackBatch(events: PropertyEvent[]): Promise<void> {
  if (events.length === 0) return;
  
  try {
    await axios.post(`${API_BASE}/events/track/batch`, { events }, {
      timeout: 10000,
    });
  } catch (error) {
    console.error('Failed to track batch events:', error);
    // Don't throw - tracking failures shouldn't break the app
  }
}

/**
 * Fetch the current digital traffic score for a property
 */
export async function getDigitalScore(propertyId: string): Promise<DigitalTrafficScore | null> {
  try {
    const response = await axios.get(`${API_BASE}/events/score/${propertyId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch digital score:', error);
    return null;
  }
}

/**
 * Fetch currently trending properties
 */
export async function getTrendingProperties(limit: number = 10): Promise<TrendingProperty[]> {
  try {
    const response = await axios.get(`${API_BASE}/events/trending`, {
      params: { limit },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch trending properties:', error);
    return [];
  }
}

/**
 * Fetch daily engagement metrics for a property (last 30 days)
 */
export async function getEngagementHistory(propertyId: string, days: number = 30): Promise<any[]> {
  try {
    const response = await axios.get(`${API_BASE}/events/engagement/${propertyId}`, {
      params: { days },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch engagement history:', error);
    return [];
  }
}
