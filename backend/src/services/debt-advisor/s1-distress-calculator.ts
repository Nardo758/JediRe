/**
 * s1-distress-calculator.ts
 * B6c: Build S1 distress flag calculator.
 *
 * Computes early-warning distress signals for a deal based on its debt
 * structure, equity position, and elapsed time.
 */

export interface DistressFlags {
  ioExpiryShock: boolean;
  underwaterEquity: boolean;
  cashInRefi: boolean;
}

export interface DistressCalcInput {
  loanAmount: number;
  propertyValue: number;
  ioPeriodMonths: number;
  termMonths: number;
  monthsElapsed: number;
  /** Current market rate (or effective rate) for cash-in refi comparison. */
  currentRate?: number;
  /** Original rate at origination (for cash-in refi 200bps threshold). */
  originalRate?: number;
  /** Year-1 NOI for DSCR post-IO check. */
  noiY1?: number;
}

/**
 * Compute S1 distress flags.
 *
 * Rules:
 * 1. ioExpiryShock — true if IO period expires within 12 months AND
 *    DSCR post-IO would fall below 1.0.
 * 2. underwaterEquity — true if propertyValue < loanAmount (negative equity).
 * 3. cashInRefi — true if underwaterEquity AND rate has risen > 200bps
 *    since origination.
 */
export function computeDistressFlags(input: DistressCalcInput): DistressFlags {
  const {
    loanAmount,
    propertyValue,
    ioPeriodMonths,
    termMonths,
    monthsElapsed,
    currentRate,
    originalRate,
    noiY1,
  } = input;

  // ── Underwater equity ─────────────────────────────────────────────────────
  const underwaterEquity = propertyValue < loanAmount;

  // ── IO expiry shock ───────────────────────────────────────────────────────
  // IO expires within 12 months?
  const ioExpiresSoon = monthsElapsed >= ioPeriodMonths - 12 && monthsElapsed < ioPeriodMonths;

  // Post-IO DSCR: assume full amortizing debt service over remaining term.
  // Simplified: use standard mortgage PMT on remaining balance = loanAmount,
  // amortized over the remaining term (termMonths - ioPeriodMonths).
  let ioExpiryShock = false;
  if (ioExpiresSoon && noiY1 !== undefined && currentRate !== undefined && currentRate > 0) {
    const remainingAmortMonths = Math.max(1, termMonths - ioPeriodMonths);
    const monthlyRate = currentRate / 12;
    const factor = Math.pow(1 + monthlyRate, remainingAmortMonths);
    const monthlyPMT = loanAmount * (monthlyRate * factor) / (factor - 1);
    const annualDebtServicePostIO = monthlyPMT * 12;
    const dscrPostIO = annualDebtServicePostIO > 0 ? noiY1 / annualDebtServicePostIO : Infinity;
    ioExpiryShock = dscrPostIO < 1.0;
  } else if (ioExpiresSoon) {
    // Without NOI / rate, we cannot compute DSCR; default to false (honest absence)
    ioExpiryShock = false;
  }

  // ── Cash-in refi ──────────────────────────────────────────────────────────
  // True if underwater AND rate has risen > 200bps since origination.
  let cashInRefi = false;
  if (
    underwaterEquity &&
    originalRate !== undefined &&
    currentRate !== undefined
  ) {
    cashInRefi = currentRate - originalRate > 0.02;
  }

  return { ioExpiryShock, underwaterEquity, cashInRefi };
}
