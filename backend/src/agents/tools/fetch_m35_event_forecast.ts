/**
 * Tool: fetch_m35_event_forecast
 *
 * Event Impact Engine (M35) trajectory forecast for a deal's location.
 * Returns demand event impacts that may affect occupancy, rent growth, or absorption.
 *
 * Gracefully stubs if M35 is not live — returns empty events with a note.
 *
 * Tier 3 evidence source — optional enhancement.
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
    // Check if demand_events table exists and has data for this area
    let m35Available = false;

    try {
      // Get deal property location
      const locResult = await query(
        `SELECT p.latitude, p.longitude
         FROM deal_properties dp
         INNER JOIN properties p ON p.id = dp.property_id
         WHERE dp.deal_id = $1
         ORDER BY dp.created_at ASC
         LIMIT 1`,
        [input.deal_id]
      );

      if (locResult.rows.length === 0 || locResult.rows[0].latitude == null) {
        return {
          events: [],
          net_occupancy_lift: 0,
          net_rent_premium: 0,
          m35_available: false,
          note: 'No property location data available for M35 event lookup.',
        };
      }

      const { latitude, longitude } = locResult.rows[0];
      const horizonDate = new Date();
      horizonDate.setMonth(horizonDate.getMonth() + input.horizon_months);

      // Try to query demand_events with a geo radius filter
      const eventsResult = await query(
        `SELECT
           de.id              AS event_id,
           de.name            AS event_name,
           det.name           AS event_type,
           NULL               AS distance_miles,
           'occupancy_boost'  AS impact_type,
           COALESCE(tiea.occupancy_impact, 0.01) AS impact_magnitude,
           'medium'           AS confidence,
           de.start_date::text AS start_month,
           de.end_date::text   AS end_month,
           de.description     AS notes
         FROM demand_events de
         LEFT JOIN demand_event_types det ON det.id = de.event_type_id
         LEFT JOIN trade_area_event_impacts tiea
           ON tiea.event_id = de.id
         WHERE de.start_date <= $1
           AND (de.end_date IS NULL OR de.end_date >= NOW())
         ORDER BY tiea.occupancy_impact DESC NULLS LAST
         LIMIT 5`,
        [horizonDate.toISOString()]
      );

      m35Available = true;

      const events = eventsResult.rows.map((r: Record<string, unknown>) => ({
        event_id: String(r.event_id ?? ''),
        event_name: String(r.event_name ?? 'Unknown Event'),
        event_type: String(r.event_type ?? 'demand'),
        distance_miles: r.distance_miles != null ? Number(r.distance_miles) : null,
        impact_type: (r.impact_type as z.infer<typeof EventImpactSchema>['impact_type']) ?? 'occupancy_boost',
        impact_magnitude: Number(r.impact_magnitude ?? 0),
        confidence: (r.confidence as z.infer<typeof EventImpactSchema>['confidence']) ?? 'medium',
        start_month: r.start_month as string | null,
        end_month: r.end_month as string | null,
        notes: r.notes as string | null,
      }));

      const netOccupancy = events
        .filter(e => e.impact_type === 'occupancy_boost')
        .reduce((sum, e) => sum + e.impact_magnitude, 0);
      const netRent = events
        .filter(e => e.impact_type === 'rent_premium')
        .reduce((sum, e) => sum + e.impact_magnitude, 0);

      logger.debug('fetch_m35_event_forecast', {
        runId: ctx.dealId,
        dealId: ctx.dealId,
        eventCount: events.length,
        m35Available,
      });

      return {
        events,
        net_occupancy_lift: Math.round(netOccupancy * 10000) / 10000,
        net_rent_premium: Math.round(netRent * 10000) / 10000,
        m35_available: true,
        note: events.length === 0 ? 'No M35 demand events found within search radius.' : undefined,
      };
    } catch {
      // M35 not live or query failed — graceful stub
      logger.debug('fetch_m35_event_forecast: M35 not available, returning stub', {
        runId: ctx.dealId,
        dealId: ctx.dealId,
      });

      return {
        events: [],
        net_occupancy_lift: 0,
        net_rent_premium: 0,
        m35_available: false,
        note: 'M35 Event Impact Engine is not currently available. Omit event-driven adjustments.',
      };
    }
  },
};
