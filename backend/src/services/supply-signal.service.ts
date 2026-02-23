/**
 * Supply Signal Service
 * Track construction pipeline (permits, starts, completions) and calculate supply risk
 * 
 * Core Functions:
 * - Track construction pipeline by trade area
 * - Calculate supply pressure and risk
 * - Phase supply deliveries over time
 * - Identify competitive projects
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';

export interface SupplyEventInput {
  projectName?: string;
  developer?: string;
  address?: string;
  
  // Event Classification
  category: 'permit' | 'construction' | 'completion' | 'demolition' | 'policy';
  eventType: string;
  
  // Units
  units: number; // positive for additions, negative handled by supply_direction
  studioUnits?: number;
  oneBedUnits?: number;
  twoBedUnits?: number;
  threeBedUnits?: number;
  
  // Pricing
  avgRent?: number;
  priceTier?: 'affordable' | 'workforce' | 'market_rate' | 'luxury';
  
  // Timeline
  eventDate: Date; // permit date, groundbreaking, etc.
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  
  // Status
  status: 'permitted' | 'under_construction' | 'delivered' | 'cancelled' | 'demolished';
  
  // Geographic
  latitude?: number;
  longitude?: number;
  msaId?: number;
  submarketId?: number;
  
  // Source
  newsEventId?: string;
  sourceType?: 'news' | 'costar' | 'permit_database' | 'manual';
  sourceUrl?: string;
  dataSourceConfidence?: number;
  
  notes?: string;
}

export interface SupplyEvent {
  id: string;
  supplyEventTypeId: number;
  projectName?: string;
  developer?: string;
  units: number;
  weightedUnits: number;
  status: string;
  eventDate: Date;
  expectedDeliveryDate?: Date;
  priceTier?: string;
  latitude?: number;
  longitude?: number;
  msaId?: number;
  submarketId?: number;
}

export interface SupplyPipeline {
  tradeAreaId: number;
  permittedProjects: number;
  permittedUnits: number;
  permittedWeightedUnits: number;
  constructionProjects: number;
  constructionUnits: number;
  constructionWeightedUnits: number;
  delivered12moProjects: number;
  delivered12moUnits: number;
  totalPipelineProjects: number;
  totalPipelineUnits: number;
  totalWeightedUnits: number;
  existingUnits: number;
  lastUpdated: Date;
}

export interface SupplyRiskScore {
  tradeAreaId: number;
  tradeAreaName?: string;
  quarter: string;
  pipelineUnits: number;
  weightedPipelineUnits: number;
  existingUnits: number;
  supplyRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  monthsToAbsorb?: number;
  absorptionRisk?: 'low' | 'medium' | 'high' | 'critical';
  demandUnits?: number;
  demandSupplyGap?: number;
  netMarketPressure?: number;
}

export interface CompetitiveProject {
  dealId: string;
  supplyEventId: string;
  projectName?: string;
  units: number;
  distanceMiles: number;
  competitiveImpact: 'direct' | 'moderate' | 'weak';
  impactWeight: number;
  priceTierMatch: boolean;
  deliveryTiming: string;
  expectedDeliveryDate?: Date;
}

export interface SupplyDeliveryTimeline {
  quarter: string;
  quarterStart: Date;
  quarterEnd: Date;
  projects: {
    projectName?: string;
    units: number;
    weightedUnits: number;
    status: string;
  }[];
  totalUnits: number;
  totalWeightedUnits: number;
}

class SupplySignalService {
  /**
   * Create supply event (permit, construction start, completion, etc.)
   */
  async createSupplyEvent(input: SupplyEventInput): Promise<SupplyEvent> {
    // Get supply event type
    const eventType = await this.getSupplyEventType(input.category, input.eventType);
    
    if (!eventType) {
      throw new Error(`Unknown supply event type: ${input.category}.${input.eventType}`);
    }
    
    // Calculate weighted units (probability-adjusted)
    const weightedUnits = input.units * eventType.weight_factor;
    
    // Insert supply event
    const result = await query(
      `INSERT INTO supply_events (
        supply_event_type_id, project_name, developer, address,
        units, weighted_units,
        studio_units, one_bed_units, two_bed_units, three_bed_units,
        avg_rent, price_tier,
        event_date, expected_delivery_date, actual_delivery_date,
        status,
        latitude, longitude, msa_id, submarket_id,
        news_event_id, source_type, source_url, data_source_confidence,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *`,
      [
        eventType.id,
        input.projectName,
        input.developer,
        input.address,
        input.units,
        weightedUnits,
        input.studioUnits || 0,
        input.oneBedUnits || 0,
        input.twoBedUnits || 0,
        input.threeBedUnits || 0,
        input.avgRent,
        input.priceTier,
        input.eventDate,
        input.expectedDeliveryDate,
        input.actualDeliveryDate,
        input.status,
        input.latitude,
        input.longitude,
        input.msaId,
        input.submarketId,
        input.newsEventId,
        input.sourceType || 'manual',
        input.sourceUrl,
        input.dataSourceConfidence || 70.0,
        input.notes
      ]
    );
    
    const supplyEvent = result.rows[0];
    
    logger.info('Supply event created', {
      id: supplyEvent.id,
      projectName: supplyEvent.project_name,
      units: supplyEvent.units,
      weightedUnits: supplyEvent.weighted_units,
      status: supplyEvent.status
    });
    
    // Generate delivery timeline if expected delivery date exists
    if (input.expectedDeliveryDate) {
      await this.generateDeliveryTimeline(
        supplyEvent.id,
        input.units,
        weightedUnits,
        input.expectedDeliveryDate,
        input.status
      );
    }
    
    return this.formatSupplyEvent(supplyEvent);
  }
  
  /**
   * Update supply event status (permit → construction → delivered)
   */
  async updateSupplyEventStatus(
    eventId: string,
    newStatus: 'permitted' | 'under_construction' | 'delivered' | 'cancelled' | 'demolished',
    actualDeliveryDate?: Date
  ): Promise<void> {
    // Get current event
    const currentResult = await query(
      `SELECT * FROM supply_events WHERE id = $1`,
      [eventId]
    );
    
    if (currentResult.rows.length === 0) {
      throw new Error(`Supply event not found: ${eventId}`);
    }
    
    const currentEvent = currentResult.rows[0];
    
    // Get new weight factor
    let newWeightFactor = 1.0;
    if (newStatus === 'permitted') newWeightFactor = 0.6;
    else if (newStatus === 'under_construction') newWeightFactor = 0.9;
    else if (newStatus === 'delivered') newWeightFactor = 1.0;
    
    const newWeightedUnits = currentEvent.units * newWeightFactor;
    
    // Update event
    await query(
      `UPDATE supply_events 
       SET status = $1, weighted_units = $2, actual_delivery_date = $3, updated_at = NOW()
       WHERE id = $4`,
      [newStatus, newWeightedUnits, actualDeliveryDate, eventId]
    );
    
    logger.info('Supply event status updated', {
      id: eventId,
      oldStatus: currentEvent.status,
      newStatus,
      newWeightedUnits
    });
    
    // Regenerate delivery timeline if needed
    if (currentEvent.expected_delivery_date) {
      await this.regenerateDeliveryTimeline(eventId);
    }
  }
  
  /**
   * Get supply pipeline for trade area
   */
  async getSupplyPipeline(tradeAreaId: number): Promise<SupplyPipeline> {
    // Update pipeline first
    await query(`SELECT update_supply_pipeline($1)`, [tradeAreaId]);
    
    // Get pipeline data
    const result = await query(
      `SELECT * FROM supply_pipeline WHERE trade_area_id = $1`,
      [tradeAreaId]
    );
    
    if (result.rows.length === 0) {
      // Return empty pipeline
      return {
        tradeAreaId,
        permittedProjects: 0,
        permittedUnits: 0,
        permittedWeightedUnits: 0,
        constructionProjects: 0,
        constructionUnits: 0,
        constructionWeightedUnits: 0,
        delivered12moProjects: 0,
        delivered12moUnits: 0,
        totalPipelineProjects: 0,
        totalPipelineUnits: 0,
        totalWeightedUnits: 0,
        existingUnits: 10000,
        lastUpdated: new Date()
      };
    }
    
    return this.formatSupplyPipeline(result.rows[0]);
  }
  
  /**
   * Calculate supply risk score for trade area
   */
  async calculateSupplyRisk(
    tradeAreaId: number,
    quarter: string,
    demandUnits?: number
  ): Promise<SupplyRiskScore> {
    // Get pipeline
    const pipeline = await this.getSupplyPipeline(tradeAreaId);
    
    // Calculate supply risk score: (pipeline ÷ existing) × 100
    const supplyRiskScore = (pipeline.totalWeightedUnits / pipeline.existingUnits) * 100;
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (supplyRiskScore >= 35) riskLevel = 'critical';
    else if (supplyRiskScore >= 20) riskLevel = 'high';
    else if (supplyRiskScore >= 10) riskLevel = 'medium';
    
    // Calculate absorption metrics
    const historicalMonthlyAbsorption = pipeline.existingUnits * 0.015; // 1.5% per month (placeholder)
    const monthsToAbsorb = pipeline.totalWeightedUnits / historicalMonthlyAbsorption;
    
    let absorptionRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (monthsToAbsorb > 36) absorptionRisk = 'critical';
    else if (monthsToAbsorb > 24) absorptionRisk = 'high';
    else if (monthsToAbsorb > 12) absorptionRisk = 'medium';
    
    // Demand-supply gap (if demand data provided)
    let demandSupplyGap: number | undefined;
    let netMarketPressure: number | undefined;
    
    if (demandUnits !== undefined) {
      demandSupplyGap = demandUnits - pipeline.totalWeightedUnits;
      netMarketPressure = (demandSupplyGap / pipeline.existingUnits) * 100;
    }
    
    // Parse quarter dates
    const quarterDates = this.parseQuarter(quarter);
    
    // Upsert supply risk score
    await query(
      `INSERT INTO supply_risk_scores (
        trade_area_id, quarter,
        pipeline_units, weighted_pipeline_units, existing_units,
        supply_risk_score, risk_level,
        historical_monthly_absorption, months_to_absorb, absorption_risk,
        demand_units, demand_supply_gap, net_market_pressure
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (trade_area_id, quarter) DO UPDATE SET
        pipeline_units = EXCLUDED.pipeline_units,
        weighted_pipeline_units = EXCLUDED.weighted_pipeline_units,
        supply_risk_score = EXCLUDED.supply_risk_score,
        risk_level = EXCLUDED.risk_level,
        months_to_absorb = EXCLUDED.months_to_absorb,
        absorption_risk = EXCLUDED.absorption_risk,
        demand_units = EXCLUDED.demand_units,
        demand_supply_gap = EXCLUDED.demand_supply_gap,
        net_market_pressure = EXCLUDED.net_market_pressure,
        calculated_at = NOW()`,
      [
        tradeAreaId,
        quarter,
        pipeline.totalPipelineUnits,
        pipeline.totalWeightedUnits,
        pipeline.existingUnits,
        supplyRiskScore,
        riskLevel,
        historicalMonthlyAbsorption,
        monthsToAbsorb,
        absorptionRisk,
        demandUnits,
        demandSupplyGap,
        netMarketPressure
      ]
    );
    
    logger.info('Supply risk calculated', {
      tradeAreaId,
      quarter,
      supplyRiskScore,
      riskLevel,
      monthsToAbsorb
    });
    
    return {
      tradeAreaId,
      quarter,
      pipelineUnits: pipeline.totalPipelineUnits,
      weightedPipelineUnits: pipeline.totalWeightedUnits,
      existingUnits: pipeline.existingUnits,
      supplyRiskScore: parseFloat(supplyRiskScore.toFixed(2)),
      riskLevel,
      monthsToAbsorb: parseFloat(monthsToAbsorb.toFixed(2)),
      absorptionRisk,
      demandUnits,
      demandSupplyGap,
      netMarketPressure: netMarketPressure ? parseFloat(netMarketPressure.toFixed(2)) : undefined
    };
  }
  
  /**
   * Get competitive projects near a deal
   */
  async getCompetitiveProjects(dealId: string, maxDistanceMiles: number = 3.0): Promise<CompetitiveProject[]> {
    // Get deal location
    const dealResult = await query(
      `SELECT latitude, longitude, unit_count, price_tier, acquisition_date
       FROM deals WHERE id = $1`,
      [dealId]
    );
    
    if (dealResult.rows.length === 0) {
      throw new Error(`Deal not found: ${dealId}`);
    }
    
    const deal = dealResult.rows[0];
    
    if (!deal.latitude || !deal.longitude) {
      throw new Error(`Deal has no location data: ${dealId}`);
    }
    
    // Find nearby supply events using Haversine formula
    const result = await query(
      `SELECT 
        se.*,
        (
          3959 * acos(
            cos(radians($1)) * cos(radians(se.latitude)) * 
            cos(radians(se.longitude) - radians($2)) + 
            sin(radians($1)) * sin(radians(se.latitude))
          )
        ) AS distance_miles
       FROM supply_events se
       WHERE se.latitude IS NOT NULL 
         AND se.longitude IS NOT NULL
         AND se.status IN ('permitted', 'under_construction', 'delivered')
       HAVING distance_miles <= $3
       ORDER BY distance_miles`,
      [deal.latitude, deal.longitude, maxDistanceMiles]
    );
    
    const competitiveProjects: CompetitiveProject[] = [];
    
    for (const row of result.rows) {
      const distanceMiles = parseFloat(row.distance_miles);
      
      // Determine competitive impact
      let competitiveImpact: 'direct' | 'moderate' | 'weak' = 'weak';
      let impactWeight = 0.25;
      
      if (distanceMiles <= 1.0) {
        competitiveImpact = 'direct';
        impactWeight = 1.0;
      } else if (distanceMiles <= 2.0) {
        competitiveImpact = 'moderate';
        impactWeight = 0.5;
      }
      
      // Check price tier match
      const priceTierMatch = row.price_tier === deal.price_tier;
      
      // Determine delivery timing
      let deliveryTiming = 'unknown';
      if (deal.acquisition_date && row.expected_delivery_date) {
        const acquisitionDate = new Date(deal.acquisition_date);
        const deliveryDate = new Date(row.expected_delivery_date);
        
        if (deliveryDate < acquisitionDate) {
          deliveryTiming = 'before_acquisition';
        } else if (deliveryDate < new Date(acquisitionDate.getTime() + 365 * 24 * 60 * 60 * 1000)) {
          deliveryTiming = 'concurrent';
        } else {
          deliveryTiming = 'after_stabilization';
        }
      }
      
      // Insert competitive project record
      await query(
        `INSERT INTO competitive_projects (
          deal_id, supply_event_id, distance_miles, competitive_impact, impact_weight,
          unit_count_difference, price_tier_match, delivery_timing
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (deal_id, supply_event_id) DO UPDATE SET
          distance_miles = EXCLUDED.distance_miles,
          competitive_impact = EXCLUDED.competitive_impact,
          impact_weight = EXCLUDED.impact_weight,
          delivery_timing = EXCLUDED.delivery_timing`,
        [
          dealId,
          row.id,
          distanceMiles,
          competitiveImpact,
          impactWeight,
          row.units - (deal.unit_count || 0),
          priceTierMatch,
          deliveryTiming
        ]
      );
      
      competitiveProjects.push({
        dealId,
        supplyEventId: row.id,
        projectName: row.project_name,
        units: row.units,
        distanceMiles: parseFloat(distanceMiles.toFixed(2)),
        competitiveImpact,
        impactWeight,
        priceTierMatch,
        deliveryTiming,
        expectedDeliveryDate: row.expected_delivery_date
      });
    }
    
    logger.info('Competitive projects analyzed', {
      dealId,
      competitorCount: competitiveProjects.length
    });
    
    return competitiveProjects;
  }
  
  /**
   * Get supply delivery timeline for trade area
   */
  async getSupplyDeliveryTimeline(
    tradeAreaId: number,
    startQuarter?: string,
    endQuarter?: string
  ): Promise<SupplyDeliveryTimeline[]> {
    let sql = `
      SELECT 
        sdt.quarter,
        sdt.quarter_start,
        sdt.quarter_end,
        se.project_name,
        se.units,
        sdt.weighted_units_delivered,
        se.status
      FROM supply_delivery_timeline sdt
      JOIN supply_events se ON se.id = sdt.supply_event_id
      JOIN trade_area_event_impacts taei ON taei.event_id = se.news_event_id
      WHERE taei.trade_area_id = $1
    `;
    
    const params: any[] = [tradeAreaId];
    
    if (startQuarter) {
      sql += ` AND sdt.quarter >= $${params.length + 1}`;
      params.push(startQuarter);
    }
    
    if (endQuarter) {
      sql += ` AND sdt.quarter <= $${params.length + 1}`;
      params.push(endQuarter);
    }
    
    sql += ` ORDER BY sdt.quarter, se.project_name`;
    
    const result = await query(sql, params);
    
    // Group by quarter
    const timelineMap = new Map<string, SupplyDeliveryTimeline>();
    
    for (const row of result.rows) {
      if (!timelineMap.has(row.quarter)) {
        timelineMap.set(row.quarter, {
          quarter: row.quarter,
          quarterStart: row.quarter_start,
          quarterEnd: row.quarter_end,
          projects: [],
          totalUnits: 0,
          totalWeightedUnits: 0
        });
      }
      
      const timeline = timelineMap.get(row.quarter)!;
      timeline.projects.push({
        projectName: row.project_name,
        units: row.units,
        weightedUnits: parseFloat(row.weighted_units_delivered),
        status: row.status
      });
      timeline.totalUnits += row.units;
      timeline.totalWeightedUnits += parseFloat(row.weighted_units_delivered);
    }
    
    return Array.from(timelineMap.values());
  }
  
  /**
   * List supply events
   */
  async getSupplyEvents(filters?: {
    msaId?: number;
    submarketId?: number;
    status?: string;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SupplyEvent[]> {
    let sql = `
      SELECT se.*, set.category, set.event_type
      FROM supply_events se
      JOIN supply_event_types set ON set.id = se.supply_event_type_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (filters?.msaId) {
      sql += ` AND se.msa_id = $${params.length + 1}`;
      params.push(filters.msaId);
    }
    
    if (filters?.submarketId) {
      sql += ` AND se.submarket_id = $${params.length + 1}`;
      params.push(filters.submarketId);
    }
    
    if (filters?.status) {
      sql += ` AND se.status = $${params.length + 1}`;
      params.push(filters.status);
    }
    
    if (filters?.category) {
      sql += ` AND set.category = $${params.length + 1}`;
      params.push(filters.category);
    }
    
    if (filters?.startDate) {
      sql += ` AND se.event_date >= $${params.length + 1}`;
      params.push(filters.startDate);
    }
    
    if (filters?.endDate) {
      sql += ` AND se.event_date <= $${params.length + 1}`;
      params.push(filters.endDate);
    }
    
    sql += ` ORDER BY se.event_date DESC LIMIT $${params.length + 1}`;
    params.push(filters?.limit || 50);
    
    const result = await query(sql, params);
    
    return result.rows.map(row => this.formatSupplyEvent(row));
  }
  
  // ========================================
  // Helper Functions
  // ========================================
  
  private async getSupplyEventType(category: string, eventType: string): Promise<any> {
    const result = await query(
      `SELECT * FROM supply_event_types WHERE category = $1 AND event_type = $2`,
      [category, eventType]
    );
    
    return result.rows[0] || null;
  }
  
  private async generateDeliveryTimeline(
    supplyEventId: string,
    units: number,
    weightedUnits: number,
    expectedDeliveryDate: Date,
    status: string
  ): Promise<void> {
    // Determine delivery quarter
    const deliveryQuarter = this.dateToQuarter(expectedDeliveryDate);
    const quarterDates = this.parseQuarter(deliveryQuarter);
    
    // For simplicity, deliver all units in the delivery quarter
    // (Could be enhanced with phasing across multiple quarters)
    
    await query(
      `INSERT INTO supply_delivery_timeline (
        supply_event_id, quarter, quarter_start, quarter_end,
        units_delivered, weighted_units_delivered
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (supply_event_id, quarter) DO UPDATE SET
        units_delivered = EXCLUDED.units_delivered,
        weighted_units_delivered = EXCLUDED.weighted_units_delivered`,
      [supplyEventId, deliveryQuarter, quarterDates.start, quarterDates.end, units, weightedUnits]
    );
  }
  
  private async regenerateDeliveryTimeline(supplyEventId: string): Promise<void> {
    // Delete existing timeline
    await query(`DELETE FROM supply_delivery_timeline WHERE supply_event_id = $1`, [supplyEventId]);
    
    // Get event details
    const result = await query(`SELECT * FROM supply_events WHERE id = $1`, [supplyEventId]);
    
    if (result.rows.length > 0) {
      const event = result.rows[0];
      if (event.expected_delivery_date) {
        await this.generateDeliveryTimeline(
          event.id,
          event.units,
          event.weighted_units,
          event.expected_delivery_date,
          event.status
        );
      }
    }
  }
  
  private dateToQuarter(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }
  
  private parseQuarter(quarterStr: string): { start: Date; end: Date } {
    const [year, q] = quarterStr.split('-Q');
    const quarter = parseInt(q);
    
    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 3;
    
    const start = new Date(parseInt(year), startMonth, 1);
    const end = new Date(parseInt(year), endMonth, 0);
    
    return { start, end };
  }
  
  private formatSupplyEvent(row: any): SupplyEvent {
    return {
      id: row.id,
      supplyEventTypeId: row.supply_event_type_id,
      projectName: row.project_name,
      developer: row.developer,
      units: row.units,
      weightedUnits: parseFloat(row.weighted_units),
      status: row.status,
      eventDate: row.event_date,
      expectedDeliveryDate: row.expected_delivery_date,
      priceTier: row.price_tier,
      latitude: row.latitude ? parseFloat(row.latitude) : undefined,
      longitude: row.longitude ? parseFloat(row.longitude) : undefined,
      msaId: row.msa_id,
      submarketId: row.submarket_id
    };
  }
  
  private formatSupplyPipeline(row: any): SupplyPipeline {
    return {
      tradeAreaId: row.trade_area_id,
      permittedProjects: row.permitted_projects,
      permittedUnits: row.permitted_units,
      permittedWeightedUnits: parseFloat(row.permitted_weighted_units),
      constructionProjects: row.construction_projects,
      constructionUnits: row.construction_units,
      constructionWeightedUnits: parseFloat(row.construction_weighted_units),
      delivered12moProjects: row.delivered_12mo_projects,
      delivered12moUnits: row.delivered_12mo_units,
      totalPipelineProjects: row.total_pipeline_projects,
      totalPipelineUnits: row.total_pipeline_units,
      totalWeightedUnits: parseFloat(row.total_weighted_units),
      existingUnits: row.existing_units,
      lastUpdated: row.last_updated
    };
  }
}

export const supplySignalService = new SupplySignalService();
