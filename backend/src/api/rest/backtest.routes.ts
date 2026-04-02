import { Router, Request, Response } from 'express';
import { pool } from '../../database';
import { BacktestEngineService } from '../../services/backtestEngine.service';
import { logger } from '../../utils/logger';

const router = Router();
const engine = new BacktestEngineService(pool);

router.post('/run', async (req: Request, res: Response) => {
  try {
    const { propertyId, config } = req.body;
    if (!propertyId || typeof propertyId !== 'string') {
      return res.status(400).json({ error: 'propertyId is required and must be a string' });
    }

    const result = await engine.runBacktest(propertyId, config || {});
    res.json(result);
  } catch (error) {
    logger.error(`Backtest run error: ${String(error)}`);
    res.status(500).json({ error: 'Backtest execution failed' });
  }
});

router.get('/runs', async (_req: Request, res: Response) => {
  try {
    const runs = await engine.getAllRuns();
    res.json(runs);
  } catch (error) {
    logger.error(`Backtest list error: ${String(error)}`);
    res.status(500).json({ error: 'Failed to retrieve backtest runs' });
  }
});

router.get('/results/:runId', async (req: Request, res: Response) => {
  try {
    const runId = parseInt(req.params.runId);
    if (isNaN(runId) || runId <= 0) {
      return res.status(400).json({ error: 'runId must be a positive integer' });
    }
    const result = await engine.getRunResults(runId);
    if (!result) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(result);
  } catch (error) {
    logger.error(`Backtest results error: ${String(error)}`);
    res.status(500).json({ error: 'Failed to retrieve backtest results' });
  }
});

router.post('/run/traffic', async (req: Request, res: Response) => {
  try {
    const { propertyId, config } = req.body;
    if (!propertyId || typeof propertyId !== 'string') {
      return res.status(400).json({ error: 'propertyId is required and must be a string' });
    }

    const result = await engine.runTrafficBacktest(propertyId, config || {});
    res.json(result);
  } catch (error) {
    logger.error(`Traffic backtest error: ${String(error)}`);
    res.status(500).json({ error: 'Traffic backtest execution failed' });
  }
});

router.get('/property/:propertyId', async (req: Request, res: Response) => {
  try {
    const results = await engine.getPropertyResults(req.params.propertyId);
    res.json(results);
  } catch (error) {
    logger.error(`Backtest property results error: ${String(error)}`);
    res.status(500).json({ error: 'Failed to retrieve property backtest results' });
  }
});

export default router;
