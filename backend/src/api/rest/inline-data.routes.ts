import { Router } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();
const pool = getPool();

// These sub-paths under /supply are owned by dedicated routers (supplyExtraRouter,
// supplyRoutes) and must not be swallowed by this catch-all.
const RESERVED_SUPPLY_PATHS = new Set([
  'pipeline-timeline',
  'pipeline',
  'market-dynamics',
  'signals',
]);

router.get('/supply/:market', async (req, res, next) => {
  try {
    const { market } = req.params;
    if (RESERVED_SUPPLY_PATHS.has(market)) {
      return next();
    }
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await pool.query(
      `SELECT * FROM supply_metrics WHERE market = $1 ORDER BY timestamp DESC LIMIT $2`,
      [market, limit]
    );
    res.json({ success: true, market, data: result.rows });
  } catch (error) {
    console.error('Error fetching supply metrics:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/alerts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await pool.query(
      `SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
