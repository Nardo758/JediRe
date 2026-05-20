/**
 * Task #920 — Workspace composability (Mode 4, Gap 6)
 *
 * CRUD endpoints for user_workspaces:
 *   GET    /api/v1/workspaces          list workspaces for current user
 *   POST   /api/v1/workspaces          create new workspace
 *   GET    /api/v1/workspaces/:id      get single workspace (layout included)
 *   PATCH  /api/v1/workspaces/:id      update name and/or layout (drag/resize/pin)
 *   DELETE /api/v1/workspaces/:id      delete workspace
 */

import { Router, Response } from 'express';
import { pool } from '../../database';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

// All workspace routes require authentication
router.use(requireAuth);

// ── List workspaces for authenticated user ──────────────────────────────────
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { rows } = await pool.query(
      `SELECT id, name, layout,
              jsonb_array_length(layout) AS panel_count,
              created_at, updated_at
       FROM user_workspaces
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err: any) {
    console.error('[workspace] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Create workspace ────────────────────────────────────────────────────────
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const name   = (req.body?.name as string | undefined)?.trim() || 'My Workspace';
    const layout = Array.isArray(req.body?.layout) ? req.body.layout : [];

    const { rows } = await pool.query(
      `INSERT INTO user_workspaces (user_id, name, layout)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, name, layout, created_at, updated_at`,
      [userId, name, JSON.stringify(layout)]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    console.error('[workspace] create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Get single workspace ────────────────────────────────────────────────────
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id }  = req.params;
    const { rows } = await pool.query(
      `SELECT id, name, layout, created_at, updated_at
       FROM user_workspaces
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    console.error('[workspace] get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Update workspace (layout drag/resize/pin, name) ────────────────────────
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId  = req.user!.userId;
    const { id }  = req.params;
    const { name, layout } = req.body ?? {};

    // Verify ownership
    const own = await pool.query(
      `SELECT id FROM user_workspaces WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (own.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }

    const sets: string[] = ['updated_at = NOW()'];
    const params: any[]  = [];
    let p = 1;

    if (typeof name === 'string' && name.trim()) {
      sets.push(`name = $${p++}`);
      params.push(name.trim());
    }
    if (Array.isArray(layout)) {
      sets.push(`layout = $${p++}::jsonb`);
      params.push(JSON.stringify(layout));
    }
    params.push(id);

    const { rows } = await pool.query(
      `UPDATE user_workspaces SET ${sets.join(', ')}
       WHERE id = $${p}
       RETURNING id, name, layout, created_at, updated_at`,
      params
    );
    res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    console.error('[workspace] patch error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Delete workspace ────────────────────────────────────────────────────────
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id }  = req.params;
    const { rowCount } = await pool.query(
      `DELETE FROM user_workspaces WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (!rowCount) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[workspace] delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
