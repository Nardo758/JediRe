/**
 * Sigma (M36) Tool: goal_seek_target_irr
 *
 * Given a target IRR and current deal assumptions, find the least-aggressive
 * assumption set (lowest Mahalanobis d) that hits the target, across all
 * available debt bundles.
 *
 * Called by CashFlow Agent when the user says "solve for X% IRR".
 * Can lock specific variables the user doesn't want changed.
 *
 * Output includes: per-bundle ranking, recommended bundle, deltas from
 * current values, narrative explanation.
 */

import { z } from 'zod';
import { goalSeek, VARIABLE_META } from '../../services/sigma/sigma-engine';
import { logger } from '../../utils/logger';

const InputSchema = z.object({
  targetIrR: z.number().min(0.01).max(0.50).describe(
    'Target IRR as decimal (e.g., 0.15 for 15%)'
  ),
  holdYears: z.number().int().min(1).max(15).describe(
    'Holding period in years'
  ),
  currentAssumptions: z.record(z.number()).optional().default({}).describe(
    'Current deal assumptions to start from'
  ),
  lockVariables: z.array(z.string()).optional().default([]).describe(
    'Variable keys the user wants to keep fixed'
  ),
  bundleFilter: z.array(z.string()).optional().default([]).describe(
    'Restrict to specific bundle IDs; empty = all bundles'
  ),
});

const BundleRankingSchema = z.object({
  bundle: z.string(),
  bundleName: z.string(),
  baseIrR: z.number().describe('IRR without assumption changes'),
  achievedIrR: z.number().describe('IRR after solver adjustments'),
  dScore: z.number(),
  band: z.string(),
  changedVars: z.array(z.object({
    key: z.string(),
    before: z.number(),
    after: z.number(),
  })),
  narrative: z.string(),
});

const OutputSchema = z.object({
  targetIrR: z.number(),
  holdYears: z.number(),
  results: z.array(BundleRankingSchema),
  recommendation: z.object({
    bundle: z.string(),
    bundleName: z.string(),
    dScore: z.number(),
    band: z.string(),
    achievedIrR: z.number(),
    narrative: z.string(),
  }).nullable(),
  bundlesEvaluated: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })),
});

export type GoalSeekTargetIrrInput = z.infer<typeof InputSchema>;
export type GoalSeekTargetIrrOutput = z.infer<typeof OutputSchema>;

export async function goalSeekTargetIrr(
  input: GoalSeekTargetIrrInput
): Promise<GoalSeekTargetIrrOutput> {
  logger.info('[goal_seek_target_irr] Running goal seek', {
    targetIrR: input.targetIrR,
    holdYears: input.holdYears,
    lockVariables: input.lockVariables,
    bundleFilter: input.bundleFilter,
  });

  const result = goalSeek(
    input.targetIrR,
    input.holdYears,
    input.currentAssumptions,
    {
      lockedVariables: input.lockVariables,
      bundleFilter: input.bundleFilter,
    }
  );

  return {
    targetIrR: result.targetIrR,
    holdYears: result.holdYears,
    results: result.results.map(r => ({
      bundle: r.bundle.id,
      bundleName: r.bundle.name,
      baseIrR: r.baseIrR,
      achievedIrR: r.achievedIrR,
      dScore: r.dScore,
      band: r.band,
      changedVars: r.changedVars.map(c => ({ key: c.key, before: c.before, after: c.after })),
      narrative: r.narrative,
    })),
    recommendation: result.recommendation ? {
      bundle: result.recommendation.bundle.id,
      bundleName: result.recommendation.bundle.name,
      dScore: result.recommendation.dScore,
      band: result.recommendation.band,
      achievedIrR: result.recommendation.achievedIrR,
      narrative: result.recommendation.narrative,
    } : null,
    bundlesEvaluated: result.bundlesEvaluated,
  };
}

export const goalSeekTargetIrrTool = {
  name: 'goal_seek_target_irr',
  description: `Solve for a target IRR across available debt bundles.
For each debt product (HUD 221(d)(4), Agency Fixed, Agency Floating, Bridge, CMBS),
finds the lowest-plausibility assumption adjustment that achieves the target IRR.
Returns ranked results sorted by d-score (least aggressive first).

Use when the user asks "solve for X% IRR" or "what assumptions get me to Y% return".

Input: { "targetIrR": 0.15, "holdYears": 5, "currentAssumptions": {...}, "lockVariables": ["exitCapRate"], "bundleFilter": ["agency_fixed", "hud_221d4"] }`,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: goalSeekTargetIrr,
};
