/**
 * Boundary context types for the timeline model.
 *
 * The boundary system separates three zones in a proforma timeline:
 *   - Actuals: months with real operating data (from T12, rent roll, etc.)
 *   - Gap: months between last actual and acquisition/closing (derived from trends)
 *   - Projection: months from acquisition forward (from versioned assumptions)
 *
 * These types are used by the proforma seeder, field resolution, and the
 * financial model engine to tag each period with its zone type.
 */

/**
 * Zone type for a single period in the timeline.
 */
export type PeriodZoneType = 'actual' | 'gap' | 'projection' | 'override';

/**
 * Boundary context stored alongside the year1 / periodic seed.
 * Non-field metadata that tells the system where actuals end and projection begins.
 */
export interface BoundaryContext {
  /** Last month with real operating actuals (ISO date, YYYY-MM-DD). null = no actuals. */
  actuals_through_month: string | null;

  /** Ownership start date (ISO date). null = not yet owned. */
  acquisition_date: string | null;

  /** Derived: true if actuals_through_month is set (has at least one actual month). */
  has_actuals: boolean;

  /** Derived: true if any projection-zone periods exist in the seed data. */
  has_projection: boolean;

  /** Derived: the first month that is gap (actuals_end + 1 month), or null. */
  gap_start_month: string | null;

  /** Derived: the closing / acquisition month that ends the gap, or null. */
  gap_end_month: string | null;

  /** Derived: the first month in the projection zone, or null. Populated by buildPeriodicSeed. */
  first_projection_month: string | null;

  /**
   * The as-of date the analysis is being performed against (ISO date, YYYY-MM-DD).
   * Gap zone = (last actual + 1 month) -> (analysis_date - 1 month); projection
   * zone starts at analysis_date. This REPLACES acquisition_date as the gap/
   * projection boundary driver (acquisition_date is retained on the type for
   * other consumers but no longer drives gap math).
   *
   * Persisted, not recomputed: once a seed has an analysis_date, subsequent
   * reseeds must reuse the same value (pass it back in via analysisDateOverride)
   * so gap/projection boundaries stay stable and reseeds are deterministic.
   * Only defaults to "today" the first time a deal is seeded under this scheme.
   */
  analysis_date: string | null;
}

/**
 * Build a BoundaryContext from raw deal fields.
 *
 * @param analysisDateOverride - Persisted analysis_date from a prior seed's
 *   boundary, if one exists. Pass this in on every reseed to keep the gap/
 *   projection boundary stable (determinism requirement). When null/undefined,
 *   defaults to the current date (first-ever seed for this deal under this scheme).
 */
export function buildBoundaryContext(
  actuals_through_month: string | Date | null,
  acquisition_date: string | Date | null,
  analysisDateOverride?: string | Date | null,
): BoundaryContext {
  const atm = toIsoDate(actuals_through_month);
  const ad = toIsoDate(acquisition_date);
  const analysisDate = toIsoDate(analysisDateOverride ?? null) ?? toIsoDate(new Date());

  let gap_start: string | null = null;
  let gap_end: string | null = null;

  if (atm && analysisDate) {
    const gapStart = addOneMonth(atm);
    const gapEnd = subtractOneMonth(analysisDate);
    // Only meaningful if gap start is on/before gap end (i.e. there's at least
    // one full month between the last actual and the analysis date).
    if (gapStart && gapEnd && gapStart.slice(0, 7) <= gapEnd.slice(0, 7)) {
      gap_start = gapStart;
      gap_end = gapEnd;
    }
  }

  return {
    actuals_through_month: atm,
    acquisition_date: ad,
    has_actuals: atm !== null,
    has_projection: analysisDate !== null,
    gap_start_month: gap_start,
    gap_end_month: gap_end,
    first_projection_month: null, // populated by buildPeriodicSeed after period data is built
    analysis_date: analysisDate,
  };
}

/**
 * Determine the zone type for a given period (YYYY-MM) based on boundary context.
 */
export function zoneTypeForPeriod(
  periodMonth: string,
  boundary: BoundaryContext,
): PeriodZoneType {
  // Override always wins if explicitly set
  // (override logic is handled by the caller; this is the base zone)

  if (boundary.actuals_through_month && periodMonth <= boundary.actuals_through_month.slice(0, 7)) {
    return 'actual';
  }

  if (boundary.gap_start_month && boundary.gap_end_month) {
    if (periodMonth >= boundary.gap_start_month.slice(0, 7) && periodMonth <= boundary.gap_end_month.slice(0, 7)) {
      return 'gap';
    }
  }

  return 'projection';
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function toIsoDate(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10); // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function addOneMonth(ymd: string): string | null {
  const [y, m] = ymd.split('-').map(Number);
  if (!y || !m) return null;
  const next = new Date(y, m, 1); // month is 0-indexed in JS, but m is 1-12 here
  // Wait: new Date(2024, 12, 1) = Jan 2025 because month is 0-indexed
  // So m=12 means month index 12 which is January of next year. This is correct!
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function subtractOneMonth(ymd: string): string | null {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m) return null;
  // new Date(y, m - 2, d) = one month before the m-th month (m is 1-12, JS month index is m-1)
  const prev = new Date(y, m - 2, d || 1);
  const yy = prev.getFullYear();
  const mm = String(prev.getMonth() + 1).padStart(2, '0');
  const dd = String(prev.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
