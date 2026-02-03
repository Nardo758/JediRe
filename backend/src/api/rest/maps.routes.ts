/**
 * Maps & Pins API Routes  
 * Handle map creation, management, and property pins
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/maps
 * List user's maps
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await query(
      `SELECT 
        m.id,
        m.name,
        m.map_type,
        m.owner_id,
        m.created_at,
        m.updated_at,
        COUNT(DISTINCT mc.user_id) as collaborators_count,
        COUNT(DISTINCT mp.id) as pins_count
       FROM maps m
       LEFT JOIN map_collaborators mc ON m.id = mc.map_id
       LEFT JOIN map_pins mp ON m.id = mp.map_id
       WHERE m.owner_id = $1
       GROUP BY m.id
       ORDER BY m.updated_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error fetching maps:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch maps'
    });
  }
});

/**
 * POST /api/v1/maps
 * Create new map
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, map_type, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'name is required'
      });
    }

    // Create map
    const mapResult = await query(
      `INSERT INTO maps (name, owner_id, map_type, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, userId, map_type || 'acquisition', description]
    );

    const mapId = mapResult.rows[0].id;

    // Create default pipeline stages
    const stages = [
      { name: 'Lead', order: 1, color: '#94a3b8' },
      { name: 'Qualified', order: 2, color: '#60a5fa' },
      { name: 'Analyzing', order: 3, color: '#fbbf24' },
      { name: 'Offer Made', order: 4, color: '#fb923c' },
      { name: 'Under Contract', order: 5, color: '#a78bfa' },
      { name: 'Closed', order: 6, color: '#34d399' },
    ];

    for (const stage of stages) {
      await query(
        `INSERT INTO pipeline_stages (map_id, name, stage_order, color)
         VALUES ($1, $2, $3, $4)`,
        [mapId, stage.name, stage.order, stage.color]
      );
    }

    logger.info('Map created', { userId, mapId, name });

    res.json({
      success: true,
      data: mapResult.rows[0],
      message: 'Map created successfully'
    });

  } catch (error) {
    logger.error('Error creating map:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create map'
    });
  }
});

/**
 * GET /api/v1/maps/:id
 * Get map details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const mapId = req.params.id;

    const result = await query(
      `SELECT m.*
       FROM maps m
       WHERE m.id = $1 
       AND (m.owner_id = $2 OR EXISTS (
         SELECT 1 FROM map_collaborators mc 
         WHERE mc.map_id = m.id AND mc.user_id = $2
       ))`,
      [mapId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Map not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching map:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch map'
    });
  }
});

/**
 * PUT /api/v1/maps/:id
 * Update map
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const mapId = req.params.id;
    const { name, description, map_type } = req.body;

    const result = await query(
      `UPDATE maps
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           map_type = COALESCE($3, map_type),
           updated_at = now()
       WHERE id = $4 AND owner_id = $5
       RETURNING *`,
      [name, description, map_type, mapId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Map not found or you do not have permission'
      });
    }

    logger.info('Map updated', { userId, mapId });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Map updated successfully'
    });

  } catch (error) {
    logger.error('Error updating map:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update map'
    });
  }
});

/**
 * DELETE /api/v1/maps/:id
 * Delete map
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const mapId = req.params.id;

    const result = await query(
      'DELETE FROM maps WHERE id = $1 AND owner_id = $2 RETURNING id',
      [mapId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Map not found or you do not have permission'
      });
    }

    logger.info('Map deleted', { userId, mapId });

    res.json({
      success: true,
      message: 'Map deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting map:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete map'
    });
  }
});

/**
 * GET /api/v1/maps/:id/pins
 * Get all pins for a map
 */
router.get('/:id/pins', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const mapId = req.params.id;
    const pipelineStageId = req.query.pipeline_stage_id as string;
    const propertyType = req.query.property_type as string;

    // Verify user has access to map
    const mapCheck = await query(
      `SELECT id FROM maps 
       WHERE id = $1 
       AND (owner_id = $2 OR EXISTS (
         SELECT 1 FROM map_collaborators 
         WHERE map_id = $1 AND user_id = $2
       ))`,
      [mapId, userId]
    );

    if (mapCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Map not found or access denied'
      });
    }

    // Build query with optional filters
    let queryText = `
      SELECT 
        mp.id,
        mp.map_id,
        mp.pin_type,
        mp.property_name,
        mp.address,
        ST_X(mp.coordinates::geometry) as lng,
        ST_Y(mp.coordinates::geometry) as lat,
        mp.pipeline_stage_id,
        ps.name as pipeline_stage_name,
        ps.color as pipeline_stage_color,
        mp.property_data,
        mp.created_at,
        mp.updated_at
      FROM map_pins mp
      LEFT JOIN pipeline_stages ps ON mp.pipeline_stage_id = ps.id
      WHERE mp.map_id = $1
    `;

    const params: any[] = [mapId];
    let paramIndex = 2;

    if (pipelineStageId) {
      queryText += ` AND mp.pipeline_stage_id = $${paramIndex}`;
      params.push(pipelineStageId);
      paramIndex++;
    }

    if (propertyType) {
      queryText += ` AND mp.property_data->>'propertyType' = $${paramIndex}`;
      params.push(propertyType);
      paramIndex++;
    }

    queryText += ' ORDER BY mp.created_at DESC';

    const result = await query(queryText, params);

    // Format coordinates
    const pins = result.rows.map(pin => ({
      ...pin,
      coordinates: {
        lat: parseFloat(pin.lat),
        lng: parseFloat(pin.lng)
      },
      lat: undefined,
      lng: undefined
    }));

    res.json({
      success: true,
      data: pins
    });

  } catch (error) {
    logger.error('Error fetching pins:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pins'
    });
  }
});

