/**
 * Inngest Cron: Weekly SpyFu Missing Data Health Check
 *
 * Lower #8 — Scans all active domain connections and logs warnings for
 * properties where SpyFu data is missing, stale (>14 days), or errored.
 *
 * Schedule: Every Monday at 08:00 UTC
 *
 * Without this job
 * ─────────────────
 * - Operators only discover missing SpyFu data when they manually visit
 *   a property's analytics page. Stale data silently poisons downstream
 *   digital-share and competitor analyses.
 */

import { inngest } from '../../lib/inngest';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { PropertyAnalyticsService } from '../../services/property-analytics.service';

export const spyfuMissingDataCron = inngest.createFunction(
  {
    id: 'spyfu-missing-data-check',
    name: 'Analytics: Weekly SpyFu missing-data health check',
    triggers: [{ cron: '0 8 * * 1' }], // Every Monday at 08:00 UTC
    retries: 2,
  },
  async ({ step }) => {

    const warnings = await step.run('scan-spyfu-warnings', async () => {
      const pool = getPool();
      const service = new PropertyAnalyticsService(pool);
      return service.getSpyFuMissingDataWarnings(14);
    });

    await step.run('log-summary', async () => {
      const byStatus = warnings.reduce((acc, w) => {
        acc[w.status] = (acc[w.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      logger.info('[SpyFuMissingDataCheck] Weekly scan complete', {
        totalWarnings: warnings.length,
        missing: byStatus['missing'] || 0,
        stale: byStatus['stale'] || 0,
        error: byStatus['error'] || 0,
      });
    });

    return {
      totalWarnings: warnings.length,
      missing: warnings.filter(w => w.status === 'missing').length,
      stale: warnings.filter(w => w.status === 'stale').length,
      error: warnings.filter(w => w.status === 'error').length,
    };
  },
);
