/**
 * Tool: fetch_municode
 *
 * Fetches the full municipal zoning ordinance section(s) for a given
 * zoning code or land-use classification from the platform code library.
 * Provides verbatim regulatory language the LLM can cite in analysis.
 *
 * Required capability: read:zoning
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  zoning_code: z.string().describe('Zoning classification code, e.g. "R-4" or "MU-CBD"'),
  jurisdiction: z.string().describe('City or county name for the code lookup'),
  section: z.string().optional().describe('Specific ordinance section number if known'),
});

const OutputSchema = z.object({
  zoning_code: z.string(),
  jurisdiction: z.string(),
  ordinance_sections: z.array(z.object({
    section_number: z.string(),
    title: z.string(),
    text: z.string(),
  })).default([]),
  effective_date: z.string().nullable(),
  source_url: z.string().nullable(),
  source: z.string().default('platform_api'),
}).passthrough();

export const fetchMunicodeTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_municode',
  description:
    'Fetch the municipal ordinance text for a zoning code in a given jurisdiction. ' +
    'Returns verbatim regulatory sections that govern permitted uses, dimensional standards, ' +
    'and conditional use permits.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:zoning',

  execute: async (input, ctx) => {
    const client = platformClient.as({
      agentId: ctx.agentId ?? 'zoning',
      runId: ctx.correlationId,
    });

    try {
      const resp = await client.get<Record<string, unknown>>('/zoning/municode', {
        zoning_code: input.zoning_code,
        jurisdiction: input.jurisdiction,
        ...(input.section && { section: input.section }),
      });

      const sections = Array.isArray(resp.sections)
        ? resp.sections.map((s: Record<string, unknown>) => ({
            section_number: String(s.section_number ?? s.section ?? ''),
            title: String(s.title ?? ''),
            text: String(s.text ?? s.content ?? ''),
          }))
        : [];

      return {
        zoning_code: input.zoning_code,
        jurisdiction: input.jurisdiction,
        ordinance_sections: sections,
        effective_date: resp.effective_date ? String(resp.effective_date) : null,
        source_url: resp.source_url ? String(resp.source_url) : null,
        source: 'platform_api',
      };
    } catch (err) {
      logger.warn('fetch_municode: API call failed', {
        zoning_code: input.zoning_code,
        jurisdiction: input.jurisdiction,
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        zoning_code: input.zoning_code,
        jurisdiction: input.jurisdiction,
        ordinance_sections: [],
        effective_date: null,
        source_url: null,
        source: 'unavailable',
      };
    }
  },
};
