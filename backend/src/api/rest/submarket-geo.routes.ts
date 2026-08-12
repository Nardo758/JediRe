/**
 * Submarket Geo REST Routes
 * GET /api/v1/submarkets/geo — aggregates properties by submarket for map bubbles
 *
 * Returns centroid (avg lat/lng), deal count, and averaged performance metrics
 * per submarket. Used by the mapping surface submarket aggregation layer.
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/submarkets/geo
 *
 * Query params:
 *   status     — 'pipeline' | 'owned' | 'both'  (default: 'both')
 *   city       — filter by city (optional)
 *   metric     — which metric to average ('jediScore', 'occupancyRate',
 *                'rentGrowth', 'concessions', 'vacancyLoss', 'noi')
 *                default: 'jediScore'
 *
 * Returns: Array of submarket geo aggregates
 */
router.get('/geo', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const {
      status = 'both',
      city,
      metric = 'jediScore',
    } = req.query;

    // Validate metric against allowlist
    const allowedMetrics = ['jediScore', 'occupancyRate', 'rentGrowth', 'concessions', 'vacancyLoss', 'noi'];
    const safeMetric = allowedMetrics.includes(metric as string) ? (metric as string) : 'jediScore';

    // Map frontend metric names to SQL column expressions
    const metricMap: Record<string, string> = {
      jediScore:       'AVG(p.jedi_score)::float',
      occupancyRate:   'AVG(dma.occupancy_rate)::float',
      rentGrowth:      'AVG(dma.rent_growth)::float',
      concessions:     'AVG(dma.concessions)::float',
      vacancyLoss:     'AVG(dma.vacancy_loss)::float',
      noi:             'AVG(dma.noi)::float',
    };
    const metricSql = metricMap[safeMetric] || metricMap.jediScore;

    // Build WHERE clauses
    const conditions: string[] = [
      "p.submarket IS NOT NULL",
      "p.submarket <> ''",
      'p.lat IS NOT NULL',
      'p.lng IS NOT NULL',
    ];
    const params: any[] = [];
    let paramIdx = 1;

    if (status === 'pipeline') {
      conditions.push(`p.ownership_status = 'pipeline'`);
    } else if (status === 'owned') {
      conditions.push(`p.ownership_status = 'owned'`);
    } else {
      conditions.push(`p.ownership_status IN ('pipeline', 'owned')`);
    }

    if (city) {
      conditions.push(`p.city ILIKE $${paramIdx}`);
      params.push(`%${city}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT
        p.submarket AS name,
        p.city,
        p.state_code AS state,
        COUNT(*)::int AS deal_count,
        AVG(p.lat)::float AS lat,
        AVG(p.lng)::float AS lng,
        ${metricSql} AS avg_metric,
        AVG(p.units)::float AS avg_units,
        AVG(p.year_built)::float AS avg_year_built
      FROM properties p
      LEFT JOIN LATERAL (
        SELECT *
        FROM deal_monthly_actuals
        WHERE property_id = p.id
        ORDER BY report_month DESC
        LIMIT 1
      ) dma ON true
      WHERE ${whereClause}
      GROUP BY p.submarket, p.city, p.state_code
      HAVING COUNT(*) >= 1
      ORDER BY deal_count DESC
    `;

    const result = await query(sql, params);

    const submarkets = result.rows.map((row: any) => ({
      name: row.name,
      city: row.city || '',
      state: row.state || '',
      dealCount: row.deal_count,
      lat: row.lat,
      lng: row.lng,
      avgMetric: row.avg_metric,
      avgUnits: row.avg_units,
      avgYearBuilt: row.avg_year_built,
      metricName: safeMetric,
    }));

    res.json({
      success: true,
      count: submarkets.length,
      metric: safeMetric,
      submarkets,
    });
  } catch (error) {
    logger.error('Submarket geo aggregation failed:', error);
    next(error);
  }
});

export default router;
