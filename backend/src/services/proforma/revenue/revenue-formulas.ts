/**
 * Pro Forma Revenue Formulas
 * ==========================
 *
 * Implements F9 Pro Forma Architecture spec §11. The user picks among
 * three revenue projection formulas; the choice itself is a layered
 * deal-level value (`revenue_formula`) so it persists with provenance.
 *
 *   SIMPLE
 *     revenue_t = units × rent_0 × (1 + g)^t
 *
 *   MARK_TO_MARKET (recommended for deals with significant LTL)
 *     revenue_t = (in_place × in_place_rent × (1 + escalator)^t)
 *               + (turnover_t × market_rent_t × (1 + g(t))^t)
 *
 *     turnover_t = total_units × (1 − renewal_rate)
 *
 *   RENEWAL_AWARE (most detailed — Tier 3)
 *     revenue_t = (renewing × in_place_rent × (1 + g_renewal(t)))
 *               + (new_leases × market_rent_t)
 *
 *     where g_renewal ≠ g_market in tight markets (concession-heavy
 *     renewals to retain tenants). The new-lease leg uses `market_rent_t`
 *     directly because callers pass an already-trended year-t value
 *     (`CommonRevenueInputs.marketRent`); applying `(1 + g_market)` again
 *     would double-count growth — see the `marketRent` field doc below.
 *
 * Pure module — no DB, no I/O. All inputs are scalars or
 * ProvenancedValue<number>; outputs are ProvenancedValue<number>.
 */

import {
  ProvenancedValue,
  provenanced,
  missing,
} from '../../../types/provenanced-value';

// ────────────────────────────────────────────────────────────────────────────
// Renewal-rate baselines (spec §14 — calibration TBD)
// ────────────────────────────────────────────────────────────────────────────

export type MarketType = 'urban' | 'suburban' | 'secondary' | 'tertiary';

/**
 * Baseline renewal rate (decimal, 0-1) by asset class × market type.
 * Used by mark-to-market and renewal-aware formulas when the deal does
 * not provide a rent-roll-derived renewal rate.
 *
 * Default values per spec §14 — calibrate from historical lease data.
 *   - Multifamily urban: ~50% (high churn — lifestyle moves)
 *   - Multifamily suburban: ~58% (more stable)
 *   - Multifamily secondary: ~62% (lower turnover)
 *   - Retail: ~75% (long leases, high switching cost for tenants)
 *   - Office: ~70% (tenant improvement moats)
 *   - Industrial: ~80% (purpose-built, sticky)
 *   - STR: not applicable (booking-by-booking)
 */
export const RENEWAL_RATE_BASELINES: Record<
  string,
  Partial<Record<MarketType, number>>
> = {
  multifamily: {
    urban: 0.50,
    suburban: 0.58,
    secondary: 0.62,
    tertiary: 0.65,
  },
  retail: {
    urban: 0.72,
    suburban: 0.75,
    secondary: 0.78,
    tertiary: 0.80,
  },
  office: {
    urban: 0.68,
    suburban: 0.70,
    secondary: 0.72,
    tertiary: 0.75,
  },
  industrial: {
    urban: 0.78,
    suburban: 0.80,
    secondary: 0.82,
    tertiary: 0.85,
  },
  str: {}, // n/a — booking-by-booking
  flip: {}, // n/a — no operating phase
  land: {}, // n/a
};

export const RENEWAL_BASELINE_CALIBRATION = {
  asOf: '2026-04-29',
  source: 'spec §14 default; per-market backtest TBD',
  calibrationStatus: 'tbd' as const,
  notes:
    'Baselines are seed values. Calibrate from owner historical lease data ' +
    'when available; surface as INFERRED ProvenancedValue when used.',
} as const;

/**
 * Resolve a renewal-rate baseline for the (assetClass, marketType) pair.
 * Returns 0.55 when both lookups miss — a defensible "moderate churn"
 * default that errs toward more turnover (higher mark-to-market gain).
 */
export function lookupRenewalRateBaseline(
  assetClass: string,
  marketType: MarketType,
): number {
  return RENEWAL_RATE_BASELINES[assetClass]?.[marketType] ?? 0.55;
}

// ────────────────────────────────────────────────────────────────────────────
// Common inputs
// ────────────────────────────────────────────────────────────────────────────

