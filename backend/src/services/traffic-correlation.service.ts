/**
 * JEDI RE Traffic Correlation Service
 *
 * T-04: Traffic Correlation Signal (Hidden Gem / Validated / Hype Check / Dead Zone)
 * T-07: Traffic Trajectory (8-week trend analysis)
 * T-09: Competitive Traffic Share
 *
 * These are the 3 missing outputs from the Traffic Engine.
 * The other 7 (T-01, T-02, T-03, T-05, T-06, T-08, T-10) already exist in:
 *   - trafficPredictionEngine.ts (T-01, T-02, T-06, T-08, T-10)
 *   - digitalTrafficService.ts (T-03)
 *   - multifamilyTrafficService.ts (T-05)
 */

import { pool } from '../database';

// ============================================================================
// T-04: Traffic Correlation Signal
// ============================================================================

export interface CorrelationSignal {
  property_id: string;
  physical_traffic_score: number;
  digital_traffic_score: number;
  correlation_signal: 'HIDDEN_GEM' | 'VALIDATED' | 'HYPE_CHECK' | 'DEAD_ZONE';
  physical_percentile: number;
  digital_percentile: number;
  divergence_score: number;
  strategy_implication: string;
  recommended_action: string;
}

/**
 * The 2x2 Correlation Matrix
 *
 *                    HIGH Physical Traffic
 *                           |
 *      Hidden Gem           |         Validated Winner
 *      (Opportunity)        |         (Competitive)
 *                           |
 * LOW Digital ──────────────┼──────────────── HIGH Digital
 *                           |
 *      Dead Zone            |         Hype Play
 *      (Avoid)              |         (Investigate)
 *                           |
 *                    LOW Physical Traffic
 */

export class TrafficCorrelationService {

  // Thresholds for high/low classification (submarket-relative percentiles)
  private readonly PHYSICAL_THRESHOLD = 50;  // Above 50th percentile = "high"
  private readonly DIGITAL_THRESHOLD = 50;

  /**
   * Calculate T-04 correlation signal for a property
   */
  async calculateCorrelation(propertyId: string): Promise<CorrelationSignal> {

    // Step 1: Get this property's physical score from latest prediction
    const physicalResult = await pool.query(`
      SELECT physical_traffic_score, submarket_id
      FROM latest_traffic_predictions
      WHERE property_id = $1
    `, [propertyId]);

    if (physicalResult.rows.length === 0) {
      throw new Error(`No traffic prediction found for property ${propertyId}. Run prediction first.`);
    }

    const { physical_traffic_score, submarket_id } = physicalResult.rows[0];

    // Step 2: Get this property's digital score
    const digitalResult = await pool.query(`
      SELECT digital_score
      FROM digital_traffic_scores
      WHERE property_id = $1
      ORDER BY score_year DESC, score_week DESC
      LIMIT 1
    `, [propertyId]);

    const digital_traffic_score = digitalResult.rows[0]?.digital_score || 0;

    // Step 3: Calculate percentiles within submarket
    const physicalPercentile = await this.calculatePercentile(
      physical_traffic_score, submarket_id, 'physical'
    );
    const digitalPercentile = await this.calculatePercentile(
      digital_traffic_score, submarket_id, 'digital'
    );

    // Step 4: Classify into 2x2 matrix
    const signal = this.classify(physicalPercentile, digitalPercentile);

    // Step 5: Generate strategy implication
    const { implication, action } = this.generateInsight(signal, physicalPercentile, digitalPercentile);

    // Step 6: Calculate divergence (how far apart physical vs digital)
    const divergence = Math.abs(physicalPercentile - digitalPercentile);

    const result: CorrelationSignal = {
      property_id: propertyId,
      physical_traffic_score,
      digital_traffic_score,
      correlation_signal: signal,
      physical_percentile: physicalPercentile,
      digital_percentile: digitalPercentile,
      divergence_score: divergence,
      strategy_implication: implication,
      recommended_action: action,
    };

    // Step 7: Persist
    await this.saveCorrelation(result, submarket_id);

    return result;
  }

