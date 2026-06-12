/**
 * Tool: fetch_supply_analysis
 *
 * Reads the most recent supply analysis for the current deal from the
 * supply_analyses table. Used by the CashFlow agent to incorporate Supply
 * agent outputs (delivery_risk, pipeline_units, absorption_rate) into
 * proforma evidence chains — specifically revenue.rent_growth and
 * risk_adjustments — without re-running the Supply agent.
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
});

const OutputSchema = z.object({
  found: z.boolean(),
  deal_id: z.string().nullable(),
  pipeline_units: z.number().int().nullable(),
  delivery_risk: z.enum(['low', 'medium', 'high']).nullable(),
  yoy_pct: z.number().nullable(),
  peak_delivery_year: z.number().int().nullable(),
  top_developments: z.array(z.unknown()).nullable(),
  summary: z.string().nullable(),
  updated_at: z.string().nullable(),
  note: z.string().optional(),
});

export type FetchSupplyAnalysisOutput = z.infer<typeof OutputSchema>;

export const fetchSupplyAnalysisTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_supply_analysis',
  description:
    'Fetch the most recent Supply Agent analysis for this deal. Returns pipeline_units, ' +
    'delivery_risk (low/medium/high), yoy_pct, peak_delivery_year, top_developments, and summary. ' +
    'Call early in the run — before compute_proforma — and incorporate delivery_risk into ' +
    'revenue.rent_growth and risk_adjustments evidence chains. ' +
    'Returns found: false when no supply analysis has been run for this deal yet.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  execute: async (input, ctx) => {
    const dealId = input.deal_id ?? ctx.dealId;
    if (!dealId) {
      return {
        found: false,
        deal_id: null,
        pipeline_units: null,
        delivery_risk: null,
        yoy_pct: null,
        peak_delivery_year: null,
        top_developments: null,
        summary: null,
        updated_at: null,
        note: 'No deal_id available — supply context unavailable.',
      };
    }

    try {
      const result = await query(
        `SELECT pipeline_units, delivery_risk, yoy_pct, peak_delivery_year,
                top_developments, summary, updated_at
         FROM supply_analyses
         WHERE deal_id = $1
         ORDER BY updated_at DESC
         LIMIT 1`,
        [dealId]
      );

      if (result.rows.length === 0) {
        return {
          found: false,
          deal_id: dealId,
          pipeline_units: null,
          delivery_risk: null,
          yoy_pct: null,
          peak_delivery_year: null,
          top_developments: null,
          summary: null,
          updated_at: null,
          note: 'No supply analysis found for this deal. Run the Supply Agent first, or proceed with conservative rent_growth assumptions.',
        };
      }

      const row = result.rows[0];
      const topDevs = Array.isArray(row.top_developments)
        ? row.top_developments
        : (row.top_developments ? [row.top_developments] : null);

      logger.debug('fetch_supply_analysis: found record', { dealId, delivery_risk: row.delivery_risk });

      return {
        found: true,
        deal_id: dealId,
        pipeline_units: row.pipeline_units !== null ? Number(row.pipeline_units) : null,
        delivery_risk: (row.delivery_risk as 'low' | 'medium' | 'high') ?? null,
        yoy_pct: row.yoy_pct !== null ? Number(row.yoy_pct) : null,
        peak_delivery_year: row.peak_delivery_year !== null ? Number(row.peak_delivery_year) : null,
        top_developments: topDevs,
        summary: row.summary ?? null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      };
    } catch (err) {
      logger.error('fetch_supply_analysis: query error', {
        dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        found: false,
        deal_id: dealId,
        pipeline_units: null,
        delivery_risk: null,
        yoy_pct: null,
        peak_delivery_year: null,
        top_developments: null,
        summary: null,
        updated_at: null,
        note: 'Supply analysis query failed — proceeding without supply context.',
      };
    }
  },
};
