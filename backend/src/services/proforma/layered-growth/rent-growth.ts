/**
 * Layered Rent Growth Forecast
 * ============================
 *
 * Implements the F9 Pro Forma Architecture spec §6 — five-component model
 * that mean-reverts to a long-run anchor across the forecast horizon.
 *
 *     g(t) = w_m(t) * momentum
 *          + w_c(t) * cycle
 *          + w_a(t) * anchor
 *          + Σ event_deltas(t)
 *          + position(t)
 *
 * CPI is the LONG-RUN anchor, not the forecast itself. Using all-items CPI
 * as the forecast is circular (CPI already includes shelter). CPI shelter
 * sub-index plus a small asset-class spread (~30 bps for multifamily) is
 * what we anchor against. Weights mean-revert across horizon: momentum
 * dominates Y1, cycle peaks Y1-Y3, anchor dominates Y5+.
 *
 * Each component returns a `ProvenancedValue<number>` so the caller knows
 * (a) the value, (b) where it came from, (c) how confident we are, and
 * (d) what UI badge to show.
 *
 * This module is PURE — no DB, no I/O. Inputs come from the data-flow
 * router (M04 supply, M05 market, M06 demand, M15 comps, M14 risk, M22
 * actuals, BLS feeds). Outputs are consumed by the proforma engine and
 * by the dealStore.confidenceBands slice.
 */

import {
  ProvenancedValue,
  provenanced,
  missing,
} from '../../../types/provenanced-value';

// ────────────────────────────────────────────────────────────────────────────
// Asset-class anchor spreads (spec §6 — calibration TBD per §14)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Long-run spread above CPI shelter for each asset class. Default values
 * pending backtest calibration (spec §14). Multifamily ~30 bps over 30+ yr.
 */
export const ASSET_CLASS_SPREAD_BPS: Record<string, number> = {
  multifamily: 30,
  retail: 50,
  office: 0,
  industrial: 80,
  str: 100,
  flip: 0,
  land: 0,
  default: 30,
};

// ────────────────────────────────────────────────────────────────────────────
// Weight schedule — mean-reverts to anchor across horizon
// ────────────────────────────────────────────────────────────────────────────

export interface ComponentWeights {
  momentum: number;
  cycle: number;
  anchor: number;
}

/**
 * Weight curves per spec §6:
 *   - momentum (w_m): high Y1, fades to ~0 by Y3
 *   - cycle    (w_c): peaks Y1-Y3, decays after
 *   - anchor   (w_a): small early, dominates Y5+
 *
 * Deterministic, normalised so the three sum to 1.0 in every year.
 */
