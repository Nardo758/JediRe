import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getPool } from '../../database/connection';
import { DriverAnalysisService } from '../../services/driverAnalysis.service';
import { logger } from '../../utils/logger';

const router = Router();

router.use(requireAuth);

router.post('/run', async (req: Request, res: Response) => {
  try {
    const { propertyId, maxLagWeeks, minSampleSize, outcomeMetrics } = req.body;

    if (!propertyId || typeof propertyId !== 'string') {
      return res.status(400).json({ success: false, error: 'propertyId is required and must be a string' });
    }
    if (maxLagWeeks !== undefined && (typeof maxLagWeeks !== 'number' || isNaN(maxLagWeeks) || maxLagWeeks < 1 || maxLagWeeks > 26)) {
      return res.status(400).json({ success: false, error: 'maxLagWeeks must be a number between 1 and 26' });
    }
    if (minSampleSize !== undefined && (typeof minSampleSize !== 'number' || isNaN(minSampleSize) || minSampleSize < 3)) {
      return res.status(400).json({ success: false, error: 'minSampleSize must be a number >= 3' });
    }

    const service = new DriverAnalysisService(getPool());
    const result = await service.runAnalysis(propertyId, { maxLagWeeks, minSampleSize, outcomeMetrics });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Driver analysis run error:', error);
    res.status(500).json({ success: false, error: 'Driver analysis run failed' });
  }
});

router.get('/results/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { outcomeMetric, minR, maxPValue, minLag, maxLag, limit, sortBy, sortDir } = req.query;

    const service = new DriverAnalysisService(getPool());
    const results = await service.getResults(propertyId, {
      outcomeMetric: outcomeMetric as string,
      minR: minR ? parseFloat(minR as string) : undefined,
      maxPValue: maxPValue ? parseFloat(maxPValue as string) : undefined,
      minLag: minLag ? parseInt(minLag as string) : undefined,
      maxLag: maxLag ? parseInt(maxLag as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      sortBy: sortBy as string,
      sortDir: sortDir as string,
    });

    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    logger.error('Driver analysis results error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve driver analysis results' });
  }
});

router.get('/summary/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const topN = req.query.topN ? parseInt(req.query.topN as string) : 10;

    const service = new DriverAnalysisService(getPool());
    const summary = await service.getSummary(propertyId, topN);

    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Driver analysis summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve driver analysis summary' });
  }
});

router.get('/runs', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.query;
    const service = new DriverAnalysisService(getPool());
    const runs = await service.getRuns(propertyId as string);

    res.json({ success: true, data: runs });
  } catch (error) {
    logger.error('Driver analysis runs error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve driver analysis runs' });
  }
});

export default router;
