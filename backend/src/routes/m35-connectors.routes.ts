/**
 * M35 Event Connectors — Admin API Routes
 *
 * POST /api/m35/connectors/run/:connector   — trigger a single connector
 * POST /api/m35/connectors/run-all          — trigger all Atlanta connectors
 * POST /api/m35/connectors/backtest         — run full GDELT 2013-2024 seed
 * GET  /api/m35/connectors/status           — current connector health + queue count
 * GET  /api/m35/connectors/draft-events     — paginated draft event queue
 * POST /api/m35/connectors/draft-events/:id/promote — promote draft → live M35 event
 * POST /api/m35/connectors/draft-events/:id/reject  — reject draft
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import {
  runAtlantaPermitsConnector,
  runAtlantaRezoningConnector,
  runGdeltBacktestConnector,
  runAllAtlantaConnectors,
  seedAtlantaBacktest,
  type ConnectorRunStats,
} from '../services/m35-event-connectors.service';
import { promoteFromDraftQueue } from '../services/m35-events.service';

const router = Router();

// ─── GET /status ─────────────────────────────────────────────────────────────

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();

    // Queue counts by status
    const queueResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM m35_draft_events
      GROUP BY status
    `).catch(() => ({ rows: [] }));

    const counts: Record<string, number> = {};
    for (const row of queueResult.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }

    // Most recent run per connector
    const lastRunResult = await pool.query(`
      SELECT source_connector, MAX(created_at) as last_created
      FROM m35_draft_events
      GROUP BY source_connector
    `).catch(() => ({ rows: [] }));

    const lastRuns: Record<string, string | null> = {};
    for (const row of lastRunResult.rows) {
      lastRuns[row.source_connector] = row.last_created;
    }

    res.json({
      connectors: [
        {
          id: 'atlanta-permits',
          name: 'Atlanta Building Permits (Socrata)',
          source: 'data.atlantaga.gov',
          schedule: 'nightly',
          lastRun: lastRuns['atlanta-permits'] ?? null,
          status: 'active',
        },
        {
          id: 'atlanta-rezoning',
          name: 'Atlanta DPCD Rezoning + SUPs (ArcGIS)',
          source: 'gis.atlantaga.gov',
          schedule: 'nightly',
          lastRun: lastRuns['atlanta-rezoning'] ?? null,
          status: 'active',
        },
        {
          id: 'gdelt-backtest',
          name: 'GDELT GKG Historical Backtest',
          source: 'gdeltproject.org',
          schedule: 'manual',
          lastRun: lastRuns['gdelt-backtest'] ?? null,
          status: 'ready',
        },
      ],
      queue: {
        draft:    counts['DRAFT']    ?? 0,
        promoted: counts['PROMOTED'] ?? 0,
        rejected: counts['REJECTED'] ?? 0,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      },
    });
  } catch (err: any) {
    logger.error('[M35 Connectors] status error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /run/:connector ─────────────────────────────────────────────────────

router.post('/run/:connector', async (req: Request, res: Response) => {
  const { connector } = req.params;
  const { sinceDate } = req.body ?? {};
  const since = sinceDate ? new Date(sinceDate) : undefined;

  let stats: ConnectorRunStats;
  try {
    switch (connector) {
      case 'atlanta-permits':
        stats = await runAtlantaPermitsConnector({ sinceDate: since });
        break;
      case 'atlanta-rezoning':
        stats = await runAtlantaRezoningConnector({ sinceDate: since });
        break;
      default:
        res.status(400).json({ error: `Unknown connector: ${connector}` });
        return;
    }
    res.json({ ok: true, stats });
  } catch (err: any) {
    logger.error(`[M35 Connectors] run ${connector} error`, err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /run-all ────────────────────────────────────────────────────────────

router.post('/run-all', async (req: Request, res: Response) => {
  const { sinceDate } = req.body ?? {};
  const since = sinceDate ? new Date(sinceDate) : undefined;

  try {
    const results = await runAllAtlantaConnectors({ sinceDate: since });
    res.json({ ok: true, results });
  } catch (err: any) {
    logger.error('[M35 Connectors] run-all error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /backtest ───────────────────────────────────────────────────────────

router.post('/backtest', async (req: Request, res: Response) => {
  const { fromDate, toDate, keywords } = req.body ?? {};

  // Allow custom range; default is full 2013-2024
  const from = fromDate ? new Date(fromDate) : new Date('2013-01-01');
  const to   = toDate   ? new Date(toDate)   : new Date('2024-12-31');

  try {
    if (keywords) {
      // Caller passed custom keywords — run GDELT only with those
      const stats = await runGdeltBacktestConnector({ fromDate: from, toDate: to, keywords });
      res.json({ ok: true, results: [stats] });
    } else {
      // Full backtest seed
      const results = await seedAtlantaBacktest();
      res.json({ ok: true, results });
    }
  } catch (err: any) {
    logger.error('[M35 Connectors] backtest error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /draft-events ────────────────────────────────────────────────────────

router.get('/draft-events', async (req: Request, res: Response) => {
  const pool = getPool();
  const page   = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10));
  const limit  = Math.min(50, parseInt(String(req.query.limit ?? '25'), 10));
  const offset = (page - 1) * limit;

  const connector = req.query.connector as string | undefined;
  const category  = req.query.category  as string | undefined;
  const status    = (req.query.status   as string) ?? 'DRAFT';

  const conditions: string[] = [`status = $1`];
  const params: unknown[]    = [status];

  if (connector) { conditions.push(`source_connector = $${params.length + 1}`); params.push(connector); }
  if (category)  { conditions.push(`category = $${params.length + 1}`);         params.push(category);  }

  const where = conditions.join(' AND ');

  try {
    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT id, source_connector, source_record_id, msa_id, submarket_hint,
                category, scope, name, description, signal_date,
                estimated_magnitude, confidence, source_url, status, created_at
         FROM m35_draft_events
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) as total FROM m35_draft_events WHERE ${where}`, params),
    ]);

    res.json({
      items: rows.rows,
      total: parseInt(countRow.rows[0].total, 10),
      page,
      limit,
    });
  } catch (err: any) {
    logger.error('[M35 Connectors] draft-events list error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /draft-events/:id/promote ──────────────────────────────────────────
// Promote a draft event into the live key_events table via the M35 events service.

router.post('/draft-events/:id/promote', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { overrides } = req.body ?? {};

  try {
    const event = await promoteFromDraftQueue(
      id,
      overrides ?? {},
      (req as any).user?.email
    );
    res.status(201).json({ ok: true, event });
  } catch (err: any) {
    logger.error('[M35 Connectors] promote error', err);
    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// ─── POST /draft-events/:id/reject ───────────────────────────────────────────

router.post('/draft-events/:id/reject', async (req: Request, res: Response) => {
  const pool = getPool();
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE m35_draft_events SET status = 'REJECTED', reviewed_at = now() WHERE id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('[M35 Connectors] reject error', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
