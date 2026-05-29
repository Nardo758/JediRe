/**
 * Clayton County GA Data Ingestion Service
 *
 * Endpoint:
 *   https://gis.claytoncountyga.gov/server/rest/services/TaxAssessor/Parcels/MapServer/0
 *
 * Mode: parcels_with_sale — parcel attributes AND most recent sale are in the same layer.
 *   Unlike Cobb (which has a separate ParcelSales table with full sale history), Clayton's
 *   public layer exposes only the most recent recorded sale per parcel.
 *
 * Key fields:
 *   PARCELID    — parcel identifier (e.g. "04204 205001")
 *   OWNERNME    — owner name (uppercase)
 *   SITEADDRES  — site address (uppercase, e.g. "505 HALL RD")
 *   SITECITY    — city (uppercase)
 *   SITEZIP5    — zip code
 *   YEARBUILT   — year structure built
 *   SQRFT       — building square footage
 *   APPRVAL     — appraised value (string)
 *   ASSESSVAL   — assessed value (string)
 *   LANDUSEC    — land use code
 *   SALEPRICE   — most recent sale price
 *   SALEDATE    — most recent sale date (epoch ms or date string)
 *
 * Limitations vs. Cobb:
 *   - One sale row per parcel (most recent only, no historical time series)
 *   - No SALEVAL (qualified/unqualified) — qualified defaults to null
 *   - No grantor/grantee names
 *   - No unit count — property_info_cache.number_of_units remains NULL;
 *     unit-based filtering deferred to enrichCapitalMarkets or manual correction
 */

import { v4 as uuidv4 } from 'uuid';
import { ArcGISClient } from './arcgis-client';
import { query as dbQuery, getPool } from '../../../database/connection';
import { createJobRecord, completeJobRecord } from './job-tracker';
import { propertyDualWriteService, isDualWriteEnabled } from '../../property-entity/property-dual-write.service';
import { propertyResolverService } from '../../property-entity/property-resolver.service';
import {
  IngestionJob,
  IngestionConfig,
  DEFAULT_INGESTION_CONFIG,
} from './types';

const CLAYTON_BASE_URL =
  'https://gis.claytoncountyga.gov/server/rest/services/TaxAssessor/Parcels/MapServer';

const LAYER_IDS = {
  PARCELS: 0,  // contains both parcel attributes and most recent sale
};

const MAX_VALID_SALE_PRICE = 500_000_000;
const MIN_VALID_SALE_PRICE = 200_000;

interface ClaytonParcel {
  PARCELID: string;
  OWNERNME?: string;
  SITEADDRES?: string;
  SITECITY?: string;
  SITEZIP5?: string;
  YEARBUILT?: number | string | null;
  SQRFT?: number | string | null;
  APPRVAL?: string | number | null;
  ASSESSVAL?: string | number | null;
  LANDUSEC?: string | null;
  LANDUSED?: string | null;
  SALEPRICE?: number | string | null;
  SALEDATE?: number | string | null;
  // ArcGIS returnCentroid=true sets these
  centroid_x?: number;
  centroid_y?: number;
}

