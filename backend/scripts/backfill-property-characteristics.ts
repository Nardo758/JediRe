/**
 * Backfill 2 — Property Characteristics
 * Phase 2: Property Plumbing Refactor
 *
 * Populates property_characteristics from property_info_cache rows.
 * One property_characteristics row per property entity, effective_from = fetched_at.
 *
 * Re-runnable: skips any property_id that already has a characteristics row
 * for the same effective_from date.
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/backfill-property-characteristics.ts
 * Flags:
 *   --dry-run     Print counts without writing
 *   --limit=N     Process at most N properties
 *   --county=X    Only process rows for county X (case-insensitive)
 *   --skip-check  Skip spot-check at end
 */

import 'dotenv/config';
import { query } from '../src/database/connection';
import { propertyResolverService } from '../src/services/property-entity/property-resolver.service';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_CHECK = args.includes('--skip-check');
const LIMIT = (() => {
  const f = args.find((a) => a.startsWith('--limit='));
  return f ? parseInt(f.split('=')[1], 10) : 0;
})();
const COUNTY_FILTER = (() => {
  const f = args.find((a) => a.startsWith('--county='));
  return f ? f.split('=')[1].toLowerCase() : null;
})();

const BATCH = 500;

async function main() {
  console.log(`[Backfill2] Starting — dry_run=${DRY_RUN} limit=${LIMIT || 'all'} county=${COUNTY_FILTER || 'all'}`);

  // Count source rows
  const cntRes = await query(
    `SELECT COUNT(*) AS cnt FROM property_info_cache pic
     WHERE pic.property_id IS NOT NULL
       ${COUNTY_FILTER ? `AND LOWER(pic.county) = '${COUNTY_FILTER}'` : ''}`
  );
  const total = parseInt(cntRes.rows[0].cnt, 10);
  console.log(`[Backfill2] ${total} property_info_cache rows linked to property entities`);

  let inserted = 0;
  let skipped = 0;
  // Keyset cursor on pic.id — avoids skipping rows as the NOT EXISTS condition
  // shrinks the candidate set after each batch (OFFSET-based paging would skip rows
  // because successfully processed rows fall out of the WHERE but unprocessed ones shift).
  let lastCacheId = '00000000-0000-0000-0000-000000000000';

  while (true) {
    const batchLimit = LIMIT > 0 ? Math.min(BATCH, LIMIT - inserted) : BATCH;
    if (LIMIT > 0 && inserted >= LIMIT) break;

    // Fetch next batch: only rows whose property_id does NOT already have a
    // characteristics row for the same effective_from date.
    const rows = await query(
      `SELECT
         pic.id         AS cache_id,
         pic.property_id,
         pic.fetched_at,
         pic.number_of_units,
         pic.living_area_sqft,
         pic.year_built,
         pic.land_use_code,
         pic.property_type,
         pic.zoning,
         pic.provider,
         pic.parcel_id,
         pic.county
       FROM property_info_cache pic
       WHERE pic.property_id IS NOT NULL
         ${COUNTY_FILTER ? `AND LOWER(pic.county) = '${COUNTY_FILTER}'` : ''}
         AND NOT EXISTS (
           SELECT 1 FROM property_characteristics pc
           WHERE pc.property_id = pic.property_id
             AND pc.effective_from = pic.fetched_at::date
         )
         AND pic.id > $2::uuid
       ORDER BY pic.id
       LIMIT $1`,
      [batchLimit, lastCacheId]
    );

    if (rows.rows.length === 0) break;

    for (const row of rows.rows) {
      const effectiveFrom = row.fetched_at
        ? new Date(row.fetched_at as string).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      if (DRY_RUN) {
        console.log(
          `  [dry-run] would insert property_characteristics for property_id=${row.property_id} effective_from=${effectiveFrom}`
        );
        inserted++;
        continue;
      }

      try {
        await query(
          `INSERT INTO property_characteristics (
            property_id, effective_from,
            unit_count, building_sf,
            source, source_date, confidence,
            provenance
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (property_id, effective_from) DO NOTHING`,
          [
            row.property_id,
            effectiveFrom,
            row.number_of_units ?? null,
            row.living_area_sqft ?? null,
            'county',
            effectiveFrom,
            0.85,
            JSON.stringify({
              yearBuilt: row.year_built ?? null,
              landUseCode: row.land_use_code ?? null,
              propertyType: row.property_type ?? null,
              zoning: row.zoning ?? null,
              provider: row.provider ?? null,
              sourceTable: 'property_info_cache',
              sourceCacheId: row.cache_id,
            }),
          ]
        );
        inserted++;
      } catch (err) {
        console.warn(
          `  [Backfill2] skip property_id=${row.property_id}: ${err instanceof Error ? err.message : err}`
        );
        skipped++;
      }

      // Always advance keyset cursor past current row (success or failure)
      const cacheId = Number(row.cache_id);
      if (cacheId > lastCacheId) lastCacheId = cacheId;
    }

    if (rows.rows.length < batchLimit) break;
    console.log(`[Backfill2] progress: inserted=${inserted} skipped=${skipped}`);
  }

  console.log(`\n[Backfill2] Complete: inserted=${inserted} skipped=${skipped}`);

  if (!SKIP_CHECK) {
    const totChar = await query(`SELECT COUNT(*) AS cnt FROM property_characteristics`);
    console.log(`[Backfill2] property_characteristics total rows: ${totChar.rows[0].cnt}`);

    // Spot-check 50 rows: verify unit_count matches source
    const sample = await query(
      `SELECT pc.property_id, pc.unit_count, pc.building_sf, pic.number_of_units, pic.living_area_sqft
       FROM property_characteristics pc
       JOIN property_info_cache pic ON pic.property_id = pc.property_id
         AND pic.fetched_at::date = pc.effective_from
       LIMIT 50`
    );
    let mismatches = 0;
    for (const r of sample.rows) {
      if (r.unit_count !== null && r.number_of_units !== null && String(r.unit_count) !== String(r.number_of_units)) {
        console.warn(`  MISMATCH property_id=${r.property_id}: char.unit_count=${r.unit_count} vs pic.number_of_units=${r.number_of_units}`);
        mismatches++;
      }
    }
    console.log(`[Backfill2] Spot-check: ${sample.rows.length} rows verified, ${mismatches} mismatches`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[Backfill2] FATAL:', err);
  process.exit(1);
});
