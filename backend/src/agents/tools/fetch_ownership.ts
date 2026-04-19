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
import { query } from '../../database/connection';
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

    // Resolve property_id — prefer explicit input, fall back to deal_properties lookup.
    // This ensures the tool works when the LLM provides only deal_id.
    let propertyId = input.property_id ?? null;

    if (!propertyId && input.deal_id) {
      logger.debug('fetch_ownership: resolving property_id from deal_id', {
        dealId: input.deal_id,
      });
      try {
        const res = await query(
          `SELECT dp.property_id
           FROM deal_properties dp
           WHERE dp.deal_id = $1
           ORDER BY dp.created_at ASC
           LIMIT 1`,
          [input.deal_id]
        );
        propertyId = res.rows[0]?.property_id ?? null;

        if (propertyId) {
          logger.debug('fetch_ownership: resolved property_id from deal', {
            dealId: input.deal_id,
            propertyId,
          });
        } else {
          logger.debug('fetch_ownership: no linked property for deal', { dealId: input.deal_id });
        }
      } catch (err) {
        logger.warn('fetch_ownership: deal-to-property lookup failed', {
          dealId: input.deal_id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!propertyId) {
      logger.debug('fetch_ownership: no property_id available, returning unavailable', {
        dealId: input.deal_id,
      });
      return {
        property_id: null,
        owner_name: null,
        owner_type: null,
        acquisition_date: null,
        acquisition_price: null,
        mailing_address: null,
        source: 'no_linked_property',
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
