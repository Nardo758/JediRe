/**
 * Fulton County Data Ingestion Service
 * 
 * Endpoints:
 * - Tax Parcels: https://services1.arcgis.com/.../Tax_Parcels_2025/FeatureServer/0
 * - Tyler TaxParcels: https://services1.arcgis.com/.../Tyler_TaxParcels/FeatureServer/0
 * - Tyler YearlySales: https://services1.arcgis.com/.../Tyler_YearlySales/FeatureServer (2018-2022)
 * - Structures: https://services1.arcgis.com/.../Structures/FeatureServer/0 (requires spatial join)
 * - Building Permits: https://services5.arcgis.com/.../Building_Permit_latest/FeatureServer/0
 * 
 * Note: Structures.FeatureID ≠ ParcelID - must use spatial intersection
 */

import { v4 as uuidv4 } from 'uuid';
import { ArcGISClient } from './arcgis-client';
import { query as dbQuery } from '../../../database/connection';
import {
  FultonParcel,
  FultonYearlySale,
  FultonStructure,
  PropertySale,
  EnrichedProperty,
  IngestionJob,
  IngestionConfig,
  DEFAULT_INGESTION_CONFIG
} from './types';

// Fulton uses multiple ArcGIS Online organization endpoints
const FULTON_TAX_PARCELS_URL = 'https://services1.arcgis.com/jXZcOJp6qFkhsZyH/arcgis/rest/services/Tax_Parcels_2025/FeatureServer';
const FULTON_TYLER_PARCELS_URL = 'https://services1.arcgis.com/jXZcOJp6qFkhsZyH/arcgis/rest/services/Tyler_TaxParcels/FeatureServer';
const FULTON_YEARLY_SALES_URL = 'https://services1.arcgis.com/jXZcOJp6qFkhsZyH/arcgis/rest/services/Tyler_YearlySales/FeatureServer';
const FULTON_STRUCTURES_URL = 'https://services1.arcgis.com/jXZcOJp6qFkhsZyH/arcgis/rest/services/Structures/FeatureServer';
const FULTON_PERMITS_URL = 'https://services5.arcgis.com/IEb2rKlMbCUnXEeH/arcgis/rest/services/Building_Permit_latest/FeatureServer';

const LAYER_IDS = {
  PARCELS: 0,
  SALES: 0,
  STRUCTURES: 0,
  PERMITS: 0
};

export class FultonIngestionService {
  private parcelsClient: ArcGISClient;
  private tylerParcelsClient: ArcGISClient;
  private salesClient: ArcGISClient;
  private structuresClient: ArcGISClient;
  private permitsClient: ArcGISClient;
  
  constructor() {
    this.parcelsClient = new ArcGISClient(FULTON_TAX_PARCELS_URL);
    this.tylerParcelsClient = new ArcGISClient(FULTON_TYLER_PARCELS_URL);
    this.salesClient = new ArcGISClient(FULTON_YEARLY_SALES_URL);
    this.structuresClient = new ArcGISClient(FULTON_STRUCTURES_URL);
    this.permitsClient = new ArcGISClient(FULTON_PERMITS_URL);
  }
  
  /**
   * Full ingestion: Parcels + Sales (no spatial join - handled separately)
   */
  async ingestAll(config: Partial<IngestionConfig> = {}): Promise<IngestionJob> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    const jobId = uuidv4();
    
    const job: IngestionJob = {
      id: jobId,
      county: 'Fulton',
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
      console.log('[Fulton] Starting full ingestion...');
      
      // Step 1: Ingest parcels
      const parcels = await this.ingestParcels(cfg);
      job.totalRecords = parcels.length;
      console.log(`[Fulton] Loaded ${parcels.length} parcels`);
      
      // Step 2: Get parcel IDs for joining
      const parcelIds = parcels.map(p => p.ParcelID).filter(Boolean);
      const parcelIdSet = new Set(parcelIds);
      
      // Step 3: Fetch sales
      const salesMap = await this.fetchSalesAll(parcelIdSet, cfg);
      console.log(`[Fulton] Loaded sales for ${salesMap.size} parcels`);
      
      // Step 4: Enrich and save (structures require spatial join)
      for (const parcel of parcels) {
        try {
          const sales = salesMap.get(parcel.ParcelID) || [];
          const enriched = this.buildEnrichedProperty(parcel, sales);
          
          // TODO: Save to database
          await this.saveProperty(enriched);
          
          if (sales.length > 0) {
            await this.saveSales(parcel.ParcelID, sales);
          }
          
          job.processedRecords++;
          job.insertedRecords++;
        } catch (error) {
          job.errorCount++;
          job.errors.push(`Parcel ${parcel.ParcelID}: ${error}`);
        }
      }
      
      job.status = 'complete';
      job.completedAt = new Date();
      
      // Note: Structures spatial join should be done in PostGIS separately
      console.log('[Fulton] Note: Run spatial join for structures separately using PostGIS');
      
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
  async ingestParcels(config: Partial<IngestionConfig> = {}): Promise<FultonParcel[]> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    
    const parcels = await this.parcelsClient.queryAll<FultonParcel>(LAYER_IDS.PARCELS, {
      where: '1=1',
      outFields: ['ParcelID', 'LivUnits', 'TotAppr', 'LUCode'],
      batchSize: cfg.batchSize,
      maxRecords: cfg.maxRecords,
      onProgress: (processed, total) => {
        if (processed % 25000 === 0) {
          console.log(`[Fulton Parcels] ${processed}/${total}`);
        }
      }
    });
    
    return parcels;
  }
  
