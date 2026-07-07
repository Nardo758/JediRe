/**
 * tax-schedule-extract.ts — R6 extract seam
 *
 * Extracted from deterministic-model-runner.ts (Phase 2 F-P1 arc, R6).
 *
 * These two functions compute the per-year property tax schedule used by the
 * deterministic proforma runner.  They were originally inline in the runner;
 * moved here so the runner does not import tax logic directly and so
 * F-P1t (the trigger-model follow-up dispatch) has a single place to extend.
 *
 * Constants are kept at their historically calibrated values and must NOT be
 * changed without running the Bishop + Highlands identity checkpoints:
 *   FL_REASSESS_PCT   0.85  — seller-loss reassessment basis (FL Stat §193.155)
 *   FL_CAP_INCREASE   0.10  — non-homestead SOH cap (10%/yr max increase)
 *   FL_DEF_MILLAGE    0.0218 — per-$1 AV (≈ 21.8 mills/1000) median FL commercial
 *
 * R6b (NC millage_unit): North Carolina assessors report millage in per-$100 AV
 * (millage_unit = 'per_100').  At compose-time the caller MUST multiply the raw
 * NC millage rate by 10 to convert to the standard per-$1000 mills used here.
 * Example: NC rate 0.6500 per_100 → pass 6.500 per_1000 as baseTax input.
 * Failure to convert produces a 10× underestimation of the tax schedule.
 *
 * F-P1t note (trigger-model follow-up dispatch): The current behavior is the
 * two-segment special case of the full four-door trend model described in R6b:
 *   Segment 1 (year 1): full reassessment on sale → new basis = purchasePrice × 0.85
 *   Segment 2 (years 2+): assessed-value grows at cap-clamped rate from new basis
 * The general model adds trigger events (CO, cycle, subsequent sale) that reset
 * the basis mid-hold; that is deferred to F-P1t and must NOT be back-ported here.
 */

// ── Constants (behavior-identical to pre-extract inline values) ────────────────
export const FL_REASSESS_PCT   = 0.85;   // reassessment basis fraction on sale
export const FL_CAP_INCREASE   = 0.10;   // non-homestead SOH cap (10% / yr)
export const FL_DEF_MILLAGE    = 0.0218; // per-$1 AV (21.8 mills / $1,000)

/**
 * Florida non-homestead property tax schedule.
 *
 * Year 1 basis = purchasePrice × FL_REASSESS_PCT (sale reassessment).
 * Years 2+: assessed value grows at FL_CAP_INCREASE per year (cap-clamped trend).
 * Returns holdYears + 1 entries (year 0 = acquisition year, year holdYears = sale year).
 */
export function computeFloridaTax(
  purchasePrice: number,
  holdYears: number,
  millageRate: number = FL_DEF_MILLAGE,
  capRate: number = FL_CAP_INCREASE,
  reassessPct: number = FL_REASSESS_PCT,
): { perYear: number[]; assessedValues: number[] } {
  const base = purchasePrice * reassessPct;
  const perYear: number[] = [];
  const assessedValues: number[] = [];
  for (let y = 1; y <= holdYears + 1; y++) {
    const av = base * Math.pow(1 + capRate, y - 1);
    assessedValues.push(av);
    perYear.push(av * millageRate);
  }
  return { perYear, assessedValues };
}

/**
 * Non-Florida property tax schedule.
 *
 * Grows baseTax at expenseGrowth per year (flat compound trend).
 * assessedValues is always 0 — caller provides baseTax directly.
 *
 * See R6b comment above re: NC millage_unit conversion requirement.
 *
 * B9 guard: Pass millageUnit when the source data specifies one.
 * If 'per_100', this function throws — the caller MUST multiply the raw
 * NC rate by 10 before passing as baseTax (per_100 → per_1000 conversion).
 * A per_100 rate passed unconverted produces a 10× tax underestimate.
 */
export function computeNonFloridaTax(
  baseTax: number,
  expenseGrowth: number,
  holdYears: number,
  millageUnit?: 'per_100' | 'per_1000',
): { perYear: number[]; assessedValues: number[] } {
  // B9 (F-P1): Runtime guard — NC per_100 rates must be converted before reaching this seam.
  if (millageUnit === 'per_100') {
    throw new Error(
      'F-P1-B9: computeNonFloridaTax received millageUnit="per_100". ' +
      'North Carolina assessors report millage in per-$100 AV; the caller MUST ' +
      'multiply the raw rate by 10 to convert to per-$1000 before passing baseTax. ' +
      'Passing unconverted produces a 10× tax underestimate. ' +
      'Fix: baseTax = rawMillageRate * 10 * assessedValue / 1000.'
    );
  }
  const perYear: number[] = [];
  const assessedValues: number[] = [];
  for (let y = 1; y <= holdYears + 1; y++) {
    perYear.push(baseTax * Math.pow(1 + expenseGrowth, y - 1));
    assessedValues.push(0);
  }
  return { perYear, assessedValues };
}

/**
 * B9 finding record — NC millage blast radius (F-P1 arc):
 *
 * Finding: North Carolina assessors report millage in per-$100 AV (millage_unit='per_100').
 * The computeNonFloridaTax seam expects baseTax as an absolute dollar amount, not a rate.
 * The current proforma-assumptions-bridge does NOT populate basePropertyTax from millage
 * data for any deal — it defaults to purchasePrice × 0.012 for all non-FL deals.
 *
 * Blast radius: ZERO for all current production deals.
 * - No NC deals have millage data flowing through the bridge into basePropertyTax.
 * - All non-FL deals use the purchasePrice × 1.2% default, which is state-agnostic
 *   and does not involve a per_100 rate at all.
 * - The 10× drift described in R6b is a POTENTIAL future failure (if a pipeline adds
 *   NC millage rate → basePropertyTax without ×10 conversion), not a historical one.
 *
 * Guard installed above prevents the drift from ever reaching production silently.
 * Future NC millage pipeline work must call: baseTax = rawPer100Rate * 10 * assessedValue / 1000.
 */
export const NC_MILLAGE_BLAST_RADIUS_NOTE = 'zero_current_production_deals' as const;
