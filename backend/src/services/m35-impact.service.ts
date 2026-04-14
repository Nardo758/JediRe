/**
 * M35 Impact Measurement Service
 * OLS Windowing + Difference-in-Differences Engine
 *
 * For every materialized key_event × metric × window:
 *   1. Resolve metric time-series from metric_time_series table
 *   2. Fit OLS line over T-12mo pre-event baseline
 *   3. Extrapolate to T+N (3 / 12 / 24 / 36 mo) and compare to actual
 *   4. Select 3-5 control submarkets (same MSA tier, no same-category event)
 *   5. Compute DiD attributed_delta = treatment_delta - avg(control_delta)
 *   6. Persist to event_impacts; publish event.impact_measured Kafka topic
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { kafkaProducer } from './kafka/kafka-producer.service';
import { KAFKA_TOPICS, type M35ImpactMeasuredMessage } from './kafka/event-schemas';

// ─── Constants ────────────────────────────────────────────────────────────────

const MEASUREMENT_WINDOWS = [3, 12, 24, 36] as const;
const BASELINE_MONTHS = 12;
const MIN_BASELINE_POINTS = 4;
const TARGET_CONTROL_N = 5;
const MAX_CONTROL_N = 10;

// ─── Canonical metric registry ─────────────────────────────────────────────
// Maps M35 category → preferred metric_ids from metric_time_series.
// Geography resolution: prefer 'metro' (MSA-level), fall back to 'national'.

export const M35_METRIC_REGISTRY: Record<string, string[]> = {
  EMPLOYMENT:          ['rent_index', 'home_value_index', 'rent_index_yoy'],
  INFRASTRUCTURE:      ['rent_index', 'home_value_index', 'rent_index_yoy'],
  REGULATORY_POLICY:   ['rent_index', 'home_value_index'],
  MARKET_STRUCTURE:    ['rent_index', 'home_value_index', 'rent_index_yoy'],
  MACRO_DEMOGRAPHIC:   ['rent_index', 'home_value_index'],
  DISASTER_DISRUPTION: ['rent_index', 'home_value_index'],
  TECHNOLOGY_INDUSTRY: ['rent_index', 'home_value_index', 'rent_index_yoy'],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  date: Date;
  value: number;
}

export interface OLSResult {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
}

export interface ImpactRecord {
  id: string;
  eventId: string;
  metricKey: string;
  geographyType: string;
  geographyId: string;
  windowMonths: number;
  measurementDate: Date;
  baselineSlope: number | null;
  baselineIntercept: number | null;
  baselineR2: number | null;
  baselineN: number;
  projectedValue: number | null;
  actualValue: number | null;
  delta: number | null;
  deltaPct: number | null;
  controlAvgDelta: number | null;
  attributedDelta: number | null;
  attributedDeltaPct: number | null;
  didConfidence: number;
  pValue: number | null;
  controlGroupN: number;
  dataQuality: 'complete' | 'partial' | 'insufficient';
  dataGaps: string[];
  computedAt: Date;
}

export interface ControlGroupEntry {
  id: string;
  eventId: string;
  controlGeographyType: string;
  controlGeographyId: string;
  controlGeographyName: string | null;
  matchScore: number;
  matchCriteria: Record<string, number>;
  isIncluded: boolean;
  exclusionReason: string | null;
}

// ─── Metric Time-Series Resolver ──────────────────────────────────────────────

/**
 * Pull metric values from metric_time_series for a geography + metric.
 * Falls back through: submarket → metro → national geography types.
 */
export async function resolveMetricSeries(
  geographyId: string,
  metricKey: string,
  startDate: Date,
  endDate: Date
): Promise<TimeSeriesPoint[]> {
  const pool = getPool();

  const geoTypes = ['submarket', 'metro', 'national'];

  for (const geoType of geoTypes) {
    const geoId = geoType === 'national' ? 'national' : geographyId;

    const result = await pool.query(
      `SELECT period_date, value
       FROM metric_time_series
       WHERE metric_id = $1
         AND geography_type = $2
         AND geography_id = $3
         AND period_date BETWEEN $4 AND $5
       ORDER BY period_date ASC`,
      [metricKey, geoType, geoId, startDate, endDate]
    );

    if (result.rows.length >= MIN_BASELINE_POINTS) {
      return result.rows.map((r: any) => ({ date: new Date(r.period_date), value: parseFloat(r.value) }));
    }
  }

  return [];
}

