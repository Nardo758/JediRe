/**
 * Tool: fetch_costar_pipeline
 *
 * Fetches the construction/development pipeline for a submarket from the
 * CoStar-backed supply API. Distinct from fetch_costar_metrics which returns
 * current market statistics; this tool focuses on future supply delivery.
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
  property_type: z.string().optional().describe('Property type: multifamily, office, industrial, retail'),
  horizon_months: z.number().optional().default(24).describe('Pipeline look-ahead in months'),
  msa_id: z.string().optional().describe('CBSA code if known'),
});

const OutputSchema = z.object({
  city: z.string(),
  state_code: z.string(),
  property_type: z.string().nullable(),
  under_construction_units: z.number().nullable(),
  under_construction_sqft: z.number().nullable(),
  planned_units: z.number().nullable(),
  deliveries_12mo: z.number().nullable(),
  deliveries_24mo: z.number().nullable(),
  absorption_rate: z.number().nullable(),
  months_of_supply: z.number().nullable(),
  pipeline_as_pct_of_stock: z.number().nullable(),
  fetched_at: z.string(),
  source: z.string().default('platform_api'),
}).passthrough();

export const fetchCostarPipelineTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_costar_pipeline',
  description:
    'Fetch the construction and development pipeline for a submarket: units under construction, ' +
    'planned deliveries over 12/24 months, absorption rate, and pipeline as % of existing stock.',
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
      const resp = await client.get<Record<string, unknown>>('/supply/pipeline', {
        city: input.city,
        state_code: input.state_code,
        ...(input.property_type && { property_type: input.property_type }),
        ...(input.msa_id && { msa_id: input.msa_id }),
        horizon_months: String(input.horizon_months ?? 24),
      });

      const n = (v: unknown) => v != null ? Number(v) : null;

      return {
        city: input.city,
        state_code: input.state_code,
        property_type: input.property_type ?? null,
        under_construction_units: n(resp.under_construction_units),
        under_construction_sqft: n(resp.under_construction_sqft),
        planned_units: n(resp.planned_units),
        deliveries_12mo: n(resp.deliveries_12mo),
        deliveries_24mo: n(resp.deliveries_24mo),
        absorption_rate: n(resp.absorption_rate),
        months_of_supply: n(resp.months_of_supply),
        pipeline_as_pct_of_stock: n(resp.pipeline_as_pct_of_stock),
        fetched_at: now,
        source: 'platform_api',
      };
    } catch (err) {
      logger.warn('fetch_costar_pipeline: API call failed', {
        city: input.city,
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        city: input.city,
        state_code: input.state_code,
        property_type: input.property_type ?? null,
        under_construction_units: null,
        under_construction_sqft: null,
        planned_units: null,
        deliveries_12mo: null,
        deliveries_24mo: null,
        absorption_rate: null,
        months_of_supply: null,
        pipeline_as_pct_of_stock: null,
        fetched_at: now,
        source: 'unavailable',
      };
    }
  },
};
