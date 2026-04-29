/**
 * Frontend pure mirror of the F9 Tier-1 protector math.
 *
 * Lets AssumptionsTab classify user overrides and run the Gordon check
 * synchronously as the user types — no server round-trip. The server-side
 * implementation in backend/src/services/proforma/validators/ remains the
 * source of truth and computes definitive bands at proforma generation time.
 *
 * Keep these implementations in lockstep. Changes here must mirror changes
 * to the backend modules and vice-versa.
 *
 * Source: docs/architecture/f9-proforma-spec.md §8-§9.
 */

import type {
  ConfidenceBands,
  OverrideClassificationResult,
  GordonValidationResult,
  RefusalDecision,
} from './types';

// ─── Constants — must match backend ──────────────────────────────────────────

export const Z_P25 = 0.674;
export const Z_P10 = 1.282;

export const GORDON_THRESHOLDS = {
  overPromiseBps: -25,
  conservativeBps: 100,
} as const;

export const REFUSAL_THRESHOLDS = {
  minComps: 5,
  minHistoryYears: 3,
} as const;

// ─── Confidence bands ────────────────────────────────────────────────────────

export function computeConfidenceBands(input: {
  forecast: number;
  sigmaModel: number;
  sigmaSparsity: number;
}): ConfidenceBands {
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

// ─── Gordon Growth ───────────────────────────────────────────────────────────

export function validateGordonGrowth(input: {
  exitCap: number | null;
  terminalGrowth: number | null;
  requiredReturn: number | null;
}): GordonValidationResult {
  if (
    input.exitCap === null ||
    input.terminalGrowth === null ||
    input.requiredReturn === null
  ) {
    return {
      valid: false,
      impliedCap: null,
      divergenceBps: null,
      message: 'Insufficient inputs to validate (need exit cap, terminal growth, required return).',
    };
  }
  const impliedCap = input.requiredReturn - input.terminalGrowth;
  const divergenceBps = Math.round((input.exitCap - impliedCap) * 10000);

  if (divergenceBps < GORDON_THRESHOLDS.overPromiseBps) {
    return {
      valid: false,
      impliedCap,
      divergenceBps,
      flag: 'GORDON_OVER_PROMISE',
      severity: 'high',
      message:
        `Exit cap ${(input.exitCap * 100).toFixed(2)}% is ${Math.abs(divergenceBps)}bps below ` +
        `Gordon-implied ${(impliedCap * 100).toFixed(2)}%. Reconcile assumptions.`,
    };
  }
  if (divergenceBps > GORDON_THRESHOLDS.conservativeBps) {
    return {
      valid: true,
      impliedCap,
      divergenceBps,
      flag: 'GORDON_CONSERVATIVE',
      severity: 'info',
      message:
        `Exit cap ${(input.exitCap * 100).toFixed(2)}% is ${divergenceBps}bps above ` +
        `Gordon-implied ${(impliedCap * 100).toFixed(2)}%.`,
    };
  }
  return { valid: true, impliedCap, divergenceBps };
}

export interface GordonChartSeries {
  line: Array<{ g: number; cap: number }>;
  user: { g: number; cap: number } | null;
}

export function buildGordonChartSeries(
  exitCap: number | null,
  terminalGrowth: number | null,
  requiredReturn: number | null,
  rangeBps = 200,
): GordonChartSeries {
  if (requiredReturn === null) return { line: [], user: null };
  const k = requiredReturn;
  const center = terminalGrowth ?? 0.025;
  const line: Array<{ g: number; cap: number }> = [];
  for (let bp = -rangeBps; bp <= rangeBps; bp += 25) {
    const g = Math.max(0, center + bp / 10000);
    line.push({ g, cap: k - g });
  }
  const user =
    terminalGrowth !== null && exitCap !== null
      ? { g: terminalGrowth, cap: exitCap }
      : null;
  return { line, user };
}

// ─── Refusal ─────────────────────────────────────────────────────────────────

export function evaluateRefusal(ctx: {
  stabilizedComps: number;
  historyYears: number;
  hasAssetClassRep: boolean;
}): RefusalDecision {
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
  if (reasons.length === 0) return { refuse: false };
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

// ─── NOI growth identity (spec §7) ───────────────────────────────────────────

export function noiGrowthIdentity(
  rentGrowth: number | null,
  opexGrowth: number | null,
  noiMargin: number,
): number | null {
  if (noiMargin <= 0 || noiMargin > 1) return null;
  if (rentGrowth === null || opexGrowth === null) return null;
  return (rentGrowth - opexGrowth * (1 - noiMargin)) / noiMargin;
}
