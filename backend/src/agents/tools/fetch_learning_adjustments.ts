/**
 * Tool: fetch_learning_adjustments
 *
 * Retrieves systematic bias corrections learned from historical deal outcomes.
 * The CashFlow Agent calls this early in the underwriting process to get
 * adjustments that should be applied to its assumptions.
 *
 * Example: If the platform has historically underestimated vacancy in Atlanta
 * Class B value-add deals by 8%, this tool returns an adjustment factor
 * that the agent applies to avoid repeating the same mistake.
 */

import { z } from 'zod';
import { getLearningAdjustments, applyLearningAdjustment } from '../../services/learning-feedback.service';
import { logger } from '../../utils/logger';

const InputSchema = z.object({
  state: z.string().optional().describe('State code (e.g. "GA", "TX")'),
  msa: z.string().optional().describe('MSA name'),
  asset_class: z.string().optional().describe('Asset class (A, B, C)'),
  deal_type: z.string().optional().describe('Deal type: existing | value-add | lease-up'),
  assumption_names: z.array(z.string()).optional().describe(
    'Specific assumptions to get adjustments for (e.g. ["vacancy_pct", "opex_per_unit"]). If omitted, returns all applicable adjustments.'
  ),
});

const AdjustmentSchema = z.object({
  assumption_name: z.string(),
  adjustment_type: z.string(),
  adjustment_value: z.number(),
  adjustment_direction: z.string(),
  n_deals: z.number(),
  mean_gap_pct: z.number(),
  confidence: z.number(),
  bucket: z.object({
    state: z.string().nullable(),
    msa: z.string().nullable(),
    asset_class: z.string().nullable(),
    deal_type: z.string().nullable(),
  }),
  explanation: z.string(),
});

const OutputSchema = z.object({
  found: z.boolean(),
  adjustments: z.array(AdjustmentSchema),
  summary: z.string(),
  note: z.string().optional(),
});

export const fetchLearningAdjustmentsTool = {
  name: 'fetch_learning_adjustments',
  description:
    'Retrieves learned bias corrections from historical deal outcomes. Call early in underwriting ' +
    'to get adjustment factors that correct for systematic over/underestimation. Each adjustment ' +
    'includes confidence level and the number of deals it was learned from. Apply these corrections ' +
    'to your assumptions before writing to proforma_fields.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  async execute(input: z.infer<typeof InputSchema>) {
    try {
      const adjustments = await getLearningAdjustments({
        state: input.state,
        msa: input.msa,
        assetClass: input.asset_class,
        dealType: input.deal_type,
        assumptionNames: input.assumption_names,
      });

      if (adjustments.length === 0) {
        return {
          found: false,
          adjustments: [],
          summary: 'No learning adjustments available for this context. Use benchmark data without historical correction.',
          note: 'This is normal for new markets or deal types with limited historical data.',
        };
      }

      const formattedAdjustments = adjustments.map(adj => {
        const directionWord = adj.adjustmentDirection === 'increase' ? 'higher' : 'lower';
        const biasWord = adj.adjustmentDirection === 'increase' ? 'underestimated' : 'overestimated';
        const pctValue = (adj.adjustmentValue * 100).toFixed(1);
        
        return {
          assumption_name: adj.assumptionName,
          adjustment_type: adj.adjustmentType,
          adjustment_value: adj.adjustmentValue,
          adjustment_direction: adj.adjustmentDirection,
          n_deals: adj.nDeals,
          mean_gap_pct: adj.meanGapPct,
          confidence: adj.confidence,
          bucket: {
            state: adj.state ?? null,
            msa: adj.msa ?? null,
            asset_class: adj.assetClass ?? null,
            deal_type: adj.dealType ?? null,
          },
          explanation: `Historically ${biasWord} by ${Math.abs(adj.meanGapPct).toFixed(1)}% across ${adj.nDeals} deals. ` +
            `Apply ${pctValue}% ${directionWord} adjustment (confidence: ${(adj.confidence * 100).toFixed(0)}%).`,
        };
      });

      // Generate summary
      const increaseCount = adjustments.filter(a => a.adjustmentDirection === 'increase').length;
      const decreaseCount = adjustments.filter(a => a.adjustmentDirection === 'decrease').length;
      const highConfidence = adjustments.filter(a => a.confidence > 0.7).length;

      let summary = `Found ${adjustments.length} learning adjustments for this context. `;
      if (increaseCount > 0) summary += `${increaseCount} suggest increasing assumptions (historical underestimation). `;
      if (decreaseCount > 0) summary += `${decreaseCount} suggest decreasing assumptions (historical overestimation). `;
      if (highConfidence > 0) summary += `${highConfidence} are high-confidence (70%+).`;

      logger.debug('fetch_learning_adjustments: completed', {
        context: input,
        adjustmentsFound: adjustments.length,
      });

      return {
        found: true,
        adjustments: formattedAdjustments,
        summary,
      };

    } catch (err) {
      logger.error('fetch_learning_adjustments: query error', {
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        found: false,
        adjustments: [],
        summary: 'Learning adjustment query failed.',
        note: 'Proceeding without historical correction. Use benchmark data as-is.',
      };
    }
  },
};

/**
 * Helper function for the agent to apply an adjustment
 * Can be called programmatically, not as a tool
 */
export function applyAdjustment(
  value: number,
  adjustment: z.infer<typeof AdjustmentSchema>
): { adjustedValue: number; adjustmentNote: string } {
  return applyLearningAdjustment(value, {
    assumptionName: adjustment.assumption_name,
    adjustmentType: adjustment.adjustment_type as 'additive_bps' | 'multiplicative',
    adjustmentValue: adjustment.adjustment_value,
    adjustmentDirection: adjustment.adjustment_direction as 'increase' | 'decrease',
    nDeals: adjustment.n_deals,
    meanGapPct: adjustment.mean_gap_pct,
    confidence: adjustment.confidence,
  });
}
