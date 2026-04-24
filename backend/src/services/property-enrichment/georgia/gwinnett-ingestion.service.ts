/**
 * Gwinnett County Data Ingestion Service
 * 
 * Base: https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer
 * 
 * Layers/Tables:
 * - Layer 0: Parcels (PIN, TAXPIN, LRSN, ADDRESS)
 * - Table 3: Tax Master (LRSN, owner, value, grantor)
 * - Table 8: Property Improvements (LRSN, YRBUILT, STORIES, FINSIZE)
 * - Table 10: Land Value (LRSN, 3 historical sales)
 * 
 * Join Key: LRSN (NOT PIN - formats differ)
 */

import { v4 as uuidv4 } from 'uuid';
import { ArcGISClient } from './arcgis-client';
import {
  GwinnettParcel,
  GwinnettTaxMaster,
  GwinnettPropertyImprovement,
  GwinnettLandValue,
  PropertySale,
  EnrichedProperty,
  IngestionJob,
  IngestionConfig,
  DEFAULT_INGESTION_CONFIG
} from './types';

const GWINNETT_BASE_URL = 'https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer';

const LAYER_IDS = {
  PARCELS: 0,
  TAX_MASTER: 3,        // Table
  IMPROVEMENTS: 8,       // Table
  LAND_VALUE: 10         // Table - has up to 3 historical sales
};

export class GwinnettIngestionService {
  private client: ArcGISClient;
  
  constructor() {
    this.client = new ArcGISClient(GWINNETT_BASE_URL);
  }
  
  /**
   * Full ingestion: Parcels + Tax Master + Improvements + Sales
   */
  async ingestAll(config: Partial<IngestionConfig> = {}): Promise<IngestionJob> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    const jobId = uuidv4();
    
