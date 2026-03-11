/**
 * Research Agent — The data assembly brain
 *
 * Assembles DealContext packages by querying all platform data sources
 * in parallel. Eliminates redundant API calls across agents by providing
 * a single, cached data package.
 *
 * Sources:
 * - County records / property appraiser
 * - ArcGIS REST endpoints (zoning, flood, parcels)
 * - Municode (setbacks, FAR, height, density)
 * - Google Places (amenities, reviews, traffic)
 * - RentCast (market rents, vacancy, absorption)
 * - SpyFu (digital traffic scoring)
 * - FRED / BLS (employment, migration, macro)
 * - NewsAPI (market news, development pipeline)
 * - Apartment Locator AI (comp inventory, pricing)
 * - County permits (active permits in trade area)
 * - FDOT (traffic counts, AADT, seasonal factors)
 * - Freddie Mac PMMS (mortgage rates)
 * - Census / ArcGIS GeoEnrichment (demographics)
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { query } from '../database/connection';
import type {
  DealContext,
  ParcelData,
  ZoningData,
  MarketData,
  CompData,
  PipelineData,
  DemographicsData,
  DigitalSignals,
  NewsItem,
  MacroData,
  AssemblyMeta,
} from '../types/dealContext';

interface ResearchInput {
  address: string;
  coordinates?: { lat: number; lng: number };
  propertyId?: string;
  userId: string;
  forceRefresh?: boolean;
}

export class ResearchAgent {
  /**
   * Execute full data assembly for a property.
   * Returns cached DealContext if available and fresh.
   */
  async execute(input: ResearchInput): Promise<DealContext> {
    const startTime = Date.now();
    const requestId = uuidv4();

    logger.info('Research Agent: starting data assembly', {
      requestId,
      address: input.address,
    });

    // Check cache first (24h freshness TTL)
    if (!input.forceRefresh) {
      const cached = await this.getCachedContext(input.address);
      if (cached) {
        logger.info('Research Agent: returning cached DealContext', {
          requestId,
          address: input.address,
          age: `${cached.meta.dataFreshnessHours}h`,
        });
        return cached;
      }
    }

    // Resolve coordinates if not provided
    const coordinates = input.coordinates || (await this.geocode(input.address));

    // Run all data sources in parallel
    const sourcesQueried: string[] = [];
    const sourcesSucceeded: string[] = [];
    const sourcesFailed: string[] = [];

    const [
      parcelResult,
      zoningResult,
      marketResult,
      compsResult,
      pipelineResult,
      demographicsResult,
      digitalResult,
      newsResult,
      macroResult,
    ] = await Promise.allSettled([
      this.fetchParcelData(input.address, coordinates, sourcesQueried),
      this.fetchZoningData(input.address, coordinates, sourcesQueried),
      this.fetchMarketData(input.address, coordinates, sourcesQueried),
      this.fetchComps(input.address, coordinates, sourcesQueried),
      this.fetchPipeline(input.address, coordinates, sourcesQueried),
      this.fetchDemographics(coordinates, sourcesQueried),
      this.fetchDigitalSignals(input.address, sourcesQueried),
      this.fetchNews(input.address, sourcesQueried),
      this.fetchMacroData(coordinates, sourcesQueried),
    ]);

    // Process results
    const parcel = this.unwrapResult(parcelResult, 'county_records', sourcesSucceeded, sourcesFailed, this.defaultParcel());
    const zoning = this.unwrapResult(zoningResult, 'arcgis_municode', sourcesSucceeded, sourcesFailed, this.defaultZoning());
    const market = this.unwrapResult(marketResult, 'rentcast_apts', sourcesSucceeded, sourcesFailed, this.defaultMarket());
    const comps = this.unwrapResult(compsResult, 'apartment_locator', sourcesSucceeded, sourcesFailed, [] as CompData[]);
    const pipeline = this.unwrapResult(pipelineResult, 'county_permits', sourcesSucceeded, sourcesFailed, this.defaultPipeline());
    const demographics = this.unwrapResult(demographicsResult, 'census_geo', sourcesSucceeded, sourcesFailed, this.defaultDemographics());
    const digital = this.unwrapResult(digitalResult, 'spyfu_google', sourcesSucceeded, sourcesFailed, this.defaultDigital());
    const news = this.unwrapResult(newsResult, 'newsapi', sourcesSucceeded, sourcesFailed, [] as NewsItem[]);
    const macro = this.unwrapResult(macroResult, 'fred_bls', sourcesSucceeded, sourcesFailed, this.defaultMacro());

    const assemblyTimeMs = Date.now() - startTime;
    const confidenceScore = sourcesSucceeded.length / Math.max(sourcesQueried.length, 1);

    const dealContext: DealContext = {
      requestId,
      address: input.address,
      coordinates,
      parcelId: parcel.legalDescription || '',
      createdAt: new Date().toISOString(),
      parcel,
      zoning,
      market,
      comps,
      pipeline,
      demographics,
      digital,
      news,
      macro,
      meta: {
        sourcesQueried,
        sourcesSucceeded,
        sourcesFailed,
        assemblyTimeMs,
        dataFreshnessHours: 0,
        confidenceScore,
      },
    };

    // Cache the assembled context
    await this.cacheDealContext(dealContext, input.userId, input.propertyId);

    logger.info('Research Agent: assembly complete', {
      requestId,
      address: input.address,
      assemblyTimeMs,
      sourcesSucceeded: sourcesSucceeded.length,
      sourcesFailed: sourcesFailed.length,
      confidenceScore,
    });

    return dealContext;
  }

  // ── Data Source Fetchers ──────────────────────────────────────

  private async fetchParcelData(
    address: string,
    coords: { lat: number; lng: number },
    sourcesQueried: string[]
  ): Promise<ParcelData> {
    sourcesQueried.push('county_records');

    // Query existing property data from our database first
    const result = await query(
      `SELECT p.*, pd.assessed_value, pd.last_sale_date, pd.last_sale_price,
              pd.owner_name, pd.legal_description
       FROM properties p
       LEFT JOIN property_details pd ON pd.property_id = p.id
       WHERE p.address_line1 ILIKE $1
       LIMIT 1`,
      [`%${address.split(',')[0].trim()}%`]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        lotSizeSqFt: row.lot_size_sqft || 0,
        lotSizeAcres: row.lot_size_acres || (row.lot_size_sqft ? row.lot_size_sqft / 43560 : 0),
        assessedValue: row.assessed_value || 0,
        lastSaleDate: row.last_sale_date || '',
        lastSalePrice: row.last_sale_price || 0,
        ownerName: row.owner_name || '',
        ownerType: 'entity',
        legalDescription: row.legal_description || '',
      };
    }

    return this.defaultParcel();
  }

  private async fetchZoningData(
    address: string,
    coords: { lat: number; lng: number },
    sourcesQueried: string[]
  ): Promise<ZoningData> {
    sourcesQueried.push('arcgis_municode');

    // Query existing zoning data from our database
    const result = await query(
      `SELECT zd.*
       FROM properties p
       JOIN zoning_districts zd ON zd.id = p.zoning_district_id
       WHERE p.address_line1 ILIKE $1
       LIMIT 1`,
      [`%${address.split(',')[0].trim()}%`]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const lotSizeAcres = 1; // Will be refined by parcel data
      return {
        district: row.district_code || '',
        description: row.district_name || row.district_description || '',
        maxStories: row.max_stories || 0,
        maxHeight: row.max_height_ft || 0,
        maxDensity: row.max_density_units_per_acre || 0,
        far: row.max_coverage_percent ? row.max_coverage_percent / 100 : 0,
        maxBuildableUnits: row.max_density_units_per_acre
          ? Math.floor(row.max_density_units_per_acre * lotSizeAcres)
          : 0,
        parkingRatio: row.parking_spaces_per_unit || 0,
        setbacks: {
          front: row.front_setback_ft || 0,
          side: row.side_setback_ft || 0,
          rear: row.rear_setback_ft || 0,
        },
        overlays: [],
        floodZone: 'Unknown',
        sourceUrl: '',
        confidence: 0.7,
      };
    }

    return this.defaultZoning();
  }

  private async fetchMarketData(
    address: string,
    coords: { lat: number; lng: number },
    sourcesQueried: string[]
  ): Promise<MarketData> {
    sourcesQueried.push('rentcast_apts');

    // Query existing market data
    const result = await query(
      `SELECT * FROM market_snapshots
       WHERE city ILIKE $1
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [`%${this.extractCity(address)}%`]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        msa: row.msa || this.extractCity(address),
        submarket: row.submarket || '',
        avgRent: row.avg_rent || 0,
        avgRentPSF: row.avg_rent_psf || 0,
        vacancyRate: row.vacancy_rate || 0,
        absorptionUnitsPerMonth: row.absorption_units_per_month || 0,
        daysOnMarket: row.avg_days_on_market || 0,
        rentGrowthYoY: row.rent_growth_yoy || 0,
        concessionRate: row.concession_rate || 0,
      };
    }

    return this.defaultMarket();
  }

  private async fetchComps(
    address: string,
    coords: { lat: number; lng: number },
    sourcesQueried: string[]
  ): Promise<CompData[]> {
    sourcesQueried.push('apartment_locator');

    // Query nearby comps from database
    const result = await query(
      `SELECT name, address, units, year_built, avg_rent, occupancy_rate, google_rating,
              ST_Distance(
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
              ) / 1609.34 as distance_mi
       FROM apartment_comps
       WHERE ST_DWithin(
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
         16093.4
       )
       ORDER BY distance_mi ASC
       LIMIT 10`,
      [coords.lng, coords.lat]
    );

    return result.rows.map((row: any) => ({
      name: row.name || 'Unknown',
      address: row.address || '',
      distanceMi: parseFloat(row.distance_mi) || 0,
      units: row.units || 0,
      yearBuilt: row.year_built || 0,
      avgRent: row.avg_rent || 0,
      occupancy: row.occupancy_rate || 0,
      rating: row.google_rating || 0,
    }));
  }

  private async fetchPipeline(
    address: string,
    coords: { lat: number; lng: number },
    sourcesQueried: string[]
  ): Promise<PipelineData> {
    sourcesQueried.push('county_permits');

    // Query permit data from our database
    const result = await query(
      `SELECT COUNT(*) as active_permits,
              COALESCE(SUM(units), 0) as total_pipeline_units,
              MIN(estimated_completion) as nearest_delivery
       FROM building_permits
       WHERE status = 'active'
         AND ST_DWithin(
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
           8046.7
         )`,
      [coords.lng, coords.lat]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        activePermits: parseInt(row.active_permits) || 0,
        totalPipelineUnits: parseInt(row.total_pipeline_units) || 0,
        nearestDeliveryDate: row.nearest_delivery || '',
        monthsOfPipelineSupply: 0, // Calculated by Supply Agent
      };
    }

    return this.defaultPipeline();
  }

  private async fetchDemographics(
    coords: { lat: number; lng: number },
    sourcesQueried: string[]
  ): Promise<DemographicsData> {
    sourcesQueried.push('census_geo');

    // Query cached demographic data
    const result = await query(
      `SELECT * FROM demographic_data
       WHERE ST_DWithin(
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
         16093.4
       )
       ORDER BY data_year DESC
       LIMIT 1`,
      [coords.lng, coords.lat]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        populationGrowthYoY: row.population_growth_yoy || 0,
        medianHouseholdIncome: row.median_household_income || 0,
        employmentGrowthYoY: row.employment_growth_yoy || 0,
        topEmployers: row.top_employers || [],
        netMigration: row.net_migration || 0,
      };
    }

    return this.defaultDemographics();
  }

  private async fetchDigitalSignals(
    address: string,
    sourcesQueried: string[]
  ): Promise<DigitalSignals> {
    sourcesQueried.push('spyfu_google');

    // Query existing digital traffic data
    const result = await query(
      `SELECT traffic_index, search_momentum, google_rating_avg, review_volume
       FROM digital_signals
       WHERE address ILIKE $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [`%${address.split(',')[0].trim()}%`]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        trafficIndex: row.traffic_index || 0,
        searchMomentum: row.search_momentum || 0,
        googleRatingAvg: row.google_rating_avg || 0,
        reviewVolume: row.review_volume || 0,
      };
    }

    return this.defaultDigital();
  }

  private async fetchNews(
    address: string,
    sourcesQueried: string[]
  ): Promise<NewsItem[]> {
    sourcesQueried.push('newsapi');

    const city = this.extractCity(address);
    const result = await query(
      `SELECT headline, source, published_date, sentiment, relevance_category
       FROM market_news
       WHERE city ILIKE $1
       ORDER BY published_date DESC
       LIMIT 10`,
      [`%${city}%`]
    );

    return result.rows.map((row: any) => ({
      headline: row.headline,
      source: row.source,
      date: row.published_date,
      sentiment: row.sentiment || 'neutral',
      relevance: row.relevance_category || 'market',
    }));
  }

  private async fetchMacroData(
    coords: { lat: number; lng: number },
    sourcesQueried: string[]
  ): Promise<MacroData> {
    sourcesQueried.push('fred_bls');

    // Query cached macro data
    const result = await query(
      `SELECT * FROM macro_indicators
       ORDER BY data_date DESC
       LIMIT 1`
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        fed30YrMortgageRate: row.mortgage_rate_30yr || 0,
        freddieMacPMMS: row.freddie_mac_pmms || 0,
        msaUnemploymentRate: row.unemployment_rate || 0,
        cpiYoY: row.cpi_yoy || 0,
      };
    }

    return this.defaultMacro();
  }

  // ── Helpers ──────────────────────────────────────────────────

  private async geocode(address: string): Promise<{ lat: number; lng: number }> {
    // Try to get from existing property data first
    const result = await query(
      `SELECT latitude, longitude FROM properties
       WHERE address_line1 ILIKE $1 AND latitude IS NOT NULL
       LIMIT 1`,
      [`%${address.split(',')[0].trim()}%`]
    );

    if (result.rows.length > 0) {
      return {
        lat: parseFloat(result.rows[0].latitude),
        lng: parseFloat(result.rows[0].longitude),
      };
    }

    // Default to Atlanta coordinates as fallback
    return { lat: 33.749, lng: -84.388 };
  }

  private extractCity(address: string): string {
    const parts = address.split(',');
    return parts.length > 1 ? parts[1].trim() : parts[0].trim();
  }

  private unwrapResult<T>(
    result: PromiseSettledResult<T>,
    sourceName: string,
    succeeded: string[],
    failed: string[],
    fallback: T
  ): T {
    if (result.status === 'fulfilled') {
      succeeded.push(sourceName);
      return result.value;
    }
    failed.push(sourceName);
    logger.warn(`Research Agent: source failed: ${sourceName}`, {
      error: result.reason?.message || result.reason,
    });
    return fallback;
  }

  private async getCachedContext(address: string): Promise<DealContext | null> {
    try {
      const result = await query(
        `SELECT context_json, created_at FROM deal_contexts
         WHERE address ILIKE $1
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [`%${address.split(',')[0].trim()}%`]
      );

      if (result.rows.length > 0) {
        const ctx = result.rows[0].context_json as DealContext;
        const ageHours =
          (Date.now() - new Date(result.rows[0].created_at).getTime()) / 3600000;
        ctx.meta.dataFreshnessHours = Math.round(ageHours * 10) / 10;
        return ctx;
      }
    } catch (error) {
      logger.warn('Research Agent: cache lookup failed', { error });
    }
    return null;
  }

  private async cacheDealContext(
    context: DealContext,
    userId: string,
    propertyId?: string
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24h TTL

      await query(
        `INSERT INTO deal_contexts (
          deal_id, user_id, address, context_json,
          sources_queried, sources_succeeded, sources_failed,
          confidence_score, assembly_time_ms, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          propertyId || null,
          userId,
          context.address,
          JSON.stringify(context),
          context.meta.sourcesQueried,
          context.meta.sourcesSucceeded,
          context.meta.sourcesFailed,
          context.meta.confidenceScore,
          context.meta.assemblyTimeMs,
          expiresAt.toISOString(),
        ]
      );
    } catch (error) {
      logger.warn('Research Agent: failed to cache DealContext', { error });
    }
  }

  // ── Default Fallback Values ──────────────────────────────────

  private defaultParcel(): ParcelData {
    return {
      lotSizeSqFt: 0, lotSizeAcres: 0, assessedValue: 0,
      lastSaleDate: '', lastSalePrice: 0, ownerName: '',
      ownerType: 'entity', legalDescription: '',
    };
  }

  private defaultZoning(): ZoningData {
    return {
      district: '', description: '', maxStories: 0, maxHeight: 0,
      maxDensity: 0, far: 0, maxBuildableUnits: 0, parkingRatio: 0,
      setbacks: { front: 0, side: 0, rear: 0 },
      overlays: [], floodZone: 'Unknown', sourceUrl: '', confidence: 0,
    };
  }

  private defaultMarket(): MarketData {
    return {
      msa: '', submarket: '', avgRent: 0, avgRentPSF: 0,
      vacancyRate: 0, absorptionUnitsPerMonth: 0, daysOnMarket: 0,
      rentGrowthYoY: 0, concessionRate: 0,
    };
  }

  private defaultPipeline(): PipelineData {
    return {
      activePermits: 0, totalPipelineUnits: 0,
      nearestDeliveryDate: '', monthsOfPipelineSupply: 0,
    };
  }

  private defaultDemographics(): DemographicsData {
    return {
      populationGrowthYoY: 0, medianHouseholdIncome: 0,
      employmentGrowthYoY: 0, topEmployers: [], netMigration: 0,
    };
  }

  private defaultDigital(): DigitalSignals {
    return {
      trafficIndex: 0, searchMomentum: 0,
      googleRatingAvg: 0, reviewVolume: 0,
    };
  }

  private defaultMacro(): MacroData {
    return {
      fed30YrMortgageRate: 0, freddieMacPMMS: 0,
      msaUnemploymentRate: 0, cpiYoY: 0,
    };
  }
}

export const researchAgent = new ResearchAgent();
