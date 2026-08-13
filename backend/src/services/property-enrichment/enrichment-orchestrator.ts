/**
 * Property Enrichment Orchestrator
 * 
 * Coordinates three data streams (Property Info + Rent Data + Building Characteristics)
 * to build complete property profiles. Handles geocoding, provider selection,
 * parallel fetching, and data quality scoring.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PropertyProfile,
  PropertyInfo,
  RentData,
  EnrichmentJob,
  EnrichmentStatus,
  GeocodeResult
} from './types';
import { getPropertyInfoRegistry } from './property-info/provider-registry';
import { getRentDataRegistry } from './rent-data/provider-registry';
import { BuildingCharacteristicsWebProvider } from './building-characteristics/web-research-provider';
import { upsertBuildingProfile } from '../building-profiles/building-profile.service';

export class PropertyEnrichmentOrchestrator {
  private propertyInfoRegistry = getPropertyInfoRegistry();
  private rentDataRegistry = getRentDataRegistry();
  private buildingCharacteristicsProvider = new BuildingCharacteristicsWebProvider();
  
  /**
   * Enrich a property address with all three data streams
   */
  async enrichProperty(
    address: string,
    city: string,
    state: string,
    options: {
      zip?: string;
      county?: string;
      propertyName?: string;
      coordinates?: { lat: number; lng: number };
      skipPropertyInfo?: boolean;
      skipRentData?: boolean;
      skipBuildingCharacteristics?: boolean;
    } = {}
  ): Promise<EnrichmentJob> {
    const jobId = uuidv4();
    const startTime = Date.now();
    
    const job: EnrichmentJob = {
      id: jobId,
      address,
      city,
      state,
      zip: options.zip,
      county: options.county,
      coordinates: options.coordinates,
      propertyInfoStatus: options.skipPropertyInfo ? 'complete' : 'pending',
      rentDataStatus: options.skipRentData ? 'complete' : 'pending',
      buildingCharacteristicsStatus: options.skipBuildingCharacteristics ? 'complete' : 'pending',
      createdAt: new Date(),
      startedAt: new Date()
    };
    
    // Step 1: Geocode if no coordinates provided
    if (!options.coordinates && !options.county) {
      const geocoded = await this.geocodeAddress(address, city, state, options.zip);
      if (geocoded) {
        job.coordinates = { lat: geocoded.latitude, lng: geocoded.longitude };
        job.county = geocoded.county;
      }
    }
    
    // Step 2: Fetch all three streams in parallel
    const [propertyInfoResult, rentDataResult, buildingCharsResult] = await Promise.allSettled([
      // Stream 1: Property Info
      options.skipPropertyInfo 
        ? Promise.resolve({ info: null, provider: null })
        : this.fetchPropertyInfo(address, city, state, options.zip, options.county, job.coordinates),
      
      // Stream 2: Rent Data
      options.skipRentData
        ? Promise.resolve({ data: null, provider: null })
        : this.fetchRentData(address, city, state, options.propertyName),
      
      // Stream 3: Building Characteristics
      options.skipBuildingCharacteristics
        ? Promise.resolve({ data: null })
        : this.fetchBuildingCharacteristics(address, city, state, options)
    ]);
    
    // Process Property Info result
    if (propertyInfoResult.status === 'fulfilled') {
      const { info, provider } = propertyInfoResult.value;
      job.propertyInfo = info || undefined;
      job.propertyInfoProvider = provider || undefined;
      job.propertyInfoStatus = info ? 'complete' : 'failed';
    } else {
      job.propertyInfoStatus = 'failed';
      job.propertyInfoError = propertyInfoResult.reason?.message || 'Unknown error';
    }
    
    // Process Rent Data result
    if (rentDataResult.status === 'fulfilled') {
      const { data, provider } = rentDataResult.value;
      job.rentData = data || undefined;
      job.rentDataProvider = provider || undefined;
      job.rentDataStatus = data ? 'complete' : 'failed';
    } else {
      job.rentDataStatus = 'failed';
      job.rentDataError = rentDataResult.reason?.message || 'Unknown error';
    }
    
    // Process Building Characteristics result
    if (buildingCharsResult.status === 'fulfilled') {
      const { data } = buildingCharsResult.value;
      if (data) {
        job.buildingCharacteristics = data;
        job.buildingCharacteristicsStatus = 'complete';
        job.buildingCharacteristicsProvider = 'web_research';
        
        // Persist to building_profiles via the building profile service (fire-and-forget)
        setImmediate(async () => {
          try {
            await this.persistBuildingCharacteristics(job);
          } catch (persistErr) {
            console.warn('[Enrichment] Building characteristics persist failed (non-fatal):', persistErr);
          }
        });
      } else {
        job.buildingCharacteristicsStatus = 'failed';
      }
    } else {
      job.buildingCharacteristicsStatus = 'failed';
      job.buildingCharacteristicsError = buildingCharsResult.reason?.message || 'Unknown error';
    }
    
    job.completedAt = new Date();
    
    const duration = Date.now() - startTime;
    console.log(`[Enrichment] Completed job ${jobId} in ${duration}ms`);
    console.log(`[Enrichment] Property Info: ${job.propertyInfoStatus} (${job.propertyInfoProvider || 'none'})`);
    console.log(`[Enrichment] Rent Data: ${job.rentDataStatus} (${job.rentDataProvider || 'none'})`);
    console.log(`[Enrichment] Building Characteristics: ${job.buildingCharacteristicsStatus} (${job.buildingCharacteristicsProvider || 'none'})`);
    
    // Ingest enriched property into Knowledge Graph (fire-and-forget)
    setImmediate(async () => {
      try {
        const { getKnowledgeGraph } = await import('./neural-network/knowledge-graph.service' as any) as any;
        const { getPool } = await import('../../database/connection');
        const kg = getKnowledgeGraph(getPool());
        const pi = job.propertyInfo as any;
        const bc = job.buildingCharacteristics;
        await kg.upsertNode({
          type: 'Property',
          externalId: `enriched-${jobId}`,
          name: options.propertyName || address,
          properties: {
            address,
            city,
            state,
            zip: options.zip,
            county: job.county || options.county,
            latitude: job.coordinates?.lat,
            longitude: job.coordinates?.lng,
            units: pi?.units,
            yearBuilt: pi?.yearBuilt ?? bc?.yearBuilt,
            propertyType: pi?.propertyType,
            assessedValue: pi?.assessedValue,
            ownerName: pi?.ownerName,
            parcelId: pi?.parcelId,
            buildingType: bc?.buildingType,
            constructionType: bc?.constructionType,
            parkingType: bc?.parkingType,
            enrichedAt: new Date().toISOString(),
            enrichmentProvider: job.propertyInfoProvider,
          }
        });
        console.log(`[Graph] Enriched property ingested: ${address}`);
      } catch (graphErr) {
        // Non-fatal - enrichment still returned
      }
    });

    return job;
  }
  
  /**
   * Persist building characteristics from an enrichment job to the building_profiles table.
   * Converts web research results into a BuildingProfile and upserts via the service.
   */
  private async persistBuildingCharacteristics(job: EnrichmentJob): Promise<void> {
    const bc = job.buildingCharacteristics;
    if (!bc) return;

    // Need a dealId to write to building_profiles. The enrichment orchestrator
    // operates on addresses, not deals. If the caller hasn't linked this to a
    // deal, we can't persist. Future: accept dealId in enrichProperty options.
    // For now, this is a no-op placeholder — the data-router path (OM ingestion)
    // and explicit deal enrichment API (Piece 2.5) will handle persistence.
    console.log(`[Enrichment] Building characteristics for job ${job.id} not persisted — no dealId linkage in orchestrator`);
  }
  
  /**
   * Build a unified property profile from enrichment job
   */
  buildPropertyProfile(job: EnrichmentJob): PropertyProfile {
    const { propertyInfo, rentData, buildingCharacteristics } = job;
    
    // Calculate data quality score
    const { score, missingFields } = this.calculateDataQuality(propertyInfo, rentData, buildingCharacteristics);
    
    const profile: PropertyProfile = {
      id: job.id,
      
      // Core identity (prefer property info, fallback to job input)
      address: propertyInfo?.address || job.address,
      city: propertyInfo?.city || job.city,
      state: propertyInfo?.state || job.state,
      zip: propertyInfo?.zip || job.zip || '',
      county: propertyInfo?.county || job.county || '',
      propertyName: rentData?.propertyName || propertyInfo?.subdivisionName,
      
      // Coordinates
      latitude: propertyInfo?.latitude || job.coordinates?.lat || 0,
      longitude: propertyInfo?.longitude || job.coordinates?.lng || 0,
      
      // Combined data
      propertyInfo,
      rentData,
      buildingCharacteristics,
      
      // Quality metrics
      dataQualityScore: score,
      missingFields,
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      propertyInfoFetchedAt: propertyInfo?.fetchedAt,
      rentDataFetchedAt: rentData?.fetchedAt,
      buildingCharacteristicsFetchedAt: buildingCharacteristics ? new Date() : undefined
    };
    
    return profile;
  }
  
  /**
   * Fetch property info from the best available provider
   */
  private async fetchPropertyInfo(
    address: string,
    city: string,
    state: string,
    zip?: string,
    county?: string,
    coordinates?: { lat: number; lng: number }
  ): Promise<{ info: PropertyInfo | null; provider: string | null }> {
    return this.propertyInfoRegistry.fetchPropertyInfo(
      address,
      city,
      state,
      zip,
      county,
      coordinates
    );
  }
  
  /**
   * Fetch rent data from the best available provider
   */
  private async fetchRentData(
    address: string,
    city: string,
    state: string,
    propertyName?: string
  ): Promise<{ data: RentData | null; provider: string | null }> {
    return this.rentDataRegistry.fetchRentData(
      address,
      city,
      state,
      propertyName
    );
  }
  
  /**
   * Fetch building characteristics from web research (Stream 3).
   * Only researches fields that county GIS / property info did not provide.
   */
  private async fetchBuildingCharacteristics(
    address: string,
    city: string,
    state: string,
    options: {
      propertyName?: string;
      zip?: string;
    }
  ): Promise<{ data: import('./types').BuildingCharacteristicsData | null }> {
    const result = await this.buildingCharacteristicsProvider.research(
      address,
      city,
      state,
      {
        propertyName: options.propertyName,
        zip: options.zip,
      }
    );
    
    if (result.confidence === 0.0) {
      return { data: null };
    }
    
    return {
      data: {
        yearBuilt: result.yearBuilt,
        stories: result.stories,
        constructionType: result.constructionType,
        buildingType: result.buildingType,
        parkingType: result.parkingType,
        parkingRatio: result.parkingRatio,
        amenities: result.amenities,
        confidence: result.confidence,
        sources: result.sources,
      }
    };
  }
  
  /**
   * Geocode an address to get coordinates and county
   */
  private async geocodeAddress(
    address: string,
    city: string,
    state: string,
    zip?: string
  ): Promise<GeocodeResult | null> {
    // Use Census Geocoder API (free, no API key required)
    try {
      const fullAddress = `${address}, ${city}, ${state}${zip ? ` ${zip}` : ''}`;
      const encoded = encodeURIComponent(fullAddress);
      
      const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encoded}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
      
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const data = await response.json();
      const match = data.result?.addressMatches?.[0];
      
      if (!match) return null;
      
      // Extract county from geography
      const geographies = match.geographies;
      const countyGeo = geographies?.Counties?.[0];
      const countyName = countyGeo?.BASENAME || countyGeo?.NAME || '';
      
      return {
        address: match.matchedAddress || address,
        city: match.addressComponents?.city || city,
        state: match.addressComponents?.state || state,
        zip: match.addressComponents?.zip || zip || '',
        county: countyName,
        latitude: match.coordinates?.y || 0,
        longitude: match.coordinates?.x || 0,
        confidence: 0.9,
        provider: 'census_geocoder'
      };
    } catch (error) {
      console.error('[Enrichment] Geocoding error:', error);
      return null;
    }
  }
  
  /**
   * Calculate data quality score (0-100)
   */
  private calculateDataQuality(
    propertyInfo?: PropertyInfo,
    rentData?: RentData,
    buildingCharacteristics?: import('./types').BuildingCharacteristicsData
  ): { score: number; missingFields: string[] } {
    const weights = {
      // Property Info (50 points total)
      yearBuilt: 8,
      numberOfUnits: 8,
      livingAreaSqFt: 6,
      zoning: 5,
      justValue: 6,
      ownerName: 4,
      latitude: 4,
      numberOfBuildings: 4,
      acres: 5,
      
      // Rent Data (30 points total)
      unitMix: 12,
      avgAskingRent: 8,
      occupancyPct: 6,
      concessions: 4,
      
      // Building Characteristics (20 points total)
      stories: 5,
      constructionType: 5,
      parkingType: 5,
      amenities: 5
    };
    
    let score = 0;
    const missingFields: string[] = [];
    
    // Score property info
    if (propertyInfo) {
      if (propertyInfo.yearBuilt) score += weights.yearBuilt;
      else missingFields.push('yearBuilt');
      
      if (propertyInfo.numberOfUnits) score += weights.numberOfUnits;
      else missingFields.push('numberOfUnits');
      
      if (propertyInfo.livingAreaSqFt) score += weights.livingAreaSqFt;
      else missingFields.push('livingAreaSqFt');
      
      if (propertyInfo.zoning) score += weights.zoning;
      else missingFields.push('zoning');
      
      if (propertyInfo.justValue) score += weights.justValue;
      else missingFields.push('justValue');
      
      if (propertyInfo.ownerName) score += weights.ownerName;
      else missingFields.push('ownerName');
      
      if (propertyInfo.latitude && propertyInfo.longitude) score += weights.latitude;
      else missingFields.push('coordinates');
      
      if (propertyInfo.numberOfBuildings) score += weights.numberOfBuildings;
      else missingFields.push('numberOfBuildings');
      
      if (propertyInfo.acres) score += weights.acres;
      else missingFields.push('acres');
    } else {
      missingFields.push('propertyInfo');
    }
    
    // Score rent data
    if (rentData) {
      if (rentData.unitMix && rentData.unitMix.length > 0) score += weights.unitMix;
      else missingFields.push('unitMix');
      
      if (rentData.avgAskingRent) score += weights.avgAskingRent;
      else missingFields.push('avgAskingRent');
      
      if (rentData.occupancyPct !== undefined) score += weights.occupancyPct;
      else missingFields.push('occupancyPct');
      
      if (rentData.concessions) score += weights.concessions;
      // Concessions are optional, don't mark as missing
    } else {
      missingFields.push('rentData');
    }
    
    // Score building characteristics
    if (buildingCharacteristics) {
      if (buildingCharacteristics.stories) score += weights.stories;
      else missingFields.push('stories');
      
      if (buildingCharacteristics.constructionType) score += weights.constructionType;
      else missingFields.push('constructionType');
      
      if (buildingCharacteristics.parkingType) score += weights.parkingType;
      else missingFields.push('parkingType');
      
      if (buildingCharacteristics.amenities && buildingCharacteristics.amenities.length > 0) score += weights.amenities;
      else missingFields.push('amenities');
    } else {
      missingFields.push('buildingCharacteristics');
    }
    
    return { score, missingFields };
  }
  
  /**
   * Check coverage for a location
   */
  getCoverage(state: string, county?: string): {
    propertyInfo: { hasCoverage: boolean; providers: string[] };
    rentData: { hasCoverage: boolean; providers: string[] };
    buildingCharacteristics: { hasCoverage: boolean; provider: string };
  } {
    const propertyInfoCoverage = this.propertyInfoRegistry.checkCoverage(state, county);
    const rentDataStats = this.rentDataRegistry.getStats();
    
    return {
      propertyInfo: propertyInfoCoverage,
      rentData: {
        hasCoverage: rentDataStats.enabledProviders > 0,
        providers: rentDataStats.providers.filter(p => p.enabled).map(p => p.name)
      },
      buildingCharacteristics: {
        hasCoverage: true,
        provider: 'web_research'
      }
    };
  }
  
  /**
   * Health check all providers
   */
  async healthCheck(): Promise<{
    propertyInfo: Map<string, boolean>;
    rentData: Map<string, boolean>;
    buildingCharacteristics: boolean;
  }> {
    const [propertyInfoHealth, rentDataHealth] = await Promise.all([
      this.propertyInfoRegistry.healthCheck(),
      this.rentDataRegistry.healthCheck()
    ]);
    
    return {
      propertyInfo: propertyInfoHealth,
      rentData: rentDataHealth,
      buildingCharacteristics: true
    };
  }
  
  /**
   * Get statistics about available providers
   */
  getStats(): {
    propertyInfo: ReturnType<typeof getPropertyInfoRegistry.prototype.getCoverageStats>;
    rentData: ReturnType<typeof getRentDataRegistry.prototype.getStats>;
  } {
    return {
      propertyInfo: this.propertyInfoRegistry.getCoverageStats(),
      rentData: this.rentDataRegistry.getStats()
    };
  }
}

// Singleton instance
let orchestratorInstance: PropertyEnrichmentOrchestrator | null = null;

export function getEnrichmentOrchestrator(): PropertyEnrichmentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new PropertyEnrichmentOrchestrator();
  }
  return orchestratorInstance;
}
