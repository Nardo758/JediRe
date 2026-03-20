/**
 * JEDI Score Consumer
 * 
 * Listens to demand, supply, and risk signals and recalculates
 * JEDI Scores for affected deals.
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { consumerManager, MessageHandler } from '../kafka-consumer-manager.service';
import {
  DemandSignalMessage,
  SupplySignalMessage,
  RiskSignalMessage,
  KAFKA_TOPICS,
} from '../event-schemas';
import { jediScoreService } from '../../jedi-score.service';
import { kafkaProducer } from '../kafka-producer.service';

const logger = {
  info: (...args: any[]) => console.log('[JEDI Consumer]', ...args),
  error: (...args: any[]) => console.error('[JEDI Consumer]', ...args),
  warn: (...args: any[]) => console.warn('[JEDI Consumer]', ...args),
};

// ============================================================================
// JEDI Score Recalculation Handler
// ============================================================================

const jediScoreHandler: MessageHandler = async (event: any, metadata) => {
  logger.info('Processing signal for JEDI score update', {
    eventId: event.eventId,
    topic: metadata.topic,
  });

  // Extract deal ID and trade area ID
  const dealId = event.dealId;
  const tradeAreaId = event.tradeAreaId;

  if (!dealId && !tradeAreaId) {
    logger.warn('No deal ID or trade area ID in event, skipping', {
      eventId: event.eventId,
    });
    return;
  }

  try {
    // Recalculate JEDI score
    const result = await jediScoreService.calculateScore({
      dealId,
      tradeAreaId,
      triggeringEventId: event.eventId,
      context: {
        demandSignal: metadata.topic === KAFKA_TOPICS.DEMAND_SIGNALS ? event : undefined,
        supplySignal: metadata.topic === KAFKA_TOPICS.SUPPLY_SIGNALS ? event : undefined,
        riskSignal: metadata.topic === KAFKA_TOPICS.RISK_SIGNALS ? event : undefined,
      },
    });

    logger.info('JEDI score recalculated', {
      dealId,
      tradeAreaId,
      previousScore: result.previousScore,
      newScore: result.jediScore,
      delta: result.scoreDelta,
    });

    // Publish JEDI score update
    await kafkaProducer.publish(
      KAFKA_TOPICS.JEDI_SCORES,
      {
        eventId: result.scoreId,
        eventType: result.scoreDelta && Math.abs(result.scoreDelta) > 5
          ? 'jedi_significant_change'
          : 'jedi_calculated',
        timestamp: new Date().toISOString(),
        scoreId: result.scoreId,
        dealId: result.dealId,
        tradeAreaId: result.tradeAreaId,
        jediScore: result.jediScore,
        previousScore: result.previousScore,
        scoreDelta: result.scoreDelta,
        components: result.components,
        grade: result.grade,
        tier: result.tier,
        confidenceScore: result.confidenceScore || 80,
        triggeringEventIds: [event.eventId],
      },
      {
        key: dealId || tradeAreaId,
        publishedBy: 'jedi-score-consumer',
      }
    );

    // Create cascade trace
    await kafkaProducer.createCascadeTrace(
      event.triggeringEventId || event.eventId,
      event.eventId,
      result.scoreId,
      2 // Typically 2 levels deep (news -> signal -> jedi)
    );
  } catch (error: any) {
    logger.error('Failed to recalculate JEDI score:', error);
    throw error;
  }
};

// ============================================================================
// Consumer Registration
// ============================================================================

export async function registerJEDIScoreConsumer(): Promise<void> {
  await consumerManager.registerConsumer({
    groupId: 'jedi-score-group',
    name: 'jedi-score-calculator',
    topics: [
      KAFKA_TOPICS.DEMAND_SIGNALS,
      KAFKA_TOPICS.SUPPLY_SIGNALS,
      KAFKA_TOPICS.RISK_SIGNALS,
    ],
    handler: jediScoreHandler,
    fromBeginning: false,
    autoCommit: true,
    maxRetries: 3,
  });

  logger.info('JEDI score consumer registered and running');
}
