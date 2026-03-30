import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { MarketMetricsAggregator } from '../../services/market-metrics-aggregator.service';
import { pool } from '../../database';
import { logger } from '../../utils/logger';

const router = Router();
const aggregator = new MarketMetricsAggregator(pool);

router.use(requireAuth);

router.get('/markets', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const markets = await aggregator.getMarkets(userId);

    res.json({
      success: true,
      count: markets.length,
      markets,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching market metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market metrics',
    });
  }
});

router.get('/submarkets', async (req: Request, res: Response) => {
  try {
    const msaId = req.query.msaId as string | undefined;
    const submarkets = await aggregator.getSubmarkets(msaId);

    res.json({
      success: true,
      count: submarkets.length,
      submarkets,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching submarket metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch submarket metrics',
    });
  }
});

router.get('/properties', async (req: Request, res: Response) => {
  try {
    const msaId = req.query.msaId as string | undefined;
    const properties = await aggregator.getProperties(msaId);

    res.json({
      success: true,
      count: properties.length,
      properties,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching property metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property metrics',
    });
  }
});

export default router;
