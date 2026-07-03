/**
 * Periodic seeder service — converts single-value `ProFormaYear1Seed` to
 * `ProFormaPeriodicSeed` with per-month granularity.
 *
 * Phase 2 of the timeline infrastructure.
 *
 * Usage:
 *   const periodicSeed = buildPeriodicSeed({
 *     year1Seed,
 *     t12Months: deal_data->extraction_t12->months,
 *     boundary,
 *     unitCount: 232,
 *   });
 */

import type {
  ProFormaPeriodicSeed,
  PeriodicFieldSeries,
  PeriodLayeredValue,
  BuildPeriodicSeedInput,
} from './periodic-field.types';
import { FIELD_TO_T12_COLUMN, SUM_ROLLUP_DOLLAR_FIELDS } from './periodic-field.types';
import type { BoundaryContext, PeriodZoneType } from './boundary.types';
import { logger } from '../../utils/logger';

import { deriveGapForSeed, DEFAULT_GAP_TRENDS } from './gap-bridge.service';

// Fields that the periodic model tracks (canonical set from ProFormaYear1Seed)
const CANONICAL_FIELDS = [
  'gpr', 'loss_to_lease_pct', 'vacancy_pct', 'concessions_pct', 'bad_debt_pct',
  'non_revenue_units_pct', 'net_rental_income', 'other_income_per_unit', 'egi',
  'payroll', 'repairs_maintenance', 'turnover', 'amenities', 'contract_services',
  'marketing', 'office', 'g_and_a', 'hoa_dues', 'utilities', 'water_sewer',
  'electric', 'gas_fuel', 'landscaping', 'management_fee_pct', 'insurance',
  'real_estate_tax', 'personal_property_tax', 'replacement_reserves', 'total_opex',
  'noi', 'noi_per_unit',
  'rent_growth', // Phase 5: derived from GPR series
];

/**
 * Build a periodic seed from a single-value year1 seed.
 *
 * Three zones:
 *   1. History (actuals): from T12 months array (if available)
 *   2. Gap: derived from trends (Phase 3 — currently copies year1 value as placeholder)
 *   3. Projection: from year1 single-value assumptions (copied across all projection periods)
 */
export function buildPeriodicSeed(input: BuildPeriodicSeedInput): ProFormaPeriodicSeed {
  const {
    year1Seed,
    t12Months = [],
    boundary,
    unitCount,
    projectionMonths = 120,
    sourceDocs = {},
  } = input;

  const now = new Date().toISOString();
  const warnings: string[] = [];

  // Determine the month range of the timeline
  const historyMonths = t12Months.length;
  const actualsEnd = boundary.actuals_through_month
    ? boundary.actuals_through_month.slice(0, 7) // YYYY-MM
    : null;

  // Build period list: history (actuals) + gap + projection
  const allPeriods = buildPeriodList(
    t12Months,
    boundary,
    projectionMonths,
  );

  const fields: Record<string, PeriodicFieldSeries> = {};

  for (const fieldName of CANONICAL_FIELDS) {
    const series = buildFieldSeries({
      fieldName,
      year1Seed,
      t12Months,
      allPeriods,
      boundary,
      unitCount,
    });

    fields[fieldName] = series;
  }

  const resolvedNoi = fields.noi?.periods
    .filter(p => p.zone === 'actual')
    .map(p => p.resolved)
    .filter((v): v is number => v != null)
    .pop() ?? null;

  // Phase 3 — Gap Bridge: derive gap values from trend assumptions
  let periodicSeed: ProFormaPeriodicSeed = {
    fields,
    boundary,
    unitCount,
    sourceDocs,
    last_seeded_at: now,
    _meta: {
      warnings,
      fields_seeded: Object.keys(fields).length,
      resolved_noi: resolvedNoi,
    },
  };

  if (boundary.gap_start_month && boundary.gap_end_month) {
    periodicSeed = deriveGapForSeed(periodicSeed, DEFAULT_GAP_TRENDS);
  }

  // Phase 5: derive rent_growth from GPR series (server-side, not client approximation)
  periodicSeed = deriveRentGrowth(periodicSeed, year1Seed);

  // Phase 5 — Augment boundary with data-driven has_projection + first_projection_month.
  // has_projection was previously "acquisition_date !== null" but Highlands (portfolio asset)
  // has no acquisition_date recorded yet has 120 projection-zone periods. Recompute from data.
  const firstProjPeriod = Object.values(periodicSeed.fields)[0]?.periods.find(
    p => p.zone === 'projection',
  );
  periodicSeed.boundary = {
    ...periodicSeed.boundary,
    has_projection: firstProjPeriod != null,
    first_projection_month: firstProjPeriod?.month ?? null,
  };

  return periodicSeed;
}

