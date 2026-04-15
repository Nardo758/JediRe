/**
 * M35 Backtesting & Confidence Refinement Routes  (Phase 5)
 *
 * POST /api/v1/m35/backtest/run                    — run monthly backtest job (admin)
 * GET  /api/v1/m35/backtest/accuracy               — playbook accuracy stats (all subtypes)
 * GET  /api/v1/m35/backtest/accuracy/:subtype      — accuracy stats for one subtype
 * GET  /api/v1/m35/backtest/events/:id             — backtest results for a specific event
 * GET  /api/v1/m35/backtest/regime-alerts          — open regime-shift alerts
 * POST /api/v1/m35/backtest/regime-alerts/:id/ack  — acknowledge a regime alert
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  runMonthlyBacktest,
  getPlaybookAccuracyStats,
  getPlaybookBacktestReport,
  getEventBacktestResults,
  getRegimeShiftAlerts,
  acknowledgeRegimeAlert,
} from '../services/m35-backtest.service';

const router = Router();

// ─── Run backtest job (admin) ─────────────────────────────────────────────────

router.post('/backtest/run', async (req: Request, res: Response) => {
  try {
    const result = await runMonthlyBacktest();
    res.json({ message: 'Backtest job complete', ...result });
  } catch (err) {
    logger.error('[M35 Backtest] Error running backtest job:', err);
    res.status(500).json({ error: 'Failed to run backtest job' });
  }
});

// ─── Playbook accuracy stats ──────────────────────────────────────────────────

router.get('/backtest/accuracy', async (req: Request, res: Response) => {
  try {
    const stats = await getPlaybookAccuracyStats();
    res.json({ accuracy: stats, count: stats.length });
  } catch (err) {
    logger.error('[M35 Backtest] Error fetching accuracy stats:', err);
    res.status(500).json({ error: 'Failed to fetch accuracy stats' });
  }
});

router.get('/backtest/accuracy/:subtype', async (req: Request, res: Response) => {
  try {
    const stats = await getPlaybookAccuracyStats(req.params.subtype);
    res.json({ subtype: req.params.subtype, accuracy: stats });
  } catch (err) {
    logger.error('[M35 Backtest] Error fetching subtype accuracy:', err);
    res.status(500).json({ error: 'Failed to fetch subtype accuracy' });
  }
});

// ─── Playbook backtest report (hit rate, error dist, regime status, last 10) ──

router.get('/playbooks/:subtype/backtest', async (req: Request, res: Response) => {
  try {
    const report = await getPlaybookBacktestReport(req.params.subtype);
    res.json(report);
  } catch (err) {
    logger.error('[M35 Backtest] Error fetching playbook backtest report:', err);
    res.status(500).json({ error: 'Failed to fetch playbook backtest report' });
  }
});

// ─── Event-specific backtest results ─────────────────────────────────────────

router.get('/backtest/events/:id', async (req: Request, res: Response) => {
  try {
    const results = await getEventBacktestResults(req.params.id);
    res.json({ eventId: req.params.id, results, count: results.length });
  } catch (err) {
    logger.error('[M35 Backtest] Error fetching event backtest results:', err);
    res.status(500).json({ error: 'Failed to fetch event backtest results' });
  }
});

// ─── Regime-shift alerts ──────────────────────────────────────────────────────

router.get('/backtest/regime-alerts', async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) ?? 'open';
    const alerts = await getRegimeShiftAlerts(status);
    res.json({ alerts, count: alerts.length });
  } catch (err) {
    logger.error('[M35 Backtest] Error fetching regime alerts:', err);
    res.status(500).json({ error: 'Failed to fetch regime alerts' });
  }
});

router.post('/backtest/regime-alerts/:id/ack', async (req: Request, res: Response) => {
  try {
    const ok = await acknowledgeRegimeAlert(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Alert not found or already acknowledged' });
    res.json({ message: 'Alert acknowledged' });
  } catch (err) {
    logger.error('[M35 Backtest] Error acknowledging regime alert:', err);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

export default router;
