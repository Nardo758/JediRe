/**
 * ApartmentIQ API Client
 * 
 * Integrates with ApartmentIQ (Apartment Locator AI) to fetch real-time
 * property data for JEDI RE market analysis.
 * 
 * @version 1.0.0
 * @date 2026-02-05
 */

import axios, { AxiosInstance } from 'axios';

// ============================================================================
// ApartmentIQ Response Types
// ============================================================================

export interface ApartmentIQProperty {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  submarket: string;
  
  // Supply
  total_units: number;
  available_units: number;
  vacancy_rate: number;
  days_on_market: number;
  
  // Pricing
  rent_studio?: number;
  rent_1bed?: number;
  rent_2bed?: number;
  rent_3bed?: number;
  rent_avg: number;
  price_change_30d?: number;
  price_change_90d?: number;
  
  // Building
  building_class: 'A' | 'B' | 'C';
  year_built: number;
  unit_mix: {
    studio_pct: number;
    one_bed_pct: number;
    two_bed_pct: number;
    three_bed_pct: number;
  };
  amenities: string[];
  sqft_avg?: number;
  
  // Intelligence (ApartmentIQ proprietary)
  opportunity_score: number;
  negotiation_success_rate: number;
  recommended_concessions?: string[];
  concessions_current?: string;
  leverage_factors?: string[];
  estimated_savings?: number;
  comparable_avg_rent?: number;
  price_vs_market?: number;
  
  // Metadata
  last_scraped: string;
  data_source: string;
  confidence_score: number;
}

export interface ApartmentIQMarketSummary {
  city: string;
  submarket: string;
  date_range: string;
  
  // Supply
  total_properties: number;
  total_units: number;
  available_units: number;
  vacancy_rate: number;
  avg_days_on_market: number;
  
  // Pricing
  avg_rent_studio: number;
  avg_rent_1bed: number;
  avg_rent_2bed: number;
  avg_rent_3bed: number;
  avg_rent_overall: number;
  rent_growth_rate_30d: number;
  rent_growth_rate_90d: number;
  
  // Intelligence
  avg_opportunity_score: number;
  concessions_prevalence: number;
  avg_concessions_pct: number;
  avg_savings_potential: number;
  negotiation_success_rate: number;
  
  // Market Pressure
  supply_demand_ratio: number;
  listing_volume_trend: string;
  seasonal_factor: number;
  market_saturation: string;
}

export interface ApartmentIQMarketDataResponse {
  market_summary: ApartmentIQMarketSummary;
  properties: ApartmentIQProperty[];
  total_properties: number;
  page: number;
  per_page: number;
}

export interface ApartmentIQTimeseriesObservation {
  date: string;
  
  // Core Metrics
  avg_rent: number;
  vacancy_rate: number;
  total_supply: number;
  available_units: number;
  listings_active: number;
  
  // Intelligence
  avg_opportunity_score: number;
  concessions_prevalence: number;
  avg_days_on_market: number;
  negotiation_success_rate: number;
  
  // Demand
  search_activity_index?: number;
  application_volume?: number;
  
  // Seasonal
  seasonal_factor: number;
}

export interface ApartmentIQTimeseriesResponse {
  submarket: string;
  city: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  observations: ApartmentIQTimeseriesObservation[];
}

export interface ApartmentIQSubmarket {
  name: string;
  city: string;
  zip_codes?: string[];
  
  // Supply
  properties_count: number;
  total_units: number;
  vacancy_rate: number;
  
  // Pricing
  avg_rent: number;
  rent_growth_30d: number;
  
  // Intelligence
  avg_opportunity_score: number;
  negotiation_success_rate: number;
  market_pressure: string;
}

export interface ApartmentIQSubmarketsResponse {
  submarkets: ApartmentIQSubmarket[];
}

// ============================================================================
// JEDI RE Internal Types (target format)
// ============================================================================

export interface JEDIMarketSnapshot {
  submarket_id: string;
  snapshot_date: string;
  
  // Supply
  existing_units: number;
  total_supply: number;
  
  // Demand (calculated)
  vacancy_rate: number;
  absorption_rate?: number;
  concessions_pct: number;
  
  // Pricing
  avg_rent: {
    studio?: number;
    one_bed?: number;
    two_bed?: number;
    three_bed?: number;
    average: number;
  };
  
  // Quality
  building_class_mix: {
    A: number;
    B: number;
    C: number;
  };
  
  // Intelligence (ApartmentIQ proprietary)
  opportunity_score?: number;
  negotiation_success_rate?: number;
  market_pressure_index?: number;
  
  // Metadata
  data_sources: Array<{
    name: string;
    type: string;
    confidence: number;
  }>;
  confidence: number;
}

// ============================================================================
// API Client
// ============================================================================

