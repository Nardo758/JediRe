import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';
import circle from '@turf/circle';
import area from '@turf/area';
import { point } from '@turf/helpers';

const router = Router();
const pool = getPool();

router.post('/', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      geometry,
      definition_method,
      method_params,
    } = req.body;

    if (!name || !geometry || !definition_method) {
      return res.status(400).json({
        success: false,
        message: 'Name, geometry, and definition_method are required',
      });
    }

    const result = await pool.query(
      `INSERT INTO trade_areas (name, boundary, metadata, created_at, updated_at)
       VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, NOW(), NOW())
       RETURNING id, name, metadata, created_at, updated_at`,
      [
        name,
        JSON.stringify(geometry),
        JSON.stringify({ definition_method, method_params: method_params || {} }),
      ]
    );

    const row = result.rows[0];
    logger.info(`Trade area created: ${name}`, { tradeAreaId: row.id });

    res.status(201).json({
      success: true,
      data: {
        id: row.id,
        name: row.name,
        geometry,
        definition_method,
        method_params: method_params || {},
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      message: 'Trade area created successfully',
    });
  } catch (error) {
    logger.error('Error creating trade area:', error);
    next(error);
  }
});

router.get('/library', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      `SELECT id, name, metadata,
              ST_AsGeoJSON(boundary)::json as geometry,
              created_at, updated_at
       FROM trade_areas
       ORDER BY updated_at DESC
       LIMIT 50`
    );

    const tradeAreas = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      geometry: row.geometry,
      definition_method: row.metadata?.definition_method || 'radius',
      stats_snapshot: row.metadata?.stats_snapshot || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    res.json({
      success: true,
      data: tradeAreas,
      count: tradeAreas.length,
    });
  } catch (error) {
    logger.error('Error fetching trade area library:', error);
    next(error);
  }
});

router.get('/:id', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, name, municipality, state, metadata,
              ST_AsGeoJSON(boundary)::json as geometry,
              created_at, updated_at
       FROM trade_areas
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Trade area not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        name: row.name,
        municipality: row.municipality,
        state: row.state,
        geometry: row.geometry,
        definition_method: row.metadata?.definition_method || 'radius',
        method_params: row.metadata?.method_params || {},
        stats_snapshot: row.metadata?.stats_snapshot || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (error) {
    logger.error('Error fetching trade area:', error);
    next(error);
  }
});

router.put('/:id', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, geometry, metadata } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (name) {
      updates.push(`name = $${paramIdx++}`);
      values.push(name);
    }
    if (geometry) {
      updates.push(`boundary = ST_SetSRID(ST_GeomFromGeoJSON($${paramIdx++}), 4326)`);
      values.push(JSON.stringify(geometry));
    }
    if (metadata) {
      updates.push(`metadata = metadata || $${paramIdx++}::jsonb`);
      values.push(JSON.stringify(metadata));
    }
    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE trade_areas SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING id, name, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Trade area not found' });
    }

    res.json({
      success: true,
      message: 'Trade area updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating trade area:', error);
    next(error);
  }
});

router.delete('/:id', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const linked = await pool.query(
      `SELECT COUNT(*) as cnt FROM deals WHERE trade_area_id = $1`,
      [id]
    );
    if (parseInt(linked.rows[0].cnt) > 0) {
      await pool.query(`UPDATE deals SET trade_area_id = NULL WHERE trade_area_id = $1`, [id]);
    }

    await pool.query(`DELETE FROM trade_areas WHERE id = $1`, [id]);

    res.json({ success: true, message: 'Trade area deleted successfully' });
  } catch (error) {
    logger.error('Error deleting trade area:', error);
    next(error);
  }
});

router.post('/generate', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, radius_hint } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    const radiusMiles = radius_hint || 3;
    const centerPoint = point([lng, lat]);
    const circleGeometry = circle(centerPoint, radiusMiles, {
      steps: 64,
      units: 'miles',
    });

    res.json({
      success: true,
      data: {
        geometry: circleGeometry.geometry,
        confidence: 0.75,
        analysis: {
          method: 'radius_fallback',
          message: 'Using radius-based boundary.',
          radius_miles: radiusMiles,
        },
      },
    });
  } catch (error) {
    logger.error('Error generating trade area:', error);
    next(error);
  }
});

