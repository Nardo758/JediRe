/**
 * schedule-generators.ts
 *
 * Pure functions — one per AmortizationMethod.
 * Each generator takes a ConcessionRecord and returns an ordered array of
 * { month: YYYYMM, amount: number } entries covering the full lease term.
 * The caller (orchestrator) applies horizon truncation and write-offs.
 *
 * Cash contract: sum(entries[].amount) === record.cash_value within $0.01 rounding.
 * Rounding remainder is always pushed to the LAST entry so no cents are lost.
 */

import type { ConcessionRecord, MonthlyRecognitionEntry } from '../../types/concessions';

/**
 * Platform-default FRONT_LOADED curve for a 12-month lease term.
 * Weights sum to exactly 1.0.
 * Index 0 = lease month 1 (commencement month), index 11 = lease month 12.
 */
export const FRONT_LOADED_CURVE_12MO: readonly number[] = [
  0.20, 0.18, 0.15, 0.12, 0.10, 0.08, 0.06, 0.05, 0.03, 0.02, 0.01, 0.00,
];

// ─── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Convert a YYYY-MM-DD date string to a YYYYMM period key.
 * e.g. "2025-03-15" → "202503"
 */
export function dateToYYYYMM(date: string): string {
  const [y, m] = date.split('-');
  return `${y}${m.padStart(2, '0')}`;
}

/**
 * Add n months to a YYYYMM period key and return the new YYYYMM key.
 * Handles year rollover correctly.
 */
export function addMonthsToYYYYMM(yyyymm: string, n: number): string {
  const year = parseInt(yyyymm.slice(0, 4), 10);
  const month = parseInt(yyyymm.slice(4, 6), 10); // 1-based
  const totalMonths = (year * 12 + (month - 1)) + n;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1; // 1-based
  return `${newYear}${String(newMonth).padStart(2, '0')}`;
}

/**
 * Compare two YYYYMM strings. Returns negative/0/positive.
 */
export function compareYYYYMM(a: string, b: string): number {
  return parseInt(a, 10) - parseInt(b, 10);
}

// ─── Rounding helpers ──────────────────────────────────────────────────────────

/**
 * Round a dollar amount to 2 decimal places (cent precision).
 * Always use this instead of Math.round() so we never lose fractional cents
 * on non-integer concession amounts (e.g. $1000.50 / 3 months).
 */
