/**
 * Inngest Cron: Nightly Planning Application Sweep
 *
 * Fires every night at 01:00 UTC.
 * Polls Atlanta DPCD and Fulton County ArcGIS FeatureServer layers for
 * planning applications filed or updated in the last 7 days, and upserts
 * results into the planning_applications table.
 *
 * Architecture:
 *   Step 1 — Fetch DPCD applications + upsert + parcel audit (single step to avoid
 *             Inngest JSON serialization converting Date → string across step boundary)
 *   Step 2 — Fetch Fulton County applications + upsert + parcel audit (same reason)
 *   Step 3 — Log summary
 *
 * Task: #1075 (Atlanta DPCD + Fulton County planning ingest — GREEN-rated)
 *
 * Why nightly at 01:00 UTC (21:00 ET): ArcGIS Hub layers are updated within
 * 1 business day of status change; a nightly sweep captures all new filings
 * and status transitions from the previous day's DPCD processing cycle.
 *
 * Deduplication: ON CONFLICT (case_number, jurisdiction) DO UPDATE in the
 * ingest service — same case appearing in multiple sweeps is updated, not duplicated.
 */

import { inngest } from '../../lib/inngest';
import { fetchAtlantaDpcdApplications } from '../../services/planning/adapters/atlanta-dpcd.adapter';
import { fetchFultonCountyApplications } from '../../services/planning/adapters/fulton-county.adapter';
import { upsertPlanningApplications, auditParcelLinkage } from '../../services/planning/planning-ingest.service';
import { logger } from '../../utils/logger';

const LOOKBACK_DAYS = 7;

export const syncPlanningApplicationsCron = inngest.createFunction(
  {
    id:   'sync-planning-applications',
    name: 'Atlanta DPCD + Fulton County: nightly planning application ingest',
    triggers: [{ cron: '0 1 * * *' }],   // 01:00 UTC daily
    concurrency: { limit: 1 },            // only one sweep at a time
  },
  async ({ step }) => {

    // ── Step 1: DPCD fetch + upsert (combined to keep Date objects in-process) ──
    const dpcdResult = await step.run('fetch-upsert-atlanta-dpcd', async () => {
      logger.info('[sync-planning] Fetching Atlanta DPCD applications', { lookbackDays: LOOKBACK_DAYS });
      const apps = await fetchAtlantaDpcdApplications(LOOKBACK_DAYS);
      logger.info('[sync-planning] Atlanta DPCD fetch complete', { count: apps.length });

      const upsertResult = await upsertPlanningApplications(apps);
      const linked = await auditParcelLinkage('atlanta_dpcd');

      logger.info('[sync-planning] Atlanta DPCD upsert complete', { ...upsertResult, parcel_linked: linked });
      return { fetched: apps.length, ...upsertResult, parcel_linked: linked };
    });

    // ── Step 2: Fulton County fetch + upsert (combined for same reason) ───────
    const fultonResult = await step.run('fetch-upsert-fulton-county', async () => {
      logger.info('[sync-planning] Fetching Fulton County applications', { lookbackDays: LOOKBACK_DAYS });
      const apps = await fetchFultonCountyApplications(LOOKBACK_DAYS);
      logger.info('[sync-planning] Fulton County fetch complete', { count: apps.length });

      const upsertResult = await upsertPlanningApplications(apps);
      const linked = await auditParcelLinkage('fulton_county');

      logger.info('[sync-planning] Fulton County upsert complete', { ...upsertResult, parcel_linked: linked });
      return { fetched: apps.length, ...upsertResult, parcel_linked: linked };
    });

    // ── Step 3: Summary ───────────────────────────────────────────────────────
    const summary = await step.run('log-summary', async () => {
      const result = {
        sweep_date:     new Date().toISOString().split('T')[0],
        lookback_days:  LOOKBACK_DAYS,
        atlanta_dpcd:   dpcdResult,
        fulton_county:  fultonResult,
        total_fetched:  dpcdResult.fetched  + fultonResult.fetched,
        total_inserted: dpcdResult.inserted + fultonResult.inserted,
        total_updated:  dpcdResult.updated  + fultonResult.updated,
        total_errors:   dpcdResult.errors   + fultonResult.errors,
      };

      logger.info('[sync-planning] Nightly planning sweep complete', result);

      if (result.total_errors > 0) {
        logger.warn('[sync-planning] Some records failed to upsert', { total_errors: result.total_errors });
      }

      return result;
    });

    return summary;
  },
);
