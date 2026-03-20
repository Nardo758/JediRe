/**
 * M08 Strategy Arbitrage Routes
 * GET  /api/v1/strategies              — list strategies (system + org)
 * GET  /api/v1/strategies/templates    — list system templates only
 * POST /api/v1/strategies              — create custom strategy
 * GET  /api/v1/strategies/:id         — get single strategy
 * PUT  /api/v1/strategies/:id         — update strategy
 * DELETE /api/v1/strategies/:id       — soft-delete strategy
 * POST /api/v1/strategies/:id/clone   — clone a strategy
 * PUT  /api/v1/strategies/reorder     — reorder strategies
 * POST /api/v1/strategies/score-deal/:dealId — score deal (backward compat)
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query, getPool } from '../../database/connection';
import { scoreAndPersist, detectArbitrage, calculateStrategyScore, ScoreContext } from '../../services/strategyArbitrage.service';
import { logger } from '../../utils/logger';

const router = Router();

function validateWeights(weights: Record<string, number>): boolean {
  const positiveSum = Object.values(weights)
    .filter(v => v > 0)
    .reduce((a, b) => a + b, 0);
  return Math.abs(positiveSum - 1.0) < 0.01;
}

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights);
  const positiveSum = entries.filter(([, v]) => v > 0).reduce((a, [, v]) => a + v, 0);
  if (positiveSum === 0) return weights;
  const normalized: Record<string, number> = {};
  for (const [k, v] of entries) {
    normalized[k] = v > 0 ? parseFloat((v / positiveSum).toFixed(4)) : v;
  }
  return normalized;
}

async function getUserOrgId(userId: string): Promise<string | null> {
  try {
    const result = await query(
      `SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows[0]?.org_id ?? null;
  } catch {
    return null;
  }
}

router.get('/templates', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM strategies WHERE is_system_template = true AND is_active = true ORDER BY sort_order`,
      []
    );
    res.json({ success: true, templates: result.rows });
  } catch (error: any) {
    logger.error('[M08] Error fetching templates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

router.get('/reorder', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  res.status(405).json({ success: false, error: 'Use PUT /reorder' });
});

router.put('/reorder', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ success: false, error: 'order must be array of ids' });
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);
    // Only allow reordering non-system-template strategies visible to this caller
    for (let i = 0; i < order.length; i++) {
      await query(
        `UPDATE strategies SET sort_order = $1, updated_at = NOW()
         WHERE id = $2
           AND is_system_template = false
           AND (created_by = $3 OR ($4::uuid IS NOT NULL AND org_id = $4))`,
        [i, order[i], userId, orgId]
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[M08] Error reordering:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder' });
  }
});

router.post('/score-deal/:dealId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);
    // Verify deal access
    const dealCheck = await query(
      `SELECT id FROM deals WHERE id = $1 AND (user_id = $2 OR ($3::uuid IS NOT NULL AND org_id = $3))`,
      [dealId, userId, orgId]
    );
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    const ctx = { userId, orgId };
    const scores = await scoreAndPersist(dealId, ctx);
    const arbitrage = detectArbitrage(scores);
    res.json({ success: true, data: scores, arbitrage });
  } catch (error: any) {
    logger.error('[M08] Error scoring deal:', error);
    res.status(500).json({ success: false, error: 'Failed to score deal' });
  }
});

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);
    const result = await query(
      `SELECT * FROM strategies
       WHERE is_active = true
         AND (is_system_template = true OR created_by = $1 OR ($2::uuid IS NOT NULL AND org_id = $2))
       ORDER BY is_system_template DESC, sort_order`,
      [userId, orgId]
    );
    res.json({ success: true, strategies: result.rows });
  } catch (error: any) {
    logger.error('[M08] Error listing strategies:', error);
    res.status(500).json({ success: false, error: 'Failed to list strategies' });
  }
});

router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, description, signal_weights, property_gates, risk_gates, execution_profile } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    const weights = signal_weights || {};
    if (Object.keys(weights).length > 0 && !validateWeights(weights)) {
      return res.status(400).json({ success: false, error: 'signal_weights positive values must sum to 1.0 (±0.01)' });
    }

    const orgId = await getUserOrgId(userId);
    const result = await query(
      `INSERT INTO strategies (name, description, signal_weights, property_gates, risk_gates, execution_profile, is_system_template, sort_order, created_by, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, false, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM strategies), $7, $8)
       RETURNING *`,
      [
        name, description || null,
        JSON.stringify(weights),
        JSON.stringify(property_gates || []),
        JSON.stringify(risk_gates || []),
        JSON.stringify(execution_profile || {}),
        userId, orgId,
      ]
    );
    res.status(201).json({ success: true, strategy: result.rows[0] });
  } catch (error: any) {
    logger.error('[M08] Error creating strategy:', error);
    res.status(500).json({ success: false, error: 'Failed to create strategy' });
  }
});

router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);
    const result = await query(
      `SELECT * FROM strategies
       WHERE id = $1
         AND (is_system_template = true OR created_by = $2 OR ($3::uuid IS NOT NULL AND org_id = $3))`,
      [id, userId, orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Strategy not found' });
    res.json({ success: true, strategy: result.rows[0] });
  } catch (error: any) {
    logger.error('[M08] Error fetching strategy:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch strategy' });
  }
});

router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);
    const existing = await query(
      `SELECT * FROM strategies WHERE id = $1 AND (is_system_template = true OR created_by = $2 OR ($3::uuid IS NOT NULL AND org_id = $3))`,
      [id, userId, orgId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ success: false, error: 'Strategy not found' });
    if (existing.rows[0].is_system_template) {
      return res.status(403).json({ success: false, error: 'Cannot modify system templates' });
    }

    const { name, description, signal_weights, property_gates, risk_gates, execution_profile } = req.body;
    if (signal_weights && !validateWeights(signal_weights)) {
      return res.status(400).json({ success: false, error: 'signal_weights positive values must sum to 1.0 (±0.01)' });
    }

    const result = await query(
      `UPDATE strategies SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        signal_weights = COALESCE($3::jsonb, signal_weights),
        property_gates = COALESCE($4::jsonb, property_gates),
        risk_gates = COALESCE($5::jsonb, risk_gates),
        execution_profile = COALESCE($6::jsonb, execution_profile),
        version = version + 1,
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        name || null, description || null,
        signal_weights ? JSON.stringify(signal_weights) : null,
        property_gates ? JSON.stringify(property_gates) : null,
        risk_gates ? JSON.stringify(risk_gates) : null,
        execution_profile ? JSON.stringify(execution_profile) : null,
        id,
      ]
    );
    res.json({ success: true, strategy: result.rows[0] });
  } catch (error: any) {
    logger.error('[M08] Error updating strategy:', error);
    res.status(500).json({ success: false, error: 'Failed to update strategy' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);
    const existing = await query(
      `SELECT * FROM strategies WHERE id = $1 AND (is_system_template = true OR created_by = $2 OR ($3::uuid IS NOT NULL AND org_id = $3))`,
      [id, userId, orgId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ success: false, error: 'Strategy not found' });
    if (existing.rows[0].is_system_template) {
      return res.status(403).json({ success: false, error: 'Cannot delete system templates' });
    }
    await query(`UPDATE strategies SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[M08] Error deleting strategy:', error);
    res.status(500).json({ success: false, error: 'Failed to delete strategy' });
  }
});

router.post('/:id/clone', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);
    const source = await query(
      `SELECT * FROM strategies WHERE id = $1 AND (is_system_template = true OR created_by = $2 OR ($3::uuid IS NOT NULL AND org_id = $3))`,
      [id, userId, orgId]
    );
    if (source.rows.length === 0) return res.status(404).json({ success: false, error: 'Strategy not found' });
    const s = source.rows[0];

    const normalizedWeights = normalizeWeights(s.signal_weights || {});
    const result = await query(
      `INSERT INTO strategies (name, description, signal_weights, property_gates, risk_gates, execution_profile, is_system_template, sort_order, created_by, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, false, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM strategies), $7, $8)
       RETURNING *`,
      [
        `${s.name} (Copy)`, s.description,
        JSON.stringify(normalizedWeights),
        JSON.stringify(s.property_gates || []),
        JSON.stringify(s.risk_gates || []),
        JSON.stringify(s.execution_profile || {}),
        userId, orgId,
      ]
    );
    res.status(201).json({ success: true, strategy: result.rows[0] });
  } catch (error: any) {
    logger.error('[M08] Error cloning strategy:', error);
    res.status(500).json({ success: false, error: 'Failed to clone strategy' });
  }
});

export default router;
