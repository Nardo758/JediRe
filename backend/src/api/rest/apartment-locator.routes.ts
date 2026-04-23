/**
 * Apartment Locator AI Routes
 * Admin endpoints for syncing rent data
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { apartmentLocatorSyncService } from '../../services/apartment-locator-sync.service';
import { logger } from '../../utils/logger';
import { query as dbQuery } from '../../database/connection';

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
router.post('/sync-table', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { city, state, minUnits = 1 } = req.body || {};
    const where: string[] = ['p.address_line1 IS NOT NULL', 'p.city IS NOT NULL', 'p.state_code IS NOT NULL'];
    const params: unknown[] = [minUnits];
    where.push(`COALESCE(p.units, 0) >= $1`);
    if (city) {
      params.push(city);
      where.push(`UPPER(p.city) = UPPER($${params.length})`);
    }
    if (state) {
      params.push(state);
      where.push(`UPPER(p.state_code) = UPPER($${params.length})`);
    }

    const sourceRows = await dbQuery(
      `SELECT p.id, p.name, p.address_line1, p.city, p.state_code, p.zip,
              p.lat, p.lng, p.units, p.year_built,
              p.avg_rent, p.market_rent, p.current_occupancy
         FROM properties p
        WHERE ${where.join(' AND ')}`,
      params
    );

    let inserted = 0;
    let updated = 0;
    for (const r of sourceRows.rows) {
      const externalId = `legacy:${r.id}`;
      const result = await dbQuery(
        `INSERT INTO apartment_locator_properties (
            external_id, property_name, address, city, state, zip,
            latitude, longitude, total_units, year_built,
            avg_asking_rent, avg_effective_rent, occupancy_pct,
            source, data_as_of
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'apartment_locator', CURRENT_DATE)
          ON CONFLICT (external_id, source) DO UPDATE SET
            property_name = EXCLUDED.property_name,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            zip = EXCLUDED.zip,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            total_units = EXCLUDED.total_units,
            year_built = EXCLUDED.year_built,
            avg_asking_rent = EXCLUDED.avg_asking_rent,
            avg_effective_rent = EXCLUDED.avg_effective_rent,
            occupancy_pct = EXCLUDED.occupancy_pct,
            last_updated = NOW()
          RETURNING (xmax = 0) AS inserted`,
        [
          externalId,
          r.name || `${r.address_line1}, ${r.city}, ${r.state_code}`,
          r.address_line1,
          r.city,
          r.state_code,
          r.zip || null,
          r.lat || null,
          r.lng || null,
          r.units || null,
          r.year_built || null,
          r.avg_rent || null,
          r.market_rent || null,
          r.current_occupancy != null ? Number(r.current_occupancy) * 100 : null,
        ]
      );
      if (result.rows[0]?.inserted) inserted++;
      else updated++;
    }

    logger.info(`[AL sync-table] inserted=${inserted}, updated=${updated}, source=${sourceRows.rows.length}`);
    res.json({
      success: true,
      stats: {
        sourceRows: sourceRows.rows.length,
        inserted,
        updated,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[AL sync-table] failed', { error: msg });
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
