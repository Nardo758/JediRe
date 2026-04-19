/**
 * Tool: fetch_zoning_code
 *
 * Fetches zoning classification, overlay districts, and permitted uses
 * for a parcel from the platform zoning API.
 *
 * Required capability: read:zoning
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  parcel_id: z.string().optional().describe('Platform property UUID'),
  address: z.string().optional().describe('Full street address to geocode and look up'),
  jurisdiction: z.string().optional().describe('City/county name for disambiguation'),
}).refine(
  d => d.parcel_id || d.address,
  { message: 'Must provide parcel_id or address' }
);

const OutputSchema = z.object({
  parcel_id: z.string(),
  zoning_code: z.string().nullable(),
  zoning_description: z.string().nullable(),
  permitted_uses: z.array(z.string()).default([]),
  conditional_uses: z.array(z.string()).default([]),
  overlay_districts: z.array(z.string()).default([]),
  max_far: z.number().nullable(),
  max_height_ft: z.number().nullable(),
  min_lot_sqft: z.number().nullable(),
  setback_front_ft: z.number().nullable(),
  setback_rear_ft: z.number().nullable(),
  setback_side_ft: z.number().nullable(),
  max_lot_coverage_pct: z.number().nullable(),
  source: z.string().default('platform_api'),
}).passthrough();

export const fetchZoningCodeTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_zoning_code',
  description:
    'Fetch zoning classification, permitted uses, overlay districts, and development parameters ' +
    '(FAR, height limit, setbacks) for a parcel by ID or address.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:zoning',

  execute: async (input, ctx) => {
    const client = platformClient.as({
      agentId: ctx.agentId ?? 'zoning',
      runId: ctx.correlationId,
    });

    try {
      const params: Record<string, string> = {};
      if (input.parcel_id) params.property_id = input.parcel_id;
      if (input.address) params.address = input.address;
      if (input.jurisdiction) params.jurisdiction = input.jurisdiction;

      const resp = await client.get<Record<string, unknown>>('/zoning/lookup', params);

      return {
        parcel_id: input.parcel_id ?? input.address ?? 'unknown',
        zoning_code: str(resp.zoning_code),
        zoning_description: str(resp.zoning_description ?? resp.description),
        permitted_uses: arr(resp.permitted_uses),
        conditional_uses: arr(resp.conditional_uses),
        overlay_districts: arr(resp.overlay_districts),
        max_far: num(resp.max_far ?? resp.far),
        max_height_ft: num(resp.max_height_ft ?? resp.max_height),
        min_lot_sqft: num(resp.min_lot_sqft),
        setback_front_ft: num(resp.setback_front_ft),
        setback_rear_ft: num(resp.setback_rear_ft),
        setback_side_ft: num(resp.setback_side_ft),
        max_lot_coverage_pct: num(resp.max_lot_coverage_pct),
        source: 'platform_api',
      };
    } catch (err) {
      logger.warn('fetch_zoning_code: API call failed', {
        parcel_id: input.parcel_id,
        address: input.address,
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        parcel_id: input.parcel_id ?? input.address ?? 'unknown',
        zoning_code: null,
        zoning_description: null,
        permitted_uses: [],
        conditional_uses: [],
        overlay_districts: [],
        max_far: null,
        max_height_ft: null,
        min_lot_sqft: null,
        setback_front_ft: null,
        setback_rear_ft: null,
        setback_side_ft: null,
        max_lot_coverage_pct: null,
        source: 'unavailable',
      };
    }
  },
};

function str(v: unknown): string | null {
  if (v == null) return null;
  return String(v);
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}
