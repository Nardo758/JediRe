/**
 * M14 Macro Consumer
 *
 * Listens to `event.classified` and filters to `primary_channel = 'M14_macro'`.
 * On a `rate_move` event: busts the rate-environment cache so the next
 * `classifyRateEnvironment()` call picks up the new key_events overlay.
 *
 * W-07 (Task #729): EP-05 / CE-03 unified M14 macro wiring.
 * Causal Discipline §3.4 — Kafka subscription defined here at the wiring layer,
 * not embedded in the query path of each service.
 *
 * Phase B (corpus-gated): add recession_indicator cache-bust when M28 snapshots
 * gain an invalidation path.
 */

import { consumerManager, MessageHandler } from '../kafka-consumer-manager.service';
import { KAFKA_TOPICS, KafkaTopic } from '../event-schemas';
import { bustRateCache } from '../../debt-advisor/rate-environment.service';

const logger = {
  info:  (...a: any[]) => console.log('[M14 Macro Consumer]', ...a),
  warn:  (...a: any[]) => console.warn('[M14 Macro Consumer]', ...a),
  error: (...a: any[]) => console.error('[M14 Macro Consumer]', ...a),
};

// ─── Handler ──────────────────────────────────────────────────────────────────

const m14MacroHandler: MessageHandler = async (event: any) => {
  // Filter: only process M14_macro channel events.
  if (event.primaryChannel !== 'M14_macro') {
    return;
  }

  const subtype: string = event.subtype ?? '';
  const eventId: string = event.eventId ?? '(unknown)';

  logger.info('M14_macro event classified', { eventId, subtype });

  if (subtype === 'rate_move') {
    // Bust the cached rate classification so the overlay from key_events is
    // picked up on the next call to classifyRateEnvironment().
    bustRateCache();
    logger.info('Rate environment cache busted for rate_move event', { eventId });
    return;
  }

  if (subtype === 'recession_indicator') {
    // Cycle phase is queried live (no persistent cache in getCyclePhase),
    // so no explicit bust is required. Log for observability.
    logger.info('Recession indicator event received — cycle phase will reflect on next query', { eventId });
    return;
  }

  // Other M14_macro subtypes (major_relocation_announcement, regional_shock)
  // are Phase B — log and no-op for Phase A.
  logger.info('M14_macro subtype received (Phase B — no Phase A action)', { eventId, subtype });
};

// ─── Registration ─────────────────────────────────────────────────────────────

export async function registerM14MacroConsumer(): Promise<void> {
  const topic: KafkaTopic = KAFKA_TOPICS.EVENT_CLASSIFIED;

  await consumerManager.registerConsumer({
    groupId:    'm14-macro-event-classified-group',
    name:       'm14-macro-event-classified',
    topics:     [topic],
    handler:    m14MacroHandler,
    maxRetries: 3,
  });

  logger.info('M14 macro consumer registered for topic:', topic);
}
