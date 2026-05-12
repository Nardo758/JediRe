/**
 * Inngest Cron: Historical Observations — Nightly Realized Output Backfill
 *
 * Runs nightly at 03:00 UTC.
 * Scans historical_observations for rows where the T+N window has closed
 * but realized_* columns are still NULL, and backfills them using the
 * RealizedOutputsService.
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 7
 */

import { inngest } from '../../lib/inngest';
import { logger } from '../../utils/logger';
import { realizedOutputsService } from '../../services/historical-observations/realized-outputs.service';

export const historicalObservationsBackfill = inngest.createFunction(
  {
    id: 'historical-obs-backfill',
    name: 'Historical Obs: nightly realized output backfill',
    triggers: [{ cron: '0 3 * * *' }], // Every day at 03:00 UTC
    retries: 2,
  },
  async ({ step }) => {
    const result = await step.run('backfill-overdue', async () => {
      logger.info('[HistoricalObsBackfill] Starting nightly backfill');
      const outcome = await realizedOutputsService.backfillAllOverdue();
      logger.info('[HistoricalObsBackfill] Complete', outcome);
      return {
        status: 'ok',
        processed: outcome.processed,
        errors: outcome.errors,
      };
    });

    return result;
  },
);
