/**
 * Asset Time-Series Service
 *
 * Per-Property Visibility Substrate — §4, Step 2.
 *
 * Provides `getAssetTimeSeries`: queries historical_observations for a given
 * parcel, groups by metric + observation_date, and returns structured series
 * data with tier, source_file_ids, and gap-detection diagnostics.
 */

import { query } from '../../database/connection';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SupportedMetric =
  | 'asking_rent'
  | 'avg_rent'
  | 'occupancy'
  | 'signing_velocity'
  | 'concession_per_unit';

/** Map from public metric name → historical_observations column */
const METRIC_COLUMN_MAP: Record<SupportedMetric, string> = {
  asking_rent:        'property_asking_rent',
  avg_rent:           'property_avg_rent',
  occupancy:          'property_occupancy',
  signing_velocity:   'property_signing_velocity',
  concession_per_unit:'property_concession_per_unit',
};

export const DEFAULT_METRICS: SupportedMetric[] = [
  'asking_rent',
  'avg_rent',
  'occupancy',
  'signing_velocity',
  'concession_per_unit',
];

export interface TimeSeriesDataPoint {
  observation_date: string;
  value: number;
  tier: string | null;
  source_file_ids: string[] | null;
}

export interface MetricSeries {
  metric: SupportedMetric;
  points: TimeSeriesDataPoint[];
}

export interface TimeSeriesGapDiagnostic {
  expected_months: number;
  actual_months: number;
  gap_count: number;
  gap_months: string[];
  coverage_pct: number;
}

export interface MetricCoverage {
  observations_count: number;
  date_range: { start: string | null; end: string | null };
  gap_diagnostic: TimeSeriesGapDiagnostic | null;
}

export interface AssetTimeSeriesResult {
  parcel_id: string;
  series: Record<SupportedMetric, TimeSeriesDataPoint[]>;
  coverage: Record<SupportedMetric, MetricCoverage>;
  range: { start: string; end: string };
}

// ─── Gap detection helper ────────────────────────────────────────────────────

function detectGaps(
  dates: string[],
  rangeStart: Date,
  rangeEnd: Date,
): TimeSeriesGapDiagnostic {
  // Build a set of YYYY-MM strings that actually have observations
  const observed = new Set(dates.map(d => d.substring(0, 7)));

  // Build full expected sequence (monthly)
  const expectedMonths: string[] = [];
  const cursor = new Date(rangeStart);
  cursor.setDate(1);
  const endYYYYMM = rangeEnd.toISOString().substring(0, 7);

  while (cursor.toISOString().substring(0, 7) <= endYYYYMM) {
    expectedMonths.push(cursor.toISOString().substring(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const gapMonths = expectedMonths.filter(m => !observed.has(m));

  return {
    expected_months: expectedMonths.length,
    actual_months:   observed.size,
    gap_count:       gapMonths.length,
    gap_months:      gapMonths,
    coverage_pct:    expectedMonths.length > 0
      ? Math.round((observed.size / expectedMonths.length) * 100) / 100
      : 0,
  };
}

// ─── Main service function ───────────────────────────────────────────────────

/**
 * Retrieve per-property time-series data from historical_observations.
 *
 * @param parcelId   Parcel identifier (matches historical_observations.parcel_id)
 * @param metrics    Which metrics to include (defaults to all five standard metrics)
 * @param rangeStart Start of the time window (defaults to 5 years ago)
 * @param rangeEnd   End of the time window (defaults to today)
 */
export async function getAssetTimeSeries(
  parcelId: string,
  metrics: SupportedMetric[] = DEFAULT_METRICS,
  rangeStart: Date = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 5); return d; })(),
  rangeEnd: Date = new Date(),
): Promise<AssetTimeSeriesResult> {

  // Build SELECT list: always include the date + shared columns
  const metricSelects = metrics
    .map(m => `${METRIC_COLUMN_MAP[m]} AS ${m}`)
    .join(',\n           ');

  const sql = `
    SELECT
      observation_date,
      data_quality_tier                    AS tier,
      source_file_ids,
      ${metricSelects}
    FROM historical_observations
    WHERE parcel_id = $1
      AND observation_date >= $2
      AND observation_date <= $3
      AND geography_level = 'property'
    ORDER BY observation_date ASC
  `;

  const startStr = rangeStart.toISOString().split('T')[0];
  const endStr   = rangeEnd.toISOString().split('T')[0];

  const result = await query(sql, [parcelId, startStr, endStr]);

  // Initialise empty buckets
  const series: Record<string, TimeSeriesDataPoint[]> = {};
  const allDatesPerMetric: Record<string, string[]> = {};
  for (const m of metrics) {
    series[m] = [];
    allDatesPerMetric[m] = [];
  }

  for (const row of result.rows) {
    const d: string = row.observation_date instanceof Date
      ? row.observation_date.toISOString().split('T')[0]
      : String(row.observation_date);

    const tier: string | null = row.tier ?? null;
    const fileIds: string[] | null = row.source_file_ids ?? null;

    for (const m of metrics) {
      const raw = row[m];
      if (raw != null) {
        const value = parseFloat(String(raw));
        if (!isNaN(value)) {
          series[m].push({ observation_date: d, value, tier, source_file_ids: fileIds });
          allDatesPerMetric[m].push(d);
        }
      }
    }
  }

  // Build per-metric coverage diagnostics
  const coverage: Record<string, MetricCoverage> = {};
  for (const m of metrics) {
    const points = series[m];
    const dates  = allDatesPerMetric[m];

    const minDate = dates.length > 0 ? dates[0]  : null;
    const maxDate = dates.length > 0 ? dates[dates.length - 1] : null;

    const gapDiagnostic = dates.length > 0
      ? detectGaps(dates, rangeStart, rangeEnd)
      : null;

    coverage[m] = {
      observations_count: points.length,
      date_range: { start: minDate, end: maxDate },
      gap_diagnostic:     gapDiagnostic,
    };
  }

  return {
    parcel_id: parcelId,
    series:    series as Record<SupportedMetric, TimeSeriesDataPoint[]>,
    coverage:  coverage as Record<SupportedMetric, MetricCoverage>,
    range:     { start: startStr, end: endStr },
  };
}
