/**
 * JEDI Score Service
 * 
 * Calculates and manages JEDI Scores for real estate deals based on 5 signals:
 * - Demand (30%): Employment events, population growth, economic indicators
 * - Supply (25%): Pipeline units, absorption rates, vacancy trends
 * - Momentum (20%): Rent growth, transaction velocity, market sentiment
 * - Position (15%): Submarket strength, proximity to amenities, competitive position
 * - Risk (10%): Market volatility, political/regulatory risk, concentration risk
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { query } from '../database/connection';

// ============================================================================
// Types
// ============================================================================

export interface JEDIScore {
  totalScore: number;
  demandScore: number;
  supplyScore: number;
  momentumScore: number;
  positionScore: number;
  riskScore: number;
  demandContribution: number;
  supplyContribution: number;
  momentumContribution: number;
  positionContribution: number;
  riskContribution: number;
}

export interface JEDIScoreHistory extends JEDIScore {
  id: string;
  dealId: string;
  calculationMethod: string;
  triggerEventId?: string;
  triggerType: string;
  previousScore?: number;
  scoreDelta?: number;
  marketSnapshot?: any;
  demandFactors?: any;
  supplyFactors?: any;
  createdAt: Date;
}

export interface DemandSignal {
  eventId: string;
  eventType: string;
  eventCategory: string;
  confidence: 'high' | 'medium' | 'low';
  impactScore: number;
  employeeCount?: number;
  unitCount?: number;
  distanceMiles: number;
}

export interface ScoreCalculationContext {
  dealId: string;
  tradeAreaId?: string;
  triggerEventId?: string;
  triggerType?: 'news_event' | 'market_update' | 'manual_recalc' | 'periodic';
}

// ============================================================================
// JEDI Score Service Class
// ============================================================================

export class JEDIScoreService {
  // Score weights (must sum to 1.0)
  private readonly WEIGHTS = {
    demand: 0.30,
    supply: 0.25,
    momentum: 0.20,
    position: 0.15,
    risk: 0.10,
  };

  /**
   * Calculate JEDI Score for a deal
   */
  async calculateScore(context: ScoreCalculationContext): Promise<JEDIScore> {
    const { dealId, tradeAreaId } = context;

    // Get deal and trade area information
    const dealInfo = await this.getDealInfo(dealId);
    if (!dealInfo) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    // Calculate each signal component (0-100 scale)
    const demandScore = await this.calculateDemandScore(dealId, tradeAreaId);
    const supplyScore = await this.calculateSupplyScore(dealId, tradeAreaId);
    const momentumScore = await this.calculateMomentumScore(dealId, tradeAreaId);
    const positionScore = await this.calculatePositionScore(dealId, tradeAreaId);
    const riskScore = await this.calculateRiskScore(dealId, tradeAreaId);

    // Calculate weighted contributions
    const demandContribution = demandScore * this.WEIGHTS.demand;
    const supplyContribution = supplyScore * this.WEIGHTS.supply;
    const momentumContribution = momentumScore * this.WEIGHTS.momentum;
    const positionContribution = positionScore * this.WEIGHTS.position;
    const riskContribution = riskScore * this.WEIGHTS.risk;

    // Total score (weighted sum)
    const totalScore = 
      demandContribution +
      supplyContribution +
      momentumContribution +
      positionContribution +
      riskContribution;

    return {
      totalScore: parseFloat(totalScore.toFixed(2)),
      demandScore: parseFloat(demandScore.toFixed(2)),
      supplyScore: parseFloat(supplyScore.toFixed(2)),
      momentumScore: parseFloat(momentumScore.toFixed(2)),
      positionScore: parseFloat(positionScore.toFixed(2)),
      riskScore: parseFloat(riskScore.toFixed(2)),
      demandContribution: parseFloat(demandContribution.toFixed(2)),
      supplyContribution: parseFloat(supplyContribution.toFixed(2)),
      momentumContribution: parseFloat(momentumContribution.toFixed(2)),
      positionContribution: parseFloat(positionContribution.toFixed(2)),
      riskContribution: parseFloat(riskContribution.toFixed(2)),
    };
  }

  /**
   * Calculate Demand Signal Score (0-100)
   * Based on employment events, population growth, economic indicators
   */
  private async calculateDemandScore(dealId: string, tradeAreaId?: string): Promise<number> {
    // Get demand signals (news events affecting this deal's trade area)
    const signals = await this.getDemandSignals(dealId, tradeAreaId);

    if (signals.length === 0) {
      return 50.0; // Baseline neutral score
    }

    // Get signal weights
    const weightResult = await query(
      `SELECT event_category, event_type, base_weight, confidence_multiplier, max_jedi_impact,
              housing_conversion_rate, occupancy_factor
       FROM demand_signal_weights`
    );
    const weightMap = new Map(
      weightResult.rows.map(w => [
        `${w.event_category}:${w.event_type}`,
        w
      ])
    );

    let totalImpact = 0;
    const demandFactors = [];

    for (const signal of signals) {
      const weightKey = `${signal.eventCategory}:${signal.eventType}`;
      const weight = weightMap.get(weightKey);

      if (!weight) continue;

      // Apply confidence multiplier
      const confidenceMultiplier = weight.confidence_multiplier[signal.confidence] || 0.5;
      
      // Calculate impact magnitude
      let impactMagnitude = 0;
      
      if (signal.employeeCount && weight.housing_conversion_rate) {
        // Employment event: convert jobs to housing demand
        const housingDemand = signal.employeeCount * weight.housing_conversion_rate * weight.occupancy_factor;
        impactMagnitude = (housingDemand / 100) * weight.max_jedi_impact; // Normalize
      } else if (signal.unitCount) {
        // Development event: direct unit impact
        impactMagnitude = (signal.unitCount / 500) * Math.abs(weight.max_jedi_impact); // Normalize to 500 units
      } else {
        // Generic event: use impact score
        impactMagnitude = (signal.impactScore / 100) * weight.max_jedi_impact;
      }

      // Apply confidence weighting
      const weightedImpact = impactMagnitude * confidenceMultiplier * weight.base_weight;
      
      // Apply proximity decay (already factored into impactScore from geographic assignment)
      const proximityFactor = signal.impactScore / 100;
      const finalImpact = weightedImpact * proximityFactor;

      // Cap individual event impact at max_jedi_impact
      const cappedImpact = Math.max(
        -Math.abs(weight.max_jedi_impact),
        Math.min(Math.abs(weight.max_jedi_impact), finalImpact)
      );

      totalImpact += cappedImpact;
      demandFactors.push({
        eventId: signal.eventId,
        eventType: signal.eventType,
        impact: cappedImpact,
        confidence: signal.confidence,
      });
    }

    // Convert impact to 0-100 score (baseline 50, +/- 15 max)
    const demandScore = 50 + Math.max(-15, Math.min(15, totalImpact));

    return demandScore;
  }

  /**
   * Calculate Supply Signal Score (0-100)
   * For Phase 1, use baseline value (will be implemented in Phase 2)
   */
  private async calculateSupplyScore(dealId: string, tradeAreaId?: string): Promise<number> {
    // TODO Phase 2: Implement pipeline analysis, absorption rates, vacancy trends
    
    // Baseline: Get development permits in trade area (supply pressure indicator)
    const supplyResult = await query(
      `SELECT COUNT(*) as permit_count,
              SUM((ne.extracted_data->>'unit_count')::INTEGER) as total_units
       FROM news_events ne
       JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
       JOIN trade_areas ta ON ta.id = taei.trade_area_id
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1
         AND ne.event_category = 'development'
         AND ne.event_type LIKE '%permit%'
         AND ne.published_at > NOW() - INTERVAL '12 months'`,
      [dealId]
    );

    const supply = supplyResult.rows[0];
    const pipelineUnits = supply.total_units || 0;

    // Simplified scoring: high pipeline = lower supply score (more competition)
    if (pipelineUnits === 0) return 60.0; // No new supply = good
    if (pipelineUnits < 200) return 55.0;
    if (pipelineUnits < 500) return 50.0;
    if (pipelineUnits < 1000) return 45.0;
    return 40.0; // Heavy supply pressure
  }

  /**
   * Calculate Momentum Signal Score (0-100)
   * For Phase 1, use baseline value (will be implemented in Phase 2)
   */
  private async calculateMomentumScore(dealId: string, tradeAreaId?: string): Promise<number> {
    // TODO Phase 2: Implement rent growth trends, transaction velocity
    
    // Baseline: Check recent transaction activity
    const momentumResult = await query(
      `SELECT COUNT(*) as transaction_count
       FROM news_events ne
       JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
       JOIN trade_areas ta ON ta.id = taei.trade_area_id
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1
         AND ne.event_category = 'transactions'
         AND ne.published_at > NOW() - INTERVAL '6 months'`,
      [dealId]
    );

    const transactionCount = parseInt(momentumResult.rows[0].transaction_count) || 0;

    // More transactions = more momentum
    if (transactionCount === 0) return 45.0;
    if (transactionCount < 3) return 50.0;
    if (transactionCount < 5) return 55.0;
    return 60.0;
  }

  /**
   * Calculate Position Signal Score (0-100)
   * For Phase 1, use baseline value (will be implemented in Phase 2)
   */
  private async calculatePositionScore(dealId: string, tradeAreaId?: string): Promise<number> {
    // TODO Phase 2: Implement submarket analysis, amenity proximity, competitive position
    
    // Baseline: Check amenity events
    const positionResult = await query(
      `SELECT COUNT(*) as amenity_count
       FROM news_events ne
       JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
       JOIN trade_areas ta ON ta.id = taei.trade_area_id
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1
         AND ne.event_category = 'amenities'
         AND ne.published_at > NOW() - INTERVAL '24 months'`,
      [dealId]
    );

    const amenityCount = parseInt(positionResult.rows[0].amenity_count) || 0;

    // More amenities = better position
    return 50.0 + (amenityCount * 2); // +2 points per amenity, max +10
  }

  /**
   * Calculate Risk Signal Score (0-100)
   * For Phase 1, use baseline value (will be implemented in Phase 2)
   */
  private async calculateRiskScore(dealId: string, tradeAreaId?: string): Promise<number> {
    // TODO Phase 2: Implement volatility analysis, regulatory risk, concentration risk
    
    // Baseline: Neutral risk
    return 50.0;
  }

  /**
   * Get demand signals affecting a deal
   */
  private async getDemandSignals(dealId: string, tradeAreaId?: string): Promise<DemandSignal[]> {
    const result = await query(
      `SELECT 
         ne.id as event_id,
         ne.event_type,
         ne.event_category,
         ne.extraction_confidence,
         ne.extracted_data,
         taei.impact_score,
         taei.distance_miles,
         CASE 
           WHEN ne.extraction_confidence >= 0.8 THEN 'high'
           WHEN ne.extraction_confidence >= 0.6 THEN 'medium'
           ELSE 'low'
         END as confidence
       FROM news_events ne
       JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
       JOIN trade_areas ta ON ta.id = taei.trade_area_id
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1
         AND ne.event_category IN ('employment', 'development', 'amenities')
         AND ne.published_at > NOW() - INTERVAL '12 months'
         AND taei.impact_score >= 30
       ORDER BY taei.impact_score DESC, ne.published_at DESC`,
      [dealId]
    );

    return result.rows.map(row => ({
      eventId: row.event_id,
      eventType: row.event_type,
      eventCategory: row.event_category,
      confidence: row.confidence,
      impactScore: parseFloat(row.impact_score),
      employeeCount: row.extracted_data?.employee_count,
      unitCount: row.extracted_data?.unit_count,
      distanceMiles: parseFloat(row.distance_miles) || 0,
    }));
  }

  /**
   * Save JEDI Score to history
   */
  async saveScore(
    context: ScoreCalculationContext,
    score: JEDIScore,
    previousScore?: number
  ): Promise<JEDIScoreHistory> {
    const scoreDelta = previousScore ? score.totalScore - previousScore : null;

    const result = await query(
      `INSERT INTO jedi_score_history (
         deal_id, total_score, demand_score, supply_score, momentum_score, position_score, risk_score,
         demand_contribution, supply_contribution, momentum_contribution, position_contribution, risk_contribution,
         trigger_event_id, trigger_type, previous_score, score_delta
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        context.dealId,
        score.totalScore,
        score.demandScore,
        score.supplyScore,
        score.momentumScore,
        score.positionScore,
        score.riskScore,
        score.demandContribution,
        score.supplyContribution,
        score.momentumContribution,
        score.positionContribution,
        score.riskContribution,
        context.triggerEventId,
        context.triggerType || 'periodic',
        previousScore,
        scoreDelta,
      ]
    );

    return this.mapScoreHistory(result.rows[0]);
  }

  /**
   * Get latest JEDI Score for a deal
   */
  async getLatestScore(dealId: string): Promise<JEDIScoreHistory | null> {
    const result = await query(
      `SELECT * FROM jedi_score_history
       WHERE deal_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [dealId]
    );

    if (result.rows.length === 0) return null;
    return this.mapScoreHistory(result.rows[0]);
  }

  /**
   * Get JEDI Score history for a deal
   */
  async getScoreHistory(
    dealId: string,
    options: { limit?: number; offset?: number; days?: number } = {}
  ): Promise<JEDIScoreHistory[]> {
    const { limit = 50, offset = 0, days } = options;

    const whereClause = days
      ? `WHERE deal_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'`
      : `WHERE deal_id = $1`;

    const result = await query(
      `SELECT * FROM jedi_score_history
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [dealId, limit, offset]
    );

    return result.rows.map(row => this.mapScoreHistory(row));
  }

  /**
   * Get events impacting a deal's JEDI Score
   */
  async getImpactingEvents(dealId: string, limit = 20) {
    const result = await query(
      `SELECT 
         ne.*,
         taei.impact_score,
         taei.distance_miles,
         taei.decay_score,
         ta.name as trade_area_name
       FROM news_events ne
       JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
       JOIN trade_areas ta ON ta.id = taei.trade_area_id
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1
         AND taei.impact_score >= 30
       ORDER BY taei.impact_score DESC, ne.published_at DESC
       LIMIT $2`,
      [dealId, limit]
    );

    return result.rows;
  }

  /**
   * Calculate and save score for a deal
   */
  async calculateAndSave(context: ScoreCalculationContext): Promise<JEDIScoreHistory> {
    // Get previous score
    const previousScore = await this.getLatestScore(context.dealId);

    // Calculate new score
    const score = await this.calculateScore(context);

    // Save to history
    const history = await this.saveScore(
      context,
      score,
      previousScore?.totalScore
    );

    return history;
  }

  /**
   * Recalculate scores for all active deals
   */
  async recalculateAllScores(): Promise<number> {
    const result = await query(
      `SELECT id FROM deals WHERE stage IN ('prospect', 'uw', 'loi', 'psa', 'closing')`
    );

    let count = 0;
    for (const row of result.rows) {
      try {
        await this.calculateAndSave({
          dealId: row.id,
          triggerType: 'periodic',
        });
        count++;
      } catch (error) {
        console.error(`Failed to calculate score for deal ${row.id}:`, error);
      }
    }

    return count;
  }

  /**
   * Helper: Get deal information
   */
  private async getDealInfo(dealId: string) {
    const result = await query(
      `SELECT d.*, p.id as property_id, ta.id as trade_area_id
       FROM deals d
       LEFT JOIN properties p ON p.deal_id = d.id
       LEFT JOIN trade_areas ta ON ta.property_id = p.id
       WHERE d.id = $1
       LIMIT 1`,
      [dealId]
    );

    return result.rows[0] || null;
  }

  /**
   * Helper: Map database row to JEDIScoreHistory
   */
  private mapScoreHistory(row: any): JEDIScoreHistory {
    return {
      id: row.id,
      dealId: row.deal_id,
      totalScore: parseFloat(row.total_score),
      demandScore: parseFloat(row.demand_score),
      supplyScore: parseFloat(row.supply_score),
      momentumScore: parseFloat(row.momentum_score),
      positionScore: parseFloat(row.position_score),
      riskScore: parseFloat(row.risk_score),
      demandContribution: parseFloat(row.demand_contribution),
      supplyContribution: parseFloat(row.supply_contribution),
      momentumContribution: parseFloat(row.momentum_contribution),
      positionContribution: parseFloat(row.position_contribution),
      riskContribution: parseFloat(row.risk_contribution),
      calculationMethod: row.calculation_method,
      triggerEventId: row.trigger_event_id,
      triggerType: row.trigger_type,
      previousScore: row.previous_score ? parseFloat(row.previous_score) : undefined,
      scoreDelta: row.score_delta ? parseFloat(row.score_delta) : undefined,
      marketSnapshot: row.market_snapshot,
      demandFactors: row.demand_factors,
      supplyFactors: row.supply_factors,
      createdAt: new Date(row.created_at),
    };
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const jediScoreService = new JEDIScoreService();
