/**
 * Atlanta MSA County Property Import
 *
 * Pulls property records from county ArcGIS REST services
 * into the property_records table (upsert on parcel_id).
 *
 * County status (ArcGIS endpoints):
 *   ✅ Fulton  — services1.arcgis.com — Tax_Parcels_2025 — full attributes
 *   ✅ DeKalb  — dcgis.dekalbcountyga.gov — Parcels/MapServer/0 — full attributes
 *   ⚠️  Cobb    — services.arcgis.com — CobbParcelsCopy041425/FeatureServer/1
 *                  geometry + parcel IDs only (no address/owner in this layer)
 *   ⚠️  Gwinnett — gis3.gwinnettcounty.com — GC_Parcel/MapServer/6
 *                  server blocks outbound requests from non-browser IPs;
 *                  works in-browser — retry from a scheduled job behind a proxy
 *
 * Run manually or nightly via M28 scheduler.
 */
import dotenv from 'dotenv';
dotenv.config();

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const pool = getPool();

const PAGE_SIZE = 1000;
const DEFAULT_TIMEOUT_MS = 25_000;

interface CountyConfig {
  name: string;
  state: string;
  featureServerUrl: string;
  whereClause: string;
  fieldMap: Record<string, string>; // property_records column → ArcGIS field name
  defaultLandUseCode?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  notes?: string;
}

// ── County configurations ─────────────────────────────────────────────────────

const COUNTY_CONFIGS: CountyConfig[] = [
  // ── Fulton ─────────────────────────────────────────────────────────────────
  {
    name: 'Fulton',
    state: 'GA',
    featureServerUrl:
      'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0',
    // LivUnits > 5 = multifamily (condos, apts, complexes)
    whereClause: 'LivUnits > 5',
    fieldMap: {
      parcel_id:      'ParcelID',
      address:        'Address',
      owner_name:     'Owner',
      units:          'LivUnits',
      land_acres:     'LandAcres',
      assessed_value: 'TotAssess',
      land_use_code:  'LUCode',
    },
  },

  // ── DeKalb ────────────────────────────────────────────────────────────────
  // Full attributes: parcel ID, site address, owner, assessed value, acreage.
  // USECD is mostly NULL in this layer, so we import all addressable parcels
  // and rely on the county assessed value and address for filtering downstream.
  {
    name: 'DeKalb',
    state: 'GA',
    featureServerUrl:
      'https://dcgis.dekalbcountyga.gov/hosted/rest/services/Parcels/MapServer/0',
    whereClause: "PARCELID IS NOT NULL AND SITEADDRESS IS NOT NULL AND OWNERNME1 IS NOT NULL",
    fieldMap: {
      parcel_id:      'PARCELID',
      address:        'SITEADDRESS',
      owner_name:     'OWNERNME1',
      assessed_value: 'CNTASSDVAL',
      land_acres:     'ACREAGE',
      land_use_code:  'USECD',
    },
    defaultLandUseCode: 'DEKALB',
    timeoutMs: 30_000,
  },

  // ── Cobb ──────────────────────────────────────────────────────────────────
  // Parcel geometry + classification layer only — no address or owner fields
  // in the publicly available FeatureServer. Records include parcel ID, acreage,
  // class code, and HAS_MULTIUNIT flag. Centroid lat/lng from geometry.
  // Address enrichment can be done downstream via reverse geocoding.
  {
    name: 'Cobb',
    state: 'GA',
    featureServerUrl:
      'https://services.arcgis.com/HYLRafMc4Ux6DA8c/ArcGIS/rest/services/CobbParcelsCopy041425/FeatureServer/1',
    // Filter to parcels with multi-unit flag so we don't load all single-family
    whereClause: "HAS_MULTIUNIT = 'Y' AND PARCEL_ID IS NOT NULL",
    fieldMap: {
      parcel_id:     'PARCEL_ID',
      land_use_code: 'CLASS',
      land_acres:    'ACRE_CALC',
    },
    defaultLandUseCode: 'COBB-MF',
    notes: 'Address/owner not in this layer — parcel ID + geometry only.',
  },

  // ── Gwinnett ──────────────────────────────────────────────────────────────
  // The GIS server blocks outbound requests from non-browser IPs (verified:
  // curl from Replit times out; browser fetch works fine). Added here so the
  // config is ready — will be skipped at runtime when the server is unreachable.
  {
    name: 'Gwinnett',
    state: 'GA',
    featureServerUrl:
      'https://gis3.gwinnettcounty.com/mapvis/rest/services/GISDataBrowser/GC_Parcel/MapServer/6',
    whereClause: '1=1',
    fieldMap: {
      parcel_id:     'PARCELID',
      address:       'SITEADDRESS',
      owner_name:    'OWNERNME1',
      assessed_value:'CNTASSDVAL',
      land_acres:    'ACREAGE',
      land_use_code: 'USECD',
    },
    timeoutMs: 35_000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JediRe-DataIngest/1.0)',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://gis3.gwinnettcounty.com/',
    },
    notes: 'Server blocks non-browser IPs — skipped if connection times out.',
  },
];

