import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../../database';
import { DotFetcherService } from '../../services/dot-fetcher.service';
import { DotAggregatorService } from '../../services/dot-aggregator.service';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();
const dotFetcher = new DotFetcherService(pool);
const dotAggregator = new DotAggregatorService(pool);

const requireAdminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string
    || req.query.api_key as string
    || (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.slice(7));

  const configuredKey = process.env.API_KEY_ADMIN;
  if (configuredKey && apiKey === configuredKey) {
    req.user = { userId: 'admin-api-key', email: 'admin@api', role: 'admin' };
    return next();
  }

  requireAuth(req, res, (err?: any) => {
    if (err) return next(err);
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

router.post('/dot-ingest', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { state, year, aggregate = true } = req.body;

    if (!state || !year) {
      return res.status(400).json({
        error: 'Missing required fields: state, year',
        availableStates: dotFetcher.getAvailableStates(),
      });
    }

    const config = dotFetcher.getStateConfig(state);
    if (!config) {
      return res.status(400).json({
        error: `Unknown state: ${state}`,
        availableStates: dotFetcher.getAvailableStates(),
      });
    }

    const yearNum = parseInt(String(year), 10);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2030) {
      return res.status(400).json({ error: 'Year must be between 2000 and 2030' });
    }

    logger.info(`[DotAdmin] Ingestion triggered: ${state} ${yearNum}`);

    const fetchResult = await dotFetcher.fetchAndIngest(state, yearNum);

    let aggregationResult = null;
    if (aggregate && fetchResult.inserted > 0) {
      aggregationResult = await dotAggregator.aggregateToGeographies(state);
    }

    res.json({
      success: true,
      fetch: fetchResult,
      aggregation: aggregationResult,
    });
  } catch (error: any) {
    logger.error('[DotAdmin] Ingestion failed', { error: error.message });
    res.status(500).json({ error: 'Ingestion failed', message: error.message });
  }
});

router.post('/dot-ingest/batch', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { state, startYear, endYear } = req.body;

    if (!state || !startYear || !endYear) {
      return res.status(400).json({
        error: 'Missing required fields: state, startYear, endYear',
      });
    }

    const config = dotFetcher.getStateConfig(state);
    if (!config) {
      return res.status(400).json({
        error: `Unknown state: ${state}`,
        availableStates: dotFetcher.getAvailableStates(),
      });
    }

    const start = parseInt(String(startYear), 10);
    const end = parseInt(String(endYear), 10);

    if (isNaN(start) || isNaN(end) || start > end || start < 2000 || end > 2030) {
      return res.status(400).json({ error: 'Invalid year range' });
    }

    logger.info(`[DotAdmin] Batch ingestion triggered: ${state} ${start}-${end}`);

    const results: any[] = [];
    for (let y = start; y <= end; y++) {
      const result = await dotFetcher.fetchAndIngest(state, y);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const aggregationResult = await dotAggregator.aggregateToGeographies(state);

    res.json({
      success: true,
      state,
      yearRange: { start, end },
      results,
      aggregation: aggregationResult,
    });
  } catch (error: any) {
    logger.error('[DotAdmin] Batch ingestion failed', { error: error.message });
    res.status(500).json({ error: 'Batch ingestion failed', message: error.message });
  }
});

router.get('/dot-ingest/status', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const status = await dotFetcher.getIngestionStatus();

    const aggregatedResult = await pool.query(`
      SELECT
        metric_id,
        geography_type,
        COUNT(DISTINCT geography_id) as geo_count,
        COUNT(*) as data_points,
        MIN(period_date) as earliest,
        MAX(period_date) as latest
      FROM metric_time_series
      WHERE metric_id IN ('T_AADT', 'T_AADT_YOY')
      GROUP BY metric_id, geography_type
      ORDER BY metric_id
    `);

    res.json({
      success: true,
      ingestion: status,
      aggregated: aggregatedResult.rows,
    });
  } catch (error: any) {
    logger.error('[DotAdmin] Status check failed', { error: error.message });
    res.status(500).json({ error: 'Status check failed', message: error.message });
  }
});

router.post('/dot-ingest/aggregate', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { state } = req.body;
    const result = await dotAggregator.aggregateToGeographies(state || undefined);
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[DotAdmin] Aggregation failed', { error: error.message });
    res.status(500).json({ error: 'Aggregation failed', message: error.message });
  }
});

export default router;
