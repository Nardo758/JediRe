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
const EVIDENCE_HIT        = 0.85;
const EVIDENCE_MISS       = 0.25;
const HIT_RATE_THRESHOLD  = 0.55;
const CI_WIDEN_FACTOR     = 1.20;
const REGIME_WINDOW       = 5;
const CANCELLED_STATUSES  = new Set(['cancelled', 'reversed']);

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
// Returns { actualValue, dataCoverage } for treatment − control pre/post delta.
// actualValue = (treatPost − treatPre) − avg(ctrlPost − ctrlPre)
// coverage    = fraction of expected monthly data points present in pre+post windows

async function computeDiDActual(
  pool: any,
  geographyId: string,
  controlGeoIds: string[],
  metricKey: string,
  announcedDate: Date,
  milestoneDate: Date
): Promise<{ actualValue: number | null; dataCoverage: number }> {
  const metricId    = resolveMetricId(metricKey);
  const preStart    = new Date(announcedDate);
  preStart.setMonth(preStart.getMonth() - BASELINE_MONTHS);
  const preEnd      = new Date(announcedDate);
  const postStart   = new Date(announcedDate);
  const postEnd     = new Date(milestoneDate);

  const windowMonths =
    (postEnd.getFullYear() - preStart.getFullYear()) * 12 +
    (postEnd.getMonth()    - preStart.getMonth());
  const expectedPoints = windowMonths;

  // Count actual data points for coverage check
  const countRes = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM metric_time_series
     WHERE metric_id = $1
       AND geography_id = $2
       AND period_date BETWEEN $3 AND $4`,
    [metricId, geographyId, preStart, postEnd]
  );
  const actualCount  = parseInt(countRes.rows[0]?.cnt ?? '0');
  const dataCoverage = Math.min(1, actualCount / Math.max(expectedPoints, 1));

  // Treatment: pre and post averages
  const treatRes = await pool.query(
    `SELECT
       AVG(value) FILTER (WHERE period_date BETWEEN $3 AND $4) AS pre_avg,
       AVG(value) FILTER (WHERE period_date BETWEEN $5 AND $6) AS post_avg
     FROM metric_time_series
     WHERE metric_id = $1 AND geography_id = $2
       AND period_date BETWEEN $3 AND $6`,
    [metricId, geographyId, preStart, preEnd, postStart, postEnd]
  );

  const treat = treatRes.rows[0];
  if (!treat || treat.pre_avg == null || treat.post_avg == null) {
    return { actualValue: null, dataCoverage };
  }
  const treatDelta = parseFloat(treat.post_avg) - parseFloat(treat.pre_avg);

  if (!controlGeoIds.length) {
    return { actualValue: treatDelta, dataCoverage };
  }

  // Control: pre and post averages across all control geographies
  const ctrlRes = await pool.query(
    `SELECT
       AVG(value) FILTER (WHERE period_date BETWEEN $3 AND $4) AS pre_avg,
       AVG(value) FILTER (WHERE period_date BETWEEN $5 AND $6) AS post_avg
     FROM metric_time_series
     WHERE metric_id = $1
       AND geography_id = ANY($2::text[])
       AND period_date BETWEEN $3 AND $6`,
    [metricId, controlGeoIds, preStart, preEnd, postStart, postEnd]
  );

  const ctrl = ctrlRes.rows[0];
  if (!ctrl || ctrl.pre_avg == null || ctrl.post_avg == null) {
    return { actualValue: treatDelta, dataCoverage };
  }
  const ctrlDelta   = parseFloat(ctrl.post_avg) - parseFloat(ctrl.pre_avg);
  const didEstimate = treatDelta - ctrlDelta;

  return { actualValue: didEstimate, dataCoverage };
}

// ─── Confidence decay ─────────────────────────────────────────────────────────

async function updatePlaybookConfidence(pool: any, playbookId: string, hit: boolean): Promise<void> {
  const row = await pool.query(
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

async function widenCIIfNeeded(
  pool: any, playbookId: string, subtype: string, metricKey: string, windowMonths: number
): Promise<void> {
  const hr = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE pbr.hit_within_ci = true) AS hits, COUNT(*) AS total
     FROM playbook_backtest_results pbr
     WHERE pbr.subtype = $1 AND pbr.metric_key = $2 AND pbr.window_months = $3
       AND pbr.status = 'evaluated' AND pbr.hit_within_ci IS NOT NULL`,
    [subtype, metricKey, windowMonths]
  );
  const total = parseInt(hr.rows[0].total ?? '0');
  if (total < 4) return;

  const hitRate = parseInt(hr.rows[0].hits ?? '0') / total;
  if (hitRate >= HIT_RATE_THRESHOLD) return;

  const pb = await pool.query(
    `SELECT median_delta, p25, p75 FROM event_playbooks WHERE id = $1`, [playbookId]
  );
  if (!pb.rows.length || pb.rows[0].median_delta == null || pb.rows[0].p25 == null || pb.rows[0].p75 == null) return;

  const med     = parseFloat(pb.rows[0].median_delta);
  const newHalf = (parseFloat(pb.rows[0].p75) - parseFloat(pb.rows[0].p25)) * CI_WIDEN_FACTOR / 2;
  await pool.query(
    `UPDATE event_playbooks SET p25 = $1, p75 = $2, last_updated = NOW() WHERE id = $3`,
    [(med - newHalf).toFixed(6), (med + newHalf).toFixed(6), playbookId]
  );
  logger.info('[M35 Backtest] CI widened', { playbookId, subtype, metricKey, windowMonths, hitRate });
}

