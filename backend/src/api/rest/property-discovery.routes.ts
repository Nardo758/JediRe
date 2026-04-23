/**
 * Property Discovery & Matching API Routes
 * 
 * Endpoints for:
 * - Discovering large multifamily properties from municipal APIs
 * - Matching discovered properties with Apartment Locator AI data
 * - Auto-enriching Data Library assets with missing information
 */

import { Router, Request, Response } from 'express';
import { getPropertyDiscoveryService } from '../../services/property-enrichment/discovery/property-discovery.service';
import { getPropertyMatcherService } from '../../services/property-enrichment/matching/property-matcher.service';
import { getDataLibraryAutoEnrichmentService } from '../../services/property-enrichment/data-library/auto-enrichment.service';
import { COUNTY_CONFIGS } from '../../services/property-enrichment/property-info/county-configs';

const router = Router();
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
      coverageByState: Object.fromEntries(
        Object.entries(
          COUNTY_CONFIGS.reduce((acc, c) => {
            acc[c.state] = (acc[c.state] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        )
      )
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
    const { county, state, limit = '50' } = req.query as Record<string, string>;
    
    // TODO: Query match_review_queue view
    
    res.json({
      matches: [],
      total: 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get review queue' });
  }
});

/**
 * POST /api/v1/property-discovery/matches/:id/confirm
 * 
 * Confirm a match.
 */
router.post('/matches/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = (req as any).user?.id;
    
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
router.post('/matches/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.id;
    
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
    const userId = (req as any).user?.id;
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

export default router;
