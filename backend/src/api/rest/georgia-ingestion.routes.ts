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
import { requireAuth } from '../../middleware/auth';

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
router.post('/run-pipeline', async (req: Request, res: Response) => {
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

  const durationMs = Date.now() - startedAt;
  console.log(`[Pipeline] Completed in ${(durationMs / 1000).toFixed(1)}s`);

  res.json({
    success: true,
    durationMs,
    pipeline: log,
  });
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

    const [dealsResult, capRateResult, buyerResult, volumeResult, headlineResult] = await Promise.all([
      pool.query(`
        SELECT
          address AS property,
          units,
          sale_price AS price,
          price_per_unit AS ppu,
          cap_rate AS cap,
          COALESCE(buyer, 'Unknown') AS buyer,
          TO_CHAR(sale_date, 'Mon YY') AS date,
          asset_class,
          sale_date
        FROM market_sale_comps
        WHERE state = $1
          AND sale_date >= NOW() - ($2 || ' months')::interval
          AND sale_price > 0
        ORDER BY sale_date DESC
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
        GROUP BY asset_class
        ORDER BY asset_class
      `, [state]),

      pool.query(`
        SELECT
          COALESCE(buyer_type, 'Unknown') AS type,
          COUNT(*) AS deal_count,
          SUM(sale_price) AS total_volume,
          AVG(sale_price) AS avg_size
        FROM market_sale_comps
        WHERE state = $1
          AND sale_date >= NOW() - ($2 || ' months')::interval
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

export default router;