router.post('/preview-stats', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { geometry } = req.body;

    if (!geometry) {
      return res.status(400).json({
        success: false,
        message: 'Geometry is required',
      });
    }

    const areaSqMeters = area(geometry);
    const areaSqMiles = areaSqMeters / 2_589_988;
    const geoJson = JSON.stringify(geometry);

    let stats: any = {
      area_sq_miles: Math.round(areaSqMiles * 100) / 100,
      properties_count: 0,
      existing_units: 0,
      pipeline_units: 0,
      avg_rent: 0,
      population: 0,
    };

    const containsClause = `ST_Contains(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326))`;

    try {
      const propResult = await pool.query(
        `SELECT COUNT(*) as cnt,
                COALESCE(SUM(p.units), 0) as total_units,
                ROUND(COALESCE(AVG(NULLIF(COALESCE(p.avg_rent, p.market_rent, p.rent), 0)), 0)) as avg_rent
         FROM properties p
         WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
           AND ${containsClause}`,
        [geoJson]
      );
      stats.properties_count = parseInt(propResult.rows[0].cnt) || 0;
      stats.existing_units = parseInt(propResult.rows[0].total_units) || 0;
      stats.avg_rent = parseInt(propResult.rows[0].avg_rent) || 0;
    } catch (err) {
      logger.warn('Error querying properties for preview stats:', err);
    }

    try {
      const demoResult = await pool.query(
        `SELECT COALESCE(SUM(pd.total_population), 0) as population
         FROM property_demographics pd
         JOIN properties p ON p.id = pd.property_id
         WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
           AND ${containsClause}`,
        [geoJson]
      );
      stats.population = parseInt(demoResult.rows[0].population) || 0;
    } catch (err) {
      logger.warn('Error querying demographics for preview stats:', err);
    }

    if (stats.population === 0 && stats.area_sq_miles > 0) {
      const estimatedPopDensity = 3000;
      stats.population = Math.round(stats.area_sq_miles * estimatedPopDensity);
      stats.population_estimated = true;
    }

    try {
      const pipelineResult = await pool.query(
        `SELECT COALESCE(SUM(d.target_units), 0) as pipeline_units
         FROM deals d
         JOIN deal_properties dp ON dp.deal_id = d.id
         JOIN properties p ON p.id = dp.property_id
         WHERE d.status IN ('active', 'qualified', 'due_diligence', 'under_contract', 'lead')
           AND d.target_units > 0
           AND p.lat IS NOT NULL AND p.lng IS NOT NULL
           AND ${containsClause}`,
        [geoJson]
      );
      stats.pipeline_units = parseInt(pipelineResult.rows[0].pipeline_units) || 0;
    } catch (err) {
      logger.warn('Error querying pipeline units for preview stats:', err);
    }

    if (stats.avg_rent === 0) {
      try {
        const centroid = await pool.query(
          `SELECT ST_X(ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))) as lng,
                  ST_Y(ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))) as lat`,
          [geoJson]
        );
        if (centroid.rows.length > 0) {
          const subResult = await pool.query(
            `SELECT avg_rent FROM submarkets
             WHERE ST_Contains(geometry, ST_SetSRID(ST_MakePoint($1::float, $2::float), 4326))
             LIMIT 1`,
            [centroid.rows[0].lng, centroid.rows[0].lat]
          );
          if (subResult.rows.length > 0) {
            stats.avg_rent = parseInt(subResult.rows[0].avg_rent) || 0;
          }
        }
      } catch (err) {
        logger.warn('Error querying submarket avg rent for preview stats:', err);
      }
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error calculating preview stats:', error);
    next(error);
  }
});

router.post('/radius', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, miles } = req.body;

    if (!lat || !lng || !miles) {
      return res.status(400).json({
        success: false,
        message: 'Latitude, longitude, and miles are required',
      });
    }

    const centerPoint = point([lng, lat]);
    const circleGeometry = circle(centerPoint, miles, {
      steps: 64,
      units: 'miles',
    });

    res.json({
      success: true,
      data: {
        geometry: circleGeometry.geometry,
        center: [lng, lat],
        radius_miles: miles,
      },
    });
  } catch (error) {
    logger.error('Error creating radius circle:', error);
    next(error);
  }
});

export default router;
