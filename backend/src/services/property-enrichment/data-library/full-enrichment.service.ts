/**
 * Full Data Library Enrichment Service
 * 
 * Connects Data Library assets to the COMPLETE data matrix:
 * 
 * 1. Property Info (Municipal APIs) - year built, units, SF, zoning, owner
 * 2. Rent Data (Apartment Locator) - unit mix, asking rents, occupancy
 * 3. Proximity Context - transit, grocery, employers, schools, crime
 * 4. Market Events - upcoming impacts, supply pipeline, risk factors
 * 5. Historical Validation - similar deals performance, backtest context
 * 6. Sales Comps - recent transactions, price/unit trends
 * 
 * This is the "brain" that connects all neural pathways to deal analysis.
 */

import { Pool } from 'pg';
import { DataLibraryAsset, EnrichmentResult, getDataLibraryAutoEnrichmentService } from './auto-enrichment.service';
import { getProximityService, ProximityScores } from '../../proximity/proximity.service';
import { getMarketEventsService, MarketEvent } from '../../proximity/events.service';
import { getBacktestService } from '../../proximity/backtest.service';

export interface FullEnrichmentResult extends EnrichmentResult {
  // Extended data from proximity layer
  proximity?: {
    scores: ProximityScores;
    transitGrade: string;
    groceryGrade: string;
    schoolGrade: string;
    safetyGrade: string;
    estimatedPremiumPct: number;
    highlights: string[];
    concerns: string[];
  };
  
  // Market events context
  events?: {
    upcomingPositive: number;
    upcomingNegative: number;
    supplyPipelineUnits: number;
    netSentiment: 'bullish' | 'bearish' | 'neutral';
    keyEvents: Array<{
      name: string;
      type: string;
      date: string;
      impact: string;
    }>;
    riskFactors: string[];
    opportunities: string[];
  };
  
  // Historical validation
  backtest?: {
    sampleSize: number;
    avgActualIrr: number;
    irrAccuracyPct: number;
    outperformanceRate: number;
    keyDrivers: Array<{
      factor: string;
      impact: 'positive' | 'negative';
      frequency: number;
    }>;
    confidenceLevel: 'high' | 'medium' | 'low';
    insights: string[];
  };
  
  // Sales comps
  salesComps?: {
    recentTransactions: number;
    avgPricePerUnit: number;
    avgPricePerSF: number;
    avgCapRate: number;
    pricePerUnitTrend: 'increasing' | 'stable' | 'decreasing';
  };
  
  // Unified quality score
  overallDataQualityScore: number;
  readinessForUnderwriting: 'ready' | 'partial' | 'insufficient';
  missingCriticalData: string[];
}

export interface FullEnrichmentConfig {
  // What to enrich
  enrichPropertyInfo: boolean;
  enrichRentData: boolean;
  enrichProximity: boolean;
  enrichEvents: boolean;
  enrichBacktest: boolean;
  enrichSalesComps: boolean;
  
  // Geography params
  searchRadiusMiles: number;
  lookAheadMonths: number;
  
  // Conflict handling
  overwriteExisting: boolean;
  requireConfirmation: boolean;
}

const DEFAULT_CONFIG: FullEnrichmentConfig = {
  enrichPropertyInfo: true,
  enrichRentData: true,
  enrichProximity: true,
  enrichEvents: true,
  enrichBacktest: true,
  enrichSalesComps: true,
  searchRadiusMiles: 5,
  lookAheadMonths: 24,
  overwriteExisting: false,
  requireConfirmation: true
};

export class FullEnrichmentService {
  private pool: Pool;
  private autoEnrichment = getDataLibraryAutoEnrichmentService();
  
  constructor(pool: Pool) {
    this.pool = pool;
  }
  
  /**
   * Fully enrich a Data Library asset from all data sources
   */
  async enrichAsset(
    asset: DataLibraryAsset,
    config: Partial<FullEnrichmentConfig> = {}
  ): Promise<FullEnrichmentResult> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    
    console.log(`[FullEnrichment] Starting enrichment for ${asset.propertyName || asset.address}`);
    
    // Step 1: Basic enrichment (property info + rent data)
    const baseResult = await this.autoEnrichment.enrichAsset(asset, {
      enrichPropertyInfo: cfg.enrichPropertyInfo,
      enrichRentData: cfg.enrichRentData,
      overwriteExisting: cfg.overwriteExisting,
      requireConfirmation: cfg.requireConfirmation
    });
    
