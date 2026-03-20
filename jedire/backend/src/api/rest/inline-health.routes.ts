import { Router } from 'express';
import { getPool } from '../../database/connection';

const router = Router();
const pool = getPool();

router.get('/', async (req, res) => {
  let databaseStatus = 'unknown';
  try {
    await pool.query('SELECT 1');
    databaseStatus = 'connected';
  } catch { databaseStatus = 'disconnected'; }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: databaseStatus,
    uptime: process.uptime(),
  });
});

router.get('/db', async (req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query('SELECT NOW() as time, version() as version');
    const latency = Date.now() - start;
    res.status(200).json({
      connected: true,
      latency,
      timestamp: result.rows[0].time,
      version: result.rows[0].version,
    });
  } catch (error: any) {
    res.status(503).json({
      connected: false,
      error: error.message,
    });
  }
});

export default router;
