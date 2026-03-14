/**
 * Admin API Routes (API Key Auth)
 * For automated access via API key instead of JWT
 */

import { Router, Response } from 'express';
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
 * POST /api/v1/admin-api/ingest/bls-qcew
 * SESSION 8: Ingest BLS QCEW employment & wage data for Florida counties
 */
router.post('/ingest/bls-qcew', requireAdminApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const blsApiKey = process.env.BLS_API_KEY;
    if (!blsApiKey) {
      return res.status(400).json({
        error: 'Configuration Error',
        message: 'BLS_API_KEY environment variable not configured'
      });
    }

    const { ingestBLSQCEW } = await import('../../services/ingestion/bls-ingest.service');
    const result = await ingestBLSQCEW(blsApiKey);

    res.json({
      success: true,
      service: 'BLS QCEW',
      result: {
        countiesProcessed: result.countiesProcessed,
        rowsInserted: result.rowsInserted,
        errors: result.errors.length,
        duration_ms: result.endTime.getTime() - result.startTime.getTime(),
        error_details: result.errors.slice(0, 5)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Ingestion Failed',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/admin-api/ingest/census-acs
 * SESSION 8: Ingest Census ACS demographic data for Florida ZIP codes
 */
router.post('/ingest/census-acs', requireAdminApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const censusApiKey = process.env.CENSUS_API_KEY;
    if (!censusApiKey) {
      return res.status(400).json({
        error: 'Configuration Error',
        message: 'CENSUS_API_KEY environment variable not configured'
      });
    }

    const { ingestCensusACS } = await import('../../services/ingestion/census-ingest.service');
    const result = await ingestCensusACS(censusApiKey);

    res.json({
      success: true,
      service: 'Census ACS',
      result: {
        zipCodesProcessed: result.zipCodesProcessed,
        rowsInserted: result.rowsInserted,
        errors: result.errors.length,
        duration_ms: result.endTime.getTime() - result.startTime.getTime(),
        error_details: result.errors.slice(0, 5)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Ingestion Failed',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/admin-api/ingest/census-building-permits
 * SESSION 8: Ingest Census Building Permits for Florida counties
 */
router.post('/ingest/census-building-permits', requireAdminApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const censusApiKey = process.env.CENSUS_API_KEY;
    if (!censusApiKey) {
      return res.status(400).json({
        error: 'Configuration Error',
        message: 'CENSUS_API_KEY environment variable not configured'
      });
    }

    const { ingestBuildingPermits } = await import('../../services/ingestion/census-permits-ingest.service');
    const result = await ingestBuildingPermits(censusApiKey);

    res.json({
      success: true,
      service: 'Census Building Permits',
      result: {
        countiesProcessed: result.countiesProcessed,
        rowsInserted: result.rowsInserted,
        errors: result.errors.length,
        duration_ms: result.endTime.getTime() - result.startTime.getTime(),
        error_details: result.errors.slice(0, 5)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Ingestion Failed',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/admin-api/ingest/florida-geographies
 * SESSION 8: Seed geographies table with Florida counties and MSAs
 */
router.post('/ingest/florida-geographies', requireAdminApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Create geographies table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS geographies (
        id VARCHAR(50) PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        parent_id VARCHAR(50),
        state VARCHAR(2),
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const counties = [
      { fipsId: '12001', name: 'Alachua' }, { fipsId: '12003', name: 'Baker' }, { fipsId: '12005', name: 'Bradford' },
      { fipsId: '12007', name: 'Brevard' }, { fipsId: '12009', name: 'Broward' }, { fipsId: '12011', name: 'Calhoun' },
      { fipsId: '12013', name: 'Charlotte' }, { fipsId: '12015', name: 'Citrus' }, { fipsId: '12017', name: 'Clay' },
      { fipsId: '12019', name: 'Collier' }, { fipsId: '12021', name: 'Columbia' }, { fipsId: '12023', name: 'DeSoto' },
      { fipsId: '12025', name: 'Dixie' }, { fipsId: '12027', name: 'Duval' }, { fipsId: '12029', name: 'Escambia' },
      { fipsId: '12031', name: 'Flagler' }, { fipsId: '12033', name: 'Franklin' }, { fipsId: '12035', name: 'Gadsden' },
      { fipsId: '12037', name: 'Gilchrist' }, { fipsId: '12039', name: 'Glades' }, { fipsId: '12041', name: 'Gulf' },
      { fipsId: '12043', name: 'Hamilton' }, { fipsId: '12045', name: 'Hardee' }, { fipsId: '12047', name: 'Hendry' },
      { fipsId: '12049', name: 'Hernando' }, { fipsId: '12051', name: 'Highlands' }, { fipsId: '12053', name: 'Hillsborough' },
      { fipsId: '12055', name: 'Holmes' }, { fipsId: '12057', name: 'Indian River' }, { fipsId: '12059', name: 'Jackson' },
      { fipsId: '12061', name: 'Jefferson' }, { fipsId: '12063', name: 'Lafayette' }, { fipsId: '12065', name: 'Lake' },
      { fipsId: '12067', name: 'Lee' }, { fipsId: '12069', name: 'Leon' }, { fipsId: '12071', name: 'Levy' },
      { fipsId: '12073', name: 'Liberty' }, { fipsId: '12075', name: 'Madison' }, { fipsId: '12077', name: 'Manatee' },
      { fipsId: '12079', name: 'Marion' }, { fipsId: '12081', name: 'Martin' }, { fipsId: '12083', name: 'Miami-Dade' },
      { fipsId: '12085', name: 'Monroe' }, { fipsId: '12087', name: 'Nassau' }, { fipsId: '12089', name: 'Okaloosa' },
      { fipsId: '12091', name: 'Okeechobee' }, { fipsId: '12093', name: 'Orange' }, { fipsId: '12095', name: 'Osceola' },
      { fipsId: '12097', name: 'Palm Beach' }, { fipsId: '12099', name: 'Pasco' }, { fipsId: '12101', name: 'Pinellas' },
      { fipsId: '12103', name: 'Polk' }, { fipsId: '12105', name: 'Putnam' }, { fipsId: '12107', name: 'St. Johns' },
      { fipsId: '12109', name: 'St. Lucie' }, { fipsId: '12111', name: 'Santa Rosa' }, { fipsId: '12113', name: 'Sarasota' },
      { fipsId: '12115', name: 'Seminole' }, { fipsId: '12117', name: 'Sumter' }, { fipsId: '12119', name: 'Suwannee' },
      { fipsId: '12121', name: 'Taylor' }, { fipsId: '12123', name: 'Union' }, { fipsId: '12125', name: 'Volusia' },
      { fipsId: '12127', name: 'Wakulla' }, { fipsId: '12129', name: 'Walton' }, { fipsId: '12131', name: 'Washington' },
    ];

    const msas = [
      { fipsId: '45300', name: 'Tampa-St Petersburg' }, { fipsId: '36740', name: 'Orlando' },
      { fipsId: '33100', name: 'Miami' }, { fipsId: '27260', name: 'Jacksonville' },
      { fipsId: '38940', name: 'Port St Lucie' }, { fipsId: '15980', name: 'Cape Coral' },
      { fipsId: '19660', name: 'Deltona' }, { fipsId: '29460', name: 'Lakeland' },
      { fipsId: '37340', name: 'Palm Bay' }, { fipsId: '35840', name: 'North Port' },
      { fipsId: '37860', name: 'Pensacola' }, { fipsId: '23540', name: 'Gainesville' },
    ];

    let countiesInserted = 0;
    for (const county of counties) {
      await pool.query(
        `INSERT INTO geographies (id, type, name, parent_id, state) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [county.fipsId, 'county', county.name, '12', 'FL']
      );
      countiesInserted++;
    }

    let msasInserted = 0;
    for (const msa of msas) {
      await pool.query(
        `INSERT INTO geographies (id, type, name, parent_id, state) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [msa.fipsId, 'msa', msa.name, '12', 'FL']
      );
      msasInserted++;
    }

    res.json({
      success: true,
      service: 'Florida Geographies',
      result: {
        countiesInserted,
        msasInserted,
        totalInserted: countiesInserted + msasInserted
      },
      message: 'Note: ZIP codes are auto-seeded during Census ACS ingestion',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Seeding Failed',
      message: error.message
    });
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
