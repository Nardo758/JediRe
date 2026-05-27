/**
 * Apartment Locator AI Routes
 * Admin endpoints for syncing rent data
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { apartmentLocatorSyncService } from '../../services/apartment-locator-sync.service';
import { logger } from '../../utils/logger';
import { query as dbQuery } from '../../database/connection';
import { syncApartmentLocatorTable } from '../../services/property-enrichment/apartment-locator/sync-table.service';

const router = Router();

/**
 * POST /api/v1/apartment-locator/sync-table
 *
 * One-way sync from the legacy `properties` table (populated by
 * ApartmentLocatorSyncService) into the new `apartment_locator_properties`
 * matching table. Does NOT call any external APIs.
 *
 * Body: { city?, state?, minUnits? }
 */
router.post("/sync-table", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { city, state, minUnits = 1 } = req.body || {};
    const stats = await syncApartmentLocatorTable({ city, state, minUnits });
    logger.info(`[AL sync-table] inserted=${stats.inserted}, updated=${stats.updated}, source=${stats.source}`);
    try {
      await dbQuery('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_rent_benchmarks');
      logger.info('[AL sync-table] mv_market_rent_benchmarks refreshed');
    } catch (mvErr: any) {
      logger.warn('[AL sync-table] mv_market_rent_benchmarks refresh failed (non-fatal)', { error: mvErr.message });
    }
    res.json({ success: true, stats: { sourceRows: stats.source, inserted: stats.inserted, updated: stats.updated } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[AL sync-table] failed", { error: msg });
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/v1/apartment-locator/sync/atlanta
 * Sync Atlanta market data and properties
 */
router.post('/sync/atlanta', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('Atlanta sync triggered by user', { userId: req.user?.userId });
    
    const result = await apartmentLocatorSyncService.syncAtlanta();
    if (result.success) {
      try {
        await dbQuery('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_rent_benchmarks');
        logger.info('[AL sync/atlanta] mv_market_rent_benchmarks refreshed');
      } catch (mvErr: any) {
        logger.warn('[AL sync/atlanta] mv_market_rent_benchmarks refresh failed (non-fatal)', { error: mvErr.message });
      }
    }
    res.json({
      success: result.success,
      message: result.success 
        ? `Synced ${result.stats.properties_inserted + result.stats.properties_updated} Atlanta properties`
        : 'Sync failed',
      stats: result.stats
    });
    
  } catch (error: any) {
    logger.error('Atlanta sync endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Sync failed',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/apartment-locator/sync/all
 * Sync all supported metros
 */
router.post('/sync/all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('All metros sync triggered', { userId: req.user?.userId });
    
    const result = await apartmentLocatorSyncService.syncAllMetros();
    if (result.success) {
      try {
        await dbQuery('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_rent_benchmarks');
        logger.info('[AL sync/all] mv_market_rent_benchmarks refreshed');
      } catch (mvErr: any) {
        logger.warn('[AL sync/all] mv_market_rent_benchmarks refresh failed (non-fatal)', { error: mvErr.message });
      }
    }
    res.json({
      success: result.success,
      message: `Synced ${result.results.length} metros`,
      results: result.results
    });
    
  } catch (error: any) {
    logger.error('All metros sync error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Sync failed',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/apartment-locator/status
 * Check Apartment Locator AI connection status
 */
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const marketData = await apartmentLocatorSyncService.fetchMarketData('Atlanta', 'GA');
    
    res.json({
      success: !!marketData,
      connected: !!marketData,
      api_url: process.env.APARTMENT_LOCATOR_API_URL,
      sample_data: marketData ? {
        total_properties: marketData.supply.total_properties,
        avg_rent: marketData.pricing.avg_rent
      } : null
    });
    
  } catch (error: any) {
    res.json({
      success: false,
      connected: false,
      error: error.message
    });
  }
});

export default router;