function parseSaleDate(raw: number | string | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    if (raw <= 0) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function safeNum(raw: number | string | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

export class ClaytonIngestionService {
  private client: ArcGISClient;

  constructor() {
    this.client = new ArcGISClient(CLAYTON_BASE_URL);
  }

  /**
   * Full ingestion: query all parcels with a valid sale, write to
   * property_info_cache (parcel attributes) and georgia_property_sales (sale row).
   */
  async ingestAll(config: Partial<IngestionConfig> = {}): Promise<IngestionJob> {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    const jobId = uuidv4();

    const job: IngestionJob = {
      id: jobId,
      county: 'Clayton',
      state: 'GA',
      jobType: 'full',
      status: 'running',
      totalRecords: 0,
      processedRecords: 0,
      insertedRecords: 0,
      updatedRecords: 0,
      errorCount: 0,
      errors: [],
      startedAt: new Date(),
    };

    await createJobRecord(job);

    try {
      console.log('[Clayton] Starting ingestion...');

      const where = `SALEPRICE >= ${MIN_VALID_SALE_PRICE} AND SALEPRICE < ${MAX_VALID_SALE_PRICE}`;

      const parcels = await this.client.queryAll<ClaytonParcel>(LAYER_IDS.PARCELS, {
        where,
        outFields: [
          'PARCELID', 'OWNERNME',
          'SITEADDRES', 'SITECITY', 'SITEZIP5',
          'YEARBUILT', 'SQRFT',
          'APPRVAL', 'ASSESSVAL',
          'LANDUSEC', 'LANDUSED',
          'SALEPRICE', 'SALEDATE',
        ],
        returnCentroid: true,
        outSR: 4326,
        batchSize: cfg.batchSize,
        maxRecords: cfg.maxRecords,
        onProgress: (processed, total) => {
          if (processed % 10000 === 0) {
            console.log(`[Clayton] ${processed}/${total}`);
          }
        },
      });

      job.totalRecords = parcels.length;
      console.log(`[Clayton] Loaded ${parcels.length} parcels with qualifying sales`);

      for (const parcel of parcels) {
        try {
          const saleDate = parseSaleDate(parcel.SALEDATE);
          const salePrice = safeNum(parcel.SALEPRICE);

          if (!parcel.PARCELID || !salePrice || salePrice <= 0 || !saleDate) {
            job.processedRecords++;
            continue;
          }

          await this.saveParcel(parcel);
          await this.saveSale(parcel, saleDate, salePrice);

          job.processedRecords++;
          job.insertedRecords++;
        } catch (err) {
          job.errorCount++;
          job.errors.push(`Parcel ${parcel.PARCELID}: ${err}`);
        }
      }

      job.status = 'complete';
      job.completedAt = new Date();
      await completeJobRecord(job);

      console.log(
        `[Clayton] Done — ${job.insertedRecords} upserted, ${job.errorCount} errors`
      );
    } catch (err) {
      job.status = 'failed';
      job.errors.push(String(err));
      job.completedAt = new Date();
      await completeJobRecord(job);
      console.error('[Clayton] Ingestion failed:', err);
    }

    return job;
  }

  private async saveParcel(parcel: ClaytonParcel): Promise<void> {
    let resolvedPropertyId: string | null = null;
    if (isDualWriteEnabled()) {
      const resolved = await propertyResolverService.resolveByParcel({
        parcelIdRaw: parcel.PARCELID,
        county: 'Clayton',
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
        `INSERT INTO property_info_cache (
          parcel_id, address, city, state, county,
          year_built, living_area_sqft,
          just_value, assessed_value,
          land_use_code, land_use_description,
          property_type,
          owner_name,
          latitude, longitude,
          provider, fetched_at, raw_data
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        ON CONFLICT (parcel_id, county, state) DO UPDATE SET
          year_built           = COALESCE(EXCLUDED.year_built, property_info_cache.year_built),
          living_area_sqft     = COALESCE(EXCLUDED.living_area_sqft, property_info_cache.living_area_sqft),
          just_value           = COALESCE(EXCLUDED.just_value, property_info_cache.just_value),
          assessed_value       = COALESCE(EXCLUDED.assessed_value, property_info_cache.assessed_value),
          land_use_code        = COALESCE(EXCLUDED.land_use_code, property_info_cache.land_use_code),
          land_use_description = COALESCE(EXCLUDED.land_use_description, property_info_cache.land_use_description),
          property_type        = COALESCE(EXCLUDED.property_type, property_info_cache.property_type),
          owner_name           = COALESCE(EXCLUDED.owner_name, property_info_cache.owner_name),
          latitude             = COALESCE(EXCLUDED.latitude, property_info_cache.latitude),
          longitude            = COALESCE(EXCLUDED.longitude, property_info_cache.longitude),
          provider             = EXCLUDED.provider,
          fetched_at           = EXCLUDED.fetched_at,
          updated_at           = NOW()`,
        [
          parcel.PARCELID,
          parcel.SITEADDRES || '',
          parcel.SITECITY || 'Jonesboro',
          'GA',
          'Clayton',
          safeNum(parcel.YEARBUILT),
          safeNum(parcel.SQRFT),
          safeNum(parcel.APPRVAL),
          safeNum(parcel.ASSESSVAL),
          parcel.LANDUSEC || null,
          parcel.LANDUSED || null,
          'other',
          parcel.OWNERNME || null,
          parcel.centroid_y ?? null,
          parcel.centroid_x ?? null,
          'clayton_ga',
          new Date(),
          JSON.stringify({ landUsec: parcel.LANDUSEC }),
        ]
      );

      if (resolvedPropertyId) {
        await propertyDualWriteService.writeCharacteristicsInTx(resolvedPropertyId, {
          parcelId: parcel.PARCELID,
          county: 'Clayton',
          state: 'GA',
          address: parcel.SITEADDRES || null,
          city: parcel.SITECITY || null,
          latitude: parcel.centroid_y ?? null,
          longitude: parcel.centroid_x ?? null,
          yearBuilt: safeNum(parcel.YEARBUILT),
          livingAreaSqft: safeNum(parcel.SQRFT),
          numberOfUnits: null,
          landUseCode: parcel.LANDUSEC || null,
          fetchedAt: new Date(),
          provider: 'clayton_ga',
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

  private async saveSale(
    parcel: ClaytonParcel,
    saleDate: string,
    salePrice: number,
  ): Promise<void> {
    let resolvedPropertyId: string | null = null;
    if (isDualWriteEnabled()) {
      const resolved = await propertyResolverService.resolveByParcel({
        parcelIdRaw: parcel.PARCELID,
        county: 'Clayton',
        state: 'GA',
        createIfMissing: true,
      });
      resolvedPropertyId = resolved?.id ?? null;
    }

    const saleYear = parseInt(saleDate.split('-')[0], 10);
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO georgia_property_sales (
          parcel_id, county, state,
          sale_date, sale_year, sale_price,
          qualified, provider, raw_data
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (parcel_id, county, state, sale_date, sale_price) DO NOTHING`,
        [
          parcel.PARCELID,
          'Clayton',
          'GA',
          saleDate,
          saleYear,
          salePrice,
          null,
          'clayton_ga',
          JSON.stringify({ LANDUSEC: parcel.LANDUSEC }),
        ]
      );

      if (resolvedPropertyId) {
        await propertyDualWriteService.writeSaleInTx(resolvedPropertyId, {
          parcelId: parcel.PARCELID,
          county: 'Clayton',
          state: 'GA',
          saleDate,
          salePrice,
          saleType: null,
          qualified: null,
          provider: 'clayton_ga',
        }, client);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn(`[Clayton] saveSale skip (${parcel.PARCELID}): ${err}`);
    } finally {
      client.release();
    }
  }
}

let claytonServiceInstance: ClaytonIngestionService | null = null;

export function getClaytonIngestionService(): ClaytonIngestionService {
  if (!claytonServiceInstance) {
    claytonServiceInstance = new ClaytonIngestionService();
  }
  return claytonServiceInstance;
}
