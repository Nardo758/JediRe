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

    // Resolve deal context so tools receive address / property_id / MSA hints
    const dealCtxRes = await query(
      `SELECT d.address, d.property_address, d.city, d.state_code,
              dp.property_id
       FROM deals d
       LEFT JOIN deal_properties dp ON dp.deal_id = d.id
       WHERE d.id = $1
       ORDER BY dp.created_at ASC
       LIMIT 1`,
      [deal_id]
    );
    const dRow = dealCtxRes.rows[0] ?? {};
    const dealContext = {
      address: (dRow.property_address ?? dRow.address ?? null) as string | null,
      city: (dRow.city ?? null) as string | null,
      state: (dRow.state_code ?? null) as string | null,
      property_id: (dRow.property_id ?? null) as string | null,
    };

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

    // Enriched run input — LLM receives address/city/state/property_id so it
    // can call all 6 tools (fetch_parcel, fetch_ownership, fetch_costar_metrics,
    // fetch_tax_bill, fetch_comps, write_dealcontext) with valid parameters.
    const runInput: Record<string, unknown> = {
      deal_id,
      ...(dealContext.address && { address: dealContext.address }),
      ...(dealContext.city && { city: dealContext.city }),
      ...(dealContext.state && { state: dealContext.state }),
      ...(dealContext.property_id && { property_id: dealContext.property_id }),
    };

    // Fire run asynchronously — don't block the HTTP response.
    // On completion, write an audit_log entry so the unified feed surfaces this run.
    void researchRuntime.run(runInput, ctx)
      .then(async (output) => {
        // Recover run ID from DB (stamped by request_id in triggerContext)
        const runRow = await query(
          `SELECT id FROM agent_runs
           WHERE agent_id = 'research' AND deal_id = $1
             AND trigger_context->>'request_id' = $2
           LIMIT 1`,
          [deal_id, requestId]
        ).catch(() => null);

        const runId = runRow?.rows[0]?.id;
        if (!runId) return;

        const typed = output as { confidence_score?: number; fields_written?: string[]; summary?: string };
        // Idempotent audit_log write — same WHERE NOT EXISTS guard as Inngest function
        await query(
          `INSERT INTO audit_log
             (actor_id, actor_type, action, resource_type, resource_id, metadata, agent_run_id)
           SELECT 'research', 'agent', 'research.completed', 'deal', $1, $2, $3
           WHERE NOT EXISTS (SELECT 1 FROM audit_log WHERE agent_run_id = $3)`,
          [
            deal_id,
            JSON.stringify({
              confidence_score: typed.confidence_score ?? null,
              fields_written: typed.fields_written ?? [],
              summary: typed.summary ?? null,
              run_id: runId,
              triggered_by: 'user',
            }),
            runId,
          ]
        ).catch(() => { /* non-fatal */ });
      })
      .catch(() => {
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

// ── GET /api/v1/deals/:dealId/audit-log ──────────────────────────
// Unified audit_log feed for a deal — used as primary source for agent events in the UI.
// Returns audit_log entries where resource_type='deal' AND resource_id=dealId,
// joined with agent_runs metadata when agent_run_id is present.

dealAgentRunsRouter.get(
  '/:dealId/audit-log',
  requireAuthOrApiKey,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;

      if (!UUID_RE.test(dealId)) {
        throw new AppError(400, 'Invalid deal ID');
      }

      await assertDealAccess(dealId, req.user!.userId);

      const { actor_type, limit = '100', offset = '0' } = req.query;

      let queryText = `
        SELECT
          al.id,
          al.actor_id,
          al.actor_type,
          al.action,
          al.resource_type,
          al.resource_id AS deal_id,
          al.metadata,
          al.agent_run_id,
          al.created_at,
          -- Agent run join
          ar.agent_id,
          ar.agent_version,
          ar.status                                          AS run_status,
          ar.triggered_by,
          ar.tokens_in,
          ar.tokens_out,
          ar.cost_usd,
          ar.started_at,
          ar.completed_at,
          ar.duration_ms,
          ar.error                                           AS run_error
        FROM audit_log al
        LEFT JOIN agent_runs ar ON ar.id = al.agent_run_id
        WHERE al.resource_type = 'deal'
          AND al.resource_id   = $1
      `;

      const params: unknown[] = [dealId];
      let paramIndex = 2;

      if (actor_type) {
        queryText += ` AND al.actor_type = $${paramIndex}`;
        params.push(actor_type);
        paramIndex++;
      }

      queryText += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

      const result = await query(queryText, params);

      const entries = result.rows.map(row => ({
        id: row.id,
        actor_id: row.actor_id,
        actor_type: row.actor_type,
        action: row.action,
        deal_id: row.deal_id,
        metadata: row.metadata,
        agent_run_id: row.agent_run_id,
        created_at: row.created_at,
        // Normalized agent run details (only present when actor_type='agent')
        agent_run: row.agent_run_id
          ? {
              id: row.agent_run_id,
              agent_id: row.agent_id,
              agent_version: row.agent_version,
              display_status: normalizeStatus(row.run_status ?? 'failed'),
              triggered_by: row.triggered_by,
              tokens_in: row.tokens_in ?? 0,
              tokens_out: row.tokens_out ?? 0,
              cost_usd: row.cost_usd ?? null,
              started_at: row.started_at,
              completed_at: row.completed_at,
              duration_ms: row.duration_ms ?? null,
              error: row.run_error ?? null,
            }
          : null,
      }));

      res.json({ success: true, entries, count: entries.length, deal_id: dealId });
    } catch (error) {
      next(error);
    }
  }
);

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