/**
 * Derive annual rent-growth rate from the GPR series.
 * For each period, compares GPR to the value 12 months prior (same month, prior year).
 * Falls back to the year1 seed's rentGrowth assumption when 12-month history is unavailable.
 */
function deriveRentGrowth(
  seed: ProFormaPeriodicSeed,
  year1Seed: Record<string, unknown>,
): ProFormaPeriodicSeed {
  const gprSeries = seed.fields.gpr;
  if (!gprSeries) return seed;

  const periods = gprSeries.periods;
  const rentGrowthPeriods: PeriodLayeredValue[] = [];

  // Extract year1 rentGrowth assumption as fallback
  const revenueSeed = year1Seed.revenue as Record<string, unknown> | undefined;
  const rentGrowthArr = Array.isArray(revenueSeed?.rentGrowth)
    ? (revenueSeed.rentGrowth as number[])
    : null;
  const fallbackGrowth = rentGrowthArr?.[0] ?? 0.03;

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const month = period.month;
    const year = parseInt(month.slice(0, 4), 10);
    const monthNum = parseInt(month.slice(5, 7), 10);

    // Find the same month in the prior year
    const priorYear = `${year - 1}-${String(monthNum).padStart(2, '0')}`;
    const priorPeriod = periods.find(p => p.month === priorYear);

    let resolved: number | null = null;
    let resolution: PeriodLayeredValue['resolution'] = 'unresolved';
    let source: string | null = null;

    if (priorPeriod != null && period.resolved != null && priorPeriod.resolved != null && priorPeriod.resolved !== 0) {
      // Year-over-year growth: (current - prior) / prior
      resolved = (period.resolved - priorPeriod.resolved) / priorPeriod.resolved;
      resolution = 'computed';
      source = 'gpr_series_yoy';
    } else if (period.zone === 'projection' && fallbackGrowth != null) {
      // Projection zone: use year1 assumption growth rate
      resolved = fallbackGrowth;
      resolution = 'assumption_trend';
      source = 'year1_seed';
    } else if (period.zone === 'gap' && fallbackGrowth != null) {
      // Gap zone: use year1 assumption as placeholder
      resolved = fallbackGrowth;
      resolution = 'derived_gap';
      source = 'assumption_trend';
    }

    rentGrowthPeriods.push({
      periodIndex: period.periodIndex,
      month: period.month,
      resolved,
      resolution,
      source,
      zone: period.zone,
      updated_at: new Date().toISOString(),
    });
  }

  seed.fields.rent_growth = {
    fieldName: 'rent_growth',
    periods: rentGrowthPeriods,
    fallbackResolved: fallbackGrowth,
    fallbackResolution: 'assumption_trend',
    fallbackSource: 'year1_seed',
  };

  return seed;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

interface PeriodDef {
  month: string;        // YYYY-MM
  periodIndex: number;   // 0-based
  zone: PeriodZoneType;
  t12Month?: Record<string, unknown>;
}

