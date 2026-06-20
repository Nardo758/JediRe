/**
 * Inngest Cron: Daily Google Realtime Traffic Factor Refresh
 *
 * Lower #7 — Refreshes google_realtime_factor for all properties whose
 * traffic context is stale (>12 hours old). Respects Google Maps API
 * quota limits by batching at 100 properties per run with 200ms delays.
 *
 * Schedule: Daily at 07:00 UTC (off-peak, before business hours)
 *
 * Without this job
 * ─────────────────
 * - google_realtime_factor only updates when someone actively reads a
 *   property's traffic context (getPropertyTrafficContext). Properties
 *   that are not frequently viewed will have stale realtime factors.
 * - TrafficGrowthIndexService computes misleading growth indices because
 *   the realtime factor is stale.
 */

import { inngest } from '../../lib/inngest';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { TrafficDataSourcesService } from '../../services/traffic-data-sources.service';

export const googleRealtimeRefreshCron = inngest.createFunction(
  {
    id: 'google-realtime-refresh',
    name: 'Traffic: Daily Google realtime factor refresh',
    triggers: [{ cron: '0 7 * * *' }], // Daily 07:00 UTC
    retries: 2,
  },
  async ({ step }) => {

    // Step 1 — Refresh stale realtime factors
    const result = await step.run('refresh-stale-factors', async () => {
      const pool = getPool();
      const service = new TrafficDataSourcesService(pool);
      return service.refreshStaleRealtimeFactors(12, 100);
    });

    // Step 2 — Log summary
    await step.run('log-summary', async () => {
      logger.info('[GoogleRealtimeRefresh] Daily refresh complete', {
        refreshed: result.refreshed,
        skipped: result.skipped,
        failed: result.failed,
        elapsedMs: result.elapsedMs,
      });
    });

    return {
      refreshed: result.refreshed,
      skipped: result.skipped,
      failed: result.failed,
      elapsedMs: result.elapsedMs,
    };
  },
);
