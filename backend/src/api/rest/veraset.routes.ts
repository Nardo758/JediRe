/**
 * Veraset Admin Routes — Subscription management & status
 *
 * GET  /api/v1/veraset/status        — list all subscriptions with status
 * POST /api/v1/veraset/:msaId/activate   — activate subscription (admin only)
 * POST /api/v1/veraset/:msaId/deactivate — deactivate subscription (admin only)
 * POST /api/v1/veraset/:msaId/backfill  — trigger a backfill job (admin only)
 *
 * All routes require admin role. The ingest endpoint is handled by the
 * Inngest cron (veraset-nightly.ts) which reads from veraset_subscriptions.
 *
 * @see backend/src/services/veraset-mobility.service.ts
 */

import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { verasetMobilityService } from '../../services/veraset-mobility.service';
import { logger } from '../../utils/logger';
import { query } from '../../database/connection';

const router = Router();

// All routes require admin role
router.use(requireAuth, requireRole('admin'));

// ─── GET /api/v1/veraset/status ──────────────────────────────────────────────

router.get('/status', async (_req: AuthenticatedRequest, res) => {
  try {
    const result = await query('SELECT * FROM veraset_subscriptions ORDER BY msa_id');
    const subscriptions = result.rows.map((row) => ({
      id: row.id,
      msaId: row.msa_id,
      msaName: row.msa_name,
      isActive: row.is_active,
      subscriptionTier: row.subscription_tier,
      monthlyQuota: row.monthly_quota,
      quotaUsedThisMonth: row.quota_used_this_month,
      quotaResetsAt: row.quota_resets_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json({ subscriptions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[Veraset Admin] status failed', { error: msg });
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/v1/veraset/:msaId/activate ───────────────────────────────────

router.post('/:msaId/activate', async (req: AuthenticatedRequest, res) => {
  try {
    const { msaId } = req.params;
    const { tier, quota, apiEndpoint } = req.body;

    const result = await query(
      `INSERT INTO veraset_subscriptions (msa_id, is_active, subscription_tier, monthly_quota, api_endpoint, updated_at)
       VALUES ($1, TRUE, $2, $3, $4, NOW())
       ON CONFLICT (msa_id) DO UPDATE SET
         is_active = TRUE,
         subscription_tier = COALESCE(EXCLUDED.subscription_tier, veraset_subscriptions.subscription_tier),
         monthly_quota = COALESCE(EXCLUDED.monthly_quota, veraset_subscriptions.monthly_quota),
         api_endpoint = COALESCE(EXCLUDED.api_endpoint, veraset_subscriptions.api_endpoint),
         updated_at = NOW()
       RETURNING *`,
      [msaId, tier || 'basic', quota || null, apiEndpoint || null],
    );

    const row = result.rows[0];
    logger.info('[Veraset Admin] subscription activated', { msaId, by: req.user?.userId });

    res.json({
      success: true,
      subscription: {
        msaId: row.msa_id,
        msaName: row.msa_name,
        isActive: row.is_active,
        tier: row.subscription_tier,
        quota: row.monthly_quota,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[Veraset Admin] activate failed', { error: msg });
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/v1/veraset/:msaId/deactivate ─────────────────────────────────

router.post('/:msaId/deactivate', async (req: AuthenticatedRequest, res) => {
  try {
    const { msaId } = req.params;

    const result = await query(
      `UPDATE veraset_subscriptions
       SET is_active = FALSE, updated_at = NOW()
       WHERE msa_id = $1
       RETURNING *`,
      [msaId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Subscription not found for this MSA' });
      return;
    }

    logger.info('[Veraset Admin] subscription deactivated', { msaId, by: req.user?.userId });
    res.json({ success: true, msaId, isActive: false });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[Veraset Admin] deactivate failed', { error: msg });
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/v1/veraset/:msaId/backfill ───────────────────────────────────

router.post('/:msaId/backfill', async (req: AuthenticatedRequest, res) => {
  try {
    const { msaId } = req.params;
    const { months } = req.body;

    const result = await verasetMobilityService.runBackfill(msaId, months || 24);
    res.json({ success: result.status === 'completed', ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[Veraset Admin] backfill failed', { error: msg });
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/v1/veraset/:msaId/jobs ────────────────────────────────────────

router.get('/:msaId/jobs', async (req: AuthenticatedRequest, res) => {
  try {
    const { msaId } = req.params;
    const { limit = 20 } = req.query;

    const result = await query(
      `SELECT * FROM veraset_ingest_jobs
       WHERE msa_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [msaId, Number(limit)],
    );

    res.json({
      msaId,
      jobs: result.rows.map((row) => ({
        id: row.id,
        jobType: row.job_type,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        rowsInserted: row.rows_inserted,
        rowsUpdated: row.rows_updated,
        errorMessage: row.error_message,
        metadata: row.metadata,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[Veraset Admin] jobs query failed', { error: msg });
    res.status(500).json({ error: msg });
  }
});

export default router;
