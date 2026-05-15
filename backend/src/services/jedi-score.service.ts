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
import { MODULE_ALIASES } from './m35-metric-mapping';

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

interface M35WeightOverride {
  keyEventId:      string;
  attributedDelta: number;
  confidence:      number;
  windowMonths:    number;
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
    const corpHealthAdj = await this.getCorporateHealthAdjustment(dealInfo.submarket_id || null);

    const rawDemandScore = await this.calculateDemandScore(dealId, tradeAreaId, demandIntel);
    const demandScore = Math.max(0, Math.min(100, rawDemandScore + corpHealthAdj.demandAdj));
    const supplyScore = await this.calculateSupplyScore(dealId, tradeAreaId, demandIntel);
    const momentumScore = await this.calculateMomentumScore(dealId, tradeAreaId, demandIntel);
    const positionScore = await this.calculatePositionScore(dealId, tradeAreaId, demandIntel);
    const rawRiskScore = await this.calculateRiskScore(dealId, tradeAreaId, demandIntel);
    const riskScore = Math.max(0, Math.min(100, rawRiskScore + corpHealthAdj.riskAdj));

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
  // Maps M35 key_event.category enum values to JEDI demand signal categories.
  // Only categories listed here can produce an M35 weight override for demand signals.
  private static readonly M35_TO_DEMAND_CAT: Readonly<Record<string, string>> = {
    EMPLOYMENT:          'employment',
    TECHNOLOGY_INDUSTRY: 'employment',
    INFRASTRUCTURE:      'development',
    MACRO_DEMOGRAPHIC:   'amenities',
  };

  // Per demand category: the M35 metric key (via MODULE_ALIASES.M06) that carries
  // the attributed_delta for that category. Only this metric row is accepted from
  // event_forecasts — all other metric rows for the same key event are ignored.
  private static readonly DEMAND_CAT_M06_METRIC: Readonly<Record<string, string>> = {
    employment:  MODULE_ALIASES.M06.demand_signal_rent,       // 'rent_growth_yoy'
    development: MODULE_ALIASES.M06.demand_signal_absorption, // 'net_absorption'
    amenities:   MODULE_ALIASES.M06.demand_signal_traffic,    // 'search_growth'
  };

