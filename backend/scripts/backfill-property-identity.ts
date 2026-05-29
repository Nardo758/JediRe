/**
 * Backfill 1 — Property Identity
 * Phase 2: Property Plumbing Refactor
 *
 * Populates properties.parcel_id_canonical for all existing property records
 * by joining properties against property_info_cache and property_records.
 *
 * Algorithm:
 *   1. For each properties row with a non-null parcel_id: build canonical form
 *      and write to parcel_id_canonical if still null.
 *   2. For each property_info_cache row not yet linked to properties:
 *      find-or-create a properties row and write parcel_id_canonical.
 *
 * Re-runnable: uses ON CONFLICT / WHERE parcel_id_canonical IS NULL guards.
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/backfill-property-identity.ts
 * Flags:
 *   --dry-run     Print counts without writing
 *   --limit=N     Process at most N rows per phase (default: all)
 *   --county=X    Only process rows for county X (case-insensitive)
 */

import '../src/utils/env-loader';
import { query, getPool } from '../src/database/connection';
import { propertyResolverService } from '../src/services/property-entity/property-resolver.service';
import { logger } from '../src/utils/logger';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => {
  const flag = args.find((a) => a.startsWith('--limit='));
  return flag ? parseInt(flag.split('=')[1], 10) : 0;
})();
const COUNTY_FILTER = (() => {
  const flag = args.find((a) => a.startsWith('--county='));
  return flag ? flag.split('=')[1].toLowerCase() : null;
})();

const BATCH = 1000;

// ── Phase 1: Update existing properties rows with parcel_id_canonical ──────
// Uses keyset pagination on id to avoid skipping rows as parcel_id_canonical
// is populated (which shrinks the candidate set, invalidating OFFSET-based paging).

async function phase1UpdateExistingProperties(): Promise<{ updated: number; skipped: number }> {
  console.log('[Backfill1] Phase 1: updating properties.parcel_id_canonical from existing rows...');

  const countRes = await query(
    `SELECT COUNT(*) AS cnt FROM properties
     WHERE parcel_id IS NOT NULL
       AND parcel_id_canonical IS NULL
       ${COUNTY_FILTER ? `AND LOWER(county) = $1` : ''}`,
    COUNTY_FILTER ? [COUNTY_FILTER] : []
  );
  const total = parseInt(countRes.rows[0].cnt, 10);
  console.log(`[Backfill1] Phase 1: ${total} rows to process`);

  let lastId = '';
  let updated = 0;
  let skipped = 0;

  while (true) {
    const limit = LIMIT > 0 ? Math.min(BATCH, LIMIT - updated - skipped) : BATCH;
    if (LIMIT > 0 && updated + skipped >= LIMIT) break;

    // Keyset pagination: id > lastId ensures we never re-visit or skip rows
    // even as parcel_id_canonical IS NULL candidates shrink between batches.
    const rows = await query(
      `SELECT id, parcel_id, county, state
       FROM properties
       WHERE parcel_id IS NOT NULL
         AND parcel_id_canonical IS NULL
         ${COUNTY_FILTER ? `AND LOWER(county) = '${COUNTY_FILTER}'` : ''}
         AND id > $2
       ORDER BY id
       LIMIT $1`,
      [limit, lastId]
    );

    if (rows.rows.length === 0) break;

    for (const row of rows.rows) {
      const state = (row.state as string) ?? 'GA';
      const county = (row.county as string) ?? 'unknown';
      const rawId = row.parcel_id as string;

      const canonical = propertyResolverService.buildCanonicalParcelId(state, county, rawId);

      if (DRY_RUN) {
        console.log(`  [dry-run] would set parcel_id_canonical=${canonical} for id=${row.id}`);
        updated++;
        continue;
      }

      try {
        await query(
          `UPDATE properties
           SET parcel_id_canonical = $1, parcel_id_status = 'pending', updated_at = NOW()
           WHERE id = $2 AND parcel_id_canonical IS NULL`,
          [canonical, row.id]
        );
        updated++;
      } catch (err) {
        console.warn(`  [Backfill1] skip id=${row.id}: ${err instanceof Error ? err.message : err}`);
        skipped++;
      }

      // Advance keyset cursor regardless of success/failure so we never loop
      if (!lastId || row.id > lastId) lastId = row.id as string;
    }

    if (rows.rows.length < limit) break;
    console.log(`[Backfill1] Phase 1 progress: ${updated} updated, ${skipped} skipped`);
  }

  return { updated, skipped };
}

// ── Phase 2: Ensure property_info_cache rows have a matching properties row ─
// Uses keyset pagination on id to avoid skipping rows as property_id IS NULL
// candidates shrink between batches (processed rows get property_id set).

