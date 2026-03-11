/**
 * Kafka Consumer Manager
 * 
 * Orchestrates multiple Kafka consumers, handles message processing,
 * error handling, retries, and health monitoring.
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { Kafka, Consumer, EachMessagePayload, KafkaMessage as KafkaJSMessage } from 'kafkajs';
import { query } from '../../database/connection';
import { BaseEvent, KafkaTopic } from './event-schemas';
import { retryHandler } from './retry-handler.service';

// ============================================================================
// Logger
// ============================================================================

const logger = {
  info: (...args: any[]) => console.log('[Consumer Manager]', ...args),
  error: (...args: any[]) => console.error('[Consumer Manager]', ...args),
  warn: (...args: any[]) => console.warn('[Consumer Manager]', ...args),
  debug: (...args: any[]) => console.debug('[Consumer Manager]', ...args),
};

// ============================================================================
// Types
// ============================================================================

export type MessageHandler<T extends BaseEvent = BaseEvent> = (
  event: T,
  metadata: {
    topic: string;
    partition: number;
    offset: string;
    timestamp: string;
  }
) => Promise<void>;

export interface ConsumerConfig {
  groupId: string;
  topics: KafkaTopic[];
  name: string;
  handler: MessageHandler;
  fromBeginning?: boolean;
  autoCommit?: boolean;
  maxRetries?: number;
}

export interface ConsumerInstance {
  config: ConsumerConfig;
  consumer: Consumer;
  isRunning: boolean;
}

// ============================================================================
// Kafka Configuration
// ============================================================================

const kafka = new Kafka({
  clientId: 'jedire-consumer-manager',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    retries: 8,
    initialRetryTime: 300,
    maxRetryTime: 30000,
  },
  connectionTimeout: 10000,
  requestTimeout: 30000,
});

// ============================================================================
// Consumer Manager Service
// ============================================================================

class KafkaConsumerManager {
  private consumers: Map<string, ConsumerInstance> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Register a new consumer
   */
  async registerConsumer(config: ConsumerConfig): Promise<void> {
    const consumerId = `${config.groupId}:${config.name}`;

    if (this.consumers.has(consumerId)) {
      logger.warn(`Consumer ${consumerId} already registered`);
      return;
    }

    logger.info(`Registering consumer: ${consumerId}`, {
      topics: config.topics,
      groupId: config.groupId,
    });

    const consumer = kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      retry: {
        retries: 5,
      },
    });

    const instance: ConsumerInstance = {
      config,
      consumer,
      isRunning: false,
    };

    this.consumers.set(consumerId, instance);

    // Setup event handlers
    this.setupConsumerHandlers(consumerId, consumer);

    // Connect and subscribe
    await consumer.connect();
    await consumer.subscribe({
      topics: config.topics,
      fromBeginning: config.fromBeginning ?? false,
    });

    // Start consuming
    await consumer.run({
      autoCommit: config.autoCommit ?? true,
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(consumerId, payload, config);
      },
    });

    instance.isRunning = true;
    logger.info(`Consumer ${consumerId} started successfully`);
  }

  /**
   * Setup consumer event handlers
   */
  private setupConsumerHandlers(consumerId: string, consumer: Consumer): void {
    consumer.on('consumer.connect', () => {
      logger.info(`Consumer ${consumerId} connected`);
    });

    consumer.on('consumer.disconnect', () => {
      logger.warn(`Consumer ${consumerId} disconnected`);
      const instance = this.consumers.get(consumerId);
      if (instance) {
        instance.isRunning = false;
      }
    });

    consumer.on('consumer.crash', (event) => {
      logger.error(`Consumer ${consumerId} crashed:`, event.payload.error);
      const instance = this.consumers.get(consumerId);
      if (instance) {
        instance.isRunning = false;
      }
    });

    consumer.on('consumer.rebalancing', () => {
      logger.info(`Consumer ${consumerId} rebalancing...`);
    });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(
    consumerId: string,
    payload: EachMessagePayload,
    config: ConsumerConfig
  ): Promise<void> {
    const { topic, partition, message } = payload;
    const offset = message.offset;

    let event: BaseEvent;
    let eventId: string;

    try {
      // Parse message
      const value = message.value?.toString();
      if (!value) {
        throw new Error('Empty message value');
      }

      event = JSON.parse(value);
      eventId = event.eventId || 'unknown';

      logger.debug(`Processing message from ${topic}`, {
        eventId,
        eventType: event.eventType,
        partition,
        offset,
      });

      // Create processing status record
      const processingId = await this.createProcessingStatus(
        eventId,
        config.groupId,
        config.name
      );

      const startTime = Date.now();

      try {
        // Call the handler
        await config.handler(event, {
          topic,
          partition,
          offset,
          timestamp: message.timestamp,
        });

        // Mark as success
        await this.updateProcessingStatus(processingId, 'success', Date.now() - startTime);

        logger.debug(`Successfully processed event ${eventId}`);
      } catch (handlerError: any) {
        logger.error(`Handler failed for event ${eventId}:`, handlerError);

        // Check if we should retry
        const shouldRetry = await this.shouldRetryEvent(eventId, config.maxRetries || 3);

        if (shouldRetry) {
          // Schedule retry
          await retryHandler.scheduleRetry(
            eventId,
            topic,
            event,
            handlerError.message,
            config.groupId,
            config.name
          );

          await this.updateProcessingStatus(
            processingId,
            'retrying',
            Date.now() - startTime,
            handlerError.message
          );
        } else {
          // Move to DLQ
          await this.sendToDeadLetterQueue(topic, event, handlerError.message);

          await this.updateProcessingStatus(
            processingId,
            'failed',
            Date.now() - startTime,
            handlerError.message
          );
        }

        // Don't throw - we've handled the error
      }

      // Update consumer health
      await this.updateConsumerHealth(config.groupId, config.name, topic, partition, offset);
    } catch (error: any) {
      logger.error(`Fatal error processing message from ${topic}:`, error);
      // This is a parsing/infrastructure error - log and continue
    }
  }

  /**
   * Create processing status record
   */
  private async createProcessingStatus(
    eventId: string,
    consumerGroup: string,
    consumerName: string
  ): Promise<number> {
    const result = await query(
      `INSERT INTO event_processing_status (
        event_id, consumer_group, consumer_name, status
      ) VALUES ($1, $2, $3, 'processing')
      RETURNING id`,
      [eventId, consumerGroup, consumerName]
    );

    return result.rows[0].id;
  }

  /**
   * Update processing status
   */
  private async updateProcessingStatus(
    id: number,
    status: string,
    durationMs: number,
    errorMessage?: string
  ): Promise<void> {
    await query(
      `UPDATE event_processing_status
       SET status = $1,
           completed_at = NOW(),
           error_message = $2
       WHERE id = $3`,
      [status, errorMessage || null, id]
    );
  }

  /**
   * Check if event should be retried
   */
  private async shouldRetryEvent(eventId: string, maxRetries: number): Promise<boolean> {
    const result = await query(
      `SELECT retry_count FROM event_processing_status
       WHERE event_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [eventId]
    );

    if (result.rows.length === 0) {
      return true; // First failure
    }

    const retryCount = result.rows[0].retry_count || 0;
    return retryCount < maxRetries;
  }

  /**
   * Send failed event to dead letter queue
   */
  private async sendToDeadLetterQueue(
    originalTopic: string,
    event: BaseEvent,
    errorMessage: string
  ): Promise<void> {
    try {
      const { kafkaProducer } = await import('./kafka-producer.service');
      
      await kafkaProducer.publish(
        'dlq.failed.events' as KafkaTopic,
        {
          ...event,
          metadata: {
            ...event.metadata,
            dlq: {
              originalTopic,
              errorMessage,
              failedAt: new Date().toISOString(),
            },
          },
        },
        {
          publishedBy: 'consumer-manager',
        }
      );

      logger.info(`Sent event ${event.eventId} to DLQ`);
    } catch (error) {
      logger.error('Failed to send to DLQ:', error);
    }
  }

  /**
   * Update consumer health metrics
   */
  private async updateConsumerHealth(
    consumerGroup: string,
    consumerName: string,
    topic: string,
    partition: number,
    offset: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO consumer_health_status (
          consumer_group, consumer_name, topic, partition,
          current_offset, status, last_heartbeat
        ) VALUES ($1, $2, $3, $4, $5, 'healthy', NOW())
        ON CONFLICT (consumer_group, consumer_name, topic, partition)
        DO UPDATE SET
          current_offset = EXCLUDED.current_offset,
          status = 'healthy',
          last_heartbeat = NOW(),
          messages_processed_last_minute = consumer_health_status.messages_processed_last_minute + 1`,
        [consumerGroup, consumerName, topic, partition, offset]
      );
    } catch (error) {
      logger.error('Failed to update consumer health:', error);
    }
  }

  /**
   * Stop a specific consumer
   */
  async stopConsumer(consumerId: string): Promise<void> {
    const instance = this.consumers.get(consumerId);
    if (!instance) {
      logger.warn(`Consumer ${consumerId} not found`);
      return;
    }

    logger.info(`Stopping consumer: ${consumerId}`);
    await instance.consumer.disconnect();
    instance.isRunning = false;
    this.consumers.delete(consumerId);
  }

  /**
   * Stop all consumers
   */
  async stopAll(): Promise<void> {
    logger.info('Stopping all consumers...');

    const stopPromises = Array.from(this.consumers.keys()).map((id) =>
      this.stopConsumer(id)
    );

    await Promise.all(stopPromises);

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    logger.info('All consumers stopped');
  }

  /**
   * Get consumer status
   */
  getConsumerStatus(): Array<{
    id: string;
    groupId: string;
    name: string;
    topics: KafkaTopic[];
    isRunning: boolean;
  }> {
    return Array.from(this.consumers.entries()).map(([id, instance]) => ({
      id,
      groupId: instance.config.groupId,
      name: instance.config.name,
      topics: instance.config.topics,
      isRunning: instance.isRunning,
    }));
  }

  /**
   * Start health check monitoring
   */
  startHealthCheck(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      logger.debug('Running consumer health check...');
      
      // Check for unhealthy consumers
      const result = await query(
        `SELECT consumer_group, consumer_name, topic, partition, lag
         FROM consumer_health_status
         WHERE last_heartbeat < NOW() - INTERVAL '2 minutes'
            OR lag > 1000`
      );

      if (result.rows.length > 0) {
        logger.warn('Unhealthy consumers detected:', result.rows);
      }
    }, intervalMs);

    logger.info('Health check monitoring started');
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const consumerManager = new KafkaConsumerManager();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, stopping all consumers...');
  await consumerManager.stopAll();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, stopping all consumers...');
  await consumerManager.stopAll();
});
