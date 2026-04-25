/**
 * Property Enrichment Orchestrator
 * 
 * Coordinates both data streams (Property Info + Rent Data) to build
 * complete property profiles. Handles geocoding, provider selection,
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

export class PropertyEnrichmentOrchestrator {
  private propertyInfoRegistry = getPropertyInfoRegistry();
  private rentDataRegistry = getRentDataRegistry();
  
  /**
   * Enrich a property address with both property info and rent data
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
    
    // Step 2: Fetch both streams in parallel
    const [propertyInfoResult, rentDataResult] = await Promise.allSettled([
      // Stream 1: Property Info
      options.skipPropertyInfo 
        ? Promise.resolve({ info: null, provider: null })
        : this.fetchPropertyInfo(address, city, state, options.zip, options.county, job.coordinates),
      
      // Stream 2: Rent Data
      options.skipRentData
        ? Promise.resolve({ data: null, provider: null })
        : this.fetchRentData(address, city, state, options.propertyName)
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
    
    job.completedAt = new Date();
    
    const duration = Date.now() - startTime;
    console.log(`[Enrichment] Completed job ${jobId} in ${duration}ms`);
    console.log(`[Enrichment] Property Info: ${job.propertyInfoStatus} (${job.propertyInfoProvider || 'none'})`);
    console.log(`[Enrichment] Rent Data: ${job.rentDataStatus} (${job.rentDataProvider || 'none'})`);
    
    // Ingest enriched property into Knowledge Graph (fire-and-forget)
    setImmediate(async () => {
      try {
        const { getKnowledgeGraph } = await import('./neural-network/knowledge-graph.service' as any) as any;
        const { getPool } = await import('../../database/connection');
        const kg = getKnowledgeGraph(getPool());
        const pi = job.propertyInfo as any;
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
            yearBuilt: pi?.yearBuilt,
            propertyType: pi?.propertyType,
            assessedValue: pi?.assessedValue,
            ownerName: pi?.ownerName,
            parcelId: pi?.parcelId,
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
   * Build a unified property profile from enrichment job
   */
  buildPropertyProfile(job: EnrichmentJob): PropertyProfile {
    const { propertyInfo, rentData } = job;
    
    // Calculate data quality score
    const { score, missingFields } = this.calculateDataQuality(propertyInfo, rentData);
    
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
      
      // Quality metrics
      dataQualityScore: score,
      missingFields,
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      propertyInfoFetchedAt: propertyInfo?.fetchedAt,
      rentDataFetchedAt: rentData?.fetchedAt
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
    rentData?: RentData
  ): { score: number; missingFields: string[] } {
    const weights = {
      // Property Info (60 points total)
      yearBuilt: 10,
      numberOfUnits: 10,
      livingAreaSqFt: 8,
      zoning: 5,
      justValue: 7,
      ownerName: 5,
      latitude: 5,
      numberOfBuildings: 5,
      acres: 5,
      
      // Rent Data (40 points total)
      unitMix: 15,
      avgAskingRent: 10,
      occupancyPct: 8,
      concessions: 4,
      amenities: 3
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
      
      if (rentData.unitAmenities?.length || rentData.communityAmenities?.length) {
        score += weights.amenities;
      }
    } else {
      missingFields.push('rentData');
    }
    
    return { score, missingFields };
  }
  
  /**
   * Check coverage for a location
   */
  getCoverage(state: string, county?: string): {
    propertyInfo: { hasCoverage: boolean; providers: string[] };
    rentData: { hasCoverage: boolean; providers: string[] };
  } {
    const propertyInfoCoverage = this.propertyInfoRegistry.checkCoverage(state, county);
    const rentDataStats = this.rentDataRegistry.getStats();
    
    return {
      propertyInfo: propertyInfoCoverage,
      rentData: {
        hasCoverage: rentDataStats.enabledProviders > 0,
        providers: rentDataStats.providers.filter(p => p.enabled).map(p => p.name)
      }
    };
  }
  
  /**
   * Health check all providers
   */
  async healthCheck(): Promise<{
    propertyInfo: Map<string, boolean>;
    rentData: Map<string, boolean>;
  }> {
    const [propertyInfoHealth, rentDataHealth] = await Promise.all([
      this.propertyInfoRegistry.healthCheck(),
      this.rentDataRegistry.healthCheck()
    ]);
    
    return {
      propertyInfo: propertyInfoHealth,
      rentData: rentDataHealth
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
