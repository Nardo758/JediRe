/**
 * Gap bridge service — fills the T12-end → acquisition gap with assumption-driven trends.
 *
 * Phase 3 of the timeline infrastructure.
 *
 * When a deal has actuals (T12) and an acquisition date, there is often a gap
 * between the last actual month and the acquisition month. This service derives
 * values for that gap using trend assumptions (rent growth, expense growth, etc.).
 */

import type {
  PeriodicFieldSeries,
  PeriodLayeredValue,
  ProFormaPeriodicSeed,
} from './periodic-field.types';
import type { BoundaryContext, PeriodZoneType } from './boundary.types';
import { logger } from '../../utils/logger';
import { applyStabilizationRamp } from './stabilization.service';

export interface GapTrendAssumptions {
  /** Monthly rent growth rate (e.g., 0.03/12 = 0.0025 for 3% annual). */
  rentGrowthMonthly: number;
  /** Monthly expense growth rate. */
  expenseGrowthMonthly: number;
  /** Monthly vacancy change rate (can be negative for lease-up). */
  vacancyChangeMonthly: number;
  /** Monthly concession change rate. */
  concessionChangeMonthly: number;
}

export const DEFAULT_GAP_TRENDS: GapTrendAssumptions = {
  rentGrowthMonthly: 0.0025,      // 3% annual / 12
  expenseGrowthMonthly: 0.00208,   // 2.5% annual / 12
  vacancyChangeMonthly: 0,          // stable
  concessionChangeMonthly: 0,     // stable
};

/**
 * Map canonical field names to their trend type for gap derivation.
 * Exported so reconciliation.service.ts can re-use the same trend mapping when
 * re-deriving forward projection after a rebase.
 */
export function trendTypeForField(fieldName: string): keyof GapTrendAssumptions | 'none' {
  if (fieldName === 'gpr') return 'rentGrowthMonthly';
  if (fieldName === 'net_rental_income') return 'rentGrowthMonthly';
  if (fieldName === 'egi') return 'rentGrowthMonthly';
  if (fieldName === 'other_income_per_unit') return 'rentGrowthMonthly';
  if (fieldName === 'payroll') return 'expenseGrowthMonthly';
  if (fieldName === 'repairs_maintenance') return 'expenseGrowthMonthly';
  if (fieldName === 'turnover') return 'expenseGrowthMonthly';
  if (fieldName === 'amenities') return 'expenseGrowthMonthly';
  if (fieldName === 'contract_services') return 'expenseGrowthMonthly';
  if (fieldName === 'marketing') return 'expenseGrowthMonthly';
  if (fieldName === 'office') return 'expenseGrowthMonthly';
  if (fieldName === 'g_and_a') return 'expenseGrowthMonthly';
  if (fieldName === 'hoa_dues') return 'expenseGrowthMonthly';
  if (fieldName === 'utilities') return 'expenseGrowthMonthly';
  if (fieldName === 'water_sewer') return 'expenseGrowthMonthly';
  if (fieldName === 'electric') return 'expenseGrowthMonthly';
  if (fieldName === 'gas_fuel') return 'expenseGrowthMonthly';
  if (fieldName === 'landscaping') return 'expenseGrowthMonthly';
  if (fieldName === 'insurance') return 'expenseGrowthMonthly';
  if (fieldName === 'real_estate_tax') return 'expenseGrowthMonthly';
  if (fieldName === 'personal_property_tax') return 'expenseGrowthMonthly';
  if (fieldName === 'replacement_reserves') return 'expenseGrowthMonthly';
  if (fieldName === 'total_opex') return 'expenseGrowthMonthly';
  if (fieldName === 'noi') return 'rentGrowthMonthly'; // NOI follows revenue trend approximately
  if (fieldName === 'vacancy_pct') return 'vacancyChangeMonthly';
  if (fieldName === 'concessions_pct') return 'concessionChangeMonthly';
  if (fieldName === 'loss_to_lease_pct') return 'rentGrowthMonthly'; // LTL tracks rent growth
  if (fieldName === 'bad_debt_pct') return 'none'; // stable
  if (fieldName === 'non_revenue_units_pct') return 'none'; // stable
  if (fieldName === 'management_fee_pct') return 'none'; // stable
  return 'none';
}

/**
 * Derive gap values for a single field using trend assumptions.
 *
 * @param series   The existing periodic series (actuals already populated)
 * @param trends   Trend assumptions for the gap
 * @param boundary Boundary context (gap_start, gap_end)
 * @returns        New series with gap periods filled
 */
