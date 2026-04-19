/**
 * Tool: write_supply_analysis
 *
 * Persists supply analysis findings (pipeline, deliveries, absorption)
 * to the supply_analyses table for a given deal.
 *
 * Required capability: write:deal_context
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  pipeline_units: z.number().int().optional().describe(
    'Total units currently in the construction pipeline for the submarket'
  ),
  delivery_risk: z.enum(['low', 'medium', 'high']).optional().describe(
    'Overall delivery risk level based on pipeline vs. absorption'
  ),
  yoy_pct: z.number().optional().describe(
    'Year-over-year percentage change in supply pipeline'
  ),
  peak_delivery_year: z.number().int().optional().describe(
    'Calendar year with the highest projected unit deliveries'
  ),
  top_developments: z.array(z.unknown()).optional().describe(
    'List of notable pipeline development objects (name, units, est_delivery, etc.)'
  ),
  summary: z.string().optional().describe(
    'Narrative summary of the supply analysis findings'
  ),
});

const OutputSchema = z.object({
  stored: z.boolean(),
  deal_id: z.string().nullable(),
});

export const writeSupplyAnalysisTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'write_supply_analysis',
  description:
    'Persist a structured supply analysis record to the supply_analyses table. ' +
    'Accepts pipeline_units, delivery_risk (low/medium/high), yoy_pct, ' +
    'peak_delivery_year, top_developments, and summary. All fields are optional ' +
    'and merged via upsert on deal_id.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'write:deal_context',

  execute: async (input, ctx) => {
    if (!ctx.dealId) {
      logger.warn('write_supply_analysis: no dealId — skipping');
      return { stored: false, deal_id: null };
    }

    try {
      await query(
        `INSERT INTO supply_analyses
           (deal_id, agent_run_id, pipeline_units, delivery_risk, yoy_pct,
            peak_delivery_year, top_developments, summary, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())
         ON CONFLICT (deal_id)
         DO UPDATE SET
           agent_run_id       = EXCLUDED.agent_run_id,
           pipeline_units     = COALESCE(EXCLUDED.pipeline_units,     supply_analyses.pipeline_units),
           delivery_risk      = COALESCE(EXCLUDED.delivery_risk,      supply_analyses.delivery_risk),
           yoy_pct            = COALESCE(EXCLUDED.yoy_pct,            supply_analyses.yoy_pct),
           peak_delivery_year = COALESCE(EXCLUDED.peak_delivery_year, supply_analyses.peak_delivery_year),
           top_developments   = COALESCE(EXCLUDED.top_developments,   supply_analyses.top_developments),
           summary            = COALESCE(EXCLUDED.summary,            supply_analyses.summary),
           updated_at         = NOW()`,
        [
          ctx.dealId,
          ctx.correlationId ?? null,
          input.pipeline_units ?? null,
          input.delivery_risk ?? null,
          input.yoy_pct ?? null,
          input.peak_delivery_year ?? null,
          input.top_developments !== undefined ? JSON.stringify(input.top_developments) : null,
          input.summary ?? null,
        ]
      );
      return { stored: true, deal_id: ctx.dealId };
    } catch (err) {
      logger.error('write_supply_analysis: DB write failed', {
        dealId: ctx.dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return { stored: false, deal_id: ctx.dealId };
    }
  },
};
