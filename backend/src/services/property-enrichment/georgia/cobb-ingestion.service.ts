/**
 * Cobb County Data Ingestion Service
 * 
 * Endpoints:
 * - Parcels: https://gis.cobbcounty.gov/gisserver/rest/services/tax/taxassessorsdaily/MapServer/0
 * - YearBuilt: https://gis.cobbcounty.gov/gisserver/rest/services/tax/taxassessorsdaily/MapServer/5 (Table)
 * - ParcelSales: https://gis.cobbcounty.gov/gisserver/rest/services/tax/taxassessorsdaily/MapServer/9 (Table)
 * 
 * Join: PARID from Parcels → PIN in YearBuilt/ParcelSales
 */

import { v4 as uuidv4 } from 'uuid';
import { ArcGISClient } from './arcgis-client';
import {
  CobbParcel,
  CobbYearBuilt,
  CobbParcelSale,
  PropertySale,
  EnrichedProperty,
  IngestionJob,
  IngestionConfig,
  DEFAULT_INGESTION_CONFIG
} from './types';

const COBB_BASE_URL = 'https://gis.cobbcounty.gov/gisserver/rest/services/tax/taxassessorsdaily/MapServer';

const LAYER_IDS = {
  PARCELS: 0,
  YEAR_BUILT: 5,  // Table
  PARCEL_SALES: 9  // Table
};

// Max sale price filter (exclude $6B data error)
const MAX_VALID_SALE_PRICE = 500_000_000;

export class CobbIngestionService {
  private client: ArcGISClient;
  
  constructor() {
    this.client = new ArcGISClient(COBB_BASE_URL);
  }
  
  /**
   * Full ingestion: Parcels + YearBuilt + Sales
   */
  async ingestAll(config: Partial<IngestionConfig> = {}): Promise<IngestionJob> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    const jobId = uuidv4();
    
