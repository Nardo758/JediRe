/**
 * Agent Status Routes — Neural Network Control Hub backend
 *
 * Single endpoint that powers the F1 dashboard "Neural Network Hub" widget:
 *
 *   GET /api/v1/agents/status
 *
 * Returns three live windows the user wants to see, all scoped to data the
 * authenticated caller is actually allowed to see:
 *   running   – workflow runs in flight (status in pending|running, top 20)
 *   recent    – completed/failed runs in the last 24 hours, with
 *               a computed duration_seconds for each row
 *   events    – the last 10 platform events that hit the dispatcher
 *
 * Backed by the `agent_events` and `agent_workflow_runs` tables created in
 * 20260426_neural_hub_agent_workflow_runs.sql.
 *
 * Authorization model
 * -------------------
 * Mirrors the established pattern in `backend/src/api/rest/agent-runs.routes.ts`:
 * a row is visible to user U if any of the following holds:
 *   - the row's `user_id` is U                                 (run/event the user triggered)
 *   - the row's `deal_id` belongs to a deal U owns             (deals.user_id = U)
 *   - the row's `deal_id` belongs to a deal in U's org         (org_members.user_id = U)
 * Rows with no user_id and no deal_id (system-level housekeeping runs) are
 * deliberately hidden from non-admin callers — they leak no per-tenant
 * information and are not actionable from the widget. Admin/operator
 * dashboards can be added later via a separate elevated endpoint.
 */

import { Router, Response } from 'express';
import { Pool } from 'pg';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

export function createAgentStatusRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthenticated' });
      }

      // Shared visibility predicate: row owned by user, or by a deal the
      // user can access (direct ownership or org membership).
      const VISIBILITY_JOINS = `
        LEFT JOIN deals d
          ON d.id = r.deal_id AND d.archived_at IS NULL
        LEFT JOIN org_members om
          ON om.org_id = d.org_id AND om.user_id = $1
      `;
      const VISIBILITY_WHERE = `
        (
          r.user_id = $1
          OR (r.deal_id IS NOT NULL AND (d.user_id = $1 OR om.user_id IS NOT NULL))
        )
      `;

      const [running, recent, events] = await Promise.all([
        pool.query(
          `SELECT r.id, r.agent_id, r.trigger_event, r.deal_id, r.user_id, r.status,
                  r.started_at, r.created_at
             FROM agent_workflow_runs r
             ${VISIBILITY_JOINS}
            WHERE r.status IN ('pending', 'running')
              AND ${VISIBILITY_WHERE}
            ORDER BY COALESCE(r.started_at, r.created_at) DESC
            LIMIT 20`,
          [userId]
        ),
        pool.query(
          `SELECT r.id, r.agent_id, r.trigger_event, r.deal_id, r.user_id, r.status,
                  r.started_at, r.completed_at, r.created_at, r.error,
                  EXTRACT(EPOCH FROM (
                    COALESCE(r.completed_at, NOW()) - COALESCE(r.started_at, r.created_at)
                  ))::int AS duration_seconds
             FROM agent_workflow_runs r
             ${VISIBILITY_JOINS}
            WHERE r.status IN ('completed', 'failed')
              AND COALESCE(r.completed_at, r.created_at) >= NOW() - INTERVAL '24 hours'
              AND ${VISIBILITY_WHERE}
            ORDER BY COALESCE(r.completed_at, r.created_at) DESC
            LIMIT 50`,
          [userId]
        ),
        pool.query(
          `SELECT r.id, r.event_type, r.deal_id, r.user_id, r.created_at
             FROM agent_events r
             ${VISIBILITY_JOINS}
            WHERE ${VISIBILITY_WHERE}
            ORDER BY r.created_at DESC
            LIMIT 10`,
          [userId]
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
