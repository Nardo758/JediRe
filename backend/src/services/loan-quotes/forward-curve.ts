/**
 * forward-curve.ts
 * Component 2b: Forward curve fetcher + interpolation.
 *
 * The forward curve serves TWO distinct roles — do not conflate them:
 *
 * ### Role 1 — FIXED-rate pricing (one lookup, then locked)
 * A fixed-rate term loan prices off the term point at origination, then the
 * rate is locked for the hold. The curve tells you what rate to set on day
 * one; after that it's irrelevant to that loan. `term_index(N)` interpolates
 * the tenor grid to the loan's term. Provenance: which curve point + date
 * drove the rate.
 *
 * ### Role 2 — FLOATING-rate PROJECTION (the whole cash flow, period by period)
 * This is where the curve is load-bearing, not a refinement. A SOFR + spread
 * loan has a rate that changes every period. Projecting its debt service
 * across the hold requires the market's expected SOFR PATH — which IS the
 * forward curve. This is not pricing; it's the cash-flow projection itself.
 *
 * Per-period rate: each month carries a different rate = forward SOFR at that
 * month + spread. The debt-service line becomes curve-driven, not constant.
 *
 * Fixed↔floating transition (the common multifamily story): float during
 * lease-up, refinance into fixed agency debt at stabilization. The transition
 * month ties to monthsToStabilize (Finding Z).
 *
 * Rate caps: floating borrowers buy interest-rate caps; cap cost (upfront) and
 * payoff (when SOFR > strike) are functions of the forward curve vs the strike.
 *
 * Honest-absence invariant: if the curve series is stale/missing, return null
 * with reason — never silently fall back to spot or to a flat-rate assumption.
 *
 * Source: FRED treasury constant-maturity series (DGS5, DGS7, DGS10, DGS30) +
 * SOFR term structure, assembled in DebtContext (B6).
 */

// ============================================================================
// Tenor Point
// ============================================================================

/**
 * A single point on the tenor grid: a maturity year and its market rate.
 */
export interface TenorPoint {
  /** Tenor in years, e.g. 5, 7, 10, 30. */
  tenorYears: number;

  /** Market rate at this tenor (decimal, e.g. 0.0427 for 4.27%). */
  rate: number;

  /** FRED series code or source identifier, e.g. 'DGS5', 'DGS7', 'DGS10', 'DGS30'. */
  seriesCode: string;
}

// ============================================================================
// Forward Curve
// ============================================================================

/**
 * The forward curve assembled from FRED (or other source).
 * Serves as the tenor grid for term_index interpolation.
 */
export interface ForwardCurve {
  /** Ordered tenor points (typically 5yr, 7yr, 10yr, 30yr). */
  tenorPoints: TenorPoint[];

  /** Data source, e.g. 'FRED_DGS'. */
  source: string;

  /** ISO 8601 timestamp when the curve was fetched. */
  fetchedAt: string;

  /**
   * Hours after which the curve is considered stale.
   * Treasury/SOFR series update daily; default 24h.
   * Open question #7 in spec.
   */
  staleThresholdHours: number;

  /**
   * Which index basis this curve represents: 'treasury' for spread-over-treasury
   * quotes (CMT), 'sofr' for ARM/floating quotes. The resolver reads the quote's
   * own index_basis field to decide which curve to use.
   */
  indexBasis: 'treasury' | 'sofr';
}

// ============================================================================
// Fetch Forward Curve
// ============================================================================

/**
 * Fetch the current forward curve from FRED (or return mock data in stub).
 *
 * TODO: Replace mock data with real FRED API call:
 *   - DGS5  (5-Year Treasury Constant Maturity Rate)
 *   - DGS7  (7-Year Treasury Constant Maturity Rate)
 *   - DGS10 (10-Year Treasury Constant Maturity Rate)
 *   - DGS30 (30-Year Treasury Constant Maturity Rate)
 *
 * Mock data reflects 2024-06-25 reference fixture (flat/inverted curve):
 *   5T 4.27%, 7T 4.24%, 10T 4.31%, 30T 4.45%.
 */
