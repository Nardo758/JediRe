/**
 * Data Matrix Service
 * 
 * The neural network that pulls from ALL data sources to power agents and analysis.
 * 
 * DATA LIBRARY = Source of Truth (user uploads, extracted documents, curated deals)
 * DATA MATRIX = Pulls from Data Library + enriches with external sources
 * 
 * Flow:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                          DATA LIBRARY                                   │
 * │  (User Uploads, Extracted Docs, Curated Deals, Historical Archives)    │
 * └────────────────────────────────┬────────────────────────────────────────┘
 *                                  │
 *                                  ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                          DATA MATRIX                                    │
 * │                                                                         │
 * │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
 * │  │ Property │ │   Rent   │ │  Sales   │ │Proximity │ │  Events  │     │
 * │  │   Info   │ │   Data   │ │  Comps   │ │ Context  │ │ Pipeline │     │
 * │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
 * │                                                                         │
 * │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
 * │  │ Backtest │ │  Market  │ │   Macro  │ │  Traffic │ │  Archive │     │
 * │  │ History  │ │  Trends  │ │   Econ   │ │   Data   │ │Benchmarks│     │
 * │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
 * └────────────────────────────────┬────────────────────────────────────────┘
 *                                  │
 *                                  ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                            AGENTS                                       │
 * │  Strategy | CFO | Acquisitions | Research | Revenue | Asset Mgmt       │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { Pool } from 'pg';

// Import all data source services
import { getProximityService } from '../proximity/proximity.service';
import type { ProximityScores } from '../proximity/types';
import { getMarketEventsService } from '../proximity/events.service';
import type { MarketEvent } from '../proximity/types';
import { getBacktestService } from '../proximity/backtest.service';

export interface DataLibraryDeal {
  id: string;
  userId?: string;
  
  // Core identity from Data Library
  propertyName?: string;
  address?: string;
  city?: string;
  state?: string;
  county?: string;
  zip?: string;
  
  // Physical (from extracted docs or user input)
  units?: number;
  yearBuilt?: number;
  stories?: number;
  livingAreaSqFt?: number;
  lotSizeSqFt?: number;
  
  // Financial (from T12, OM, user input)
  askingPrice?: number;
  capRate?: number;
  noi?: number;
  avgRent?: number;
  occupancyPct?: number;
  
  // Deal context
  dealType?: string; // acquisition, development, value-add
  assetClass?: string; // A, B, C
  
  // Coordinates (if known)
  latitude?: number;
  longitude?: number;
}

export interface DataMatrixContext {
  // Source deal from Data Library
  deal: DataLibraryDeal;
  
  // Layer 1: Property Info (from municipal APIs)
  propertyInfo?: {
    parcelId?: string;
    yearBuilt?: number;
    units?: number;
    sqft?: number;
    zoning?: string;
    landUse?: string;
    ownerName?: string;
    justValue?: number;
    assessedValue?: number;
    lastSaleDate?: Date;
    lastSalePrice?: number;
    provider: string;
  };
  
  // Layer 2: Rent Data (from Apartment Locator, scrapers)
  rentData?: {
    propertyName?: string;
    avgAskingRent?: number;
    avgEffectiveRent?: number;
    occupancyPct?: number;
    unitMix?: Array<{
      beds: number;
      baths: number;
      sqFt: number;
      rent: number;
      count: number;
    }>;
    concessions?: string;
    provider: string;
    asOfDate: Date;
  };
  
  // Layer 3: Sales Comps (from county records)
  salesComps?: {
    recentTransactions: number;
    avgPricePerUnit?: number;
    avgPricePerSF?: number;
    avgCapRate?: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    comps: Array<{
      address: string;
      saleDate: Date;
      salePrice: number;
      pricePerUnit?: number;
      units?: number;
    }>;
  };
  
  // Layer 4: Proximity Context
  proximity?: {
    transitGrade: string;
    groceryGrade: string;
    schoolGrade: string;
    safetyGrade: string;
    estimatedPremiumPct: number;
    highlights: string[];
    concerns: string[];
    details: ProximityScores;
  };
  
  // Layer 5: Market Events
  events?: {
    netSentiment: 'bullish' | 'bearish' | 'neutral';
    supplyPipelineUnits: number;
    upcomingPositive: number;
    upcomingNegative: number;
    keyEvents: Array<{
      name: string;
      type: string;
      date: string;
      impact: string;
      distance?: number;
    }>;
    riskFactors: string[];
    opportunities: string[];
  };
  
  // Layer 6: Backtest / Historical Validation
  backtest?: {
    sampleSize: number;
    avgProjectedIrr: number;
    avgActualIrr: number;
    irrAccuracyPct: number;
    outperformanceRate: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    keyDrivers: Array<{
      factor: string;
      impact: 'positive' | 'negative';
      frequency: number;
    }>;
    insights: string[];
  };
  
  // Layer 7: Archive Benchmarks (from historical deals)
  benchmarks?: {
    similarDealsCount: number;
    avgCapRate: number;
    avgRentPsf: number;
    avgExpenseRatio: number;
    avgRentGrowthYear1: number;
    avgHoldPeriod: number;
    avgIrr?: number;
    source: string;
  };
  
  // Layer 8: Macro Economic Context
  macro?: {
    unemploymentRate?: number;
    jobGrowthYoy?: number;
    populationGrowthYoy?: number;
    medianHouseholdIncome?: number;
    cpiInflation?: number;
    fedFundsRate?: number;
  };
  
  // Layer 9: Traffic / Demand Signals (from Apartment Locator traffic)
  traffic?: {
    searchVolume?: number;
    tourRequests?: number;
    applicationVolume?: number;
    avgDaysToLease?: number;
    demandIndex?: number; // 100 = average
  };
  
  // Layer 10: Market Trends (from correlation engine)
  marketTrends?: {
    rentGrowthYoy?: number;
    occupancyTrend?: 'improving' | 'stable' | 'declining';
    supplyPressure?: 'low' | 'moderate' | 'high';
    affordabilityCeiling?: number;
    cyclePosition?: string;
  };
  
  // Layer 11: Extracted Deal Data (from deals.deal_data)
  extractedData?: {
    // T-12 operating statement
    t12?: {
      monthsCaptured?: number;
      gpr?: number;
      egi?: number;
      vacancyLoss?: string;
      opexTotal?: number;
      noi?: number;
      expenseRatio?: number;
      noiMargin?: number;
      payroll?: number;
      repairsMaintenance?: number;
      marketing?: number;
      managementFee?: number;
      insurance?: number;
      realEstateTax?: number;
      periodStart?: string;
      periodEnd?: string;
    };
    // Rent roll
    rentRoll?: {
      totalUnits?: number;
      occupiedUnits?: number;
      vacancyUnits?: number;
      occupancyPct?: number;
      avgMarketRent?: number;
      avgEffectiveRent?: number;
      gprMonthly?: number;
      lossToLease?: number;
      egiInPlaceAnnualized?: number;
      floorPlanMix?: Array<{ beds: number; count: number; marketRent?: number; effectiveRent?: number }>;
      expirationCurve?: { months0_3?: number; months3_6?: number; months6_12?: number; months12plus?: number; mtm?: number };
    };
    // Broker claims from OM
    brokerClaims?: Record<string, unknown>;
  };

  // Metadata
  completeness: {
    score: number; // 0-100
    missingLayers: string[];
    dataQuality: 'high' | 'medium' | 'low';
  };
  
  fetchedAt: Date;
}

export class DataMatrixService {
  constructor(private pool: Pool) {}
  
  /**
   * Build full data matrix context for a deal from the Data Library
   */
  async buildContext(
    deal: DataLibraryDeal,
    options: {
      includePropertyInfo?: boolean;
      includeRentData?: boolean;
      includeSalesComps?: boolean;
      includeProximity?: boolean;
      includeEvents?: boolean;
      includeBacktest?: boolean;
      includeBenchmarks?: boolean;
      includeMacro?: boolean;
      includeTraffic?: boolean;
      includeMarketTrends?: boolean;
      searchRadiusMiles?: number;
    } = {}
  ): Promise<DataMatrixContext> {
    const opts = {
      includePropertyInfo: true,
      includeRentData: true,
      includeSalesComps: true,
      includeProximity: true,
      includeEvents: true,
      includeBacktest: true,
      includeBenchmarks: true,
      includeMacro: true,
      includeTraffic: false, // Requires Apartment Locator integration
      includeMarketTrends: true,
      searchRadiusMiles: 5,
      ...options
    };
    
    console.log(`[DataMatrix] Building context for: ${deal.propertyName || deal.address}`);
    
    const context: DataMatrixContext = {
      deal,
      completeness: {
        score: 0,
        missingLayers: [],
        dataQuality: 'low'
      },
      fetchedAt: new Date()
    };
    
    // Get coordinates (needed for spatial queries)
    const coordinates = await this.resolveCoordinates(deal);
    
    // Fetch all layers in parallel where possible
    const promises: Promise<void>[] = [];
    
    const withErrorLog = (label: string, p: Promise<void>): Promise<void> =>
      p.catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[DataMatrix] Layer FAILED [${label}]: ${msg}`);
      });
    
    if (opts.includePropertyInfo) {
      promises.push(withErrorLog('propertyInfo', this.fetchPropertyInfo(deal, context)));
    }
    
    if (opts.includeRentData) {
      promises.push(withErrorLog('rentData', this.fetchRentData(deal, context)));
    }
    
    if (opts.includeSalesComps) {
      promises.push(withErrorLog('salesComps', this.fetchSalesComps(deal, context)));
    }
    
    if (opts.includeProximity && coordinates) {
      promises.push(withErrorLog('proximity', this.fetchProximity(coordinates.lat, coordinates.lng, deal.address, context)));
    }
    
    if (opts.includeEvents && coordinates) {
      promises.push(withErrorLog('events', this.fetchEvents(coordinates.lat, coordinates.lng, opts.searchRadiusMiles, context)));
    }
    
    if (opts.includeBacktest) {
      promises.push(withErrorLog('backtest', this.fetchBacktest(deal, context)));
    }
    
    if (opts.includeBenchmarks) {
      promises.push(withErrorLog('benchmarks', this.fetchBenchmarks(deal, context)));
    }
    
    if (opts.includeMacro) {
      promises.push(withErrorLog('macro', this.fetchMacro(deal.city, deal.state, context)));
    }
    
    if (opts.includeMarketTrends) {
      promises.push(withErrorLog('marketTrends', this.fetchMarketTrends(deal.city, deal.state, context)));
    }
    
    // Wait for all fetches
    await Promise.allSettled(promises);

    // ── Inject extracted deal data (T12, rent roll, broker claims) ──
    if (deal.id && deal.id !== 'inline') {
      try {
        console.log(`[DataMatrix] Fetching extractedData for deal.id=${deal.id}`);
        const extResult = await this.pool.query(
          `SELECT deal_data->'extraction_t12' AS t12,
                  deal_data->'extraction_rent_roll' AS rr,
                  deal_data->'broker_claims' AS bc
           FROM deals WHERE id = $1 AND deal_data IS NOT NULL`,
          [deal.id]
        );
        const extRow = extResult.rows[0];
        console.log(`[DataMatrix] extRow: ${extRow ? 'found' : 'not found'}`);
        if (extRow) {
          const t12 = extRow.t12;
          const rr = extRow.rr;
          const bc = extRow.bc;
          console.log(`[DataMatrix] t12=${!!t12}, rr=${!!rr}, bc=${!!bc}`);

          console.log(`[DataMatrix] Extracted data: t12_GPR=${t12?.gpr}, rr_units=${rr?.total_units}, rr_occ=${rr?.occupied_units}`);

          if (t12 || rr || bc) {
            context.extractedData = {
              t12: t12 ? {
                monthsCaptured: t12.months_captured,
                gpr: t12.gpr,
                egi: t12.egi,
                vacancyLoss: t12.vacancy_loss != null ? String(t12.vacancy_loss) : undefined,
                opexTotal: t12.opex?.total,
                noi: t12.noi,
                expenseRatio: t12.expense_ratio,
                noiMargin: t12.noi_margin,
                payroll: t12.opex?.payroll,
                repairsMaintenance: t12.opex?.r_and_m,
                marketing: t12.opex?.marketing,
                managementFee: t12.opex?.mgmt_fee,
                insurance: t12.opex?.insurance,
                realEstateTax: t12.opex?.real_estate_tax,
                periodStart: t12.period_start,
                periodEnd: t12.period_end,
              } : undefined,
              rentRoll: rr ? {
                totalUnits: rr.total_units,
                occupiedUnits: rr.occupied_units,
                vacancyUnits: rr.vacant_units,
                occupancyPct: rr.occupancy_by_unit_pct,
                avgMarketRent: rr.avg_market_rent,
                avgEffectiveRent: rr.avg_effective_rent,
                gprMonthly: rr.gpr_monthly,
                lossToLease: rr.loss_to_lease_monthly,
                egiInPlaceAnnualized: rr.egi_in_place_annualized,
              } : undefined,
              brokerClaims: bc ?? undefined,
            };
          }
        }
      } catch (extErr) {
        // Non-fatal — extracted data is supplementary
        console.warn(`[DataMatrix] Failed to inject extracted data for ${deal.id}:`, extErr);
      }
    }
    
    // Calculate completeness
    context.completeness = this.calculateCompleteness(context);
    
    return context;
  }
  
  /**
   * Get coordinates from deal or geocode
   */
  private async resolveCoordinates(deal: DataLibraryDeal): Promise<{ lat: number; lng: number } | null> {
    // Use provided coordinates
    if (deal.latitude && deal.longitude) {
      return { lat: deal.latitude, lng: deal.longitude };
    }
    
    // Check property_info_cache
    if (deal.address && deal.city && deal.state) {
      const cached = await this.pool.query(`
        SELECT latitude, longitude 
        FROM property_info_cache 
        WHERE address ILIKE $1 AND city ILIKE $2 AND state = $3
          AND latitude IS NOT NULL AND longitude IS NOT NULL
        LIMIT 1
      `, [`%${deal.address}%`, deal.city, deal.state]);
      
      if (cached.rows[0]) {
        return {
          lat: parseFloat(cached.rows[0].latitude),
          lng: parseFloat(cached.rows[0].longitude)
        };
      }
    }
    
    // Fallback to city centroid (for Atlanta metro)
    const cityCentroids: Record<string, { lat: number; lng: number }> = {
      'atlanta': { lat: 33.7490, lng: -84.3880 },
      'midtown': { lat: 33.7870, lng: -84.3833 },
      'buckhead': { lat: 33.8400, lng: -84.3800 },
      'sandy springs': { lat: 33.9243, lng: -84.3788 },
      'marietta': { lat: 33.9526, lng: -84.5499 },
      'decatur': { lat: 33.7748, lng: -84.2963 },
      'alpharetta': { lat: 34.0754, lng: -84.2941 },
      'roswell': { lat: 34.0232, lng: -84.3616 },
      'dunwoody': { lat: 33.9462, lng: -84.3346 }
    };
    
    const cityKey = (deal.city || '').toLowerCase();
    return cityCentroids[cityKey] || null;
  }
  
  /**
   * Fetch property info from municipal APIs cache
   */
  private async fetchPropertyInfo(deal: DataLibraryDeal, context: DataMatrixContext): Promise<void> {
    try {
      if (!deal.address || !deal.city || !deal.state) return;
      
      const result = await this.pool.query(`
        SELECT * FROM property_info_cache
        WHERE address ILIKE $1 AND city ILIKE $2 AND state = $3
        ORDER BY fetched_at DESC
        LIMIT 1
      `, [`%${deal.address}%`, deal.city, deal.state]);
      
      if (result.rows[0]) {
        const row = result.rows[0];
        context.propertyInfo = {
          parcelId: row.parcel_id,
          yearBuilt: row.year_built,
          units: row.number_of_units,
          sqft: row.living_area_sqft,
          zoning: row.zoning,
          landUse: row.land_use_description,
          ownerName: row.owner_name,
          justValue: row.just_value ? parseFloat(row.just_value) : undefined,
          assessedValue: row.assessed_value ? parseFloat(row.assessed_value) : undefined,
          lastSaleDate: row.last_sale_date ? new Date(row.last_sale_date) : undefined,
          lastSalePrice: row.last_sale_amount ? parseFloat(row.last_sale_amount) : undefined,
          provider: row.provider
        };
      }
    } catch (error) {
      console.error('[DataMatrix] Property info fetch failed:', error);
    }
  }
  
  /**
   * Fetch rent data from Apartment Locator cache
   */
  private async fetchRentData(deal: DataLibraryDeal, context: DataMatrixContext): Promise<void> {
    try {
      // First check matched properties
      const matched = await this.pool.query(`
        SELECT al.* 
        FROM apartment_locator_properties al
        WHERE al.city ILIKE $1 AND al.state = $2
          AND (al.address ILIKE $3 OR al.property_name ILIKE $4)
        ORDER BY al.fetched_at DESC
        LIMIT 1
      `, [deal.city, deal.state, `%${deal.address}%`, `%${deal.propertyName}%`]);
      
      if (matched.rows[0]) {
        const row = matched.rows[0];
        context.rentData = {
          propertyName: row.property_name,
          avgAskingRent: row.avg_asking_rent ? parseFloat(row.avg_asking_rent) : undefined,
          avgEffectiveRent: row.avg_effective_rent ? parseFloat(row.avg_effective_rent) : undefined,
          occupancyPct: row.occupancy_pct ? parseFloat(row.occupancy_pct) : undefined,
          unitMix: row.unit_mix || [],
          concessions: row.concessions,
          provider: row.source,
          asOfDate: new Date(row.fetched_at)
        };
      }
    } catch (error) {
      console.error('[DataMatrix] Rent data fetch failed:', error);
    }
  }
  
  /**
   * Fetch sales comps from property_sales
   */
  private async fetchSalesComps(deal: DataLibraryDeal, context: DataMatrixContext): Promise<void> {
    try {
      if (!deal.county || !deal.state) return;
      
      // Get recent transactions
      const result = await this.pool.query(`
        SELECT 
          ps.sale_year, ps.sale_price, pic.address, pic.number_of_units, pic.living_area_sqft
        FROM property_sales ps
        JOIN property_info_cache pic ON ps.parcel_id = pic.parcel_id
        WHERE pic.county = $1 AND pic.state = $2
          AND ps.sale_year >= EXTRACT(YEAR FROM NOW())::int - 2
          AND ps.sale_price > 1000000
          AND pic.number_of_units > 10
        ORDER BY ps.sale_year DESC
        LIMIT 20
      `, [deal.county, deal.state]);
      
      if (result.rows.length > 0) {
        const comps = result.rows.map(row => ({
          address: row.address,
          saleDate: new Date(parseInt(row.sale_year, 10), 0, 1),
          salePrice: parseFloat(row.sale_price),
          pricePerUnit: row.number_of_units ? parseFloat(row.sale_price) / row.number_of_units : undefined,
          units: row.number_of_units
        }));
        
        const avgPPU = comps.filter(c => c.pricePerUnit).reduce((sum, c) => sum + c.pricePerUnit!, 0) / 
                       comps.filter(c => c.pricePerUnit).length;
        
        // Calculate trend
        const recent = comps.filter(c => c.saleDate > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
        const older = comps.filter(c => c.saleDate <= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
        
        const recentAvg = recent.filter(c => c.pricePerUnit).reduce((s, c) => s + c.pricePerUnit!, 0) / recent.length || 0;
        const olderAvg = older.filter(c => c.pricePerUnit).reduce((s, c) => s + c.pricePerUnit!, 0) / older.length || 0;
        
        let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
        if (olderAvg > 0) {
          const change = (recentAvg - olderAvg) / olderAvg;
          if (change > 0.05) trend = 'increasing';
          else if (change < -0.05) trend = 'decreasing';
        }
        
        context.salesComps = {
          recentTransactions: comps.length,
          avgPricePerUnit: avgPPU || undefined,
          trend,
          comps: comps.slice(0, 5)
        };
      }
    } catch (error) {
      console.error('[DataMatrix] Sales comps fetch failed:', error);
    }
  }
  
  /**
   * Fetch proximity context
   */
  private async fetchProximity(
    lat: number, 
    lng: number, 
    address: string | undefined, 
    context: DataMatrixContext
  ): Promise<void> {
    try {
      const proximityService = getProximityService(this.pool);
      const scores = await proximityService.computeProximityScores(lat, lng, { address });
      
      const highlights: string[] = [];
      const concerns: string[] = [];
      
      if (scores.transit.nearestStationMiles && scores.transit.nearestStationMiles <= 0.5) {
        highlights.push(`${scores.transit.nearestStationName} station ${scores.transit.nearestStationMiles.toFixed(1)}mi`);
      }
      if (scores.parks.beltlineMiles && scores.parks.beltlineMiles <= 0.5) {
        highlights.push('BeltLine adjacent');
      }
      if (scores.employers.totalJobsWithin5Miles && scores.employers.totalJobsWithin5Miles > 20000) {
        highlights.push(`${scores.employers.totalJobsWithin5Miles.toLocaleString()} jobs within 5mi`);
      }
      if (scores.schools.elementaryRating && scores.schools.elementaryRating <= 4) {
        concerns.push(`Lower school ratings (${scores.schools.elementaryRating}/10)`);
      }
      
      context.proximity = {
        transitGrade: this.gradeDistance(scores.transit.nearestStationMiles, [0.25, 0.5, 1.0]),
        groceryGrade: this.gradeDistance(scores.grocery.nearestMiles, [0.25, 0.5, 1.0]),
        schoolGrade: this.gradeRating(scores.schools.elementaryRating),
        safetyGrade: this.gradeCrime(scores.safety.crimeIndex),
        estimatedPremiumPct: (scores.estimatedPremiums.totalPremiumPct || 0) * 100,
        highlights,
        concerns,
        details: scores
      };
    } catch (error) {
      console.error('[DataMatrix] Proximity fetch failed:', error);
    }
  }
  
  /**
   * Fetch market events
   */
  private async fetchEvents(
    lat: number, 
    lng: number, 
    radiusMiles: number,
    context: DataMatrixContext
  ): Promise<void> {
    try {
      const eventsService = getMarketEventsService(this.pool);
      const events = await eventsService.getEventsNearLocation(lat, lng, radiusMiles);
      
      const now = new Date();
      const upcoming = events.filter(e => e.effectiveDate > now);
      
      const upcomingPositive = upcoming.filter(e => e.expectedImpactDirection === 'positive').length;
      const upcomingNegative = upcoming.filter(e => e.expectedImpactDirection === 'negative').length;
      
      const supplyEvents = upcoming.filter(e => 
        ['supply_delivery', 'supply_announced'].includes(e.eventType)
      );
      const supplyPipelineUnits = supplyEvents.reduce((sum, e) => sum + (e.unitsAffected || 0), 0);
      
      let netSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (upcomingPositive > upcomingNegative * 1.5) netSentiment = 'bullish';
      else if (upcomingNegative > upcomingPositive * 1.5) netSentiment = 'bearish';
      
      const riskFactors: string[] = [];
      const opportunities: string[] = [];
      
      if (supplyPipelineUnits > 500) {
        riskFactors.push(`${supplyPipelineUnits.toLocaleString()} units in pipeline`);
      }
      
      for (const event of upcoming.slice(0, 10)) {
        if (event.eventType.includes('expansion') && event.jobsAffected && event.jobsAffected > 500) {
          opportunities.push(`${event.entityName}: +${event.jobsAffected.toLocaleString()} jobs`);
        }
        if (event.eventType === 'transit_opening') {
          opportunities.push(event.eventName);
        }
      }
      
      context.events = {
        netSentiment,
        supplyPipelineUnits,
        upcomingPositive,
        upcomingNegative,
        keyEvents: upcoming.slice(0, 5).map(e => ({
          name: e.eventName,
          type: e.eventType,
          date: e.effectiveDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          impact: `${e.expectedImpactDirection} (${e.expectedImpactMagnitude})`
        })),
        riskFactors,
        opportunities
      };
    } catch (error) {
      console.error('[DataMatrix] Events fetch failed:', error);
    }
  }
  
  /**
   * Fetch backtest context
   */
  private async fetchBacktest(deal: DataLibraryDeal, context: DataMatrixContext): Promise<void> {
    try {
      const backtestService = getBacktestService(this.pool);
      const deals = await backtestService.getSimilarDealsPerformance({
        dealType: deal.dealType,
        assetClass: deal.assetClass,
        units: deal.units
      });
      
      if (deals.length > 0) {
        const avgProjected = deals.reduce((s, d) => s + d.projectedIrr, 0) / deals.length;
        const avgActual = deals.reduce((s, d) => s + d.actualIrr, 0) / deals.length;
        const errors = deals.map(d => Math.abs(d.actualIrr - d.projectedIrr) / d.projectedIrr);
        const avgError = errors.reduce((s, e) => s + e, 0) / errors.length;
        const outperformers = deals.filter(d => d.actualIrr > d.projectedIrr);
        
        context.backtest = {
          sampleSize: deals.length,
          avgProjectedIrr: Math.round(avgProjected * 10) / 10,
          avgActualIrr: Math.round(avgActual * 10) / 10,
          irrAccuracyPct: Math.round((1 - avgError) * 100),
          outperformanceRate: Math.round((outperformers.length / deals.length) * 100),
          confidenceLevel: deals.length >= 10 ? 'high' : deals.length >= 5 ? 'medium' : 'low',
          keyDrivers: [],
          insights: [
            avgActual > avgProjected 
              ? `Similar deals outperformed by ${((avgActual - avgProjected) / avgProjected * 100).toFixed(0)}%`
              : `Similar deals underperformed by ${((avgProjected - avgActual) / avgProjected * 100).toFixed(0)}%`
          ]
        };
      }
    } catch (error) {
      console.error('[DataMatrix] Backtest fetch failed:', error);
    }
  }
  
  /**
   * Fetch benchmarks from archive deals
   */
  private async fetchBenchmarks(deal: DataLibraryDeal, context: DataMatrixContext): Promise<void> {
    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as count,
          AVG(actual_exit_cap) as avg_actual_exit_cap,
          AVG(projected_exit_cap) as avg_projected_exit_cap,
          AVG(actual_irr) as avg_actual_irr,
          AVG(EXTRACT(YEAR FROM disposition_date) - EXTRACT(YEAR FROM acquisition_date)) as avg_hold_years
        FROM archive_deals
        WHERE asset_class = $1 OR $1 IS NULL
      `, [deal.assetClass]);
      
      if (result.rows[0] && parseInt(result.rows[0].count) > 0) {
        const row = result.rows[0];
        context.benchmarks = {
          similarDealsCount: parseInt(row.count),
          avgCapRate: row.avg_projected_exit_cap ? parseFloat(row.avg_projected_exit_cap) : row.avg_actual_exit_cap ? parseFloat(row.avg_actual_exit_cap) : 0,
          avgIrr: row.avg_actual_irr ? parseFloat(row.avg_actual_irr) : 0,
          avgHoldPeriod: row.avg_hold_years ? parseInt(row.avg_hold_years) : 5,
          source: 'archive_deals'
        };
      }
    } catch (error) {
      console.error('[DataMatrix] Benchmarks fetch failed:', error);
    }
  }
  
  /**
   * Fetch macro economic data
   */
  private async fetchMacro(city: string | undefined, state: string | undefined, context: DataMatrixContext): Promise<void> {
    try {
      // Would query BLS API or cached macro data
      // For now, use Atlanta defaults
      context.macro = {
        unemploymentRate: 3.2,
        jobGrowthYoy: 2.1,
        populationGrowthYoy: 1.5,
        medianHouseholdIncome: 71000,
        fedFundsRate: 5.25
      };
    } catch (error) {
      console.error('[DataMatrix] Macro fetch failed:', error);
    }
  }
  
  /**
   * Fetch market trends from correlation engine
   */
  private async fetchMarketTrends(city: string | undefined, state: string | undefined, context: DataMatrixContext): Promise<void> {
    try {
      const result = await this.pool.query(`
        SELECT * FROM market_snapshots
        WHERE geography_id = $1 OR geography_name ILIKE $2
        ORDER BY snapshot_date DESC
        LIMIT 2
      `, [city?.toLowerCase(), `%${city}%`]);
      
      if (result.rows.length >= 1) {
        const latest = result.rows[0];
        context.marketTrends = {
          rentGrowthYoy: latest.rent_growth_yoy ? parseFloat(latest.rent_growth_yoy) : undefined,
          occupancyTrend: latest.avg_occupancy_pct > 95 ? 'improving' : 
                          latest.avg_occupancy_pct < 92 ? 'declining' : 'stable',
          supplyPressure: latest.units_under_construction > 5000 ? 'high' :
                          latest.units_under_construction > 2000 ? 'moderate' : 'low'
        };
      }
    } catch (error) {
      console.error('[DataMatrix] Market trends fetch failed:', error);
    }
  }
  
  /**
   * Calculate completeness score
   */
  private calculateCompleteness(context: DataMatrixContext): DataMatrixContext['completeness'] {
    const layers = [
      { name: 'propertyInfo', data: context.propertyInfo, weight: 10 },
      { name: 'rentData', data: context.rentData, weight: 10 },
      { name: 'salesComps', data: context.salesComps, weight: 10 },
      { name: 'proximity', data: context.proximity, weight: 10 },
      { name: 'events', data: context.events, weight: 10 },
      { name: 'backtest', data: context.backtest, weight: 10 },
      { name: 'benchmarks', data: context.benchmarks, weight: 10 },
      { name: 'macro', data: context.macro, weight: 5 },
      { name: 'marketTrends', data: context.marketTrends, weight: 10 },
      // Extracted deal data (T12 + rent roll) is the highest-value data
      { name: 'extractedData', data: context.extractedData, weight: 15 }
    ];
    
    let score = 0;
    const missingLayers: string[] = [];
    
    for (const layer of layers) {
      if (layer.data) {
        score += layer.weight;
      } else {
        missingLayers.push(layer.name);
      }
    }
    
    return {
      score,
      missingLayers,
      dataQuality: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low'
    };
  }
  
  private gradeDistance(distance: number | undefined, thresholds: number[]): string {
    if (!distance) return 'unknown';
    if (distance <= thresholds[0]) return 'excellent';
    if (distance <= thresholds[1]) return 'good';
    if (distance <= thresholds[2]) return 'fair';
    return 'poor';
  }
  
  private gradeRating(rating: number | undefined): string {
    if (!rating) return 'unknown';
    if (rating >= 8) return 'excellent';
    if (rating >= 6) return 'good';
    if (rating >= 4) return 'fair';
    return 'poor';
  }
  
  private gradeCrime(index: number | undefined): string {
    if (!index) return 'unknown';
    if (index < 80) return 'excellent';
    if (index < 100) return 'good';
    if (index < 120) return 'fair';
    return 'poor';
  }
}

// Singleton factory
let dataMatrixInstance: DataMatrixService | null = null;

export function getDataMatrixService(pool: Pool): DataMatrixService {
  if (!dataMatrixInstance) {
    dataMatrixInstance = new DataMatrixService(pool);
  }
  return dataMatrixInstance;
}
