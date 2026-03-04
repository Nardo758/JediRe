/**
 * Map Annotations API
 * CRUD endpoints for user map drawings and annotations
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/map-annotations
 * Get user's saved annotations
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id; // From auth middleware
    const { include_shared = 'false' } = req.query;

    let whereClause: any = {
      deleted_at: null,
    };

    if (include_shared === 'true') {
      // Include user's own + team shared
      whereClause = {
        OR: [
          { user_id: userId },
          { shared_with_team: true },
          { shared_with_users: { has: userId } },
        ],
        deleted_at: null,
      };
    } else {
      // Only user's own
      whereClause.user_id = userId;
    }

    const annotations = await prisma.userMapAnnotation.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    res.json({
      annotations: annotations.map(a => ({
        id: a.id,
        user_id: a.user_id,
        user_name: a.user.name,
        title: a.title,
        description: a.description,
        geojson: a.geojson,
        color: a.color,
        stroke_width: a.stroke_width,
        fill_opacity: a.fill_opacity,
        is_shared: a.is_shared,
        shared_with_team: a.shared_with_team,
        feature_count: a.geojson.features?.length || 0,
        created_at: a.created_at,
        updated_at: a.updated_at,
      })),
    });
  } catch (error) {
    console.error('Get annotations error:', error);
    res.status(500).json({ error: 'Failed to fetch annotations' });
  }
});

/**
 * POST /api/v1/map-annotations
 * Create new annotation
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      title,
      description,
      geojson,
      color = '#3B82F6',
      stroke_width = 2,
      fill_opacity = 0.3,
    } = req.body;

    // Validation
    if (!title || !geojson) {
      return res.status(400).json({ error: 'Title and geojson are required' });
    }

    if (!geojson.type || geojson.type !== 'FeatureCollection') {
      return res.status(400).json({ error: 'geojson must be a FeatureCollection' });
    }

    const annotation = await prisma.userMapAnnotation.create({
      data: {
        user_id: userId,
        title,
        description,
        geojson,
        color,
        stroke_width,
        fill_opacity,
        is_shared: false,
        shared_with_team: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      id: annotation.id,
      user_id: annotation.user_id,
      user_name: annotation.user.name,
      title: annotation.title,
      description: annotation.description,
      geojson: annotation.geojson,
      color: annotation.color,
      stroke_width: annotation.stroke_width,
      fill_opacity: annotation.fill_opacity,
      is_shared: annotation.is_shared,
      shared_with_team: annotation.shared_with_team,
      created_at: annotation.created_at,
      updated_at: annotation.updated_at,
    });
  } catch (error) {
    console.error('Create annotation error:', error);
    res.status(500).json({ error: 'Failed to create annotation' });
  }
});

/**
 * GET /api/v1/map-annotations/:id
 * Get specific annotation
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const annotation = await prisma.userMapAnnotation.findFirst({
      where: {
        id,
        OR: [
          { user_id: userId },
          { shared_with_team: true },
          { shared_with_users: { has: userId } },
        ],
        deleted_at: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    res.json({
      id: annotation.id,
      user_id: annotation.user_id,
      user_name: annotation.user.name,
      title: annotation.title,
      description: annotation.description,
      geojson: annotation.geojson,
      color: annotation.color,
      stroke_width: annotation.stroke_width,
      fill_opacity: annotation.fill_opacity,
      is_shared: annotation.is_shared,
      shared_with_team: annotation.shared_with_team,
      created_at: annotation.created_at,
      updated_at: annotation.updated_at,
    });
  } catch (error) {
    console.error('Get annotation error:', error);
    res.status(500).json({ error: 'Failed to fetch annotation' });
  }
});

/**
 * PATCH /api/v1/map-annotations/:id
 * Update annotation
 */
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const {
      title,
      description,
      geojson,
      color,
      stroke_width,
      fill_opacity,
    } = req.body;

    // Check ownership
    const existing = await prisma.userMapAnnotation.findFirst({
      where: {
        id,
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Annotation not found or access denied' });
    }

    const updated = await prisma.userMapAnnotation.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(geojson && { geojson }),
        ...(color && { color }),
        ...(stroke_width !== undefined && { stroke_width }),
        ...(fill_opacity !== undefined && { fill_opacity }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      id: updated.id,
      user_id: updated.user_id,
      user_name: updated.user.name,
      title: updated.title,
      description: updated.description,
      geojson: updated.geojson,
      color: updated.color,
      stroke_width: updated.stroke_width,
      fill_opacity: updated.fill_opacity,
      is_shared: updated.is_shared,
      shared_with_team: updated.shared_with_team,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    });
  } catch (error) {
    console.error('Update annotation error:', error);
    res.status(500).json({ error: 'Failed to update annotation' });
  }
});

/**
 * POST /api/v1/map-annotations/:id/share
 * Share annotation with team
 */
router.post('/:id/share', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { shared_with_team = true, shared_with_users = [] } = req.body;

    // Check ownership
    const existing = await prisma.userMapAnnotation.findFirst({
      where: {
        id,
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Annotation not found or access denied' });
    }

    const updated = await prisma.userMapAnnotation.update({
      where: { id },
      data: {
        is_shared: true,
        shared_with_team,
        shared_with_users,
      },
    });

    res.json({
      id: updated.id,
      shared_with_team: updated.shared_with_team,
      shared_with_users: updated.shared_with_users,
    });
  } catch (error) {
    console.error('Share annotation error:', error);
    res.status(500).json({ error: 'Failed to share annotation' });
  }
});

/**
 * DELETE /api/v1/map-annotations/:id
 * Soft delete annotation
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    // Check ownership
    const existing = await prisma.userMapAnnotation.findFirst({
      where: {
        id,
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Annotation not found or access denied' });
    }

    // Soft delete
    await prisma.userMapAnnotation.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete annotation error:', error);
    res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

/**
 * POST /api/v1/map-annotations/:id/duplicate
 * Duplicate annotation
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const original = await prisma.userMapAnnotation.findFirst({
      where: {
        id,
        OR: [
          { user_id: userId },
          { shared_with_team: true },
        ],
        deleted_at: null,
      },
    });

    if (!original) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    const duplicate = await prisma.userMapAnnotation.create({
      data: {
        user_id: userId,
        title: `${original.title} (Copy)`,
        description: original.description,
        geojson: original.geojson,
        color: original.color,
        stroke_width: original.stroke_width,
        fill_opacity: original.fill_opacity,
        is_shared: false,
        shared_with_team: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      id: duplicate.id,
      user_id: duplicate.user_id,
      user_name: duplicate.user.name,
      title: duplicate.title,
      description: duplicate.description,
      geojson: duplicate.geojson,
      color: duplicate.color,
      created_at: duplicate.created_at,
      updated_at: duplicate.updated_at,
    });
  } catch (error) {
    console.error('Duplicate annotation error:', error);
    res.status(500).json({ error: 'Failed to duplicate annotation' });
  }
});

export default router;
