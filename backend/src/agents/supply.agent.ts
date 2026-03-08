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
      const inventory = inventoryResult.rows;

      // Extract metrics from inventory data
      const latestSnapshot = inventory.length > 0 ? inventory[0] : null;

      return {
        status: 'success',
        market: `${city}, ${stateCode}`,
        propertyType,
        
        // Current metrics from latest snapshot
        activeListings: latestSnapshot?.active_listings || 0,
        medianPrice: parseFloat(latestSnapshot?.median_price) || 0,
        avgPrice: parseFloat(latestSnapshot?.avg_price) || 0,
        pricePerSqft: parseFloat(latestSnapshot?.price_per_sqft) || 0,
        avgDaysOnMarket: latestSnapshot?.avg_days_on_market || 0,
        medianDaysOnMarket: latestSnapshot?.median_days_on_market || 0,
        
        // Supply metrics
        absorptionRate: parseFloat(latestSnapshot?.absorption_rate) || 0,
        monthsOfSupply: parseFloat(latestSnapshot?.months_of_supply) || 0,
        vacancyRate: parseFloat(latestSnapshot?.vacancy_rate) || 0,
        
        // 30-day activity
        newListings30d: latestSnapshot?.new_listings_30d || 0,
        closedSales30d: latestSnapshot?.closed_sales_30d || 0,
        
        // Property details
        avgSqft: latestSnapshot?.avg_sqft || 0,
        avgYearBuilt: latestSnapshot?.avg_year_built || 0,
        
        // 90-day trends
        trends: {
          avgListings: parseFloat(trends.avg_listings) || 0,
          avgPrice: parseFloat(trends.avg_price) || 0,
          avgDaysOnMarket: parseFloat(trends.avg_dom) || 0,
          avgAbsorption: parseFloat(trends.avg_absorption) || 0,
        },
        
        // Raw inventory data for reference
        inventory: inventory.map((item: any) => ({
          snapshotDate: item.snapshot_date,
          activeListings: item.active_listings,
          medianPrice: parseFloat(item.median_price),
          avgDaysOnMarket: item.avg_days_on_market,
          absorptionRate: parseFloat(item.absorption_rate),
        })),
        
        opportunityScore: this.calculateOpportunityScore(trends),
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