  /**
   * Batch calculate for all properties in a submarket
   */
  async calculateSubmarketCorrelations(submarketId: string): Promise<CorrelationSignal[]> {
    const properties = await pool.query(`
      SELECT DISTINCT p.id
      FROM properties p
      JOIN traffic_predictions tp ON p.id = tp.property_id
      WHERE p.submarket_id = $1
    `, [submarketId]);

    const results: CorrelationSignal[] = [];
    for (const row of properties.rows) {
      try {
        const signal = await this.calculateCorrelation(row.id);
        results.push(signal);
      } catch (e) {
        console.warn(`Skipping property ${row.id}: ${(e as Error).message}`);
      }
    }

    return results;
  }

  private classify(
    physicalPctl: number,
    digitalPctl: number
  ): CorrelationSignal['correlation_signal'] {
    const highPhysical = physicalPctl >= this.PHYSICAL_THRESHOLD;
    const highDigital = digitalPctl >= this.DIGITAL_THRESHOLD;

    if (highPhysical && !highDigital) return 'HIDDEN_GEM';
    if (highPhysical && highDigital) return 'VALIDATED';
    if (!highPhysical && highDigital) return 'HYPE_CHECK';
    return 'DEAD_ZONE';
  }

  private generateInsight(
    signal: CorrelationSignal['correlation_signal'],
    physicalPctl: number,
    digitalPctl: number
  ): { implication: string; action: string } {
    switch (signal) {
      case 'HIDDEN_GEM':
        return {
          implication: `Strong physical traffic (${physicalPctl}th pctl) but low digital presence (${digitalPctl}th pctl). Institutional buyers likely haven't found this yet. The location fundamentals are strong — the property just hasn't been "discovered" online.`,
          action: 'Act fast — this pricing window closes once digital visibility catches up. Ideal for Value-Add or Flip strategies where you can capture the location premium before the market corrects.'
        };
      case 'VALIDATED':
        return {
          implication: `Both physical (${physicalPctl}th pctl) and digital (${digitalPctl}th pctl) traffic are strong. The market has priced in this location's quality. Competition for this property will be fierce.`,
          action: 'Expect competitive bidding. Returns depend on operational execution, not location arbitrage. Best for Stabilized Hold or STR if regulations allow.'
        };
      case 'HYPE_CHECK':
        return {
          implication: `High digital interest (${digitalPctl}th pctl) but weak physical traffic (${physicalPctl}th pctl). Either the product is overcoming a poor location through brand/marketing, or there is speculative interest without fundamental support.`,
          action: 'Investigate carefully. If strong product drives digital interest despite location, may work for STR or niche play. If pure hype, avoid — pricing likely inflated relative to location quality.'
        };
      case 'DEAD_ZONE':
        return {
          implication: `Both physical (${physicalPctl}th pctl) and digital (${digitalPctl}th pctl) traffic are below average. No natural demand drivers and no market attention.`,
          action: 'Avoid unless you have a thesis for transforming the location (e.g., new transit station, rezoning catalyst). Marketing alone won\'t fix a traffic-dead location.'
        };
    }
  }

  private async calculatePercentile(
    score: number,
    submarketId: string,
    type: 'physical' | 'digital'
  ): Promise<number> {
    const column = type === 'physical' ? 'physical_traffic_score' : 'digital_score';

    // For physical: direct submarket query
    if (type === 'physical') {
      const result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE ${column} <= $1) * 100.0 / NULLIF(COUNT(*), 0) as percentile
        FROM latest_traffic_predictions
        WHERE submarket_id = $2
        AND ${column} IS NOT NULL
      `, [score, submarketId]);

      return Math.round(result.rows[0]?.percentile || 50);
    }

    // For digital: join through properties to get submarket
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE ds.${column} <= $1) * 100.0 / NULLIF(COUNT(*), 0) as percentile
      FROM digital_traffic_scores ds
      JOIN properties p ON ds.property_id = p.id
      WHERE p.submarket_id = $2
      AND ds.${column} IS NOT NULL
    `, [score, submarketId]);

