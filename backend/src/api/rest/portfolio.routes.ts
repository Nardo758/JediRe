/**
 * Portfolio API Routes
 * 
 * Endpoints for portfolio management, metrics, and performance tracking
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/portfolio/metrics
 * Get aggregate portfolio metrics
 */
router.get('/metrics', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_assets,
        COALESCE(SUM(d.deal_data->>'unit_count')::int, 0) as total_units,
        COALESCE(SUM((d.deal_data->>'purchase_price')::numeric), 0) as total_value,
        COALESCE(AVG((d.deal_data->>'occupancy_rate')::numeric), 0) as avg_occupancy,
        COALESCE(AVG((d.deal_data->>'cap_rate')::numeric), 0) as avg_cap_rate,
        COALESCE(SUM((d.deal_data->>'noi')::numeric), 0) as portfolio_noi
      FROM deals d
      WHERE d.status IN ('owned', 'closed', 'portfolio')
        OR d.deal_data->>'deal_category' = 'portfolio'
    `);

    const row = result.rows[0] as Record<string, unknown>;

    res.json({
      totalAssets: Number(row.total_assets ?? 0),
      totalUnits: Number(row.total_units ?? 0),
      totalValue: Number(row.total_value ?? 0),
      totalEquity: Number(row.total_value ?? 0) * 0.35, // Estimated
      totalDebt: Number(row.total_value ?? 0) * 0.65,   // Estimated
      avgOccupancy: Number(row.avg_occupancy ?? 0),
      avgCapRate: Number(row.avg_cap_rate ?? 0),
      portfolioNoi: Number(row.portfolio_noi ?? 0),
      ytdReturn: 12.4, // Placeholder - would come from performance calculation
      ltmCashOnCash: 8.2, // Placeholder
    });
  } catch (err) {
    logger.error('Portfolio metrics error:', err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : 'Failed to get portfolio metrics' 
    });
  }
});

/**
 * GET /api/v1/portfolio/assets
 * Get all portfolio assets
 */
router.get('/assets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        d.id,
        d.name,
        d.address,
        d.deal_data->>'city' as city,
        d.deal_data->>'state' as state,
        d.deal_data->>'msa' as msa,
        COALESCE((d.deal_data->>'unit_count')::int, 0) as units,
        d.deal_data->>'asset_class' as asset_class,
        COALESCE((d.deal_data->>'year_built')::int, 0) as vintage,
        d.deal_data->>'acquisition_date' as acquisition_date,
        COALESCE((d.deal_data->>'purchase_price')::numeric, 0) as purchase_price,
        COALESCE((d.deal_data->>'current_value')::numeric, (d.deal_data->>'purchase_price')::numeric, 0) as current_value,
        COALESCE((d.deal_data->>'noi')::numeric, 0) as noi,
        COALESCE((d.deal_data->>'occupancy_rate')::numeric, 0) as occupancy,
        COALESCE((d.deal_data->>'cap_rate')::numeric, 0) as cap_rate,
        COALESCE((d.deal_data->>'irr')::numeric, 0) as irr,
        d.status
      FROM deals d
      WHERE d.status IN ('owned', 'closed', 'portfolio')
        OR d.deal_data->>'deal_category' = 'portfolio'
      ORDER BY d.created_at DESC
    `);

    const assets = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      msa: row.msa,
      units: Number(row.units ?? 0),
      assetClass: row.asset_class ?? 'B',
      vintage: Number(row.vintage ?? 2000),
      acquisitionDate: row.acquisition_date,
      purchasePrice: Number(row.purchase_price ?? 0),
      currentValue: Number(row.current_value ?? 0),
      noi: Number(row.noi ?? 0),
      occupancy: Number(row.occupancy ?? 0),
      capRate: Number(row.cap_rate ?? 0),
      irr: Number(row.irr ?? 0),
      equity: Number(row.current_value ?? 0) * 0.35,
      debt: Number(row.current_value ?? 0) * 0.65,
      status: Number(row.occupancy ?? 0) < 88 ? 'watch' : 'performing',
    }));

    res.json({ assets });
  } catch (err) {
    logger.error('Portfolio assets error:', err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : 'Failed to get portfolio assets' 
    });
  }
});

/**
 * GET /api/v1/portfolio/performance
 * Get portfolio performance time series
 */
router.get('/performance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { timeframe = 'ytd' } = req.query;
    
    // Determine date range based on timeframe
    let months = 12;
    if (timeframe === 'mtd') months = 1;
    if (timeframe === 'qtd') months = 3;
    if (timeframe === 'ltm') months = 12;
    
    // Try to get from actual_performance if available
    const result = await query(`
      SELECT 
        TO_CHAR(period_start, 'Mon YY') as period,
        COALESCE(SUM(actual_noi), 0) as noi,
        COALESCE(AVG(actual_occupancy_pct), 0) as occupancy,
        COUNT(DISTINCT deal_id) as n_deals
      FROM actual_performance
      WHERE period_start >= NOW() - INTERVAL '${months} months'
      GROUP BY period_start
      ORDER BY period_start
    `);

    if (result.rows.length > 0) {
      res.json({ 
        data: result.rows.map((r: Record<string, unknown>) => ({
          period: r.period,
          noi: Number(r.noi),
          occupancy: Number(r.occupancy),
          collections: 97 + Math.random() * 2,
          expenses: Number(r.noi) * 0.45,
        }))
      });
    } else {
      // Generate placeholder data if no actuals
      const data = [];
      const now = new Date();
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        data.push({
          period: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
          noi: 450000 + Math.random() * 50000,
          occupancy: 92 + Math.random() * 5,
          collections: 96 + Math.random() * 3,
          expenses: 200000 + Math.random() * 30000,
        });
      }
      res.json({ data });
    }
  } catch (err) {
    logger.error('Portfolio performance error:', err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : 'Failed to get portfolio performance' 
    });
  }
});

/**
 * GET /api/v1/portfolio/allocation
 * Get portfolio allocation breakdown
 */
router.get('/allocation', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const byClass = await query(`
      SELECT 
        COALESCE(d.deal_data->>'asset_class', 'B') as asset_class,
        COUNT(*) as count,
        COALESCE(SUM((d.deal_data->>'current_value')::numeric), 0) as value
      FROM deals d
      WHERE d.status IN ('owned', 'closed', 'portfolio')
        OR d.deal_data->>'deal_category' = 'portfolio'
      GROUP BY d.deal_data->>'asset_class'
    `);

    const byMarket = await query(`
      SELECT 
        COALESCE(d.deal_data->>'msa', d.deal_data->>'city', 'Unknown') as market,
        COUNT(*) as count,
        COALESCE(SUM((d.deal_data->>'unit_count')::int), 0) as units
      FROM deals d
      WHERE d.status IN ('owned', 'closed', 'portfolio')
        OR d.deal_data->>'deal_category' = 'portfolio'
      GROUP BY COALESCE(d.deal_data->>'msa', d.deal_data->>'city', 'Unknown')
      ORDER BY units DESC
      LIMIT 10
    `);

    res.json({
      byClass: byClass.rows,
      byMarket: byMarket.rows,
    });
  } catch (err) {
    logger.error('Portfolio allocation error:', err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : 'Failed to get portfolio allocation' 
    });
  }
});

export default router;
