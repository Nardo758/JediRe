/**
 * Inngest Cron: Historical Observations — Nightly Realized Output Backfill
 *
 * Runs nightly at 03:00 UTC.
 * Checks for historical_observations rows where the T+N window has closed
 * but realized_* columns are still NULL, and backfills them.
 *
 * Phase 1: Stub — logs only.
 * Phase 2: Full implementation using RealizedOutputsService.backfillAllOverdue().
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 7
 */

import { inngest } from '../../lib/inngest';
import { logger } from '../../utils/logger';

export const historicalObservationsBackfill = inngest.createFunction(
  {
    id: 'historical-obs-backfill',
    name: 'Historical Obs: nightly realized output backfill',
    triggers: [{ cron: '0 3 * * *' }], // Every day at 03:00 UTC
    retries: 2,
  },
  async ({ step }) => {
    const result = await step.run('log-stub', async () => {
      logger.info(
        '[HistoricalObsBackfill] Stub — backfill not yet implemented. Phase 2 will call RealizedOutputsService.backfillAllOverdue()',
      );
      return { status: 'stub', processed: 0, errors: 0 };
    });

    return result;
  },
);