/**
 * Get the single metric value closest to a target date.
 */
async function resolveMetricAtDate(
  geographyId: string,
  metricKey: string,
  targetDate: Date
): Promise<number | null> {
  const pool = getPool();

  const searchStart = new Date(targetDate);
  searchStart.setMonth(searchStart.getMonth() - 3);
  const searchEnd = new Date(targetDate);
  searchEnd.setMonth(searchEnd.getMonth() + 3);

  const geoTypes = ['submarket', 'metro', 'national'];

  for (const geoType of geoTypes) {
    const geoId = geoType === 'national' ? 'national' : geographyId;

    const result = await pool.query(
      `SELECT value
       FROM metric_time_series
       WHERE metric_id = $1
         AND geography_type = $2
         AND geography_id = $3
         AND period_date BETWEEN $4 AND $5
       ORDER BY ABS(EXTRACT(EPOCH FROM (period_date - $6::date))) ASC
       LIMIT 1`,
      [metricKey, geoType, geoId, searchStart, searchEnd, targetDate]
    );

    if (result.rows.length > 0) {
      return parseFloat(result.rows[0].value);
    }
  }

  return null;
}

// ─── OLS Engine ──────────────────────────────────────────────────────────────

/**
 * Fit an OLS line to a time series. X = months from first point, Y = value.
 */
export function fitOLS(series: TimeSeriesPoint[]): OLSResult | null {
  if (series.length < MIN_BASELINE_POINTS) return null;

  const t0 = series[0].date.getTime();
  const msPerMonth = 30.44 * 24 * 3600 * 1000;

  const xs = series.map(p => (p.date.getTime() - t0) / msPerMonth);
  const ys = series.map(p => p.value);
  const n = xs.length;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let ssXX = 0, ssXY = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXX += (xs[i] - meanX) ** 2;
    ssXY += (xs[i] - meanX) * (ys[i] - meanY);
    ssYY += (ys[i] - meanY) ** 2;
  }

  if (ssXX === 0) return null;

  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;

  const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]));
  const ssRes = residuals.reduce((a, r) => a + r * r, 0);
  const r2 = ssYY === 0 ? 1 : Math.max(0, 1 - ssRes / ssYY);

  return { slope, intercept, r2, n };
}

/**
 * Extrapolate OLS value at an offset of offsetMonths from the last baseline point.
 */
export function extrapolateOLS(
  ols: OLSResult,
  lastBaselineDate: Date,
  baselineStartDate: Date,
  targetDate: Date
): number {
  const msPerMonth = 30.44 * 24 * 3600 * 1000;
  const t0 = baselineStartDate.getTime();
  const xTarget = (targetDate.getTime() - t0) / msPerMonth;
  return ols.intercept + ols.slope * xTarget;
}

/**
 * Approximate p-value for a Pearson r with n observations.
 * Two-tailed, uses normal approximation.
 */
function approxPValue(r: number, n: number): number {
  if (n < 3 || Math.abs(r) >= 1) return 0;
  const t = r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
  const absT = Math.abs(t);
  // Simple rational approximation of the normal CDF tail
  const p = 0.3275911;
  const z = absT / Math.sqrt(2);
  const tPoly = 1 / (1 + p * z);
  const erf = 1 - tPoly * (0.254829592 + tPoly * (-0.284496736 + tPoly * (1.421413741 + tPoly * (-1.453152027 + tPoly * 1.061405429)))) * Math.exp(-z * z);
  return Math.max(0, Math.min(1, 2 * (1 - 0.5 * (1 + erf))));
}

// ─── Control Submarket Matching ───────────────────────────────────────────────