function buildPeriodList(
  t12Months: Array<Record<string, unknown>>,
  boundary: BoundaryContext,
  projectionMonths: number,
): PeriodDef[] {
  const periods: PeriodDef[] = [];

  // 1. History zone: months from T12
  if (t12Months.length > 0) {
    for (let i = 0; i < t12Months.length; i++) {
      const m = t12Months[i];
      const month = (m.reportMonth as string)?.slice(0, 7) ?? 'unknown';
      periods.push({
        month,
        periodIndex: i,
        zone: 'actual',
        t12Month: m as Record<string, unknown>,
      });
    }
  }

  // 2. Gap zone: between actuals end and acquisition
  if (boundary.gap_start_month && boundary.gap_end_month) {
    const gapStart = boundary.gap_start_month.slice(0, 7);
    const gapEnd = boundary.gap_end_month.slice(0, 7);
    let idx = periods.length;
    let current = gapStart;
    while (current <= gapEnd) {
      // Only add if not already in history
      if (!periods.some(p => p.month === current)) {
        periods.push({
          month: current,
          periodIndex: idx++,
          zone: 'gap',
        });
      }
      current = nextMonth(current);
    }
  }

  // 3. Projection zone: from analysis_date (or after gap, if the gap already
  // reaches analysis_date), forward N months. analysis_date replaces
  // acquisition_date as the gap/projection boundary driver (W-A gap zone dispatch).
  const projectionStart = boundary.analysis_date
    ? boundary.analysis_date.slice(0, 7)
    : (periods.length > 0 ? nextMonth(periods[periods.length - 1].month) : '2024-01');

  let projIdx = periods.length;
  let projMonth = projectionStart;
  for (let i = 0; i < projectionMonths; i++) {
    if (!periods.some(p => p.month === projMonth)) {
      periods.push({
        month: projMonth,
        periodIndex: projIdx++,
        zone: 'projection',
      });
    }
    projMonth = nextMonth(projMonth);
  }

  return periods;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1); // m is 1-12, new Date(y, m, 1) = month m+1 (since 0-indexed)
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

interface BuildFieldSeriesInput {
  fieldName: string;
  year1Seed: Record<string, unknown>;
  t12Months: Array<Record<string, unknown>>;
  allPeriods: PeriodDef[];
  boundary: BoundaryContext;
  unitCount: number;
}

function buildFieldSeries(input: BuildFieldSeriesInput): PeriodicFieldSeries {
  const { fieldName, year1Seed, allPeriods } = input;

  // Get the single-value fallback from year1 seed
  const year1Field = year1Seed[fieldName] as Record<string, unknown> | undefined;
  const fallbackResolved = typeof year1Field?.resolved === 'number' ? year1Field.resolved : null;
  const fallbackResolution = typeof year1Field?.resolution === 'string' ? year1Field.resolution : 'unresolved';
  const fallbackSource = typeof year1Field?.source === 'string' ? year1Field.source : null;

  const periods: PeriodLayeredValue[] = [];

  for (const period of allPeriods) {
    let resolved: number | null = null;
    let resolution: PeriodLayeredValue['resolution'] = 'unresolved';
    let source: string | null = null;
    let raw: number | null = null;

    if (period.zone === 'actual' && period.t12Month) {
      // Extract from T12 month data
      const t12Col = FIELD_TO_T12_COLUMN[fieldName];
      if (t12Col) {
        const t12Val = period.t12Month[t12Col];
        if (typeof t12Val === 'number') {
          resolved = t12Val;
          raw = t12Val;
          resolution = 'actual';
          source = 'extraction_t12';
        }
      }

      // If T12 value is absent (no mapping or NULL monthly row), fall back to year1.
      // SUM-rollup dollar fields: divide by 12 so the annual SUM of 12 accruals
      // equals the year1 annual figure, not 12×. Tag as 'year1_accrual' so the
      // grid can style imputed months distinctly from real extraction_t12 actuals.
      // Rate/AVG fields: copy verbatim (constant rate → AVG rollup → correct).
      if (resolved == null && fallbackResolved != null) {
        if (SUM_ROLLUP_DOLLAR_FIELDS.has(fieldName)) {
          resolved = fallbackResolved / 12;
          resolution = 'year1_accrual';
          source = 'year1_annual_accrual';
        } else {
          resolved = fallbackResolved;
          resolution = 'actual';
          source = fallbackSource;
        }
      }
    } else if (period.zone === 'gap') {
      // Phase 3 placeholder: gap uses year1 value as trend baseline
      // (Phase 3 will replace with actual trend derivation)
      // Same ÷12 rule for SUM-rollup dollar fields to keep gap-year annual
      // totals sane (year1 annual, not 12×).
      if (fallbackResolved != null) {
        resolved = SUM_ROLLUP_DOLLAR_FIELDS.has(fieldName)
          ? fallbackResolved / 12
          : fallbackResolved;
        resolution = 'derived_gap';
        source = 'assumption_trend';
      }
    } else {
      // Projection: use year1 single-value assumption
      if (fallbackResolved != null) {
        resolved = fallbackResolved;
        resolution = 'assumption_trend';
        source = fallbackSource ?? 'platform_default';
      }
    }

    periods.push({
      periodIndex: period.periodIndex,
      month: period.month,
      resolved,
      resolution,
      source,
      zone: period.zone,
      raw,
      updated_at: new Date().toISOString(),
    });
  }

  return {
    fieldName,
    periods,
    fallbackResolved,
    fallbackResolution,
    fallbackSource,
  };
}

