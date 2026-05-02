/**
 * Tool: fetch_owned_asset_actuals
 *
 * Queries deal_monthly_actuals for owned portfolio assets comparable to the subject deal.
 * Returns TTM (trailing twelve months) and TTM-24 (prior year) summaries per asset,
 * with a comparability score based on submarket, class, vintage, and unit count similarity.
 *
 * Tier 2 evidence source — used by CashFlow Agent.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid().describe('Current deal UUID (used to exclude itself)'),
  submarket: z.string().nullable().optional().describe('Target submarket name for comparability'),
  asset_class: z.string().nullable().optional().describe('A, B, or C class'),
  year_built: z.number().int().nullable().optional().describe('Vintage year for cohort matching'),
  units: z.number().int().nullable().optional().describe('Unit count for size comparability'),
  max_assets: z.number().int().default(5).describe('Max comparable assets to return'),
});

const OwnedAssetSummarySchema = z.object({
  property_id: z.string(),
  address: z.string().nullable(),
  submarket: z.string().nullable(),
  units: z.number().nullable(),
  year_built: z.number().nullable(),
  comparability_score: z.number().describe('0-1, higher = more comparable'),
  ttm: z.object({
    months_available: z.number(),
    avg_occupancy_rate: z.number().nullable(),
    avg_effective_rent_per_unit: z.number().nullable(),
    noi_per_unit_annual: z.number().nullable(),
    opex_per_unit_annual: z.number().nullable(),
    egi_per_unit_annual: z.number().nullable(),
    management_fee_pct: z.number().nullable(),
  }),
  ttm_minus_24: z.object({
    months_available: z.number(),
    avg_occupancy_rate: z.number().nullable(),
    noi_per_unit_annual: z.number().nullable(),
  }).nullable(),
});

const OutputSchema = z.object({
  assets: z.array(OwnedAssetSummarySchema),
  total_owned_portfolio_size: z.number().int(),
  note: z.string().optional(),
});

export const fetchOwnedAssetActualsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_owned_asset_actuals',
  description:
    'Fetch TTM operating actuals from comparable owned portfolio assets. ' +
    'Returns per-unit NOI, occupancy, effective rent, and opex metrics from deal_monthly_actuals. ' +
    'Use as Tier 2 evidence to cross-check T-12 assumptions.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:all',

  execute: async (input, ctx) => {
    const now = new Date();
    const ttmStart = new Date(now);
    ttmStart.setMonth(ttmStart.getMonth() - 12);
    const ttm24Start = new Date(now);
    ttm24Start.setMonth(ttm24Start.getMonth() - 36);
    const ttm24End = new Date(now);
    ttm24End.setMonth(ttm24End.getMonth() - 24);

    const totalResult = await query(
      `SELECT COUNT(DISTINCT property_id) AS cnt FROM deal_monthly_actuals`,
      []
    );
    const totalCount = parseInt(String(totalResult.rows[0]?.cnt ?? '0'), 10);

    // Get all properties with TTM data
    const propsResult = await query(
      `SELECT
         p.id              AS property_id,
         p.address_line1   AS address,
         NULL::text        AS submarket,
         p.units           AS units,
         p.year_built      AS year_built,
         p.building_class  AS asset_class
       FROM properties p
       WHERE EXISTS (
         SELECT 1 FROM deal_monthly_actuals dma
         WHERE dma.property_id = p.id
           AND dma.report_month >= $1
           AND dma.is_budget = false
       )
       AND p.id NOT IN (
         SELECT dp.property_id FROM deal_properties dp WHERE dp.deal_id = $2
         UNION
         SELECT dp.property_id FROM deal_properties dp
         INNER JOIN deals d ON d.id = dp.deal_id WHERE d.id = $2
       )
       LIMIT 50`,
      [ttmStart.toISOString().slice(0, 10), input.deal_id]
    );

    if (propsResult.rows.length === 0) {
      return {
        assets: [],
        total_owned_portfolio_size: totalCount,
        note: 'No comparable owned assets with TTM data found.',
      };
    }

    // Score each asset for comparability
    const scored = propsResult.rows.map((p: Record<string, unknown>) => {
      let score = 0;
      if (input.submarket && p.submarket === input.submarket) score += 0.40;
      else if (!input.submarket) score += 0.40;

      if (input.asset_class && p.asset_class != null) {
        // Exact class match (A/B/C) = full weight; adjacent class = partial; no match = minimal
        const pClass = String(p.asset_class).trim().toUpperCase();
        const tClass = input.asset_class.trim().toUpperCase();
        if (pClass === tClass) score += 0.30;
        else if (
          (pClass === 'A' && tClass === 'B') ||
          (pClass === 'B' && (tClass === 'A' || tClass === 'C')) ||
          (pClass === 'C' && tClass === 'B')
        ) score += 0.15;
        else score += 0.02;
      } else if (input.asset_class && p.asset_class == null) {
        // Class was specified but property has no stored class — degrade to partial credit
        score += 0.10;
      } else {
        // No class filter provided — treat all assets as neutral (partial credit)
        score += 0.15;
      }

      if (input.year_built && p.year_built != null) {
        const diff = Math.abs(Number(p.year_built) - input.year_built);
        score += diff <= 5 ? 0.15 : diff <= 15 ? 0.08 : 0.02;
      } else {
        score += 0.15;
      }

      if (input.units && p.units != null) {
        const ratio = Math.min(Number(p.units), input.units) / Math.max(Number(p.units), input.units);
        score += ratio >= 0.7 ? 0.15 : ratio >= 0.4 ? 0.08 : 0.02;
      } else {
        score += 0.15;
      }

      return { ...p, comparability_score: Math.round(score * 100) / 100 };
    });

    // Sort by score, take top N
    const top = scored
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        (b.comparability_score as number) - (a.comparability_score as number)
      )
      .slice(0, input.max_assets);

    const propertyIds = top.map((p: Record<string, unknown>) => p.property_id as string);

    if (propertyIds.length === 0) {
      return { assets: [], total_owned_portfolio_size: totalCount };
    }

    // TTM actuals
    const ttmResult = await query(
      `SELECT
         property_id,
         COUNT(*)                                            AS months_available,
         AVG(occupancy_rate)                                 AS avg_occupancy_rate,
         AVG(avg_effective_rent)                             AS avg_effective_rent_per_unit,
         SUM(noi) / NULLIF(MAX(total_units), 0)              AS noi_per_unit_annual,
         SUM(effective_gross_income - noi) / NULLIF(MAX(total_units), 0) AS opex_per_unit_annual,
         SUM(effective_gross_income) / NULLIF(MAX(total_units), 0)       AS egi_per_unit_annual,
         AVG(management_fee_pct)                             AS management_fee_pct
       FROM deal_monthly_actuals
       WHERE property_id = ANY($1::uuid[])
         AND report_month >= $2
         AND is_budget = false
       GROUP BY property_id`,
      [propertyIds, ttmStart.toISOString().slice(0, 10)]
    );

    // TTM-24 (prior year)
    const ttm24Result = await query(
      `SELECT
         property_id,
         COUNT(*)                                       AS months_available,
         AVG(occupancy_rate)                            AS avg_occupancy_rate,
         SUM(noi) / NULLIF(MAX(total_units), 0)         AS noi_per_unit_annual
       FROM deal_monthly_actuals
       WHERE property_id = ANY($1::uuid[])
         AND report_month BETWEEN $2 AND $3
         AND is_budget = false
       GROUP BY property_id`,
      [propertyIds, ttm24Start.toISOString().slice(0, 10), ttm24End.toISOString().slice(0, 10)]
    );

    const ttmMap = new Map(ttmResult.rows.map((r: Record<string, unknown>) => [r.property_id as string, r]));
    const ttm24Map = new Map(ttm24Result.rows.map((r: Record<string, unknown>) => [r.property_id as string, r]));

    const assets = top.map((p: Record<string, unknown>) => {
      const pid = p.property_id as string;
      const ttm = ttmMap.get(pid) ?? {};
      const ttm24 = ttm24Map.get(pid) ?? null;

      const parseNum = (v: unknown): number | null =>
        v != null && !isNaN(Number(v)) ? Math.round(Number(v) * 100) / 100 : null;

      return {
        property_id: pid,
        address: (p.address ?? null) as string | null,
        submarket: (p.submarket ?? null) as string | null,
        units: p.units != null ? Number(p.units) : null,
        year_built: p.year_built != null ? Number(p.year_built) : null,
        comparability_score: p.comparability_score as number,
        ttm: {
          months_available: Number((ttm as Record<string, unknown>).months_available ?? 0),
          avg_occupancy_rate: parseNum((ttm as Record<string, unknown>).avg_occupancy_rate),
          avg_effective_rent_per_unit: parseNum((ttm as Record<string, unknown>).avg_effective_rent_per_unit),
          noi_per_unit_annual: parseNum((ttm as Record<string, unknown>).noi_per_unit_annual),
          opex_per_unit_annual: parseNum((ttm as Record<string, unknown>).opex_per_unit_annual),
          egi_per_unit_annual: parseNum((ttm as Record<string, unknown>).egi_per_unit_annual),
          management_fee_pct: parseNum((ttm as Record<string, unknown>).management_fee_pct),
        },
        ttm_minus_24: ttm24
          ? {
              months_available: Number((ttm24 as Record<string, unknown>).months_available ?? 0),
              avg_occupancy_rate: parseNum((ttm24 as Record<string, unknown>).avg_occupancy_rate),
              noi_per_unit_annual: parseNum((ttm24 as Record<string, unknown>).noi_per_unit_annual),
            }
          : null,
      };
    });

    logger.debug('fetch_owned_asset_actuals', {
      runId: ctx.dealId,
      dealId: ctx.dealId,
      assetCount: assets.length,
    });

    return { assets, total_owned_portfolio_size: totalCount };
  },
};
