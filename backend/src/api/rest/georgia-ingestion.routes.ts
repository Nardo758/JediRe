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
router.get('/analytics/price-trends', async (req: Request, res: Response) => {
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

export default router;
