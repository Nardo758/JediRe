import { Router, Request, Response } from 'express';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT
        metric_id,
        geography_type,
        geography_id,
        geography_name,
        source,
        period_type,
        COUNT(*) as data_points,
        MIN(period_date)::text as earliest_date,
        MAX(period_date)::text as latest_date,
        MIN(value) as min_value,
        MAX(value) as max_value,
        AVG(value) as avg_value
      FROM metric_time_series
      GROUP BY metric_id, geography_type, geography_id, geography_name, source, period_type
      ORDER BY metric_id, geography_id
    `);
    res.json({ success: true, metrics: result.rows });
  } catch (error) {
    logger.error('Time series metrics list error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/data', async (req: Request, res: Response) => {
  try {
    const { metric_id, geography_id, start_date, end_date, limit: limitParam } = req.query;

    if (!metric_id) {
      return res.status(400).json({ success: false, error: 'metric_id is required' });
    }

    let sql = `
      SELECT
        metric_id,
        geography_type,
        geography_id,
        geography_name,
        period_date::text as period_date,
        period_type,
        value,
        source,
        confidence
      FROM metric_time_series
      WHERE metric_id = $1
    `;
    const params: any[] = [metric_id];
    let paramIdx = 2;

    if (geography_id) {
      sql += ` AND geography_id = $${paramIdx}`;
      params.push(geography_id);
      paramIdx++;
    }

    if (start_date) {
      sql += ` AND period_date >= $${paramIdx}`;
      params.push(start_date);
      paramIdx++;
    }

    if (end_date) {
      sql += ` AND period_date <= $${paramIdx}`;
      params.push(end_date);
      paramIdx++;
    }

    sql += ` ORDER BY period_date ASC`;

    const rowLimit = Math.min(parseInt(String(limitParam || '5000'), 10), 10000);
    sql += ` LIMIT $${paramIdx}`;
    params.push(rowLimit);

    const result = await query(sql, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    logger.error('Time series data error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT
        source,
        COUNT(DISTINCT metric_id) as metric_count,
        COUNT(DISTINCT geography_id) as geo_count,
        COUNT(*) as total_points,
        MIN(period_date)::text as earliest,
        MAX(period_date)::text as latest,
        MAX(created_at)::text as last_ingested
      FROM metric_time_series
      GROUP BY source
      ORDER BY source
    `);
    const totals = await query(`
      SELECT
        COUNT(DISTINCT metric_id) as total_metrics,
        COUNT(DISTINCT geography_id) as total_geos,
        COUNT(*) as total_points
      FROM metric_time_series
    `);
    res.json({ success: true, sources: result.rows, totals: totals.rows[0] });
  } catch (error) {
    logger.error('Time series summary error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/geographies', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT DISTINCT
        geography_type,
        geography_id,
        geography_name,
        COUNT(DISTINCT metric_id) as metric_count,
        COUNT(*) as data_points
      FROM metric_time_series
      GROUP BY geography_type, geography_id, geography_name
      ORDER BY geography_type, geography_name
    `);
    res.json({ success: true, geographies: result.rows });
  } catch (error) {
    logger.error('Time series geographies error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
