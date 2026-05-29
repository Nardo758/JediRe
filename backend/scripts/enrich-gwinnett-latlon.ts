/**
 * Gwinnett County lat/lon enrichment — Task #1479
 *
 * property_info_cache has ~24K Gwinnett rows with NULL lat/lon because the
 * original ingest did not request geometry from ArcGIS.  Without lat/lon the
 * promoteGeorgiaSales ETL filters every Gwinnett row out of market_sale_comps.
 *
 * This script:
 *   1. Reads the LRSNs already in property_info_cache that are missing lat/lon
 *   2. Fetches centroids from ArcGIS in batches using LRSN IN (…) WHERE clauses
 *   3. Bulk-UPDATEs property_info_cache.latitude/longitude
 *   4. Runs promoteGeorgiaSales for Gwinnett
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/enrich-gwinnett-latlon.ts
 *   cd backend && npx ts-node --transpile-only scripts/enrich-gwinnett-latlon.ts --skip-promote
 *   cd backend && npx ts-node --transpile-only scripts/enrich-gwinnett-latlon.ts --dry-run
 */

import { connectDatabase, getPool } from '../src/database/connection';
import { georgiaSaleCompsService } from '../src/services/saleComps/georgia-sale-comps.service';

const GWINNETT_BASE_URL =
  'https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer';
const PARCELS_LAYER = 0;
const ARCGIS_BATCH  = 500; // LRSNs per POST request (avoids GET URL-length limit)

const args = process.argv.slice(2);
const DRY_RUN      = args.includes('--dry-run');
const SKIP_PROMOTE = args.includes('--skip-promote');

