/**
 * Agent Runs REST Routes — Phase 3: Research Agent End-to-End
 *
 * Endpoints:
 *   POST   /api/v1/agents/:agentId/run          Manual trigger (deal ownership required)
 *   GET    /api/v1/agents/runs/:runId            Run detail (ownership gated)
 *   GET    /api/v1/agents/runs/:runId/steps      Run step log (ownership gated)
 *   GET    /api/v1/deals/:dealId/agent-runs      All runs for a deal (ownership gated)
 *
 * Authorization pattern:
 *   All endpoints check that the requesting user either owns the deal
 *   directly (deals.user_id = userId) or is a member of the deal's org
 *   (org_members.user_id = userId AND org_members.org_id = deals.org_id).
 *
 * Status normalization:
 *   Backend stores: pending | running | succeeded | failed | aborted | budget_exceeded
 *   API exposes a normalized display_status for UI consumption:
 *     running        → "running"
 *     succeeded      → "completed"
 *     failed         → "failed"
 *     aborted        → "cancelled"
 *     budget_exceeded→ "budget_exceeded"
 *     pending        → "pending"
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuthOrApiKey, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { researchRuntime } from '../../agents/research.config';
import { seedResearchPrompt } from '../../agents/seeds/research.seed';
import type { RunContext } from '../../agents/runtime/types';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Helpers ───────────────────────────────────────────────────────

type BackendRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'aborted' | 'budget_exceeded';
type DisplayStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'budget_exceeded';

function normalizeStatus(raw: string): DisplayStatus {
  const map: Record<BackendRunStatus, DisplayStatus> = {
    pending: 'pending',
    running: 'running',
    succeeded: 'completed',
    failed: 'failed',
    aborted: 'cancelled',
    budget_exceeded: 'budget_exceeded',
  };
  return map[raw as BackendRunStatus] ?? 'failed';
}

function normalizeRun(row: Record<string, unknown>) {
  return { ...row, display_status: normalizeStatus(row.status as string) };
}

/**
 * Verify the authenticated user has access to the given deal.
 * Returns the deal row if accessible, throws 403/404 otherwise.
 */
async function assertDealAccess(dealId: string, userId: string): Promise<{ id: string }> {
  const result = await query(
    `SELECT d.id
     FROM deals d
     LEFT JOIN org_members om ON om.org_id = d.org_id AND om.user_id = $2
     WHERE d.id = $1
       AND d.archived_at IS NULL
       AND (d.user_id = $2 OR om.user_id IS NOT NULL)`,
    [dealId, userId]
  );

  if (result.rows.length === 0) {
    // Use 404 to avoid leaking deal existence to unauthorized users
    throw new AppError(404, `Deal ${dealId} not found`);
  }

  return result.rows[0] as { id: string };
}

/**
 * Verify the authenticated user has access to the given agent run.
 * Returns the run row if accessible, throws 403/404 otherwise.
 */
async function assertRunAccess(
  runId: string,
  userId: string
): Promise<Record<string, unknown>> {
  const result = await query(
    `SELECT r.id, r.agent_id, r.agent_version, r.prompt_version,
            r.deal_id, r.user_id, r.triggered_by, r.trigger_context,
            r.status, r.input, r.output, r.error,
            r.tokens_in, r.tokens_out, r.cost_usd,
            r.started_at, r.completed_at, r.duration_ms
     FROM agent_runs r
     LEFT JOIN deals d ON d.id = r.deal_id AND d.archived_at IS NULL
     LEFT JOIN org_members om ON om.org_id = d.org_id AND om.user_id = $2
     WHERE r.id = $1
       AND (
         r.user_id = $2
         OR d.user_id = $2
         OR om.user_id IS NOT NULL
       )`,
    [runId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, `Run ${runId} not found`);
  }

  return result.rows[0] as Record<string, unknown>;
}

// ── POST /api/v1/agents/:agentId/run ─────────────────────────────
// Manually trigger a research run for a deal the user owns.

