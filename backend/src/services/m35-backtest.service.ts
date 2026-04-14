/**
 * M35 Backtesting & Confidence Refinement Service  (Phase 5)
 *
 * Monthly job that, for every event now at T+12, T+24, or T+36 months:
 *   1. Pulls the active-or-superseded forecast that was made at announcement
 *   2. Computes actual metric delta using Difference-in-Differences (DiD)
 *   3. Logs error / coverage / bias to backtest_results
 *   4. Updates playbook confidence via Bayesian decay:
 *        new_conf = prior × (1-λ) + hit_rate × λ,  λ = 0.25
 *   5. Detects regime-shift if ≥5 consecutive biased results exist
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { kafkaProducer } from './kafka/kafka-producer.service';
import { KAFKA_TOPICS } from './kafka/event-schemas';
import { toCanonicalId } from './m35-metric-mapping';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_DECAY = 0.25;          // λ for Bayesian update
const REGIME_SHIFT_WINDOW = 5;          // consecutive biased results → alert
const MEASUREMENT_WINDOWS = [12, 24, 36] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BacktestResult {
  id: string;
  eventId: string;
  forecastId: string | null;
  subtype: string;
  metricKey: string;
  windowMonths: number;
  forecastValue: number | null;
  actualValue: number | null;
  error: number | null;
  pctError: number | null;
  isWithinCi: boolean | null;
  ciLow: number | null;
  ciHigh: number | null;
  biasDirection: 'over' | 'under' | 'exact';
  backtestDate: Date;
}

export interface PlaybookAccuracyStats {
  subtype: string;
  metricKey: string;
  windowMonths: number;
  backtestCount: number;
  rmse: number | null;
  meanPctError: number | null;
  coverageRate: number | null;    // fraction of actuals within CI
  currentConfidence: number | null;
  biasDirection: 'over' | 'under' | 'balanced' | 'insufficient_data';
  hasRegimeAlert: boolean;
}

export interface RegimeShiftAlert {
  id: string;
  subtype: string;
  metricKey: string;
  windowMonths: number;
  detectedAt: Date;
  biasDirection: string;
  avgPctError: number | null;
  status: string;
}

export interface BacktestJobResult {
  eventsChecked: number;
  windowsEvaluated: number;
  newBacktestRows: number;
  playbooksRefined: number;
  regimeAlertsCreated: number;
}

// ─── DiD: Actual metric delta computation ────────────────────────────────────

async function computeActualDelta(
  geoId: string,
  controlGeoIds: string[],
  metricKey: string,
  eventDate: Date,
  windowMonths: number,
  pool: ReturnType<typeof getPool>,
): Promise<number | null> {
  // Translate M35 shorthand to canonical DB metric_id
  const canonicalMetricId = toCanonicalId(metricKey);

  // Pre-event baseline: 12 months before event
  const preStart = new Date(eventDate);
  preStart.setMonth(preStart.getMonth() - 12);
  const preEnd = new Date(eventDate);

  // Post-event window: eventDate → eventDate + windowMonths
  const postStart = new Date(eventDate);
  const postEnd = new Date(eventDate);
  postEnd.setMonth(postEnd.getMonth() + windowMonths);

  // Treated geography: post - pre
  const treatedRes = await pool.query(`
    SELECT
      AVG(CASE WHEN period_date BETWEEN $2 AND $3 THEN value END) AS post_val,
      AVG(CASE WHEN period_date BETWEEN $4 AND $5 THEN value END) AS pre_val
    FROM metric_time_series
    WHERE geography_id = $1 AND metric_id = $6
  `, [geoId, postStart, postEnd, preStart, preEnd, canonicalMetricId]);

  const treated = treatedRes.rows[0];
  if (!treated || treated.post_val == null || treated.pre_val == null) return null;

  const treatedDelta = parseFloat(treated.post_val) - parseFloat(treated.pre_val);

  if (controlGeoIds.length === 0) return treatedDelta;

  // Control: average across control geographies
  const controlRes = await pool.query(`
    SELECT
      AVG(CASE WHEN period_date BETWEEN $2 AND $3 THEN value END) AS post_val,
      AVG(CASE WHEN period_date BETWEEN $4 AND $5 THEN value END) AS pre_val
    FROM metric_time_series
    WHERE geography_id = ANY($1::text[]) AND metric_id = $6
  `, [controlGeoIds, postStart, postEnd, preStart, preEnd, canonicalMetricId]);

  const control = controlRes.rows[0];
  if (!control || control.post_val == null || control.pre_val == null) return treatedDelta;

  const controlDelta = parseFloat(control.post_val) - parseFloat(control.pre_val);
  return treatedDelta - controlDelta;  // DiD estimate
}

// ─── Core: Monthly backtest job ───────────────────────────────────────────────

export async function runMonthlyBacktest(): Promise<BacktestJobResult> {
  const pool = getPool();
  const result: BacktestJobResult = {
    eventsChecked: 0,
    windowsEvaluated: 0,
    newBacktestRows: 0,
    playbooksRefined: 0,
    regimeAlertsCreated: 0,
  };

  const playbooksToRefine = new Set<string>();   // "subtype|metric|window"

  // Find all events where at least one window has elapsed
  const eventsRes = await pool.query(`
    SELECT
      ke.id, ke.subtype, ke.msa_id, ke.submarket_id,
      ke.announced_date, ke.materialization_date, ke.confidence,
      EXTRACT(EPOCH FROM (NOW() - ke.announced_date)) / 2592000 AS months_since_announced
    FROM key_events ke
    WHERE ke.announced_date IS NOT NULL
      AND ke.subtype IS NOT NULL
      AND ke.status IN ('in_progress', 'materialized', 'reversed', 'cancelled')
      AND EXTRACT(EPOCH FROM (NOW() - ke.announced_date)) / 2592000 >= 12
    ORDER BY ke.announced_date
    LIMIT 200
  `);

  for (const ev of eventsRes.rows) {
    result.eventsChecked++;
    const geoId = ev.submarket_id ?? ev.msa_id;
    if (!geoId) continue;

    const eventDate = new Date(ev.announced_date);
    const monthsElapsed = parseFloat(ev.months_since_announced);

    // Load control group from event_control_groups if present
    const controlRes = await pool.query(`
      SELECT control_geography_id
      FROM event_control_groups
      WHERE event_id = $1
    `, [ev.id]);
    const controlGeoIds = controlRes.rows.map((r: any) => r.control_geography_id);

    // Load the relevant forecast for this event (at time of announcement)
    const forecastRes = await pool.query(`
      SELECT id, metric_key, window_months, point_estimate, ci_low, ci_high
      FROM event_forecasts
      WHERE event_id = $1
        AND (status = 'active' OR status = 'superseded')
      ORDER BY generated_at ASC
    `, [ev.id]);

    const forecastMap: Record<string, any> = {};
    for (const fr of forecastRes.rows) {
      const key = `${fr.metric_key}|${fr.window_months}`;
      if (!forecastMap[key]) forecastMap[key] = fr;  // use earliest (at-announcement) forecast
    }

    // Get watchlist metrics for this event
    const watchlistRes = await pool.query(`
      SELECT metric_key FROM m35_metric_watchlist_config WHERE event_id = $1 AND is_active = true
    `, [ev.id]);
    const watchlistMetrics = watchlistRes.rows.map((r: any) => r.metric_key);

    // If no watchlist, use forecast keys
    const forecastMetrics = [...new Set(forecastRes.rows.map((r: any) => r.metric_key))];
    const metricsToCheck = watchlistMetrics.length > 0 ? watchlistMetrics : forecastMetrics;

    for (const windowMonths of MEASUREMENT_WINDOWS) {
      if (monthsElapsed < windowMonths) continue;  // window hasn't elapsed yet

      for (const metricKey of metricsToCheck) {
        // Check if already backtested for this event × metric × window
        const existing = await pool.query(`
          SELECT id FROM backtest_results
          WHERE event_id = $1 AND metric_key = $2 AND window_months = $3
          LIMIT 1
        `, [ev.id, metricKey, windowMonths]);
        if (existing.rows.length > 0) continue;

        result.windowsEvaluated++;

        // Compute actual delta
        const actualValue = await computeActualDelta(
          geoId, controlGeoIds, metricKey, eventDate, windowMonths, pool,
        );

        if (actualValue === null) continue;

        const forecastKey = `${metricKey}|${windowMonths}`;
        const fc = forecastMap[forecastKey];
        const forecastValue = fc ? parseFloat(fc.point_estimate) : null;
        const ciLow = fc ? parseFloat(fc.ci_low) : null;
        const ciHigh = fc ? parseFloat(fc.ci_high) : null;

        const error = forecastValue !== null ? actualValue - forecastValue : null;
        const pctError = forecastValue !== null && forecastValue !== 0
          ? (actualValue - forecastValue) / Math.abs(forecastValue)
          : null;

        const isWithinCi = (ciLow !== null && ciHigh !== null)
          ? actualValue >= Math.min(ciLow, ciHigh) && actualValue <= Math.max(ciLow, ciHigh)
          : null;

        const biasDirection: 'over' | 'under' | 'exact' =
          error === null || Math.abs(error) < 0.0001 ? 'exact'
          : error < 0 ? 'over'  // we over-predicted
          : 'under';            // we under-predicted

        await pool.query(`
          INSERT INTO backtest_results
            (event_id, forecast_id, subtype, metric_key, window_months,
             forecast_value, actual_value, error, pct_error,
             is_within_ci, ci_low, ci_high, bias_direction, method, backtest_date)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'DiD',NOW())
        `, [ev.id, fc?.id ?? null, ev.subtype, metricKey, windowMonths,
            forecastValue, actualValue, error, pctError,
            isWithinCi, ciLow, ciHigh, biasDirection]);

        result.newBacktestRows++;
        playbooksToRefine.add(`${ev.subtype}|${metricKey}|${windowMonths}`);
      }
    }
  }

  // Refine playbook confidence for all affected subtype × metric × window combos
  for (const key of playbooksToRefine) {
    const [subtype, metricKey, windowMonthsStr] = key.split('|');
    const windowMonths = parseInt(windowMonthsStr);

    const refined = await refinePlaybookConfidence(subtype, metricKey, windowMonths, pool);
    if (refined) result.playbooksRefined++;

    const alertCreated = await detectRegimeShift(subtype, metricKey, windowMonths, pool);
    if (alertCreated) result.regimeAlertsCreated++;
  }

  logger.info(`[M35 Backtest] Job complete: ${JSON.stringify(result)}`);
  return result;
}

// ─── Confidence refinement: Bayesian update ──────────────────────────────────

export async function refinePlaybookConfidence(
  subtype: string,
  metricKey: string,
  windowMonths: number,
  pool?: ReturnType<typeof getPool>,
): Promise<boolean> {
  const db = pool ?? getPool();

  // Compute hit rate (fraction within CI) from recent backtests
  const statsRes = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE is_within_ci IS NOT NULL) AS total,
      COUNT(*) FILTER (WHERE is_within_ci = true)  AS hits,
      AVG(CASE WHEN is_within_ci IS NOT NULL THEN (is_within_ci::int) END) AS hit_rate
    FROM backtest_results
    WHERE subtype = $1 AND metric_key = $2 AND window_months = $3
      AND backtest_date >= NOW() - INTERVAL '24 months'
  `, [subtype, metricKey, windowMonths]);

  const stats = statsRes.rows[0];
  if (!stats || parseInt(stats.total) < 3) return false;  // need ≥3 obs

  const hitRate = parseFloat(stats.hit_rate ?? '0');

  // Pull current playbook confidence
  const pbRes = await db.query(`
    SELECT id, confidence FROM event_playbooks
    WHERE subtype = $1
      AND metric_key = $2
      AND window_months = $3
  `, [subtype, metricKey, windowMonths]);

  if (pbRes.rows.length === 0) return false;

  for (const pb of pbRes.rows) {
    const priorConf = parseFloat(pb.confidence);
    const newConf = priorConf * (1 - CONFIDENCE_DECAY) + hitRate * CONFIDENCE_DECAY;
    const clampedConf = Math.min(0.99, Math.max(0.01, newConf));

    // Widen CI if confidence dropped (accuracy degraded) — widen by inverse of hit rate
    const ciWidenFactor = hitRate < 0.70 ? 1 + (0.70 - hitRate) : 1.0;

    await db.query(`
      UPDATE event_playbooks
      SET confidence = $2,
          ci_width_factor = $3,
          last_updated = NOW()
      WHERE id = $1
    `, [pb.id, clampedConf, ciWidenFactor]);

    logger.debug(`[M35 Backtest] Refined ${subtype}/${metricKey}@${windowMonths}mo: ` +
      `conf ${priorConf.toFixed(3)} → ${clampedConf.toFixed(3)}, hitRate=${hitRate.toFixed(2)}`);
  }

  return true;
}

// ─── Regime shift detection ───────────────────────────────────────────────────

export async function detectRegimeShift(
  subtype: string,
  metricKey: string,
  windowMonths: number,
  pool?: ReturnType<typeof getPool>,
): Promise<boolean> {
  const db = pool ?? getPool();

  // Get last N backtest results sorted by date
  const recentRes = await db.query(`
    SELECT pct_error, bias_direction
    FROM backtest_results
    WHERE subtype = $1 AND metric_key = $2 AND window_months = $3
    ORDER BY backtest_date DESC
    LIMIT $4
  `, [subtype, metricKey, windowMonths, REGIME_SHIFT_WINDOW]);

  if (recentRes.rows.length < REGIME_SHIFT_WINDOW) return false;

  // Check for systematic bias (all same direction)
  const directions = recentRes.rows.map((r: any) => r.bias_direction);
  const allOver = directions.every((d: string) => d === 'over');
  const allUnder = directions.every((d: string) => d === 'under');

  if (!allOver && !allUnder) return false;

  const biasDirection = allOver ? 'over' : 'under';
  const pctErrors = recentRes.rows.map((r: any) => parseFloat(r.pct_error ?? '0'));
  const avgPctError = pctErrors.reduce((s, v) => s + v, 0) / pctErrors.length;

  // Only create alert if there isn't already an open one
  const existing = await db.query(`
    SELECT id FROM regime_shift_alerts
    WHERE subtype = $1 AND metric_key = $2 AND window_months = $3 AND status = 'open'
    LIMIT 1
  `, [subtype, metricKey, windowMonths]);

  if (existing.rows.length > 0) return false;

  await db.query(`
    INSERT INTO regime_shift_alerts
      (subtype, metric_key, window_months, detected_at, bias_direction,
       recent_pct_errors, avg_pct_error, status)
    VALUES ($1,$2,$3,NOW(),$4,$5::numeric[],$6,'open')
  `, [subtype, metricKey, windowMonths, biasDirection,
      `{${pctErrors.join(',')}}`, avgPctError]);

  // Publish Kafka alert
  try {
    await kafkaProducer.publish(KAFKA_TOPICS.M35_PLAYBOOK_UPDATED, {
      eventType: 'M35_REGIME_SHIFT_DETECTED',
      subtype, metricKey, windowMonths, biasDirection, avgPctError,
      detectedAt: new Date().toISOString(),
    }, { key: subtype });
  } catch { /* non-blocking */ }

  logger.warn(`[M35 Backtest] REGIME SHIFT DETECTED: ${subtype}/${metricKey}@${windowMonths}mo ` +
    `— consistent ${biasDirection}-prediction, avgErr=${(avgPctError * 100).toFixed(1)}%`);

  return true;
}

