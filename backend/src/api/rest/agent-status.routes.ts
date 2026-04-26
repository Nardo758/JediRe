/**
 * Agent Status Routes
 * Provides real-time visibility into agent workflows for the Neural Network Hub widget
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query } from '../../database/connection';

const router = Router();

// GET /api/v1/agents/status
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;

  const [runningResult, recentResult, eventsResult] = await Promise.all([
    // Currently running / pending agents
    query(`
      SELECT r.id, r.agent_id, r.trigger_event, r.status, r.started_at, r.created_at,
             d.name as deal_name, r.deal_id
      FROM agent_workflow_runs r
      LEFT JOIN deals d ON d.id = r.deal_id
      WHERE r.status IN ('pending', 'running')
        AND (r.user_id = $1 OR r.user_id IS NULL)
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [userId]),

    // Recently completed (last 24h)
    query(`
      SELECT r.id, r.agent_id, r.trigger_event, r.status, r.started_at, r.completed_at, r.created_at,
             d.name as deal_name,
             EXTRACT(EPOCH FROM (COALESCE(r.completed_at, NOW()) - r.created_at))::int as duration_seconds
      FROM agent_workflow_runs r
      LEFT JOIN deals d ON d.id = r.deal_id
      WHERE r.status IN ('completed', 'failed')
        AND r.created_at > NOW() - INTERVAL '24 hours'
        AND (r.user_id = $1 OR r.user_id IS NULL)
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [userId]),

    // Recent events
    query(`
      SELECT e.id, e.event_type, e.payload, e.created_at
      FROM agent_events e
      ORDER BY e.created_at DESC
      LIMIT 10
    `),
  ]);

  res.json({
    running: runningResult.rows,
    recent: recentResult.rows,
    events: eventsResult.rows,
  });
});

export default router;
