/**
 * Notifications API Routes
 * Handle user notifications and alerts
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
// @ts-nocheck
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/v1/notifications
 * Get user's notifications
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const unreadOnly = req.query.unread_only === 'true';
    const limit = parseInt(req.query.limit as string) || 50;

    let queryText = `
      SELECT * FROM unread_notifications
      WHERE user_id = $1
    `;

    if (!unreadOnly) {
      queryText = `
        SELECT 
          n.id,
          n.proposal_id,
          n.notification_type,
          n.message,
          n.is_read,
          n.read_at,
          n.created_at,
          p.map_id,
          m.name as map_name
        FROM proposal_notifications n
        LEFT JOIN map_change_proposals p ON n.proposal_id = p.id
        LEFT JOIN maps m ON p.map_id = m.id
        WHERE n.user_id = $1
      `;
    }

    queryText += ` ORDER BY n.created_at DESC LIMIT $2`;

    const result = await query(queryText, [userId, limit]);

    // Get unread count
    const countResult = await query(
      `SELECT COUNT(*) as count 
       FROM proposal_notifications 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      unread_count: parseInt(countResult.rows[0].count)
    });

  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

/**
 * POST /api/v1/notifications/:id/read
 * Mark notification as read
 */
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const notificationId = req.params.id;

    const result = await query(
      `UPDATE proposal_notifications
       SET is_read = true,
           read_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    logger.info('Notification marked as read', { userId, notificationId });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Notification marked as read'
    });

  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

/**
 * POST /api/v1/notifications/read-all
 * Mark all notifications as read
 */
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const result = await query(
      `UPDATE proposal_notifications
       SET is_read = true,
           read_at = now()
       WHERE user_id = $1 AND is_read = false
       RETURNING id`,
      [userId]
    );

    logger.info('All notifications marked as read', {
      userId,
      count: result.rows.length
    });

    res.json({
      success: true,
      message: `Marked ${result.rows.length} notifications as read`
    });

  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read'
    });
  }
});

export default router;
