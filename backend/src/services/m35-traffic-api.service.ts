/**
 * M35 Traffic API Service
 *
 * Implements the data contract M07 Traffic Engine needs from M35 (spec §2.3.4):
 *
 *   getActiveEvents()   — active M35 events affecting a location/time window
 *   getPipelineEvents() — announced but not yet materialized events
 *   getPlaybook()       — historical analogs + expected magnitude for an event type
 *   proximityFactor()   — inverse-square geographic decay factor
 *   temporalFactor()    — time-based decay factor (ramp, S-curve, step, etc.)
 *
 * M07 Traffic Engine consumes these to implement mechanisms A-D:
 *   A. Baseline exclusion windows (don't poison calibration with disaster noise)
 *   B. Anomaly attribution (is the signing spike an event effect or real signal?)
 *   C. T-07 forward trajectory (announced events boost future demand signal)
 *   D. Lease-Up absorption curve adjustment (playbook-driven lift)
 *
 * This service is also used by the T-07 trajectory computation to include
 * the event_pipeline_signal as the 6th weighted component (15% weight).
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LocationTarget {
  lat?: number;
  lng?: number;
  submarket?: string;
  msaId?: string;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface ActiveEventParams {
  location: LocationTarget;
  radiusMi?: number;
  window: TimeWindow;
}

export interface M35ActiveEvent {
  id: string;
  name: string;
  category: string;
  subtype: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  msaId: string | null;
  submarketId: string | null;
  magnitudeScore: number;
  announcedDate: Date | null;
  materializationDate: Date | null;
  completionDate: Date | null;
  confidence: number;
  baselineTreatment: 'EXCLUDE' | 'ATTRIBUTE' | 'PASS_THROUGH';
  defaultMagnitude: number;
  decayShape: string;
  typicalDecayMonths: number;
}

export interface M35PipelineEvent extends M35ActiveEvent {
  expectedImpactDate: Date | null;
  timeToImpactMonths: number;
}

export interface EventPlaybook {
  eventType: string;
  nAnalogs: number;
  absorptionLift: number;          // fractional lift, e.g. 0.18 = +18%
  absorptionLiftBand: { low: number; high: number };
  rentGrowthLift: number;
  liftDecayCurve: 'permanent' | 'ramp' | 's_curve' | 'step' | 'linear';
  typicalDecayMonths: number;
  confidence: 'high' | 'medium' | 'low';
}

// ─── Main Service ──────────────────────────────────────────────────────────────

export class M35TrafficApiService {
  private pool = getPool();

  /**
   * Returns events that are active during the given time window and affect
   * the given location. Used by M07 calibration job for mechanisms A-C.
   */
  async getActiveEvents(params: ActiveEventParams): Promise<M35ActiveEvent[]> {
    const { location, radiusMi = 5, window } = params;
    const pool = this.pool;

    const whereClauses: string[] = [
      `ke.status NOT IN ('draft', 'cancelled')`,
      `(ke.announced_date <= $1 OR ke.announced_date IS NULL)`,
      `(ke.completion_date >= $2 OR ke.completion_date IS NULL)`,
    ];
    const bindings: any[] = [window.end, window.start];
    let bindIdx = 3;

    if (location.msaId) {
      whereClauses.push(`ke.msa_id = $${bindIdx++}`);
      bindings.push(location.msaId);
    } else if (location.submarket) {
      whereClauses.push(`(ke.submarket_id = $${bindIdx++} OR ke.msa_id IS NOT NULL)`);
      bindings.push(location.submarket);
    }

    if (location.lat && location.lng) {
      // Bounding box pre-filter (1° ≈ 69mi)
      const degOffset = radiusMi / 69;
      whereClauses.push(`
        (ke.lat IS NULL OR (
          ke.lat BETWEEN $${bindIdx++} AND $${bindIdx++}
          AND ke.lng BETWEEN $${bindIdx++} AND $${bindIdx++}
        ))
      `);
      bindings.push(
        location.lat - degOffset, location.lat + degOffset,
        location.lng - degOffset, location.lng + degOffset
      );
    }

    const sql = `
      SELECT
        ke.id, ke.name, ke.category, ke.subtype, ke.status,
        ke.lat, ke.lng, ke.msa_id, ke.submarket_id,
        ke.magnitude_score, ke.confidence,
        ke.announced_date, ke.materialization_date, ke.completion_date,
        COALESCE(ett.baseline_treatment, 'PASS_THROUGH') AS baseline_treatment,
        COALESCE(ett.default_magnitude, 0) AS default_magnitude,
        COALESCE(ett.decay_shape, 'linear') AS decay_shape,
        COALESCE(ett.typical_decay_months, 6) AS typical_decay_months
      FROM key_events ke
      LEFT JOIN event_type_treatments ett ON ett.event_type = ke.category
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY ke.magnitude_score DESC NULLS LAST
    `;

    const res = await pool.query(sql, bindings);

    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      subtype: r.subtype,
      status: r.status,
      lat: r.lat ? parseFloat(r.lat) : null,
      lng: r.lng ? parseFloat(r.lng) : null,
      msaId: r.msa_id,
      submarketId: r.submarket_id,
      magnitudeScore: parseFloat(r.magnitude_score || '0.5'),
      confidence: parseFloat(r.confidence || '0.7'),
      announcedDate: r.announced_date ? new Date(r.announced_date) : null,
      materializationDate: r.materialization_date ? new Date(r.materialization_date) : null,
      completionDate: r.completion_date ? new Date(r.completion_date) : null,
      baselineTreatment: r.baseline_treatment as 'EXCLUDE' | 'ATTRIBUTE' | 'PASS_THROUGH',
      defaultMagnitude: parseFloat(r.default_magnitude || '0'),
      decayShape: r.decay_shape,
      typicalDecayMonths: parseInt(r.typical_decay_months || '6'),
    }));
  }

  /**
   * Returns announced-but-not-yet-materialized events for T-07 forward trajectory.
   * The event_pipeline_signal in T-07 = Σ(magnitude × proximity × timeToImpact × confidence)
   */
  async getPipelineEvents(params: ActiveEventParams): Promise<M35PipelineEvent[]> {
    const pipelineParams = {
      ...params,
      window: {
        start: new Date(),
        end: params.window.end,
      }
    };

    const now = new Date();
    const active = await this.getActiveEvents(pipelineParams);

    return active
      .filter(ev => ev.status === 'announced' || ev.status === 'in_progress')
      .map(ev => {
        const impactDate = ev.materializationDate || ev.announcedDate || now;
        const msDiff = impactDate.getTime() - now.getTime();
        const monthsDiff = msDiff / (1000 * 60 * 60 * 24 * 30);
        return {
          ...ev,
          expectedImpactDate: impactDate,
          timeToImpactMonths: Math.max(0, Math.round(monthsDiff)),
        };
      })
      .sort((a, b) => a.timeToImpactMonths - b.timeToImpactMonths);
  }

  /**
   * Returns the historical playbook for an event type/subtype — reads from
   * the aggregated event_playbooks table (populated by m35-playbook.service).
   * Used by Lease-Up absorption curve adjustment (Mechanism D).
   *
   * Semantics when `eventType` is a category (not a subtype):
   *   The query matches any playbook row whose event_taxonomy.category equals eventType,
   *   then selects the single subtype with the highest instance_count. This gives the
   *   most data-rich representative subtype, NOT a cross-subtype aggregate. Callers that
   *   need true category-level aggregation should call getPlaybook() for each subtype
   *   and merge results externally.
   */
  async getPlaybook(eventType: string): Promise<EventPlaybook | null> {
    const pool = this.pool;

    // Prefer subtype match, fall back to category match
    const res = await pool.query(`
      SELECT
        ep.subtype,
        MAX(ep.instance_count)::int                                                  AS n_analogs,
        AVG(CASE WHEN ep.metric_key IN ('net_absorption','net_absorption_units')
               THEN ep.median_delta END)                                             AS avg_absorption_lift,
        AVG(CASE WHEN ep.metric_key IN ('net_absorption','net_absorption_units')
               THEN ep.p25 END)                                                      AS absorption_lift_p25,
        AVG(CASE WHEN ep.metric_key IN ('net_absorption','net_absorption_units')
               THEN ep.p75 END)                                                      AS absorption_lift_p75,
        AVG(CASE WHEN ep.metric_key IN ('rent_growth_yoy','effective_rent_growth','rent_index_yoy')
               THEN ep.median_delta END)                                             AS avg_rent_lift,
        AVG(ep.confidence)                                                           AS avg_confidence,
        COALESCE(ett.decay_shape, 'linear')                                          AS decay_shape,
        COALESCE(ett.typical_decay_months, 12)                                       AS typical_decay_months
      FROM event_playbooks ep
      LEFT JOIN event_taxonomy et ON et.subtype = ep.subtype
      LEFT JOIN event_type_treatments ett
             ON ett.event_type = COALESCE(et.category::text, $1)
      WHERE (ep.subtype = $1 OR et.category::text = $1)
        AND ep.stratum_msa_tier = 'all'
        AND ep.stratum_magnitude = 'all'
        AND ep.stratum_regime    = 'all'
        AND ep.window_months     = 12
      GROUP BY ep.subtype, ett.decay_shape, ett.typical_decay_months
      ORDER BY MAX(ep.instance_count) DESC
      LIMIT 1
    `, [eventType]);

    const nAnalogs = parseInt(res.rows[0]?.n_analogs ?? '0');

    if (nAnalogs === 0) {
      // Nothing in event_playbooks — fall back to event_type_treatments defaults
      const ett = await pool.query(
        `SELECT * FROM event_type_treatments WHERE event_type = $1 LIMIT 1`,
        [eventType],
      );
      if (ett.rows.length === 0) {
        logger.debug(`[M35 Traffic API] No playbook or treatment for ${eventType}`);
        return null;
      }
      const t = ett.rows[0];
      return {
        eventType,
        nAnalogs: 0,
        absorptionLift: Math.abs(parseFloat(t.default_magnitude || '0.1')),
        absorptionLiftBand: { low: 0, high: Math.abs(parseFloat(t.default_magnitude || '0.1')) * 1.5 },
        rentGrowthLift: Math.abs(parseFloat(t.default_magnitude || '0.05')) * 0.4,
        liftDecayCurve: (t.decay_shape || 'linear') as any,
        typicalDecayMonths: parseInt(t.typical_decay_months || '12'),
        confidence: 'low',
      };
    }

    const row = res.rows[0];
    const avgConf = parseFloat(row.avg_confidence ?? '0.5');
    return {
      eventType,
      nAnalogs,
      absorptionLift: parseFloat(row.avg_absorption_lift ?? '0'),
      absorptionLiftBand: {
        low: parseFloat(row.absorption_lift_p25 ?? '0'),
        high: parseFloat(row.absorption_lift_p75 ?? '0'),
      },
      rentGrowthLift: parseFloat(row.avg_rent_lift ?? '0'),
      liftDecayCurve: (row.decay_shape || 'linear') as any,
      typicalDecayMonths: parseInt(row.typical_decay_months || '12'),
      confidence: avgConf >= 0.7 ? 'high' : avgConf >= 0.5 ? 'medium' : 'low',
    };
  }

  /**
   * Proximity decay factor — inverse-square from event epicenter.
   * max(0, 1 - (d / r)^2)  per spec §2.3.3
   *
   * @param event  — the M35 event (needs lat/lng or submarket)
   * @param target — the target property or submarket
   */
  proximityFactor(event: M35ActiveEvent, target: LocationTarget): number {
    if (!event.lat || !event.lng) {
      // No geocode — if same submarket, return 1.0; if same MSA, return 0.6; else 0.3
      if (event.submarketId && event.submarketId === target.submarket) return 1.0;
      if (event.msaId && event.msaId === target.msaId) return 0.6;
      return 0.3;
    }
    if (!target.lat || !target.lng) return 0.5; // partial info

    const distMi = this.haversineMi(event.lat, event.lng, target.lat, target.lng);
    const cascadeRadius = 5; // spec default: 5 mi
    const factor = Math.max(0, 1 - Math.pow(distMi / cascadeRadius, 2));
    return Math.round(factor * 1000) / 1000;
  }

  /**
   * Temporal decay factor — event-type-specific, as of a given date.
   * - Disasters: S-curve recovery (starts 0 at disaster, ramps back to 1)
   * - Announcements: ramp from ~0.3 at 18mo out → 1.0 at impact date
   * - Closures: step-down at announcement, gradual substitution
   * - Permanent: stays at 1.0 after materialization
   *
   * Returns 0.0–1.0 representing the event's current influence strength.
   */
  temporalFactor(event: M35ActiveEvent, asOf: Date): number {
    const impactDate = event.materializationDate || event.announcedDate;
    if (!impactDate) return 0.5;

    const daysSinceImpact = (asOf.getTime() - impactDate.getTime()) / (1000 * 60 * 60 * 24);
    const monthsSinceImpact = daysSinceImpact / 30;
    const decayMonths = event.typicalDecayMonths || 12;
    const timeToImpactMonths = -monthsSinceImpact; // negative = event hasn't happened yet

    switch (event.decayShape) {
      case 'permanent':
        // Always 1.0 after materialization
        return monthsSinceImpact >= 0 ? 1.0 : Math.max(0.1, 1 - timeToImpactMonths / 18);

      case 'ramp':
        // Builds from 0.3 at announcement to 1.0 at impact, then stays
        if (monthsSinceImpact < 0) {
          // Pre-impact: timeToImpact counts down
          const preImpactFactor = Math.max(0.3, 1 - timeToImpactMonths / 18);
          return Math.min(1.0, preImpactFactor);
        }
        return 1.0; // Post-impact: sustained

      case 's_curve': {
        // Disaster recovery: starts negative (impact) and recovers S-curve over decayMonths
        // Factor goes from 0 at disaster to 1.0 when fully recovered
        if (monthsSinceImpact < 0) return 1.0; // pre-disaster, no effect yet
        const progress = monthsSinceImpact / decayMonths;
        // Logistic S-curve
        const s = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
        return Math.min(1.0, s);
      }

      case 'step':
        // Step-down: full effect immediately, then linear decay
        if (monthsSinceImpact < 0) return 0.0;
        return Math.max(0, 1 - monthsSinceImpact / decayMonths);

      case 'linear':
      default:
        if (monthsSinceImpact < 0) return Math.max(0.1, 1 + monthsSinceImpact / 18);
        return Math.max(0, 1 - monthsSinceImpact / decayMonths);
    }
  }

  /**
   * Compute the T-07 event_pipeline_signal — the 6th component added by spec §3.1.
   * Returns a score -1..+1 representing the net demand signal from upcoming events.
   *
   * Positive = net demand catalyst (employer openings, infrastructure improvements)
   * Negative = net demand suppressor (disasters, closures)
   */
  async computeEventPipelineSignal(location: LocationTarget, horizon = 18): Promise<number> {
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + horizon);

    const pipelineEvents = await this.getPipelineEvents({
      location,
      radiusMi: 5,
      window: { start: now, end },
    });

    if (pipelineEvents.length === 0) return 0;

    let signal = 0;
    for (const ev of pipelineEvents) {
      const proximity = this.proximityFactor(ev, location);
      const timeFactor = this.timeToImpactFactor(ev.timeToImpactMonths, horizon);
      const magnitude = ev.defaultMagnitude !== 0 ? ev.defaultMagnitude : ev.magnitudeScore;
      signal += magnitude * proximity * timeFactor * ev.confidence;
    }

    // Normalize to -1..+1 range
    return Math.max(-1, Math.min(1, signal));
  }

  /**
   * time-to-impact factor: 1.0 at impact, ~0.3 at horizon months out.
   * Spec: "ramp function — 1.0 at impact, decaying to ~0.3 at 18 months out"
   */
  timeToImpactFactor(monthsToImpact: number, horizon = 18): number {
    if (monthsToImpact <= 0) return 1.0;
    return Math.max(0.3, 1 - (monthsToImpact / horizon) * 0.7);
  }

  private haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) *
              Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }
}

export const m35TrafficApiService = new M35TrafficApiService();