    const job: IngestionJob = {
      id: jobId,
      county: 'Gwinnett',
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
      console.log('[Gwinnett] Starting full ingestion...');
      
      // Step 1: Ingest parcels
      const parcels = await this.ingestParcels(cfg);
      job.totalRecords = parcels.length;
      console.log(`[Gwinnett] Loaded ${parcels.length} parcels`);
      
      // Step 2: Get all LRSNs for joining
      const lrsnIds = parcels.map(p => p.LRSN).filter(Boolean);
      const lrsnSet = new Set(lrsnIds);
      
      // Step 3: Fetch Tax Master data
      const taxMasterMap = await this.fetchTaxMasterAll(lrsnSet, cfg);
      console.log(`[Gwinnett] Loaded ${taxMasterMap.size} tax master records`);
      
      // Step 4: Fetch Improvements data
      const improvementsMap = await this.fetchImprovementsAll(lrsnSet, cfg);
      console.log(`[Gwinnett] Loaded ${improvementsMap.size} improvement records`);
      
      // Step 5: Fetch Land Value (sales) data
      const landValueMap = await this.fetchLandValueAll(lrsnSet, cfg);
      console.log(`[Gwinnett] Loaded ${landValueMap.size} land value records`);
      
      // Step 6: Enrich and save
      for (const parcel of parcels) {
        try {
          const taxMaster = taxMasterMap.get(parcel.LRSN);
          const improvements = improvementsMap.get(parcel.LRSN);
          const landValue = landValueMap.get(parcel.LRSN);
          
          const enriched = this.buildEnrichedProperty(parcel, taxMaster, improvements, landValue);
          
          // TODO: Save to database
          await this.saveProperty(enriched);
          
          // Save sales from land value
          if (landValue) {
            const sales = this.extractSalesFromLandValue(parcel.LRSN, landValue);
            if (sales.length > 0) {
              await this.saveSales(parcel.LRSN, sales);
            }
          }
          
          job.processedRecords++;
          job.insertedRecords++;
        } catch (error) {
          job.errorCount++;
          job.errors.push(`LRSN ${parcel.LRSN}: ${error}`);
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
  async ingestParcels(config: Partial<IngestionConfig> = {}): Promise<GwinnettParcel[]> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    
    const parcels = await this.client.queryAll<GwinnettParcel>(LAYER_IDS.PARCELS, {
      where: '1=1',
      outFields: ['PIN', 'TAXPIN', 'LRSN', 'ADDRESS'],
      batchSize: cfg.batchSize,
      maxRecords: cfg.maxRecords,
      onProgress: (processed, total) => {
        if (processed % 10000 === 0) {
          console.log(`[Gwinnett Parcels] ${processed}/${total}`);
        }
      }
    });
    
    return parcels;
  }
  
  /**
   * Get apartments only (USECODE = 'APART')
   */
  async getApartments(limit?: number): Promise<GwinnettPropertyImprovement[]> {
    const result = await this.client.queryAll<GwinnettPropertyImprovement>(LAYER_IDS.IMPROVEMENTS, {
      where: "USECODE = 'APART'",
      outFields: '*',
      maxRecords: limit,
      onProgress: (processed, total) => {
        console.log(`[Gwinnett Apartments] ${processed}/${total}`);
      }
    });
    
    return result;
  }
  
  /**
   * Fetch all Tax Master records
   */
  private async fetchTaxMasterAll(
    lrsnSet: Set<string>,
    config: IngestionConfig
  ): Promise<Map<string, GwinnettTaxMaster>> {
    const allRecords = await this.client.queryAll<GwinnettTaxMaster>(LAYER_IDS.TAX_MASTER, {
      where: '1=1',
      outFields: ['LRSN', 'OWNER1', 'OWNER2', 'TOTVAL1', 'PROPCLAS', 
                  'PCDESC', 'ZONING', 'GRANTOR1', 'GRANTOR2', 'GRANTOR3', 'DOC1REF'],
      batchSize: config.batchSize,
      onProgress: (processed, total) => {
        if (processed % 50000 === 0) {
          console.log(`[Gwinnett Tax Master] ${processed}/${total}`);
        }
      }
    });
    
    const map = new Map<string, GwinnettTaxMaster>();
    for (const record of allRecords) {
      if (lrsnSet.has(record.LRSN)) {
        map.set(record.LRSN, record);
      }
    }
    
    return map;
  }
  
  /**
   * Fetch all Property Improvements records
   */
  private async fetchImprovementsAll(
    lrsnSet: Set<string>,
    config: IngestionConfig
  ): Promise<Map<string, GwinnettPropertyImprovement>> {
    const allRecords = await this.client.queryAll<GwinnettPropertyImprovement>(LAYER_IDS.IMPROVEMENTS, {
      where: '1=1',
      outFields: ['LRSN', 'YRBUILT', 'STORIES', 'FINSIZE', 'USECODE', 
                  'USEDESC', 'CONDCODE', 'NUMBDRMS'],
      batchSize: config.batchSize,
      onProgress: (processed, total) => {
        if (processed % 50000 === 0) {
          console.log(`[Gwinnett Improvements] ${processed}/${total}`);
        }
      }
    });
    
    const map = new Map<string, GwinnettPropertyImprovement>();
    for (const record of allRecords) {
      if (lrsnSet.has(record.LRSN)) {
        // Keep most recent/best record (highest sqft for multifamily)
        const existing = map.get(record.LRSN);
        if (!existing || (record.FINSIZE || 0) > (existing.FINSIZE || 0)) {
          map.set(record.LRSN, record);
        }
      }
    }
    
    return map;
  }
  
  /**
   * Fetch all Land Value records (contains sales history)
   */
  private async fetchLandValueAll(
    lrsnSet: Set<string>,
    config: IngestionConfig
  ): Promise<Map<string, GwinnettLandValue>> {
    const allRecords = await this.client.queryAll<GwinnettLandValue>(LAYER_IDS.LAND_VALUE, {
      where: '1=1',
      outFields: ['LRSN', 'SALE1D', 'SALE1AMT', 'SALE2D', 'SALE2AMT', 
                  'SALE3D', 'SALE3AMT', 'GRANTOR1', 'GRANTOR2', 'GRANTOR3', 'NUMDWLG'],
      batchSize: config.batchSize,
      onProgress: (processed, total) => {
        if (processed % 50000 === 0) {
          console.log(`[Gwinnett Land Value] ${processed}/${total}`);
        }
      }
    });
    
    const map = new Map<string, GwinnettLandValue>();
    for (const record of allRecords) {
      if (lrsnSet.has(record.LRSN)) {
        map.set(record.LRSN, record);
      }
    }
    
    return map;
  }
  
  /**
   * Extract up to 3 sales from Land Value record
   */
  private extractSalesFromLandValue(lrsn: string, landValue: GwinnettLandValue): PropertySale[] {
    const sales: PropertySale[] = [];
    
    if (landValue.SALE1D && landValue.SALE1AMT) {
      sales.push({
        parcelId: lrsn,
        county: 'Gwinnett',
        state: 'GA',
        saleDate: new Date(landValue.SALE1D),
        salePrice: landValue.SALE1AMT,
        grantorName: landValue.GRANTOR1
      });
    }
    
    if (landValue.SALE2D && landValue.SALE2AMT) {
      sales.push({
        parcelId: lrsn,
        county: 'Gwinnett',
        state: 'GA',
        saleDate: new Date(landValue.SALE2D),
        salePrice: landValue.SALE2AMT,
        grantorName: landValue.GRANTOR2
      });
    }
    
    if (landValue.SALE3D && landValue.SALE3AMT) {
      sales.push({
        parcelId: lrsn,
        county: 'Gwinnett',
        state: 'GA',
        saleDate: new Date(landValue.SALE3D),
        salePrice: landValue.SALE3AMT,
        grantorName: landValue.GRANTOR3
      });
    }
    
    return sales;
  }
  
  /**
   * Build enriched property from raw data
   */
  private buildEnrichedProperty(
    parcel: GwinnettParcel,
    taxMaster?: GwinnettTaxMaster,
    improvements?: GwinnettPropertyImprovement,
    landValue?: GwinnettLandValue
  ): EnrichedProperty {
    const isMultifamily = 
      improvements?.USECODE === 'APART' ||
      (taxMaster?.PCDESC || '').toLowerCase().includes('apart') ||
      (landValue?.NUMDWLG || 0) > 4;
    
    return {
      parcelId: parcel.LRSN,
      address: parcel.ADDRESS || '',
      county: 'Gwinnett',
      state: 'GA',
      
      ownerName: taxMaster?.OWNER1 || '',
      ownerName2: taxMaster?.OWNER2,
      
      yearBuilt: improvements?.YRBUILT,
      sqft: improvements?.FINSIZE,
      stories: improvements?.STORIES,
      units: landValue?.NUMDWLG,
      
      totalValue: taxMaster?.TOTVAL1,
      
      propertyClass: taxMaster?.PROPCLAS,
      zoning: taxMaster?.ZONING,
      isMultifamily,
      
      sales: landValue ? this.extractSalesFromLandValue(parcel.LRSN, landValue) : [],
      
      provider: 'gwinnett_ga',
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
   * Save sales to database
   */
  private async saveSales(lrsn: string, sales: PropertySale[]): Promise<void> {
    // TODO: Implement database insert
  }
  
  /**
   * Get property by LRSN with all joined data
   */
  async getPropertyByLRSN(lrsn: string): Promise<EnrichedProperty | null> {
    // Get parcel
    const parcelResult = await this.client.query<GwinnettParcel>(LAYER_IDS.PARCELS, {
      where: `LRSN = '${lrsn}'`,
      outFields: '*'
    });
    
    if (!parcelResult.features[0]) return null;
    const parcel = parcelResult.features[0].attributes;
    
    // Get joined data
    const [taxResult, impResult, landResult] = await Promise.all([
      this.client.query<GwinnettTaxMaster>(LAYER_IDS.TAX_MASTER, {
        where: `LRSN = '${lrsn}'`, outFields: '*'
      }),
      this.client.query<GwinnettPropertyImprovement>(LAYER_IDS.IMPROVEMENTS, {
        where: `LRSN = '${lrsn}'`, outFields: '*'
      }),
      this.client.query<GwinnettLandValue>(LAYER_IDS.LAND_VALUE, {
        where: `LRSN = '${lrsn}'`, outFields: '*'
      })
    ]);
    
    return this.buildEnrichedProperty(
      parcel,
      taxResult.features[0]?.attributes,
      impResult.features[0]?.attributes,
      landResult.features[0]?.attributes
    );
  }
}

// Singleton
let gwinnettServiceInstance: GwinnettIngestionService | null = null;

export function getGwinnettIngestionService(): GwinnettIngestionService {
  if (!gwinnettServiceInstance) {
    gwinnettServiceInstance = new GwinnettIngestionService();
  }
  return gwinnettServiceInstance;
}
