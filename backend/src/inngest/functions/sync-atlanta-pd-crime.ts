/**
 * Inngest Cron: Sync Atlanta PD Crime Statistics
 *
 * Fires weekly on Monday at 05:00 UTC.
 * Fetches the past 12 months of crime incidents from the Atlanta PD ArcGIS
 * feature layer, aggregates by ZIP code into a normalised crime index
 * (city average = 100), and upserts into crime_statistics.
 *
 * Architecture:
 *   Step 1 — Fetch incidents from ArcGIS, aggregate, upsert
 *   Step 2 — Log summary
 */

import { inngest } from '../../lib/inngest';
import { syncAtlantaPdCrime } from '../../services/real-data/atlanta-pd-crime.service';
import { logger } from '../../utils/logger';

export const syncAtlantaPdCrimeFunction = inngest.createFunction(
  {
    id: 'sync-atlanta-pd-crime',
    name: 'Atlanta: sync PD crime statistics (weekly)',
    triggers: [{ cron: '0 5 * * 1' }],
  },
  async ({ step }) => {
    const result = await step.run('fetch-and-upsert-crime-stats', async () => {
      try {
        const r = await syncAtlantaPdCrime();
        logger.info('[Inngest] syncAtlantaPdCrime complete', r);
        return r;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[Inngest] syncAtlantaPdCrime fatal', { error: msg });
        throw err;
      }
    });

    await step.run('log-crime-summary', async () => {
      logger.info('[Inngest] Crime sync summary', {
        total_incidents: result.total_incidents,
        zip_codes: result.zip_codes_processed,
        rows_upserted: result.rows_upserted,
        period: `${result.period_start} → ${result.period_end}`,
        errors: result.errors.length,
      });
      return {
        zip_codes: result.zip_codes_processed,
        rows_upserted: result.rows_upserted,
      };
    });

    return {
      success: result.errors.length === 0,
      total_incidents: result.total_incidents,
      zip_codes_processed: result.zip_codes_processed,
      rows_upserted: result.rows_upserted,
      period_start: result.period_start,
      period_end: result.period_end,
    };
  }
);
