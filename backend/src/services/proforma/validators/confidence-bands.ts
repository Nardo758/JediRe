/**
 * Confidence Intervals & Refusal Threshold
 * ========================================
 *
 * Implements F9 Pro Forma Architecture spec §9.
 *
 *   σ_total(t) = sqrt( σ_model(t)² + σ_sparsity(submarket)² )
 *
 *   P10(t) = forecast(t) − 1.282 σ_total(t)
 *   P25(t) = forecast(t) − 0.674 σ_total(t)
 *   P75(t) = forecast(t) + 0.674 σ_total(t)
 *   P90(t) = forecast(t) + 1.282 σ_total(t)
 *
 * F9 collision view states (when user enters an override on a platform-
 * forecast field):
 *
 *   inside  P25-P75            → 'within'         (no flag)
 *   outside P25-P75 inside P10-P90 → 'soft_warning'  (quartile)
 *   outside P10-P90            → 'hard_warning'   (require justification)
 *
 * Refusal thresholds — platform should NOT forecast when:
 *   - fewer than 5 stabilized comps in submarket
 *   - submarket has < 3 years of comp history
 *   - asset class has no representation
 *
 * Pure module.
 */

// ────────────────────────────────────────────────────────────────────────────
// Z-scores for percentiles (one-sided)
// ────────────────────────────────────────────────────────────────────────────

export const Z_P25 = 0.674; // 25th / 75th percentile
export const Z_P10 = 1.282; // 10th / 90th percentile

// ────────────────────────────────────────────────────────────────────────────
// Confidence band math
// ────────────────────────────────────────────────────────────────────────────

export interface ConfidenceBandsInput {
  /** Point forecast (decimal where applicable). */
  forecast: number;
  /** Model residual standard deviation from backtesting. */
  sigmaModel: number;
  /** Sparsity penalty for thin submarket data. Inflated when value is INFERRED / DEFAULT. */
  sigmaSparsity: number;
}

export interface ConfidenceBands {
  forecast: number;
  sigmaTotal: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
}

export function computeConfidenceBands(input: ConfidenceBandsInput): ConfidenceBands {
  const sigmaTotal = Math.sqrt(
    input.sigmaModel * input.sigmaModel +
      input.sigmaSparsity * input.sigmaSparsity,
  );
  return {
    forecast: input.forecast,
    sigmaTotal,
    p10: input.forecast - Z_P10 * sigmaTotal,
    p25: input.forecast - Z_P25 * sigmaTotal,
    p75: input.forecast + Z_P25 * sigmaTotal,
    p90: input.forecast + Z_P10 * sigmaTotal,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Override classification (3 bands)
// ────────────────────────────────────────────────────────────────────────────

export type OverrideClassification = 'within' | 'soft_warning' | 'hard_warning';

export interface OverrideClassificationResult {
  classification: OverrideClassification;
  /** True when the result requires a justification note from the user. */
  requireJustification: boolean;
  /** Distance to the nearest band edge, expressed as multiple of sigma. */
  zDistance: number;
  /** UI message. */
  message: string;
}

export function classifyOverride(
  override: number,
  bands: ConfidenceBands,
): OverrideClassificationResult {
  const z =
    bands.sigmaTotal > 0
      ? Math.abs(override - bands.forecast) / bands.sigmaTotal
      : 0;

  if (override >= bands.p25 && override <= bands.p75) {
    return {
      classification: 'within',
      requireJustification: false,
      zDistance: z,
      message: 'Override within typical (P25–P75) range.',
    };
  }
  if (override >= bands.p10 && override <= bands.p90) {
    const direction = override < bands.forecast ? 'bottom' : 'top';
    return {
      classification: 'soft_warning',
      requireJustification: false,
      zDistance: z,
      message: `Override sits in the ${direction} quartile of historically reasonable forecasts (between P10–P25 / P75–P90).`,
    };
  }
  const direction = override < bands.forecast ? 'below' : 'above';
  return {
    classification: 'hard_warning',
    requireJustification: true,
    zDistance: z,
    message: `Override is ${direction} the P10–P90 band of historically reasonable forecasts. Justification note required.`,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Refusal threshold
// ────────────────────────────────────────────────────────────────────────────

export interface RefusalContext {
  /** Number of stabilized comps in the submarket. */
  stabilizedComps: number;
  /** Years of comp history available in the submarket. */
  historyYears: number;
  /** Whether the asset class has any representation in this submarket. */
  hasAssetClassRep: boolean;
}

export const REFUSAL_THRESHOLDS = {
  minComps: 5,
  minHistoryYears: 3,
} as const;

export interface RefusalDecision {
  refuse: boolean;
  reason?: 'INSUFFICIENT_DATA';
  required?: string;
  available?: { comps: number; history_years: number; asset_class_present: boolean };
  message?: string;
}

export function evaluateRefusal(ctx: RefusalContext): RefusalDecision {
  const reasons: string[] = [];
  if (ctx.stabilizedComps < REFUSAL_THRESHOLDS.minComps) {
    reasons.push(`only ${ctx.stabilizedComps} stabilized comp(s), need ≥ ${REFUSAL_THRESHOLDS.minComps}`);
  }
  if (ctx.historyYears < REFUSAL_THRESHOLDS.minHistoryYears) {
    reasons.push(`only ${ctx.historyYears.toFixed(1)} yr history, need ≥ ${REFUSAL_THRESHOLDS.minHistoryYears}`);
  }
  if (!ctx.hasAssetClassRep) {
    reasons.push('asset class has no representation in submarket');
  }
  if (reasons.length === 0) {
    return { refuse: false };
  }
  return {
    refuse: true,
    reason: 'INSUFFICIENT_DATA',
    required: `min ${REFUSAL_THRESHOLDS.minComps} comps + ${REFUSAL_THRESHOLDS.minHistoryYears}yr history + asset class present`,
    available: {
      comps: ctx.stabilizedComps,
      history_years: ctx.historyYears,
      asset_class_present: ctx.hasAssetClassRep,
    },
    message: `Platform unable to forecast: ${reasons.join('; ')}.`,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Sigma sparsity inflation hook (spec §12 — INFERRED / DEFAULT widen bands)
// ────────────────────────────────────────────────────────────────────────────

export type ProvenanceQualityForSigma =
  | 'ACTUAL'
  | 'INFERRED'
  | 'ESTIMATED'
  | 'DEFAULT';

const SIGMA_INFLATION_FACTOR: Record<ProvenanceQualityForSigma, number> = {
  ACTUAL: 1.0,
  INFERRED: 1.5,
  ESTIMATED: 2.0,
  DEFAULT: 3.0,
};

export function inflateSigmaSparsity(
  baseSigma: number,
  qualityFlag: ProvenanceQualityForSigma,
): number {
  return baseSigma * (SIGMA_INFLATION_FACTOR[qualityFlag] ?? 1.0);
}
