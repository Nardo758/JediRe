/**
 * Tool: fetch_costar_metrics
 *
 * Fetches submarket-level CoStar supply and market metrics for a given MSA/submarket.
 * Routes through the platform API under the supply agent's service-account identity.
 *
 * Required capability: read:costar
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  msa_id: z.string().describe('CBSA code, e.g. "12060" for Atlanta'),
  submarket_id: z.string().optional().describe('CoStar submarket ID, if known'),
  metric_types: z.array(
    z.enum([
      'vacancy_rate',
      'asking_rent',
      'effective_rent',
      'absorption_units',
      'deliveries_units',
      'under_construction_units',
      'cap_rate',
    ])
  ).default(['vacancy_rate', 'asking_rent', 'under_construction_units']),
  period: z.object({
    start: z.string().describe('ISO date, e.g. 2023-01-01'),
    end: z.string().describe('ISO date, e.g. 2024-12-31'),
  }).optional(),
});

const OutputSchema = z.object({
  msa_id: z.string(),
  submarket_id: z.string().nullable(),
  submarket_name: z.string().nullable(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  metrics: z.record(
    z.string(),
    z.object({
      value: z.number().nullable(),
      unit: z.string().nullable(),
      period: z.string().nullable(),
    })
  ),
  source: z.string().default('costar'),
  fetched_at: z.string(),
}).passthrough();

export const fetchCostarMetricsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_costar_metrics',
  description:
    'Fetch submarket-level CoStar supply and market metrics (vacancy, rent, ' +
    'deliveries, under construction) for a given MSA or submarket. ' +
    'Use to quantify pipeline supply pressure.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:costar',

  execute: async (input, ctx) => {
    const client = platformClient.as({
      agentId: 'supply',
      runId: ctx.correlationId,
    });

    const params: Record<string, string> = {
      msa_id: input.msa_id,
      metrics: input.metric_types.join(','),
    };
    if (input.submarket_id) params.submarket_id = input.submarket_id;
    if (input.period?.start) params.period_start = input.period.start;
    if (input.period?.end) params.period_end = input.period.end;

    const data = await client.get<z.infer<typeof OutputSchema>>(
      '/market/costar/metrics',
      params
    );

    return data;
  },
};
