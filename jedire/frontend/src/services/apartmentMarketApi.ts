/**
 * Apartment Market API Service
 * Client for querying Apartment Locator AI data via JEDI RE backend
 */

import api from './api';

export interface MarketSummary {
  location: {
    city: string;
    state: string;
  };
  supply: {
    total_properties: number;
    total_units: number;
    avg_occupancy: number;
    class_distribution: {
      a: number;
      b: number;
      c: number;
    };
  };
  pricing: {
    avg_rent_by_type: { [key: string]: number };
    rent_growth_90d: number;
    rent_growth_180d: number;
    concession_rate: number;
    avg_concession_value: number;
  };
  demand: {
    total_renters: number;
    avg_budget: number;
    lease_expirations_90d: number;
  };
  forecast: {
    units_delivering_30d: number;
    units_delivering_60d: number;
    units_delivering_90d: number;
  };
}

export interface RentComparable {
  property_id: number;
  property_name: string;
  address: string;
  distance_miles?: number;
  unit_type: string;
  square_feet?: number;
  rent: number;
  rent_per_sqft?: number;
  occupancy?: number;
  year_built?: number;
  property_class?: string;
  concessions_active: boolean;
}

export interface SupplyPipeline {
  properties: Array<{
    id: number;
    name: string;
    address: string;
    total_units: number;
    property_class?: string;
    available_date: string;
    units_delivering: number;
  }>;
  total_units: number;
}

export interface AbsorptionRates {
  last_30_days: {
    units_absorbed: number;
    avg_days_on_market: number;
    occupancy_change: number;
  };
  last_90_days: {
    units_absorbed: number;
    avg_days_on_market: number;
    occupancy_change: number;
  };
  forecast_next_90_days: {
    units_to_absorb: number;
    estimated_days_on_market: number;
  };
}

class ApartmentMarketApi {
  /**
   * Get market summary for a city
   */
  async getMarketSummary(city: string, state: string): Promise<MarketSummary> {
    const response = await api.get('/api/apartment-market/market-summary', {
      params: { city, state }
    });
    return response.data.intelligence;
  }

  /**
   * Get rent comparables for a deal
   */
  async getDealComparables(dealId: number, limit: number = 10): Promise<RentComparable[]> {
    const response = await api.get(`/api/apartment-market/deal/${dealId}/comparables`, {
      params: { limit }
    });
    return response.data.comparables;
  }

  /**
   * Get supply pipeline for a city
   */
  async getSupplyPipeline(city: string, state: string): Promise<SupplyPipeline> {
    const response = await api.get('/api/apartment-market/supply-pipeline', {
      params: { city, state }
    });
    return response.data.pipeline;
  }

  /**
   * Get absorption rates for a city
   */
  async getAbsorptionRates(city: string, state: string): Promise<AbsorptionRates> {
    const response = await api.get('/api/apartment-market/absorption-rates', {
      params: { city, state }
    });
    return response.data.absorption;
  }

  /**
   * Sync market data for a deal
   */
  async syncDeal(dealId: number): Promise<{ success: boolean; metrics: any }> {
    const response = await api.post(`/api/apartment-market/sync-deal/${dealId}`);
    return response.data;
  }

  /**
   * Refresh market cache
   */
  async refreshCache(city: string, state: string): Promise<{ success: boolean }> {
    const response = await api.post('/api/apartment-market/refresh-cache', null, {
      params: { city, state }
    });
    return response.data;
  }
}

export const apartmentMarketApi = new ApartmentMarketApi();
