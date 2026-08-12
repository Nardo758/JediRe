/**
 * Traffic Geo REST Routes
 * GET /api/v1/properties/geo/traffic — returns geo-located properties with
 * latest traffic prediction weights for Mapbox heatmap rendering.
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/properties/geo/traffic
 *
 * Query params:
 *   status     — 'pipeline' | 'owned' | 'both'  (default: 'both')
 *   limit      — max results (default: 500)
 *   city       — filter by city (optional)
 *   minWeight  — minimum weekly_walk_ins to include (default: 0)
 *
 * Returns: GeoJSON FeatureCollection of properties with traffic weight
 */
router.get('/traffic', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const {
      status = 'both',
      limit = '500',
      city,
      minWeight = '0',
    } = req.query;

    const maxLimit = Math.min(parseInt(limit as string, 10) || 500, 1000);
    const minWeightNum = parseFloat(minWeight as string) || 0;

    // Build WHERE clauses
    const conditions: string[] = ['p.lat IS NOT NULL', 'p.lng IS NOT NULL'];
    const params: any[] = [minWeightNum];
    let paramIdx = 2;

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

    // Use latest_traffic_predictions view if available, else fall back to
    // traffic_predictions with a DISTINCT ON subquery.
    const sql = `
      WITH latest_pred AS (
        SELECT DISTINCT ON (property_id)
          property_id,
          weekly_walk_ins,
          confidence_score,
          prediction_year,
          prediction_week
        FROM traffic_predictions
        WHERE weekly_walk_ins IS NOT NULL
        ORDER BY property_id, prediction_year DESC, prediction_week DESC
      )
      SELECT
        p.id,
        p.name,
        p.address_line1 AS address,
        p.city,
        p.state_code AS state,
        p.ownership_status,
        p.lat::float AS lat,
        p.lng::float AS lng,
        COALESCE(lp.weekly_walk_ins, 0)::float AS weekly_walk_ins,
        lp.confidence_score::float AS confidence
      FROM properties p
      LEFT JOIN latest_pred lp ON lp.property_id = p.id
      WHERE ${whereClause}
        AND COALESCE(lp.weekly_walk_ins, 0) >= $1
      ORDER BY weekly_walk_ins DESC NULLS LAST
      LIMIT ${maxLimit}
    `;

    const result = await query(sql, params);

    const features = result.rows.map((row: any) => ({
      type: 'Feature' as const,
      properties: {
        id: row.id,
        name: row.name || 'Untitled',
        address: row.address || '',
        city: row.city || '',
        state: row.state || '',
        ownershipStatus: row.ownership_status,
        weeklyWalkIns: row.weekly_walk_ins,
        confidence: row.confidence,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [row.lng, row.lat],
      },
    }));

    res.json({
      success: true,
      count: features.length,
      type: 'FeatureCollection',
      features,
    });
  } catch (error) {
    logger.error('Traffic geo query failed:', error);
    next(error);
  }
});

export default router;
