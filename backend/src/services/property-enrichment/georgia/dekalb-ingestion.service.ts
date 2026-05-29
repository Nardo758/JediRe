/**
 * DeKalb County Data Ingestion Service
 *
 * Endpoints used:
 *   Parcels (rich)  : https://dcgis.dekalbcountyga.gov/mapping/rest/services/iasWorldParcels/MapServer/0
 *                     Has RESYRBLT, BLDGAREA, RESFLRAREA, FLOORCOUNT, USECD/USEDSCRP, NGHBRHDCD.
 *   Parcels (basic) : https://dcgis.dekalbcountyga.gov/mapping/rest/services/TaxParcels/MapServer/0
 *                     Fallback; fewer fields.
 *   CO Permits      : https://dcgis.dekalbcountyga.gov/building/rest/services/Building_Permit_Applications/FeatureServer/0
 *                     Returns 404 as of 2025 — skip with graceful warning.
 *
 * SALES DATA STATUS — NO PUBLIC ENDPOINT FOUND
 *   DeKalb County's public ArcGIS server (dcgis.dekalbcountyga.gov) does not expose any
 *   property sale/transfer data in any layer. Neither TaxParcels, iasWorldParcels, nor
 *   Tax_Parcels_Assessment_View contain SALEDATE/SALEPRICE fields (confirmed 2025-05-29).
 *   saveSales() is a no-op stub; it will never write to georgia_property_sales until a
 *   replacement endpoint is discovered. promoteGeorgiaSales will produce 0 comps for
 *   DeKalb until that gap is filled.
 *
 *   Possible future sources to investigate:
 *     - DeKalb County ArcGIS Online org (search hub.arcgis.com for "DeKalb County GA sales")
 *     - Georgia PT-61 transfer tax deed records (state-level open data)
 *     - Tyler Technologies iNovah or MUNIS portal (if county publishes externally)
 */

import { v4 as uuidv4 } from 'uuid';
import { ArcGISClient } from './arcgis-client';
import { query as dbQuery, getPool } from '../../../database/connection';
import { createJobRecord, completeJobRecord } from './job-tracker';
import { propertyDualWriteService, isDualWriteEnabled } from '../../property-entity/property-dual-write.service';
import { propertyResolverService } from '../../property-entity/property-resolver.service';
import {
  DeKalbParcel,
  DeKalbPermit,
  EnrichedProperty,
  IngestionJob,
  IngestionConfig,
  DEFAULT_INGESTION_CONFIG
} from './types';

