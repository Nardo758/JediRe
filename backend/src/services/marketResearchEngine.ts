/**
 * JEDI RE Market Research Engine
 * Central intelligence hub that aggregates market data from multiple sources
 * 
 * Data Sources:
 * - Apartment Locator AI (PRIMARY APARTMENT MARKET DATA)
 *   → Rent prices, occupancy, unit mix, amenities, concessions
 *   → Rent trends, property inventory, market saturation
 *   → Property classification, lease rates, availability
 * - Zoning Intelligence (FUTURE SUPPLY PREDICTION)
 *   → Allowed density, vacant parcels, development potential
 *   → Rezoning probability, buildable units forecast
 *   → Time to market analysis
 * - Census API (demographics)
 * - News Intelligence (market events)
 * - Building Permits (pipeline supply - permitted projects)
 * - Labor Statistics (employment)
 * - CoStar (commercial real estate - when available)
 */

import axios from 'axios';
import { pool } from '../database';

// Data source configurations
const DATA_SOURCES = {
  APARTMENT_LOCATOR_AI: process.env.APARTMENT_LOCATOR_API_URL || 'http://localhost:3000/api',
  CENSUS_API: 'https://api.census.gov/data',
  // Add other sources as they become available
};

interface DealLocation {
  id: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  address: string;
}

interface MarketResearchReport {
  deal_id: string;
  submarket_name: string;
  generated_at: Date;
  
  // Apartment Market Data (from Apartment Locator AI - PRIMARY SOURCE)
  apartment_market: {
    // Property Inventory
    properties_count: number;
    total_units: number;
    available_units: number;
    
    // Rent Prices by Unit Type
    avg_rent_studio?: number;
    avg_rent_1br?: number;
    avg_rent_2br?: number;
    avg_rent_3br?: number;
    
    // Market Performance
    avg_occupancy_rate?: number;
    rent_growth_6mo?: number;
    rent_growth_12mo?: number;
    
    // Supply Metrics
    market_saturation: number;  // % of market captured
    competition_intensity: 'LOW' | 'MEDIUM' | 'HIGH';
    
    // Property Quality
    avg_property_age?: number;
    property_class_mix?: { A: number; B: number; C: number; D: number };
    
    // Amenities & Features
    common_amenities: string[];
    avg_amenity_count?: number;
    
    // Concessions & Incentives
    active_concessions_count: number;
    avg_concession_value?: number;
    
    // Comparable Properties
    comparable_properties: any[];
  };
  
  // Demographics (from Census API)
  demographics?: {
    population: number;
    median_income: number;
    population_growth_rate?: number;
    household_count?: number;
  };
  
  // Market Events (from News Intelligence)
  market_events?: {
    recent_developments: any[];
    employment_changes: any[];
    major_announcements: any[];
  };
  
  // Supply Pipeline (from Building Permits - permitted projects)
  supply_pipeline?: {
    units_under_construction: number;
    units_permitted: number;
    expected_delivery_timeline: string;
  };
  
  // Zoning Intelligence (future supply prediction)
  zoning_analysis?: {
    // Developable Land
    vacant_parcels_count: number;
    underutilized_parcels_count: number;
    total_developable_acres: number;
    
    // Development Potential
    max_allowed_density: number;  // units per acre
    theoretical_max_units: number;  // max buildable under current zoning
    realistic_buildable_units: number;  // adjusted for market conditions
    
    // Probability Factors
    rezoning_likelihood: 'LOW' | 'MEDIUM' | 'HIGH';
    development_probability: number;  // 0-100
    
    // Timeline
    estimated_years_to_saturation: number;
    future_supply_risk: 'LOW' | 'MEDIUM' | 'HIGH';
    
    // Market Impact
    future_supply_ratio: number;  // future units / existing units
    absorption_capacity: string;  // Can market absorb future supply?
  };
  
  // Aggregated Metrics
  market_score: {
    demand_strength: number;  // 0-100
    supply_balance: number;   // 0-100
    overall_opportunity: number; // 0-100
    future_supply_risk: number;  // 0-100 (higher = more risk)
  };
  
