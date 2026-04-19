/**
 * Tool: write_zoning_analysis
 *
 * Persists structured zoning analysis findings to the zoning_analyses table.
 * One row per (deal_id, agent_run_id) — upsert-safe via ON CONFLICT.
 *
 * Required capability: write:zoning_analysis
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  zoning_code: z.string().describe('Current zoning classification'),
  zoning_description: z.string().optional().describe('Human-readable zoning name'),
  permitted_uses: z.array(z.string()).default([]).describe('List of by-right permitted uses'),
  max_far: z.number().nullable().optional().describe('Maximum floor-area ratio'),
  max_height_ft: z.number().nullable().optional().describe('Height limit in feet'),
  max_gfa_sqft: z.number().nullable().optional().describe('Max buildable GFA in sq ft from compute_envelope'),
  est_max_units: z.number().nullable().optional().describe('Estimated max unit count'),
  entitlement_risk: z.enum(['low', 'medium', 'high']).optional().describe('Entitlement risk level'),
  summary: z.string().describe('1-3 sentence zoning analysis summary'),
});

const OutputSchema = z.object({
  stored: z.boolean(),
  deal_id: z.string().nullable(),
  zoning_code: z.string(),
});

export const writeZoningAnalysisTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'write_zoning_analysis',
  description:
    'Persist structured zoning analysis results (code, FAR, height limit, max GFA, unit capacity, ' +
    'entitlement risk) to the database for this deal. Call after all zoning computations are complete.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'write:zoning_analysis',

  execute: async (input, ctx) => {
    if (!ctx.dealId) {
      logger.warn('write_zoning_analysis: no dealId in context — skipping persist');
      return { stored: false, deal_id: null, zoning_code: input.zoning_code };
    }

    try {
      await query(
        `INSERT INTO zoning_analyses
           (deal_id, agent_run_id, zoning_code, zoning_description,
            permitted_uses, max_far, max_height_ft, max_gfa_sqft,
            est_max_units, entitlement_risk, summary, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
         ON CONFLICT (deal_id)
         DO UPDATE SET
           agent_run_id       = EXCLUDED.agent_run_id,
           zoning_code        = EXCLUDED.zoning_code,
           zoning_description = EXCLUDED.zoning_description,
           permitted_uses     = EXCLUDED.permitted_uses,
           max_far            = EXCLUDED.max_far,
           max_height_ft      = EXCLUDED.max_height_ft,
           max_gfa_sqft       = EXCLUDED.max_gfa_sqft,
           est_max_units      = EXCLUDED.est_max_units,
           entitlement_risk   = EXCLUDED.entitlement_risk,
           summary            = EXCLUDED.summary,
           updated_at         = NOW()`,
        [
          ctx.dealId,
          ctx.correlationId ?? null,
          input.zoning_code,
          input.zoning_description ?? null,
          JSON.stringify(input.permitted_uses),
          input.max_far ?? null,
          input.max_height_ft ?? null,
          input.max_gfa_sqft ?? null,
          input.est_max_units ?? null,
          input.entitlement_risk ?? null,
          input.summary,
        ]
      );

      logger.info('write_zoning_analysis: stored', { dealId: ctx.dealId, code: input.zoning_code });
      return { stored: true, deal_id: ctx.dealId, zoning_code: input.zoning_code };
    } catch (err) {
      logger.error('write_zoning_analysis: DB write failed', {
        dealId: ctx.dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return { stored: false, deal_id: ctx.dealId, zoning_code: input.zoning_code };
    }
  },
};
