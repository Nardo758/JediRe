/**
 * Admin Data Coverage Routes
 * Monitor property data coverage across counties
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const router = Router();

// Middleware to require admin role
const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: any) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new AppError(403, 'Admin access required');
  }
  next();
};

/**
 * GET /api/v1/admin/data-coverage
 * Get overall coverage summary
 */
router.get('/', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    // Get all counties
    const coverage = await query(`
      SELECT * FROM coverage_summary
      ORDER BY state_code, county
    `);
    
    // Get summary stats
    const summary = await query(`
      SELECT 
        COUNT(DISTINCT CONCAT(county, state_code)) as total_counties,
        SUM(scraped_count) as total_properties,
        AVG(success_rate_24h) as avg_success_rate,
        AVG(avg_response_time_ms) as avg_api_response,
        COUNT(*) FILTER (WHERE api_status = 'active') as active_counties,
        SUM(stale_count) as total_stale
      FROM property_data_coverage
    `);
    
    // Get recent activity
    const recentActivity = await query(`
      SELECT * FROM recent_scrape_activity
      LIMIT 20
    `);
    
    res.json({
      counties: coverage.rows,
      summary: summary.rows[0],
      recentActivity: recentActivity.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/data-coverage/:county/:state
 * Get detailed coverage for specific county
 */
router.get('/:county/:state', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { county, state } = req.params;
    
    // Get coverage details
    const coverage = await query(
      'SELECT * FROM property_data_coverage WHERE county = $1 AND state_code = $2',
      [county, state]
    );
    
    if (coverage.rows.length === 0) {
      throw new AppError(404, 'County not found');
    }
    
    // Get recent activity
    const recentActivity = await query(`
      SELECT * FROM recent_scrape_activity
      WHERE county = $1 AND state_code = $2
      LIMIT 100
    `, [county, state]);
    
    // Get stale properties count by age bucket
    const staleBreakdown = await query(`
      SELECT
        COUNT(*) FILTER (WHERE scraped_at < NOW() - INTERVAL '30 days' AND scraped_at >= NOW() - INTERVAL '60 days') as stale_30_60,
        COUNT(*) FILTER (WHERE scraped_at < NOW() - INTERVAL '60 days' AND scraped_at >= NOW() - INTERVAL '90 days') as stale_60_90,
        COUNT(*) FILTER (WHERE scraped_at < NOW() - INTERVAL '90 days') as stale_90_plus
      FROM property_records
      WHERE county = $1 AND state_code = $2
    `, [county, state]);
    
    // Get sample stale properties
    const sampleStale = await query(`
      SELECT parcel_id, address, scraped_at
      FROM property_records
      WHERE county = $1 AND state_code = $2 AND scraped_at < NOW() - INTERVAL '30 days'
      ORDER BY scraped_at ASC
      LIMIT 10
    `, [county, state]);
    
    res.json({
      coverage: coverage.rows[0],
      recentActivity: recentActivity.rows,
      staleBreakdown: staleBreakdown.rows[0],
      sampleStale: sampleStale.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/data-coverage/:county/:state/scrape
 * Trigger bulk scrape for county
 */
router.post('/:county/:state/scrape', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { county, state } = req.params;
    const { limit = 100, minUnits = 1 } = req.body;
    
    const startTime = Date.now();
    
    // Call property API worker
    const response = await fetch('https://property-api.m-dixon5030.workers.dev/multifamily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minUnits, limit }),
    });
    
    if (!response.ok) {
      throw new AppError(response.status, 'Failed to scrape properties from API');
    }
    
    const data = await response.json();
    const duration = (Date.now() - startTime) / 1000;
    
    // Log activity
    await query(`
      SELECT log_scrape_activity($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      county,
      state,
      'bulk_import',
      data.total || 0,
      data.total || 0,
      0,
      duration,
      'manual',
      req.user?.userId,
    ]);
    
    // Update coverage stats
    await query('SELECT update_county_coverage_stats($1, $2)', [county, state]);
    
    logger.info('Bulk scrape completed', {
      userId: req.user?.userId,
      county,
      state,
      imported: data.total,
      duration,
    });
    
    res.json({
      success: true,
      imported: data.total,
      duration,
      properties: data.properties?.slice(0, 5), // Sample
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/data-coverage/refresh-stale
 * Refresh all stale properties
 */
router.post('/refresh-stale', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { limit = 100 } = req.body;
    
    // Get stale properties
    const staleProperties = await query(`
      SELECT parcel_id, county, state_code, address
      FROM property_records 
      WHERE scraped_at < NOW() - INTERVAL '30 days'
      ORDER BY scraped_at ASC
      LIMIT $1
    `, [limit]);
    
    const startTime = Date.now();
    let refreshed = 0;
    let failed = 0;
    const errors: string[] = [];
    
    for (const prop of staleProperties.rows) {
      try {
        const response = await fetch('https://property-api.m-dixon5030.workers.dev/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parcelId: prop.parcel_id }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.property) {
            // Property data returned, will be saved by the endpoint
            refreshed++;
          } else {
            failed++;
            errors.push(`${prop.parcel_id}: Property not found`);
          }
        } else {
          failed++;
          errors.push(`${prop.parcel_id}: API error ${response.status}`);
        }
      } catch (error: any) {
        failed++;
        errors.push(`${prop.parcel_id}: ${error.message}`);
      }
    }
    
    const duration = (Date.now() - startTime) / 1000;
    
    // Log activity for each county affected
    const countiesByState = new Map<string, Set<string>>();
    for (const prop of staleProperties.rows) {
      const key = `${prop.county}|${prop.state_code}`;
      if (!countiesByState.has(key)) {
        countiesByState.set(key, new Set([prop.county, prop.state_code]));
      }
    }
    
    for (const [_, [county, state]] of Array.from(countiesByState.entries())) {
      await query(`
        SELECT log_scrape_activity($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [county, state, 'refresh', limit, refreshed, failed, duration, 'manual', req.user?.userId]);
      
      await query('SELECT update_county_coverage_stats($1, $2)', [county, state]);
    }
    
    logger.info('Stale properties refreshed', {
      userId: req.user?.userId,
      attempted: staleProperties.rows.length,
      refreshed,
      failed,
      duration,
    });
    
    res.json({
      success: true,
      attempted: staleProperties.rows.length,
      refreshed,
      failed,
      errors: errors.slice(0, 10), // First 10 errors
      duration,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/data-coverage/:county/:state/test-api
 * Test county API connection
 */
router.post('/:county/:state/test-api', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { county, state } = req.params;
    
    const startTime = Date.now();
    
    // Test with a simple query
    const response = await fetch('https://property-api.m-dixon5030.workers.dev/health');
    const responseTime = Date.now() - startTime;
    
    const isHealthy = response.ok;
    const data = await response.json();
    
    // Update API status
    await query(`
      UPDATE property_data_coverage
      SET
        api_status = $1,
        last_api_check = NOW(),
        avg_response_time_ms = $2
      WHERE county = $3 AND state_code = $4
    `, [isHealthy ? 'active' : 'down', responseTime, county, state]);
    
    logger.info('API health check', {
      userId: req.user?.userId,
      county,
      state,
      status: isHealthy ? 'healthy' : 'down',
      responseTime,
    });
    
    res.json({
      success: true,
      healthy: isHealthy,
      responseTime,
      details: data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/admin/data-coverage/:county/:state
 * Update county configuration
 */
router.put('/:county/:state', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { county, state } = req.params;
    const {
      totalParcels,
      apiUrl,
      apiType,
      apiStatus,
      notes,
    } = req.body;
    
    const result = await query(`
      UPDATE property_data_coverage
      SET
        total_parcels = COALESCE($1, total_parcels),
        api_url = COALESCE($2, api_url),
        api_type = COALESCE($3, api_type),
        api_status = COALESCE($4, api_status),
        notes = COALESCE($5, notes),
        updated_at = NOW()
      WHERE county = $6 AND state_code = $7
      RETURNING *
    `, [totalParcels, apiUrl, apiType, apiStatus, notes, county, state]);
    
    if (result.rows.length === 0) {
      throw new AppError(404, 'County not found');
    }
    
    logger.info('County configuration updated', {
      userId: req.user?.userId,
      county,
      state,
    });
    
    res.json({
      success: true,
      coverage: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/data-coverage/activity/recent
 * Get recent scraping activity across all counties
 */
router.get('/activity/recent', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { limit = 50 } = req.query;
    
    const activity = await query(`
      SELECT * FROM recent_scrape_activity
      LIMIT $1
    `, [limit]);
    
    res.json({
      activity: activity.rows,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
