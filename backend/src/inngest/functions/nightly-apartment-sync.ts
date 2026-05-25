import { inngest } from '../../lib/inngest';
import { apartmentLocatorSyncService } from '../../services/apartment-locator-sync.service';
import { logger } from '../../utils/logger';

/**
 * Task #635 — Nightly apartment sync cron
 *
 * Fires at 04:00 UTC every day.  Calls syncAllMetros() which iterates 11 metros,
 * writes apartment_class_rent_snapshots (trend history), apartment_supply_pipeline,
 * apartment_locator_properties, and apartment_market_snapshots.
 *
 * Per-metro failures are caught inside syncAllMetros() and do not abort the run.
 * A top-level failure is caught here and logged without rethrowing so Inngest
 * still marks the run complete (the job is best-effort; the API is external).
 */
export const nightlyApartmentSyncCron = inngest.createFunction(
  {
    id: 'nightly-apartment-sync',
    name: 'Nightly Apartment Locator Sync (all metros)',
    retries: 1,
    triggers: [{ cron: '0 4 * * *' }],
  },
  async ({ step }) => {
    const startedAt = new Date().toISOString();

    const result = await step.run('sync-all-metros', async () => {
      try {
        return await apartmentLocatorSyncService.syncAllMetros();
      } catch (err: any) {
        logger.error('[nightly-apartment-sync] syncAllMetros threw unexpectedly', {
          error: err.message,
        });
        return { success: false, results: [] };
      }
    });

    await step.run('log-summary', async () => {
      const succeeded = result.results.filter((r: any) => r.success).length;
      const failed = result.results.filter((r: any) => !r.success).length;
      const totalInserted = result.results.reduce(
        (sum: number, r: any) => sum + (r.inserted || 0),
        0,
      );
      const totalUpdated = result.results.reduce(
        (sum: number, r: any) => sum + (r.updated || 0),
        0,
      );

      logger.info('[nightly-apartment-sync] run complete', {
        started_at: startedAt,
        metros_succeeded: succeeded,
        metros_failed: failed,
        properties_inserted: totalInserted,
        properties_updated: totalUpdated,
      });

      return { succeeded, failed, totalInserted, totalUpdated };
    });

    return {
      success: result.success,
      metros_synced: result.results.length,
      results: result.results,
    };
  },
);
