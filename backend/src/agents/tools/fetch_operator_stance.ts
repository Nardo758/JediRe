/**
 * Agent Tool: fetch_operator_stance
 *
 * Loads the OperatorStance for the current deal and returns:
 *   1. The resolved stance (platform defaults if operator hasn't set one)
 *   2. The modulation deltas for each stance-aware field path
 *   3. The list of STANCE_MODULATION_RULES that are currently active
 *
 * WHEN TO CALL:
 *   Call this AFTER fetch_data_matrix and BEFORE writing any proforma_fields.
 *   The agent should use the returned deltas to adjust its derived values
 *   BEFORE calling write_underwriting. The tool auto-tags adjusted fields
 *   with stanceModulated=true and stanceTrace.
 *
 * CACHE-AWARE RE-BLEND (stanceOnly mode):
 *   When the agent is invoked with stanceOnly=true in the trigger context,
 *   it should call ONLY this tool, apply the modulation to the cached
 *   proforma_fields from the last snapshot, and call write_underwriting.
 *   No fetch_t12, fetch_rent_roll, fetch_data_matrix calls in stanceOnly mode.
 *
 * IDEMPOTENCY:
 *   Running with the same stance produces the same deltas. The tool is
 *   deterministic — given the same stance and base values, output is identical.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';
import {
  resolveStance,
  computeStanceDelta,
  buildStanceTrace,
  STANCE_MODULATED_FIELD_PATHS,
  STANCE_MODULATION_RULES,
  type OperatorStance,
} from '../../types/operator-stance';

const InputSchema = z.object({
  deal_id: z.string().uuid().describe('Deal UUID to fetch stance for'),
});

const StanceDeltaSchema = z.object({
  fieldPath: z.string(),
  deltaBps: z.number(),
  deltaDecimal: z.number().describe('deltaBps / 10000 — add this to the resolved decimal field value'),
  trace: z.string().describe('Human-readable trace for stanceTrace field'),
  firedRuleIds: z.array(z.string()),
});

const OutputSchema = z.object({
  stance: z.record(z.string(), z.unknown()).describe('The resolved OperatorStance for this deal'),
  defaulted: z.boolean().describe('True when operator has not set a stance — platform defaults in use'),
  deltas: z.array(StanceDeltaSchema).describe('Per-field modulation deltas to apply to derived values'),
  activeRuleIds: z.array(z.string()).describe('IDs of STANCE_MODULATION_RULES currently firing'),
  instructions: z.string().describe('How to apply these deltas to your proforma_fields before write_underwriting'),
});

export const fetchOperatorStanceTool: ToolDefinition = {
  name: 'fetch_operator_stance',
  description: `
Fetch the operator's underwriting stance for this deal. Call this AFTER fetch_data_matrix
and BEFORE computing final proforma_fields values.

The stance is the operator's macro/posture framing — it modulates how the agent exercises
discretion in the tier hierarchy. It is NOT a Tier 1/2/3 data source; it's a meta-layer
that adjusts blend weights and adds floors/ceilings AFTER tier resolution.

The returned \`deltas\` array tells you exactly how much to adjust each field (in bps).
Apply each delta by adding deltaDecimal to your resolved value:
  adjusted_value = resolved_value + delta.deltaDecimal

Then tag the field in proforma_fields before write_underwriting:
  field.stanceModulated = true
  field.stanceTrace = delta.trace

If defaulted=true, the operator has not set a stance — deltas will all be 0 (MARKET defaults
produce no adjustment). Proceed with your tier-resolved values unchanged.

If stanceOnly=true was passed in your trigger context, you are in a stance-only reblend
run. Load the last proforma_fields from deal_underwriting_snapshots, apply deltas, then
call write_underwriting. Do NOT call fetch_t12, fetch_data_matrix, or other data tools.
`.trim(),
  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  async execute(params: z.infer<typeof InputSchema>): Promise<z.infer<typeof OutputSchema>> {
    const { deal_id } = params;

    // Load raw stance from deals table
    const res = await query(
      `SELECT operator_stance FROM deals WHERE id = $1`,
      [deal_id],
    );
    if (res.rows.length === 0) {
      throw new Error(`Deal not found: ${deal_id}`);
    }

    const raw = res.rows[0].operator_stance;
    const stance: OperatorStance = resolveStance(raw);

    // Compute deltas for all stance-aware fields
    const deltas: z.infer<typeof StanceDeltaSchema>[] = [];
    const activeRuleIds = new Set<string>();

    for (const fieldPath of STANCE_MODULATED_FIELD_PATHS) {
      const { deltaBps, firedRules } = computeStanceDelta(stance, fieldPath);
      for (const r of firedRules) activeRuleIds.add(r.id);

      // Always include the field — even 0-delta entries tell the agent "no adjustment needed"
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
      defaulted: stance.defaulted,
      underwritingPosture: stance.underwritingPosture,
      activeRules: [...activeRuleIds],
      fieldsWithDelta: deltas.filter(d => d.deltaBps !== 0).map(d => d.fieldPath),
    });

    const instructions = stance.defaulted
      ? 'Stance is at MARKET defaults. No adjustments needed — proceed with tier-resolved values.'
      : [
          'Apply each non-zero delta to your resolved value before write_underwriting:',
          '  field.value = Math.max(0, resolved_value + delta.deltaDecimal)',
          '  field.stanceModulated = true',
          '  field.stanceTrace = delta.trace',
          '',
          `Active rules: ${[...activeRuleIds].join(', ') || 'none'}`,
          `Net adjustments: ${deltas.filter(d => d.deltaBps !== 0).map(d => `${d.fieldPath}=${d.deltaBps > 0 ? '+' : ''}${d.deltaBps}bps`).join(', ')}`,
        ].join('\n');

    return {
      stance: stance as Record<string, unknown>,
      defaulted: stance.defaulted,
      deltas,
      activeRuleIds: [...activeRuleIds],
      instructions,
    };
  },
};
