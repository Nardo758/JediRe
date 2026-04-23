/**
 * Property Discovery & Matching API Routes
 * 
 * Endpoints for:
 * - Discovering large multifamily properties from municipal APIs
 * - Matching discovered properties with Apartment Locator AI data
 * - Auto-enriching Data Library assets with missing information
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getPropertyDiscoveryService } from '../../services/property-enrichment/discovery/property-discovery.service';
import { getPropertyMatcherService } from '../../services/property-enrichment/matching/property-matcher.service';
import { getDataLibraryAutoEnrichmentService } from '../../services/property-enrichment/data-library/auto-enrichment.service';
import { COUNTY_CONFIGS } from '../../services/property-enrichment/property-info/county-configs';

const router = Router();

// All property-discovery endpoints require authentication
router.use((req: Request, res: Response, next: NextFunction) => {
  return requireAuth(req as Parameters<typeof requireAuth>[0], res, next);
});
const discoveryService = getPropertyDiscoveryService();
const matcherService = getPropertyMatcherService();
const autoEnrichmentService = getDataLibraryAutoEnrichmentService();

// ============================================================================
// DISCOVERY ROUTES
// ============================================================================

/**
 * POST /api/v1/property-discovery/discover
 * 
 * Discover large multifamily properties in a county.
 */
