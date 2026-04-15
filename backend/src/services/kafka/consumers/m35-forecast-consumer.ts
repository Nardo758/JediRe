/**
 * M35 Forecast Consumer
 *
 * Subscribes to m35.forecast.created and m35.forecast.diverged.
 *
 * m35.forecast.created  → bust M08 cache for deals in the affected MSA so the
 *                          next strategy request picks up the new event-timing narrative.
 * m35.forecast.diverged → log a warning so ops can review; future work will
 *                          trigger a score recalculation pipeline.
 */

import { consumerManager, MessageHandler } from '../kafka-consumer-manager.service';
import { KAFKA_TOPICS } from '../event-schemas';
import { bustM08Cache } from '../../m08-strategies.service';
import { getPool } from '../../../database/connection';

const logger = {
  info:  (...a: any[]) => console.log('[M35 Forecast Consumer]', ...a),
  warn:  (...a: any[]) => console.warn('[M35 Forecast Consumer]', ...a),
  error: (...a: any[]) => console.error('[M35 Forecast Consumer]', ...a),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function bustCacheForMsa(msaId: string): Promise<void> {
  try {
    const pool = getPool();
    const res = await pool.query(
      `SELECT id FROM deals WHERE deal_data->>'msaId' = $1 AND status NOT IN ('archived','deleted') LIMIT 50`,
      [msaId]
    );
    for (const row of res.rows) {
      bustM08Cache(row.id);
    }
    if (res.rows.length > 0) {
      logger.info(`Busted M08 cache for ${res.rows.length} deals in MSA ${msaId}`);
    }
  } catch (err) {
    logger.warn('Failed to bust M08 cache for MSA', { msaId, err });
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

const forecastCreatedHandler: MessageHandler = async (event: any) => {
  const msaId: string | undefined = event.msaId;
  if (!msaId) {
    logger.warn('m35.forecast.created missing msaId — skipping cache bust', { eventId: event.eventId });
    return;
  }
  await bustCacheForMsa(msaId);
};

const forecastDivergedHandler: MessageHandler = async (event: any) => {
  logger.warn('m35.forecast.diverged received — manual review may be needed', {
    eventId: event.eventId,
    msaId: event.msaId,
    metricKey: event.metricKey,
    windowMonths: event.windowMonths,
    divergencePct: event.divergencePct,
  });

  const msaId: string | undefined = event.msaId;
  if (msaId) {
    await bustCacheForMsa(msaId);
  }
};

// ─── Registration ─────────────────────────────────────────────────────────────

export async function registerM35ForecastConsumer(): Promise<void> {
  await Promise.all([
    consumerManager.registerConsumer({
      groupId:  'm35-forecast-created-group',
      name:     'm35-forecast-created',
      topics:   [KAFKA_TOPICS.M35_FORECAST_CREATED as any],
      handler:  forecastCreatedHandler,
      maxRetries: 3,
    }),
    consumerManager.registerConsumer({
      groupId:  'm35-forecast-diverged-group',
      name:     'm35-forecast-diverged',
      topics:   [KAFKA_TOPICS.M35_FORECAST_DIVERGED as any],
      handler:  forecastDivergedHandler,
      maxRetries: 3,
    }),
  ]);
}
