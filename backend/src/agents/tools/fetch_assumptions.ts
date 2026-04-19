/**
 * Tool: fetch_assumptions
 *
 * Fetches the deal underwriting assumptions from the database — purchase price,
 * LTV, interest rate, hold period, exit cap rate, rent growth, and vacancy.
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

export const fetchAssumptionsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
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
      return { deal_id: input.deal_id, has_assumptions: false, purchase_price: null,
        ltv_pct: null, interest_rate_pct: null, loan_term_years: null,
        amortization_years: null, vacancy_rate_pct: null, management_fee_pct: null,
        annual_rent_growth_pct: null, exit_cap_rate_pct: null, hold_period_years: null,
        total_units: null, property_type: null, source: 'no_deal_id' };
    }

    try {
      const result = await query(
        `SELECT
           d.purchase_price, d.property_type, d.units,
           da.ltv, da.interest_rate, da.loan_term_years, da.amortization_years,
           da.vacancy_rate, da.management_fee, da.rent_growth_rate,
           da.exit_cap_rate, da.hold_period_years
         FROM deals d
         LEFT JOIN deal_assumptions da ON da.deal_id = d.id
         WHERE d.id = $1
         LIMIT 1`,
        [dealId]
      );

      const row = result.rows[0];
      if (!row) {
        return { deal_id: dealId, has_assumptions: false, purchase_price: null,
          ltv_pct: null, interest_rate_pct: null, loan_term_years: null,
          amortization_years: null, vacancy_rate_pct: null, management_fee_pct: null,
          annual_rent_growth_pct: null, exit_cap_rate_pct: null, hold_period_years: null,
          total_units: null, property_type: null, source: 'not_found' };
      }

      const n = (v: unknown) => v != null ? Number(v) : null;

      return {
        deal_id: dealId,
        has_assumptions: true,
        purchase_price: n(row.purchase_price),
        ltv_pct: row.ltv != null ? Number(row.ltv) * 100 : null,
        interest_rate_pct: n(row.interest_rate),
        loan_term_years: n(row.loan_term_years),
        amortization_years: n(row.amortization_years),
        vacancy_rate_pct: row.vacancy_rate != null ? Number(row.vacancy_rate) * 100 : null,
        management_fee_pct: row.management_fee != null ? Number(row.management_fee) * 100 : null,
        annual_rent_growth_pct: row.rent_growth_rate != null ? Number(row.rent_growth_rate) * 100 : null,
        exit_cap_rate_pct: row.exit_cap_rate != null ? Number(row.exit_cap_rate) * 100 : null,
        hold_period_years: n(row.hold_period_years),
        total_units: n(row.units),
        property_type: row.property_type ? String(row.property_type) : null,
        source: 'platform_db',
      };
    } catch (err) {
      logger.warn('fetch_assumptions: DB query failed', {
        dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return { deal_id: dealId, has_assumptions: false, purchase_price: null,
        ltv_pct: null, interest_rate_pct: null, loan_term_years: null,
        amortization_years: null, vacancy_rate_pct: null, management_fee_pct: null,
        annual_rent_growth_pct: null, exit_cap_rate_pct: null, hold_period_years: null,
        total_units: null, property_type: null, source: 'error' };
    }
  },
};
