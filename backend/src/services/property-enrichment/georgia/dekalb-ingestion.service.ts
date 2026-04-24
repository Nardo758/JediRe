/**
 * DeKalb County Data Ingestion Service
 * 
 * Endpoints:
 * - Parcels: https://dcgis.dekalbcountyga.gov/mapping/rest/services/TaxParcels/MapServer/0
 * - Permits: https://dcgis.dekalbcountyga.gov/building/rest/services/Building_Permit_Applications/FeatureServer/0
 * 
 * Note: IASWorld endpoints exist but return NULL values
 * Year built: Use CO date from permits as proxy (address match to parcels)
 */

import { v4 as uuidv4 } from 'uuid';
import { ArcGISClient } from './arcgis-client';
import {
  DeKalbParcel,
  DeKalbPermit,
  EnrichedProperty,
  IngestionJob,
  IngestionConfig,
  DEFAULT_INGESTION_CONFIG
} from './types';

const DEKALB_PARCELS_URL = 'https://dcgis.dekalbcountyga.gov/mapping/rest/services/TaxParcels/MapServer';
const DEKALB_PERMITS_URL = 'https://dcgis.dekalbcountyga.gov/building/rest/services/Building_Permit_Applications/FeatureServer';

const LAYER_IDS = {
  PARCELS: 0,
  PERMITS: 0
};

export class DeKalbIngestionService {
  private parcelsClient: ArcGISClient;
  private permitsClient: ArcGISClient;
  
  constructor() {
    this.parcelsClient = new ArcGISClient(DEKALB_PARCELS_URL);
    this.permitsClient = new ArcGISClient(DEKALB_PERMITS_URL);
  }
  
  /**
   * Full ingestion: Parcels + Permits (for year built)
   */
  async ingestAll(config: Partial<IngestionConfig> = {}): Promise<IngestionJob> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    const jobId = uuidv4();
    
    const job: IngestionJob = {
      id: jobId,
      county: 'DeKalb',
      state: 'GA',
      jobType: 'full',
      status: 'running',
      totalRecords: 0,
      processedRecords: 0,
      insertedRecords: 0,
      updatedRecords: 0,
      errorCount: 0,
      errors: [],
      startedAt: new Date()
    };
    
    try {
      console.log('[DeKalb] Starting full ingestion...');
      
      // Step 1: Ingest parcels
      const parcels = await this.ingestParcels(cfg);
      job.totalRecords = parcels.length;
      console.log(`[DeKalb] Loaded ${parcels.length} parcels`);
      
      // Step 2: Build address lookup map for fuzzy matching
      const addressMap = this.buildAddressMap(parcels);
      console.log(`[DeKalb] Built address map with ${addressMap.size} entries`);
      
      // Step 3: Fetch CO permits (for year built)
      const permits = await this.fetchCOPermits(cfg);
      console.log(`[DeKalb] Loaded ${permits.length} CO permits`);
      
      // Step 4: Match permits to parcels by address
      const yearBuiltMap = this.matchPermitsToParcels(permits, addressMap);
      console.log(`[DeKalb] Matched ${yearBuiltMap.size} permits to parcels`);
      
      // Step 5: Enrich and save
      for (const parcel of parcels) {
        try {
          const permitData = yearBuiltMap.get(parcel.PARCELID);
          const enriched = this.buildEnrichedProperty(parcel, permitData);
          
          // TODO: Save to database
          await this.saveProperty(enriched);
          
          job.processedRecords++;
          job.insertedRecords++;
        } catch (error) {
          job.errorCount++;
          job.errors.push(`Parcel ${parcel.PARCELID}: ${error}`);
        }
      }
      
      job.status = 'complete';
      job.completedAt = new Date();
      
    } catch (error) {
      job.status = 'failed';
      job.errors.push(String(error));
      job.completedAt = new Date();
    }
    
