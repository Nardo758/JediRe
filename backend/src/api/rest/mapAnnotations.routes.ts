import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

// Types
interface MapAnnotation {
  id: string;
  userId: string;
  name: string;
  description?: string;
  geojson: any;
  fillColor: string;
  strokeColor: string;
  fillOpacity: number;
  strokeWidth: number;
  isShared: boolean;
  sharedWithUsers: string[];
  sharedWithTeams: string[];
  annotationType: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/v1/map-annotations
 * Get all map annotations for current user
 */
router.get('/', [
  query('userId').optional().isString(),
  query('includeShared').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.query.userId as string || 'current-user';
    const includeShared = req.query.includeShared === 'true';

    // TODO: Replace with actual database query
    // const db = req.app.locals.db;
    
    // Mock query for development
    let query = `
      SELECT 
        id,
        user_id as "userId",
        name,
        description,
        geojson,
        fill_color as "fillColor",
        stroke_color as "strokeColor",
        fill_opacity as "fillOpacity",
        stroke_width as "strokeWidth",
        is_shared as "isShared",
        shared_with_users as "sharedWithUsers",
        shared_with_teams as "sharedWithTeams",
        annotation_type as "annotationType",
        tags,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM user_map_annotations
      WHERE user_id = $1
    `;

    if (includeShared) {
      query += ` OR is_shared = true OR $1 = ANY(shared_with_users)`;
    }

    query += ` ORDER BY created_at DESC`;

    // const result = await db.query(query, [userId]);
    // const annotations = result.rows;

    // Mock data for development
    const annotations: MapAnnotation[] = [];

    res.json(annotations);
  } catch (error) {
    console.error('Error fetching map annotations:', error);
    res.status(500).json({ error: 'Failed to fetch map annotations' });
  }
});

/**
 * GET /api/v1/map-annotations/:id
 * Get specific map annotation
 */
router.get('/:id', [
  param('id').isUUID(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    // TODO: Replace with actual database query
    const query = `
      SELECT 
        id,
        user_id as "userId",
        name,
        description,
        geojson,
        fill_color as "fillColor",
        stroke_color as "strokeColor",
        fill_opacity as "fillOpacity",
        stroke_width as "strokeWidth",
        is_shared as "isShared",
        shared_with_users as "sharedWithUsers",
        shared_with_teams as "sharedWithTeams",
        annotation_type as "annotationType",
        tags,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM user_map_annotations
      WHERE id = $1
    `;

    // const result = await db.query(query, [id]);
    // if (result.rows.length === 0) {
    //   return res.status(404).json({ error: 'Annotation not found' });
    // }
    // const annotation = result.rows[0];

    // Mock response
    res.status(404).json({ error: 'Annotation not found' });
  } catch (error) {
    console.error('Error fetching map annotation:', error);
    res.status(500).json({ error: 'Failed to fetch map annotation' });
  }
});

/**
 * POST /api/v1/map-annotations
 * Create new map annotation
 */