    return Math.round(result.rows[0]?.percentile || 50);
  }

  private async saveCorrelation(signal: CorrelationSignal, submarketId: string): Promise<void> {
    await pool.query(`
      INSERT INTO traffic_correlation_signals (
        property_id, physical_traffic_score, digital_traffic_score,
        correlation_signal, physical_percentile, digital_percentile,
        divergence_score, strategy_implication, recommended_action,
        submarket_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (property_id, calculation_date)
      DO UPDATE SET
        correlation_signal = EXCLUDED.correlation_signal,
        divergence_score = EXCLUDED.divergence_score,
        strategy_implication = EXCLUDED.strategy_implication,
        updated_at = NOW()
    `, [
      signal.property_id,
      signal.physical_traffic_score,
      signal.digital_traffic_score,
      signal.correlation_signal,
      signal.physical_percentile,
      signal.digital_percentile,
      signal.divergence_score,
      signal.strategy_implication,
      signal.recommended_action,
      submarketId
    ]);
  }
}

// ============================================================================
// T-07: Traffic Trajectory (8-week trend)
// ============================================================================

export interface TrafficTrajectory {
  property_id: string;
  current_walk_ins: number;
  eight_week_avg: number;
  trend_direction: 'accelerating' | 'stable' | 'decelerating' | 'insufficient_data';
  week_over_week_change_pct: number;
  eight_week_change_pct: number;
  data_points: number;
  weekly_series: Array<{ week: number; year: number; walk_ins: number }>;
}

export class TrafficTrajectoryService {

  /**
   * Calculate T-07 trajectory from prediction history
   */
  async calculateTrajectory(propertyId: string): Promise<TrafficTrajectory> {

    // Get last 8 weeks of predictions
    const result = await pool.query(`
      SELECT prediction_week, prediction_year, weekly_walk_ins
      FROM traffic_prediction_history
      WHERE property_id = $1
      ORDER BY prediction_year DESC, prediction_week DESC
      LIMIT 8
    `, [propertyId]);

    const series = result.rows.reverse(); // Oldest first

    if (series.length < 2) {
      return {
        property_id: propertyId,
        current_walk_ins: series[0]?.weekly_walk_ins || 0,
        eight_week_avg: series[0]?.weekly_walk_ins || 0,
        trend_direction: 'insufficient_data',
        week_over_week_change_pct: 0,
        eight_week_change_pct: 0,
        data_points: series.length,
        weekly_series: series.map(s => ({
          week: s.prediction_week,
          year: s.prediction_year,
          walk_ins: s.weekly_walk_ins
        }))
      };
    }

    const current = series[series.length - 1].weekly_walk_ins;
    const previous = series[series.length - 2].weekly_walk_ins;
    const oldest = series[0].weekly_walk_ins;
    const avg = series.reduce((sum: number, s: any) => sum + s.weekly_walk_ins, 0) / series.length;

    const wowChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const eightWeekChange = oldest > 0 ? ((current - oldest) / oldest) * 100 : 0;

    // Determine trend using linear regression slope
    let trend: TrafficTrajectory['trend_direction'];
    if (series.length < 4) {
      trend = wowChange > 3 ? 'accelerating' : wowChange < -3 ? 'decelerating' : 'stable';
    } else {
      // Simple slope: compare first half avg to second half avg
      const halfPoint = Math.floor(series.length / 2);
      const firstHalf = series.slice(0, halfPoint).reduce((s: number, r: any) => s + r.weekly_walk_ins, 0) / halfPoint;
      const secondHalf = series.slice(halfPoint).reduce((s: number, r: any) => s + r.weekly_walk_ins, 0) / (series.length - halfPoint);
      const slopeChange = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

      trend = slopeChange > 5 ? 'accelerating' : slopeChange < -5 ? 'decelerating' : 'stable';
    }

    return {
      property_id: propertyId,
      current_walk_ins: current,
      eight_week_avg: Math.round(avg),
      trend_direction: trend,
      week_over_week_change_pct: Math.round(wowChange * 10) / 10,
      eight_week_change_pct: Math.round(eightWeekChange * 10) / 10,
      data_points: series.length,
      weekly_series: series.map((s: any) => ({
        week: s.prediction_week,
        year: s.prediction_year,
        walk_ins: s.weekly_walk_ins
      }))
    };
  }
}

