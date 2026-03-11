/**
 * Unified Kafka Producer Service
 * 
 * Central service for publishing events to Kafka topics.
 * Handles connection management, error handling, and event logging.
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { Kafka, Producer, ProducerRecord, RecordMetadata } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../database/connection';
import {
  BaseEvent,
  KafkaMessage,
  KafkaTopic,
  validateEvent,
} from './event-schemas';

// ============================================================================
// Logger
// ============================================================================

const logger = {
  info: (...args: any[]) => console.log('[Kafka Producer]', ...args),
  error: (...args: any[]) => console.error('[Kafka Producer]', ...args),
  warn: (...args: any[]) => console.warn('[Kafka Producer]', ...args),
  debug: (...args: any[]) => console.debug('[Kafka Producer]', ...args),
};

// ============================================================================
// Kafka Configuration
// ============================================================================

const kafka = new Kafka({
  clientId: 'jedire-producer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    retries: 5,
    initialRetryTime: 300,
    maxRetryTime: 30000,
  },
  connectionTimeout: 10000,
  requestTimeout: 30000,
});

// ============================================================================
// Producer Service
// ============================================================================

class KafkaProducerService {
  private producer: Producer;
  private connected: boolean = false;
  private connecting: boolean = false;

  constructor() {
    this.producer = kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
      maxInFlightRequests: 5,
      idempotent: true, // Ensure exactly-once delivery
      compression: 1, // GZIP compression
    });

    this.setupEventHandlers();
  }

  /**
   * Setup producer event handlers
   */
  private setupEventHandlers(): void {
    this.producer.on('producer.connect', () => {
      logger.info('Producer connected to Kafka');
      this.connected = true;
      this.connecting = false;
    });

    this.producer.on('producer.disconnect', () => {
      logger.warn('Producer disconnected from Kafka');
      this.connected = false;
    });

    this.producer.on('producer.network.request_timeout', (payload) => {
      logger.error('Request timeout:', payload);
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.connecting) {
      // Wait for existing connection attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.connect();
    }

    try {
      this.connecting = true;
      await this.producer.connect();
      logger.info('Kafka producer connected successfully');
    } catch (error) {
      this.connecting = false;
      logger.error('Failed to connect producer:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.producer.disconnect();
      logger.info('Kafka producer disconnected');
    } catch (error) {
      logger.error('Error disconnecting producer:', error);
      throw error;
    }
  }

  /**
   * Publish a single event to Kafka
   */
  async publish<T extends BaseEvent>(
    topic: KafkaTopic,
    event: T,
    options: {
      key?: string;
      partition?: number;
      headers?: Record<string, string>;
      publishedBy?: string;
    } = {}
  ): Promise<RecordMetadata[]> {
    // Ensure connection
    await this.connect();

    // Validate event
    const validation = validateEvent(event);
    if (!validation.valid) {
      throw new Error(`Invalid event: ${validation.errors.join(', ')}`);
    }

    // Ensure event has ID and timestamp
    if (!event.eventId) {
      event.eventId = uuidv4();
    }
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Default key to eventId if not provided
    const key = options.key || event.eventId;

    try {
      // Publish to Kafka
      const result = await this.producer.send({
        topic,
        messages: [
          {
            key,
            value: JSON.stringify(event),
            partition: options.partition,
            headers: {
              ...options.headers,
              eventId: event.eventId,
              eventType: event.eventType,
              timestamp: event.timestamp,
            },
          },
        ],
      });

      // Log to database
      await this.logEvent(topic, event, result[0], options.publishedBy || 'unknown');

      logger.info(`Published event to ${topic}`, {
        eventId: event.eventId,
        eventType: event.eventType,
        partition: result[0].partition,
        offset: result[0].offset,
      });

      return result;
    } catch (error) {
      logger.error(`Failed to publish event to ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Publish multiple events in a batch
   */
  async publishBatch<T extends BaseEvent>(
    topic: KafkaTopic,
    events: T[],
    options: {
      publishedBy?: string;
      getKey?: (event: T) => string;
    } = {}
  ): Promise<RecordMetadata[]> {
    await this.connect();

    const messages = events.map((event) => {
      // Validate each event
      const validation = validateEvent(event);
      if (!validation.valid) {
        throw new Error(`Invalid event ${event.eventId}: ${validation.errors.join(', ')}`);
      }

      // Ensure event has ID and timestamp
      if (!event.eventId) {
        event.eventId = uuidv4();
      }
      if (!event.timestamp) {
        event.timestamp = new Date().toISOString();
      }

      const key = options.getKey ? options.getKey(event) : event.eventId;

      return {
        key,
        value: JSON.stringify(event),
        headers: {
          eventId: event.eventId,
          eventType: event.eventType,
          timestamp: event.timestamp,
        },
      };
    });

    try {
      const results = await this.producer.send({
        topic,
        messages,
      });

      // Log all events to database
      await Promise.all(
        events.map((event, index) =>
          this.logEvent(topic, event, results[index], options.publishedBy || 'unknown')
        )
      );

      logger.info(`Published ${events.length} events to ${topic}`);

      return results;
    } catch (error) {
      logger.error(`Failed to publish batch to ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Log event to database for audit trail
   */
  private async logEvent<T extends BaseEvent>(
    topic: string,
    event: T,
    metadata: RecordMetadata,
    publishedBy: string
  ): Promise<void> {
    try {
      // Extract geographic context if available
      const tradeAreaIds = (event as any).tradeAreaIds || (event as any).tradeAreaId ? [(event as any).tradeAreaId] : null;
      const submarketIds = (event as any).submarketIds || null;
      const msaIds = (event as any).msaIds || null;
      const dealId = (event as any).dealId || null;
      const magnitude = (event as any).magnitude || (event as any).housingUnitsNeeded || (event as any).pipelineUnits || null;
      const confidence = (event as any).confidence || (event as any).confidenceScore || null;

      await query(
        `INSERT INTO kafka_events_log (
          event_id, topic, event_type, payload,
          trade_area_ids, submarket_ids, msa_ids, deal_id,
          published_by, partition, offset,
          magnitude, confidence_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          event.eventId,
          topic,
          event.eventType,
          JSON.stringify(event),
          tradeAreaIds,
          submarketIds,
          msaIds,
          dealId,
          publishedBy,
          metadata.partition,
          metadata.offset,
          magnitude,
          confidence,
        ]
      );
    } catch (error) {
      logger.error('Failed to log event to database:', error);
      // Don't throw - logging failure shouldn't break event publishing
    }
  }

  /**
   * Create a cascade trace entry
   */
  async createCascadeTrace(
    rootEventId: string,
    parentEventId: string | null,
    currentEventId: string,
    depth: number = 0
  ): Promise<void> {
    try {
      // Get the cascade path from parent (if exists)
      let cascadePath: string[];
      
      if (parentEventId) {
        const parentTrace = await query(
          'SELECT cascade_path FROM event_cascade_trace WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1',
          [parentEventId]
        );
        
        if (parentTrace.rows.length > 0) {
          cascadePath = [...parentTrace.rows[0].cascade_path, currentEventId];
        } else {
          cascadePath = [rootEventId, currentEventId];
        }
      } else {
        cascadePath = [currentEventId];
      }

      await query(
        `INSERT INTO event_cascade_trace (
          root_event_id, event_id, parent_event_id, depth, cascade_path
        ) VALUES ($1, $2, $3, $4, $5)`,
        [rootEventId, currentEventId, parentEventId, depth, cascadePath]
      );

      logger.debug(`Created cascade trace: ${cascadePath.join(' → ')}`);
    } catch (error) {
      logger.error('Failed to create cascade trace:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.connect();
      return this.connected;
    } catch (error) {
      logger.error('Health check failed:', error);
      return false;
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const kafkaProducer = new KafkaProducerService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, disconnecting Kafka producer...');
  await kafkaProducer.disconnect();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, disconnecting Kafka producer...');
  await kafkaProducer.disconnect();
});
