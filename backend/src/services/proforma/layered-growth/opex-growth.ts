/**
 * Layered OPEX Growth Forecast (per-line)
 * =======================================
 *
 * Implements the F9 Pro Forma Architecture spec §7 — OPEX is NOT one
 * number. It's a stack of nine line items, each with its own anchor and
 * growth profile. Total OPEX growth is the dollar-weighted average of
 * line growth rates.
 *
 *   total_opex_growth(t) = Σ line_share_i * line_growth_i(t)
 *
 * Per line:
 *
 *   opex_line_growth(t) = w_m(t) * momentum
 *                       + w_c(t) * cycle
 *                       + w_a(t) * line_anchor
 *                       + Σ event_deltas(t)
 *                       + structural_overrides(t)
 *
 * Florida structural overrides (gated by deal.state === 'FL') hard-code
 * the four mandates that override smooth growth: 10% non-homestead cap
 * on property tax, reassess-on-sale Y1 STEP, and an insurance hurricane
 * premium. Mgmt fees auto-couple to revenue (no independent forecast).
 *
 * NOI growth identity (spec §7) is exposed as a helper so F9 can show
 * users how their rent + OPEX assumptions roll up.
 *
 * Pure module — no DB, no I/O.
 */

import {
  ProvenancedValue,
  provenanced,
  missing,
} from '../../../types/provenanced-value';
import {
  OPEX_LINE_ITEMS,
  type OpexLineKey,
} from '../blueprint/proforma-blueprint';
import {
  getRentGrowthWeights,
  type ComponentWeights,
} from './rent-growth';

// ────────────────────────────────────────────────────────────────────────────
// Per-line anchors (spec §7 line table — calibration TBD §14)
// ────────────────────────────────────────────────────────────────────────────

/** Default decimal anchor growth for each OPEX line when feed unavailable. */
export const DEFAULT_LINE_ANCHORS: Record<OpexLineKey, number> = {
  propertyTax: 0.04,         // county millage projections (placeholder)
  insurance: 0.07,           // NAIC regional + reinsurance hardening
  utilities: 0.03,           // EIA AEO baseline
  repairsMaintenance: 0.035, // BLS PPI construction
  managementFee: 0,          // auto-couples to revenue, not anchored
  payroll: 0.04,             // BLS ECI by metro
  marketingAdmin: 0.025,     // CPI all-items
  replacementReserves: 0.025,// per-unit + age curve
  other: 0.025,              // CPI all-items
};

/** Typical dollar share by line for stabilized FL multifamily (spec §7). */
export const DEFAULT_LINE_SHARES: Record<OpexLineKey, number> = {
  propertyTax: 0.18,
  insurance: 0.20,
  utilities: 0.09,
  repairsMaintenance: 0.10,
  managementFee: 0.04,
  payroll: 0.14,
  marketingAdmin: 0.03,
  replacementReserves: 0.13,
  other: 0.05,
  // sums to ~0.96; "other" absorbs rounding.
};

/**
 * Whether the line uses the rent-growth weight schedule (default) or a
 * custom one. Today every line uses the same schedule per spec — the type
 * leaves a hook for per-line tuning.
 */
export function getOpexLineWeights(
  _line: OpexLineKey,
  year: number,
): ComponentWeights {
  return getRentGrowthWeights(year);
}

// ────────────────────────────────────────────────────────────────────────────
// Florida structural overrides (spec §7)
// ────────────────────────────────────────────────────────────────────────────

/** Florida non-homestead annual cap on assessed-value increase. */
export const FL_NON_HOMESTEAD_CAP = 0.10;
/** Default coastal-FL hurricane premium uplift on insurance anchor. */
export const FL_HURRICANE_PREMIUM_UPLIFT = 0.08;

export interface FloridaOverrideContext {
  /** Was the deal acquired in this year? Triggers reassess-on-sale Y1 step. */
  acquiredThisYear: boolean;
  /** Pre-sale assessed value (for the Y1 step). */
  preSaleAssessedValue?: number;
  /** Purchase price (post-sale assessed value baseline). */
  purchasePrice?: number;
  /** Whether subject is in a coastal county — drives insurance premium. */
  coastal: boolean;
}

