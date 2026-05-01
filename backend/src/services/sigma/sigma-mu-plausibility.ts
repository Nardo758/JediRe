/**
 * M36 Sigma Engine — Macro-Anchored Plausibility Extension
 *
 * Extension to sigma-engine.ts that overrides static VARIABLE_META[].prior
 * with dynamically-computed macro-anchored μ for plausibility scoring.
 *
 * Usage:
 *   import { computeDynamicPlausibility, solveWithDynamicMu } from './sigma-mu-plausibility';
 *
 *   // Returns PlausibilityResult but with μ dynamically composed
 *   const result = await computeDynamicPlausibility(assumptions, dealEmpiricalMeans);
 */

import { 
  computePlausibility as staticPlausibility,
  computeSimplifiedIrR,
  goalSeek as staticGoalSeek,
  VARIABLE_META,
  type AssumptionVector,
  type PlausibilityResult,
  type GoalSeekResult,
  type SolverConstraints,
} from './sigma-engine';
import { composeMu, composeAllAnchoredMu } from './mu-composer';
import { logger } from '../../utils/logger';

// ─── Dynamic Prior Resolution ────────────────────────────────────────────────

/**
 * Resolve a dynamic prior for a metric.
 *
 * For anchored metrics: μ = w_emp·μ_emp + (1-w_emp)·μ_macro (from composer)
 * For non-anchored: μ = fallbackPrior (original VARIABLE_META value)
 *
 * @param metric       - sigma-engine metric key
 * @param muEmpirical  - empirical mean from deal data/market (fallback = VARIABLE_META.prior)
 * @param metricStd    - standard deviation (from VARIABLE_META)
 * @returns            - { prior: number, std: number, breakdown }
 */
export async function resolveDynamicPrior(
  metric: string,
  muEmpirical?: number,
  metricStd?: number
): Promise<{
  prior: number;
  std: number;
  isAnchored: boolean;
}> {
  const meta = VARIABLE_META[metric];
  if (!meta) {
    return { prior: 0, std: 1, isAnchored: false };
  }

  const emp = muEmpirical ?? meta.prior;
  const std = metricStd ?? meta.std;

  try {
    const breakdown = await composeMu(metric, emp, std);
    return {
      prior: breakdown.finalMu,
      std,
      isAnchored: breakdown.isAnchored,
    };
  } catch {
    return { prior: meta.prior, std, isAnchored: false };
  }
}

/**
 * Resolve dynamic priors for an entire assumption vector.
 * Returns a map of metric → { prior, std, isAnchored }.
 */
export async function resolveAllDynamicPriors(
  empiricalMeans: Map<string, { mean: number; std: number }> | Record<string, { mean: number; std: number }>
): Promise<Map<string, { prior: number; std: number; isAnchored: boolean }>> {
  const map = empiricalMeans instanceof Map
    ? empiricalMeans
    : new Map(Object.entries(empiricalMeans));

  const result = new Map<string, { prior: number; std: number; isAnchored: boolean }>();

  for (const [metric, meta] of Object.entries(VARIABLE_META)) {
    const emp = map.get(metric);
    const prior = await resolveDynamicPrior(metric, emp?.mean, meta.std);
    result.set(metric, prior);
  }

  return result;
}

// ─── Dynamic Plausibility ────────────────────────────────────────────────────

/**
 * Compute plausibility with macro-anchored μ.
 *
 * @param assumptions    - assumption vector to score
 * @param empiricalMeans - empirical means from deal data (optional, falls back to VARIABLE_META)
 * @returns              - PlausibilityResult with macro-informed d-score
 */
