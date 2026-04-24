/**
 * Inngest Cron: Capture Monthly Market Snapshots
 *
 * Fires on the 1st of every month at 02:00 UTC.
 * Calls SnapshotCaptureService.captureMonthlySnapshots() which upserts
 * market_snapshots rows for the Atlanta MSA and 9 key submarkets.
 *
 * Architecture:
 *   Step 1 — Capture snapshots for all Atlanta geographies
 *   Step 2 — Log results summary
 */

import { inngest } from '../../lib/inngest';
import { snapshotCaptureService } from '../../services/backtest/snapshot-capture.service';
import { logger } from '../../utils/logger';

export const captureMonthlySnapshotsFunction = inngest.createFunction(
  {
    id: 'capture-monthly-snapshots',
    name: 'Atlanta: monthly market snapshot capture',
    triggers: [{ cron: '0 2 1 * *' }],
  },
  async ({ step }) => {
    const captureResult = await step.run(
      'capture-atlanta-snapshots',
      async () => {
        try {
          const result = await snapshotCaptureService.captureMonthlySnapshots();
          logger.info('[Inngest] captureMonthlySnapshots complete', {
            snapshot_date: result.snapshot_date,
            captured: result.captured,
            errors: result.errors,
          });
          return {
            snapshot_date: result.snapshot_date,
            captured: result.captured,
            skipped: result.skipped,
            errors: result.errors,
            geographies: result.results.map(r => ({
              geography_id: r.geography_id,
              avg_asking_rent: r.avg_asking_rent,
              avg_occupancy_pct: r.avg_occupancy_pct,
              data_completeness_score: r.data_completeness_score,
            })),
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error('[Inngest] captureMonthlySnapshots fatal error', { error: msg });
          throw err;
        }
      }
    );

    await step.run('log-snapshot-summary', async () => {
      const { snapshot_date, captured, errors, geographies } = captureResult;
      const highCompleteness = geographies.filter(g => g.data_completeness_score >= 0.5).length;
      logger.info('[Inngest] Snapshot summary', {
        snapshot_date,
        captured,
        errors,
        high_completeness: highCompleteness,
        total_geographies: geographies.length,
      });
      return { snapshot_date, captured, errors, high_completeness: highCompleteness };
    });

    return {
      success: captureResult.errors === 0,
      snapshot_date: captureResult.snapshot_date,
      captured: captureResult.captured,
      errors: captureResult.errors,
    };
  }
);
