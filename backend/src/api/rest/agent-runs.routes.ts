/**
 * Agent Runs REST Routes — Phase 3: Research Agent End-to-End
 *
 * Endpoints:
 *   POST   /api/v1/agents/:agentId/run          Manual trigger
 *   GET    /api/v1/agents/runs/:runId            Run detail
 *   GET    /api/v1/agents/runs/:runId/steps      Run step log
 *   GET    /api/v1/deals/:dealId/agent-runs      All runs for a deal
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

// ── POST /api/v1/agents/:agentId/run ─────────────────────────────
// Manually trigger a research run for a deal.
// Only agentId='research' is supported in Phase 3.

router.post('/:agentId/run', requireAuthOrApiKey, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { agentId } = req.params;
    const { deal_id, force_refresh } = req.body;

    if (agentId !== 'research') {
      throw new AppError(400, `Agent "${agentId}" is not available for manual runs in Phase 3. Only "research" is supported.`);
    }

    if (!deal_id || !UUID_RE.test(deal_id)) {
      throw new AppError(400, 'deal_id must be a valid UUID');
    }

    // Verify deal exists
    const dealCheck = await query('SELECT id FROM deals WHERE id = $1', [deal_id]);
    if (dealCheck.rows.length === 0) {
      throw new AppError(404, `Deal ${deal_id} not found`);
    }

    // Seed prompt (idempotent)
    await seedResearchPrompt();

    const ctx: RunContext = {
      dealId: deal_id,
      userId: req.user!.userId,
      triggeredBy: 'user',
      triggerContext: {
        source: 'manual_trigger',
        force_refresh: force_refresh ?? false,
      },
    };

    // Run asynchronously and return run ID immediately
    const runPromise = researchRuntime.run({ deal_id }, ctx).catch(err => {
      // Errors are persisted to agent_runs by AgentRuntime
      // and logged — don't crash the response
    });

    // The run ID is written synchronously before the loop starts.
    // We poll agent_runs for the newly created run.
    // Allow a small window for the INSERT to complete.
    await new Promise(r => setTimeout(r, 150));

    const runRow = await query(
      `SELECT id, status, started_at FROM agent_runs
       WHERE agent_id = 'research' AND deal_id = $1 AND user_id = $2
       ORDER BY started_at DESC LIMIT 1`,
      [deal_id, req.user!.userId]
    );

    res.status(202).json({
      success: true,
      message: 'Research run started',
      run_id: runRow.rows[0]?.id ?? null,
      status: runRow.rows[0]?.status ?? 'running',
      deal_id,
    });

    // Fire and forget — run continues in background
    void runPromise;
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/agents/runs/:runId ───────────────────────────────
// Fetch a single agent run by ID.

router.get('/runs/:runId', requireAuthOrApiKey, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { runId } = req.params;

    if (!UUID_RE.test(runId)) {
      throw new AppError(400, 'Invalid run ID');
    }

    const result = await query(
      `SELECT
         id, agent_id, agent_version, prompt_version,
         deal_id, user_id, triggered_by, trigger_context,
         status, input, output, error,
         tokens_in, tokens_out, cost_usd,
         started_at, completed_at, duration_ms
       FROM agent_runs
       WHERE id = $1`,
      [runId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, `Run ${runId} not found`);
    }

    res.json({ success: true, run: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/agents/runs/:runId/steps ─────────────────────────
// Fetch all steps for a run (tool calls, prompt steps, output).

router.get('/runs/:runId/steps', requireAuthOrApiKey, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { runId } = req.params;

    if (!UUID_RE.test(runId)) {
      throw new AppError(400, 'Invalid run ID');
    }

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
// Returns all agent runs for a deal, newest first.

export const dealAgentRunsRouter = Router({ mergeParams: true });

dealAgentRunsRouter.get('/:dealId/agent-runs', requireAuthOrApiKey, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { dealId } = req.params;

    if (!UUID_RE.test(dealId)) {
      throw new AppError(400, 'Invalid deal ID');
    }

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

    if (status) {
      queryText += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    queryText += ` ORDER BY started_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const result = await query(queryText, params);

    res.json({
      success: true,
      runs: result.rows,
      count: result.rows.length,
      deal_id: dealId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