export function getRentGrowthWeights(year: number): ComponentWeights {
  if (year < 1) year = 1;

  // Raw curves (un-normalised)
  const momentum = Math.max(0, 1 - (year - 1) * 0.45);     // 1.0, 0.55, 0.10, 0, 0
  const cycle = Math.max(0, 0.6 - Math.abs(year - 2) * 0.15); // peaks at Y2 = 0.6
  const anchor = Math.min(1, 0.15 + (year - 1) * 0.18);    // grows to 1.0+ by Y5

  const total = momentum + cycle + anchor;
  return {
    momentum: momentum / total,
    cycle: cycle / total,
    anchor: anchor / total,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Component inputs (see spec §6 for source modules)
// ────────────────────────────────────────────────────────────────────────────

export interface RentGrowthInputs {
  /** Forecast year (1-indexed). */
  year: number;
  /** Total horizon in years (informational). */
  horizonYears: number;
  /** Asset class — drives anchor spread. */
  assetClass: string;
  /** M15 comp set — 12-month asking rent trend (decimal, e.g. 0.04 = 4%). */
  momentum: ProvenancedValue<number> | null;
  /** M04 supply + M06 demand — pressure index (-1 to +1). Mapped to growth bp. */
  cyclePressureIndex: ProvenancedValue<number> | null;
  /** BLS CPI shelter YoY rate (decimal). */
  cpiShelterYoY: ProvenancedValue<number> | null;
  /** Correlation Engine event deltas, in decimal points (e.g. 0.008 = +80 bps). */
  eventDeltas: Array<ProvenancedValue<number>>;
  /** M15-driven submarket position adjustment in decimal (additive to growth). */
  position: ProvenancedValue<number> | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Component computations
// ────────────────────────────────────────────────────────────────────────────

/** 1. MOMENTUM — pass-through of comp-set 12-month asking rent trend. */
export function computeMomentum(
  inputs: RentGrowthInputs,
): ProvenancedValue<number> {
  if (!inputs.momentum || inputs.momentum.value === null) {
    return missing<number>('momentum signal not available — comp set has no 12-mo trend');
  }
  return inputs.momentum;
}

/**
 * 2. CYCLE — converts pressure index in [-1, +1] into a growth contribution
 *    in decimal. Saturated at ±150 bps (typical max swing of cycle component).
 */
export function computeCycle(
  inputs: RentGrowthInputs,
  saturationBps = 150,
): ProvenancedValue<number> {
  if (!inputs.cyclePressureIndex || inputs.cyclePressureIndex.value === null) {
    return missing<number>('cycle pressure index not available');
  }
  const idx = clamp(inputs.cyclePressureIndex.value, -1, 1);
  const value = idx * (saturationBps / 10000);
  return {
    ...inputs.cyclePressureIndex,
    value,
    rationale: `cycle = pressure_index(${idx.toFixed(2)}) × saturation(${saturationBps}bps)`,
  };
}

/**
 * 3. ANCHOR — CPI shelter YoY plus asset-class spread. Spread is calibrated
 *    per spec §14 (currently default values).
 */
export function computeAnchor(
  inputs: RentGrowthInputs,
): ProvenancedValue<number> {
  if (!inputs.cpiShelterYoY || inputs.cpiShelterYoY.value === null) {
    return missing<number>('BLS CPI shelter sub-index unavailable');
  }
  const spreadBps =
    ASSET_CLASS_SPREAD_BPS[inputs.assetClass] ??
    ASSET_CLASS_SPREAD_BPS.default;
  const value = inputs.cpiShelterYoY.value + spreadBps / 10000;
  return {
    ...inputs.cpiShelterYoY,
    value,
    rationale: `anchor = CPI_shelter(${(inputs.cpiShelterYoY.value * 100).toFixed(2)}%) + class_spread(${spreadBps}bps)`,
  };
}

/**
 * 4. EVENT DELTAS — sum of all Correlation Engine firings active in this
 *    year. Each delta has its own decay function applied upstream by the
 *    Correlation Engine; this just sums the resolved values.
 */
export function computeEventDeltasSum(
  inputs: RentGrowthInputs,
): ProvenancedValue<number> {
  const validDeltas = inputs.eventDeltas.filter(
    (d): d is ProvenancedValue<number> => d != null && d.value !== null,
  );
  if (validDeltas.length === 0) {
    return provenanced(0, 'platform', 1.0, 'derived', 'no active event deltas');
  }
  const total = validDeltas.reduce((sum, d) => sum + (d.value ?? 0), 0);
  // Confidence is the minimum of the deltas (weakest link).
  const minConfidence = Math.min(...validDeltas.map((d) => d.confidence));
  return provenanced(
    total,
    'platform',
    minConfidence,
    'derived',
    `sum of ${validDeltas.length} active event delta(s)`,
  );
}

/** 5. POSITION — additive subject vs comp-set spread (spec §10). */
export function computePosition(
  inputs: RentGrowthInputs,
): ProvenancedValue<number> {
  if (!inputs.position || inputs.position.value === null) {
    // Position adjustment defaults to 0 with high confidence — "no premium / discount".
    return provenanced(0, 'platform', 0.9, 'derived', 'position adjustment defaulted to 0');
  }
  return inputs.position;
}

// ────────────────────────────────────────────────────────────────────────────
// Composite layered growth
// ────────────────────────────────────────────────────────────────────────────

export interface LayeredRentGrowthResult {
  /** Forecast year (1-indexed). */
  year: number;
  /** Resolved decimal growth rate (e.g. 0.034 = 3.4%). */
  growth: ProvenancedValue<number>;
  /** Per-component contributions, post-weighting. */
  contributions: {
    momentum: number;
    cycle: number;
    anchor: number;
    eventDeltas: number;
    position: number;
  };
  /** Weight schedule used. */
  weights: ComponentWeights;
}

export function computeLayeredRentGrowth(
  inputs: RentGrowthInputs,
): LayeredRentGrowthResult {
  const w = getRentGrowthWeights(inputs.year);

  const momentum = computeMomentum(inputs);
  const cycle = computeCycle(inputs);
  const anchor = computeAnchor(inputs);
  const eventDeltas = computeEventDeltasSum(inputs);
  const position = computePosition(inputs);

  // Each weighted component contributes to total growth. Missing components
  // contribute 0 — we don't refuse the forecast just because momentum is
  // unavailable; the weight redistributes naturally because anchor still
  // pulls things toward CPI.
  const contributions = {
    momentum: w.momentum * (momentum.value ?? 0),
    cycle: w.cycle * (cycle.value ?? 0),
    anchor: w.anchor * (anchor.value ?? 0),
    eventDeltas: eventDeltas.value ?? 0,
    position: position.value ?? 0,
  };

  const totalGrowth =
    contributions.momentum +
    contributions.cycle +
    contributions.anchor +
    contributions.eventDeltas +
    contributions.position;

  // Composite confidence = weighted average of component confidences,
  // weighted by the corresponding w_i. Fallback to 0.5 when all are missing.
  const components = [
    { c: momentum, w: w.momentum },
    { c: cycle, w: w.cycle },
    { c: anchor, w: w.anchor },
  ];
  const validComponents = components.filter((x) => x.c.value !== null);
  const composedConfidence =
    validComponents.length === 0
      ? 0.3
      : validComponents.reduce((acc, x) => acc + x.w * x.c.confidence, 0) /
        validComponents.reduce((acc, x) => acc + x.w, 0);

  return {
    year: inputs.year,
    growth: provenanced(
      totalGrowth,
      'platform',
      Math.max(0, Math.min(1, composedConfidence)),
      'derived',
      `layered rent growth Y${inputs.year} (m=${(contributions.momentum * 10000).toFixed(0)}bp, c=${(contributions.cycle * 10000).toFixed(0)}bp, a=${(contributions.anchor * 10000).toFixed(0)}bp, ev=${(contributions.eventDeltas * 10000).toFixed(0)}bp, pos=${(contributions.position * 10000).toFixed(0)}bp)`,
    ),
    contributions,
    weights: w,
  };
}

/** Run the layered model across the full forecast horizon. */
export function projectRentGrowthSeries(
  baseInputs: Omit<RentGrowthInputs, 'year'>,
  horizonYears: number,
): LayeredRentGrowthResult[] {
  const out: LayeredRentGrowthResult[] = [];
  for (let y = 1; y <= horizonYears; y++) {
    out.push(computeLayeredRentGrowth({ ...baseInputs, year: y }));
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}