    return job;
  }
  
  /**
   * Ingest parcels only
   */
  async ingestParcels(config: Partial<IngestionConfig> = {}): Promise<DeKalbParcel[]> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    
    const parcels = await this.parcelsClient.queryAll<DeKalbParcel>(LAYER_IDS.PARCELS, {
      where: '1=1',
      outFields: ['PARCELID', 'CLASSCD', 'SITEADDRESS', 'OWNERNME1', 
                  'CNTASSDVAL', 'TOTAPR1', 'ZONING'],
      batchSize: cfg.batchSize,
      maxRecords: cfg.maxRecords,
      onProgress: (processed, total) => {
        if (processed % 25000 === 0) {
          console.log(`[DeKalb Parcels] ${processed}/${total}`);
        }
      }
    });
    
    return parcels;
  }
  
  /**
   * Fetch CO (Certificate of Occupancy) permits
   * CO date = year built for new construction
   */
  async fetchCOPermits(config: Partial<IngestionConfig> = {}): Promise<DeKalbPermit[]> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    
    // Filter for permits with CO issued date
    const where = 'cooIssuedDateTime IS NOT NULL';
    
    const permits = await this.permitsClient.queryAll<DeKalbPermit>(LAYER_IDS.PERMITS, {
      where,
      outFields: ['OBJECTID', 'cooIssuedDateTime', 'squareFootage', 
                  'WorkTypeDescription', 'locationLine1', 'PermitNumber', 'PermitType'],
      batchSize: cfg.batchSize,
      maxRecords: cfg.maxRecords,
      onProgress: (processed, total) => {
        if (processed % 10000 === 0) {
          console.log(`[DeKalb Permits] ${processed}/${total}`);
        }
      }
    });
    
    return permits;
  }
  
  /**
   * Build address lookup map for fuzzy matching
   */
  private buildAddressMap(parcels: DeKalbParcel[]): Map<string, DeKalbParcel> {
    const map = new Map<string, DeKalbParcel>();
    
    for (const parcel of parcels) {
      if (parcel.SITEADDRESS) {
        const normalizedAddr = this.normalizeAddress(parcel.SITEADDRESS);
        map.set(normalizedAddr, parcel);
        
        // Also store by street number + partial street name
        const streetNum = this.extractStreetNumber(parcel.SITEADDRESS);
        if (streetNum) {
          const partial = this.extractPartialAddress(parcel.SITEADDRESS);
          if (partial) {
            map.set(`${streetNum}|${partial}`, parcel);
          }
        }
      }
    }
    
    return map;
  }
  
  /**
   * Match permits to parcels by address
   */
  private matchPermitsToParcels(
    permits: DeKalbPermit[],
    addressMap: Map<string, DeKalbParcel>
  ): Map<string, { yearBuilt: number; sqft?: number }> {
    const matches = new Map<string, { yearBuilt: number; sqft?: number }>();
    
    for (const permit of permits) {
      if (!permit.locationLine1 || !permit.cooIssuedDateTime) continue;
      
      // Try exact match first
      const normalizedAddr = this.normalizeAddress(permit.locationLine1);
      let parcel = addressMap.get(normalizedAddr);
      
      // Try partial match
      if (!parcel) {
        const streetNum = this.extractStreetNumber(permit.locationLine1);
        if (streetNum) {
          const partial = this.extractPartialAddress(permit.locationLine1);
          if (partial) {
            parcel = addressMap.get(`${streetNum}|${partial}`);
          }
        }
      }
      
      if (parcel) {
        const yearBuilt = new Date(permit.cooIssuedDateTime).getFullYear();
        
        // Keep most recent CO date as year built
        const existing = matches.get(parcel.PARCELID);
        if (!existing || yearBuilt > existing.yearBuilt) {
          matches.set(parcel.PARCELID, {
            yearBuilt,
            sqft: permit.squareFootage
          });
        }
      }
    }
    
    return matches;
  }
  
  /**
   * Normalize address for matching
   */
  private normalizeAddress(address: string): string {
    return address
      .toUpperCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\bSTREET\b/g, 'ST')
      .replace(/\bAVENUE\b/g, 'AVE')
      .replace(/\bBOULEVARD\b/g, 'BLVD')
      .replace(/\bDRIVE\b/g, 'DR')
      .replace(/\bLANE\b/g, 'LN')
      .replace(/\bROAD\b/g, 'RD')
      .replace(/\bCOURT\b/g, 'CT')
      .replace(/\bCIRCLE\b/g, 'CIR')
      .replace(/\bNORTH\b/g, 'N')
      .replace(/\bSOUTH\b/g, 'S')
      .replace(/\bEAST\b/g, 'E')
      .replace(/\bWEST\b/g, 'W')
      .replace(/\s+/g, ' ');
  }
  
  /**
   * Extract street number from address
   */
  private extractStreetNumber(address: string): string | null {
    const match = address.match(/^(\d+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Extract partial address (first word of street name)
   */
  private extractPartialAddress(address: string): string | null {
    const normalized = this.normalizeAddress(address);
    const withoutNumber = normalized.replace(/^\d+\s+/, '');
    const parts = withoutNumber.split(/\s+/);
    return parts[0] || null;
  }
  
  /**
   * Build enriched property from raw data
   */
  private buildEnrichedProperty(
    parcel: DeKalbParcel,
    permitData?: { yearBuilt: number; sqft?: number }
  ): EnrichedProperty {
    // Detect multifamily from class code
    const isMultifamily = 
      (parcel.CLASSCD || '').startsWith('R4') || // R4 = apartments
      (parcel.CLASSCD || '').startsWith('C4') ||
      (parcel.CLASSCD || '').toLowerCase().includes('apt') ||
      (parcel.CLASSCD || '').toLowerCase().includes('multi');
    
    return {
      parcelId: parcel.PARCELID,
      address: parcel.SITEADDRESS || '',
      county: 'DeKalb',
      state: 'GA',
      
      ownerName: parcel.OWNERNME1 || '',
      
      yearBuilt: permitData?.yearBuilt,
      sqft: permitData?.sqft,
      
      assessedValue: parcel.CNTASSDVAL,
      totalValue: parcel.TOTAPR1,
      
      propertyClass: parcel.CLASSCD,
      zoning: parcel.ZONING,
      isMultifamily,
      
      provider: 'dekalb_ga',
      fetchedAt: new Date()
    };
  }
  
  /**
   * Save enriched property to database
   */
  private async saveProperty(property: EnrichedProperty): Promise<void> {
    // TODO: Implement database insert/update
  }
  
  /**
   * Get parcel by ID
   */
  async getParcelById(parcelId: string): Promise<DeKalbParcel | null> {
    const result = await this.parcelsClient.query<DeKalbParcel>(LAYER_IDS.PARCELS, {
      where: `PARCELID = '${parcelId}'`,
      outFields: '*'
    });
    
    return result.features[0]?.attributes || null;
  }
  
  /**
   * Search permits by address
   */
  async searchPermitsByAddress(address: string): Promise<DeKalbPermit[]> {
    const normalized = this.normalizeAddress(address);
    const result = await this.permitsClient.query<DeKalbPermit>(LAYER_IDS.PERMITS, {
      where: `UPPER(locationLine1) LIKE '%${normalized}%'`,
      outFields: '*'
    });
    
    return result.features.map(f => f.attributes);
  }
}

// Singleton
let dekalbServiceInstance: DeKalbIngestionService | null = null;

export function getDeKalbIngestionService(): DeKalbIngestionService {
  if (!dekalbServiceInstance) {
    dekalbServiceInstance = new DeKalbIngestionService();
  }
  return dekalbServiceInstance;
}
