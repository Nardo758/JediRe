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

// ============================================================================
// JOB HISTORY ROUTES
// ============================================================================

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
