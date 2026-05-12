/**
 * One-time cleanup: remove historical_observations rows that landed with
 * parcel_id = '' due to the C1 bug in writeT12ToCorpus / writeRentRollToCorpus
 * (empty string passed for parcel_id before the fix in this PR).
 *
 * Run ONCE after the C1/C2 fix is deployed and verified:
 *
 *   cd backend && npx ts-node --transpile-only src/scripts/cleanup-empty-parcel-rows.ts
 *
 * The script is idempotent — running it a second time will report 0 rows affected.
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  logger.info('[CleanupEmptyParcel] Starting cleanup of empty-parcel corpus rows');

  // 1. Count how many rows are affected
  const countResult = await query(
    `SELECT COUNT(*) AS cnt FROM historical_observations WHERE parcel_id = ''`,
  );
  const count = Number(countResult.rows[0]?.cnt) || 0;
  logger.info('[CleanupEmptyParcel] Rows with parcel_id = \'\' found', { count });

  if (count === 0) {
    logger.info('[CleanupEmptyParcel] Nothing to clean up — exiting');
    process.exit(0);
  }

  // 2. Show a sample so we can verify these are the bug-induced rows
  const sampleResult = await query(
    `SELECT id, source_signals, observation_date, created_at
     FROM historical_observations
     WHERE parcel_id = ''
     ORDER BY created_at DESC
     LIMIT 10`,
  );
  logger.info('[CleanupEmptyParcel] Sample rows (newest first):', {
    rows: sampleResult.rows,
  });

  // 3. Delete — these rows are unrecoverable because we cannot map '' → a real
  //    parcel without the deal association, which was also missing from the
  //    ingestor's path. A re-upload of the affected documents after the fix
  //    will land correct rows.
  const deleteResult = await query(
    `DELETE FROM historical_observations
     WHERE parcel_id = ''
     RETURNING id`,
  );
  const deleted = deleteResult.rowCount ?? 0;

  logger.info('[CleanupEmptyParcel] Cleanup complete', {
    rowsDeleted: deleted,
    expectedCount: count,
    match: deleted === count,
  });

  if (deleted !== count) {
    logger.warn('[CleanupEmptyParcel] Deleted count differs from pre-count — possible concurrent insert');
  }

  process.exit(0);
}

main().catch((err) => {
  logger.error('[CleanupEmptyParcel] Fatal error', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
