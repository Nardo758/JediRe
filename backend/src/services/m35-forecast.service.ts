/**
 * M35 Forecast Generator Service
 *
 * For a new event, applies the playbook to generate per-metric × per-window
 * forward projections with confidence intervals.
 *
 * Pipeline (5 steps per spec §5.1):
 *   1. Playbook lookup  — find the right subtype+stratum playbook
 *   2. Magnitude scaling  — adjust for jobs count, wage level, MSA size
 *   3. Submarket adjustment — dampen/amplify based on current vacancy/supply/traffic
 *   4. Regime adjustment — hot market vs cooling market modifier
 *   5. CI construction  — build confidence interval from scaled p25/p75
 *
 * Versioning: each generation creates new rows, marks old ones 'superseded'.
 * On event cancellation/reversal, all active forecasts are 'invalidated'.
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { kafkaProducer } from './kafka/kafka-producer.service';
import { KAFKA_TOPICS } from './kafka/event-schemas';
import {
  getPlaybook,
  scaleMagnitude,
  type PlaybookStratum,
} from './m35-playbook.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_VERSION = 'v1';
const MEASUREMENT_WINDOWS = [3, 12, 24, 36] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecastMetricWindow {
  metricKey: string;
  windowMonths: number;
  pointEstimate: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  confidence: number;
  statusLabel: 'ahead' | 'behind' | 'on_pace' | 'no_data';
  /** Full derivation trace: playbook used, scaling factors, submarket/regime adjustments */
  derivation: ForecastDerivation | null;
}

export interface ForecastRow {
  id: string;
  eventId: string;
  metricKey: string;
  windowMonths: number;
  pointEstimate: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  confidence: number;
  modelVersion: string;
  status: 'active' | 'superseded' | 'invalidated';
  derivation: ForecastDerivation;
  generatedAt: Date;
}

export interface ForecastDerivation {
  playbookSubtype: string;
  stratum: PlaybookStratum;
  playbookInstanceCount: number;
  playbookConfidence: number;
  playbookStatus: string;
  scalingFactor: number;
  scalingExplanation: string;
  submarketAdj: SubmarketAdj;
  regimeAdj: RegimeAdj;
  baselineMedian: number | null;
}

export interface SubmarketAdj {
  factor: number;
  vacancyFactor: number;
  supplyFactor: number;
  trafficFactor: number;
  explanation: string;
}

export interface RegimeAdj {
  factor: number;
  phase: string;
  explanation: string;
}

export interface EventForecast {
  eventId: string;
  eventName: string;
  subtype: string;
  status: string;
  playbookStatus: string;
  overallConfidence: number;
  generatedAt: Date | null;
  metrics: ForecastMetricWindow[];
  actuals: ForecastActual[];
  derivationSummary: string;
}

export interface ForecastActual {
  metricKey: string;
  windowMonths: number;
  forecastValue: number | null;
  actualValue: number | null;
  divergencePct: number | null;
  statusLabel: string;
  checkedAt: Date;
}

// ─── Submarket Adjustment ─────────────────────────────────────────────────────

