/**
 * Tool: fetch_m35_event_forecast
 *
 * Event Impact Engine (M35) trajectory forecast for a deal's location.
 * Returns demand event impacts that may affect occupancy, rent growth, or absorption.
 *
 * Gracefully stubs if M35 is not live — returns empty events with a note.
 *
 * Tier 3 evidence source — optional enhancement.
 *
 * W-01 (Task #728): Repoints FROM demand_events (legacy, empty) →
 *   key_events LEFT JOIN event_forecasts using the canonical pattern from
 *   EVENT_WIRING_SYNTHESIS.md §1. Column mapping:
 *     impact_type      ← CASE ke.category
 *     impact_magnitude ← ef.point_estimate (fallback: ke.magnitude_score × 0.01)
 *     confidence       ← CASE COALESCE(ef.confidence, ke.confidence)
 *     event_type       ← ke.subtype
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid(),
  radius_miles: z.number().positive().max(25).default(5)
    .describe('Search radius around property in miles'),
  horizon_months: z.number().int().min(6).max(60).default(24)
    .describe('Forecast horizon in months'),
});

const EventImpactSchema = z.object({
  event_id: z.string(),
  event_name: z.string(),
  event_type: z.string(),
  distance_miles: z.number().nullable(),
  impact_type: z.enum(['occupancy_boost', 'rent_premium', 'absorption_acceleration', 'risk']),
  impact_magnitude: z.number().describe('Decimal, e.g. 0.03 = 3% boost'),
  confidence: z.enum(['high', 'medium', 'low']),
  start_month: z.string().nullable(),
  end_month: z.string().nullable(),
  notes: z.string().nullable(),
});

const OutputSchema = z.object({
  events: z.array(EventImpactSchema),
  net_occupancy_lift: z.number().describe('Blended occupancy impact from all events'),
  net_rent_premium: z.number().describe('Blended rent premium from all events'),
  m35_available: z.boolean(),
  note: z.string().optional(),
});

export const fetchM35EventForecastTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_m35_event_forecast',
  description:
    'Fetches M35 Event Impact Engine demand trajectory for a deal location. ' +
    'Returns events (stadium openings, employer expansions, transit projects) that may ' +
    'affect rent growth or absorption. Stubs gracefully if M35 is not available.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:all',

  execute: async (input, ctx) => {
    try {
      // Step 1: Resolve deal location.
      // Primary filter: submarket_id / msa_id from the deals table (precise, no Haversine).
      // Fallback: lat/lng from the associated property (Haversine on ke.lat/ke.lng) when
      // both geo-id fields are null — handles deals not yet submarket-tagged.
      const locResult = await query(
        `SELECT
           d.submarket_id,
           d.msa_id,
           p.latitude,
           p.longitude
         FROM deals d
         LEFT JOIN deal_properties dp ON dp.deal_id = d.id
         LEFT JOIN properties p      ON p.id = dp.property_id
         WHERE d.id = $1
         ORDER BY dp.created_at ASC NULLS LAST
         LIMIT 1`,
        [input.deal_id]
      );

      if (locResult.rows.length === 0) {
        return {
          events: [],
          net_occupancy_lift: 0,
          net_rent_premium: 0,
          m35_available: false,
          note: 'No deal record found for M35 event lookup.',
        };
      }

      const { submarket_id: submarketId, msa_id: msaId, latitude, longitude } =
        locResult.rows[0] as {
          submarket_id: string | null;
          msa_id: string | null;
          latitude: string | null;
          longitude: string | null;
        };

      if (!submarketId && !msaId && (latitude == null || longitude == null)) {
        return {
          events: [],
          net_occupancy_lift: 0,
          net_rent_premium: 0,
          m35_available: false,
          note: 'No property location or submarket data available for M35 event lookup.',
        };
      }

      const horizonDate = new Date();
      horizonDate.setMonth(horizonDate.getMonth() + input.horizon_months);

      // Map requested horizon to the nearest event_forecasts window_months bucket {3,12,24,36}.
      const windowMonths =
        input.horizon_months <= 6  ? 3
        : input.horizon_months <= 18 ? 12
        : input.horizon_months <= 30 ? 24
        : 36;

      // Step 2: Canonical query — key_events LEFT JOIN event_forecasts.
      // Builds the WHERE location clause dynamically:
      //   - Primary path: submarket_id and/or msa_id match (no distance calc)
      //   - Fallback path: Haversine on ke.lat/ke.lng when geo-id fields are absent
      const params: unknown[] = [horizonDate.toISOString(), windowMonths];

      let locationClause: string;
      if (submarketId || msaId) {
        const clauses: string[] = [];
        if (submarketId) {
          params.push(submarketId);
          clauses.push(`ke.submarket_id = $${params.length}`);
        }
        if (msaId) {
          params.push(msaId);
          clauses.push(`ke.msa_id = $${params.length}`);
        }
        locationClause = `(${clauses.join(' OR ')})`;
      } else {
        // Haversine fallback — fires only when submarket_id AND msa_id are both null
        params.push(latitude, longitude, input.radius_miles);
        const latP = params.length - 2;
        const lngP = params.length - 1;
        const radP = params.length;
        locationClause = `(
          ke.lat IS NOT NULL AND ke.lng IS NOT NULL AND
          (3959 * acos(LEAST(1.0,
            cos(radians($${latP}::double precision)) *
            cos(radians(ke.lat::double precision)) *
            cos(radians(ke.lng::double precision) - radians($${lngP}::double precision)) +
            sin(radians($${latP}::double precision)) *
            sin(radians(ke.lat::double precision))
          ))) <= $${radP}
        )`;
      }

      // Canonical SELECT — key_events (canonical schema) LEFT JOIN event_forecasts.
      //
      // impact_type derived from ke.category (m35_event_category enum):
      //   EMPLOYMENT / TECHNOLOGY_INDUSTRY → occupancy_boost  (jobs drive demand)
      //   INFRASTRUCTURE                   → absorption_acceleration
      //   MARKET_STRUCTURE / MACRO_DEMOGRAPHIC → rent_premium
      //   REGULATORY_POLICY / DISASTER_DISRUPTION → risk
      //
      // impact_magnitude: prefer ef.point_estimate (forecast), fall back to
      //   ke.magnitude_score × 0.01 (1 % per score point, score range 1–5).
      //
      // confidence: map COALESCE(ef.confidence, ke.confidence) 0–1 decimal to
      //   'high' (≥0.75), 'medium' (≥0.50), 'low' (<0.50).
      //
      // LATERAL subquery picks the single event_forecast whose window_months is
      // closest to the requested horizon bucket, then largest point_estimate as
      // tiebreaker.  No metric_key filter — surface the most impactful forecast
      // regardless of metric axis.
      const eventsResult = await query(
        `SELECT
           ke.id                                        AS event_id,
           ke.name                                      AS event_name,
           COALESCE(ke.subtype, ke.category::text)      AS event_type,
           CASE ke.category::text
             WHEN 'EMPLOYMENT'            THEN 'occupancy_boost'
             WHEN 'TECHNOLOGY_INDUSTRY'   THEN 'occupancy_boost'
             WHEN 'INFRASTRUCTURE'        THEN 'absorption_acceleration'
             WHEN 'MARKET_STRUCTURE'      THEN 'rent_premium'
             WHEN 'MACRO_DEMOGRAPHIC'     THEN 'rent_premium'
             WHEN 'REGULATORY_POLICY'     THEN 'risk'
             WHEN 'DISASTER_DISRUPTION'   THEN 'risk'
             ELSE                              'occupancy_boost'
           END                                          AS impact_type,
           COALESCE(
             ef.point_estimate::numeric,
             (ke.magnitude_score * 0.01)::numeric
           )                                            AS impact_magnitude,
           CASE
             WHEN COALESCE(ef.confidence::numeric, ke.confidence::numeric, 0.5) >= 0.75
               THEN 'high'
             WHEN COALESCE(ef.confidence::numeric, ke.confidence::numeric, 0.5) >= 0.50
               THEN 'medium'
             ELSE 'low'
           END                                          AS confidence,
           TO_CHAR(ke.materialization_date, 'YYYY-MM')  AS start_month,
           TO_CHAR(ke.completion_date,      'YYYY-MM')  AS end_month,
           ke.description                               AS notes
         FROM key_events ke
         LEFT JOIN LATERAL (
           SELECT ef.point_estimate, ef.confidence
           FROM event_forecasts ef
           WHERE ef.event_id = ke.id
             AND ef.status   = 'active'
           ORDER BY
             ABS(ef.window_months - $2) ASC,
             ef.point_estimate DESC NULLS LAST
           LIMIT 1
         ) ef ON TRUE
         WHERE ke.status NOT IN ('draft', 'cancelled')
           AND ${locationClause}
           AND (ke.completion_date IS NULL OR ke.completion_date >= NOW())
           AND (ke.materialization_date IS NULL OR ke.materialization_date <= $1)
         ORDER BY
           COALESCE(ef.point_estimate::numeric, ke.magnitude_score * 0.01) DESC NULLS LAST
         LIMIT 10`,
        params
      );

      const events = eventsResult.rows.map((r: Record<string, unknown>) => ({
        event_id:         String(r.event_id ?? ''),
        event_name:       String(r.event_name ?? 'Unknown Event'),
        event_type:       String(r.event_type ?? 'demand'),
        distance_miles:   null,  // not computed on submarket/msa-match path
        impact_type:      (r.impact_type as z.infer<typeof EventImpactSchema>['impact_type']) ?? 'occupancy_boost',
        impact_magnitude: Number(r.impact_magnitude ?? 0),
        confidence:       (r.confidence as z.infer<typeof EventImpactSchema>['confidence']) ?? 'medium',
        start_month:      r.start_month as string | null,
        end_month:        r.end_month   as string | null,
        notes:            r.notes       as string | null,
      }));

      const netOccupancy = events
        .filter(e => e.impact_type === 'occupancy_boost')
        .reduce((sum, e) => sum + e.impact_magnitude, 0);
      const netRent = events
        .filter(e => e.impact_type === 'rent_premium')
        .reduce((sum, e) => sum + e.impact_magnitude, 0);

      logger.debug('fetch_m35_event_forecast', {
        runId:       ctx.dealId,
        dealId:      ctx.dealId,
        submarketId,
        msaId,
        windowMonths,
        eventCount:  events.length,
        m35Available: true,
      });

      return {
        events,
        net_occupancy_lift: Math.round(netOccupancy * 10000) / 10000,
        net_rent_premium:   Math.round(netRent    * 10000) / 10000,
        m35_available:      true,
        note: events.length === 0
          ? 'No M35 demand events found for this deal location.'
          : undefined,
      };
    } catch {
      // M35 not live or query failed — graceful stub
      logger.debug('fetch_m35_event_forecast: M35 not available, returning stub', {
        runId:  ctx.dealId,
        dealId: ctx.dealId,
      });

      return {
        events:           [],
        net_occupancy_lift: 0,
        net_rent_premium:   0,
        m35_available:      false,
        note: 'M35 Event Impact Engine is not currently available. Omit event-driven adjustments.',
      };
    }
  },
};