/**
 * POST /api/v1/maps/:id/pins
 * Create new pin on map
 */
router.post('/:id/pins', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const mapId = req.params.id;
    const {
      pin_type,
      property_name,
      address,
      coordinates,
      pipeline_stage_id,
      property_data
    } = req.body;

    // Validation
    if (!coordinates || !coordinates.lat || !coordinates.lng) {
      return res.status(400).json({
        success: false,
        error: 'coordinates with lat and lng are required'
      });
    }

    // Verify user has access to map
    const mapCheck = await query(
      `SELECT id FROM maps 
       WHERE id = $1 
       AND (owner_id = $2 OR EXISTS (
         SELECT 1 FROM map_collaborators 
         WHERE map_id = $1 AND user_id = $2 AND role IN ('owner', 'editor')
       ))`,
      [mapId, userId]
    );

    if (mapCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'No permission to add pins to this map'
      });
    }

    // Create pin
    const result = await query(
      `INSERT INTO map_pins (
        map_id,
        pin_type,
        property_name,
        address,
        coordinates,
        pipeline_stage_id,
        created_by,
        property_data
      ) VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9)
      RETURNING id, map_id, pin_type, property_name, address, 
                ST_X(coordinates::geometry) as lng,
                ST_Y(coordinates::geometry) as lat,
                pipeline_stage_id, property_data, created_at`,
      [
        mapId,
        pin_type || 'property',
        property_name,
        address,
        coordinates.lng,
        coordinates.lat,
        pipeline_stage_id,
        userId,
        property_data || {}
      ]
    );

    const pin = result.rows[0];
    pin.coordinates = {
      lat: parseFloat(pin.lat),
      lng: parseFloat(pin.lng)
    };
    delete pin.lat;
    delete pin.lng;

    // If pipeline_stage_id provided, create deal silo
    if (pipeline_stage_id && pin_type === 'property') {
      await query(
        `INSERT INTO deal_silos (pin_id, current_stage_id)
         VALUES ($1, $2)`,
        [pin.id, pipeline_stage_id]
      );
    }

    logger.info('Pin created', { userId, mapId, pinId: pin.id });

    res.json({
      success: true,
      data: pin,
      message: 'Pin created successfully'
    });

  } catch (error) {
    logger.error('Error creating pin:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create pin'
    });
  }
});

/**
 * PUT /api/v1/maps/:id/pins/:pin_id
 * Update pin
 */
router.put('/:id/pins/:pin_id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const mapId = req.params.id;
    const pinId = req.params.pin_id;
    const { property_name, address, pipeline_stage_id, property_data } = req.body;

    const result = await query(
      `UPDATE map_pins
       SET property_name = COALESCE($1, property_name),
           address = COALESCE($2, address),
           pipeline_stage_id = COALESCE($3, pipeline_stage_id),
           property_data = COALESCE($4, property_data),
           updated_at = now()
       WHERE id = $5 
       AND map_id = $6
       AND EXISTS (
         SELECT 1 FROM maps 
         WHERE id = $6 
         AND (owner_id = $7 OR EXISTS (
           SELECT 1 FROM map_collaborators 
           WHERE map_id = $6 AND user_id = $7 AND role IN ('owner', 'editor')
         ))
       )
       RETURNING *`,
      [property_name, address, pipeline_stage_id, property_data, pinId, mapId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pin not found or no permission'
      });
    }

    logger.info('Pin updated', { userId, mapId, pinId });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Pin updated successfully'
    });

  } catch (error) {
    logger.error('Error updating pin:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update pin'
    });
  }
});

/**
 * DELETE /api/v1/maps/:id/pins/:pin_id
 * Delete pin
 */
router.delete('/:id/pins/:pin_id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const mapId = req.params.id;
    const pinId = req.params.pin_id;

    const result = await query(
      `DELETE FROM map_pins
       WHERE id = $1 
       AND map_id = $2
       AND EXISTS (
         SELECT 1 FROM maps 
         WHERE id = $2 
         AND (owner_id = $3 OR EXISTS (
           SELECT 1 FROM map_collaborators 
           WHERE map_id = $2 AND user_id = $3 AND role IN ('owner', 'editor')
         ))
       )
       RETURNING id`,
      [pinId, mapId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pin not found or no permission'
      });
    }

    logger.info('Pin deleted', { userId, mapId, pinId });

    res.json({
      success: true,
      message: 'Pin deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting pin:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete pin'
    });
  }
});

export default router;