  /**
   * Ingest sales only (2018-2022)
   */
  async ingestSales(config: Partial<IngestionConfig> = {}): Promise<IngestionJob> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    const jobId = uuidv4();
    
    const job: IngestionJob = {
      id: jobId,
      county: 'Fulton',
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
      const sales = await this.salesClient.queryAll<FultonYearlySale>(LAYER_IDS.SALES, {
        where: 'Price > 0',
        outFields: ['ParID', 'Price', 'TaxYear'],
        batchSize: cfg.batchSize,
        maxRecords: cfg.maxRecords,
        onProgress: (processed, total) => {
          if (processed % 25000 === 0) {
            console.log(`[Fulton Sales] ${processed}/${total}`);
          }
        }
      });
      
      job.totalRecords = sales.length;
      
      // Group by parcel and save
      const salesByParcel = new Map<string, FultonYearlySale[]>();
      for (const sale of sales) {
        if (!salesByParcel.has(sale.ParID)) {
          salesByParcel.set(sale.ParID, []);
        }
        salesByParcel.get(sale.ParID)!.push(sale);
      }
      
      for (const [parId, parcelSales] of salesByParcel) {
        try {
          const mapped = parcelSales.map(s => this.mapSale(parId, s));
          await this.saveSales(parId, mapped);
          job.processedRecords += parcelSales.length;
          job.insertedRecords += parcelSales.length;
        } catch (error) {
          job.errorCount++;
          job.errors.push(`ParID ${parId}: ${error}`);
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
   * Fetch structures (for spatial join later)
   * These need to be loaded into PostGIS for ST_Intersects with parcels
   */
  async fetchStructures(config: Partial<IngestionConfig> = {}): Promise<FultonStructure[]> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    
    const structures = await this.structuresClient.queryAll<FultonStructure>(LAYER_IDS.STRUCTURES, {
      where: '1=1',
      outFields: ['FeatureID', 'YearBuilt', 'Stories', 'LiveUnits', 'AreaSqFt'],
      returnGeometry: true,
      batchSize: cfg.batchSize,
      maxRecords: cfg.maxRecords,
      onProgress: (processed, total) => {
        if (processed % 50000 === 0) {
          console.log(`[Fulton Structures] ${processed}/${total}`);
        }
      }
    });
    
    return structures;
  }
  
  /**
   * Fetch all sales and group by parcel
   */
  private async fetchSalesAll(
    parcelIdSet: Set<string>,
    config: IngestionConfig
  ): Promise<Map<string, PropertySale[]>> {
    const allSales = await this.salesClient.queryAll<FultonYearlySale>(LAYER_IDS.SALES, {
      where: 'Price > 0',
      outFields: ['ParID', 'Price', 'TaxYear'],
      batchSize: config.batchSize,
      onProgress: (processed, total) => {
        if (processed % 25000 === 0) {
          console.log(`[Fulton Sales] ${processed}/${total}`);
        }
      }
    });
    
    const map = new Map<string, PropertySale[]>();
    
    for (const sale of allSales) {
      if (parcelIdSet.has(sale.ParID)) {
        if (!map.has(sale.ParID)) {
          map.set(sale.ParID, []);
        }
        map.get(sale.ParID)!.push(this.mapSale(sale.ParID, sale));
      }
    }
    
    // Sort sales by date descending
    for (const sales of map.values()) {
      sales.sort((a, b) => b.saleDate.getTime() - a.saleDate.getTime());
    }
    
    return map;
  }
  
  /**
   * Map sale to PropertySale
   */
  private mapSale(parcelId: string, sale: FultonYearlySale): PropertySale {
    // TaxYear is the year of the sale (Tyler data)
    const saleDate = new Date(sale.TaxYear, 0, 1); // Jan 1 of tax year
    
    return {
      parcelId,
      county: 'Fulton',
      state: 'GA',
      saleDate,
      salePrice: sale.Price || 0
    };
  }
  
  /**
   * Build enriched property from raw data
   */
  private buildEnrichedProperty(
    parcel: FultonParcel,
    sales: PropertySale[]
  ): EnrichedProperty {
    // Detect multifamily from land use code or living units
    const isMultifamily = 
      (parcel.LivUnits || 0) > 4 ||
      (parcel.LUCode || '').toLowerCase().includes('multi') ||
      (parcel.LUCode || '').toLowerCase().includes('apt');
    
    return {
      parcelId: parcel.ParcelID,
      address: '', // Tax Parcels doesn't have address - need join
      county: 'Fulton',
      state: 'GA',
      
      ownerName: '', // Need Tyler_TaxParcels for owner
      
      units: parcel.LivUnits,
      totalValue: parcel.TotAppr,
      
      propertyClass: parcel.LUCode,
      isMultifamily,
      
      sales,
      
      provider: 'fulton_ga',
      fetchedAt: new Date()
    };
  }
  
  /**
   * Save enriched property to database
   */
  private async saveProperty(property: EnrichedProperty): Promise<void> {
    await dbQuery(
      `INSERT INTO property_info_cache (
        parcel_id, address, city, state, county,
        number_of_units, just_value,
        land_use_code, property_type,
        owner_name,
        provider, fetched_at, raw_data
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (parcel_id, county, state) DO UPDATE SET
        number_of_units  = COALESCE(EXCLUDED.number_of_units, property_info_cache.number_of_units),
        just_value       = COALESCE(EXCLUDED.just_value, property_info_cache.just_value),
        land_use_code    = COALESCE(EXCLUDED.land_use_code, property_info_cache.land_use_code),
        property_type    = COALESCE(EXCLUDED.property_type, property_info_cache.property_type),
        owner_name       = COALESCE(EXCLUDED.owner_name, property_info_cache.owner_name),
        provider         = EXCLUDED.provider,
        fetched_at       = EXCLUDED.fetched_at,
        updated_at       = NOW()`,
      [
        property.parcelId,
        property.address || '',
        property.city || '',
        property.state,
        property.county,
        property.units || null,
        property.totalValue || null,
        property.propertyClass || null,
        property.isMultifamily ? 'multifamily' : 'other',
        property.ownerName || null,
        property.provider,
        property.fetchedAt,
        JSON.stringify({ isMultifamily: property.isMultifamily, luCode: property.propertyClass })
      ]
    );
  }

  /**
   * Save sales to database
   */
  private async saveSales(parcelId: string, sales: PropertySale[]): Promise<void> {
    for (const sale of sales) {
      if (!sale.salePrice || sale.salePrice <= 0) continue;
      if (!sale.saleDate || isNaN(sale.saleDate.getTime())) continue;
      try {
        await dbQuery(
          `INSERT INTO georgia_property_sales (
            parcel_id, county, state,
            sale_date, sale_year, sale_price,
            provider
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (parcel_id, county, state, sale_date, sale_price) DO NOTHING`,
          [
            parcelId,
            sale.county,
            sale.state,
            sale.saleDate.toISOString().split('T')[0],
            sale.saleDate.getFullYear(),
            sale.salePrice,
            'fulton_ga'
          ]
        );
      } catch (err) {
        console.warn(`[Fulton] saveSales skip (${parcelId}): ${err}`);
      }
    }
  }
  
  /**
   * Get sales for a specific parcel
   */
  async getSalesForParcel(parcelId: string): Promise<FultonYearlySale[]> {
    const result = await this.salesClient.query<FultonYearlySale>(LAYER_IDS.SALES, {
      where: `ParID = '${parcelId}' AND Price > 0`,
      outFields: '*',
      orderByFields: 'TaxYear DESC'
    });
    
    return result.features.map(f => f.attributes);
  }
  
  /**
   * Generate SQL for spatial join of structures to parcels
   * This should be run in PostGIS after loading structures
   */
  getStructuresSpatialJoinSQL(): string {
    return `
-- Run this in PostGIS after loading Fulton parcels and structures
-- Requires geometry columns to be populated

UPDATE property_info_cache pic
SET 
  year_built = s.year_built,
  stories = s.stories,
  number_of_units = COALESCE(pic.number_of_units, s.live_units),
  living_area_sqft = s.area_sqft
FROM fulton_structures s
JOIN fulton_parcels p ON ST_Intersects(s.geometry, p.geometry)
WHERE pic.parcel_id = p.parcel_id
  AND pic.county = 'Fulton'
  AND pic.state = 'GA'
  AND pic.year_built IS NULL;
    `.trim();
  }
}

// Singleton
let fultonServiceInstance: FultonIngestionService | null = null;

export function getFultonIngestionService(): FultonIngestionService {
  if (!fultonServiceInstance) {
    fultonServiceInstance = new FultonIngestionService();
  }
  return fultonServiceInstance;
}
