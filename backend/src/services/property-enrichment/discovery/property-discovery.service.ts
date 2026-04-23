/**
 * Property Discovery Service
 * 
 * Automatically discovers multifamily properties (100+ units) from municipal APIs.
 * Runs on a schedule to build and maintain a database of large apartment communities.
 */

import { v4 as uuidv4 } from 'uuid';
import { getPropertyInfoRegistry } from '../property-info/provider-registry';
import { PropertyInfo, CountyAPIConfig } from '../types';
import { COUNTY_CONFIGS } from '../property-info/county-configs';

export interface DiscoveredProperty {
  id: string;
  parcelId: string;
  address: string;
  city: string;
  state: string;
  county: string;
  zip?: string;
  
  // Discovery Data
  propertyName?: string;
  numberOfUnits?: number;
  numberOfBuildings?: number;
  yearBuilt?: number;
  livingAreaSqFt?: number;
  acres?: number;
  propertyType: string;
  
  // Owner
  ownerName?: string;
  ownerCity?: string;
  ownerState?: string;
  
  // Valuation
  justValue?: number;
  buildingValue?: number;
  
  // Status
  matchStatus: 'unmatched' | 'matched' | 'manual_review';
  apartmentLocatorId?: string;
  apartmentLocatorName?: string;
  matchConfidence?: number;
  
  // Metadata
  discoveredAt: Date;
  provider: string;
  lastUpdated: Date;
}

export interface DiscoveryJob {
  id: string;
  county: string;
  state: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  propertiesFound: number;
  propertiesNew: number;
  propertiesUpdated: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
}

export class PropertyDiscoveryService {
  private registry = getPropertyInfoRegistry();
  
  /**
   * Discover large multifamily properties in a county
   */
  async discoverInCounty(
    county: string,
    state: string,
    options: {
      minUnits?: number;
      minBuildings?: number;
      minSqFt?: number;
      propertyTypes?: string[];
      yearBuiltAfter?: number;
    } = {}
  ): Promise<DiscoveryJob> {
    const jobId = uuidv4();
    const minUnits = options.minUnits ?? 100;
    const minBuildings = options.minBuildings ?? 3;
    
    const job: DiscoveryJob = {
      id: jobId,
      county,
      state,
      status: 'running',
      propertiesFound: 0,
      propertiesNew: 0,
      propertiesUpdated: 0,
      errors: [],
      startedAt: new Date()
    };
    
    console.log(`[Discovery] Starting discovery in ${county}, ${state} (min ${minUnits} units)`);
    
    try {
      // Get county config
      const config = this.getCountyConfig(county, state);
      if (!config) {
        job.status = 'failed';
        job.errors.push(`No provider config for ${county}, ${state}`);
        return job;
      }
      
      // Build query for large multifamily properties
      const properties = await this.queryLargeMultifamily(config, {
        minUnits,
        minBuildings,
        minSqFt: options.minSqFt,
        yearBuiltAfter: options.yearBuiltAfter
      });
      
      job.propertiesFound = properties.length;
      console.log(`[Discovery] Found ${properties.length} properties in ${county}, ${state}`);
      
      // Process and store each property
      for (const prop of properties) {
        try {
          const existing = await this.findExistingProperty(prop.parcelId, county, state);
          
          if (existing) {
            await this.updateDiscoveredProperty(existing.id, prop);
            job.propertiesUpdated++;
          } else {
            await this.saveDiscoveredProperty(prop);
            job.propertiesNew++;
          }
        } catch (error) {
          job.errors.push(`Error processing ${prop.address}: ${error}`);
        }
      }
      
      job.status = 'complete';
      job.completedAt = new Date();
      
    } catch (error) {
      job.status = 'failed';
      job.errors.push(String(error));
    }
    
    return job;
  }
  
