/**
 * Notifications Controller
 * API endpoints for notification management
 */

import { Request, Response } from 'express';
import { Pool } from 'pg';
import { NotificationService } from '../services/NotificationService';
import { logger } from '../utils/logger';
import { NotificationType } from '../types/notification.types';

export class NotificationsController {
  private notificationService: NotificationService;

  constructor(private readonly db: Pool) {
    this.notificationService = new NotificationService(db);
  }

  /**
   * GET /api/notifications
   * Get user notifications with optional filters
   */
  async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const {
        unreadOnly = 'false',
        limit = '50',
        offset = '0',
        type,
      } = req.query;

      const notifications = await this.notificationService.getNotifications(userId, {
        unreadOnly: unreadOnly === 'true',
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        type: type as NotificationType | undefined,
      });

      res.json({
        success: true,
        notifications,
        count: notifications.length,
      });
    } catch (error) {
      logger.error('Error in getNotifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications',
      });
    }
  }

  /**
   * GET /api/notifications/counts
   * Get unread notification counts by category
   */
  async getCounts(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const counts = await this.notificationService.getUnreadCounts(userId);

      res.json(counts);
    } catch (error) {
      logger.error('Error in getCounts:', error);
      res.status(500).json({
        totalUnread: 0,
        decisionsUnread: 0,
        alertsUnread: 0,
        milestonesUnread: 0,
        infoUnread: 0,
      });
    }
  }

  /**
   * PUT /api/notifications/:id/read
   * Mark a notification as read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const success = await this.notificationService.markAsRead(id, userId);

      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
      }
    } catch (error) {
      logger.error('Error in markAsRead:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read',
      });
    }
  }

  /**
   * PUT /api/notifications/read-all
   * Mark all notifications as read for user
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const count = await this.notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        count,
      });
    } catch (error) {
      logger.error('Error in markAllAsRead:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark all notifications as read',
      });
    }
  }

  /**
   * GET /api/notifications/preferences
   * Get user notification preferences
   */
  async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const preferences = await this.notificationService.getPreferences(userId);

      if (preferences) {
        res.json(preferences);
      } else {
        res.status(404).json({
          error: 'Preferences not found',
        });
      }
    } catch (error) {
      logger.error('Error in getPreferences:', error);
      res.status(500).json({
        error: 'Failed to fetch preferences',
      });
    }
  }

  /**
   * PUT /api/notifications/preferences
   * Update user notification preferences
   */
  async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const updates = req.body;

      const success = await this.notificationService.updatePreferences(userId, updates);

      if (success) {
        res.json({ success: true });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to update preferences',
        });
      }
    } catch (error) {
      logger.error('Error in updatePreferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preferences',
      });
    }
  }

  /**
   * POST /api/notifications/test-decision
   * Test endpoint to trigger a decision notification (development only)
   */
  async testDecisionNotification(req: Request, res: Response): Promise<void> {
    try {
      const { dealId, stage = 'triage', message } = req.body;

      // Get deal details
      const dealResult = await this.db.query(
        'SELECT id, name, user_id FROM deals WHERE id = $1',
        [dealId]
      );

      if (dealResult.rows.length === 0) {
        res.status(404).json({ error: 'Deal not found' });
        return;
      }

      const deal = dealResult.rows[0];

      const notificationId = await this.notificationService.sendDecisionRequired({
        dealId: deal.id,
        dealName: deal.name,
        stage,
        message: message || `Test ${stage} decision notification`,
      });

      res.json({
        success: true,
        notificationId,
      });
    } catch (error) {
      logger.error('Error in testDecisionNotification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send test notification',
      });
    }
  }
}

/**
 * Setup notification routes
 */
export function setupNotificationRoutes(app: any, db: Pool, authMiddleware: any) {
  const controller = new NotificationsController(db);

  // Public routes (none)

  // Protected routes
  app.get(
    '/api/notifications',
    authMiddleware,
    (req: Request, res: Response) => controller.getNotifications(req, res)
  );

  app.get(
    '/api/notifications/counts',
    authMiddleware,
    (req: Request, res: Response) => controller.getCounts(req, res)
  );

  app.put(
    '/api/notifications/:id/read',
    authMiddleware,
    (req: Request, res: Response) => controller.markAsRead(req, res)
  );

  app.put(
    '/api/notifications/read-all',
    authMiddleware,
    (req: Request, res: Response) => controller.markAllAsRead(req, res)
  );

  app.get(
    '/api/notifications/preferences',
    authMiddleware,
    (req: Request, res: Response) => controller.getPreferences(req, res)
  );

  app.put(
    '/api/notifications/preferences',
    authMiddleware,
    (req: Request, res: Response) => controller.updatePreferences(req, res)
  );

  // Development/testing only
  if (process.env.NODE_ENV === 'development') {
    app.post(
      '/api/notifications/test-decision',
      authMiddleware,
      (req: Request, res: Response) => controller.testDecisionNotification(req, res)
    );
  }

  logger.info('Notification routes configured');
}
