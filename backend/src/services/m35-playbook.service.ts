/**
 * M35 Playbook Aggregation Service
 *
 * Aggregates event_impacts records into reusable playbooks per event subtype.
 * Playbooks are the platform's learned response functions — they answer:
 *   "HQ relocations historically lifted rent growth 3.8pp at T+24 with confidence 0.74"
 *
 * Key operations:
 *   aggregatePlaybook()       — pulls event_impacts, computes p25/median/p75 per metric×window, upserts
 *   getPlaybook()             — returns structured playbook from DB
 *   listPlaybooks()           — all subtypes with instance counts + confidence
 *   scaleMagnitude()          — applies jobs/wage/MSA-size scaling to a playbook baseline
 *   triggerPlaybookUpdate()   — called after computeEventImpact() to keep playbooks current
 *   seedHistoricalPlaybooks() — backfill seed so playbooks are not empty on first launch
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { kafkaProducer } from './kafka/kafka-producer.service';
import { KAFKA_TOPICS, M35PlaybookUpdatedMessage } from './kafka/event-schemas';

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_PUBLISHABLE = 8;   // n >= 8 → 'publishable', else 'preliminary'
const PRELIMINARY_CI_SCALE = 1.4;   // widen CI by this factor when preliminary
const DECAY_WEIGHT = 0.3;    // exponential update weight for new instances

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlaybookStratum {
  msaTier?: 'large' | 'mid' | 'small' | 'all';
  magnitude?: 'small' | 'medium' | 'large' | 'transformative' | 'all';
  regime?: 'pre_covid' | 'post_covid' | 'all';
}

/** Snake-case DB row from the event_playbooks table. */
interface DbPlaybookRow {
  id: string;
  subtype: string;
  stratum_msa_tier: 'large' | 'mid' | 'small' | 'all';
  stratum_magnitude: 'small' | 'medium' | 'large' | 'transformative' | 'all';
  stratum_regime: 'pre_covid' | 'post_covid' | 'all';
  metric_key: string;
  window_months: string;      // pg numeric → string
  median_delta: string | null;
  p25: string | null;
  p75: string | null;
  mean_delta: string | null;
  stddev_delta: string | null;
  instance_count: string;     // pg numeric → string
  confidence: string;         // pg numeric → string
  status: 'preliminary' | 'publishable';
  lag_structure: Record<string, unknown> | null;
  scaling_coefficients: Record<string, number> | null;
  is_seeded: boolean;
  last_updated: string;
}

export interface PlaybookRow {
  subtype: string;
  stratumMsaTier: string;
  stratumMagnitude: string;
  stratumRegime: string;
  metricKey: string;
  windowMonths: number;
  medianDelta: number | null;
  p25: number | null;
  p75: number | null;
  meanDelta: number | null;
  stddevDelta: number | null;
  instanceCount: number;
  confidence: number;
  status: 'preliminary' | 'publishable';
  lagStructure: Record<string, Record<string, unknown>>;
  scalingCoefficients: Record<string, number>;
  isSeeded: boolean;
  lastUpdated: Date;
}

export interface PlaybookMetricWindow {
  metricKey: string;
  windowMonths: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  mean: number | null;
  stddev: number | null;
  instanceCount: number;
  confidence: number;
  status: 'preliminary' | 'publishable';
}

export interface PlaybookSummary {
  subtype: string;
  displayName: string;
  category: string;
  instanceCount: number;
  confidence: number;
  status: 'preliminary' | 'publishable';
  metricWindowCount: number;
  lastUpdated: Date | null;
}

export interface Playbook {
  subtype: string;
  displayName: string;
  category: string;
  stratum: PlaybookStratum;
  instanceCount: number;
  confidence: number;
  status: 'preliminary' | 'publishable';
  lagStructure: Record<string, Record<string, unknown>>;
  scalingCoefficients: Record<string, number>;
  metrics: PlaybookMetricWindow[];
  lastUpdated: Date | null;
}

