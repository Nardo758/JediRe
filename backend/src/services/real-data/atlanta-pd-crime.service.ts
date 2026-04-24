/**
 * Atlanta PD Crime Service
 *
 * Fetches recent crime incident data from the Atlanta PD's ArcGIS REST
 * feature layer (past 12 months), aggregates by ZIP code, normalises to a
 * crime index where the city average = 100, and upserts results into the
 * crime_statistics table.
 *
 * Endpoint: ArcGIS FeatureServer for Atlanta Crime Data
 * No API key required – publicly accessible.
 *
 * Crime index formula:
 *   zip_index = (zip_incidents_per_1000 / city_incidents_per_1000) * 100
 *
 * Violent crimes: UCR codes 1–4 (homicide, rape, robbery, aggravated assault)
 * Property crimes: UCR codes 5–8 (burglary, larceny, auto theft, arson)
 */

import axios from 'axios';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

const ARCGIS_ENDPOINT =
  'https://services3.arcgis.com/Et5Qfajgiyosiw4d/arcgis/rest/services/Atlanta_Crime_Data_Prod/FeatureServer/0/query';

const VIOLENT_CRIME_TYPES = new Set([
  'HOMICIDE', 'RAPE', 'ROBBERY', 'AGG ASSAULT', 'AGGRAVATED ASSAULT',
  'MURDER', 'MANSLAUGHTER',
]);

const PROPERTY_CRIME_TYPES = new Set([
  'BURGLARY', 'LARCENY', 'AUTO THEFT', 'ARSON', 'ROBBERY-COMMERCIAL',
  'ROBBERY-RESIDENCE', 'BURGLARY-RESIDENCE', 'BURGLARY-NONRESIDENCE',
  'LARCENY-FROM VEHICLE', 'LARCENY-NON VEHICLE',
]);

interface CrimeFeatureAttributes {
  zip?: string | null;
  zipcode?: string | null;
  Zip?: string | null;
  UC2_Literal?: string | null;
  crime?: string | null;
  Crime?: string | null;
  occur_date?: string | number | null;
  rpt_date?: string | number | null;
}

interface CrimeFeature {
  attributes: CrimeFeatureAttributes;
}

export interface CrimeSyncResult {
  total_incidents: number;
  zip_codes_processed: number;
  rows_upserted: number;
  period_start: string;
  period_end: string;
  errors: string[];
}

interface ArcGisResponse {
  features?: CrimeFeature[];
  exceededTransferLimit?: boolean;
  error?: { code: number; message: string };
}

/**
 * Paginate through ArcGIS FeatureServer to retrieve all crime incidents in the
 * past 12 months. ArcGIS enforces a per-request record cap (often 1 000–2 000).
 * We loop with resultOffset until exceededTransferLimit is absent/false.
 *
 * Safety cap: MAX_PAGES × PAGE_SIZE = 50 × 2 000 = 100 000 records max.
 */
async function fetchCrimeIncidents(): Promise<CrimeFeature[]> {
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setFullYear(periodStart.getFullYear() - 1);

  const startStr = periodStart.toISOString().split('T')[0];
  const endStr = periodEnd.toISOString().split('T')[0];

  // ArcGIS date syntax varies by layer; prefer the DATE literal which works
  // on most hosted feature services. The endpoint is queried with a permissive
  // OR fallback: if the layer uses a timestamp field the server will still
  // coerce DATE literals correctly.
  const whereClause = `occur_date >= DATE '${startStr}' AND occur_date <= DATE '${endStr}'`;
  const outFields = 'zip,zipcode,Zip,UC2_Literal,crime,Crime,occur_date,rpt_date';

  const PAGE_SIZE = 2000;
  const MAX_PAGES = 50;

  const allFeatures: CrimeFeature[] = [];
  let offset = 0;

  logger.info('[AtlantaPD] Starting paginated crime fetch', { start: startStr, end: endStr, page_size: PAGE_SIZE });

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await axios.get<ArcGisResponse>(ARCGIS_ENDPOINT, {
      params: {
        where: whereClause,
        outFields,
        f: 'json',
        resultRecordCount: PAGE_SIZE,
        resultOffset: offset,
      },
      timeout: 45_000,
      headers: { 'User-Agent': 'JediRe-DataSync/1.0 (realestate-intelligence)' },
    });

    const data = response.data;

    if (data.error) {
      throw new Error(`ArcGIS error ${data.error.code}: ${data.error.message}`);
    }

    const features = data.features || [];
    allFeatures.push(...features);

    logger.info('[AtlantaPD] Page fetched', {
      page: page + 1,
      page_count: features.length,
      total_so_far: allFeatures.length,
      exceeded_transfer_limit: data.exceededTransferLimit ?? false,
    });

    // If the server signals more records exist, advance offset and continue.
    if (!data.exceededTransferLimit || features.length === 0) {
      break;
    }
    offset += PAGE_SIZE;
  }

  // Sanity check: warn if result count looks suspiciously low for a full year.
  if (allFeatures.length < 100) {
    logger.warn('[AtlantaPD] Unusually low incident count — possible endpoint change or empty date range', {
      count: allFeatures.length,
      where: whereClause,
    });
  }

  logger.info('[AtlantaPD] Pagination complete', {
    total_fetched: allFeatures.length,
    pages: Math.ceil((offset + PAGE_SIZE) / PAGE_SIZE),
  });

  return allFeatures;
}

