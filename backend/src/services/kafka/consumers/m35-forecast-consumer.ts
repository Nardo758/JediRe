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

const RECOMPUTE_BATCH = 10; // concurrency cap per page

async function bustAndRecomputeForMsa(msaId: string): Promise<void> {
  try {
    const pool = getPool();
    let offset = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let totalDeals = 0;

    // Paginate through all active deals in the MSA — no hard cap on total count.
    while (true) {
      const res = await pool.query(
        `SELECT d.id, ta.id AS trade_area_id
         FROM deals d
         LEFT JOIN trade_areas ta ON ta.deal_id = d.id
         WHERE d.deal_data->>'msaId' = $1
           AND d.status NOT IN ('archived','deleted')
         LIMIT $2 OFFSET $3`,
        [msaId, RECOMPUTE_BATCH, offset]
      );
      if (res.rows.length === 0) break;

      for (const row of res.rows) bustM08Cache(row.id);

      const results = await Promise.allSettled(
        res.rows.map(r =>
          jediScoreService.calculateScore({ dealId: r.id, tradeAreaId: r.trade_area_id ?? undefined })
        )
      );

      totalSucceeded += results.filter(r => r.status === 'fulfilled').length;
      totalFailed    += results.filter(r => r.status === 'rejected').length;
      totalDeals     += res.rows.length;
      offset         += res.rows.length;

      if (res.rows.length < RECOMPUTE_BATCH) break;
    }

    if (totalDeals > 0) {
      logger.info(`MSA ${msaId}: JEDI recomputed ${totalSucceeded}/${totalDeals} deals (${totalFailed} failed)`);
    }
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
    // On divergence, bust caches only — full recompute triggered by operator or next forecast.created.
    // Paginate to cover all deals without a hard cap.
    const pool = getPool();
    let pg = 0;
    while (true) {
      const res = await pool.query(
        `SELECT id FROM deals WHERE deal_data->>'msaId' = $1 AND status NOT IN ('archived','deleted') LIMIT 50 OFFSET $2`,
        [msaId, pg * 50]
      ).catch(() => ({ rows: [] as Array<{ id: string }> }));
      if (res.rows.length === 0) break;
      for (const row of res.rows) bustM08Cache(row.id);
      if (res.rows.length < 50) break;
      pg++;
    }
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
