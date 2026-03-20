/**
 * Digital Traffic Service
 * 
 * Service for calculating digital traffic scores and detecting patterns
 * in property engagement data.
 * 
 * Part of Week 1 (Events Infrastructure) of the 8-week traffic engine roadmap.
 * 
 * Scoring algorithm:
 * - Base score from views (40%)
 * - Engagement actions: saves/shares (30%)
 * - Analysis runs (20%)
 * - Trending velocity (10%)
 * 
 * @version 1.0.0
 * @date 2025-02-18
 */

import { Pool } from 'pg';

export interface DigitalScoreResult {
  property_id: string;
  score: number;
  weekly_views: number;
  weekly_saves: number;
  trending_velocity: string;
  institutional_interest_flag: boolean;
  unique_users_7d: number;
  calculated_at: Date;
}

export interface TrendingVelocityResult {
  velocity: number;
  week_over_week_growth: number;
  current_week_events: number;
  previous_week_events: number;
}

export class DigitalTrafficService {
  constructor(private pool: Pool) {}

  /**
   * Calculate comprehensive digital traffic score for a property
   * 
   * Score breakdown (0-100):
   * - Views (40 points): Weekly views normalized
   * - Engagement (30 points): Saves + shares weighted
   * - Analysis runs (20 points): Deep engagement indicator
   * - Velocity (10 points): Trending momentum bonus
   * 
   * @param propertyId Property UUID
   * @returns Calculated score data
   */
  async calculateDigitalScore(propertyId: string): Promise<DigitalScoreResult> {
    try {
      // Get weekly metrics (last 7 days)
      const weeklyMetrics = await this.pool.query(
        `SELECT 
          COALESCE(SUM(views), 0) as weekly_views,
          COALESCE(SUM(saves), 0) as weekly_saves,
          COALESCE(SUM(shares), 0) as weekly_shares,
          COALESCE(SUM(analysis_runs), 0) as weekly_analysis_runs,
          COALESCE(MAX(unique_users), 0) as unique_users_7d
         FROM property_engagement_daily
         WHERE property_id = $1
           AND date >= CURRENT_DATE - INTERVAL '7 days'`,
        [propertyId]
      );

      const metrics = weeklyMetrics.rows[0];

      // Get trending velocity
      const velocityData = await this.calculateTrendingVelocity(propertyId);

      // Calculate institutional interest
      const institutionalInterest = await this.detectInstitutionalInterest(propertyId);

      // Calculate score components
      const viewsScore = this.calculateViewsScore(metrics.weekly_views);
      const engagementScore = this.calculateEngagementScore(
        metrics.weekly_saves,
        metrics.weekly_shares
      );
      const analysisScore = this.calculateAnalysisScore(metrics.weekly_analysis_runs);
      const velocityScore = this.calculateVelocityScore(velocityData.velocity);

      // Total score (0-100)
      const totalScore = Math.min(
        100,
        Math.round(viewsScore + engagementScore + analysisScore + velocityScore)
      );

      // Store calculated score
      const insertResult = await this.pool.query(
        `INSERT INTO digital_traffic_scores (
          property_id, 
          score, 
          weekly_views, 
          weekly_saves, 
          trending_velocity, 
          institutional_interest_flag, 
          unique_users_7d
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          propertyId,
          totalScore,
          metrics.weekly_views,
          metrics.weekly_saves,
          velocityData.velocity.toFixed(2),
          institutionalInterest,
          metrics.unique_users_7d
        ]
      );

      return insertResult.rows[0];
    } catch (error) {
      console.error('[DigitalTrafficService] Error calculating score:', error);
      throw error;
    }
  }

  /**
   * Detect institutional interest patterns
   * 
   * Flags as institutional interest if:
   * - 5+ unique users viewing in last 7 days
   * - OR 3+ analysis runs from different users
   * 
   * @param propertyId Property UUID
   * @returns True if institutional interest detected
   */
  async detectInstitutionalInterest(propertyId: string): Promise<boolean> {
    try {
      // Check unique users in last 7 days
      const uniqueUsersResult = await this.pool.query(
        `SELECT COUNT(DISTINCT user_id) as unique_users
         FROM property_events
         WHERE property_id = $1
           AND timestamp >= NOW() - INTERVAL '7 days'`,
        [propertyId]
      );

      const uniqueUsers = parseInt(uniqueUsersResult.rows[0].unique_users);

      if (uniqueUsers >= 5) {
        return true;
      }

      // Check analysis runs from different users
      const analysisUsersResult = await this.pool.query(
        `SELECT COUNT(DISTINCT user_id) as analysis_users
         FROM property_events
         WHERE property_id = $1
           AND event_type = 'analysis_run'
           AND timestamp >= NOW() - INTERVAL '7 days'`,
        [propertyId]
      );

      const analysisUsers = parseInt(analysisUsersResult.rows[0].analysis_users);

      return analysisUsers >= 3;
    } catch (error) {
      console.error('[DigitalTrafficService] Error detecting institutional interest:', error);
      return false;
    }
  }

  /**
   * Calculate trending velocity (week-over-week growth)
   * 
   * Formula: ((current_week - previous_week) / previous_week) * 100
   * 
   * @param propertyId Property UUID
   * @returns Velocity data with growth percentage
   */
  async calculateTrendingVelocity(propertyId: string): Promise<TrendingVelocityResult> {
    try {
      // Get current week events (last 7 days)
      const currentWeekResult = await this.pool.query(
        `SELECT COUNT(*) as event_count
         FROM property_events
         WHERE property_id = $1
           AND timestamp >= NOW() - INTERVAL '7 days'`,
        [propertyId]
      );

      const currentWeekEvents = parseInt(currentWeekResult.rows[0].event_count);

      // Get previous week events (8-14 days ago)
      const previousWeekResult = await this.pool.query(
        `SELECT COUNT(*) as event_count
         FROM property_events
         WHERE property_id = $1
           AND timestamp >= NOW() - INTERVAL '14 days'
           AND timestamp < NOW() - INTERVAL '7 days'`,
        [propertyId]
      );

      const previousWeekEvents = parseInt(previousWeekResult.rows[0].event_count);

      // Calculate velocity
      let velocity = 0;
      if (previousWeekEvents > 0) {
        velocity = ((currentWeekEvents - previousWeekEvents) / previousWeekEvents) * 100;
      } else if (currentWeekEvents > 0) {
        velocity = 100; // New trending property
      }

      return {
        velocity,
        week_over_week_growth: velocity,
        current_week_events: currentWeekEvents,
        previous_week_events: previousWeekEvents
      };
    } catch (error) {
      console.error('[DigitalTrafficService] Error calculating velocity:', error);
      return {
        velocity: 0,
        week_over_week_growth: 0,
        current_week_events: 0,
        previous_week_events: 0
      };
    }
  }

  /**
   * Calculate views score component (0-40 points)
   * 
   * Scoring tiers:
   * - 0-10 views: Linear scale 0-10 points
   * - 11-50 views: 10-25 points
   * - 51-100 views: 25-35 points
   * - 100+ views: 35-40 points (capped)
   */
  private calculateViewsScore(views: number): number {
    if (views <= 10) {
      return views; // 0-10 points
    } else if (views <= 50) {
      return 10 + (views - 10) * 0.375; // 10-25 points
    } else if (views <= 100) {
      return 25 + (views - 50) * 0.2; // 25-35 points
    } else {
      return Math.min(40, 35 + (views - 100) * 0.05); // 35-40 points (capped)
    }
  }

  /**
   * Calculate engagement score component (0-30 points)
   * 
   * Saves are weighted 2x more than shares
   * - Each save: 3 points (capped at 20 points)
   * - Each share: 1.5 points (capped at 10 points)
   */
  private calculateEngagementScore(saves: number, shares: number): number {
    const savesScore = Math.min(20, saves * 3);
    const sharesScore = Math.min(10, shares * 1.5);
    return Math.min(30, savesScore + sharesScore);
  }

  /**
   * Calculate analysis score component (0-20 points)
   * 
   * Analysis runs indicate deep engagement:
   * - Each analysis run: 5 points (capped at 20)
   */
  private calculateAnalysisScore(analysisRuns: number): number {
    return Math.min(20, analysisRuns * 5);
  }

  /**
   * Calculate velocity score component (0-10 points)
   * 
   * Bonus points for trending properties:
   * - 0-20% growth: 0-3 points
   * - 20-50% growth: 3-6 points
   * - 50-100% growth: 6-8 points
   * - 100%+ growth: 8-10 points
   */
  private calculateVelocityScore(velocity: number): number {
    if (velocity < 0) {
      return 0; // No bonus for declining properties
    } else if (velocity <= 20) {
      return velocity * 0.15; // 0-3 points
    } else if (velocity <= 50) {
      return 3 + (velocity - 20) * 0.1; // 3-6 points
    } else if (velocity <= 100) {
      return 6 + (velocity - 50) * 0.04; // 6-8 points
    } else {
      return Math.min(10, 8 + (velocity - 100) * 0.02); // 8-10 points (capped)
    }
  }

  /**
   * Recalculate scores for all properties (batch processing)
   * 
   * This should be run periodically (e.g., hourly) to refresh all scores
   * 
   * @param limit Optional limit for batch processing
   * @returns Number of properties scored
   */
  async recalculateAllScores(limit?: number): Promise<number> {
    try {
      // Get properties with recent activity (last 30 days)
      const propertiesQuery = `
        SELECT DISTINCT property_id
        FROM property_events
        WHERE timestamp >= NOW() - INTERVAL '30 days'
        ${limit ? `LIMIT ${limit}` : ''}
      `;

      const result = await this.pool.query(propertiesQuery);
      const properties = result.rows;

      let scoredCount = 0;

      for (const property of properties) {
        try {
          await this.calculateDigitalScore(property.property_id);
          scoredCount++;
        } catch (error) {
          console.error(
            `[DigitalTrafficService] Error scoring property ${property.property_id}:`,
            error
          );
          // Continue with next property
        }
      }

      console.log(`[DigitalTrafficService] Recalculated scores for ${scoredCount} properties`);
      return scoredCount;
    } catch (error) {
      console.error('[DigitalTrafficService] Error in batch recalculation:', error);
      throw error;
    }
  }
}