// ─── Regime shift detection ───────────────────────────────────────────────────

async function detectRegimeShift(
  pool: any, subtype: string, metricKey: string, windowMonths: number
): Promise<void> {
  const res = await pool.query(
    `SELECT error FROM playbook_backtest_results
     WHERE subtype = $1 AND metric_key = $2 AND window_months = $3
       AND status = 'evaluated' AND error IS NOT NULL
     ORDER BY ran_at DESC LIMIT $4`,
    [subtype, metricKey, windowMonths, REGIME_WINDOW]
  );
  if (res.rows.length < REGIME_WINDOW) return;

  // error = actual − forecast; positive → under-prediction; negative → over-prediction
  const errors: number[] = res.rows.map((r: any) => parseFloat(r.error));
  const allNegative = errors.every(e => e < 0);   // actual < forecast → over-predicted
  const allPositive = errors.every(e => e > 0);   // actual > forecast → under-predicted
  if (!allNegative && !allPositive) return;

  const stdErr = stdDev(errors);
  // Each individual error must exceed 1× std — confirms systematic, not random, bias
  const allExceedOneStd = errors.every(e => Math.abs(e) > stdErr);
  if (!allExceedOneStd) return;

  const avgErr = mean(errors);

  const existing = await pool.query(
    `SELECT id FROM regime_shift_alerts
     WHERE subtype = $1 AND metric_key = $2 AND window_months = $3 AND status = 'open' LIMIT 1`,
    [subtype, metricKey, windowMonths]
  );
  if (existing.rows.length > 0) return;

  const alertId    = uuidv4();
  const direction  = allNegative ? 'over' : 'under'; // over = we over-predicted (actual was lower)
  const detectedAt = new Date().toISOString();

  await pool.query(
    `INSERT INTO regime_shift_alerts
       (id, subtype, metric_key, window_months, bias_direction, avg_pct_error, std_error,
        sample_size, status, detected_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9)`,
    [alertId, subtype, metricKey, windowMonths, direction,
     avgErr.toFixed(6), stdErr.toFixed(6), REGIME_WINDOW, detectedAt]
  );

  const msg: M35RegimeShiftDetectedMessage = {
    eventId: alertId, eventType: 'M35_REGIME_SHIFT_DETECTED', timestamp: detectedAt,
    alertId, subtype, metricKey, windowMonths,
    biasDirection: direction as 'over' | 'under',
    avgError: avgErr, stdError: stdErr, sampleSize: REGIME_WINDOW, detectedAt,
  };

  try {
    await kafkaProducer.publish(KAFKA_TOPICS.M35_REGIME_SHIFT_DETECTED, msg, { key: alertId });
  } catch (e) {
    logger.warn('[M35 Backtest] Kafka publish failed for regime shift (non-fatal)', { alertId });
  }
  logger.warn('[M35 Backtest] Regime shift detected', { alertId, subtype, metricKey, windowMonths, direction, avgErr, stdErr });
}

// ─── runBacktestForEvent ──────────────────────────────────────────────────────

