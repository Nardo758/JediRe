/**
 * Inngest Cron: Sync MARTA GTFS Transit Stops
 *
 * Fires quarterly (1st Jan/Apr/Jul/Oct at 03:00 UTC).
 * Downloads MARTA's GTFS stops.txt feed and upserts all transit stop rows
 * within the Atlanta metro bounding box into points_of_interest.
 *
 * Architecture:
 *   Step 1 — Fetch and parse GTFS zip, upsert stops
 *   Step 2 — Log summary
 */

import { inngest } from '../../lib/inngest';
import { syncMartaGtfs } from '../../services/real-data/marta-gtfs.service';
import { logger } from '../../utils/logger';

export const syncMartaGtfsFunction = inngest.createFunction(
  {
    id: 'sync-marta-gtfs',
    name: 'Atlanta: sync MARTA GTFS transit stops (quarterly)',
    triggers: [{ cron: '0 3 1 1,4,7,10 *' }],
  },
  async ({ step }) => {
    const result = await step.run('fetch-and-upsert-marta-stops', async () => {
      try {
        const r = await syncMartaGtfs();
        logger.info('[Inngest] syncMartaGtfs complete', r);
        return r;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[Inngest] syncMartaGtfs fatal', { error: msg });
        throw err;
      }
    });

    await step.run('log-marta-summary', async () => {
      logger.info('[Inngest] MARTA sync summary', {
        fetched: result.fetched,
        upserted: result.upserted,
        skipped: result.skipped,
        errors: result.errors.length,
      });
      return { fetched: result.fetched, upserted: result.upserted };
    });

    return {
      success: result.errors.length === 0,
      fetched: result.fetched,
      upserted: result.upserted,
      skipped: result.skipped,
    };
  }
);