/**
 * Export a single resolved value at a specific period from a periodic seed.
 * Backward-compatible: returns the fallbackResolved if periodIndex is omitted.
 */
export function getPeriodValue(
  seed: ProFormaPeriodicSeed,
  fieldName: string,
  periodIndex?: number,
): { resolved: number | null; resolution: string; source: string | null; zone: PeriodZoneType } | null {
  const series = seed.fields[fieldName];
  if (!series) return null;

  if (periodIndex == null) {
    return {
      resolved: series.fallbackResolved,
      resolution: series.fallbackResolution,
      source: series.fallbackSource,
      zone: 'projection',
    };
  }

  const period = series.periods[periodIndex];
  if (!period) return null;

  return {
    resolved: period.resolved,
    resolution: period.resolution,
    source: period.source,
    zone: period.zone,
  };
}

/**
 * Export the full series for a field as an array of {month, resolved}.
 * Useful for chart rendering (F9 Phase 5).
 */
export function getFieldSeries(
  seed: ProFormaPeriodicSeed,
  fieldName: string,
): Array<{ month: string; resolved: number | null; zone: PeriodZoneType }> | null {
  const series = seed.fields[fieldName];
  if (!series) return null;
  return series.periods.map(p => ({
    month: p.month,
    resolved: p.resolved,
    zone: p.zone,
  }));
}
/**
 * Overlay deterministic engine monthly cash-flow output onto the projection
 * zone of an existing periodic seed.  Replaces year1-fallback placeholders
 * with the engine's per-month values so the ribbon timeline reflects the
 * actual ramp, rent-growth trajectory, and operating dynamics computed by
 * the deterministic runner.
 *
 * D2 acceptance: Bishop ribbon projection matches engine output; ramp
 * behavior preserved ($70,019.26 at m24 off live year1 = $840,231).
 */