/**
 * Returns the structural override growth contribution for one OPEX line in
 * a given year, when the deal is in Florida. Returns 0 otherwise.
 */
export function computeFloridaStructuralOverride(
  line: OpexLineKey,
  year: number,
  ctx: FloridaOverrideContext,
): ProvenancedValue<number> {
  if (line === 'propertyTax') {
    if (year === 1 && ctx.acquiredThisYear) {
      // Y1 STEP: reassess-on-sale at purchase price. Step is the raw
      // (purchase / pre-sale) - 1 ratio, but capped by the 10% non-homestead
      // cap on the *post-step* growth — the cap applies to year-on-year
      // assessment moves, not to the step itself. The step is a one-time
      // re-anchoring; subsequent years are subject to the 10% cap.
      const pre = ctx.preSaleAssessedValue ?? 0;
      const px = ctx.purchasePrice ?? 0;
      if (pre > 0 && px > 0) {
        const step = px / pre - 1;
        return provenanced(
          step,
          'platform',
          0.9,
          'derived',
          `FL reassess-on-sale Y1 step: purchase $${px.toLocaleString()} vs pre-sale assessment $${pre.toLocaleString()} = ${(step * 100).toFixed(1)}%`,
        );
      }
      return provenanced(0, 'platform', 0.5, 'derived', 'FL Y1 step requested but assessed values missing');
    }
    // Years > 1 (or no acquisition this year): cap year-on-year growth.
    // The cap is a CEILING — applied downstream in computeOpexLineGrowth as
    // a min(line_growth, 0.10). We emit 0 here because the cap is applied
    // post-composition.
    return provenanced(0, 'platform', 1.0, 'derived', 'FL 10% non-homestead cap applied as ceiling, not delta');
  }

  if (line === 'insurance' && ctx.coastal) {
    // Hurricane premium is an uplift on the anchor — modelled here as a
    // structural additive to growth in the first 3 years (when reinsurance
    // hardening is felt most acutely), tapering off.
    const decay = Math.max(0, 1 - (year - 1) * 0.33);
    const uplift = FL_HURRICANE_PREMIUM_UPLIFT * decay;
    return provenanced(
      uplift,
      'platform',
      0.7,
      'derived',
      `FL coastal hurricane premium uplift Y${year}: +${(uplift * 100).toFixed(1)}%`,
    );
  }

  return provenanced(0, 'platform', 1.0, 'derived', 'no FL structural override for this line');
}

// ────────────────────────────────────────────────────────────────────────────
// Per-line growth computation
// ────────────────────────────────────────────────────────────────────────────

export interface OpexLineInputs {
  line: OpexLineKey;
  /** Forecast year (1-indexed). */
  year: number;
  /** Trailing 12-month actual growth from M22 / M18 / library fallback. */
  momentum: ProvenancedValue<number> | null;
  /** Line-specific cycle pressure (e.g. reinsurance hardening for insurance). */
  cycle: ProvenancedValue<number> | null;
  /** Line-specific anchor — uses DEFAULT_LINE_ANCHORS when null. */
  anchor: ProvenancedValue<number> | null;
  /** Correlation Engine event deltas active in this year for this line. */
  eventDeltas: Array<ProvenancedValue<number>>;
  /** Structural override (FL) — typically computed via computeFloridaStructuralOverride. */
  structuralOverride: ProvenancedValue<number>;
  /** Florida ceiling toggle — when true, property tax growth is capped at 10%. */
  applyFloridaPropertyTaxCap?: boolean;
}

export interface LayeredOpexLineResult {
  line: OpexLineKey;
  year: number;
  growth: ProvenancedValue<number>;
  contributions: {
    momentum: number;
    cycle: number;
    anchor: number;
    eventDeltas: number;
    structuralOverride: number;
  };
  weights: ComponentWeights;
  /** True when the FL property tax 10% cap clipped the result. */
  ceilingApplied: boolean;
}

