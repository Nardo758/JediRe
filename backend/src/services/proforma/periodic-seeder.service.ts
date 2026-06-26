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
  FIELD_TO_T12_COLUMN,
} from './periodic-field.types';
import type { BoundaryContext, PeriodZoneType } from './boundary.types';
import { logger } from '../../utils/logger';

// Fields that the periodic model tracks (canonical set from ProFormaYear1Seed)
const CANONICAL_FIELDS = [
  'gpr', 'loss_to_lease_pct', 'vacancy_pct', 'concessions_pct', 'bad_debt_pct',
  'non_revenue_units_pct', 'net_rental_income', 'other_income_per_unit', 'egi',
  'payroll', 'repairs_maintenance', 'turnover', 'amenities', 'contract_services',
  'marketing', 'office', 'g_and_a', 'hoa_dues', 'utilities', 'water_sewer',
  'electric', 'gas_fuel', 'landscaping', 'management_fee_pct', 'insurance',
  'real_estate_tax', 'personal_property_tax', 'replacement_reserves', 'total_opex',
  'noi', 'noi_per_unit',
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

  return {
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

  // 3. Projection zone: from acquisition or after gap, forward N months
  const projectionStart = boundary.acquisition_date
    ? boundary.acquisition_date.slice(0, 7)
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

      // If not found in T12 column map, fall back to year1 value
      if (resolved == null && fallbackResolved != null) {
        resolved = fallbackResolved;
        resolution = 'actual';
        source = fallbackSource;
      }
    } else if (period.zone === 'gap') {
      // Phase 3 placeholder: gap uses year1 value as trend baseline
      // (Phase 3 will replace with actual trend derivation)
      if (fallbackResolved != null) {
        resolved = fallbackResolved;
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
