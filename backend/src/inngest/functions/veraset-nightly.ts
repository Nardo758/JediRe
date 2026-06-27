/**
 * Veraset Nightly Ingestion — Inngest Scheduled Function
 *
 * Runs daily at 03:00 UTC for every MSA with an active Veraset subscription.
 * Gated by subscription.is_active — if no active subscriptions, the function
 * exits immediately with a skip log.
 *
 * When the paid subscription deal is active and API credentials are configured,
 * this function will:
 *   1. Fetch daily mobility data from the Veraset API
 *   2. Upsert into historical_observations.mobility_* columns
 *   3. Log results to veraset_ingest_jobs
 *
 * Until then, it is a stub that logs readiness status.
 *
 * @see backend/src/services/veraset-mobility.service.ts
 */

import { inngest } from '../../lib/inngest';
import { verasetMobilityService } from '../../services/veraset-mobility.service';
import { logger } from '../../utils/logger';

export const verasetNightlyIngest = inngest.createFunction(
  {
    id: 'veraset-nightly-ingest',
    name: 'Veraset Mobility Nightly Ingest',
    concurrency: { limit: 1 },
  },
  { cron: 'TZ=UTC 0 3 * * *' }, // 03:00 UTC daily
  async ({ step }) => {
    // Step 1: Discover active subscriptions
    const activeSubs = await step.run('discover-active-subscriptions', async () => {
      return verasetMobilityService.getActiveSubscriptions();
    });

    if (activeSubs.length === 0) {
      logger.info('[Veraset Nightly] No active subscriptions — skipping ingest');
      return { status: 'skipped', reason: 'no_active_subscriptions' };
    }

    logger.info('[Veraset Nightly] Starting ingest for MSAs', {
      count: activeSubs.length,
      msas: activeSubs.map((s) => s.msaId),
    });

    // Step 2: Ingest per MSA (parallel)
    const results = await step.run('ingest-per-msa', async () => {
      const ingestions = activeSubs.map(async (sub) => {
        const result = await verasetMobilityService.ingestDailyMobility(sub.msaId, {
          msaId: sub.msaId,
          observationDate: new Date().toISOString().slice(0, 10), // today as YYYY-MM-DD
          visitsMonthly: 0,
          uniqueVisitors: 0,
          visitsPerSqFt: 0,
          rawSummary: { stub: true, note: 'Replace with real Veraset API call when deal active' },
        });

        return { msaId: sub.msaId, ...result };
      });

      return Promise.all(ingestions);
    });

    const completed = results.filter((r) => r.status === 'completed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    logger.info('[Veraset Nightly] Ingest complete', {
      completed,
      failed,
      skipped,
      total: results.length,
    });

    return {
      status: 'completed',
      msasProcessed: results.length,
      completed,
      failed,
      skipped,
      results,
    };
  },
);
