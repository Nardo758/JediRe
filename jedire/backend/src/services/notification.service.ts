/**
 * Notification Service
 * Handles user notifications and alerts
 */

import { logger } from '../utils/logger';
import { query } from '../database/connection';

export type NotificationType = 
  | 'new_proposal' 
  | 'proposal_accepted' 
  | 'proposal_rejected' 
  | 'proposal_cancelled'
  | 'property_auto_created'
  | 'property_needs_review'
  | 'collaborator_added'
  | 'collaborator_removed';

/**
 * Create a notification
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  message: string,
  data?: Record<string, any>
): Promise<string | null> {
  try {
    const result = await query(
      `INSERT INTO proposal_notifications (
        user_id,
        notification_type,
        message,
        proposal_id,
        is_read
      ) VALUES ($1, $2, $3, $4, false)
      RETURNING id`,
      [userId, type, message, data?.proposal_id || null]
    );

    logger.info('Notification created', { userId, type });

    return result.rows[0].id;

  } catch (error) {
    logger.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Get user notifications
 */
export async function getUserNotifications(
  userId: string,
  unreadOnly: boolean = false,
  limit: number = 50
): Promise<any[]> {
  try {
    let queryText: string;

    if (unreadOnly) {
      queryText = `
        SELECT * FROM unread_notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
    } else {
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
        ORDER BY n.created_at DESC
        LIMIT $2
      `;
    }

    const result = await query(queryText, [userId, limit]);
    return result.rows;

  } catch (error) {
    logger.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  try {
    const result = await query(
      `UPDATE proposal_notifications
       SET is_read = true, read_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, userId]
    );

    return result.rows.length > 0;

  } catch (error) {
    logger.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(
  userId: string
): Promise<number> {
  try {
    const result = await query(
      `UPDATE proposal_notifications
       SET is_read = true, read_at = now()
       WHERE user_id = $1 AND is_read = false
       RETURNING id`,
      [userId]
    );

    logger.info('All notifications marked as read', { userId, count: result.rows.length });

    return result.rows.length;

  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    return 0;
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(
  userId: string
): Promise<number> {
  try {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM proposal_notifications 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return parseInt(result.rows[0].count);

  } catch (error) {
    logger.error('Error getting unread count:', error);
    return 0;
  }
}

/**
 * Delete old notifications (cleanup)
 */
export async function deleteOldNotifications(
  daysOld: number = 30
): Promise<number> {
  try {
    const result = await query(
      `DELETE FROM proposal_notifications
       WHERE created_at < now() - interval '${daysOld} days'
       AND is_read = true
       RETURNING id`,
      []
    );

    logger.info('Old notifications deleted', { count: result.rows.length, daysOld });

    return result.rows.length;

  } catch (error) {
    logger.error('Error deleting old notifications:', error);
    return 0;
  }
}

/**
 * Notify property auto-created
 */
export async function notifyPropertyAutoCreated(
  userId: string,
  propertyAddress: string,
  mapName: string
): Promise<void> {
  try {
    await createNotification(
      userId,
      'property_auto_created',
      `✅ Property auto-added: ${propertyAddress} to "${mapName}"`
    );
  } catch (error) {
    logger.error('Error sending property auto-created notification:', error);
  }
}

/**
 * Notify property needs review
 */
export async function notifyPropertyNeedsReview(
  userId: string,
  count: number
): Promise<void> {
  try {
    await createNotification(
      userId,
      'property_needs_review',
      `🟡 ${count} ${count === 1 ? 'property needs' : 'properties need'} your review`
    );
  } catch (error) {
    logger.error('Error sending property needs review notification:', error);
  }
}

/**
 * Notify collaborator added
 */
export async function notifyCollaboratorAdded(
  userId: string,
  mapName: string,
  addedBy: string
): Promise<void> {
  try {
    await createNotification(
      userId,
      'collaborator_added',
      `👥 ${addedBy} added you as a collaborator to "${mapName}"`
    );
  } catch (error) {
    logger.error('Error sending collaborator added notification:', error);
  }
}
