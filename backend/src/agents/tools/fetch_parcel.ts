/**
 * Tool: fetch_parcel
 *
 * Fetches parcel and property data by parcel_id (as property UUID) or by address.
 * Routes through the platform API under the research agent's service-account
 * identity (dogfooding pattern — no private backdoor).
 *
 * Endpoint mapping to existing routes:
 *   - parcel_id → GET /properties/:id  (property.routes.ts)
 *   - address   → GET /pipeline/analyze/:parcelId via POST /pipeline/analyze
 *
 * Required capability: read:parcels
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  parcel_id: z.string().optional().describe('Platform property UUID or parcel ID'),
  address: z.string().optional().describe('Full street address'),
  county: z.string().optional().describe('County name, used with address for disambiguation'),
}).refine(
  d => d.parcel_id || d.address,
  { message: 'Must provide parcel_id or address' }
);

const OutputSchema = z.object({
  parcel_id: z.string(),
  address: z.string().nullable(),
  acres: z.number().nullable(),
  zoning_code: z.string().nullable(),
  land_use: z.string().nullable(),
  assessed_value: z.number().nullable(),
  legal_description: z.string().nullable(),
  owner_name: z.string().nullable(),
  year_built: z.number().nullable(),
  square_feet: z.number().nullable(),
  county: z.string().nullable(),
  state: z.string().nullable(),
  source: z.string().default('platform_api'),
}).passthrough();

type ParcelOutput = z.infer<typeof OutputSchema>;

export const fetchParcelTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  ParcelOutput
> = {
  name: 'fetch_parcel',
  description:
    'Fetch parcel data by property ID or by address. ' +
    'Returns zoning code, acres, assessed value, owner, and year built.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:parcels',

  execute: async (input, ctx) => {
    const client = platformClient.as({
      agentId: 'research',
      runId: ctx.correlationId,
    });

    if (input.parcel_id) {
      // Look up by property UUID via GET /properties/:id
      const data = await client.get<Record<string, unknown>>(
        `/properties/${encodeURIComponent(input.parcel_id)}`
      );
      return normalizePropertyRow(data, input.parcel_id);
    }

    // Address lookup via POST /pipeline/analyze
    try {
      const data = await client.post<Record<string, unknown>>(
        '/pipeline/analyze',
        { address: input.address, county: input.county }
      );
      return normalizePropertyRow(data, (data.id as string) ?? input.address ?? 'unknown');
    } catch (err) {
      logger.warn('fetch_parcel: /pipeline/analyze failed, returning partial result', {
        address: input.address,
        err: err instanceof Error ? err.message : String(err),
      });
      // Return minimal structure so model can handle gracefully
      return {
        parcel_id: input.address ?? 'unknown',
        address: input.address ?? null,
        acres: null,
        zoning_code: null,
        land_use: null,
        assessed_value: null,
        legal_description: null,
        owner_name: null,
        year_built: null,
        square_feet: null,
        county: input.county ?? null,
        state: null,
        source: 'platform_api',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

function normalizePropertyRow(
  row: Record<string, unknown>,
  fallbackId: string
): ParcelOutput {
  return {
    parcel_id: (row.id as string) ?? (row.parcel_id as string) ?? fallbackId,
    address: (row.address as string) ?? (row.full_address as string) ?? null,
    acres: toNumber(row.lot_size_acres ?? row.acres),
    zoning_code: (row.zoning_code as string) ?? (row.zoning as string) ?? null,
    land_use: (row.land_use as string) ?? (row.property_type as string) ?? null,
    assessed_value: toNumber(row.assessed_value ?? row.tax_assessed_value),
    legal_description: (row.legal_description as string) ?? null,
    owner_name: (row.owner_name as string) ?? (row.owner as string) ?? null,
    year_built: toNumber(row.year_built),
    square_feet: toNumber(row.square_feet ?? row.gross_sf ?? row.building_sf),
    county: (row.county as string) ?? null,
    state: (row.state as string) ?? null,
    source: 'platform_api',
  };
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}