export function deriveGapSeries(
  series: PeriodicFieldSeries,
  trends: GapTrendAssumptions,
  boundary: BoundaryContext,
): PeriodicFieldSeries {
  const trendType = trendTypeForField(series.fieldName);
  if (trendType === 'none' || !boundary.gap_start_month || !boundary.gap_end_month) {
    // No trend applicable or no gap → return series unchanged (gap already has fallback values)
    return series;
  }

  const trendRate = trends[trendType];
  const gapStart = boundary.gap_start_month.slice(0, 7);
  const gapEnd = boundary.gap_end_month.slice(0, 7);

  // Find the last actual value to use as the baseline
  const actualPeriods = series.periods.filter(p => p.zone === 'actual');
  const lastActual = actualPeriods[actualPeriods.length - 1];
  if (!lastActual || lastActual.resolved == null) {
    logger.warn('[GapBridge] No last actual value for gap derivation', { field: series.fieldName });
    return series;
  }

  const baseline = lastActual.resolved;
  const newPeriods = series.periods.map((period): PeriodLayeredValue => {
    if (period.zone !== 'gap') return period;
    if (period.month < gapStart || period.month > gapEnd) return period;

    // Months from gap start
    const monthsFromStart = monthDiff(gapStart, period.month);
    const derivedValue = applyCompoundTrend(baseline, trendRate, monthsFromStart);

    return {
      ...period,
      resolved: derivedValue,
      resolution: 'derived_gap',
      source: 'assumption_trend',
      raw: null,
      updated_at: new Date().toISOString(),
    };
  });

  return {
    ...series,
    periods: newPeriods,
  };
}

/**
 * Derive gap values for ALL fields in a periodic seed.
 */
export function deriveGapForSeed(
  seed: ProFormaPeriodicSeed,
  trends: GapTrendAssumptions = DEFAULT_GAP_TRENDS,
): ProFormaPeriodicSeed {
  const newFields: Record<string, PeriodicFieldSeries> = {};

  for (const [fieldName, series] of Object.entries(seed.fields)) {
    newFields[fieldName] = deriveGapSeries(series, trends, seed.boundary);
  }

  return {
    ...seed,
    fields: newFields,
    last_seeded_at: new Date().toISOString(),
  };
}

/**
 * Derive projection values for a single field after a rebase.
 *
 * After actuals advance (or gap is re-derived), the projection zone still holds
 * the original year1 annual seed values as placeholders. This function re-trends
 * projection periods forward from the last non-projection value (last gap month if
 * a gap exists, otherwise last actual month), keeping all periods in the same
 * monthly scale as actuals.
 */
function deriveProjectionSeries(
  series: PeriodicFieldSeries,
  trends: GapTrendAssumptions,
  ramp?: { stabilizedMonthly: number; monthsToStabilization: number },
): PeriodicFieldSeries {
  const trendType = trendTypeForField(series.fieldName);

  // Find the last non-projection period to use as baseline.
  // Priority: last gap value (already trended from actuals), then last actual value.
  const nonProjPeriods = series.periods.filter(p => p.zone !== 'projection');
  if (nonProjPeriods.length === 0) return series;

  const lastNonProj = nonProjPeriods[nonProjPeriods.length - 1];
  if (lastNonProj.resolved == null) return series;

  const baseline = lastNonProj.resolved;
  const baselineMonth = lastNonProj.month;
  const trendRate = trendType === 'none' ? 0 : trends[trendType];

  const newPeriods = series.periods.map((period): PeriodLayeredValue => {
    if (period.zone !== 'projection') return period;

    const monthsFromBaseline = monthDiff(baselineMonth, period.month);
    // W-B Phase 2: ramp only applies where a stabilization target was supplied
    // (currently 'noi' — see deriveProjectionForSeed). No degenerate special
    // case for baseline ≈ target: applyStabilizationRamp naturally collapses
    // to ≈stabilizedMonthly for the whole ramp window in that case.
    const derivedValue = ramp
      ? applyStabilizationRamp(baseline, ramp.stabilizedMonthly, monthsFromBaseline, ramp.monthsToStabilization, trendRate)
      : applyCompoundTrend(baseline, trendRate, monthsFromBaseline);

    return {
      ...period,
      resolved: derivedValue,
      resolution: 'derived_projection',
      source: ramp ? 'assumption_trend_ramp' : 'assumption_trend',
      raw: null,
      updated_at: new Date().toISOString(),
    };
  });

  return { ...series, periods: newPeriods };
}

/**
 * Re-derive ALL projection periods for every field in a periodic seed.
 *
 * Called by applyRebase after actuals advance and gap is re-derived.
 * Replaces frozen year1-annual placeholders with monthly-scale trended values
 * that compound-grow from the last actual/gap baseline.
 */
export function deriveProjectionForSeed(
  seed: ProFormaPeriodicSeed,
  trends: GapTrendAssumptions = DEFAULT_GAP_TRENDS,
  stabilization?: { monthsToStabilization: number; resolution: string },
): ProFormaPeriodicSeed {
  const newFields: Record<string, PeriodicFieldSeries> = {};

  // W5 fix: Beyond the engine horizon (holdYears+1 months), projection periods
  // use compound-trend continuation from the last known value — same pattern as
  // gap derivation. No ramp-to-stabilized target; by horizon-end the deal is
  // already stabilized and post-hold months are hypothetical continuation.
  // The old ramp target (seed._meta.resolved_noi) was the in-place figure,
  // causing a ~3.2× undershoot on lease-up and a discontinuity at m72→m73.
  for (const [fieldName, series] of Object.entries(seed.fields)) {
    newFields[fieldName] = deriveProjectionSeries(series, trends, undefined);
  }

  return {
    ...seed,
    fields: newFields,
    last_seeded_at: new Date().toISOString(),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function applyCompoundTrend(baseline: number, rate: number, months: number): number {
  return baseline * Math.pow(1 + rate, months);
}

export function monthDiff(startMonth: string, endMonth: string): number {
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  return (ey - sy) * 12 + (em - sm);
}
