/**
 * M35 Event Deltas Service — Playbook-driven rent-growth assumption deltas
 *
 * Upgrades the legacy event-deltas.service.ts from hardcoded magnitude→bps mapping
 * to M35 playbook-driven deltas with proper provenance.
 *
 * Algorithm:
 *   1. Resolve deal location (MSA, submarket, lat/lng) from properties table
 *   2. Query key_events at scope-cascade (MSA + submarket + property)
 *   3. For each event:
 *      a. Look up playbook for subtype × stratum (MSA tier, magnitude, regime)
 *      b. Get rent_growth_yoy metric at windowMonths=12 (T+12 forecast)
 *      c. Compute proximityFactor and temporalFactor
 *      d. assumptionDelta = median × proximity × temporal
 *   4. Return ProvenancedValue with playbook citation provenance
 *
 * Counterfactual mode (Touch 4): when includeEvents=false, returns empty array
 * so the pro forma runs with baseline-only assumptions.
 *
 * @see backend/src/services/proforma/event-deltas.service.ts (legacy version)
 * @see backend/src/services/m35-playbook.service.ts
 * @see backend/src/services/m35-traffic-api.service.ts
 */

import { Pool } from 'pg';
import { ProvenancedValue, provenanced } from '../../types/provenanced-value';
import {
  getPlaybook,
  classifyMsaTier,
  type PlaybookStratum,
} from '../m35-playbook.service';
import { m35TrafficApiService } from '../m35-traffic-api.service';
import { logger } from '../../utils/logger';

// ─── Constants ───────────────────────────────────────────────────────────────

const TARGET_METRIC_KEY = 'rent_growth_yoy';
const TARGET_WINDOW_MONTHS = 12;
const PROXIMITY_THRESHOLD = 0.1; // same as events-context

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ComputeEventDeltasOptions {
  /** When false, returns empty array (counterfactual / Touch 4 mode). */
  includeEvents?: boolean;
  /** Override the target metric key (default: rent_growth_yoy). */
  metricKey?: string;
  /** Override the forecast window (default: 12 months). */
  windowMonths?: number;
}

// ─── Main function ───────────────────────────────────────────────────────────

