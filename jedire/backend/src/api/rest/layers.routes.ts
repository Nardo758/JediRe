/**
 * Map Layers API Routes
 * Handle layer CRUD operations for maps
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
// @ts-ignore
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/v1/layers/map/:map_id
 * Get all layers for a map
 */
router.get('/map/:map_id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const mapId = req.params.map_id;
    const visibleOnly = req.query.visible_only === 'true';

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

    // Build query
    let queryText = `
      SELECT 
        id,
        map_id,
        name,
        layer_type,
        source_type,
        visible,
        opacity,
        z_index,
        filters,
        style,
        source_config,
        created_at,
        updated_at
      FROM map_layers
      WHERE map_id = $1
    `;

    if (visibleOnly) {
      queryText += ' AND visible = true';
    }

    queryText += ' ORDER BY z_index ASC, created_at ASC';

    const result = await query(queryText, [mapId]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error fetching layers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch layers'
    });
  }
});

/**
 * GET /api/v1/layers/:id
 * Get single layer by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const layerId = req.params.id;

    const result = await query(
      `SELECT ml.*
       FROM map_layers ml
       INNER JOIN maps m ON ml.map_id = m.id
       WHERE ml.id = $1
       AND (m.owner_id = $2 OR EXISTS (
         SELECT 1 FROM map_collaborators 
         WHERE map_id = m.id AND user_id = $2
       ))`,
      [layerId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Layer not found or access denied'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching layer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch layer'
    });
  }
});

/**
 * POST /api/v1/layers
 * Create new layer
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      map_id,
      name,
      layer_type,
      source_type,
      visible = true,
      opacity = 1.0,
      z_index = 0,
      filters = {},
      style = {},
      source_config = {}
    } = req.body;

    // Validation
    if (!map_id || !name || !layer_type || !source_type) {
      return res.status(400).json({
        success: false,
        error: 'map_id, name, layer_type, and source_type are required'
      });
    }

    // Valid layer types
    const validLayerTypes = ['pin', 'bubble', 'heatmap', 'boundary', 'overlay'];
    if (!validLayerTypes.includes(layer_type)) {
      return res.status(400).json({
        success: false,
        error: `layer_type must be one of: ${validLayerTypes.join(', ')}`
      });
    }

    // Valid source types
    const validSourceTypes = ['assets', 'pipeline', 'email', 'news', 'market', 'custom'];
    if (!validSourceTypes.includes(source_type)) {
      return res.status(400).json({
        success: false,
        error: `source_type must be one of: ${validSourceTypes.join(', ')}`
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
      [map_id, userId]
    );

    if (mapCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'No permission to add layers to this map'
      });
    }

    // Auto-calculate z_index if not provided
    let finalZIndex = z_index;
    if (z_index === 0) {
      const maxZResult = await query(
        'SELECT COALESCE(MAX(z_index), 0) as max_z FROM map_layers WHERE map_id = $1',
        [map_id]
      );
      finalZIndex = maxZResult.rows[0].max_z + 1;
    }

    // Create layer
    const result = await query(
      `INSERT INTO map_layers (
        map_id,
        name,
        layer_type,
        source_type,
        visible,
        opacity,
        z_index,
        filters,
        style,
        source_config,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        map_id,
        name,
        layer_type,
        source_type,
        visible,
        opacity,
        finalZIndex,
        filters,
        style,
        source_config,
        userId
      ]
    );

    logger.info('Layer created', { userId, mapId: map_id, layerId: result.rows[0].id });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Layer created successfully'
    });

  } catch (error) {
    logger.error('Error creating layer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create layer'
    });
  }
});

/**
 * PUT /api/v1/layers/:id
 * Update layer
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const layerId = req.params.id;
    const {
      name,
      visible,
      opacity,
      z_index,
      filters,
      style,
      source_config
    } = req.body;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }
    if (visible !== undefined) {
      updates.push(`visible = $${paramIndex}`);
      values.push(visible);
      paramIndex++;
    }
    if (opacity !== undefined) {
      updates.push(`opacity = $${paramIndex}`);
      values.push(opacity);
      paramIndex++;
    }
    if (z_index !== undefined) {
      updates.push(`z_index = $${paramIndex}`);
      values.push(z_index);
      paramIndex++;
    }
    if (filters !== undefined) {
      updates.push(`filters = $${paramIndex}`);
      values.push(filters);
      paramIndex++;
    }
    if (style !== undefined) {
      updates.push(`style = $${paramIndex}`);
      values.push(style);
      paramIndex++;
    }
    if (source_config !== undefined) {
      updates.push(`source_config = $${paramIndex}`);
      values.push(source_config);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push('updated_at = now()');

    values.push(layerId, userId);

    const result = await query(
      `UPDATE map_layers ml
       SET ${updates.join(', ')}
       FROM maps m
       WHERE ml.id = $${paramIndex}
       AND ml.map_id = m.id
       AND (m.owner_id = $${paramIndex + 1} OR EXISTS (
         SELECT 1 FROM map_collaborators 
         WHERE map_id = m.id AND user_id = $${paramIndex + 1} AND role IN ('owner', 'editor')
       ))
       RETURNING ml.*`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Layer not found or no permission'
      });
    }

    logger.info('Layer updated', { userId, layerId });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Layer updated successfully'
    });

  } catch (error) {
    logger.error('Error updating layer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update layer'
    });
  }
});

/**
 * DELETE /api/v1/layers/:id
 * Delete layer
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const layerId = req.params.id;

    const result = await query(
      `DELETE FROM map_layers ml
       USING maps m
       WHERE ml.id = $1
       AND ml.map_id = m.id
       AND (m.owner_id = $2 OR EXISTS (
         SELECT 1 FROM map_collaborators 
         WHERE map_id = m.id AND user_id = $2 AND role IN ('owner', 'editor')
       ))
       RETURNING ml.id`,
      [layerId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Layer not found or no permission'
      });
    }

    logger.info('Layer deleted', { userId, layerId });

    res.json({
      success: true,
      message: 'Layer deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting layer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete layer'
    });
  }
});

/**
 * POST /api/v1/layers/reorder
 * Bulk update z-index for multiple layers
 */
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { map_id, layer_order } = req.body;

    // layer_order should be array of { id, z_index }
    if (!map_id || !Array.isArray(layer_order)) {
      return res.status(400).json({
        success: false,
        error: 'map_id and layer_order array are required'
      });
    }

    // Verify access to map
    const mapCheck = await query(
      `SELECT id FROM maps 
       WHERE id = $1 
       AND (owner_id = $2 OR EXISTS (
         SELECT 1 FROM map_collaborators 
         WHERE map_id = $1 AND user_id = $2 AND role IN ('owner', 'editor')
       ))`,
      [map_id, userId]
    );

    if (mapCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'No permission to modify this map'
      });
    }

    // Update each layer's z_index
    for (const item of layer_order) {
      await query(
        `UPDATE map_layers 
         SET z_index = $1, updated_at = now()
         WHERE id = $2 AND map_id = $3`,
        [item.z_index, item.id, map_id]
      );
    }

    logger.info('Layers reordered', { userId, mapId: map_id, count: layer_order.length });

    res.json({
      success: true,
      message: 'Layers reordered successfully'
    });

  } catch (error) {
    logger.error('Error reordering layers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reorder layers'
    });
  }
});