export interface MagnitudeScaleResult {
  metricKey: string;
  windowMonths: number;
  baselineMedian: number | null;
  scaledMedian: number | null;
  scaledP25: number | null;
  scaledP75: number | null;
  scaleFactor: number;
  explanation: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyMsaTier(msaId: string | null): 'large' | 'mid' | 'small' {
  if (!msaId) return 'mid';
  const large = ['new-york', 'los-angeles', 'chicago', 'dallas', 'houston', 'atlanta', 'washington', 'miami', 'phoenix', 'philadelphia', 'boston', 'san-francisco', 'seattle', 'detroit', 'minneapolis'];
  if (large.some(l => msaId.toLowerCase().includes(l))) return 'large';
  const small = ['boise', 'fayetteville', 'macon', 'savannah', 'augusta', 'chattanooga', 'knoxville', 'greenville', 'columbia-sc', 'montgomery', 'tuscaloosa'];
  if (small.some(s => msaId.toLowerCase().includes(s))) return 'small';
  return 'mid';
}

function classifyMagnitudeStratum(magnitudeScore: number | null): 'small' | 'medium' | 'large' | 'transformative' {
  const s = magnitudeScore ?? 2;
  if (s <= 1) return 'small';
  if (s <= 2) return 'medium';
  if (s <= 4) return 'large';
  return 'transformative';
}

function classifyRegime(announcedDate: Date | null): 'pre_covid' | 'post_covid' {
  if (!announcedDate) return 'post_covid';
  return announcedDate < new Date('2020-03-01') ? 'pre_covid' : 'post_covid';
}

// ─── Core: Aggregate playbook from event_impacts ───────────────────────────────

export async function aggregatePlaybook(
  subtype: string,
  stratum: PlaybookStratum = { msaTier: 'all', magnitude: 'all', regime: 'all' },
): Promise<void> {
  const pool = getPool();
  const msaTier = stratum.msaTier ?? 'all';
  const magnitude = stratum.magnitude ?? 'all';
  const regime = stratum.regime ?? 'all';

  // Build WHERE clauses for stratification
  const stratumClauses: string[] = ["ke.subtype = $1", "ei.data_quality IN ('complete', 'partial')"];
  const params: (string | number)[] = [subtype];

  if (msaTier !== 'all') {
    const largeMsaPattern = 'new-york|los-angeles|chicago|dallas|houston|atlanta|washington|miami|phoenix|philadelphia|boston|san-francisco|seattle|detroit|minneapolis';
    const smallMsaPattern = 'boise|fayetteville|macon|savannah|augusta|chattanooga|knoxville|greenville|columbia-sc|montgomery|tuscaloosa';
    if (msaTier === 'large') {
      params.push(largeMsaPattern);
      stratumClauses.push(`ke.msa_id ~ $${params.length}`);
    } else if (msaTier === 'small') {
      params.push(smallMsaPattern);
      stratumClauses.push(`ke.msa_id ~ $${params.length}`);
    } else {
      // 'mid': explicitly exclude both large and small sets
      params.push(largeMsaPattern);
      stratumClauses.push(`ke.msa_id !~ $${params.length}`);
      params.push(smallMsaPattern);
      stratumClauses.push(`ke.msa_id !~ $${params.length}`);
    }
  }
  if (magnitude !== 'all') {
    const scoreRange = { small: [1, 1], medium: [2, 2], large: [3, 4], transformative: [5, 5] }[magnitude] ?? [1, 5];
    params.push(scoreRange[0], scoreRange[1]);
    stratumClauses.push(`ke.magnitude_score BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  if (regime !== 'all') {
    params.push('2020-03-01');
    stratumClauses.push(regime === 'pre_covid'
      ? `ke.announced_date < $${params.length}`
      : `ke.announced_date >= $${params.length}`);
  }

  const whereClause = stratumClauses.join(' AND ');

  // Hybrid aggregation:
  //   • Quantiles (median / p25 / p75): true PERCENTILE_CONT from empirical distribution of attributed_delta
  //   • Mean / stddev / confidence: confidence × recency weighted (weight = did_confidence × exp(-DECAY_WEIGHT × age_years))
  // This preserves the correct distributional statistics while incorporating recency/quality weighting
  // in the scalar summarisation fields.
  const aggRows = await pool.query(`
    WITH weighted AS (
      SELECT
        ei.id                                                              AS impact_id,
        ei.event_id,
        ei.metric_key,
        ei.window_months,
        ei.attributed_delta                                                AS delta,
        GREATEST(0.01,
          ei.did_confidence *
          EXP(-${DECAY_WEIGHT} * GREATEST(0,
            EXTRACT(EPOCH FROM (NOW() - COALESCE(ke.materialization_date, ke.announced_date, NOW())))
            / 31536000.0
          ))
        )                                                                  AS w
      FROM event_impacts ei
      JOIN key_events ke ON ke.id = ei.event_id
      WHERE ${whereClause}
        AND ei.attributed_delta IS NOT NULL
    ),
    -- Empirical quantiles: true percentiles from historical distribution
    quantiles AS (
      SELECT
        metric_key,
        window_months,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY delta)   AS median_delta,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY delta)   AS p25,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY delta)   AS p75,
        COUNT(DISTINCT event_id)::int                          AS n
      FROM weighted
      GROUP BY metric_key, window_months
    ),
    -- Weighted mean: recency × confidence weighted point estimate
    wt_stats AS (
      SELECT
        metric_key,
        window_months,
        SUM(delta * w) / NULLIF(SUM(w), 0)   AS wt_mean,
        SUM(w)                                AS sum_w,
        AVG(w)                                AS avg_w
      FROM weighted
      GROUP BY metric_key, window_months
    ),
    -- Weighted variance: for stddev_delta field
    wt_var AS (
      SELECT
        w.metric_key,
        w.window_months,
        SQRT(
          SUM(w.w * POWER(w.delta - s.wt_mean, 2)) / NULLIF(s.sum_w, 0)
        )                                     AS wt_sd
      FROM weighted w
      JOIN wt_stats s USING (metric_key, window_months)
      GROUP BY w.metric_key, w.window_months, s.wt_mean, s.sum_w
    )
    SELECT
      q.metric_key,
      q.window_months,
      q.median_delta,
      q.p25,
      q.p75,
      s.wt_mean                              AS mean_delta,
      v.wt_sd                                AS stddev_delta,
      q.n                                    AS instance_count,
      LEAST(s.avg_w, 0.999)                 AS avg_confidence
    FROM quantiles q
    JOIN wt_stats s USING (metric_key, window_months)
    JOIN wt_var v USING (metric_key, window_months)
    ORDER BY q.metric_key, q.window_months
  `, params);

  if (aggRows.rows.length === 0) {
    logger.debug(`[M35 Playbook] No impact data for ${subtype} (${msaTier}/${magnitude}/${regime})`);
    return;
  }

  // ── Lag structure derivation ──────────────────────────────────────────────
  // For each metric, examine how |median_delta| varies across window_months.
  // Peak window = the window with highest absolute impact.
  // Onset window = first window where signal exceeds 25% of peak amplitude.
  // Profile = 'immediate' | 'gradual' | 'delayed' (based on peak position in window ordering).
  const metricWindows: Record<string, Array<{ wm: number; delta: number }>> = {};
  for (const r of aggRows.rows) {
    const mk = r.metric_key;
    if (!metricWindows[mk]) metricWindows[mk] = [];
    metricWindows[mk].push({ wm: parseInt(r.window_months), delta: parseFloat(r.median_delta ?? '0') });
  }
  const lagStructureByMetric: Record<string, object> = {};
  for (const [metric, windows] of Object.entries(metricWindows)) {
    windows.sort((a, b) => a.wm - b.wm);
    const absVals = windows.map(w => Math.abs(w.delta));
    const peakIdx = absVals.indexOf(Math.max(...absVals));
    const peakWindow = windows[peakIdx].wm;
    const peakAbs = absVals[peakIdx];
    const onset = windows.find(w => Math.abs(w.delta) > 0.25 * peakAbs);
    const onsetWindow = onset ? onset.wm : windows[0]?.wm ?? 0;
    const peakPos = peakIdx / Math.max(windows.length - 1, 1);
    const profile = peakPos <= 0.25 ? 'immediate' : peakPos <= 0.6 ? 'gradual' : 'delayed';
    const direction = (windows[peakIdx]?.delta ?? 0) >= 0 ? 'positive' : 'negative';
    lagStructureByMetric[metric] = { peak_window: peakWindow, onset_window: onsetWindow, profile, direction };
  }

  // Upsert each metric×window row
  for (const row of aggRows.rows) {
    const n = parseInt(row.instance_count);
    const status = n >= MIN_PUBLISHABLE ? 'publishable' : 'preliminary';
    let p25 = parseFloat(row.p25 ?? '0');
    let p75 = parseFloat(row.p75 ?? '0');
    if (status === 'preliminary') {
      const spread = Math.abs(p75 - p25) * PRELIMINARY_CI_SCALE;
      const mid = parseFloat(row.median_delta ?? '0');
      p25 = mid - spread / 2;
      p75 = mid + spread / 2;
    }

    const lagJson = JSON.stringify(lagStructureByMetric[row.metric_key] ?? {});
    await pool.query(`
      INSERT INTO event_playbooks
        (subtype, stratum_msa_tier, stratum_magnitude, stratum_regime,
         metric_key, window_months,
         median_delta, p25, p75, mean_delta, stddev_delta,
         instance_count, confidence, status, lag_structure, is_seeded, last_updated)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,false,NOW())
      ON CONFLICT (subtype, stratum_msa_tier, stratum_magnitude, stratum_regime, metric_key, window_months)
      DO UPDATE SET
        median_delta   = EXCLUDED.median_delta,
        p25            = EXCLUDED.p25,
        p75            = EXCLUDED.p75,
        mean_delta     = EXCLUDED.mean_delta,
        stddev_delta   = EXCLUDED.stddev_delta,
        instance_count = EXCLUDED.instance_count,
        confidence     = EXCLUDED.confidence,
        status         = EXCLUDED.status,
        lag_structure  = EXCLUDED.lag_structure,
        is_seeded      = false,
        last_updated   = NOW()
    `, [
      subtype, msaTier, magnitude, regime,
      row.metric_key, row.window_months,
      row.median_delta, p25, p75,
      row.mean_delta, row.stddev_delta,
      n, row.avg_confidence, status, lagJson,
    ]);
  }

  // Bulk-insert provenance links into playbook_instances.
  // First, prune any stale links for the affected playbook rows — this handles the case where
  // source impacts have been removed, quality-gated, or moved out of the stratum since the last run.
  await pool.query(`
    DELETE FROM playbook_instances
    WHERE playbook_id IN (
      SELECT ep.id FROM event_playbooks ep
      WHERE ep.subtype            = $1
        AND ep.stratum_msa_tier   = $2
        AND ep.stratum_magnitude  = $3
        AND ep.stratum_regime     = $4
    )
  `, [subtype, msaTier, magnitude, regime]);

  // Then insert fresh links — stratum join params appended AFTER WHERE params.
  const piMsaIdx  = params.length + 1;
  const piMagIdx  = params.length + 2;
  const piRegIdx  = params.length + 3;
  await pool.query(`
    INSERT INTO playbook_instances (playbook_id, event_id, impact_id, weight)
    SELECT
      ep.id,
      ei.event_id,
      ei.id,
      GREATEST(0.01,
        ei.did_confidence *
        EXP(-${DECAY_WEIGHT} * GREATEST(0,
          EXTRACT(EPOCH FROM (NOW() - COALESCE(ke.materialization_date, ke.announced_date, NOW())))
          / 31536000.0
        ))
      ) AS weight
    FROM event_impacts ei
    JOIN key_events ke ON ke.id = ei.event_id
    JOIN event_playbooks ep
      ON  ep.subtype            = ke.subtype
      AND ep.metric_key         = ei.metric_key
      AND ep.window_months      = ei.window_months
      AND ep.stratum_msa_tier   = $${piMsaIdx}
      AND ep.stratum_magnitude  = $${piMagIdx}
      AND ep.stratum_regime     = $${piRegIdx}
    WHERE ${whereClause}
      AND ei.attributed_delta IS NOT NULL
    ON CONFLICT (playbook_id, impact_id) DO UPDATE SET weight = EXCLUDED.weight
  `, [...params, msaTier, magnitude, regime]);

  // Publish Kafka event
  try {
    const now = new Date().toISOString();
    const playbookMsg: M35PlaybookUpdatedMessage = {
      eventType: 'M35_PLAYBOOK_UPDATED',
      eventId: `playbook:${subtype}:${msaTier}:${magnitude}:${regime}`,
      timestamp: now,
      subtype,
      stratum: { msaTier, magnitude, regime },
      metricWindowCount: aggRows.rows.length,
      instanceCount: aggRows.rows[0] ? parseInt(aggRows.rows[0].instance_count) : 0,
      updatedAt: now,
    };
    await kafkaProducer.publish(KAFKA_TOPICS.M35_PLAYBOOK_UPDATED, playbookMsg,
      { key: `${subtype}:${msaTier}:${magnitude}:${regime}` });
  } catch { /* non-blocking */ }

  logger.info(`[M35 Playbook] Aggregated ${aggRows.rows.length} metric×window rows for ${subtype}`);
}

// ─── Trigger: Called after computeEventImpact() ───────────────────────────────

export async function triggerPlaybookUpdate(eventId: string): Promise<void> {
  const pool = getPool();
  const ev = await pool.query(
    `SELECT subtype, msa_id, magnitude_score, announced_date FROM key_events WHERE id = $1`,
    [eventId],
  );
  if (!ev.rows[0]?.subtype) return;

  const { subtype, msa_id, magnitude_score, announced_date } = ev.rows[0];
  const msaTier = classifyMsaTier(msa_id);
  const magnitude = classifyMagnitudeStratum(magnitude_score);
  const regime = classifyRegime(announced_date ? new Date(announced_date) : null);

  // Aggregate the broad 'all' stratum + the specific stratum for this event
  await aggregatePlaybook(subtype, { msaTier: 'all', magnitude: 'all', regime: 'all' });
  await aggregatePlaybook(subtype, { msaTier, magnitude, regime });

  logger.info(`[M35 Playbook] Updated playbooks for subtype=${subtype} after impact event=${eventId}`);

  // Regen forecasts for all active events of the same subtype (fire-and-forget)
  // Dynamic import avoids circular dep: m35-forecast.service imports m35-playbook.service
  void (async () => {
    try {
      const affectedRes = await pool.query(`
        SELECT DISTINCT ef.event_id
        FROM event_forecasts ef
        JOIN key_events ke ON ke.id = ef.event_id
        WHERE ke.subtype = $1
          AND ef.status = 'active'
          AND ke.status IN ('announced', 'in_progress', 'materialized')
      `, [subtype]);

      if (affectedRes.rows.length === 0) return;

      const { generateForecast } = await import('./m35-forecast.service');
      for (const row of affectedRes.rows) {
        try {
          await generateForecast(row.event_id);
        } catch (innerErr: any) {
          logger.warn(`[M35 Playbook] Forecast regen failed for event ${row.event_id} (non-fatal)`, { err: innerErr.message });
        }
      }
      logger.info(`[M35 Playbook] Regenerated forecasts for ${affectedRes.rows.length} active events of subtype=${subtype}`);
    } catch (err: any) {
      logger.warn('[M35 Playbook] Playbook-update forecast regen failed (non-fatal)', { err: err.message });
    }
  })();
}

// ─── Read: Get playbook ───────────────────────────────────────────────────────

export async function getPlaybook(
  subtype: string,
  stratum: PlaybookStratum = { msaTier: 'all', magnitude: 'all', regime: 'all' },
): Promise<Playbook | null> {
  const pool = getPool();
  const msaTier = stratum.msaTier ?? 'all';
  const magnitude = stratum.magnitude ?? 'all';
  const regime = stratum.regime ?? 'all';

  const rows = await pool.query<DbPlaybookRow>(`
    SELECT ep.*
    FROM event_playbooks ep
    WHERE ep.subtype = $1
      AND ep.stratum_msa_tier = $2
      AND ep.stratum_magnitude = $3
      AND ep.stratum_regime = $4
    ORDER BY ep.metric_key, ep.window_months
  `, [subtype, msaTier, magnitude, regime]);

  // Fall back to 'all' stratum if no rows for specific stratum
  let data: DbPlaybookRow[] = rows.rows;
  if (data.length === 0 && (msaTier !== 'all' || magnitude !== 'all' || regime !== 'all')) {
    const fallback = await pool.query<DbPlaybookRow>(`
      SELECT ep.*
      FROM event_playbooks ep
      WHERE ep.subtype = $1
        AND ep.stratum_msa_tier = 'all'
        AND ep.stratum_magnitude = 'all'
        AND ep.stratum_regime = 'all'
      ORDER BY ep.metric_key, ep.window_months
    `, [subtype]);
    data = fallback.rows;
  }

  if (data.length === 0) return null;

  // Fetch taxonomy display info
  const tax = await pool.query(
    `SELECT display_name, category FROM event_taxonomy WHERE subtype = $1 LIMIT 1`,
    [subtype],
  );

  const first = data[0];
  const maxN = Math.max(...data.map(r => Number(r.instance_count)));
  const avgConf = data.reduce((s, r) => s + Number(r.confidence), 0) / data.length;
  const overallStatus = maxN >= MIN_PUBLISHABLE ? 'publishable' : 'preliminary';

  // Build per-metric lag structure map — lag_structure is metric-level (same object stored in every
  // window row for the same metric), so deduplicate by taking the first non-empty entry per metric_key.
  const lagStructureMap: Record<string, Record<string, unknown>> = {};
  for (const r of data) {
    if (r.lag_structure && Object.keys(r.lag_structure).length > 0 && !lagStructureMap[r.metric_key]) {
      lagStructureMap[r.metric_key] = r.lag_structure as Record<string, unknown>;
    }
  }

  return {
    subtype,
    displayName: tax.rows[0]?.display_name ?? subtype,
    category: tax.rows[0]?.category ?? 'EMPLOYMENT',
    stratum: { msaTier: first.stratum_msa_tier, magnitude: first.stratum_magnitude, regime: first.stratum_regime },
    instanceCount: maxN,
    confidence: Math.round(avgConf * 100) / 100,
    status: overallStatus,
    lagStructure: lagStructureMap,
    scalingCoefficients: first.scaling_coefficients ?? {},
    metrics: data.map(r => ({
      metricKey: r.metric_key,
      windowMonths: Number(r.window_months),
      median: r.median_delta !== null ? Number(r.median_delta) : null,
      p25: r.p25 !== null ? Number(r.p25) : null,
      p75: r.p75 !== null ? Number(r.p75) : null,
      mean: r.mean_delta !== null ? Number(r.mean_delta) : null,
      stddev: r.stddev_delta !== null ? Number(r.stddev_delta) : null,
      instanceCount: Number(r.instance_count),
      confidence: Number(r.confidence),
      status: r.status,
    })),
    lastUpdated: data.reduce<Date | null>((latest, r) => {
      const d = r.last_updated ? new Date(r.last_updated) : null;
      if (!d) return latest;
      return !latest || d > latest ? d : latest;
    }, null),
  };
}

// ─── Read: List all playbooks ─────────────────────────────────────────────────

export async function listPlaybooks(): Promise<PlaybookSummary[]> {
  const pool = getPool();
  const rows = await pool.query(`
    SELECT
      ep.subtype,
      et.display_name,
      et.category,
      MAX(ep.instance_count)              AS instance_count,
      AVG(ep.confidence)                  AS avg_confidence,
      CASE WHEN MAX(ep.instance_count) >= $1 THEN 'publishable' ELSE 'preliminary' END AS status,
      COUNT(*)::int                       AS metric_window_count,
      MAX(ep.last_updated)                AS last_updated
    FROM event_playbooks ep
    LEFT JOIN event_taxonomy et ON et.subtype = ep.subtype
    WHERE ep.stratum_msa_tier = 'all'
      AND ep.stratum_magnitude = 'all'
      AND ep.stratum_regime = 'all'
    GROUP BY ep.subtype, et.display_name, et.category
    ORDER BY MAX(ep.instance_count) DESC, ep.subtype
  `, [MIN_PUBLISHABLE]);

  return rows.rows.map(r => ({
    subtype: r.subtype,
    displayName: r.display_name ?? r.subtype,
    category: r.category ?? 'EMPLOYMENT',
    instanceCount: parseInt(r.instance_count),
    confidence: Math.round(parseFloat(r.avg_confidence) * 100) / 100,
    status: r.status as 'preliminary' | 'publishable',
    metricWindowCount: parseInt(r.metric_window_count),
    lastUpdated: r.last_updated ? new Date(r.last_updated) : null,
  }));
}

// ─── Magnitude Scaling ────────────────────────────────────────────────────────

/**
 * Scale a playbook's baseline estimates for a specific event's magnitude.
 *
 * Spec §4.1 scaling factors:
 *   jobs × 0.0002 = rent_growth_pp (so 2,000 jobs ≈ +0.4pp base effect)
 *   Wage premium multiplier: 1.4x if avg wage > 1.5x area median
 *   MSA size attenuator: larger MSAs absorb better (inverse proportional)
 */
export function scaleMagnitude(
  event: {
    magnitudeValue: number | null;
    magnitudeUnit: string | null;
    magnitudeScore: number | null;
    msaId: string | null;
    wageLevel?: number | null;       // avg wage of jobs (for employment events)
    areaMedWage?: number | null;     // area median wage
  },
  playbook: Playbook,
): MagnitudeScaleResult[] {
  const msaTier = classifyMsaTier(event.msaId);
  // MSA size attenuation: large=0.7, mid=1.0, small=1.4 (smaller markets feel it more)
  const msaAtten = msaTier === 'large' ? 0.70 : msaTier === 'small' ? 1.40 : 1.00;

  // Wage premium multiplier
  let wageMult = 1.0;
  if (event.wageLevel && event.areaMedWage && event.areaMedWage > 0) {
    wageMult = event.wageLevel / event.areaMedWage > 1.5 ? 1.4 : 1.0;
  }

  // ── Jobs-based formula (employment events only) ────────────────────────────
  // Spec: rent_growth_pp_baseline = jobs × 0.0002
  //       absorption_pp_baseline  = jobs × 0.0001 (net absorption driven by employment demand)
  // Both baselines are then modulated by wageMult and msaAtten — NOT used as multipliers on
  // the existing playbook median, which would double-count and inflate results.
  const jobCount  = event.magnitudeUnit === 'jobs' ? (event.magnitudeValue ?? 0) : 0;
  const isJobsBased = event.magnitudeUnit === 'jobs' && jobCount > 0;
  const rentBaseline       = jobCount * 0.0002 * wageMult * msaAtten;  // pp rent growth
  const absorptionBaseline = jobCount * 0.0001 * wageMult * msaAtten;  // pp absorption

  return playbook.metrics.map(m => {
    const isRentMetric       = m.metricKey.includes('rent');
    const isAbsorptionMetric = m.metricKey.includes('absorption') || m.metricKey.includes('vacancy');

    let scaledMedian: number | null;
    let scaleFactor: number;
    const parts: string[] = [];

    if (isJobsBased && isRentMetric) {
      // Point estimate from jobs formula; playbook median drives the CI spread ratio
      scaledMedian = rentBaseline;
      scaleFactor  = m.median !== null && m.median !== 0 ? rentBaseline / m.median : msaAtten * wageMult;
      parts.push(`${jobCount} jobs × 0.0002 = ${rentBaseline.toFixed(3)} pp`);
      if (wageMult !== 1.0) parts.push(`wage premium ×${wageMult}`);
      if (msaAtten !== 1.0) parts.push(`MSA ${msaTier} atten ×${msaAtten}`);
    } else if (isJobsBased && isAbsorptionMetric) {
      scaledMedian = absorptionBaseline;
      scaleFactor  = m.median !== null && m.median !== 0 ? absorptionBaseline / m.median : msaAtten * wageMult;
      parts.push(`${jobCount} jobs × 0.0001 = ${absorptionBaseline.toFixed(3)} pp`);
      if (wageMult !== 1.0) parts.push(`wage premium ×${wageMult}`);
      if (msaAtten !== 1.0) parts.push(`MSA ${msaTier} atten ×${msaAtten}`);
    } else {
      // Non-jobs event OR non-rent/absorption metric: scale the playbook median by modifiers
      scaleFactor  = msaAtten * wageMult;
      scaledMedian = m.median !== null ? m.median * scaleFactor : null;
      if (msaAtten !== 1.0) parts.push(`MSA ${msaTier} atten ×${msaAtten}`);
      if (wageMult !== 1.0) parts.push(`wage premium ×${wageMult}`);
    }

    // CI spread is always relative to the playbook's existing spread, scaled by scaleFactor
    const spread     = (m.p75 ?? 0) - (m.p25 ?? 0);
    const halfSpread = Math.abs(spread / 2 * scaleFactor);

    return {
      metricKey: m.metricKey,
      windowMonths: m.windowMonths,
      baselineMedian: m.median,
      scaledMedian,
      scaledP25: scaledMedian !== null ? scaledMedian - halfSpread : null,
      scaledP75: scaledMedian !== null ? scaledMedian + halfSpread : null,
      scaleFactor,
      explanation: parts.length > 0 ? parts.join(', ') : 'no scaling applied',
    };
  });
}

// ─── Historical Backfill Seed ─────────────────────────────────────────────────

/**
 * Seeds event_playbooks by inserting synthetic key_events + event_impacts
 * for historically-grounded analog events, then running them through the
 * normal aggregatePlaybook() pipeline.  Re-run safe (ON CONFLICT DO NOTHING).
 *
 * Sources:
 *   EMPLOYMENT  — BLS QCEW, NBER working papers, CoStar market analysis
 *   INFRASTRUCTURE — TCRP Report 167, NBER transit capitalization studies
 *   REGULATORY_POLICY — Diamond et al. (2019), AirDNA/CBRE research 2018-2023
 *   MARKET_STRUCTURE — Zillow research on upzoning 2018-2022
 *   DISASTER_DISRUPTION — FHFA house price indices, NBER disaster papers
 */
export async function seedHistoricalPlaybooks(): Promise<{ seeded: number; skipped: number }> {
  const pool = getPool();

  // ── Benchmark table: median attributed_delta and half-spread per subtype×metric×window ──
  // Half-spread drives the linear jitter that distributes synthetic impact values across analogs.
  const benchmarks: Array<{
    subtype: string; metricKey: string; windowMonths: number;
    median: number; halfSpread: number; confidence: number;
  }> = [
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', metricKey:'search_growth',    windowMonths:3,  median:0.28,    halfSpread:0.12, confidence:0.74 },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', metricKey:'rent_growth_yoy',  windowMonths:3,  median:0.004,   halfSpread:0.003, confidence:0.74 },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', metricKey:'search_growth',    windowMonths:12, median:0.45,    halfSpread:0.20, confidence:0.74 },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', metricKey:'rent_growth_yoy',  windowMonths:12, median:0.018,   halfSpread:0.012, confidence:0.74 },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', metricKey:'net_absorption',   windowMonths:12, median:0.22,    halfSpread:0.14, confidence:0.68 },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', metricKey:'rent_growth_yoy',  windowMonths:24, median:0.038,   halfSpread:0.017, confidence:0.74 },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', metricKey:'cap_rate',         windowMonths:24, median:-0.0035, halfSpread:0.0023, confidence:0.61 },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', metricKey:'permits_issued',   windowMonths:24, median:0.48,    halfSpread:0.29, confidence:0.58 },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', metricKey:'rent_growth_yoy',  windowMonths:36, median:0.012,   halfSpread:0.009, confidence:0.55 },

    { subtype:'TRANSIT_LINE_OPENING', metricKey:'rent_growth_yoy',   windowMonths:3,  median:0.005,   halfSpread:0.006, confidence:0.63 },
    { subtype:'TRANSIT_LINE_OPENING', metricKey:'rent_growth_yoy',   windowMonths:12, median:0.018,   halfSpread:0.012, confidence:0.63 },
    { subtype:'TRANSIT_LINE_OPENING', metricKey:'effective_rent',    windowMonths:12, median:0.021,   halfSpread:0.015, confidence:0.60 },
    { subtype:'TRANSIT_LINE_OPENING', metricKey:'vacancy_rate',      windowMonths:12, median:-0.012,  halfSpread:0.009, confidence:0.60 },
    { subtype:'TRANSIT_LINE_OPENING', metricKey:'rent_growth_yoy',   windowMonths:24, median:0.031,   halfSpread:0.017, confidence:0.63 },
    { subtype:'TRANSIT_LINE_OPENING', metricKey:'permits_issued',    windowMonths:24, median:0.35,    halfSpread:0.27, confidence:0.52 },
    { subtype:'TRANSIT_LINE_OPENING', metricKey:'home_value_index',  windowMonths:36, median:0.062,   halfSpread:0.035, confidence:0.50 },

    { subtype:'MAJOR_EMPLOYER_DEPARTURE', metricKey:'rent_growth_yoy', windowMonths:3,  median:-0.004,  halfSpread:0.006, confidence:0.65 },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', metricKey:'vacancy_rate',    windowMonths:3,  median:0.008,   halfSpread:0.008, confidence:0.65 },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', metricKey:'rent_growth_yoy', windowMonths:12, median:-0.015,  halfSpread:0.012, confidence:0.65 },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', metricKey:'net_absorption',  windowMonths:12, median:-0.18,   halfSpread:0.13, confidence:0.58 },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', metricKey:'rent_growth_yoy', windowMonths:24, median:-0.022,  halfSpread:0.015, confidence:0.65 },

    { subtype:'STR_REGULATION_BAN', metricKey:'rent_growth_yoy',    windowMonths:3,  median:0.006,   halfSpread:0.006, confidence:0.62 },
    { subtype:'STR_REGULATION_BAN', metricKey:'vacancy_rate',       windowMonths:3,  median:-0.018,  halfSpread:0.010, confidence:0.62 },
    { subtype:'STR_REGULATION_BAN', metricKey:'rent_growth_yoy',    windowMonths:12, median:0.024,   halfSpread:0.015, confidence:0.62 },
    { subtype:'STR_REGULATION_BAN', metricKey:'vacancy_rate',       windowMonths:12, median:-0.028,  halfSpread:0.014, confidence:0.62 },
    { subtype:'STR_REGULATION_BAN', metricKey:'home_value_index',   windowMonths:12, median:-0.031,  halfSpread:0.022, confidence:0.54 },
    { subtype:'STR_REGULATION_BAN', metricKey:'effective_rent',     windowMonths:24, median:0.038,   halfSpread:0.021, confidence:0.62 },

    { subtype:'ZONING_UPZONE', metricKey:'permits_issued',          windowMonths:12, median:0.55,    halfSpread:0.44, confidence:0.55 },
    { subtype:'ZONING_UPZONE', metricKey:'home_value_index',        windowMonths:12, median:0.018,   halfSpread:0.015, confidence:0.55 },
    { subtype:'ZONING_UPZONE', metricKey:'rent_growth_yoy',         windowMonths:24, median:-0.012,  halfSpread:0.014, confidence:0.55 },
    { subtype:'ZONING_UPZONE', metricKey:'rent_growth_yoy',         windowMonths:36, median:-0.018,  halfSpread:0.015, confidence:0.50 },

    { subtype:'HURRICANE_NAMED_STORM', metricKey:'vacancy_rate',      windowMonths:3,  median:0.085,   halfSpread:0.065, confidence:0.71 },
    { subtype:'HURRICANE_NAMED_STORM', metricKey:'rent_growth_yoy',   windowMonths:3,  median:0.042,   halfSpread:0.040, confidence:0.71 },
    { subtype:'HURRICANE_NAMED_STORM', metricKey:'rent_growth_yoy',   windowMonths:12, median:0.028,   halfSpread:0.035, confidence:0.71 },
    { subtype:'HURRICANE_NAMED_STORM', metricKey:'home_value_index',  windowMonths:12, median:-0.038,  halfSpread:0.045, confidence:0.68 },
    { subtype:'HURRICANE_NAMED_STORM', metricKey:'home_value_index',  windowMonths:24, median:-0.015,  halfSpread:0.037, confidence:0.68 },

    { subtype:'PLANT_OPENING', metricKey:'employment_growth',       windowMonths:3,  median:0.015,   halfSpread:0.012, confidence:0.61 },
    { subtype:'PLANT_OPENING', metricKey:'rent_growth_yoy',         windowMonths:12, median:0.012,   halfSpread:0.010, confidence:0.61 },
    { subtype:'PLANT_OPENING', metricKey:'rent_growth_yoy',         windowMonths:24, median:0.021,   halfSpread:0.015, confidence:0.61 },
    { subtype:'PLANT_OPENING', metricKey:'net_absorption',          windowMonths:12, median:0.14,    halfSpread:0.11, confidence:0.56 },

    { subtype:'RENT_CONTROL_ENACTED', metricKey:'rent_growth_yoy',  windowMonths:12, median:-0.008,  halfSpread:0.010, confidence:0.52 },
    { subtype:'RENT_CONTROL_ENACTED', metricKey:'vacancy_rate',     windowMonths:24, median:-0.021,  halfSpread:0.015, confidence:0.52 },
    { subtype:'RENT_CONTROL_ENACTED', metricKey:'permits_issued',   windowMonths:24, median:-0.28,   halfSpread:0.17, confidence:0.48 },
  ];

  // ── Historical analog events (real named events used as seeds) ────────────────
  const seedEvents: Array<{
    subtype: string; category: string; scope: string;
    name: string; msaId: string; magnitudeScore: number;
    announcedDate: string; materializationDate: string;
    sourceRecordId: string;
  }> = [
    // ── MAJOR_EMPLOYER_ARRIVAL (14 analogs) ──────────────────────────────────
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'nashville',   magnitudeScore:5, announcedDate:'2018-11-13', materializationDate:'2021-01-01', name:'Amazon HQ2 Nashville',           sourceRecordId:'seed_mea_01' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'austin',       magnitudeScore:4, announcedDate:'2020-12-11', materializationDate:'2022-01-01', name:'Oracle HQ Relocation Austin',    sourceRecordId:'seed_mea_02' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'austin',       magnitudeScore:5, announcedDate:'2018-12-13', materializationDate:'2022-06-01', name:'Apple Austin Campus',            sourceRecordId:'seed_mea_03' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'dallas',       magnitudeScore:4, announcedDate:'2014-01-15', materializationDate:'2017-01-01', name:'Toyota HQ Plano TX',             sourceRecordId:'seed_mea_04' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'san-jose',     magnitudeScore:5, announcedDate:'2019-01-01', materializationDate:'2022-06-01', name:'Google Bay View Campus',         sourceRecordId:'seed_mea_05' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'dallas',       magnitudeScore:4, announcedDate:'2020-06-01', materializationDate:'2022-01-01', name:'Meta Fort Worth Data Center',    sourceRecordId:'seed_mea_06' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'birmingham',   magnitudeScore:4, announcedDate:'2020-11-16', materializationDate:'2021-03-29', name:'Amazon Bessemer Fulfillment',    sourceRecordId:'seed_mea_07' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'charleston-sc',magnitudeScore:4, announcedDate:'2009-12-01', materializationDate:'2011-06-01', name:'Boeing South Carolina Plant',    sourceRecordId:'seed_mea_08' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'san-francisco', magnitudeScore:5, announcedDate:'2010-01-01', materializationDate:'2012-01-01', name:'Tesla Fremont Factory',         sourceRecordId:'seed_mea_09' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'dallas',       magnitudeScore:3, announcedDate:'2020-10-01', materializationDate:'2022-06-01', name:'Goldman Sachs Dallas Office',    sourceRecordId:'seed_mea_10' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'nashville',    magnitudeScore:3, announcedDate:'2018-05-01', materializationDate:'2020-01-01', name:'AllianceBernstein Nashville',    sourceRecordId:'seed_mea_11' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'seattle',      magnitudeScore:4, announcedDate:'2019-01-01', materializationDate:'2022-01-01', name:'Microsoft Redmond Expansion',    sourceRecordId:'seed_mea_12' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'austin',       magnitudeScore:5, announcedDate:'2021-07-01', materializationDate:'2023-04-01', name:'Samsung Texas Memory Fab',       sourceRecordId:'seed_mea_13' },
    { subtype:'MAJOR_EMPLOYER_ARRIVAL', category:'EMPLOYMENT', scope:'MSA', msaId:'phoenix',      magnitudeScore:5, announcedDate:'2020-05-01', materializationDate:'2024-01-01', name:'TSMC Arizona Fab',               sourceRecordId:'seed_mea_14' },

    // ── TRANSIT_LINE_OPENING (11 analogs) ────────────────────────────────────
    { subtype:'TRANSIT_LINE_OPENING', category:'INFRASTRUCTURE', scope:'MSA', msaId:'washington', magnitudeScore:3, announcedDate:'2012-06-01', materializationDate:'2014-07-26', name:'Silver Line Phase I DC',         sourceRecordId:'seed_tlo_01' },
    { subtype:'TRANSIT_LINE_OPENING', category:'INFRASTRUCTURE', scope:'MSA', msaId:'los-angeles', magnitudeScore:3, announcedDate:'2014-01-01', materializationDate:'2023-06-16', name:'LA Purple Line Extension',      sourceRecordId:'seed_tlo_02' },
    { subtype:'TRANSIT_LINE_OPENING', category:'INFRASTRUCTURE', scope:'MSA', msaId:'houston',    magnitudeScore:2, announcedDate:'2003-01-01', materializationDate:'2004-01-01', name:'Houston Purple METRORail',       sourceRecordId:'seed_tlo_03' },
    { subtype:'TRANSIT_LINE_OPENING', category:'INFRASTRUCTURE', scope:'MSA', msaId:'denver',     magnitudeScore:2, announcedDate:'2010-01-01', materializationDate:'2013-04-22', name:'Denver W Rail Line',             sourceRecordId:'seed_tlo_04' },
    { subtype:'TRANSIT_LINE_OPENING', category:'INFRASTRUCTURE', scope:'MSA', msaId:'chicago',    magnitudeScore:3, announcedDate:'2016-06-01', materializationDate:'2022-10-17', name:'Red Line Extension Chicago',     sourceRecordId:'seed_tlo_05' },
    { subtype:'TRANSIT_LINE_OPENING', category:'INFRASTRUCTURE', scope:'MSA', msaId:'san-francisco', magnitudeScore:2, announcedDate:'2012-01-01', materializationDate:'2017-03-25', name:'BART Warm Springs Extension', sourceRecordId:'seed_tlo_06' },
    { subtype:'TRANSIT_LINE_OPENING', category:'INFRASTRUCTURE', scope:'MSA', msaId:'seattle',    magnitudeScore:3, announcedDate:'2012-01-01', materializationDate:'2021-10-02', name:'Seattle Northgate Link',         sourceRecordId:'seed_tlo_07' },
    { subtype:'TRANSIT_LINE_OPENING', category:'INFRASTRUCTURE', scope:'MSA', msaId:'phoenix',    magnitudeScore:2, announcedDate:'2016-01-01', materializationDate:'2016-12-28', name:'Phoenix West Valley Light Rail', sourceRecordId:'seed_tlo_08' },
    { subtype:'TRANSIT_LINE_OPENING', category:'INFRASTRUCTURE', scope:'MSA', msaId:'minneapolis', magnitudeScore:2, announcedDate:'2010-01-01', materializationDate:'2014-06-14', name:'Twin Cities Green Line',        sourceRecordId:'seed_tlo_09' },
    { subtype:'TRANSIT_LINE_OPENING', category:'INFRASTRUCTURE', scope:'MSA', msaId:'charlotte',  magnitudeScore:2, announcedDate:'2017-01-01', materializationDate:'2020-03-16', name:'Charlotte Gold Line Streetcar',  sourceRecordId:'seed_tlo_10' },
    { subtype:'TRANSIT_LINE_OPENING', category:'INFRASTRUCTURE', scope:'MSA', msaId:'boston',     magnitudeScore:3, announcedDate:'2018-01-01', materializationDate:'2022-08-22', name:'Green Line Extension Boston',    sourceRecordId:'seed_tlo_11' },

    // ── MAJOR_EMPLOYER_DEPARTURE (9 analogs) ─────────────────────────────────
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', category:'EMPLOYMENT', scope:'MSA', msaId:'chicago',    magnitudeScore:4, announcedDate:'2017-01-15', materializationDate:'2018-10-15', name:'Sears HQ Closure Hoffman Estates', sourceRecordId:'seed_med_01' },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', category:'EMPLOYMENT', scope:'MSA', msaId:'indianapolis', magnitudeScore:3, announcedDate:'2015-12-01', materializationDate:'2017-06-01', name:'Carrier Indianapolis Layoffs',   sourceRecordId:'seed_med_02' },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', category:'EMPLOYMENT', scope:'MSA', msaId:'youngstown-oh', magnitudeScore:5, announcedDate:'2018-11-26', materializationDate:'2019-03-01', name:'GM Lordstown Plant Closure',    sourceRecordId:'seed_med_03' },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', category:'EMPLOYMENT', scope:'MSA', msaId:'seattle',    magnitudeScore:4, announcedDate:'2020-06-01', materializationDate:'2021-01-01', name:'Boeing Everett Production Cut',   sourceRecordId:'seed_med_04' },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', category:'EMPLOYMENT', scope:'MSA', msaId:'san-francisco', magnitudeScore:4, announcedDate:'2012-01-01', materializationDate:'2014-01-01', name:'HP Palo Alto Headquarters Spin', sourceRecordId:'seed_med_05' },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', category:'EMPLOYMENT', scope:'MSA', msaId:'new-york',   magnitudeScore:3, announcedDate:'2019-01-01', materializationDate:'2020-01-01', name:'Goldman Sachs Hoboken Exit',     sourceRecordId:'seed_med_06' },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', category:'EMPLOYMENT', scope:'MSA', msaId:'new-york',   magnitudeScore:3, announcedDate:'2019-06-01', materializationDate:'2021-01-01', name:'Capital One Stamford Downsizing', sourceRecordId:'seed_med_07' },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', category:'EMPLOYMENT', scope:'MSA', msaId:'chicago',    magnitudeScore:3, announcedDate:'2021-06-01', materializationDate:'2022-06-01', name:'Citadel Chicago Departure',      sourceRecordId:'seed_med_08' },
    { subtype:'MAJOR_EMPLOYER_DEPARTURE', category:'EMPLOYMENT', scope:'MSA', msaId:'detroit',    magnitudeScore:4, announcedDate:'2008-01-01', materializationDate:'2009-06-01', name:'GM Detroit Production Curtail',  sourceRecordId:'seed_med_09' },

    // ── STR_REGULATION_BAN (8 analogs) ───────────────────────────────────────
    { subtype:'STR_REGULATION_BAN', category:'REGULATORY_POLICY', scope:'MSA', msaId:'new-york', magnitudeScore:4, announcedDate:'2023-07-01', materializationDate:'2023-09-05', name:'NYC Local Law 18 STR Enforcement', sourceRecordId:'seed_str_01' },
    { subtype:'STR_REGULATION_BAN', category:'REGULATORY_POLICY', scope:'MSA', msaId:'san-francisco', magnitudeScore:3, announcedDate:'2015-01-01', materializationDate:'2015-02-01', name:'SF STR Primary Resident Rule', sourceRecordId:'seed_str_02' },
    { subtype:'STR_REGULATION_BAN', category:'REGULATORY_POLICY', scope:'MSA', msaId:'los-angeles', magnitudeScore:3, announcedDate:'2015-06-01', materializationDate:'2015-09-01', name:'Santa Monica 30-Day Minimum', sourceRecordId:'seed_str_03' },
    { subtype:'STR_REGULATION_BAN', category:'REGULATORY_POLICY', scope:'MSA', msaId:'new-orleans', magnitudeScore:3, announcedDate:'2019-01-01', materializationDate:'2019-04-01', name:'New Orleans STR Owner-Occupant', sourceRecordId:'seed_str_04' },
    { subtype:'STR_REGULATION_BAN', category:'REGULATORY_POLICY', scope:'MSA', msaId:'nashville', magnitudeScore:3, announcedDate:'2022-01-01', materializationDate:'2022-07-01', name:'Nashville STR License Cap',      sourceRecordId:'seed_str_05' },
    { subtype:'STR_REGULATION_BAN', category:'REGULATORY_POLICY', scope:'MSA', msaId:'austin',    magnitudeScore:2, announcedDate:'2016-01-01', materializationDate:'2016-04-01', name:'Austin STR Operator Permit',     sourceRecordId:'seed_str_06' },
    { subtype:'STR_REGULATION_BAN', category:'REGULATORY_POLICY', scope:'MSA', msaId:'denver',    magnitudeScore:2, announcedDate:'2016-07-01', materializationDate:'2017-01-01', name:'Denver STR Primary Home Rule',   sourceRecordId:'seed_str_07' },
    { subtype:'STR_REGULATION_BAN', category:'REGULATORY_POLICY', scope:'MSA', msaId:'miami',     magnitudeScore:3, announcedDate:'2018-01-01', materializationDate:'2018-06-01', name:'Miami Beach STR Zone Limits',    sourceRecordId:'seed_str_08' },

    // ── ZONING_UPZONE (7 analogs) ─────────────────────────────────────────────
    { subtype:'ZONING_UPZONE', category:'REGULATORY_POLICY', scope:'MSA', msaId:'minneapolis', magnitudeScore:3, announcedDate:'2018-12-01', materializationDate:'2019-12-01', name:'Minneapolis 2040 Plan',          sourceRecordId:'seed_zu_01' },
    { subtype:'ZONING_UPZONE', category:'REGULATORY_POLICY', scope:'MSA', msaId:'seattle',    magnitudeScore:3, announcedDate:'2017-01-01', materializationDate:'2019-03-01', name:'Seattle MHA Upzone',             sourceRecordId:'seed_zu_02' },
    { subtype:'ZONING_UPZONE', category:'REGULATORY_POLICY', scope:'MSA', msaId:'austin',     magnitudeScore:3, announcedDate:'2019-01-01', materializationDate:'2023-11-01', name:'Austin Land Development Code',  sourceRecordId:'seed_zu_03' },
    { subtype:'ZONING_UPZONE', category:'REGULATORY_POLICY', scope:'MSA', msaId:'portland-or', magnitudeScore:2, announcedDate:'2020-01-01', materializationDate:'2021-01-01', name:'Portland Commercial Conversion', sourceRecordId:'seed_zu_04' },
    { subtype:'ZONING_UPZONE', category:'REGULATORY_POLICY', scope:'MSA', msaId:'denver',     magnitudeScore:2, announcedDate:'2019-01-01', materializationDate:'2020-01-01', name:'Denver Transit Corridor Upzone', sourceRecordId:'seed_zu_05' },
    { subtype:'ZONING_UPZONE', category:'REGULATORY_POLICY', scope:'MSA', msaId:'salt-lake-city', magnitudeScore:2, announcedDate:'2021-01-01', materializationDate:'2021-12-01', name:'Salt Lake City ADU Expansion', sourceRecordId:'seed_zu_06' },
    { subtype:'ZONING_UPZONE', category:'REGULATORY_POLICY', scope:'MSA', msaId:'raleigh-nc', magnitudeScore:2, announcedDate:'2022-01-01', materializationDate:'2023-01-01', name:'Raleigh Missing Middle Zoning',   sourceRecordId:'seed_zu_07' },

    // ── HURRICANE_NAMED_STORM (12 analogs) ───────────────────────────────────
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'new-orleans', magnitudeScore:5, announcedDate:'2005-08-29', materializationDate:'2005-08-29', name:'Hurricane Katrina',    sourceRecordId:'seed_hns_01' },
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'houston',     magnitudeScore:5, announcedDate:'2017-08-25', materializationDate:'2017-08-25', name:'Hurricane Harvey',      sourceRecordId:'seed_hns_02' },
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'miami',       magnitudeScore:5, announcedDate:'2017-09-10', materializationDate:'2017-09-10', name:'Hurricane Irma',        sourceRecordId:'seed_hns_03' },
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'tallahassee', magnitudeScore:5, announcedDate:'2018-10-10', materializationDate:'2018-10-10', name:'Hurricane Michael',     sourceRecordId:'seed_hns_04' },
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'raleigh-nc',  magnitudeScore:4, announcedDate:'2018-09-14', materializationDate:'2018-09-14', name:'Hurricane Florence',    sourceRecordId:'seed_hns_05' },
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'jacksonville-fl', magnitudeScore:3, announcedDate:'2019-09-01', materializationDate:'2019-09-01', name:'Hurricane Dorian', sourceRecordId:'seed_hns_06' },
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'raleigh-nc',  magnitudeScore:3, announcedDate:'2020-08-04', materializationDate:'2020-08-04', name:'Hurricane Isaias',     sourceRecordId:'seed_hns_07' },
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'new-orleans', magnitudeScore:5, announcedDate:'2021-08-29', materializationDate:'2021-08-29', name:'Hurricane Ida',         sourceRecordId:'seed_hns_08' },
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'fort-lauderdale', magnitudeScore:5, announcedDate:'2022-09-28', materializationDate:'2022-09-28', name:'Hurricane Ian',     sourceRecordId:'seed_hns_09' },
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'fort-lauderdale', magnitudeScore:3, announcedDate:'2022-11-09', materializationDate:'2022-11-09', name:'Hurricane Nicole',  sourceRecordId:'seed_hns_10' },
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'jacksonville-fl', magnitudeScore:4, announcedDate:'2023-08-30', materializationDate:'2023-08-30', name:'Hurricane Idalia', sourceRecordId:'seed_hns_11' },
    { subtype:'HURRICANE_NAMED_STORM', category:'DISASTER_DISRUPTION', scope:'MSA', msaId:'orlando',     magnitudeScore:5, announcedDate:'2004-08-13', materializationDate:'2004-08-13', name:'Hurricane Charley FL',  sourceRecordId:'seed_hns_12' },

    // ── PLANT_OPENING (8 analogs) ─────────────────────────────────────────────
    { subtype:'PLANT_OPENING', category:'EMPLOYMENT', scope:'MSA', msaId:'chattanooga',   magnitudeScore:4, announcedDate:'2008-07-01', materializationDate:'2011-05-23', name:'Volkswagen Chattanooga Plant',   sourceRecordId:'seed_po_01' },
    { subtype:'PLANT_OPENING', category:'EMPLOYMENT', scope:'MSA', msaId:'greenville-sc', magnitudeScore:3, announcedDate:'2014-01-01', materializationDate:'2016-06-01', name:'BMW Spartanburg Expansion',      sourceRecordId:'seed_po_02' },
    { subtype:'PLANT_OPENING', category:'EMPLOYMENT', scope:'MSA', msaId:'lexington-ky',  magnitudeScore:3, announcedDate:'2015-01-01', materializationDate:'2017-01-01', name:'Toyota Georgetown Expansion',    sourceRecordId:'seed_po_03' },
    { subtype:'PLANT_OPENING', category:'EMPLOYMENT', scope:'MSA', msaId:'columbus-oh',   magnitudeScore:3, announcedDate:'2019-01-01', materializationDate:'2021-01-01', name:'Honda Ohio Plant Expansion',     sourceRecordId:'seed_po_04' },
    { subtype:'PLANT_OPENING', category:'EMPLOYMENT', scope:'MSA', msaId:'nashville',     magnitudeScore:3, announcedDate:'2018-01-01', materializationDate:'2021-01-01', name:'Nucor Steel Gallatin TN',        sourceRecordId:'seed_po_05' },
    { subtype:'PLANT_OPENING', category:'EMPLOYMENT', scope:'MSA', msaId:'austin',        magnitudeScore:5, announcedDate:'2021-11-01', materializationDate:'2024-01-01', name:'Samsung Advanced Logic Fab',     sourceRecordId:'seed_po_06' },
    { subtype:'PLANT_OPENING', category:'EMPLOYMENT', scope:'MSA', msaId:'phoenix',       magnitudeScore:5, announcedDate:'2020-05-01', materializationDate:'2024-01-01', name:'TSMC Phoenix Wafer Fab',         sourceRecordId:'seed_po_07' },
    { subtype:'PLANT_OPENING', category:'EMPLOYMENT', scope:'MSA', msaId:'chicago',       magnitudeScore:4, announcedDate:'2018-01-01', materializationDate:'2021-07-01', name:'Rivian Normal IL EV Plant',      sourceRecordId:'seed_po_08' },

    // ── RENT_CONTROL_ENACTED (6 analogs) ─────────────────────────────────────
    { subtype:'RENT_CONTROL_ENACTED', category:'REGULATORY_POLICY', scope:'MSA', msaId:'portland-or', magnitudeScore:3, announcedDate:'2019-02-01', materializationDate:'2019-02-27', name:'Oregon Statewide Rent Control',  sourceRecordId:'seed_rce_01' },
    { subtype:'RENT_CONTROL_ENACTED', category:'REGULATORY_POLICY', scope:'MSA', msaId:'denver',      magnitudeScore:2, announcedDate:'2021-01-01', materializationDate:'2022-01-01', name:'Colorado Local Rent Stabilization', sourceRecordId:'seed_rce_02' },
    { subtype:'RENT_CONTROL_ENACTED', category:'REGULATORY_POLICY', scope:'MSA', msaId:'minneapolis', magnitudeScore:3, announcedDate:'2021-11-02', materializationDate:'2022-05-01', name:'St Paul MN Rent Control',        sourceRecordId:'seed_rce_03' },
    { subtype:'RENT_CONTROL_ENACTED', category:'REGULATORY_POLICY', scope:'MSA', msaId:'los-angeles', magnitudeScore:3, announcedDate:'2019-09-01', materializationDate:'2020-01-01', name:'California AB 1482 Rent Cap',    sourceRecordId:'seed_rce_04' },
    { subtype:'RENT_CONTROL_ENACTED', category:'REGULATORY_POLICY', scope:'MSA', msaId:'new-york',    magnitudeScore:3, announcedDate:'2023-04-01', materializationDate:'2024-04-20', name:'NYC Good Cause Eviction',        sourceRecordId:'seed_rce_05' },
    { subtype:'RENT_CONTROL_ENACTED', category:'REGULATORY_POLICY', scope:'MSA', msaId:'washington',  magnitudeScore:2, announcedDate:'2020-03-01', materializationDate:'2020-07-01', name:'DC Rent Increase Freeze',        sourceRecordId:'seed_rce_06' },
  ];

  // ── Deterministic jitter: distribute N events evenly around the benchmark median ──
  function jitterDelta(median: number, halfSpread: number, idx: number, n: number): number {
    if (n <= 1) return median;
    const t = idx / (n - 1);         // 0 → 1 across the N events
    return median + (t - 0.5) * 2 * halfSpread;
  }

  let seeded = 0;
  let skipped = 0;
  const subtypesAffected = new Set<string>();

  // Group events by subtype for count-based jitter
  const bySubtype: Record<string, typeof seedEvents> = {};
  for (const ev of seedEvents) {
    (bySubtype[ev.subtype] = bySubtype[ev.subtype] ?? []).push(ev);
  }

  for (const ev of seedEvents) {
    // 1) Upsert key_event (idempotent on source_record_id)
    const eventRes = await pool.query(`
      INSERT INTO key_events
        (category, subtype, name, scope, msa_id, magnitude_score,
         announced_date, materialization_date, status,
         is_verified, confidence, ingestion_source, source_record_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'materialized', true, 0.80, 'manual', $9)
      ON CONFLICT (source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING
      RETURNING id
    `, [ev.category, ev.subtype, ev.name, ev.scope, ev.msaId, ev.magnitudeScore,
        ev.announcedDate, ev.materializationDate, ev.sourceRecordId]);

    if (!eventRes.rows[0]) {
      skipped++;
      continue;
    }

    const eventId = eventRes.rows[0].id as string;
    const evGroup = bySubtype[ev.subtype];
    const evIdx = evGroup.indexOf(ev);
    const evN = evGroup.length;

    // 2) Insert event_impacts for each matching benchmark
    const subtypeBenchmarks = benchmarks.filter(b => b.subtype === ev.subtype);
    for (const bm of subtypeBenchmarks) {
      const attrDelta = jitterDelta(bm.median, bm.halfSpread, evIdx, evN);
      await pool.query(`
        INSERT INTO event_impacts
          (event_id, metric_key, geography_type, geography_id,
           window_months, measurement_date,
           delta, delta_pct, attributed_delta, attributed_delta_pct,
           did_confidence, data_quality)
        VALUES ($1, $2, 'msa', $3, $4, $5, $6, $7, $6, $7, $8, 'complete')
        ON CONFLICT (event_id, metric_key, geography_id, window_months)
        DO NOTHING
      `, [eventId, bm.metricKey, ev.msaId, bm.windowMonths,
          ev.materializationDate,
          attrDelta, attrDelta * 100,
          bm.confidence]);
    }

    subtypesAffected.add(ev.subtype);
    seeded++;
  }

  // 3) Aggregate all affected subtypes across every stratum combination.
  // aggregatePlaybook() returns early when a stratum has no qualifying events,
  // so empty combinations incur only a lightweight SELECT and no INSERT.
  const SEED_MSA_TIERS    = ['all', 'large', 'mid', 'small'] as const;
  const SEED_MAGNITUDES   = ['all', 'small', 'medium', 'large', 'transformative'] as const;
  const SEED_REGIMES      = ['all', 'pre_covid', 'post_covid'] as const;
  let strataCombinations  = 0;
  for (const subtype of subtypesAffected) {
    for (const msaTier of SEED_MSA_TIERS) {
      for (const magnitude of SEED_MAGNITUDES) {
        for (const regime of SEED_REGIMES) {
          await aggregatePlaybook(subtype, { msaTier, magnitude, regime });
          strataCombinations++;
        }
      }
    }
  }

  logger.info(`[M35 Playbook] Seed complete: ${seeded} events inserted, ${skipped} skipped; ${subtypesAffected.size} subtypes × ${strataCombinations} strata aggregated`);
  return { seeded, skipped };
}

// ─── Aggregate all subtypes (full rebuild) ────────────────────────────────────

export async function aggregateAllPlaybooks(): Promise<{ subtypes: string[]; rowsUpdated: number }> {
  const pool = getPool();
  const subtypes = await pool.query(
    `SELECT DISTINCT subtype FROM key_events WHERE subtype IS NOT NULL AND status = 'materialized'`,
  );
  let rowsUpdated = 0;
  const processed: string[] = [];
  for (const { subtype } of subtypes.rows) {
    await aggregatePlaybook(subtype, { msaTier: 'all', magnitude: 'all', regime: 'all' });
    rowsUpdated++;
    processed.push(subtype);
  }
  return { subtypes: processed, rowsUpdated };
}
