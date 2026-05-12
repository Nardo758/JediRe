/**
 * Inngest Cron: M07 Weekly Traffic Calibration
 *
 * Fires every Monday at 02:00 UTC.
 *
 * Activates the three-layer Bayesian calibration hierarchy that is already
 * fully implemented in TrafficCalibrationJob:
 *
 *   Baseline   → cold-start BASELINE_COEFFICIENTS constants
 *   Platform   → traffic_calibration_factors Bayesian posteriors  ← this job updates these
 *   Deal/Subject-First → per-deal S1/S2/S3/S4 subject history
 *
 * Without this schedule, platform posteriors remain frozen at seed values and
 * all downstream M07 consumers (M09 ProForma, M25 JEDI, M14 Risk) operate on
 * stale coefficients indefinitely.
 *
 * Weekly cadence rationale:
 *   - Rent-roll snapshots arrive episodically (not daily)
 *   - Bayesian posteriors stabilize over multiple weeks of evidence
 *   - Weekly reduces compute load while keeping calibration meaningfully fresh
 *
 * lookbackHours = 168 (7 days) — matches the weekly cadence so each run folds
 * in exactly the evidence that arrived since the prior run.
 *
 * The existing admin route POST /api/v1/calibration/job/run is unchanged;
 * manual invocations continue to work independently.
 *
 * Per TRAFFIC_ENGINE_STATE_AUDIT.md §11 Fix #1 (TE-02 + TE-08).
 */

import { inngest } from '../../lib/inngest';
import { pool } from '../../database';
import { TrafficCalibrationJob } from '../../jobs/trafficCalibrationJob';
import { logger } from '../../utils/logger';

const LOOKBACK_HOURS = 168; // 7 days — matches weekly cadence

export const trafficCalibrationCron = inngest.createFunction(
  {
    id: 'traffic-calibration-weekly',
    name: 'M07: Weekly Traffic Calibration',
    triggers: [{ cron: '0 2 * * 1' }], // Every Monday at 02:00 UTC
    retries: 1,
  },
  async ({ step }) => {
    const result = await step.run('run-calibration', async () => {
      logger.info('[TrafficCalibrationCron] Starting weekly calibration', {
        lookbackHours: LOOKBACK_HOURS,
        scheduledFor: new Date().toISOString(),
      });

      try {
        const job = new TrafficCalibrationJob(pool);
        const jobResult = await job.run(LOOKBACK_HOURS);

        logger.info('[TrafficCalibrationCron] Complete', {
          buckets_updated: jobResult.buckets_updated,
          buckets_created: jobResult.buckets_created,
          properties_processed: jobResult.properties_processed,
          absorption_benchmarks_updated: jobResult.absorption_benchmarks_updated,
          job_version: jobResult.job_version,
          run_at: jobResult.run_at.toISOString(),
        });

        return jobResult;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('[TrafficCalibrationCron] Job failed', {
          error: message,
          lookbackHours: LOOKBACK_HOURS,
        });
        throw err;
      }
    });

    return result;
  },
);
