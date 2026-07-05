/**
 * Seed-path actuals aggregation — real (non-test-only) aggregation logic for
 * owned/seed-path deals.
 *
 * This exists so golden fixtures for seed-path deals (e.g. Highlands) can be
 * validated the same way build-path fixtures are: by running real production
 * logic over a pinned input snapshot, not by hand-computing two constants and
 * comparing them to each other (Finding N, W5-DISPATCH.md).
 *
 * Input rows are the same shape returned by
 * `GET /api/v1/portfolio/:dealId/financials` (see portfolio.routes.ts) —
 * raw `deal_monthly_actuals` rows, budget/proforma rows included so the
 * aggregator itself is responsible for excluding them (matching how that
 * route's own filtered variant already does it, but this is the shared
 * calculation any other seed-path consumer should also use).
 */

export interface SeedActualsRow {
  report_month: string; // ISO date, e.g. '2025-01-01'
  effective_gross_income: number | null;
  noi: number | null;
  total_opex: number | null;
  is_budget: boolean;
  is_proforma: boolean;
}

export interface SeedAggregateResult {
  targetYear: number;
  monthsCovered: number;
  egiAnnual: number;
  noiAnnual: number;
  opexAnnual: number;
  /** noiAnnual / egiAnnual */
  noiMargin: number;
  /** opexAnnual / egiAnnual */
  opexRatio: number;
  /** ISO date of the latest non-budget, non-proforma month across all rows passed in. */
  boundary: string | null;
}

/**
 * Aggregate a set of raw deal_monthly_actuals-shaped rows into annual metrics
 * for a target calendar year, and report the actuals/projection boundary
 * (latest real month across the full row set, not just the target year).
 *
 * Excludes is_budget and is_proforma rows — only real reported actuals count
 * toward EGI/NOI/opex aggregates and the boundary date.
 */
export function aggregateSeedActuals(
  rows: SeedActualsRow[],
  targetYear: number,
): SeedAggregateResult {
  const actual = rows.filter(r => !r.is_budget && !r.is_proforma);

  const yearRows = actual.filter(r => r.report_month.slice(0, 4) === String(targetYear));

  const egiAnnual = yearRows.reduce((s, r) => s + (r.effective_gross_income ?? 0), 0);
  const noiAnnual = yearRows.reduce((s, r) => s + (r.noi ?? 0), 0);
  const opexAnnual = yearRows.reduce((s, r) => s + (r.total_opex ?? 0), 0);

  const boundary = actual.length > 0
    ? actual.map(r => r.report_month).sort().slice(-1)[0]!
    : null;

  return {
    targetYear,
    monthsCovered: yearRows.length,
    egiAnnual,
    noiAnnual,
    opexAnnual,
    noiMargin: egiAnnual !== 0 ? noiAnnual / egiAnnual : 0,
    opexRatio: egiAnnual !== 0 ? opexAnnual / egiAnnual : 0,
    boundary,
  };
}
