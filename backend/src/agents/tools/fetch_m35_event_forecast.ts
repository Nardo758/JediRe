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
 * W-01 fix: repoints FROM demand_events (legacy/empty) to
 *   key_events LEFT JOIN event_forecasts per EVENT_WIRING_SYNTHESIS.md §1.
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

// Adapter: map ke.subtype (W-01 source) to output impact_type enum.
// Explicit subtype map covers known taxonomy values; category fallback covers future subtypes.
type ImpactType = z.infer<typeof EventImpactSchema>['impact_type'];
const SUBTYPE_IMPACT: Record<string, ImpactType> = {
  // EMPLOYMENT
  MAJOR_EMPLOYER_ARRIVAL:    'occupancy_boost',
  PLANT_OPENING:             'occupancy_boost',
  EMPLOYER_EXPANSION:        'occupancy_boost',
  MAJOR_EMPLOYER_DEPARTURE:  'risk',
  PLANT_CLOSURE:             'risk',
  EMPLOYER_CONTRACTION:      'risk',
  // INFRASTRUCTURE
  TRANSIT_LINE_OPENING:      'absorption_acceleration',
  HIGHWAY_EXPANSION:         'absorption_acceleration',
  STADIUM_ARENA:             'absorption_acceleration',
  MIXED_USE_DEVELOPMENT:     'absorption_acceleration',
  // MARKET_STRUCTURE / supply
  MULTIFAMILY_DELIVERY:      'risk',
  SUPPLY_PIPELINE_SHOCK:     'risk',
  // MACRO_DEMOGRAPHIC
  POPULATION_INFLUX:         'rent_premium',
  DEMOGRAPHIC_SHIFT:         'rent_premium',
  // REGULATORY_POLICY
  STR_REGULATION_BAN:        'rent_premium',  // removes competing STR supply → LTR benefit
  ZONING_UPZONE:             'absorption_acceleration',
  RENT_CONTROL_ENACTED:      'risk',
  MORATORIUM:                'risk',
  // DISASTER_DISRUPTION
  HURRICANE_NAMED_STORM:     'risk',
  WILDFIRE:                  'risk',
  FLOOD_EVENT:               'risk',
};

function resolveImpactType(subtype: string | null, category: string | null): ImpactType {
  if (subtype && SUBTYPE_IMPACT[subtype]) {
    return SUBTYPE_IMPACT[subtype];
  }
  // Category fallback for subtypes not yet in the explicit map
  switch (category) {
    case 'EMPLOYMENT':          return 'occupancy_boost';
    case 'TECHNOLOGY_INDUSTRY': return 'occupancy_boost';
    case 'INFRASTRUCTURE':      return 'absorption_acceleration';
    case 'MARKET_STRUCTURE':    return 'risk';
    case 'MACRO_DEMOGRAPHIC':   return 'rent_premium';
    case 'REGULATORY_POLICY':   return 'risk';
    case 'DISASTER_DISRUPTION': return 'risk';
    default:                    return 'occupancy_boost';
  }
}

// Adapter: map ef.confidence (numeric 0–1, W-01 source) to confidence enum.
type ConfidenceLevel = z.infer<typeof EventImpactSchema>['confidence'];
function resolveConfidence(efConf: string | null): ConfidenceLevel {
  if (efConf == null) return 'low';
  const v = parseFloat(efConf);
  return v >= 0.75 ? 'high' : v >= 0.50 ? 'medium' : 'low';
}

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
      // Resolve deal location: submarket_id / msa_id (canonical key_events filter);
      // lat/lng retained as Haversine fallback for deals not yet submarket-tagged.
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

      // Map requested horizon to nearest event_forecasts window_months bucket {3,12,24,36}.
      const windowMonths =
        input.horizon_months <= 6  ? 3
        : input.horizon_months <= 18 ? 12
        : input.horizon_months <= 30 ? 24
        : 36;

      // Build location WHERE clause.
      // Primary: submarket_id / msa_id match (no distance computation needed).
      // Fallback: Haversine on ke.lat/ke.lng when both geo-id fields are absent.
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

      // Canonical W-01 query per EVENT_WIRING_SYNTHESIS.md §1:
      //   FROM key_events ke
      //   LEFT JOIN event_forecasts ef
      //     ON ef.event_id = ke.id AND ef.status = 'active' AND ef.window_months = $windowMonths
      //
      // W-01 column mapping:
      //   event_type (free string) ← ke.subtype
      //   impact_type              ← ke.subtype  (adapter: resolveImpactType)
      //   impact_magnitude         ← ef.point_estimate (fallback: ke.magnitude_score × 0.01)
      //   confidence               ← ef.confidence     (adapter: resolveConfidence)
      //   m35_available            ← true when rows > 0
      const eventsResult = await query(
        `SELECT
           ke.id                                       AS event_id,
           ke.name                                     AS event_name,
           ke.subtype                                  AS event_type,
           ke.subtype                                  AS raw_subtype,
           ke.category::text                           AS raw_category,
           COALESCE(
             ef.point_estimate::numeric,
             (ke.magnitude_score * 0.01)::numeric
           )                                           AS impact_magnitude,
           ef.confidence                               AS ef_confidence,
           TO_CHAR(ke.materialization_date, 'YYYY-MM') AS start_month,
           TO_CHAR(ke.completion_date,      'YYYY-MM') AS end_month,
           ke.description                              AS notes
         FROM key_events ke
         LEFT JOIN event_forecasts ef
           ON ef.event_id      = ke.id
           AND ef.status       = 'active'
           AND ef.window_months = $2
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
        event_type:       String(r.event_type ?? r.raw_category ?? 'demand'),
        distance_miles:   null,
        impact_type:      resolveImpactType(
          r.raw_subtype as string | null,
          r.raw_category as string | null
        ),
        impact_magnitude: Number(r.impact_magnitude ?? 0),
        confidence:       resolveConfidence(r.ef_confidence as string | null),
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
        runId:        ctx.dealId,
        dealId:       ctx.dealId,
        submarketId,
        msaId,
        windowMonths,
        eventCount:   events.length,
        m35Available: events.length > 0,
      });

      return {
        events,
        net_occupancy_lift: Math.round(netOccupancy * 10000) / 10000,
        net_rent_premium:   Math.round(netRent    * 10000) / 10000,
        m35_available:      events.length > 0,
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
        events:             [],
        net_occupancy_lift: 0,
        net_rent_premium:   0,
        m35_available:      false,
        note: 'M35 Event Impact Engine is not currently available. Omit event-driven adjustments.',
      };
    }
  },
};
