/**
 * Inngest Cron: Nightly M35 Atlanta Data Connectors
 *
 * #13 — Provisions the active M35 event data feed by running the Atlanta
 * data connectors nightly:
 *   1. Atlanta Building Permits (Socrata)
 *   2. Atlanta DPCD Rezoning + SUPs (ArcGIS)
 *
 * Draft events land in m35_draft_events for analyst review.
 * The M35 Event Ingested Kafka consumer handles downstream effects
 * (M08 cache bust, JEDI recompute, pipeline signal refresh) when
 * analysts promote drafts to live key_events.
 *
 * Schedule: Daily at 02:00 UTC (off-peak, after midnight data refreshes)
 *
 * Without this job
 * ─────────────────
 * - m35_draft_events is only populated when someone manually triggers
 *   a connector via POST /api/m35/connectors/run or /run-all.
 * - The active event feed is stale; new permits, rezonings, and SUPs
 *   are not surfaced for analyst review.
 * - Portfolio event feeds, deal context banners, and pipeline signals
 *   miss recently announced developments.
 */

import { inngest } from '../../lib/inngest';
import { logger } from '../../utils/logger';
import {
  runAllAtlantaConnectors,
  type ConnectorRunStats,
} from '../../services/m35-event-connectors.service';

export const m35ConnectorsNightlyCron = inngest.createFunction(
  {
    id: 'm35-connectors-nightly',
    name: 'M35: Nightly Atlanta data connectors',
    triggers: [{ cron: '0 2 * * *' }], // Daily 02:00 UTC
    retries: 2,
  },
  async ({ step }) => {

    // Step 1 — Run all Atlanta connectors
    const results: ConnectorRunStats[] = await step.run('run-connectors', async () => {
      return runAllAtlantaConnectors();
    });

    // Step 2 — Log summary
    await step.run('log-summary', async () => {
      const totalCreated = results.reduce((s, r) => s + r.draftEventsCreated, 0);
      const totalSkipped = results.reduce((s, r) => s + r.draftEventsSkipped, 0);
      const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

      for (const r of results) {
        logger.info(`[M35 Connectors] ${r.connector} complete`, {
          scanned: r.recordsScanned,
          created: r.draftEventsCreated,
          skipped: r.draftEventsSkipped,
          duplicates: r.duplicatesIgnored,
          errors: r.errors.length,
          durationMs: r.durationMs,
        });
      }

      logger.info('[M35 Connectors] Nightly run complete', {
        connectors: results.length,
        totalCreated,
        totalSkipped,
        totalErrors,
      });
    });

    return {
      connectors: results.map(r => ({
        connector: r.connector,
        scanned: r.recordsScanned,
        created: r.draftEventsCreated,
        skipped: r.draftEventsSkipped,
        errors: r.errors.length,
        durationMs: r.durationMs,
      })),
    };
  },
);
