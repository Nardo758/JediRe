/**
 * Ingest Gwinnett County parcels into the county_parcels table.
 *
 * Enables Zoning Intelligence for Duluth-area deals (Highlands at Sweetwater
 * Creek / p2122) by populating centroid_lat, centroid_lng, land_use_code,
 * and county_zoning_code.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/ingest-gwinnett-county-parcels.ts
 *   npx ts-node --transpile-only scripts/ingest-gwinnett-county-parcels.ts --all
 *   npx ts-node --transpile-only scripts/ingest-gwinnett-county-parcels.ts --dry-run
 *
 * Flags:
 *   --all      Full-county ingest (~350 k parcels). Default: Duluth-area bbox.
 *   --dry-run  Fetch and parse without writing to the database.
 *
 * ArcGIS source:
 *   https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer
 *   Layer 0 : Parcels    (PIN, LRSN, ADDRESS + geometry for centroid)
 *   Table 3 : Tax Master (LRSN, PROPCLAS, PCDESC, ZONING)
 */

import { pool } from '../src/database';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL =
  'https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer';

const LAYER = { PARCELS: 0, TAX_MASTER: 3 };

/**
 * Duluth-area bounding box (WGS-84).
 * Centered on Highlands at Sweetwater Creek (33.9779, -84.1447).
 * The zoning-intelligence query window is ±0.043° lat, ±0.048° lng.
 * We add a 50% buffer so the full window is always covered.
 */
const DULUTH_BBOX = {
  xmin: -84.1447 - 0.072,  // ~-84.217
  ymin: 33.9779  - 0.065,  // ~33.913
  xmax: -84.1447 + 0.072,  // ~-84.073
  ymax: 33.9779  + 0.065,  // ~34.043
};

const PARCEL_FETCH_BATCH  = 1000;   // records per ArcGIS pagination request
const LRSN_QUERY_BATCH    = 500;    // LRSNs per Tax Master POST request
const DB_UPSERT_BATCH     = 500;    // rows per multi-row INSERT statement
const MAX_RETRIES         = 3;
const RETRY_DELAY_MS      = 1000;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getJson(url: string, attempt = 1): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText} — ${url}`);
    const data = await res.json();
    if (data?.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`  [GET retry ${attempt}]`);
      await sleep(RETRY_DELAY_MS * attempt);
      return getJson(url, attempt + 1);
    }
    throw err;
  }
}

async function postJson(
  url: string,
  params: Record<string, string | number | boolean>,
  attempt = 1,
): Promise<any> {
  try {
    const body = new URLSearchParams({ f: 'json' });
    for (const [k, v] of Object.entries(params)) body.set(k, String(v));
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (data?.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`  [POST retry ${attempt}]`);
      await sleep(RETRY_DELAY_MS * attempt);
      return postJson(url, params, attempt + 1);
    }
    throw err;
  }
}

function queryUrl(layerId: number, params: Record<string, string | number | boolean>): string {
  const p = new URLSearchParams({ f: 'json' });
  for (const [k, v] of Object.entries(params)) p.set(k, String(v));
  return `${BASE_URL}/${layerId}/query?${p}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParcelRow {
  PIN: string;
  LRSN: string;
  ADDRESS: string;
  centroid_lat: number;
  centroid_lng: number;
  lot_area_sf: number | null;
}

/**
 * Compute approximate polygon area in square feet from a WGS-84 ring.
 *
 * Uses the Shoelace formula for signed area in (lng, lat) degrees, then
 * scales to square meters using the projection correction at the centroid
 * latitude (111 320 m/° lat × 111 320·cos(lat) m/° lng).
 *
 * Error at 34°N is < 0.5% for typical suburban parcel sizes.
 */
function ringToSqFt(ring: number[][], centroidLat: number): number | null {
  if (!ring || ring.length < 3) return null;
  // Shoelace in degree² (WGS-84 lng,lat order)
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  const areaDeg2 = Math.abs(area) / 2;
  // Scale: 1° lat ≈ 111 320 m, 1° lng ≈ 111 320 · cos(lat) m
  const cosLat = Math.cos((centroidLat * Math.PI) / 180);
  const areaSqM = areaDeg2 * 111320 * 111320 * cosLat;
  const areaSqFt = areaSqM * 10.7639;
  // Sanity check: reject implausibly large or tiny values
  if (areaSqFt < 100 || areaSqFt > 50_000_000) return null;
  return Math.round(areaSqFt);
}

