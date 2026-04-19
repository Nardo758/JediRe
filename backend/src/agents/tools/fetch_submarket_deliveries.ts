/**
 * Tool: fetch_submarket_deliveries
 *
 * Fetches historical delivery data for a submarket — units or sqft delivered
 * per year and how they were absorbed. Provides context for interpreting the
 * current pipeline's demand risk.
 *
 * Required capability: read:supply
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  city: z.string().describe('City name'),
  state_code: z.string().describe('2-letter state code'),
  property_type: z.string().optional().describe('Property type filter'),
  years_back: z.number().optional().default(5).describe('Years of historical data to retrieve'),
});

const OutputSchema = z.object({
  city: z.string(),
  state_code: z.string(),
  annual_deliveries: z.array(z.object({
    year: z.number(),
    units_delivered: z.number().nullable(),
    sqft_delivered: z.number().nullable(),
    net_absorption: z.number().nullable(),
    vacancy_at_year_end: z.number().nullable(),
  })).default([]),
  avg_annual_deliveries: z.number().nullable(),
  avg_net_absorption: z.number().nullable(),
  demand_supply_ratio: z.number().nullable(),
  fetched_at: z.string(),
  source: z.string().default('platform_api'),
}).passthrough();

export const fetchSubmarketDeliveriesTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_submarket_deliveries',
  description:
    'Fetch historical delivery and absorption data for a submarket over the past N years. ' +
    'Returns annual units/sqft delivered, net absorption, and vacancy trajectory.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:supply',

  execute: async (input, ctx) => {
    const client = platformClient.as({
      agentId: ctx.agentId ?? 'supply',
      runId: ctx.correlationId,
    });
    const now = new Date().toISOString();

    try {
      const resp = await client.get<Record<string, unknown>>('/supply/deliveries', {
        city: input.city,
        state_code: input.state_code,
        ...(input.property_type && { property_type: input.property_type }),
        years_back: String(input.years_back ?? 5),
      });

      const n = (v: unknown) => v != null ? Number(v) : null;

      const annual = Array.isArray(resp.annual_deliveries)
        ? resp.annual_deliveries.map((y: Record<string, unknown>) => ({
            year: Number(y.year),
            units_delivered: n(y.units_delivered),
            sqft_delivered: n(y.sqft_delivered),
            net_absorption: n(y.net_absorption),
            vacancy_at_year_end: n(y.vacancy_at_year_end),
          }))
        : [];

      return {
        city: input.city,
        state_code: input.state_code,
        annual_deliveries: annual,
        avg_annual_deliveries: n(resp.avg_annual_deliveries),
        avg_net_absorption: n(resp.avg_net_absorption),
        demand_supply_ratio: n(resp.demand_supply_ratio),
        fetched_at: now,
        source: 'platform_api',
      };
    } catch (err) {
      logger.warn('fetch_submarket_deliveries: API call failed', {
        city: input.city,
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        city: input.city,
        state_code: input.state_code,
        annual_deliveries: [],
        avg_annual_deliveries: null,
        avg_net_absorption: null,
        demand_supply_ratio: null,
        fetched_at: now,
        source: 'unavailable',
      };
    }
  },
};
