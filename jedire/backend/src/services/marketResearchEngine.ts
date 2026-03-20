/**
 * JEDI RE Market Research Engine V2
 * User-Driven Risk Assessment with Real Metrics
 * 
 * Philosophy: Show real numbers, let users decide risk
 * 
 * Data Sources:
 * - Apartment Locator AI (PRIMARY APARTMENT MARKET DATA)
 * - Zoning Intelligence (FUTURE SUPPLY PREDICTION)
 * - News Intelligence (EMPLOYMENT IMPACT)
 * - Census API (demographics)
 * - Building Permits (pipeline supply)
 */

import axios from 'axios';
import { pool } from '../database';

const DATA_SOURCES = {
  APARTMENT_LOCATOR_AI: process.env.APARTMENT_LOCATOR_API_URL || 'http://localhost:3000/api',
  CENSUS_API: 'https://api.census.gov/data',
};

interface DealLocation {
  id: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  address: string;
}

interface EmploymentEvent {
  event: string;
  date: string;
  jobs_added: number;
  jobs_removed?: number;
  units_demand_generated: number;
  timeline: string;
  source: string;
}

interface MarketResearchReport {
  deal_id: string;
  submarket_name: string;
  generated_at: Date;
  
  // Supply Analysis (Real Numbers, Not Scores)
  supply_analysis: {
    // Current Market
    existing_properties: number;
    existing_total_units: number;
    available_units_now: number;
    availability_rate: number; // percentage
    
    // Near-term Pipeline (0-24 months)
    units_under_construction: number;
    units_permitted: number;
    near_term_pipeline_total: number;
    pipeline_ratio: number; // percentage of existing market
    
    // Future Supply (2-5 years) from Zoning
    vacant_parcels: number;
    underutilized_parcels: number;
    developable_acres: number;
    realistic_buildable_units: number; // KEY METRIC
    theoretical_max_units: number;
    future_supply_ratio: number; // percentage vs existing
    
    // Timeline
    estimated_years_to_buildout: number;
    annual_absorption_rate: number;
    
    // Context
    development_probability: number; // 0-100
    rezoning_likelihood: 'LOW' | 'MEDIUM' | 'HIGH';
    market_size_multiplier: number; // total future / existing
  };
  
  // Demand Indicators (Market Health)
  demand_indicators: {
    // Occupancy
    avg_occupancy_rate: number | null;
    occupancy_trend: 'UP' | 'STABLE' | 'DOWN' | 'UNKNOWN';
    
    // Pricing
    avg_rent_studio: number | null;
    avg_rent_1br: number | null;
    avg_rent_2br: number | null;
    avg_rent_3br: number | null;
    rent_growth_6mo: number | null;
    rent_growth_12mo: number | null;
    rent_growth_trend: 'ACCELERATING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';
    
    // Competition
    properties_in_market: number;
    competitive_pressure: 'LOW' | 'MEDIUM' | 'HIGH';
    
    // Concessions (weakness signal)
    properties_with_concessions: number;
    concession_rate: number; // percentage
    avg_concession_value: number | null;
    
    // Market Stress Signals
    stress_signals: string[];
  };
  
  // Per Capita Analysis
  per_capita: {
    // Population Context
    population: number;
    household_count: number;
    avg_household_size: number;
    
    // Current Density
    units_per_1000_people: number;
    units_per_100_households: number;
    
    // With Pipeline
    units_per_1000_with_pipeline: number;
    units_per_100_hh_with_pipeline: number;
    
    // Fully Built
    units_per_1000_fully_built: number;
    units_per_100_hh_fully_built: number;
    
    // Benchmarks
    benchmarks: {
      national_avg: number;
      urban_markets: number;
      suburban_markets: number;
      this_market_category: 'urban' | 'suburban' | 'rural';
    };
    
    // Capacity Assessment
    current_vs_benchmark: number; // percentage
    future_vs_benchmark: number; // percentage
    
    // Affordability
    median_income: number;
    avg_rent_annual: number;
    rent_to_income_ratio: number; // percentage
    affordable_rent_30pct: number;
    market_affordability: 'AFFORDABLE' | 'STRETCHED' | 'EXPENSIVE';
  };
  