// ─── Read: Playbook accuracy stats ───────────────────────────────────────────

export async function getPlaybookAccuracyStats(subtype?: string): Promise<PlaybookAccuracyStats[]> {
  const pool = getPool();

  const whereClause = subtype ? `WHERE br.subtype = $1` : '';
  const params = subtype ? [subtype] : [];

  const res = await pool.query(`
    SELECT
      br.subtype,
      br.metric_key,
      br.window_months,
      COUNT(*) AS backtest_count,
      SQRT(AVG(br.error ^ 2)) AS rmse,
      AVG(br.pct_error) AS mean_pct_error,
      AVG(br.is_within_ci::int) AS coverage_rate,
      ep.confidence AS current_confidence
    FROM backtest_results br
    LEFT JOIN LATERAL (
      SELECT confidence FROM event_playbooks
      WHERE subtype = br.subtype AND metric_key = br.metric_key AND window_months = br.window_months
      LIMIT 1
    ) ep ON TRUE
    ${whereClause}
    GROUP BY br.subtype, br.metric_key, br.window_months, ep.confidence
    ORDER BY br.subtype, br.metric_key, br.window_months
  `, params);

  // Load open regime alerts
  const alertRes = await pool.query(`
    SELECT DISTINCT subtype, metric_key, window_months FROM regime_shift_alerts WHERE status = 'open'
  `);
  const alertSet = new Set(alertRes.rows.map((r: any) => `${r.subtype}|${r.metric_key}|${r.window_months}`));

  return res.rows.map((r: any) => {
    const meanPctError = r.mean_pct_error != null ? parseFloat(r.mean_pct_error) : null;
    const count = parseInt(r.backtest_count);
    const biasDir = count < 3 || meanPctError === null ? 'insufficient_data'
      : meanPctError < -0.05 ? 'over'
      : meanPctError > 0.05 ? 'under'
      : 'balanced';

    return {
      subtype: r.subtype,
      metricKey: r.metric_key,
      windowMonths: parseInt(r.window_months),
      backtestCount: count,
      rmse: r.rmse != null ? parseFloat(r.rmse) : null,
      meanPctError,
      coverageRate: r.coverage_rate != null ? parseFloat(r.coverage_rate) : null,
      currentConfidence: r.current_confidence != null ? parseFloat(r.current_confidence) : null,
      biasDirection: biasDir as PlaybookAccuracyStats['biasDirection'],
      hasRegimeAlert: alertSet.has(`${r.subtype}|${r.metric_key}|${r.window_months}`),
    };
  });
}