async function computeSubmarketAdj(
  msaId: string | null,
  submarketId: string | null,
  pool: ReturnType<typeof getPool>,
): Promise<SubmarketAdj> {
  const geoId = submarketId ?? msaId ?? 'national';

  // Pull latest market metrics for the geography
  const metricsRes = await pool.query(`
    SELECT metric_id, value
    FROM metric_time_series
    WHERE geography_id = $1
      AND metric_id = ANY($2)
      AND period_date >= NOW() - INTERVAL '6 months'
    ORDER BY period_date DESC
  `, [geoId, ['CS_VACANCY_PCT', 'CS_NET_ABSORPTION_PCT', 'CS_DELIVERIES', 'C_SEARCH_GROWTH_INDEX']]);

  const metrics: Record<string, number> = {};
  for (const row of metricsRes.rows) {
    if (!(row.metric_id in metrics)) metrics[row.metric_id] = parseFloat(row.value);
  }

  const vacancy = metrics['CS_VACANCY_PCT'] ?? null;
  const searchMomentum = metrics['C_SEARCH_GROWTH_INDEX'] ?? null;
  const deliveries = metrics['CS_DELIVERIES'] ?? null;

  // Vacancy factor: low vacancy (<4%) → demand already absorbed → dampen lift
  // High vacancy (>8%) → more room to absorb event demand → amplify
  let vacancyFactor = 1.0;
  if (vacancy !== null) {
    if (vacancy < 0.04) vacancyFactor = 0.75;     // already tight, limited upside
    else if (vacancy < 0.06) vacancyFactor = 0.90;
    else if (vacancy > 0.10) vacancyFactor = 1.20;  // lots of room, event matters more
    else if (vacancy > 0.08) vacancyFactor = 1.10;
  }

  // Supply factor: heavy pipeline → rents get competed away → dampen
  let supplyFactor = 1.0;
  if (deliveries !== null) {
    if (deliveries > 3000) supplyFactor = 0.70;    // heavy supply pipeline
    else if (deliveries > 1500) supplyFactor = 0.85;
    else if (deliveries < 200) supplyFactor = 1.15; // supply constrained
  }

  // Search/traffic factor: already rising → ceiling effect → dampen
  let trafficFactor = 1.0;
  if (searchMomentum !== null) {
    if (searchMomentum > 0.30) trafficFactor = 0.85;   // already surging, ceiling effect
    else if (searchMomentum > 0.15) trafficFactor = 0.93;
    else if (searchMomentum < -0.10) trafficFactor = 1.10; // lagging market, event catalyzes
  }

  const factor = vacancyFactor * supplyFactor * trafficFactor;
  const parts: string[] = [];
  if (vacancyFactor !== 1.0) parts.push(`vacancy(${(vacancy! * 100).toFixed(1)}%)→×${vacancyFactor}`);
  if (supplyFactor !== 1.0) parts.push(`supply(${deliveries})→×${supplyFactor}`);
  if (trafficFactor !== 1.0) parts.push(`momentum→×${trafficFactor}`);

  return {
    factor,
    vacancyFactor,
    supplyFactor,
    trafficFactor,
    explanation: parts.length > 0 ? parts.join(', ') : 'no submarket adjustment',
  };
}

// ─── Regime Adjustment ────────────────────────────────────────────────────────

async function computeRegimeAdj(
  msaId: string | null,
  announcedDate: Date | null,
  pool: ReturnType<typeof getPool>,
): Promise<RegimeAdj> {
  // Pull rent growth trend for the MSA (last 12mo YoY)
  const trendRes = await pool.query(`
    SELECT AVG(value) AS avg_growth
    FROM metric_time_series
    WHERE geography_id = $1
      AND metric_id = ANY($2)
      AND period_date >= NOW() - INTERVAL '12 months'
  `, [msaId ?? 'national', ['CS_EFF_RENT_GROWTH', 'rent_index_yoy']]);

  const rentTrend = parseFloat(trendRes.rows[0]?.avg_growth ?? '0');

  // Hot market (rent growing >5%): event effects partly pre-priced → slightly dampen
  // Cooling market (rent flat/declining): event is a catalyst → amplify
  let factor = 1.0;
  let phase = 'neutral';
  if (rentTrend > 0.06) { factor = 0.88; phase = 'hot — event partly pre-priced'; }
  else if (rentTrend > 0.04) { factor = 0.95; phase = 'warm'; }
  else if (rentTrend < -0.02) { factor = 1.18; phase = 'cooling — event is a catalyst'; }
  else if (rentTrend < 0.01) { factor = 1.08; phase = 'flat — event amplified'; }

  return {
    factor,
    phase,
    explanation: `rent trend ${(rentTrend * 100).toFixed(1)}%/yr → regime=${phase}, factor=${factor}`,
  };
}