    const job: IngestionJob = {
      id: jobId,
      county: 'Cobb',
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
      console.log('[Cobb] Starting full ingestion...');
      
      // Step 1: Ingest parcels
      const parcels = await this.ingestParcels(cfg);
      job.totalRecords = parcels.length;
      console.log(`[Cobb] Loaded ${parcels.length} parcels`);
      
      // Step 2: Get all PARIDs for joining
      const parcelIds = parcels.map(p => p.PARID).filter(Boolean);
      
      // Step 3: Fetch YearBuilt data
      const yearBuiltMap = await this.fetchYearBuiltByIds(parcelIds, cfg);
      console.log(`[Cobb] Loaded ${yearBuiltMap.size} year built records`);
      
      // Step 4: Fetch Sales data
      const salesMap = await this.fetchSalesByIds(parcelIds, cfg);
      console.log(`[Cobb] Loaded sales for ${salesMap.size} parcels`);
      
      // Step 5: Enrich and save
      for (const parcel of parcels) {
        try {
          const yearBuilt = yearBuiltMap.get(parcel.PARID);
          const sales = salesMap.get(parcel.PARID) || [];
          
          const enriched = this.buildEnrichedProperty(parcel, yearBuilt, sales);
          
          // TODO: Save to database
          await this.saveProperty(enriched);
          
          if (sales.length > 0) {
            await this.saveSales(parcel.PARID, sales);
          }
          
          job.processedRecords++;
          job.insertedRecords++;
        } catch (error) {
          job.errorCount++;
          job.errors.push(`Parcel ${parcel.PARID}: ${error}`);
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
  async ingestParcels(config: Partial<IngestionConfig> = {}): Promise<CobbParcel[]> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    
    let where = '1=1';
    if (cfg.filterMultifamilyOnly) {
      where = "HAS_MULTIUNIT = 'Y'";
    }
    
    const parcels = await this.client.queryAll<CobbParcel>(LAYER_IDS.PARCELS, {
      where,
      outFields: ['PIN', 'PARID', 'SITUS_ADDR', 'OWNER_NAM1', 'OWNER_NAM2',
                  'FMV_LAND', 'FMV_BLDG', 'FMV_TOTAL', 'ASV_TOTAL', 
                  'CLASS', 'HAS_MULTIUNIT'],
      batchSize: cfg.batchSize,
      maxRecords: cfg.maxRecords,
      onProgress: (processed, total) => {
        if (processed % 10000 === 0) {
          console.log(`[Cobb Parcels] ${processed}/${total}`);
        }
      }
    });
    
    return parcels;
  }
  
  /**
   * Ingest sales only (927K records!)
   */
  async ingestSales(config: Partial<IngestionConfig> = {}): Promise<IngestionJob> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    const jobId = uuidv4();
    
    const job: IngestionJob = {
      id: jobId,
      county: 'Cobb',
      state: 'GA',
      jobType: 'sales',
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
      // Filter out bad data: PRICE < $500M and PRICE > 0
      const where = `PRICE > 0 AND PRICE < ${MAX_VALID_SALE_PRICE}`;
      
      const sales = await this.client.queryAll<CobbParcelSale>(LAYER_IDS.PARCEL_SALES, {
        where,
        outFields: ['PIN', 'SALEDT', 'PRICE', 'SALETYPE', 'SALEVAL', 
                    'INSTRTYP', 'APRTOT', 'ASR', 'NBHD'],
        batchSize: cfg.batchSize,
        maxRecords: cfg.maxRecords,
        onProgress: (processed, total) => {
          if (processed % 50000 === 0) {
            console.log(`[Cobb Sales] ${processed}/${total}`);
          }
        }
      });
      
      job.totalRecords = sales.length;
      
      // Group by PIN and save
      const salesByPin = new Map<string, CobbParcelSale[]>();
      for (const sale of sales) {
        if (!salesByPin.has(sale.PIN)) {
          salesByPin.set(sale.PIN, []);
        }
        salesByPin.get(sale.PIN)!.push(sale);
      }
      
      for (const [pin, parcelSales] of salesByPin) {
        try {
          await this.saveSales(pin, parcelSales);
          job.processedRecords += parcelSales.length;
          job.insertedRecords += parcelSales.length;
        } catch (error) {
          job.errorCount++;
          job.errors.push(`PIN ${pin}: ${error}`);
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
   * Fetch YearBuilt records by PARID
   */
  private async fetchYearBuiltByIds(
    parcelIds: string[],
    config: IngestionConfig
  ): Promise<Map<string, CobbYearBuilt>> {
    // For efficiency, query all and filter
    const allYearBuilt = await this.client.queryAll<CobbYearBuilt>(LAYER_IDS.YEAR_BUILT, {
      where: '1=1',
      outFields: ['PIN', 'TAXYR', 'CARD', 'YRBLT', 'SQFT'],
      batchSize: config.batchSize,
      onProgress: (processed, total) => {
        if (processed % 50000 === 0) {
          console.log(`[Cobb YearBuilt] ${processed}/${total}`);
        }
      }
    });
    
    // Build map by PIN (most recent tax year takes precedence)
    const map = new Map<string, CobbYearBuilt>();
    const parcelIdSet = new Set(parcelIds);
    
    for (const yb of allYearBuilt) {
      if (parcelIdSet.has(yb.PIN)) {
        const existing = map.get(yb.PIN);
        if (!existing || yb.TAXYR > existing.TAXYR) {
          map.set(yb.PIN, yb);
        }
      }
    }
    
    return map;
  }
  
  /**
   * Fetch Sales records by PARID
   */
  private async fetchSalesByIds(
    parcelIds: string[],
    config: IngestionConfig
  ): Promise<Map<string, CobbParcelSale[]>> {
    // Query all valid sales
    const where = `PRICE > 0 AND PRICE < ${MAX_VALID_SALE_PRICE}`;
    
    const allSales = await this.client.queryAll<CobbParcelSale>(LAYER_IDS.PARCEL_SALES, {
      where,
      outFields: ['PIN', 'SALEDT', 'PRICE', 'SALETYPE', 'SALEVAL', 
                  'INSTRTYP', 'APRTOT', 'ASR', 'NBHD'],
      batchSize: config.batchSize,
      onProgress: (processed, total) => {
        if (processed % 100000 === 0) {
          console.log(`[Cobb Sales] ${processed}/${total}`);
        }
      }
    });
    
    // Group by PIN
    const map = new Map<string, CobbParcelSale[]>();
    const parcelIdSet = new Set(parcelIds);
    
    for (const sale of allSales) {
      if (parcelIdSet.has(sale.PIN)) {
        if (!map.has(sale.PIN)) {
          map.set(sale.PIN, []);
        }
        map.get(sale.PIN)!.push(sale);
      }
    }
    
    // Sort sales by date descending
    for (const sales of map.values()) {
      sales.sort((a, b) => (b.SALEDT || 0) - (a.SALEDT || 0));
    }
    
    return map;
  }
  
  /**
   * Build enriched property from raw data
   */
  private buildEnrichedProperty(
    parcel: CobbParcel,
    yearBuilt?: CobbYearBuilt,
    sales?: CobbParcelSale[]
  ): EnrichedProperty {
    return {
      parcelId: parcel.PARID,
      address: parcel.SITUS_ADDR || '',
      county: 'Cobb',
      state: 'GA',
      
      ownerName: parcel.OWNER_NAM1 || '',
      ownerName2: parcel.OWNER_NAM2,
      
      yearBuilt: yearBuilt?.YRBLT,
      sqft: yearBuilt?.SQFT,
      
      landValue: parcel.FMV_LAND,
      buildingValue: parcel.FMV_BLDG,
      totalValue: parcel.FMV_TOTAL,
      assessedValue: parcel.ASV_TOTAL,
      
      propertyClass: parcel.CLASS,
      isMultifamily: parcel.HAS_MULTIUNIT === 'Y',
      
      sales: sales?.map(s => this.mapSale(parcel.PARID, s)),
      
      provider: 'cobb_ga',
      fetchedAt: new Date()
    };
  }
  
  /**
   * Map raw sale to PropertySale
   */
  private mapSale(parcelId: string, sale: CobbParcelSale): PropertySale {
    return {
      parcelId,
      county: 'Cobb',
      state: 'GA',
      saleDate: sale.SALEDT ? new Date(sale.SALEDT) : new Date(0),
      salePrice: sale.PRICE || 0,
      saleType: sale.SALETYPE,
      qualified: sale.SALEVAL === 'Q'
    };
  }
  
  /**
   * Save enriched property to database
   */
  private async saveProperty(property: EnrichedProperty): Promise<void> {
    // TODO: Implement database insert/update
    // INSERT INTO property_info_cache (...) VALUES (...)
    // ON CONFLICT (parcel_id, county, state) DO UPDATE SET ...
  }
  
  /**
   * Save sales to database
   */
  private async saveSales(parcelId: string, sales: CobbParcelSale[]): Promise<void> {
    // TODO: Implement database insert
    // INSERT INTO property_sales (...) VALUES (...)
    // ON CONFLICT DO NOTHING
  }
  
  /**
   * Get multifamily properties only
   */
  async getMultifamilyParcels(limit?: number): Promise<CobbParcel[]> {
    return this.client.queryAll<CobbParcel>(LAYER_IDS.PARCELS, {
      where: "HAS_MULTIUNIT = 'Y'",
      outFields: '*',
      maxRecords: limit
    });
  }
  
  /**
   * Get sales for a specific parcel
   */
  async getSalesForParcel(parid: string): Promise<CobbParcelSale[]> {
    const result = await this.client.query<CobbParcelSale>(LAYER_IDS.PARCEL_SALES, {
      where: `PIN = '${parid}' AND PRICE > 0 AND PRICE < ${MAX_VALID_SALE_PRICE}`,
      outFields: '*'
    });
    
    return result.features.map(f => f.attributes);
  }
  
  /**
   * Get year built for a specific parcel
   */
  async getYearBuiltForParcel(parid: string): Promise<CobbYearBuilt | null> {
    const result = await this.client.query<CobbYearBuilt>(LAYER_IDS.YEAR_BUILT, {
      where: `PIN = '${parid}'`,
      outFields: '*',
      orderByFields: 'TAXYR DESC',
      resultRecordCount: 1
    });
    
    return result.features[0]?.attributes || null;
  }
}

// Singleton
let cobbServiceInstance: CobbIngestionService | null = null;

export function getCobbIngestionService(): CobbIngestionService {
  if (!cobbServiceInstance) {
    cobbServiceInstance = new CobbIngestionService();
  }
  return cobbServiceInstance;
}
