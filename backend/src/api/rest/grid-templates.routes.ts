import { Router, Response } from 'express';
import { getPool } from '../../database/connection';
import { AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

function getUserId(req: AuthenticatedRequest): string | null {
  return req.user?.userId || null;
}

interface GridTemplateRow {
  id: string;
  user_id: string;
  name: string;
  view_id: string;
  columns: string[];
  column_config: Record<string, unknown>;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const viewId = req.query.viewId as string;
    const userId = getUserId(req);

    if (!userId) {
      return res.json({ success: true, templates: [] });
    }

    let query = `SELECT * FROM grid_templates WHERE (user_id = $1 OR is_shared = TRUE)`;
    const params: string[] = [userId];

    if (viewId) {
      query += ` AND view_id = $2`;
      params.push(viewId);
    }
    query += ` ORDER BY updated_at DESC`;

    const result = await pool.query<GridTemplateRow>(query, params);
    res.json({ success: true, templates: result.rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { name, viewId, columns, columnConfig } = req.body;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!name || !viewId || !columns) {
      return res.status(400).json({ success: false, error: 'name, viewId, and columns are required' });
    }

    const result = await pool.query<GridTemplateRow>(
      `INSERT INTO grid_templates (user_id, name, view_id, columns, column_config)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, name, viewId, JSON.stringify(columns), JSON.stringify(columnConfig || {})]
    );
    res.json({ success: true, template: result.rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { name, columns, columnConfig } = req.body;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const sets: string[] = ['updated_at = NOW()'];
    const params: string[] = [];
    let idx = 1;

    if (name) { sets.push(`name = $${idx}`); params.push(name); idx++; }
    if (columns) { sets.push(`columns = $${idx}`); params.push(JSON.stringify(columns)); idx++; }
    if (columnConfig) { sets.push(`column_config = $${idx}`); params.push(JSON.stringify(columnConfig)); idx++; }

    params.push(id);
    params.push(userId);
    const result = await pool.query<GridTemplateRow>(
      `UPDATE grid_templates SET ${sets.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found or not owned by you' });
    }
    res.json({ success: true, template: result.rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await pool.query(
      'DELETE FROM grid_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found or not owned by you' });
    }
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