export interface CommonRevenueInputs {
  /** Forecast year (1-indexed). */
  year: number;
  /** Total stabilized unit count. */
  units: number;
  /** Year-1 in-place rent per unit per period (matches periodicity). */
  inPlaceRent: number;
  /** Year-t market rent per unit (caller has already trended; pass year-t value). */
  marketRent: number;
  /** Year-t market rent growth (decimal). */
  marketGrowth: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Formula implementations
// ────────────────────────────────────────────────────────────────────────────

/**
 * SIMPLE — uniform growth, fastest, least accurate. Use for screening.
 *
 *   revenue_t = units × rent_0 × (1 + g)^t
 *
 * Note: caller passes the year. We use `marketGrowth` as `g` and treat
 * `inPlaceRent` as `rent_0`.
 */
export function computeSimpleRevenue(
  inputs: CommonRevenueInputs,
): ProvenancedValue<number> {
  if (inputs.units <= 0 || inputs.inPlaceRent <= 0) {
    return missing<number>('simple revenue requires positive units + rent');
  }
  const value =
    inputs.units * inputs.inPlaceRent * Math.pow(1 + inputs.marketGrowth, inputs.year);
  return provenanced(
    value,
    'platform',
    0.6,
    'derived',
    `simple revenue Y${inputs.year}: ${inputs.units} units × $${inputs.inPlaceRent} × (1+${(inputs.marketGrowth * 100).toFixed(2)}%)^${inputs.year}`,
  );
}

/**
 * MARK-TO-MARKET — recommended for deals with significant loss-to-lease.
 *
 *   revenue_t = (in_place × in_place_rent × (1 + escalator)^t)
 *             + (turnover_t × market_rent_t)
 *
 *   turnover_t = units × (1 − renewal_rate)
 *   in_place   = units × renewal_rate
 *
 * `escalator` is the contractual annual lease bump on in-place leases.
 */
export interface MarkToMarketInputs extends CommonRevenueInputs {
  /** Renewal rate (decimal, 0-1). Falls back to baseline if not supplied. */
  renewalRate: number;
  /** Annual escalator applied to in-place rent (decimal). */
  escalator: number;
}

export function computeMarkToMarketRevenue(
  inputs: MarkToMarketInputs,
): ProvenancedValue<number> {
  if (inputs.units <= 0) {
    return missing<number>('M2M revenue requires positive units');
  }
  const renewal = clamp(inputs.renewalRate, 0, 1);
  const inPlaceUnits = inputs.units * renewal;
  const turnoverUnits = inputs.units * (1 - renewal);

  const inPlaceContrib =
    inPlaceUnits *
    inputs.inPlaceRent *
    Math.pow(1 + inputs.escalator, inputs.year);
  const turnoverContrib = turnoverUnits * inputs.marketRent;

  const value = inPlaceContrib + turnoverContrib;
  return provenanced(
    value,
    'platform',
    0.75,
    'derived',
    `M2M revenue Y${inputs.year}: in-place ${inPlaceUnits.toFixed(1)}u @ $${inputs.inPlaceRent}×(1+${(inputs.escalator * 100).toFixed(2)}%)^${inputs.year} + turnover ${turnoverUnits.toFixed(1)}u @ $${inputs.marketRent}`,
  );
}

/**
 * RENEWAL-AWARE — splits new leases vs renewals with separate growth rates.
 *
 *   revenue_t = (renewing × in_place_rent × (1 + g_renewal))
 *             + (new_leases × market_rent × (1 + g_market))
 *
 * Most detailed — best for stabilized portfolios with detailed rent roll
 * and renewal history.
 */
export interface RenewalAwareInputs extends CommonRevenueInputs {
  /** Renewal rate (decimal, 0-1). Falls back to baseline if not supplied. */
  renewalRate: number;
  /** Renewal-specific rent growth (decimal). Typically softer than market. */
  renewalGrowth: number;
}

export function computeRenewalAwareRevenue(
  inputs: RenewalAwareInputs,
): ProvenancedValue<number> {
  if (inputs.units <= 0) {
    return missing<number>('renewal-aware revenue requires positive units');
  }
  const renewal = clamp(inputs.renewalRate, 0, 1);
  const renewingUnits = inputs.units * renewal;
  const newLeaseUnits = inputs.units * (1 - renewal);

  const renewingContrib =
    renewingUnits * inputs.inPlaceRent * (1 + inputs.renewalGrowth);
  // `marketRent` is year-t (already trended by caller per the
  // CommonRevenueInputs contract), so we DO NOT multiply by
  // (1 + marketGrowth) again — that would double-count growth.
  const newLeaseContrib = newLeaseUnits * inputs.marketRent;

  const value = renewingContrib + newLeaseContrib;
  return provenanced(
    value,
    'platform',
    0.8,
    'derived',
    `renewal-aware revenue Y${inputs.year}: ` +
      `renewing ${renewingUnits.toFixed(1)}u @ $${inputs.inPlaceRent} × (1+${(inputs.renewalGrowth * 100).toFixed(2)}%) + ` +
      `new ${newLeaseUnits.toFixed(1)}u @ year-t market $${inputs.marketRent}`,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
