/**
 * Agent Status Routes — Neural Network Control Hub backend
 *
 * Single endpoint that powers the F1 dashboard "Neural Network Hub" widget:
 *
 *   GET /api/v1/agents/status
 *
 * Returns three live windows the user wants to see:
 *   running   – workflow runs currently executing (status='running')
 *   recent    – the last 25 completed / failed runs
 *   events    – the last 25 platform events that hit the dispatcher
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
          `SELECT id, agent_id, trigger_event, deal_id, user_id, started_at, created_at
             FROM agent_workflow_runs
            WHERE status = 'running'
            ORDER BY COALESCE(started_at, created_at) DESC
            LIMIT 25`
        ),
        pool.query(
          `SELECT id, agent_id, trigger_event, deal_id, user_id, status,
                  started_at, completed_at, created_at, error
             FROM agent_workflow_runs
            WHERE status IN ('completed', 'failed')
            ORDER BY COALESCE(completed_at, created_at) DESC
            LIMIT 25`
        ),
        pool.query(
          `SELECT id, event_type, deal_id, user_id, created_at
             FROM agent_events
            ORDER BY created_at DESC
            LIMIT 25`
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