/**
 * Mgmt-fee auto-couple helper — passes through revenue growth so the line
 * grows with EGI without a separate model. Caller supplies the revenue
 * growth ProvenancedValue and the function wraps it in a result row.
 */
export function computeManagementFeeGrowth(
  year: number,
  revenueGrowth: ProvenancedValue<number> | null,
): LayeredOpexLineResult {
  const w = getOpexLineWeights('managementFee', year);
  const value = revenueGrowth?.value ?? 0;
  return {
    line: 'managementFee',
    year,
    growth: provenanced(
      value,
      'platform',
      revenueGrowth?.confidence ?? 0.5,
      'derived',
      'mgmt fee auto-couples to revenue growth (% of EGI)',
    ),
    contributions: {
      momentum: 0,
      cycle: 0,
      anchor: 0,
      eventDeltas: 0,
      structuralOverride: value,
    },
    weights: w,
    ceilingApplied: false,
  };
}

export function computeOpexLineGrowth(inputs: OpexLineInputs): LayeredOpexLineResult {
  const w = getOpexLineWeights(inputs.line, inputs.year);

  const momentumVal = inputs.momentum?.value ?? null;
  const cycleVal = inputs.cycle?.value ?? null;
  const anchorVal =
    inputs.anchor?.value ?? DEFAULT_LINE_ANCHORS[inputs.line] ?? 0.025;

  const eventDeltasSum = inputs.eventDeltas
    .filter((d) => d != null && d.value !== null)
    .reduce((s, d) => s + (d.value ?? 0), 0);

  const structuralVal = inputs.structuralOverride.value ?? 0;

  const contributions = {
    momentum: w.momentum * (momentumVal ?? 0),
    cycle: w.cycle * (cycleVal ?? 0),
    anchor: w.anchor * anchorVal,
    eventDeltas: eventDeltasSum,
    structuralOverride: structuralVal,
  };

  let total =
    contributions.momentum +
    contributions.cycle +
    contributions.anchor +
    contributions.eventDeltas +
    contributions.structuralOverride;

  // FL 10% non-homestead cap on property tax YoY growth (post-Y1).
  let ceilingApplied = false;
  if (
    inputs.applyFloridaPropertyTaxCap &&
    inputs.line === 'propertyTax' &&
    inputs.year > 1 &&
    total > FL_NON_HOMESTEAD_CAP
  ) {
    total = FL_NON_HOMESTEAD_CAP;
    ceilingApplied = true;
  }

  // Composite confidence — weighted average of available component confidences.
  const componentConfs = [
    { val: momentumVal, conf: inputs.momentum?.confidence ?? 0, w: w.momentum },
    { val: cycleVal, conf: inputs.cycle?.confidence ?? 0, w: w.cycle },
    { val: anchorVal, conf: inputs.anchor?.confidence ?? 0.6, w: w.anchor },
  ].filter((x) => x.val !== null);
  const composedConfidence =
    componentConfs.length === 0
      ? 0.3
      : componentConfs.reduce((s, x) => s + x.w * x.conf, 0) /
        componentConfs.reduce((s, x) => s + x.w, 0);

  return {
    line: inputs.line,
    year: inputs.year,
    growth: provenanced(
      total,
      'platform',
      Math.max(0, Math.min(1, composedConfidence)),
      'derived',
      `OPEX ${inputs.line} Y${inputs.year} layered growth (m=${(contributions.momentum * 10000).toFixed(0)}bp, c=${(contributions.cycle * 10000).toFixed(0)}bp, a=${(contributions.anchor * 10000).toFixed(0)}bp, ev=${(contributions.eventDeltas * 10000).toFixed(0)}bp, str=${(contributions.structuralOverride * 10000).toFixed(0)}bp${ceilingApplied ? ', cap_applied' : ''})`,
    ),
    contributions,
    weights: w,
    ceilingApplied,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Total OPEX growth — dollar-weighted average across lines
// ────────────────────────────────────────────────────────────────────────────

export interface TotalOpexGrowthInputs {
  /** Per-line results for the year. */
  lineResults: LayeredOpexLineResult[];
  /** Dollar share by line. Sums need not equal 1 — they're normalised. */
  lineShares?: Partial<Record<OpexLineKey, number>>;
}

export interface TotalOpexGrowthResult {
  year: number;
  totalGrowth: ProvenancedValue<number>;
  perLine: Record<OpexLineKey, number>;
}

export function computeTotalOpexGrowth(
  inputs: TotalOpexGrowthInputs,
): TotalOpexGrowthResult {
  if (inputs.lineResults.length === 0) {
    throw new Error('computeTotalOpexGrowth: no line results provided');
  }
  const year = inputs.lineResults[0].year;
  const shares = inputs.lineShares ?? DEFAULT_LINE_SHARES;
  const totalShare = Object.values(shares).reduce<number>(
    (s, v) => s + (v ?? 0),
    0,
  );
  if (totalShare <= 0) {
    throw new Error('computeTotalOpexGrowth: line shares sum to zero');
  }

  const perLine: Record<string, number> = {};
  let weighted = 0;
  let confSum = 0;
  let confDenom = 0;

  for (const r of inputs.lineResults) {
    const share = (shares[r.line] ?? 0) / totalShare;
    const g = r.growth.value ?? 0;
    perLine[r.line] = g;
    weighted += share * g;
    confSum += share * r.growth.confidence;
    confDenom += share;
  }

  return {
    year,
    totalGrowth: provenanced(
      weighted,
      'platform',
      confDenom > 0 ? confSum / confDenom : 0.5,
      'derived',
      `total OPEX growth Y${year} = $-weighted avg of ${inputs.lineResults.length} lines`,
    ),
    perLine: perLine as Record<OpexLineKey, number>,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// NOI growth identity (spec §7)
// ────────────────────────────────────────────────────────────────────────────

/**
 * The identity that surfaces in F9:
 *
 *   NOI_growth = (rent_growth − opex_growth × (1 − NOI_margin)) / NOI_margin
 *
 * Returns null when NOI margin is 0 (degenerate). Returns a ProvenancedValue
 * so F9 can render with a confidence badge.
 *
 * Example (FL multifamily, 60% NOI margin baseline):
 *   rent +3.0%, opex +5.2%
 *   noi = (0.03 − 0.052 × 0.4) / 0.6 ≈ 0.0153
 */
export function noiGrowthIdentity(
  rentGrowth: ProvenancedValue<number> | null,
  opexGrowth: ProvenancedValue<number> | null,
  noiMargin: number,
): ProvenancedValue<number> {
  if (noiMargin <= 0 || noiMargin > 1) {
    return missing<number>(`NOI margin out of range: ${noiMargin}`);
  }
  if (!rentGrowth || rentGrowth.value === null || !opexGrowth || opexGrowth.value === null) {
    return missing<number>('rent or OPEX growth missing — cannot compute NOI identity');
  }
  const r = rentGrowth.value;
  const o = opexGrowth.value;
  const opexShare = 1 - noiMargin;
  const noiG = (r - o * opexShare) / noiMargin;
  const conf = Math.min(rentGrowth.confidence, opexGrowth.confidence);
  return provenanced(
    noiG,
    'platform',
    conf,
    'derived',
    `NOI identity: (${(r * 100).toFixed(2)}% − ${(o * 100).toFixed(2)}%×${(opexShare * 100).toFixed(0)}%) / ${(noiMargin * 100).toFixed(0)}% = ${(noiG * 100).toFixed(2)}%`,
  );
}

// Re-export OPEX line keys list for convenience.
export const OPEX_LINE_KEYS: readonly OpexLineKey[] = OPEX_LINE_ITEMS.map(
  (l) => l.key,
);
