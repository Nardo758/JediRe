import { consumerManager, MessageHandler } from '../kafka-consumer-manager.service';
import { KAFKA_TOPICS } from '../event-schemas';
import { bustM08Cache } from '../../m08-strategies.service';
import { jediScoreService } from '../../jedi-score.service';
import { getPool } from '../../../database/connection';
import { m35TrafficApiService } from '../../m35-traffic-api.service';
import { logger } from '../../utils/logger';

const RECOMPUTE_BATCH = 10;

async function bustAndRecomputeForMsa(msaId: string): Promise<void> {
  try {
    const pool = getPool();
    let offset = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let totalDeals = 0;

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
          jediScoreService.calculateAndSave({ dealId: r.id, tradeAreaId: r.trade_area_id ?? undefined })
        )
      );

      totalSucceeded += results.filter(r => r.status === 'fulfilled').length;
      totalFailed += results.filter(r => r.status === 'rejected').length;
      totalDeals += res.rows.length;
      offset += res.rows.length;

      if (res.rows.length < RECOMPUTE_BATCH) break;
    }

    if (totalDeals > 0) {
      logger.info(`[M35 Event Ingested] MSA ${msaId}: JEDI recomputed ${totalSucceeded}/${totalDeals} deals (${totalFailed} failed)`);
    }
  } catch (err) {
    logger.warn(`[M35 Event Ingested] Failed to bust/recompute for MSA`, { msaId, err });
  }
}

async function updatePipelineSignal(msaId: string): Promise<void> {
  try {
    // Recompute the T-07 event_pipeline_signal for this MSA so downstream
    // consumers (traffic calibration, deal context) see the new event immediately.
    await m35TrafficApiService.computeEventPipelineSignal({ msaId }, 18);
    logger.info(`[M35 Event Ingested] Pipeline signal refreshed for MSA ${msaId}`);
  } catch (err) {
    logger.warn(`[M35 Event Ingested] Pipeline signal refresh failed for MSA`, { msaId, err });
  }
}

const eventIngestedHandler: MessageHandler = async (event: any) => {
  const msaId: string | undefined = event.msaId;
  if (!msaId) {
    logger.warn('[M35 Event Ingested] missing msaId — skipping', { eventId: event.eventId });
    return;
  }

  logger.info('[M35 Event Ingested] processing', {
    eventId: event.eventId,
    msaId,
    category: event.category,
    magnitudeScore: event.magnitudeScore,
  });

  // 1. Bust M08 cache and recompute JEDI scores for all active deals in the MSA
  await bustAndRecomputeForMsa(msaId);

  // 2. Refresh pipeline signal for the MSA
  await updatePipelineSignal(msaId);
};

export async function registerM35EventIngestedConsumer(): Promise<void> {
  await consumerManager.registerConsumer({
    groupId: 'm35-event-ingested-group',
    name: 'm35-event-ingested',
    topics: [KAFKA_TOPICS.M35_EVENT_INGESTED],
    handler: eventIngestedHandler,
    maxRetries: 3,
  });
}
