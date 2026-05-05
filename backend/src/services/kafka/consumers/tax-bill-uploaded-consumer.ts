/**
 * Kafka Consumer: tax.bill.uploaded
 *
 * Subscribes to the TAX_BILL_UPLOADED Kafka topic and invalidates ALL fiscal-year
 * parcel cache entries for the affected parcel so the next taxService.forecast()
 * call re-fetches fresh data from ATTOM or the newly uploaded PDF.
 *
 * This is the authoritative event-driven invalidation path. The REST route
 * in context-tracker.routes.ts also fires this Kafka event *and* calls
 * parcelCacheInvalidate() synchronously as a belt-and-suspenders measure.
 *
 * Consumer group: 'tax-bill-cache-invalidation-group'
 * Topics:         tax.bill.uploaded
 */

import { consumerManager, MessageHandler } from '../kafka-consumer-manager.service';
import { KAFKA_TOPICS } from '../event-schemas';
import { parcelCacheInvalidate } from '../../tax/parcelCache';
import { logger } from '../../../utils/logger';
import type { BaseEvent } from '../event-schemas';

// ── Event shape ───────────────────────────────────────────────────────────────

export interface TaxBillUploadedKafkaPayload extends BaseEvent {
  eventType: 'tax_bill_uploaded';
  parcelId: string;
  dealId: string;
  uploadedBy?: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

const taxBillUploadedKafkaHandler: MessageHandler<TaxBillUploadedKafkaPayload> = async (event) => {
  const { parcelId, dealId } = event;

  if (!parcelId) {
    logger.warn('[taxBillUploadedConsumer] Received event with no parcelId — skipping cache invalidation', { dealId });
    return;
  }

  try {
    // Wipe ALL fiscal years so the fresh PDF/ATTOM fetch applies regardless of
    // which year the deal is modelled in.
    await parcelCacheInvalidate(parcelId);
    logger.info('[taxBillUploadedConsumer] Parcel cache invalidated', { parcelId, dealId });
  } catch (err: any) {
    logger.warn('[taxBillUploadedConsumer] Cache invalidation failed', {
      parcelId,
      dealId,
      err: err?.message,
    });
  }
};

// ── Registration ──────────────────────────────────────────────────────────────

export async function registerTaxBillUploadedConsumer(): Promise<void> {
  await consumerManager.registerConsumer({
    groupId: 'tax-bill-cache-invalidation-group',
    name:    'tax-bill-uploaded-handler',
    topics:  [KAFKA_TOPICS.TAX_BILL_UPLOADED],
    handler: taxBillUploadedKafkaHandler as MessageHandler,
    fromBeginning: false,
    autoCommit:    true,
    maxRetries:    3,
  });

  logger.info('[taxBillUploadedConsumer] Consumer registered and running');
}