/**
 * Select control submarkets for a given event.
 * Criteria:
 *   - Same MSA as event
 *   - No same-category event within ±18 months of event's materialization_date
 *   - Pre-event trend similarity: compute OLS slope on primary metric (rent_index)
 *     for each candidate; score = 1 - min(|slope_diff|/max(|treat_slope|,0.001), 1)
 *   - Class/demographic similarity from submarkets table (avg_rent, class_label, avg_occupancy)
 */
export async function selectControlGroup(
  eventId: string,
  event: {
    msaId: string | null;
    msaName: string | null;
    category: string;
    materializationDate: Date;
    geographyId: string;
  }
): Promise<ControlGroupEntry[]> {
  const pool = getPool();

  if (!event.msaId && !event.msaName) {
    logger.warn('[M35 Impact] Cannot select control group: no MSA info', { eventId });
    return [];
  }

  const windowStart = new Date(event.materializationDate);
  windowStart.setMonth(windowStart.getMonth() - 18);
  const windowEnd = new Date(event.materializationDate);
  windowEnd.setMonth(windowEnd.getMonth() + 18);

  const baselineStart = new Date(event.materializationDate);
  baselineStart.setMonth(baselineStart.getMonth() - BASELINE_MONTHS);
  const baselineEnd = new Date(event.materializationDate);

  // Get candidate submarkets in same MSA (include class_label and avg_rent for similarity)
  const candidatesRes = await pool.query(
    `SELECT s.id::text AS id, s.name,
            COALESCE(s.avg_rent, 0) AS avg_rent,
            COALESCE(s.avg_occupancy, 0) AS avg_occupancy,
            COALESCE(s.class_label, '') AS class_label
     FROM submarkets s
     WHERE ($1::text IS NULL OR s.msa_id::text = $1)
       AND s.id::text != $2
     LIMIT $3`,
    [event.msaId, event.geographyId, MAX_CONTROL_N * 3]
  );

  if (candidatesRes.rows.length === 0) {
    logger.info('[M35 Impact] No candidate control submarkets found', { eventId });
    return [];
  }

  // Get same-category events in the window (to exclude those submarkets)
  const excludeRes = await pool.query(
    `SELECT DISTINCT submarket_id FROM key_events
     WHERE category = $1
       AND (announced_date BETWEEN $2 AND $3 OR materialization_date BETWEEN $2 AND $3)
       AND id != $4
       AND submarket_id IS NOT NULL`,
    [event.category, windowStart, windowEnd, eventId]
  );
  const excludedIds = new Set(excludeRes.rows.map((r: any) => r.submarket_id));

  // Compute treatment pre-event OLS slope on the primary metric for trend similarity
  const primaryMetric = 'rent_index';
  const treatmentSeries = await resolveMetricSeries(
    event.geographyId, primaryMetric, baselineStart, baselineEnd
  );
  const treatmentOls = fitOLS(treatmentSeries);
  const treatmentSlope = treatmentOls?.slope ?? null;

  // Get treatment submarket's own class/rent/occupancy for demographic similarity
  const treatRes = await pool.query(
    `SELECT COALESCE(avg_rent, 0) AS avg_rent,
            COALESCE(avg_occupancy, 0) AS avg_occupancy,
            COALESCE(class_label, '') AS class_label
     FROM submarkets WHERE id::text = $1 LIMIT 1`,
    [event.geographyId]
  );
  const treatAttr = treatRes.rows[0] ?? null;

  // Score each candidate
  const scored: Array<ControlGroupEntry & { _rank: number }> = [];

  for (const c of candidatesRes.rows) {
    const isExcluded = excludedIds.has(c.id);
    const matchCriteria: Record<string, number> = {};
    const componentScores: number[] = [];

    // 1. No confounding event (binary: 1.0 / 0.0)
    const confoundScore = isExcluded ? 0.0 : 1.0;
    matchCriteria.no_confounding_event = confoundScore;

    // 2. Pre-event trend similarity (OLS slope comparison on rent_index)
    let trendScore = 0.5; // default when we have no data
    if (treatmentSlope !== null) {
      try {
        const ctrlSeries = await resolveMetricSeries(c.id, primaryMetric, baselineStart, baselineEnd);
        const ctrlOls = fitOLS(ctrlSeries);
        if (ctrlOls) {
          const slopeDiff = Math.abs(ctrlOls.slope - treatmentSlope);
          const denom = Math.max(Math.abs(treatmentSlope), 0.001);
          trendScore = Math.max(0, 1 - Math.min(slopeDiff / denom, 1));
        }
      } catch (_) { /* non-fatal */ }
    }
    matchCriteria.pre_event_trend_similarity = Math.round(trendScore * 10000) / 10000;
    componentScores.push(trendScore * 0.40); // 40% weight

    // 3. Class/asset class similarity
    let classScore = 0.5;
    if (treatAttr && treatAttr.class_label && c.class_label) {
      classScore = c.class_label === treatAttr.class_label ? 1.0 : 0.2;
    }
    matchCriteria.class_similarity = classScore;
    componentScores.push(classScore * 0.25); // 25% weight

    // 4. Demographic/rent-level similarity
    let rentScore = 0.5;
    if (treatAttr && treatAttr.avg_rent > 0 && c.avg_rent > 0) {
      const rentDiff = Math.abs(c.avg_rent - treatAttr.avg_rent);
      const rentDenom = Math.max(treatAttr.avg_rent, 1);
      rentScore = Math.max(0, 1 - Math.min(rentDiff / rentDenom, 1));
    }
    matchCriteria.rent_level_similarity = Math.round(rentScore * 10000) / 10000;
    componentScores.push(rentScore * 0.20); // 20% weight

    // 5. Occupancy similarity
    let occScore = 0.5;
    if (treatAttr && treatAttr.avg_occupancy > 0 && c.avg_occupancy > 0) {
      const occDiff = Math.abs(c.avg_occupancy - treatAttr.avg_occupancy);
      occScore = Math.max(0, 1 - Math.min(occDiff / 100, 1));
    }
    matchCriteria.occupancy_similarity = Math.round(occScore * 10000) / 10000;
    componentScores.push(occScore * 0.15); // 15% weight

    const matchScore = Math.min(1, componentScores.reduce((a, b) => a + b, 0));

    scored.push({
      id: uuidv4(),
      eventId,
      controlGeographyType: 'submarket',
      controlGeographyId: c.id,
      controlGeographyName: c.name,
      matchScore: Math.round(matchScore * 10000) / 10000,
      matchCriteria,
      isIncluded: !isExcluded,
      exclusionReason: isExcluded ? `Confounding ${event.category} event within ±18mo window` : null,
      _rank: isExcluded ? 0 : matchScore,
    });
  }

  // Sort by rank desc, take top TARGET_CONTROL_N included + all excluded
  scored.sort((a, b) => b._rank - a._rank);
  const included = scored.filter(s => s.isIncluded).slice(0, TARGET_CONTROL_N);
  const excluded = scored.filter(s => !s.isIncluded);

  return [...included, ...excluded];
}

