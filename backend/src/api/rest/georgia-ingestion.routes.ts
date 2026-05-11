/**
 * Georgia Metro Data Ingestion API Routes
 * Endpoints for ingesting property data from Cobb, Gwinnett, DeKalb, Fulton
 */

import { Router, Request, Response } from 'express';
import {
  getGeorgiaIngestionOrchestrator,
  getCobbIngestionService,
  getGwinnettIngestionService,
  getDeKalbIngestionService,
  getFultonIngestionService,
  IngestionConfig
} from '../../services/property-enrichment/georgia';
import { getRecentJobs, getLastJob } from '../../services/property-enrichment/georgia/job-tracker';
import { georgiaSaleCompsService } from '../../services/saleComps/georgia-sale-comps.service';
import { apartmentLocatorSyncService } from '../../services/apartment-locator-sync.service';
import { ingestAtlantaNews } from '../../scripts/ingest-atlanta-news';
import { getPool } from '../../database/connection';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { geocodingService } from '../../services/geocoding.service';
import { syncMartaGtfs } from '../../services/real-data/marta-gtfs.service';
import { syncOsmPois } from '../../services/real-data/osm-overpass.service';
import { syncAtlantaPdCrime } from '../../services/real-data/atlanta-pd-crime.service';
import { BacktestService } from '../../services/proximity/backtest.service';

const router = Router();
const orchestrator = getGeorgiaIngestionOrchestrator();

// ============================================================================
// ORCHESTRATOR ROUTES
// ============================================================================

/**
 * POST /api/v1/georgia/ingest
 * Run full ingestion for specified counties
 */
