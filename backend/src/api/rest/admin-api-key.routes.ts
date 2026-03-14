/**
 * Admin API Routes (API Key Auth)
 * For automated access via API key instead of JWT
 */

import { Router, Response } from 'express';
import axios from 'axios';
import { getPool } from '../../database/connection';
import { AuthenticatedRequest } from '../../middleware/auth';

const router = Router();
const pool = getPool();

/**
 * Middleware: Require Admin API Key
 */
function requireAdminApiKey(req: AuthenticatedRequest, res: Response, next: Function) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin API key required (X-API-Key header)'
    });
  }
  
  const validKey = process.env.API_KEY_ADMIN;
  
  if (!validKey || apiKey !== validKey) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid admin API key'
    });
  }
  
  // Set user context for admin operations
  req.user = {
    userId: 'admin-api-key',
    email: 'admin@system',
    role: 'admin'
  };
  
  next();
}

/**
 * GET /api/v1/admin-api/data/status
 * Full database status
 */
router.get('/data/status', requireAdminApiKey, async (req, res) => {
  try {
    const [
      municipalities,
      zoningDistricts,
      benchmarkProjects,
      properties,
      rentComps,
      deals
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM municipalities'),
      pool.query('SELECT COUNT(*) as count FROM zoning_districts'),
      pool.query('SELECT COUNT(*) as count FROM benchmark_projects'),
      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(current_zoning) FILTER (WHERE current_zoning IS NOT NULL) as with_zoning,
          COUNT(lat) FILTER (WHERE lat IS NOT NULL) as with_coords
        FROM properties
      `),
      pool.query('SELECT COUNT(*) as count FROM rent_comps'),
      pool.query('SELECT COUNT(*) as count FROM deals')
    ]);
    
    res.json({
      municipalities: parseInt(municipalities.rows[0].count),
      zoning_districts: parseInt(zoningDistricts.rows[0].count),
      benchmark_projects: parseInt(benchmarkProjects.rows[0].count),
      properties: {
        total: parseInt(properties.rows[0].total),
        with_zoning: parseInt(properties.rows[0].with_zoning),
        with_coords: parseInt(properties.rows[0].with_coords)
      },
      rent_comps: parseInt(rentComps.rows[0].count),
      deals: parseInt(deals.rows[0].count),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin-api/data/zoning-coverage
 * Zoning data coverage by city
 */
router.get('/data/zoning-coverage', requireAdminApiKey, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.name as municipality,
        m.state,
        COUNT(zd.id) as district_count,
        m.has_api,
        m.data_quality,
        m.last_scraped_at
      FROM municipalities m
      LEFT JOIN zoning_districts zd ON zd.municipality_id = m.id
      GROUP BY m.id, m.name, m.state, m.has_api, m.data_quality, m.last_scraped_at
      ORDER BY district_count DESC
    `);
    
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin-api/data/benchmark-stats
 * Benchmark project statistics
 */
router.get('/data/benchmark-stats', requireAdminApiKey, async (req, res) => {
  try {
    const [summary, byMunicipality, byOutcome] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE outcome = 'approved') as approved,
          COUNT(*) FILTER (WHERE total_entitlement_days IS NOT NULL) as with_timeline,
          AVG(total_entitlement_days) FILTER (WHERE total_entitlement_days > 0) as avg_days
        FROM benchmark_projects
      `),
      pool.query(`
        SELECT 
          municipality,
          state,
          COUNT(*) as count
        FROM benchmark_projects
        WHERE municipality IS NOT NULL
        GROUP BY municipality, state
        ORDER BY count DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT 
          outcome,
          COUNT(*) as count
        FROM benchmark_projects
        GROUP BY outcome
        ORDER BY count DESC
      `)
    ]);
    
    res.json({
      summary: summary.rows[0],
      by_municipality: byMunicipality.rows,
      by_outcome: byOutcome.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/admin-api/ingest/run
 * Trigger full ingestion
 */
router.post('/ingest/run', requireAdminApiKey, async (req, res) => {
  try {
    const { step } = req.body;
    
    // For now, just acknowledge
    // The actual ingestion would be triggered asynchronously
    res.json({
      message: 'Ingestion job queued',
      step: step || 'full',
      status: 'pending'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin-api/municipalities
 * List all municipalities
 */
router.get('/municipalities', requireAdminApiKey, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.*,
        COUNT(zd.id) as district_count
      FROM municipalities m
      LEFT JOIN zoning_districts zd ON zd.municipality_id = m.id
      GROUP BY m.id
      ORDER BY m.state, m.name
    `);
    
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin-api/health
 * Health check
 */
router.get('/health', requireAdminApiKey, async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

export default router;