  private async calculateDemandScore(dealId: string, tradeAreaId?: string, demandIntel?: DemandIntelligence | null): Promise<number> {
    const signals = await this.getDemandSignals(dealId, tradeAreaId);

    if (signals.length === 0 && !demandIntel) {
      return 50.0;
    }

    // Pre-fetch M35 overrides keyed by demand signal category.
    // Only categories with a forecast-backed key event in the deal's submarket (or MSA) get an override.
    const m35Overrides = await this.getM35CategoryOverrides(dealId);

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

        // Substitute static base_weight with M35 attributed_delta when the deal's
        // submarket (or MSA) has a forecast-backed key event in this specific category.
        const m35Override = m35Overrides.get(signal.eventCategory);
        const effectiveBaseWeight =
          m35Override && m35Override.confidence >= 0.50
            ? Math.abs(m35Override.attributedDelta) * 100 * m35Override.confidence
            : weight.base_weight;

        const weightedImpact = impactMagnitude * confidenceMultiplier * effectiveBaseWeight;
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
    // Run legacy news_events query and submarket resolution in parallel
    const [supplyResult, submarketRow] = await Promise.all([
      query(
        `SELECT COUNT(*) as permit_count,
                SUM((ne.extracted_data->>'unit_count')::INTEGER) as total_units
         FROM news_events ne
         JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
         JOIN trade_areas ta ON ta.id = taei.trade_area_id
         JOIN properties p ON p.id = ta.property_id
         JOIN deal_properties dp_link ON dp_link.property_id = p.id
         WHERE dp_link.deal_id = $1
           AND ne.event_category = 'development'
           AND ne.event_type LIKE '%permit%'
           AND ne.published_at > NOW() - INTERVAL '12 months'`,
        [dealId]
      ),
      query(
        `SELECT p.submarket_id
         FROM properties p
         JOIN deal_properties dp ON dp.property_id = p.id
         WHERE dp.deal_id = $1
         LIMIT 1`,
        [dealId]
      ),
    ]);

    const submarketId: string | null = submarketRow.rows[0]?.submarket_id ?? null;

    // W-05: M35 pipeline queries from event_forecasts (live supply data);
    // run in parallel when submarket is known, otherwise skip (no-op)
    const [m35SupplyResult, m35DemoResult] = submarketId
      ? await Promise.all([
          query(
            `SELECT COALESCE(SUM(ef.point_estimate), 0) AS m35_units
             FROM event_forecasts ef
             JOIN key_events ke ON ke.id = ef.event_id
             WHERE ke.subtype IN ('multifamily_delivery', 'multifamily_permit')
               AND ke.submarket_id = $1
               AND ef.metric_key IN ('deliveries', 'permits_issued', 'net_absorption_units')
               AND ef.status = 'active'
               AND ef.window_months = 12`,
            [submarketId]
          ),
          query(
            `SELECT COALESCE(SUM(ef.point_estimate), 0) AS m35_units
             FROM event_forecasts ef
             JOIN key_events ke ON ke.id = ef.event_id
             WHERE ke.subtype IN ('demolition', 'conversion')
               AND ke.submarket_id = $1
               AND ef.metric_key IN ('deliveries', 'permits_issued', 'net_absorption_units')
               AND ef.status = 'active'
               AND ef.window_months = 12`,
            [submarketId]
          ),
        ])
      : [null, null];

    const m35Supply = parseFloat(m35SupplyResult?.rows[0]?.m35_units ?? '0') || 0;
    const m35Demo   = parseFloat(m35DemoResult?.rows[0]?.m35_units ?? '0') || 0;

    const supply = supplyResult.rows[0];
    // pg returns SUM() as a string — coerce explicitly before arithmetic
    const legacyUnits = Number(supply.total_units) || 0;
    // Blend: legacy news_events baseline + M35 deliveries/permits − M35 demolitions/conversions
    // Floor at 0: negative net pipeline (more demolitions than deliveries) should not invert scoring
    const pipelineUnits = Math.max(0, legacyUnits + m35Supply - m35Demo);

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
       JOIN deal_properties dp_link ON dp_link.property_id = p.id
       WHERE dp_link.deal_id = $1
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
       JOIN deal_properties dp_link ON dp_link.property_id = p.id
       WHERE dp_link.deal_id = $1
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
       JOIN deal_properties dp_link ON dp_link.property_id = p.id
       WHERE dp_link.deal_id = $1
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
       JOIN deal_properties dp_link ON dp_link.property_id = p.id
       WHERE dp_link.deal_id = $1
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
      `SELECT d.*, d.city as city, p.id as property_id, p.submarket_id, ta.id as trade_area_id
       FROM deals d
       LEFT JOIN deal_properties dp_link ON dp_link.deal_id = d.id
       LEFT JOIN properties p ON p.id = dp_link.property_id
       LEFT JOIN trade_areas ta ON ta.property_id = p.id
       WHERE d.id = $1
       LIMIT 1`,
      [dealId]
    );

