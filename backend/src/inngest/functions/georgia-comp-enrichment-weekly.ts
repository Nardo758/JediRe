/**
 * Inngest Cron: Weekly Georgia Comp Enrichment
 *
 * Fires every Monday at 02:00 UTC (0 2 * * 1).
 *
 * What it does
 * ─────────────
 * Step 1 — promoteGeorgiaSales: re-upserts qualified Georgia county sales into
 *           market_sale_comps for all counties. Idempotent via ON CONFLICT.
 * Step 2 — enrichCapitalMarkets: backfills cap rates, units estimates, $/unit,
 *           buyer type, seller, and asset class for multifamily candidates.
 * Step 3 — Log a summary of results.
 *
 * What it intentionally SKIPS
 * ─────────────────────────────
 * The heavy ArcGIS county ingest step (property_info_cache population) is
 * NOT run here — that step can take 5–15 min per county and should remain
 * a monthly manual or separately-scheduled operation.
 *
 * Idempotent: both promote and enrich use UPSERT / UPDATE-WHERE-NULL logic,
 * so re-running multiple times in the same week is safe.
 *
 * Task #1478
 */

import { inngest } from '../../lib/inngest';
import { logger } from '../../utils/logger';
import { georgiaSaleCompsService } from '../../services/saleComps/georgia-sale-comps.service';

export const georgiaCompEnrichmentWeekly = inngest.createFunction(
  {
    id: 'georgia-comp-enrichment-weekly',
    name: 'Georgia Comp Enrichment: weekly promote + enrich (no ArcGIS ingest)',
    triggers: [{ cron: '0 2 * * 1' }],
    retries: 2,
  },
  async ({ step }) => {
    const startedAt = new Date().toISOString();

    // ── Step 1: Re-promote Georgia sales → market_sale_comps ─────────────────
    const promoteResults = await step.run('promote-georgia-sales', async () => {
      try {
        const results = await georgiaSaleCompsService.promoteGeorgiaSales({
          state: 'GA',
        });
        logger.info('[georgia-comp-enrichment-weekly] promoteGeorgiaSales complete', {
          counties: results.map((r) => ({ county: r.county, promoted: r.promoted })),
        });
        return results;
      } catch (err: any) {
        logger.error('[georgia-comp-enrichment-weekly] promoteGeorgiaSales failed', {
          error: err.message,
        });
        return [];
      }
    });

    // ── Step 2: Enrich capital markets fields ─────────────────────────────────
    const enrichResult = await step.run('enrich-capital-markets', async () => {
      try {
        const result = await georgiaSaleCompsService.enrichCapitalMarkets('GA');
        logger.info('[georgia-comp-enrichment-weekly] enrichCapitalMarkets complete', {
          candidates: result.candidates,
          capRateUpdated: result.capRateUpdated,
          unitsUpdated: result.unitsUpdated,
          pricePerUnitUpdated: result.pricePerUnitUpdated,
          buyerTypeUpdated: result.buyerTypeUpdated,
          sellerUpdated: result.sellerUpdated,
          assetClassUpdated: result.assetClassUpdated,
        });
        return result;
      } catch (err: any) {
        logger.error('[georgia-comp-enrichment-weekly] enrichCapitalMarkets failed', {
          error: err.message,
        });
        return null;
      }
    });

    // ── Step 3: Summary log ───────────────────────────────────────────────────
    await step.run('log-summary', async () => {
      const totalPromoted = promoteResults.reduce(
        (sum: number, r: any) => sum + (r.promoted ?? 0),
        0,
      );

      logger.info('[georgia-comp-enrichment-weekly] run complete', {
        started_at: startedAt,
        counties_processed: promoteResults.length,
        total_comps_promoted: totalPromoted,
        enrich_candidates: enrichResult?.candidates ?? 0,
        enrich_cap_rate_updated: enrichResult?.capRateUpdated ?? 0,
        enrich_units_updated: enrichResult?.unitsUpdated ?? 0,
        enrich_price_per_unit_updated: enrichResult?.pricePerUnitUpdated ?? 0,
      });

      return {
        totalPromoted,
        enrichResult,
      };
    });

    return {
      started_at: startedAt,
      counties_processed: promoteResults.length,
      total_comps_promoted: promoteResults.reduce(
        (sum: number, r: any) => sum + (r.promoted ?? 0),
        0,
      ),
      enrich_candidates: enrichResult?.candidates ?? 0,
    };
  },
);
