/**
 * aggregator.ts
 *
 * Calendar-year and fiscal-year aggregation of per-month recognition maps.
 * Both functions consume the same Record<YYYYMM, number> output from the orchestrator
 * and return Record<YYYY_string, number>.
 *
 * Spec §8.
 */

// ─── Calendar Year ─────────────────────────────────────────────────────────────

/**
 * §8.1 — Aggregate monthly recognition into calendar years.
 *
 * @param monthly  Record<YYYYMM, number>  e.g. { "202501": 500, "202601": 750 }
 * @returns        Record<YYYY, number>    e.g. { "2025": 6000, "2026": 9000 }
 */
export function aggregateByCalendarYear(
  monthly: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [yyyymm, amount] of Object.entries(monthly)) {
    if (!yyyymm || yyyymm.length < 6) continue;
    const year = yyyymm.slice(0, 4);
    result[year] = (result[year] ?? 0) + amount;
  }
  return result;
}

// ─── Fiscal Year ───────────────────────────────────────────────────────────────

/**
 * §8.2 — Compute which fiscal year a YYYYMM period belongs to.
 *
 * Convention: the fiscal year label is the calendar year in which the fiscal
 * year ENDS (i.e. the year containing the last month of the FY).
 *
 * Examples with fiscalStart = 7 (July):
 *   "202507" (July 2025)  → FY label "2026" (FY runs Jul 2025 – Jun 2026)
 *   "202506" (June 2025)  → FY label "2025" (FY runs Jul 2024 – Jun 2025)
 *
 * With fiscalStart = 1 (January, calendar year):
 *   All months in 2025 → FY label "2025"  (calendar year = fiscal year)
 */
export function computeFiscalYear(yyyymm: string, fiscalStart: number): string {
  const calYear = parseInt(yyyymm.slice(0, 4), 10);
  const calMonth = parseInt(yyyymm.slice(4, 6), 10); // 1-based

  if (fiscalStart <= 1) {
    // Calendar year = fiscal year
    return String(calYear);
  }

  // If this month is in the first portion of the fiscal year (month >= fiscalStart),
  // it belongs to the FY that ends in calYear + 1.
  if (calMonth >= fiscalStart) {
    return String(calYear + 1);
  }
  // Otherwise it's in the tail of the prior fiscal year (month < fiscalStart),
  // which ends in calYear.
  return String(calYear);
}

/**
 * §8.3 — Aggregate monthly recognition into fiscal years.
 *
 * @param monthly      Record<YYYYMM, number>
 * @param fiscalStart  First month of the fiscal year (1=Jan … 12=Dec). Defaults to 1.
 * @returns            Record<YYYY, number>  keyed by fiscal year label
 */
export function aggregateByFiscalYear(
  monthly: Record<string, number>,
  fiscalStart = 1,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [yyyymm, amount] of Object.entries(monthly)) {
    if (!yyyymm || yyyymm.length < 6) continue;
    const fyLabel = computeFiscalYear(yyyymm, fiscalStart);
    result[fyLabel] = (result[fyLabel] ?? 0) + amount;
  }
  return result;
}
