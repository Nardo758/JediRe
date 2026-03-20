/**
 * Email Sync Scheduler
 * Automatically syncs Gmail accounts at configured intervals
 */

import { query } from '../database/connection';
import { gmailSyncService } from './gmail-sync.service';
import { logger } from '../utils/logger';

class EmailSyncScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private syncIntervalMinutes: number = 15;

  /**
   * Start the scheduler
   */
  start(intervalMinutes: number = 15): void {
    if (this.isRunning) {
      logger.warn('Email sync scheduler is already running');
      return;
    }

    this.syncIntervalMinutes = intervalMinutes;
    this.isRunning = true;

    // Run immediately on start
    this.syncAllAccounts();

    // Schedule periodic syncs
    this.intervalId = setInterval(() => {
      this.syncAllAccounts();
    }, this.syncIntervalMinutes * 60 * 1000);

    logger.info(`Email sync scheduler started (interval: ${intervalMinutes} minutes)`);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('Email sync scheduler stopped');
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    intervalMinutes: number;
  } {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.syncIntervalMinutes,
    };
  }

  /**
   * Sync all enabled accounts
   */
  private async syncAllAccounts(): Promise<void> {
    try {
      logger.info('Starting scheduled email sync for all accounts');

      // Get all accounts that need syncing
      const result = await query(
        `SELECT id, email_address, sync_frequency_minutes, last_sync_at
         FROM user_email_accounts
         WHERE provider = 'google' 
           AND sync_enabled = true
         ORDER BY last_sync_at ASC NULLS FIRST`
      );

      const accounts = result.rows;

      if (accounts.length === 0) {
        logger.info('No accounts to sync');
        return;
      }

      logger.info(`Found ${accounts.length} accounts to sync`);

      // Sync each account
      for (const account of accounts) {
        try {
          // Check if account is due for sync based on its frequency
          if (this.isAccountDueForSync(account)) {
            logger.info(`Syncing account: ${account.email_address}`);
            const result = await gmailSyncService.syncEmails(account.id, 50);
            logger.info(
              `Synced ${account.email_address}: ${result.stored} stored, ${result.skipped} skipped`
            );
          } else {
            logger.debug(`Skipping ${account.email_address} - not due for sync yet`);
          }
        } catch (error) {
          logger.error(`Failed to sync account ${account.email_address}:`, error);
          // Continue with next account even if one fails
        }
      }

      logger.info('Scheduled email sync completed');
    } catch (error) {
      logger.error('Error in scheduled email sync:', error);
    }
  }

  /**
   * Check if account is due for sync
   */
  private isAccountDueForSync(account: any): boolean {
    if (!account.last_sync_at) {
      // Never synced - definitely due
      return true;
    }

    const lastSyncTime = new Date(account.last_sync_at).getTime();
    const now = Date.now();
    const frequencyMs = account.sync_frequency_minutes * 60 * 1000;
    const timeSinceLastSync = now - lastSyncTime;

    return timeSinceLastSync >= frequencyMs;
  }

  /**
   * Manually trigger sync for all accounts (bypass frequency check)
   */
  async syncAllNow(): Promise<{
    total: number;
    successful: number;
    failed: number;
  }> {
    const result = await query(
      `SELECT id, email_address
       FROM user_email_accounts
       WHERE provider = 'google' AND sync_enabled = true`
    );

    const accounts = result.rows;
    let successful = 0;
    let failed = 0;

    for (const account of accounts) {
      try {
        await gmailSyncService.syncEmails(account.id, 50);
        successful++;
      } catch (error) {
        logger.error(`Failed to sync ${account.email_address}:`, error);
        failed++;
      }
    }

    return {
      total: accounts.length,
      successful,
      failed,
    };
  }
}

export const emailSyncScheduler = new EmailSyncScheduler();
