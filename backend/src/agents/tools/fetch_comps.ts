/**
 * Tool: fetch_comps
 *
 * Fetches comparable properties (comps) for a given deal from the M27 comps service.
 * Routes through GET /deals/:dealId/comps/summary via the platform API.
 *
 * Required capability: read:comps
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid('deal_id must be a valid UUID'),
  limit: z.number().int().min(1).max(50).default(10).describe(
    'Maximum number of comps to return. Defaults to 10.'
  ),
});

const CompSchema = z.object({
  id: z.string(),
  address: z.string().nullable(),
  property_name: z.string().nullable(),
  distance_miles: z.number().nullable(),
  units: z.number().nullable(),
  year_built: z.number().nullable(),
  avg_rent: z.number().nullable(),
  occupancy_rate: z.number().nullable(),
});

const OutputSchema = z.object({
  deal_id: z.string(),
  comps: z.array(CompSchema),
  avg_market_rent: z.number().nullable(),
  avg_occupancy: z.number().nullable(),
  comp_count: z.number(),
  fetched_at: z.string(),
});

export const fetchCompsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_comps',
  description:
    'Fetch comparable rental properties (comps) for a deal. ' +
    'Returns nearby properties with rent, occupancy, and unit mix data for underwriting support.',
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
      const data = await client.get<{
        comps?: Array<{
          id?: string;
          address?: string | null;
          propertyName?: string | null;
          distanceMiles?: number | null;
          units?: number | null;
          yearBuilt?: number | null;
          avgRent?: number | null;
          occupancyRate?: number | null;
        }>;
        avgMarketRent?: number | null;
        avgOccupancy?: number | null;
      }>(`/deals/${input.deal_id}/comps/summary`);

      const comps = (data?.comps ?? []).slice(0, input.limit).map(c => ({
        id: c.id ?? '',
        address: c.address ?? null,
        property_name: c.propertyName ?? null,
        distance_miles: c.distanceMiles ?? null,
        units: c.units ?? null,
        year_built: c.yearBuilt ?? null,
        avg_rent: c.avgRent ?? null,
        occupancy_rate: c.occupancyRate ?? null,
      }));

      logger.debug('fetch_comps: fetched comps summary', {
        dealId: input.deal_id,
        count: comps.length,
      });

      return {
        deal_id: input.deal_id,
        comps,
        avg_market_rent: data?.avgMarketRent ?? null,
        avg_occupancy: data?.avgOccupancy ?? null,
        comp_count: comps.length,
        fetched_at: now,
      };
    } catch (err) {
      logger.warn('fetch_comps: request failed', {
        dealId: input.deal_id,
        err: err instanceof Error ? err.message : String(err),
      });

      return {
        deal_id: input.deal_id,
        comps: [],
        avg_market_rent: null,
        avg_occupancy: null,
        comp_count: 0,
        fetched_at: now,
      };
    }
  },
};
