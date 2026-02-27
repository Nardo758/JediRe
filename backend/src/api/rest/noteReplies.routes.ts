/**
 * Note Replies API Routes
 * Endpoints for threaded comments/replies on notes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { noteRepliesService } from '../../services/noteRepliesService';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/assets/:assetId/notes/:noteId/replies
 * Get all replies for a note
 */
router.get(
  '/:assetId/notes/:noteId/replies',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { noteId } = req.params;
    const { limit, offset } = req.query;

    try {
      const result = await noteRepliesService.getReplies(
        client,
        noteId,
        userId,
        limit ? parseInt(limit as string) : undefined,
        offset ? parseInt(offset as string) : undefined
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error in GET /assets/:assetId/notes/:noteId/replies:', error);
      res.status(error.message.includes('authorized') ? 403 : 500).json({
        success: false,
        error: error.message || 'Failed to fetch replies',
      });
    }
  }
);

/**
 * GET /api/assets/:assetId/notes/:noteId/replies/:replyId
 * Get a single reply by ID
 */
router.get(
  '/:assetId/notes/:noteId/replies/:replyId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { replyId } = req.params;

    try {
      const reply = await noteRepliesService.getReplyById(client, replyId, userId);

      if (!reply) {
        return res.status(404).json({
          success: false,
          error: 'Reply not found',
        });
      }

      res.json({
        success: true,
        reply,
      });
    } catch (error: any) {
      logger.error('Error in GET /assets/:assetId/notes/:noteId/replies/:replyId:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch reply',
      });
    }
  }
);

/**
 * POST /api/assets/:assetId/notes/:noteId/replies
 * Add a reply to a note
 */
router.post(
  '/:assetId/notes/:noteId/replies',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { noteId } = req.params;
    const { content } = req.body;

    try {
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Reply content is required',
        });
      }

      const reply = await noteRepliesService.createReply(client, {
        noteId,
        content,
        authorId: userId,
      });

      res.status(201).json({
        success: true,
        reply: {
          id: reply.id,
          content: reply.content,
          createdAt: reply.createdAt,
        },
      });
    } catch (error: any) {
      logger.error('Error in POST /assets/:assetId/notes/:noteId/replies:', error);
      res.status(error.message.includes('authorized') ? 403 : 400).json({
        success: false,
        error: error.message || 'Failed to create reply',
      });
    }
  }
);

/**
 * PATCH /api/assets/:assetId/notes/:noteId/replies/:replyId
 * Edit a reply (author only)
 */
router.patch(
  '/:assetId/notes/:noteId/replies/:replyId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { replyId } = req.params;
    const { content } = req.body;

    try {
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Reply content is required',
        });
      }

      const updated = await noteRepliesService.updateReply(client, replyId, userId, {
        content,
      });

      res.json({
        success: true,
        reply: updated,
      });
    } catch (error: any) {
      logger.error('Error in PATCH /assets/:assetId/notes/:noteId/replies/:replyId:', error);
      res.status(error.message.includes('authorized') ? 403 : 400).json({
        success: false,
        error: error.message || 'Failed to update reply',
      });
    }
  }
);

/**
 * DELETE /api/assets/:assetId/notes/:noteId/replies/:replyId
 * Delete a reply (author or admin)
 */
router.delete(
  '/:assetId/notes/:noteId/replies/:replyId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { replyId } = req.params;

    try {
      await noteRepliesService.deleteReply(client, replyId, userId);

      res.json({
        success: true,
        message: 'Reply deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error in DELETE /assets/:assetId/notes/:noteId/replies/:replyId:', error);
      res.status(error.message.includes('authorized') ? 403 : 400).json({
        success: false,
        error: error.message || 'Failed to delete reply',
      });
    }
  }
);

export default router;