  // Data Quality
  data_quality: {
    sources_available: string[];
    sources_missing: string[];
    confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export class MarketResearchEngine {
  
  /**
   * Main entry point: Generate comprehensive market research for a deal
   */
  async generateMarketReport(dealLocation: DealLocation): Promise<MarketResearchReport> {
    console.log(`🧠 Generating market research for deal ${dealLocation.id}`);
    
    const startTime = Date.now();
    const sourcesAvailable: string[] = [];
    const sourcesMissing: string[] = [];
    
    // Parallel data fetching from all sources
    const [
      apartmentData,
      demographics,
      marketEvents,
      supplyPipeline,
      zoningAnalysis
    ] = await Promise.allSettled([
      this.fetchApartmentMarketData(dealLocation).catch(err => {
        sourcesMissing.push('Apartment Locator AI');
        return null;
      }),
      this.fetchDemographics(dealLocation).catch(err => {
        sourcesMissing.push('Census API');
        return null;
      }),
      this.fetchMarketEvents(dealLocation).catch(err => {
        sourcesMissing.push('News Intelligence');
        return null;
      }),
      this.fetchSupplyPipeline(dealLocation).catch(err => {
        sourcesMissing.push('Building Permits');
        return null;
      }),
      this.fetchZoningIntelligence(dealLocation).catch(err => {
        sourcesMissing.push('Zoning Intelligence');
        return null;
      })
    ]);
    
    // Extract successful results
    const apartmentMarket = apartmentData.status === 'fulfilled' ? apartmentData.value : null;
    const demo = demographics.status === 'fulfilled' ? demographics.value : null;
    const events = marketEvents.status === 'fulfilled' ? marketEvents.value : null;
    const pipeline = supplyPipeline.status === 'fulfilled' ? supplyPipeline.value : null;
    const zoning = zoningAnalysis.status === 'fulfilled' ? zoningAnalysis.value : null;
    
    // Track which sources succeeded
    if (apartmentMarket) sourcesAvailable.push('Apartment Locator AI');
    if (demo) sourcesAvailable.push('Census API');
    if (events) sourcesAvailable.push('News Intelligence');
    if (pipeline) sourcesAvailable.push('Building Permits');
    if (zoning) sourcesAvailable.push('Zoning Intelligence');
    
    // Calculate market scores (including zoning intelligence)
    const marketScore = this.calculateMarketScores(apartmentMarket, demo, pipeline, zoning);
    
    // Determine confidence level
    const confidenceLevel = sourcesAvailable.length >= 4 ? 'HIGH' : 
                           sourcesAvailable.length >= 2 ? 'MEDIUM' : 'LOW';
    
    const report: MarketResearchReport = {
      deal_id: dealLocation.id,
      submarket_name: this.determineSubmarket(dealLocation),
      generated_at: new Date(),
      apartment_market: apartmentMarket || this.getEmptyApartmentData(),
      demographics: demo,
      market_events: events,
      supply_pipeline: pipeline,
      zoning_analysis: zoning,
      market_score: marketScore,
      data_quality: {
        sources_available: sourcesAvailable,
        sources_missing: sourcesMissing,
        confidence_level: confidenceLevel
      }
    };
    
    // Cache the report
    await this.cacheReport(report);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Market report generated in ${duration}ms with ${sourcesAvailable.length} sources`);
    
    return report;
  }
  
  // ============================================================
  // DATA SOURCE INTEGRATIONS
  // ============================================================
  
  /**
   * Fetch comprehensive apartment market data from Apartment Locator AI
   * This is the PRIMARY source for apartment market intelligence
   */
  private async fetchApartmentMarketData(location: DealLocation): Promise<any> {
    try {
      const response = await axios.get(`${DATA_SOURCES.APARTMENT_LOCATOR_AI}/properties/search`, {
        params: {
          latitude: location.latitude,
          longitude: location.longitude,
          radius: 3, // 3-mile radius
          limit: 50
        },
        timeout: 10000
      });
      
      const properties = response.data;
      
      // Aggregate ALL apartment market metrics
      return this.aggregateApartmentMetrics(properties, location);
      
    } catch (error: any) {
      console.error('❌ Failed to fetch apartment market data:', error.message);
      throw error;
    }
  }
  
  /**
   * Fetch demographics from Census API
   */
  private async fetchDemographics(location: DealLocation): Promise<any> {
    // TODO: Implement Census API integration
    // For now, return mock data structure
    return {
      population: 0,
      median_income: 0,
      population_growth_rate: 0,
      household_count: 0
    };
  }
  
  /**
   * Fetch market events from JEDI RE News Intelligence
   */
  private async fetchMarketEvents(location: DealLocation): Promise<any> {
    try {
      // Query internal news intelligence database
      const result = await pool.query(`
        SELECT 
          ne.id,
          ne.title,
          ne.event_type,
          ne.event_date,
          ne.source
        FROM news_events ne
        WHERE ST_DWithin(
          ne.location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          8000  -- 5 miles in meters
        )
        AND ne.event_date >= NOW() - INTERVAL '6 months'
        ORDER BY ne.event_date DESC
        LIMIT 20
      `, [location.longitude, location.latitude]);
      
      return {
        recent_developments: result.rows.filter(e => e.event_type === 'development'),
        employment_changes: result.rows.filter(e => e.event_type === 'employment'),
        major_announcements: result.rows.filter(e => e.event_type === 'announcement')
      };
      
    } catch (error: any) {
      console.error('❌ Failed to fetch market events:', error.message);
      throw error;
    }
  }
  
  /**
   * Fetch supply pipeline data (building permits, planned developments)
   */
  private async fetchSupplyPipeline(location: DealLocation): Promise<any> {
    // TODO: Integrate with building permit APIs or scrape permit data
    // For now, return structure
    return {
      units_under_construction: 0,
      units_permitted: 0,
      expected_delivery_timeline: 'Unknown'
    };
  }
  
  /**
   * Fetch zoning intelligence to predict future supply
   * Analyzes zoning data to forecast development potential
   */
  private async fetchZoningIntelligence(location: DealLocation): Promise<any> {
    try {
      // Query JEDI RE zoning database within 3-mile radius
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_parcels,
          SUM(CASE WHEN land_use = 'Vacant' THEN 1 ELSE 0 END) as vacant_parcels,
          SUM(CASE WHEN development_potential = 'Underutilized' THEN 1 ELSE 0 END) as underutilized_parcels,
          SUM(COALESCE(acres, 0)) as total_acres,
          AVG(COALESCE(allowed_density, 0)) as avg_density,
          MAX(COALESCE(allowed_density, 0)) as max_density,
          SUM(COALESCE(buildable_units, 0)) as theoretical_max_units
        FROM zoning_parcels
        WHERE ST_DWithin(
          geom::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          4800  -- 3 miles in meters
        )
        AND zoning_district LIKE '%R%'  -- Residential zoning only
      `, [location.longitude, location.latitude]);
      
      if (result.rows.length === 0 || !result.rows[0].total_parcels) {
        throw new Error('No zoning data available for this location');
      }
      
      const data = result.rows[0];
      
      // Calculate realistic buildable units (70% of theoretical max)
      const theoreticalMax = data.theoretical_max_units || 0;
      const realisticBuildable = Math.round(theoreticalMax * 0.7);
      
      // Determine rezoning likelihood based on current zoning patterns
      const vacantRatio = data.vacant_parcels / data.total_parcels;
      const rezoningLikelihood = 
        vacantRatio > 0.3 ? 'HIGH' :
        vacantRatio > 0.15 ? 'MEDIUM' : 'LOW';
      
      // Calculate development probability (0-100)
      let devProbability = 50; // Base
      if (vacantRatio > 0.2) devProbability += 20;
      if (data.avg_density > 20) devProbability += 15; // High density allowed
      if (data.underutilized_parcels > 5) devProbability += 15;
      devProbability = Math.min(100, devProbability);
      
      // Estimate years to saturation (based on typical development pace)
      const annualAbsorption = 200; // Typical annual unit absorption
      const yearsToSaturation = realisticBuildable > 0 ? 
        Math.round(realisticBuildable / annualAbsorption) : 0;
      
      // Future supply ratio (future units / existing units estimate)
      const existingUnitsEstimate = data.total_parcels * 50; // Rough estimate
      const futureSupplyRatio = existingUnitsEstimate > 0 ?
        realisticBuildable / existingUnitsEstimate : 0;
      
      // Determine future supply risk
      const futureSupplyRisk =
        futureSupplyRatio > 0.5 ? 'HIGH' :   // 50%+ future supply = high risk
        futureSupplyRatio > 0.25 ? 'MEDIUM' : // 25-50% = medium risk
        'LOW';                                 // <25% = low risk
      
      // Absorption capacity analysis
      const absorptionCapacity =
        futureSupplyRatio < 0.2 ? 'Market can easily absorb future supply' :
        futureSupplyRatio < 0.4 ? 'Moderate absorption capacity' :
        'High future supply may oversaturate market';
      
      return {
        // Developable Land
        vacant_parcels_count: data.vacant_parcels || 0,
        underutilized_parcels_count: data.underutilized_parcels || 0,
        total_developable_acres: Math.round(data.total_acres) || 0,
        
        // Development Potential
        max_allowed_density: Math.round(data.max_density) || 0,
        theoretical_max_units: theoreticalMax,
        realistic_buildable_units: realisticBuildable,
        
        // Probability Factors
        rezoning_likelihood: rezoningLikelihood,
        development_probability: devProbability,
        
        // Timeline
        estimated_years_to_saturation: yearsToSaturation,
        future_supply_risk: futureSupplyRisk,
        
        // Market Impact
        future_supply_ratio: Math.round(futureSupplyRatio * 100) / 100,
        absorption_capacity: absorptionCapacity
      };
      
    } catch (error: any) {
      console.error('❌ Failed to fetch zoning intelligence:', error.message);
      throw error;
    }
  }
  
