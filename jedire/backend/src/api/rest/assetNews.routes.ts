/**
 * Asset News API Routes
 * Endpoints for news-asset linking and management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { assetNewsService } from '../../services/assetNewsService';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/assets/:assetId/news
 * Get all news events linked to an asset
 */
router.get(
  '/:assetId/news',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const { assetId } = req.params;
    const { radius, type, excludeDismissed, includeLink } = req.query;

    try {
      const result = await assetNewsService.getAssetNews(client, assetId, {
        radius: radius ? parseFloat(radius as string) : undefined,
        type: type as string,
        excludeDismissed: excludeDismissed !== 'false',
        includeLink: includeLink !== 'false',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error in GET /assets/:assetId/news:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch asset news',
      });
    }
  }
);

/**
 * POST /api/assets/:assetId/news/:newsId/link
 * Manually link a news event to an asset
 */
router.post(
  '/:assetId/news/:newsId/link',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { assetId, newsId } = req.params;
    const { userNotes, impactScore } = req.body;

    try {
      const link = await assetNewsService.linkNewsToAsset(client, {
        assetId,
        newsEventId: newsId,
        linkType: 'manual',
        userNotes,
        impactScore,
        linkedBy: userId,
      });

      res.json({
        success: true,
        link: {
          id: link.id,
          linkType: link.linkType,
          linkedAt: link.linkedAt,
          impactScore: link.impactScore,
        },
      });
    } catch (error: any) {
      logger.error('Error in POST /assets/:assetId/news/:newsId/link:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to link news to asset',
      });
    }
  }
);

/**
 * PATCH /api/assets/:assetId/news/:newsId/link
 * Update news link (user notes, impact score)
 */
router.patch(
  '/:assetId/news/:newsId/link',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const { assetId, newsId } = req.params;
    const { userNotes, impactScore } = req.body;

    try {
      // Find the link first
      const existingQuery = `
        SELECT id FROM asset_news_links
        WHERE asset_id = $1 AND news_event_id = $2
      `;
      const existing = await client.query(existingQuery, [assetId, newsId]);

      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'News link not found',
        });
      }

      const linkId = existing.rows[0].id;

      const updated = await assetNewsService.updateNewsLink(client, linkId, {
        userNotes,
        impactScore,
      });

      res.json({
        success: true,
        link: updated,
      });
    } catch (error: any) {
      logger.error('Error in PATCH /assets/:assetId/news/:newsId/link:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update news link',
      });
    }
  }
);

/**
 * DELETE /api/assets/:assetId/news/:newsId/link
 * Dismiss an auto-linked news event
 */
router.delete(
  '/:assetId/news/:newsId/link',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { assetId, newsId } = req.params;

    try {
      await assetNewsService.dismissNewsLink(client, assetId, newsId, userId);

      res.json({
        success: true,
        linkType: 'dismissed',
      });
    } catch (error: any) {
      logger.error('Error in DELETE /assets/:assetId/news/:newsId/link:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to dismiss news link',
      });
    }
  }
);

/**
 * POST /api/assets/news/:newsId/auto-link
 * Trigger auto-linking for a news event (admin only)
 */
router.post(
  '/news/:newsId/auto-link',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const { newsId } = req.params;
    const { radiusMiles } = req.body;

    try {
      const linkedCount = await assetNewsService.autoLinkNewsToAssets(
        client,
        newsId,
        radiusMiles || 5.0
      );

      res.json({
        success: true,
        linkedCount,
      });
    } catch (error: any) {
      logger.error('Error in POST /assets/news/:newsId/auto-link:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to auto-link news',
      });
    }
  }
);

export default router;
