/**
 * Sigma (M36) Tool: evaluate_plausibility
 *
 * Scores an assumption set for plausibility using Mahalanobis distance.
 * Called by CashFlow Agent to verify assumptions are within market norms.
 * 
 * Returns: d-score, band (Realistic/Stretch/Aggressive/Heroic/Unrealistic),
 * per-variable contributions, and top 5 contributors.
 */

import { z } from 'zod';
import { computePlausibility } from '../../services/sigma/sigma-engine';
import { logger } from '../../utils/logger';

const InputSchema = z.object({
  assumptions: z.record(z.number()).describe(
    'Assumption vector as key→value map (e.g., { goingInCapRate: 0.065, rentGrowthStabilized: 0.03 })'
  ),
});

const OutputSchema = z.object({
  mahalanobisD: z.number(),
  band: z.string(),
  nVariables: z.number(),
  topContributors: z.array(z.object({
    variable: z.string(),
    contribution: z.number(),
  })),
});

export type EvaluatePlausibilityInput = z.infer<typeof InputSchema>;
export type EvaluatePlausibilityOutput = z.infer<typeof OutputSchema>;

export async function evaluatePlausibility(
  input: EvaluatePlausibilityInput
): Promise<EvaluatePlausibilityOutput> {
  logger.info('[evaluate_plausibility] Scoring assumption set', {
    nVariables: Object.keys(input.assumptions).length,
  });

  const result = computePlausibility(input.assumptions);

  return {
    mahalanobisD: parseFloat(result.dScore.toFixed(3)),
    band: result.band,
    nVariables: Object.keys(result.contributions).length,
    topContributors: result.topContributors,
  };
}

export const evaluatePlausibilityTool = {
  name: 'evaluate_plausibility',
  description: `Score an assumption set for underwriting plausibility using Mahalanobis distance.
Returns a d-score and band:
  d ≤ 1.0 = Realistic (within 1σ of historical center)
  d 1.0-1.5 = Stretch (requires some favorable conditions)
  d 1.5-2.0 = Aggressive (requires specific execution)
  d 2.0-3.0 = Heroic (unlikely without exceptional conditions)
  d > 3.0 = Unrealistic (outside any defensible range)
Also returns per-variable contribution for explainability.

Use this to validate that assumptions are within defensible ranges
before committing them to the proforma.

Input: { "assumptions": { "goingInCapRate": 0.065, ... } }`,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: evaluatePlausibility,
};
