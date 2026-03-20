/**
 * Market Research Engine API Routes
 * Central hub for market intelligence aggregation
 */

import { Router } from 'express';
import marketResearchEngine from '../../services/marketResearchEngine';
import { pool } from '../../database';

const router = Router();

/**
 * POST /api/market-research/generate/:dealId
 * Generate fresh market research report for a deal
 */
router.post('/generate/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    const { force = false } = req.query;
    
    // Get deal location
    const dealResult = await pool.query(`
      SELECT id, property_name, latitude, longitude, city, state, address
      FROM deals 
      WHERE id = $1
    `, [dealId]);
    
    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    const deal = dealResult.rows[0];
    
    if (!deal.latitude || !deal.longitude) {
      return res.status(400).json({ 
        error: 'Deal location not set. Please add deal address first.' 
      });
    }
    
    // Check for cached report unless force=true
    if (!force) {
      const cached = await marketResearchEngine.getCachedReport(dealId, 24);
      if (cached) {
        return res.json({
          success: true,
          report: cached,
          cached: true,
          message: 'Returning cached report (< 24 hours old)'
        });
      }
    }
    
    // Generate new report
    const report = await marketResearchEngine.generateMarketReport({
      id: deal.id,
      latitude: deal.latitude,
      longitude: deal.longitude,
      city: deal.city,
      state: deal.state,
      address: deal.address
    });
    
    res.json({
      success: true,
      report,
      cached: false,
      message: 'Market research report generated successfully'
    });
    
  } catch (error: any) {
    console.error('Generate report error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to generate market research report'
    });
  }
});

/**
 * GET /api/market-research/report/:dealId
 * Get market research report for a deal (cached if available)
 */
