/**
 * NotificationService
 * Handles notification creation, delivery, and management for deal decision points
 */

import { Pool, QueryResult } from 'pg';
import { logger } from '../utils/logger';
import {
  NotificationType,
  NotificationPriority,
  Notification,
  NotificationCounts,
  CreateNotificationRequest,
  DecisionRequiredPayload,
  MilestoneReachedPayload,
  StallAlertPayload,
  NotificationPreferences,
} from '../types/notification.types';

export class NotificationService {
  constructor(private readonly db: Pool) {}

  // ============================================================================
  // CORE NOTIFICATION METHODS
  // ============================================================================

  /**
   * Create a notification
   */
  async createNotification(request: CreateNotificationRequest): Promise<string | null> {
    try {
      const {
        userId,
        dealId,
        type,
        title,
        message,
        actionUrl,
        actionLabel,
        metadata = {},
      } = request;

      // Determine priority based on type
      const priority = this.determinePriority(type);

      const result: QueryResult = await this.db.query(
        `INSERT INTO notifications (
          user_id, deal_id, type, priority, title, message,
          action_url, action_label, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          userId,
          dealId || null,
          type,
          priority,
          title,
          message,
          actionUrl || null,
          actionLabel || null,
          JSON.stringify(metadata),
        ]
      );

      const notificationId = result.rows[0].id;

      logger.info('Notification created', {
        notificationId,
        userId,
        dealId,
        type,
        priority,
      });

      return notificationId;
    } catch (error) {
      logger.error('Error creating notification:', error);
      return null;
    }
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      type?: NotificationType;
    } = {}
  ): Promise<Notification[]> {
    try {
      const { unreadOnly = false, limit = 50, offset = 0, type } = options;

      let query = `
        SELECT 
          n.*,
          d.name as deal_name,
          d.project_type
        FROM notifications n
        LEFT JOIN deals d ON n.deal_id = d.id
        WHERE n.user_id = $1
          AND (n.expires_at IS NULL OR n.expires_at > NOW())
      `;

      const params: any[] = [userId];
      let paramIndex = 2;

      if (unreadOnly) {
        query += ` AND n.is_read = FALSE`;
      }

      if (type) {
        query += ` AND n.type = $${paramIndex++}`;
        params.push(type);
      }

      query += ` ORDER BY n.priority DESC, n.created_at DESC`;
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result: QueryResult = await this.db.query(query, params);

      return result.rows.map((row) => this.mapRowToNotification(row));
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Get unread notification counts
   */
  async getUnreadCounts(userId: string): Promise<NotificationCounts> {
    try {
      const result: QueryResult = await this.db.query(
        'SELECT * FROM get_notification_counts($1)',
        [userId]
      );

      const counts = result.rows[0] || {};

      return {
        totalUnread: parseInt(counts.total_unread) || 0,
        decisionsUnread: parseInt(counts.decisions_unread) || 0,
        alertsUnread: parseInt(counts.alerts_unread) || 0,
        milestonesUnread: parseInt(counts.milestones_unread) || 0,
        infoUnread: parseInt(counts.info_unread) || 0,
      };
    } catch (error) {
      logger.error('Error fetching notification counts:', error);
      return {
        totalUnread: 0,
        decisionsUnread: 0,
        alertsUnread: 0,
        milestonesUnread: 0,
        infoUnread: 0,
      };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result: QueryResult = await this.db.query(
        `UPDATE notifications
         SET is_read = TRUE, read_at = NOW()
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
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result: QueryResult = await this.db.query(
        `UPDATE notifications
         SET is_read = TRUE, read_at = NOW()
         WHERE user_id = $1 AND is_read = FALSE
         RETURNING id`,
        [userId]
      );

      logger.info('All notifications marked as read', {
        userId,
        count: result.rows.length,
      });

      return result.rows.length;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      return 0;
    }
  }

  // ============================================================================
  // DECISION POINT NOTIFICATIONS
  // ============================================================================

  /**
   * Send notification when a decision is required
   */
  async sendDecisionRequired(payload: DecisionRequiredPayload): Promise<string | null> {
    const { dealId, dealName, stage, message, context } = payload;

    // Get deal owner
    const ownerResult = await this.db.query(
      'SELECT user_id FROM deals WHERE id = $1',
      [dealId]
    );

    if (ownerResult.rows.length === 0) {
      logger.error('Deal not found for decision notification', { dealId });
      return null;
    }

    const userId = ownerResult.rows[0].user_id;

    // Map stage to notification type
    const typeMap: Record<string, NotificationType> = {
      triage: NotificationType.DECISION_TRIAGE_COMPLETE,
      intelligence_assembly: NotificationType.DECISION_INTELLIGENCE_COMPLETE,
      underwriting: NotificationType.DECISION_UNDERWRITING_COMPLETE,
      stalled: NotificationType.DECISION_DEAL_STALLED,
    };

    const type = typeMap[stage.toLowerCase()] || NotificationType.DECISION_TRIAGE_COMPLETE;

    const notificationId = await this.createNotification({
      userId,
      dealId,
      type,
      title: `🎯 Decision Required: ${dealName}`,
      message,
      actionUrl: `/deals/${dealId}/decide`,
      actionLabel: 'Review & Decide',
      metadata: {
        stage,
        context,
      },
    });

    // Log decision presented
    if (notificationId) {
      await this.db.query(
        `INSERT INTO decision_log (
          deal_id, user_id, notification_id, decision_point, presented_at
        ) VALUES ($1, $2, $3, $4, NOW())`,
        [dealId, userId, notificationId, stage]
      );
    }

    return notificationId;
  }

  /**
   * Send milestone reached notification
   */
  async sendMilestoneReached(payload: MilestoneReachedPayload): Promise<string | null> {
    const { dealId, dealName, milestone, details, metrics } = payload;

    // Get deal owner
    const ownerResult = await this.db.query(
      'SELECT user_id FROM deals WHERE id = $1',
      [dealId]
    );

    if (ownerResult.rows.length === 0) {
      logger.error('Deal not found for milestone notification', { dealId });
      return null;
    }

    const userId = ownerResult.rows[0].user_id;

    // Map milestone to notification type
    const typeMap: Record<string, NotificationType> = {
      deal_created: NotificationType.MILESTONE_DEAL_CREATED,
      stage_changed: NotificationType.MILESTONE_STAGE_CHANGED,
      analysis_complete: NotificationType.MILESTONE_ANALYSIS_COMPLETE,
      property_linked: NotificationType.MILESTONE_PROPERTY_LINKED,
    };

    const type = typeMap[milestone] || NotificationType.MILESTONE_STAGE_CHANGED;

    return this.createNotification({
      userId,
      dealId,
      type,
      title: `✅ Milestone: ${dealName}`,
      message: details || `${milestone.replace(/_/g, ' ')} completed`,
      actionUrl: `/deals/${dealId}`,
      actionLabel: 'View Deal',
      metadata: {
        milestone,
        metrics,
      },
    });
  }

  /**
   * Send stall alert notification
   */
  async sendStallAlert(payload: StallAlertPayload): Promise<string | null> {
    const { dealId, dealName, daysStalled, lastActivity, currentStage } = payload;

    // Get deal owner
    const ownerResult = await this.db.query(
      'SELECT user_id FROM deals WHERE id = $1',
      [dealId]
    );

    if (ownerResult.rows.length === 0) {
      logger.error('Deal not found for stall alert', { dealId });
      return null;
    }

    const userId = ownerResult.rows[0].user_id;

    // Update stall notification timestamp
    await this.db.query(
      `UPDATE deal_state_tracking 
       SET stall_notified_at = NOW()
       WHERE deal_id = $1`,
      [dealId]
    );

    return this.createNotification({
      userId,
      dealId,
      type: NotificationType.DECISION_DEAL_STALLED,
      title: `⚠️ Deal Needs Attention: ${dealName}`,
      message: `This deal has been idle for ${daysStalled} days in ${currentStage} stage. Time to take action!`,
      actionUrl: `/deals/${dealId}`,
      actionLabel: 'Review Deal',
      metadata: {
        daysStalled,
        lastActivity: lastActivity.toISOString(),
        currentStage,
      },
    });
  }

  // ============================================================================
  // STALL DETECTION
  // ============================================================================

  /**
   * Check for stalled deals and send notifications
   */
  async checkStalledDeals(): Promise<number> {
    try {
      // Get stalled deals
      const result: QueryResult = await this.db.query(
        'SELECT * FROM check_and_mark_stalled_deals()'
      );

      const stalledDeals = result.rows;

      logger.info('Checking for stalled deals', { count: stalledDeals.length });

      // Send notifications for each stalled deal
      for (const row of stalledDeals) {
        const dealDetails = await this.db.query(
          `SELECT d.name, dst.current_stage, dst.last_activity_at
           FROM deals d
           JOIN deal_state_tracking dst ON d.id = dst.deal_id
           WHERE d.id = $1`,
          [row.deal_id]
        );

        if (dealDetails.rows.length > 0) {
          const deal = dealDetails.rows[0];
          
          await this.sendStallAlert({
            dealId: row.deal_id,
            dealName: deal.name,
            daysStalled: row.days_stalled,
            lastActivity: new Date(deal.last_activity_at),
            currentStage: deal.current_stage,
          });
        }
      }

      return stalledDeals.length;
    } catch (error) {
      logger.error('Error checking stalled deals:', error);
      return 0;
    }
  }

  // ============================================================================
  // PREFERENCES
  // ============================================================================

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const result: QueryResult = await this.db.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        // Create default preferences
        await this.db.query(
          'INSERT INTO notification_preferences (user_id) VALUES ($1)',
          [userId]
        );
        return this.getPreferences(userId);
      }