  // Employment Impact (Jobs-to-Housing)
  employment_impact: {
    // Current Employment
    total_jobs_in_market: number;
    labor_force_participation: number; // percentage
    
    // Jobs-to-Housing Ratios
    jobs_per_unit: number;
    units_per_100_jobs: number;
    jobs_per_unit_fully_built: number;
    units_per_100_jobs_fully_built: number;
    
    // Multiplier
    jobs_to_units_multiplier: number; // default 0.45
    
    // Benchmarks
    benchmarks: {
      balanced_jobs_per_unit: number;
      jobs_rich_market: number;
      housing_rich_market: number;
    };
    
    // News Impact
    recent_employment_changes: EmploymentEvent[];
    total_jobs_from_news: number;
    total_units_demand_from_news: number;
    demand_absorption_vs_pipeline: number; // percentage
    demand_absorption_vs_future: number; // percentage
    
    // Verdict
    employment_verdict: string;
    demand_supply_balance: 'FAVORABLE' | 'BALANCED' | 'UNFAVORABLE';
  };
  
  // Market Capacity
  market_capacity: {
    current_market_units: number;
    total_future_supply: number;
    current_absorption_rate: number;
    years_to_absorb_pipeline: number;
    years_to_absorb_all: number;
    market_size_multiplier: number;
    saturation_year: number;
    capacity_assessment: string;
    undersupplied_today: boolean;
    oversupplied_future: boolean;
  };
  
  // Optional: Calculated Insights (legacy scores for reference)
  calculated_insights?: {
    demand_strength_score: number; // 0-100
    supply_balance_score: number; // 0-100
    overall_opportunity_score: number; // 0-100
  };
  
