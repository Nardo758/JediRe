/**
 * Apartment Market API Routes
 * Endpoints for integrating Apartment Locator AI data with JEDI RE
 */

import { Router } from 'express';
import apartmentMarketService from '../../services/apartmentMarketService';
import { pool } from '../../database';

const router = Router();

/**
 * POST /api/apartment-market/sync-deal/:dealId
 * Sync apartment market data for a specific deal
 */
router.post('/sync-deal/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    // Get deal location
    const dealResult = await pool.query(
      'SELECT latitude, longitude, property_name FROM deals WHERE id = $1',
      [dealId]
    );
    
    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    const { latitude, longitude } = dealResult.rows[0];
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Deal location not set' });
    }
    
    // Fetch and link comparable properties
    await apartmentMarketService.linkComparablesToDeal(dealId, latitude, longitude);
    
    // Get trade area if exists
    const tradeAreaResult = await pool.query(
      'SELECT id FROM trade_areas WHERE deal_id = $1 LIMIT 1',
      [dealId]
    );
    
    let metrics = null;
    if (tradeAreaResult.rows.length > 0) {
      const tradeAreaId = tradeAreaResult.rows[0].id;
      metrics = await apartmentMarketService.calculateTradeAreaMetrics(dealId, tradeAreaId);
    }
    
    res.json({
      success: true,
      message: 'Market data synced successfully',
      metrics
    });
    
  } catch (error: any) {
    console.error('Sync deal error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/apartment-market/deal/:dealId/comparables
 * Get comparable properties for a deal
 */
router.get('/deal/:dealId/comparables', async (req, res) => {
  try {
    const { dealId } = req.params;
    const { limit = 10, minRelevance = 50 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        dcp.*,
        CASE 
          WHEN dcp.relevance_score >= 80 THEN 'excellent'
          WHEN dcp.relevance_score >= 60 THEN 'good'
          ELSE 'fair'
        END as match_quality
      FROM deal_comparable_properties dcp
      WHERE dcp.deal_id = $1
      AND dcp.relevance_score >= $2
      ORDER BY dcp.relevance_score DESC, dcp.distance_miles ASC
      LIMIT $3
    `, [dealId, minRelevance, limit]);
    
    res.json({
      success: true,
      comparables: result.rows,
      count: result.rows.length
    });
    
  } catch (error: any) {
    console.error('Get comparables error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/apartment-market/deal/:dealId/metrics
 * Get market metrics for a deal's trade area
 */
router.get('/deal/:dealId/metrics', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM deal_market_summary WHERE deal_id = $1
    `, [dealId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Market metrics not found. Run sync first.' 
      });
    }
    
    res.json({
      success: true,
      metrics: result.rows[0]
    });
    
  } catch (error: any) {
    console.error('Get metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/apartment-market/deal/:dealId/analysis-input
 * Get formatted data for JEDI market analysis
 */
router.get('/deal/:dealId/analysis-input', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    const marketData = await apartmentMarketService.getMarketDataForAnalysis(dealId);
    
    if (!marketData) {
      return res.status(404).json({
        error: 'No market data available. Please sync first.'
      });
    }
    
    // Get historical rent data for trend analysis
    const historyResult = await pool.query(`
      SELECT 
        mh.snapshot_date,
        mh.avg_rent
      FROM market_metric_history mh
      JOIN trade_area_market_metrics tam ON tam.trade_area_id = mh.trade_area_id
      WHERE tam.deal_id = $1
      ORDER BY mh.snapshot_date ASC
      LIMIT 12
    `, [dealId]);
    
    const rentTimeseries = historyResult.rows.map(row => row.avg_rent);
    
    res.json({
      success: true,
      analysisInput: {
        existing_units: marketData.existing_units,
        avg_rent: marketData.avg_rent,
        occupancy: marketData.occupancy,
        rent_timeseries: rentTimeseries.length > 0 ? rentTimeseries : [marketData.avg_rent],
        rent_growth_rate: marketData.rent_growth_rate,
        market_saturation: marketData.market_saturation
      }
    });
    
  } catch (error: any) {
    console.error('Get analysis input error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/apartment-market/deal/:dealId/trends
 * Get rent trends over time for a deal's trade area
 */
router.get('/deal/:dealId/trends', async (req, res) => {
  try {
    const { dealId } = req.params;
    const { months = 12 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        mh.snapshot_date,
        mh.avg_rent,
        mh.avg_occupancy,
        mh.properties_count
      FROM market_metric_history mh
      JOIN trade_area_market_metrics tam ON tam.trade_area_id = mh.trade_area_id
      WHERE tam.deal_id = $1
      AND mh.snapshot_date >= NOW() - INTERVAL '${months} months'
      ORDER BY mh.snapshot_date ASC
    `, [dealId]);
    
    res.json({
      success: true,
      trends: result.rows,
      count: result.rows.length
    });
    
  } catch (error: any) {
    console.error('Get trends error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/apartment-market/sync-status/:dealId
 * Check sync status and data freshness
 */
router.get('/sync-status/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    // Get last successful sync
    const syncResult = await pool.query(`
      SELECT *
      FROM apartment_api_sync_log
      WHERE deal_id = $1
      AND status = 'success'
      ORDER BY synced_at DESC
      LIMIT 1
    `, [dealId]);
    
    // Check metrics freshness
    const metricsResult = await pool.query(`
      SELECT calculated_at
      FROM trade_area_market_metrics
      WHERE deal_id = $1
      ORDER BY calculated_at DESC
      LIMIT 1
    `, [dealId]);
    
    const lastSync = syncResult.rows[0];
    const lastMetrics = metricsResult.rows[0];
    
    let status = 'never_synced';
    let needsSync = true;
    
    if (lastSync && lastMetrics) {
      const hoursSinceSync = (Date.now() - new Date(lastMetrics.calculated_at).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceSync < 24) {
        status = 'fresh';
        needsSync = false;
      } else if (hoursSinceSync < 72) {
        status = 'stale';
        needsSync = true;
      } else {
        status = 'old';
        needsSync = true;
      }
    }
    
    res.json({
      success: true,
      status,
      needsSync,
      lastSync: lastSync ? lastSync.synced_at : null,
      lastMetricsCalculated: lastMetrics ? lastMetrics.calculated_at : null
    });
    
  } catch (error: any) {
    console.error('Get sync status error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
