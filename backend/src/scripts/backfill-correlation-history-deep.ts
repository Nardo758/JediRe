/**
 * Deep historical backfill — Task #919: Historical correlations pipeline
 *
 * Computes rolling correlations at quarterly as-of dates spanning the last
 * 8 quarters (2022-Q4 → 2024-Q4), building a multi-point sparkline series
 * in correlation_history so stability scores become non-null immediately.
 *
 * The shallow backfill (backfill-correlation-history.ts) only copied the
 * latest metric_correlations snapshot (one date). This script generates
 * additional historical snapshots by re-running the correlation engine
 * against metric_time_series data that existed at each as-of date.
 *
 * Safe to re-run: ON CONFLICT DO NOTHING prevents duplicate rows.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only src/scripts/backfill-correlation-history-deep.ts
 *
 * Flags:
 *   --window=12         Only backfill 12-month window (default: both 12 and 36)
 *   --window=36         Only backfill 36-month window
 *   --geo=msa           Only backfill geographies of this type (default: all)
 */

import { getPool } from '../database/connection';
import { CorrelationEngineService } from '../services/correlationEngine.service';
import { logger } from '../utils/logger';

// Quarterly as-of dates: end-of-quarter from 2022-Q4 to 2024-Q4
const AS_OF_DATES: string[] = [
  '2022-12-31',
  '2023-03-31',
  '2023-06-30',
  '2023-09-30',
  '2023-12-31',
  '2024-03-31',
  '2024-06-30',
  '2024-09-30',
  '2024-12-31',
];

async function main() {
  const args = process.argv.slice(2);
  const windowArg = args.find(a => a.startsWith('--window='))?.split('=')[1];
  const geoArg = args.find(a => a.startsWith('--geo='))?.split('=')[1];
  const windows = windowArg ? [parseInt(windowArg, 10)] : [12, 36];

  const pool = getPool();
  const engine = new CorrelationEngineService(pool);

  logger.info('[deep-backfill] starting', { asOfDates: AS_OF_DATES.length, windows });

  // Load distinct geographies
  let geoQuery = `SELECT DISTINCT geography_type, geography_id
     FROM metric_time_series
     WHERE geography_id IS NOT NULL`;
  if (geoArg) geoQuery += ` AND geography_type = '${geoArg.replace(/'/g, '')}'`;
  geoQuery += ' ORDER BY geography_type, geography_id';

  const geoRes = await pool.query<{ geography_type: string; geography_id: string }>(geoQuery);
  const geographies = geoRes.rows;
  logger.info(`[deep-backfill] ${geographies.length} geographies × ${AS_OF_DATES.length} dates × ${windows.length} windows`);

  let totalComputed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const dateStr of AS_OF_DATES) {
    const asOfDate = new Date(dateStr);
    logger.info(`[deep-backfill] processing as-of ${dateStr}`);

    for (const { geography_type, geography_id } of geographies) {
      for (const windowMonths of windows) {
        try {
          const { computed, skipped } = await engine.computeTimeSeriesCorrelationsAsOf(
            geography_type, geography_id, windowMonths, asOfDate
          );
          totalComputed += computed;
          totalSkipped += skipped;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn('[deep-backfill] error', { geography_type, geography_id, dateStr, windowMonths, error: msg });
          totalErrors++;
        }
      }
    }

    logger.info(`[deep-backfill] ${dateStr} done`, {
      totalComputed, totalSkipped, totalErrors,
    });
  }

  logger.info('[deep-backfill] complete', { totalComputed, totalSkipped, totalErrors });
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  logger.error('[deep-backfill] fatal', { error: err?.message ?? String(err) });
  process.exit(1);
});