      return this.mapRowToPreferences(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching notification preferences:', error);
      return null;
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<boolean> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic update query
      const allowedFields = [
        'enable_in_app',
        'enable_email',
        'enable_push',
        'decision_points_enabled',
        'milestones_enabled',
        'alerts_enabled',
        'info_enabled',
        'enable_daily_digest',
        'daily_digest_time',
        'quiet_hours_enabled',
        'quiet_hours_start',
        'quiet_hours_end',
      ];

      Object.entries(updates).forEach(([key, value]) => {
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        if (allowedFields.includes(snakeKey)) {
          fields.push(`${snakeKey} = $${paramIndex++}`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        return false;
      }

      values.push(userId);
      await this.db.query(
        `UPDATE notification_preferences
         SET ${fields.join(', ')}
         WHERE user_id = $${paramIndex}`,
        values
      );

      logger.info('Notification preferences updated', { userId });

      return true;
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      return false;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Determine priority based on notification type
   */
  private determinePriority(type: NotificationType): NotificationPriority {
    if (type.startsWith('decision_')) {
      return NotificationPriority.HIGH;
    }
    if (type.startsWith('alert_')) {
      return NotificationPriority.HIGH;
    }
    if (type.startsWith('milestone_')) {
      return NotificationPriority.MEDIUM;
    }
    return NotificationPriority.LOW;
  }

  /**
   * Map database row to Notification object
   */
  private mapRowToNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      dealId: row.deal_id,
      type: row.type as NotificationType,
      priority: row.priority as NotificationPriority,
      title: row.title,
      message: row.message,
      metadata: row.metadata || {},
      actionUrl: row.action_url,
      actionLabel: row.action_label,
      isRead: row.is_read,
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      inAppStatus: row.in_app_status,
      emailStatus: row.email_status,
      pushStatus: row.push_status,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    };
  }

  /**
   * Map database row to NotificationPreferences object
   */
  private mapRowToPreferences(row: any): NotificationPreferences {
    return {
      id: row.id,
      userId: row.user_id,
      enableInApp: row.enable_in_app,
      enableEmail: row.enable_email,
      enablePush: row.enable_push,
      decisionPointsEnabled: row.decision_points_enabled,
      milestonesEnabled: row.milestones_enabled,
      alertsEnabled: row.alerts_enabled,
      infoEnabled: row.info_enabled,
      enableDailyDigest: row.enable_daily_digest,
      dailyDigestTime: row.daily_digest_time,
      quietHoursEnabled: row.quiet_hours_enabled,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Delete old read notifications (cleanup)
   */
  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    try {
      const result: QueryResult = await this.db.query(
        `DELETE FROM notifications
         WHERE created_at < NOW() - INTERVAL '${daysOld} days'
         AND is_read = TRUE
         RETURNING id`
      );

      logger.info('Old notifications cleaned up', { count: result.rows.length });

      return result.rows.length;
    } catch (error) {
      logger.error('Error cleaning up old notifications:', error);
      return 0;
    }
  }
}