// ─── Core: Generate forecast ──────────────────────────────────────────────────

export async function generateForecast(eventId: string): Promise<ForecastRow[]> {
  const pool = getPool();

  // Load event
  const evRes = await pool.query(`
    SELECT id, name, category, subtype, msa_id, submarket_id,
           magnitude_value, magnitude_unit, magnitude_score,
           announced_date, status, confidence
    FROM key_events WHERE id = $1
  `, [eventId]);

  if (!evRes.rows[0]) throw new Error(`Event ${eventId} not found`);
  const ev = evRes.rows[0];

  if (!ev.subtype) {
    logger.warn(`[M35 Forecast] Event ${eventId} has no subtype — skipping forecast`);
    return [];
  }

  // Draft events do not get active forecasts; generation is deferred until status advances.
  if (ev.status === 'draft') {
    logger.debug(`[M35 Forecast] Event ${eventId} is still draft — skipping forecast generation`);
    return [];
  }

  // Classify stratum
  const announcedDate = ev.announced_date ? new Date(ev.announced_date) : null;
  const stratum: PlaybookStratum = {
    msaTier: 'all',
    magnitude: 'all',
    regime: 'all',
  };

  // Load playbook (try specific stratum then fall back to 'all')
  const playbook = await getPlaybook(ev.subtype, stratum);
  if (!playbook || playbook.metrics.length === 0) {
    logger.warn(`[M35 Forecast] No playbook for ${ev.subtype} — skipping`);
    return [];
  }

  // Step 1+2: Magnitude scaling
  const scaledMetrics = scaleMagnitude({
    magnitudeValue: ev.magnitude_value ? parseFloat(ev.magnitude_value) : null,
    magnitudeUnit: ev.magnitude_unit ?? null,
    magnitudeScore: ev.magnitude_score ? parseInt(ev.magnitude_score) : null,
    msaId: ev.msa_id ?? null,
  }, playbook);

  // Step 3: Submarket adjustment
  const submarketAdj = await computeSubmarketAdj(ev.msa_id, ev.submarket_id, pool);

  // Step 4: Regime adjustment
  const regimeAdj = await computeRegimeAdj(ev.msa_id, announcedDate, pool);

  const combinedFactor = submarketAdj.factor * regimeAdj.factor;

  // Step 5: Supersede existing active forecasts
  await pool.query(`
    UPDATE event_forecasts
    SET status = 'superseded', superseded_at = NOW()
    WHERE event_id = $1 AND status = 'active'
  `, [eventId]);

  // Build and insert new forecast rows
  const newRows: ForecastRow[] = [];

  for (const scaled of scaledMetrics) {
    if (scaled.scaledMedian === null) continue;

    const point = scaled.scaledMedian * combinedFactor;
    const spreadHalf = ((scaled.scaledP75 ?? point) - (scaled.scaledP25 ?? point)) / 2 * combinedFactor;
    const ciLow = point - spreadHalf;
    const ciHigh = point + spreadHalf;

    // Find the playbook metric for confidence
    const pbMetric = playbook.metrics.find(
      m => m.metricKey === scaled.metricKey && m.windowMonths === scaled.windowMonths,
    );
    const conf = Math.min(0.99, (pbMetric?.confidence ?? 0.5) * ev.confidence * combinedFactor);

    const derivation: ForecastDerivation = {
      playbookSubtype: ev.subtype,
      stratum,
      playbookInstanceCount: playbook.instanceCount,
      playbookConfidence: playbook.confidence,
      playbookStatus: playbook.status,
      scalingFactor: scaled.scaleFactor * combinedFactor,
      scalingExplanation: scaled.explanation,
      submarketAdj,
      regimeAdj,
      baselineMedian: scaled.baselineMedian,
    };

    const res = await pool.query(`
      INSERT INTO event_forecasts
        (event_id, metric_key, window_months, point_estimate, ci_low, ci_high,
         confidence, model_version, status, derivation, generated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9::jsonb,NOW())
      RETURNING *
    `, [eventId, scaled.metricKey, scaled.windowMonths, point, ciLow, ciHigh,
        conf, MODEL_VERSION, JSON.stringify(derivation)]);

    const row = res.rows[0];
    newRows.push({
      id: row.id,
      eventId: row.event_id,
      metricKey: row.metric_key,
      windowMonths: parseInt(row.window_months),
      pointEstimate: row.point_estimate ? parseFloat(row.point_estimate) : null,
      ciLow: row.ci_low ? parseFloat(row.ci_low) : null,
      ciHigh: row.ci_high ? parseFloat(row.ci_high) : null,
      confidence: parseFloat(row.confidence),
      modelVersion: row.model_version,
      status: row.status,
      derivation,
      generatedAt: new Date(row.generated_at),
    });
  }

  if (newRows.length > 0) {
    // Publish Kafka event
    try {
      await kafkaProducer.publish(KAFKA_TOPICS.M35_FORECAST_CREATED, {
        eventType: 'M35_FORECAST_CREATED',
        eventId,
        eventName: ev.name,
        subtype: ev.subtype,
        msaId: ev.msa_id,
        metricWindowCount: newRows.length,
        overallConfidence: newRows.reduce((s, r) => s + r.confidence, 0) / newRows.length,
        generatedAt: new Date().toISOString(),
      }, { key: eventId });
    } catch { /* non-blocking */ }

    logger.info(`[M35 Forecast] Generated ${newRows.length} forecast rows for event ${eventId} (${ev.subtype})`);
  }

  return newRows;
}