interface TaxRow {
  LRSN: string;
  PCDESC: string;
  ZONING: string;
}

// ─── Step 1: Fetch parcels (spatially filtered or full county) ────────────────

async function fetchParcels(fullCounty: boolean): Promise<ParcelRow[]> {
  const baseParams: Record<string, string | number | boolean> = {
    outFields: 'PIN,LRSN,ADDRESS',
    returnGeometry: true,
    outSR: 4326,
    where: '1=1',
  };

  const countParams: Record<string, string | number | boolean> = {
    where: '1=1',
    returnCountOnly: true,
  };

  if (!fullCounty) {
    const bboxStr = `${DULUTH_BBOX.xmin},${DULUTH_BBOX.ymin},${DULUTH_BBOX.xmax},${DULUTH_BBOX.ymax}`;
    const spatialExtras = {
      geometry: bboxStr,
      geometryType: 'esriGeometryEnvelope',
      inSR: 4326,
      spatialRel: 'esriSpatialRelIntersects',
    };
    Object.assign(baseParams, spatialExtras);
    Object.assign(countParams, spatialExtras);
  }

  const countData = await getJson(queryUrl(LAYER.PARCELS, countParams));
  const total: number = countData.count ?? 0;
  console.log(`[Parcels] Total: ${total.toLocaleString()}`);

  const all: ParcelRow[] = [];
  let offset = 0;

  while (all.length < total) {
    const url = queryUrl(LAYER.PARCELS, {
      ...baseParams,
      resultOffset: offset,
      resultRecordCount: PARCEL_FETCH_BATCH,
    });

    const data = await getJson(url);
    const features: any[] = data.features ?? [];
    if (features.length === 0) break;

    for (const f of features) {
      const a = f.attributes ?? {};
      const geom = f.geometry;

      let lat: number | null = null;
      let lng: number | null = null;
      let lotAreaSf: number | null = null;

      // Try native centroid first; fall back to ring average
      const native = (f as any).centroid;
      if (native?.x != null && native?.y != null) {
        lng = native.x; lat = native.y;
      } else if (geom?.rings?.length > 0) {
        const ring: number[][] = geom.rings[0];
        lng = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length;
        lat = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length;
      } else if (geom?.x != null && geom?.y != null) {
        lng = geom.x; lat = geom.y;
      }

      if (lat == null || lng == null) continue;

      // Compute lot area from polygon ring (outer ring = rings[0])
      if (geom?.rings?.length > 0) {
        lotAreaSf = ringToSqFt(geom.rings[0] as number[][], lat);
      }

      all.push({
        PIN:         String(a.PIN ?? a.TAXPIN ?? ''),
        LRSN:        String(a.LRSN ?? ''),
        ADDRESS:     String(a.ADDRESS ?? ''),
        centroid_lat: lat,
        centroid_lng: lng,
        lot_area_sf:  lotAreaSf,
      });
    }

    offset += features.length;
    if (offset % 10000 === 0) console.log(`[Parcels] ${all.length.toLocaleString()}/${total.toLocaleString()}`);
    await sleep(60);
  }

  console.log(`[Parcels] Fetched ${all.length.toLocaleString()} parcels with valid centroids`);
  return all;
}

// ─── Step 2: Fetch Tax Master (PCDESC + ZONING) via POST batches ──────────────

async function fetchTaxMaster(lrsns: string[]): Promise<Map<string, TaxRow>> {
  const map = new Map<string, TaxRow>();
  if (lrsns.length === 0) return map;

  const endpoint = `${BASE_URL}/${LAYER.TAX_MASTER}/query`;
  console.log(`[Tax Master] ${lrsns.length.toLocaleString()} LRSNs → ${Math.ceil(lrsns.length / LRSN_QUERY_BATCH)} POST batches`);

  for (let i = 0; i < lrsns.length; i += LRSN_QUERY_BATCH) {
    const batch = lrsns.slice(i, i + LRSN_QUERY_BATCH);
    const inClause = batch.map(l => `'${l.replace(/'/g, "''")}'`).join(',');
    const data = await postJson(endpoint, {
      where: `LRSN IN (${inClause})`,
      outFields: 'LRSN,PCDESC,ZONING',
      returnGeometry: false,
    });

    for (const f of data.features ?? []) {
      const a = f.attributes ?? {};
      const lrsn = String(a.LRSN ?? '');
      if (lrsn) {
        map.set(lrsn, {
          LRSN:   lrsn,
          PCDESC: String(a.PCDESC ?? ''),
          ZONING: String(a.ZONING ?? ''),
        });
      }
    }

    if ((i / LRSN_QUERY_BATCH + 1) % 10 === 0) {
      console.log(`[Tax Master] ${Math.min(i + LRSN_QUERY_BATCH, lrsns.length).toLocaleString()}/${lrsns.length.toLocaleString()}`);
    }
    await sleep(60);
  }

  console.log(`[Tax Master] Loaded ${map.size.toLocaleString()} records`);
  return map;
}

