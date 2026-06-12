/**
 * One-time backfill: stories count on existing properties from property_info_cache
 *
 * Existing `properties` rows that have a matching `parcel_id` in
 * `property_info_cache` may still have `stories = NULL` (or 0) because they
 * predate the proximity-enrichment script's stories write. This script
 * performs a single JOIN-UPDATE to fill those gaps from the already-cached
 * county assessor data.
 *
 * Safe to re-run: the WHERE clause skips rows that already have stories > 0.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/backfill-properties-stories.ts
 *   cd backend && npx ts-node --transpile-only scripts/backfill-properties-stories.ts --dry-run
 */

import 'dotenv/config';
import { getPool, connectDatabase } from '../src/database/connection';
import { logger } from '../src/utils/logger';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  logger.info('[backfill-properties-stories] Starting', { dryRun: DRY_RUN });

  await connectDatabase();
  const pool = getPool();

  // First, report how many rows are eligible for the update.
  const preview = await pool.query<{ count: string }>(`
    SELECT COUNT(*) AS count
      FROM properties p
      JOIN property_info_cache pic ON pic.parcel_id = p.parcel_id
     WHERE (p.stories IS NULL OR p.stories = 0)
       AND pic.stories IS NOT NULL
       AND pic.stories > 0
  `);

  const eligible = parseInt(preview.rows[0]?.count ?? '0', 10);
  logger.info(`[backfill-properties-stories] Eligible rows: ${eligible}`);

  if (eligible === 0) {
    logger.info('[backfill-properties-stories] Nothing to update — exiting.');
    await pool.end();
    return;
  }

  if (DRY_RUN) {
    logger.info('[backfill-properties-stories] Dry-run mode — no writes performed.');
    await pool.end();
    return;
  }

  const result = await pool.query<{ property_id: string; address: string; stories: number }>(`
    UPDATE properties p
       SET stories = pic.stories
      FROM property_info_cache pic
     WHERE pic.parcel_id = p.parcel_id
       AND (p.stories IS NULL OR p.stories = 0)
       AND pic.stories IS NOT NULL
       AND pic.stories > 0
    RETURNING p.property_id, p.address, p.stories
  `);

  const updated = result.rowCount ?? 0;
  logger.info(`[backfill-properties-stories] Updated ${updated} row(s).`);

  if (result.rows.length > 0) {
    logger.info('[backfill-properties-stories] Updated properties:');
    for (const row of result.rows) {
      logger.info(`  property_id=${row.property_id}  stories=${row.stories}  address=${row.address}`);
    }
  }

  logger.info('[backfill-properties-stories] Done.');
  await pool.end();
}

main().catch((err) => {
  logger.error('[backfill-properties-stories] Fatal error', { error: err });
  process.exit(1);
});