/**
 * GET /api/v1/layers/sources/:source_type
 * Fetch data for a specific layer source type
 */
router.get('/sources/:source_type', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const sourceType = req.params.source_type;
    const mapId = req.query.map_id as string;

    if (!mapId) {
      return res.status(400).json({
        success: false,
        error: 'map_id query parameter is required'
      });
    }

    // Verify access to map
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

    let data = [];

    // Fetch data based on source type
    switch (sourceType) {
      case 'assets':
        // Fetch user's owned properties
        const assetsResult = await query(
          `SELECT 
            p.id,
            p.address,
            p.city,
            p.state,
            ST_X(p.coordinates::geometry) as lng,
            ST_Y(p.coordinates::geometry) as lat,
            p.property_type,
            p.bedrooms,
            p.bathrooms,
            p.sqft,
            p.price
           FROM properties p
           WHERE p.listing_status = 'owned'
           ORDER BY p.created_at DESC`,
          []
        );
        data = assetsResult.rows;
        break;

      case 'pipeline':
        // Fetch pipeline deals for this map
        const pipelineResult = await query(
          `SELECT 
            mp.id,
            mp.property_name,
            mp.address,
            ST_X(mp.coordinates::geometry) as lng,
            ST_Y(mp.coordinates::geometry) as lat,
            ps.name as stage_name,
            ps.color as stage_color,
            mp.property_data
           FROM map_pins mp
           LEFT JOIN pipeline_stages ps ON mp.pipeline_stage_id = ps.id
           WHERE mp.map_id = $1
           AND mp.pin_type = 'property'
           ORDER BY mp.created_at DESC`,
          [mapId]
        );
        data = pipelineResult.rows;
        break;

      case 'email':
        // Fetch properties mentioned in emails
        const emailResult = await query(
          `SELECT DISTINCT
            e.id,
            e.subject,
            e.from_email,
            e.from_name,
            (e.extracted_data->>'address') as address,
            (e.extracted_data->>'lat')::float as lat,
            (e.extracted_data->>'lng')::float as lng,
            e.received_at,
            e.deal_id
           FROM emails e
           WHERE e.extracted_data->>'address' IS NOT NULL
           AND e.extracted_data->>'lat' IS NOT NULL
           ORDER BY e.received_at DESC
           LIMIT 100`,
          []
        );
        data = emailResult.rows;
        break;

      case 'news':
        // Fetch news events with geographic data
        const newsResult = await query(
          `SELECT 
            ne.id,
            ne.event_type,
            ne.headline,
            ne.summary,
            ST_X(ne.location::geometry) as lng,
            ST_Y(ne.location::geometry) as lat,
            ne.impact_score,
            ne.confidence_score,
            ne.event_date
           FROM news_events ne
           WHERE ne.location IS NOT NULL
           ORDER BY ne.event_date DESC
           LIMIT 200`,
          []
        );
        data = newsResult.rows;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown source type: ${sourceType}`
        });
    }

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    logger.error('Error fetching layer source data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch layer data'
    });
  }
});

export default router;