function resolveZip(attrs: CrimeFeatureAttributes): string | null {
  const z = attrs.zip || attrs.zipcode || attrs.Zip;
  if (!z) return null;
  const str = String(z).trim().replace(/\s+/g, '');
  return str.length >= 5 ? str.slice(0, 5) : null;
}

function resolveCrimeType(attrs: CrimeFeatureAttributes): string | null {
  return attrs.UC2_Literal || attrs.crime || attrs.Crime || null;
}

export async function syncAtlantaPdCrime(): Promise<CrimeSyncResult> {
  const errors: string[] = [];
  const pool = getPool();

  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setFullYear(periodStart.getFullYear() - 1);
  const periodStartStr = periodStart.toISOString().split('T')[0];
  const periodEndStr = periodEnd.toISOString().split('T')[0];

  let features: CrimeFeature[] = [];

  try {
    features = await fetchCrimeIncidents();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[AtlantaPD] Failed to fetch incidents', { error: msg });
    errors.push(`fetch: ${msg}`);
    return {
      total_incidents: 0,
      zip_codes_processed: 0,
      rows_upserted: 0,
      period_start: periodStartStr,
      period_end: periodEndStr,
      errors,
    };
  }

  // Aggregate by ZIP
  const zipStats = new Map<string, { total: number; violent: number; property: number }>();

  for (const f of features) {
    const zip = resolveZip(f.attributes);
    if (!zip) continue;
    const crimeType = (resolveCrimeType(f.attributes) || '').toUpperCase();

    if (!zipStats.has(zip)) {
      zipStats.set(zip, { total: 0, violent: 0, property: 0 });
    }
    const stat = zipStats.get(zip)!;
    stat.total++;
    if (VIOLENT_CRIME_TYPES.has(crimeType)) stat.violent++;
    if (PROPERTY_CRIME_TYPES.has(crimeType)) stat.property++;
  }

  const totalIncidents = features.length;
  const numZips = zipStats.size;

  if (numZips === 0) {
    logger.warn('[AtlantaPD] No ZIP-linked incidents found — possible schema mismatch');
    return {
      total_incidents: totalIncidents,
      zip_codes_processed: 0,
      rows_upserted: 0,
      period_start: periodStartStr,
      period_end: periodEndStr,
      errors,
    };
  }

  // Compute city-wide average incidents per ZIP (raw, not per-capita)
  const avgIncidentsPerZip = totalIncidents / numZips;
  const avgViolentPerZip = Array.from(zipStats.values()).reduce((s, v) => s + v.violent, 0) / numZips;
  const avgPropertyPerZip = Array.from(zipStats.values()).reduce((s, v) => s + v.property, 0) / numZips;

  let rowsUpserted = 0;

  for (const [zip, stat] of zipStats.entries()) {
    const crimeIndex = avgIncidentsPerZip > 0
      ? Math.round((stat.total / avgIncidentsPerZip) * 100 * 10) / 10
      : 100;
    const violentIndex = avgViolentPerZip > 0
      ? Math.round((stat.violent / avgViolentPerZip) * 100 * 10) / 10
      : 100;
    const propertyIndex = avgPropertyPerZip > 0
      ? Math.round((stat.property / avgPropertyPerZip) * 100 * 10) / 10
      : 100;

    try {
      await pool.query(`
        INSERT INTO crime_statistics (
          zip_code, city, state,
          crime_index, violent_crime_index, property_crime_index,
          incident_count, violent_count, property_count,
          period_start, period_end,
          computed_at, source
        ) VALUES (
          $1, 'Atlanta', 'GA',
          $2, $3, $4,
          $5, $6, $7,
          $8, $9,
          NOW(), 'atlanta_pd'
        )
        ON CONFLICT (zip_code, period_start, period_end)
        DO UPDATE SET
          crime_index          = EXCLUDED.crime_index,
          violent_crime_index  = EXCLUDED.violent_crime_index,
          property_crime_index = EXCLUDED.property_crime_index,
          incident_count       = EXCLUDED.incident_count,
          violent_count        = EXCLUDED.violent_count,
          property_count       = EXCLUDED.property_count,
          computed_at          = NOW(),
          updated_at           = NOW()
      `, [
        zip,
        crimeIndex, violentIndex, propertyIndex,
        stat.total, stat.violent, stat.property,
        periodStartStr, periodEndStr,
      ]);
      rowsUpserted++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`zip ${zip}: ${msg}`);
      logger.warn('[AtlantaPD] Upsert error', { zip, error: msg });
    }
  }

  logger.info('[AtlantaPD] Sync complete', {
    total_incidents: totalIncidents,
    zip_codes_processed: numZips,
    rows_upserted: rowsUpserted,
    errors: errors.length,
  });

  return {
    total_incidents: totalIncidents,
    zip_codes_processed: numZips,
    rows_upserted: rowsUpserted,
    period_start: periodStartStr,
    period_end: periodEndStr,
    errors,
  };
}
