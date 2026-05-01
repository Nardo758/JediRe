/**
 * M36 Macro-Anchored Mean Composer
 *
 * Implements Section 3 of M36_Macro_Anchored_Mean_Addendum:
 *   μ(metric, t) = w_emp · μ_emp + (1 - w_emp) · μ_macro
 *
 * Where:
 *   μ_macro = macro_series(t) + structural_premium
 *   w_emp = f(divergence), where divergence = |μ_emp - μ_macro| / σ_metric
 *
 * For non-anchored metrics, μ = μ_emp (w_emp = 1.0).
 *
 * In Phase A (heuristic), μ_emp comes from:
 *   1. The deal's own empirical data (historical rent roll/T12)
 *   2. Market-level rolling averages from macro_anchor_observations
 *   3. Fallback: the hardcoded VARIABLE_META[].prior
 *
 * In Phase B, μ_emp comes from M36's regime-conditional empirical Σ estimator.
 */

import { logger } from '../../utils/logger';
import { getMacroValue, MACRO_ANCHOR_MAP, type MacroAnchorConfig } from './macro/macro-fetcher';

// ─── Default Blend Weights ───────────────────────────────────────────────────

export const DEFAULT_W_EMPIRICAL = 0.70;
export const MIN_W_EMPIRICAL = 0.30;
export const MAX_W_EMPIRICAL = 0.90;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MuBreakdown {
  metric: string;
  muEmpirical: number;        // from data (or fallback prior)
  muMacro: number;            // macro series + structural premium
  macroSeriesValue: number;   // raw FRED/BLS value
  structuralPremium: number;
  blendWeight: number;        // w_empirical (0.3-0.9)
  divergenceSigma: number;    // in σ units
  finalMu: number;            // blended result
  isAnchored: boolean;
  source: 'macro_anchored' | 'pure_empirical';
}

// ─── Divergence-Driven Reweighting ──────────────────────────────────────────

/**
 * Derive blend weight from divergence in σ units.
 * Implements Section 3.4 of the spec.
 */
export function deriveBlendWeight(divergenceSigma: number): number {
  // Divergence thresholds match spec exactly
  const thresholds = [
    { max: 1.0, weight: 0.70 },
    { max: 2.0, weight: 0.55 },
    { max: 3.0, weight: 0.40 },
  ];

  for (const t of thresholds) {
    if (divergenceSigma < t.max) return t.weight;
  }
  return MIN_W_EMPIRICAL;
}

/**
 * Compute μ_macro = macro_series(t) + structural_premium
 */
export function computeMacroMu(anchor: MacroAnchorConfig, macroValue: number): number {
  return macroValue + anchor.structuralPremium;
}

/**
 * Compute divergence in σ units.
 */
export function computeDivergenceSigma(
  muEmpirical: number,
  muMacro: number,
  metricStd: number
): number {
  if (metricStd <= 0) return 0;
  return Math.abs(muEmpirical - muMacro) / metricStd;
}

// ─── Main Composition Function ───────────────────────────────────────────────

/**
 * Compose the blended μ for a single metric.
 *
 * @param metric       - sigma-engine metric key (e.g., 'rentGrowthStabilized')
 * @param muEmpirical  - empirical mean (from deal data, market rolling window, or prior)
 * @param metricStd    - standard deviation of the metric (from VARIABLE_META[].std)
 * @returns            - breakdown including final blended μ
 */
export async function composeMu(
  metric: string,
  muEmpirical: number,
  metricStd: number
): Promise<MuBreakdown> {
  const anchor = MACRO_ANCHOR_MAP.get(metric);

  if (!anchor) {
    // Non-anchored metric — purely empirical
    return {
      metric,
      muEmpirical,
      muMacro: muEmpirical,
      macroSeriesValue: 0,
      structuralPremium: 0,
      blendWeight: 1.0,
      divergenceSigma: 0,
      finalMu: muEmpirical,
      isAnchored: false,
      source: 'pure_empirical',
    };
  }

  try {
    const macroResult = await getMacroValue(anchor.seriesId);
    const muMacro = computeMacroMu(anchor, macroResult.value);
    const divergenceSigma = computeDivergenceSigma(muEmpirical, muMacro, metricStd);
    const blendWeight = deriveBlendWeight(divergenceSigma);
    const finalMu = blendWeight * muEmpirical + (1 - blendWeight) * muMacro;

    return {
      metric,
      muEmpirical,
      muMacro,
      macroSeriesValue: macroResult.value,
      structuralPremium: anchor.structuralPremium,
      blendWeight,
      divergenceSigma: parseFloat(divergenceSigma.toFixed(3)),
      finalMu,
      isAnchored: true,
      source: 'macro_anchored',
    };
  } catch (err) {
    logger.error('[mu-composer] Failed to compose μ for metric, using empirical', {
      metric,
      err: err instanceof Error ? err.message : String(err),
    });
    return {
      metric,
      muEmpirical,
      muMacro: muEmpirical,
      macroSeriesValue: 0,
      structuralPremium: anchor.structuralPremium,
      blendWeight: 1.0,
      divergenceSigma: 0,
      finalMu: muEmpirical,
      isAnchored: true,
      source: 'macro_anchored',
    };
  }
}

/**
 * Compose μ for all anchored metrics in one call.
 * Returns a map: metricKey → MuBreakdown
 */
export async function composeAllAnchoredMu(
  empiricalMeans: Map<string, { mean: number; std: number }>,
): Promise<Map<string, MuBreakdown>> {
  const result = new Map<string, MuBreakdown>();

  const entries = Array.from(empiricalMeans.entries());
  const composed = await Promise.all(
    entries.map(([metric, { mean, std }]) => composeMu(metric, mean, std))
  );

  for (const breakdown of composed) {
    result.set(breakdown.metric, breakdown);
  }

  return result;
}

/**
 * Get a debug breakdown for a single metric, for API display.
 * Used by GET /api/sigma/mu/breakdown
 */
export async function getMuBreakdown(
  metric: string,
  muEmpirical: number,
  metricStd: number
): Promise<MuBreakdown> {
  return composeMu(metric, muEmpirical, metricStd);
}

/**
 * Shortcut: get just the blended μ for a metric, without the full breakdown.
 */
export async function getBlendedMu(
  metric: string,
  muEmpirical: number,
  metricStd: number
): Promise<number> {
  const result = await composeMu(metric, muEmpirical, metricStd);
  return result.finalMu;
}
