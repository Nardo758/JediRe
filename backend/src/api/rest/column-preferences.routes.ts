import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { pool } from '../../database';
import { logger } from '../../utils/logger';

const router = Router();
router.use(requireAuth);

const VALID_VIEWS = ['f4_dashboard', 'f4_browse', 'f4_submarkets', 'f4_properties', 'f4_compare'];

const DEFAULT_COLUMNS: Record<string, string[]> = {
  f4_dashboard: ['rank', 'starred', 'msa', 'props', 'units', 'jedi', 'd30', 'trend', 'rent', 'rentD', 'vac', 'absorb', 'pipeline', 'costs', 'dApt', 'popD', 'medInc', 'cap', 'cycle'],
  f4_browse: ['rank', 'starred', 'msa', 'props', 'units', 'jedi', 'd30', 'trend', 'rent', 'rentD', 'vac', 'absorb', 'pipeline', 'costs', 'dApt', 'popD', 'medInc', 'cap', 'cycle'],
  f4_submarkets: ['name', 'msa', 'jedi', 'rent', 'rentD', 'vac', 'props', 'units', 'opp', 'cap', 'cycle'],
  f4_properties: ['name', 'submarket', 'msa', 'jedi', 'units', 'rent', 'occ', 'capRate', 'vintage', 'owner'],
  f4_compare: ['rank', 'msa', 'jedi', 'd30', 'rent', 'rentD', 'vac', 'absorb', 'pipeline', 'cap', 'cycle'],
};

router.get('/:viewId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { viewId } = req.params;
    if (!VALID_VIEWS.includes(viewId)) {
      return res.status(400).json({ success: false, error: `Invalid view: ${viewId}. Valid views: ${VALID_VIEWS.join(', ')}` });
    }

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const result = await pool.query(
      'SELECT columns, column_config FROM user_column_preferences WHERE user_id = $1 AND view_id = $2',
      [userId, viewId]
    );

    const columns = result.rows.length > 0
      ? result.rows[0].columns
      : DEFAULT_COLUMNS[viewId] || [];
    const columnConfig = result.rows.length > 0 ? (result.rows[0].column_config || {}) : {};

    res.json({ success: true, viewId, columns, columnConfig, isDefault: result.rows.length === 0 });
  } catch (error) {
    logger.error('Error fetching column preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch column preferences' });
  }
});

router.put('/:viewId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { viewId } = req.params;
    if (!VALID_VIEWS.includes(viewId)) {
      return res.status(400).json({ success: false, error: `Invalid view: ${viewId}` });
    }

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const { columns, columnConfig } = req.body;
    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ success: false, error: 'columns must be a non-empty array of column IDs' });
    }

    const configJson = columnConfig && typeof columnConfig === 'object' ? JSON.stringify(columnConfig) : null;

    await pool.query(
      `INSERT INTO user_column_preferences (user_id, view_id, columns, column_config, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, view_id)
       DO UPDATE SET columns = $3, column_config = COALESCE($4, user_column_preferences.column_config), updated_at = NOW()`,
      [userId, viewId, JSON.stringify(columns), configJson]
    );

    res.json({ success: true, viewId, columns, columnConfig: columnConfig || {} });
  } catch (error) {
    logger.error('Error saving column preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to save column preferences' });
  }
});

router.delete('/:viewId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { viewId } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    if (!VALID_VIEWS.includes(viewId)) {
      return res.status(400).json({ success: false, error: `Invalid viewId. Must be one of: ${VALID_VIEWS.join(', ')}` });
    }

    await pool.query(
      'DELETE FROM user_column_preferences WHERE user_id = $1 AND view_id = $2',
      [userId, viewId]
    );

    res.json({ success: true, viewId, columns: DEFAULT_COLUMNS[viewId] || [], isDefault: true });
  } catch (error) {
    logger.error('Error resetting column preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to reset column preferences' });
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const result = await pool.query(
      'SELECT view_id, columns FROM user_column_preferences WHERE user_id = $1',
      [userId]
    );

    const prefs: Record<string, string[]> = {};
    for (const row of result.rows) {
      prefs[row.view_id] = row.columns;
    }

    for (const view of VALID_VIEWS) {
      if (!prefs[view]) prefs[view] = DEFAULT_COLUMNS[view] || [];
    }

    res.json({ success: true, preferences: prefs, defaults: DEFAULT_COLUMNS });
  } catch (error) {
    logger.error('Error fetching all column preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch column preferences' });
  }
});

export default router;
