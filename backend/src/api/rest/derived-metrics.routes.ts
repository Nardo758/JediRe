import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { DerivedMetricsService } from '../../services/derivedMetrics.service';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT metric_id, COUNT(*) as point_count,
              MIN(period_date)::text as earliest,
              MAX(period_date)::text as latest,
              COUNT(DISTINCT geography_id) as geo_count
       FROM metric_time_series
       WHERE source = 'derived' AND value IS NOT NULL
       GROUP BY metric_id
       ORDER BY metric_id`
    );
    res.json({
      success: true,
      derivedMetrics: result.rows,
      totalMetrics: result.rows.length,
      totalPoints: result.rows.reduce((s: number, r: any) => s + parseInt(r.point_count), 0)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/compute', requireAuth, async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const service = new DerivedMetricsService(pool);
    const startTime = Date.now();
    const result = await service.computeAll();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    res.json({
      success: true,
      computed: result.computed,
      errors: result.errors,
      elapsedSeconds: elapsed
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