// ─── Read: Event-specific backtest results ────────────────────────────────────

export async function getEventBacktestResults(eventId: string): Promise<BacktestResult[]> {
  const pool = getPool();
  const res = await pool.query(`
    SELECT * FROM backtest_results WHERE event_id = $1 ORDER BY metric_key, window_months
  `, [eventId]);

  return res.rows.map((r: any) => ({
    id: r.id,
    eventId: r.event_id,
    forecastId: r.forecast_id ?? null,
    subtype: r.subtype,
    metricKey: r.metric_key,
    windowMonths: parseInt(r.window_months),
    forecastValue: r.forecast_value != null ? parseFloat(r.forecast_value) : null,
    actualValue: r.actual_value != null ? parseFloat(r.actual_value) : null,
    error: r.error != null ? parseFloat(r.error) : null,
    pctError: r.pct_error != null ? parseFloat(r.pct_error) : null,
    isWithinCi: r.is_within_ci,
    ciLow: r.ci_low != null ? parseFloat(r.ci_low) : null,
    ciHigh: r.ci_high != null ? parseFloat(r.ci_high) : null,
    biasDirection: r.bias_direction,
    backtestDate: new Date(r.backtest_date),
  }));
}

// ─── Read: Open regime shift alerts ──────────────────────────────────────────

export async function getRegimeShiftAlerts(status = 'open'): Promise<RegimeShiftAlert[]> {
  const pool = getPool();
  const res = await pool.query(`
    SELECT * FROM regime_shift_alerts WHERE status = $1 ORDER BY detected_at DESC
  `, [status]);

  return res.rows.map((r: any) => ({
    id: r.id,
    subtype: r.subtype,
    metricKey: r.metric_key,
    windowMonths: parseInt(r.window_months),
    detectedAt: new Date(r.detected_at),
    biasDirection: r.bias_direction,
    avgPctError: r.avg_pct_error != null ? parseFloat(r.avg_pct_error) : null,
    status: r.status,
  }));
}

// ─── Admin: Acknowledge regime alert ─────────────────────────────────────────

export async function acknowledgeRegimeAlert(alertId: string): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(`
    UPDATE regime_shift_alerts SET status = 'acknowledged' WHERE id = $1 AND status = 'open'
    RETURNING id
  `, [alertId]);
  return (res.rowCount ?? 0) > 0;
}