router.post('/discover', async (req: Request, res: Response) => {
  try {
    const {
      county,
      state,
      minUnits = 100,
      minBuildings,
      minSqFt,
      yearBuiltAfter
    } = req.body;
    
    if (!county || !state) {
      return res.status(400).json({ error: 'County and state are required' });
    }
    
    console.log(`[API] Starting discovery: ${county}, ${state} (min ${minUnits} units)`);
    
    const job = await discoveryService.discoverInCounty(county, state, {
      minUnits,
      minBuildings,
      minSqFt,
      yearBuiltAfter
    });
    
    res.json({
      success: job.status === 'complete',
      job
    });
  } catch (error) {
    console.error('[API] Discovery error:', error);
    res.status(500).json({
      error: 'Discovery failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/property-discovery/discover-all
 * 
 * Discover properties across all configured counties.
 */
router.post('/discover-all', async (req: Request, res: Response) => {
  try {
    const { minUnits = 100, states, counties } = req.body;
    
    console.log(`[API] Starting discovery across all counties`);
    
    const jobs = await discoveryService.discoverAll({
      minUnits,
      states,
      counties
    });
    
    const successful = jobs.filter(j => j.status === 'complete').length;
    const totalFound = jobs.reduce((sum, j) => sum + j.propertiesFound, 0);
    const totalNew = jobs.reduce((sum, j) => sum + j.propertiesNew, 0);
    
    res.json({
      success: true,
      summary: {
        counties: jobs.length,
        successful,
        totalFound,
        totalNew
      },
      jobs
    });
  } catch (error) {
    console.error('[API] Discover-all error:', error);
    res.status(500).json({ error: 'Discovery failed' });
  }
});

/**
 * GET /api/v1/property-discovery/discovered
 * 
 * Get discovered properties with optional filters.
 */
router.get('/discovered', async (req: Request, res: Response) => {
  try {
    const {
      county,
      state,
      matchStatus,
      minUnits,
      limit = '50',
      offset = '0'
    } = req.query as Record<string, string>;
    
    // TODO: Query discovered_properties table with filters
    
    res.json({
      properties: [],
      total: 0,
      filters: { county, state, matchStatus, minUnits },
      pagination: { limit: parseInt(limit), offset: parseInt(offset) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get discovered properties' });
  }
});

/**
 * GET /api/v1/property-discovery/stats
 * 
 * Get discovery statistics.
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await discoveryService.getStats();

    res.json({
      ...stats,
      configuredCounties: COUNTY_CONFIGS.length,
      coverageByState: COUNTY_CONFIGS.reduce((acc, c) => {
        acc[c.state] = (acc[c.state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      // List of configured (county, state) pairs so the admin UI can render
      // per-county action rows even before any discoveries exist.
      configuredCountyList: COUNTY_CONFIGS.map(c => ({ county: c.county, state: c.state })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================================================
// MATCHING ROUTES
// ============================================================================

/**
 * POST /api/v1/property-discovery/match
 * 
 * Match discovered properties with Apartment Locator data for a county.
 */
router.post('/match', async (req: Request, res: Response) => {
  try {
    const {
      county,
      state,
      minConfidence = 50,
      autoMatchThreshold = 85
    } = req.body;
    
    if (!county || !state) {
      return res.status(400).json({ error: 'County and state are required' });
    }
    
    console.log(`[API] Starting matching: ${county}, ${state}`);
    
    const result = await matcherService.matchCounty(county, state, {
      minConfidence,
      autoMatchThreshold
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[API] Matching error:', error);
    res.status(500).json({ error: 'Matching failed' });
  }
});

/**
 * GET /api/v1/property-discovery/matches/review
 * 
 * Get matches that need manual review.
 */
router.get('/matches/review', async (req: Request, res: Response) => {
  try {
    const { county, state } = req.query as Record<string, string>;
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
    const { query: dbQuery } = await import('../../database/connection');

    const where: string[] = [];
    const params: unknown[] = [];
    if (county) { params.push(county); where.push(`discovered_address IS NOT NULL AND EXISTS (SELECT 1 FROM discovered_properties dp2 WHERE dp2.id = discovered_property_id AND dp2.county = $${params.length})`); }
    if (state)  { params.push(state); where.push(`EXISTS (SELECT 1 FROM discovered_properties dp3 WHERE dp3.id = discovered_property_id AND dp3.state = $${params.length})`); }
    params.push(limit);

    const sql = `
      SELECT id,
             discovered_property_id,
             apartment_locator_id,
             confidence       AS confidence_score,
             status,
             discovered_address,
             discovered_city,
             al_name          AS al_property_name,
             al_address
        FROM match_review_queue
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       LIMIT $${params.length}
    `;
    const r = await dbQuery(sql, params);
    res.json({ matches: r.rows, total: r.rows.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get review queue';
    console.error('[API] /matches/review failed', error);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/v1/property-discovery/matches/:id/confirm
 * 
 * Confirm a match.
 */
router.post(['/matches/:id/confirm', '/match/:id/confirm'], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await matcherService.confirmMatch(id, userId, notes);
    
    res.json({ success: true, message: 'Match confirmed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm match' });
  }
});

/**
 * POST /api/v1/property-discovery/matches/:id/reject
 * 
 * Reject a match.
 */
router.post(['/matches/:id/reject', '/match/:id/reject'], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    await matcherService.rejectMatch(id, userId, reason);
    
    res.json({ success: true, message: 'Match rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject match' });
  }
});

// ============================================================================
// DATA LIBRARY AUTO-ENRICHMENT ROUTES
// ============================================================================

/**
 * POST /api/v1/property-discovery/enrich-asset
 * 
 * Auto-enrich a Data Library asset with missing information.
 */
router.post('/enrich-asset', async (req: Request, res: Response) => {
  try {
    const { asset, config } = req.body;
    
    if (!asset || !asset.address || !asset.city || !asset.state) {
      return res.status(400).json({
        error: 'Asset with address, city, and state is required'
      });
    }
    
    console.log(`[API] Enriching asset: ${asset.address}, ${asset.city}`);
    
    const result = await autoEnrichmentService.enrichAsset(asset, config);
    
    res.json({
      success: result.success,
      result
    });
  } catch (error) {
    console.error('[API] Enrichment error:', error);
    res.status(500).json({ error: 'Enrichment failed' });
  }
});

/**
 * POST /api/v1/property-discovery/enrich-asset/:id/apply
 * 
 * Apply enrichment results to a Data Library asset.
 */
router.post('/enrich-asset/:id/apply', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { result, conflictResolutions } = req.body;
    
    await autoEnrichmentService.applyEnrichment(id, result, conflictResolutions);
    
    res.json({ success: true, message: 'Enrichment applied' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply enrichment' });
  }
});

/**
 * POST /api/v1/property-discovery/batch-enrich
 * 
 * Batch enrich multiple Data Library assets.
 */
router.post('/batch-enrich', async (req: Request, res: Response) => {
  try {
    const { assets, config } = req.body;
    
    if (!assets || !Array.isArray(assets)) {
      return res.status(400).json({ error: 'Assets array is required' });
    }
    
    if (assets.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 assets per batch' });
    }
    
    const result = await autoEnrichmentService.batchEnrich(assets, config);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: 'Batch enrichment failed' });
  }
});

/**
 * GET /api/v1/property-discovery/enrichment-opportunities
 * 
 * Get Data Library assets that could benefit from enrichment.
 */
router.get('/enrichment-opportunities', async (req: Request, res: Response) => {
  try {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { minScore = '50' } = req.query as Record<string, string>;

    const assets = await autoEnrichmentService.getAssetsNeedingEnrichment(
      userId,
      parseInt(minScore)
    );
    
    res.json({
      assets,
      total: assets.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get enrichment opportunities' });
  }
});

// ============================================================================
// APARTMENT LOCATOR SYNC ROUTES
// ============================================================================

/**
 * POST /api/v1/property-discovery/apartment-locator/sync
 * 
 * Sync properties from Apartment Locator AI.
 */
router.post('/apartment-locator/sync', async (req: Request, res: Response) => {
  try {
    const { county, state, source = 'apartment_locator_ai' } = req.body;
    
    // TODO: Implement sync with Apartment Locator AI API
    // This would pull properties from their system and upsert into apartment_locator_properties
    
    res.json({
      success: true,
      message: 'Sync initiated',
      source
    });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

/**
 * GET /api/v1/property-discovery/apartment-locator/properties
 * 
 * Get Apartment Locator properties.
 */
router.get('/apartment-locator/properties', async (req: Request, res: Response) => {
  try {
    const {
      city,
      state,
      search,
      limit = '50',
      offset = '0'
    } = req.query as Record<string, string>;
    
    // TODO: Query apartment_locator_properties table
    
    res.json({
      properties: [],
      total: 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get properties' });
  }
});

/**
 * POST /api/v1/property-discovery/enrich/:assetId
 *
 * Convenience endpoint that loads asset, enriches it, and returns
 * fields enriched + conflicts (with logIds for resolution).
 */
router.post('/enrich/:assetId', async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const { force } = req.body || {};
    const userId = (req as { user?: { userId?: string; id?: string } }).user?.userId
      ?? (req as { user?: { userId?: string; id?: string } }).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { query: dbQuery0 } = await import('../../database/connection');
    const own = await dbQuery0<{ created_by: string | null }>(
      'SELECT created_by FROM data_library_assets WHERE id = $1',
      [assetId]
    );
    if (!own.rows[0]) return res.status(404).json({ error: 'Asset not found' });
    if (own.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Not authorized to enrich this asset' });
    }
    // Preview-only by default: persist a proposal log but DO NOT mutate the
    // asset. The client must explicitly accept/reject via /enrichment-log/:id/resolve.
    const result = await autoEnrichmentService.enrichAssetById(assetId, {
      autoEnrichOnUpload: true,
      minDqScoreForAutoEnrich: force ? 100 : 50,
      requireConfirmation: true,
      previewOnly: true,
    });
    if (!result) {
      return res.status(404).json({ error: 'Asset not found or not eligible for enrichment' });
    }
    res.json({
      success: result.success,
      assetId: result.assetId,
      fieldsEnriched: result.fieldsEnriched,
      fieldsStillMissing: result.fieldsStillMissing,
      conflicts: result.conflicts,
      previousScore: result.previousScore,
      newScore: result.newScore,
      municipalProvider: result.municipalProvider,
      apartmentLocatorUsed: result.apartmentLocatorUsed,
      logId: result.logId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Enrichment failed';
    console.error('[API] enrich/:assetId failed', error);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/v1/property-discovery/enrichment-log/:logId/resolve
 *
 * Resolve conflicts on a prior enrichment log entry. Two modes:
 *   - { accept: true }                  → apply all conflicting fields
 *   - { accept: false }                 → reject all conflicts
 *   - { resolutions: { field: 'keep' | 'overwrite' } } → per-field decisions
 */
router.post('/enrichment-log/:logId/resolve', async (req: Request, res: Response) => {
  try {
    const { logId } = req.params;
    const { accept, resolutions } = req.body || {};
    const userId = (req as { user?: { userId?: string; id?: string } }).user?.userId
      ?? (req as { user?: { userId?: string; id?: string } }).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { query: dbQuery } = await import('../../database/connection');

    // Ownership: log must reference an asset created by this user
    const own = await dbQuery<{ created_by: string | null }>(
      `SELECT a.created_by
         FROM data_library_enrichment_log l
         JOIN data_library_assets a ON a.id = l.asset_id
        WHERE l.id = $1`,
      [logId]
    );
    if (!own.rows[0]) return res.status(404).json({ error: 'Enrichment log not found' });
    if (own.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Not authorized to resolve this enrichment log' });
    }

    if (resolutions && typeof resolutions === 'object') {
      const map: Record<string, 'keep' | 'overwrite'> = {};
      for (const [k, v] of Object.entries(resolutions)) {
        if (v === 'keep' || v === 'overwrite') map[k] = v;
      }
      await autoEnrichmentService.applyEnrichmentFromLog(logId, map);
      return res.json({ success: true });
    }

    if (typeof accept !== 'boolean') {
      return res.status(400).json({ error: 'accept (boolean) or resolutions (map) is required' });
    }

    if (accept) {
      await autoEnrichmentService.applyEnrichmentFromLog(logId);
    } else {
      await dbQuery(
        `UPDATE data_library_enrichment_log
            SET status = 'rejected', applied_at = NOW()
          WHERE id = $1`,
        [logId]
      );
    }
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Resolve failed';
    console.error('[API] enrichment-log/:logId/resolve failed', error);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/v1/property-discovery/jobs
 *
 * Recent discovery jobs.
 */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 100);
    const { query: dbQuery } = await import('../../database/connection');
    const r = await dbQuery(
      `SELECT id, county, state, status,
              properties_found  AS properties_discovered,
              properties_new,
              properties_updated,
              started_at, completed_at,
              CASE
                WHEN errors IS NULL OR errors = '[]'::jsonb THEN NULL
                ELSE (errors->>0)
              END AS error_message
         FROM discovery_jobs
        ORDER BY started_at DESC NULLS LAST, id DESC
        LIMIT $1`,
      [limit]
    );
    res.json({ jobs: r.rows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to load jobs';
    console.error('[API] /jobs failed', error);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/v1/property-discovery/match-all
 *
 * Match all configured counties; returns aggregate counts.
 */
router.post('/match-all', async (_req: Request, res: Response) => {
  try {
    let totalDiscovered = 0;
    let totalMatched = 0;
    let totalReview = 0;
    const byCounty: Array<{ county: string; state: string; matched: number; reviewRequired: number }> = [];
    for (const cfg of COUNTY_CONFIGS) {
      try {
        const r = await matcherService.matchCounty(cfg.county, cfg.state);
        totalDiscovered += r.total;
        totalMatched += r.matched;
        totalReview += r.reviewRequired;
        byCounty.push({ county: cfg.county, state: cfg.state, matched: r.matched, reviewRequired: r.reviewRequired });
      } catch (e) {
        console.warn(`[match-all] ${cfg.county}, ${cfg.state} failed:`, (e as Error).message);
      }
    }
    res.json({
      success: true,
      totalDiscovered,
      totalMatched,
      totalReview,
      byCounty,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Match-all failed';
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/v1/property-discovery/data-library-assets/:id
 *
 * Convenience: fetch latest asset row (used by AssetDetailModal to refresh
 * after Auto-Enrich apply without re-mounting).
 */
router.get('/data-library-assets/:id/refresh', async (req: Request, res: Response) => {
  try {
    const { query: dbQuery } = await import('../../database/connection');
    const r = await dbQuery(
      `SELECT id, data_quality_score, property_name, address, city, state, zip_code,
              county, property_type, asset_class, year_built, unit_count,
              net_rentable_sqft, occupancy_rate
         FROM data_library_assets WHERE id = $1`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to refresh asset';
    res.status(500).json({ error: msg });
  }
});

export default router;
