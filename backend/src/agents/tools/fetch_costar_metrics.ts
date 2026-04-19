/**
 * Tool: fetch_costar_metrics
 *
 * Fetches submarket-level supply and market metrics for a given MSA or deal.
 *
 * Endpoint mapping to existing routes:
 *   - If ctx.dealId is set:  GET /supply/deals/:dealId/supply  (supply.routes.ts)
 *   - Otherwise:             GET /market/inventory/:city/:state (market.routes.ts)
 *
 * Phase 3 TODO: add a dedicated GET /supply/msa/:msa_id/metrics endpoint
 * that accepts CBSA codes directly — currently data is deal- or city-centric.
 *
 * Required capability: read:costar
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  msa_id: z.string().describe('CBSA code, e.g. "12060" for Atlanta'),
  city: z.string().optional().describe('City name for market lookup fallback'),
  state: z.string().optional().describe('Two-letter state code for market lookup fallback'),
  submarket_id: z.string().optional().describe('Deal UUID when supply is deal-scoped'),
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
});

const OutputSchema = z.object({
  msa_id: z.string(),
  submarket_id: z.string().nullable(),
  submarket_name: z.string().nullable(),
  metrics: z.record(
    z.string(),
    z.object({
      value: z.number().nullable(),
      unit: z.string().nullable(),
    })
  ),
  source: z.string().default('platform_api'),
  fetched_at: z.string(),
}).passthrough();

type CostarOutput = z.infer<typeof OutputSchema>;

export const fetchCostarMetricsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  CostarOutput
> = {
  name: 'fetch_costar_metrics',
  description:
    'Fetch submarket-level supply and market metrics (vacancy, rent, ' +
    'deliveries, under construction) for a given MSA. ' +
    'Use to quantify pipeline supply pressure. ' +
    'Provide msa_id (CBSA code) and optionally city+state.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:costar',

  execute: async (input, ctx) => {
    const client = platformClient.as({
      agentId: 'supply',
      runId: ctx.correlationId,
    });

    const now = new Date().toISOString();

    // Path 1: deal-scoped supply data
    if (ctx.dealId) {
      try {
        const data = await client.get<Record<string, unknown>>(
          `/supply/deals/${ctx.dealId}/supply`
        );
        return normalizeSupplyResponse(data, input.msa_id, ctx.dealId, now);
      } catch (err) {
        logger.warn('fetch_costar_metrics: deal-scoped supply failed, trying market fallback', {
          dealId: ctx.dealId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Path 2: city/state market inventory
    const city = input.city ?? 'Atlanta';
    const state = input.state ?? 'GA';

    try {
      const data = await client.get<Record<string, unknown>>(
        `/market/inventory/${encodeURIComponent(city)}/${encodeURIComponent(state)}`
      );
      return normalizeMarketInventory(data, input.msa_id, now);
    } catch (err) {
      logger.warn('fetch_costar_metrics: market inventory fallback failed', {
        city, state,
        err: err instanceof Error ? err.message : String(err),
      });

      // Return structured stub so model can handle gracefully
      return {
        msa_id: input.msa_id,
        submarket_id: null,
        submarket_name: null,
        metrics: buildMetricStub(input.metric_types),
        source: 'unavailable',
        fetched_at: now,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

function normalizeSupplyResponse(
  data: Record<string, unknown>,
  msaId: string,
  dealId: string,
  now: string
): CostarOutput {
  const metrics: CostarOutput['metrics'] = {};

  if (data.vacancyRate !== undefined || data.vacancy_rate !== undefined) {
    metrics.vacancy_rate = { value: toNumber(data.vacancyRate ?? data.vacancy_rate), unit: 'pct' };
  }
  if (data.askingRent !== undefined || data.asking_rent !== undefined) {
    metrics.asking_rent = { value: toNumber(data.askingRent ?? data.asking_rent), unit: 'usd_per_sf' };
  }
  if (data.unitsUnderConstruction !== undefined || data.under_construction_units !== undefined) {
    metrics.under_construction_units = {
      value: toNumber(data.unitsUnderConstruction ?? data.under_construction_units),
      unit: 'units',
    };
  }

  return {
    msa_id: msaId,
    submarket_id: dealId,
    submarket_name: (data.submarketName as string) ?? null,
    metrics,
    source: 'supply_signal_service',
    fetched_at: now,
  };
}

function normalizeMarketInventory(
  data: Record<string, unknown>,
  msaId: string,
  now: string
): CostarOutput {
  const metrics: CostarOutput['metrics'] = {};

  if (data.vacancyRate !== undefined) {
    metrics.vacancy_rate = { value: toNumber(data.vacancyRate), unit: 'pct' };
  }
  if (data.avgRent !== undefined) {
    metrics.asking_rent = { value: toNumber(data.avgRent), unit: 'usd_per_mo' };
  }
  if (data.totalUnits !== undefined) {
    metrics.total_units = { value: toNumber(data.totalUnits), unit: 'units' };
  }

  return {
    msa_id: msaId,
    submarket_id: null,
    submarket_name: (data.city as string) ?? null,
    metrics,
    source: 'market_inventory',
    fetched_at: now,
  };
}

function buildMetricStub(
  types: string[]
): CostarOutput['metrics'] {
  const out: CostarOutput['metrics'] = {};
  for (const t of types) {
    out[t] = { value: null, unit: null };
  }
  return out;
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}