    return result.rows[0] || null;
  }

  private async getCorporateHealthAdjustment(submarketId: number | null): Promise<{demandAdj: number, riskAdj: number}> {
    if (!submarketId) return { demandAdj: 0, riskAdj: 0 };
    try {
      const result = await query(
        `SELECT schi_score, divergence_score, herfindahl_index, top_5_share
         FROM submarket_corporate_health
         WHERE submarket_id = $1
         ORDER BY quarter DESC LIMIT 1`,
        [submarketId]
      );
      if (result.rows.length === 0) return { demandAdj: 0, riskAdj: 0 };

      const { schi_score, divergence_score, herfindahl_index, top_5_share } = result.rows[0];
      const divVal = parseFloat(divergence_score || '0');
      const hhi = parseFloat(herfindahl_index || '0');

      const minChsResult = await query(
        `SELECT MIN(chs.composite_chs) as min_chs
         FROM corporate_health_scores chs
         JOIN submarket_employers se ON se.ticker = chs.ticker
         WHERE se.submarket_id = $1
           AND chs.fiscal_quarter = (SELECT MAX(fiscal_quarter) FROM corporate_health_scores)`,
        [submarketId]
      );
      const minChs = parseFloat(minChsResult.rows[0]?.min_chs || '50');

      const demandAdj = Math.max(-8, Math.min(8, (divVal / 15) * 8));

      const hhiNormalized = Math.min(1, hhi / 0.25);
      const riskAdj = Math.round(hhiNormalized * (1 - minChs / 100) * 100) / 10;

      return { demandAdj, riskAdj };
    } catch {
      return { demandAdj: 0, riskAdj: 0 };
    }
  }

  // Queries key events with active forecasts in the deal's submarket (MSA fallback).
  // Returns a Map<demandSignalCategory, M35WeightOverride> — one entry per demand category,
  // taking the highest-confidence key event when multiple events share a category.
  // Signals whose category is NOT in M35_TO_DEMAND_CAT keep their static base_weight.
  private async getM35CategoryOverrides(
    dealId: string,
  ): Promise<Map<string, M35WeightOverride>> {
    try {
      const pool = getPool();

      const dealRes = await pool.query<{ submarket_id: string | null; msa_id: string | null }>(
        `SELECT deal_data->>'submarketId' AS submarket_id,
                deal_data->>'msaId'        AS msa_id
         FROM deals WHERE id = $1 LIMIT 1`,
        [dealId]
      );
      const { submarket_id: submarketId, msa_id: msaId } = dealRes.rows[0] ?? {};

      // Restrict to the M06-specific metric keys via the MODULE_ALIASES.M06 mapping.
      // This prevents supply/investment metrics from polluting demand weight derivation.
      const allowedMetricKeys = Object.values(JEDIScoreService.DEMAND_CAT_M06_METRIC);

      const BASE_SQL = `
        SELECT ke.id             AS key_event_id,
               ke.category::text AS m35_category,
               ef.metric_key,
               ef.point_estimate AS attributed_delta,
               ef.confidence,
               ef.window_months
        FROM event_forecasts ef
        JOIN key_events ke ON ke.id = ef.event_id
        WHERE ef.status = 'active'
          AND ke.status IN ('announced','in_progress','materialized')
          AND ef.point_estimate IS NOT NULL
          AND ef.metric_key = ANY($2)`;

      type ForecastRow = {
        key_event_id:    string;
        m35_category:    string;
        metric_key:      string;
        attributed_delta: string | null;
        confidence:      string;
        window_months:   string;
      };

      let rows: ForecastRow[] = [];

      if (submarketId) {
        const res = await pool.query<ForecastRow>(
          `${BASE_SQL} AND ke.submarket_id = $1 ORDER BY ef.confidence DESC`,
          [submarketId, allowedMetricKeys]
        );
        rows = res.rows;
      }

      if (rows.length === 0 && msaId) {
        const res = await pool.query<ForecastRow>(
          `${BASE_SQL} AND ke.msa_id = $1 ORDER BY ef.confidence DESC`,
          [msaId, allowedMetricKeys]
        );
        rows = res.rows;
      }

      const overrides = new Map<string, M35WeightOverride>();
      for (const r of rows) {
        const demandCat = JEDIScoreService.M35_TO_DEMAND_CAT[r.m35_category];
        if (!demandCat) continue;
        // Only accept the metric key designated for this demand category via MODULE_ALIASES.M06.
        const expectedMetric = JEDIScoreService.DEMAND_CAT_M06_METRIC[demandCat];
        if (r.metric_key !== expectedMetric) continue;
        if (overrides.has(demandCat)) continue; // rows ordered by confidence DESC; first wins
        overrides.set(demandCat, {
          keyEventId:      r.key_event_id,
          attributedDelta: parseFloat(r.attributed_delta!),
          confidence:      parseFloat(r.confidence),
          windowMonths:    parseInt(r.window_months),
        });
      }
      return overrides;
    } catch {
      return new Map();
    }
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
