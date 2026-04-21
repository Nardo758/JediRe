/**
 * Archive Management Routes
 * 
 * Endpoints for scanning, ingesting, and querying archive deal data.
 * Used by Settings → Intelligence & Data and the CashFlow agent.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { 
  ingestArchiveDeals, 
  scanArchiveFolder,
  getArchiveCompStats,
  getArchiveComps,
  type ArchiveCompQuery 
} from '../../services/archive-ingestion.service';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// Default archive path (can be overridden in request)
const DEFAULT_ARCHIVE_PATH = '/home/ldixon/.openclaw/Archive Deals';

/**
 * GET /api/v1/archive/scan
 * Preview what's in the archive folder without ingesting
 */
router.get('/scan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const archivePath = (req.query.path as string) || DEFAULT_ARCHIVE_PATH;
    const folders = scanArchiveFolder(archivePath);
    
    // Summarize file types
    const summary = {
      totalFolders: folders.length,
      folders: folders.slice(0, 50).map(f => ({
        name: f.name,
        fileCount: f.files.length,
        hasT12: f.files.some(file => file.type === 'T12'),
        hasRentRoll: f.files.some(file => file.type === 'RENT_ROLL'),
        hasTaxBill: f.files.some(file => file.type === 'TAX_BILL'),
        hasOM: f.files.some(file => file.type === 'OM'),
        files: f.files.map(file => ({ name: file.name, type: file.type })),
      })),
      truncated: folders.length > 50,
    };
    
    res.json({ success: true, ...summary });
  } catch (err) {
    logger.error('Archive scan error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Scan failed' 
    });
  }
});

/**
 * POST /api/v1/archive/ingest
 * Start archive ingestion (parses all folders and populates data_library_assets)
 */
router.post('/ingest', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path: archivePath, limit, skipExisting } = req.body;
    
    const result = await ingestArchiveDeals(
      archivePath || DEFAULT_ARCHIVE_PATH,
      { 
        limit: limit ? parseInt(limit) : undefined,
        skipExisting: skipExisting !== false, // default true
      }
    );
    
    res.json({ success: true, result });
  } catch (err) {
    logger.error('Archive ingestion error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Ingestion failed' 
    });
  }
});

/**
 * GET /api/v1/archive/status
 * Get current archive ingestion status and statistics
 */
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_assets,
        COUNT(*) FILTER (WHERE source_type = 'archive') as archive_assets,
        COUNT(*) FILTER (WHERE source_type = 'archive' AND trailing_noi IS NOT NULL) as with_noi,
        COUNT(*) FILTER (WHERE source_type = 'archive' AND avg_rent IS NOT NULL) as with_rent_roll,
        COUNT(*) FILTER (WHERE source_type = 'archive' AND parse_status = 'complete') as parsed_complete,
        COUNT(*) FILTER (WHERE source_type = 'archive' AND parse_status = 'error') as parsed_error,
        COUNT(DISTINCT state) FILTER (WHERE source_type = 'archive') as unique_states,
        COUNT(DISTINCT property_type) FILTER (WHERE source_type = 'archive') as unique_property_types
      FROM data_library_assets
    `);
    
    const row = stats.rows[0];
    
    // Get breakdown by state
    const byState = await pool.query(`
      SELECT state, COUNT(*) as count
      FROM data_library_assets
      WHERE source_type = 'archive' AND state IS NOT NULL
      GROUP BY state
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Get breakdown by vintage
    const byVintage = await pool.query(`
      SELECT vintage_band, COUNT(*) as count
      FROM data_library_assets
      WHERE source_type = 'archive' AND vintage_band IS NOT NULL
      GROUP BY vintage_band
      ORDER BY vintage_band
    `);
    
    // Get breakdown by unit count
    const byUnitCount = await pool.query(`
      SELECT unit_count_band, COUNT(*) as count
      FROM data_library_assets
      WHERE source_type = 'archive' AND unit_count_band IS NOT NULL
      GROUP BY unit_count_band
      ORDER BY unit_count_band
    `);
    
    res.json({
      success: true,
      stats: {
        totalAssets: parseInt(row.total_assets),
        archiveAssets: parseInt(row.archive_assets),
        withNoi: parseInt(row.with_noi),
        withRentRoll: parseInt(row.with_rent_roll),
        parsedComplete: parseInt(row.parsed_complete),
        parsedError: parseInt(row.parsed_error),
        uniqueStates: parseInt(row.unique_states),
        uniquePropertyTypes: parseInt(row.unique_property_types),
      },
      breakdown: {
        byState: byState.rows,
        byVintage: byVintage.rows,
        byUnitCount: byUnitCount.rows,
      },
    });
  } catch (err) {
    logger.error('Archive status error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Status fetch failed' 
    });
  }
});