export function overlayEngineMonthlyOnSeed(
  seed: ProFormaPeriodicSeed,
  engineMonthly: Array<Record<string, number>>,
  unitCount: number,
): ProFormaPeriodicSeed {
  const anyField = Object.values(seed.fields)[0];
  const firstProjectionPeriod = anyField?.periods.find(p => p.zone === 'projection');
  if (!firstProjectionPeriod) return seed;

  const projStartIdx = firstProjectionPeriod.periodIndex;

  // Direct dollar-field mapping: engine MonthlyCashFlowRow key → seeder canonical field
  const directMap: Record<string, string> = {
    gpr: 'gpr',
    baseRevenue: 'net_rental_income',
    egi: 'egi',
    payroll: 'payroll',
    maintenance: 'repairs_maintenance',
    contractServices: 'contract_services',
    marketing: 'marketing',
    utilities: 'utilities',
    admin: 'g_and_a',
    insurance: 'insurance',
    propertyTax: 'real_estate_tax',
    replacementReserves: 'replacement_reserves',
    totalExpenses: 'total_opex',
    noi: 'noi',
  };

  // Percentage fields derived from engine dollar numerators / denominators
  const pctDerivations: Array<{
    engineNumerator: string;
    engineDenominator: string;
    seederField: string;
  }> = [
    { engineNumerator: 'lossToLease', engineDenominator: 'gpr', seederField: 'loss_to_lease_pct' },
    { engineNumerator: 'vacancy', engineDenominator: 'gpr', seederField: 'vacancy_pct' },
    { engineNumerator: 'concessions', engineDenominator: 'gpr', seederField: 'concessions_pct' },
    { engineNumerator: 'badDebt', engineDenominator: 'gpr', seederField: 'bad_debt_pct' },
    { engineNumerator: 'managementFee', engineDenominator: 'egi', seederField: 'management_fee_pct' },
  ];

  // Helper: overlay a single value onto a specific period index
  const overlay = (series: PeriodicFieldSeries, targetIdx: number, value: number) => {
    const period = series.periods.find(p => p.periodIndex === targetIdx);
    if (period && (period.zone === 'projection' || period.zone === 'gap')) {
      period.resolved = value;
      period.resolution = 'derived_projection';
      period.source = 'deterministic_engine';
      period.updated_at = new Date().toISOString();
    }
  };

  // 1. Direct dollar fields
  for (const [engineKey, seederField] of Object.entries(directMap)) {
    const series = seed.fields[seederField];
    if (!series) continue;
    for (let i = 0; i < engineMonthly.length; i++) {
      const v = engineMonthly[i][engineKey];
      if (v == null || !Number.isFinite(v)) continue;
      overlay(series, projStartIdx + i, v);
    }
  }

  // 2. Per-unit conversion: otherIncome → other_income_per_unit
  const oiSeries = seed.fields['other_income_per_unit'];
  if (oiSeries && unitCount > 0) {
    for (let i = 0; i < engineMonthly.length; i++) {
      const v = engineMonthly[i]['otherIncome'];
      if (v == null || !Number.isFinite(v)) continue;
      overlay(oiSeries, projStartIdx + i, v / unitCount);
    }
  }

  // 3. Per-unit conversion: noi → noi_per_unit
  const noiPerUnitSeries = seed.fields['noi_per_unit'];
  if (noiPerUnitSeries && unitCount > 0) {
    for (let i = 0; i < engineMonthly.length; i++) {
      const v = engineMonthly[i]['noi'];
      if (v == null || !Number.isFinite(v)) continue;
      overlay(noiPerUnitSeries, projStartIdx + i, v / unitCount);
    }
  }

  // 4. Percentage derivations
  for (const { engineNumerator, engineDenominator, seederField } of pctDerivations) {
    const series = seed.fields[seederField];
    if (!series) continue;
    for (let i = 0; i < engineMonthly.length; i++) {
      const num = engineMonthly[i][engineNumerator];
      const den = engineMonthly[i][engineDenominator];
      if (num == null || den == null || !Number.isFinite(num) || !Number.isFinite(den) || den === 0) continue;
      overlay(series, projStartIdx + i, num / den);
    }
  }

  // 5. Update fallbacks for overlaid fields to first engine value (display default)
  for (const seederField of [
    ...Object.values(directMap),
    'other_income_per_unit',
    'noi_per_unit',
    ...pctDerivations.map(d => d.seederField),
  ]) {
    const series = seed.fields[seederField];
    if (!series) continue;
    const firstProj = series.periods.find(p => p.zone === 'projection');
    if (firstProj?.resolved != null) {
      series.fallbackResolved = firstProj.resolved;
      series.fallbackResolution = 'derived_projection';
      series.fallbackSource = 'deterministic_engine';
    }
  }

  return seed;
}
