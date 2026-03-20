/**
 * Notification Background Tasks
 * Scheduled jobs for notification system
 */

import { Pool } from 'pg';
import { NotificationService } from '../services/NotificationService';
import { logger } from '../utils/logger';

export class NotificationTasks {
  private notificationService: NotificationService;

  constructor(private readonly db: Pool) {
    this.notificationService = new NotificationService(db);
  }

  /**
   * Check for stalled deals and send notifications
   * Schedule: Every 6 hours
   */
  async checkStalledDeals(): Promise<void> {
    try {
      logger.info('Starting stalled deals check...');

      const count = await this.notificationService.checkStalledDeals();

      logger.info('Stalled deals check complete', {
        notificationsSent: count,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in checkStalledDeals task:', error);
    }
  }

  /**
   * Clean up old read notifications
   * Schedule: Daily at 2 AM
   */
  async cleanupOldNotifications(): Promise<void> {
    try {
      logger.info('Starting notification cleanup...');

      const count = await this.notificationService.cleanupOldNotifications(30);

      logger.info('Notification cleanup complete', {
        deletedCount: count,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in cleanupOldNotifications task:', error);
    }
  }

  /**
   * Send daily digest emails (future implementation)
   * Schedule: Daily at user's preferred time (default 9 AM)
   */
  async sendDailyDigests(): Promise<void> {
    try {
      logger.info('Starting daily digest sending...');

      // Get users with digest enabled
      const result = await this.db.query(
        `SELECT user_id, daily_digest_time
         FROM notification_preferences
         WHERE enable_daily_digest = true
         AND enable_email = true`
      );

      const users = result.rows;

      for (const user of users) {
        // Get unread notifications for user (non-decision, low priority)
        const notifications = await this.notificationService.getNotifications(
          user.user_id,
          {
            unreadOnly: true,
            limit: 50,
          }
        );

        // Filter for digest-appropriate notifications
        const digestNotifications = notifications.filter(
          (n) =>
            !n.type.startsWith('decision_') &&
            !n.type.startsWith('alert_') &&
            n.priority !== 'high' &&
            n.priority !== 'urgent'
        );

        if (digestNotifications.length > 0) {
          // TODO: Send email with digest
          logger.info('Daily digest sent', {
            userId: user.user_id,
            notificationCount: digestNotifications.length,
          });
        }
      }

      logger.info('Daily digest sending complete');
    } catch (error) {
      logger.error('Error in sendDailyDigests task:', error);
    }
  }

  /**
   * Update deal state tracking for all active deals
   * Schedule: Every hour
   */
  async updateDealStates(): Promise<void> {
    try {
      logger.info('Updating deal state tracking...');

      // Get all active deals
      const result = await this.db.query(
        `SELECT id FROM deals WHERE status = 'active'`
      );

      const deals = result.rows;

      for (const deal of deals) {
        // Ensure deal has state tracking entry
        await this.db.query(
          `INSERT INTO deal_state_tracking (deal_id, current_stage, last_activity_at)
           SELECT d.id, 
                  COALESCE(dp.stage, 'lead') as current_stage,
                  COALESCE(
                    (SELECT MAX(created_at) FROM deal_activity WHERE deal_id = d.id),
                    d.created_at
                  ) as last_activity_at
           FROM deals d
           LEFT JOIN deal_pipeline dp ON d.id = dp.deal_id
           WHERE d.id = $1
           ON CONFLICT (deal_id) DO NOTHING`,
          [deal.id]
        );
      }

      logger.info('Deal state tracking updated', {
        dealsProcessed: deals.length,
      });
    } catch (error) {
      logger.error('Error in updateDealStates task:', error);
    }
  }
}

/**
 * Setup scheduled tasks using cron
 */
export function setupNotificationTasks(db: Pool): void {
  const tasks = new NotificationTasks(db);

  // Using node-cron or similar
  // Example with setInterval (replace with proper cron library)

  // Check stalled deals every 6 hours
  setInterval(
    () => {
      tasks.checkStalledDeals();
    },
    6 * 60 * 60 * 1000
  ); // 6 hours

  // Run immediately on startup
  setTimeout(() => {
    tasks.checkStalledDeals();
  }, 10000); // 10 seconds after startup

  // Cleanup old notifications daily at 2 AM
  const scheduleCleanup = () => {
    const now = new Date();
    const tomorrow2AM = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      2,
      0,
      0
    );
    const msUntil2AM = tomorrow2AM.getTime() - now.getTime();

    setTimeout(() => {
      tasks.cleanupOldNotifications();
      // Schedule next run
      setInterval(
        () => {
          tasks.cleanupOldNotifications();
        },
        24 * 60 * 60 * 1000
      ); // Daily
    }, msUntil2AM);
  };

  scheduleCleanup();

  // Update deal states every hour
  setInterval(
    () => {
      tasks.updateDealStates();
    },
    60 * 60 * 1000
  ); // 1 hour

  // Run immediately on startup
  setTimeout(() => {
    tasks.updateDealStates();
  }, 5000); // 5 seconds after startup

  logger.info('Notification tasks scheduled');
}

/**
 * Example: Proper cron setup with node-cron
 * 
 * import cron from 'node-cron';
 * 
 * export function setupNotificationTasks(db: Pool): void {
 *   const tasks = new NotificationTasks(db);
 *   
 *   // Check stalled deals every 6 hours
 *   cron.schedule('0 *\/6 * * *', () => {
 *     tasks.checkStalledDeals();
 *   });
 *   
 *   // Cleanup old notifications daily at 2 AM
 *   cron.schedule('0 2 * * *', () => {
 *     tasks.cleanupOldNotifications();
 *   });
 *   
 *   // Update deal states every hour
 *   cron.schedule('0 * * * *', () => {
 *     tasks.updateDealStates();
 *   });
 *   
 *   // Send daily digests at 9 AM
 *   cron.schedule('0 9 * * *', () => {
 *     tasks.sendDailyDigests();
 *   });
 *   
 *   logger.info('Notification tasks scheduled');
 * }
 */
