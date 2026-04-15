/**
 * M35 Forecast Consumer
 *
 * m35.forecast.created  → busts M08 cache and triggers JEDI score recomputation
 *                          for all active deals in the affected MSA.
 * m35.forecast.diverged → logs a warning and busts M08 cache.
 */

import { consumerManager, MessageHandler } from '../kafka-consumer-manager.service';
import { KAFKA_TOPICS, KafkaTopic } from '../event-schemas';
import { bustM08Cache } from '../../m08-strategies.service';
import { jediScoreService } from '../../jedi-score.service';
import { getPool } from '../../../database/connection';

const logger = {
  info:  (...a: any[]) => console.log('[M35 Forecast Consumer]', ...a),
  warn:  (...a: any[]) => console.warn('[M35 Forecast Consumer]', ...a),
  error: (...a: any[]) => console.error('[M35 Forecast Consumer]', ...a),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getDealsForMsa(msaId: string): Promise<Array<{ id: string; tradeAreaId: string | null }>> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT d.id, ta.id AS trade_area_id
     FROM deals d
     LEFT JOIN trade_areas ta ON ta.deal_id = d.id
     WHERE d.deal_data->>'msaId' = $1
       AND d.status NOT IN ('archived','deleted')
     LIMIT 20`,
    [msaId]
  );
  return res.rows.map(r => ({ id: r.id, tradeAreaId: r.trade_area_id ?? null }));
}

async function bustAndRecomputeForMsa(msaId: string): Promise<void> {
  try {
    const deals = await getDealsForMsa(msaId);
    if (deals.length === 0) return;

    for (const deal of deals) {
      bustM08Cache(deal.id);
    }

    // Recompute JEDI scores — M35 forecast-derived weights now incorporated in calculateDemandScore
    const results = await Promise.allSettled(
      deals.map(d =>
        jediScoreService.calculateScore({ dealId: d.id, tradeAreaId: d.tradeAreaId ?? undefined })
      )
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed    = results.filter(r => r.status === 'rejected').length;
    logger.info(`MSA ${msaId}: M08 cache busted, JEDI recomputed ${succeeded}/${deals.length} deals (${failed} failed)`);
  } catch (err) {
    logger.warn('Failed to bust/recompute for MSA', { msaId, err });
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

const forecastCreatedHandler: MessageHandler = async (event: any) => {
  const msaId: string | undefined = event.msaId;
  if (!msaId) {
    logger.warn('m35.forecast.created missing msaId — skipping', { eventId: event.eventId });
    return;
  }
  await bustAndRecomputeForMsa(msaId);
};

const forecastDivergedHandler: MessageHandler = async (event: any) => {
  logger.warn('m35.forecast.diverged received — manual review may be needed', {
    eventId:       event.eventId,
    msaId:         event.msaId,
    metricKey:     event.metricKey,
    windowMonths:  event.windowMonths,
    divergencePct: event.divergencePct,
  });

  const msaId: string | undefined = event.msaId;
  if (msaId) {
    // On divergence, bust caches only — full recompute triggered by operator or next forecast.created
    const pool = getPool();
    const res = await pool.query(
      `SELECT id FROM deals WHERE deal_data->>'msaId' = $1 AND status NOT IN ('archived','deleted') LIMIT 50`,
      [msaId]
    ).catch(() => ({ rows: [] as Array<{ id: string }> }));
    for (const row of res.rows) bustM08Cache(row.id);
  }
};

// ─── Registration ─────────────────────────────────────────────────────────────

export async function registerM35ForecastConsumer(): Promise<void> {
  const createdTopic: KafkaTopic = KAFKA_TOPICS.M35_FORECAST_CREATED;
  const divergedTopic: KafkaTopic = KAFKA_TOPICS.M35_FORECAST_DIVERGED;

  await Promise.all([
    consumerManager.registerConsumer({
      groupId:    'm35-forecast-created-group',
      name:       'm35-forecast-created',
      topics:     [createdTopic],
      handler:    forecastCreatedHandler,
      maxRetries: 3,
    }),
    consumerManager.registerConsumer({
      groupId:    'm35-forecast-diverged-group',
      name:       'm35-forecast-diverged',
      topics:     [divergedTopic],
      handler:    forecastDivergedHandler,
      maxRetries: 3,
    }),
  ]);
}
