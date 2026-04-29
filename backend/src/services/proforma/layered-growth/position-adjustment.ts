/**
 * Submarket Position Adjustment
 * =============================
 *
 * Implements F9 Pro Forma Architecture spec §10. "Position" is the
 * subject's quality / vintage premium or discount relative to its comp set
 * average — a new-construction Class A in a Class B submarket may price at
 * +12% (position = +0.12); an old Class C in a Class B submarket may price
 * at −8% (position = −0.08).
 *
 *   subject_growth_t = submarket_growth_t + (position_t − position_{t-1})
 *
 * Three modes (spec §10):
 *
 *   MEAN_REVERTING (default)
 *     Premium / discount decays exponentially toward zero:
 *
 *       position_t = position_0 × exp(−t / half_life)
 *
 *     Half-life calibrated by historical comp-set data. Multifamily
 *     premium decay typically 4-5 years; discount closure typically slower
 *     because renovation is slow (default 6yr).
 *
 *   CONSTANT_GAP
 *     Subject and submarket grow at the same rate; gap maintained.
 *     Use when there's a structural reason the gap won't close
 *     (irreplaceable location, regulatory moat, unique amenity).
 *
 *   WIDENING (rare)
 *     Justified only when subject has a structural advantage that
 *     compounds (land-constrained submarket where new construction is
 *     impossible, so existing premium grows). Modelled as a small
 *     compound on `position_0` per year.
 *
 * Pure module — no DB, no I/O.
 */

import {
  ProvenancedValue,
  provenanced,
} from '../../../types/provenanced-value';

// ────────────────────────────────────────────────────────────────────────────
// Mode + spec
// ────────────────────────────────────────────────────────────────────────────

export type PositionMode = 'mean_reverting' | 'constant_gap' | 'widening';

