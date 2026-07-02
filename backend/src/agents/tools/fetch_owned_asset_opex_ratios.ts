/**
 * Tool: fetch_owned_asset_opex_ratios
 *
 * Returns per-line-item opex ratios from owned portfolio assets normalized to per-unit/year.
 * Queries deal_monthly_actuals and computes TTM averages across comparable assets.
 *
 * Tier 2 evidence source — used by CashFlow Agent for opex cross-check.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  property_ids: z.array(z.string().uuid()).min(1).max(20)
    .describe('Property IDs from fetch_owned_asset_actuals output'),
  months_lookback: z.number().int().min(3).max(36).default(12)
    .describe('Number of months to aggregate for ratios'),
});

const OpexLineSchema = z.object({
  line_item: z.string(),
  per_unit_annual: z.number().nullable(),
  as_pct_of_egi: z.number().nullable().describe('Decimal, e.g. 0.35 = 35%'),
  asset_count: z.number().int().describe('Number of assets contributing to this metric'),
});

const OutputSchema = z.object({
  portfolio_lines: z.array(OpexLineSchema),
  coverage_months: z.number().int(),
  note: z.string().optional(),
});

export const fetchOwnedAssetOpexRatiosTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_owned_asset_opex_ratios',
  description:
    'Returns per-line-item opex ratios (per unit/yr + % of EGI) from comparable owned portfolio assets. ' +
    'Use as Tier 2 cross-check against T-12 operating expenses.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:all',

  execute: async (input, ctx) => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - input.months_lookback);

    // Caller org from B2a attribution — used to defensively scope opex reads even if
    // property_ids came from a (now-org-scoped) fetch_owned_asset_actuals call.
    // Null-safe: if ctx.org_id is absent, the IS NULL guard disables the filter and
    // trusts that property_ids are already org-scoped from the upstream actuals tool.
    const callerOrgId: string | null = ctx.org_id ?? null;

    const result = await query(
      `SELECT
         AVG(payroll)           / NULLIF(MAX(total_units), 0) AS payroll_per_unit,
         AVG(repairs_maintenance)/ NULLIF(MAX(total_units), 0) AS rm_per_unit,
         AVG(utilities)         / NULLIF(MAX(total_units), 0) AS utilities_per_unit,
         AVG(marketing)         / NULLIF(MAX(total_units), 0) AS marketing_per_unit,
         AVG(admin_general)     / NULLIF(MAX(total_units), 0) AS admin_per_unit,
         AVG(management_fee)    / NULLIF(MAX(total_units), 0) AS mgmt_fee_per_unit,
         AVG(management_fee_pct)                              AS mgmt_fee_pct,
         AVG(turnover_costs)    / NULLIF(MAX(total_units), 0) AS turnover_per_unit,
         AVG(effective_gross_income) / NULLIF(MAX(total_units), 0) AS egi_per_unit,
         COUNT(DISTINCT dma.property_id)                      AS asset_count,
         COUNT(*)                                             AS month_rows
       FROM deal_monthly_actuals dma
       WHERE dma.property_id = ANY($1::uuid[])
         AND dma.report_month >= $2
         AND dma.is_budget = false
         AND (
           $3::uuid IS NULL
           OR EXISTS (
             SELECT 1 FROM deal_properties dp
             JOIN deals d ON d.id = dp.deal_id
             WHERE dp.deal_id = dma.deal_id
               AND d.org_id = $3
           )
         )`,
      [input.property_ids, cutoff.toISOString().slice(0, 10), callerOrgId]
    );

    const r = result.rows[0] ?? {};
    const parseNum = (v: unknown): number | null =>
      v != null && !isNaN(Number(v)) ? Math.round(Number(v) * 100) / 100 : null;

    const egiPerUnit = parseNum(r.egi_per_unit);
    const assetCount = Number(r.asset_count ?? 0);

    const pctOfEgi = (v: number | null): number | null => {
      if (v == null || egiPerUnit == null || egiPerUnit === 0) return null;
      return Math.round((v / egiPerUnit) * 1000) / 1000;
    };

    const lines: z.infer<typeof OpexLineSchema>[] = [
      {
        line_item: 'payroll',
        per_unit_annual: parseNum(r.payroll_per_unit) != null
          ? (parseNum(r.payroll_per_unit)! * 12) : null,
        as_pct_of_egi: pctOfEgi(parseNum(r.payroll_per_unit) != null
          ? parseNum(r.payroll_per_unit)! * 12 : null),
        asset_count: assetCount,
      },
      {
        line_item: 'repairs_maintenance',
        per_unit_annual: parseNum(r.rm_per_unit) != null
          ? parseNum(r.rm_per_unit)! * 12 : null,
        as_pct_of_egi: pctOfEgi(parseNum(r.rm_per_unit) != null
          ? parseNum(r.rm_per_unit)! * 12 : null),
        asset_count: assetCount,
      },
      {
        line_item: 'utilities',
        per_unit_annual: parseNum(r.utilities_per_unit) != null
          ? parseNum(r.utilities_per_unit)! * 12 : null,
        as_pct_of_egi: pctOfEgi(parseNum(r.utilities_per_unit) != null
          ? parseNum(r.utilities_per_unit)! * 12 : null),
        asset_count: assetCount,
      },
      {
        line_item: 'marketing',
        per_unit_annual: parseNum(r.marketing_per_unit) != null
          ? parseNum(r.marketing_per_unit)! * 12 : null,
        as_pct_of_egi: pctOfEgi(parseNum(r.marketing_per_unit) != null
          ? parseNum(r.marketing_per_unit)! * 12 : null),
        asset_count: assetCount,
      },
      {
        line_item: 'admin_general',
        per_unit_annual: parseNum(r.admin_per_unit) != null
          ? parseNum(r.admin_per_unit)! * 12 : null,
        as_pct_of_egi: pctOfEgi(parseNum(r.admin_per_unit) != null
          ? parseNum(r.admin_per_unit)! * 12 : null),
        asset_count: assetCount,
      },
      {
        line_item: 'management_fee',
        per_unit_annual: parseNum(r.mgmt_fee_per_unit) != null
          ? parseNum(r.mgmt_fee_per_unit)! * 12 : null,
        as_pct_of_egi: parseNum(r.mgmt_fee_pct),
        asset_count: assetCount,
      },
      {
        line_item: 'turnover_costs',
        per_unit_annual: parseNum(r.turnover_per_unit) != null
          ? parseNum(r.turnover_per_unit)! * 12 : null,
        as_pct_of_egi: pctOfEgi(parseNum(r.turnover_per_unit) != null
          ? parseNum(r.turnover_per_unit)! * 12 : null),
        asset_count: assetCount,
      },
    ];

    logger.debug('fetch_owned_asset_opex_ratios', {
      runId: ctx.dealId,
      assetCount,
      monthRows: Number(r.month_rows ?? 0),
    });

    return {
      portfolio_lines: lines,
      coverage_months: input.months_lookback,
      note: assetCount === 0 ? 'No owned assets found for provided property_ids.' : undefined,
    };
  },
};
