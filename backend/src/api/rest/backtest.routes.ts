import { Router, Request, Response } from 'express';
import { pool } from '../../database';
import { BacktestEngineService } from '../../services/backtestEngine.service';
import { StrategyBacktestService } from '../../services/strategyBacktest.service';
import { logger } from '../../utils/logger';

const router = Router();
const engine = new BacktestEngineService(pool);
const strategyBacktest = new StrategyBacktestService(pool);

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

router.get('/strategy/leaderboard', async (_req: Request, res: Response) => {
  try {
    const leaderboard = await strategyBacktest.getLeaderboard();
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    logger.error(`Strategy leaderboard error: ${String(error)}`);
    res.status(500).json({ error: 'Failed to retrieve strategy leaderboard' });
  }
});

router.get('/strategy/summaries', async (_req: Request, res: Response) => {
  try {
    const summaries = await strategyBacktest.getAllSummaries();
    res.json({ success: true, data: summaries });
  } catch (error) {
    logger.error(`Strategy summaries error: ${String(error)}`);
    res.status(500).json({ error: 'Failed to retrieve strategy summaries' });
  }
});

router.post('/strategy/run-all-presets', async (_req: Request, res: Response) => {
  try {
    const results = await strategyBacktest.runAllPresets();
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error(`Run all presets error: ${String(error)}`);
    res.status(500).json({ error: 'Failed to run all preset backtests' });
  }
});

const runHandler = async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    if (!strategyId) {
      return res.status(400).json({ error: 'strategyId is required' });
    }
    const result = await strategyBacktest.runBacktest(strategyId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Strategy backtest run error: ${String(error)}`);
    res.status(500).json({ error: 'Strategy backtest execution failed' });
  }
};

const resultsHandler = async (req: Request, res: Response) => {
  try {
    const results = await strategyBacktest.getResults(req.params.strategyId);
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error(`Strategy backtest results error: ${String(error)}`);
    res.status(500).json({ error: 'Failed to retrieve strategy backtest results' });
  }
};

const summaryHandler = async (req: Request, res: Response) => {
  try {
    const summary = await strategyBacktest.getSummary(req.params.strategyId);
    if (!summary) {
      return res.status(404).json({ error: 'No backtest summary found for this strategy' });
    }
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error(`Strategy backtest summary error: ${String(error)}`);
    res.status(500).json({ error: 'Failed to retrieve strategy backtest summary' });
  }
};

router.post('/strategy/:strategyId/run', runHandler);
router.get('/strategy/:strategyId/results', resultsHandler);
router.get('/strategy/:strategyId/summary', summaryHandler);

router.post('/run/strategy/:strategyId', runHandler);
router.get('/results/strategy/:strategyId', resultsHandler);
router.get('/summary/strategy/:strategyId', summaryHandler);

export default router;
