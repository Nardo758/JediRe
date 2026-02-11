/**
 * Kafka Consumer: Pro Forma Recalculation
 * 
 * Listens to demand signal updates and automatically recalculates
 * pro forma assumptions for affected deals.
 * 
 * Topics:
 * - signals.demand.updated
 * - signals.supply.updated (Phase 2.1)
 * - signals.momentum.updated (Phase 2.2)
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { proformaAdjustmentService } from '../proforma-adjustment.service';
import { query } from '../../database/connection';

const logger = {
  info: (...args: any[]) => console.log('[ProForma Consumer]', ...args),
  error: (...args: any[]) => console.error('[ProForma Consumer]', ...args),
  warn: (...args: any[]) => console.warn('[ProForma Consumer]', ...args),
};

// ============================================================================
// Kafka Configuration
// ============================================================================

const kafka = new Kafka({
  clientId: 'jedire-proforma-consumer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    retries: 8,
    initialRetryTime: 300,
  },
});

const consumer = kafka.consumer({
  groupId: 'proforma-adjustment-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

// ============================================================================
// Message Handlers
// ============================================================================

interface DemandSignalMessage {
  dealId: string;
  demandEventId: string;
  tradeAreaId: string;
  totalUnits: number;
  confidenceScore: number;
  timestamp: string;
}

interface SupplySignalMessage {
  dealId: string;
  supplyEventId: string;
  tradeAreaId: string;
  pipelineUnits: number;
  deliveryDate: string;
  timestamp: string;
}

/**
 * Handle demand signal updates
 */
async function handleDemandUpdate(message: DemandSignalMessage): Promise<void> {
  const { dealId, demandEventId, totalUnits, confidenceScore } = message;
  
  logger.info('Demand signal update received', { dealId, demandEventId, totalUnits });
  
  // Only recalculate if confidence is high enough and impact is significant
  if (confidenceScore < 60) {
    logger.warn('Skipping recalculation (low confidence)', { dealId, confidenceScore });
    return;
  }
  
  if (Math.abs(totalUnits) < 50) {
    logger.warn('Skipping recalculation (low impact)', { dealId, totalUnits });
    return;
  }
  
  try {
    // Recalculate pro forma
    await proformaAdjustmentService.recalculate({
      dealId,
      triggerType: 'demand_signal',
      triggerEventId: demandEventId,
    });
    
    logger.info('Pro forma recalculated successfully', { dealId });
    
    // Optionally: Send notification to deal owner
    await sendNotification(dealId, {
      type: 'proforma_updated',
      message: `Pro forma assumptions updated based on new demand signal (${totalUnits} units)`,
      demandEventId,
    });
  } catch (error: any) {
    logger.error('Failed to recalculate pro forma', { dealId, error: error.message });
    throw error; // Kafka will retry
  }
}

/**
 * Handle supply signal updates (Phase 2.1)
 */
async function handleSupplyUpdate(message: SupplySignalMessage): Promise<void> {
  const { dealId, supplyEventId, pipelineUnits } = message;
  
  logger.info('Supply signal update received', { dealId, supplyEventId, pipelineUnits });
  
  // Placeholder for Phase 2.1
  // Will integrate with supply tracking system
  
  logger.warn('Supply signal handling not yet implemented (Phase 2.1)');
}

/**
 * Send notification to deal owner
 */
async function sendNotification(dealId: string, notification: any): Promise<void> {
  try {
    // Get deal owner
    const result = await query(
      `SELECT owner_id FROM deals WHERE id = $1`,
      [dealId]
    );
    
    if (result.rows.length === 0) {
      logger.warn('Deal not found for notification', { dealId });
      return;
    }
    
    const ownerId = result.rows[0].owner_id;
    
    if (!ownerId) {
      logger.warn('No owner found for deal', { dealId });
      return;
    }
    
    // Insert notification
    await query(
      `INSERT INTO notifications (
        user_id, type, title, message, metadata, read
      ) VALUES ($1, $2, $3, $4, $5, false)`,
      [
        ownerId,
        notification.type,
        'Pro Forma Updated',
        notification.message,
        JSON.stringify({
          dealId,
          demandEventId: notification.demandEventId,
          timestamp: new Date().toISOString(),
        }),
      ]
    );
    
    logger.info('Notification sent', { dealId, ownerId, type: notification.type });
  } catch (error: any) {
    logger.error('Failed to send notification', { dealId, error: error.message });
    // Don't throw - notification failure shouldn't block recalculation
  }
}

// ============================================================================
// Consumer Setup
// ============================================================================

export async function startProFormaConsumer(): Promise<void> {
  try {
    // Connect consumer
    await consumer.connect();
    logger.info('Kafka consumer connected');
    
    // Subscribe to topics
    await consumer.subscribe({
      topics: [
        'signals.demand.updated',
        'signals.supply.updated', // Phase 2.1
      ],
      fromBeginning: false, // Only new messages
    });
    
    logger.info('Subscribed to topics: signals.demand.updated, signals.supply.updated');
    
    // Start consuming
    await consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        const { topic, partition, message } = payload;
        
        try {
          const messageValue = message.value?.toString();
          
          if (!messageValue) {
            logger.warn('Empty message received', { topic, partition });
            return;
          }
          
          const parsedMessage = JSON.parse(messageValue);
          
          logger.info('Processing message', { 
            topic, 
            partition, 
            offset: message.offset,
            key: message.key?.toString() 
          });
          
          // Route to appropriate handler
          switch (topic) {
            case 'signals.demand.updated':
              await handleDemandUpdate(parsedMessage);
              break;
            
            case 'signals.supply.updated':
              await handleSupplyUpdate(parsedMessage);
              break;
            
            default:
              logger.warn('Unknown topic', { topic });
          }
          
          logger.info('Message processed successfully', { topic, offset: message.offset });
        } catch (error: any) {
          logger.error('Error processing message', {
            topic,
            partition,
            offset: message.offset,
            error: error.message,
          });
          
          // Rethrow to trigger Kafka retry
          throw error;
        }
      },
    });
  } catch (error: any) {
    logger.error('Failed to start Pro Forma consumer', { error: error.message });
    throw error;
  }
}

/**
 * Graceful shutdown
 */
export async function stopProFormaConsumer(): Promise<void> {
  try {
    logger.info('Stopping Pro Forma consumer...');
    await consumer.disconnect();
    logger.info('Pro Forma consumer stopped');
  } catch (error: any) {
    logger.error('Error stopping consumer', { error: error.message });
    throw error;
  }
}

// ============================================================================
// Handle process signals for graceful shutdown
// ============================================================================

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await stopProFormaConsumer();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await stopProFormaConsumer();
  process.exit(0);
});

// ============================================================================
// Export
// ============================================================================

export default {
  start: startProFormaConsumer,
  stop: stopProFormaConsumer,
};
