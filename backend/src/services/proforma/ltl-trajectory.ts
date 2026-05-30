/**
 * LTL Forward Trajectory Math — Task #1540 (Piece B1)
 *
 * Replaces the flat lossToLeasePct constant in Engine A's projection loop
 * with a per-year decaying trajectory driven by lease roll velocity and
 * mark-to-market capture rate.
 *
 * Formula:  LTL[yr] = LTL[yr-1] × (1 − velocity[yr] × captureRate)
 *
 * Where:
 *   LTL[yr-1]    = LTL fraction from the prior year (starts at ltlStart)
 *   velocity[yr] = fraction of leases rolling in year yr
 *                  (from deal_lease_transactions.lease_end distribution)
 *   captureRate  = fraction of the LTL gap closed per roll event
 *                  (operator assumption, default 0.33 = 33%)
 *
 * Signal priority for ltlStart:
 *   1. live lease-level LTL from deal_traffic_snapshots.summary.lossToLeasePct
 *      (computed by traffic-analytics.service.ts from deal_lease_transactions — 13.8% for 464 Bishop)
 *   2. T12 trailing average from deal_assumptions.year1.loss_to_lease_pct.t12
 *      (0.35% for 464 Bishop — anchored unrealistically low by the T12 period)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LTLTrajectoryInputs {
  ltlStart: number;
  leaseRollVelocityPerYear: number[];
  captureRate: number;
  holdYears: number;
}

export interface LTLTrajectoryResult {
  byYear: number[];
  ltlStart: number;
  captureRate: number;
}

export interface LTLSignals {
  t12Pct: number | null;
  livePct: number | null;
  trajectorySource: 'live' | 't12' | 'resolved';
  byYear: number[];
  captureRate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_CAPTURE_RATE = 0.33;

// ─── Pure functions ───────────────────────────────────────────────────────────

/**
 * Compute LTL forward trajectory for all hold years.
 * Pure function — no side effects.
 *
 * Each year: LTL compresses by (velocity × captureRate) of its current value.
 * LTL is clamped to [0, 1] and can never go negative.
 */
export function computeLTLTrajectory(opts: LTLTrajectoryInputs): LTLTrajectoryResult {
  const { ltlStart, leaseRollVelocityPerYear, captureRate, holdYears } = opts;
  const byYear: number[] = [];
  let ltl = Math.max(0, Math.min(1, ltlStart));

  for (let yr = 1; yr <= holdYears; yr++) {
    const velocity =
      leaseRollVelocityPerYear[yr - 1] ??
      leaseRollVelocityPerYear[leaseRollVelocityPerYear.length - 1] ??
      1 / Math.max(1, holdYears);

    ltl = Math.max(0, ltl * (1 - Math.min(1, velocity) * Math.min(1, captureRate)));
    byYear.push(ltl);
  }

  return { byYear, ltlStart, captureRate };
}

/**
 * Compute per-year lease roll velocity from an array of lease expiration dates.
 *
 * For each hold year Y (1-indexed), counts leases whose lease_end falls within
 * [asOfDate + (Y-1)×365.25 days, asOfDate + Y×365.25 days), then divides by
 * total leases with known expiration dates to get the fraction rolling.
 *
 * Leases already expired at asOfDate count in year 1 (rolling immediately / MTM).
 * Leases expiring beyond the hold period are excluded.
 *
 * @param leaseDates  Array of lease_end values (Date, ISO string, or null/undefined).
 * @param asOfDate    Reference date for year-band bucketing (typically rent roll as-of date).
 * @param holdYears   Number of hold-year bands to compute.
 * @returns           Float array of length holdYears where element[i] = fraction rolling in year (i+1).
 */
export function computeLeaseRollVelocityFromDates(
  leaseDates: Array<Date | string | null | undefined>,
  asOfDate: Date,
  holdYears: number,
): number[] {
  const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;
  const asOfMs      = asOfDate.getTime();
  const counts      = Array<number>(holdYears).fill(0);
  let   validCount  = 0;

  for (const raw of leaseDates) {
    if (raw == null) continue;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (isNaN(d.getTime())) continue;

    validCount++;
    const yearsOut  = (d.getTime() - asOfMs) / MS_PER_YEAR;
    const yearBand  = yearsOut < 0 ? 0 : Math.floor(yearsOut);

    if (yearBand < holdYears) {
      counts[yearBand]++;
    }
    // Leases expiring beyond hold period: excluded (not captured in trajectory)
  }

  if (validCount === 0) {
    const uniform = 1 / Math.max(1, holdYears);
    return Array<number>(holdYears).fill(uniform);
  }

  return counts.map(c => c / validCount);
}
