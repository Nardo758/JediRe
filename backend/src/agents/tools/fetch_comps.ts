/**
 * Tool: fetch_comps
 *
 * Fetches comp set summary for a deal via GET /deals/:dealId/comps/summary.
 *
 * Actual endpoint response shape:
 *   { success: true, data: {
 *       hasCompSet: boolean,
 *       comp_count?: number,              ← total comps in set
 *       median_price_per_unit?: number,   ← $/unit at median
 *       median_implied_cap_rate?: number, ← 0–1 fraction
 *       price_range?: { min: number, max: number }
 *   }}
 *
 * Note: this endpoint returns sale-comp aggregates (price/cap rate), not
 * rental comps. avg_market_rent and avg_occupancy are not available
 * from this source and will be returned as null.
 *
 * Required capability: read:comps
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid('deal_id must be a valid UUID'),
});

const OutputSchema = z.object({
  deal_id: z.string(),
  comp_count: z.number().nullable(),
  median_price_per_unit: z.number().nullable(),
  median_implied_cap_rate: z.number().nullable(),
  price_range_min: z.number().nullable(),
  price_range_max: z.number().nullable(),
  source: z.string(),
  fetched_at: z.string(),
});

type CompSummaryResponse = {
  success: boolean;
  data?: {
    hasCompSet?: boolean;
    comp_count?: number | null;
    median_price_per_unit?: number | null;
    median_implied_cap_rate?: number | null;
    price_range?: { min?: number | null; max?: number | null } | null;
  };
};

export const fetchCompsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_comps',
  description:
    'Fetch the comp set summary for a deal: count, median price per unit, ' +
    'and implied cap rate from comparable sales. Use to benchmark deal pricing vs market.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:comps',

  execute: async (input, ctx) => {
    const client = platformClient.as({
      agentId: ctx.agentId ?? 'research',
      runId: ctx.correlationId,
    });

    const now = new Date().toISOString();

    try {
      const resp = await client.get<CompSummaryResponse>(
        `/deals/${input.deal_id}/comps/summary`
      );

      if (!resp.success || !resp.data?.hasCompSet) {
        logger.debug('fetch_comps: no comp set available', { dealId: input.deal_id });
        return {
          deal_id: input.deal_id,
          comp_count: null,
          median_price_per_unit: null,
          median_implied_cap_rate: null,
          price_range_min: null,
          price_range_max: null,
          source: 'no_comp_set',
          fetched_at: now,
        };
      }

      const d = resp.data;

      logger.debug('fetch_comps: fetched comp set summary', {
        dealId: input.deal_id,
        compCount: d.comp_count,
        medianPrice: d.median_price_per_unit,
      });

      return {
        deal_id: input.deal_id,
        comp_count: d.comp_count ?? null,
        median_price_per_unit: d.median_price_per_unit ?? null,
        median_implied_cap_rate: d.median_implied_cap_rate ?? null,
        price_range_min: d.price_range?.min ?? null,
        price_range_max: d.price_range?.max ?? null,
        source: 'comp_set_service',
        fetched_at: now,
      };
    } catch (err) {
      logger.warn('fetch_comps: request failed', {
        dealId: input.deal_id,
        err: err instanceof Error ? err.message : String(err),
      });

      return {
        deal_id: input.deal_id,
        comp_count: null,
        median_price_per_unit: null,
        median_implied_cap_rate: null,
        price_range_min: null,
        price_range_max: null,
        source: 'unavailable',
        fetched_at: now,
      };
    }
  },
};
