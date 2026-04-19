/**
 * Tool: fetch_permits
 *
 * Fetches active building permits and permit pipeline data for a given
 * submarket or parcel from the platform permits API.
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
  property_type: z.string().optional().describe('Filter by property type: multifamily, office, retail, etc.'),
  radius_miles: z.number().optional().default(3).describe('Search radius in miles from deal address'),
  months_back: z.number().optional().default(12).describe('Look-back window in months for permit activity'),
});

const OutputSchema = z.object({
  city: z.string(),
  state_code: z.string(),
  total_permits: z.number(),
  permitted_units: z.number().nullable(),
  permitted_sqft: z.number().nullable(),
  permits_by_type: z.record(z.string(), z.number()).default({}),
  yoy_change_pct: z.number().nullable(),
  top_developments: z.array(z.object({
    address: z.string(),
    units: z.number().nullable(),
    permit_date: z.string().nullable(),
    status: z.string().nullable(),
  })).default([]),
  fetched_at: z.string(),
  source: z.string().default('platform_api'),
}).passthrough();

export const fetchPermitsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_permits',
  description:
    'Fetch active building permits and permit pipeline data for a submarket. ' +
    'Returns total permits, permitted units/sqft, year-over-year change, and top individual developments.',
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
      const resp = await client.get<Record<string, unknown>>('/supply/permits', {
        city: input.city,
        state_code: input.state_code,
        ...(input.property_type && { property_type: input.property_type }),
        radius_miles: String(input.radius_miles ?? 3),
        months_back: String(input.months_back ?? 12),
      });

      const developments = Array.isArray(resp.top_developments)
        ? resp.top_developments.map((d: Record<string, unknown>) => ({
            address: String(d.address ?? ''),
            units: d.units != null ? Number(d.units) : null,
            permit_date: d.permit_date ? String(d.permit_date) : null,
            status: d.status ? String(d.status) : null,
          }))
        : [];

      return {
        city: input.city,
        state_code: input.state_code,
        total_permits: Number(resp.total_permits ?? 0),
        permitted_units: resp.permitted_units != null ? Number(resp.permitted_units) : null,
        permitted_sqft: resp.permitted_sqft != null ? Number(resp.permitted_sqft) : null,
        permits_by_type: (resp.permits_by_type as Record<string, number>) ?? {},
        yoy_change_pct: resp.yoy_change_pct != null ? Number(resp.yoy_change_pct) : null,
        top_developments: developments,
        fetched_at: now,
        source: 'platform_api',
      };
    } catch (err) {
      logger.warn('fetch_permits: API call failed', {
        city: input.city,
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        city: input.city,
        state_code: input.state_code,
        total_permits: 0,
        permitted_units: null,
        permitted_sqft: null,
        permits_by_type: {},
        yoy_change_pct: null,
        top_developments: [],
        fetched_at: now,
        source: 'unavailable',
      };
    }
  },
};
