import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from '../../database';
import { TrafficDataSourcesService } from '../../services/traffic-data-sources.service';
import { TrafficGrowthIndexService, TrafficGrowthResult } from '../../services/traffic-growth-index.service';
import { logger } from '../../utils/logger';

const router = Router();
const trafficDataService = new TrafficDataSourcesService(pool);
const trafficGrowthService = new TrafficGrowthIndexService(pool);

const adtUpload = multer({
  dest: path.join(process.cwd(), 'uploads', 'adt-data'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

router.post('/adt/upload', adtUpload.single('file') as any, async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded. Accepted formats: CSV, XLSX, XLS' });
    }

    const sourceSystem = (req.body.source_system as string) || 'DOT';
    const result = await trafficDataService.ingestADTData(file.path, sourceSystem);

    res.json({
      success: true,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors.slice(0, 20),
      message: `Ingested ${result.inserted} ADT records from ${file.originalname}`,
    });
  } catch (error: any) {
    logger.error('[TrafficData] ADT upload failed', { error: error.message });
    res.status(500).json({ error: 'Failed to ingest ADT data', message: error.message });
  }
});

router.get('/adt/stations', async (req: Request, res: Response) => {
  try {
    const filters = {
      city: req.query.city as string,
      state: req.query.state as string,
      minADT: req.query.min_adt ? parseInt(req.query.min_adt as string) : undefined,
      maxADT: req.query.max_adt ? parseInt(req.query.max_adt as string) : undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await trafficDataService.getADTStations(filters);
    res.json(result);
  } catch (error: any) {
    logger.error('[TrafficData] ADT stations fetch failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch ADT stations', message: error.message });
  }
});

router.get('/adt/nearest', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const limit = parseInt(req.query.limit as string) || 5;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng query parameters are required' });
    }

    const stations = await trafficDataService.findNearestADT(lat, lng, limit);
    res.json({ lat, lng, stations, count: stations.length });
  } catch (error: any) {
    logger.error('[TrafficData] Nearest ADT fetch failed', { error: error.message });
    res.status(500).json({ error: 'Failed to find nearest ADT', message: error.message });
  }
});

router.get('/context/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const context = await trafficDataService.getPropertyTrafficContext(propertyId);

    if (!context) {
      return res.status(404).json({
        error: 'No traffic context found for this property',
        property_id: propertyId,
        hint: 'Use POST /api/v1/traffic-data/context/:propertyId/link to link this property to nearby ADT stations',
      });
    }

    res.json({ property_id: propertyId, context });
  } catch (error: any) {
    logger.error('[TrafficData] Context fetch failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch traffic context', message: error.message });
  }
});

router.post('/context/:propertyId/link', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const context = await trafficDataService.linkPropertyToADT(propertyId);

    if (!context) {
      return res.status(404).json({
        error: 'Could not link property to ADT data',
        property_id: propertyId,
        hint: 'Property may not exist, may be missing coordinates, or no ADT stations are loaded',
      });
    }

    res.json({
      success: true,
      property_id: propertyId,
      context,
      message: `Linked to ${context.primary_road_name} (${context.primary_adt} ADT, ${context.primary_adt_distance_m}m away)`,
    });
  } catch (error: any) {
    logger.error('[TrafficData] Property link failed', { error: error.message });
    res.status(500).json({ error: 'Failed to link property to ADT', message: error.message });
  }
});

router.get('/realtime', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng query parameters are required' });
    }

    const result = await trafficDataService.getRealTimeTrafficFactor(lat, lng);
    res.json({ lat, lng, ...result });
  } catch (error: any) {
    logger.error('[TrafficData] Realtime traffic fetch failed', { error: error.message });
    res.status(500).json({ error: 'Failed to get real-time traffic', message: error.message });
  }
});

router.post('/bulk-link', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.body.limit as string) || 50;
    const result = await trafficDataService.bulkLinkProperties(limit);

    res.json({
      success: true,
      ...result,
      message: `Bulk link complete: ${result.linked} linked, ${result.failed} failed`,
    });
  } catch (error: any) {
    logger.error('[TrafficData] Bulk link failed', { error: error.message });
    res.status(500).json({ error: 'Failed to bulk link properties', message: error.message });
  }
});

router.get('/growth-index/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const result = await trafficGrowthService.computeForProperty(propertyId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No traffic context found for this property. Ensure DOT data is linked.',
      });
    }

    res.json({
      success: true,
      metric: 'C_TRAFFIC_GROWTH_INDEX',
      metricName: 'Traffic Growth Index (TGI)',
      formula: '(Google Realtime ADT - DOT Historical Avg ADT) / DOT Historical Avg ADT × 100',
      data: result,
    });
  } catch (error: any) {
    logger.error('[TrafficData] Growth index compute failed', { error: error.message });
    res.status(500).json({ error: 'Failed to compute Traffic Growth Index', message: error.message });
  }
});

router.post('/growth-index/:propertyId/store', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const result = await trafficGrowthService.computeAndStoreForProperty(propertyId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No traffic context found for this property. Ensure DOT data is linked.',
      });
    }

    res.json({
      success: true,
      metric: 'C_TRAFFIC_GROWTH_INDEX',
      metricName: 'Traffic Growth Index (TGI)',
      stored: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[TrafficData] Growth index store failed', { error: error.message });
    res.status(500).json({ error: 'Failed to store Traffic Growth Index', message: error.message });
  }
});

router.post('/growth-index/batch', async (req: Request, res: Response) => {
  try {
    const { propertyIds } = req.body;
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ success: false, error: 'propertyIds array is required' });
    }

    const results: TrafficGrowthResult[] = [];
    const errors: Array<{ propertyId: string; error: string }> = [];

    for (const pid of propertyIds.slice(0, 100)) {
      try {
        const r = await trafficGrowthService.computeAndStoreForProperty(pid);
        if (r) results.push(r);
      } catch (err: any) {
        errors.push({ propertyId: pid, error: err.message });
      }
    }

    res.json({
      success: true,
      metric: 'C_TRAFFIC_GROWTH_INDEX',
      metricName: 'Traffic Growth Index (TGI)',
      computed: results.length,
      failed: errors.length,
      requested: propertyIds.length,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    logger.error('[TrafficData] Batch growth index failed', { error: error.message });
    res.status(500).json({ error: 'Failed to compute batch Traffic Growth Index', message: error.message });
  }
});

export default router;
