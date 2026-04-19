/**
 * Tool: fetch_parcel
 *
 * Fetches parcel/property data from the platform database.
 * Routes through the platform API under the research agent's service-account
 * identity (dogfooding pattern — no private backdoor).
 *
 * API contracts:
 *   parcel_id → GET /properties/:id
 *               Response: property row ({ id, address_line1, city, state_code,
 *               property_type, year_built, sqft, units, avg_rent, ... })
 *
 *   address   → GET /properties/?address=<query>&limit=1
 *               Response: { properties: [...rows], count: N }
 *               (address filter added to property.routes.ts list endpoint)
 *
 * Required capability: read:parcels
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  parcel_id: z.string().optional().describe('Platform property UUID'),
  address: z.string().optional().describe('Full or partial street address'),
  county: z.string().optional().describe('County for disambiguation (logged only)'),
}).refine(
  d => d.parcel_id || d.address,
  { message: 'Must provide parcel_id or address' }
);

const OutputSchema = z.object({
  parcel_id: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  property_type: z.string().nullable(),
  year_built: z.number().nullable(),
  square_feet: z.number().nullable(),
  units: z.number().nullable(),
  avg_rent: z.number().nullable(),
  occupancy_rate: z.number().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  source: z.string().default('platform_api'),
}).passthrough();

type ParcelOutput = z.infer<typeof OutputSchema>;

export const fetchParcelTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  ParcelOutput
> = {
  name: 'fetch_parcel',
  description:
    'Fetch property/parcel data by ID or by address. ' +
    'Returns property type, year built, square footage, units, avg rent, and occupancy.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:parcels',

  execute: async (input, ctx) => {
    const client = platformClient.as({
      agentId: 'research',
      runId: ctx.correlationId,
    });

    if (input.parcel_id) {
      // Look up by UUID — GET /properties/:id returns a single property row
      const row = await client.get<Record<string, unknown>>(
        `/properties/${encodeURIComponent(input.parcel_id)}`
      );
      return normalizeRow(row);
    }

    // Address lookup — GET /properties/?address=<query>&limit=1
    // Returns { properties: [...], count: N }
    const listResp = await client.get<{ properties: Record<string, unknown>[]; count: number }>(
      '/properties',
      { address: input.address!, limit: '1' }
    );

    const rows = listResp?.properties;

    if (!rows || rows.length === 0) {
      logger.warn('fetch_parcel: no property found for address', {
        address: input.address,
        county: input.county,
      });
      return {
        parcel_id: input.address ?? 'unknown',
        address: input.address ?? null,
        city: null,
        state: null,
        property_type: null,
        year_built: null,
        square_feet: null,
        units: null,
        avg_rent: null,
        occupancy_rate: null,
        lat: null,
        lng: null,
        source: 'platform_api',
        not_found: true,
      };
    }

    return normalizeRow(rows[0]);
  },
};

// ── Response normalization ────────────────────────────────────────

function normalizeRow(row: Record<string, unknown>): ParcelOutput {
  return {
    parcel_id: str(row.id),
    address: str(row.address_line1 ?? row.address ?? row.full_address),
    city: str(row.city),
    state: str(row.state_code ?? row.state),
    property_type: str(row.property_type),
    year_built: num(row.year_built),
    square_feet: num(row.sqft ?? row.square_feet),
    units: num(row.units),
    avg_rent: num(row.avg_rent ?? row.market_rent),
    occupancy_rate: num(row.current_occupancy ?? row.occupancy_rate),
    lat: num(row.lat),
    lng: num(row.lng),
    source: 'platform_api',
  };
}

function str(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  return String(val);
}

function num(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}