// ─── Step 3: Batch upsert into county_parcels ─────────────────────────────────

async function batchUpsert(
  parcels: ParcelRow[],
  taxMap: Map<string, TaxRow>,
  batchId: string,
  dryRun: boolean,
): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0, updated = 0, skipped = 0;

  if (dryRun) {
    console.log(`[DB] DRY-RUN — would upsert ${parcels.length.toLocaleString()} rows`);
    return { inserted: parcels.length, updated: 0, skipped: 0 };
  }

  // Deduplicate by (PIN, county, state) — ArcGIS can return a parcel more than once
  // (e.g. split lots sharing a PIN). Keep first occurrence.
  const seen = new Set<string>();
  const rows: ParcelRow[] = [];
  for (const p of parcels) {
    if (!p.PIN) { skipped++; continue; }
    const key = `${p.PIN}|Gwinnett|GA`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    rows.push(p);
  }

  for (let i = 0; i < rows.length; i += DB_UPSERT_BATCH) {
    const chunk = rows.slice(i, i + DB_UPSERT_BATCH);

    // Build multi-row parameterized INSERT
    const COLS = 13;
    const valuePlaceholders: string[] = [];
    const params: any[] = [];

    for (let j = 0; j < chunk.length; j++) {
      const p   = chunk[j];
      const tax = taxMap.get(p.LRSN);
      const base = j * COLS;

      valuePlaceholders.push(
        `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13})`
      );
      params.push(
        p.PIN,                           // $1  parcel_id
        'Gwinnett',                      // $2  county
        'GA',                            // $3  state
        null,                            // $4  municipality
        tax?.ZONING  || null,            // $5  county_zoning_code
        tax?.PCDESC  || null,            // $6  county_zoning_desc
        tax?.PCDESC  || null,            // $7  land_use_code (best available without Improvements)
        p.lot_area_sf ?? null,           // $8  lot_area_sf (computed from polygon ring)
        p.ADDRESS    || null,            // $9  site_address
        p.centroid_lat,                  // $10 centroid_lat
        p.centroid_lng,                  // $11 centroid_lng
        BASE_URL,                        // $12 county_source_url
        batchId,                         // $13 ingestion_batch_id
      );
    }

    const sql = `
      INSERT INTO county_parcels (
        parcel_id, county, state, municipality,
        county_zoning_code, county_zoning_desc, land_use_code,
        lot_area_sf, site_address,
        centroid_lat, centroid_lng,
        county_source_url, ingestion_batch_id
      ) VALUES ${valuePlaceholders.join(',')}
      ON CONFLICT (parcel_id, county, state) DO UPDATE SET
        county_zoning_code = COALESCE(EXCLUDED.county_zoning_code, county_parcels.county_zoning_code),
        county_zoning_desc = COALESCE(EXCLUDED.county_zoning_desc, county_parcels.county_zoning_desc),
        land_use_code      = COALESCE(EXCLUDED.land_use_code,      county_parcels.land_use_code),
        lot_area_sf        = COALESCE(EXCLUDED.lot_area_sf,        county_parcels.lot_area_sf),
        site_address       = COALESCE(EXCLUDED.site_address,       county_parcels.site_address),
        centroid_lat       = COALESCE(EXCLUDED.centroid_lat,       county_parcels.centroid_lat),
        centroid_lng       = COALESCE(EXCLUDED.centroid_lng,       county_parcels.centroid_lng),
        updated_at         = NOW()
    `;

    try {
      const res = await pool.query(sql, params);
      // rowCount = rows affected (inserts + updates combined)
      inserted += res.rowCount ?? chunk.length;
    } catch (err: any) {
      console.error(`  ✗ Batch at offset ${i}: ${err.message}`);
      skipped += chunk.length;
    }

    if ((i / DB_UPSERT_BATCH + 1) % 20 === 0) {
      console.log(`[DB] ${Math.min(i + DB_UPSERT_BATCH, rows.length).toLocaleString()}/${rows.length.toLocaleString()} rows processed`);
    }
  }

  return { inserted, updated, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const fullCounty = args.includes('--all');
  const dryRun     = args.includes('--dry-run');
  const batchId    = `gwinnett_${Date.now()}`;

  console.log('=== Gwinnett County Parcel Ingest → county_parcels ===\n');
  console.log(`Mode     : ${fullCounty ? 'FULL COUNTY (slow — all ~350 k parcels)' : 'DULUTH-AREA BBOX (covers Highlands p2122 ± buffer)'}`);
  if (dryRun) console.log('DRY-RUN  : no database writes');
  console.log(`Batch ID : ${batchId}\n`);

  // ── Step 1: parcels ────────────────────────────────────────────────────────
  const parcels = await fetchParcels(fullCounty);

  if (parcels.length === 0) {
    console.error('No parcels fetched — check ArcGIS connectivity.');
    process.exit(1);
  }

  // ── Step 2: Tax Master enrichment ─────────────────────────────────────────
  const lrsns = [...new Set(parcels.map(p => p.LRSN).filter(Boolean))];
  console.log(`\n[Join] ${lrsns.length.toLocaleString()} unique LRSNs`);
  const taxMap = await fetchTaxMaster(lrsns);

  // ── Step 3: batch upsert ──────────────────────────────────────────────────
  console.log(`\n[DB] Batch-upserting ${parcels.length.toLocaleString()} rows (${DB_UPSERT_BATCH}/batch)…`);
  const { inserted, updated, skipped } = await batchUpsert(parcels, taxMap, batchId, dryRun);

  // ── Results ───────────────────────────────────────────────────────────────
  console.log('\n=== Results ===');
  console.log(`  Processed : ${parcels.length.toLocaleString()}`);
  console.log(`  Upserted  : ${inserted.toLocaleString()}`);
  console.log(`  Skipped   : ${skipped.toLocaleString()}`);

  if (!dryRun) {
    const totalRes = await pool.query(
      `SELECT COUNT(*) FROM county_parcels WHERE county = 'Gwinnett' AND state = 'GA'`,
    );
    console.log(`\n  county_parcels (Gwinnett, GA) total rows : ${Number(totalRes.rows[0].count).toLocaleString()}`);

    // Verify the zoning-intelligence bounding box for Highlands
    const LAT = 33.9779, LNG = -84.1447;
    const zoneRes = await pool.query(
      `SELECT COUNT(*) FROM county_parcels
       WHERE county = 'Gwinnett' AND state = 'GA'
         AND centroid_lat BETWEEN $1 AND $2
         AND centroid_lng BETWEEN $3 AND $4`,
      [LAT - 0.043, LAT + 0.043, LNG - 0.048, LNG + 0.048],
    );
    const zoneParcels = Number(zoneRes.rows[0].count);
    console.log(`  Parcels in Highlands ±3-mi zoning window : ${zoneParcels.toLocaleString()}`);

    // lot_area_sf coverage validation
    const lotRes = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(lot_area_sf) AS with_lot_area,
         ROUND(AVG(lot_area_sf)::numeric, 0) AS avg_sf,
         ROUND(MIN(lot_area_sf)::numeric, 0) AS min_sf,
         ROUND(MAX(lot_area_sf)::numeric, 0) AS max_sf
       FROM county_parcels
       WHERE county = 'Gwinnett' AND state = 'GA'
         AND centroid_lat BETWEEN $1 AND $2
         AND centroid_lng BETWEEN $3 AND $4`,
      [LAT - 0.043, LAT + 0.043, LNG - 0.048, LNG + 0.048],
    );
    const lr = lotRes.rows[0];
    const lotCoverage = lr.total > 0 ? Math.round((lr.with_lot_area / lr.total) * 100) : 0;
    console.log(`  lot_area_sf coverage (zoning window) : ${Number(lr.with_lot_area).toLocaleString()}/${Number(lr.total).toLocaleString()} (${lotCoverage}%)`);
    console.log(`  lot_area_sf stats (sqft)             : avg=${lr.avg_sf} min=${lr.min_sf} max=${lr.max_sf}`);

    if (lotCoverage < 80) {
      console.warn(`  ⚠️  lot_area_sf coverage is low (${lotCoverage}%) — check geometry extraction`);
    }

    if (zoneParcels > 0) {
      console.log('\n  ✅ Zoning Intelligence will now resolve for Highlands (p2122)');
    } else {
      console.warn('\n  ⚠️  No parcels in zoning window — check DULUTH_BBOX or centroid extraction');
    }
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