// ─── Single-metric impact computation ─────────────────────────────────────────

async function computeMetricWindowImpact(
  event: {
    id: string;
    category: string;
    msaId: string | null;
    msaName: string | null;
    materializationDate: Date;
    geographyId: string;
  },
  metricKey: string,
  windowMonths: number,
  controlGroup: ControlGroupEntry[]
): Promise<Partial<ImpactRecord>> {
  const geographyId = event.msaId ?? event.geographyId;

  const baselineEnd = new Date(event.materializationDate);
  const baselineStart = new Date(event.materializationDate);
  baselineStart.setMonth(baselineStart.getMonth() - BASELINE_MONTHS);

  const measurementDate = new Date(event.materializationDate);
  measurementDate.setMonth(measurementDate.getMonth() + windowMonths);

  // Only compute if measurement date is in the past
  if (measurementDate > new Date()) {
    return {
      dataQuality: 'insufficient',
      dataGaps: [`Measurement window T+${windowMonths}mo not yet reached (${measurementDate.toISOString().split('T')[0]})`],
    };
  }

  // Resolve pre-event baseline series
  const baselineSeries = await resolveMetricSeries(geographyId, metricKey, baselineStart, baselineEnd);

  if (baselineSeries.length < MIN_BASELINE_POINTS) {
    return {
      dataQuality: 'insufficient',
      dataGaps: [`Insufficient baseline data: only ${baselineSeries.length} points (need ${MIN_BASELINE_POINTS})`],
    };
  }

  // Fit OLS
  const ols = fitOLS(baselineSeries);
  if (!ols) {
    return {
      dataQuality: 'insufficient',
      dataGaps: ['OLS fit failed — possibly flat or missing series'],
    };
  }

  // Extrapolate to measurement date
  const projectedValue = extrapolateOLS(ols, baselineEnd, baselineStart, measurementDate);

  // Get actual value at measurement date
  const actualValue = await resolveMetricAtDate(geographyId, metricKey, measurementDate);

  if (actualValue === null) {
    return {
      baselineSlope: ols.slope,
      baselineIntercept: ols.intercept,
      baselineR2: ols.r2,
      baselineN: ols.n,
      projectedValue,
      dataQuality: 'partial',
      dataGaps: [`No actual value found at measurement date ${measurementDate.toISOString().split('T')[0]}`],
    };
  }

  const delta = actualValue - projectedValue;
  const deltaPct = projectedValue !== 0 ? (delta / Math.abs(projectedValue)) * 100 : null;

  // ── DiD: compute control group deltas ──────────────────────────────────────
  const includedControls = controlGroup.filter(c => c.isIncluded);
  const controlDeltas: number[] = [];

  for (const ctrl of includedControls) {
    try {
      const ctrlBaseline = await resolveMetricSeries(
        ctrl.controlGeographyId, metricKey, baselineStart, baselineEnd
      );
      if (ctrlBaseline.length < MIN_BASELINE_POINTS) continue;

      const ctrlOls = fitOLS(ctrlBaseline);
      if (!ctrlOls) continue;

      const ctrlProjected = extrapolateOLS(ctrlOls, baselineEnd, baselineStart, measurementDate);
      const ctrlActual = await resolveMetricAtDate(ctrl.controlGeographyId, metricKey, measurementDate);
      if (ctrlActual === null) continue;

      controlDeltas.push(ctrlActual - ctrlProjected);
    } catch (err) {
      logger.debug('[M35 Impact] Control delta computation failed', { controlId: ctrl.controlGeographyId, err });
    }
  }

  const controlAvgDelta = controlDeltas.length > 0
    ? controlDeltas.reduce((a, b) => a + b, 0) / controlDeltas.length
    : null;

  const attributedDelta = controlAvgDelta !== null ? delta - controlAvgDelta : null;
  const attributedDeltaPct = attributedDelta !== null && projectedValue !== 0
    ? (attributedDelta / Math.abs(projectedValue)) * 100
    : null;

  const avgMatchScore = includedControls.length > 0
    ? includedControls.reduce((a, c) => a + c.matchScore, 0) / includedControls.length
    : 0;

  const dataCompleteness = controlDeltas.length / Math.max(1, includedControls.length);
  const didConfidence = Math.round(avgMatchScore * dataCompleteness * 10000) / 10000;

  const pValue = ols.r2 > 0 ? approxPValue(Math.sqrt(ols.r2), ols.n) : null;

  return {
    baselineSlope: ols.slope,
    baselineIntercept: ols.intercept,
    baselineR2: ols.r2,
    baselineN: ols.n,
    projectedValue,
    actualValue,
    delta,
    deltaPct,
    controlAvgDelta,
    attributedDelta,
    attributedDeltaPct,
    didConfidence,
    pValue,
    controlGroupN: controlDeltas.length,
    dataQuality: controlDeltas.length >= 2 ? 'complete' : 'partial',
    dataGaps: controlDeltas.length < includedControls.length
      ? [`Only ${controlDeltas.length}/${includedControls.length} controls had sufficient data`]
      : [],
  };
}