// ============================================================================
// T-09: Competitive Traffic Share
// ============================================================================

export interface CompetitiveShare {
  property_id: string;
  property_walk_ins: number;
  trade_area_total: number;
  traffic_share_pct: number;
  rank: number;
  total_properties: number;
  above_average: boolean;
}

export class CompetitiveTrafficShareService {

  /**
   * Calculate T-09 for a property within its trade area
   */
  async calculateShare(propertyId: string, tradeAreaId?: string): Promise<CompetitiveShare> {

    // Get this property's prediction + submarket
    const propResult = await pool.query(`
      SELECT tp.weekly_walk_ins, tp.submarket_id, p.latitude, p.longitude
      FROM latest_traffic_predictions tp
      JOIN properties p ON tp.property_id = p.id
      WHERE tp.property_id = $1
    `, [propertyId]);

    if (propResult.rows.length === 0) {
      throw new Error(`No prediction for property ${propertyId}`);
    }

    const { weekly_walk_ins, submarket_id } = propResult.rows[0];
    const effectiveArea = tradeAreaId || submarket_id;

    // Get all predictions in the same submarket/trade area
    const areaResult = await pool.query(`
      SELECT tp.property_id, tp.weekly_walk_ins
      FROM latest_traffic_predictions tp
      WHERE tp.submarket_id = $1
      AND tp.weekly_walk_ins > 0
      ORDER BY tp.weekly_walk_ins DESC
    `, [effectiveArea]);

    const allProperties = areaResult.rows;
    const totalWalkIns = allProperties.reduce((sum: number, p: any) => sum + p.weekly_walk_ins, 0);
    const rank = allProperties.findIndex((p: any) => p.property_id === propertyId) + 1;
    const avgShare = totalWalkIns > 0 ? 100.0 / allProperties.length : 0;
    const propertyShare = totalWalkIns > 0 ? (weekly_walk_ins / totalWalkIns) * 100 : 0;

    const share: CompetitiveShare = {
      property_id: propertyId,
      property_walk_ins: weekly_walk_ins,
      trade_area_total: totalWalkIns,
      traffic_share_pct: Math.round(propertyShare * 10) / 10,
      rank,
      total_properties: allProperties.length,
      above_average: propertyShare > avgShare,
    };

    // Persist
    const { week, year } = this.getCurrentWeek();
    await pool.query(`
      INSERT INTO traffic_competitive_share (
        property_id, trade_area_id, property_walk_ins, trade_area_total_walk_ins,
        traffic_share_pct, rank_in_trade_area, total_properties_in_area,
        avg_share_pct, above_average, calculation_week, calculation_year
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (property_id, calculation_week, calculation_year)
      DO UPDATE SET
        traffic_share_pct = EXCLUDED.traffic_share_pct,
        rank_in_trade_area = EXCLUDED.rank_in_trade_area
    `, [
      propertyId, effectiveArea, weekly_walk_ins, totalWalkIns,
      share.traffic_share_pct, rank, allProperties.length,
      Math.round(avgShare * 10) / 10, share.above_average, week, year
    ]);

    return share;
  }

  private getCurrentWeek(): { week: number; year: number } {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const week = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
    return { week, year: now.getFullYear() };
  }
}

// ============================================================================
// Exports
// ============================================================================

export const trafficCorrelation = new TrafficCorrelationService();
export const trafficTrajectory = new TrafficTrajectoryService();
export const competitiveShare = new CompetitiveTrafficShareService();