export async function fetchForwardCurve(): Promise<ForwardCurve> {
  // TODO: Integrate with FRED API (fred.stlouisfed.org).
  // For the stub, return the reference fixture rates.
  const mockTenorPoints: TenorPoint[] = [
    { tenorYears: 5, rate: 0.0427, seriesCode: 'DGS5' },
    { tenorYears: 7, rate: 0.0424, seriesCode: 'DGS7' },
    { tenorYears: 10, rate: 0.0431, seriesCode: 'DGS10' },
    { tenorYears: 30, rate: 0.0445, seriesCode: 'DGS30' },
  ];

  return {
    tenorPoints: mockTenorPoints,
    source: 'FRED_DGS_STUB',
    fetchedAt: new Date().toISOString(),
    staleThresholdHours: 24,
    indexBasis: 'treasury',
  };
}

// ============================================================================
// Interpolation
// ============================================================================

/**
 * Linearly interpolate a rate for a target tenor between two tenor points.
 *
 * @param targetYears — target tenor in years (e.g. 8 for an 8-year loan)
 * @param curve — the forward curve with tenor points
 * @returns interpolated rate (decimal), or null if target is outside range
 */
export function interpolateRate(targetYears: number, curve: ForwardCurve): number | null {
  const points = curve.tenorPoints;
  if (points.length === 0) return null;

  // Sort ascending by tenorYears
  const sorted = [...points].sort((a, b) => a.tenorYears - b.tenorYears);

  // Exact match
  const exact = sorted.find((p) => p.tenorYears === targetYears);
  if (exact) return exact.rate;

  // Below minimum — don't extrapolate below shortest tenor
  if (targetYears < sorted[0].tenorYears) return null;

  // Above maximum — don't extrapolate above longest tenor
  if (targetYears > sorted[sorted.length - 1].tenorYears) return null;

  // Find bracket
  let lower = sorted[0];
  let upper = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (targetYears >= sorted[i].tenorYears && targetYears <= sorted[i + 1].tenorYears) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  const t = (targetYears - lower.tenorYears) / (upper.tenorYears - lower.tenorYears);
  return lower.rate + t * (upper.rate - lower.rate);
}

// ============================================================================
// Staleness Check
// ============================================================================

/**
 * Check whether the forward curve is stale based on fetchedAt and threshold.
 *
 * @param curve — the forward curve to check
 * @returns true if the curve is stale
 */
export function isStale(curve: ForwardCurve): boolean {
  const now = Date.now();
  const thresholdMs = (curve.staleThresholdHours ?? 24) * 60 * 60 * 1000;
  const fetchedAtMs = new Date(curve.fetchedAt).getTime();
  return now - fetchedAtMs > thresholdMs;
}

// ============================================================================
// Term Index (resolver-facing wrapper)
// ============================================================================

/**
 * Get the term index for a given loan term and index basis.
 * Returns the interpolated rate from the curve, or null if the curve is stale
 * or the target term cannot be interpolated.
 *
 * This is the primary entry point for the pricing resolver (Role 1).
 * For Role 2 (floating projection), use `interpolateRate` directly per period.
 *
 * @param termYears — loan term in years
 * @param curve — forward curve
 * @param indexBasis — which basis the quote prices off (must match curve)
 * @returns interpolated rate (decimal) or null
 */
export function getTermIndex(
  termYears: number,
  curve: ForwardCurve,
  indexBasis: string
): number | null {
  // Honest-absence: stale curve
  if (isStale(curve)) {
    return null;
  }

  // TODO: Support SOFR term structure once available.
  // For now, treasury curve is the only implemented basis.
  if (indexBasis.startsWith('treasury') || indexBasis === 'SOFR') {
    // SOFR stub: fall through to treasury proxy for now.
    // Real implementation will query SOFR term structure separately.
  }

  return interpolateRate(termYears, curve);
}
