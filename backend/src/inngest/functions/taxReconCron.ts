/**
 * Inngest Cron: Tax Reconciliation — W7 layer-(b)
 *
 * D3 DISPATCH_D3_PHASE2_GO R5 — layer-(b) interim implementation.
 * Marked for migration into F-P1t acceptance layer when that build lands.
 *
 * Runs nightly at 02:30 UTC.
 * For each deal where year1.real_estate_tax has both an OM-stated value
 * and a platform/engine value, compares the two. When they diverge by more
 * than TAX_DIVERGENCE_THRESHOLD, writes a broker_claim flag via the D3
 * write seam (writeBrokerClaimFlag) so the agent judgment layer can surface
 * it to the operator.
 *
 * Architecture:
 *   Step 1 — Scan deals with both OM and platform tax populated
 *   Step 2 — For each diverging deal, write broker_claim flag
 *   Step 3 — Log summary
 *
 * TODO (F-P1t migration): When F-P1t lands, the deterministic reconciliation
 * (engine tax vs ATTOM tax_amt) moves into the tax-engine acceptance layer.
 * This cron should be retired in favour of that; the broker_claim flag path
 * remains correct in both layers.
 */

import { inngest } from '../../lib/inngest';
import { query } from '../../database/connection';
import { writeBrokerClaimFlag } from '../../services/deterministic/agent-overlay-writer';
import { logger } from '../../utils/logger';

const TAX_DIVERGENCE_THRESHOLD = 0.20; // 20% divergence triggers a flag

interface TaxDivergenceDeal {
  deal_id: string;
  deal_name: string;
  field_key: 'real_estate_tax' | 'personal_property_tax';
  om_value: number;
  platform_value: number;
  divergence_pct: number;
}

export const taxReconCron = inngest.createFunction(
  {
    id: 'tax-recon-nightly',
    name: 'Tax: nightly OM-vs-platform reconciliation (D3 W7 layer-b)',
    triggers: [{ cron: '30 2 * * *' }], // Nightly at 02:30 UTC
    retries: 2,
  },
  async ({ step }) => {

    // ── Step 1: Find deals with OM-vs-platform tax divergence ────────────────
    const divergingDeals = await step.run('scan-tax-divergence', async () => {
      try {
        const res = await query(
          `SELECT
               da.deal_id,
               d.name AS deal_name,
               unnested.field_key,
               unnested.om_value,
               unnested.platform_value
             FROM deal_assumptions da
             JOIN deals d ON d.id = da.deal_id
             JOIN LATERAL (
               VALUES
                 ('real_estate_tax',
                    (da.year1->'real_estate_tax'->>'om')::numeric,
                    (da.year1->'real_estate_tax'->>'platform')::numeric),
                 ('personal_property_tax',
                    (da.year1->'personal_property_tax'->>'om')::numeric,
                    (da.year1->'personal_property_tax'->>'platform')::numeric)
             ) AS unnested(field_key, om_value, platform_value)
               ON TRUE
             WHERE da.year1 IS NOT NULL
               AND unnested.om_value IS NOT NULL
               AND unnested.platform_value IS NOT NULL
               AND unnested.platform_value <> 0
               AND ABS(unnested.om_value - unnested.platform_value)
                     / unnested.platform_value > $1`,
          [TAX_DIVERGENCE_THRESHOLD],
        );

        return res.rows.map(r => ({
          deal_id: r.deal_id,
          deal_name: r.deal_name,
          field_key: r.field_key as 'real_estate_tax' | 'personal_property_tax',
          om_value: parseFloat(r.om_value),
          platform_value: parseFloat(r.platform_value),
          divergence_pct: Math.abs(
            (parseFloat(r.om_value) - parseFloat(r.platform_value)) /
            parseFloat(r.platform_value),
          ),
        })) as TaxDivergenceDeal[];
      } catch (err: any) {
        logger.warn('[TaxRecon] scan failed', { err: err?.message });
        return [] as TaxDivergenceDeal[];
      }
    });

    if (divergingDeals.length === 0) {
      logger.info('[TaxRecon] No tax divergences found');
      return { scanned: 0, flagged: 0 };
    }

    logger.info('[TaxRecon] Found diverging deals', {
      count: divergingDeals.length,
      deals: divergingDeals.map(d => `${d.deal_name} (${d.field_key} ${(d.divergence_pct * 100).toFixed(1)}%)`),
    });

    // ── Step 2: Write broker_claim flags for each divergence ─────────────────
    const flagged = await step.run('write-broker-claim-flags', async () => {
      let count = 0;
      for (const deal of divergingDeals) {
        try {
          await writeBrokerClaimFlag({
            dealId: deal.deal_id,
            fieldKey: deal.field_key,
            reasoning:
              `Tax reconciliation (D3 W7 layer-b): OM-stated ${deal.field_key} ` +
              `$${deal.om_value.toLocaleString()} diverges from platform/engine value ` +
              `$${deal.platform_value.toLocaleString()} by ` +
              `${(deal.divergence_pct * 100).toFixed(1)}% (threshold: ` +
              `${(TAX_DIVERGENCE_THRESHOLD * 100).toFixed(0)}%). ` +
              `Verify against county assessor records or latest tax bill. ` +
              `TODO: migrate to F-P1t acceptance on landing.`,
            evidenceRefs: [
              {
                type: 'deal_assumption',
                id: `${deal.deal_id}:${deal.field_key}:om`,
                label: `OM-stated: $${deal.om_value.toLocaleString()}`,
                sourceTag: 'om',
              },
              {
                type: 'deal_assumption',
                id: `${deal.deal_id}:${deal.field_key}:platform`,
                label: `Platform/engine: $${deal.platform_value.toLocaleString()}`,
                sourceTag: 'platform',
              },
            ],
          });
          count++;
          logger.info('[TaxRecon] Broker claim flag written', {
            dealId: deal.deal_id,
            fieldKey: deal.field_key,
            omValue: deal.om_value,
            platformValue: deal.platform_value,
            divergencePct: deal.divergence_pct,
          });
        } catch (err: any) {
          logger.warn('[TaxRecon] Flag write failed', {
            dealId: deal.deal_id,
            fieldKey: deal.field_key,
            err: err?.message,
          });
        }
      }
      return count;
    });

    // ── Step 3: Log summary ──────────────────────────────────────────────────
    await step.run('log-summary', async () => {
      logger.info('[TaxRecon] Cron complete', {
        dealsScanned: divergingDeals.length,
        flagsWritten: flagged,
      });
    });

    return {
      scanned: divergingDeals.length,
      flagged,
    };
  },
);
