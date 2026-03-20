/**
 * Note Categories API Routes
 * Endpoints for managing user-defined note categories
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { noteCategoriesService } from '../../services/noteCategoriesService';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/note-categories
 * Get all categories (system + user's custom)
 */
router.get(
  '/',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;

    try {
      const categories = await noteCategoriesService.getCategories(client, userId);

      res.json({
        success: true,
        categories,
      });
    } catch (error: any) {
      logger.error('Error in GET /note-categories:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch categories',
      });
    }
  }
);

/**
 * GET /api/note-categories/:categoryId
 * Get a specific category by ID
 */
router.get(
  '/:categoryId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const { categoryId } = req.params;

    try {
      const category = await noteCategoriesService.getCategoryById(client, categoryId);

      if (!category) {
        return res.status(404).json({
          success: false,
          error: 'Category not found',
        });
      }

      res.json({
        success: true,
        category,
      });
    } catch (error: any) {
      logger.error('Error in GET /note-categories/:categoryId:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch category',
      });
    }
  }
);

/**
 * POST /api/note-categories
 * Create a custom category
 */
router.post(
  '/',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { name, color, icon, organizationId } = req.body;

    try {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Category name is required',
        });
      }

      const category = await noteCategoriesService.createCategory(client, {
        name: name.trim(),
        color,
        icon,
        userId,
        organizationId,
      });

      res.status(201).json({
        success: true,
        category,
      });
    } catch (error: any) {
      logger.error('Error in POST /note-categories:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create category',
      });
    }
  }
);

/**
 * PATCH /api/note-categories/:categoryId
 * Update a custom category
 */
router.patch(
  '/:categoryId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { categoryId } = req.params;
    const { name, color, icon, displayOrder } = req.body;

    try {
      const updated = await noteCategoriesService.updateCategory(client, categoryId, userId, {
        name,
        color,
        icon,
        displayOrder,
      });

      res.json({
        success: true,
        category: updated,
      });
    } catch (error: any) {
      logger.error('Error in PATCH /note-categories/:categoryId:', error);
      res.status(error.message.includes('authorized') ? 403 : 400).json({
        success: false,
        error: error.message || 'Failed to update category',
      });
    }
  }
);

/**
 * DELETE /api/note-categories/:categoryId
 * Delete a custom category
 */
router.delete(
  '/:categoryId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { categoryId } = req.params;

    try {
      await noteCategoriesService.deleteCategory(client, categoryId, userId);

      res.json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error in DELETE /note-categories/:categoryId:', error);
      res.status(error.message.includes('authorized') ? 403 : 400).json({
        success: false,
        error: error.message || 'Failed to delete category',
      });
    }
  }
);

/**
 * GET /api/note-categories/stats/usage
 * Get usage statistics for categories
 */
router.get(
  '/stats/usage',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;

    try {
      const stats = await noteCategoriesService.getCategoryUsageStats(client, userId);

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      logger.error('Error in GET /note-categories/stats/usage:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch category usage stats',
      });
    }
  }
);

export default router;