  /**
   * Query municipal API for large multifamily properties
   */
  private async queryLargeMultifamily(
    config: CountyAPIConfig,
    filters: {
      minUnits?: number;
      minBuildings?: number;
      minSqFt?: number;
      yearBuiltAfter?: number;
    }
  ): Promise<DiscoveredProperty[]> {
    const properties: DiscoveredProperty[] = [];
    const mappings = config.fieldMappings;
    
    // Build WHERE clause for multifamily properties
    const whereClauses: string[] = [];
    
    // Property type filter - look for multifamily land use codes
    if (mappings.landUseCode) {
      // Common multifamily DOR codes: 003XX, 004XX, 100X
      whereClauses.push(
        `(${mappings.landUseCode} LIKE '003%' OR ${mappings.landUseCode} LIKE '004%' OR ${mappings.landUseCode} LIKE '100%')`
      );
    } else if (mappings.landUseDescription) {
      whereClauses.push(
        `(UPPER(${mappings.landUseDescription}) LIKE '%MULTIFAMILY%' OR UPPER(${mappings.landUseDescription}) LIKE '%APARTMENT%')`
      );
    }
    
    // Unit count filter
    if (filters.minUnits && mappings.numberOfUnits) {
      whereClauses.push(`${mappings.numberOfUnits} >= ${filters.minUnits}`);
    }
    
    // Building count filter (fallback if units not available)
    if (filters.minBuildings && mappings.numberOfBuildings) {
      whereClauses.push(`${mappings.numberOfBuildings} >= ${filters.minBuildings}`);
    }
    
    // Square footage filter
    if (filters.minSqFt && mappings.livingArea) {
      whereClauses.push(`${mappings.livingArea} >= ${filters.minSqFt}`);
    }
    
    // Year built filter
    if (filters.yearBuiltAfter && mappings.yearBuilt) {
      whereClauses.push(`${mappings.yearBuilt} >= ${filters.yearBuiltAfter}`);
    }
    
    // Combine clauses
    const whereClause = whereClauses.length > 0 
      ? whereClauses.join(' AND ')
      : "1=1";
    
    // Query the parcels layer
    const url = `${config.parcelsEndpoint}/${config.parcelsLayerId}/query?` +
      new URLSearchParams({
        where: whereClause,
        outFields: '*',
        returnGeometry: 'false',
        resultRecordCount: '500', // Limit per query
        f: 'json'
      });
    
    console.log(`[Discovery] Querying: ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'API Error');
      }
      
      if (!data.features || data.features.length === 0) {
        return [];
      }
      
      // Map features to DiscoveredProperty
      for (const feature of data.features) {
        const attrs = feature.attributes || feature;
        
        const prop = this.mapToDiscoveredProperty(attrs, config);
        
        // Apply post-query filters (in case API doesn't support all filters)
        if (filters.minUnits && prop.numberOfUnits && prop.numberOfUnits < filters.minUnits) {
          continue;
        }
        if (filters.minBuildings && prop.numberOfBuildings && prop.numberOfBuildings < filters.minBuildings) {
          continue;
        }
        
        properties.push(prop);
      }
      
    } catch (error) {
      console.error(`[Discovery] Query error:`, error);
      throw error;
    }
    
    return properties;
  }
  
  /**
   * Map raw API data to DiscoveredProperty
   */
  private mapToDiscoveredProperty(
    attrs: Record<string, unknown>,
    config: CountyAPIConfig
  ): DiscoveredProperty {
    const mappings = config.fieldMappings;
    
    const getValue = (field?: string): unknown => {
      return field ? attrs[field] : undefined;
    };
    
    const parseNumber = (value: unknown): number | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[,\$]/g, ''));
      return isNaN(num) ? undefined : num;
    };
    
    const parseString = (value: unknown): string | undefined => {
      if (value === null || value === undefined) return undefined;
      const str = String(value).trim();
      return str === '' ? undefined : str;
    };
    
    return {
      id: uuidv4(),
      parcelId: parseString(getValue(mappings.parcelId)) || '',
      address: parseString(getValue(mappings.fullAddress)) || '',
      city: parseString(getValue(mappings.city)) || 
            parseString(attrs['SITE_MAILING_CITY']) ||
            parseString(attrs['SITE_CITY']) || '',
      state: config.state,
      county: config.county,
      zip: parseString(getValue(mappings.zip)) ||
           parseString(attrs['SITE_ZIP']) ||
           parseString(attrs['ZIP_CODE5']),
      
      propertyName: parseString(getValue(mappings.subdivisionName)),
      numberOfUnits: parseNumber(getValue(mappings.numberOfUnits)),
      numberOfBuildings: parseNumber(getValue(mappings.numberOfBuildings)),
      yearBuilt: parseNumber(getValue(mappings.yearBuilt)),
      livingAreaSqFt: parseNumber(getValue(mappings.livingArea)),
      acres: parseNumber(getValue(mappings.acres)),
      propertyType: 'multifamily',
      
      ownerName: parseString(getValue(mappings.ownerName)),
      ownerCity: parseString(getValue(mappings.ownerCity)),
      ownerState: parseString(getValue(mappings.ownerState)),
      
      justValue: parseNumber(getValue(mappings.justValue)),
      buildingValue: parseNumber(getValue(mappings.buildingValue)),
      
      matchStatus: 'unmatched',
      discoveredAt: new Date(),
      provider: `${config.county.toLowerCase()}_${config.state.toLowerCase()}`,
      lastUpdated: new Date()
    };
  }
  
  /**
   * Get county config
   */
  private getCountyConfig(county: string, state: string): CountyAPIConfig | undefined {
    const normalizedCounty = county.toUpperCase().replace(/\s+COUNTY$/i, '').trim();
    const normalizedState = state.toUpperCase().trim();
    
    return COUNTY_CONFIGS.find(config => {
      const configCounty = config.county.toUpperCase();
      const configState = config.state.toUpperCase();
      return configCounty === normalizedCounty && configState === normalizedState;
    });
  }
  
  /**
   * Find existing discovered property by parcel ID
   */
  private async findExistingProperty(
    parcelId: string,
    county: string,
    state: string
  ): Promise<{ id: string } | null> {
    // TODO: Query database
    // SELECT id FROM discovered_properties WHERE parcel_id = $1 AND county = $2 AND state = $3
    return null;
  }
  
  /**
   * Save newly discovered property
   */
  private async saveDiscoveredProperty(property: DiscoveredProperty): Promise<void> {
    // TODO: Insert into database
    console.log(`[Discovery] New property: ${property.address} (${property.numberOfUnits || '?'} units)`);
  }
  
  /**
   * Update existing discovered property
   */
  private async updateDiscoveredProperty(id: string, property: DiscoveredProperty): Promise<void> {
    // TODO: Update in database
    console.log(`[Discovery] Updated property: ${property.address}`);
  }
  
  /**
   * Run discovery across all configured counties
   */
  async discoverAll(options: {
    minUnits?: number;
    states?: string[];
    counties?: string[];
  } = {}): Promise<DiscoveryJob[]> {
    const jobs: DiscoveryJob[] = [];
    
    for (const config of COUNTY_CONFIGS) {
      // Filter by state if specified
      if (options.states && !options.states.includes(config.state)) {
        continue;
      }
      
      // Filter by county if specified
      if (options.counties && !options.counties.includes(config.county)) {
        continue;
      }
      
      const job = await this.discoverInCounty(config.county, config.state, {
        minUnits: options.minUnits ?? 100
      });
      
      jobs.push(job);
      
      // Rate limiting between counties
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return jobs;
  }
  
  /**
   * Get discovery statistics
   */
  async getStats(): Promise<{
    totalDiscovered: number;
    byCounty: Record<string, number>;
    byMatchStatus: Record<string, number>;
    recentDiscoveries: number;
  }> {
    // TODO: Query database for stats
    return {
      totalDiscovered: 0,
      byCounty: {},
      byMatchStatus: { unmatched: 0, matched: 0, manual_review: 0 },
      recentDiscoveries: 0
    };
  }
}

// Singleton
let discoveryInstance: PropertyDiscoveryService | null = null;

export function getPropertyDiscoveryService(): PropertyDiscoveryService {
  if (!discoveryInstance) {
    discoveryInstance = new PropertyDiscoveryService();
  }
  return discoveryInstance;
}