export async function computeEventDeltas(
  pool: Pool,
  dealId: string,
  options: ComputeEventDeltasOptions = {}
): Promise<ProvenancedValue<number>[]> {
  const {
    includeEvents = true,
    metricKey = TARGET_METRIC_KEY,
    windowMonths = TARGET_WINDOW_MONTHS,
  } = options;

  if (!includeEvents) return [];

  // Resolve deal location from properties table (canonical)
  const locRes = await pool.query(
    `SELECT
       COALESCE(p.msa_id, d.deal_data->>'msaId', lower(trim(d.city))) AS msa_id,
       p.submarket_id,
       p.latitude,
       p.longitude
     FROM deals d
     LEFT JOIN deal_properties dp ON dp.deal_id = d.id
     LEFT JOIN properties p ON p.id = dp.property_id
     WHERE d.id = $1
     ORDER BY dp.created_at ASC NULLS LAST
     LIMIT 1`,
    [dealId]
  );

  const deal = locRes.rows[0];
  if (!deal) {
    logger.warn('[EventDeltas] No deal found', { dealId });
    return [];
  }

  const msaId = deal.msa_id ?? null;
  const submarketId = deal.submarket_id ?? null;
  const dealLat = deal.latitude ? parseFloat(deal.latitude) : null;
  const dealLng = deal.longitude ? parseFloat(deal.longitude) : null;

  if (!msaId) {
    logger.warn('[EventDeltas] No MSA resolved for deal', { dealId });
    return [];
  }

  // Scope-cascade query: MSA + submarket + property
  const evRes = await pool.query(
    `SELECT
       ke.id, ke.name, ke.category, ke.subtype, ke.status,
       ke.lat, ke.lng, ke.msa_id, ke.submarket_id,
       ke.magnitude_score, ke.magnitude_value, ke.confidence,
       ke.announced_date, ke.materialization_date, ke.completion_date,
       COALESCE(ett.baseline_treatment, 'PASS_THROUGH') AS baseline_treatment,
       COALESCE(ett.default_magnitude, 0) AS default_magnitude,
       COALESCE(ett.decay_shape, 'linear') AS decay_shape,
       COALESCE(ett.typical_decay_months, 6) AS typical_decay_months
     FROM key_events ke
     LEFT JOIN event_type_treatments ett ON ett.event_type = ke.category
     WHERE (
       ke.msa_id = $1
       OR ($2::text IS NOT NULL AND ke.submarket_id = $2)
       OR ($3::text IS NOT NULL AND ke.property_id = $3)
     )
     AND ke.status NOT IN ('cancelled','reversed','draft')
     ORDER BY ke.magnitude_score DESC, ke.announced_date DESC NULLS LAST`,
    [msaId, submarketId, dealId]
  );

  const events = evRes.rows;
  if (events.length === 0) {
    logger.info('[EventDeltas] No events found for deal', { dealId, msaId, submarketId });
    return [];
  }

  const msaTier = classifyMsaTier(msaId);
  const deltas: ProvenancedValue<number>[] = [];
  const now = new Date();

  for (const ev of events) {
    const subtype = ev.subtype as string | null;
    if (!subtype) {
      logger.debug('[EventDeltas] Event has no subtype, skipping', { eventId: ev.id });
      continue;
    }

    const magnitudeScore = parseFloat(ev.magnitude_score ?? '2');
    const magnitudeStratum = classifyMagnitudeStratum(magnitudeScore);
    const regime = classifyRegime(ev.announced_date ? new Date(ev.announced_date) : null);

    const stratum: PlaybookStratum = {
      msaTier,
      magnitude: magnitudeStratum,
      regime,
    };

    // Look up playbook
    const playbook = await getPlaybook(subtype, stratum);
    if (!playbook) {
      logger.debug('[EventDeltas] No playbook found for subtype', { subtype, stratum });
      continue;
    }

    // Find target metric in playbook
    const metric = playbook.metrics.find(
      m => m.metricKey === metricKey && m.windowMonths === windowMonths
    );
    if (!metric || metric.median === null) {
      logger.debug('[EventDeltas] No metric in playbook', {
        subtype, metricKey, windowMonths, availableMetrics: playbook.metrics.map(m => m.metricKey),
      });
      continue;
    }

    // Build M35ActiveEvent object for proximity/temporal computation
    const eventObj = {
      id: ev.id as string,
      name: ev.name as string,
      category: ev.category as string,
      subtype: ev.subtype as string | null,
      status: ev.status as string,
      lat: ev.lat ? parseFloat(ev.lat) : null,
      lng: ev.lng ? parseFloat(ev.lng) : null,
      msaId: ev.msa_id as string | null,
      submarketId: ev.submarket_id as string | null,
      magnitudeScore: parseFloat(ev.magnitude_score || '0.5'),
      magnitudeValue: ev.magnitude_value != null ? parseFloat(ev.magnitude_value) : null,
      confidence: parseFloat(ev.confidence || '0.7'),
      announcedDate: ev.announced_date ? new Date(ev.announced_date) : null,
      materializationDate: ev.materialization_date ? new Date(ev.materialization_date) : null,
      completionDate: ev.completion_date ? new Date(ev.completion_date) : null,
      baselineTreatment: ev.baseline_treatment as 'EXCLUDE' | 'ATTRIBUTE' | 'PASS_THROUGH',
      defaultMagnitude: parseFloat(ev.default_magnitude || '0'),
      decayShape: ev.decay_shape as string,
      typicalDecayMonths: parseInt(ev.typical_decay_months || '6'),
    };

    const location = {
      lat: dealLat ?? undefined,
      lng: dealLng ?? undefined,
      submarket: submarketId ?? undefined,
      msaId: msaId ?? undefined,
    };

    const proximity = m35TrafficApiService.proximityFactor(eventObj, location);
    const temporal = m35TrafficApiService.temporalFactor(eventObj, now);

    // Filter by proximity threshold (same as events-context)
    if (proximity < PROXIMITY_THRESHOLD) {
      logger.debug('[EventDeltas] Event below proximity threshold, skipping', {
        eventId: ev.id, proximity, threshold: PROXIMITY_THRESHOLD,
      });
      continue;
    }

    // Compute assumption delta: median × proximity × temporal
    const assumptionDelta = metric.median * proximity * temporal;

    if (Math.abs(assumptionDelta) < 0.0001) {
      logger.debug('[EventDeltas] Negligible delta, skipping', { eventId: ev.id, assumptionDelta });
      continue;
    }

    // Composite confidence: playbook confidence × proximity × temporal
    const compositeConfidence = metric.confidence * proximity * temporal;

    const rationale = (
      `${ev.name} (${subtype}) | ` +
      `playbook: ${playbook.subtype} (${playbook.status}, n=${playbook.instanceCount}) | ` +
      `stratum: ${JSON.stringify(stratum)} | ` +
      `metric: ${metricKey}@${windowMonths}mo | ` +
      `median=${(metric.median * 100).toFixed(2)}pp | ` +
      `proximity=${proximity.toFixed(3)} | ` +
      `temporal=${temporal.toFixed(3)} | ` +
      `delta=${(assumptionDelta * 100).toFixed(2)}pp | ` +
      `metricConfidence=${metric.confidence.toFixed(3)} | ` +
      `compositeConfidence=${compositeConfidence.toFixed(3)}`
    );

    const pv = provenanced(assumptionDelta, 'platform', compositeConfidence, 'derived', rationale);

    // Add playbook citation as sourceRefs for LayeredValue badge
    pv.sourceRefs = [{
      moduleId: 'M35',
      formulaId: playbook.subtype,
      note: `playbookId=${playbook.subtype}, stratum=${JSON.stringify(stratum)}, n=${playbook.instanceCount}, metricConfidence=${metric.confidence.toFixed(3)}`,
    }];

    deltas.push(pv);
  }

  logger.info('[EventDeltas] Computed deltas for deal', {
    dealId,
    eventCount: events.length,
    deltaCount: deltas.length,
    totalDelta: deltas.reduce((s, d) => s + (d.value ?? 0), 0),
  });

  return deltas;
}

