/**
 * Market Data REST Routes
 * Supply and market analytics endpoints
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';

const router = Router();

/**
 * GET /api/v1/market/inventory/:city/:state
 * Get market inventory for a city
 */
router.get('/inventory/:city/:state', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { city, state } = req.params;
    const { propertyType, days = 30 } = req.query;

    let queryText = `
      SELECT *
      FROM market_inventory
      WHERE city ILIKE $1 AND state_code = $2
        AND snapshot_date >= NOW() - INTERVAL '${parseInt(days as string)} days'
    `;
    const params: any[] = [city, state.toUpperCase()];

    if (propertyType) {
      queryText += ' AND property_type = $3';
      params.push(propertyType);
    }

    queryText += ' ORDER BY snapshot_date DESC';

    const result = await query(queryText, params);

    res.json({
      city,
      state: state.toUpperCase(),
      propertyType: propertyType || 'all',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/market/trends/:city/:state
 * Calculate market trends
 */
router.get('/trends/:city/:state', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { city, state } = req.params;

    const result = await query(
      `SELECT 
        property_type,
        AVG(active_listings) as avg_listings,
        AVG(median_price) as avg_price,
        AVG(avg_days_on_market) as avg_dom,
        AVG(absorption_rate) as avg_absorption,
        MIN(snapshot_date) as period_start,
        MAX(snapshot_date) as period_end
       FROM market_inventory
       WHERE city ILIKE $1 AND state_code = $2
         AND snapshot_date >= NOW() - INTERVAL '90 days'
       GROUP BY property_type`,
      [city, state.toUpperCase()]
    );

    res.json({
      city,
      state: state.toUpperCase(),
      trends: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