  // Data Quality
  data_quality: {
    sources_available: string[];
    sources_missing: string[];
    confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export class MarketResearchEngine {
  
  private JOBS_TO_UNITS_MULTIPLIER = 0.45; // Configurable per market
  
  /**
   * Main entry point: Generate comprehensive market research V2
   */
  async generateMarketReport(dealLocation: DealLocation): Promise<MarketResearchReport> {
    console.log(`🧠 Generating Market Research V2 for deal ${dealLocation.id}`);
    
    const startTime = Date.now();
    const sourcesAvailable: string[] = [];
    const sourcesMissing: string[] = [];
    
    // Parallel data fetching
    const [
      apartmentData,
      demographics,
      employmentNews,
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
      this.fetchEmploymentNews(dealLocation).catch(err => {
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
    
    // Extract results
    const apartmentMarket = apartmentData.status === 'fulfilled' ? apartmentData.value : null;
    const demo = demographics.status === 'fulfilled' ? demographics.value : null;
    const empNews = employmentNews.status === 'fulfilled' ? employmentNews.value : null;
    const pipeline = supplyPipeline.status === 'fulfilled' ? supplyPipeline.value : null;
    const zoning = zoningAnalysis.status === 'fulfilled' ? zoningAnalysis.value : null;
    
    // Track sources
    if (apartmentMarket) sourcesAvailable.push('Apartment Locator AI');
    if (demo) sourcesAvailable.push('Census API');
    if (empNews) sourcesAvailable.push('News Intelligence');
    if (pipeline) sourcesAvailable.push('Building Permits');
    if (zoning) sourcesAvailable.push('Zoning Intelligence');
    
    // Build V2 Report Structure
    const report: MarketResearchReport = {
      deal_id: dealLocation.id,
      submarket_name: this.determineSubmarket(dealLocation),
      generated_at: new Date(),
      
      supply_analysis: this.buildSupplyAnalysis(apartmentMarket, pipeline, zoning),
      demand_indicators: this.buildDemandIndicators(apartmentMarket),
      per_capita: this.buildPerCapitaAnalysis(apartmentMarket, demo, pipeline, zoning),
      employment_impact: this.buildEmploymentImpact(demo, empNews, apartmentMarket, pipeline, zoning),
      market_capacity: this.buildMarketCapacity(apartmentMarket, pipeline, zoning, demo),
      
      // Optional legacy scores
      calculated_insights: this.calculateLegacyScores(apartmentMarket, demo, pipeline, zoning),
      
      data_quality: {
        sources_available: sourcesAvailable,
        sources_missing: sourcesMissing,
        confidence_level: sourcesAvailable.length >= 4 ? 'HIGH' : 
                         sourcesAvailable.length >= 2 ? 'MEDIUM' : 'LOW'
      }
    };
    
    // Cache the report
    await this.cacheReport(report);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Market Research V2 generated in ${duration}ms with ${sourcesAvailable.length} sources`);
    
    return report;
  }
  
  // ============================================================
  // V2 REPORT BUILDERS
  // ============================================================
  
  private buildSupplyAnalysis(apartmentData: any, pipeline: any, zoning: any): any {
    const existingUnits = apartmentData?.total_units || 0;
    const pipelineUnits = (pipeline?.units_under_construction || 0) + (pipeline?.units_permitted || 0);
    const futureUnits = zoning?.realistic_buildable_units || 0;
    
    const pipelineRatio = existingUnits > 0 ? (pipelineUnits / existingUnits) * 100 : 0;
    const futureSupplyRatio = existingUnits > 0 ? (futureUnits / existingUnits) * 100 : 0;
    
    const totalFutureSupply = pipelineUnits + futureUnits;
    const marketMultiplier = existingUnits > 0 ? (existingUnits + totalFutureSupply) / existingUnits : 0;
    
    const absorptionRate = apartmentData?.properties_count ? apartmentData.properties_count * 10 : 200;
    const yearsToAbsorb = futureUnits > 0 ? futureUnits / absorptionRate : 0;
    
    return {
      existing_properties: apartmentData?.properties_count || 0,
      existing_total_units: existingUnits,
      available_units_now: apartmentData?.available_units || 0,
      availability_rate: existingUnits > 0 ? ((apartmentData?.available_units || 0) / existingUnits) * 100 : 0,
      
      units_under_construction: pipeline?.units_under_construction || 0,
      units_permitted: pipeline?.units_permitted || 0,
      near_term_pipeline_total: pipelineUnits,
      pipeline_ratio: Math.round(pipelineRatio * 10) / 10,
      
      vacant_parcels: zoning?.vacant_parcels_count || 0,
      underutilized_parcels: zoning?.underutilized_parcels_count || 0,
      developable_acres: zoning?.total_developable_acres || 0,
      realistic_buildable_units: futureUnits,
      theoretical_max_units: zoning?.theoretical_max_units || 0,
      future_supply_ratio: Math.round(futureSupplyRatio * 10) / 10,
      
      estimated_years_to_buildout: Math.round(yearsToAbsorb * 10) / 10,
      annual_absorption_rate: Math.round(absorptionRate),
      
      development_probability: zoning?.development_probability || 0,
      rezoning_likelihood: zoning?.rezoning_likelihood || 'UNKNOWN',
      market_size_multiplier: Math.round(marketMultiplier * 10) / 10
    };
  }
  
  private buildDemandIndicators(apartmentData: any): any {
    const propertiesWithConcessions = apartmentData?.active_concessions_count || 0;
    const totalProperties = apartmentData?.properties_count || 1;
    const concessionRate = (propertiesWithConcessions / totalProperties) * 100;
    
    const stressSignals: string[] = [];
    if (concessionRate > 20) {
      stressSignals.push(`High concession rate (${Math.round(concessionRate)}%)`);
    }
    if (apartmentData?.rent_growth_12mo && apartmentData.rent_growth_12mo > 8) {
      stressSignals.push('Aggressive rent growth may not be sustainable');
    }
    if (apartmentData?.avg_occupancy_rate && apartmentData.avg_occupancy_rate < 90) {
      stressSignals.push(`Low occupancy (${apartmentData.avg_occupancy_rate}%)`);
    }
    
    return {
      avg_occupancy_rate: apartmentData?.avg_occupancy_rate || null,
      occupancy_trend: 'UNKNOWN', // TODO: Calculate from historical
      
      avg_rent_studio: apartmentData?.avg_rent_studio || null,
      avg_rent_1br: apartmentData?.avg_rent_1br || null,
      avg_rent_2br: apartmentData?.avg_rent_2br || null,
      avg_rent_3br: apartmentData?.avg_rent_3br || null,
      rent_growth_6mo: apartmentData?.rent_growth_6mo || null,
      rent_growth_12mo: apartmentData?.rent_growth_12mo || null,
      rent_growth_trend: 'UNKNOWN', // TODO: Calculate
      
      properties_in_market: totalProperties,
      competitive_pressure: totalProperties < 5 ? 'LOW' : totalProperties < 15 ? 'MEDIUM' : 'HIGH',
      
      properties_with_concessions: propertiesWithConcessions,
      concession_rate: Math.round(concessionRate * 10) / 10,
      avg_concession_value: apartmentData?.avg_concession_value || null,
      
      stress_signals: stressSignals
    };
  }
  
  private buildPerCapitaAnalysis(apartmentData: any, demographics: any, pipeline: any, zoning: any): any {
    const population = demographics?.population || 0;
    const medianIncome = demographics?.median_income || 0;
    const householdCount = demographics?.household_count || Math.round(population / 2.7);
    const avgHouseholdSize = population > 0 ? population / householdCount : 2.7;
    
    const existingUnits = apartmentData?.total_units || 0;
    const pipelineUnits = (pipeline?.units_under_construction || 0) + (pipeline?.units_permitted || 0);
    const futureUnits = zoning?.realistic_buildable_units || 0;
    const totalUnitsWithPipeline = existingUnits + pipelineUnits;
    const totalUnitsFullyBuilt = existingUnits + pipelineUnits + futureUnits;
    
    const unitsPer1000 = population > 0 ? (existingUnits / population) * 1000 : 0;
    const unitsPer1000Pipeline = population > 0 ? (totalUnitsWithPipeline / population) * 1000 : 0;
    const unitsPer1000Built = population > 0 ? (totalUnitsFullyBuilt / population) * 1000 : 0;
    
    const unitsPer100HH = householdCount > 0 ? (existingUnits / householdCount) * 100 : 0;
    const unitsPer100HHPipeline = householdCount > 0 ? (totalUnitsWithPipeline / householdCount) * 100 : 0;
    const unitsPer100HHBuilt = householdCount > 0 ? (totalUnitsFullyBuilt / householdCount) * 100 : 0;
    
    // Determine market category based on population density
    const marketCategory = population > 100000 ? 'urban' : population > 30000 ? 'suburban' : 'rural';
    const suburbanBenchmark = 28.3;
    
    const currentVsBenchmark = suburbanBenchmark > 0 ? ((unitsPer1000 - suburbanBenchmark) / suburbanBenchmark) * 100 : 0;
    const futureVsBenchmark = suburbanBenchmark > 0 ? ((unitsPer1000Built - suburbanBenchmark) / suburbanBenchmark) * 100 : 0;
    
    const avgRent = apartmentData?.avg_rent_1br || apartmentData?.avg_rent_2br || 0;
    const avgRentAnnual = avgRent * 12;
    const rentToIncome = medianIncome > 0 ? (avgRentAnnual / medianIncome) * 100 : 0;
    const affordableRent = medianIncome * 0.30;
    
    const affordability = rentToIncome < 25 ? 'AFFORDABLE' : rentToIncome < 30 ? 'AFFORDABLE' : rentToIncome < 35 ? 'STRETCHED' : 'EXPENSIVE';
    
    return {
      population,
      household_count: householdCount,
      avg_household_size: Math.round(avgHouseholdSize * 10) / 10,
      
      units_per_1000_people: Math.round(unitsPer1000 * 10) / 10,
      units_per_100_households: Math.round(unitsPer100HH * 10) / 10,
      
      units_per_1000_with_pipeline: Math.round(unitsPer1000Pipeline * 10) / 10,
      units_per_100_hh_with_pipeline: Math.round(unitsPer100HHPipeline * 10) / 10,
      
      units_per_1000_fully_built: Math.round(unitsPer1000Built * 10) / 10,
      units_per_100_hh_fully_built: Math.round(unitsPer100HHBuilt * 10) / 10,
      
      benchmarks: {
        national_avg: 35.5,
        urban_markets: 45.2,
        suburban_markets: 28.3,
        this_market_category: marketCategory
      },
      
      current_vs_benchmark: Math.round(currentVsBenchmark),
      future_vs_benchmark: Math.round(futureVsBenchmark),
      
      median_income: medianIncome,
      avg_rent_annual: Math.round(avgRentAnnual),
      rent_to_income_ratio: Math.round(rentToIncome * 10) / 10,
      affordable_rent_30pct: Math.round(affordableRent),
      market_affordability: affordability
    };
  }
  
  private buildEmploymentImpact(demographics: any, employmentNews: any, apartmentData: any, pipeline: any, zoning: any): any {
    const population = demographics?.population || 0;
    const totalJobs = Math.round(population * 0.57); // 57% labor force participation
    
    const existingUnits = apartmentData?.total_units || 1;
    const pipelineUnits = (pipeline?.units_under_construction || 0) + (pipeline?.units_permitted || 0);
    const futureUnits = zoning?.realistic_buildable_units || 0;
    const totalUnitsFullyBuilt = existingUnits + pipelineUnits + futureUnits;
    
    const jobsPerUnit = totalJobs / existingUnits;
    const unitsPer100Jobs = (existingUnits / totalJobs) * 100;
    const jobsPerUnitBuilt = totalJobs / totalUnitsFullyBuilt;
    const unitsPer100JobsBuilt = (totalUnitsFullyBuilt / totalJobs) * 100;
    
    // Process employment news
    const employmentEvents: EmploymentEvent[] = employmentNews || [];
    let totalJobsChange = 0;
    
    for (const event of employmentEvents) {
      totalJobsChange += (event.jobs_added || 0) - (event.jobs_removed || 0);
    }
    
    const totalUnitsDemand = Math.round(totalJobsChange * this.JOBS_TO_UNITS_MULTIPLIER);
    const demandVsPipeline = pipelineUnits > 0 ? (totalUnitsDemand / pipelineUnits) * 100 : 0;
    const demandVsFuture = (pipelineUnits + futureUnits) > 0 ? (totalUnitsDemand / (pipelineUnits + futureUnits)) * 100 : 0;
    
    let verdict = 'NO EMPLOYMENT DATA';
    let balance: 'FAVORABLE' | 'BALANCED' | 'UNFAVORABLE' = 'BALANCED';
    
    if (totalJobsChange > 0) {
      if (demandVsFuture > 100) {
        verdict = `STRONG DEMAND - New jobs (${totalJobsChange}) generate ${totalUnitsDemand} units demand, exceeds future supply`;
        balance = 'FAVORABLE';
      } else if (demandVsFuture > 50) {
        verdict = `MODERATE DEMAND - New jobs (${totalJobsChange}) generate ${totalUnitsDemand} units demand, covers ${Math.round(demandVsFuture)}% of supply`;
        balance = 'BALANCED';
      } else {
        verdict = `WEAK DEMAND - New jobs (${totalJobsChange}) only generate ${totalUnitsDemand} units demand`;
        balance = 'UNFAVORABLE';
      }
    }
    
    return {
      total_jobs_in_market: totalJobs,
      labor_force_participation: 57,
      
      jobs_per_unit: Math.round(jobsPerUnit * 10) / 10,
      units_per_100_jobs: Math.round(unitsPer100Jobs * 10) / 10,
      jobs_per_unit_fully_built: Math.round(jobsPerUnitBuilt * 10) / 10,
      units_per_100_jobs_fully_built: Math.round(unitsPer100JobsBuilt * 10) / 10,
      
      jobs_to_units_multiplier: this.JOBS_TO_UNITS_MULTIPLIER,
      
      benchmarks: {
        balanced_jobs_per_unit: 1.5,
        jobs_rich_market: 2.5,
        housing_rich_market: 1.0
      },
      
      recent_employment_changes: employmentEvents,
      total_jobs_from_news: totalJobsChange,
      total_units_demand_from_news: totalUnitsDemand,
      demand_absorption_vs_pipeline: Math.round(demandVsPipeline),
      demand_absorption_vs_future: Math.round(demandVsFuture),
      
      employment_verdict: verdict,
      demand_supply_balance: balance
    };
  }
  
  private buildMarketCapacity(apartmentData: any, pipeline: any, zoning: any, demographics: any): any {
    const existingUnits = apartmentData?.total_units || 0;
    const pipelineUnits = (pipeline?.units_under_construction || 0) + (pipeline?.units_permitted || 0);
    const futureUnits = zoning?.realistic_buildable_units || 0;
    const totalFutureSupply = pipelineUnits + futureUnits;
    
    const absorptionRate = apartmentData?.properties_count ? apartmentData.properties_count * 10 : 200;
    const yearsToAbsorbPipeline = pipelineUnits > 0 ? pipelineUnits / absorptionRate : 0;
    const yearsToAbsorbAll = totalFutureSupply > 0 ? totalFutureSupply / absorptionRate : 0;
    
    const marketMultiplier = existingUnits > 0 ? (existingUnits + totalFutureSupply) / existingUnits : 0;
    const currentYear = new Date().getFullYear();
    const saturationYear = currentYear + Math.round(yearsToAbsorbAll);
    
    const population = demographics?.population || 0;
    const unitsPer1000Built = population > 0 ? ((existingUnits + totalFutureSupply) / population) * 1000 : 0;
    const suburbanBenchmark = 28.3;
    
    const undersuppliedToday = unitsPer1000Built < suburbanBenchmark;
    const oversuppliedFuture = unitsPer1000Built > suburbanBenchmark * 1.5;
    
    let assessment = 'BALANCED MARKET';
    if (marketMultiplier > 3) {
      assessment = `HIGH RISK - Future supply (${Math.round(unitsPer1000Built)} units/1000) exceeds benchmark by ${Math.round(((unitsPer1000Built - suburbanBenchmark) / suburbanBenchmark) * 100)}%`;
    } else if (marketMultiplier > 2) {
      assessment = `MODERATE RISK - Market will grow ${Math.round(marketMultiplier)}x`;
    } else {
      assessment = `LOW RISK - Controlled growth (${Math.round(marketMultiplier)}x)`;
    }
    
    return {
      current_market_units: existingUnits,
      total_future_supply: totalFutureSupply,
      current_absorption_rate: absorptionRate,
      years_to_absorb_pipeline: Math.round(yearsToAbsorbPipeline * 10) / 10,
      years_to_absorb_all: Math.round(yearsToAbsorbAll * 10) / 10,
      market_size_multiplier: Math.round(marketMultiplier * 10) / 10,
      saturation_year: saturationYear,
      capacity_assessment: assessment,
      undersupplied_today: undersuppliedToday,
      oversupplied_future: oversuppliedFuture
    };
  }
  
  private calculateLegacyScores(apartmentData: any, demographics: any, pipeline: any, zoning: any): any {
    // Legacy 0-100 scores for reference (optional)
    let demandStrength = 50;
    let supplyBalance = 50;
    
    if (apartmentData?.avg_occupancy_rate >= 95) demandStrength += 20;
    if (apartmentData?.rent_growth_12mo >= 5) demandStrength += 15;
    
    const existingUnits = apartmentData?.total_units || 1;
    const pipelineUnits = (pipeline?.units_under_construction || 0) + (pipeline?.units_permitted || 0);
    const supplyRatio = pipelineUnits / existingUnits;
    
    if (supplyRatio < 0.1) supplyBalance = 80;
    else if (supplyRatio < 0.2) supplyBalance = 60;
    else supplyBalance = 40;
    
    const overall = Math.round((demandStrength * 0.6) + (supplyBalance * 0.4));
    
    return {
      demand_strength_score: Math.min(100, Math.max(0, Math.round(demandStrength))),
      supply_balance_score: Math.min(100, Math.max(0, Math.round(supplyBalance))),
      overall_opportunity_score: Math.min(100, Math.max(0, overall))
    };
  }
  
  // ============================================================
  // DATA SOURCE FETCHERS
  // ============================================================
  
  private async fetchApartmentMarketData(location: DealLocation): Promise<any> {
    try {
      const response = await axios.get(`${DATA_SOURCES.APARTMENT_LOCATOR_AI}/properties/search`, {
        params: {
          latitude: location.latitude,
          longitude: location.longitude,
          radius: 3,
          limit: 50
        },
        timeout: 10000
      });
      
      return this.aggregateApartmentMetrics(response.data);
      
    } catch (error: any) {
      console.error('❌ Apartment market data fetch failed:', error.message);
      throw error;
    }
  }
  
  private async fetchDemographics(location: DealLocation): Promise<any> {
    // TODO: Implement Census API integration
    return {
      population: 0,
      median_income: 0,
      household_count: 0
    };
  }
  
  private async fetchEmploymentNews(location: DealLocation): Promise<EmploymentEvent[]> {
    try {
      // Query News Intelligence for employment events
      const result = await pool.query(`
        SELECT 
          ne.title as event,
          ne.event_date as date,
          ne.metadata
        FROM news_events ne
        WHERE ST_DWithin(
          ne.location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          8000
        )
        AND ne.event_type = 'employment'
        AND ne.event_date >= NOW() - INTERVAL '12 months'
        ORDER BY ne.event_date DESC
        LIMIT 20
      `, [location.longitude, location.latitude]);
      
      // Transform to employment events with job counts
      return result.rows.map(row => {
        const jobsAdded = row.metadata?.jobs_added || 0;
        const jobsRemoved = row.metadata?.jobs_removed || 0;
        const netJobs = jobsAdded - jobsRemoved;
        
        return {
          event: row.event,
          date: row.date,
          jobs_added: jobsAdded,
          jobs_removed: jobsRemoved,
          units_demand_generated: Math.round(netJobs * this.JOBS_TO_UNITS_MULTIPLIER),
          timeline: '12-18 months',
          source: 'News Intelligence'
        };
      });
      
    } catch (error: any) {
      console.error('❌ Employment news fetch failed:', error.message);
      throw error;
    }
  }
  
  private async fetchSupplyPipeline(location: DealLocation): Promise<any> {
    // TODO: Integrate building permits API
    return {
      units_under_construction: 0,
      units_permitted: 0
    };
  }
  
  private async fetchZoningIntelligence(location: DealLocation): Promise<any> {
    try {
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
          4800
        )
        AND zoning_district LIKE '%R%'
      `, [location.longitude, location.latitude]);
      
      if (result.rows.length === 0 || !result.rows[0].total_parcels) {
        throw new Error('No zoning data available');
      }
      
      const data = result.rows[0];
      const theoreticalMax = data.theoretical_max_units || 0;
      const realisticBuildable = Math.round(theoreticalMax * 0.7);
      
      const vacantRatio = data.vacant_parcels / data.total_parcels;
      const rezoningLikelihood = vacantRatio > 0.3 ? 'HIGH' : vacantRatio > 0.15 ? 'MEDIUM' : 'LOW';
      
      let devProbability = 50;
      if (vacantRatio > 0.2) devProbability += 20;
      if (data.avg_density > 20) devProbability += 15;
      devProbability = Math.min(100, devProbability);
      
      return {
        vacant_parcels_count: data.vacant_parcels || 0,
        underutilized_parcels_count: data.underutilized_parcels || 0,
        total_developable_acres: Math.round(data.total_acres) || 0,
        max_allowed_density: Math.round(data.max_density) || 0,
        theoretical_max_units: theoreticalMax,
        realistic_buildable_units: realisticBuildable,
        rezoning_likelihood: rezoningLikelihood,
        development_probability: devProbability
      };
      
    } catch (error: any) {
      console.error('❌ Zoning intelligence fetch failed:', error.message);
      throw error;
    }
  }
  
  private aggregateApartmentMetrics(properties: any[]): any {
    if (!properties || properties.length === 0) {
      return {
        properties_count: 0,
        total_units: 0,
        available_units: 0
      };
    }
    
    let totalUnits = 0;
    let availableUnits = 0;
    let concessionsCount = 0;
    
    const rentsByBedroom: { [key: number]: number[] } = { 0: [], 1: [], 2: [], 3: [] };
    
    for (const prop of properties) {
      const units = prop.units_count || 50;
      totalUnits += units;
      
      if (prop.occupancy_rate) {
        availableUnits += units * ((100 - prop.occupancy_rate) / 100);
      }
      
      if (prop.concessions && prop.concessions.length > 0) {
        concessionsCount += prop.concessions.length;
      }
      
      const avgPrice = (prop.min_price + prop.max_price) / 2;
      const bedrooms = prop.bedrooms_min || 0;
      if (rentsByBedroom[bedrooms]) {
        rentsByBedroom[bedrooms].push(avgPrice);
      }
    }
    
    return {
      properties_count: properties.length,
      total_units: totalUnits,
      available_units: Math.round(availableUnits),
      avg_rent_studio: this.average(rentsByBedroom[0]),
      avg_rent_1br: this.average(rentsByBedroom[1]),
      avg_rent_2br: this.average(rentsByBedroom[2]),
      avg_rent_3br: this.average(rentsByBedroom[3]),
      active_concessions_count: concessionsCount,
      avg_occupancy_rate: null, // TODO: Calculate
      rent_growth_6mo: null,
      rent_growth_12mo: null
    };
  }
  
  // ============================================================
  // CACHING & PERSISTENCE
  // ============================================================
  
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
  
  async getCachedReport(dealId: string, maxAgeHours: number = 24): Promise<MarketResearchReport | null> {
    const result = await pool.query(`
      SELECT report_data
      FROM market_research_reports
      WHERE deal_id = $1
      AND generated_at >= NOW() - INTERVAL '${maxAgeHours} hours'
    `, [dealId]);
    
    return result.rows.length > 0 ? result.rows[0].report_data : null;
  }
  
  // ============================================================
  // UTILITIES
  // ============================================================
  
  private determineSubmarket(location: DealLocation): string {
    return location.city || 'Unknown';
  }
  
  private average(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
  }
}

export default new MarketResearchEngine();
