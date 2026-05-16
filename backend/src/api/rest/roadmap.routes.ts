/**
 * Roadmap Mode REST Routes
 *
 * POST  /api/v1/deals/:dealId/roadmap        Generate a new roadmap
 * GET   /api/v1/deals/:dealId/roadmap/latest  Fetch the most recent roadmap
 * GET   /api/v1/deals/:dealId/roadmap/:id     Fetch a specific roadmap by ID
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { generateRoadmap } from '../../services/roadmap/roadmap-engine';
import type { RoadmapInput } from '../../types/roadmap';
import { logger } from '../../utils/logger';

export const roadmapRouter = Router({ mergeParams: true });

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

// ── POST /api/v1/deals/:dealId/roadmap ────────────────────────────────────────
roadmapRouter.post(
  '/:dealId/roadmap',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;
      if (!UUID_RE.test(dealId)) throw new AppError(400, 'Invalid deal ID');

      await assertDealAccess(dealId, req.user!.userId);

      const { target_return, constraints, sponsor_capabilities } = req.body;

      if (!target_return?.metric || target_return?.value == null || !target_return?.hold_years) {
        throw new AppError(400, 'target_return.metric, target_return.value, and target_return.hold_years are required');
      }

      const validMetrics = ['irr', 'equity_multiple', 'noi_growth_3yr', 'cash_on_cash_y3'];
      if (!validMetrics.includes(target_return.metric)) {
        throw new AppError(400, `target_return.metric must be one of: ${validMetrics.join(', ')}`);
      }

      if (target_return.hold_years < 1 || target_return.hold_years > 30) {
        throw new AppError(400, 'target_return.hold_years must be between 1 and 30');
      }

      const input: RoadmapInput = {
        deal_id: dealId,
        target_return: {
          metric: target_return.metric,
          value: Number(target_return.value),
          hold_years: Number(target_return.hold_years),
        },
        constraints: constraints ?? undefined,
        sponsor_capabilities: sponsor_capabilities ?? undefined,
      };

      // Create a pending roadmap row — persist full input_json alongside decomposed fields
      const insertResult = await query(
        `INSERT INTO deal_roadmaps
           (deal_id, created_by, target_return_metric, target_return_value, hold_years,
            input_json, constraints_json, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'running')
         RETURNING id`,
        [
          dealId,
          req.user!.userId,
          input.target_return.metric,
          input.target_return.value,
          input.target_return.hold_years,
          JSON.stringify(input),
          constraints ? JSON.stringify(constraints) : null,
        ]
      );

      const roadmapId = (insertResult.rows[0] as Record<string, unknown>).id as string;

      // Run synchronously for v1 (roadmap generation is fast — <1s deterministic computation)
      let output;
      try {
        output = await generateRoadmap(input);

        await query(
          `UPDATE deal_roadmaps
           SET status = 'succeeded', output_json = $1, updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(output), roadmapId]
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await query(
          `UPDATE deal_roadmaps
           SET status = 'failed', error = $1, updated_at = NOW()
           WHERE id = $2`,
          [message, roadmapId]
        );
        logger.error('[roadmap-routes] Generation failed', { roadmapId, err });

        // Validation errors from loadDealFinancials — surface as 422 (not 500).
        // ROADMAP_NO_SNAPSHOT / ROADMAP_MISSING_NOI: kept for legacy log parsing.
        // ROADMAP_NO_BASELINE: new code when neither snapshot nor purchase_price exists.
        const isValidationError =
          message.startsWith('ROADMAP_NO_SNAPSHOT') ||
          message.startsWith('ROADMAP_INVALID_SNAPSHOT') ||
          message.startsWith('ROADMAP_MISSING_NOI') ||
          message.startsWith('ROADMAP_NO_BASELINE');

        throw new AppError(
          isValidationError ? 422 : 500,
          isValidationError
            ? message
            : `Roadmap generation failed: ${message}`
        );
      }

      // Return RoadmapOutput directly, augmented with persistence metadata.
      // Top-level fields follow the RoadmapOutput contract; roadmap_id/deal_id
      // are additive metadata the client can use for polling/reference.
      res.status(201).json({
        roadmap_id: roadmapId,
        deal_id: dealId,
        ...output,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ── GET /api/v1/deals/:dealId/roadmap/latest ──────────────────────────────────
roadmapRouter.get(
  '/:dealId/roadmap/latest',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;
      if (!UUID_RE.test(dealId)) throw new AppError(400, 'Invalid deal ID');

      await assertDealAccess(dealId, req.user!.userId);

      const result = await query(
        `SELECT id, deal_id, created_by, target_return_metric, target_return_value,
                hold_years, constraints_json, output_json, status, error, created_at, updated_at
         FROM deal_roadmaps
         WHERE deal_id = $1 AND status = 'succeeded'
         ORDER BY created_at DESC
         LIMIT 1`,
        [dealId]
      );

      if (result.rows.length === 0) {
        res.json({ success: true, roadmap: null, deal_id: dealId });
        return;
      }

      const row = result.rows[0] as Record<string, unknown>;
      res.json({
        success: true,
        roadmap_id: row.id,
        deal_id: row.deal_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        output: row.output_json,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ── GET /api/v1/deals/:dealId/roadmap/:roadmapId ──────────────────────────────
roadmapRouter.get(
  '/:dealId/roadmap/:roadmapId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId, roadmapId } = req.params;
      if (!UUID_RE.test(dealId)) throw new AppError(400, 'Invalid deal ID');
      if (!UUID_RE.test(roadmapId)) throw new AppError(400, 'Invalid roadmap ID');

      await assertDealAccess(dealId, req.user!.userId);

      const result = await query(
        `SELECT id, deal_id, created_by, target_return_metric, target_return_value,
                hold_years, constraints_json, output_json, status, error, created_at, updated_at
         FROM deal_roadmaps
         WHERE id = $1 AND deal_id = $2`,
        [roadmapId, dealId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, `Roadmap ${roadmapId} not found`);
      }

      const row = result.rows[0] as Record<string, unknown>;
      res.json({
        success: true,
        roadmap_id: row.id,
        deal_id: row.deal_id,
        status: row.status,
        error: row.error,
        created_at: row.created_at,
        updated_at: row.updated_at,
        output: row.output_json,
      });
    } catch (error) {
      next(error);
    }
  }
);
