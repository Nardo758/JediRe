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
}

/**
 * Build a BoundaryContext from raw deal fields.
 */
export function buildBoundaryContext(
  actuals_through_month: string | Date | null,
  acquisition_date: string | Date | null,
): BoundaryContext {
  const atm = toIsoDate(actuals_through_month);
  const ad = toIsoDate(acquisition_date);

  let gap_start: string | null = null;
  let gap_end: string | null = null;

  if (atm && ad) {
    const gapStart = addOneMonth(atm);
    const gapEnd = ad;
    // Only meaningful if gap start is before gap end
    if (gapStart && gapStart <= gapEnd) {
      gap_start = gapStart;
      gap_end = gapEnd;
    }
  }

  return {
    actuals_through_month: atm,
    acquisition_date: ad,
    has_actuals: atm !== null,
    has_projection: ad !== null,
    gap_start_month: gap_start,
    gap_end_month: gap_end,
    first_projection_month: null, // populated by buildPeriodicSeed after period data is built
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
