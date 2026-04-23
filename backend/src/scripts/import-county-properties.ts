/**
 * Atlanta MSA County Property Import
 *
 * Pulls multifamily property records from county ArcGIS REST FeatureServices
 * into the property_records table (upsert on parcel_id).
 *
 * Currently supported counties (ArcGIS endpoints confirmed working):
 *   - Fulton County (GA): services1.arcgis.com — Tax_Parcels_2025
 *
 * Blocked counties (ArcGIS servers not responding publicly — need REGRID API key):
 *   - DeKalb, Cobb, Gwinnett
 *
 * Run manually or from the M28 nightly scheduler.
 */
import dotenv from 'dotenv';
dotenv.config();

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const pool = getPool();

const PAGE_SIZE = 1000;
const FETCH_TIMEOUT_MS = 20_000;

// Land-use codes for residential multifamily in Fulton County GA
// 100-199 = residential; 200+ = commercial. We want: 110=Condo, 120=Apt,
// 250=MF, 251=Apt complex, 252=Low-rise apt, 253=High-rise apt, 254=Conv apt
// Also include 300-396 range for commercial multi-tenant / self-storage etc.
const FULTON_MULTIFAMILY_WHERE = `LivUnits > 5`;

interface CountyConfig {
  name: string;
  state: string;
  featureServerUrl: string;
  whereClause: string;
  fieldMap: Record<string, string>; // property_records column → ArcGIS field
  defaultLandUseCode?: string;
}

const COUNTY_CONFIGS: CountyConfig[] = [
  {
    name: 'Fulton',
    state: 'GA',
    featureServerUrl:
      'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0',
    whereClause: FULTON_MULTIFAMILY_WHERE,
    fieldMap: {
      parcel_id:             'ParcelID',
      address:               'Address',
      owner_name:            'Owner',
      units:                 'LivUnits',
      land_acres:            'LandAcres',
      assessed_value:        'TotAssess',
      land_use_code:         'LUCode',
    },
  },
];

async function arcgisPage(
  featureServerUrl: string,
  whereClause: string,
  outFields: string[],
  offset: number
): Promise<{ features: any[]; exceededTransferLimit: boolean }> {
  const url = new URL(`${featureServerUrl}/query`);
  url.searchParams.set('where', whereClause);
  url.searchParams.set('outFields', outFields.join(','));
  url.searchParams.set('resultOffset', String(offset));
  url.searchParams.set('resultRecordCount', String(PAGE_SIZE));
  url.searchParams.set('returnGeometry', 'true');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('geometryType', 'esriGeometryPoint');
  url.searchParams.set('f', 'json');

  const resp = await fetch(url.toString(), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
  // Point geometry
  if (geometry.x !== undefined && geometry.y !== undefined) {
    return { lat: geometry.y, lng: geometry.x };
  }
  // Polygon — compute rough centroid from rings
  if (geometry.rings?.length > 0) {
    const ring: number[][] = geometry.rings[0];
    const lng = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length;
    const lat = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length;
    return { lat, lng };
  }
  return null;
}

async function importCounty(config: CountyConfig): Promise<{ inserted: number; updated: number; errors: number }> {
  console.log(`\n  → ${config.name} County (${config.state})`);
  const outFields = [...new Set(Object.values(config.fieldMap))];
  let offset = 0;
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  let page = 0;

  while (true) {
    page++;
    let result: { features: any[]; exceededTransferLimit: boolean };
    try {
      result = await arcgisPage(
        config.featureServerUrl,
        config.whereClause,
        outFields,
        offset
      );
    } catch (err: any) {
      logger.error(`[CountyImport] ArcGIS page failed ${config.name} offset=${offset}`, { error: err.message });
      errors++;
      break;
    }

    const { features, exceededTransferLimit } = result;
    console.log(`     Page ${page}: ${features.length} parcels (offset ${offset})`);

    for (const feature of features) {
      const attrs = feature.attributes || {};
      const centroid = extractCentroid(feature.geometry);

      const parcelId = attrs[config.fieldMap.parcel_id]?.toString()?.trim();
      if (!parcelId) continue;

      const address = (attrs[config.fieldMap.address] || '').trim();
      const ownerName = config.fieldMap.owner_name ? (attrs[config.fieldMap.owner_name] || '').trim() : null;
      const units = config.fieldMap.units ? attrs[config.fieldMap.units] : null;
      const landAcres = config.fieldMap.land_acres ? attrs[config.fieldMap.land_acres] : null;
      const assessedValue = config.fieldMap.assessed_value ? attrs[config.fieldMap.assessed_value] : null;
      const luCode = config.fieldMap.land_use_code ? attrs[config.fieldMap.land_use_code] : config.defaultLandUseCode;

      if (!address) continue;

      try {
        const res = await pool.query(
          `INSERT INTO property_records (
             parcel_id, county, state, address, owner_name,
             units, land_acres, assessed_value, land_use_code,
             data_source_url, scraped_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
           ON CONFLICT (parcel_id) DO UPDATE SET
             address        = EXCLUDED.address,
             owner_name     = EXCLUDED.owner_name,
             units          = EXCLUDED.units,
             land_acres     = EXCLUDED.land_acres,
             assessed_value = EXCLUDED.assessed_value,
             land_use_code  = EXCLUDED.land_use_code,
             data_source_url= EXCLUDED.data_source_url,
             updated_at     = NOW()
           RETURNING (xmax = 0) AS is_new`,
          [
            parcelId,
            config.name,
            config.state,
            address,
            ownerName,
            units,
            landAcres,
            assessedValue,
            luCode,
            config.featureServerUrl,
          ]
        );
        if (res.rows[0]?.is_new) inserted++; else updated++;

        // Also sync lat/lng into the centroid columns if present (added in migration 040 if available)
        if (centroid) {
          await pool.query(
            `UPDATE property_records SET
               parcel_area_sqft = COALESCE(parcel_area_sqft, $1)
             WHERE parcel_id = $2`,
            [null, parcelId]  // placeholder — centroid stored in properties table lat/lng
          );
        }
      } catch (err: any) {
        errors++;
        logger.warn(`[CountyImport] upsert failed ${parcelId}`, { error: err.message });
      }
    }

    offset += features.length;
    if (!exceededTransferLimit || features.length === 0) break;
  }

  return { inserted, updated, errors };
}

export async function importCountyProperties(countyNames?: string[]): Promise<void> {
  const snapshotDate = new Date().toISOString().split('T')[0];
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`Atlanta MSA County Property Import - ${snapshotDate}`);
  console.log(`═══════════════════════════════════════════════════`);

  const targets = countyNames
    ? COUNTY_CONFIGS.filter(c => countyNames.map(n => n.toLowerCase()).includes(c.name.toLowerCase()))
    : COUNTY_CONFIGS;

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const config of targets) {
    const { inserted, updated, errors } = await importCounty(config);
    totalInserted += inserted;
    totalUpdated += updated;
    totalErrors += errors;
    console.log(`     ✓ ${config.name}: +${inserted} new, ${updated} updated, ${errors} errors`);
  }

  console.log(`\n✅ County import complete`);
  console.log(`   New: ${totalInserted}  |  Updated: ${totalUpdated}  |  Errors: ${totalErrors}\n`);

  console.log(`ℹ️  DeKalb, Cobb, Gwinnett county ArcGIS servers are not publicly accessible.`);
  console.log(`   Add REGRID_API_KEY to enable coverage for those three counties.`);
}

if (require.main === module) {
  importCountyProperties()
    .catch(err => {
      console.error('Fatal:', err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