export async function runBacktestForEvent(eventId: string): Promise<{ processed: number; skipped: number }> {
  const pool = getPool();
  let processed = 0, skipped = 0;

  const evRes = await pool.query(
    `SELECT id, subtype, announced_date, msa_id, submarket_id, status
     FROM key_events WHERE id = $1`,
    [eventId]
  );
  if (!evRes.rows.length) return { processed, skipped };

  const ev = evRes.rows[0];
  if (!ev.subtype || !ev.announced_date || CANCELLED_STATUSES.has(ev.status)) return { processed, skipped };

  const announcedDate = new Date(ev.announced_date);
  const geographyId   = ev.submarket_id ?? ev.msa_id ?? '';
  const now           = new Date();

  // Load control geographies for DiD
  const ctrlRes = await pool.query(
    `SELECT control_geography_id FROM event_control_groups WHERE event_id = $1 AND is_included = true`,
    [eventId]
  );
  const controlGeoIds: string[] = ctrlRes.rows.map((r: any) => r.control_geography_id);

  for (const windowMonths of BACKTEST_WINDOWS) {
    const milestoneDate = new Date(announcedDate);
    milestoneDate.setMonth(milestoneDate.getMonth() + windowMonths);
    if (milestoneDate > now) { skipped++; continue; }

    // Active forecasts for this event × window
    const fcRes = await pool.query(
      `SELECT ef.metric_key, ef.point_estimate, ef.ci_low, ef.ci_high,
              ep.id AS playbook_id, ep.median_delta, ep.p25, ep.p75
       FROM event_forecasts ef
       LEFT JOIN event_playbooks ep
         ON ep.subtype = $1 AND ep.metric_key = ef.metric_key
         AND ep.window_months = $2
         AND ep.stratum_msa_tier = 'all' AND ep.stratum_magnitude = 'all'
         AND ep.stratum_regime   = 'all'
       WHERE ef.event_id = $3 AND ef.window_months = $2 AND ef.status = 'active'`,
      [ev.subtype, windowMonths, eventId]
    );
    if (!fcRes.rows.length) { skipped++; continue; }

    for (const fc of fcRes.rows) {
      const metricKey: string = fc.metric_key;

      // DiD actual computation (also returns data coverage)
      const { actualValue, dataCoverage } = await computeDiDActual(
        pool, geographyId, controlGeoIds, metricKey, announcedDate, milestoneDate
      );

      const rowStatus  = dataCoverage < MIN_DATA_COVERAGE ? 'insufficient_data' : 'evaluated';
      const forecastMedian = fc.point_estimate != null ? parseFloat(fc.point_estimate) : null;
      const forecastP25    = fc.ci_low         != null ? parseFloat(fc.ci_low)         : null;
      const forecastP75    = fc.ci_high        != null ? parseFloat(fc.ci_high)        : null;

      let error: number | null = null, errorPct: number | null = null;
      let hitWithinCi: boolean | null = null;

      if (actualValue != null && rowStatus === 'evaluated') {
        error        = forecastMedian != null ? actualValue - forecastMedian : null;
        errorPct     = forecastMedian != null && Math.abs(forecastMedian) > 0
          ? ((actualValue - forecastMedian) / Math.abs(forecastMedian)) * 100 : null;
        hitWithinCi = forecastP25 != null && forecastP75 != null
          ? actualValue >= forecastP25 && actualValue <= forecastP75 : null;
      }

      // Always persist a row — insufficient_data rows have null error/hit columns
      await pool.query(
        `INSERT INTO playbook_backtest_results
           (id, event_id, playbook_id, subtype, metric_key, window_months, milestone_date,
            forecast_median, forecast_p25, forecast_p75,
            actual_value, error, error_pct, hit_within_ci, data_coverage, status, computed_at, ran_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
         ON CONFLICT (event_id, metric_key, window_months)
         DO UPDATE SET
           playbook_id = EXCLUDED.playbook_id, subtype = EXCLUDED.subtype,
           milestone_date = EXCLUDED.milestone_date,
           forecast_median = EXCLUDED.forecast_median, forecast_p25 = EXCLUDED.forecast_p25,
           forecast_p75 = EXCLUDED.forecast_p75, actual_value = EXCLUDED.actual_value,
           error = EXCLUDED.error, error_pct = EXCLUDED.error_pct,
           hit_within_ci = EXCLUDED.hit_within_ci, data_coverage = EXCLUDED.data_coverage,
           status = EXCLUDED.status, computed_at = NOW(), ran_at = NOW()`,
        [
          uuidv4(), eventId, fc.playbook_id ?? null, ev.subtype, metricKey, windowMonths, milestoneDate,
          forecastMedian, forecastP25, forecastP75,
          actualValue,
          error    != null ? error.toFixed(6)   : null,
          errorPct != null ? errorPct.toFixed(4) : null,
          hitWithinCi,
          dataCoverage.toFixed(3),
          rowStatus,
        ]
      );

      if (rowStatus === 'evaluated' && fc.playbook_id && hitWithinCi != null) {
        await updatePlaybookConfidence(pool, fc.playbook_id, hitWithinCi);
        await widenCIIfNeeded(pool, fc.playbook_id, ev.subtype, metricKey, windowMonths);
        await detectRegimeShift(pool, ev.subtype, metricKey, windowMonths);
      }

      processed++;
    }
  }

  logger.info('[M35 Backtest] Event backtest complete', { eventId, processed, skipped });
  return { processed, skipped };
}