// ─── Invalidate forecasts on event status change ──────────────────────────────

export async function invalidateForecasts(eventId: string, reason: string): Promise<number> {
  const pool = getPool();
  const res = await pool.query(`
    UPDATE event_forecasts
    SET status = 'invalidated', invalidated_at = NOW(), invalidation_reason = $2
    WHERE event_id = $1 AND status = 'active'
    RETURNING id
  `, [eventId, reason]);

  const count = res.rowCount ?? 0;
  if (count > 0) logger.info(`[M35 Forecast] Invalidated ${count} forecasts for event ${eventId}: ${reason}`);
  return count;
}

// ─── Read: Get event forecast ─────────────────────────────────────────────────

export async function getEventForecast(eventId: string): Promise<EventForecast | null> {
  const pool = getPool();

  const evRes = await pool.query(
    `SELECT id, name, subtype, status FROM key_events WHERE id = $1`,
    [eventId],
  );
  if (!evRes.rows[0]) return null;
  const ev = evRes.rows[0];

  // Active forecasts
  const forecastRes = await pool.query(`
    SELECT * FROM event_forecasts
    WHERE event_id = $1 AND status = 'active'
    ORDER BY metric_key, window_months
  `, [eventId]);

  // Most recent actuals tracking
  const actualsRes = await pool.query(`
    SELECT DISTINCT ON (metric_key, window_months)
      metric_key, window_months, forecast_value, actual_value,
      divergence_pct, status_label, checked_at
    FROM forecast_actuals_tracking
    WHERE event_id = $1
    ORDER BY metric_key, window_months, checked_at DESC
  `, [eventId]);

  const rows = forecastRes.rows;
  const actuals = actualsRes.rows;

  const playbookStatus = rows[0]?.derivation?.playbookStatus ?? 'unknown';
  const avgConf = rows.length > 0
    ? rows.reduce((s: number, r: any) => s + parseFloat(r.confidence), 0) / rows.length
    : 0;

  const derivationSummary = rows[0]?.derivation
    ? `${rows[0].derivation.playbookSubtype} playbook (${rows[0].derivation.playbookInstanceCount} instances, conf=${rows[0].derivation.playbookConfidence}). ` +
      `Submarket adj×${rows[0].derivation.submarketAdj?.factor?.toFixed(2) ?? 1}. ` +
      `Regime: ${rows[0].derivation.regimeAdj?.phase ?? 'neutral'}.`
    : 'No derivation available';

  return {
    eventId,
    eventName: ev.name,
    subtype: ev.subtype ?? '',
    status: ev.status,
    playbookStatus,
    overallConfidence: Math.round(avgConf * 100) / 100,
    generatedAt: rows[0]?.generated_at ? new Date(rows[0].generated_at) : null,
    metrics: rows.map((r: any) => ({
      metricKey: r.metric_key,
      windowMonths: parseInt(r.window_months),
      pointEstimate: r.point_estimate ? parseFloat(r.point_estimate) : null,
      ciLow: r.ci_low ? parseFloat(r.ci_low) : null,
      ciHigh: r.ci_high ? parseFloat(r.ci_high) : null,
      confidence: parseFloat(r.confidence),
      statusLabel: 'no_data' as const,
      derivation: (r.derivation as ForecastDerivation) ?? null,
    })),
    actuals: actuals.map((r: any) => ({
      metricKey: r.metric_key,
      windowMonths: parseInt(r.window_months),
      forecastValue: r.forecast_value ? parseFloat(r.forecast_value) : null,
      actualValue: r.actual_value ? parseFloat(r.actual_value) : null,
      divergencePct: r.divergence_pct ? parseFloat(r.divergence_pct) : null,
      statusLabel: r.status_label ?? 'on_pace',
      checkedAt: new Date(r.checked_at),
    })),
    derivationSummary,
  };
}

