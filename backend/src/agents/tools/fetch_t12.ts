/**
 * Tool: fetch_t12
 *
 * Fetches trailing 12-month (T-12) financial data for a deal — revenue,
 * expenses, NOI, and occupancy from uploaded operating statements or
 * the deal's financial context.
 *
 * Required capability: read:financials
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().describe('Deal UUID'),
  months: z.number().optional().default(12).describe('Number of trailing months to aggregate'),
});

const OutputSchema = z.object({
  deal_id: z.string(),
  has_data: z.boolean(),
  trailing_months: z.number(),
  gross_revenue: z.number().nullable(),
  total_expenses: z.number().nullable(),
  noi: z.number().nullable(),
  avg_occupancy_pct: z.number().nullable(),
  revenue_per_unit: z.number().nullable(),
  expense_ratio_pct: z.number().nullable(),
  months_available: z.number(),
  source: z.string().default('platform_db'),
}).passthrough();

export const fetchT12Tool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_t12',
  description:
    'Fetch trailing 12-month financials (gross revenue, total expenses, NOI, occupancy) ' +
    'for a deal from uploaded operating statements. Returns actuals when available.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:financials',

  execute: async (input, ctx) => {
    const dealId = input.deal_id ?? ctx.dealId;
    if (!dealId) {
      return {
        deal_id: input.deal_id,
        has_data: false,
        trailing_months: input.months ?? 12,
        gross_revenue: null,
        total_expenses: null,
        noi: null,
        avg_occupancy_pct: null,
        revenue_per_unit: null,
        expense_ratio_pct: null,
        months_available: 0,
        source: 'no_deal_id',
      };
    }

    try {
      // Aggregate from deal_monthly_actuals (monthly actuals uploaded via P&L).
      // The table is keyed by property_id, so join through deal_properties to
      // resolve from a deal id. Operating-statement schema column mapping:
      //   gross_revenue    ← effective_gross_income (or net_rental_income + other_income)
      //   total_expenses   ← total_opex
      //   noi              ← noi
      //   avg_occupancy    ← occupancy_rate (already 0..1)
      //   revenue_per_unit ← effective_gross_income / NULLIF(total_units, 0)
      //   period_end       ← report_month
      // Excludes budget/proforma rows so the result reflects actuals only.
      const result = await query(
        `SELECT
           COUNT(*)::int                                       AS months_available,
           SUM(COALESCE(dma.effective_gross_income,
                        dma.net_rental_income + COALESCE(dma.other_income, 0))) AS gross_revenue,
           SUM(dma.total_opex)                                 AS total_expenses,
           SUM(dma.noi)                                        AS noi,
           AVG(dma.occupancy_rate)                             AS avg_occupancy,
           AVG(dma.effective_gross_income
               / NULLIF(dma.total_units, 0))                   AS revenue_per_unit
         FROM deal_monthly_actuals dma
         JOIN deal_properties dp ON dp.property_id = dma.property_id
         WHERE dp.deal_id = $1
           AND dma.report_month >= (NOW() - (($2::int) * INTERVAL '1 month'))::date
           AND COALESCE(dma.is_budget,   FALSE) = FALSE
           AND COALESCE(dma.is_proforma, FALSE) = FALSE`,
        [dealId, input.months ?? 12]
      );

      const row = result.rows[0];
      const months = Number(row?.months_available ?? 0);

      if (months === 0) {
        return {
          deal_id: dealId,
          has_data: false,
          trailing_months: input.months ?? 12,
          gross_revenue: null,
          total_expenses: null,
          noi: null,
          avg_occupancy_pct: null,
          revenue_per_unit: null,
          expense_ratio_pct: null,
          months_available: 0,
          source: 'no_uploads',
        };
      }

      const rev = row.gross_revenue != null ? Number(row.gross_revenue) : null;
      const exp = row.total_expenses != null ? Number(row.total_expenses) : null;

      return {
        deal_id: dealId,
        has_data: true,
        trailing_months: input.months ?? 12,
        gross_revenue: rev,
        total_expenses: exp,
        noi: row.noi != null ? Number(row.noi) : (rev != null && exp != null ? rev - exp : null),
        avg_occupancy_pct: row.avg_occupancy != null ? Number(row.avg_occupancy) : null,
        revenue_per_unit: row.revenue_per_unit != null ? Number(row.revenue_per_unit) : null,
        expense_ratio_pct: (rev && exp) ? (exp / rev) * 100 : null,
        months_available: months,
        source: 'platform_db',
      };
    } catch (err) {
      logger.warn('fetch_t12: DB query failed', {
        dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        deal_id: dealId,
        has_data: false,
        trailing_months: input.months ?? 12,
        gross_revenue: null,
        total_expenses: null,
        noi: null,
        avg_occupancy_pct: null,
        revenue_per_unit: null,
        expense_ratio_pct: null,
        months_available: 0,
        source: 'error',
      };
    }
  },
};