export async function computeDynamicPlausibility(
  assumptions: AssumptionVector,
  empiricalMeans?: Map<string, { mean: number; std: number }> | Record<string, { mean: number; std: number }>
): Promise<PlausibilityResult> {
  // Static score first (for comparison)
  const staticResult = staticPlausibility(assumptions);

  // If no empirical means provided, static result is the answer
  if (!empiricalMeans || (empiricalMeans instanceof Map && empiricalMeans.size === 0) ||
      (!(empiricalMeans instanceof Map) && Object.keys(empiricalMeans).length === 0)) {
    return staticResult;
  }

  // Resolve dynamic priors
  // Build context map: for anchored metrics, use empirical mean; for others, use VARIABLE_META.prior
  const empMap = empiricalMeans instanceof Map ? empiricalMeans : new Map(Object.entries(empiricalMeans));
  const dynamicPriors = await resolveAllDynamicPriors(empMap);

  // Recompute d² with dynamic priors
  let dSquared = 0;
  const contributions: { [key: string]: number } = {};

  for (const [key, value] of Object.entries(assumptions)) {
    const resolved = dynamicPriors.get(key);
    if (!resolved) continue;
    const dev = (value - resolved.prior) / resolved.std;
    const contrib = dev * dev;
    contributions[key] = contrib;
    dSquared += contrib;
  }

  const dScore = Math.sqrt(dSquared);

  let band: string;
  if (dScore <= 1.0) band = 'Realistic';
  else if (dScore <= 1.5) band = 'Stretch';
  else if (dScore <= 2.0) band = 'Aggressive';
  else if (dScore <= 3.0) band = 'Heroic';
  else band = 'Unrealistic';

  const topContributors = Object.entries(contributions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => ({ variable: k, contribution: parseFloat(v.toFixed(3)) }));

  return { dScore, band, contributions, topContributors };
}

// ─── Dynamic Goal-Seeking ────────────────────────────────────────────────────

/**
 * Temporary: goal-seek with dynamic μ just uses the static solver but
 * with empirical means influencing the base assumptions.
 * 
 * The full integration (where the solver's d-score optimization uses
 * macro-anchored μ) requires refactoring the solver's internal 
 * computePlausibility calls. Phase B work.
 */
export async function solveWithDynamicMu(
  targetIrR: number,
  holdYears: number,
  currentAssumptions: AssumptionVector,
  constraints?: SolverConstraints,
): Promise<GoalSeekResult> {
  // For Phase A integration, run static goal-seek.
  // The base assumptions may have been pre-adjusted by the caller using
  // dynamic μ priors before calling goal-seek.
  return staticGoalSeek(targetIrR, holdYears, currentAssumptions, constraints);
}

/**
 * API-friendly wrapper: score plausibility with optional empirical context.
 */
export async function computePlausibilityWithContext(
  assumptions: AssumptionVector,
  empiricalContext?: {
    rentGrowth?: number;
    expenseGrowth?: number;
    entryCap?: number;
    exitCap?: number;
    nObservations?: number;
  }
): Promise<{
  mahalanobisD: number;
  band: string;
  contributions: Record<string, number>;
  topContributors: { variable: string; contribution: number }[];
  macroBreakdown: Record<string, { muEmpirical: number; muMacro: number; blendWeight: number; finalMu: number; divergenceSigma: number }>;
}> {
  // Build empirical means map from context
  const empMap = new Map<string, { mean: number; std: number }>();
  if (empiricalContext?.rentGrowth != null) {
    empMap.set('rentGrowthStabilized', { mean: empiricalContext.rentGrowth, std: VARIABLE_META.rentGrowthStabilized?.std ?? 0.012 });
  }
  if (empiricalContext?.expenseGrowth != null) {
    empMap.set('expenseGrowthRate', { mean: empiricalContext.expenseGrowth, std: VARIABLE_META.expenseGrowthRate?.std ?? 0.01 });
  }
  if (empiricalContext?.entryCap != null) {
    empMap.set('entryCapRate', { mean: empiricalContext.entryCap, std: VARIABLE_META.entryCapRate?.std ?? 0.015 });
  }
  if (empiricalContext?.exitCap != null) {
    empMap.set('exitCapRate', { mean: empiricalContext.exitCap, std: VARIABLE_META.exitCapRate?.std ?? 0.015 });
  }

  const plau = await computeDynamicPlausibility(assumptions, empMap);

  // Build macro breakdown
  const macroBreakdown: Record<string, any> = {};
  for (const [key, val] of Object.entries(assumptions)) {
    const emp = empMap.get(key);
    if (emp) {
      try {
        const breakdown = await (await import('./mu-composer')).composeMu(key, emp.mean, emp.std);
        macroBreakdown[key] = {
          muEmpirical: breakdown.muEmpirical,
          muMacro: breakdown.muMacro,
          blendWeight: breakdown.blendWeight,
          finalMu: breakdown.finalMu,
          divergenceSigma: breakdown.divergenceSigma,
        };
      } catch {}
    }
  }

  return {
    mahalanobisD: plau.dScore,
    band: plau.band,
    contributions: plau.contributions,
    topContributors: plau.topContributors,
    macroBreakdown,
  };
}
