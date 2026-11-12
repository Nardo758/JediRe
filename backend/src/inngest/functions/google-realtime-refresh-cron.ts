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
 *
 * The traffic growth index no longer reads google_realtime_factor (DL-192):
 * that factor is a congestion ratio, not a volume. Growth is computed from
 * the hourly speed samples collected by trafficSpeedSampleCron below.
 */

import { inngest } from '../../lib/inngest';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { TrafficDataSourcesService } from '../../services/traffic-data-sources.service';
import { TrafficSpeedSamplerService } from '../../services/traffic-speed-sampler.service';
import { isTrafficSpeedSamplingEnabled } from '../../config/traffic-growth.config';

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

/**
 * Inngest Cron: hourly traffic speed sampling (DL-192)
 *
 * Runs every hour and samples the properties whose local clock reads one of
 * the configured sample hours. Each run is capped so a full day stays within
 * the daily sample budget. Does nothing unless TRAFFIC_SPEED_SAMPLING_ENABLED
 * is 'true', because every sample is a Google Directions call.
 */
export const trafficSpeedSampleCron = inngest.createFunction(
  {
    id: 'traffic-speed-sample',
    name: 'Traffic: Hourly speed sampling for the growth index',
    triggers: [{ cron: '5 * * * *' }], // Hourly at :05
    retries: 1,
  },
  async ({ step }) => {
    if (!isTrafficSpeedSamplingEnabled()) {
      return { status: 'disabled' as const };
    }

    const run = await step.run('sample-due-properties', async () => {
      const pool = getPool();
      const sampler = new TrafficSpeedSamplerService(pool, {
        travelTimes: new TrafficDataSourcesService(pool),
      });
      return sampler.sampleDueProperties();
    });

    const purged = await step.run('purge-expired-samples', async () => {
      const pool = getPool();
      const sampler = new TrafficSpeedSamplerService(pool, {
        travelTimes: new TrafficDataSourcesService(pool),
      });
      return sampler.purgeExpiredSamples();
    });

    return { status: 'ran' as const, ...run, purged };
  },
);
