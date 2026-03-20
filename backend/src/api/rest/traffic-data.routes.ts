import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from '../../database';
import { TrafficDataSourcesService } from '../../services/traffic-data-sources.service';
import { logger } from '../../utils/logger';

const router = Router();
const trafficDataService = new TrafficDataSourcesService(pool);

const adtUpload = multer({
  dest: path.join(process.cwd(), 'uploads', 'adt-data'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

router.post('/adt/upload', adtUpload.single('file'), async (req: Request, res: Response) => {
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

export default router;
