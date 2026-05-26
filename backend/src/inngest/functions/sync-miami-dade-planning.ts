/**
 * Inngest Cron: Nightly Miami-Dade Planning Application Sweep
 *
 * Fires every night at 03:30 UTC — offset from the 01:00 UTC DPCD/Fulton and
 * 02:00 UTC Accela (Gwinnett/DeKalb/Cobb) sweeps.
 *
 * Scrapes the Miami-Dade BCC zoning hearing case tracker
 * (https://www8.miamidade.gov/Apps/RER/Track/case_track.aspx) for new and
 * updated BCC rezoning, variance, CDMP amendment, and special exception
 * applications filed in the last 7 days, then upserts into planning_applications.
 *
 * Architecture:
 *   Step 1 — Fetch + upsert Miami-Dade BCC cases (combined to avoid Inngest
 *             JSON serialization converting Date → string across step boundaries)
 *   Step 2 — Parcel linkage audit (verify folio → properties table coverage)
 *   Step 3 — Summary
 *
 * Task: #1077
 */

import { inngest } from '../../lib/inngest';
import { fetchMiamiDadePlanningApps } from '../../services/planning/adapters/miami-dade.adapter';
import { upsertPlanningApplications, auditParcelLinkage } from '../../services/planning/planning-ingest.service';
import { logger } from '../../utils/logger';

const LOOKBACK_DAYS = 7;
const JURISDICTION  = 'miami_dade_county';

export const syncMiamiDadePlanningCron = inngest.createFunction(
  {
    id:   'sync-miami-dade-planning',
    name: 'Miami-Dade County: nightly BCC planning application ingest',
    triggers: [{ cron: '30 3 * * *' }],   // 03:30 UTC daily
    concurrency: { limit: 1 },
  },
  async ({ step }) => {

    // ── Step 1: Fetch + upsert BCC cases ─────────────────────────────────
    // Fetch and upsert are combined in one step to keep Date objects in-process
    // (Inngest serialises step return values as JSON, converting Date → string).
    const fetchResult = await step.run('fetch-upsert-miami-dade-bcc', async () => {
      logger.info('[sync-miami-dade] Fetching Miami-Dade BCC case tracker', { lookbackDays: LOOKBACK_DAYS });

      const apps = await fetchMiamiDadePlanningApps(LOOKBACK_DAYS);
      logger.info('[sync-miami-dade] BCC fetch complete', { count: apps.length });

      const upsertResult = await upsertPlanningApplications(apps);
      logger.info('[sync-miami-dade] Upsert complete', { fetched: apps.length, ...upsertResult });

      return { fetched: apps.length, ...upsertResult };
    });

    // ── Step 2: Parcel linkage audit ──────────────────────────────────────
    // Count planning_applications rows whose folio matches a property in the
    // properties table (linkage via parcel_id column).  Non-fatal; provides
    // observability into how much Miami-Dade planning data resolves to deals.
    const linkageResult = await step.run('parcel-linkage-audit', async () => {
      const linked = await auditParcelLinkage(JURISDICTION);
      logger.info('[sync-miami-dade] Parcel linkage audit', { jurisdiction: JURISDICTION, linked });
      return { linked };
    });

    // ── Step 3: Summary ───────────────────────────────────────────────────
    const summary = await step.run('log-summary', async () => {
      const result = {
        sweep_date:    new Date().toISOString().split('T')[0],
        lookback_days: LOOKBACK_DAYS,
        jurisdiction:  JURISDICTION,
        bcc:           fetchResult,
        parcel_linked: linkageResult.linked,
      };

      logger.info('[sync-miami-dade] Nightly sweep complete', result);

      if (fetchResult.errors > 0) {
        logger.warn('[sync-miami-dade] Some records failed to upsert', {
          errors: fetchResult.errors,
        });
      }

      return result;
    });

    return summary;
  },
);
