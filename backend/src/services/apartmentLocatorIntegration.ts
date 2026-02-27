/**
 * Apartment Locator AI Integration Service
 * Connects JEDI RE to Apartment Locator AI's market intelligence
 * 
 * Provides real scraped property data for:
 * - Market analysis
 * - Rent comparables
 * - Supply pipeline
 * - Absorption rates
 * - Investment underwriting
 */

import axios, { AxiosInstance } from 'axios';

// =============================================
// TYPES
// =============================================

export interface MarketLocation {
  city: string;
  state: string;
}

export interface MarketIntelligence {
  location: MarketLocation;
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
    avg_rent_by_type: { [unitType: string]: number };
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

export interface SupplyPipelineProperty {
  id: number;
  name: string;
  address: string;
  total_units: number;
  property_class?: string;
  available_date: string;
  units_delivering: number;
}

export interface AbsorptionRate {
  avg_days_to_lease: number | null;
  properties_tracked: number;
  monthly_absorption_rate: number | null;
}

export interface PropertyDetails {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  
  // Property characteristics
  year_built?: number;
  year_renovated?: number;
  property_class?: 'A' | 'B' | 'C' | 'D';
  building_type?: string;
  management_company?: string;
  
  // Occupancy
  total_units?: number;
  current_occupancy_percent?: number;
  avg_days_to_lease?: number;
  
  // Financial data (in cents)
  parking_fee_monthly?: number;
  pet_rent_monthly?: number;
  application_fee?: number;
  admin_fee?: number;
  
  // Aggregated lease data
  unit_count: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  concession_count: number;
}

// =============================================
// CONFIGURATION
// =============================================

interface IntegrationConfig {
  baseUrl: string;
  timeout?: number;
  apiKey?: string;
}

// =============================================
// APARTMENT LOCATOR AI INTEGRATION SERVICE
// =============================================

export class ApartmentLocatorIntegration {
  private client: AxiosInstance;
  private config: IntegrationConfig;

  constructor(config: IntegrationConfig) {
    this.config = {
      timeout: 10000, // 10 seconds default
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
    });
  }

  // =============================================
  // MARKET INTELLIGENCE
  // =============================================

  /**
   * Get complete market intelligence for a location
   * Used for deal underwriting and market analysis
   */
  async getMarketData(location: MarketLocation): Promise<MarketIntelligence> {
    try {
      const response = await this.client.get('/api/jedi/market-data', {
        params: {
          city: location.city,
          state: location.state,
        },
      });

      return response.data.data;
    } catch (error: any) {
      console.error('Failed to fetch market data:', error.message);
      throw new Error(`Market data fetch failed: ${error.message}`);
    }
  }

  /**
   * Get rent comparables for underwriting
   * Returns properties with similar unit types in the same market
   */
  async getRentComps(
    location: MarketLocation,
    options?: {
      unit_type?: string;
      max_distance_miles?: number;
    }
  ): Promise<RentComparable[]> {
    try {
      const response = await this.client.get('/api/jedi/rent-comps', {
        params: {
          city: location.city,
          state: location.state,
          unit_type: options?.unit_type,
          max_distance_miles: options?.max_distance_miles,
        },
      });

      return response.data.data;
    } catch (error: any) {
      console.error('Failed to fetch rent comps:', error.message);
      throw new Error(`Rent comps fetch failed: ${error.message}`);
    }
  }

  /**
   * Get supply pipeline (properties coming online)
   * Used for supply pressure analysis
   */
  async getSupplyPipeline(
    location: MarketLocation,
    days: number = 180
  ): Promise<SupplyPipelineProperty[]> {
    try {
      const response = await this.client.get('/api/jedi/supply-pipeline', {
        params: {
          city: location.city,
          state: location.state,
          days,
        },
      });

      return response.data.data;
    } catch (error: any) {
      console.error('Failed to fetch supply pipeline:', error.message);
      throw new Error(`Supply pipeline fetch failed: ${error.message}`);
    }
  }

  /**
   * Get absorption rate for market
   * Indicates how quickly units lease up
   */
  async getAbsorptionRate(location: MarketLocation): Promise<AbsorptionRate> {
    try {
      const response = await this.client.get('/api/jedi/absorption-rate', {
        params: {
          city: location.city,
          state: location.state,
        },
      });

      return response.data.data;
    } catch (error: any) {
      console.error('Failed to fetch absorption rate:', error.message);
      throw new Error(`Absorption rate fetch failed: ${error.message}`);
    }
  }

  // =============================================
  // PROPERTY DATA
  // =============================================

