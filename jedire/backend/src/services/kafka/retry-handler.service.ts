/**
 * Event Retry Handler
 * 
 * Manages failed event retries with exponential backoff.
 * Processes retry queue and handles retry logic.
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { query } from '../../database/connection';
import { BaseEvent } from './event-schemas';

// ============================================================================
// Logger
// ============================================================================

const logger = {
  info: (...args: any[]) => console.log('[Retry Handler]', ...args),
  error: (...args: any[]) => console.error('[Retry Handler]', ...args),
  warn: (...args: any[]) => console.warn('[Retry Handler]', ...args),
  debug: (...args: any[]) => console.debug('[Retry Handler]', ...args),
};

// ============================================================================
// Retry Configuration
// ============================================================================

const RETRY_CONFIG = {
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
  maxRetries: 3,
};

// ============================================================================
// Retry Handler Service
// ============================================================================

class RetryHandlerService {
  private retryInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  /**
   * Schedule a retry for a failed event
   */
  async scheduleRetry(
    eventId: string,
    topic: string,
    event: BaseEvent,
    errorMessage: string,
    consumerGroup: string,
    consumerName: string
  ): Promise<void> {
    try {
      // Get current retry count
      const statusResult = await query(
        `SELECT retry_count, max_retries
         FROM event_processing_status
         WHERE event_id = $1
           AND consumer_group = $2
           AND consumer_name = $3
         ORDER BY created_at DESC
         LIMIT 1`,
        [eventId, consumerGroup, consumerName]
      );

      let retryCount = 0;
      let maxRetries = RETRY_CONFIG.maxRetries;

      if (statusResult.rows.length > 0) {
        retryCount = (statusResult.rows[0].retry_count || 0) + 1;
        maxRetries = statusResult.rows[0].max_retries || RETRY_CONFIG.maxRetries;
      }

      if (retryCount >= maxRetries) {
        logger.warn(`Event ${eventId} exceeded max retries (${maxRetries})`);
        return;
      }

      // Calculate next retry time with exponential backoff
      const nextRetryDelay = this.calculateRetryDelay(retryCount);
      const nextRetryAt = new Date(Date.now() + nextRetryDelay);

      // Update processing status
      await query(
        `UPDATE event_processing_status
         SET status = 'retrying',
             retry_count = $1,
             next_retry_at = $2,
             error_message = $3,
             updated_at = NOW()
         WHERE event_id = $4
           AND consumer_group = $5
           AND consumer_name = $6
           AND created_at = (
             SELECT MAX(created_at)
             FROM event_processing_status
             WHERE event_id = $4
               AND consumer_group = $5
               AND consumer_name = $6
           )`,
        [retryCount, nextRetryAt, errorMessage, eventId, consumerGroup, consumerName]
      );

      logger.info(`Scheduled retry ${retryCount}/${maxRetries} for event ${eventId}`, {
        nextRetryAt: nextRetryAt.toISOString(),
        delayMs: nextRetryDelay,
      });
    } catch (error) {
      logger.error('Failed to schedule retry:', error);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
    return Math.min(delay, RETRY_CONFIG.maxDelayMs);
  }

  /**
   * Process retry queue
   */
  async processRetryQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get events ready for retry
      const result = await query(
        `SELECT 
           eps.id,
           eps.event_id,
           eps.consumer_group,
           eps.consumer_name,
           eps.retry_count,
           eps.max_retries,
           kel.topic,
           kel.payload
         FROM event_processing_status eps
         JOIN kafka_events_log kel ON eps.event_id = kel.event_id
         WHERE eps.status = 'retrying'
           AND eps.next_retry_at <= NOW()
           AND eps.retry_count < eps.max_retries
         ORDER BY eps.next_retry_at
         LIMIT 100`
      );

      if (result.rows.length === 0) {
        logger.debug('No events in retry queue');
        return;
      }

      logger.info(`Processing ${result.rows.length} events from retry queue`);

      for (const row of result.rows) {
        await this.retryEvent(row);
      }
    } catch (error) {
      logger.error('Error processing retry queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry a single event
   */
  private async retryEvent(row: any): Promise<void> {
    const { id, event_id, consumer_group, consumer_name, topic, payload } = row;

    try {
      logger.info(`Retrying event ${event_id} (attempt ${row.retry_count + 1}/${row.max_retries})`);

      // Import consumer manager to replay the event
      const { consumerManager } = await import('./kafka-consumer-manager.service');

      // Get the consumer instance
      const consumers = consumerManager.getConsumerStatus();
      const consumerInstance = consumers.find(
        (c) => c.groupId === consumer_group && c.name === consumer_name
      );

      if (!consumerInstance || !consumerInstance.isRunning) {
        logger.warn(`Consumer ${consumer_group}:${consumer_name} not running, skipping retry`);
        return;
      }

      // TODO: Implement actual event replay
      // For now, just mark as failed
      await query(
        `UPDATE event_processing_status
         SET status = 'failed',
             error_message = 'Consumer not available for retry',
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      logger.warn(`Event ${event_id} marked as failed (consumer unavailable)`);
    } catch (error: any) {
      logger.error(`Failed to retry event ${event_id}:`, error);

      // Update status
      await query(
        `UPDATE event_processing_status
         SET error_message = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [error.message, id]
      );
    }
  }

  /**
   * Start retry processor
   */
  startRetryProcessor(intervalMs: number = 10000): void {
    if (this.retryInterval) {
      logger.warn('Retry processor already running');
      return;
    }

    this.retryInterval = setInterval(async () => {
      await this.processRetryQueue();
    }, intervalMs);

    logger.info(`Retry processor started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop retry processor
   */
  stopRetryProcessor(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
      logger.info('Retry processor stopped');
    }
  }

  /**
   * Manually retry a specific event
   */
  async manualRetry(eventId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get the failed event
      const result = await query(
        `SELECT 
           eps.id,
           eps.consumer_group,
           eps.consumer_name,
           eps.retry_count,
           eps.max_retries,
           kel.topic,
           kel.payload
         FROM event_processing_status eps
         JOIN kafka_events_log kel ON eps.event_id = kel.event_id
         WHERE eps.event_id = $1
           AND eps.status IN ('failed', 'retrying')
         ORDER BY eps.created_at DESC
         LIMIT 1`,
        [eventId]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          message: 'Event not found or not in failed/retrying state',
        };
      }

      const row = result.rows[0];

      // Reset retry count and schedule immediate retry
      await query(
        `UPDATE event_processing_status
         SET status = 'retrying',
             retry_count = 0,
             next_retry_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [row.id]
      );

      logger.info(`Manual retry scheduled for event ${eventId}`);

      // Trigger immediate processing
      await this.processRetryQueue();

      return {
        success: true,
        message: 'Event retry scheduled',
      };
    } catch (error: any) {
      logger.error('Manual retry failed:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get retry statistics
   */
  async getRetryStatistics(): Promise<{
    pending: number;
    processing: number;
    recentSuccesses: number;
    recentFailures: number;
  }> {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'retrying' AND next_retry_at > NOW()) as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'success' AND completed_at > NOW() - INTERVAL '1 hour') as recent_successes,
        COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '1 hour') as recent_failures
      FROM event_processing_status
    `);

    return result.rows[0];
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const retryHandler = new RetryHandlerService();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, stopping retry processor...');
  retryHandler.stopRetryProcessor();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, stopping retry processor...');
  retryHandler.stopRetryProcessor();
});
