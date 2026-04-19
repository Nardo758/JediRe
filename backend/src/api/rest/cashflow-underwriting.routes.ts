/**
 * CashFlow Underwriting REST Routes
 *
 * Endpoints:
 *   POST  /api/v1/agents/cashflow/underwrite               Trigger evidence underwriting run
 *   GET   /api/v1/agents/runs/:runId/underwriting          Run underwriting result
 *   GET   /api/v1/deals/:dealId/assumptions/:fieldPath/evidence  Field evidence
 *   POST  /api/v1/deals/:dealId/assumptions/:fieldPath/override  User override
 *   POST  /api/v1/deals/:dealId/underwriting/walkthrough   Request walkthrough narrative
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { cashflowRuntime } from '../../agents/cashflow.config';
import { seedCashflowPrompt } from '../../agents/seeds/cashflow.seed';
import type { RunContext } from '../../agents/runtime/types';

const router = Router();
export const dealUnderwritingRouter = Router({ mergeParams: true });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assertDealAccess(dealId: string, userId: string): Promise<void> {
  const result = await query(
    `SELECT d.id FROM deals d
     LEFT JOIN org_members om ON om.org_id = d.org_id AND om.user_id = $2
     WHERE d.id = $1 AND d.archived_at IS NULL
       AND (d.user_id = $2 OR om.user_id IS NOT NULL)`,
    [dealId, userId]
  );
  if (result.rows.length === 0) {
    throw new AppError(404, `Deal ${dealId} not found`);
  }
}

// ── POST /api/v1/agents/cashflow/underwrite ───────────────────────
router.post('/cashflow/underwrite', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { deal_id, trigger = 'manual' } = req.body;

    if (!deal_id || !UUID_RE.test(deal_id)) {
      throw new AppError(400, 'deal_id must be a valid UUID');
    }

    await assertDealAccess(deal_id, req.user!.userId);
    await seedCashflowPrompt();

    const ctx: RunContext = {
      dealId: deal_id,
      userId: req.user!.userId,
      triggeredBy: 'user',
      triggerContext: {
        source: 'underwriting_trigger',
        trigger,
        request_id: crypto.randomUUID(),
      },
    };

    const { runId, done } = await cashflowRuntime.startAsync({ deal_id }, ctx);

    void done.catch(() => {});

    res.status(202).json({
      success: true,
      message: 'CashFlow underwriting run started',
      agent_run_id: runId,
      status: 'running',
      deal_id,
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/agents/runs/:runId/underwriting ───────────────────
router.get('/runs/:runId/underwriting', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { runId } = req.params;
    if (!UUID_RE.test(runId)) throw new AppError(400, 'Invalid run ID');

    const runResult = await query(
      `SELECT r.id, r.deal_id, r.status, r.output, r.started_at, r.completed_at
       FROM agent_runs r
       LEFT JOIN deals d ON d.id = r.deal_id AND d.archived_at IS NULL
       LEFT JOIN org_members om ON om.org_id = d.org_id AND om.user_id = $2
       WHERE r.id = $1 AND r.agent_id = 'cashflow'
         AND (r.user_id = $2 OR d.user_id = $2 OR om.user_id IS NOT NULL)`,
      [runId, req.user!.userId]
    );

    if (runResult.rows.length === 0) {
      throw new AppError(404, `Run ${runId} not found`);
    }

    const run = runResult.rows[0] as Record<string, unknown>;

    // Fetch latest snapshot for this run
    const snapResult = await query(
      `SELECT id, proforma_json, evidence_map, created_at
       FROM deal_underwriting_snapshots
       WHERE agent_run_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [runId]
    );

    const snapshot = snapResult.rows[0] ?? null;

    res.json({
      success: true,
      run_id: runId,
      deal_id: run.deal_id,
      status: run.status,
      started_at: run.started_at,
      completed_at: run.completed_at,
      proforma: (snapshot as Record<string, unknown> | null)?.proforma_json ?? null,
      evidence_map: (snapshot as Record<string, unknown> | null)?.evidence_map ?? null,
      snapshot_id: (snapshot as Record<string, unknown> | null)?.id ?? null,
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/deals/:dealId/assumptions/:fieldPath/evidence ─────
dealUnderwritingRouter.get(
  '/:dealId/assumptions/:fieldPath/evidence',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId, fieldPath } = req.params;
      if (!UUID_RE.test(dealId)) throw new AppError(400, 'Invalid deal ID');

      await assertDealAccess(dealId, req.user!.userId);

      const result = await query(
        `SELECT id, field_path, value_numeric, value_text, primary_tier,
                data_points, reasoning, alternatives, collision, confidence, created_at, agent_run_id
         FROM underwriting_evidence
         WHERE deal_id = $1 AND field_path = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [dealId, fieldPath]
      );

      if (result.rows.length === 0) {
        res.json({ success: true, evidence: null, deal_id: dealId, field_path: fieldPath });
        return;
      }

      const row = result.rows[0] as Record<string, unknown>;
      res.json({
        success: true,
        evidence: {
          id: row.id,
          field_path: row.field_path,
          value_numeric: row.value_numeric,
          value_text: row.value_text,
          primary_tier: row.primary_tier,
          data_points: row.data_points,
          reasoning: row.reasoning,
          alternatives: row.alternatives,
          collision: row.collision,
          confidence: row.confidence,
          created_at: row.created_at,
          agent_run_id: row.agent_run_id,
        },
        deal_id: dealId,
        field_path: fieldPath,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ── POST /api/v1/deals/:dealId/assumptions/:fieldPath/override ────
dealUnderwritingRouter.post(
  '/:dealId/assumptions/:fieldPath/override',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId, fieldPath } = req.params;
      if (!UUID_RE.test(dealId)) throw new AppError(400, 'Invalid deal ID');

      await assertDealAccess(dealId, req.user!.userId);

      const { value, reason } = req.body;
      if (value === undefined || value === null) {
        throw new AppError(400, 'value is required');
      }

      // Fetch previous agent value for audit log
      const prevResult = await query(
        `SELECT value_numeric, value_text
         FROM underwriting_evidence
         WHERE deal_id = $1 AND field_path = $2
         ORDER BY created_at DESC LIMIT 1`,
        [dealId, fieldPath]
      );
      const prev = prevResult.rows[0] ?? null;

      // Write to deal_context_fields as user override
      await query(
        `INSERT INTO deal_context_fields
           (deal_id, field_path, value, source_label, metadata, updated_at)
         VALUES ($1, $2, $3, 'override', $4, NOW())
         ON CONFLICT (deal_id, field_path)
         DO UPDATE SET
           value = EXCLUDED.value,
           source_label = 'override',
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [
          dealId,
          fieldPath,
          JSON.stringify(value),
          JSON.stringify({
            override_reason: reason ?? null,
            previous_agent_value: prev
              ? (prev as Record<string, unknown>).value_numeric ?? (prev as Record<string, unknown>).value_text
              : null,
            overridden_by: req.user!.userId,
            overridden_at: new Date().toISOString(),
          }),
        ]
      );

      // Audit log entry
      await query(
        `INSERT INTO audit_log
           (actor_id, actor_type, action, resource_type, resource_id, metadata)
         VALUES ($1, 'user', 'assumption.override', 'deal', $2, $3)`,
        [
          req.user!.userId,
          dealId,
          JSON.stringify({
            field_path: fieldPath,
            new_value: value,
            previous_value: prev
              ? (prev as Record<string, unknown>).value_numeric ?? (prev as Record<string, unknown>).value_text
              : null,
            reason: reason ?? null,
          }),
        ]
      );

      res.json({
        success: true,
        deal_id: dealId,
        field_path: fieldPath,
        value,
        source: 'override',
        overridden_at: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ── POST /api/v1/deals/:dealId/underwriting/walkthrough ───────────
dealUnderwritingRouter.post(
  '/:dealId/underwriting/walkthrough',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;
      if (!UUID_RE.test(dealId)) throw new AppError(400, 'Invalid deal ID');

      await assertDealAccess(dealId, req.user!.userId);

      const { focus } = req.body;
      const eventId = crypto.randomUUID();
      const generatedAt = new Date().toISOString();

      // Log the request in audit_log
      await query(
        `INSERT INTO audit_log
           (actor_id, actor_type, action, resource_type, resource_id, metadata)
         VALUES ($1, 'user', 'cashflow.walkthrough_requested', 'deal', $2, $3)`,
        [
          req.user!.userId,
          dealId,
          JSON.stringify({
            event_id: eventId,
            focus: focus ?? null,
            trigger_reason: 'user_requested',
            requested_at: generatedAt,
          }),
        ]
      );

      // Check for existing walkthrough narrative in audit_log
      const existingResult = await query(
        `SELECT metadata FROM audit_log
         WHERE resource_type = 'deal' AND resource_id = $1
           AND action = 'cashflow.walkthrough_completed'
         ORDER BY created_at DESC LIMIT 1`,
        [dealId]
      );

      const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
      const narrative = existing?.metadata
        ? (existing.metadata as Record<string, unknown>).narrative ?? null
        : null;

      res.json({
        success: true,
        event_id: eventId,
        deal_id: dealId,
        narrative,
        generated_at: generatedAt,
        status: narrative ? 'available' : 'pending',
        message: narrative
          ? 'Walkthrough narrative is available.'
          : 'Walkthrough narrative generation requested. Check back in a few moments.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ── GET /api/v1/deals/:dealId/underwriting/evidence-summary ──────
/**
 * Aggregates evidence distribution, collision summary, and confidence
 * breakdown for the frontend's F9 EvidencePanel overview header.
 *
 * Returns:
 *   - collision_summary: {total, severe, material, minor, fields_with_collision}
 *   - confidence_distribution: {high, medium, low}
 *   - tier_distribution: {tier1, tier2, tier3, tier4}
 *   - field_count: total distinct underwritten fields
 *   - latest_run_at: timestamp of the most recent evidence row
 *   - snapshot_id: latest snapshot ID for this deal
 */
