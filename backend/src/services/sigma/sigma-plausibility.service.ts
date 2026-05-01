/**
 * Plausibility Scoring Service
 *
 * Scores an assumption set against the current Σ-derived joint distribution.
 * Returns Mahalanobis distance, aggressiveness band, per-variable decomposition,
 * and warnings (double-up, regime-appropriate, etc.).
 *
 * Phase A uses heuristic Σ. Phase C upgrades to empirical Σ transparently.
 */

import {
  buildHeuristicSigma,
  mahalanobisSquared,
  mahalanobisContributions,
  aggressivenessBand,
} from './heuristic-sigma-builder';
import { SIGMA_VARIABLES, VARIABLE_COUNT } from './sigma-variable-registry';
import type { CovarianceMatrix, RegimeLabel } from './heuristic-sigma-builder';
import { assessDoubleUp } from './debt-bundle-registry';
import { logger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlausibilityInput {
  /** Assumption set: variable ID → value */
  assumptions: Record<string, number>;
  /** Override regime (default: current regime from HMM, or 'expansion' for Phase A) */
  regime?: RegimeLabel;
  /** Debt bundle ID, if selected — for double-up detection */
  bundleId?: string;
  /** Deal F1 sensitivity, if available — for double-up detection */
  dealF1Sensitivity?: number;
}

export interface PlausibilityResult {
  mahalanobisD: number;
  mahalanobisD2: number;
  band: string;
  perVariable: Record<string, {
    value: number;
    mean: number;
    zScore: number;
    contribution: number;
    contributionPct: number;
    macroAnchored: boolean;
  }>;
  regime: RegimeLabel;
  warnings: PlausibilityWarning[];
  bundleAssessment?: {
    doubleUp: import('./debt-bundle-registry').DoubleUpAssessment;
    irrVariance: number;
  };
}

export interface PlausibilityWarning {
  type: 'heroic_assumption' | 'double_up_risk' | 'regime_mismatch' | 'high_divergence' | 'anomaly';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric?: string;
}

// ─── Cached Σ ────────────────────────────────────────────────────────────────

let cachedSigma: CovarianceMatrix | null = null;
let cachedRegime: RegimeLabel | null = null;
let lastBuildTime = 0;
const CACHE_TTL_MS = 600_000; // 10 minutes

function getOrBuildSigma(regime: RegimeLabel): CovarianceMatrix {
  const now = Date.now();
  if (cachedSigma && cachedRegime === regime && (now - lastBuildTime) < CACHE_TTL_MS) {
    return cachedSigma;
  }
  const sigma = buildHeuristicSigma(regime);
  cachedSigma = sigma;
  cachedRegime = regime;
  lastBuildTime = now;
  return sigma;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Score an assumption set for plausibility.
 * Returns Mahalanobis distance, band, per-variable contributions, and warnings.
 */
export async function scorePlausibility(input: PlausibilityInput): Promise<PlausibilityResult> {
  const regime = input.regime ?? 'expansion';
  const sigma = getOrBuildSigma(regime);

  const n = sigma.variableOrder.length;
  const warnings: PlausibilityWarning[] = [];

  // Build x vector matching Σ's variable order
  const x = new Array(n);
  const provided = new Set<string>();

  for (let i = 0; i < n; i++) {
    const varId = sigma.variableOrder[i];
    if (input.assumptions[varId] !== undefined) {
      x[i] = input.assumptions[varId];
      provided.add(varId);
    } else {
      // Default to μ for non-provided variables
      x[i] = sigma.meanVector[i];
    }
  }

  // Compute Mahalanobis distance
  const d2 = mahalanobisSquared(x, sigma.meanVector, sigma.invCovFlat, n);
  const { band, d } = aggressivenessBand(d2);

  // Per-variable decomposition
  const contribs = mahalanobisContributions(x, sigma.meanVector, sigma.invCovFlat, n);
  const perVariable: Record<string, PlausibilityResult['perVariable'][string]> = {};

  for (let i = 0; i < n; i++) {
    const varId = sigma.variableOrder[i];
    const vDef = SIGMA_VARIABLES[varId];
    if (!vDef || !provided.has(varId)) continue;

    const value = x[i];
    const mean = sigma.meanVector[i];
    const stdDev = Math.sqrt(sigma.covFlat[i * n + i]);
    const zScore = (value - mean) / stdDev;
    const contribution = contribs[i];
    const contributionPct = d2 > 0 ? (contribution / d2) * 100 : 0;

    perVariable[varId] = {
      value,
      mean,
      zScore,
      contribution,
      contributionPct,
      macroAnchored: vDef.macroAnchored,
    };

    // Generate warnings for extreme assumptions
    if (Math.abs(zScore) > 3 && provided.has(varId) && vDef.maxFeasible !== undefined) {
      // Always check against feasible range
      if (value > vDef.maxFeasible || (vDef.minFeasible !== undefined && value < vDef.minFeasible)) {
        warnings.push({
            type: 'heroic_assumption',
            severity: 'critical',
            metric: varId,
            message: `${vDef.label} (${(value * 100).toFixed(1)}%) is outside feasible range [${(vDef.minFeasible! * 100).toFixed(0)}%, ${(vDef.maxFeasible * 100).toFixed(0)}%] and is a ${(Math.abs(zScore)).toFixed(1)}σ outlier.`,
          });
        }
      }
    }

  // Regime mismatch warning
  if (input.assumptions.rent_growth && regime === 'contraction') {
    const rentGrowth = input.assumptions.rent_growth;
    if (rentGrowth > 0.03) {
      warnings.push({
        type: 'regime_mismatch',
        severity: 'warning',
        metric: 'rent_growth',
        message: `Assumed rent growth ${(rentGrowth * 100).toFixed(1)}% in Contraction regime. Historical mean in Contraction is ~1.0%. Consider if this is realistic.`,
      });
    }
  }

  // Macro-anchored divergence warning
  for (const [varId, val] of Object.entries(perVariable)) {
    if (val.macroAnchored && Math.abs(val.zScore) > 1.5) {
      warnings.push({
        type: 'high_divergence',
        severity: 'info',
        metric: varId,
        message: `${SIGMA_VARIABLES[varId]?.label ?? varId} at ${(val.value * 100).toFixed(1)}% diverges ${val.zScore > 0 ? 'above' : 'below'} the macro-anchored mean (${(val.mean * 100).toFixed(1)}%). This may imply mean reversion risk.`,
      });
    }
  }

  // Double-up detection
  let bundleAssessment: PlausibilityResult['bundleAssessment'] | undefined;
  if (input.bundleId) {
    const doubleUp = assessDoubleUp(input.bundleId, input.dealF1Sensitivity ?? 0.15);
    if (doubleUp.severity !== 'none') {
      warnings.push({
        type: 'double_up_risk',
        severity: doubleUp.severity === 'high' ? 'critical' : 'warning',
        message: doubleUp.explanation,
      });
    }

    bundleAssessment = {
      doubleUp,
      irrVariance: 0.02, // placeholder — actual variance requires proforma sensitivity
    };
  }

  // Sort warnings by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    mahalanobisD: d,
    mahalanobisD2: d2,
    band,
    perVariable,
    regime,
    warnings,
    bundleAssessment,
  };
}

/**
 * Invalidate the cached Σ (call after regime change or manual refresh).
 */
export function invalidateSigmaCache(): void {
  cachedSigma = null;
  cachedRegime = null;
  lastBuildTime = 0;
}
