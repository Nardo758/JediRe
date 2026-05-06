/**
 * Agent Tool: fetch_operator_stance
 *
 * Loads the OperatorStance for the current deal and returns:
 *   1. The resolved stance (platform defaults if operator hasn't set one)
 *   2. The modulation deltas for each stance-aware field path (informational)
 *   3. The list of STANCE_MODULATION_RULES that are currently active
 *
 * ENFORCEMENT MODEL:
 *   The backend (cashflow.postprocess.ts) applies stance modulation deterministically
 *   after the agent run, regardless of what values the agent writes. The agent
 *   MUST write raw tier-resolved values and MUST NOT pre-apply stance deltas.
 *
 *   This tool is INFORMATIONAL — it tells the agent what adjustments will be made
 *   post-run so it can provide accurate reasoning notes. The agent does not need
 *   to apply the deltas itself.
 *
 * AUTHORIZATION:
 *   Scoped to the authenticated user via ctx.userId + deal ownership check.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition, RunContext } from '../runtime/types';
import {
  resolveStance,
  computeStanceDelta,
  buildStanceTrace,
  STANCE_MODULATED_FIELD_PATHS,
  type OperatorStance,
} from '../../types/operator-stance';

const InputSchema = z.object({
  deal_id: z.string().uuid().describe('Deal UUID to fetch stance for'),
});

const StanceDeltaSchema = z.object({
  fieldPath: z.string(),
  deltaBps: z.number(),
  deltaDecimal: z.number().describe('deltaBps / 10000 — the decimal adjustment that will be applied post-run'),
  trace: z.string().describe('Human-readable trace for stanceTrace field'),
  firedRuleIds: z.array(z.string()),
});

const OutputSchema = z.object({
  stance: z.record(z.string(), z.unknown()).describe('The resolved OperatorStance for this deal'),
  defaulted: z.boolean().describe('True when operator has not set a stance — platform defaults in use'),
  deltas: z.array(StanceDeltaSchema).describe('Per-field modulation deltas that WILL be applied by the backend post-run'),
  activeRuleIds: z.array(z.string()).describe('IDs of STANCE_MODULATION_RULES currently firing'),
  note: z.string().describe('Instruction for how to use this information in your reasoning'),
});

export const fetchOperatorStanceTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_operator_stance',
  description: `
Fetch the operator's underwriting stance for this deal. Call this AFTER fetch_data_matrix
to understand the operator's macro framing before writing proforma_fields.

IMPORTANT — read carefully:
  • The backend AUTOMATICALLY applies stance modulation after your run completes.
  • You MUST write raw, tier-resolved values to write_underwriting — do NOT pre-apply deltas.
  • The \`deltas\` array shows what the backend WILL apply — use it for reasoning notes only.

For each stance-aware field in your reasoning, note the posture and what will happen:
  "Tier-resolved rentGrowth: 3.0%. Operator stance (CONSERVATIVE) will apply -25bps
   post-enforcement → effective 2.75%."

If defaulted=true, the operator has not set a stance — your tier-resolved values are used as-is.
`.trim(),
  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  execute: async (input: z.infer<typeof InputSchema>, ctx: RunContext): Promise<z.infer<typeof OutputSchema>> => {
    const { deal_id } = input;

    // ── Authorization: verify deal ownership via authenticated user ────────────
    // ctx.userId is set by AgentRuntime from the triggering user's session.
    // If not set (e.g. system trigger), fall back to deal existence check only.
    let res;
    if (ctx.userId) {
      res = await query(
        `SELECT operator_stance FROM deals WHERE id = $1 AND user_id = $2`,
        [deal_id, ctx.userId],
      );
      if (res.rows.length === 0) {
        throw new Error(`Deal not found or not accessible: ${deal_id}`);
      }
    } else {
      res = await query(
        `SELECT operator_stance FROM deals WHERE id = $1`,
        [deal_id],
      );
      if (res.rows.length === 0) {
        throw new Error(`Deal not found: ${deal_id}`);
      }
    }

    const raw = res.rows[0].operator_stance;
    const stance: OperatorStance = resolveStance(raw);

    // Compute deltas for all stance-aware fields (informational — backend will apply)
    const deltas: z.infer<typeof StanceDeltaSchema>[] = [];
    const activeRuleIds = new Set<string>();

    for (const fieldPath of STANCE_MODULATED_FIELD_PATHS) {
      const { deltaBps, firedRules } = computeStanceDelta(stance, fieldPath);
      for (const r of firedRules) activeRuleIds.add(r.id);

      deltas.push({
        fieldPath,
        deltaBps,
        deltaDecimal: deltaBps / 10000,
        trace: deltaBps !== 0
          ? buildStanceTrace(stance, fieldPath, deltaBps, firedRules)
          : 'no stance adjustment — MARKET defaults',
        firedRuleIds: firedRules.map(r => r.id),
      });
    }

    logger.info('[fetch_operator_stance] resolved', {
      dealId: deal_id,
      userId: ctx.userId ?? 'system',
      defaulted: stance.defaulted,
      underwritingPosture: stance.underwritingPosture,
      activeRules: [...activeRuleIds],
      fieldsWithDelta: deltas.filter(d => d.deltaBps !== 0).map(d => d.fieldPath),
    });

    const note = stance.defaulted
      ? 'Stance is at MARKET defaults — no adjustments will be applied. Write raw tier-resolved values.'
      : [
          'The backend will apply the following adjustments AFTER your run:',
          deltas
            .filter(d => d.deltaBps !== 0)
            .map(d => `  ${d.fieldPath}: ${d.deltaBps > 0 ? '+' : ''}${d.deltaBps}bps (${d.trace})`)
            .join('\n'),
          '',
          'Write raw tier-resolved values to write_underwriting. Do NOT apply these deltas yourself.',
          'In your reasoning, note: "Tier-resolved: X. Operator stance will apply Ybps → effective Z post-enforcement."',
        ].join('\n');

    return {
      stance: stance as Record<string, unknown>,
      defaulted: stance.defaulted,
      deltas,
      activeRuleIds: [...activeRuleIds],
      note,
    };
  },
};
