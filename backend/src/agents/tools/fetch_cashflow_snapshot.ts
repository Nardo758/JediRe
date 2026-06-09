/**
 * Tool: fetch_cashflow_snapshot
 *
 * Reads the most recent successful CashFlow Agent run for the current deal and
 * returns a concise summary of key proforma metrics (NOI, cap rate, IRR, DSCR,
 * collision counts). Injected into Commentary as pre-run context so the narrative
 * agent references grounded numbers instead of re-deriving them from raw market data.
 *
 * Required capability: read:all
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().optional().describe(
    'Deal ID to look up. Defaults to the run context deal_id when omitted.'
  ),
  max_age_hours: z.number().optional().default(72).describe(
    'Only return cashflow runs completed within this many hours. Default 72h.'
  ),
});

const OutputSchema = z.object({
  found: z.boolean(),
  deal_id: z.string().nullable(),
  run_id: z.string().nullable(),
  completed_at: z.string().nullable(),
  noi_year1: z.number().nullable(),
  cap_rate: z.number().nullable(),
  irr: z.number().nullable(),
  dscr_min: z.number().nullable(),
  collision_counts: z.object({
    minor: z.number(),
    material: z.number(),
    severe: z.number(),
  }).nullable(),
  investment_rating: z.string().nullable(),
  summary: z.string().nullable(),
  note: z.string().optional(),
});

export type FetchCashflowSnapshotOutput = z.infer<typeof OutputSchema>;

export const fetchCashflowSnapshotTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_cashflow_snapshot',
  description:
    'Fetch the most recent successful CashFlow Agent run for this deal. ' +
    'Returns key proforma metrics: NOI (year 1), cap rate, IRR, min DSCR, collision counts, ' +
    'investment_rating, and the cashflow summary narrative. ' +
    'Call this BEFORE fetch_data_matrix so your narrative references the actual underwritten numbers. ' +
    'Returns found: false when no recent cashflow run exists for this deal.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  execute: async (input, ctx) => {
    const dealId = input.deal_id ?? ctx.dealId;
    if (!dealId) {
      return {
        found: false,
        deal_id: null,
        run_id: null,
        completed_at: null,
        noi_year1: null,
        cap_rate: null,
        irr: null,
        dscr_min: null,
        collision_counts: null,
        investment_rating: null,
        summary: null,
        note: 'No deal_id available — cashflow snapshot unavailable.',
      };
    }

    try {
      const maxAgeHours = input.max_age_hours ?? 72;
      const result = await query(
        `SELECT id, output, completed_at
         FROM agent_runs
         WHERE agent_id = 'cashflow'
           AND deal_id = $1
           AND status = 'succeeded'
           AND completed_at >= NOW() - ($2 || ' hours')::INTERVAL
         ORDER BY completed_at DESC
         LIMIT 1`,
        [dealId, String(maxAgeHours)]
      );

      if (result.rows.length === 0) {
        return {
          found: false,
          deal_id: dealId,
          run_id: null,
          completed_at: null,
          noi_year1: null,
          cap_rate: null,
          irr: null,
          dscr_min: null,
          collision_counts: null,
          investment_rating: null,
          summary: null,
          note: `No successful cashflow run found in the last ${maxAgeHours}h. Commentary will derive context from raw market data.`,
        };
      }

      const row = result.rows[0];
      const runOutput: Record<string, unknown> =
        typeof row.output === 'string' ? JSON.parse(row.output) : (row.output ?? {});

      // Extract key metrics from proforma_fields
      const proformaFields = (runOutput.proforma_fields ?? {}) as Record<string, { value: unknown }>;

      function extractNum(key: string): number | null {
        const field = proformaFields[key];
        if (!field) return null;
        const v = field.value;
        return v !== null && v !== undefined && !isNaN(Number(v)) ? Number(v) : null;
      }

      const noiYear1 = extractNum('revenue.noi') ?? extractNum('noi_year1') ?? extractNum('noi');
      const capRate  = extractNum('capital_structure.going_in_cap_rate') ?? extractNum('cap_rate');
      const irr      = extractNum('capital_structure.irr') ?? extractNum('irr');
      const dscrMin  = extractNum('capital_structure.dscr_min') ?? extractNum('dscr_min');

      const collisionSummary = runOutput.collision_summary as {
        minor_count?: number; material_count?: number; severe_count?: number;
      } | null | undefined;

      const collisionCounts = collisionSummary ? {
        minor: Number(collisionSummary.minor_count ?? 0),
        material: Number(collisionSummary.material_count ?? 0),
        severe: Number(collisionSummary.severe_count ?? 0),
      } : null;

      const investmentRating = (runOutput.investment_rating as string) ?? null;
      const summary = (runOutput.summary as string) ?? null;

      logger.debug('fetch_cashflow_snapshot: found record', {
        dealId, runId: row.id, noiYear1, capRate, irr,
      });

      return {
        found: true,
        deal_id: dealId,
        run_id: row.id as string,
        completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
        noi_year1: noiYear1,
        cap_rate: capRate,
        irr,
        dscr_min: dscrMin,
        collision_counts: collisionCounts,
        investment_rating: investmentRating,
        summary,
      };
    } catch (err) {
      logger.error('fetch_cashflow_snapshot: query error', {
        dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        found: false,
        deal_id: dealId,
        run_id: null,
        completed_at: null,
        noi_year1: null,
        cap_rate: null,
        irr: null,
        dscr_min: null,
        collision_counts: null,
        investment_rating: null,
        summary: null,
        note: 'Cashflow snapshot query failed — proceeding without cashflow context.',
      };
    }
  },
};
