/**
 * Gordon Growth Coupling — Cap Rate Validator
 * ===========================================
 *
 * Implements F9 Pro Forma Architecture spec §8.
 *
 *   Value = NOI / (k − g)   ⇒   cap = k − g
 *
 *   k = required return (from RSS / M14 risk model)
 *   g = perpetuity growth rate (terminal layered-rent forecast)
 *
 * Brokers commonly stack "high growth + cap compression" without realising
 * they're double-counting growth. This validator catches that.
 *
 * Severity bands (spec §8 + calibration TBD per §14):
 *
 *   divergence_bps < −25  → GORDON_OVER_PROMISE  (high)
 *   divergence_bps >  100 → GORDON_CONSERVATIVE  (info)
 *
 *   divergence_bps = (deal.exit_cap − implied_cap) × 100
 *
 * Pure module — no DB, no I/O.
 */

export type GordonFlag = 'GORDON_OVER_PROMISE' | 'GORDON_CONSERVATIVE';
export type GordonSeverity = 'high' | 'medium' | 'info';

export interface GordonValidationInput {
  /** Exit cap rate as decimal (e.g. 0.05 = 5.0%). */
  exitCap: number | null;
  /** Terminal-year layered rent growth as decimal (e.g. 0.025 = 2.5%). */
  terminalGrowth: number | null;
  /** Required return k from RSS / M14 as decimal (e.g. 0.09 = 9.0%). */
  requiredReturn: number | null;
}

export interface GordonValidationResult {
  valid: boolean;
  /** Implied cap rate per Gordon: k − g. */
  impliedCap: number | null;
  /** (exit_cap − implied_cap) × 10000 in basis points. */
  divergenceBps: number | null;
  flag?: GordonFlag;
  severity?: GordonSeverity;
  message?: string;
}

/** Spec §8 thresholds — tuneable per spec §14. */
export const GORDON_THRESHOLDS = {
  overPromiseBps: -25,
  conservativeBps: 100,
} as const;

export function validateGordonGrowth(
  input: GordonValidationInput,
): GordonValidationResult {
  // Refuse to validate when any input is missing — caller surfaces
  // "incomplete validation" rather than a false-positive flag.
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
        `Gordon-implied ${(impliedCap * 100).toFixed(2)}% (k=${(input.requiredReturn * 100).toFixed(2)}%, ` +
        `g=${(input.terminalGrowth * 100).toFixed(2)}%). Reconcile: lower terminal growth, raise exit cap, ` +
        `or justify a lower required return.`,
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
        `Gordon-implied ${(impliedCap * 100).toFixed(2)}%. Conservative — fine, but check if ` +
        `value is being left on the table.`,
    };
  }

  return {
    valid: true,
    impliedCap,
    divergenceBps,
  };
}

/**
 * Build a series of (g, cap) points centred on the user's assumption so the
 * "show valid range" chart can plot the user point against the Gordon line.
 * Returned series is the Gordon line within ±200bps of the user's growth.
 */
export interface GordonChartSeries {
  line: Array<{ g: number; cap: number }>;
  user: { g: number; cap: number } | null;
  validBand: { gMin: number; gMax: number; capMin: number; capMax: number };
}

export function buildGordonChartSeries(
  input: GordonValidationInput,
  rangeBps = 200,
): GordonChartSeries {
  const line: Array<{ g: number; cap: number }> = [];
  if (input.requiredReturn === null) {
    return { line, user: null, validBand: { gMin: 0, gMax: 0, capMin: 0, capMax: 0 } };
  }
  const k = input.requiredReturn;
  const centerG = input.terminalGrowth ?? 0.025;
  const stepBps = 25;
  for (let bp = -rangeBps; bp <= rangeBps; bp += stepBps) {
    const g = Math.max(0, centerG + bp / 10000);
    line.push({ g, cap: k - g });
  }
  const user =
    input.terminalGrowth !== null && input.exitCap !== null
      ? { g: input.terminalGrowth, cap: input.exitCap }
      : null;
  const gMin = Math.max(0, centerG - rangeBps / 10000);
  const gMax = centerG + rangeBps / 10000;
  return {
    line,
    user,
    validBand: {
      gMin,
      gMax,
      capMin: k - gMax + GORDON_THRESHOLDS.overPromiseBps / 10000,
      capMax: k - gMin + GORDON_THRESHOLDS.conservativeBps / 10000,
    },
  };
}