    const result: FullEnrichmentResult = {
      ...baseResult,
      overallDataQualityScore: baseResult.newScore,
      readinessForUnderwriting: 'insufficient',
      missingCriticalData: [...baseResult.fieldsStillMissing]
    };
    
    // Need coordinates for proximity/events
    const coordinates = await this.getCoordinates(asset);
    
    if (!coordinates) {
      console.warn('[FullEnrichment] No coordinates available, skipping spatial enrichment');
      return this.finalizeResult(result, asset);
    }
    
    // Step 2: Proximity enrichment
    if (cfg.enrichProximity) {
      try {
        result.proximity = await this.enrichProximity(
          coordinates.lat,
          coordinates.lng,
          asset.address
        );
        console.log(`[FullEnrichment] Proximity: ${result.proximity.transitGrade} transit, ${result.proximity.estimatedPremiumPct}% premium`);
      } catch (error) {
        console.error('[FullEnrichment] Proximity enrichment failed:', error);
      }
    }
    
    // Step 3: Events enrichment
    if (cfg.enrichEvents) {
      try {
        result.events = await this.enrichEvents(
          coordinates.lat,
          coordinates.lng,
          cfg.searchRadiusMiles,
          cfg.lookAheadMonths
        );
        console.log(`[FullEnrichment] Events: ${result.events.netSentiment}, ${result.events.supplyPipelineUnits} units in pipeline`);
      } catch (error) {
        console.error('[FullEnrichment] Events enrichment failed:', error);
      }
    }
    
    // Step 4: Backtest context
    if (cfg.enrichBacktest) {
      try {
        result.backtest = await this.enrichBacktest(asset);
        console.log(`[FullEnrichment] Backtest: ${result.backtest.sampleSize} similar deals, ${result.backtest.confidenceLevel} confidence`);
      } catch (error) {
        console.error('[FullEnrichment] Backtest enrichment failed:', error);
      }
    }
    
    // Step 5: Sales comps
    if (cfg.enrichSalesComps) {
      try {
        result.salesComps = await this.enrichSalesComps(
          asset.county || '',
          asset.state || '',
          coordinates.lat,
          coordinates.lng,
          cfg.searchRadiusMiles
        );
        console.log(`[FullEnrichment] Sales: ${result.salesComps.recentTransactions} comps, $${result.salesComps.avgPricePerUnit?.toLocaleString()}/unit`);
      } catch (error) {
        console.error('[FullEnrichment] Sales comps enrichment failed:', error);
      }
    }
    