// ─── Read: MSA active forecasts ───────────────────────────────────────────────

export async function getMsaActiveForecasts(msaId: string): Promise<EventForecast[]> {
  const pool = getPool();

  const eventsRes = await pool.query(`
    SELECT DISTINCT ke.id
    FROM key_events ke
    JOIN event_forecasts ef ON ef.event_id = ke.id AND ef.status = 'active'
    WHERE ke.msa_id = $1
      AND ke.status IN ('announced', 'in_progress', 'materialized')
    ORDER BY ke.id
  `, [msaId]);

  const forecasts: EventForecast[] = [];
  for (const ev of eventsRes.rows) {
    const f = await getEventForecast(ev.id);
    if (f) forecasts.push(f);
  }
  return forecasts;
}

// ─── Nightly divergence tracking job ─────────────────────────────────────────

const DIVERGENCE_BATCH_SIZE = 200;

export async function runDivergenceTrackingJob(): Promise<{
  checked: number;
  diverged: number;
}> {
  const pool = getPool();

  let checked = 0;
  let diverged = 0;
  let offset = 0;
  let batchRows: any[] = [];

  // Divergence timing design: we only check forecasts whose window has *elapsed*
  // (announced_date + window_months <= NOW()). Checking before the horizon elapses
  // would compare a point-estimate for T+12 months against an early T+1 observation,
  // which produces meaningless divergence signals. "Nightly" refers to the run cadence,
  // not the observation age — each night we look for newly-elapsed windows and compare
  // the actual metric value closest to that horizon date.
  //
  // Paginate through all eligible forecasts to guarantee full daily coverage.
  do {
    const batchRes = await pool.query(`
      SELECT
        ef.id AS forecast_id,
        ef.event_id,
        ef.metric_key,
        ef.window_months,
        ef.point_estimate,
        ef.ci_low,
        ef.ci_high,
        ke.msa_id,
        ke.submarket_id,
        ke.announced_date,
        ke.materialization_date,
        ke.subtype,
        COALESCE(ep.stddev_delta, 0) AS playbook_stddev
      FROM event_forecasts ef
      JOIN key_events ke ON ke.id = ef.event_id
      LEFT JOIN event_playbooks ep
        ON ep.subtype = ke.subtype
        AND ep.metric_key = ef.metric_key
        AND ep.window_months = ef.window_months
        AND ep.stratum_msa_tier = 'all'
        AND ep.stratum_magnitude  = 'all'
        AND ep.stratum_regime     = 'all'
      WHERE ef.status = 'active'
        AND ef.point_estimate IS NOT NULL
        AND ke.announced_date IS NOT NULL
        AND ke.announced_date + (ef.window_months || ' months')::interval <= NOW()
      ORDER BY ef.event_id, ef.metric_key, ef.window_months
      LIMIT $1 OFFSET $2
    `, [DIVERGENCE_BATCH_SIZE, offset]);

    batchRows = batchRes.rows;
    offset += batchRows.length;

  for (const row of batchRows) {
    const geoId = row.submarket_id ?? row.msa_id ?? 'national';

    // Compute the forecast horizon date: announced_date + window_months
    // This is the point-in-time at which the forecast was expected to materialise.
    const horizonDate = new Date(row.announced_date);
    horizonDate.setMonth(horizonDate.getMonth() + parseInt(row.window_months));

    // Pull actual metric value closest to the forecast horizon date
    const actualRes = await pool.query(`
      SELECT value FROM metric_time_series
      WHERE geography_id = $1
        AND metric_id = $2
        AND period_date >= $3::date - INTERVAL '3 months'
        AND period_date <= $3::date + INTERVAL '3 months'
      ORDER BY ABS(EXTRACT(EPOCH FROM (period_date - $3::date)))
      LIMIT 1
    `, [geoId, row.metric_key, horizonDate]);

    if (!actualRes.rows[0]) continue;

    const actualValue  = parseFloat(actualRes.rows[0].value);
    const forecastValue = parseFloat(row.point_estimate);
    const ciLow  = parseFloat(row.ci_low  ?? row.point_estimate);
    const ciHigh = parseFloat(row.ci_high ?? row.point_estimate);

    const divergencePct = forecastValue !== 0
      ? (actualValue - forecastValue) / Math.abs(forecastValue)
      : 0;

    // Divergence rule per spec: |actual - forecast| > 1 playbook stddev.
    // Falls back to CI-based check when stddev is unavailable (preliminary playbooks).
    const playbookStddev = parseFloat(row.playbook_stddev ?? '0');
    const absDeviation = Math.abs(actualValue - forecastValue);
    const isDiverged = playbookStddev > 0
      ? absDeviation > playbookStddev
      : (actualValue < ciLow || actualValue > ciHigh);
    const statusLabel = actualValue > ciHigh ? 'ahead'
      : actualValue < ciLow ? 'behind'
      : 'on_pace';

    await pool.query(`
      INSERT INTO forecast_actuals_tracking
        (forecast_id, event_id, metric_key, window_months, checked_at,
         actual_value, forecast_value, divergence_pct, is_diverged, status_label)
      VALUES ($1,$2,$3,$4,NOW(),$5,$6,$7,$8,$9)
    `, [row.forecast_id, row.event_id, row.metric_key, row.window_months,
        actualValue, forecastValue, divergencePct, isDiverged, statusLabel]);

    checked++;
    if (isDiverged) {
      diverged++;
      try {
        await kafkaProducer.publish(
          KAFKA_TOPICS.M35_FORECAST_DIVERGED,
          {
            eventType: 'M35_FORECAST_DIVERGED',
            eventId: row.event_id,
            forecastId: row.forecast_id,
            metricKey: row.metric_key,
            windowMonths: row.window_months,
            actualValue,
            forecastValue,
            divergencePct,
            statusLabel,
            checkedAt: new Date().toISOString(),
          },
          { key: row.event_id },
        );
      } catch { /* non-blocking */ }
    }
  } // end for (row of batchRows)
  } while (batchRows.length === DIVERGENCE_BATCH_SIZE); // next batch if page was full

  logger.info(`[M35 Forecast] Divergence check: ${checked} checked, ${diverged} diverged`);
  return { checked, diverged };
}