async function phase2LinkInfoCacheToProperties(): Promise<{ created: number; linked: number; skipped: number }> {
  console.log('[Backfill1] Phase 2: linking property_info_cache → properties...');

  const countRes = await query(
    `SELECT COUNT(*) AS cnt FROM property_info_cache
     WHERE property_id IS NULL
       ${COUNTY_FILTER ? `AND LOWER(county) = '${COUNTY_FILTER}'` : ''}`,
    []
  );
  const total = parseInt(countRes.rows[0].cnt, 10);
  console.log(`[Backfill1] Phase 2: ${total} unlinked property_info_cache rows`);

  let lastId = 0;
  let created = 0;
  let linked = 0;
  let skipped = 0;

  while (true) {
    const limit = LIMIT > 0 ? Math.min(BATCH, LIMIT - created - linked) : BATCH;
    if (LIMIT > 0 && created + linked >= LIMIT) break;

    // Keyset on id: rows that succeed are updated (property_id set), so they fall
    // out of the WHERE. Rows that fail keep property_id NULL but id > lastId advances
    // past them — preventing infinite retry loops.
    const rows = await query(
      `SELECT id, parcel_id, county, state, address, city, latitude, longitude
       FROM property_info_cache
       WHERE property_id IS NULL
         ${COUNTY_FILTER ? `AND LOWER(county) = '${COUNTY_FILTER}'` : ''}
         AND id > $2
       ORDER BY id
       LIMIT $1`,
      [limit, lastId]
    );

    if (rows.rows.length === 0) break;

    for (const row of rows.rows) {
      const parcelId = row.parcel_id as string;
      const county = (row.county as string) ?? 'unknown';
      const state = (row.state as string) ?? 'GA';

      if (DRY_RUN) {
        console.log(`  [dry-run] would resolve/create property for parcel=${parcelId} county=${county}`);
        created++;
        if (row.id > lastId) lastId = row.id as number;
        continue;
      }

      try {
        const property = await propertyResolverService.resolveByParcel({
          parcelIdRaw: parcelId,
          county,
          state,
          createIfMissing: true,
        });

        if (!property) {
          skipped++;
          if (row.id > lastId) lastId = row.id as number;
          continue;
        }

        // Link property_info_cache.property_id → properties.id
        await query(
          `UPDATE property_info_cache SET property_id = $1 WHERE id = $2 AND property_id IS NULL`,
          [property.id, row.id]
        );

        if (property.parcelIdCanonical) {
          linked++;
        } else {
          created++;
        }
      } catch (err) {
        console.warn(
          `  [Backfill1] skip parcel=${parcelId}: ${err instanceof Error ? err.message : err}`
        );
        skipped++;
      }

      // Always advance cursor past current row
      if (row.id > lastId) lastId = row.id as number;
    }

    if (rows.rows.length < limit) break;
    console.log(`[Backfill1] Phase 2 progress: created=${created} linked=${linked} skipped=${skipped}`);
  }

  return { created, linked, skipped };
}

// ── Spot-check ───────────────────────────────────────────────────────────────

async function spotCheck(): Promise<void> {
  console.log('\n[Backfill1] Spot-check (50 rows):');
  const rows = await query(
    `SELECT id, parcel_id, parcel_id_canonical, county, state
     FROM properties
     WHERE parcel_id_canonical IS NOT NULL
     ORDER BY RANDOM()
     LIMIT 50`
  );
  for (const row of rows.rows) {
    const expected = propertyResolverService.buildCanonicalParcelId(
      (row.state as string) ?? 'GA',
      (row.county as string) ?? 'unknown',
      row.parcel_id as string
    );
    const match = row.parcel_id_canonical === expected;
    if (!match) {
      console.warn(`  MISMATCH id=${row.id}: got=${row.parcel_id_canonical} expected=${expected}`);
    }
  }
  console.log(`[Backfill1] Spot-check: ${rows.rows.length} rows verified`);

  const unlinked = await query(
    `SELECT COUNT(*) AS cnt FROM properties WHERE parcel_id IS NOT NULL AND parcel_id_canonical IS NULL`
  );
  console.log(`[Backfill1] Remaining unlinked: ${unlinked.rows[0].cnt} properties rows`);

  const infoLinked = await query(
    `SELECT COUNT(*) AS total,
            COUNT(property_id) AS linked
     FROM property_info_cache`
  );
  const r = infoLinked.rows[0];
  console.log(`[Backfill1] property_info_cache: ${r.total} total, ${r.linked} linked to properties`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[Backfill1] Starting — dry_run=${DRY_RUN} limit=${LIMIT || 'all'} county=${COUNTY_FILTER || 'all'}`);

  const p1 = await phase1UpdateExistingProperties();
  console.log(`[Backfill1] Phase 1 complete: updated=${p1.updated} skipped=${p1.skipped}`);

  const p2 = await phase2LinkInfoCacheToProperties();
  console.log(`[Backfill1] Phase 2 complete: created=${p2.created} linked=${p2.linked} skipped=${p2.skipped}`);

  await spotCheck();

  console.log('\n[Backfill1] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Backfill1] FATAL:', err);
  process.exit(1);
});