// ─── Helper: classify magnitude into stratum bucket ───────────────────────────

function classifyMagnitudeStratum(magnitudeScore: number): 'small' | 'medium' | 'large' | 'transformative' {
  if (magnitudeScore <= 1) return 'small';
  if (magnitudeScore <= 2) return 'medium';
  if (magnitudeScore <= 4) return 'large';
  return 'transformative';
}

// ─── Helper: classify regime by announcement date ───────────────────────────

function classifyRegime(announcedDate: Date | null): 'pre_covid' | 'post_covid' {
  if (!announcedDate) return 'post_covid';
  return announcedDate < new Date('2020-03-01') ? 'pre_covid' : 'post_covid';
}

// ─── Legacy compatibility shim ───────────────────────────────────────────────

/**
 * Legacy interface: computeEventDeltas(pool, city, state)
 * 
 * This shim resolves the city/state to a dealId (first match) and delegates
 * to the new dealId-based implementation. It is preserved for backward
 * compatibility with the financial model engine call site.
 * 
 * @deprecated Use computeEventDeltas(pool, dealId) directly.
 */
export async function computeEventDeltasLegacy(
  pool: Pool,
  city: string | null,
  state: string | null,
): Promise<ProvenancedValue<number>[]> {
  if (!city || !state) return [];

  // Find first deal matching city/state
  const dealRes = await pool.query(
    `SELECT id FROM deals WHERE lower(trim(city)) = $1 AND lower(trim(state)) = $2 LIMIT 1`,
    [city.toLowerCase().trim(), state.toLowerCase().trim()]
  );

  const dealId = dealRes.rows[0]?.id as string | undefined;
  if (!dealId) return [];

  return computeEventDeltas(pool, dealId);
}
