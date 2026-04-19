/**
 * Tool: fetch_rent_roll
 *
 * Fetches the rent roll summary for a deal — occupied/vacant unit counts,
 * avg rent, total monthly income, lease expiry distribution, and market
 * rent vs in-place rent spread.
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
  has_data: z.boolean(),
  total_units: z.number().nullable(),
  occupied_units: z.number().nullable(),
  vacant_units: z.number().nullable(),
  occupancy_pct: z.number().nullable(),
  avg_in_place_rent: z.number().nullable(),
  total_monthly_income: z.number().nullable(),
  leases_expiring_90d: z.number().nullable(),
  leases_expiring_180d: z.number().nullable(),
  market_rent_spread: z.number().nullable().describe('Market rent minus in-place rent per unit'),
  source: z.string().default('platform_db'),
}).passthrough();

export const fetchRentRollTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_rent_roll',
  description:
    'Fetch the rent roll summary for a deal: occupied/vacant units, average in-place rent, ' +
    'total monthly income, upcoming lease expirations, and rent-to-market spread.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:financials',

  execute: async (input, ctx) => {
    const dealId = input.deal_id ?? ctx.dealId;
    if (!dealId) {
      return {
        deal_id: input.deal_id,
        has_data: false,
        total_units: null, occupied_units: null, vacant_units: null,
        occupancy_pct: null, avg_in_place_rent: null, total_monthly_income: null,
        leases_expiring_90d: null, leases_expiring_180d: null,
        market_rent_spread: null, source: 'no_deal_id',
      };
    }

    try {
      const result = await query(
        `SELECT
           COUNT(*)::int                                              AS total_units,
           COUNT(*) FILTER (WHERE status = 'occupied')::int          AS occupied_units,
           COUNT(*) FILTER (WHERE status = 'vacant')::int            AS vacant_units,
           AVG(monthly_rent) FILTER (WHERE status = 'occupied')      AS avg_in_place_rent,
           SUM(monthly_rent) FILTER (WHERE status = 'occupied')      AS total_monthly_income,
           COUNT(*) FILTER (
             WHERE lease_end BETWEEN NOW() AND NOW() + INTERVAL '90 days'
           )::int                                                     AS exp_90d,
           COUNT(*) FILTER (
             WHERE lease_end BETWEEN NOW() AND NOW() + INTERVAL '180 days'
           )::int                                                     AS exp_180d,
           AVG(market_rent - monthly_rent) FILTER (WHERE status = 'occupied') AS market_spread
         FROM deal_leases
         WHERE deal_id = $1`,
        [dealId]
      );

      const row = result.rows[0];
      const total = Number(row?.total_units ?? 0);

      if (total === 0) {
        return {
          deal_id: dealId, has_data: false,
          total_units: null, occupied_units: null, vacant_units: null,
          occupancy_pct: null, avg_in_place_rent: null, total_monthly_income: null,
          leases_expiring_90d: null, leases_expiring_180d: null,
          market_rent_spread: null, source: 'no_uploads',
        };
      }

      const n = (v: unknown) => v != null ? Number(v) : null;
      const occupied = n(row.occupied_units);

      return {
        deal_id: dealId,
        has_data: true,
        total_units: total,
        occupied_units: occupied,
        vacant_units: n(row.vacant_units),
        occupancy_pct: (occupied != null && total > 0) ? (occupied / total) * 100 : null,
        avg_in_place_rent: n(row.avg_in_place_rent),
        total_monthly_income: n(row.total_monthly_income),
        leases_expiring_90d: n(row.exp_90d),
        leases_expiring_180d: n(row.exp_180d),
        market_rent_spread: n(row.market_spread),
        source: 'platform_db',
      };
    } catch (err) {
      logger.warn('fetch_rent_roll: DB query failed', {
        dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        deal_id: dealId, has_data: false,
        total_units: null, occupied_units: null, vacant_units: null,
        occupancy_pct: null, avg_in_place_rent: null, total_monthly_income: null,
        leases_expiring_90d: null, leases_expiring_180d: null,
        market_rent_spread: null, source: 'error',
      };
    }
  },
};
