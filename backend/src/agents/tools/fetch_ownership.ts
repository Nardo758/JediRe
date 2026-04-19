/**
 * Tool: fetch_ownership
 *
 * Fetches ownership information for a property/parcel.
 * Routes through GET /properties/:propertyId (ownership fields) via the platform API.
 * Falls back to address lookup if propertyId is unavailable.
 *
 * Required capability: read:parcels
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  property_id: z.string().uuid('property_id must be a valid UUID').optional().describe(
    'Platform property UUID. If provided, used for direct lookup.'
  ),
  deal_id: z.string().uuid('deal_id must be a valid UUID').optional().describe(
    'Deal UUID — used to identify the property when property_id is unavailable.'
  ),
}).refine(
  data => data.property_id != null || data.deal_id != null,
  'Either property_id or deal_id must be provided'
);

const OutputSchema = z.object({
  property_id: z.string().nullable(),
  owner_name: z.string().nullable(),
  owner_type: z.string().nullable().describe(
    'LLC, individual, trust, REIT, etc.'
  ),
  acquisition_date: z.string().nullable(),
  acquisition_price: z.number().nullable(),
  mailing_address: z.string().nullable(),
  source: z.string(),
  fetched_at: z.string(),
});

export const fetchOwnershipTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_ownership',
  description:
    'Fetch ownership information for a property: owner name, entity type, acquisition date, ' +
    'and acquisition price from county records. Use to assess ownership motivation and hold period.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:parcels',

  execute: async (input, ctx) => {
    const client = platformClient.as({
      agentId: ctx.agentId ?? 'research',
      runId: ctx.correlationId,
    });

    const now = new Date().toISOString();

    const propertyId = input.property_id;

    if (!propertyId) {
      logger.debug('fetch_ownership: no property_id, returning empty ownership', {
        dealId: input.deal_id,
      });
      return {
        property_id: null,
        owner_name: null,
        owner_type: null,
        acquisition_date: null,
        acquisition_price: null,
        mailing_address: null,
        source: 'unavailable',
        fetched_at: now,
      };
    }

    try {
      const row = await client.get<{
        owner_name?: string | null;
        owner_type?: string | null;
        acquisition_date?: string | null;
        acquisition_price?: number | null;
        mailing_address?: string | null;
      }>(`/properties/${encodeURIComponent(propertyId)}`);

      logger.debug('fetch_ownership: fetched ownership', {
        propertyId,
        owner: row?.owner_name,
      });

      return {
        property_id: propertyId,
        owner_name: row?.owner_name ?? null,
        owner_type: row?.owner_type ?? null,
        acquisition_date: row?.acquisition_date ?? null,
        acquisition_price: row?.acquisition_price ?? null,
        mailing_address: row?.mailing_address ?? null,
        source: 'county_records',
        fetched_at: now,
      };
    } catch (err) {
      logger.warn('fetch_ownership: request failed', {
        propertyId,
        err: err instanceof Error ? err.message : String(err),
      });

      return {
        property_id: propertyId,
        owner_name: null,
        owner_type: null,
        acquisition_date: null,
        acquisition_price: null,
        mailing_address: null,
        source: 'unavailable',
        fetched_at: now,
      };
    }
  },
};
