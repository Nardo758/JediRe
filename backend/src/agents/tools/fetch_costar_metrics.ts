/**
 * Tool: fetch_costar_metrics
 *
 * Fetches submarket-level supply and market metrics for a given MSA or deal.
 *
 * API contracts:
 *   Deal-scoped: GET /supply/deals/:dealId/supply
 *     Response: { success: true, dealId, tradeAreaId,
 *                 data: SupplyPipeline { constructionUnits, totalPipelineUnits,
 *                       existingUnits, delivered12moUnits, permittedUnits, ... } }
 *
 *   Market fallback: GET /market/inventory/:city/:state
 *     Response: { city, state, data: market_inventory[],
 *                 data[i]: { vacancy_rate, absorption_rate, months_of_supply,
 *                            price_per_sqft, median_price, active_listings, ... } }
 *
 * Required capability: read:costar
 *
 * Phase 3 TODO: add GET /supply/msa/:msaId/metrics accepting CBSA codes directly.
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  msa_id: z.string().optional().describe(
    'CBSA code, e.g. "12060" for Atlanta. Optional — if absent, the tool will ' +
    'use the deal supply endpoint (via ctx.dealId) or fall back to city+state lookup.'
  ),
  city: z.string().optional().describe('City name for market lookup (e.g. "Atlanta")'),
  state: z.string().optional().describe('Two-letter state code (e.g. "GA")'),
  metric_types: z.array(
    z.enum([
      'vacancy_rate',
      'asking_rent',
      'absorption_rate',
      'months_of_supply',
      'under_construction_units',
      'delivered_12mo_units',
      'total_pipeline_units',
      'price_per_sqft',
    ])
  ).default(['vacancy_rate', 'absorption_rate', 'under_construction_units']),
});

const MetricEntry = z.object({
  value: z.number().nullable(),
  unit: z.string().nullable(),
});

const OutputSchema = z.object({
  msa_id: z.string(),
  source_path: z.string(),
  metrics: z.record(z.string(), MetricEntry),
  raw: z.record(z.string(), z.unknown()).optional(),
  fetched_at: z.string(),
}).passthrough();

type CostarOutput = z.infer<typeof OutputSchema>;

export const fetchCostarMetricsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  CostarOutput
> = {
  name: 'fetch_costar_metrics',
  description:
    'Fetch submarket supply and market metrics for a given MSA. ' +
    'Returns vacancy rate, absorption, pipeline supply (under construction + delivered), ' +
    'and price per sqft. Requires msa_id (CBSA code). ' +
    'Optionally provide city + state for market inventory lookup.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:costar',

  execute: async (input, ctx) => {
    // Use caller's agent identity from RunContext (stamped by AgentRuntime from
    // AgentConfig.agentId) so attribution/auth is correct regardless of which
    // agent executes this tool.
    const client = platformClient.as({
      agentId: ctx.agentId ?? 'supply',
      runId: ctx.correlationId,
    });

    const now = new Date().toISOString();
    // msa_id is optional — use provided value or fall back to dealId for labelling.
    const msaLabel = input.msa_id ?? (ctx.dealId ? `deal:${ctx.dealId}` : 'unknown');

    // Path 1: deal-scoped supply pipeline
    if (ctx.dealId) {
      try {
        const resp = await client.get<{
          success: boolean;
          dealId: string;
          tradeAreaId: string;
          data: Record<string, unknown>;
        }>(`/supply/deals/${ctx.dealId}/supply`);

        if (resp.success && resp.data) {
          return normalizeSupplyPipeline(resp.data, msaLabel, ctx.dealId, now);
        }
      } catch (err) {
        logger.warn('fetch_costar_metrics: deal supply failed, trying market fallback', {
          dealId: ctx.dealId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Path 2: city/state market inventory (aggregate across rows)
    const city = input.city ?? 'Atlanta';
    const state = input.state ?? 'GA';

    try {
      const resp = await client.get<{
        city: string;
        state: string;
        data: Record<string, unknown>[];
        count: number;
      }>(`/market/inventory/${encodeURIComponent(city)}/${encodeURIComponent(state)}`);

      const rows = resp?.data ?? [];
      return normalizeMarketInventoryRows(rows, msaLabel, city, state, now);

    } catch (err) {
      logger.warn('fetch_costar_metrics: market inventory fallback failed', {
        city, state,
        err: err instanceof Error ? err.message : String(err),
      });

      // Return stub so model can handle gracefully
      return {
        msa_id: msaLabel,
        source_path: 'unavailable',
        metrics: Object.fromEntries(
          input.metric_types.map(t => [t, { value: null, unit: null }])
        ),
        fetched_at: now,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

// ── Response normalization ────────────────────────────────────────

/**
 * Normalize SupplyPipeline object from /supply/deals/:id/supply → data
 * Fields: constructionUnits, totalPipelineUnits, existingUnits,
 *         delivered12moUnits, permittedUnits, constructionProjects
 */
function normalizeSupplyPipeline(
  pipeline: Record<string, unknown>,
  msaId: string,
  dealId: string,
  now: string
): CostarOutput {
  const metrics: CostarOutput['metrics'] = {
    under_construction_units: {
      value: num(pipeline.constructionUnits ?? pipeline.constructionWeightedUnits),
      unit: 'units',
    },
    total_pipeline_units: {
      value: num(pipeline.totalPipelineUnits ?? pipeline.totalWeightedUnits),
      unit: 'units',
    },
    delivered_12mo_units: {
      value: num(pipeline.delivered12moUnits),
      unit: 'units',
    },
    permitted_units: {
      value: num(pipeline.permittedUnits ?? pipeline.permittedWeightedUnits),
      unit: 'units',
    },
    existing_units: {
      value: num(pipeline.existingUnits),
      unit: 'units',
    },
  };

  // Supply pressure ratio: pipeline ÷ existing
  const existing = num(pipeline.existingUnits);
  const total = num(pipeline.totalPipelineUnits ?? pipeline.totalWeightedUnits);
  if (existing && total && existing > 0) {
    metrics.supply_pressure_ratio = {
      value: +(total / existing).toFixed(4),
      unit: 'ratio',
    };
  }

  return {
    msa_id: msaId,
    source_path: `/supply/deals/${dealId}/supply`,
    metrics,
    raw: pipeline,
    fetched_at: now,
  };
}

/**
 * Aggregate market_inventory rows from /market/inventory/:city/:state → data[]
 * Averages numeric metrics across rows (snapshots) to get a single value.
 */
function normalizeMarketInventoryRows(
  rows: Record<string, unknown>[],
  msaId: string,
  city: string,
  state: string,
  now: string
): CostarOutput {
  if (rows.length === 0) {
    return {
      msa_id: msaId,
      source_path: `/market/inventory/${city}/${state}`,
      metrics: {},
      fetched_at: now,
    };
  }

  function avg(field: string): number | null {
    const vals = rows
      .map(r => num(r[field]))
      .filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4);
  }

  const metrics: CostarOutput['metrics'] = {
    vacancy_rate: { value: avg('vacancy_rate'), unit: 'pct' },
    absorption_rate: { value: avg('absorption_rate'), unit: 'units_per_month' },
    months_of_supply: { value: avg('months_of_supply'), unit: 'months' },
    price_per_sqft: { value: avg('price_per_sqft'), unit: 'usd_per_sqft' },
    active_listings: { value: avg('active_listings'), unit: 'units' },
  };

  return {
    msa_id: msaId,
    source_path: `/market/inventory/${city}/${state}`,
    metrics,
    fetched_at: now,
  };
}

function num(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}