/**
 * GET /api/v1/archive/deals
 * List archive deals with filtering
 */
router.get('/deals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { state, propertyType, vintageBand, unitCountBand, limit = 50, offset = 0 } = req.query;
    
    const conditions: string[] = ["source_type = 'archive'"];
    const params: (string | number)[] = [];
    let paramIndex = 1;
    
    if (state) {
      conditions.push(`state = $${paramIndex++}`);
      params.push(state as string);
    }
    if (propertyType) {
      conditions.push(`property_type = $${paramIndex++}`);
      params.push(propertyType as string);
    }
    if (vintageBand) {
      conditions.push(`vintage_band = $${paramIndex++}`);
      params.push(vintageBand as string);
    }
    if (unitCountBand) {
      conditions.push(`unit_count_band = $${paramIndex++}`);
      params.push(unitCountBand as string);
    }
    
    params.push(parseInt(limit as string) || 50);
    params.push(parseInt(offset as string) || 0);
    
    const result = await pool.query(`
      SELECT 
        id, property_name, city, state, unit_count, year_built,
        property_type, vintage_band, unit_count_band,
        trailing_noi, trailing_revenue, trailing_opex, opex_ratio,
        noi_per_unit, opex_per_unit, avg_rent, occupancy_pct,
        parse_status, parsed_at, parse_warnings
      FROM data_library_assets
      WHERE ${conditions.join(' AND ')}
      ORDER BY property_name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);
    
    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM data_library_assets
      WHERE ${conditions.join(' AND ')}
    `, params.slice(0, -2));
    
    res.json({
      success: true,
      deals: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit as string) || 50,
      offset: parseInt(offset as string) || 0,
    });
  } catch (err) {
    logger.error('Archive deals list error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'List failed' 
    });
  }
});

/**
 * GET /api/v1/archive/deals/:id
 * Get single archive deal details
 */
router.get('/deals/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT *
      FROM data_library_assets
      WHERE id = $1 AND source_type = 'archive'
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    
    res.json({ success: true, deal: result.rows[0] });
  } catch (err) {
    logger.error('Archive deal fetch error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Fetch failed' 
    });
  }
});

/**
 * GET /api/v1/archive/comps
 * Get comparable archive deals for a given profile (used by CashFlow agent)
 */
router.get('/comps', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query: ArchiveCompQuery = {
      state: req.query.state as string,
      msa: req.query.msa as string,
      propertyType: req.query.propertyType as string,
      vintageBand: req.query.vintageBand as string,
      unitCountBand: req.query.unitCountBand as string,
      minUnits: req.query.minUnits ? parseInt(req.query.minUnits as string) : undefined,
      maxUnits: req.query.maxUnits ? parseInt(req.query.maxUnits as string) : undefined,
    };
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const comps = await getArchiveComps(query, limit);
    
    res.json({ success: true, comps });
  } catch (err) {
    logger.error('Archive comps error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Comps query failed' 
    });
  }
});

/**
 * GET /api/v1/archive/stats
 * Get statistical distribution for archive comps (P10/P25/P50/P75/P90)
 */
router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query: ArchiveCompQuery = {
      state: req.query.state as string,
      msa: req.query.msa as string,
      propertyType: req.query.propertyType as string,
      vintageBand: req.query.vintageBand as string,
      unitCountBand: req.query.unitCountBand as string,
    };
    
    const fields = (req.query.fields as string)?.split(',') || 
      ['opex_ratio', 'noi_per_unit', 'opex_per_unit', 'occupancy_pct', 'avg_rent'];
    
    const stats = await getArchiveCompStats(query, fields);
    
    res.json({ success: true, stats, query });
  } catch (err) {
    logger.error('Archive stats error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Stats query failed' 
    });
  }
});

export default router;