// iasWorldParcels is the richest parcel layer — has RESYRBLT, BLDGAREA, FLOORCOUNT,
// USECD/USEDSCRP. TaxParcels is a lighter fallback. No sale data in either.
const DEKALB_PARCELS_URL = 'https://dcgis.dekalbcountyga.gov/mapping/rest/services/iasWorldParcels/MapServer';
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
    
    await createJobRecord(job);
    
    try {
      console.log('[DeKalb] Starting full ingestion...');
      
      // Step 1: Ingest parcels
      const parcels = await this.ingestParcels(cfg);
      job.totalRecords = parcels.length;
      console.log(`[DeKalb] Loaded ${parcels.length} parcels`);
      
      // Step 2: Build address lookup map for fuzzy matching
      const addressMap = this.buildAddressMap(parcels);
      console.log(`[DeKalb] Built address map with ${addressMap.size} entries`);
      
      // Step 3: Fetch CO permits (for year built) — endpoint may be unavailable
      let yearBuiltMap = new Map<string, any>();
      try {
        const permits = await this.fetchCOPermits(cfg);
        console.log(`[DeKalb] Loaded ${permits.length} CO permits`);
        yearBuiltMap = this.matchPermitsToParcels(permits, addressMap);
        console.log(`[DeKalb] Matched ${yearBuiltMap.size} permits to parcels`);
      } catch (permitErr) {
        console.warn(`[DeKalb] CO permits endpoint unavailable (${(permitErr as Error).message}) — skipping year_built enrichment`);
      }
      
      // Step 5: Enrich and save
      for (const parcel of parcels) {
        try {
          const permitData = yearBuiltMap.get(parcel.PARCELID);
          const enriched = this.buildEnrichedProperty(parcel, permitData);
          
          await this.saveProperty(enriched);

          // Opportunistically save sale record if parcel layer exposed sale fields
          await this.saveSales(parcel);
          
          job.processedRecords++;
          job.insertedRecords++;
        } catch (error) {
          job.errorCount++;
          job.errors.push(`Parcel ${parcel.PARCELID}: ${error}`);
        }
      }
      
      job.status = 'complete';
      job.completedAt = new Date();
      await completeJobRecord(job);
      
    } catch (error) {
      job.status = 'failed';
      job.errors.push(String(error));
      job.completedAt = new Date();
      await completeJobRecord(job);
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
      outFields: [
        'PARCELID', 'LOWPARCELID',
        'CLASSCD', 'CLASSDSCRP',
        'SITEADDRESS', 'CITY',
        'OWNERNME1', 'OWNERNME2',
        'CNTASSDVAL', 'LNDVALUE', 'TOTAPR1',
        'ZONING',
        // iasWorldParcels enrichment fields
        'RESYRBLT', 'BLDGAREA', 'RESFLRAREA', 'FLOORCOUNT',
        'USECD', 'USEDSCRP', 'NGHBRHDCD',
      ],
      returnCentroid: true,
      outSR: 4326,
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
    // Detect multifamily from class code or use description
    const classLower = (parcel.CLASSCD || '').toLowerCase();
    const useDesc = (parcel.USEDSCRP || '').toLowerCase();
    const isMultifamily =
      classLower.startsWith('r4') ||       // R4x = apartments in DeKalb
      classLower.startsWith('c4') ||
      classLower.includes('apt') ||
      classLower.includes('multi') ||
      useDesc.includes('apartment') ||
      useDesc.includes('multifamily') ||
      useDesc.includes('multi-family');

    // Prefer iasWorldParcels RESYRBLT; fall back to permit CO date
    const yearBuilt = parcel.RESYRBLT
      ? Number(parcel.RESYRBLT)
      : permitData?.yearBuilt;

    // Prefer residential floor area; fall back to total building area or permit sqft
    const sqft = parcel.RESFLRAREA
      ? Number(parcel.RESFLRAREA)
      : parcel.BLDGAREA
        ? Number(parcel.BLDGAREA)
        : permitData?.sqft;

    return {
      parcelId: parcel.PARCELID,
      address: parcel.SITEADDRESS || '',
      city: parcel.CITY || '',
      county: 'DeKalb',
      state: 'GA',

      ownerName: parcel.OWNERNME1 || '',

      yearBuilt,
      sqft,
      stories: parcel.FLOORCOUNT ? Number(parcel.FLOORCOUNT) : undefined,

      assessedValue: parcel.CNTASSDVAL,
      totalValue: parcel.TOTAPR1,

      propertyClass: parcel.USECD || parcel.CLASSCD || null,
      zoning: parcel.ZONING || null,
      isMultifamily,

      latitude: parcel.centroid_y ?? undefined,
      longitude: parcel.centroid_x ?? undefined,

      provider: 'dekalb_ga',
      fetchedAt: new Date(),
    };
  }
  
  /**
   * Save enriched property to database
   */
  private async saveProperty(property: EnrichedProperty): Promise<void> {
    // Pre-resolve property entity OUTSIDE transaction (idempotent find-or-create)
    let resolvedPropertyId: string | null = null;
    if (isDualWriteEnabled()) {
      const resolved = await propertyResolverService.resolveByParcel({
        parcelIdRaw: property.parcelId,
        county: property.county,
        state: property.state,
        createIfMissing: true,
      });
      resolvedPropertyId = resolved?.id ?? null;
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO property_info_cache (
          parcel_id, address, city, state, county,
          year_built, living_area_sqft,
          assessed_value, just_value,
          land_use_code, property_type, zoning,
          owner_name,
          latitude, longitude,
          provider, fetched_at, raw_data
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        ON CONFLICT (parcel_id, county, state) DO UPDATE SET
          year_built       = COALESCE(EXCLUDED.year_built, property_info_cache.year_built),
          living_area_sqft = COALESCE(EXCLUDED.living_area_sqft, property_info_cache.living_area_sqft),
          assessed_value   = COALESCE(EXCLUDED.assessed_value, property_info_cache.assessed_value),
          just_value       = COALESCE(EXCLUDED.just_value, property_info_cache.just_value),
          land_use_code    = COALESCE(EXCLUDED.land_use_code, property_info_cache.land_use_code),
          property_type    = COALESCE(EXCLUDED.property_type, property_info_cache.property_type),
          zoning           = COALESCE(EXCLUDED.zoning, property_info_cache.zoning),
          owner_name       = COALESCE(EXCLUDED.owner_name, property_info_cache.owner_name),
          latitude         = COALESCE(EXCLUDED.latitude, property_info_cache.latitude),
          longitude        = COALESCE(EXCLUDED.longitude, property_info_cache.longitude),
          provider         = EXCLUDED.provider,
          fetched_at       = EXCLUDED.fetched_at,
          updated_at       = NOW()`,
        [
          property.parcelId,
          property.address || '',
          property.city || '',
          property.state,
          property.county,
          property.yearBuilt || null,
          property.sqft || null,
          property.assessedValue || null,
          property.totalValue || null,
          property.propertyClass || null,
          property.isMultifamily ? 'multifamily' : 'other',
          property.zoning || null,
          property.ownerName || null,
          property.latitude ?? null,
          property.longitude ?? null,
          property.provider,
          property.fetchedAt,
          JSON.stringify({ isMultifamily: property.isMultifamily }),
        ]
      );

      if (resolvedPropertyId) {
        await propertyDualWriteService.writeCharacteristicsInTx(resolvedPropertyId, {
          parcelId: property.parcelId,
          county: property.county,
          state: property.state,
          address: property.address || null,
          city: property.city || null,
          latitude: property.latitude ?? null,
          longitude: property.longitude ?? null,
          yearBuilt: property.yearBuilt || null,
          livingAreaSqft: property.sqft || null,
          zoning: property.zoning || null,
          landUseCode: property.propertyClass || null,
          fetchedAt: property.fetchedAt,
          provider: property.provider,
        }, client);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Save any sale records found in parcel attributes to georgia_property_sales.
   * DeKalb's main parcel layer may expose LSALEDT/LSALEAMT or SALEDATE/SALEPRICE
   * fields (varies by MapServer version). Rows with no valid price/date are skipped.
   */
  async saveSales(parcel: DeKalbParcel): Promise<void> {
    const rawAmt  = parcel.LSALEAMT  ?? parcel.SALEPRICE ?? parcel.SALEAMT;
    const rawDate = parcel.LSALEDT   ?? parcel.SALEDATE;

    if (!rawAmt || rawAmt <= 0 || !rawDate) return;

    // rawDate may be epoch-ms (> 1e9) or YYYYMMDD integer (< 1e9)
    let saleDate: Date;
    if (rawDate > 1_000_000_000) {
      saleDate = new Date(rawDate);
    } else {
      // YYYYMMDD → "YYYY-MM-DD"
      const s = String(rawDate);
      saleDate = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`);
    }

    if (isNaN(saleDate.getTime())) return;
    if (rawAmt < 200_000) return; // below promote threshold — skip

    const saleDateStr = saleDate.toISOString().split('T')[0];

    // Pre-resolve property entity OUTSIDE transaction (idempotent find-or-create)
    let resolvedPropertyId: string | null = null;
    if (isDualWriteEnabled()) {
      const resolved = await propertyResolverService.resolveByParcel({
        parcelIdRaw: parcel.PARCELID,
        county: 'DeKalb',
        state: 'GA',
        createIfMissing: true,
      });
      resolvedPropertyId = resolved?.id ?? null;
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO georgia_property_sales (
          parcel_id, county, state,
          sale_date, sale_year, sale_price,
          provider
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (parcel_id, county, state, sale_date, sale_price) DO NOTHING`,
        [
          parcel.PARCELID,
          'DeKalb',
          'GA',
          saleDateStr,
          saleDate.getFullYear(),
          rawAmt,
          'dekalb_ga',
        ]
      );

      if (resolvedPropertyId) {
        await propertyDualWriteService.writeSaleInTx(resolvedPropertyId, {
          parcelId: parcel.PARCELID,
          county: 'DeKalb',
          state: 'GA',
          saleDate: saleDateStr,
          salePrice: rawAmt,
          provider: 'dekalb_ga',
        }, client);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn(`[DeKalb] saveSales skip (${parcel.PARCELID}): ${err}`);
    } finally {
      client.release();
    }
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