router.get('/report/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    const { maxAge = 24 } = req.query;
    
    const report = await marketResearchEngine.getCachedReport(dealId, Number(maxAge));
    
    if (!report) {
      return res.status(404).json({
        error: 'No market research report found',
        message: 'Generate a report first using POST /generate/:dealId'
      });
    }
    
    res.json({
      success: true,
      report,
      cached: true
    });
    
  } catch (error: any) {
    console.error('Get report error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/market-research/metrics/:dealId
 * Get quick market metrics (from extracted table)
 */
router.get('/metrics/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM market_research_metrics WHERE deal_id = $1
    `, [dealId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No market metrics found',
        message: 'Generate a market research report first'
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
 * GET /api/market-research/intelligence/:dealId
 * Get comprehensive market intelligence view
 */
router.get('/intelligence/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM deal_market_intelligence WHERE deal_id = $1
    `, [dealId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No market intelligence found',
        message: 'Generate a market research report first'
      });
    }
    
    res.json({
      success: true,
      intelligence: result.rows[0]
    });
    
  } catch (error: any) {
    console.error('Get intelligence error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/market-research/sources/:dealId
 * Get data source status for a deal's report
 */
router.get('/sources/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    // Get latest report
    const reportResult = await pool.query(`
      SELECT id, sources_count, confidence_level, generated_at
      FROM market_research_reports
      WHERE deal_id = $1
      ORDER BY generated_at DESC
      LIMIT 1
    `, [dealId]);
    
    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'No report found' });
    }
    
    const report = reportResult.rows[0];
    
    // Get source logs
    const logsResult = await pool.query(`
      SELECT source_name, status, records_fetched, response_time_ms, error_message
      FROM market_research_source_log
      WHERE report_id = $1
      ORDER BY fetched_at DESC
    `, [report.id]);
    
    res.json({
      success: true,
      report_id: report.id,
      generated_at: report.generated_at,
      sources_count: report.sources_count,
      confidence_level: report.confidence_level,
      sources: logsResult.rows
    });
    
  } catch (error: any) {
    console.error('Get sources error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/market-research/analysis-input/:dealId
 * Get formatted input for JEDI Score analysis
 */
router.get('/analysis-input/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    // Get metrics
    const metricsResult = await pool.query(`
      SELECT * FROM market_research_metrics WHERE deal_id = $1
    `, [dealId]);
    
    if (metricsResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No market data available',
        message: 'Generate a market research report first'
      });
    }
    
    const metrics = metricsResult.rows[0];
    
    // Format for JEDI analysis (using comprehensive apartment market data)
    const analysisInput = {
      // Submarket identification
      submarket: metrics.submarket_name || 'Unknown',
      
      // Demographics
      population: metrics.population || 0,
      median_income: metrics.median_income || 0,
      population_growth_rate: metrics.population_growth_rate || 0,
      
      // Housing supply (from Apartment Locator AI)
      existing_units: metrics.properties_count || 0,
      total_units: metrics.total_units || 0,
      available_units: metrics.available_units || 0,
      pipeline_units: metrics.units_under_construction || 0,
      
      // Rental market performance
      rent_timeseries: [metrics.avg_rent_1br], // TODO: Pull historical data
      rent_growth_annual: metrics.rent_growth_12mo || 0,
      avg_rent: (metrics.avg_rent_1br + metrics.avg_rent_2br) / 2,
      occupancy_rate: metrics.avg_occupancy_rate || 0,
      
      // Market conditions
      market_saturation: metrics.market_saturation || 0,
      competition_level: metrics.competition_intensity || 'UNKNOWN',
      concessions_active: metrics.active_concessions_count || 0,
      
      // Property quality indicators
      avg_property_age: metrics.avg_property_age,
      property_class_mix: metrics.property_class_mix
    };
    
    res.json({
      success: true,
      analysisInput,
      source: 'Market Research Engine'
    });
    
  } catch (error: any) {
    console.error('Get analysis input error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/market-research/status/:dealId
 * Check if market research exists and its freshness
 */
router.get('/status/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        generated_at,
        confidence_level,
        sources_count,
        EXTRACT(EPOCH FROM (NOW() - generated_at)) / 3600 as hours_old
      FROM market_research_reports
      WHERE deal_id = $1
      ORDER BY generated_at DESC
      LIMIT 1
    `, [dealId]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        exists: false,
        status: 'not_generated',
        message: 'No market research report exists for this deal'
      });
    }
    
    const report = result.rows[0];
    const hoursOld = report.hours_old;
    
    let status = 'fresh';
    let needsUpdate = false;
    
    if (hoursOld > 72) {
      status = 'stale';
      needsUpdate = true;
    } else if (hoursOld > 168) { // 1 week
      status = 'outdated';
      needsUpdate = true;
    }
    
    res.json({
      success: true,
      exists: true,
      status,
      needsUpdate,
      generated_at: report.generated_at,
      hours_old: Math.round(hoursOld),
      confidence_level: report.confidence_level,
      sources_count: report.sources_count
    });
    
  } catch (error: any) {
    console.error('Get status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/market-research/batch-generate
 * Generate reports for multiple deals
 */
router.post('/batch-generate', async (req, res) => {
  try {
    const { dealIds } = req.body;
    
    if (!Array.isArray(dealIds) || dealIds.length === 0) {
      return res.status(400).json({ error: 'dealIds array required' });
    }
    
    const results = [];
    
    for (const dealId of dealIds) {
      try {
        const dealResult = await pool.query(`
          SELECT id, property_name, latitude, longitude, city, state, address
          FROM deals WHERE id = $1
        `, [dealId]);
        
        if (dealResult.rows.length === 0) continue;
        
        const deal = dealResult.rows[0];
        
        if (!deal.latitude || !deal.longitude) continue;
        
        const report = await marketResearchEngine.generateMarketReport({
          id: deal.id,
          latitude: deal.latitude,
          longitude: deal.longitude,
          city: deal.city,
          state: deal.state,
          address: deal.address
        });
        
        results.push({
          deal_id: dealId,
          success: true,
          confidence: report.data_quality.confidence_level
        });
        
      } catch (error: any) {
        results.push({
          deal_id: dealId,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      results,
      total: dealIds.length,
      successful: results.filter(r => r.success).length
    });
    
  } catch (error: any) {
    console.error('Batch generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
