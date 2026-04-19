/**
 * Tool: write_projection
 *
 * Persists cashflow projection results (NOI, IRR, cash-on-cash, DSCR)
 * to the deal_context_fields table for a given deal.
 *
 * Required capability: write:deal_context
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  field_path: z.string().describe(
    'Dot-separated path within cashflow context, e.g. "cashflow.irr_pct"'
  ),
  value: z.unknown().describe('Value to store at the field path'),
  source_label: z.string().optional().describe('Data source label, e.g. "compute_proforma"'),
});

const OutputSchema = z.object({
  stored: z.boolean(),
  field_path: z.string(),
  deal_id: z.string().nullable(),
});

export const writeProjectionTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'write_projection',
  description:
    'Persist a cashflow projection field to the deal context store. ' +
    'Use for cashflow.* field paths: irr_pct, avg_cash_on_cash_pct, year1_cap_rate_pct, ' +
    'dscr_year1, noi_year1, equity_invested, exit_value, annual_debt_service.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'write:deal_context',

  execute: async (input, ctx) => {
    if (!ctx.dealId) {
      logger.warn('write_projection: no dealId — skipping');
      return { stored: false, field_path: input.field_path, deal_id: null };
    }

    try {
      await query(
        `INSERT INTO deal_context_fields
           (deal_id, field_path, value, source_label, agent_run_id, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
         ON CONFLICT (deal_id, field_path)
         DO UPDATE SET
           value        = EXCLUDED.value,
           source_label = EXCLUDED.source_label,
           agent_run_id = EXCLUDED.agent_run_id,
           updated_at   = NOW()`,
        [
          ctx.dealId,
          input.field_path,
          JSON.stringify(input.value),
          input.source_label ?? 'cashflow_agent',
          ctx.correlationId ?? null,
        ]
      );
      return { stored: true, field_path: input.field_path, deal_id: ctx.dealId };
    } catch (err) {
      logger.error('write_projection: DB write failed', {
        dealId: ctx.dealId,
        fieldPath: input.field_path,
        err: err instanceof Error ? err.message : String(err),
      });
      return { stored: false, field_path: input.field_path, deal_id: ctx.dealId };
    }
  },
};
