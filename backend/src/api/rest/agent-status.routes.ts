/**
 * Agent Status Routes — Neural Network Control Hub backend
 *
 * Single endpoint that powers the F1 dashboard "Neural Network Hub" widget:
 *
 *   GET /api/v1/agents/status
 *
 * Returns three live windows the user wants to see:
 *   running   – workflow runs in flight (status in pending|running, top 20)
 *   recent    – completed/failed runs in the last 24 hours, with
 *               a computed duration_seconds for each row
 *   events    – the last 10 platform events that hit the dispatcher
 *
 * Backed by the `agent_events` and `agent_workflow_runs` tables created in
 * 20260426_neural_hub_agent_workflow_runs.sql.  All three queries are
 * keyset-friendly (descending on created_at / started_at) and are O(N) on
 * the small partial indexes defined in the migration.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authMiddleware } from '../../middleware/auth';

export function createAgentStatusRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/', authMiddleware.requireAuth, async (_req: Request, res: Response) => {
    try {
      const [running, recent, events] = await Promise.all([
        pool.query(
          `SELECT id, agent_id, trigger_event, deal_id, user_id, status,
                  started_at, created_at
             FROM agent_workflow_runs
            WHERE status IN ('pending', 'running')
            ORDER BY COALESCE(started_at, created_at) DESC
            LIMIT 20`
        ),
        pool.query(
          `SELECT id, agent_id, trigger_event, deal_id, user_id, status,
                  started_at, completed_at, created_at, error,
                  EXTRACT(EPOCH FROM (
                    COALESCE(completed_at, NOW()) - COALESCE(started_at, created_at)
                  ))::int AS duration_seconds
             FROM agent_workflow_runs
            WHERE status IN ('completed', 'failed')
              AND COALESCE(completed_at, created_at) >= NOW() - INTERVAL '24 hours'
            ORDER BY COALESCE(completed_at, created_at) DESC
            LIMIT 50`
        ),
        pool.query(
          `SELECT id, event_type, deal_id, user_id, created_at
             FROM agent_events
            ORDER BY created_at DESC
            LIMIT 10`
        ),
      ]);

      res.json({
        success: true,
        running: running.rows,
        recent: recent.rows,
        events: events.rows,
        summary: {
          runningCount: running.rows.length,
          recentCount: recent.rows.length,
          eventCount: events.rows.length,
        },
        ts: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[AgentStatus] Failed to fetch status:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch agent status',
        message: err?.message,
      });
    }
  });

  return router;
}

export default createAgentStatusRoutes;