  /**
   * Get detailed property list for admin/analysis
   */
  async getProperties(filters?: {
    city?: string;
    state?: string;
    zip?: string;
    class?: 'A' | 'B' | 'C' | 'D';
  }): Promise<PropertyDetails[]> {
    try {
      const response = await this.client.get('/api/admin/properties', {
        params: filters,
      });

      return response.data.data;
    } catch (error: any) {
      console.error('Failed to fetch properties:', error.message);
      throw new Error(`Properties fetch failed: ${error.message}`);
    }
  }

  /**
   * Get properties grouped by location
   */
  async getPropertiesGrouped(): Promise<Array<{
    city: string;
    state: string;
    property_count: number;
    total_units: number;
    avg_occupancy: number;
    last_scraped: string;
  }>> {
    try {
      const response = await this.client.get('/api/admin/properties/grouped');
      return response.data.data;
    } catch (error: any) {
      console.error('Failed to fetch grouped properties:', error.message);
      throw new Error(`Grouped properties fetch failed: ${error.message}`);
    }
  }

  // =============================================
  // CONVENIENCE METHODS
  // =============================================

  /**
   * Get market summary for quick overview
   * Combines multiple API calls into one summary
   */
  async getMarketSummary(location: MarketLocation): Promise<{
    market: MarketIntelligence;
    absorption: AbsorptionRate;
    pipeline: SupplyPipelineProperty[];
  }> {
    const [market, absorption, pipeline] = await Promise.all([
      this.getMarketData(location),
      this.getAbsorptionRate(location),
      this.getSupplyPipeline(location, 90),
    ]);

    return { market, absorption, pipeline };
  }

  /**
   * Get investment metrics for underwriting
   * Returns key metrics for financial analysis
   */
  async getInvestmentMetrics(location: MarketLocation): Promise<{
    avg_rent_growth_90d: number;
    avg_rent_growth_180d: number;
    occupancy_rate: number;
    concession_rate: number;
    absorption_days: number | null;
    supply_pressure: 'low' | 'moderate' | 'high';
    market_grade: 'A' | 'B' | 'C' | 'D';
  }> {
    const market = await this.getMarketData(location);
    const absorption = await this.getAbsorptionRate(location);

    // Calculate supply pressure
    const totalPipeline = market.forecast.units_delivering_90d;
    const currentSupply = market.supply.total_units;
    const supplyPressureRatio = totalPipeline / currentSupply;

    let supply_pressure: 'low' | 'moderate' | 'high';
    if (supplyPressureRatio < 0.05) supply_pressure = 'low';
    else if (supplyPressureRatio < 0.10) supply_pressure = 'moderate';
    else supply_pressure = 'high';

    // Calculate market grade (weighted average of property classes)
    const totalProperties = market.supply.class_distribution.a +
                           market.supply.class_distribution.b +
                           market.supply.class_distribution.c;
    const classScore = (
      (market.supply.class_distribution.a * 4) +
      (market.supply.class_distribution.b * 3) +
      (market.supply.class_distribution.c * 2)
    ) / totalProperties;

    let market_grade: 'A' | 'B' | 'C' | 'D';
    if (classScore >= 3.5) market_grade = 'A';
    else if (classScore >= 2.5) market_grade = 'B';
    else if (classScore >= 1.5) market_grade = 'C';
    else market_grade = 'D';

    return {
      avg_rent_growth_90d: market.pricing.rent_growth_90d,
      avg_rent_growth_180d: market.pricing.rent_growth_180d,
      occupancy_rate: market.supply.avg_occupancy,
      concession_rate: market.pricing.concession_rate,
      absorption_days: absorption.avg_days_to_lease,
      supply_pressure,
      market_grade,
    };
  }

  /**
   * Check if market data is available for a location
   */
  async hasMarketData(location: MarketLocation): Promise<boolean> {
    try {
      const market = await this.getMarketData(location);
      return market.supply.total_properties > 0;
    } catch (error) {
      return false;
    }
  }
}

// =============================================
// FACTORY & SINGLETON
// =============================================

let integrationInstance: ApartmentLocatorIntegration | null = null;

/**
 * Initialize the integration service
 * Call this once at application startup
 */
export function initializeApartmentLocatorIntegration(config: IntegrationConfig): void {
  integrationInstance = new ApartmentLocatorIntegration(config);
  console.log('Apartment Locator AI integration initialized:', config.baseUrl);
}

/**
 * Get the integration instance
 * Throws if not initialized
 */
export function getApartmentLocatorIntegration(): ApartmentLocatorIntegration {
  if (!integrationInstance) {
    throw new Error('Apartment Locator AI integration not initialized. Call initializeApartmentLocatorIntegration() first.');
  }
  return integrationInstance;
}

// =============================================
// CONVENIENCE EXPORTS
// =============================================

export default {
  initialize: initializeApartmentLocatorIntegration,
  getInstance: getApartmentLocatorIntegration,
};