// ─── runMonthlyBacktest ───────────────────────────────────────────────────────

export async function runMonthlyBacktest(): Promise<{
  eventsChecked: number;
  eventsProcessed: number;
  totalProcessed: number;
  totalSkipped: number;
}> {
  const pool = getPool();
  const evRes = await pool.query(
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

// ─── getPlaybookAccuracyStats ─────────────────────────────────────────────────

export async function getPlaybookAccuracyStats(subtype?: string): Promise<Array<{
  subtype: string; metricKey: string; windowMonths: number;
  total: number; hits: number; hitRate: number;
  avgError: number | null; stdError: number | null;
}>> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT pbr.subtype, pbr.metric_key, pbr.window_months,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE pbr.hit_within_ci = true) AS hits,
            AVG(pbr.error) AS avg_error,
            STDDEV(pbr.error) AS std_error
     FROM playbook_backtest_results pbr
     WHERE pbr.status = 'evaluated' AND pbr.hit_within_ci IS NOT NULL
       AND ($1::text IS NULL OR pbr.subtype = $1)
     GROUP BY pbr.subtype, pbr.metric_key, pbr.window_months
     ORDER BY pbr.subtype, pbr.metric_key, pbr.window_months`,
    [subtype ?? null]
  );
  return res.rows.map((r: any) => ({
    subtype: r.subtype, metricKey: r.metric_key, windowMonths: parseInt(r.window_months),
    total: parseInt(r.total), hits: parseInt(r.hits),
    hitRate:  parseInt(r.hits) / parseInt(r.total),
    avgError: r.avg_error != null ? parseFloat(r.avg_error) : null,
    stdError: r.std_error != null ? parseFloat(r.std_error) : null,
  }));
}

// ─── getPlaybookBacktestReport ────────────────────────────────────────────────
// Full backtest report for a subtype: hit rate, error distribution, regime status, last 10 points.

export async function getPlaybookBacktestReport(subtype: string): Promise<{
  subtype: string;
  hitRate: number | null;
  errorDistribution: { mean: number | null; stddev: number | null; p25: number | null; p75: number | null } | null;
  regimeStatus: { hasOpenAlert: boolean; direction?: string; detectedAt?: string };
  recentPoints: Array<{
    eventId: string; metricKey: string; windowMonths: number;
    forecastMedian: number | null; actualValue: number | null;
    error: number | null; hitWithinCi: boolean | null; ranAt: string;
  }>;
}> {
  const pool = getPool();

  // Aggregate stats
  const statsRes = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE hit_within_ci IS NOT NULL) AS total,
       COUNT(*) FILTER (WHERE hit_within_ci = true)      AS hits,
       AVG(error)    AS mean_error,
       STDDEV(error) AS std_error,
       PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY error) AS p25,
       PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY error) AS p75
     FROM playbook_backtest_results
     WHERE subtype = $1 AND status = 'evaluated'`,
    [subtype]
  );
  const s = statsRes.rows[0];
  const total = parseInt(s?.total ?? '0');

  // Regime alert
  const alertRes = await pool.query(
    `SELECT bias_direction, detected_at FROM regime_shift_alerts
     WHERE subtype = $1 AND status = 'open' ORDER BY detected_at DESC LIMIT 1`,
    [subtype]
  );
  const alert = alertRes.rows[0];

  // Last 10 evaluated points
  const pointsRes = await pool.query(
    `SELECT event_id, metric_key, window_months, forecast_median, actual_value,
            error, hit_within_ci, ran_at
     FROM playbook_backtest_results
     WHERE subtype = $1 AND status = 'evaluated'
     ORDER BY ran_at DESC LIMIT 10`,
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
      hasOpenAlert: !!alert,
      direction:   alert?.bias_direction,
      detectedAt:  alert?.detected_at,
    },
    recentPoints: pointsRes.rows.map((r: any) => ({
      eventId:       r.event_id,
      metricKey:     r.metric_key,
      windowMonths:  parseInt(r.window_months),
      forecastMedian: r.forecast_median != null ? parseFloat(r.forecast_median) : null,
      actualValue:   r.actual_value     != null ? parseFloat(r.actual_value)     : null,
      error:         r.error            != null ? parseFloat(r.error)            : null,
      hitWithinCi:   r.hit_within_ci,
      ranAt:         r.ran_at,
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
  const res = await pool.query(
    `SELECT id, metric_key, window_months, milestone_date,
            forecast_median, forecast_p25, forecast_p75,
            actual_value, error, error_pct, hit_within_ci, data_coverage, status, ran_at
     FROM playbook_backtest_results WHERE event_id = $1
     ORDER BY window_months, metric_key`,
    [eventId]
  );
  return res.rows.map((r: any) => ({
    id: r.id, metricKey: r.metric_key, windowMonths: parseInt(r.window_months),
    milestoneDate:  r.milestone_date,
    forecastMedian: r.forecast_median != null ? parseFloat(r.forecast_median) : null,
    forecastP25:    r.forecast_p25    != null ? parseFloat(r.forecast_p25)    : null,
    forecastP75:    r.forecast_p75    != null ? parseFloat(r.forecast_p75)    : null,
    actualValue:    r.actual_value    != null ? parseFloat(r.actual_value)    : null,
    error:          r.error           != null ? parseFloat(r.error)           : null,
    errorPct:       r.error_pct       != null ? parseFloat(r.error_pct)       : null,
    hitWithinCi:    r.hit_within_ci,
    dataCoverage:   r.data_coverage   != null ? parseFloat(r.data_coverage)   : null,
    status:         r.status,
    ranAt:          r.ran_at,
  }));
}

// ─── getRegimeShiftAlerts ─────────────────────────────────────────────────────

export async function getRegimeShiftAlerts(status: string = 'open'): Promise<Array<{
  id: string; subtype: string; metricKey: string; windowMonths: number;
  direction: string; avgError: number | null; stdError: number | null;
  sampleSize: number; status: string; acknowledgedBy: string | null;
  acknowledgedAt: string | null; detectedAt: string;
}>> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT id, subtype, metric_key, window_months, bias_direction, avg_pct_error, std_error,
            sample_size, status, acknowledged_by, acknowledged_at, detected_at
     FROM regime_shift_alerts WHERE status = $1 ORDER BY detected_at DESC`,
    [status]
  );
  return res.rows.map((r: any) => ({
    id: r.id, subtype: r.subtype, metricKey: r.metric_key,
    windowMonths:   parseInt(r.window_months),
    direction:      r.bias_direction,
    avgError:       r.avg_pct_error != null ? parseFloat(r.avg_pct_error) : null,
    stdError:       r.std_error     != null ? parseFloat(r.std_error)     : null,
    sampleSize:     r.sample_size   != null ? parseInt(r.sample_size)     : 5,
    status:         r.status,
    acknowledgedBy: r.acknowledged_by ?? null,
    acknowledgedAt: r.acknowledged_at ?? null,
    detectedAt:     r.detected_at,
  }));
}

// ─── acknowledgeRegimeAlert ───────────────────────────────────────────────────

export async function acknowledgeRegimeAlert(
  alertId: string, acknowledgedBy: string = 'system'
): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(
    `UPDATE regime_shift_alerts
     SET status = 'acknowledged', acknowledged_by = $1,
         acknowledged_at = NOW(), resolved_at = NOW()
     WHERE id = $2 AND status = 'open'
     RETURNING id`,
    [acknowledgedBy, alertId]
  );
  return (res.rowCount ?? 0) > 0;
}
