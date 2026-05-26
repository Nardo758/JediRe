/**
 * Inngest Cron: Nightly Accela Planning Application Sweep
 *
 * Fires every night at 02:00 UTC (different from the 01:00 UTC DPCD/Fulton sweep).
 * Polls Gwinnett, DeKalb, and Cobb county Accela portals for planning applications
 * filed or updated in the last 7 days, then upserts into planning_applications.
 *
 * Architecture:
 *   Step 1 — Gwinnett County Accela (aca-prod.accela.com/GWINNETT)
 *   Step 2 — Gwinnett HTML fallback (gwinnettcounty.com applications-received)
 *   Step 3 — DeKalb County Accela (epermits.dekalbcountyga.gov)
 *   Step 4 — Cobb County Accela (cobbca.cobbcounty.gov/CitizenAccess)
 *   Step 5 — Summary
 *
 * Fetch + upsert are combined into each step to avoid Inngest JSON serialization
 * converting Date → string across step boundaries (same pattern as Task #1075).
 *
 * Task: #1076
 */

import { inngest } from '../../lib/inngest';
import {
  scrapeAccelaAgency,
  GWINNETT_CONFIG,
  DEKALB_CONFIG,
  COBB_CONFIG,
} from '../../services/planning/adapters/accela-scraper.adapter';
import { fetchGwinnettHtmlFallback } from '../../services/planning/adapters/gwinnett-html-fallback.adapter';
import { upsertPlanningApplications, auditParcelLinkage } from '../../services/planning/planning-ingest.service';
import { logger } from '../../utils/logger';

const LOOKBACK_DAYS = 7;

export const syncAccelaPlanningCron = inngest.createFunction(
  {
    id:   'sync-accela-planning',
    name: 'Gwinnett + DeKalb + Cobb: nightly Accela planning application ingest',
    triggers: [{ cron: '0 2 * * *' }],   // 02:00 UTC daily (offset from DPCD sweep)
    concurrency: { limit: 1 },
  },
  async ({ step }) => {

    // ── Step 1: Gwinnett County — Accela ─────────────────────────────────
    const gwinnettAccelaResult = await step.run('fetch-upsert-gwinnett-accela', async () => {
      logger.info('[sync-accela] Fetching Gwinnett County (Accela)', { lookbackDays: LOOKBACK_DAYS });
      const apps = await scrapeAccelaAgency(GWINNETT_CONFIG, LOOKBACK_DAYS);
      const upsertResult = await upsertPlanningApplications(apps);
      logger.info('[sync-accela] Gwinnett Accela upsert complete', { fetched: apps.length, ...upsertResult });
      return { fetched: apps.length, ...upsertResult };
    });

    // ── Step 2: Gwinnett County — HTML fallback ───────────────────────────
    const gwinnettHtmlResult = await step.run('fetch-upsert-gwinnett-html', async () => {
      logger.info('[sync-accela] Fetching Gwinnett HTML fallback');
      const apps = await fetchGwinnettHtmlFallback(LOOKBACK_DAYS);
      // Deduplicate by case_number against what Accela already returned
      // (upsert conflict handles true dupes; this just avoids redundant DB round-trips)
      const upsertResult = await upsertPlanningApplications(apps);
      logger.info('[sync-accela] Gwinnett HTML upsert complete', { fetched: apps.length, ...upsertResult });

      // Audit parcel linkage for Gwinnett after both sources are ingested
      const linked = await auditParcelLinkage('gwinnett_county');
      logger.info('[sync-accela] Gwinnett parcel linkage audit', { linked });
      return { fetched: apps.length, ...upsertResult, parcel_linked: linked };
    });

    // ── Step 3: DeKalb County — Accela ───────────────────────────────────
    const dekalbResult = await step.run('fetch-upsert-dekalb-accela', async () => {
      logger.info('[sync-accela] Fetching DeKalb County (Accela)', { lookbackDays: LOOKBACK_DAYS });
      const apps = await scrapeAccelaAgency(DEKALB_CONFIG, LOOKBACK_DAYS);
      const upsertResult = await upsertPlanningApplications(apps);
      const linked = await auditParcelLinkage('dekalb_county');
      logger.info('[sync-accela] DeKalb upsert complete', { fetched: apps.length, ...upsertResult, linked });
      return { fetched: apps.length, ...upsertResult, parcel_linked: linked };
    });

    // ── Step 4: Cobb County — Accela ─────────────────────────────────────
    const cobbResult = await step.run('fetch-upsert-cobb-accela', async () => {
      logger.info('[sync-accela] Fetching Cobb County (Accela)', { lookbackDays: LOOKBACK_DAYS });
      const apps = await scrapeAccelaAgency(COBB_CONFIG, LOOKBACK_DAYS);
      const upsertResult = await upsertPlanningApplications(apps);
      const linked = await auditParcelLinkage('cobb_county');
      logger.info('[sync-accela] Cobb upsert complete', { fetched: apps.length, ...upsertResult, linked });
      return { fetched: apps.length, ...upsertResult, parcel_linked: linked };
    });

    // ── Step 5: Summary ───────────────────────────────────────────────────
    const summary = await step.run('log-summary', async () => {
      const result = {
        sweep_date:     new Date().toISOString().split('T')[0],
        lookback_days:  LOOKBACK_DAYS,
        gwinnett_accela: gwinnettAccelaResult,
        gwinnett_html:   gwinnettHtmlResult,
        dekalb:          dekalbResult,
        cobb:            cobbResult,
        total_fetched:  gwinnettAccelaResult.fetched + gwinnettHtmlResult.fetched +
                        dekalbResult.fetched + cobbResult.fetched,
        total_inserted: gwinnettAccelaResult.inserted + gwinnettHtmlResult.inserted +
                        dekalbResult.inserted + cobbResult.inserted,
        total_updated:  gwinnettAccelaResult.updated + gwinnettHtmlResult.updated +
                        dekalbResult.updated + cobbResult.updated,
        total_errors:   gwinnettAccelaResult.errors + gwinnettHtmlResult.errors +
                        dekalbResult.errors + cobbResult.errors,
      };

      logger.info('[sync-accela] Nightly Accela sweep complete', result);

      if (result.total_errors > 0) {
        logger.warn('[sync-accela] Some records failed to upsert', { total_errors: result.total_errors });
      }

      return result;
    });

    return summary;
  },
);