router.post('/', [
  body('userId').isString(),
  body('name').isString().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().isString(),
  body('geojson').isObject(),
  body('fillColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('strokeColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('fillOpacity').optional().isFloat({ min: 0, max: 1 }),
  body('strokeWidth').optional().isInt({ min: 1, max: 10 }),
  body('isShared').optional().isBoolean(),
  body('annotationType').optional().isString(),
  body('tags').optional().isArray(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      userId,
      name,
      description,
      geojson,
      fillColor = '#3B82F6',
      strokeColor = '#2563EB',
      fillOpacity = 0.2,
      strokeWidth = 2,
      isShared = false,
      annotationType = 'drawing',
      tags = [],
    } = req.body;

    // TODO: Replace with actual database insert
    const query = `
      INSERT INTO user_map_annotations (
        user_id,
        name,
        description,
        geojson,
        fill_color,
        stroke_color,
        fill_opacity,
        stroke_width,
        is_shared,
        annotation_type,
        tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        id,
        user_id as "userId",
        name,
        description,
        geojson,
        fill_color as "fillColor",
        stroke_color as "strokeColor",
        fill_opacity as "fillOpacity",
        stroke_width as "strokeWidth",
        is_shared as "isShared",
        annotation_type as "annotationType",
        tags,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    // const result = await db.query(query, [
    //   userId, name, description, JSON.stringify(geojson),
    //   fillColor, strokeColor, fillOpacity, strokeWidth,
    //   isShared, annotationType, tags
    // ]);
    // const annotation = result.rows[0];

    // Mock response
    const annotation: MapAnnotation = {
      id: `annotation-${Date.now()}`,
      userId,
      name,
      description,
      geojson,
      fillColor,
      strokeColor,
      fillOpacity,
      strokeWidth,
      isShared,
      sharedWithUsers: [],
      sharedWithTeams: [],
      annotationType,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    res.status(201).json(annotation);
  } catch (error: any) {
    console.error('Error creating map annotation:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Annotation with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create map annotation' });
  }
});

/**
 * PUT /api/v1/map-annotations/:id
 * Update map annotation
 */
router.put('/:id', [
  param('id').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().isString(),
  body('geojson').optional().isObject(),
  body('fillColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('strokeColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('fillOpacity').optional().isFloat({ min: 0, max: 1 }),
  body('strokeWidth').optional().isInt({ min: 1, max: 10 }),
  body('isShared').optional().isBoolean(),
  body('tags').optional().isArray(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      const dbColumn = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      updateFields.push(`${dbColumn} = $${paramIndex}`);
      values.push(updates[key]);
      paramIndex++;
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    // TODO: Replace with actual database update
    const query = `
      UPDATE user_map_annotations
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING 
        id,
        user_id as "userId",
        name,
        description,
        geojson,
        fill_color as "fillColor",
        stroke_color as "strokeColor",
        fill_opacity as "fillOpacity",
        stroke_width as "strokeWidth",
        is_shared as "isShared",
        annotation_type as "annotationType",
        tags,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    // const result = await db.query(query, values);
    // if (result.rows.length === 0) {
    //   return res.status(404).json({ error: 'Annotation not found' });
    // }
    // const annotation = result.rows[0];

    // Mock response
    res.status(200).json({ message: 'Annotation updated (mock)' });
  } catch (error) {
    console.error('Error updating map annotation:', error);
    res.status(500).json({ error: 'Failed to update map annotation' });
  }
});

/**
 * DELETE /api/v1/map-annotations/:id
 * Delete map annotation
 */
router.delete('/:id', [
  param('id').isUUID(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    // TODO: Replace with actual database delete
    const query = `DELETE FROM user_map_annotations WHERE id = $1 RETURNING id`;

    // const result = await db.query(query, [id]);
    // if (result.rows.length === 0) {
    //   return res.status(404).json({ error: 'Annotation not found' });
    // }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting map annotation:', error);
    res.status(500).json({ error: 'Failed to delete map annotation' });
  }
});

/**
 * POST /api/v1/map-annotations/:id/share
 * Share annotation with users or teams
 */
router.post('/:id/share', [
  param('id').isUUID(),
  body('users').optional().isArray(),
  body('teams').optional().isArray(),
  body('isShared').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { users = [], teams = [], isShared = true } = req.body;

    // TODO: Replace with actual database update
    const query = `
      UPDATE user_map_annotations
      SET 
        is_shared = $1,
        shared_with_users = $2,
        shared_with_teams = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id
    `;

    // const result = await db.query(query, [isShared, users, teams, id]);
    // if (result.rows.length === 0) {
    //   return res.status(404).json({ error: 'Annotation not found' });
    // }

    res.json({ message: 'Annotation sharing updated' });
  } catch (error) {
    console.error('Error sharing map annotation:', error);
    res.status(500).json({ error: 'Failed to share map annotation' });
  }
});

export default router;
