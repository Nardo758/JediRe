/**
 * Inngest Cron: Nightly Rolling Correlation Compute (Task #919)
 *
 * Fires every night at 03:00 UTC.
 * For every geography tracked in metric_time_series, recomputes
 * correlations for 12-month and 36-month rolling windows, writing
 * the latest value to metric_correlations (overwrite) and appending
 * a snapshot to correlation_history.
 *
 * Architecture:
 *   Step 1 — load all distinct geographies from metric_time_series
 *   Step 2 — run 12-month window across all geographies
 *   Step 3 — run 36-month window across all geographies
 *   Step 4 — log summary
 */

import { inngest } from '../../lib/inngest';
import { getPool } from '../../database/connection';
import { CorrelationEngineService } from '../../services/correlationEngine.service';
import { logger } from '../../utils/logger';

export const correlationRollingComputeCron = inngest.createFunction(
  {
    id: 'correlation-rolling-compute-nightly',
    name: 'Nightly: rolling correlation compute (12m + 36m)',
    triggers: [{ cron: '0 3 * * *' }],
    retries: 2,
  },
  async ({ step }) => {
    const geographies = await step.run('load-geographies', async () => {
      const pool = getPool();
      const res = await pool.query<{ geography_type: string; geography_id: string }>(
        `SELECT DISTINCT geography_type, geography_id
         FROM metric_time_series
         WHERE geography_id IS NOT NULL
         ORDER BY geography_type, geography_id`
      );
      logger.info('[CorrelationCron] loaded geographies', { count: res.rowCount });
      return res.rows;
    });

    const results12 = await step.run('compute-12m-window', async () => {
      const pool = getPool();
      const engine = new CorrelationEngineService(pool);
      const out: Array<{ geo: string; computed: number; skipped: number; error?: string }> = [];
      for (const { geography_type, geography_id } of geographies) {
        try {
          await engine.computeTimeSeriesCorrelations(geography_type, geography_id, 12);
          out.push({ geo: `${geography_type}:${geography_id}`, computed: 1, skipped: 0 });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn('[CorrelationCron] 12m failed', { geography_type, geography_id, error: msg });
          out.push({ geo: `${geography_type}:${geography_id}`, computed: 0, skipped: 1, error: msg });
        }
      }
      return out;
    });

    const results36 = await step.run('compute-36m-window', async () => {
      const pool = getPool();
      const engine = new CorrelationEngineService(pool);
      const out: Array<{ geo: string; computed: number; skipped: number; error?: string }> = [];
      for (const { geography_type, geography_id } of geographies) {
        try {
          await engine.computeTimeSeriesCorrelations(geography_type, geography_id, 36);
          out.push({ geo: `${geography_type}:${geography_id}`, computed: 1, skipped: 0 });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn('[CorrelationCron] 36m failed', { geography_type, geography_id, error: msg });
          out.push({ geo: `${geography_type}:${geography_id}`, computed: 0, skipped: 1, error: msg });
        }
      }
      return out;
    });

    await step.run('log-summary', async () => {
      const total12ok = results12.filter(r => r.computed > 0).length;
      const total36ok = results36.filter(r => r.computed > 0).length;
      const total12err = results12.filter(r => r.error).length;
      const total36err = results36.filter(r => r.error).length;
      logger.info('[CorrelationCron] nightly complete', {
        geographies: geographies.length,
        window_12m: { ok: total12ok, errors: total12err },
        window_36m: { ok: total36ok, errors: total36err },
      });
      return { geographies: geographies.length, window_12m: total12ok, window_36m: total36ok };
    });

    return {
      geographies: geographies.length,
      windows_computed: results12.length + results36.length,
    };
  }
);