  // ============================================================
  // DATA AGGREGATION & ANALYSIS
  // ============================================================
  
  /**
   * Aggregate comprehensive apartment market metrics from Apartment Locator AI
   * Captures ALL available market intelligence data
   */
  private aggregateApartmentMetrics(properties: any[], location: DealLocation): any {
    if (!properties || properties.length === 0) {
      return this.getEmptyApartmentData();
    }
    
    // Rent prices by bedroom type
    const byBedrooms: { [key: number]: number[] } = {
      0: [], 1: [], 2: [], 3: []
    };
    
    // Market performance tracking
    let totalOccupancy = 0;
    let occupancyCount = 0;
    let totalUnits = 0;
    let availableUnits = 0;
    
    // Property quality tracking
    let totalAge = 0;
    let ageCount = 0;
    const classDistribution = { A: 0, B: 0, C: 0, D: 0 };
    
    // Amenities tracking
    const amenitiesSet = new Set<string>();
    let totalAmenityCount = 0;
    let amenityPropertyCount = 0;
    
    // Concessions tracking
    let concessionsCount = 0;
    let totalConcessionValue = 0;
    let concessionValueCount = 0;
    
    // Process each property
    for (const prop of properties) {
      // Rent prices
      const avgPrice = (prop.min_price + prop.max_price) / 2;
      const bedrooms = prop.bedrooms_min || 0;
      if (byBedrooms[bedrooms]) {
        byBedrooms[bedrooms].push(avgPrice);
      }
      
      // Occupancy
      if (prop.occupancy_rate) {
        totalOccupancy += prop.occupancy_rate;
        occupancyCount++;
      }
      
      // Units inventory (estimate if not provided)
      const unitsEstimate = prop.units_count || 50;
      totalUnits += unitsEstimate;
      if (prop.occupancy_rate) {
        availableUnits += unitsEstimate * ((100 - prop.occupancy_rate) / 100);
      }
      
      // Property age
      if (prop.year_built) {
        const age = new Date().getFullYear() - prop.year_built;
        totalAge += age;
        ageCount++;
      }
      
      // Property class
      if (prop.property_class) {
        const propClass = prop.property_class.toUpperCase();
        if (propClass in classDistribution) {
          classDistribution[propClass as keyof typeof classDistribution]++;
        }
      }
      
      // Amenities
      if (prop.amenities && Array.isArray(prop.amenities)) {
        prop.amenities.forEach((amenity: string) => amenitiesSet.add(amenity));
        totalAmenityCount += prop.amenities.length;
        amenityPropertyCount++;
      }
      
      // Concessions
      if (prop.concessions && Array.isArray(prop.concessions) && prop.concessions.length > 0) {
        concessionsCount += prop.concessions.length;
        // Try to extract concession value if available
        prop.concessions.forEach((concession: any) => {
          if (concession.value) {
            totalConcessionValue += concession.value;
            concessionValueCount++;
          }
        });
      }
    }
    
    // Calculate averages
    const avgOccupancy = occupancyCount > 0 ? totalOccupancy / occupancyCount : null;
    const avgPropertyAge = ageCount > 0 ? Math.round(totalAge / ageCount) : null;
    const avgAmenityCount = amenityPropertyCount > 0 ? Math.round(totalAmenityCount / amenityPropertyCount) : null;
    const avgConcessionValue = concessionValueCount > 0 ? Math.round(totalConcessionValue / concessionValueCount) : null;
    
    // Market saturation (rough estimate based on available units)
    const marketSaturation = totalUnits > 0 ? Math.round((totalUnits / (totalUnits + availableUnits)) * 100) : 0;
    
    // Competition intensity
    const competitionIntensity = 
      properties.length < 5 ? 'LOW' :
      properties.length < 15 ? 'MEDIUM' : 'HIGH';
    
    // Property class mix percentages
    const totalClassified = classDistribution.A + classDistribution.B + classDistribution.C + classDistribution.D;
    const classMix = totalClassified > 0 ? {
      A: Math.round((classDistribution.A / totalClassified) * 100),
      B: Math.round((classDistribution.B / totalClassified) * 100),
      C: Math.round((classDistribution.C / totalClassified) * 100),
      D: Math.round((classDistribution.D / totalClassified) * 100)
    } : undefined;
    
    return {
      // Property Inventory
      properties_count: properties.length,
      total_units: totalUnits,
      available_units: Math.round(availableUnits),
      
      // Rent Prices
      avg_rent_studio: this.average(byBedrooms[0]),
      avg_rent_1br: this.average(byBedrooms[1]),
      avg_rent_2br: this.average(byBedrooms[2]),
      avg_rent_3br: this.average(byBedrooms[3]),
      
      // Market Performance
      avg_occupancy_rate: avgOccupancy,
      rent_growth_6mo: null, // TODO: Calculate from historical data
      rent_growth_12mo: null, // TODO: Calculate from historical data
      
      // Supply Metrics
      market_saturation: marketSaturation,
      competition_intensity: competitionIntensity,
      
      // Property Quality
      avg_property_age: avgPropertyAge,
      property_class_mix: classMix,
      
      // Amenities
      common_amenities: Array.from(amenitiesSet).slice(0, 10), // Top 10
      avg_amenity_count: avgAmenityCount,
      
      // Concessions
      active_concessions_count: concessionsCount,
      avg_concession_value: avgConcessionValue,
      
      // Comparables
      comparable_properties: properties.slice(0, 10) // Top 10 comps
    };
  }
  