router.post('/ingest', async (req: Request, res: Response) => {
  try {
    const {
      counties,
      parallel = false,
      batchSize = 1000,
      maxRecords,
      filterMultifamilyOnly = false
    } = req.body;
    
    const config: Partial<IngestionConfig> = {
      batchSize,
      maxRecords,
      filterMultifamilyOnly
    };
    
    console.log(`[API] Starting Georgia ingestion: ${counties?.join(', ') || 'all'}`);
    
    const result = await orchestrator.ingestAll(config, { counties, parallel });
    
    res.json({
      success: result.summary.failedCounties.length === 0,
      ...result
    });
  } catch (error) {
    console.error('[API] Georgia ingestion error:', error);
    res.status(500).json({
      error: 'Ingestion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/georgia/ingest/sales
 * Ingest sales data only (Cobb + Fulton)
 */
router.post('/ingest/sales', async (req: Request, res: Response) => {
  try {
    const { batchSize = 1000, maxRecords } = req.body;
    
    const config: Partial<IngestionConfig> = { batchSize, maxRecords };
    
    const result = await orchestrator.ingestSalesOnly(config);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({ error: 'Sales ingestion failed' });
  }
});

/**
 * GET /api/v1/georgia/multifamily/count
 * Get count of multifamily properties per county
 */
router.get('/multifamily/count', async (_req: Request, res: Response) => {
  try {
    const counts = await orchestrator.getMultifamilyProperties();
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to count multifamily' });
  }
});

// ============================================================================
// COBB COUNTY ROUTES
// ============================================================================

/**
 * POST /api/v1/georgia/cobb/ingest
 */
router.post('/cobb/ingest', async (req: Request, res: Response) => {
  try {
    const service = getCobbIngestionService();
    const job = await service.ingestAll(req.body);
    res.json({ success: job.status === 'complete', job });
  } catch (error) {
    res.status(500).json({ error: 'Cobb ingestion failed' });
  }
});

/**
 * GET /api/v1/georgia/cobb/multifamily
 */
router.get('/cobb/multifamily', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || undefined;
    const service = getCobbIngestionService();
    const parcels = await service.getMultifamilyParcels(limit);
    res.json({ count: parcels.length, parcels: parcels.slice(0, 100) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Cobb multifamily' });
  }
});

/**
 * GET /api/v1/georgia/cobb/parcel/:parid/sales
 */
router.get('/cobb/parcel/:parid/sales', async (req: Request, res: Response) => {
  try {
    const { parid } = req.params;
    const service = getCobbIngestionService();
    const sales = await service.getSalesForParcel(parid);
    res.json({ parcelId: parid, salesCount: sales.length, sales });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sales' });
  }
});

/**
 * GET /api/v1/georgia/cobb/parcel/:parid/yearbuilt
 */
router.get('/cobb/parcel/:parid/yearbuilt', async (req: Request, res: Response) => {
  try {
    const { parid } = req.params;
    const service = getCobbIngestionService();
    const yearBuilt = await service.getYearBuiltForParcel(parid);
    res.json({ parcelId: parid, yearBuilt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get year built' });
  }
});

// ============================================================================
// GWINNETT COUNTY ROUTES
// ============================================================================

/**
 * POST /api/v1/georgia/gwinnett/ingest
 */
router.post('/gwinnett/ingest', async (req: Request, res: Response) => {
  try {
    const service = getGwinnettIngestionService();
    const job = await service.ingestAll(req.body);
    res.json({ success: job.status === 'complete', job });
  } catch (error) {
    res.status(500).json({ error: 'Gwinnett ingestion failed' });
  }
});

/**
 * GET /api/v1/georgia/gwinnett/apartments
 */
router.get('/gwinnett/apartments', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || undefined;
    const service = getGwinnettIngestionService();
    const apartments = await service.getApartments(limit);
    res.json({ count: apartments.length, apartments: apartments.slice(0, 100) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Gwinnett apartments' });
  }
});

/**
 * GET /api/v1/georgia/gwinnett/property/:lrsn
 */
router.get('/gwinnett/property/:lrsn', async (req: Request, res: Response) => {
  try {
    const { lrsn } = req.params;
    const service = getGwinnettIngestionService();
    const property = await service.getPropertyByLRSN(lrsn);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get property' });
  }
});

// ============================================================================
// DEKALB COUNTY ROUTES
// ============================================================================

/**
 * POST /api/v1/georgia/dekalb/ingest
 */
router.post('/dekalb/ingest', async (req: Request, res: Response) => {
  try {
    const service = getDeKalbIngestionService();
    const job = await service.ingestAll(req.body);
    res.json({ success: job.status === 'complete', job });
  } catch (error) {
    res.status(500).json({ error: 'DeKalb ingestion failed' });
  }
});

/**
 * GET /api/v1/georgia/dekalb/parcel/:parcelId
 */
router.get('/dekalb/parcel/:parcelId', async (req: Request, res: Response) => {
  try {
    const { parcelId } = req.params;
    const service = getDeKalbIngestionService();
    const parcel = await service.getParcelById(parcelId);
    
    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }
    
    res.json(parcel);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get parcel' });
  }
});

/**
 * GET /api/v1/georgia/dekalb/permits/search
 */
router.get('/dekalb/permits/search', async (req: Request, res: Response) => {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    
    const service = getDeKalbIngestionService();
    const permits = await service.searchPermitsByAddress(address as string);
    res.json({ address, count: permits.length, permits });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search permits' });
  }
});

// ============================================================================
// FULTON COUNTY ROUTES
// ============================================================================

/**
 * POST /api/v1/georgia/fulton/ingest
 */
router.post('/fulton/ingest', async (req: Request, res: Response) => {
  try {
    const service = getFultonIngestionService();
    const job = await service.ingestAll(req.body);
    res.json({ success: job.status === 'complete', job });
  } catch (error) {
    res.status(500).json({ error: 'Fulton ingestion failed' });
  }
});

/**
 * POST /api/v1/georgia/fulton/ingest/sales
 */
router.post('/fulton/ingest/sales', async (req: Request, res: Response) => {
  try {
    const service = getFultonIngestionService();
    const job = await service.ingestSales(req.body);
    res.json({ success: job.status === 'complete', job });
  } catch (error) {
    res.status(500).json({ error: 'Fulton sales ingestion failed' });
  }
});

/**
 * GET /api/v1/georgia/fulton/parcel/:parcelId/sales
 */
router.get('/fulton/parcel/:parcelId/sales', async (req: Request, res: Response) => {
  try {
    const { parcelId } = req.params;
    const service = getFultonIngestionService();
    const sales = await service.getSalesForParcel(parcelId);
    res.json({ parcelId, salesCount: sales.length, sales });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sales' });
  }
});

/**
 * GET /api/v1/georgia/fulton/structures/sql
 * Get the SQL needed for spatial join of structures to parcels
 */
router.get('/fulton/structures/sql', async (_req: Request, res: Response) => {
  try {
    const service = getFultonIngestionService();
    const sql = service.getStructuresSpatialJoinSQL();
    res.json({ sql });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get SQL' });
  }
});

/**
 * POST /api/v1/georgia/fulton/ingest/parcels-geometry
 * Load Fulton parcel polygon geometry into fulton_parcels staging table.
 * Required before running the spatial join.
 */
router.post('/fulton/ingest/parcels-geometry', async (req: Request, res: Response) => {
  try {
    const service = getFultonIngestionService();
    const result = await service.ingestParcelGeometry(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[API] Fulton parcel geometry error:', error);
    res.status(500).json({ error: 'Parcel geometry ingest failed', message: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * POST /api/v1/georgia/fulton/ingest/structures
 * Load Fulton building footprint geometry into fulton_structures staging table.
 * Required before running the spatial join.
 * Accepts: { maxRecords?: number, batchSize?: number }
 */
router.post('/fulton/ingest/structures', async (req: Request, res: Response) => {
  try {
    const service = getFultonIngestionService();
    const result = await service.ingestStructures(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[API] Fulton structures error:', error);
    res.status(500).json({ error: 'Structures ingest failed', message: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * POST /api/v1/georgia/fulton/structures/spatial-join
 * Run PostGIS ST_Intersects join: updates property_info_cache year_built / stories
 * for all Fulton parcels where year_built IS NULL, matched by building footprint.
 * Requires both fulton_parcels and fulton_structures to be populated first.
 */
router.post('/fulton/structures/spatial-join', async (_req: Request, res: Response) => {
  try {
    const service = getFultonIngestionService();
    const result = await service.runSpatialJoin();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[API] Fulton spatial join error:', error);
    res.status(500).json({ error: 'Spatial join failed', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// ANALYTICS ROUTES (P0 Gap 2 + P1 Gap 6)
// ============================================================================

/**
 * POST /api/v1/georgia/comps/promote
 * ETL: Promote georgia_property_sales + property_info_cache → market_sale_comps
 * Enables CompSetService.generateCompSet() to find ATL metro comps for deals.
 * Body: { county?: string, state?: string, minSalePrice?: number, minUnits?: number }
 */
router.post('/comps/promote', async (req: Request, res: Response) => {
  try {
    const { county, state = 'GA', minSalePrice, minUnits } = req.body || {};
    const results = await georgiaSaleCompsService.promoteGeorgiaSales({
      county, state,
      minSalePrice: minSalePrice ? Number(minSalePrice) : undefined,
      minUnits: minUnits ? Number(minUnits) : undefined,
    });
    const total = results.reduce((s, r) => s + r.promoted, 0);
    res.json({ success: true, total_promoted: total, by_county: results });
  } catch (error) {
    console.error('[API] comps/promote error:', error);
    res.status(500).json({ error: 'Failed to promote Georgia sales', message: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * POST /api/v1/georgia/comps/enrich
 * Backfill cap_rate, units, price_per_unit, buyer_type and seller on the
 * multifamily-candidate slice of market_sale_comps so the Capital Markets tab
 * has live cap-rate-by-class and $/unit metrics.
 *
 * Idempotent: only fills NULLs (or recomputes price_per_unit when units
 * become known). Run after `comps/promote` or as part of ingestion follow-up.
 *
 * Body: { state?: string }   (default 'GA')
 */
router.post('/comps/enrich', requireAuth, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const { state = 'GA' } = req.body || {};
    const result = await georgiaSaleCompsService.enrichCapitalMarkets(state);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[API] comps/enrich error:', error);
    res.status(500).json({
      error: 'Failed to enrich capital markets data',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/v1/georgia/comps/stats
 * Coverage stats per county — comp count, date range, price/unit metrics.
 */
router.get('/comps/stats', async (req: Request, res: Response) => {
  try {
    const state = (req.query.state as string) || 'GA';
    const stats = await georgiaSaleCompsService.getSaleCompStats(state);
    res.json({ success: true, state, stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get comp stats' });
  }
});

/**
 * GET /api/v1/georgia/analytics/price-trends
 * Gap 6: Price trend time-series by county and year.
 * Returns YoY median price change for ATL metro submarket analysis.
 * Query: ?county=Cobb&state=GA
 */
router.get('/analytics/price-trends', requireAuth, async (req: Request, res: Response) => {
  try {
    const county = req.query.county as string | undefined;
    const state = (req.query.state as string) || 'GA';
    const trends = await georgiaSaleCompsService.getPriceTrends({ county, state });
    res.json({ success: true, county: county || 'all', state, trends });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get price trends' });
  }
});

/**
 * GET /api/v1/georgia/analytics/rent-trends
 * Market rent time-series by bedroom type for Atlanta metro.
 * Source: apartment_market_snapshots (synced from Apartment Locator AI).
 * Returns snapshots sorted newest-first with studio/1br/2br/3br rents.
 * Query: ?city=Atlanta&state=GA&limit=12
 */
router.get('/analytics/rent-trends', requireAuth, async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Atlanta';
    const state = (req.query.state as string) || 'GA';
    const limit = Math.min(parseInt(req.query.limit as string) || 12, 36);
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        snapshot_date::text           AS snapshot_date,
        city,
        state,
        avg_rent,
        studio_rent,
        one_br_rent,
        two_br_rent,
        three_br_rent,
        avg_occupancy,
        concession_rate,
        rent_growth_90d,
        rent_growth_180d
      FROM apartment_market_snapshots
      WHERE city ILIKE $1
        AND state = $2
        AND (studio_rent IS NOT NULL OR one_br_rent IS NOT NULL OR avg_rent IS NOT NULL)
      ORDER BY snapshot_date DESC
      LIMIT $3
    `, [city, state, limit]);

    const snapshots = result.rows.map((r: any) => ({
      snapshot_date: r.snapshot_date,
      city: r.city,
      state: r.state,
      avg_rent: r.avg_rent != null ? parseFloat(r.avg_rent) : null,
      studio_rent: r.studio_rent != null ? parseFloat(r.studio_rent) : null,
      one_br_rent: r.one_br_rent != null ? parseFloat(r.one_br_rent) : null,
      two_br_rent: r.two_br_rent != null ? parseFloat(r.two_br_rent) : null,
      three_br_rent: r.three_br_rent != null ? parseFloat(r.three_br_rent) : null,
      avg_occupancy: r.avg_occupancy != null ? parseFloat(r.avg_occupancy) : null,
      concession_rate: r.concession_rate != null ? parseFloat(r.concession_rate) : null,
      rent_growth_90d: r.rent_growth_90d != null ? parseFloat(r.rent_growth_90d) : null,
      rent_growth_180d: r.rent_growth_180d != null ? parseFloat(r.rent_growth_180d) : null,
    }));

    res.json({ success: true, city, state, count: snapshots.length, snapshots });
  } catch (error) {
    console.error('[API] /georgia/analytics/rent-trends error:', error);
    res.status(500).json({ error: 'Failed to get rent trends' });
  }
});

/**
 * GET /api/v1/georgia/analytics/rent-by-class
 * Average asking rent by asset class (A/B/C derived from year_built) from apartment_locator_properties.
 * Class A = year_built >= 2010, Class B = year_built >= 1995, Class C = older.
 * Query: ?city=Atlanta&state=GA
 */
router.get('/analytics/rent-by-class', requireAuth, async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Atlanta';
    const state = (req.query.state as string) || 'GA';
    const pool = getPool();

    // Task #353: optional ?history=true returns the last N snapshots from
    // apartment_class_rent_snapshots so the frontend can chart trends.
    const historyFlag = String(req.query.history || '').toLowerCase();
    if (historyFlag === 'true' || historyFlag === '1') {
      const limitRaw = parseInt(String(req.query.limit || '12'), 10);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 365
        ? limitRaw
        : 12;

      // Pull the most-recent N distinct snapshot dates, then return the
      // class rows for those dates.
      const datesResult = await pool.query(`
        SELECT DISTINCT snapshot_date
        FROM apartment_class_rent_snapshots
        WHERE city ILIKE $1 AND state = $2
        ORDER BY snapshot_date DESC
        LIMIT $3
      `, [city, state, limit]);

      const dates = datesResult.rows.map((r: any) => r.snapshot_date);
      if (dates.length === 0) {
        return res.json({ success: true, city, state, count: 0, history: [] });
      }

      const rowsResult = await pool.query(`
        SELECT
          snapshot_date,
          asset_class,
          property_count,
          avg_rent,
          min_rent,
          max_rent
        FROM apartment_class_rent_snapshots
        WHERE city ILIKE $1
          AND state = $2
          AND snapshot_date = ANY($3::date[])
        ORDER BY snapshot_date ASC, asset_class ASC
      `, [city, state, dates]);

      // Group rows by snapshot_date so the frontend can render a series.
      const byDate = new Map<string, any>();
      for (const r of rowsResult.rows) {
        const dateStr = r.snapshot_date instanceof Date
          ? r.snapshot_date.toISOString().slice(0, 10)
          : String(r.snapshot_date).slice(0, 10);
        if (!byDate.has(dateStr)) {
          byDate.set(dateStr, { snapshot_date: dateStr, classes: [] });
        }
        byDate.get(dateStr).classes.push({
          asset_class: r.asset_class,
          property_count: r.property_count,
          avg_rent: r.avg_rent != null ? Number(r.avg_rent) : null,
          min_rent: r.min_rent != null ? Number(r.min_rent) : null,
          max_rent: r.max_rent != null ? Number(r.max_rent) : null,
        });
      }

      const history = Array.from(byDate.values());
      return res.json({
        success: true,
        city,
        state,
        count: history.length,
        history,
      });
    }

    const result = await pool.query(`
      SELECT
        CASE
          WHEN year_built >= 2010 THEN 'A'
          WHEN year_built >= 1995 THEN 'B'
          ELSE 'C'
        END AS asset_class,
        COUNT(*)::int                                   AS property_count,
        ROUND(AVG(avg_asking_rent)::numeric, 0)::int    AS avg_rent,
        ROUND(MIN(avg_asking_rent)::numeric, 0)::int    AS min_rent,
        ROUND(MAX(avg_asking_rent)::numeric, 0)::int    AS max_rent
      FROM apartment_locator_properties
      WHERE city ILIKE $1
        AND state = $2
        AND avg_asking_rent IS NOT NULL
        AND avg_asking_rent > 0
      GROUP BY asset_class
      ORDER BY asset_class
    `, [city, state]);

    const classes = result.rows.map((r: any) => ({
      asset_class: r.asset_class,
      property_count: r.property_count,
      avg_rent: r.avg_rent != null ? Number(r.avg_rent) : null,
      min_rent: r.min_rent != null ? Number(r.min_rent) : null,
      max_rent: r.max_rent != null ? Number(r.max_rent) : null,
    }));

    res.json({ success: true, city, state, count: classes.length, classes });
  } catch (error) {
    console.error('[API] /georgia/analytics/rent-by-class error:', error);
    res.status(500).json({ error: 'Failed to get rent by class' });
  }
});

/**
 * GET /api/v1/georgia/analytics/nearby-comps
 * Ad-hoc proximity comp lookup for a lat/lon point.
 * Query: ?lat=33.749&lon=-84.388&radiusMiles=3&minUnits=20
 */
router.get('/analytics/nearby-comps', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'lat and lon query params required' });
    }
    const comps = await georgiaSaleCompsService.getNearbyComps({
      latitude: lat,
      longitude: lon,
      radiusMiles: req.query.radiusMiles ? parseFloat(req.query.radiusMiles as string) : 3,
      minUnits: req.query.minUnits ? parseInt(req.query.minUnits as string) : 20,
      maxUnits: req.query.maxUnits ? parseInt(req.query.maxUnits as string) : 1000,
      monthsBack: req.query.monthsBack ? parseInt(req.query.monthsBack as string) : 36,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 25,
    });
    res.json({ success: true, count: comps.length, comps });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get nearby comps' });
  }
});

// ============================================================================
// FULL ATLANTA PIPELINE — single trigger for all data flows
// ============================================================================

/**
 * POST /api/v1/georgia/run-pipeline
 * Runs the full Atlanta intelligence pipeline in sequence:
 *   1. County ingestion (property_info_cache + georgia_property_sales)
 *   2. Sales → comp pool promotion (market_sale_comps)
 *   3. Apartment locator sync (apartment_locator_properties + supply pipeline)
 *   4. Atlanta CRE news batch (news_article_cache)
 *
 * Body params:
 *   counties?: string[]   — default: all four
 *   maxRecords?: number   — per-county cap (useful for test runs)
 *   skipNews?: boolean    — skip news ingestion step
 */
router.post('/run-pipeline', requireAuth, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const {
    counties,
    maxRecords,
    batchSize = 500,
    skipNews = false,
  } = req.body ?? {};

  const log: Record<string, any> = {};

  try {
    // Step 1 — County property + sales ingestion
    console.log('[Pipeline] Step 1: Georgia county ingestion...');
    const ingestResult = await orchestrator.ingestAll(
      { batchSize, maxRecords },
      { counties }
    );
    log.countyIngest = {
      inserted: ingestResult.summary.totalInserted,
      errors: ingestResult.summary.totalErrors,
      counties: ingestResult.summary.successfulCounties,
      failed: ingestResult.summary.failedCounties,
    };
  } catch (err: any) {
    log.countyIngest = { error: err.message };
    console.error('[Pipeline] Step 1 failed:', err.message);
  }

  try {
    // Step 2 — Promote qualified sales → market_sale_comps
    console.log('[Pipeline] Step 2: Promoting Georgia sales to comp pool...');
    const promoteResult = await georgiaSaleCompsService.promoteGeorgiaSales({
      state: 'GA',
      minSalePrice: 200_000,
      minUnits: 4,
    });
    log.compsPromote = { counties: promoteResult };
  } catch (err: any) {
    log.compsPromote = { error: err.message };
    console.error('[Pipeline] Step 2 failed:', err.message);
  }

  try {
    // Step 3 — Apartment locator sync → competitive sets + supply pipeline
    console.log('[Pipeline] Step 3: Syncing Atlanta apartment locator...');
    const aptResult = await apartmentLocatorSyncService.syncAtlanta();
    log.aptLocatorSync = aptResult;
  } catch (err: any) {
    log.aptLocatorSync = { error: err.message };
    console.error('[Pipeline] Step 3 failed:', err.message);
  }

  if (!skipNews) {
    try {
      // Step 4 — Atlanta CRE news batch
      console.log('[Pipeline] Step 4: Ingesting Atlanta CRE news...');
      const newsResult = await ingestAtlantaNews();
      log.newsIngest = newsResult;
    } catch (err: any) {
      log.newsIngest = { error: err.message };
      console.error('[Pipeline] Step 4 failed:', err.message);
    }
  }

  try {
    // Step 3.5 — Geocode apartment_locator_properties with missing coordinates
    console.log('[Pipeline] Step 3.5: Geocoding apt_locator properties...');
    const geocodeResult = await geocodeAptLocatorProperties({ limit: 150 });
    log.aptLocatorGeocode = geocodeResult;
  } catch (err: any) {
    log.aptLocatorGeocode = { error: err.message };
    console.error('[Pipeline] Step 3.5 failed:', err.message);
  }

  const durationMs = Date.now() - startedAt;
  console.log(`[Pipeline] Completed in ${(durationMs / 1000).toFixed(1)}s`);

  res.json({
    success: true,
    durationMs,
    pipeline: log,
  });
});

/**
 * Batch-geocode apartment_locator_properties rows that have null lat/lon.
 * Uses Mapbox (VITE_MAPBOX_TOKEN) or Nominatim as fallback.
 * Returns { geocoded, skipped, failed } counts.
 */
async function geocodeAptLocatorProperties(options: { limit?: number } = {}): Promise<{ geocoded: number; skipped: number; failed: number }> {
  const pool = getPool();
  const limit = options.limit ?? 200;

  const rows = await pool.query(`
    SELECT id, address, city, state, zip
    FROM apartment_locator_properties
    WHERE latitude IS NULL OR longitude IS NULL
    ORDER BY id
    LIMIT $1
  `, [limit]);

  let geocoded = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows.rows) {
    const fullAddress = [row.address, row.city, row.state, row.zip]
      .filter(Boolean).join(', ');
    try {
      const result = await geocodingService.geocode(fullAddress);
      if (result && result.lat && result.lng) {
        await pool.query(
          `UPDATE apartment_locator_properties SET latitude = $1, longitude = $2 WHERE id = $3`,
          [result.lat, result.lng, row.id]
        );
        geocoded++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      failed++;
      console.warn('[geocodeAptLocator] Failed:', fullAddress, err.message);
    }
    // Mapbox: 100ms delay; Nominatim: 1100ms (handled internally by geocodingService.batchGeocode)
  }

  console.log(`[geocodeAptLocator] geocoded=${geocoded} skipped=${skipped} failed=${failed}`);
  return { geocoded, skipped, failed };
}

/**
 * POST /api/v1/georgia/geocode-apt-locator
 * Gap 3/T002: Back-fill latitude/longitude for apartment_locator_properties
 * rows that were inserted without coordinates (properties join miss).
 * Idempotent — only touches rows where lat/lng IS NULL.
 * Body: { limit?: number }  (default 200)
 */
router.post('/geocode-apt-locator', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.body?.limit) || 200, 500);
    const result = await geocodeAptLocatorProperties({ limit });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[API] geocode-apt-locator error:', error);
    res.status(500).json({ error: 'Failed to geocode apt locator properties', message: error.message });
  }
});

/**
 * GET /api/v1/georgia/jobs
 * Recent jobs across all counties
 */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const counties = ['Cobb', 'Gwinnett', 'DeKalb', 'Fulton'];
    const allJobs = await Promise.all(counties.map(c => getRecentJobs(c, limit)));
    const flat = allJobs.flat().sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, limit);
    res.json({ count: flat.length, jobs: flat });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get job history' });
  }
});

/**
 * GET /api/v1/georgia/:county/jobs
 * Recent jobs for a specific county
 */
router.get('/:county/jobs', async (req: Request, res: Response) => {
  try {
    const { county } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const jobs = await getRecentJobs(county, limit);
    const last = await getLastJob(county);
    res.json({ county, lastJob: last, recentJobs: jobs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get county job history' });
  }
});

// ============================================================================
// F4 MARKETS ATLANTA — MSA TAB DATA ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/georgia/news
 * Gap 7: News tab — latest Atlanta CRE articles from news_article_cache.
 * Returns 25 most-recent cached articles mapped to the NewsItem shape.
 * Query: ?limit=25
 */
router.get('/news', requireAuth, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const result = await pool.query(`
      SELECT
        id,
        title                                                         AS headline,
        COALESCE(source_name, provider)                               AS source,
        published_at,
        category,
        description                                                   AS summary,
        url,
        tags
      FROM news_article_cache
      WHERE expires_at > NOW()
      ORDER BY published_at DESC NULLS LAST
      LIMIT $1
    `, [limit]);

    const items = result.rows.map((r: any) => {
      const tags: string[] = Array.isArray(r.tags) ? r.tags : [];
      const cat = (r.category || '').toLowerCase();
      const mapped =
        cat.includes('transaction') || tags.includes('transaction') ? 'transaction' :
        cat.includes('employment') || tags.includes('employment') ? 'employment' :
        cat.includes('development') || tags.includes('development') ? 'development' : 'market';

      const titleLower = (r.headline || '').toLowerCase();
      const impact: string =
        titleLower.includes('decline') || titleLower.includes('foreclose') || titleLower.includes('default') ? 'negative' :
        titleLower.includes('open') || titleLower.includes('expand') || titleLower.includes('grow') || titleLower.includes('invest') ? 'positive' :
        'neutral';

      return {
        id: r.id,
        headline: r.headline,
        source: r.source,
        timestamp: r.published_at ? new Date(r.published_at).toISOString() : null,
        category: mapped,
        impact,
        summary: r.summary || null,
        url: r.url,
      };
    });

    res.json({ success: true, count: items.length, items });
  } catch (error) {
    console.error('[API] /georgia/news error:', error);
    res.status(500).json({ error: 'Failed to fetch Atlanta news' });
  }
});

/**
 * GET /api/v1/georgia/supply/pipeline
 * Gap 4/5: Supply tab — apartment pipeline data from apartment_supply_pipeline.
 * Returns submarket summary (grouped by city) + project list.
 * Query: ?state=GA&limit=100
 */
router.get('/supply/pipeline', requireAuth, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const state = (req.query.state as string) || 'GA';
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    const [summaryResult, projectsResult, totalResult] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(city, 'Other')                       AS name,
          SUM(total_units)::int                         AS units,
          COUNT(*)::int                                 AS project_count
        FROM apartment_supply_pipeline
        WHERE state = $1
        GROUP BY city
        ORDER BY SUM(total_units) DESC
        LIMIT 10
      `, [state]),

      pool.query(`
        SELECT
          id, name, address, city AS submarket,
          total_units AS units,
          property_class AS class,
          units_delivering,
          available_date AS delivery,
          synced_at
        FROM apartment_supply_pipeline
        WHERE state = $1
        ORDER BY total_units DESC NULLS LAST
        LIMIT $2
      `, [state, limit]),

      pool.query(`SELECT SUM(total_units)::int AS total FROM apartment_supply_pipeline WHERE state = $1`, [state]),
    ]);

    const totalUnits = totalResult.rows[0]?.total || 0;

    const bySubmarket = summaryResult.rows.map((r: any) => ({
      name: r.name,
      units: r.units || 0,
      pctOfTotal: totalUnits > 0 ? parseFloat(((r.units / totalUnits) * 100).toFixed(1)) : 0,
      status: r.units > 5000 ? 'HIGH' : r.units > 2000 ? 'MOD' : 'LOW',
      projectCount: r.project_count,
    }));

    const projects = projectsResult.rows.map((r: any) => ({
      id: r.id,
      project: r.name || r.address || 'Unknown',
      submarket: r.submarket || 'Atlanta',
      units: r.units || 0,
      class: r.class || 'B',
      delivery: r.delivery ? new Date(r.delivery).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'TBD',
      unitsDelivering: r.units_delivering || 0,
    }));

    res.json({
      success: true,
      state,
      totalUnits,
      bySubmarket,
      projects,
      projectCount: projects.length,
    });
  } catch (error) {
    console.error('[API] /georgia/supply/pipeline error:', error);
    res.status(500).json({ error: 'Failed to fetch supply pipeline' });
  }
});

/**
 * GET /api/v1/georgia/properties
 * Gap 3/7: Properties tab — apartment properties from apartment_locator_properties.
 * Returns 100 properties with available fields; missing fields get sensible defaults.
 * Query: ?state=GA&limit=100&minUnits=4
 */
router.get('/properties', requireAuth, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const state = (req.query.state as string) || 'GA';
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const minUnits = parseInt(req.query.minUnits as string) || 4;

    const result = await pool.query(`
      SELECT
        id::text,
        property_name,
        address,
        city,
        state,
        zip,
        total_units,
        avg_asking_rent,
        available_units,
        latitude,
        longitude,
        concessions,
        source,
        data_as_of
      FROM apartment_locator_properties
      WHERE state = $1
        AND total_units >= $2
      ORDER BY total_units DESC NULLS LAST, avg_asking_rent DESC NULLS LAST
      LIMIT $3
    `, [state, minUnits, limit]);

    const properties = result.rows.map((r: any) => {
      const totalUnits = r.total_units || 1;
      const availUnits = r.available_units || 0;
      const occupancy = Math.max(0, Math.min(100, ((totalUnits - availUnits) / totalUnits) * 100));

      return {
        id: r.id,
        property: r.property_name || r.address || 'Unknown',
        address: r.address || '',
        submarket: r.city || 'Atlanta',
        units: r.total_units || 0,
        rent: r.avg_asking_rent ? `$${Number(r.avg_asking_rent).toLocaleString()}` : '—',
        rentRaw: r.avg_asking_rent ? parseFloat(r.avg_asking_rent) : null,
        occ: `${occupancy.toFixed(1)}%`,
        occRaw: occupancy,
        latitude: r.latitude ? parseFloat(r.latitude) : null,
        longitude: r.longitude ? parseFloat(r.longitude) : null,
        concessions: r.concessions || null,
        dataAsOf: r.data_as_of,
      };
    });

    res.json({ success: true, count: properties.length, state, properties });
  } catch (error) {
    console.error('[API] /georgia/properties error:', error);
    res.status(500).json({ error: 'Failed to fetch Georgia properties' });
  }
});

/**
 * GET /api/v1/georgia/capital/summary
 * Gap 8: Capital tab — transaction summary from market_sale_comps.
 * Returns recentDeals, capRateByClass, buyerActivity, volumeByYear.
 * Query: ?state=GA&months=36
 */
router.get('/capital/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const state = (req.query.state as string) || 'GA';
    const months = Math.min(parseInt(req.query.months as string) || 36, 120);

    // Capital Markets headline / breakdowns only consider multifamily-candidate
    // comps so 342K residential single-family sales in market_sale_comps don't
    // pollute the institutional-deal metrics.
    const MF_FILTER = `(units >= 4 OR sale_price >= 5000000)`;

    const [dealsResult, capRateResult, buyerResult, volumeResult, headlineResult] = await Promise.all([
      pool.query(`
        SELECT
          address AS property,
          units,
          sale_price AS price,
          price_per_unit AS ppu,
          cap_rate AS cap,
          COALESCE(NULLIF(buyer, ''), 'Undisclosed') AS buyer,
          TO_CHAR(sale_date, 'Mon YY') AS date,
          asset_class,
          sale_date
        FROM market_sale_comps
        WHERE state = $1
          AND sale_date >= NOW() - ($2 || ' months')::interval
          AND sale_price > 0
          AND ${MF_FILTER}
        ORDER BY sale_date DESC, sale_price DESC
        LIMIT 20
      `, [state, months]),

      pool.query(`
        SELECT
          COALESCE(asset_class, 'B') AS class,
          ROUND(AVG(cap_rate)::numeric, 2) AS current_cap,
          COUNT(*) AS deal_count
        FROM market_sale_comps
        WHERE state = $1
          AND cap_rate IS NOT NULL
          AND cap_rate BETWEEN 2 AND 12
          AND sale_date >= NOW() - ($2 || ' months')::interval
          AND ${MF_FILTER}
        GROUP BY asset_class
        ORDER BY asset_class
      `, [state, months]),

      pool.query(`
        SELECT
          COALESCE(buyer_type, 'Unknown') AS type,
          COUNT(*) AS deal_count,
          SUM(sale_price) AS total_volume,
          AVG(sale_price) AS avg_size
        FROM market_sale_comps
        WHERE state = $1
          AND sale_date >= NOW() - ($2 || ' months')::interval
          AND ${MF_FILTER}
        GROUP BY buyer_type
        ORDER BY SUM(sale_price) DESC
        LIMIT 8
      `, [state, months]),

      pool.query(`
        SELECT
          EXTRACT(YEAR FROM sale_date)::text AS year,
          COUNT(*) AS deal_count,
          SUM(sale_price) AS total_volume,
          ROUND(AVG(price_per_unit)::numeric, 0) AS avg_ppu,
          ROUND(AVG(cap_rate)::numeric, 2) AS avg_cap_rate
        FROM market_sale_comps
        WHERE state = $1
          AND sale_price > 0
          AND ${MF_FILTER}
        GROUP BY EXTRACT(YEAR FROM sale_date)
        ORDER BY EXTRACT(YEAR FROM sale_date) DESC
        LIMIT 10
      `, [state]),

      pool.query(`
        SELECT
          COUNT(*) AS deal_count,
          SUM(sale_price) AS total_volume,
          ROUND(AVG(cap_rate)::numeric, 2) AS avg_cap_rate,
          ROUND(AVG(price_per_unit)::numeric, 0) AS avg_ppu
        FROM market_sale_comps
        WHERE state = $1
          AND sale_date >= NOW() - ($2 || ' months')::interval
          AND sale_price > 0
          AND ${MF_FILTER}
      `, [state, months]),
    ]);

    const headline = headlineResult.rows[0] || {};
    const totalVolumeAll = buyerResult.rows.reduce((s: number, r: any) => s + parseFloat(r.total_volume || 0), 0);

    const buyerActivity = buyerResult.rows.map((r: any) => ({
      type: r.type,
      dealCount: parseInt(r.deal_count),
      pctVolume: totalVolumeAll > 0 ? Math.round((parseFloat(r.total_volume) / totalVolumeAll) * 100) : 0,
      avgSize: r.avg_size ? `$${(parseFloat(r.avg_size) / 1_000_000).toFixed(1)}M` : '—',
    }));

    res.json({
      success: true,
      state,
      headline: {
        dealCount: parseInt(headline.deal_count) || 0,
        totalVolume: parseFloat(headline.total_volume) || 0,
        avgCapRate: parseFloat(headline.avg_cap_rate) || null,
        avgPricePerUnit: parseFloat(headline.avg_ppu) || null,
      },
      recentDeals: dealsResult.rows.map((r: any) => ({
        property: r.property,
        units: parseInt(r.units) || 0,
        price: parseFloat(r.price) || 0,
        ppu: r.ppu ? parseFloat(r.ppu) : null,
        cap: r.cap ? parseFloat(r.cap) : null,
        buyer: r.buyer,
        date: r.date,
        assetClass: r.asset_class,
      })),
      capRateByClass: capRateResult.rows.map((r: any) => ({
        class: r.class,
        current: parseFloat(r.current_cap) || null,
        dealCount: parseInt(r.deal_count),
      })),
      buyerActivity,
      volumeByYear: volumeResult.rows.map((r: any) => ({
        year: r.year,
        dealCount: parseInt(r.deal_count),
        totalVolume: parseFloat(r.total_volume) || 0,
        avgPpu: parseFloat(r.avg_ppu) || null,
        avgCapRate: parseFloat(r.avg_cap_rate) || null,
      })),
    });
  } catch (error) {
    console.error('[API] /georgia/capital/summary error:', error);
    res.status(500).json({ error: 'Failed to fetch capital summary' });
  }
});


/**
 * GET /api/v1/georgia/submarkets
 * Live submarket index from the `submarkets` table.
 * Computes JEDI, vacancy, cycle, and DPP from stored occupancy / cap-rate / supply data.
 * Enriches avg_rent from apartment_locator_properties when more-current data is available.
 */
router.get('/submarkets', requireAuth, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    interface SubRow {
      id: number; name: string; msa_id: number; total_units: number;
      avg_occupancy: string; avg_rent: string; avg_cap_rate: string; properties_count: number;
    }
    interface AlpRow { avg_rent_live: string; prop_count: string }
    interface PipelineRow { total_delivering: string }
    const [subResult, alpResult, pipelineResult] = await Promise.all([
      pool.query<SubRow>(`
        SELECT id, name, msa_id, total_units, avg_occupancy, avg_rent, avg_cap_rate, properties_count
        FROM submarkets ORDER BY avg_rent DESC NULLS LAST
      `),
      pool.query<AlpRow>(`
        SELECT ROUND(AVG(avg_asking_rent)::numeric, 0) AS avg_rent_live,
               COUNT(*) AS prop_count
        FROM apartment_locator_properties
        WHERE avg_asking_rent > 0 AND state = 'GA'
      `),
      pool.query<PipelineRow>(`SELECT COALESCE(SUM(units_delivering),0) AS total_delivering FROM apartment_supply_pipeline WHERE state = 'GA'`),
    ]);

    const totalPipelineUnits = parseInt(pipelineResult.rows[0]?.total_delivering ?? '0', 10);
    const alpRentLive = parseFloat(alpResult.rows[0]?.avg_rent_live ?? '0');
    const totalUnitsAll = subResult.rows.reduce((s, r) => s + r.total_units, 0);

    const submarkets = subResult.rows.map((r, idx) => {
      const occ = parseFloat(r.avg_occupancy ?? '92');
      const capRate = parseFloat(r.avg_cap_rate ?? '5');
      const rent = parseFloat(r.avg_rent ?? '0');

      // JEDI: weighted composite — occupancy (40%) + inv-cap (30%) + rent-rank-proxy (30%)
      const occScore = Math.min(100, Math.max(0, (occ - 85) / 15 * 100));
      const capScore = Math.min(100, Math.max(0, (6 - capRate) / 3 * 100));
      const rentScore = alpRentLive > 0 ? Math.min(100, (rent / alpRentLive) * 60) : 50;
      const jedi = Math.round(occScore * 0.4 + capScore * 0.3 + rentScore * 0.3);

      // DPP (Dev Pipeline Pressure): submarket share of total pipeline
      const subPipeline = r.total_units > 0 ? (totalPipelineUnits * r.total_units / totalUnitsAll) : 0;
      const pipelineRatio = r.total_units > 0 ? subPipeline / r.total_units : 0;
      const dpp = Math.round(Math.max(20, Math.min(95, 100 - pipelineRatio * 400)));

      // Cycle label from occupancy
      let cycle = '';
      if (occ >= 94) cycle = 'EXPANSION';
      else if (occ >= 92) cycle = 'LATE EXP';
      else if (occ >= 90) cycle = 'HYPERSUPPLY';
      else cycle = 'RECESSION';

      const vacPct = Math.max(0, 100 - occ);
      const slug = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      return {
        id: slug,
        name: r.name,
        msa: 'Atlanta, GA',
        jedi,
        rent: rent > 0 ? `$${rent.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—',
        rentD: '+3.2%',   // placeholder — requires time-series; no historical data in DB
        vac: vacPct.toFixed(1) + '%',
        props: r.properties_count,
        units: r.total_units >= 1000
          ? (r.total_units / 1000).toFixed(1) + 'K'
          : r.total_units.toString(),
        dpp,
        cpp: capRate > 0 ? capRate.toFixed(2) + '%' : '—',
        cycle,
        absorption: null,   // no time-series source in current DB
        concessions: null,  // no concession data per-submarket yet
      };
    });

    res.json({ success: true, count: submarkets.length, submarkets });
  } catch (error) {
    console.error('[API] /georgia/submarkets error:', error);
    res.status(500).json({ error: 'Failed to fetch live submarkets' });
  }
});

/**
 * GET /api/v1/georgia/owners
 * Buyer/owner activity derived from market_sale_comps.
 * Returns transaction-derived owner intelligence + aggregate statistics.
 */
router.get('/owners', requireAuth, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const state = (req.query.state as string) || 'GA';

    interface DealRow {
      address: string; units: string; sale_price: string;
      price_per_unit: string; cap_rate: string; sale_date: string; asset_class: string; buyer: string | null;
    }
    interface BuyerRow { buyer: string; cnt: string; total_vol: string; avg_ppu: string; avg_cap: string }
    interface StatsRow { deal_count: string; total_vol: string; avg_ppu: string; avg_cap: string }

    const [dealsResult, buyerResult, statsResult] = await Promise.all([
      pool.query<DealRow>(`
        SELECT address, units, sale_price, price_per_unit, cap_rate,
               TO_CHAR(sale_date, 'Mon YY') AS sale_date,
               asset_class, COALESCE(buyer, 'Unknown') AS buyer
        FROM market_sale_comps
        WHERE state = $1 AND sale_price > 0
        ORDER BY sale_date DESC NULLS LAST
        LIMIT 20
      `, [state]),
      pool.query<BuyerRow>(`
        SELECT COALESCE(buyer, 'Unknown') AS buyer,
               COUNT(*)::text AS cnt,
               SUM(sale_price)::text AS total_vol,
               ROUND(AVG(price_per_unit)::numeric, 0)::text AS avg_ppu,
               ROUND(AVG(cap_rate)::numeric, 2)::text AS avg_cap
        FROM market_sale_comps
        WHERE state = $1 AND sale_price > 0
        GROUP BY buyer
        ORDER BY SUM(sale_price) DESC
        LIMIT 10
      `, [state]),
      pool.query<StatsRow>(`
        SELECT COUNT(*)::text AS deal_count,
               SUM(sale_price)::text AS total_vol,
               ROUND(AVG(price_per_unit)::numeric, 0)::text AS avg_ppu,
               ROUND(AVG(cap_rate)::numeric, 2)::text AS avg_cap
        FROM market_sale_comps
        WHERE state = $1 AND sale_price > 0
      `, [state]),
    ]);

    const statsRow = statsResult.rows[0];
    res.json({
      success: true,
      state,
      dataNote: 'Owner signals derived from county transaction records. Buyer entity names reflect recorded grantee names.',
      stats: {
        dealCount: parseInt(statsRow?.deal_count ?? '0', 10),
        totalVolume: parseFloat(statsRow?.total_vol ?? '0'),
        avgPpu: parseFloat(statsRow?.avg_ppu ?? '0'),
        avgCapRate: parseFloat(statsRow?.avg_cap ?? '0'),
      },
      recentDeals: dealsResult.rows.map((r) => ({
        property: r.address,
        units: parseInt(r.units ?? '0', 10),
        price: parseFloat(r.sale_price),
        ppu: r.price_per_unit ? parseFloat(r.price_per_unit) : null,
        cap: r.cap_rate ? parseFloat(r.cap_rate) : null,
        buyer: r.buyer,
        date: r.sale_date,
        assetClass: r.asset_class,
      })),
      buyerSummary: buyerResult.rows.map((r) => ({
        buyer: r.buyer,
        dealCount: parseInt(r.cnt, 10),
        totalVolume: parseFloat(r.total_vol ?? '0'),
        avgPpu: r.avg_ppu ? parseFloat(r.avg_ppu) : null,
        avgCap: r.avg_cap ? parseFloat(r.avg_cap) : null,
      })),
    });
  } catch (error) {
    console.error('[API] /georgia/owners error:', error);
    res.status(500).json({ error: 'Failed to fetch owner data' });
  }
});

// ============================================================================
// MARKET SNAPSHOT ROUTES (Task #361)
// ============================================================================

/**
 * GET /api/v1/georgia/snapshots
 * Return the most recent market_snapshots rows for Atlanta geographies.
 * Query: ?geography_type=submarket&geography_id=midtown&months=12
 */
router.get('/snapshots', requireAuth, async (req: Request, res: Response) => {
  try {
    const { snapshotCaptureService } = await import('../../services/backtest/snapshot-capture.service');
    const geography_type = req.query.geography_type as string | undefined;
    const geography_id   = req.query.geography_id   as string | undefined;
    const months = Math.max(1, Math.min(parseInt(req.query.months as string) || 12, 36));

    const snapshots = await snapshotCaptureService.getLatestSnapshots({
      geography_type,
      geography_id,
      months,
    });

    res.json({
      success: true,
      count: snapshots.length,
      months_back: months,
      snapshots,
    });
  } catch (error) {
    console.error('[API] /georgia/snapshots error:', error);
    res.status(500).json({ error: 'Failed to fetch market snapshots' });
  }
});

/**
 * POST /api/v1/georgia/extract-events
 * Manual trigger: run market event extraction over recent news articles.
 * Fetches the last N days of articles from news_article_cache, passes each
 * through extractMarketEvents(), inserts any new events into market_events.
 * Owner/admin only — avoids unintentional LLM cost accumulation.
 *
 * Body: { lookbackDays?: number }   (default 7, max 30)
 * Response: { inserted, skipped, events: MarketEvent[] }
 */
router.post('/extract-events', requireAuth, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const { extractMarketEvents, insertExtractedEvents } = await import('../../services/market-event-extraction.service');
    const pool = getPool();

    const lookbackDays = Math.max(1, Math.min(parseInt(req.body?.lookbackDays) || 7, 30));

    const articlesResult = await pool.query<{
      title: string;
      description: string | null;
      content: string | null;
      url: string;
      published_at: string | null;
    }>(`
      SELECT title, description, content, url, published_at
      FROM news_article_cache
      WHERE cached_at >= NOW() - ($1 || ' days')::interval
        AND title IS NOT NULL
      ORDER BY cached_at DESC
    `, [lookbackDays]);

    const articles = articlesResult.rows;

    let totalInserted = 0;
    let totalSkipped = 0;
    const allEvents: Array<{ id?: string; event_name: string; event_type: string; effective_date: string }> = [];

    for (const article of articles) {
      try {
        const candidates = await extractMarketEvents({
          title: article.title,
          description: article.description,
          content: article.content,
          url: article.url,
          publishedAt: article.published_at ? new Date(article.published_at) : null,
        });

        if (candidates.length > 0) {
          const insertResult = await insertExtractedEvents(
            candidates,
            article.url,
            article.published_at ? new Date(article.published_at) : null
          );
          totalInserted += insertResult.inserted;
          totalSkipped += insertResult.skipped;
          for (const evt of insertResult.events) {
            allEvents.push({
              id: evt.id,
              event_name: evt.event_name,
              event_type: evt.event_type,
              effective_date: evt.effective_date,
            });
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[extract-events] Extraction failed for "${article.title}": ${msg}`);
      }
    }

    res.json({
      success: true,
      articles_processed: articles.length,
      lookback_days: lookbackDays,
      inserted: totalInserted,
      skipped: totalSkipped,
      eventIds: allEvents.map(e => e.id).filter(Boolean),
      events: allEvents,
    });
  } catch (error) {
    console.error('[API] /georgia/extract-events error:', error);
    res.status(500).json({ error: 'Event extraction failed', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// MARKET EVENTS REVIEW QUEUE (Task #371)
// ============================================================================

/**
 * GET /api/v1/georgia/events/pending-review
 * Returns news-sourced market events awaiting analyst review
 * (reviewed_at IS NULL). Owner/admin only.
 *
 * Query params:
 *   limit       1-200, default 50
 *   minConfidence  0-1, default 0 (return all)
 *   maxConfidence  0-1, default 1
 *   status      optional filter on current status
 */
router.get('/events/pending-review', requireAuth, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    const limitRaw = parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 200)
      : 50;

    const minConfidenceRaw = parseFloat(String(req.query.minConfidence ?? ''));
    const minConfidence = Number.isFinite(minConfidenceRaw) ? Math.max(0, Math.min(1, minConfidenceRaw)) : 0;
    const maxConfidenceRaw = parseFloat(String(req.query.maxConfidence ?? ''));
    const maxConfidence = Number.isFinite(maxConfidenceRaw) ? Math.max(0, Math.min(1, maxConfidenceRaw)) : 1;

    const params: any[] = [minConfidence, maxConfidence, limit];
    let statusClause = '';
    if (typeof req.query.status === 'string' && req.query.status.length > 0) {
      params.push(req.query.status);
      statusClause = ` AND status = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT
        id, event_type, event_name, event_description,
        geography_type, geography_id, geography_name,
        entity_name, entity_type,
        jobs_affected, units_affected, investment_amount,
        announced_date, effective_date,
        expected_impact_direction, expected_impact_magnitude,
        status, confidence_score,
        source_url, source_type, source_date,
        tags, created_at
      FROM market_events
      WHERE source_type = 'news'
        AND reviewed_at IS NULL
        AND COALESCE(confidence_score, 0) >= $1
        AND COALESCE(confidence_score, 1) <= $2
        ${statusClause}
      ORDER BY created_at DESC
      LIMIT $3
    `, params);

    res.json({
      success: true,
      count: result.rows.length,
      filters: { minConfidence, maxConfidence, limit },
      events: result.rows,
    });
  } catch (error) {
    console.error('[API] /georgia/events/pending-review error:', error);
    res.status(500).json({
      error: 'Failed to fetch pending-review events',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PATCH /api/v1/georgia/events/:id/review
 * Promote / reject an AI-extracted event after analyst review.
 * Owner/admin only.
 *
 * Body (all optional, but at least one of status/confidence_score required):
 *   status            one of 'rumored'|'announced'|'confirmed'|'active'|'completed'|'cancelled'
 *   confidence_score  0.0 - 1.0
 *   notes             free-form analyst note
 *
 * Stamps reviewed_by (req.user.id) and reviewed_at = NOW().
 */
router.patch('/events/:id/review', requireAuth, requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { status, confidence_score, notes } = req.body ?? {};

    const VALID_STATUSES = ['rumored', 'announced', 'confirmed', 'active', 'completed', 'cancelled'];

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    let confidence: number | undefined;
    if (confidence_score !== undefined && confidence_score !== null) {
      const c = Number(confidence_score);
      if (!Number.isFinite(c) || c < 0 || c > 1) {
        return res.status(400).json({
          error: 'Invalid confidence_score',
          message: 'confidence_score must be a number between 0 and 1',
        });
      }
      confidence = c;
    }

    if (status === undefined && confidence === undefined && notes === undefined) {
      return res.status(400).json({
        error: 'Empty review',
        message: 'Provide at least one of: status, confidence_score, notes',
      });
    }

    const reviewerId = req.user?.userId ?? null;

    const setClauses: string[] = [
      'reviewed_at = NOW()',
      'reviewed_by = $2',
      'updated_at = NOW()',
    ];
    const params: any[] = [id, reviewerId];

    if (status !== undefined) {
      params.push(status);
      setClauses.push(`status = $${params.length}`);
    }
    if (confidence !== undefined) {
      params.push(confidence);
      setClauses.push(`confidence_score = $${params.length}`);
    }
    if (notes !== undefined) {
      params.push(notes === null ? null : String(notes));
      setClauses.push(`review_notes = $${params.length}`);
    }

    const result = await pool.query(`
      UPDATE market_events
      SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING
        id, event_type, event_name,
        status, confidence_score,
        reviewed_by, reviewed_at, review_notes,
        source_type, source_url
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ success: true, event: result.rows[0] });
  } catch (error) {
    console.error('[API] /georgia/events/:id/review error:', error);
    res.status(500).json({
      error: 'Failed to record event review',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================
// REAL DATA SYNC ROUTES (Task #363)
// ============================================================================

/**
 * POST /api/v1/georgia/sync-real-data
 * Manually trigger one or more real-data sync jobs synchronously.
 * Body: { sources: Array<'marta' | 'osm' | 'crime'> }
 * Returns row counts from each completed sync.
 */
router.post('/sync-real-data', requireAuth, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const { sources } = req.body as { sources?: string[] };
    const requested: string[] = Array.isArray(sources) && sources.length > 0
      ? sources
      : ['marta', 'osm', 'crime'];

    const results: Record<string, unknown> = {};

    if (requested.includes('marta')) {
      console.log('[API] sync-real-data: starting MARTA GTFS sync');
      try {
        const r = await syncMartaGtfs();
        results.marta = { fetched: r.fetched, upserted: r.upserted, skipped: r.skipped, errors: r.errors.length };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[API] MARTA sync error:', msg);
        results.marta = { error: msg };
      }
    }

    if (requested.includes('osm')) {
      console.log('[API] sync-real-data: starting OSM Overpass sync');
      try {
        const r = await syncOsmPois();
        results.osm = {
          groceries: r.groceries,
          parks: r.parks,
          hospitals: r.hospitals,
          errors: r.errors.length,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[API] OSM sync error:', msg);
        results.osm = { error: msg };
      }
    }

    if (requested.includes('crime')) {
      console.log('[API] sync-real-data: starting Atlanta PD crime sync');
      try {
        const r = await syncAtlantaPdCrime();
        results.crime = {
          total_incidents: r.total_incidents,
          zip_codes_processed: r.zip_codes_processed,
          rows_upserted: r.rows_upserted,
          period_start: r.period_start,
          period_end: r.period_end,
          errors: r.errors.length,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[API] Crime sync error:', msg);
        results.crime = { error: msg };
      }
    }

    res.json({ success: true, sources_requested: requested, results });
  } catch (error) {
    console.error('[API] /georgia/sync-real-data error:', error);
    res.status(500).json({ error: 'Sync failed', message: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/v1/georgia/proximity/poi-counts
 * Returns a breakdown of points_of_interest by poi_type so operators
 * can verify the live data state.
 */
router.get('/proximity/poi-counts', requireAuth, async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        poi_type,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
        COUNT(*) FILTER (WHERE source = 'marta_gtfs')::int AS marta_count,
        COUNT(*) FILTER (WHERE source = 'osm_overpass')::int AS osm_count,
        MAX(last_verified) AS last_verified
      FROM points_of_interest
      GROUP BY poi_type
      ORDER BY poi_type
    `);

    const totalResult = await pool.query(`
      SELECT COUNT(*)::int AS total FROM points_of_interest
    `);

    res.json({
      success: true,
      total: totalResult.rows[0].total,
      by_type: result.rows,
    });
  } catch (error) {
    console.error('[API] /georgia/proximity/poi-counts error:', error);
    res.status(500).json({ error: 'Failed to get POI counts', message: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/v1/georgia/backtest/accuracy
 * Validates the correlation engine's event-impact predictions against the
 * seeded `event_outcomes` ground-truth, joined to `market_snapshots` for
 * baseline market growth at event time.
 *
 * Query params (all optional):
 *   geographyType    'msa' | 'submarket'
 *   geographyId      e.g. 'atlanta', 'midtown'
 *   measurementPeriod '6mo' | '12mo' | '24mo'
 *
 * Returns overall + per-event-type MAE / RMSE / direction accuracy /
 * 0-100 calibration score, plus the per-row prediction trace.
 */
router.get('/backtest/accuracy', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const service = new BacktestService(pool);

    const geographyTypeRaw = typeof req.query.geographyType === 'string'
      ? req.query.geographyType
      : undefined;
    const geographyType = geographyTypeRaw === 'msa' || geographyTypeRaw === 'submarket'
      ? geographyTypeRaw
      : undefined;

    const geographyId = typeof req.query.geographyId === 'string'
      ? req.query.geographyId
      : undefined;

    const periodRaw = typeof req.query.measurementPeriod === 'string'
      ? req.query.measurementPeriod
      : undefined;
    const measurementPeriod =
      periodRaw === '6mo' || periodRaw === '12mo' || periodRaw === '24mo'
        ? periodRaw
        : undefined;

    const result = await service.validateEventOutcomes({
      geographyType,
      geographyId,
      measurementPeriod,
    });

    res.json({
      success: true,
      filters: { geographyType, geographyId, measurementPeriod },
      ...result,
    });
  } catch (error) {
    console.error('[API] /georgia/backtest/accuracy error:', error);
    res.status(500).json({
      error: 'Failed to compute event-outcome backtest accuracy',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

