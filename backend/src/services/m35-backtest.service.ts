import { Pool } from 'pg';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { kafkaProducer } from './kafka/kafka-producer.service';
import { KAFKA_TOPICS, type M35RegimeShiftDetectedMessage } from './kafka/event-schemas';
import { resolveMetricId } from './m35-impact.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKTEST_WINDOWS    = [12, 24, 36] as const;
const BASELINE_MONTHS     = 12;
const MIN_DATA_COVERAGE   = 0.80;
const CONFIDENCE_DECAY    = 0.15;
const EVIDENCE_HIT        = 0.85; // calibrated: strong evidence from a hit
const EVIDENCE_MISS       = 0.25; // calibrated: weak residual evidence from a miss
const HIT_RATE_THRESHOLD  = 0.55;
const CI_WIDEN_FACTOR     = 1.20;
const CI_WIDEN_MAX_HALF   = 3.0; // CI half-width cap: cannot exceed 3× |median_delta|
const REGIME_WINDOW       = 5;
const CANCELLED_STATUSES  = new Set(['cancelled', 'reversed']);

// ─── Row interfaces ───────────────────────────────────────────────────────────

interface MetricCoverageRow { cnt: string }
interface DiDRow           { pre_avg: string | null; post_avg: string | null }
interface ConfidenceRow    { confidence: string | null }
interface HitRateRow       { hits: string; total: string }
interface ErrorPctRow      { error_pct: string; metric_key: string; window_months: string }
interface RegimeExistRow   { id: string }
interface PrevStatusRow    { status: string }
interface EventRow {
  id: string; subtype: string; announced_date: string;
  msa_id: string | null; submarket_id: string | null; status: string;
}
interface ForecastRow {
  metric_key: string; point_estimate: string | null;
  ci_low: string | null; ci_high: string | null; generated_at: string;
  playbook_id: string | null; median_delta: string | null;
  p25: string | null; p75: string | null;
}
interface BacktestResultRow {
  id: string; metric_key: string; window_months: string; milestone_date: string;
  forecast_delta: string | null; forecast_p25: string | null; forecast_p75: string | null;
  actual_delta: string | null; error: string | null; error_pct: string | null;
  within_ci: boolean | null; data_coverage_pct: string | null; status: string; ran_at: string;
}
interface AccuracyStatsRow {
  subtype: string; metric_key: string; window_months: string;
  total: string; hits: string; avg_error: string | null; std_error: string | null;
}
interface BacktestReportStatsRow {
  total: string; hits: string;
  mean_error: string | null; std_error: string | null; p25: string | null; p75: string | null;
}
interface AlertRow {
  id: string; subtype: string; metric_key: string; window_months: string;
  bias_direction: string; avg_pct_error: string | null; std_error: string | null;
  sample_size: string | null; consecutive_misses: string | null; resolved: boolean;
  status: string; acknowledged_by: string | null; acknowledged_at: string | null; detected_at: string;
}
interface OpenAlertRow { bias_direction: string; consecutive_misses: string | null; detected_at: string }
interface AckRow       { id: string }
interface ControlGeoRow { control_geography_id: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

// ─── DiD actual computation ───────────────────────────────────────────────────
// Returns (treatPost−treatPre) − avg(ctrlPost−ctrlPre) for the given metric.
// dataCoverage = actual window-period points / windowMonths (measurement window only).
// geography_type filter mirrors the impact service pattern for consistency.

async function computeDiDActual(
  pool: Pool,
  geographyType: string,
  geographyId: string,
  controlGeoIds: string[],
  metricKey: string,
  announcedDate: Date,
  milestoneDate: Date,
  windowMonths: number
): Promise<{ actualValue: number | null; dataCoverage: number }> {
  const metricId  = resolveMetricId(metricKey);
  const preStart  = new Date(announcedDate);
  preStart.setMonth(preStart.getMonth() - BASELINE_MONTHS);
  const preEnd    = new Date(announcedDate);
  const postStart = new Date(announcedDate);
  const postEnd   = new Date(milestoneDate);

  // Coverage over window period only. Assumes monthly cadence (1 point/month expected).
  // For mixed-frequency metrics, dataCoverage may over/under-estimate actual coverage.
  const countRes = await pool.query<MetricCoverageRow>(
    `SELECT COUNT(*) AS cnt
     FROM metric_time_series
     WHERE metric_id = $1 AND geography_type = $2 AND geography_id = $3
       AND period_date BETWEEN $4 AND $5`,
    [metricId, geographyType, geographyId, postStart, postEnd]
  );
  const dataCoverage = Math.min(1, parseInt(countRes.rows[0]?.cnt ?? '0') / Math.max(windowMonths, 1));

  const treatRes = await pool.query<DiDRow>(
    `SELECT
       AVG(value) FILTER (WHERE period_date BETWEEN $4 AND $5) AS pre_avg,
       AVG(value) FILTER (WHERE period_date BETWEEN $6 AND $7) AS post_avg
     FROM metric_time_series
     WHERE metric_id = $1 AND geography_type = $2 AND geography_id = $3
       AND period_date BETWEEN $4 AND $7`,
    [metricId, geographyType, geographyId, preStart, preEnd, postStart, postEnd]
  );
  const treat = treatRes.rows[0];
  if (!treat || treat.pre_avg == null || treat.post_avg == null) {
    return { actualValue: null, dataCoverage };
  }
  const treatDelta = parseFloat(treat.post_avg) - parseFloat(treat.pre_avg);

  if (!controlGeoIds.length) return { actualValue: treatDelta, dataCoverage };

  const ctrlRes = await pool.query<DiDRow>(
    `SELECT
       AVG(value) FILTER (WHERE period_date BETWEEN $4 AND $5) AS pre_avg,
       AVG(value) FILTER (WHERE period_date BETWEEN $6 AND $7) AS post_avg
     FROM metric_time_series
     WHERE metric_id = $1 AND geography_type = $2 AND geography_id = ANY($3::text[])
       AND period_date BETWEEN $4 AND $7`,
    [metricId, geographyType, controlGeoIds, preStart, preEnd, postStart, postEnd]
  );
  const ctrl = ctrlRes.rows[0];
  if (!ctrl || ctrl.pre_avg == null || ctrl.post_avg == null) {
    return { actualValue: treatDelta, dataCoverage };
  }
  return { actualValue: treatDelta - (parseFloat(ctrl.post_avg) - parseFloat(ctrl.pre_avg)), dataCoverage };
}

// ─── Confidence decay (applied only once per newly-evaluated row) ─────────────

async function updatePlaybookConfidence(pool: Pool, playbookId: string, hit: boolean): Promise<void> {
  const row = await pool.query<ConfidenceRow>(
    `SELECT confidence FROM event_playbooks WHERE id = $1`, [playbookId]
  );
  if (!row.rows.length) return;
  const prior   = parseFloat(row.rows[0].confidence ?? '0.5');
  const newConf = clamp(prior * (1 - CONFIDENCE_DECAY) + (hit ? EVIDENCE_HIT : EVIDENCE_MISS) * CONFIDENCE_DECAY, 0.10, 0.99);
  await pool.query(
    `UPDATE event_playbooks SET confidence = $1, last_updated = NOW() WHERE id = $2`,
    [newConf.toFixed(4), playbookId]
  );
}

// ─── CI widening ──────────────────────────────────────────────────────────────
// Scope: subtype-wide — all playbook rows for the subtype across all metric/window tracks.
// Trigger: per-track hit rate (<55%) on the track that just received a new evaluation.
// Rationale: a low hit rate on any track signals degraded forecast accuracy for the subtype;
// widening applies to all future forecasts for that subtype ("that subtype's future forecasts").
// Spread is capped at CI_WIDEN_MAX_HALF × |median_delta| per row (episode guard).

async function widenCIIfNeeded(
  pool: Pool, subtype: string, metricKey: string, windowMonths: number
): Promise<void> {
  const hr = await pool.query<HitRateRow>(
    `SELECT COUNT(*) FILTER (WHERE within_ci = true) AS hits, COUNT(*) AS total
     FROM playbook_backtest_results
     WHERE subtype = $1 AND metric_key = $2 AND window_months = $3
       AND status = 'evaluated' AND within_ci IS NOT NULL`,
    [subtype, metricKey, windowMonths]
  );
  const total = parseInt(hr.rows[0].total ?? '0');
  if (total < 4) return; // minimum 4 evaluated samples for a statistically meaningful hit rate

  const hitRate = parseInt(hr.rows[0].hits ?? '0') / total;
  if (hitRate >= HIT_RATE_THRESHOLD) return;

  // Widen ALL playbook rows for this subtype (not just the triggering track).
  // Episode guard: rows already at the cap (half-spread >= CI_WIDEN_MAX_HALF × |median_delta|)
  // are excluded from the UPDATE to prevent runaway expansion.
  await pool.query(
    `UPDATE event_playbooks SET
       p25 = median_delta - LEAST((p75 - p25) * $2 / 2, ABS(median_delta) * $3),
       p75 = median_delta + LEAST((p75 - p25) * $2 / 2, ABS(median_delta) * $3),
       last_updated = NOW()
     WHERE subtype = $1
       AND p25 IS NOT NULL AND p75 IS NOT NULL AND median_delta IS NOT NULL
       AND (p75 - p25) / 2.0 < ABS(median_delta) * $3`,
    [subtype, CI_WIDEN_FACTOR, CI_WIDEN_MAX_HALF]
  );
  logger.info('[M35 Backtest] CI widened (subtype-wide)', { subtype, metricKey, windowMonths, hitRate });
}

// ─── Regime shift detection ───────────────────────────────────────────────────
// Design: intentionally subtype-wide (not per metric/window track).
// A regime shift reflects a structural change in the market environment affecting
// the whole subtype, so aggregating across all metrics/windows yields a more robust
// signal than per-track detection.
// Fires when the last REGIME_WINDOW evaluated rows for this subtype all share the
// same error_pct sign AND each |error_pct| exceeds 1× std dev of the sample.
// Alert stored with metric_key='*', window_months=0 as sentinel values for subtype-level scope.

async function detectRegimeShift(pool: Pool, subtype: string): Promise<void> {
  const res = await pool.query<ErrorPctRow>(
    `SELECT error_pct, metric_key, window_months FROM playbook_backtest_results
     WHERE subtype = $1 AND status = 'evaluated' AND error_pct IS NOT NULL
     ORDER BY computed_at DESC LIMIT $2`,
    [subtype, REGIME_WINDOW]
  );
  if (res.rows.length < REGIME_WINDOW) return;

  const errorPcts: number[] = res.rows.map(r => parseFloat(r.error_pct));
  const allNegative = errorPcts.every(e => e < 0);
  const allPositive = errorPcts.every(e => e > 0);
  if (!allNegative && !allPositive) return;

  const stdErr = stdDev(errorPcts);
  if (!errorPcts.every(e => Math.abs(e) > stdErr)) return;

  const avgPctErr = mean(errorPcts);

  const existing = await pool.query<RegimeExistRow>(
    `SELECT id FROM regime_shift_alerts WHERE subtype = $1 AND status = 'open' LIMIT 1`,
    [subtype]
  );
  if (existing.rows.length > 0) return;

  const alertId    = uuidv4();
  const direction  = allNegative ? 'over' : 'under';
  const detectedAt = new Date().toISOString();

  // metric_key='*' and window_months=0 indicate subtype-level scope (not a specific track)
  await pool.query(
    `INSERT INTO regime_shift_alerts
       (id, subtype, metric_key, window_months, bias_direction, avg_pct_error, std_error,
        sample_size, consecutive_misses, resolved, status, detected_at)
     VALUES ($1,$2,'*',0,$3,$4,$5,$6,$6,FALSE,'open',$7)`,
    [alertId, subtype, direction, avgPctErr.toFixed(6), stdErr.toFixed(6), REGIME_WINDOW, detectedAt]
  );

  const msg: M35RegimeShiftDetectedMessage = {
    eventId: alertId, eventType: 'M35_REGIME_SHIFT_DETECTED', timestamp: detectedAt,
    alertId, subtype, metricKey: '*', windowMonths: 0,
    biasDirection: direction as 'over' | 'under',
    avgError: avgPctErr, stdError: stdErr, sampleSize: REGIME_WINDOW, detectedAt,
  };
  try {
    await kafkaProducer.publish(KAFKA_TOPICS.M35_REGIME_SHIFT_DETECTED, msg, { key: alertId });
  } catch (e) {
    logger.warn('[M35 Backtest] Kafka publish failed for regime shift (non-fatal)', { alertId });
  }
  logger.warn('[M35 Backtest] Regime shift detected', { alertId, subtype, direction, avgPctErr, stdErr });
}

// ─── runBacktestForEvent ──────────────────────────────────────────────────────

export async function runBacktestForEvent(eventId: string): Promise<{ processed: number; skipped: number }> {
  const pool = getPool();
  let processed = 0, skipped = 0;

  const evRes = await pool.query<EventRow>(
    `SELECT id, subtype, announced_date, msa_id, submarket_id, status
     FROM key_events WHERE id = $1`,
    [eventId]
  );
  if (!evRes.rows.length) return { processed, skipped };

  const ev = evRes.rows[0];
  if (!ev.subtype || !ev.announced_date || CANCELLED_STATUSES.has(ev.status)) return { processed, skipped };

  const announcedDate = new Date(ev.announced_date);
  const geographyType = ev.submarket_id ? 'submarket' : (ev.msa_id ? 'metro' : 'national');
  const geographyId   = ev.submarket_id ?? ev.msa_id ?? 'national';
  const now           = new Date();

  // Control geographies for DiD (same geography_type as treatment)
  const ctrlRes = await pool.query<ControlGeoRow>(
    `SELECT control_geography_id FROM event_control_groups WHERE event_id = $1 AND is_included = true`,
    [eventId]
  );
  const controlGeoIds: string[] = ctrlRes.rows.map(r => r.control_geography_id);

  for (const windowMonths of BACKTEST_WINDOWS) {
    const milestoneDate = new Date(announcedDate);
    milestoneDate.setMonth(milestoneDate.getMonth() + windowMonths);
    if (milestoneDate > now) { skipped++; continue; }

    // Use EARLIEST forecast at announcement time (DISTINCT ON metric_key, oldest generated_at)
    const fcRes = await pool.query<ForecastRow>(
      `SELECT DISTINCT ON (ef.metric_key)
              ef.metric_key, ef.point_estimate, ef.ci_low, ef.ci_high, ef.generated_at,
              ep.id AS playbook_id, ep.median_delta, ep.p25, ep.p75
       FROM event_forecasts ef
       LEFT JOIN event_playbooks ep
         ON ep.subtype = $1 AND ep.metric_key = ef.metric_key
         AND ep.window_months = $2
         AND ep.stratum_msa_tier = 'all' AND ep.stratum_magnitude = 'all'
         AND ep.stratum_regime   = 'all'
       WHERE ef.event_id = $3 AND ef.window_months = $2
         AND ef.status IN ('active', 'superseded')
       ORDER BY ef.metric_key, ef.generated_at ASC`,
      [ev.subtype, windowMonths, eventId]
    );
    if (!fcRes.rows.length) { skipped++; continue; }

    for (const fc of fcRes.rows) {
      const metricKey = fc.metric_key;

      // Check existing row status before upsert — idempotency guard
      const prevRes = await pool.query<PrevStatusRow>(
        `SELECT status FROM playbook_backtest_results
         WHERE event_id = $1 AND metric_key = $2 AND window_months = $3 LIMIT 1`,
        [eventId, metricKey, windowMonths]
      );
      const prevStatus: string | null = prevRes.rows[0]?.status ?? null;

      const { actualValue, dataCoverage } = await computeDiDActual(
        pool, geographyType, geographyId, controlGeoIds, metricKey, announcedDate, milestoneDate, windowMonths
      );

      // insufficient_data when coverage is low OR DiD baseline could not be computed
      const rowStatus      = (dataCoverage < MIN_DATA_COVERAGE || actualValue == null) ? 'insufficient_data' : 'evaluated';
      const forecastMedian = fc.point_estimate != null ? parseFloat(fc.point_estimate) : null;
      // Fall back to playbook p25/p75 when forecast-specific CI bounds are absent,
      // so confidence updates remain possible even if event_forecasts lacks CI columns.
      const forecastP25    = fc.ci_low  != null ? parseFloat(fc.ci_low)  : (fc.p25 != null ? parseFloat(fc.p25) : null);
      const forecastP75    = fc.ci_high != null ? parseFloat(fc.ci_high) : (fc.p75 != null ? parseFloat(fc.p75) : null);

      let error: number | null = null, errorPct: number | null = null;
      let hitWithinCi: boolean | null = null;

      if (actualValue != null && rowStatus === 'evaluated') {
        error       = forecastMedian != null ? actualValue - forecastMedian : null;
        errorPct    = forecastMedian != null && Math.abs(forecastMedian) > 0
          ? ((actualValue - forecastMedian) / Math.abs(forecastMedian)) * 100 : null;
        hitWithinCi = forecastP25 != null && forecastP75 != null
          ? actualValue >= forecastP25 && actualValue <= forecastP75 : null;
      }

      // Always persist a row; insufficient_data rows have null error/hit columns
      await pool.query(
        `INSERT INTO playbook_backtest_results
           (id, event_id, playbook_id, subtype, metric_key, window_months, milestone_date,
            forecast_delta, forecast_p25, forecast_p75,
            actual_delta, error, error_pct, within_ci, data_coverage_pct, status, computed_at, ran_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
         ON CONFLICT (event_id, metric_key, window_months)
         DO UPDATE SET
           playbook_id = EXCLUDED.playbook_id, subtype = EXCLUDED.subtype,
           milestone_date = EXCLUDED.milestone_date,
           forecast_delta = EXCLUDED.forecast_delta, forecast_p25 = EXCLUDED.forecast_p25,
           forecast_p75 = EXCLUDED.forecast_p75, actual_delta = EXCLUDED.actual_delta,
           error = EXCLUDED.error, error_pct = EXCLUDED.error_pct,
           within_ci = EXCLUDED.within_ci, data_coverage_pct = EXCLUDED.data_coverage_pct,
           status = EXCLUDED.status, ran_at = NOW(),
           computed_at = CASE
             WHEN playbook_backtest_results.status != 'evaluated' AND EXCLUDED.status = 'evaluated'
             THEN NOW()
             ELSE playbook_backtest_results.computed_at
           END`,
        [
          uuidv4(), eventId, fc.playbook_id ?? null, ev.subtype, metricKey, windowMonths, milestoneDate,
          forecastMedian, forecastP25, forecastP75, actualValue,
          error    != null ? error.toFixed(6)   : null,
          errorPct != null ? errorPct.toFixed(4) : null,
          hitWithinCi, dataCoverage.toFixed(3), rowStatus,
        ]
      );

      // Only apply confidence/CI/regime updates when the row is newly 'evaluated'
      const isNewlyEvaluated = rowStatus === 'evaluated' && prevStatus !== 'evaluated';
      if (isNewlyEvaluated && fc.playbook_id && hitWithinCi != null) {
        await updatePlaybookConfidence(pool, fc.playbook_id, hitWithinCi);
        await widenCIIfNeeded(pool, ev.subtype, metricKey, windowMonths);
        await detectRegimeShift(pool, ev.subtype);
      } else if (isNewlyEvaluated && hitWithinCi == null) {
        // Confidence update skipped: forecast or playbook lacks CI bounds for this metric/window
        logger.warn('[M35 Backtest] confidence update skipped — no CI bounds', { eventId, metricKey, windowMonths });
      }

      processed++;
    }
  }

  logger.info('[M35 Backtest] Event backtest complete', { eventId, processed, skipped });
  return { processed, skipped };
}

// ─── runMonthlyBacktest / runAllPendingBacktests ──────────────────────────────

export async function runMonthlyBacktest(): Promise<{
  eventsChecked: number;
  eventsProcessed: number;
  totalProcessed: number;
  totalSkipped: number;
}> {
  const pool = getPool();
  // Process all eligible events; per-metric idempotency is handled inside runBacktestForEvent
  // (rows already 'evaluated' skip confidence/CI/regime updates via prevStatus check).
  // cancelled/reversed events are excluded: their forecasts are invalidated by the status
  // change and including them would corrupt hit-rate and confidence signals.
  const evRes = await pool.query<{ id: string }>(
    `SELECT id FROM key_events
     WHERE announced_date IS NOT NULL
       AND announced_date + INTERVAL '12 months' <= NOW()
       AND status NOT IN ('cancelled','reversed')
     ORDER BY announced_date ASC`
  );

  let eventsProcessed = 0, totalProcessed = 0, totalSkipped = 0;
  for (const row of evRes.rows) {
    try {
      const r = await runBacktestForEvent(row.id);
      if (r.processed > 0) eventsProcessed++;
      totalProcessed += r.processed;
      totalSkipped   += r.skipped;
    } catch (err) {
      logger.error('[M35 Backtest] Error processing event', { eventId: row.id, err });
    }
  }

  logger.info('[M35 Backtest] Monthly run complete', {
    eventsChecked: evRes.rows.length, eventsProcessed, totalProcessed, totalSkipped,
  });
  return { eventsChecked: evRes.rows.length, eventsProcessed, totalProcessed, totalSkipped };
}

export const runAllPendingBacktests = runMonthlyBacktest;

// ─── getPlaybookAccuracyStats ─────────────────────────────────────────────────

export async function getPlaybookAccuracyStats(subtype?: string): Promise<Array<{
  subtype: string; metricKey: string; windowMonths: number;
  total: number; hits: number; hitRate: number;
  avgError: number | null; stdError: number | null;
}>> {
  const pool = getPool();
  const res = await pool.query<AccuracyStatsRow>(
    `SELECT pbr.subtype, pbr.metric_key, pbr.window_months,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE pbr.within_ci = true) AS hits,
            AVG(pbr.error) AS avg_error,
            STDDEV(pbr.error) AS std_error
     FROM playbook_backtest_results pbr
     WHERE pbr.status = 'evaluated' AND pbr.within_ci IS NOT NULL
       AND ($1::text IS NULL OR pbr.subtype = $1)
     GROUP BY pbr.subtype, pbr.metric_key, pbr.window_months
     ORDER BY pbr.subtype, pbr.metric_key, pbr.window_months`,
    [subtype ?? null]
  );
  return res.rows.map(r => ({
    subtype: r.subtype, metricKey: r.metric_key, windowMonths: parseInt(r.window_months),
    total: parseInt(r.total), hits: parseInt(r.hits),
    hitRate:  parseInt(r.hits) / parseInt(r.total),
    avgError: r.avg_error != null ? parseFloat(r.avg_error) : null,
    stdError: r.std_error != null ? parseFloat(r.std_error) : null,
  }));
}

// ─── getPlaybookBacktestReport ────────────────────────────────────────────────

export async function getPlaybookBacktestReport(subtype: string): Promise<{
  subtype: string;
  hitRate: number | null;
  errorDistribution: { mean: number | null; stddev: number | null; p25: number | null; p75: number | null } | null;
  regimeStatus: { hasOpenAlert: boolean; direction?: string; consecutiveMisses?: number; detectedAt?: string };
  recentPoints: Array<{
    eventId: string; metricKey: string; windowMonths: number;
    forecastMedian: number | null; actualValue: number | null;
    error: number | null; hitWithinCi: boolean | null; evaluatedAt: string;
  }>;
}> {
  const pool = getPool();

  const statsRes = await pool.query<BacktestReportStatsRow>(
    `SELECT COUNT(*) FILTER (WHERE within_ci IS NOT NULL) AS total,
            COUNT(*) FILTER (WHERE within_ci = true)      AS hits,
            AVG(error) AS mean_error, STDDEV(error) AS std_error,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY error) AS p25,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY error) AS p75
     FROM playbook_backtest_results WHERE subtype = $1 AND status = 'evaluated'`,
    [subtype]
  );
  const s = statsRes.rows[0];
  const total = parseInt(s?.total ?? '0');

  const alertRes = await pool.query<OpenAlertRow>(
    `SELECT bias_direction, consecutive_misses, detected_at
     FROM regime_shift_alerts
     WHERE subtype = $1 AND status = 'open' ORDER BY detected_at DESC LIMIT 1`,
    [subtype]
  );
  const alert = alertRes.rows[0];

  const pointsRes = await pool.query<{
    event_id: string; metric_key: string; window_months: string;
    forecast_delta: string | null; actual_delta: string | null;
    error: string | null; within_ci: boolean | null; computed_at: string;
  }>(
    `SELECT event_id, metric_key, window_months, forecast_delta, actual_delta,
            error, within_ci, computed_at
     FROM playbook_backtest_results
     WHERE subtype = $1 AND status = 'evaluated'
     ORDER BY computed_at DESC LIMIT 10`,
    [subtype]
  );

  return {
    subtype,
    hitRate: total > 0 ? parseInt(s.hits ?? '0') / total : null,
    errorDistribution: total > 0 ? {
      mean:   s.mean_error != null ? parseFloat(s.mean_error) : null,
      stddev: s.std_error  != null ? parseFloat(s.std_error)  : null,
      p25:    s.p25        != null ? parseFloat(s.p25)        : null,
      p75:    s.p75        != null ? parseFloat(s.p75)        : null,
    } : null,
    regimeStatus: {
      hasOpenAlert:     !!alert,
      direction:        alert?.bias_direction,
      consecutiveMisses: alert?.consecutive_misses != null ? parseInt(alert.consecutive_misses) : undefined,
      detectedAt:       alert?.detected_at,
    },
    recentPoints: pointsRes.rows.map(r => ({
      eventId:        r.event_id,
      metricKey:      r.metric_key,
      windowMonths:   parseInt(r.window_months),
      forecastMedian: r.forecast_delta != null ? parseFloat(r.forecast_delta) : null,
      actualValue:    r.actual_delta    != null ? parseFloat(r.actual_delta)    : null,
      error:          r.error           != null ? parseFloat(r.error)           : null,
      hitWithinCi:    r.within_ci,
      evaluatedAt:    r.computed_at,
    })),
  };
}

// ─── getEventBacktestResults ──────────────────────────────────────────────────

export async function getEventBacktestResults(eventId: string): Promise<Array<{
  id: string; metricKey: string; windowMonths: number; milestoneDate: string;
  forecastMedian: number | null; forecastP25: number | null; forecastP75: number | null;
  actualValue: number | null; error: number | null; errorPct: number | null;
  hitWithinCi: boolean | null; dataCoverage: number | null; status: string; ranAt: string;
}>> {
  const pool = getPool();
  const res = await pool.query<BacktestResultRow>(
    `SELECT id, metric_key, window_months, milestone_date,
            forecast_delta, forecast_p25, forecast_p75,
            actual_delta, error, error_pct, within_ci, data_coverage_pct, status, ran_at
     FROM playbook_backtest_results WHERE event_id = $1
     ORDER BY window_months, metric_key`,
    [eventId]
  );
  return res.rows.map(r => ({
    id: r.id, metricKey: r.metric_key, windowMonths: parseInt(r.window_months),
    milestoneDate:  r.milestone_date,
    forecastMedian: r.forecast_delta != null ? parseFloat(r.forecast_delta) : null,
    forecastP25:    r.forecast_p25    != null ? parseFloat(r.forecast_p25)    : null,
    forecastP75:    r.forecast_p75    != null ? parseFloat(r.forecast_p75)    : null,
    actualValue:    r.actual_delta    != null ? parseFloat(r.actual_delta)    : null,
    error:          r.error           != null ? parseFloat(r.error)           : null,
    errorPct:       r.error_pct       != null ? parseFloat(r.error_pct)       : null,
    hitWithinCi:    r.within_ci,
    dataCoverage:   r.data_coverage_pct   != null ? parseFloat(r.data_coverage_pct)   : null,
    status:         r.status,
    ranAt:          r.ran_at,
  }));
}

// ─── getRegimeShiftAlerts ─────────────────────────────────────────────────────

export async function getRegimeShiftAlerts(status: string = 'open'): Promise<Array<{
  id: string; subtype: string; metricKey: string; windowMonths: number;
  direction: string; avgError: number | null; stdError: number | null;
  sampleSize: number; consecutiveMisses: number; resolved: boolean;
  status: string; acknowledgedBy: string | null;
  acknowledgedAt: string | null; detectedAt: string;
}>> {
  const pool = getPool();
  const res = await pool.query<AlertRow>(
    `SELECT id, subtype, metric_key, window_months, bias_direction, avg_pct_error, std_error,
            sample_size, consecutive_misses, resolved, status,
            acknowledged_by, acknowledged_at, detected_at
     FROM regime_shift_alerts WHERE status = $1 ORDER BY detected_at DESC`,
    [status]
  );
  return res.rows.map(r => ({
    id: r.id, subtype: r.subtype, metricKey: r.metric_key,
    windowMonths:     parseInt(r.window_months),
    direction:        r.bias_direction,
    avgError:         r.avg_pct_error != null ? parseFloat(r.avg_pct_error) : null,
    stdError:         r.std_error     != null ? parseFloat(r.std_error)     : null,
    sampleSize:       r.sample_size   != null ? parseInt(r.sample_size)     : 5,
    consecutiveMisses: r.consecutive_misses != null ? parseInt(r.consecutive_misses) : 5,
    resolved:         r.resolved ?? false,
    status:           r.status,
    acknowledgedBy:   r.acknowledged_by  ?? null,
    acknowledgedAt:   r.acknowledged_at  ?? null,
    detectedAt:       r.detected_at,
  }));
}

// ─── acknowledgeRegimeAlert / resolveRegimeAlert ──────────────────────────────

export async function acknowledgeRegimeAlert(
  alertId: string, acknowledgedBy: string = 'system'
): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query<AckRow>(
    `UPDATE regime_shift_alerts
     SET status = 'acknowledged', resolved = TRUE,
         acknowledged_by = $1, acknowledged_at = NOW(), resolved_at = NOW()
     WHERE id = $2 AND status = 'open'
     RETURNING id`,
    [acknowledgedBy, alertId]
  );
  return (res.rowCount ?? 0) > 0;
}

export const resolveRegimeAlert = acknowledgeRegimeAlert;
