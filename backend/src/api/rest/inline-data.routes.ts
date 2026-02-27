import { Router } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();
const pool = getPool();

router.get('/supply/:market', async (req, res) => {
  try {
    const { market } = req.params;
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

router.get('/markets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (market) 
        market, timestamp, total_inventory, months_of_supply, score, interpretation
      FROM supply_metrics
      ORDER BY market, timestamp DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/properties', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const city = req.query.city as string;
    let query = 'SELECT * FROM properties';
    const params: any[] = [];
    if (city) {
      query += ' WHERE city ILIKE $1';
      params.push(`%${city}%`);
    }
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/alerts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const client = req.dbClient || pool;
    const result = await client.query(
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
