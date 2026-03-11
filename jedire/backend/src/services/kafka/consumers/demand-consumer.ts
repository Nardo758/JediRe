/**
 * Demand Agent Consumer
 * 
 * Listens to news.events.extracted topic and calculates housing demand
 * for employment, university, and military events.
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { consumerManager, MessageHandler } from '../kafka-consumer-manager.service';
import { NewsEventMessage, KAFKA_TOPICS } from '../event-schemas';
import { demandSignalService } from '../../demand-signal.service';

const logger = {
  info: (...args: any[]) => console.log('[Demand Consumer]', ...args),
  error: (...args: any[]) => console.error('[Demand Consumer]', ...args),
  warn: (...args: any[]) => console.warn('[Demand Consumer]', ...args),
};

// ============================================================================
// Demand Calculator Handler
// ============================================================================

const demandCalculatorHandler: MessageHandler<NewsEventMessage> = async (event, metadata) => {
  logger.info('Processing news event for demand calculation', {
    eventId: event.eventId,
    eventType: event.eventType,
  });

  // Filter: Only process demand-generating events
  const demandEventTypes = ['employment', 'university', 'military'];
  if (!demandEventTypes.includes(event.eventType)) {
    logger.debug(`Skipping non-demand event type: ${event.eventType}`);
    return;
  }

  // Confidence threshold
  if (event.confidence < 60) {
    logger.warn('Skipping low-confidence event', {
      eventId: event.eventId,
      confidence: event.confidence,
    });
    return;
  }

  // Impact threshold
  if (event.magnitude < 50) {
    logger.warn('Skipping low-impact event', {
      eventId: event.eventId,
      magnitude: event.magnitude,
    });
    return;
  }

  try {
    // Determine income tier from event metadata
    const incomeTier = determineIncomeTier(event);

    // Calculate remote work percentage (if applicable)
    const remoteWorkPct = calculateRemoteWorkPct(event);

    // Determine geographic concentration
    const geographicConcentration = calculateGeographicConcentration(event);

    // Create demand event
    const demandEvent = await demandSignalService.createDemandEvent({
      newsEventId: event.eventId,
      headline: event.title,
      sourceUrl: event.sourceUrl,
      publishedAt: new Date(event.announcedDate || event.timestamp),
      category: event.eventType as 'employment' | 'university' | 'military',
      eventType: event.eventType,
      peopleCount: event.magnitude,
      incomeTier,
      remoteWorkPct,
      geographicConcentration,
      msaId: event.msaIds?.[0] ? parseInt(event.msaIds[0]) : undefined,
      submarketId: event.submarketIds?.[0] ? parseInt(event.submarketIds[0]) : undefined,
      geographicTier: event.tradeAreaIds.length > 0 ? 'pin_drop' : 'metro',
    });

    logger.info('Demand event created successfully', {
      newsEventId: event.eventId,
      demandEventId: demandEvent.id,
      totalUnits: demandEvent.totalUnits,
    });
  } catch (error: any) {
    logger.error('Failed to create demand event:', error);
    throw error; // Re-throw to trigger retry logic
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine income tier from news event metadata
 */
function determineIncomeTier(event: NewsEventMessage): 'low' | 'standard' | 'high' | 'luxury' {
  const metadata = event.metadata || {};

  // Check for explicit income tier in metadata
  if (metadata.incomeTier) {
    return metadata.incomeTier;
  }

  // Infer from industry/sector
  const industryMapping: Record<string, 'low' | 'standard' | 'high' | 'luxury'> = {
    technology: 'high',
    tech: 'high',
    software: 'high',
    finance: 'high',
    banking: 'high',
    'venture capital': 'luxury',
    biotech: 'high',
    healthcare: 'standard',
    retail: 'standard',
    hospitality: 'standard',
    manufacturing: 'standard',
    logistics: 'standard',
    warehouse: 'low',
    construction: 'low',
  };

  // Check entities for industry keywords
  const companies = event.entities?.companies || [];
  for (const company of companies) {
    const lowerCompany = company.toLowerCase();
    for (const [keyword, tier] of Object.entries(industryMapping)) {
      if (lowerCompany.includes(keyword)) {
        return tier;
      }
    }
  }

  // Check title/summary for keywords
  const text = `${event.title} ${event.summary}`.toLowerCase();
  for (const [keyword, tier] of Object.entries(industryMapping)) {
    if (text.includes(keyword)) {
      return tier;
    }
  }

  // Default to standard
  return 'standard';
}

/**
 * Calculate remote work percentage from event metadata
 */
function calculateRemoteWorkPct(event: NewsEventMessage): number {
  const metadata = event.metadata || {};

  // Explicit remote work percentage
  if (metadata.remoteWorkPct !== undefined) {
    return metadata.remoteWorkPct;
  }

  // Infer from event type and industry
  if (event.eventType === 'employment') {
    const text = `${event.title} ${event.summary}`.toLowerCase();

    // High remote work industries
    if (text.includes('software') || text.includes('tech') || text.includes('remote')) {
      return 30; // 30% remote
    }

    // Office-based roles
    if (text.includes('office') || text.includes('headquarters')) {
      return 15; // 15% remote
    }

    // On-site required
    if (
      text.includes('manufacturing') ||
      text.includes('warehouse') ||
      text.includes('retail') ||
      text.includes('hospital')
    ) {
      return 0; // 0% remote
    }
  }

  // Default: 10% remote
  return 10;
}

/**
 * Calculate geographic concentration from trade area context
 */
function calculateGeographicConcentration(event: NewsEventMessage): number {
  // If we have specific trade areas, assume high concentration
  if (event.tradeAreaIds && event.tradeAreaIds.length > 0) {
    return 1.0; // 100% concentrated
  }

  // If only MSA-level, assume moderate concentration
  if (event.msaIds && event.msaIds.length > 0) {
    return 0.7; // 70% concentrated
  }

  // Default: low concentration
  return 0.5;
}

// ============================================================================
// Consumer Registration
// ============================================================================

export async function registerDemandConsumer(): Promise<void> {
  await consumerManager.registerConsumer({
    groupId: 'demand-calculation-group',
    name: 'demand-calculator',
    topics: [KAFKA_TOPICS.NEWS_EVENTS],
    handler: demandCalculatorHandler,
    fromBeginning: false,
    autoCommit: true,
    maxRetries: 3,
  });

  logger.info('Demand consumer registered and running');
}