export class ApartmentIQClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey?: string;

  constructor() {
    this.baseUrl = process.env.APARTMENTIQ_API_URL || 'http://localhost:3000';
    this.apiKey = process.env.APARTMENTIQ_API_KEY;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'X-API-Key': this.apiKey }),
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // API responded with error
          throw new Error(
            `ApartmentIQ API error (${error.response.status}): ${
              error.response.data?.message || error.message
            }`
          );
        } else if (error.request) {
          // No response received
          throw new Error('ApartmentIQ API unreachable - no response received');
        } else {
          // Request setup error
          throw new Error(`ApartmentIQ API request error: ${error.message}`);
        }
      }
    );
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Fetch market data for a specific city/submarket
   * 
   * @param city - City name (e.g., "Atlanta")
   * @param submarket - Optional submarket filter (e.g., "Midtown")
   * @param dateFrom - Optional start date (ISO 8601)
   * @returns Market data with properties and summary
   */
  async fetchMarketData(
    city: string,
    submarket?: string,
    dateFrom?: string
  ): Promise<ApartmentIQMarketDataResponse> {
    try {
      const params: any = { city };
      if (submarket) params.submarket = submarket;
      if (dateFrom) params.date_from = dateFrom;

      const response = await this.client.get<ApartmentIQMarketDataResponse>(
        '/api/jedi/market-data',
        { params }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch market data: ${error}`);
    }
  }

  /**
   * Fetch timeseries/trend data for a submarket
   * 
   * @param submarket - Submarket name
   * @param period - Time period granularity
   * @param lookback - Days to look back
   * @returns Historical trend data
   */
  async fetchTimeseries(
    submarket: string,
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' = 'weekly',
    lookback: number = 90
  ): Promise<ApartmentIQTimeseriesResponse> {
    try {
      const response = await this.client.get<ApartmentIQTimeseriesResponse>(
        '/api/jedi/trends',
        {
          params: { submarket, period, lookback },
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch timeseries: ${error}`);
    }
  }

  /**
   * Fetch all submarkets for a city
   * 
   * @param city - City name
   * @returns List of submarkets with summary stats
   */
  async fetchSubmarkets(city: string): Promise<ApartmentIQSubmarketsResponse> {
    try {
      const response = await this.client.get<ApartmentIQSubmarketsResponse>(
        '/api/jedi/submarkets',
        {
          params: { city },
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch submarkets: ${error}`);
    }
  }

  // ==========================================================================
  // Transformation Methods (ApartmentIQ → JEDI RE format)
  // ==========================================================================

  /**
   * Transform ApartmentIQ market data into JEDI RE MarketSnapshot format
   */
  transformToMarketSnapshot(
    marketData: ApartmentIQMarketDataResponse
  ): JEDIMarketSnapshot {
    const { market_summary, properties } = marketData;

    // Calculate building class mix
    const classCounts = { A: 0, B: 0, C: 0 };
    properties.forEach((p) => classCounts[p.building_class]++);
    const totalProps = properties.length;

    return {
      submarket_id: market_summary.submarket,
      snapshot_date: new Date().toISOString(),

      // Supply
      existing_units: market_summary.total_units,
      total_supply: market_summary.total_units,

      // Demand
      vacancy_rate: market_summary.vacancy_rate,
      concessions_pct: market_summary.avg_concessions_pct,

      // Pricing
      avg_rent: {
        studio: market_summary.avg_rent_studio,
        one_bed: market_summary.avg_rent_1bed,
        two_bed: market_summary.avg_rent_2bed,
        three_bed: market_summary.avg_rent_3bed,
        average: market_summary.avg_rent_overall,
      },

      // Quality
      building_class_mix: {
        A: totalProps > 0 ? classCounts.A / totalProps : 0,
        B: totalProps > 0 ? classCounts.B / totalProps : 0,
        C: totalProps > 0 ? classCounts.C / totalProps : 0,
      },

      // Intelligence
      opportunity_score: market_summary.avg_opportunity_score,
      negotiation_success_rate: market_summary.negotiation_success_rate,
      market_pressure_index: this.calculateMarketPressure(market_summary),

      // Metadata
      data_sources: [
        {
          name: 'apartmentiq',
          type: 'api',
          confidence: this.calculateDataConfidence(properties),
        },
      ],
      confidence: this.calculateDataConfidence(properties),
    };
  }

  /**
   * Calculate market pressure index from ApartmentIQ intelligence
   * Higher = more pressure (good for renters, bad for landlords)
   * 
   * 0-3: Tight market (landlord advantage)
   * 3-5: Balanced
   * 5-8: Soft market (renter advantage)
   * 8-10: Very soft (high negotiation potential)
   */
  private calculateMarketPressure(summary: ApartmentIQMarketSummary): number {
    let pressure = 0;

    // Vacancy contributes 0-3 points
    pressure += Math.min(summary.vacancy_rate * 15, 3);

    // Concessions prevalence 0-3 points
    pressure += Math.min(summary.concessions_prevalence * 3, 3);

    // Days on market 0-2 points (normalized to 30 days)
    pressure += Math.min(summary.avg_days_on_market / 15, 2);

    // Opportunity score 0-2 points
    pressure += Math.min(summary.avg_opportunity_score / 5, 2);

    return Math.min(pressure, 10);
  }

  /**
   * Calculate data confidence score based on sample size and freshness
   */
  private calculateDataConfidence(properties: ApartmentIQProperty[]): number {
    if (properties.length === 0) return 0;

    // Base confidence on sample size (0-20 properties = 0.5-1.0)
    const sampleScore = Math.min(properties.length / 20, 1) * 0.5 + 0.5;

    // Average property confidence scores
    const avgPropertyScore =
      properties.reduce((sum, p) => sum + p.confidence_score, 0) /
      properties.length;

    // Weighted average
    return sampleScore * 0.3 + avgPropertyScore * 0.7;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const apartmentIQClient = new ApartmentIQClient();