// ── ArcGIS pagination ─────────────────────────────────────────────────────────

async function arcgisPage(
  featureServerUrl: string,
  whereClause: string,
  outFields: string[],
  offset: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  headers: Record<string, string> = {}
): Promise<{ features: any[]; exceededTransferLimit: boolean }> {
  const url = new URL(`${featureServerUrl}/query`);
  url.searchParams.set('where', whereClause);
  url.searchParams.set('outFields', outFields.join(','));
  url.searchParams.set('resultOffset', String(offset));
  url.searchParams.set('resultRecordCount', String(PAGE_SIZE));
  url.searchParams.set('returnGeometry', 'true');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('f', 'json');

  const resp = await fetch(url.toString(), {
    signal: AbortSignal.timeout(timeoutMs),
    headers,
  });
  if (!resp.ok) throw new Error(`ArcGIS HTTP ${resp.status}: ${url}`);
  const data: any = await resp.json();
  if (data.error) throw new Error(`ArcGIS error: ${JSON.stringify(data.error)}`);

  return {
    features: data.features || [],
    exceededTransferLimit: !!data.exceededTransferLimit,
  };
}

function extractCentroid(geometry: any): { lat: number; lng: number } | null {
  if (!geometry) return null;
  if (geometry.x !== undefined && geometry.y !== undefined) {
    return { lat: geometry.y, lng: geometry.x };
  }
  if (geometry.rings?.length > 0) {
    const ring: number[][] = geometry.rings[0];
    const lng = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length;
    const lat = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length;
    return { lat, lng };
  }
  return null;
}

// ── Per-county import ─────────────────────────────────────────────────────────

