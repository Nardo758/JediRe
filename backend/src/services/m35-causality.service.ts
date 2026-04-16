/**
 * M35 Event Causality Analysis Service
 *
 * Answers the core question:
 *   "Did this event drive the traffic/market uptick, or did the market
 *    uptick happen first and attract the event (announcement)?"
 *
 * Algorithm:
 *   1. Pull metric_time_series for the event's geography (monthly, T-24 to T+24)
 *   2. Create an event-indicator step function: 0 before announced_date, 1 after
 *   3. Sweep lags -12 to +12 months computing Pearson r at each offset
 *   4. Best positive lag → event leads metric → "event drives market"
 *   5. Best negative lag → metric leads event → "market attracts event"
 *   6. Compute pre-event OLS slope to detect "was market already accelerating?"
 *   7. Compute post-event delta vs extrapolated trend (inflection test)
 *   8. Persist to event_causality_results for caching
 *
 * Human-readable verdicts are generated from the combination of lag direction,
 * pre-event trend, and post-event delta magnitude.
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { METRIC_SOURCE_MAP } from './m35-impact.service';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CausalityDirection =
  | 'event_drives_market'
  | 'market_attracts_event'
  | 'simultaneous'
  | 'bidirectional'
  | 'insufficient_data';

export interface MetricCausality {
  metricKey: string;
  metricLabel: string;
  direction: CausalityDirection;
  leadLagMonths: number;    // positive = event leads metric, negative = metric leads
  r: number;
  pValue: number | null;
  sampleSize: number;
  preEventSlope: number;    // OLS slope of metric in T-12 before event
  preEventAccelerating: boolean;
  postEventDelta: number;   // metric change at T+12 vs extrapolated trend
  postEventDeltaPct: number;
  confidence: 'high' | 'medium' | 'low';
  verdictText: string;
}

export interface EventCausalityReport {
  eventId: string;
  eventName: string;
  eventCategory: string;
  eventStatus: string;
  announcedDate: string | null;
  materializationDate: string | null;
  geographyId: string;
  metrics: MetricCausality[];
  overallDirection: CausalityDirection;
  overallVerdictText: string;
  dominantLeadLagMonths: number;
  computedAt: string;
  fromCache: boolean;
}

export interface MSACausalityReport {
  msaId: string;
  events: Array<{
    eventId: string;
    eventName: string;
    eventCategory: string;
    direction: CausalityDirection;
    leadLagMonths: number;
    confidence: 'high' | 'medium' | 'low';
    keyMetric: string;
    verdictText: string;
    announcedDate: string | null;
  }>;
  summary: {
    totalEvents: number;
    eventsDriveMarket: number;
    marketAttractsEvents: number;
    simultaneous: number;
    insufficientData: number;
    avgLeadLagMonths: number;
    dominantPattern: string;
  };
  computedAt: string;
}

// ─── Core Metrics to Test for Causality ────────────────────────────────────────

const CAUSALITY_METRICS = [
  { key: 'rent_index_yoy',          label: 'Rent Growth YoY' },
  { key: 'search_growth',           label: 'Search Momentum' },
  { key: 'net_absorption',          label: 'Net Absorption' },
  { key: 'employment_growth',       label: 'Employment Growth' },
  { key: 'traffic_growth',          label: 'Traffic Growth' },
];

// ─── Statistical Helpers ───────────────────────────────────────────────────────

function pearsonR(x: number[], y: number[]): { r: number; n: number } {
  const n = Math.min(x.length, y.length);
  if (n < 5) return { r: 0, n };
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }
  if (sumX2 === 0 || sumY2 === 0) return { r: 0, n };
  return { r: sumXY / Math.sqrt(sumX2 * sumY2), n };
}

function approximatePValue(r: number, n: number): number | null {
  if (n < 5) return null;
  const t = r * Math.sqrt((n - 2) / (1 - r * r + 1e-10));
  const df = n - 2;
  // Two-tailed p-value approximation via incomplete beta
  const x = df / (df + t * t);
  const p = incompleteBeta(df / 2, 0.5, x);
  return Math.min(1, Math.max(0, p));
}

function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let sum = 0, term = 1;
  for (let k = 0; k < 200; k++) {
    if (k > 0) { term *= (a + k - 1) * x / k / (a + b + k - 1); }
    const inc = term / (a + k);
    sum += inc;
    if (Math.abs(inc) < 1e-10) break;
  }
  const lg = logGamma(a + b) - logGamma(a) - logGamma(b);
  return Math.exp(lg + a * Math.log(x) + b * Math.log(1 - x)) * sum;
}

function logGamma(z: number): number {
  const c = [76.18009172947146,-86.50532032941677,24.01409824083091,
             -1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
  let x = z - 1;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const co of c) { x += 1; ser += co / x; }
  return -tmp + Math.log(2.5066282746310005 * ser);
}

function olsSlope(x: number[], y: number[]): { slope: number; r2: number } {
  const n = x.length;
  if (n < 3) return { slope: 0, r2: 0 };
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let sXY = 0, sXX = 0, sYY = 0;
  for (let i = 0; i < n; i++) {
    sXY += (x[i] - meanX) * (y[i] - meanY);
    sXX += (x[i] - meanX) ** 2;
    sYY += (y[i] - meanY) ** 2;
  }
  const slope = sXX === 0 ? 0 : sXY / sXX;
  const r2 = sYY === 0 ? 0 : (sXY ** 2) / (sXX * sYY);
  return { slope, r2 };
}

// ─── Verdict Text Generator ────────────────────────────────────────────────────

function buildVerdictText(
  eventName: string,
  metricLabel: string,
  direction: CausalityDirection,
  leadLagMonths: number,
  preEventAccelerating: boolean,
  postEventDeltaPct: number,
  r: number
): string {
  const absLag = Math.abs(leadLagMonths);
  const rStr = r.toFixed(2);
  const deltaStr = postEventDeltaPct >= 0
    ? `+${postEventDeltaPct.toFixed(1)}%`
    : `${postEventDeltaPct.toFixed(1)}%`;

  if (direction === 'event_drives_market') {
    const preStr = preEventAccelerating
      ? ' (market was already accelerating slightly)'
      : ' (market showed no acceleration beforehand)';
    return `"${eventName}" announcement preceded ${metricLabel} uptick by ~${absLag} month${absLag !== 1 ? 's' : ''} (r=${rStr}). Post-event delta: ${deltaStr}${preStr}. Signal: event is a leading demand catalyst.`;
  }
  if (direction === 'market_attracts_event') {
    return `${metricLabel} strengthened ~${absLag} month${absLag !== 1 ? 's' : ''} before "${eventName}" was announced (r=${rStr}). The market was already improving — the event may be a response to, or confirmation of, existing momentum. Post-event delta: ${deltaStr}.`;
  }
  if (direction === 'simultaneous') {
    return `"${eventName}" and ${metricLabel} movement are largely coincident (lag ≈ ${absLag} mo, r=${rStr}). Likely mutual causation or a common underlying driver. Post-event delta: ${deltaStr}.`;
  }
  if (direction === 'bidirectional') {
    return `Both directions show signal: market appears sensitive to "${eventName}" (r=${rStr}) and the event may have been attracted by market strength. Treat as mutually reinforcing.`;
  }
  return `Insufficient time-series data to determine causality between "${eventName}" and ${metricLabel} (n < 8 months, r=${rStr}).`;
}

function buildOverallVerdict(metrics: MetricCausality[], eventName: string): { direction: CausalityDirection; text: string; dominantLag: number } {
  const validMetrics = metrics.filter(m => m.direction !== 'insufficient_data' && Math.abs(m.r) >= 0.3);
  if (validMetrics.length === 0) {
    return { direction: 'insufficient_data', text: `No significant correlation found between "${eventName}" and market metrics. Either the event is too recent, data coverage is insufficient, or the effect is localized beyond available granularity.`, dominantLag: 0 };
  }

  const drives = validMetrics.filter(m => m.direction === 'event_drives_market').length;
  const attracts = validMetrics.filter(m => m.direction === 'market_attracts_event').length;
  const both = validMetrics.filter(m => m.direction === 'bidirectional').length;

  const avgLag = validMetrics.reduce((s, m) => s + m.leadLagMonths, 0) / validMetrics.length;
  const dominantLag = Math.round(avgLag);

  if (drives > attracts && drives > 0) {
    return {
      direction: 'event_drives_market',
      text: `"${eventName}" is a leading demand catalyst. Across ${drives}/${validMetrics.length} tested metrics, event announcement preceded market improvement by an average of ${Math.round(avgLag)} months. This event likely causes the uptick — not the other way around.`,
      dominantLag
    };
  }
  if (attracts > drives && attracts > 0) {
    return {
      direction: 'market_attracts_event',
      text: `Market momentum preceded "${eventName}" announcement by an average of ${Math.abs(Math.round(avgLag))} months. The market was already improving across ${attracts}/${validMetrics.length} metrics before the event was announced. This event may be a lagging confirmation of existing strength — not the root cause.`,
      dominantLag
    };
  }
  if (both > 0 || (drives > 0 && attracts > 0)) {
    return {
      direction: 'bidirectional',
      text: `"${eventName}" shows mutual causation with market metrics — some measures respond to the event while others show prior momentum. This pattern typically indicates the event is both attracted by market strength AND reinforces it further. Treat as a self-reinforcing dynamic.`,
      dominantLag
    };
  }
  return {
    direction: 'simultaneous',
    text: `"${eventName}" and market movements are largely contemporaneous — no clear lead-lag structure identified. Could reflect rapid repricing to a well-known event, or simultaneous response to a common macro driver.`,
    dominantLag
  };
}

// ─── Main Service Class ────────────────────────────────────────────────────────

export class M35CausalityService {
  private pool = getPool();

  /**
   * Analyze causality for a single event across all key metrics.
   * Checks cache first; computes fresh if stale or missing.
   */
  async analyzeEventCausality(eventId: string, forceRefresh = false): Promise<EventCausalityReport> {
    const pool = this.pool;

    // ── Fetch event metadata ───────────────────────────────────────────────────
    const evRes = await pool.query(`
      SELECT
        ke.id, ke.name, ke.category, ke.status,
        ke.announced_date, ke.materialization_date,
        ke.msa_id, ke.submarket_id,
        ke.lat, ke.lng,
        ke.magnitude_score
      FROM key_events ke
      WHERE ke.id = $1
    `, [eventId]);

    if (evRes.rows.length === 0) {
      throw new Error(`Event ${eventId} not found`);
    }
    const ev = evRes.rows[0];

    const geographyId = ev.submarket_id || ev.msa_id || 'unknown';
    const refDate: Date = ev.announced_date
      ? new Date(ev.announced_date)
      : ev.materialization_date
        ? new Date(ev.materialization_date)
        : new Date();

    // ── Check cache (skip if < 7 days old) ────────────────────────────────────
    if (!forceRefresh) {
      const cacheRes = await pool.query(`
        SELECT *
        FROM event_causality_results
        WHERE event_id = $1
          AND geography_id = $2
          AND computed_at > NOW() - INTERVAL '7 days'
        ORDER BY computed_at DESC
      `, [eventId, geographyId]);

      if (cacheRes.rows.length >= CAUSALITY_METRICS.length) {
        const metrics = cacheRes.rows.map(row => this.rowToMetricCausality(row));
        const { direction, text, dominantLag } = buildOverallVerdict(metrics, ev.name);
        return {
          eventId: ev.id,
          eventName: ev.name,
          eventCategory: ev.category,
          eventStatus: ev.status,
          announcedDate: ev.announced_date,
          materializationDate: ev.materialization_date,
          geographyId,
          metrics,
          overallDirection: direction,
          overallVerdictText: text,
          dominantLeadLagMonths: dominantLag,
          computedAt: cacheRes.rows[0].computed_at,
          fromCache: true,
        };
      }
    }

    // ── Compute fresh for each metric ──────────────────────────────────────────
    const metrics = await Promise.all(
      CAUSALITY_METRICS.map(m => this.analyzeMetricCausality(ev, geographyId, refDate, m.key, m.label))
    );

    // ── Persist to cache ───────────────────────────────────────────────────────
    for (const m of metrics) {
      await pool.query(`
        INSERT INTO event_causality_results (
          event_id, metric_key, geography_id,
          best_lag_months, best_r, p_value, sample_size,
          pre_event_slope, pre_event_r2,
          post_event_delta, post_event_delta_pct,
          direction, confidence, verdict_text,
          computed_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
        ON CONFLICT (event_id, metric_key, geography_id)
        DO UPDATE SET
          best_lag_months = EXCLUDED.best_lag_months,
          best_r = EXCLUDED.best_r,
          p_value = EXCLUDED.p_value,
          sample_size = EXCLUDED.sample_size,
          pre_event_slope = EXCLUDED.pre_event_slope,
          post_event_delta = EXCLUDED.post_event_delta,
          post_event_delta_pct = EXCLUDED.post_event_delta_pct,
          direction = EXCLUDED.direction,
          confidence = EXCLUDED.confidence,
          verdict_text = EXCLUDED.verdict_text,
          computed_at = NOW()
      `, [
        eventId, m.metricKey, geographyId,
        m.leadLagMonths, m.r, m.pValue, m.sampleSize,
        m.preEventSlope, null,
        m.postEventDelta, m.postEventDeltaPct,
        m.direction, m.confidence, m.verdictText
      ]);
    }

    const { direction, text, dominantLag } = buildOverallVerdict(metrics, ev.name);
    logger.info(`[M35 Causality] Computed causality for event ${ev.name}: ${direction} (lag=${dominantLag}mo)`);

    return {
      eventId: ev.id,
      eventName: ev.name,
      eventCategory: ev.category,
      eventStatus: ev.status,
      announcedDate: ev.announced_date,
      materializationDate: ev.materialization_date,
      geographyId,
      metrics,
      overallDirection: direction,
      overallVerdictText: text,
      dominantLeadLagMonths: dominantLag,
      computedAt: new Date().toISOString(),
      fromCache: false,
    };
  }

  /**
   * Analyze causality for all events in an MSA, returning a summary report.
   */
  async analyzeMSACausality(msaId: string): Promise<MSACausalityReport> {
    const pool = this.pool;

    // Pull all non-draft events for the MSA
    const eventsRes = await pool.query(`
      SELECT id, name, category, announced_date
      FROM key_events
      WHERE msa_id = $1
        AND status NOT IN ('draft', 'cancelled')
      ORDER BY announced_date DESC NULLS LAST
      LIMIT 20
    `, [msaId]);

    const events: MSACausalityReport['events'] = [];

    for (const ev of eventsRes.rows) {
      try {
        const report = await this.analyzeEventCausality(ev.id);
        // Find the metric with the strongest signal
        const best = report.metrics
          .filter(m => m.direction !== 'insufficient_data')
          .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
        events.push({
          eventId: ev.id,
          eventName: ev.name,
          eventCategory: ev.category,
          direction: report.overallDirection,
          leadLagMonths: report.dominantLeadLagMonths,
          confidence: best?.confidence || 'low',
          keyMetric: best?.metricLabel || '—',
          verdictText: report.overallVerdictText,
          announcedDate: ev.announced_date,
        });
      } catch (err) {
        logger.warn(`[M35 Causality] Could not analyze event ${ev.id}: ${err}`);
      }
    }

    // ── Summary stats ─────────────────────────────────────────────────────────
    const validEvents = events.filter(e => e.direction !== 'insufficient_data');
    const drives = events.filter(e => e.direction === 'event_drives_market').length;
    const attracts = events.filter(e => e.direction === 'market_attracts_event').length;
    const simul = events.filter(e => e.direction === 'simultaneous' || e.direction === 'bidirectional').length;
    const insufficient = events.filter(e => e.direction === 'insufficient_data').length;

    const avgLag = validEvents.length > 0
      ? validEvents.reduce((s, e) => s + e.leadLagMonths, 0) / validEvents.length
      : 0;

    const dominantPattern =
      drives > attracts && drives > simul ? 'Events are leading market catalysts' :
      attracts > drives && attracts > simul ? 'Market momentum precedes event announcements' :
      simul > 0 ? 'Mixed or simultaneous causation' :
      'Insufficient data across events';

    return {
      msaId,
      events,
      summary: {
        totalEvents: events.length,
        eventsDriveMarket: drives,
        marketAttractsEvents: attracts,
        simultaneous: simul,
        insufficientData: insufficient,
        avgLeadLagMonths: Math.round(avgLag * 10) / 10,
        dominantPattern,
      },
      computedAt: new Date().toISOString(),
    };
  }

  // ── Private: Per-metric lead-lag sweep ──────────────────────────────────────

  private async analyzeMetricCausality(
    ev: any,
    geographyId: string,
    refDate: Date,
    metricKey: string,
    metricLabel: string
  ): Promise<MetricCausality> {
    const pool = this.pool;
    const resolvedMetricId = METRIC_SOURCE_MAP[metricKey] || metricKey;

    // Pull monthly time series from T-24 to T+24
    const tsRes = await pool.query(`
      SELECT
        DATE_TRUNC('month', observation_date) AS mo,
        AVG(value) AS val
      FROM metric_time_series
      WHERE metric_id = $1
        AND geography_id = $2
        AND observation_date BETWEEN $3::date - INTERVAL '24 months'
                                AND $3::date + INTERVAL '24 months'
      GROUP BY 1
      ORDER BY 1
    `, [resolvedMetricId, geographyId, refDate]);

    if (tsRes.rows.length < 8) {
      // Not enough data
      return this.insufficientResult(metricKey, metricLabel, ev.name);
    }

    const months = tsRes.rows.map((r: any) => new Date(r.mo));
    const values = tsRes.rows.map((r: any) => parseFloat(r.val));
    const n = months.length;

    // Find the index closest to refDate (event T0)
    const t0Idx = months.reduce((best, mo, i) => {
      return Math.abs(mo.getTime() - refDate.getTime()) <
             Math.abs(months[best].getTime() - refDate.getTime()) ? i : best;
    }, 0);

    // Create event indicator step series: 0 before T0, 1 from T0 onwards
    const eventIndicator = months.map((_, i) => i >= t0Idx ? 1 : 0);

    // ── Lead-lag sweep: lags -12 to +12 ──────────────────────────────────────
    // Positive lag = shift event indicator forward (event LEADS metric)
    // Negative lag = shift event indicator backward (metric LEADS event)
    let bestLag = 0;
    let bestR = 0;
    let bestN = 0;

    for (let lag = -12; lag <= 12; lag++) {
      // Shift event indicator by `lag` months
      const shifted: number[] = [];
      const valsTrimmed: number[] = [];

      for (let i = 0; i < n; i++) {
        const srcIdx = i - lag;  // positive lag → look back further in indicator
        if (srcIdx >= 0 && srcIdx < n) {
          shifted.push(eventIndicator[srcIdx]);
          valsTrimmed.push(values[i]);
        }
      }

      if (shifted.length < 6) continue;
      const { r } = pearsonR(shifted, valsTrimmed);
      if (Math.abs(r) > Math.abs(bestR)) {
        bestR = r;
        bestLag = lag;
        bestN = shifted.length;
      }
    }

    const pValue = approximatePValue(bestR, bestN);

    // ── Pre-event OLS slope (T-12 to T0) ─────────────────────────────────────
    const preIndices: number[] = [];
    const preValues: number[] = [];
    for (let i = 0; i < n; i++) {
      const moFromT0 = (months[i].getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (moFromT0 >= -12 && moFromT0 < 0) {
        preIndices.push(moFromT0);
        preValues.push(values[i]);
      }
    }
    const { slope: preSlope } = preIndices.length >= 4
      ? olsSlope(preIndices, preValues)
      : { slope: 0 };

    // ── Post-event delta (actual vs trend extrapolation at T+12) ─────────────
    const preOls = preIndices.length >= 4 ? olsSlope(preIndices, preValues) : { slope: 0, r2: 0 };
    const baselineAtT12 = (preValues[preValues.length - 1] || 0) + preOls.slope * 12;
    const actualAtT12Res = await pool.query(`
      SELECT AVG(value) AS val
      FROM metric_time_series
      WHERE metric_id = $1
        AND geography_id = $2
        AND observation_date BETWEEN $3::date + INTERVAL '10 months'
                                AND $3::date + INTERVAL '14 months'
    `, [resolvedMetricId, geographyId, refDate]);

    const actualAtT12 = actualAtT12Res.rows[0]?.val
      ? parseFloat(actualAtT12Res.rows[0].val)
      : null;

    const postEventDelta = actualAtT12 !== null ? actualAtT12 - baselineAtT12 : 0;
    const postEventDeltaPct = baselineAtT12 !== 0 && actualAtT12 !== null
      ? (postEventDelta / Math.abs(baselineAtT12)) * 100
      : 0;

    // ── Classify direction ────────────────────────────────────────────────────
    const absR = Math.abs(bestR);
    const significantThreshold = 0.3;

    let direction: CausalityDirection;
    if (absR < significantThreshold || bestN < 8) {
      direction = 'insufficient_data';
    } else if (bestLag >= 2) {
      direction = 'event_drives_market';
    } else if (bestLag <= -2) {
      direction = 'market_attracts_event';
    } else {
      direction = 'simultaneous';
    }

    // Check for bidirectionality: if both positive and negative lags show strong signal
    // Quick check: correlation at symmetric lag
    const { r: reverseR } = pearsonR(
      eventIndicator.slice(0, n - Math.abs(bestLag)),
      values.slice(Math.abs(bestLag))
    );
    if (direction !== 'insufficient_data' && Math.abs(reverseR) > 0.3 && Math.sign(bestLag) !== Math.sign(-bestLag)) {
      // Both lags show significant correlation → bidirectional
      if (bestLag > 2 && Math.abs(reverseR) > 0.25) direction = 'bidirectional';
    }

    const preEventAccelerating = preSlope > 0.001;
    const confidence: 'high' | 'medium' | 'low' =
      absR >= 0.6 && bestN >= 16 ? 'high' :
      absR >= 0.4 && bestN >= 10 ? 'medium' : 'low';

    const verdictText = buildVerdictText(
      ev.name, metricLabel, direction, bestLag,
      preEventAccelerating, postEventDeltaPct, bestR
    );

    return {
      metricKey,
      metricLabel,
      direction,
      leadLagMonths: bestLag,
      r: Math.round(bestR * 1000) / 1000,
      pValue: pValue !== null ? Math.round(pValue * 10000) / 10000 : null,
      sampleSize: bestN,
      preEventSlope: Math.round(preSlope * 100000) / 100000,
      preEventAccelerating,
      postEventDelta: Math.round(postEventDelta * 100) / 100,
      postEventDeltaPct: Math.round(postEventDeltaPct * 10) / 10,
      confidence,
      verdictText,
    };
  }

  private insufficientResult(metricKey: string, metricLabel: string, eventName: string): MetricCausality {
    return {
      metricKey,
      metricLabel,
      direction: 'insufficient_data',
      leadLagMonths: 0,
      r: 0,
      pValue: null,
      sampleSize: 0,
      preEventSlope: 0,
      preEventAccelerating: false,
      postEventDelta: 0,
      postEventDeltaPct: 0,
      confidence: 'low',
      verdictText: `Insufficient time-series data to determine causality between "${eventName}" and ${metricLabel}.`,
    };
  }

  private rowToMetricCausality(row: any): MetricCausality {
    const metricMeta = CAUSALITY_METRICS.find(m => m.key === row.metric_key);
    return {
      metricKey: row.metric_key,
      metricLabel: metricMeta?.label || row.metric_key,
      direction: row.direction as CausalityDirection,
      leadLagMonths: row.best_lag_months,
      r: parseFloat(row.best_r),
      pValue: row.p_value ? parseFloat(row.p_value) : null,
      sampleSize: row.sample_size,
      preEventSlope: row.pre_event_slope ? parseFloat(row.pre_event_slope) : 0,
      preEventAccelerating: (row.pre_event_slope || 0) > 0.001,
      postEventDelta: row.post_event_delta ? parseFloat(row.post_event_delta) : 0,
      postEventDeltaPct: row.post_event_delta_pct ? parseFloat(row.post_event_delta_pct) : 0,
      confidence: row.confidence as 'high' | 'medium' | 'low',
      verdictText: row.verdict_text || '',
    };
  }
}

export const m35CausalityService = new M35CausalityService();