// ─── Main Impact Computation ───────────────────────────────────────────────────

/**
 * Compute all metric × window impacts for a single event.
 * Only runs if event.status = 'materialized' and materialization_date is set.
 */
export async function computeEventImpact(eventId: string): Promise<ImpactRecord[]> {
  const pool = getPool();

  const eventRes = await pool.query(
    `SELECT id, category, msa_id, msa_name, submarket_id, status, materialization_date
     FROM key_events WHERE id = $1`,
    [eventId]
  );

  if (eventRes.rows.length === 0) throw new Error(`Event ${eventId} not found`);

  const ev = eventRes.rows[0];

  if (ev.status !== 'materialized') {
    logger.info('[M35 Impact] Skipping non-materialized event', { eventId, status: ev.status });
    return [];
  }

  if (!ev.materialization_date) {
    logger.info('[M35 Impact] Skipping event with no materialization_date', { eventId });
    return [];
  }

  const event = {
    id: ev.id,
    category: ev.category,
    msaId: ev.msa_id ?? null,
    msaName: ev.msa_name ?? null,
    materializationDate: new Date(ev.materialization_date),
    geographyId: ev.submarket_id ?? ev.msa_id ?? 'national',
  };

  // Select control group (persist to DB)
  const controlGroup = await selectControlGroup(eventId, event);
  await persistControlGroup(eventId, controlGroup);

  // Determine metric keys: prefer event-specific watchlist, fall back to category registry
  const watchlistRes = await pool.query(
    `SELECT metric_key FROM m35_metric_watchlist_config
     WHERE event_id = $1 AND is_active = true
     ORDER BY created_at ASC`,
    [eventId]
  );
  const metricKeys: string[] = watchlistRes.rows.length > 0
    ? watchlistRes.rows.map((r: any) => r.metric_key as string)
    : (M35_METRIC_REGISTRY[event.category] ?? ['rent_index']);

  const results: ImpactRecord[] = [];

  for (const metricKey of metricKeys) {
    for (const windowMonths of MEASUREMENT_WINDOWS) {
      try {
        const partial = await computeMetricWindowImpact(event, metricKey, windowMonths, controlGroup);

        const record: ImpactRecord = {
          id: uuidv4(),
          eventId,
          metricKey,
          geographyType: 'metro',
          geographyId: event.msaId ?? 'national',
          windowMonths,
          measurementDate: new Date(event.materializationDate.getTime()),
          baselineSlope: partial.baselineSlope ?? null,
          baselineIntercept: partial.baselineIntercept ?? null,
          baselineR2: partial.baselineR2 ?? null,
          baselineN: partial.baselineN ?? 0,
          projectedValue: partial.projectedValue ?? null,
          actualValue: partial.actualValue ?? null,
          delta: partial.delta ?? null,
          deltaPct: partial.deltaPct ?? null,
          controlAvgDelta: partial.controlAvgDelta ?? null,
          attributedDelta: partial.attributedDelta ?? null,
          attributedDeltaPct: partial.attributedDeltaPct ?? null,
          didConfidence: partial.didConfidence ?? 0,
          pValue: partial.pValue ?? null,
          controlGroupN: partial.controlGroupN ?? 0,
          dataQuality: partial.dataQuality ?? 'insufficient',
          dataGaps: partial.dataGaps ?? [],
          computedAt: new Date(),
        };

        const m = record.measurementDate;
        m.setMonth(m.getMonth() + windowMonths);

        await persistImpactRecord(record);
        results.push(record);

        // Publish Kafka event for each complete window with actual data
        if (record.delta !== null) {
          await publishImpactMeasured(record, event.category, event.msaId ?? '');
        }
      } catch (err) {
        logger.error('[M35 Impact] Error computing window impact', {
          eventId, metricKey, windowMonths, err,
        });
      }
    }
  }

  logger.info('[M35 Impact] Computation complete', {
    eventId, metrics: metricKeys.length, windows: MEASUREMENT_WINDOWS.length, records: results.length,
  });

  return results;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistControlGroup(eventId: string, group: ControlGroupEntry[]): Promise<void> {
  if (group.length === 0) return;
  const pool = getPool();

  // Upsert — clear existing and re-insert (idempotent re-compute)
  await pool.query(`DELETE FROM event_control_groups WHERE event_id = $1`, [eventId]);

  for (const c of group) {
    await pool.query(
      `INSERT INTO event_control_groups
         (id, event_id, control_geography_type, control_geography_id, control_geography_name,
          match_score, match_criteria, is_included, exclusion_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (event_id, control_geography_id) DO UPDATE SET
         match_score = EXCLUDED.match_score,
         match_criteria = EXCLUDED.match_criteria,
         is_included = EXCLUDED.is_included,
         exclusion_reason = EXCLUDED.exclusion_reason`,
      [c.id, c.eventId, c.controlGeographyType, c.controlGeographyId, c.controlGeographyName,
       c.matchScore, JSON.stringify(c.matchCriteria), c.isIncluded, c.exclusionReason]
    );
  }
}

async function persistImpactRecord(r: ImpactRecord): Promise<void> {
  const pool = getPool();

  await pool.query(
    `INSERT INTO event_impacts
       (id, event_id, metric_key, geography_type, geography_id, window_months, measurement_date,
        baseline_slope, baseline_intercept, baseline_r2, baseline_n,
        projected_value, actual_value, delta, delta_pct,
        control_avg_delta, attributed_delta, attributed_delta_pct,
        did_confidence, p_value, control_group_n,
        data_quality, data_gaps, computed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     ON CONFLICT (event_id, metric_key, geography_id, window_months) DO UPDATE SET
       baseline_slope = EXCLUDED.baseline_slope,
       baseline_intercept = EXCLUDED.baseline_intercept,
       baseline_r2 = EXCLUDED.baseline_r2,
       baseline_n = EXCLUDED.baseline_n,
       projected_value = EXCLUDED.projected_value,
       actual_value = EXCLUDED.actual_value,
       delta = EXCLUDED.delta,
       delta_pct = EXCLUDED.delta_pct,
       control_avg_delta = EXCLUDED.control_avg_delta,
       attributed_delta = EXCLUDED.attributed_delta,
       attributed_delta_pct = EXCLUDED.attributed_delta_pct,
       did_confidence = EXCLUDED.did_confidence,
       p_value = EXCLUDED.p_value,
       control_group_n = EXCLUDED.control_group_n,
       data_quality = EXCLUDED.data_quality,
       data_gaps = EXCLUDED.data_gaps,
       computed_at = EXCLUDED.computed_at`,
    [
      r.id, r.eventId, r.metricKey, r.geographyType, r.geographyId, r.windowMonths, r.measurementDate,
      r.baselineSlope, r.baselineIntercept, r.baselineR2, r.baselineN,
      r.projectedValue, r.actualValue, r.delta, r.deltaPct,
      r.controlAvgDelta, r.attributedDelta, r.attributedDeltaPct,
      r.didConfidence, r.pValue, r.controlGroupN,
      r.dataQuality, JSON.stringify(r.dataGaps), r.computedAt,
    ]
  );
}

// ─── Kafka ────────────────────────────────────────────────────────────────────

async function publishImpactMeasured(
  r: ImpactRecord,
  category: string,
  msaId: string
): Promise<void> {
  try {
    const msg: M35ImpactMeasuredMessage = {
      eventId: uuidv4(),
      eventType: 'M35_IMPACT_MEASURED',
      timestamp: new Date().toISOString(),
      keyEventId: r.eventId,
      msaId,
      category,
      metricKey: r.metricKey,
      windowMonths: r.windowMonths,
      delta: r.delta!,
      deltaPct: r.deltaPct,
      attributedDelta: r.attributedDelta,
      didConfidence: r.didConfidence,
      dataQuality: r.dataQuality,
    };

    await kafkaProducer.publish(KAFKA_TOPICS.M35_IMPACT_MEASURED, msg, {
      key: r.eventId,
      publishedBy: 'm35-impact-service',
    });
  } catch (err) {
    logger.warn('[M35 Impact] Kafka publish failed (non-fatal)', { eventId: r.eventId, err });
  }
}

// ─── GET Impacts ──────────────────────────────────────────────────────────────

export async function getEventImpacts(eventId: string): Promise<ImpactRecord[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM event_impacts WHERE event_id = $1 ORDER BY window_months, metric_key`,
    [eventId]
  );

  return result.rows.map((r: any) => ({
    id: r.id,
    eventId: r.event_id,
    metricKey: r.metric_key,
    geographyType: r.geography_type,
    geographyId: r.geography_id,
    windowMonths: r.window_months,
    measurementDate: r.measurement_date,
    baselineSlope: r.baseline_slope != null ? parseFloat(r.baseline_slope) : null,
    baselineIntercept: r.baseline_intercept != null ? parseFloat(r.baseline_intercept) : null,
    baselineR2: r.baseline_r2 != null ? parseFloat(r.baseline_r2) : null,
    baselineN: r.baseline_n,
    projectedValue: r.projected_value != null ? parseFloat(r.projected_value) : null,
    actualValue: r.actual_value != null ? parseFloat(r.actual_value) : null,
    delta: r.delta != null ? parseFloat(r.delta) : null,
    deltaPct: r.delta_pct != null ? parseFloat(r.delta_pct) : null,
    controlAvgDelta: r.control_avg_delta != null ? parseFloat(r.control_avg_delta) : null,
    attributedDelta: r.attributed_delta != null ? parseFloat(r.attributed_delta) : null,
    attributedDeltaPct: r.attributed_delta_pct != null ? parseFloat(r.attributed_delta_pct) : null,
    didConfidence: parseFloat(r.did_confidence ?? '0'),
    pValue: r.p_value != null ? parseFloat(r.p_value) : null,
    controlGroupN: r.control_group_n,
    dataQuality: r.data_quality,
    dataGaps: r.data_gaps ?? [],
    computedAt: r.computed_at,
  }));
}

export async function getEventControlGroup(eventId: string): Promise<ControlGroupEntry[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM event_control_groups WHERE event_id = $1 ORDER BY match_score DESC`,
    [eventId]
  );
  return result.rows.map((r: any) => ({
    id: r.id,
    eventId: r.event_id,
    controlGeographyType: r.control_geography_type,
    controlGeographyId: r.control_geography_id,
    controlGeographyName: r.control_geography_name,
    matchScore: parseFloat(r.match_score),
    matchCriteria: r.match_criteria ?? {},
    isIncluded: r.is_included,
    exclusionReason: r.exclusion_reason,
  }));
}