router.post('/:agentId/run', requireAuthOrApiKey, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { agentId } = req.params;
    const { deal_id, force_refresh } = req.body;

    if (agentId !== 'research') {
      throw new AppError(
        400,
        `Agent "${agentId}" is not available for manual runs in Phase 3. Only "research" is supported.`
      );
    }

    if (!deal_id || !UUID_RE.test(deal_id)) {
      throw new AppError(400, 'deal_id must be a valid UUID');
    }

    // Ownership check — 404 if not accessible (IDOR-safe)
    await assertDealAccess(deal_id, req.user!.userId);

    // Seed prompt (idempotent)
    await seedResearchPrompt();

    const requestId = crypto.randomUUID();

    const ctx: RunContext = {
      dealId: deal_id,
      userId: req.user!.userId,
      triggeredBy: 'user',
      triggerContext: {
        source: 'manual_trigger',
        force_refresh: force_refresh ?? false,
        request_id: requestId,
      },
    };

    // Fire run asynchronously — don't block the HTTP response
    void researchRuntime.run({ deal_id }, ctx).catch(() => {
      // Errors are persisted to agent_runs by AgentRuntime
    });

    // Give the INSERT time to land, then return the run reference
    await new Promise(r => setTimeout(r, 200));

    const runRow = await query(
      `SELECT id, status, started_at FROM agent_runs
       WHERE agent_id = 'research'
         AND deal_id = $1
         AND trigger_context->>'request_id' = $2
       ORDER BY started_at DESC LIMIT 1`,
      [deal_id, requestId]
    );

    // Fallback: newest run for this deal
    const row = runRow.rows[0] ?? (await query(
      `SELECT id, status, started_at FROM agent_runs
       WHERE agent_id = 'research' AND deal_id = $1
       ORDER BY started_at DESC LIMIT 1`,
      [deal_id]
    )).rows[0];

    res.status(202).json({
      success: true,
      message: 'Research run started',
      run_id: row?.id ?? null,
      display_status: normalizeStatus(row?.status ?? 'running'),
      deal_id,
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/agents/runs/:runId ───────────────────────────────
// Fetch a single agent run by ID (ownership gated).

router.get('/runs/:runId', requireAuthOrApiKey, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { runId } = req.params;

    if (!UUID_RE.test(runId)) {
      throw new AppError(400, 'Invalid run ID');
    }

    const row = await assertRunAccess(runId, req.user!.userId);
    res.json({ success: true, run: normalizeRun(row) });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/agents/runs/:runId/steps ─────────────────────────
// Fetch all steps for a run — ownership gated via run → deal.

router.get('/runs/:runId/steps', requireAuthOrApiKey, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { runId } = req.params;

    if (!UUID_RE.test(runId)) {
      throw new AppError(400, 'Invalid run ID');
    }

    // Verify access first
    await assertRunAccess(runId, req.user!.userId);

    const result = await query(
      `SELECT
         id, agent_run_id, step_index, step_type,
         tool_name, payload, tokens_in, tokens_out,
         duration_ms, created_at
       FROM agent_run_steps
       WHERE agent_run_id = $1
       ORDER BY step_index ASC`,
      [runId]
    );

    res.json({ success: true, steps: result.rows, count: result.rows.length });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/deals/:dealId/agent-runs ─────────────────────────
// Mounted under /deals prefix by index.ts.
// Returns all agent runs for a deal with normalized display_status.

export const dealAgentRunsRouter = Router({ mergeParams: true });

dealAgentRunsRouter.get(
  '/:dealId/agent-runs',
  requireAuthOrApiKey,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;

      if (!UUID_RE.test(dealId)) {
        throw new AppError(400, 'Invalid deal ID');
      }

      // Ownership check — 404 if not accessible
      await assertDealAccess(dealId, req.user!.userId);

      const { agent_id, status, limit = '50', offset = '0' } = req.query;

      let queryText = `
        SELECT
          id, agent_id, agent_version, deal_id, user_id,
          triggered_by, status, tokens_in, tokens_out, cost_usd,
          started_at, completed_at, duration_ms, error
        FROM agent_runs
        WHERE deal_id = $1
      `;
      const params: unknown[] = [dealId];
      let paramIndex = 2;

      if (agent_id) {
        queryText += ` AND agent_id = $${paramIndex}`;
        params.push(agent_id);
        paramIndex++;
      }

      // Map normalized display_status back to DB statuses for filtering
      if (status) {
        if (status === 'completed') {
          queryText += ` AND status = 'succeeded'`;
        } else if (status === 'cancelled') {
          queryText += ` AND status = 'aborted'`;
        } else {
          queryText += ` AND status = $${paramIndex}`;
          params.push(status);
          paramIndex++;
        }
      }

      queryText += ` ORDER BY started_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

      const result = await query(queryText, params);

      res.json({
        success: true,
        runs: result.rows.map(normalizeRun),
        count: result.rows.length,
        deal_id: dealId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
