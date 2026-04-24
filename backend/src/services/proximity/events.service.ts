/**
 * Market Events Service
 * 
 * Tracks and analyzes market events that impact property values:
 * - Employer moves/expansions
 * - Transit openings
 * - Supply deliveries
 * - Infrastructure changes
 * - Economic shocks
 */

import { Pool } from 'pg';
import { MarketEvent, EventOutcome, EventType } from './types';

export class MarketEventsService {
  constructor(private pool: Pool) {}
  
  /**
   * Get events near a location
   */
  async getEventsNearLocation(
    latitude: number,
    longitude: number,
    radiusMiles: number = 5.0,
    options: {
      eventTypes?: EventType[];
      status?: string[];
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<MarketEvent[]> {
    const params: any[] = [longitude, latitude, radiusMiles];
    let paramIndex = 4;
    
    let whereClause = `
      WHERE (
        -- Point-based events
        (me.latitude IS NOT NULL AND me.longitude IS NOT NULL AND
         ST_Distance(
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           ST_SetSRID(ST_MakePoint(me.longitude, me.latitude), 4326)::geography
         ) / 1609.34 <= $3)
        OR
        -- Geography-based events with impact radius
        (me.latitude IS NOT NULL AND me.longitude IS NOT NULL AND me.impact_radius_miles IS NOT NULL AND
         ST_Distance(
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           ST_SetSRID(ST_MakePoint(me.longitude, me.latitude), 4326)::geography
         ) / 1609.34 <= me.impact_radius_miles)
      )
    `;
    
    if (options.eventTypes && options.eventTypes.length > 0) {
      whereClause += ` AND me.event_type = ANY($${paramIndex})`;
      params.push(options.eventTypes);
      paramIndex++;
    }
    
    if (options.status && options.status.length > 0) {
      whereClause += ` AND me.status = ANY($${paramIndex})`;
      params.push(options.status);
      paramIndex++;
    }
    
    if (options.startDate) {
      whereClause += ` AND me.effective_date >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }
    
    if (options.endDate) {
      whereClause += ` AND me.effective_date <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }
    
    const limit = options.limit || 50;
    
    const result = await this.pool.query(`
      SELECT 
        me.*,
        ST_Distance(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(me.longitude, me.latitude), 4326)::geography
        ) / 1609.34 AS distance_miles
      FROM market_events me
      ${whereClause}
      ORDER BY 
        CASE WHEN me.effective_date > CURRENT_DATE THEN 0 ELSE 1 END,
        ABS(me.effective_date - CURRENT_DATE)
      LIMIT ${limit}
    `, params);
    
    return result.rows.map(row => this.mapRowToEvent(row));
  }
  
  /**
   * Get upcoming events that may impact a submarket
   */
  async getUpcomingEvents(
    submarket: string,
    lookAheadMonths: number = 24
  ): Promise<MarketEvent[]> {
    const result = await this.pool.query(`
      SELECT me.*
      FROM market_events me
      WHERE (me.geography_id = $1 OR me.geography_type = 'msa')
        AND me.effective_date > CURRENT_DATE
        AND me.effective_date <= CURRENT_DATE + INTERVAL '${lookAheadMonths} months'
        AND me.status NOT IN ('cancelled', 'rumored')
      ORDER BY me.effective_date
    `, [submarket]);
    
    return result.rows.map(row => this.mapRowToEvent(row));
  }
  
  /**
   * Get event by ID with outcomes
   */
  async getEventWithOutcomes(eventId: string): Promise<{
    event: MarketEvent;
    outcomes: EventOutcome[];
  } | null> {
    const eventResult = await this.pool.query(
      'SELECT * FROM market_events WHERE id = $1',
      [eventId]
    );
    
    if (eventResult.rows.length === 0) return null;
    
    const outcomesResult = await this.pool.query(
      'SELECT * FROM event_outcomes WHERE event_id = $1 ORDER BY measurement_period',
      [eventId]
    );
    
    return {
      event: this.mapRowToEvent(eventResult.rows[0]),
      outcomes: outcomesResult.rows.map(row => this.mapRowToOutcome(row))
    };
  }
  
  /**
   * Create a new market event
   */
  async createEvent(event: Omit<MarketEvent, 'id'>): Promise<MarketEvent> {
    const result = await this.pool.query(`
      INSERT INTO market_events (
        event_type, event_name, event_description,
        geography_type, geography_id, geography_name,
        latitude, longitude, impact_radius_miles,
        entity_name, entity_type, jobs_affected, units_affected, sqft_affected, investment_amount,
        announced_date, groundbreaking_date, effective_date, completion_date,
        expected_impact_direction, expected_impact_magnitude, expected_impact_duration,
        affected_metrics,
        source_url, source_type, source_date,
        status, confidence_score, tags
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
      )
      RETURNING *
    `, [
      event.eventType, event.eventName, event.eventDescription,
      event.geographyType, event.geographyId, event.geographyName,
      event.latitude, event.longitude, event.impactRadiusMiles,
      event.entityName, event.entityType, event.jobsAffected, event.unitsAffected, event.sqftAffected, event.investmentAmount,
      event.announcedDate, event.groundbreakingDate, event.effectiveDate, event.completionDate,
      event.expectedImpactDirection, event.expectedImpactMagnitude, event.expectedImpactDuration,
      event.affectedMetrics,
      event.sourceUrl, event.sourceType, event.sourceDate,
      event.status, event.confidenceScore, event.tags
    ]);
    
    return this.mapRowToEvent(result.rows[0]);
  }
  
  /**
   * Record an event outcome for backtesting
   */
  async recordOutcome(outcome: Omit<EventOutcome, 'id'>): Promise<EventOutcome> {
    const result = await this.pool.query(`
      INSERT INTO event_outcomes (
        event_id, measurement_period, measurement_start_date, measurement_end_date,
        geography_type, geography_id, distance_from_event_miles,
        rent_change_pct, occupancy_change_pct, absorption_units,
        cap_rate_change_bps, price_per_unit_change_pct, concession_change_pct,
        search_volume_change_pct, tour_volume_change_pct, application_volume_change_pct,
        attribution_confidence, confounding_factors, methodology_notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING *
    `, [
      outcome.eventId, outcome.measurementPeriod, outcome.measurementStartDate, outcome.measurementEndDate,
      outcome.geographyType, outcome.geographyId, outcome.distanceFromEventMiles,
      outcome.rentChangePct, outcome.occupancyChangePct, outcome.absorptionUnits,
      outcome.capRateChangeBps, outcome.pricePerUnitChangePct, outcome.concessionChangePct,
      outcome.searchVolumeChangePct, outcome.tourVolumeChangePct, outcome.applicationVolumeChangePct,
      outcome.attributionConfidence, outcome.confoundingFactors, outcome.methodologyNotes
    ]);
    
    return this.mapRowToOutcome(result.rows[0]);
  }
  
  /**
   * Analyze historical event impacts for a given event type
   */
  async analyzeEventTypeImpact(eventType: EventType): Promise<{
    eventType: EventType;
    sampleSize: number;
    avgRentImpact3mo: number;
    avgRentImpact12mo: number;
    avgOccupancyImpact3mo: number;
    avgOccupancyImpact12mo: number;
    confidenceLevel: 'high' | 'medium' | 'low';
  }> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT me.id) AS sample_size,
        AVG(CASE WHEN eo.measurement_period = '3mo' THEN eo.rent_change_pct END) AS avg_rent_3mo,
        AVG(CASE WHEN eo.measurement_period = '12mo' THEN eo.rent_change_pct END) AS avg_rent_12mo,
        AVG(CASE WHEN eo.measurement_period = '3mo' THEN eo.occupancy_change_pct END) AS avg_occ_3mo,
        AVG(CASE WHEN eo.measurement_period = '12mo' THEN eo.occupancy_change_pct END) AS avg_occ_12mo
      FROM market_events me
      LEFT JOIN event_outcomes eo ON eo.event_id = me.id
      WHERE me.event_type = $1
        AND me.status = 'completed'
    `, [eventType]);
    
    const row = result.rows[0];
    const sampleSize = parseInt(row.sample_size) || 0;
    
    return {
      eventType,
      sampleSize,
      avgRentImpact3mo: parseFloat(row.avg_rent_3mo) || 0,
      avgRentImpact12mo: parseFloat(row.avg_rent_12mo) || 0,
      avgOccupancyImpact3mo: parseFloat(row.avg_occ_3mo) || 0,
      avgOccupancyImpact12mo: parseFloat(row.avg_occ_12mo) || 0,
      confidenceLevel: sampleSize >= 10 ? 'high' : sampleSize >= 5 ? 'medium' : 'low'
    };
  }
  
  /**
   * Get supply pipeline (upcoming deliveries)
   */
  async getSupplyPipeline(
    submarket: string,
    lookAheadMonths: number = 36
  ): Promise<{
    totalUnits: number;
    byQuarter: Array<{ quarter: string; units: number; projects: number }>;
    projects: MarketEvent[];
  }> {
    const events = await this.pool.query(`
      SELECT me.*
      FROM market_events me
      WHERE me.event_type IN ('supply_delivery', 'supply_announced', 'supply_groundbreaking')
        AND (me.geography_id = $1 OR me.geography_type = 'msa')
        AND me.effective_date > CURRENT_DATE
        AND me.effective_date <= CURRENT_DATE + INTERVAL '${lookAheadMonths} months'
        AND me.status NOT IN ('cancelled')
      ORDER BY me.effective_date
    `, [submarket]);
    
    const projects = events.rows.map(row => this.mapRowToEvent(row));
    const totalUnits = projects.reduce((sum, p) => sum + (p.unitsAffected || 0), 0);
    
    // Group by quarter
    const byQuarter = new Map<string, { units: number; projects: number }>();
    for (const project of projects) {
      const quarter = this.getQuarter(project.effectiveDate);
      const existing = byQuarter.get(quarter) || { units: 0, projects: 0 };
      byQuarter.set(quarter, {
        units: existing.units + (project.unitsAffected || 0),
        projects: existing.projects + 1
      });
    }
    
    return {
      totalUnits,
      byQuarter: Array.from(byQuarter.entries()).map(([quarter, data]) => ({
        quarter,
        units: data.units,
        projects: data.projects
      })),
      projects
    };
  }
  
  /**
   * Get quarter string from date
   */
  private getQuarter(date: Date): string {
    const q = Math.ceil((date.getMonth() + 1) / 3);
    return `${date.getFullYear()}Q${q}`;
  }
  
  /**
   * Map database row to MarketEvent
   */
  private mapRowToEvent(row: any): MarketEvent {
    return {
      id: row.id,
      eventType: row.event_type,
      eventName: row.event_name,
      eventDescription: row.event_description,
      geographyType: row.geography_type,
      geographyId: row.geography_id,
      geographyName: row.geography_name,
      latitude: row.latitude ? parseFloat(row.latitude) : undefined,
      longitude: row.longitude ? parseFloat(row.longitude) : undefined,
      impactRadiusMiles: row.impact_radius_miles ? parseFloat(row.impact_radius_miles) : undefined,
      entityName: row.entity_name,
      entityType: row.entity_type,
      jobsAffected: row.jobs_affected,
      unitsAffected: row.units_affected,
      sqftAffected: row.sqft_affected,
      investmentAmount: row.investment_amount ? parseFloat(row.investment_amount) : undefined,
      announcedDate: row.announced_date ? new Date(row.announced_date) : undefined,
      groundbreakingDate: row.groundbreaking_date ? new Date(row.groundbreaking_date) : undefined,
      effectiveDate: new Date(row.effective_date),
      completionDate: row.completion_date ? new Date(row.completion_date) : undefined,
      expectedImpactDirection: row.expected_impact_direction,
      expectedImpactMagnitude: row.expected_impact_magnitude,
      expectedImpactDuration: row.expected_impact_duration,
      affectedMetrics: row.affected_metrics || [],
      sourceUrl: row.source_url,
      sourceType: row.source_type,
      sourceDate: row.source_date ? new Date(row.source_date) : undefined,
      status: row.status,
      confidenceScore: row.confidence_score ? parseFloat(row.confidence_score) : undefined,
      tags: row.tags || []
    };
  }
  
  /**
   * Map database row to EventOutcome
   */
  private mapRowToOutcome(row: any): EventOutcome {
    return {
      id: row.id,
      eventId: row.event_id,
      measurementPeriod: row.measurement_period,
      measurementStartDate: new Date(row.measurement_start_date),
      measurementEndDate: new Date(row.measurement_end_date),
      geographyType: row.geography_type,
      geographyId: row.geography_id,
      distanceFromEventMiles: row.distance_from_event_miles ? parseFloat(row.distance_from_event_miles) : undefined,
      rentChangePct: row.rent_change_pct ? parseFloat(row.rent_change_pct) : undefined,
      occupancyChangePct: row.occupancy_change_pct ? parseFloat(row.occupancy_change_pct) : undefined,
      absorptionUnits: row.absorption_units,
      capRateChangeBps: row.cap_rate_change_bps,
      pricePerUnitChangePct: row.price_per_unit_change_pct ? parseFloat(row.price_per_unit_change_pct) : undefined,
      concessionChangePct: row.concession_change_pct ? parseFloat(row.concession_change_pct) : undefined,
      searchVolumeChangePct: row.search_volume_change_pct ? parseFloat(row.search_volume_change_pct) : undefined,
      tourVolumeChangePct: row.tour_volume_change_pct ? parseFloat(row.tour_volume_change_pct) : undefined,
      applicationVolumeChangePct: row.application_volume_change_pct ? parseFloat(row.application_volume_change_pct) : undefined,
      attributionConfidence: row.attribution_confidence ? parseFloat(row.attribution_confidence) : undefined,
      confoundingFactors: row.confounding_factors,
      methodologyNotes: row.methodology_notes
    };
  }
}

// Singleton factory
let eventsServiceInstance: MarketEventsService | null = null;

export function getMarketEventsService(pool: Pool): MarketEventsService {
  if (!eventsServiceInstance) {
    eventsServiceInstance = new MarketEventsService(pool);
  }
  return eventsServiceInstance;
}
