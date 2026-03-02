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

import { query, getPool } from '../database/connection';

// ============================================================================
// Types
// ============================================================================

export interface DemandIntelligence {
  dealBreakers: string[];
  apartmentFeatures: Array<{ name: string; count: number }>;
  budget: { avg: number; median: number; min: number; max: number };
  bedroomDemand: { studio: number; oneBed: number; twoBed: number; threePlusBed: number };
  commutePreferences: { maxCommuteMinutes: number; preferredModes: string[]; topEmploymentCenters: string[] };
  moveInTimeline: { immediate: number; within30Days: number; within60Days: number; within90Days: number; moreThan90Days: number };
  topAmenities: string[];
  lifestylePriorities: string[];
  activeRenters: number;
}

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

    const dealInfo = await this.getDealInfo(dealId);
    if (!dealInfo) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    const demandIntel = await this.fetchDemandIntelligence(dealInfo.city);

    const demandScore = await this.calculateDemandScore(dealId, tradeAreaId, demandIntel);
    const supplyScore = await this.calculateSupplyScore(dealId, tradeAreaId, demandIntel);
    const momentumScore = await this.calculateMomentumScore(dealId, tradeAreaId, demandIntel);
    const positionScore = await this.calculatePositionScore(dealId, tradeAreaId, demandIntel);
    const riskScore = await this.calculateRiskScore(dealId, tradeAreaId, demandIntel);

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
   * Based on employment events, population growth, economic indicators,
   * enriched with apartment_features demand counts and bedroom_demand from demand intelligence.
   */
  private async calculateDemandScore(dealId: string, tradeAreaId?: string, demandIntel?: DemandIntelligence | null): Promise<number> {
    const signals = await this.getDemandSignals(dealId, tradeAreaId);

    if (signals.length === 0 && !demandIntel) {
      return 50.0;
    }

    let totalImpact = 0;

    if (signals.length > 0) {
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

      for (const signal of signals) {
        const weightKey = `${signal.eventCategory}:${signal.eventType}`;
        const weight = weightMap.get(weightKey);

        if (!weight) continue;

        const confidenceMultiplier = weight.confidence_multiplier[signal.confidence] || 0.5;
        
        let impactMagnitude = 0;
        
        if (signal.employeeCount && weight.housing_conversion_rate) {
          const housingDemand = signal.employeeCount * weight.housing_conversion_rate * weight.occupancy_factor;
          impactMagnitude = (housingDemand / 100) * weight.max_jedi_impact;
        } else if (signal.unitCount) {
          impactMagnitude = (signal.unitCount / 500) * Math.abs(weight.max_jedi_impact);
        } else {
          impactMagnitude = (signal.impactScore / 100) * weight.max_jedi_impact;
        }

        const weightedImpact = impactMagnitude * confidenceMultiplier * weight.base_weight;
        const proximityFactor = signal.impactScore / 100;
        const finalImpact = weightedImpact * proximityFactor;

        const cappedImpact = Math.max(
          -Math.abs(weight.max_jedi_impact),
          Math.min(Math.abs(weight.max_jedi_impact), finalImpact)
        );

        totalImpact += cappedImpact;
      }
    }

    if (demandIntel) {
      const totalFeatureDemand = demandIntel.apartmentFeatures.reduce((sum, f) => sum + f.count, 0);
      if (totalFeatureDemand > 50) {
        totalImpact += Math.min(3, totalFeatureDemand / 100);
      }

      const totalBedDemand = (demandIntel.bedroomDemand.studio || 0) +
        (demandIntel.bedroomDemand.oneBed || 0) +
        (demandIntel.bedroomDemand.twoBed || 0) +
        (demandIntel.bedroomDemand.threePlusBed || 0);
      if (totalBedDemand > 100) {
        totalImpact += Math.min(3, totalBedDemand / 200);
      }

      if (demandIntel.activeRenters > 500) {
        totalImpact += Math.min(2, demandIntel.activeRenters / 2000);
      }
    }

    const demandScore = 50 + Math.max(-15, Math.min(15, totalImpact));

    return demandScore;
  }

  /**
   * Calculate Supply Signal Score (0-100)
   * Enriched with bedroom_demand for supply/demand gap analysis.
   */
  private async calculateSupplyScore(dealId: string, tradeAreaId?: string, demandIntel?: DemandIntelligence | null): Promise<number> {
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

    let baseScore: number;
    if (pipelineUnits === 0) baseScore = 60.0;
    else if (pipelineUnits < 200) baseScore = 55.0;
    else if (pipelineUnits < 500) baseScore = 50.0;
    else if (pipelineUnits < 1000) baseScore = 45.0;
    else baseScore = 40.0;

    if (demandIntel) {
      const totalBedDemand = (demandIntel.bedroomDemand.studio || 0) +
        (demandIntel.bedroomDemand.oneBed || 0) +
        (demandIntel.bedroomDemand.twoBed || 0) +
        (demandIntel.bedroomDemand.threePlusBed || 0);

      if (pipelineUnits > 0 && totalBedDemand > 0) {
        const demandSupplyRatio = totalBedDemand / pipelineUnits;
        if (demandSupplyRatio > 2) {
          baseScore += 5;
        } else if (demandSupplyRatio > 1) {
          baseScore += 2;
        } else if (demandSupplyRatio < 0.5) {
          baseScore -= 3;
        }
      }
    }

    return Math.max(0, Math.min(100, baseScore));
  }

  /**
   * Calculate Momentum Signal Score (0-100)
   * Enriched with move_in_timeline for absorption rate projections.
   */
  private async calculateMomentumScore(dealId: string, tradeAreaId?: string, demandIntel?: DemandIntelligence | null): Promise<number> {
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

    let baseScore: number;
    if (transactionCount === 0) baseScore = 45.0;
    else if (transactionCount < 3) baseScore = 50.0;
    else if (transactionCount < 5) baseScore = 55.0;
    else baseScore = 60.0;

    let trajectoryBoost = 0;
    try {
      const { dataFlowRouter } = require('./module-wiring/data-flow-router');
      const trafficData = dataFlowRouter.getModuleData('M07', dealId);
      if (trafficData?.data?.traffic_trajectory !== undefined && trafficData?.data?.traffic_trajectory !== null) {
        const trajectory = trafficData.data.traffic_trajectory;
        trajectoryBoost = Math.max(-15, Math.min(15, trajectory * 50));
      }
    } catch {
    }

    let absorptionBoost = 0;
    if (demandIntel?.moveInTimeline) {
      const mt = demandIntel.moveInTimeline;
      const urgentDemand = (mt.immediate || 0) + (mt.within30Days || 0);
      const nearTermDemand = urgentDemand + (mt.within60Days || 0);
      const totalTimeline = nearTermDemand + (mt.within90Days || 0) + (mt.moreThan90Days || 0);

      if (totalTimeline > 0) {
        const urgencyRatio = urgentDemand / totalTimeline;
        if (urgencyRatio > 0.5) {
          absorptionBoost = 5;
        } else if (urgencyRatio > 0.3) {
          absorptionBoost = 3;
        } else if (urgencyRatio > 0.15) {
          absorptionBoost = 1;
        }
      }
    }

    return Math.max(0, Math.min(100, baseScore + trajectoryBoost + absorptionBoost));
  }

  /**
   * Calculate Position Signal Score (0-100)
   * Enriched with commute_preferences from demand intelligence.
   */
  private async calculatePositionScore(dealId: string, tradeAreaId?: string, demandIntel?: DemandIntelligence | null): Promise<number> {
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

    let baseScore = 50.0 + (amenityCount * 2);

    if (demandIntel?.commutePreferences) {
      const cp = demandIntel.commutePreferences;
      if (cp.topEmploymentCenters && cp.topEmploymentCenters.length > 0) {
        baseScore += Math.min(3, cp.topEmploymentCenters.length);
      }
      if (cp.preferredModes && cp.preferredModes.includes('transit')) {
        baseScore += 2;
      }
      if (cp.maxCommuteMinutes > 0 && cp.maxCommuteMinutes <= 20) {
        baseScore += 2;
      }
    }

    return Math.max(0, Math.min(100, baseScore));
  }

  /**
   * Calculate Risk Signal Score (0-100)
   * Enriched with deal_breakers from demand intelligence for preference-based risk flags.
   */
  private async calculateRiskScore(dealId: string, tradeAreaId?: string, demandIntel?: DemandIntelligence | null): Promise<number> {
    let baseScore = 50.0;

    if (demandIntel?.dealBreakers && demandIntel.dealBreakers.length > 0) {
      const highRiskBreakers = ['crime', 'safety', 'noise', 'flood', 'pollution', 'construction'];
      const matchedBreakers = demandIntel.dealBreakers.filter(
        db => highRiskBreakers.some(hrb => db.toLowerCase().includes(hrb))
      );

      if (matchedBreakers.length > 0) {
        baseScore += Math.min(10, matchedBreakers.length * 3);
      }

      if (demandIntel.dealBreakers.length > 5) {
        baseScore += 3;
      }
    }

    return Math.max(0, Math.min(100, baseScore));
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
   * Fetch demand intelligence data from apartment_user_analytics table.
   * Parses demand-signals and user-preferences JSON blobs into structured data.
   */
  private async fetchDemandIntelligence(city?: string): Promise<DemandIntelligence | null> {
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT analytics_type, data FROM apartment_user_analytics
         WHERE analytics_type IN ('demand-signals', 'user-preferences', 'user-stats')
           AND (city = $1 OR city IS NULL)
         ORDER BY synced_at DESC LIMIT 10`,
        [city || null]
      );

      if (result.rows.length === 0) return null;

      const intel: DemandIntelligence = {
        dealBreakers: [],
        apartmentFeatures: [],
        budget: { avg: 0, median: 0, min: 0, max: 0 },
        bedroomDemand: { studio: 0, oneBed: 0, twoBed: 0, threePlusBed: 0 },
        commutePreferences: { maxCommuteMinutes: 0, preferredModes: [], topEmploymentCenters: [] },
        moveInTimeline: { immediate: 0, within30Days: 0, within60Days: 0, within90Days: 0, moreThan90Days: 0 },
        topAmenities: [],
        lifestylePriorities: [],
        activeRenters: 0,
      };

      let demandBreakers: string[] = [];
      let prefBreakers: string[] = [];

      for (const row of result.rows) {
        const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

        if (row.analytics_type === 'user-stats') {
          intel.activeRenters = d?.activeUsers30d || d?.totalUsers || 0;
        }

        if (row.analytics_type === 'demand-signals') {
          intel.topAmenities = (d?.topAmenities || d?.top_amenities || []).map((a: any) => a.name || a);
          demandBreakers = (d?.dealBreakers || d?.deal_breakers || []).map((a: any) => a.name || a);
          intel.apartmentFeatures = (d?.apartmentFeatures || d?.apartment_features || []).map((a: any) =>
            typeof a === 'string' ? { name: a, count: 0 } : { name: a.name || a.feature, count: a.count || 0 }
          );

          if (d?.budget) {
            intel.budget = {
              avg: d.budget.avg || d.budget.average || d.budget.avg_budget || 0,
              median: d.budget.median || d.budget.median_budget || 0,
              min: d.budget.min || d.budget.min_budget || 0,
              max: d.budget.max || d.budget.max_budget || 0,
            };
          }

          if (d?.bedroomDemand || d?.bedroom_demand) {
            const bd = d.bedroomDemand || d.bedroom_demand;
            intel.bedroomDemand = {
              studio: bd.studio || bd['0br'] || 0,
              oneBed: bd.oneBed || bd['1br'] || bd.one_bed || 0,
              twoBed: bd.twoBed || bd['2br'] || bd.two_bed || 0,
              threePlusBed: bd.threePlusBed || bd['3br+'] || bd.three_plus_bed || 0,
            };
          }

          if (d?.commutePreferences || d?.commute_preferences) {
            const cp = d.commutePreferences || d.commute_preferences;
            intel.commutePreferences = {
              maxCommuteMinutes: cp.maxCommuteMinutes || cp.max_commute_minutes || cp.max_commute_minutes_avg || 0,
              preferredModes: cp.preferredModes || cp.preferred_modes || (cp.preferred_transport_modes || []).map((m: any) => m.mode || m) || [],
              topEmploymentCenters: cp.topEmploymentCenters || cp.top_employment_centers || (cp.top_commute_destinations || []).map((dest: any) => dest.destination || dest) || [],
            };
          }

          if (d?.moveInTimeline || d?.move_in_timeline) {
            const mt = d.moveInTimeline || d.move_in_timeline;
            intel.moveInTimeline = {
              immediate: mt.immediate || 0,
              within30Days: mt.within30Days || mt.within_30_days || 0,
              within60Days: mt.within60Days || mt.within_60_days || 0,
              within90Days: mt.within90Days || mt.within_90_days || 0,
              moreThan90Days: mt.moreThan90Days || mt.more_than_90_days || mt.flexible || 0,
            };
          }
        }

        if (row.analytics_type === 'user-preferences') {
          prefBreakers = (d?.dealBreakers || d?.deal_breakers || []).map((a: any) => a.name || a);
          intel.lifestylePriorities = (d?.lifestylePriorities || d?.lifestyle_priorities || []).map((a: any) => a.name || a);

          const prefFeatures: Array<{ name: string; count: number }> = (d?.apartmentFeatures || d?.apartment_features || []).map((a: any) =>
            typeof a === 'string' ? { name: a, count: 0 } : { name: a.name || a.feature, count: a.count || 0 }
          );

          const featureMap = new Map<string, number>();
          for (const f of [...intel.apartmentFeatures, ...prefFeatures]) {
            featureMap.set(f.name, (featureMap.get(f.name) || 0) + f.count);
          }
          intel.apartmentFeatures = Array.from(featureMap.entries()).map(([name, count]) => ({ name, count }));
        }
      }

      intel.dealBreakers = [...new Set([...demandBreakers, ...prefBreakers])];

      return intel;
    } catch {
      return null;
    }
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
      `SELECT d.*, d.city as city, p.id as property_id, ta.id as trade_area_id
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
