/**
 * Tool: write_projection
 *
 * Persists cashflow projection results (NOI, IRR, yield, breakeven)
 * to the cashflow_projections table for a given deal.
 *
 * Required capability: write:deal_context
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  year1_noi: z.number().optional().describe(
    'Year 1 Net Operating Income in dollars'
  ),
  stabilized_yield_pct: z.number().optional().describe(
    'Stabilized yield as a percentage (e.g. 5.25 for 5.25%)'
  ),
  five_yr_irr: z.number().optional().describe(
    'Projected 5-year Internal Rate of Return as a percentage'
  ),
  breakeven_occupancy: z.number().optional().describe(
    'Occupancy rate required to cover debt service, as a percentage'
  ),
  assumptions: z.record(z.string(), z.unknown()).optional().describe(
    'Key modeling assumptions (rent growth, vacancy, cap rate, hold period, etc.)'
  ),
  summary: z.string().optional().describe(
    'Narrative summary of the cashflow projection findings'
  ),
});

const OutputSchema = z.object({
  stored: z.boolean(),
  deal_id: z.string().nullable(),
});

export const writeProjectionTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'write_projection',
  description:
    'Persist a structured cashflow projection record to the cashflow_projections table. ' +
    'Accepts year1_noi, stabilized_yield_pct, five_yr_irr, breakeven_occupancy, ' +
    'assumptions, and summary. All fields are optional and merged via upsert on deal_id.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'write:deal_context',

  execute: async (input, ctx) => {
    if (!ctx.dealId) {
      logger.warn('write_projection: no dealId — skipping');
      return { stored: false, deal_id: null };
    }

    try {
      await query(
        `INSERT INTO cashflow_projections
           (deal_id, agent_run_id, year1_noi, stabilized_yield_pct, five_yr_irr,
            breakeven_occupancy, assumptions, summary, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())
         ON CONFLICT (deal_id)
         DO UPDATE SET
           agent_run_id          = EXCLUDED.agent_run_id,
           year1_noi             = COALESCE(EXCLUDED.year1_noi,             cashflow_projections.year1_noi),
           stabilized_yield_pct  = COALESCE(EXCLUDED.stabilized_yield_pct,  cashflow_projections.stabilized_yield_pct),
           five_yr_irr           = COALESCE(EXCLUDED.five_yr_irr,           cashflow_projections.five_yr_irr),
           breakeven_occupancy   = COALESCE(EXCLUDED.breakeven_occupancy,   cashflow_projections.breakeven_occupancy),
           assumptions           = COALESCE(EXCLUDED.assumptions,           cashflow_projections.assumptions),
           summary               = COALESCE(EXCLUDED.summary,               cashflow_projections.summary),
           updated_at            = NOW()`,
        [
          ctx.dealId,
          ctx.correlationId ?? null,
          input.year1_noi ?? null,
          input.stabilized_yield_pct ?? null,
          input.five_yr_irr ?? null,
          input.breakeven_occupancy ?? null,
          input.assumptions !== undefined ? JSON.stringify(input.assumptions) : null,
          input.summary ?? null,
        ]
      );
      return { stored: true, deal_id: ctx.dealId };
    } catch (err) {
      logger.error('write_projection: DB write failed', {
        dealId: ctx.dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return { stored: false, deal_id: ctx.dealId };
    }
  },
};
