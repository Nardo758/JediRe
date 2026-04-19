/**
 * Tool: fetch_parcel
 *
 * Fetches parcel data by parcel_id or by (address + county).
 * Routes through the platform API under the research agent's service-account
 * identity (dogfooding pattern — no private backdoor).
 *
 * Required capability: read:parcels
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  parcel_id: z.string().optional(),
  address: z.string().optional(),
  county: z.string().optional(),
}).refine(
  d => d.parcel_id || (d.address && d.county),
  { message: 'Must provide parcel_id or (address + county)' }
);

const OutputSchema = z.object({
  parcel_id: z.string(),
  address: z.string(),
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

export const fetchParcelTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_parcel',
  description:
    'Fetch parcel data by parcel_id or by address+county. ' +
    'Returns zoning code, acres, assessed value, owner, and year built.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:parcels',

  execute: async (input, ctx) => {
    const client = platformClient.as({
      agentId: 'research',
      runId: ctx.correlationId,
    });

    const params: Record<string, string> = {};
    if (input.parcel_id) params.parcel_id = input.parcel_id;
    if (input.address) params.address = input.address;
    if (input.county) params.county = input.county;

    const data = await client.get<z.infer<typeof OutputSchema>>(
      '/parcels/lookup',
      params
    );

    return data;
  },
};
