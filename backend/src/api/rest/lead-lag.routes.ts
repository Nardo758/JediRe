import { Router, Request, Response } from 'express';
import { pool } from '../../database';
import { LeadLagDiscoveryService } from '../../services/leadLagDiscovery.service';
import { requireAdminApiKey } from './admin-api-key.routes';

const router = Router();
const service = new LeadLagDiscoveryService(pool);

const VALID_GEO_TYPES = ['submarket', 'metro', 'county', 'state', 'country'];

router.get('/results', async (req: Request, res: Response) => {
  try {
    const { outcomeMetric, minR, limit } = req.query;
    const parsedMinR = minR ? parseFloat(minR as string) : undefined;
    const parsedLimit = limit ? parseInt(limit as string, 10) : 50;
    if (parsedMinR !== undefined && isNaN(parsedMinR)) {
      return res.status(400).json({ success: false, error: 'minR must be a valid number' });
    }
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return res.status(400).json({ success: false, error: 'limit must be between 1 and 1000' });
    }
    const results = await service.getResults({
      outcomeMetric: outcomeMetric as string | undefined,
      minR: parsedMinR,
      limit: parsedLimit,
    });
    res.json({ success: true, data: results, count: results.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metric/:metricId', async (req: Request, res: Response) => {
  try {
    const { metricId } = req.params;
    if (!metricId || metricId.length > 100) {
      return res.status(400).json({ success: false, error: 'Invalid metricId' });
    }
    const data = await service.getMetricLeadLag(metricId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/outcomes', async (_req: Request, res: Response) => {
  try {
    const data = await service.getOutcomeSummary();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/catalog-overrides', async (_req: Request, res: Response) => {
  try {
    const data = await service.getEmpiricalCatalogOverrides();
    res.json({ success: true, data, count: data.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/compute', requireAdminApiKey, async (req: Request, res: Response) => {
  try {
    const { geographyType } = req.body;
    const geo = geographyType || 'metro';
    if (!VALID_GEO_TYPES.includes(geo)) {
      return res.status(400).json({ success: false, error: `geographyType must be one of: ${VALID_GEO_TYPES.join(', ')}` });
    }
    const result = await service.runDiscoveryPipeline(geo);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