async function importCounty(
  config: CountyConfig,
  startOffset = 0,
  maxPages?: number
): Promise<{ inserted: number; updated: number; errors: number; skipped: boolean }> {
  console.log(`\n  → ${config.name} County (${config.state})`);
  if (config.notes) console.log(`     ℹ️  ${config.notes}`);

  const outFields = [...new Set(Object.values(config.fieldMap))];
  let offset = startOffset;
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  let page = 0;

  while (true) {
    if (maxPages && page >= maxPages) {
      console.log(`     ⏹  Max pages (${maxPages}) reached — run again from offset ${offset} to continue`);
      break;
    }
    page++;
    let result: { features: any[]; exceededTransferLimit: boolean };
    try {
      result = await arcgisPage(
        config.featureServerUrl,
        config.whereClause,
        outFields,
        offset,
        config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        config.headers ?? {}
      );
    } catch (err: any) {
      const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout') ||
                        err.message?.includes('timed out');
      if (isTimeout && page === 1) {
        console.log(`     ⏭️  Skipped — server not reachable (timeout on first page)`);
        return { inserted: 0, updated: 0, errors: 0, skipped: true };
      }
      logger.error(`[CountyImport] ArcGIS page failed ${config.name} offset=${offset}`, {
        error: err.message,
      });
      errors++;
      break;
    }

    const { features, exceededTransferLimit } = result;
    console.log(`     Page ${page}: ${features.length} parcels (offset ${offset})`);

    // Build batch arrays for a single multi-row upsert (much faster than per-row queries)
    const batchParcelIds:  string[]            = [];
    const batchAddresses:  string[]            = [];
    const batchOwners:     (string | null)[]   = [];
    const batchUnits:      (number | null)[]   = [];
    const batchAcres:      (number | null)[]   = [];
    const batchAssessed:   (number | null)[]   = [];
    const batchLuCodes:    (string | null)[]   = [];

    for (const feature of features) {
      const attrs   = feature.attributes || {};
      const parcelId = attrs[config.fieldMap.parcel_id]?.toString()?.trim();
      if (!parcelId) continue;

      const compositeId = `${config.name.toUpperCase()}-${parcelId}`;

      batchParcelIds.push(compositeId);
      batchAddresses.push(config.fieldMap.address
        ? (attrs[config.fieldMap.address] ?? '').toString().trim()
        : '');
      batchOwners.push(config.fieldMap.owner_name
        ? (attrs[config.fieldMap.owner_name] ?? null)
        : null);
      batchUnits.push(config.fieldMap.units
        ? (attrs[config.fieldMap.units] ?? null)
        : null);
      batchAcres.push(config.fieldMap.land_acres
        ? (attrs[config.fieldMap.land_acres] ?? null)
        : null);
      batchAssessed.push(config.fieldMap.assessed_value
        ? (attrs[config.fieldMap.assessed_value] ?? null)
        : null);
      batchLuCodes.push(config.fieldMap.land_use_code
        ? (attrs[config.fieldMap.land_use_code] ?? config.defaultLandUseCode ?? null)
        : (config.defaultLandUseCode ?? null));
    }

    // Deduplicate within the page (ArcGIS sometimes returns the same parcel twice)
    const seenInPage = new Set<string>();
    const deduped = batchParcelIds.reduce((acc, id, i) => {
      if (!seenInPage.has(id)) {
        seenInPage.add(id);
        acc.push(i);
      }
      return acc;
    }, [] as number[]);
    const dedupedIds      = deduped.map(i => batchParcelIds[i]);
    const dedupedAddr     = deduped.map(i => batchAddresses[i]);
    const dedupedOwners   = deduped.map(i => batchOwners[i]);
    const dedupedUnits    = deduped.map(i => batchUnits[i]);
    const dedupedAcres    = deduped.map(i => batchAcres[i]);
    const dedupedAssessed = deduped.map(i => batchAssessed[i]);
    const dedupedLuCodes  = deduped.map(i => batchLuCodes[i]);

    if (dedupedIds.length > 0) {
      try {
        const res = await pool.query(
          `INSERT INTO property_records (
               parcel_id, county, state, address, owner_name,
               units, land_acres, assessed_value, land_use_code,
               data_source_url, scraped_at, updated_at
             )
             SELECT
               unnest($1::text[]),
               $2, $3,
               unnest($4::text[]),
               unnest($5::text[]),
               unnest($6::numeric[]),
               unnest($7::numeric[]),
               unnest($8::numeric[]),
               unnest($9::text[]),
               $10, NOW(), NOW()
           ON CONFLICT (parcel_id) DO UPDATE SET
             address         = COALESCE(NULLIF(EXCLUDED.address, ''), property_records.address),
             owner_name      = COALESCE(EXCLUDED.owner_name,      property_records.owner_name),
             units           = COALESCE(EXCLUDED.units,           property_records.units),
             land_acres      = COALESCE(EXCLUDED.land_acres,      property_records.land_acres),
             assessed_value  = COALESCE(EXCLUDED.assessed_value,  property_records.assessed_value),
             land_use_code   = COALESCE(EXCLUDED.land_use_code,   property_records.land_use_code),
             data_source_url = EXCLUDED.data_source_url,
             updated_at      = NOW()
           RETURNING (xmax = 0) AS is_new`,
          [
            dedupedIds,
            config.name, config.state,
            dedupedAddr,
            dedupedOwners,
            dedupedUnits,
            dedupedAcres,
            dedupedAssessed,
            dedupedLuCodes,
            config.featureServerUrl,
          ]
        );
        for (const row of res.rows) {
          if (row.is_new) inserted++;
          else updated++;
        }
      } catch (err: any) {
        errors += dedupedIds.length;
        logger.warn(`[CountyImport] batch upsert failed ${config.name} offset=${offset}`, {
          error: err.message,
        });
      }
    }

    offset += features.length;
    if (!exceededTransferLimit || features.length === 0) break;
  }

  return { inserted, updated, errors, skipped: false };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function importCountyProperties(
  countyNames?: string[],
  startOffset?: number,
  maxPages?: number
): Promise<void> {
  const snapshotDate = new Date().toISOString().split('T')[0];
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`Atlanta MSA County Property Import - ${snapshotDate}`);
  if (startOffset) console.log(`  Resuming from offset ${startOffset}`);
  if (maxPages)    console.log(`  Max pages per county: ${maxPages}`);
  console.log(`═══════════════════════════════════════════════════`);

  const targets = countyNames
    ? COUNTY_CONFIGS.filter(c =>
        countyNames.map(n => n.toLowerCase()).includes(c.name.toLowerCase())
      )
    : COUNTY_CONFIGS;

  let totalInserted = 0;
  let totalUpdated  = 0;
  let totalErrors   = 0;
  const skippedCounties: string[] = [];

  for (const config of targets) {
    const { inserted, updated, errors, skipped } = await importCounty(config, startOffset, maxPages);
    if (skipped) {
      skippedCounties.push(config.name);
    } else {
      totalInserted += inserted;
      totalUpdated  += updated;
      totalErrors   += errors;
      console.log(`     ✓ ${config.name}: +${inserted} new, ${updated} updated, ${errors} errors`);
    }
  }

  console.log(`\n✅ County import complete`);
  console.log(`   New: ${totalInserted}  |  Updated: ${totalUpdated}  |  Errors: ${totalErrors}`);

  if (skippedCounties.length > 0) {
    console.log(`\n⚠️  Skipped counties (server unreachable from this host):`);
    skippedCounties.forEach(c => console.log(`   · ${c}`));
    console.log(`   These counties can be re-run from an environment that can reach their ArcGIS servers.`);
  }
}

if (require.main === module) {
  // CLI usage:
  //   npx tsx import-county-properties.ts [County ...] [--offset=N] [--maxPages=N]
  //   npx tsx import-county-properties.ts DeKalb --offset=80000 --maxPages=100
  const allArgs = process.argv.slice(2);
  const countyArgs = allArgs.filter(a => !a.startsWith('--'));
  const offsetArg  = allArgs.find(a => a.startsWith('--offset='));
  const pagesArg   = allArgs.find(a => a.startsWith('--maxPages='));
  const countyFilter  = countyArgs.length > 0 ? countyArgs : undefined;
  const startOffset   = offsetArg  ? parseInt(offsetArg.split('=')[1])  : 0;
  const maxPages      = pagesArg   ? parseInt(pagesArg.split('=')[1])   : undefined;
  if (countyFilter) console.log(`Running for counties: ${countyFilter.join(', ')}`);
  if (startOffset)  console.log(`Starting from offset: ${startOffset}`);
  if (maxPages)     console.log(`Max pages: ${maxPages}`);
  importCountyProperties(countyFilter, startOffset, maxPages)
    .catch(err => {
      console.error('Fatal:', err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
