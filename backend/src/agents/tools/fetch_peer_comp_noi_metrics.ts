/**
 * Tool: fetch_peer_comp_noi_metrics
 *
 * M15 comp engine NOI rollups by submarket/class/vintage.
 * Returns peer comp NOI metrics for cross-checking proforma assumptions.
 *
 * Tier 3 evidence source.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  asset_class: z.string().nullable().optional().describe('A, B, or C property_class'),
  year_built_min: z.number().int().nullable().optional(),
  year_built_max: z.number().int().nullable().optional(),
  units_min: z.number().int().nullable().optional(),
  units_max: z.number().int().nullable().optional(),
  max_comps: z.number().int().min(1).max(25).default(10),
  /**
   * Value-add GPR two-comp-set protocol.
   *
   * 'baseline'           — comparable assets in the same pre-renovation condition.
   *                        Establishes current market rent and validates in-place vs market gap.
   *                        Filter: same class/vintage/submarket as subject in its current state.
   *
   * 'renovation_ceiling' — newer or recently renovated assets at the finish tier the
   *                        subject renovation will reach. Establishes the post-renovation
   *                        achievable rent distribution (P25/P50/P75 per floor plan).
   *                        This distribution is the COMP CEILING INPUT — sponsor picks
   *                        positioning percentile; agent computes premium from that.
   *                        Filter: year_built_min should be max(subject_year_built + 15,
   *                        current_year - 10); same submarket required.
   *
   * When omitted: behaves as 'baseline' (legacy / non-value-add calls unchanged).
   */
  comp_role: z.enum(['baseline', 'renovation_ceiling']).nullable().optional()
    .describe(
      'Value-add GPR only. Call TWICE — once as "baseline" (current state comps), ' +
      'once as "renovation_ceiling" (newer/renovated comps that set the post-reno rent ceiling). ' +
      'Omit for non-value-add or non-GPR calls.'
    ),
});

const CompMetricSchema = z.object({
  property_name: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  year_built: z.number().nullable(),
  unit_type: z.string().nullable(),
  avg_asking_rent: z.number().nullable(),
  occupancy_rate: z.number().nullable(),
  noi_per_unit_estimate: z.number().nullable(),
  data_source: z.string(),
});

const OutputSchema = z.object({
  comps: z.array(CompMetricSchema),
  submarket_summary: z.object({
    median_asking_rent: z.number().nullable(),
    median_occupancy_rate: z.number().nullable(),
    comp_count: z.number().int(),
  }),
  /**
   * Echoes the comp_role from the request so the agent's tool response clearly identifies
   * which of the two value-add GPR comp sets this result set represents.
   * Null when comp_role was omitted (non-value-add / legacy call).
   */
  comp_role: z.enum(['baseline', 'renovation_ceiling']).nullable().optional(),
  note: z.string().optional(),
});

export const fetchPeerCompNOIMetricsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_peer_comp_noi_metrics',
  description:
    'Returns M15 comp engine metrics (asking rents, occupancy, NOI estimates) for comparable ' +
    'multifamily properties in the same market/class/vintage. Use as Tier 3 evidence for ' +
    'rent and vacancy assumptions. ' +
    'FOR VALUE-ADD DEALS: call this tool TWICE using the comp_role parameter — ' +
    'comp_role="baseline" for current-state comps (establishes current market rent), ' +
    'comp_role="renovation_ceiling" for newer/renovated comps (establishes post-renovation ' +
    'achievable rent ceiling P25/P50/P75 per floor plan). ' +
    'See system prompt "GPR Investigation — Value-Add Deals" for the full two-comp-set protocol.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:all',

  execute: async (input, ctx) => {
    // Query apartment_rent_comps aggregated by property
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (input.city) {
      conditions.push(`arc.city ILIKE $${paramIdx}`);
      params.push(`%${input.city}%`);
      paramIdx++;
    }

    if (input.state) {
      conditions.push(`arc.state ILIKE $${paramIdx}`);
      params.push(input.state);
      paramIdx++;
    }

    if (input.asset_class) {
      conditions.push(`arc.property_class = $${paramIdx}`);
      params.push(input.asset_class.toUpperCase().charAt(0));
      paramIdx++;
    }

    if (input.year_built_min != null) {
      conditions.push(`arc.year_built >= $${paramIdx}`);
      params.push(input.year_built_min);
      paramIdx++;
    }

    if (input.year_built_max != null) {
      conditions.push(`arc.year_built <= $${paramIdx}`);
      params.push(input.year_built_max);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(input.max_comps);
    const limitClause = `LIMIT $${paramIdx}`;

    const result = await query(
      `SELECT
         arc.property_name,
         arc.city,
         arc.state,
         arc.year_built,
         arc.unit_type,
         AVG(arc.rent)       AS avg_asking_rent,
         AVG(arc.occupancy)  AS avg_occupancy,
         'apartment_rent_comps' AS data_source
       FROM apartment_rent_comps arc
       ${whereClause}
       GROUP BY arc.property_name, arc.city, arc.state, arc.year_built, arc.unit_type
       ORDER BY arc.city, arc.property_name
       ${limitClause}`,
      params
    );

    const parseNum = (v: unknown): number | null =>
      v != null && !isNaN(Number(v)) ? Math.round(Number(v) * 100) / 100 : null;

    const comps = result.rows.map((r: Record<string, unknown>) => {
      const rent = parseNum(r.avg_asking_rent);
      const occupancy = parseNum(r.avg_occupancy);
      // Rough NOI/unit estimate: EGI = rent × 12 × occupancy, OpEx ≈ 40% of EGI
      const noiest = rent != null && occupancy != null
        ? Math.round(rent * 12 * (occupancy / 100) * 0.60 * 100) / 100
        : null;
      return {
        property_name: r.property_name as string | null,
        city: r.city as string | null,
        state: r.state as string | null,
        year_built: r.year_built != null ? Number(r.year_built) : null,
        unit_type: r.unit_type as string | null,
        avg_asking_rent: rent,
        occupancy_rate: occupancy,
        noi_per_unit_estimate: noiest,
        data_source: String(r.data_source ?? 'apartment_rent_comps'),
      };
    });

    const rents = comps.map(c => c.avg_asking_rent).filter((v): v is number => v != null).sort((a, b) => a - b);
    const occupancies = comps.map(c => c.occupancy_rate).filter((v): v is number => v != null).sort((a, b) => a - b);
    const median = (arr: number[]): number | null =>
      arr.length === 0 ? null : arr[Math.floor(arr.length / 2)];

    logger.debug('fetch_peer_comp_noi_metrics', {
      runId: ctx.dealId,
      dealId: ctx.dealId,
      compCount: comps.length,
    });

    return {
      comps,
      submarket_summary: {
        median_asking_rent: median(rents),
        median_occupancy_rate: median(occupancies),
        comp_count: comps.length,
      },
      comp_role: input.comp_role ?? null,
      note: comps.length === 0
        ? 'No peer comps found for the specified filters. Try relaxing city/class/vintage constraints.'
        : undefined,
    };
  },
};