interface GwinnettCentroid {
  LRSN: string;
  centroid_x?: number | null;
  centroid_y?: number | null;
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/**
 * POST-based ArcGIS query — avoids GET URL-length limits for large WHERE IN lists.
 * ArcGIS REST supports both GET and POST for /query endpoints.
 */
async function arcgisPost(
  serviceUrl: string,
  layerId: number,
  params: Record<string, string>
): Promise<any> {
  const url = `${serviceUrl}/${layerId}/query`;
  const body = new URLSearchParams(params);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const data = await response.json() as any;
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

async function fetchCentroidsForLRSNs(lrsns: string[]): Promise<GwinnettCentroid[]> {
  const results: GwinnettCentroid[] = [];

  for (let i = 0; i < lrsns.length; i += ARCGIS_BATCH) {
    const batch = lrsns.slice(i, i + ARCGIS_BATCH);
    const whereList = batch.map(l => `'${l}'`).join(',');
    const where = `LRSN IN (${whereList})`;

    try {
      const data = await arcgisPost(GWINNETT_BASE_URL, PARCELS_LAYER, {
        where,
        outFields: 'LRSN',
        returnGeometry: 'false',
        returnCentroid: 'true',
        outSR: '4326',
        resultRecordCount: String(ARCGIS_BATCH + 10),
        f: 'json',
      });

      for (const f of (data.features || [])) {
        const attrs = f.attributes;
        const centroid = f.centroid;
        const cx: number | null = centroid?.x ?? attrs?.centroid_x ?? null;
        const cy: number | null = centroid?.y ?? attrs?.centroid_y ?? null;
        if (attrs?.LRSN && cx != null && cy != null) {
          results.push({ LRSN: String(attrs.LRSN), centroid_x: cx, centroid_y: cy });
        }
      }
    } catch (err) {
      console.warn(`  [batch ${Math.floor(i / ARCGIS_BATCH) + 1}] error: ${err}`);
    }

    if (i + ARCGIS_BATCH < lrsns.length) await delay(100);

    if ((i / ARCGIS_BATCH + 1) % 10 === 0) {
      console.log(
        `  [ArcGIS] ${Math.min(i + ARCGIS_BATCH, lrsns.length).toLocaleString()} / ${lrsns.length.toLocaleString()} LRSNs queried, ${results.length.toLocaleString()} with coords`
      );
    }
  }

  return results;
}

async function main() {
  await connectDatabase();
  const pool = getPool();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Gwinnett lat/lon enrichment — Task #1479');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  dry-run      : ${DRY_RUN}`);
  console.log(`  skip-promote : ${SKIP_PROMOTE}`);
  console.log(`  ArcGIS batch : ${ARCGIS_BATCH} LRSNs per request`);
  console.log('───────────────────────────────────────────────────────\n');

  // ── STEP 1: Get LRSNs missing lat/lon from our DB ────────────────────────────
  console.log('STEP 1: Loading Gwinnett LRSNs that need lat/lon...');
  const lrsnRes = await pool.query<{ parcel_id: string }>(`
    SELECT DISTINCT parcel_id
    FROM property_info_cache
    WHERE county = 'Gwinnett' AND state = 'GA'
      AND (latitude IS NULL OR longitude IS NULL)
  `);
  const lrsns = lrsnRes.rows.map(r => r.parcel_id);
  console.log(`  ✓ ${lrsns.length.toLocaleString()} LRSNs need lat/lon`);

  if (lrsns.length === 0) {
    console.log('  ✓ Nothing to update — all rows already have lat/lon');
  }

  // ── STEP 2: Fetch centroids from ArcGIS ──────────────────────────────────────
  let withCoords: GwinnettCentroid[] = [];

  if (lrsns.length > 0) {
    console.log(`\nSTEP 2: Fetching centroids from ArcGIS (${Math.ceil(lrsns.length / ARCGIS_BATCH)} batches)...`);
    withCoords = await fetchCentroidsForLRSNs(lrsns);
    console.log(`  ✓ Received coords for ${withCoords.length.toLocaleString()} / ${lrsns.length.toLocaleString()} LRSNs`);

    if (withCoords.length === 0) {
      console.error('\n  ✗ ArcGIS returned no centroids. The layer may not support returnCentroid.');
      console.error('    Try running the full ingest: enrich-georgia-comps.ts --county=Gwinnett');
      process.exit(1);
    }
  }

  // ── STEP 3: Update property_info_cache ───────────────────────────────────────
  if (withCoords.length > 0) {
    console.log('\nSTEP 3: Updating property_info_cache with lat/lon...');

    // Deduplicate by LRSN (ArcGIS may return same parcel more than once)
    const coordMap = new Map<string, GwinnettCentroid>();
    for (const c of withCoords) coordMap.set(c.LRSN, c);
    const unique = Array.from(coordMap.values());
    console.log(`  ✓ ${unique.length.toLocaleString()} unique LRSNs after dedup (${withCoords.length - unique.length} dupes removed)`);

    if (DRY_RUN) {
      console.log(`  [dry-run] Would update ${unique.length.toLocaleString()} rows`);
    } else {
      // Stage into temp table then batch-update
      await pool.query(`
        DROP TABLE IF EXISTS _gwinnett_centroids;
        CREATE TEMP TABLE _gwinnett_centroids (
          lrsn TEXT PRIMARY KEY,
          lat  NUMERIC,
          lon  NUMERIC
        )
      `);

      const INSERT_BATCH = 500;
      for (let i = 0; i < unique.length; i += INSERT_BATCH) {
        const slice = unique.slice(i, i + INSERT_BATCH);
        const vals  = slice.map((_, j) => `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`).join(',');
        const params = slice.flatMap(p => [p.LRSN, p.centroid_y, p.centroid_x]);
        await pool.query(
          `INSERT INTO _gwinnett_centroids (lrsn, lat, lon) VALUES ${vals}
           ON CONFLICT (lrsn) DO UPDATE SET lat = EXCLUDED.lat, lon = EXCLUDED.lon`,
          params
        );
      }

      const upd = await pool.query(`
        UPDATE property_info_cache pic
        SET latitude   = c.lat,
            longitude  = c.lon,
            updated_at = NOW()
        FROM _gwinnett_centroids c
        WHERE pic.parcel_id = c.lrsn
          AND pic.county    = 'Gwinnett'
          AND pic.state     = 'GA'
          AND (pic.latitude IS NULL OR pic.longitude IS NULL)
      `);
      console.log(`  ✓ Updated ${upd.rowCount?.toLocaleString() ?? 0} property_info_cache rows`);
    }
  } else {
    console.log('\nSTEP 3: Skipped — no coords fetched or nothing to update');
  }

  // ── STEP 4: Run promoteGeorgiaSales ──────────────────────────────────────────
  if (SKIP_PROMOTE) {
    console.log('\nSTEP 4: Skipping promote (--skip-promote)\n');
  } else {
    console.log('\nSTEP 4: Running promoteGeorgiaSales for Gwinnett...');

    if (DRY_RUN) {
      const eligibleRes = await pool.query(`
        SELECT COUNT(*) AS cnt
        FROM georgia_property_sales gps
        JOIN property_info_cache pic
          ON  pic.parcel_id = gps.parcel_id
          AND pic.county    = gps.county
          AND pic.state     = gps.state
        WHERE gps.county     = 'Gwinnett'
          AND gps.state      = 'GA'
          AND gps.sale_price >= 200000
          AND (gps.qualified = true OR gps.qualified IS NULL)
          AND pic.latitude  IS NOT NULL
          AND pic.longitude IS NOT NULL
      `);
      console.log(`  [dry-run] ${Number(eligibleRes.rows[0].cnt).toLocaleString()} rows would be promoted`);
    } else {
      await pool.query(`SET statement_timeout = '10min'`);
      try {
        const results = await georgiaSaleCompsService.promoteGeorgiaSales({
          county: 'Gwinnett',
          state: 'GA',
          minSalePrice: 200_000,
          minUnits: 4,
        });
        for (const r of results) {
          console.log(`  ✓ ${r.county}: ${r.promoted.toLocaleString()} comps upserted into market_sale_comps`);
        }
      } finally {
        await pool.query(`RESET statement_timeout`);
      }
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────────
  console.log('\n── Validation ──────────────────────────────────────────');
  const picRes = await pool.query(`
    SELECT
      COUNT(*)                                  AS total,
      COUNT(latitude)                           AS with_lat
    FROM property_info_cache
    WHERE county = 'Gwinnett' AND state = 'GA'
  `);
  console.log(`  property_info_cache Gwinnett: ${Number(picRes.rows[0].total).toLocaleString()} rows, ${Number(picRes.rows[0].with_lat).toLocaleString()} with lat/lon`);

  const coverageRes = await pool.query(`
    SELECT
      county,
      COUNT(*)::int                                    AS total,
      COUNT(*) FILTER (WHERE units >= 4)::int          AS mf_comps,
      COUNT(*) FILTER (WHERE price_per_unit > 0)::int  AS with_ppu
    FROM market_sale_comps
    WHERE source = 'georgia_county' AND state = 'GA'
      AND county IN ('Gwinnett', 'DeKalb', 'Fulton', 'Cobb')
    GROUP BY county
    ORDER BY county
  `);

  console.log(`\n  market_sale_comps (source=georgia_county):`);
  console.log(`  ${'County'.padEnd(12)} ${'Total'.padStart(9)} ${'MF≥4'.padStart(8)} ${'w/PPU'.padStart(8)}`);
  console.log(`  ${'-'.repeat(42)}`);
  for (const r of coverageRes.rows) {
    console.log(
      `  ${r.county.padEnd(12)} ${String(r.total).padStart(9)} ${String(r.mf_comps).padStart(8)} ${String(r.with_ppu).padStart(8)}`
    );
  }

  const gwRow = coverageRes.rows.find((r: any) => r.county === 'Gwinnett');
  const pass  = gwRow && gwRow.total > 0;
  console.log(`\n  Gwinnett in market_sale_comps: ${pass ? '✓ PASS' : '✗ NEEDS PROMOTE — run without --skip-promote'}`);
  console.log('\n  Done.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('✗ Fatal:', err.message || err);
  process.exit(1);
});
