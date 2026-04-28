/**
 * Tool: fetch_assumptions
 *
 * Fetches the deal underwriting assumptions from the database — purchase price,
 * LTV, interest rate, hold period, exit cap rate, rent growth, and vacancy.
 *
 * Reads from deal_assumptions.year1 JSONB (proforma seeder) as primary source,
 * then falls back to legacy columns for fields not available in year1.
 *
 * Required capability: read:financials
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().describe('Deal UUID'),
});

const OutputSchema = z.object({
  deal_id: z.string(),
  has_assumptions: z.boolean(),
  purchase_price: z.number().nullable(),
  ltv_pct: z.number().nullable(),
  interest_rate_pct: z.number().nullable(),
  loan_term_years: z.number().nullable(),
  amortization_years: z.number().nullable(),
  vacancy_rate_pct: z.number().nullable(),
  management_fee_pct: z.number().nullable(),
  annual_rent_growth_pct: z.number().nullable(),
  exit_cap_rate_pct: z.number().nullable(),
  hold_period_years: z.number().nullable(),
  total_units: z.number().nullable(),
  property_type: z.string().nullable(),
  source: z.string().default('platform_db'),
}).passthrough();

type Output = z.infer<typeof OutputSchema>;

/** Extract resolved value from a year1 LayeredValue object. */
function y1Val(obj: Record<string, unknown> | null | undefined, field: string): number | null {
  if (!obj) return null;
  const v = obj[field];
  if (v && typeof v === 'object' && 'resolved' in v) {
    const r = (v as Record<string, unknown>).resolved;
    return r != null ? Number(r) : null;
  }
  // Direct value (not a LayeredValue — e.g. _unit_count)
  if (typeof v === 'number') return v;
  return null;
}

const EMPTY: Output = {
  deal_id: '',
  has_assumptions: false,
  purchase_price: null, ltv_pct: null, interest_rate_pct: null,
  loan_term_years: null, amortization_years: null,
  vacancy_rate_pct: null, management_fee_pct: null,
  annual_rent_growth_pct: null, exit_cap_rate_pct: null,
  hold_period_years: null, total_units: null,
  property_type: null, source: 'platform_db',
};

export const fetchAssumptionsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  Output
> = {
  name: 'fetch_assumptions',
  description:
    'Fetch deal underwriting assumptions: purchase price, LTV, interest rate, vacancy rate, ' +
    'rent growth, exit cap rate, and hold period from the deal record.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:financials',

  execute: async (input, ctx) => {
    const dealId = input.deal_id ?? ctx.dealId;
    if (!dealId) {
      return { ...EMPTY, deal_id: input.deal_id, source: 'no_deal_id' };
    }

    logger.info(`[fetch_assumptions] Called for deal ${dealId}`);

    try {
      const result = await query(
        `SELECT
           d.purchase_price, d.property_type, d.units AS d_units,
           da.year1,
           da.ltv, da.interest_rate, da.loan_term_years, da.amortization_years,
           da.vacancy_pct, da.vacancy_rate,
           da.management_fee_pct AS mgmt_fee,
           da.rent_growth_yr1,
           da.exit_cap,
           da.hold_period_years,
           da.total_units AS da_units
         FROM deals d
         LEFT JOIN deal_assumptions da ON da.deal_id = d.id
         WHERE d.id = $1
         LIMIT 1`,
        [dealId]
      );

      const row = result.rows[0];
      if (!row) {
        return { ...EMPTY, deal_id: dealId, source: 'not_found' };
      }

      // Parse year1 JSONB (seeded ProFormaYear1Seed)
      const year1: Record<string, unknown> | null =
        row.year1 && typeof row.year1 === 'object' ? row.year1
        : row.year1 && typeof row.year1 === 'string' ? JSON.parse(row.year1)
        : null;

      // Resolve: year1 preferred (decimal fraction → percent), legacy columns as fallback
      const vacancyY1 = y1Val(year1, 'vacancy_pct');  // decimal (0.05)
      const mgmtFeeY1 = y1Val(year1, 'management_fee_pct');  // decimal (0.03)

      const n = (v: unknown) => v != null ? Number(v) : null;

      // Legacy vacancy_pct is stored as percent (5.00 = 5%); vacancy_rate is also percent
      const vacancyLegacy = n(row.vacancy_pct ?? row.vacancy_rate);
      const vacancyPct = vacancyY1 != null ? Math.round(vacancyY1 * 100 * 100) / 100 : vacancyLegacy;

      // management_fee_pct legacy is stored as percent (3.00 = 3%)
      const mgmtFeeLegacy = n(row.mgmt_fee);
      const mgmtFeePct = mgmtFeeY1 != null ? Math.round(mgmtFeeY1 * 100 * 100) / 100 : mgmtFeeLegacy;

      logger.info(`[fetch_assumptions] Returning for deal ${dealId}: vacancy=${vacancyPct}, mgmtFee=${mgmtFeePct}, units=${n(row.da_units) || n(row.d_units) || y1Val(year1, '_unit_count')}`);

      return {
        deal_id: dealId,
        has_assumptions: true,
        purchase_price: n(row.purchase_price),
        ltv_pct: n(row.ltv) != null ? Number(row.ltv) * 100 : null,
        interest_rate_pct: n(row.interest_rate),
        loan_term_years: n(row.loan_term_years),
        amortization_years: n(row.amortization_years),
        vacancy_rate_pct: vacancyPct,
        management_fee_pct: mgmtFeePct,
        annual_rent_growth_pct: n(row.rent_growth_yr1),
        exit_cap_rate_pct: n(row.exit_cap) != null ? Number(row.exit_cap) * 100 : null,
        hold_period_years: n(row.hold_period_years),
        total_units: n(row.da_units) || n(row.d_units) || y1Val(year1, '_unit_count'),
        property_type: row.property_type ? String(row.property_type) : null,
        source: 'platform_db',
      };
    } catch (err) {
      logger.warn('fetch_assumptions: DB query failed', {
        dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return { ...EMPTY, deal_id: dealId, source: 'error' };
    }
  },
};
