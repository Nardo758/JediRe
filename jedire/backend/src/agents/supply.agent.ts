/**
 * Supply Agent
 * Analyzes market inventory and supply trends
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';

export class SupplyAgent {
  /**
   * Execute supply analysis task
   */
  async execute(inputData: any, userId: string): Promise<any> {
    logger.info('Supply agent executing...', { inputData });

    try {
      const { city, stateCode, propertyType } = inputData;

      // Validate input
      if (!city || !stateCode) {
        throw new Error('City and stateCode are required');
      }

      // Get market inventory (with type casting for safety)
      const inventoryResult = await query(
        `SELECT *
         FROM market_inventory
         WHERE city ILIKE $1 AND state_code = $2
           AND snapshot_date >= NOW() - INTERVAL '30 days'
         ORDER BY snapshot_date DESC`,
        [city, stateCode]
      );

      // Calculate trends (cast columns to numeric to avoid type errors)
      const trendsResult = await query(
        `SELECT 
          AVG(CAST(active_listings AS NUMERIC)) as avg_listings,
          AVG(CAST(median_price AS NUMERIC)) as avg_price,
          AVG(CAST(avg_days_on_market AS NUMERIC)) as avg_dom,
          AVG(CAST(absorption_rate AS NUMERIC)) as avg_absorption
         FROM market_inventory
         WHERE city ILIKE $1 AND state_code = $2
           AND snapshot_date >= NOW() - INTERVAL '90 days'`,
        [city, stateCode]
      );

      const trends = trendsResult.rows[0] || {};

      return {
        inventory: inventoryResult.rows,
        trends,
        opportunityScore: this.calculateOpportunityScore(trends),
        status: 'success',
      };
    } catch (error: any) {
      logger.error('Supply agent execution failed:', error);
      // Return clean error message
      throw new Error(error.message || 'Supply analysis failed');
    }
  }

  private calculateOpportunityScore(trends: any): number {
    // Simple scoring logic - can be enhanced
    let score = 50;

    // Safely handle null/undefined values
    const avgDom = parseFloat(trends.avg_dom) || 0;
    const avgAbsorption = parseFloat(trends.avg_absorption) || 0;
    const avgListings = parseFloat(trends.avg_listings) || 0;

    if (avgDom > 0 && avgDom < 30) score += 20; // Low days on market is good
    if (avgAbsorption > 15) score += 15; // High absorption is good
    if (avgListings > 0 && avgListings < 100) score += 15; // Low inventory is good

    return Math.min(100, Math.max(0, score));
  }
}
