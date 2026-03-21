/**
 * Metrics Catalog API Routes
 * Endpoints for strategy building metric discovery and historical data retrieval
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { getPool } from '../../database/connection';
import { pool } from '../../database';
import {
  METRICS_CATALOG,
  getMetricById,
  getMetricsByCategory,
  getCategoriesWithCounts,
  MetricGranularity,
} from '../../services/metricsCatalog.service';
import { DotAggregatorService } from '../../services/dot-aggregator.service';
import { MetricCorrelationEngine } from '../../services/metric-correlation-engine.service';
import { MetricProjectionService } from '../../services/metric-projection.service';
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
      categories: getCategoriesWithCounts(),
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

const dotAggregator = new DotAggregatorService(pool);
const correlationEngine = new MetricCorrelationEngine(pool);
const projectionService = new MetricProjectionService(pool);

router.get('/aadt-history', async (req: Request, res: Response) => {
  try {
    const geoId = req.query.geoId as string;
    const geoType = (req.query.geoType as string) || 'msa';

    if (!geoId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query param: geoId',
      });
    }

    const result = await dotAggregator.getAADTHistory(geoId, geoType);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error fetching AADT history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AADT history',
    });
  }
});

router.get('/correlations', async (req: Request, res: Response) => {
  try {
    const metricA = req.query.metricA as string | undefined;
    const metricB = req.query.metricB as string | undefined;
    const geoType = req.query.geoType as string | undefined;
    const geoId = req.query.geoId as string | undefined;

    const results = await correlationEngine.getCorrelations(metricA, metricB, geoType, geoId);
    res.json({ success: true, count: results.length, correlations: results });
  } catch (error) {
    logger.error('Error fetching correlations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch correlations' });
  }
});

router.post('/correlations/compute', async (req: Request, res: Response) => {
  try {
    const { metricA, metricB, geoType, geoId } = req.body;
    if (!metricA || !metricB || !geoType || !geoId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: metricA, metricB, geoType, geoId',
      });
    }

    const result = await correlationEngine.computeAndUpsert(metricA, metricB, geoType, geoId);
    res.json({ success: true, correlation: result });
  } catch (error) {
    logger.error('Error computing correlation:', error);
    res.status(500).json({ success: false, error: 'Failed to compute correlation' });
  }
});

router.post('/correlations/seed', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}, async (req: Request, res: Response) => {
  try {
    const result = await correlationEngine.seedCorePairs();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error seeding correlations:', error);
    res.status(500).json({ success: false, error: 'Failed to seed correlations' });
  }
});

router.get('/correlations/sweep', async (req: Request, res: Response) => {
  try {
    const metricA = req.query.metricA as string;
    const metricB = req.query.metricB as string;
    const geoType = req.query.geoType as string;
    const geoId = req.query.geoId as string;

    if (!metricA || !metricB || !geoType || !geoId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required params: metricA, metricB, geoType, geoId',
      });
    }

    const result = await correlationEngine.sweepLags(metricA, metricB, geoType, geoId);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error sweeping correlations:', error);
    res.status(500).json({ success: false, error: 'Failed to sweep correlations' });
  }
});

router.get('/:metricId/projection', async (req: Request, res: Response) => {
  try {
    const { metricId } = req.params;
    const geoId = req.query.geoId as string;
    const geoType = req.query.geoType as string;
    const rawHorizon = parseInt(req.query.horizon as string) || 60;
    const horizon = Math.min(Math.max(rawHorizon, 1), 60);

    if (!geoId || !geoType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query params: geoId, geoType',
      });
    }

    if (rawHorizon > 60) {
      return res.status(400).json({
        success: false,
        error: 'Maximum projection horizon is 60 months (5 years)',
      });
    }

    const result = await projectionService.getProjection(metricId, geoType, geoId, horizon);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Insufficient data to project ${metricId} for geography ${geoId}. Need at least 6 months of history (or a configured anchor metric).`,
      });
    }

    res.json({
      success: true,
      projection: result,
    });
  } catch (error) {
    logger.error('Error computing projection:', error);
    res.status(500).json({ success: false, error: 'Failed to compute projection' });
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

export default router;