dealUnderwritingRouter.get(
  '/:dealId/underwriting/evidence-summary',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;
      if (!UUID_RE.test(dealId)) throw new AppError(400, 'Invalid deal ID');

      await assertDealAccess(dealId, req.user!.userId);

      // Aggregate evidence rows for this deal (latest row per field_path)
      const evidenceResult = await query(
        `WITH latest_evidence AS (
           SELECT DISTINCT ON (field_path)
             field_path, primary_tier, confidence, collision, created_at
           FROM underwriting_evidence
           WHERE deal_id = $1
           ORDER BY field_path, created_at DESC
         )
         SELECT
           COUNT(*) AS field_count,
           MAX(created_at) AS latest_run_at,
           SUM(CASE WHEN confidence = 'high'   THEN 1 ELSE 0 END) AS high_confidence,
           SUM(CASE WHEN confidence = 'medium' THEN 1 ELSE 0 END) AS medium_confidence,
           SUM(CASE WHEN confidence = 'low'    THEN 1 ELSE 0 END) AS low_confidence,
           SUM(CASE WHEN primary_tier = 1 THEN 1 ELSE 0 END) AS tier1,
           SUM(CASE WHEN primary_tier = 2 THEN 1 ELSE 0 END) AS tier2,
           SUM(CASE WHEN primary_tier = 3 THEN 1 ELSE 0 END) AS tier3,
           SUM(CASE WHEN primary_tier = 4 THEN 1 ELSE 0 END) AS tier4,
           SUM(CASE WHEN collision IS NOT NULL THEN 1 ELSE 0 END) AS total_collisions,
           SUM(CASE WHEN collision->>'magnitude' = 'severe'   THEN 1 ELSE 0 END) AS severe_collisions,
           SUM(CASE WHEN collision->>'magnitude' = 'material' THEN 1 ELSE 0 END) AS material_collisions,
           SUM(CASE WHEN collision->>'magnitude' = 'minor'    THEN 1 ELSE 0 END) AS minor_collisions,
           array_agg(field_path) FILTER (WHERE collision IS NOT NULL) AS collision_fields
         FROM latest_evidence`,
        [dealId]
      );

      const row = evidenceResult.rows[0] as Record<string, unknown> | undefined;

      // Latest snapshot ID
      const snapResult = await query(
        `SELECT id FROM deal_underwriting_snapshots
         WHERE deal_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [dealId]
      );
      const snapshotId = (snapResult.rows[0] as Record<string, unknown> | undefined)?.id ?? null;

      const int = (v: unknown) => parseInt(String(v ?? 0), 10);

      res.json({
        success: true,
        deal_id: dealId,
        field_count: int(row?.field_count),
        latest_run_at: row?.latest_run_at ?? null,
        snapshot_id: snapshotId,
        collision_summary: {
          total_collisions: int(row?.total_collisions),
          severe: int(row?.severe_collisions),
          material: int(row?.material_collisions),
          minor: int(row?.minor_collisions),
          fields_with_collision: (row?.collision_fields as string[] | null) ?? [],
        },
        confidence_distribution: {
          high: int(row?.high_confidence),
          medium: int(row?.medium_confidence),
          low: int(row?.low_confidence),
        },
        tier_distribution: {
          tier1: int(row?.tier1),
          tier2: int(row?.tier2),
          tier3: int(row?.tier3),
          tier4: int(row?.tier4),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