    return this.finalizeResult(result, asset);
  }
  
  /**
   * Get coordinates from asset or geocode
   */
  private async getCoordinates(asset: DataLibraryAsset): Promise<{ lat: number; lng: number } | null> {
    // Check if we have coordinates in property_info_cache
    if (asset.address && asset.city && asset.state) {
      const cached = await this.pool.query(`
        SELECT latitude, longitude 
        FROM property_info_cache 
        WHERE address ILIKE $1 AND city ILIKE $2 AND state = $3
        LIMIT 1
      `, [asset.address, asset.city, asset.state]);
      
      if (cached.rows[0]?.latitude && cached.rows[0]?.longitude) {
        return {
          lat: parseFloat(cached.rows[0].latitude),
          lng: parseFloat(cached.rows[0].longitude)
        };
      }
    }
    
    // TODO: Add geocoding service call here
    // For now, use city-level fallback for Atlanta
    const cityCoordinates: Record<string, { lat: number; lng: number }> = {
      'atlanta': { lat: 33.7490, lng: -84.3880 },
      'midtown': { lat: 33.7870, lng: -84.3833 },
      'buckhead': { lat: 33.8400, lng: -84.3800 },
      'decatur': { lat: 33.7748, lng: -84.2963 },
      'sandy springs': { lat: 33.9243, lng: -84.3788 }
    };
    
    const cityKey = (asset.city || '').toLowerCase();
    return cityCoordinates[cityKey] || null;
  }
  
  /**
   * Enrich with proximity data
   */
  private async enrichProximity(
    lat: number,
    lng: number,
    address?: string
  ): Promise<FullEnrichmentResult['proximity']> {
    const proximityService = getProximityService(this.pool);
    const scores = await proximityService.computeProximityScores(lat, lng, { address });
    
    const highlights: string[] = [];
    const concerns: string[] = [];
    
    // Transit
    if (scores.transit.nearestStationMiles && scores.transit.nearestStationMiles <= 0.5) {
      highlights.push(`${scores.transit.nearestStationName} station ${scores.transit.nearestStationMiles.toFixed(1)}mi away`);
    } else if (!scores.transit.nearestStationMiles || scores.transit.nearestStationMiles > 1.5) {
      concerns.push('Limited transit access');
    }
    
    // Grocery
    if (scores.grocery.premiumCountWithin2Miles && scores.grocery.premiumCountWithin2Miles > 0) {
      highlights.push(`${scores.grocery.premiumCountWithin2Miles} premium groceries within 2mi`);
    }
    
    // Employers
    if (scores.employers.totalJobsWithin5Miles && scores.employers.totalJobsWithin5Miles > 20000) {
      highlights.push(`${scores.employers.totalJobsWithin5Miles.toLocaleString()} jobs within 5mi`);
    }
    
    // Schools
    if (scores.schools.elementaryRating && scores.schools.elementaryRating >= 8) {
      highlights.push(`Excellent schools (${scores.schools.elementaryRating}/10)`);
    } else if (scores.schools.elementaryRating && scores.schools.elementaryRating <= 4) {
      concerns.push(`Lower school ratings (${scores.schools.elementaryRating}/10)`);
    }
    
    // BeltLine
    if (scores.parks.beltlineMiles && scores.parks.beltlineMiles <= 0.5) {
      highlights.push('BeltLine adjacent');
    }
    
    const transitGrade = this.gradeDistance(scores.transit.nearestStationMiles, [0.25, 0.5, 1.0]);
    const groceryGrade = this.gradeDistance(scores.grocery.nearestMiles, [0.25, 0.5, 1.0]);
    const schoolGrade = this.gradeRating(scores.schools.elementaryRating);
    const safetyGrade = this.gradeCrime(scores.safety.crimeIndex);
    
    return {
      scores,
      transitGrade,
      groceryGrade,
      schoolGrade,
      safetyGrade,
      estimatedPremiumPct: (scores.estimatedPremiums.totalPremiumPct || 0) * 100,
      highlights,
      concerns
    };
  }
  
  /**
   * Enrich with market events
   */
  private async enrichEvents(
    lat: number,
    lng: number,
    radiusMiles: number,
    lookAheadMonths: number
  ): Promise<FullEnrichmentResult['events']> {
    const eventsService = getMarketEventsService(this.pool);
    const events = await eventsService.getEventsNearLocation(lat, lng, radiusMiles, {
      status: ['announced', 'confirmed', 'active']
    });
    
    const now = new Date();
    const upcoming = events.filter(e => e.effectiveDate > now);
    
    const upcomingPositive = upcoming.filter(e => e.expectedImpactDirection === 'positive').length;
    const upcomingNegative = upcoming.filter(e => e.expectedImpactDirection === 'negative').length;
    
    // Supply pipeline
    const supplyEvents = upcoming.filter(e => 
      ['supply_delivery', 'supply_announced', 'supply_groundbreaking'].includes(e.eventType)
    );
    const supplyPipelineUnits = supplyEvents.reduce((sum, e) => sum + (e.unitsAffected || 0), 0);
    
    // Net sentiment
    let netSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (upcomingPositive > upcomingNegative * 1.5) {
      netSentiment = 'bullish';
    } else if (upcomingNegative > upcomingPositive * 1.5) {
      netSentiment = 'bearish';
    }
    
    // Key events
    const keyEvents = upcoming.slice(0, 5).map(e => ({
      name: e.eventName,
      type: e.eventType,
      date: e.effectiveDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      impact: `${e.expectedImpactDirection} (${e.expectedImpactMagnitude})`
    }));
    
    // Risks and opportunities
    const riskFactors: string[] = [];
    const opportunities: string[] = [];
    
    if (supplyPipelineUnits > 500) {
      riskFactors.push(`${supplyPipelineUnits.toLocaleString()} units in pipeline`);
    }
    
    for (const event of upcoming) {
      if (event.eventType === 'employer_expansion' && event.jobsAffected && event.jobsAffected > 500) {
        opportunities.push(`${event.entityName}: +${event.jobsAffected.toLocaleString()} jobs`);
      }
      if (event.eventType === 'employer_layoff' || event.eventType === 'employer_closure') {
        riskFactors.push(`${event.entityName}: ${event.eventType.replace('employer_', '')}`);
      }
      if (event.eventType === 'transit_opening') {
        opportunities.push(event.eventName);
      }
    }
    
    return {
      upcomingPositive,
      upcomingNegative,
      supplyPipelineUnits,
      netSentiment,
      keyEvents,
      riskFactors,
      opportunities
    };
  }
  
  /**
   * Enrich with backtest context
   */
  private async enrichBacktest(asset: DataLibraryAsset): Promise<FullEnrichmentResult['backtest']> {
    const backtestService = getBacktestService(this.pool);
    
    const deals = await backtestService.getSimilarDealsPerformance({
      dealType: asset.dealType,
      assetClass: asset.assetClass,
      units: asset.units,
      vintage: asset.yearBuilt
    });
    
    if (deals.length === 0) {
      return {
        sampleSize: 0,
        avgActualIrr: 0,
        irrAccuracyPct: 0,
        outperformanceRate: 0,
        keyDrivers: [],
        confidenceLevel: 'low',
        insights: ['Insufficient historical data for this deal profile']
      };
    }
    
    const avgProjected = deals.reduce((sum, d) => sum + d.projectedIrr, 0) / deals.length;
    const avgActual = deals.reduce((sum, d) => sum + d.actualIrr, 0) / deals.length;
    
    const errors = deals.map(d => Math.abs(d.actualIrr - d.projectedIrr) / d.projectedIrr);
    const avgError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
    
    const outperformers = deals.filter(d => d.actualIrr > d.projectedIrr);
    
    // Analyze drivers
    const driverCounts: Record<string, { positive: number; negative: number }> = {};
    for (const deal of deals) {
      for (const factor of deal.keyFactors) {
        if (!driverCounts[factor]) {
          driverCounts[factor] = { positive: 0, negative: 0 };
        }
        if (deal.actualIrr > deal.projectedIrr) {
          driverCounts[factor].positive++;
        } else {
          driverCounts[factor].negative++;
        }
      }
    }
    
    const keyDrivers = Object.entries(driverCounts)
      .map(([factor, counts]) => ({
        factor,
        impact: counts.positive >= counts.negative ? 'positive' as const : 'negative' as const,
        frequency: Math.round(((counts.positive + counts.negative) / deals.length) * 100)
      }))
      .filter(d => d.frequency >= 20)
      .slice(0, 5);
    
    const insights: string[] = [];
    if (avgActual > avgProjected) {
      insights.push(`Similar deals outperformed by ${((avgActual - avgProjected) / avgProjected * 100).toFixed(0)}%`);
    } else {
      insights.push(`Similar deals underperformed by ${((avgProjected - avgActual) / avgProjected * 100).toFixed(0)}%`);
    }
    
    return {
      sampleSize: deals.length,
      avgActualIrr: Math.round(avgActual * 10) / 10,
      irrAccuracyPct: Math.round((1 - avgError) * 100),
      outperformanceRate: Math.round((outperformers.length / deals.length) * 100),
      keyDrivers,
      confidenceLevel: deals.length >= 10 ? 'high' : deals.length >= 5 ? 'medium' : 'low',
      insights
    };
  }
  
  /**
   * Enrich with sales comps
   */
  private async enrichSalesComps(
    county: string,
    state: string,
    lat: number,
    lng: number,
    radiusMiles: number
  ): Promise<FullEnrichmentResult['salesComps']> {
    // Query property_sales + property_info_cache
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) AS transaction_count,
        AVG(ps.sale_price / NULLIF(pic.number_of_units, 0)) AS avg_price_per_unit,
        AVG(ps.sale_price / NULLIF(pic.living_area_sqft, 0)) AS avg_price_per_sf
      FROM property_sales ps
      JOIN property_info_cache pic ON ps.parcel_id = pic.parcel_id 
        AND ps.county = pic.county AND ps.state = pic.state
      WHERE ps.county = $1 AND ps.state = $2
        AND ps.sale_date > NOW() - INTERVAL '24 months'
        AND ps.sale_price > 1000000
    `, [county, state]);
    
    const row = result.rows[0];
    
    // Get trend (compare last 12mo vs prior 12mo)
    const trendResult = await this.pool.query(`
      SELECT 
        AVG(CASE WHEN ps.sale_date > NOW() - INTERVAL '12 months' 
            THEN ps.sale_price / NULLIF(pic.number_of_units, 0) END) AS recent_ppu,
        AVG(CASE WHEN ps.sale_date BETWEEN NOW() - INTERVAL '24 months' AND NOW() - INTERVAL '12 months'
            THEN ps.sale_price / NULLIF(pic.number_of_units, 0) END) AS prior_ppu
      FROM property_sales ps
      JOIN property_info_cache pic ON ps.parcel_id = pic.parcel_id 
        AND ps.county = pic.county AND ps.state = pic.state
      WHERE ps.county = $1 AND ps.state = $2
        AND ps.sale_price > 1000000
    `, [county, state]);
    
    const trendRow = trendResult.rows[0];
    let pricePerUnitTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (trendRow.recent_ppu && trendRow.prior_ppu) {
      const change = (trendRow.recent_ppu - trendRow.prior_ppu) / trendRow.prior_ppu;
      if (change > 0.05) pricePerUnitTrend = 'increasing';
      else if (change < -0.05) pricePerUnitTrend = 'decreasing';
    }
    
    return {
      recentTransactions: parseInt(row.transaction_count) || 0,
      avgPricePerUnit: parseFloat(row.avg_price_per_unit) || 0,
      avgPricePerSF: parseFloat(row.avg_price_per_sf) || 0,
      avgCapRate: 0, // Would need cap rate data
      pricePerUnitTrend
    };
  }
  
  /**
   * Finalize result with quality scores
   */
  private finalizeResult(
    result: FullEnrichmentResult,
    asset: DataLibraryAsset
  ): FullEnrichmentResult {
    // Calculate overall data quality
    let qualityPoints = 0;
    let maxPoints = 0;
    
    // Core property data (40 points)
    const coreFields = ['address', 'city', 'state', 'units', 'yearBuilt', 'livingAreaSqFt'];
    for (const field of coreFields) {
      maxPoints += 7;
      if (asset[field as keyof DataLibraryAsset] || result.enrichedData[field as keyof DataLibraryAsset]) {
        qualityPoints += 7;
      }
    }
    
    // Financial data (30 points)
    const financialFields = ['avgRent', 'occupancyPct', 'askingPrice', 'capRate', 'noi'];
    for (const field of financialFields) {
      maxPoints += 6;
      if (asset[field as keyof DataLibraryAsset] || result.enrichedData[field as keyof DataLibraryAsset]) {
        qualityPoints += 6;
      }
    }
    
    // Proximity data (15 points)
    maxPoints += 15;
    if (result.proximity) {
      qualityPoints += 15;
    }
    
    // Events context (10 points)
    maxPoints += 10;
    if (result.events) {
      qualityPoints += 10;
    }
    
    // Backtest context (5 points)
    maxPoints += 5;
    if (result.backtest && result.backtest.sampleSize > 0) {
      qualityPoints += 5;
    }
    
    result.overallDataQualityScore = Math.round((qualityPoints / maxPoints) * 100);
    
    // Determine readiness
    const criticalFields = ['address', 'city', 'state', 'units'];
    const missingCritical = criticalFields.filter(f => 
      !asset[f as keyof DataLibraryAsset] && !result.enrichedData[f as keyof DataLibraryAsset]
    );
    
    result.missingCriticalData = missingCritical;
    
    if (missingCritical.length === 0 && result.overallDataQualityScore >= 70) {
      result.readinessForUnderwriting = 'ready';
    } else if (missingCritical.length <= 1 && result.overallDataQualityScore >= 50) {
      result.readinessForUnderwriting = 'partial';
    } else {
      result.readinessForUnderwriting = 'insufficient';
    }
    
    return result;
  }
  
  private gradeDistance(distance: number | undefined, thresholds: number[]): string {
    if (!distance) return 'poor';
    if (distance <= thresholds[0]) return 'excellent';
    if (distance <= thresholds[1]) return 'good';
    if (distance <= thresholds[2]) return 'fair';
    return 'poor';
  }
  
  private gradeRating(rating: number | undefined): string {
    if (!rating) return 'fair';
    if (rating >= 8) return 'excellent';
    if (rating >= 6) return 'good';
    if (rating >= 4) return 'fair';
    return 'poor';
  }
  
  private gradeCrime(index: number | undefined): string {
    if (!index) return 'fair';
    if (index < 80) return 'excellent';
    if (index < 100) return 'good';
    if (index < 120) return 'fair';
    return 'poor';
  }
}

// Singleton factory
let fullEnrichmentInstance: FullEnrichmentService | null = null;

export function getFullEnrichmentService(pool: Pool): FullEnrichmentService {
  if (!fullEnrichmentInstance) {
    fullEnrichmentInstance = new FullEnrichmentService(pool);
  }
  return fullEnrichmentInstance;
}
