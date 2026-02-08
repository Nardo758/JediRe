/**
 * Map Configurations API Routes
 * Handle saved map tabs and War Maps
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
 * GET /api/v1/map-configs
 * List user's saved map configurations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const configType = req.query.type as string;

    let queryText = `
      SELECT 
        id,
        name,
        description,
        icon,
        config_type,
        is_default,
        is_public,
        layer_config,
        map_center,
        map_zoom,
        view_count,
        last_viewed_at,
        created_at,
        updated_at
      FROM map_configurations
      WHERE user_id = $1
    `;

    const params: any[] = [userId];

    if (configType) {
      queryText += ' AND config_type = $2';
      params.push(configType);
    }

    queryText += ' ORDER BY is_default DESC, last_viewed_at DESC NULLS LAST, created_at DESC';

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error fetching map configs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch map configurations'
    });
  }
});

/**
 * GET /api/v1/map-configs/default
 * Get user's default map configuration
 */
router.get('/default', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const result = await query(
      'SELECT * FROM get_default_map_config($1)',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No default map configuration found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching default map config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch default map configuration'
    });
  }
});

/**
 * GET /api/v1/map-configs/:id
 * Get single map configuration
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const configId = req.params.id;

    const result = await query(
      `SELECT * FROM map_configurations
       WHERE id = $1 AND (user_id = $2 OR is_public = true)`,
      [configId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Map configuration not found'
      });
    }

    // Increment view count
    await query('SELECT increment_map_config_views($1)', [configId]);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching map config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch map configuration'
    });
  }
});

/**
 * POST /api/v1/map-configs
 * Create new map configuration
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      name,
      description,
      icon,
      config_type = 'custom',
      is_default = false,
      is_public = false,
      layer_config,
      map_center,
      map_zoom
    } = req.body;

    // Validation
    if (!name || !layer_config) {
      return res.status(400).json({
        success: false,
        error: 'name and layer_config are required'
      });
    }

    if (!Array.isArray(layer_config)) {
      return res.status(400).json({
        success: false,
        error: 'layer_config must be an array'
      });
    }

    // Create configuration
    const result = await query(
      `INSERT INTO map_configurations (
        user_id,
        name,
        description,
        icon,
        config_type,
        is_default,
        is_public,
        layer_config,
        map_center,
        map_zoom
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        userId,
        name,
        description,
        icon,
        config_type,
        is_default,
        is_public,
        JSON.stringify(layer_config),
        map_center ? JSON.stringify(map_center) : null,
        map_zoom
      ]
    );

    logger.info('Map configuration created', {
      userId,
      configId: result.rows[0].id,
      name
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Map configuration saved successfully'
    });

  } catch (error) {
    logger.error('Error creating map config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create map configuration'
    });
  }
});

/**
 * PUT /api/v1/map-configs/:id
 * Update map configuration
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const configId = req.params.id;
    const {
      name,
      description,
      icon,
      is_default,
      is_public,
      layer_config,
      map_center,
      map_zoom
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
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramIndex}`);
      values.push(icon);
      paramIndex++;
    }
    if (is_default !== undefined) {
      updates.push(`is_default = $${paramIndex}`);
      values.push(is_default);
      paramIndex++;
    }
    if (is_public !== undefined) {
      updates.push(`is_public = $${paramIndex}`);
      values.push(is_public);
      paramIndex++;
    }
    if (layer_config !== undefined) {
      updates.push(`layer_config = $${paramIndex}`);
      values.push(JSON.stringify(layer_config));
      paramIndex++;
    }
    if (map_center !== undefined) {
      updates.push(`map_center = $${paramIndex}`);
      values.push(JSON.stringify(map_center));
      paramIndex++;
    }
    if (map_zoom !== undefined) {
      updates.push(`map_zoom = $${paramIndex}`);
      values.push(map_zoom);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push('updated_at = now()');
    values.push(configId, userId);

    const result = await query(
      `UPDATE map_configurations
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Map configuration not found or no permission'
      });
    }

    logger.info('Map configuration updated', { userId, configId });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Map configuration updated successfully'
    });

  } catch (error) {
    logger.error('Error updating map config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update map configuration'
    });
  }
});

/**
 * DELETE /api/v1/map-configs/:id
 * Delete map configuration
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const configId = req.params.id;

    const result = await query(
      'DELETE FROM map_configurations WHERE id = $1 AND user_id = $2 RETURNING id',
      [configId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Map configuration not found or no permission'
      });
    }

    logger.info('Map configuration deleted', { userId, configId });

    res.json({
      success: true,
      message: 'Map configuration deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting map config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete map configuration'
    });
  }
});

/**
 * POST /api/v1/map-configs/:id/clone
 * Clone a map configuration
 */
router.post('/:id/clone', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const configId = req.params.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'name is required'
      });
    }

    const result = await query(
      'SELECT clone_map_config($1, $2, $3) as new_id',
      [configId, name, userId]
    );

    const newId = result.rows[0].new_id;

    // Fetch the new configuration
    const newConfig = await query(
      'SELECT * FROM map_configurations WHERE id = $1',
      [newId]
    );

    logger.info('Map configuration cloned', {
      userId,
      originalId: configId,
      newId
    });

    res.json({
      success: true,
      data: newConfig.rows[0],
      message: 'Map configuration cloned successfully'
    });

  } catch (error) {
    logger.error('Error cloning map config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clone map configuration'
    });
  }
});

/**
 * POST /api/v1/map-configs/:id/set-default
 * Set a configuration as default
 */
router.post('/:id/set-default', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const configId = req.params.id;

    const result = await query(
      `UPDATE map_configurations
       SET is_default = true
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [configId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Map configuration not found or no permission'
      });
    }

    logger.info('Map configuration set as default', { userId, configId });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Set as default map'
    });

  } catch (error) {
    logger.error('Error setting default map config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set default map'
    });
  }
});

export default router;
