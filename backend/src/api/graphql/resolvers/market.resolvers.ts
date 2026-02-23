/**
 * Market Data GraphQL Resolvers
 */

import { query } from '../../../database/connection';
import { AppError } from '../../../middleware/errorHandler';

export const marketResolvers = {
  Query: {
    marketInventory: async (_: any, { city, stateCode, propertyType }: any, context: any) => {
      if (!context.user) {
        throw new AppError(401, 'Not authenticated');
      }

      let queryText = `
        SELECT *
        FROM market_inventory
        WHERE city ILIKE $1 AND state_code = $2
          AND snapshot_date >= NOW() - INTERVAL '30 days'
      `;
      const params: any[] = [city, stateCode];

      if (propertyType) {
        queryText += ' AND property_type = $3';
        params.push(propertyType);
      }

      queryText += ' ORDER BY snapshot_date DESC';

      const result = await query(queryText, params);

      return result.rows.map((row: any) => ({
        city: row.city,
        stateCode: row.state_code,
        propertyType: row.property_type,
        activeListings: row.active_listings,
        medianPrice: row.median_price,
        avgDaysOnMarket: row.avg_days_on_market,
        absorptionRate: row.absorption_rate,
        snapshotDate: row.snapshot_date,
      }));
    },

    marketTrends: async (_: any, { city, stateCode }: any, context: any) => {
      if (!context.user) {
        throw new AppError(401, 'Not authenticated');
      }

      const result = await query(
        `SELECT 
          property_type,
          AVG(active_listings) as avg_listings,
          AVG(median_price) as avg_price,
          AVG(avg_days_on_market) as avg_dom
         FROM market_inventory
         WHERE city ILIKE $1 AND state_code = $2
           AND snapshot_date >= NOW() - INTERVAL '90 days'
         GROUP BY property_type`,
        [city, stateCode]
      );

      return {
        city,
        stateCode,
        trends: result.rows,
      };
    },
  },
};