export function roundCents(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Apply weights to a total value and distribute with exact cent invariance.
 *
 * Uses integer-cent arithmetic (works in cents = Math.round(x * 100)) throughout
 * to eliminate all floating-point accumulation errors. Guarantees:
 *   sum(entry.amount) === roundCents(cashValue) exactly (no floating-point drift).
 * The last entry absorbs any 1-cent rounding remainder.
 */
function distributeByWeights(
  cashValue: number,
  weights: number[],
  startYYYYMM: string,
): MonthlyRecognitionEntry[] {
  if (weights.length === 0) return [];
  // Work entirely in integer cents to avoid floating-point accumulation errors.
  const totalCents = Math.round(cashValue * 100);
  const entries: MonthlyRecognitionEntry[] = [];
  let distributedCents = 0;
  for (let i = 0; i < weights.length - 1; i++) {
    const amountCents = Math.round(totalCents * weights[i]);
    distributedCents += amountCents;
    entries.push({ month: addMonthsToYYYYMM(startYYYYMM, i), amount: amountCents / 100 });
  }
  // Last entry: guaranteed exact by integer subtraction (no floating-point residual).
  const lastCents = totalCents - distributedCents;
  entries.push({ month: addMonthsToYYYYMM(startYYYYMM, weights.length - 1), amount: lastCents / 100 });
  return entries;
}

// ─── Generator: STRAIGHT_LINE_GAAP ────────────────────────────────────────────

/**
 * §3.1 — Equal monthly slices over the full lease term. ASC 842 default.
 * All months receive floor(cash_value / n), remainder in last month.
 */
export function generateStraightLineGaap(record: ConcessionRecord): MonthlyRecognitionEntry[] {
  const n = record.lease_term_months;
  if (n <= 0) return [];
  const startYYYYMM = dateToYYYYMM(record.lease_start_date);
  const perMonth = record.cash_value / n;
  const weights = Array(n).fill(perMonth / record.cash_value);
  return distributeByWeights(record.cash_value, weights, startYYYYMM);
}

// ─── Generator: CASH_AT_COMMENCEMENT ──────────────────────────────────────────

/**
 * §3.2 — 100% of cash_value recognized in the lease-start month.
 * Used for one-time move-in specials or gift cards.
 */
export function generateCashAtCommencement(record: ConcessionRecord): MonthlyRecognitionEntry[] {
  const startYYYYMM = dateToYYYYMM(record.lease_start_date);
  return [{ month: startYYYYMM, amount: roundCents(record.cash_value) }];
}

// ─── Generator: BURN_OFF ───────────────────────────────────────────────────────

/**
 * §3.3 — Hyperbolic front-loaded recognition.
 * Month k (0-indexed) receives weight (n - k) / Σ(1..n) where Σ(1..n) = n*(n+1)/2.
 * Month 0 (commencement) gets the highest weight; the final month gets 1/Σ.
 * Models concessions that "burn off" most aggressively early in the lease term.
 */
export function generateBurnOff(record: ConcessionRecord): MonthlyRecognitionEntry[] {
  const n = record.lease_term_months;
  if (n <= 0) return [];
  const startYYYYMM = dateToYYYYMM(record.lease_start_date);
  const denom = (n * (n + 1)) / 2; // Σ(1..n)
  const weights: number[] = [];
  for (let k = 0; k < n; k++) {
    weights.push((n - k) / denom);
  }
  return distributeByWeights(record.cash_value, weights, startYYYYMM);
}

// ─── Generator: FRONT_LOADED ──────────────────────────────────────────────────

/**
 * §3.4 — Apply the 12-month platform default curve, scaled to actual term length.
 *
 * For terms ≤ 12 months:
 *   Take the first n weights from FRONT_LOADED_CURVE_12MO and renormalize to sum=1.
 *
 * For terms > 12 months:
 *   The first 12 months use the platform curve (absolute weights).
 *   Months 13+ each receive an equal share of the remaining weight after the
 *   curve is exhausted. Renormalize the full weight array to sum=1.
 *
 * The 12th element in FRONT_LOADED_CURVE_12MO is 0.00 by design — it is only
 * used as a "floor" reference in the extension logic.
 */
export function generateFrontLoaded(record: ConcessionRecord): MonthlyRecognitionEntry[] {
  const n = record.lease_term_months;
  if (n <= 0) return [];
  const startYYYYMM = dateToYYYYMM(record.lease_start_date);

  let rawWeights: number[];

  if (n <= 12) {
    rawWeights = Array.from(FRONT_LOADED_CURVE_12MO.slice(0, n));
  } else {
    // First 12 months use the platform curve
    rawWeights = Array.from(FRONT_LOADED_CURVE_12MO);
    // Remaining months share the last curve weight proportionally
    const curveSum = rawWeights.reduce((s, w) => s + w, 0);
    const remainder = Math.max(0, 1 - curveSum);
    const extMonths = n - 12;
    const perExtMonth = extMonths > 0 ? remainder / extMonths : 0;
    for (let i = 0; i < extMonths; i++) {
      rawWeights.push(perExtMonth);
    }
  }

  // Renormalize so weights sum exactly to 1.0
  const total = rawWeights.reduce((s, w) => s + w, 0);
  const weights = total > 0 ? rawWeights.map(w => w / total) : rawWeights.map(() => 1 / n);

  return distributeByWeights(record.cash_value, weights, startYYYYMM);
}

// ─── Generator: CUSTOM ────────────────────────────────────────────────────────

/**
 * §3.5 — Use the caller-supplied custom_schedule verbatim.
 * Validates that entries sum to cash_value within $0.01.
 * Throws if schedule is missing or the sum check fails (fail-loud per spec §14).
 */
export function generateCustom(record: ConcessionRecord): MonthlyRecognitionEntry[] {
  if (!record.custom_schedule || record.custom_schedule.length === 0) {
    throw new Error(
      `ConcessionRecord ${record.id}: amortization_method=CUSTOM but custom_schedule is empty or missing`,
    );
  }
  const scheduleSum = record.custom_schedule.reduce((s, e) => s + e.amount, 0);
  if (Math.abs(scheduleSum - record.cash_value) > 0.01) {
    throw new Error(
      `ConcessionRecord ${record.id}: custom_schedule sum ${scheduleSum.toFixed(2)} ` +
      `does not match cash_value ${record.cash_value.toFixed(2)} (tolerance $0.01)`,
    );
  }
  return record.custom_schedule.map(e => ({ month: e.month, amount: e.amount }));
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Route a ConcessionRecord to the appropriate schedule generator.
 * Returns an ordered MonthlyRecognitionEntry[].
 */
export function generateSchedule(record: ConcessionRecord): MonthlyRecognitionEntry[] {
  switch (record.amortization_method) {
    case 'STRAIGHT_LINE_GAAP':   return generateStraightLineGaap(record);
    case 'CASH_AT_COMMENCEMENT': return generateCashAtCommencement(record);
    case 'BURN_OFF':             return generateBurnOff(record);
    case 'FRONT_LOADED':         return generateFrontLoaded(record);
    case 'CUSTOM':               return generateCustom(record);
    default: {
      const m: never = record.amortization_method;
      throw new Error(`Unknown amortization_method: ${m}`);
    }
  }
}
