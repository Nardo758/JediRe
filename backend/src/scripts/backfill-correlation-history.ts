/**
 * Backfill script — Task #919: Historical correlations pipeline
 *
 * Seeds correlation_history from the existing metric_correlations rows.
 * Each metric_correlations row represents the most-recently computed value;
 * we insert it into correlation_history using its computed_at timestamp so
 * the history table has at least one baseline entry per pair.
 *
 * Safe to re-run: the UNIQUE index on (metric_a, metric_b, geography_type,
 * geography_id, window_months, computed_at::date) means duplicates for the
 * same calendar day are silently skipped via ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only src/scripts/backfill-correlation-history.ts
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

async function main() {
  const pool = getPool();

  logger.info('[backfill-correlation-history] starting');

  const existing = await pool.query<{
    metric_a: string;
    metric_b: string;
    geography_type: string;
    geography_id: string | null;
    window_months: number;
    correlation_r: string;
    p_value: string | null;
    sample_size: string;
    observation_start: Date | null;
    observation_end: Date | null;
    computed_at: Date;
  }>(
    `SELECT metric_a, metric_b, geography_type, geography_id, window_months,
            correlation_r, p_value, sample_size, observation_start, observation_end, computed_at
     FROM metric_correlations
     ORDER BY computed_at`
  );

  logger.info(`[backfill-correlation-history] found ${existing.rowCount} rows in metric_correlations`);

  let inserted = 0;
  let skipped = 0;

  for (const row of existing.rows) {
    const computedDate = row.computed_at instanceof Date
      ? row.computed_at.toISOString().slice(0, 10)
      : String(row.computed_at).slice(0, 10);

    const res = await pool.query(
      `INSERT INTO correlation_history
         (metric_a, metric_b, geography_type, geography_id, window_months,
          computed_at, computed_date, correlation_r, p_value, sample_size, observation_start, observation_end, scope_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, 'GLOBAL')
       ON CONFLICT (scope_id, metric_a, metric_b, geography_type, COALESCE(geography_id, ''), window_months, computed_date)
       DO NOTHING`,
      [
        row.metric_a,
        row.metric_b,
        row.geography_type,
        row.geography_id ?? null,
        row.window_months,
        row.computed_at,
        computedDate,
        parseFloat(row.correlation_r),
        row.p_value != null ? parseFloat(row.p_value) : null,
        parseInt(row.sample_size),
        row.observation_start ?? null,
        row.observation_end ?? null,
      ]
    );
    if ((res.rowCount ?? 0) > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  logger.info('[backfill-correlation-history] complete', { inserted, skipped });
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  logger.error('[backfill-correlation-history] fatal', { error: err?.message ?? String(err) });
  process.exit(1);
});