  /**
   * Calculate overall market scores
   * Includes zoning intelligence for future supply risk assessment
   */
  private calculateMarketScores(apartmentData: any, demographics: any, pipeline: any, zoning: any): any {
    let demandStrength = 50; // Default neutral
    let supplyBalance = 50;
    
    // Demand strength from apartment market data
    if (apartmentData) {
      // Occupancy indicators
      if (apartmentData.avg_occupancy_rate && apartmentData.avg_occupancy_rate >= 95) {
        demandStrength += 20;
      } else if (apartmentData.avg_occupancy_rate && apartmentData.avg_occupancy_rate >= 90) {
        demandStrength += 10;
      }
      
      // Rent growth indicators
      if (apartmentData.rent_growth_12mo && apartmentData.rent_growth_12mo >= 5) {
        demandStrength += 15;
      } else if (apartmentData.rent_growth_12mo && apartmentData.rent_growth_12mo >= 3) {
        demandStrength += 10;
      }
      
      // Concessions as negative demand signal
      if (apartmentData.active_concessions_count > apartmentData.properties_count * 0.5) {
        demandStrength -= 10; // High concessions = weaker demand
      }
      
      // Low availability = strong demand
      if (apartmentData.available_units && apartmentData.total_units) {
        const availabilityRate = (apartmentData.available_units / apartmentData.total_units) * 100;
        if (availabilityRate < 5) {
          demandStrength += 10; // Very tight market
        }
      }
    }
    
    // Supply balance
    if (apartmentData && pipeline) {
      const existingUnits = apartmentData.total_units || (apartmentData.properties_count * 50);
      const pipelineUnits = pipeline.units_under_construction || 0;
      
      const supplyRatio = pipelineUnits / existingUnits;
      
      if (supplyRatio < 0.1) {
        supplyBalance = 80; // Undersupplied
      } else if (supplyRatio < 0.2) {
        supplyBalance = 60; // Balanced
      } else {
        supplyBalance = 40; // Oversupplied
      }
      
      // Also factor in market saturation from apartment data
      if (apartmentData.market_saturation) {
        if (apartmentData.market_saturation > 95) {
          supplyBalance -= 10; // Market is very saturated
        } else if (apartmentData.market_saturation < 85) {
          supplyBalance += 10; // Room to grow
        }
      }
    }
    
    // Future supply risk assessment (from zoning intelligence)
    let futureSupplyRisk = 50; // Default neutral
    
    if (zoning) {
      // Future supply ratio indicates risk
      if (zoning.future_supply_ratio > 0.5) {
        futureSupplyRisk = 75; // HIGH RISK: 50%+ future supply
        supplyBalance -= 15; // Also penalize current supply balance
      } else if (zoning.future_supply_ratio > 0.3) {
        futureSupplyRisk = 60; // MEDIUM RISK: 30-50% future supply
        supplyBalance -= 10;
      } else if (zoning.future_supply_ratio > 0.15) {
        futureSupplyRisk = 40; // LOW-MEDIUM RISK: 15-30% future supply
        supplyBalance -= 5;
      } else {
        futureSupplyRisk = 20; // LOW RISK: <15% future supply
        supplyBalance += 5; // Slight bonus for limited future competition
      }
      
      // Development probability affects risk
      if (zoning.development_probability > 70) {
        futureSupplyRisk += 10; // High probability of development = more risk
      }
      
      // Years to saturation affects urgency
      if (zoning.estimated_years_to_saturation < 3) {
        futureSupplyRisk += 10; // Fast saturation = higher risk
      } else if (zoning.estimated_years_to_saturation > 10) {
        futureSupplyRisk -= 10; // Slow saturation = lower risk
      }
    }
    
    // Overall opportunity (weighted average, adjusted for future risk)
    // Reduce opportunity score if future supply risk is high
    let overallOpportunity = Math.round((demandStrength * 0.5) + (supplyBalance * 0.35) + ((100 - futureSupplyRisk) * 0.15));
    
    return {
      demand_strength: Math.min(100, Math.max(0, Math.round(demandStrength))),
      supply_balance: Math.min(100, Math.max(0, Math.round(supplyBalance))),
      overall_opportunity: Math.min(100, Math.max(0, overallOpportunity)),
      future_supply_risk: Math.min(100, Math.max(0, Math.round(futureSupplyRisk)))
    };
  }
  
