/**
 * Inngest Cron: M40 Scenario Archival — Daily at 03:00 UTC
 *
 * Runs three policies sequentially:
 *   1. Auto-archive: agent scenarios older than 30 days, not referenced
 *   2. Compression: agent scenarios older than 90 days, keep first per month
 *   3. Hard-delete: soft-deleted scenarios older than 90 days
 *
 * Low-traffic time (03:00 UTC) to avoid conflict with user activity.
 */

import { inngest } from '../../lib/inngest';
import { scenarioArchivalService } from '../../services/scenario-archival.service';
import { logger } from '../../utils/logger';

export const scenarioArchivalCron = inngest.createFunction(
  {
    id: 'scenario-archival-daily',
    name: 'M40: Daily Scenario Archival',
    triggers: [{ cron: '0 3 * * *' }], // Every day at 03:00 UTC
    retries: 1,
  },
  async ({ step }) => {
    const result = await step.run('run-archival', async () => {
      logger.info('[ScenarioArchivalCron] Starting daily archival run', {
        scheduledFor: new Date().toISOString(),
      });

      const report = await scenarioArchivalService.runDaily();

      logger.info('[ScenarioArchivalCron] Complete', report);
      return report;
    });

    return result;
  }
);
