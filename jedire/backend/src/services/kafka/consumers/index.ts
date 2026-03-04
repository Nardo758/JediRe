/**
 * Kafka Consumers Initialization
 * 
 * Central file to register and start all Kafka consumers for the platform.
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { registerDemandConsumer } from './demand-consumer';
import { registerJEDIScoreConsumer } from './jedi-score-consumer';
import { registerAlertConsumer } from './alert-consumer';
import { consumerManager } from '../kafka-consumer-manager.service';
import { retryHandler } from '../retry-handler.service';

const logger = {
  info: (...args: any[]) => console.log('[Consumers Init]', ...args),
  error: (...args: any[]) => console.error('[Consumers Init]', ...args),
  warn: (...args: any[]) => console.warn('[Consumers Init]', ...args),
};

// ============================================================================
// Initialize All Consumers
// ============================================================================

export async function initializeConsumers(): Promise<void> {
  try {
    logger.info('Initializing Kafka consumers...');

    // Register all consumers
    await Promise.all([
      registerDemandConsumer(),
      registerJEDIScoreConsumer(),
      registerAlertConsumer(),
    ]);

    // Start health check monitoring
    consumerManager.startHealthCheck(60000); // Every minute

    // Start retry processor
    retryHandler.startRetryProcessor(10000); // Every 10 seconds

    logger.info('All Kafka consumers initialized and running');
    logger.info('Consumer status:', consumerManager.getConsumerStatus());
  } catch (error) {
    logger.error('Failed to initialize consumers:', error);
    throw error;
  }
}

// ============================================================================
// Shutdown Handler
// ============================================================================

export async function shutdownConsumers(): Promise<void> {
  logger.info('Shutting down Kafka consumers...');

  try {
    retryHandler.stopRetryProcessor();
    await consumerManager.stopAll();
    logger.info('All consumers shut down successfully');
  } catch (error) {
    logger.error('Error during consumer shutdown:', error);
  }
}

// Graceful shutdown on process termination
process.on('SIGTERM', async () => {
  await shutdownConsumers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownConsumers();
  process.exit(0);
});
