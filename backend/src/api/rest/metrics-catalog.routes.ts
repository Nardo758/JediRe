/**
 * Metrics Catalog API Routes
 * Endpoints for strategy building metric discovery and historical data retrieval
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getPool } from '../../database/connection';
import {
  METRICS_CATALOG,
  getMetricById,
  getMetricsByCategory,
  getCategoriesWithCounts,
  MetricGranularity,
} from '../../services/metricsCatalog.service';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /metrics/catalog
 * Returns the full metrics catalog (all 40+ metrics with definitions)
 */
router.get('/catalog', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      count: METRICS_CATALOG.length,
      metrics: METRICS_CATALOG,
    });
  } catch (error) {
    logger.error('Error fetching metrics catalog:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics catalog',
    });
  }
});

/**
 * GET /metrics/categories
 * Returns list of all categories with metric counts
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = getCategoriesWithCounts();
    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    });
  }
});

/**
 * GET /metrics/:metricId
 * Returns a single metric definition by ID
 */
router.get('/:metricId', async (req: Request, res: Response) => {
  try {
    const { metricId } = req.params;
    const metric = getMetricById(metricId);

    if (!metric) {
      return res.status(404).json({
        success: false,
        error: `Metric ${metricId} not found`,
      });
    }

    res.json({
      success: true,
      metric,
    });
  } catch (error) {
    logger.error('Error fetching metric:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metric',
    });
  }
});

/**
 * GET /metrics/:metricId/values
 * Query metric_time_series for latest values
 * Required query params: ?geography_type=zip&geography_id=33156
 * Optional: ?limit=100
 */
router.get('/:metricId/values', async (req: Request, res: Response) => {
  try {
    const { metricId } = req.params;
    const { geography_type, geography_id, limit = 100 } = req.query;

    // Validate metric exists
    const metric = getMetricById(metricId as string);
    if (!metric) {
      return res.status(404).json({
        success: false,
        error: `Metric ${metricId} not found`,
      });
    }

    // Validate required query params
    if (!geography_type || !geography_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query params: geography_type and geography_id',
      });
    }

    const pool = getPool();
    const query = `
      SELECT
        metric_id,
        geography_type,
        geography_id,
        geography_name,
        period_date,
        period_type,
        value,
        source,
        confidence,
        created_at
      FROM metric_time_series
      WHERE metric_id = $1
        AND geography_type = $2
        AND geography_id = $3
      ORDER BY period_date DESC
      LIMIT $4
    `;

    const result = await pool.query(query, [
      metricId,
      geography_type,
      geography_id,
      limit,
    ]);

    res.json({
      success: true,
      metric: metricId,
      geography_type,
      geography_id,
      count: result.rows.length,
      values: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching metric values:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metric values',
    });
  }
});

/**
 * GET /metrics/:metricId/history
 * Query metric_time_series for full time series
 * Required query params: ?geography_type=msa&geography_id=33124
 * Optional: ?start_date=2020-01-01&end_date=2025-12-31
 */
router.get('/:metricId/history', async (req: Request, res: Response) => {
  try {
    const { metricId } = req.params;
    const { geography_type, geography_id, start_date, end_date } = req.query;

    // Validate metric exists
    const metric = getMetricById(metricId as string);
    if (!metric) {
      return res.status(404).json({
        success: false,
        error: `Metric ${metricId} not found`,
      });
    }

    // Validate required query params
    if (!geography_type || !geography_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query params: geography_type and geography_id',
      });
    }

    const pool = getPool();

    // Build query with optional date range
    let query = `
      SELECT
        metric_id,
        geography_type,
        geography_id,
        geography_name,
        period_date,
        period_type,
        value,
        source,
        confidence
      FROM metric_time_series
      WHERE metric_id = $1
        AND geography_type = $2
        AND geography_id = $3
    `;

    const params: any[] = [metricId, geography_type, geography_id];

    if (start_date) {
      query += ` AND period_date >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND period_date <= $${params.length + 1}`;
      params.push(end_date);
    }

    query += ` ORDER BY period_date ASC`;

    const result = await pool.query(query, params);

    // Calculate trend statistics
    const values = result.rows.map((r) => r.value);
    const latest = values[values.length - 1];
    const earliest = values[0];
    const change =
      earliest !== undefined && latest !== undefined
        ? ((latest - earliest) / earliest) * 100
        : null;

    res.json({
      success: true,
      metric: metricId,
      geography_type,
      geography_id,
      count: result.rows.length,
      statistics: {
        latest,
        earliest,
        change_pct: change,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
      },
      history: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching metric history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metric history',
    });
  }
});

/**
 * GET /api/v1/metrics/fred-rates
 * Get FRED rate data (SOFR, 10Y Treasury)
 * Query params: days (default 365), metrics (default 'RATE_SOFR,RATE_TREASURY_10Y')
 */
router.get('/fred-rates', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 365;
    const metricsParam = (req.query.metrics as string) || 'RATE_SOFR,RATE_TREASURY_10Y';
    const metrics = metricsParam.split(',');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await pool.query(
      `SELECT
        metric_id,
        period_date,
        value,
        computed_at
      FROM metric_time_series
      WHERE metric_id = ANY($1)
      AND geography_type = 'national'
      AND period_date >= $2
      ORDER BY period_date ASC`,
      [metrics, startDate.toISOString()]
    );

    const grouped: Record<string, Array<{ date: string; value: number }>> = {};
    result.rows.forEach((row: any) => {
      if (!grouped[row.metric_id]) grouped[row.metric_id] = [];
      grouped[row.metric_id].push({
        date: row.period_date,
        value: parseFloat(row.value),
      });
    });

    res.json({
      success: true,
      data: grouped,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Error fetching FRED rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FRED rates',
    });
  }
});

export default router;
