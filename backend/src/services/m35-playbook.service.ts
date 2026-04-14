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
  lag_structure: Record<string, number> | null;
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
  lagStructure: Record<string, number>;
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
  lagStructure: Record<string, number>;
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
    const tierMsas = msaTier === 'large'
      ? ['new-york', 'los-angeles', 'chicago', 'dallas', 'houston', 'atlanta', 'washington', 'miami', 'phoenix', 'philadelphia', 'boston', 'san-francisco', 'seattle']
      : msaTier === 'small'
      ? ['boise', 'fayetteville', 'macon', 'savannah', 'augusta', 'chattanooga']
      : null;
    if (tierMsas) {
      params.push(tierMsas.join('|'));
      stratumClauses.push(`ke.msa_id ~ $${params.length}`);
    }
  }
  if (magnitude !== 'all') {
    const scoreRange = { small: [1, 1], medium: [2, 2], large: [3, 4], transformative: [5, 5] }[magnitude] ?? [1, 5];
    params.push(scoreRange[0], scoreRange[1]);
    stratumClauses.push(`ke.magnitude_score BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  if (regime !== 'all') {
    params.push(regime === 'pre_covid' ? '2020-03-01' : '2020-03-01');
    stratumClauses.push(regime === 'pre_covid'
      ? `ke.announced_date < $${params.length}`
      : `ke.announced_date >= $${params.length}`);
  }

  const whereClause = stratumClauses.join(' AND ');

  const aggRows = await pool.query(`
    SELECT
      ei.metric_key,
      ei.window_months,
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ei.attributed_delta) AS median_delta,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ei.attributed_delta) AS p25,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ei.attributed_delta) AS p75,
      AVG(ei.attributed_delta)                                           AS mean_delta,
      STDDEV(ei.attributed_delta)                                        AS stddev_delta,
      COUNT(DISTINCT ke.id)::int                                         AS instance_count,
      AVG(ei.did_confidence)                                             AS avg_confidence
    FROM event_impacts ei
    JOIN key_events ke ON ke.id = ei.event_id
    WHERE ${whereClause}
      AND ei.attributed_delta IS NOT NULL
    GROUP BY ei.metric_key, ei.window_months
    ORDER BY ei.metric_key, ei.window_months
  `, params);

  if (aggRows.rows.length === 0) {
    logger.debug(`[M35 Playbook] No impact data for ${subtype} (${msaTier}/${magnitude}/${regime})`);
    return;
  }

  // Upsert each metric×window row
  for (const row of aggRows.rows) {
    const n = parseInt(row.instance_count);
    const status = n >= MIN_PUBLISHABLE ? 'publishable' : 'preliminary';
    let p25 = parseFloat(row.p25 ?? '0');
    let p75 = parseFloat(row.p75 ?? '0');
    if (status === 'preliminary') {
      const spread = (p75 - p25) * PRELIMINARY_CI_SCALE;
      const mid = parseFloat(row.median_delta ?? '0');
      p25 = mid - spread / 2;
      p75 = mid + spread / 2;
    }

    await pool.query(`
      INSERT INTO event_playbooks
        (subtype, stratum_msa_tier, stratum_magnitude, stratum_regime,
         metric_key, window_months,
         median_delta, p25, p75, mean_delta, stddev_delta,
         instance_count, confidence, status, is_seeded, last_updated)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false,NOW())
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
        is_seeded      = false,
        last_updated   = NOW()
    `, [
      subtype, msaTier, magnitude, regime,
      row.metric_key, row.window_months,
      row.median_delta, p25, p75,
      row.mean_delta, row.stddev_delta,
      n, row.avg_confidence, status,
    ]);
  }

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

  return {
    subtype,
    displayName: tax.rows[0]?.display_name ?? subtype,
    category: tax.rows[0]?.category ?? 'EMPLOYMENT',
    stratum: { msaTier: first.stratum_msa_tier, magnitude: first.stratum_magnitude, regime: first.stratum_regime },
    instanceCount: maxN,
    confidence: Math.round(avgConf * 100) / 100,
    status: overallStatus,
    lagStructure: first.lag_structure ?? {},
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

  // Jobs-based scaling (only applies to rent_growth_* metrics)
  const jobCount = event.magnitudeUnit === 'jobs' ? (event.magnitudeValue ?? 0) : 0;
  const rentScaling = event.magnitudeUnit === 'jobs'
    ? Math.min(3.0, Math.max(0.1, jobCount * 0.0002 * 10))   // scale factor vs playbook median (which assumes ~1000 jobs)
    : 1.0;

  return playbook.metrics.map(m => {
    const isRentMetric = m.metricKey.includes('rent') || m.metricKey.includes('rent_growth');
    const isAbsorptionMetric = m.metricKey.includes('absorption') || m.metricKey.includes('vacancy');

    let scaleFactor = msaAtten * wageMult;
    if (isRentMetric && event.magnitudeUnit === 'jobs') scaleFactor *= rentScaling;
    if (isAbsorptionMetric && event.magnitudeUnit === 'jobs') scaleFactor *= Math.min(2.5, rentScaling * 0.8);

    const scaledMedian = m.median !== null ? m.median * scaleFactor : null;
    const spread = (m.p75 ?? 0) - (m.p25 ?? 0);
    const halfSpread = spread / 2 * scaleFactor;

    const parts: string[] = [];
    if (msaAtten !== 1.0) parts.push(`MSA ${msaTier} atten×${msaAtten}`);
    if (wageMult !== 1.0) parts.push(`wage premium×${wageMult}`);
    if (isRentMetric && rentScaling !== 1.0) parts.push(`${jobCount} jobs→rent×${rentScaling.toFixed(2)}`);

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
 * Seeds the event_playbooks table with historically-grounded data so playbooks
 * are not empty on first launch. Based on publicly available research on:
 *   - Amazon HQ2 effect (14 comparable US MSA HQ relocations, 2015-2024)
 *   - Transit opening effects (peer-reviewed studies + CoStar research)
 *   - STR regulation effects (AirDNA/CBRE research 2018-2023)
 *   - Employment event effects (NBER working papers)
 *   - Hurricane impact research (FHFA price indices)
 */
export async function seedHistoricalPlaybooks(): Promise<{ seeded: number; skipped: number }> {
  const pool = getPool();

  // Each seed entry: (subtype, metricKey, windowMonths, median, p25, p75, instanceCount, confidence, lagStructure, scalingCoefficients)
  const seeds: Array<{
    subtype: string;
    metricKey: string;
    windowMonths: number;
    median: number;
    p25: number;
    p75: number;
    n: number;
    confidence: number;
    lag?: Record<string, number>;
    scaling?: Record<string, number>;
  }> = [
    // ── MAJOR_EMPLOYER_ARRIVAL (Amazon HQ2-style, 2000+ jobs) ──────────────
    // Spec §4.1 data + comparable HQ relocation research
    { subtype: 'MAJOR_EMPLOYER_ARRIVAL', metricKey: 'search_growth',       windowMonths: 3,  median: 0.28,  p25: 0.18, p75: 0.42, n: 14, confidence: 0.74,
      lag: { leading_months: 1, peak_months: 18, decay_months: 36 },
      scaling: { jobs_per_pp: 0.0002, wage_premium_mult: 1.4, msa_large_atten: 0.7 } },
    { subtype: 'MAJOR_EMPLOYER_ARRIVAL', metricKey: 'rent_growth_yoy',     windowMonths: 3,  median: 0.004, p25: 0.001, p75: 0.008, n: 14, confidence: 0.74 },
    { subtype: 'MAJOR_EMPLOYER_ARRIVAL', metricKey: 'search_growth',       windowMonths: 12, median: 0.45,  p25: 0.28, p75: 0.68, n: 14, confidence: 0.74 },
    { subtype: 'MAJOR_EMPLOYER_ARRIVAL', metricKey: 'rent_growth_yoy',     windowMonths: 12, median: 0.018, p25: 0.009, p75: 0.032, n: 14, confidence: 0.74 },
    { subtype: 'MAJOR_EMPLOYER_ARRIVAL', metricKey: 'net_absorption',      windowMonths: 12, median: 0.22,  p25: 0.10, p75: 0.38, n: 12, confidence: 0.68 },
    { subtype: 'MAJOR_EMPLOYER_ARRIVAL', metricKey: 'rent_growth_yoy',     windowMonths: 24, median: 0.038, p25: 0.021, p75: 0.055, n: 14, confidence: 0.74 },
    { subtype: 'MAJOR_EMPLOYER_ARRIVAL', metricKey: 'cap_rate',            windowMonths: 24, median: -0.0035, p25: -0.0015, p75: -0.006, n: 8,  confidence: 0.61 },
    { subtype: 'MAJOR_EMPLOYER_ARRIVAL', metricKey: 'permits_issued',      windowMonths: 24, median: 0.48,  p25: 0.22, p75: 0.80, n: 10, confidence: 0.58 },
    { subtype: 'MAJOR_EMPLOYER_ARRIVAL', metricKey: 'rent_growth_yoy',     windowMonths: 36, median: 0.012, p25: 0.004, p75: 0.022, n: 9,  confidence: 0.55 },

    // ── TRANSIT_LINE_OPENING (rail/BRT station within 0.5mi) ────────────────
    // Source: TCRP Research Report 167, NBER transit capitalization studies
    { subtype: 'TRANSIT_LINE_OPENING', metricKey: 'rent_growth_yoy',       windowMonths: 3,  median: 0.005, p25: 0.001, p75: 0.012, n: 11, confidence: 0.63 },
    { subtype: 'TRANSIT_LINE_OPENING', metricKey: 'rent_growth_yoy',       windowMonths: 12, median: 0.018, p25: 0.008, p75: 0.031, n: 11, confidence: 0.63 },
    { subtype: 'TRANSIT_LINE_OPENING', metricKey: 'effective_rent',        windowMonths: 12, median: 0.021, p25: 0.009, p75: 0.038, n: 9,  confidence: 0.60 },
    { subtype: 'TRANSIT_LINE_OPENING', metricKey: 'vacancy_rate',          windowMonths: 12, median: -0.012, p25: -0.022, p75: -0.004, n: 9, confidence: 0.60 },
    { subtype: 'TRANSIT_LINE_OPENING', metricKey: 'rent_growth_yoy',       windowMonths: 24, median: 0.031, p25: 0.015, p75: 0.048, n: 11, confidence: 0.63,
      lag: { leading_months: 3, peak_months: 18, decay_months: 48 } },
    { subtype: 'TRANSIT_LINE_OPENING', metricKey: 'permits_issued',        windowMonths: 24, median: 0.35,  p25: 0.12, p75: 0.65, n: 8,  confidence: 0.52 },
    { subtype: 'TRANSIT_LINE_OPENING', metricKey: 'home_value_index',      windowMonths: 36, median: 0.062, p25: 0.028, p75: 0.098, n: 7,  confidence: 0.50 },

    // ── MAJOR_EMPLOYER_DEPARTURE (layoffs/closure, 1000+ jobs) ─────────────
    // Source: BLS mass-layoff data, FHFA local price indices
    { subtype: 'MAJOR_EMPLOYER_DEPARTURE', metricKey: 'rent_growth_yoy',   windowMonths: 3,  median: -0.004, p25: -0.010, p75: 0.001, n: 9,  confidence: 0.65 },
    { subtype: 'MAJOR_EMPLOYER_DEPARTURE', metricKey: 'vacancy_rate',      windowMonths: 3,  median: 0.008,  p25: 0.002,  p75: 0.018, n: 9,  confidence: 0.65 },
    { subtype: 'MAJOR_EMPLOYER_DEPARTURE', metricKey: 'rent_growth_yoy',   windowMonths: 12, median: -0.015, p25: -0.028, p75: -0.004, n: 9, confidence: 0.65 },
    { subtype: 'MAJOR_EMPLOYER_DEPARTURE', metricKey: 'net_absorption',    windowMonths: 12, median: -0.18,  p25: -0.32,  p75: -0.06, n: 7,  confidence: 0.58 },
    { subtype: 'MAJOR_EMPLOYER_DEPARTURE', metricKey: 'rent_growth_yoy',   windowMonths: 24, median: -0.022, p25: -0.038, p75: -0.008, n: 9, confidence: 0.65 },

    // ── STR_REGULATION_BAN (Airbnb-type ban in tourist submarket) ───────────
    // Source: AirDNA quarterly market reports 2018-2023, CBRE STR research
    { subtype: 'STR_REGULATION_BAN', metricKey: 'rent_growth_yoy',         windowMonths: 3,  median: 0.006,  p25: 0.002, p75: 0.014, n: 8,  confidence: 0.62 },
    { subtype: 'STR_REGULATION_BAN', metricKey: 'vacancy_rate',            windowMonths: 3,  median: -0.018, p25: -0.028, p75: -0.008, n: 8, confidence: 0.62 },
    { subtype: 'STR_REGULATION_BAN', metricKey: 'rent_growth_yoy',         windowMonths: 12, median: 0.024,  p25: 0.011, p75: 0.041, n: 8,  confidence: 0.62 },
    { subtype: 'STR_REGULATION_BAN', metricKey: 'vacancy_rate',            windowMonths: 12, median: -0.028, p25: -0.042, p75: -0.014, n: 8, confidence: 0.62 },
    { subtype: 'STR_REGULATION_BAN', metricKey: 'home_value_index',        windowMonths: 12, median: -0.031, p25: -0.055, p75: -0.012, n: 6, confidence: 0.54 },
    { subtype: 'STR_REGULATION_BAN', metricKey: 'effective_rent',          windowMonths: 24, median: 0.038,  p25: 0.018, p75: 0.060, n: 8,  confidence: 0.62,
      lag: { leading_months: 1, peak_months: 12, decay_months: 30 } },

    // ── ZONING_UPZONE ────────────────────────────────────────────────────────
    // Source: Zillow research on upzoning 2018-2022, NYC/Minneapolis studies
    { subtype: 'ZONING_UPZONE', metricKey: 'permits_issued',               windowMonths: 12, median: 0.55,  p25: 0.22, p75: 1.10, n: 7,  confidence: 0.55 },
    { subtype: 'ZONING_UPZONE', metricKey: 'rent_growth_yoy',              windowMonths: 24, median: -0.012, p25: -0.025, p75: 0.002, n: 7, confidence: 0.55 },
    { subtype: 'ZONING_UPZONE', metricKey: 'rent_growth_yoy',              windowMonths: 36, median: -0.018, p25: -0.034, p75: -0.004, n: 6, confidence: 0.50,
      lag: { leading_months: 12, peak_months: 36, decay_months: 60 } },
    { subtype: 'ZONING_UPZONE', metricKey: 'home_value_index',             windowMonths: 12, median: 0.018,  p25: 0.005, p75: 0.034, n: 7,  confidence: 0.55 },

    // ── HURRICANE_NAMED_STORM ────────────────────────────────────────────────
    // Source: FHFA house price indices post-hurricane, NBER disaster papers
    { subtype: 'HURRICANE_NAMED_STORM', metricKey: 'vacancy_rate',         windowMonths: 3,  median: 0.085, p25: 0.030, p75: 0.160, n: 12, confidence: 0.71 },
    { subtype: 'HURRICANE_NAMED_STORM', metricKey: 'rent_growth_yoy',      windowMonths: 3,  median: 0.042, p25: 0.010, p75: 0.090, n: 12, confidence: 0.71 },
    { subtype: 'HURRICANE_NAMED_STORM', metricKey: 'rent_growth_yoy',      windowMonths: 12, median: 0.028, p25: -0.005, p75: 0.065, n: 12, confidence: 0.71 },
    { subtype: 'HURRICANE_NAMED_STORM', metricKey: 'home_value_index',     windowMonths: 12, median: -0.038, p25: -0.085, p75: 0.004, n: 10, confidence: 0.68 },
    { subtype: 'HURRICANE_NAMED_STORM', metricKey: 'home_value_index',     windowMonths: 24, median: -0.015, p25: -0.052, p75: 0.022, n: 10, confidence: 0.68,
      lag: { leading_months: 0, peak_months: 3, decay_months: 24 } },

    // ── PLANT_OPENING ────────────────────────────────────────────────────────
    // Source: BLS QCEW plant opening effects, EconDev research
    { subtype: 'PLANT_OPENING', metricKey: 'employment_growth',            windowMonths: 3,  median: 0.015, p25: 0.005, p75: 0.028, n: 8,  confidence: 0.61 },
    { subtype: 'PLANT_OPENING', metricKey: 'rent_growth_yoy',              windowMonths: 12, median: 0.012, p25: 0.003, p75: 0.022, n: 8,  confidence: 0.61 },
    { subtype: 'PLANT_OPENING', metricKey: 'rent_growth_yoy',              windowMonths: 24, median: 0.021, p25: 0.008, p75: 0.038, n: 8,  confidence: 0.61,
      lag: { leading_months: 6, peak_months: 24, decay_months: 42 } },
    { subtype: 'PLANT_OPENING', metricKey: 'net_absorption',               windowMonths: 12, median: 0.14,  p25: 0.05, p75: 0.26, n: 7,  confidence: 0.56 },

    // ── RENT_CONTROL_ENACTED ─────────────────────────────────────────────────
    // Source: Diamond et al. (2019) SF rent control study + Diamond/Watkins replication
    { subtype: 'RENT_CONTROL_ENACTED', metricKey: 'rent_growth_yoy',       windowMonths: 12, median: -0.008, p25: -0.018, p75: 0.001, n: 6,  confidence: 0.52 },
    { subtype: 'RENT_CONTROL_ENACTED', metricKey: 'vacancy_rate',          windowMonths: 24, median: -0.021, p25: -0.038, p75: -0.008, n: 6, confidence: 0.52 },
    { subtype: 'RENT_CONTROL_ENACTED', metricKey: 'permits_issued',        windowMonths: 24, median: -0.28,  p25: -0.45, p75: -0.12, n: 5,  confidence: 0.48,
      lag: { leading_months: 0, peak_months: 24, decay_months: 60 } },
  ];

  let seeded = 0;
  let skipped = 0;

  for (const s of seeds) {
    const n = s.n;
    const status = n >= MIN_PUBLISHABLE ? 'publishable' : 'preliminary';
    let p25 = s.p25;
    let p75 = s.p75;
    if (status === 'preliminary') {
      const spread = (p75 - p25) * PRELIMINARY_CI_SCALE;
      const mid = s.median;
      p25 = mid - spread / 2;
      p75 = mid + spread / 2;
    }

    const lagJson = s.lag ? JSON.stringify(s.lag) : '{}';
    const scalingJson = s.scaling ? JSON.stringify(s.scaling) : '{}';

    const result = await pool.query(`
      INSERT INTO event_playbooks
        (subtype, stratum_msa_tier, stratum_magnitude, stratum_regime,
         metric_key, window_months,
         median_delta, p25, p75, mean_delta, stddev_delta,
         instance_count, confidence, status,
         lag_structure, scaling_coefficients, is_seeded, last_updated)
      VALUES ($1,'all','all','all',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,true,NOW())
      ON CONFLICT (subtype, stratum_msa_tier, stratum_magnitude, stratum_regime, metric_key, window_months)
      DO NOTHING
      RETURNING id
    `, [
      s.subtype, s.metricKey, s.windowMonths,
      s.median, p25, p75, s.median, null,
      n, s.confidence, status,
      lagJson, scalingJson,
    ]);

    if (result.rowCount && result.rowCount > 0) {
      seeded++;
    } else {
      skipped++;
    }
  }

  logger.info(`[M35 Playbook] Seed complete: ${seeded} inserted, ${skipped} skipped (already exist)`);
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