  // ============================================================
  // CACHING & PERSISTENCE
  // ============================================================
  
  /**
   * Cache market report in database
   */
  private async cacheReport(report: MarketResearchReport): Promise<void> {
    await pool.query(`
      INSERT INTO market_research_reports (
        deal_id, submarket_name, report_data, 
        generated_at, confidence_level
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (deal_id) 
      DO UPDATE SET
        report_data = EXCLUDED.report_data,
        generated_at = EXCLUDED.generated_at,
        confidence_level = EXCLUDED.confidence_level
    `, [
      report.deal_id,
      report.submarket_name,
      JSON.stringify(report),
      report.generated_at,
      report.data_quality.confidence_level
    ]);
  }
  
  /**
   * Get cached report if fresh enough
   */
  async getCachedReport(dealId: string, maxAgeHours: number = 24): Promise<MarketResearchReport | null> {
    const result = await pool.query(`
      SELECT report_data, generated_at
      FROM market_research_reports
      WHERE deal_id = $1
      AND generated_at >= NOW() - INTERVAL '${maxAgeHours} hours'
    `, [dealId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].report_data;
  }
  
  // ============================================================
  // UTILITIES
  // ============================================================
  
  private determineSubmarket(location: DealLocation): string {
    // TODO: Implement submarket determination logic
    // For now, use city
    return location.city || 'Unknown';
  }
  
  private getEmptyApartmentData(): any {
    return {
      properties_count: 0,
      total_units: 0,
      available_units: 0,
      avg_rent_studio: null,
      avg_rent_1br: null,
      avg_rent_2br: null,
      avg_rent_3br: null,
      avg_occupancy_rate: null,
      rent_growth_6mo: null,
      rent_growth_12mo: null,
      market_saturation: 0,
      competition_intensity: 'UNKNOWN',
      avg_property_age: null,
      property_class_mix: null,
      common_amenities: [],
      avg_amenity_count: null,
      active_concessions_count: 0,
      avg_concession_value: null,
      comparable_properties: []
    };
  }
  
  private average(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
  }
}

export default new MarketResearchEngine();
