/**
 * Demand Signal Service
 * Converts news events into quantified housing demand projections
 * 
 * Core Functions:
 * - Extract demand events from news (employment, university, military)
 * - Calculate housing demand using conversion factors
 * - Phase demand over time (quarterly projections)
 * - Income-based stratification
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { kafkaProducer } from './kafka/kafka-producer.service';
import { DemandSignalMessage, KAFKA_TOPICS } from './kafka/event-schemas';

export interface DemandEventInput {
  newsEventId: string;
  headline: string;
  sourceUrl?: string;
  publishedAt: Date;
  
  // Event Classification
  category: 'employment' | 'university' | 'military' | 'migration';
  eventType: string;
  
  // Demand Parameters
  peopleCount: number; // employees, students, military personnel
  incomeTier?: 'low' | 'standard' | 'high' | 'luxury';
  remoteWorkPct?: number; // % of jobs that are remote
  
  // Geographic Context
  msaId?: number;
  submarketId?: number;
  geographicTier?: 'pin_drop' | 'area' | 'metro';
  geographicConcentration?: number; // 0-1, defaults to 1
  
  // Optional Overrides
  conversionRateOverride?: number;
  phasingTemplate?: string;
}

export interface DemandEvent {
  id: string;
  newsEventId: string;
  demandEventTypeId: number;
  headline: string;
  sourceUrl?: string;
  publishedAt: Date;
  
  peopleCount: number;
  incomeTier: string;
  remoteWorkPct: number;
  conversionRate: number;
  geographicConcentration: number;
  
  totalUnits: number;
  affordablePct: number;
  workforcePct: number;
  luxuryPct: number;
  
  confidenceScore: number;
  confidenceFactors: any;
  
  msaId?: number;
  submarketId?: number;
  geographicTier?: string;
}

export interface DemandProjection {
  id: string;
  demandEventId: string;
  quarter: string;
  quarterStart: Date;
  quarterEnd: Date;
  unitsProjected: number;
  phasePct: number;
  affordableUnits: number;
  workforceUnits: number;
  luxuryUnits: number;
}

export interface TradeAreaDemandForecast {
  tradeAreaId: string;
  tradeAreaName: string;
  quarter: string;
  totalUnitsProjected: number;
  eventCount: number;
  affordableUnits: number;
  workforceUnits: number;
  luxuryUnits: number;
  positiveUnits: number;
  negativeUnits: number;
  netUnits: number;
  existingUnits?: number;
  pipelineUnits?: number;
  supplyPressureScore?: number;
  absorptionRisk?: string;
}

export interface IncomeStratification {
  affordablePct: number;
  workforcePct: number;
  luxuryPct: number;
}

class DemandSignalService {
  /**
   * Main entry point: Create demand event from news
   */
  async createDemandEvent(input: DemandEventInput): Promise<DemandEvent> {
    // Step 1: Get demand event type
    const eventType = await this.getDemandEventType(input.category, input.eventType);
    
    if (!eventType) {
      throw new Error(`Unknown demand event type: ${input.category}.${input.eventType}`);
    }
    
    // Step 2: Calculate conversion rate
    const conversionRate = input.conversionRateOverride || this.calculateConversionRate(
      eventType.default_conversion_rate,
      input.incomeTier || 'standard',
      input.category
    );
    
    // Step 3: Calculate total housing units needed
    const remoteWorkPct = input.remoteWorkPct || 0;
    const geographicConcentration = input.geographicConcentration || 1.0;
    
    const totalUnits = this.calculateHousingDemand(
      input.peopleCount,
      conversionRate,
      remoteWorkPct,
      geographicConcentration
    );
    
    // Step 4: Calculate income stratification
    const incomeStrat = this.calculateIncomeStratification(
      input.incomeTier || 'standard',
      input.category
    );
    
    // Step 5: Calculate confidence score
    const confidence = this.calculateConfidence(input, eventType);
    
    // Step 6: Insert demand event
    const result = await query(
      `INSERT INTO demand_events (
        news_event_id, demand_event_type_id, headline, source_url, published_at,
        people_count, income_tier, remote_work_pct, conversion_rate, geographic_concentration,
        total_units, affordable_pct, workforce_pct, luxury_pct,
        confidence_score, confidence_factors,
        msa_id, submarket_id, geographic_tier
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        input.newsEventId,
        eventType.id,
        input.headline,
        input.sourceUrl,
        input.publishedAt,
        input.peopleCount,
        input.incomeTier || 'standard',
        remoteWorkPct,
        conversionRate,
        geographicConcentration,
        totalUnits,
        incomeStrat.affordablePct,
        incomeStrat.workforcePct,
        incomeStrat.luxuryPct,
        confidence.score,
        JSON.stringify(confidence.factors),
        input.msaId,
        input.submarketId,
        input.geographicTier
      ]
    );
    
    const demandEvent = result.rows[0];
    
    logger.info('Demand event created', {
      id: demandEvent.id,
      totalUnits: demandEvent.total_units,
      category: input.category,
      eventType: input.eventType
    });
    
    // Step 7: Generate quarterly projections
    const projections = await this.generateProjections(
      demandEvent.id,
      totalUnits,
      incomeStrat,
      input.publishedAt,
      input.phasingTemplate || 'standard_hiring',
      eventType.demand_direction
    );
    
    // Step 8: Publish demand signal event to Kafka
    await this.publishDemandSignal(demandEvent, eventType, input, projections);
    
    return this.formatDemandEvent(demandEvent);
  }
  
  /**
   * Publish demand signal to Kafka event bus
   */
  private async publishDemandSignal(
    demandEvent: any,
    eventType: any,
    input: DemandEventInput,
    projections: any[]
  ): Promise<void> {
    try {
      // Build quarterly phasing object
      const quarterlyPhasing: Record<string, number> = {};
      projections.forEach(p => {
        quarterlyPhasing[p.quarter] = p.units_projected;
      });
      
      // Get trade area ID from geographic context
      const tradeAreaId = await this.getTradeAreaId(input.msaId, input.submarketId);
      
      const demandSignal: DemandSignalMessage = {
        eventId: demandEvent.id,
        eventType: 'demand_calculated',
        timestamp: new Date().toISOString(),
        signalId: demandEvent.id,
        tradeAreaId: tradeAreaId || 'unknown',
        housingUnitsNeeded: parseFloat(demandEvent.total_units),
        absorptionRateMonthly: parseFloat(demandEvent.total_units) / 12, // Simplified
        quarterlyPhasing,
        confidenceScore: demandEvent.confidence_score,
        triggeringEventId: input.newsEventId,
        calculationMethod: `${eventType.category}:${eventType.event_type}`,
        assumedOccupancyRate: 0.95, // Default assumption
        assumedHouseholdSize: 2.5,  // Default assumption
      };
      
      await kafkaProducer.publish(
        KAFKA_TOPICS.DEMAND_SIGNALS,
        demandSignal,
        {
          key: tradeAreaId || demandEvent.id,
          publishedBy: 'demand-signal-service',
        }
      );
      
      logger.info('Published demand signal to Kafka', {
        eventId: demandEvent.id,
        tradeAreaId,
        units: demandEvent.total_units,
      });
    } catch (error) {
      logger.error('Failed to publish demand signal to Kafka:', error);
      // Don't throw - Kafka failure shouldn't break demand calculation
    }
  }
  
  /**
   * Get trade area ID from geographic context
   */
  private async getTradeAreaId(msaId?: number, submarketId?: number): Promise<string | null> {
    if (!msaId && !submarketId) {
      return null;
    }
    
    try {
      const result = await query(
        `SELECT id FROM trade_areas 
         WHERE (msa_id = $1 OR $1 IS NULL)
           AND (submarket_id = $2 OR $2 IS NULL)
         LIMIT 1`,
        [msaId, submarketId]
      );
      
      return result.rows.length > 0 ? result.rows[0].id : null;
    } catch (error) {
      logger.error('Error getting trade area ID:', error);
      return null;
    }
  }
  
  /**
   * Calculate housing demand: Units = People × Conversion × (1 - Remote%) × Geographic Concentration
   */
  private calculateHousingDemand(
    peopleCount: number,
    conversionRate: number,
    remoteWorkPct: number,
    geographicConcentration: number
  ): number {
    const demand = peopleCount 
                   * conversionRate 
                   * (1 - (remoteWorkPct / 100)) 
                   * geographicConcentration;
    
    return Math.round(demand * 100) / 100; // Round to 2 decimals
  }
  
  /**
   * Calculate conversion rate based on income tier and category
   */
  private calculateConversionRate(
    baseRate: number,
    incomeTier: string,
    category: string
  ): number {
    let rate = baseRate;
    
    // Adjust by income tier (employment only)
    if (category === 'employment') {
      switch (incomeTier) {
        case 'low':
          rate = baseRate * 0.85; // Lower housing formation rate
          break;
        case 'standard':
          rate = baseRate; // 0.35-0.40
          break;
        case 'high':
          rate = baseRate * 1.4; // 0.50-0.56 (tech/finance)
          break;
        case 'luxury':
          rate = baseRate * 1.5; // 0.52-0.60
          break;
      }
    }
    
    // University students: 0.25-0.30
    // Military: 0.60-0.70 (already set in defaults)
    
    return Math.round(rate * 10000) / 10000; // 4 decimal places
  }
  
  /**
   * Calculate income stratification (% affordable, workforce, luxury)
   */
  private calculateIncomeStratification(
    incomeTier: string,
    category: string
  ): IncomeStratification {
    let affordablePct = 0;
    let workforcePct = 0;
    let luxuryPct = 0;
    
    if (category === 'employment') {
      switch (incomeTier) {
        case 'low':
          affordablePct = 60;
          workforcePct = 35;
          luxuryPct = 5;
          break;
        case 'standard':
          affordablePct = 20;
          workforcePct = 70;
          luxuryPct = 10;
          break;
        case 'high':
          affordablePct = 5;
          workforcePct = 40;
          luxuryPct = 55;
          break;
        case 'luxury':
          affordablePct = 0;
          workforcePct = 20;
          luxuryPct = 80;
          break;
      }
    } else if (category === 'university') {
      affordablePct = 40;
      workforcePct = 60;
      luxuryPct = 0;
    } else if (category === 'military') {
      affordablePct = 30;
      workforcePct = 65;
      luxuryPct = 5;
    }
    
    return { affordablePct, workforcePct, luxuryPct };
  }
  
  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(input: DemandEventInput, eventType: any): { score: number; factors: any } {
    let score = 50; // Base
    const factors: any = {};
    
    // Source reliability (placeholder - would integrate with news source ratings)
    const sourceReliability = input.sourceUrl?.includes('wsj.com') || input.sourceUrl?.includes('bloomberg.com') ? 90 : 70;
    factors.source_reliability = sourceReliability;
    score += (sourceReliability - 50) * 0.3;
    
    // Data completeness
    let completeness = 50;
    if (input.peopleCount > 0) completeness += 20;
    if (input.msaId) completeness += 15;
    if (input.submarketId) completeness += 15;
    factors.data_completeness = completeness;
    score += (completeness - 50) * 0.3;
    
    // Event specificity
    const specificity = input.geographicTier === 'pin_drop' ? 90 : input.geographicTier === 'area' ? 70 : 50;
    factors.geographic_specificity = specificity;
    score += (specificity - 50) * 0.2;
    
    // Time freshness
    const daysSincePublished = (Date.now() - input.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    const freshness = daysSincePublished <= 7 ? 90 : daysSincePublished <= 30 ? 70 : 50;
    factors.time_freshness = freshness;
    score += (freshness - 50) * 0.2;
    
    score = Math.max(0, Math.min(100, Math.round(score)));
    
    return { score, factors };
  }
  
  /**
   * Generate quarterly projections with phasing
   */
  private async generateProjections(
    demandEventId: string,
    totalUnits: number,
    incomeStrat: IncomeStratification,
    publishedAt: Date,
    phasingTemplate: string,
    demandDirection: string
  ): Promise<any[]> {
    // Get phasing template
    const templateResult = await query(
      `SELECT phase_distribution FROM demand_phasing_templates WHERE name = $1`,
      [phasingTemplate]
    );
    
    if (templateResult.rows.length === 0) {
      throw new Error(`Phasing template not found: ${phasingTemplate}`);
    }
    
    const phaseDistribution = templateResult.rows[0].phase_distribution;
    
    // Calculate start quarter (next quarter after published date)
    const startQuarter = this.getNextQuarter(publishedAt);
    
    // Generate projections for each phase
    const projections: any[] = [];
    let quarterCursor = startQuarter;
    
    for (const [quarterOffset, phasePct] of Object.entries(phaseDistribution)) {
      const unitsThisQuarter = (totalUnits * (phasePct as number)) / 100;
      
      // Apply direction (negative for layoffs/closures)
      const adjustedUnits = demandDirection === 'negative' ? -unitsThisQuarter : unitsThisQuarter;
      
      const quarterInfo = this.parseQuarter(quarterCursor);
      
      await query(
        `INSERT INTO demand_projections (
          demand_event_id, quarter, quarter_start, quarter_end,
          units_projected, phase_pct,
          affordable_units, workforce_units, luxury_units
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          demandEventId,
          quarterCursor,
          quarterInfo.start,
          quarterInfo.end,
          adjustedUnits,
          phasePct,
          (adjustedUnits * incomeStrat.affordablePct) / 100,
          (adjustedUnits * incomeStrat.workforcePct) / 100,
          (adjustedUnits * incomeStrat.luxuryPct) / 100
        ]
      );
      
      // Track projection for return
      projections.push({
        quarter: quarterCursor,
        units_projected: adjustedUnits,
        phase_pct: phasePct,
      });
      
      quarterCursor = this.incrementQuarter(quarterCursor);
    }
    
    logger.info('Demand projections generated', {
      demandEventId,
      quarters: Object.keys(phaseDistribution).length,
      totalUnits
    });
    
    return projections;
  }
  
  /**
   * Aggregate demand for a trade area
   */
  async aggregateTradeAreaDemand(tradeAreaId: string, quarter: string): Promise<void> {
    // Get all demand events affecting this trade area
    const result = await query(
      `SELECT 
        de.id,
        de.demand_event_type_id,
        det.demand_direction,
        dp.units_projected,
        dp.affordable_units,
        dp.workforce_units,
        dp.luxury_units
       FROM demand_projections dp
       JOIN demand_events de ON de.id = dp.demand_event_id
       JOIN demand_event_types det ON det.id = de.demand_event_type_id
       JOIN trade_area_event_impacts taei ON taei.event_id = de.news_event_id
       WHERE taei.trade_area_id = $1
         AND dp.quarter = $2`,
      [tradeAreaId, quarter]
    );
    
    if (result.rows.length === 0) {
      return; // No demand events for this trade area in this quarter
    }
    
    // Aggregate
    let totalUnits = 0;
    let affordableUnits = 0;
    let workforceUnits = 0;
    let luxuryUnits = 0;
    let positiveUnits = 0;
    let negativeUnits = 0;
    
    for (const row of result.rows) {
      totalUnits += parseFloat(row.units_projected);
      affordableUnits += parseFloat(row.affordable_units);
      workforceUnits += parseFloat(row.workforce_units);
      luxuryUnits += parseFloat(row.luxury_units);
      
      if (row.demand_direction === 'positive') {
        positiveUnits += parseFloat(row.units_projected);
      } else if (row.demand_direction === 'negative') {
        negativeUnits += Math.abs(parseFloat(row.units_projected));
      }
    }
    
    const netUnits = positiveUnits - negativeUnits;
    
    // Get trade area stats
    const taResult = await query(
      `SELECT stats_snapshot FROM trade_areas WHERE id = $1`,
      [tradeAreaId]
    );
    
    const stats = taResult.rows[0]?.stats_snapshot || {};
    const existingUnits = stats.existing_units || 10000;
    const pipelineUnits = stats.pipeline_units || 0;
    const occupancy = stats.occupancy || 90;
    
    // Calculate supply pressure
    const supplyPressureScore = (netUnits / existingUnits) * 100;
    
    // Determine absorption risk
    let absorptionRisk = 'low';
    if (supplyPressureScore > 15) absorptionRisk = 'critical';
    else if (supplyPressureScore > 10) absorptionRisk = 'high';
    else if (supplyPressureScore > 5) absorptionRisk = 'medium';
    
    // Upsert forecast
    await query(
      `INSERT INTO trade_area_demand_forecast (
        trade_area_id, quarter,
        total_units_projected, event_count,
        affordable_units, workforce_units, luxury_units,
        positive_units, negative_units, net_units,
        existing_units, pipeline_units, current_occupancy,
        supply_pressure_score, absorption_risk
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (trade_area_id, quarter) DO UPDATE SET
        total_units_projected = EXCLUDED.total_units_projected,
        event_count = EXCLUDED.event_count,
        affordable_units = EXCLUDED.affordable_units,
        workforce_units = EXCLUDED.workforce_units,
        luxury_units = EXCLUDED.luxury_units,
        positive_units = EXCLUDED.positive_units,
        negative_units = EXCLUDED.negative_units,
        net_units = EXCLUDED.net_units,
        supply_pressure_score = EXCLUDED.supply_pressure_score,
        absorption_risk = EXCLUDED.absorption_risk,
        last_updated = NOW()`,
      [
        tradeAreaId, quarter,
        totalUnits, result.rows.length,
        affordableUnits, workforceUnits, luxuryUnits,
        positiveUnits, negativeUnits, netUnits,
        existingUnits, pipelineUnits, occupancy,
        supplyPressureScore, absorptionRisk
      ]
    );
    
    logger.info('Trade area demand aggregated', { tradeAreaId, quarter, netUnits });
  }
  
  /**
   * Get demand forecast for trade area
   */
  async getTradeAreaForecast(
    tradeAreaId: string,
    startQuarter?: string,
    endQuarter?: string
  ): Promise<TradeAreaDemandForecast[]> {
    let sql = `
      SELECT 
        tadf.*,
        ta.name as trade_area_name
      FROM trade_area_demand_forecast tadf
      JOIN trade_areas ta ON ta.id = tadf.trade_area_id
      WHERE tadf.trade_area_id = $1
    `;
    
    const params: any[] = [tradeAreaId];
    
    if (startQuarter) {
      sql += ` AND tadf.quarter >= $${params.length + 1}`;
      params.push(startQuarter);
    }
    
    if (endQuarter) {
      sql += ` AND tadf.quarter <= $${params.length + 1}`;
      params.push(endQuarter);
    }
    
    sql += ` ORDER BY tadf.quarter`;
    
    const result = await query(sql, params);
    
    return result.rows.map(row => ({
      tradeAreaId: row.trade_area_id,
      tradeAreaName: row.trade_area_name,
      quarter: row.quarter,
      totalUnitsProjected: parseFloat(row.total_units_projected),
      eventCount: row.event_count,
      affordableUnits: parseFloat(row.affordable_units),
      workforceUnits: parseFloat(row.workforce_units),
      luxuryUnits: parseFloat(row.luxury_units),
      positiveUnits: parseFloat(row.positive_units),
      negativeUnits: parseFloat(row.negative_units),
      netUnits: parseFloat(row.net_units),
      existingUnits: row.existing_units,
      pipelineUnits: row.pipeline_units,
      supplyPressureScore: row.supply_pressure_score ? parseFloat(row.supply_pressure_score) : undefined,
      absorptionRisk: row.absorption_risk
    }));
  }
  
  /**
   * Get demand events list
   */
  async getDemandEvents(filters?: {
    msaId?: number;
    submarketId?: number;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<DemandEvent[]> {
    let sql = `
      SELECT de.*, det.category, det.event_type, det.demand_direction
      FROM demand_events de
      JOIN demand_event_types det ON det.id = de.demand_event_type_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (filters?.msaId) {
      sql += ` AND de.msa_id = $${params.length + 1}`;
      params.push(filters.msaId);
    }
    
    if (filters?.submarketId) {
      sql += ` AND de.submarket_id = $${params.length + 1}`;
      params.push(filters.submarketId);
    }
    
    if (filters?.category) {
      sql += ` AND det.category = $${params.length + 1}`;
      params.push(filters.category);
    }
    
    if (filters?.startDate) {
      sql += ` AND de.published_at >= $${params.length + 1}`;
      params.push(filters.startDate);
    }
    
    if (filters?.endDate) {
      sql += ` AND de.published_at <= $${params.length + 1}`;
      params.push(filters.endDate);
    }
    
    sql += ` ORDER BY de.published_at DESC LIMIT $${params.length + 1}`;
    params.push(filters?.limit || 50);
    
    const result = await query(sql, params);
    
    return result.rows.map(row => this.formatDemandEvent(row));
  }
  
  // ========================================
  // Helper Functions
  // ========================================
  
  private async getDemandEventType(category: string, eventType: string): Promise<any> {
    const result = await query(
      `SELECT * FROM demand_event_types WHERE category = $1 AND event_type = $2`,
      [category, eventType]
    );
    
    return result.rows[0] || null;
  }
  
  private getNextQuarter(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    
    // Move to next quarter
    let nextQuarter = quarter + 1;
    let nextYear = year;
    
    if (nextQuarter > 4) {
      nextQuarter = 1;
      nextYear += 1;
    }
    
    return `${nextYear}-Q${nextQuarter}`;
  }
  
  private incrementQuarter(quarterStr: string): string {
    const [year, q] = quarterStr.split('-Q');
    let quarter = parseInt(q);
    let nextYear = parseInt(year);
    
    quarter += 1;
    if (quarter > 4) {
      quarter = 1;
      nextYear += 1;
    }
    
    return `${nextYear}-Q${quarter}`;
  }
  
  private parseQuarter(quarterStr: string): { start: Date; end: Date } {
    const [year, q] = quarterStr.split('-Q');
    const quarter = parseInt(q);
    
    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 3;
    
    const start = new Date(parseInt(year), startMonth, 1);
    const end = new Date(parseInt(year), endMonth, 0); // Last day of quarter
    
    return { start, end };
  }
  
  private formatDemandEvent(row: any): DemandEvent {
    return {
      id: row.id,
      newsEventId: row.news_event_id,
      demandEventTypeId: row.demand_event_type_id,
      headline: row.headline,
      sourceUrl: row.source_url,
      publishedAt: row.published_at,
      peopleCount: row.people_count,
      incomeTier: row.income_tier,
      remoteWorkPct: parseFloat(row.remote_work_pct),
      conversionRate: parseFloat(row.conversion_rate),
      geographicConcentration: parseFloat(row.geographic_concentration),
      totalUnits: parseFloat(row.total_units),
      affordablePct: parseFloat(row.affordable_pct),
      workforcePct: parseFloat(row.workforce_pct),
      luxuryPct: parseFloat(row.luxury_pct),
      confidenceScore: parseFloat(row.confidence_score),
      confidenceFactors: row.confidence_factors,
      msaId: row.msa_id,
      submarketId: row.submarket_id,
      geographicTier: row.geographic_tier
    };
  }
}

export const demandSignalService = new DemandSignalService();