export interface PositionAdjustmentSpec {
  /** Initial subject vs comp-set spread (decimal: +0.12 = +12% premium). */
  initialPosition: number;
  /** How the spread evolves over the hold. */
  mode: PositionMode;
  /** Asset class — used to look up default half-life when not supplied. */
  assetClass?: string;
  /**
   * Half-life in years for mean-reverting mode. Optional — defaults from
   * `POSITION_HALF_LIFE_DEFAULTS` keyed on assetClass + sign(initialPosition).
   */
  halfLifeYears?: number;
  /**
   * Annual compound rate for widening mode (e.g. 0.01 = +1%/yr applied to
   * the initial position). Defaults to 1% — kept small because widening is
   * rare and structural.
   */
  wideningRatePerYear?: number;
  /** Optional user-supplied justification — surfaced in F9 collision view. */
  justification?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Asset-class half-life calibration (spec §10 + §14 calibration TBD)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Per-asset-class half-life defaults for the mean-reverting mode (in years).
 * `premium` is the decay half-life when initial position is positive
 * (premium erodes as competing supply delivers). `discount` is the closure
 * half-life when initial position is negative (renovation is slow, so
 * discounts close more slowly than premiums erode).
 *
 * Default multifamily values per spec §10: 4.5yr premium / 6yr discount.
 * Other asset classes seeded with sensible defaults pending §14 backtest.
 */
export const POSITION_HALF_LIFE_DEFAULTS: Record<
  string,
  { premium: number; discount: number }
> = {
  multifamily: { premium: 4.5, discount: 6.0 },
  retail: { premium: 5.0, discount: 7.0 },         // longer — repositioning is harder
  office: { premium: 3.5, discount: 8.0 },         // class-A premium decays fast post-COVID; class-B discount sticky
  industrial: { premium: 6.0, discount: 5.0 },     // location-driven — closure faster than erosion
  str: { premium: 3.0, discount: 4.0 },            // amenity decay is rapid in STR
  flip: { premium: 1.0, discount: 1.0 },           // hold is short — fast collapse
  land: { premium: 8.0, discount: 8.0 },           // very slow either way
  default: { premium: 4.5, discount: 6.0 },
};

export const POSITION_CALIBRATION = {
  asOf: '2026-04-29',
  source: 'spec §10 default; per-asset-class backtest TBD per §14',
  calibrationStatus: 'tbd' as const,
  notes:
    'Half-lives are seed values pending historical comp-set backtests. ' +
    'Multifamily defaults (4.5yr premium / 6yr discount) match spec §10. ' +
    'Other asset classes are educated estimates and should be calibrated.',
} as const;

/** Resolve the half-life to use for a given spec, applying defaults. */
export function resolveHalfLife(spec: PositionAdjustmentSpec): number {
  if (spec.halfLifeYears && spec.halfLifeYears > 0) {
    return spec.halfLifeYears;
  }
  const cls = spec.assetClass ?? 'default';
  const table =
    POSITION_HALF_LIFE_DEFAULTS[cls] ?? POSITION_HALF_LIFE_DEFAULTS.default;
  return spec.initialPosition >= 0 ? table.premium : table.discount;
}

// ────────────────────────────────────────────────────────────────────────────
// Position evaluation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Position level at a given year (1-indexed). Year 0 returns the initial
 * position. Year 1 is the first forecast year. Returns the absolute
 * position (NOT the per-year delta).
 */
export function evaluatePositionAt(
  spec: PositionAdjustmentSpec,
  year: number,
): number {
  if (year <= 0) return spec.initialPosition;

  switch (spec.mode) {
    case 'mean_reverting': {
      const halfLife = resolveHalfLife(spec);
      if (halfLife <= 0) return 0; // degenerate — collapse immediately
      // Standard exponential decay with a half-life. Note we use natural
      // log base e here because spec §10 uses exp(−t / τ); τ here is the
      // time constant. To convert half-life to τ: τ = halfLife / ln(2).
      const tau = halfLife / Math.LN2;
      return spec.initialPosition * Math.exp(-year / tau);
    }
    case 'constant_gap':
      return spec.initialPosition;
    case 'widening': {
      const rate = spec.wideningRatePerYear ?? 0.01;
      return spec.initialPosition * Math.pow(1 + rate, year);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Per-year delta series (additive contribution to subject growth)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a per-year position-delta series for the layered rent growth model.
 * Each entry is a `ProvenancedValue<number>` where `value` is the
 * year-on-year change in position (position_t − position_{t-1}). This is
 * exactly what spec §10 says to add to submarket growth:
 *
 *   subject_growth_t = submarket_growth_t + (position_t − position_{t-1})
 *
 * Output array is length `horizonYears`, indexed Y1..Y{horizon}.
 */
export function derivePositionSeries(
  spec: PositionAdjustmentSpec,
  horizonYears: number,
): ProvenancedValue<number>[] {
  if (horizonYears <= 0) return [];

  const out: ProvenancedValue<number>[] = [];
  const halfLifeOrUndefined =
    spec.mode === 'mean_reverting' ? resolveHalfLife(spec) : undefined;

  for (let y = 1; y <= horizonYears; y++) {
    const prev = evaluatePositionAt(spec, y - 1);
    const curr = evaluatePositionAt(spec, y);
    const delta = curr - prev;

    let rationale: string;
    switch (spec.mode) {
      case 'mean_reverting':
        rationale =
          `position decay Y${y}: ${(prev * 100).toFixed(2)}% → ${(curr * 100).toFixed(2)}% ` +
          `(half-life ${halfLifeOrUndefined?.toFixed(1)}yr, mean-reverting)`;
        break;
      case 'constant_gap':
        rationale = `constant gap Y${y}: position held at ${(curr * 100).toFixed(2)}%`;
        break;
      case 'widening': {
        const rate = spec.wideningRatePerYear ?? 0.01;
        rationale =
          `position widening Y${y}: ${(prev * 100).toFixed(2)}% → ${(curr * 100).toFixed(2)}% ` +
          `(compound ${(rate * 100).toFixed(1)}%/yr — STRUCTURAL JUSTIFICATION REQUIRED)`;
        break;
      }
    }

    out.push(
      provenanced(
        delta,
        'platform',
        // Mean-reverting / constant-gap are well-grounded; widening is rare and
        // requires user justification, so confidence is lower.
        spec.mode === 'widening' ? 0.5 : 0.8,
        'derived',
        rationale,
      ),
    );
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Sugar for callers who want the "current" (year-1) additive contribution
// without building the full series.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Single-year additive position contribution for use as the `position`
 * field in `RentGrowthInputs` when the caller only needs one year. Equals
 * `position_year − position_{year-1}` for the supplied spec.
 */
export function positionContributionForYear(
  spec: PositionAdjustmentSpec,
  year: number,
): ProvenancedValue<number> {
  if (year <= 0) {
    return provenanced(0, 'platform', 1.0, 'derived', 'position contribution at Y0 = 0 by definition');
  }
  const prev = evaluatePositionAt(spec, year - 1);
  const curr = evaluatePositionAt(spec, year);
  return provenanced(
    curr - prev,
    'platform',
    spec.mode === 'widening' ? 0.5 : 0.8,
    'derived',
    `position contribution Y${year} = ${(curr - prev) * 100}bps (mode=${spec.mode})`,
  );
}
