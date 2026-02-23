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

      // Get market inventory
      const inventoryResult = await query(
        `SELECT *
         FROM market_inventory
         WHERE city ILIKE $1 AND state_code = $2
           AND snapshot_date >= NOW() - INTERVAL '30 days'
         ORDER BY snapshot_date DESC`,
        [city, stateCode]
      );

      // Calculate trends
      const trendsResult = await query(
        `SELECT 
          AVG(active_listings) as avg_listings,
          AVG(median_price) as avg_price,
          AVG(avg_days_on_market) as avg_dom,
          AVG(absorption_rate) as avg_absorption
         FROM market_inventory
         WHERE city ILIKE $1 AND state_code = $2
           AND snapshot_date >= NOW() - INTERVAL '90 days'`,
        [city, stateCode]
      );

      return {
        inventory: inventoryResult.rows,
        trends: trendsResult.rows[0],
        opportunityScore: this.calculateOpportunityScore(trendsResult.rows[0]),
        status: 'success',
      };
    } catch (error: any) {
      logger.error('Supply agent execution failed:', error);
      throw error;
    }
  }

  private calculateOpportunityScore(trends: any): number {
    // Simple scoring logic - can be enhanced
    let score = 50;

    if (trends.avg_dom < 30) score += 20; // Low days on market is good
    if (trends.avg_absorption > 15) score += 15; // High absorption is good
    if (trends.avg_listings < 100) score += 15; // Low inventory is good

    return Math.min(100, Math.max(0, score));
  }
}