// ─── Nightly Job ──────────────────────────────────────────────────────────────

/**
 * Scan key_events for items that have crossed a T+3 / T+12 / T+24 / T+36
 * measurement window milestone since the last run. Trigger computeEventImpact
 * for each. Safe to run multiple times (upsert semantics).
 */
export async function runImpactMeasurementJob(options?: { since?: Date }): Promise<{
  scanned: number;
  computed: number;
  skipped: number;
  errors: number;
}> {
  const pool = getPool();
  const now = new Date();

  // Find materialized events with a materialization_date in the past
  const eventsRes = await pool.query(
    `SELECT id, category, msa_id, msa_name, submarket_id, materialization_date
     FROM key_events
     WHERE status = 'materialized'
       AND materialization_date IS NOT NULL
       AND materialization_date <= $1
     ORDER BY materialization_date DESC
     LIMIT 200`,
    [now]
  );

  const events = eventsRes.rows;
  let computed = 0, skipped = 0, errors = 0;

  logger.info('[M35 Impact Job] Starting impact measurement job', { eventCount: events.length });

  for (const ev of events) {
    const matDate = new Date(ev.materialization_date);

    // Check if any measurement window has been crossed since last computed_at
    const windowCrossed = MEASUREMENT_WINDOWS.some(wm => {
      const windowDate = new Date(matDate);
      windowDate.setMonth(windowDate.getMonth() + wm);
      return windowDate <= now;
    });

    if (!windowCrossed) { skipped++; continue; }

    try {
      await computeEventImpact(ev.id);
      computed++;
    } catch (err) {
      logger.error('[M35 Impact Job] Error computing impact', { eventId: ev.id, err });
      errors++;
    }
  }

  const result = { scanned: events.length, computed, skipped, errors };
  logger.info('[M35 Impact Job] Complete', result);
  return result;
}
