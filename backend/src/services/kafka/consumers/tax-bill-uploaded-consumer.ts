/**
 * Kafka Consumer: tax.bill.uploaded
 *
 * Subscribes to the TAX_BILL_UPLOADED Kafka topic and:
 *   1. Invalidates ALL fiscal-year parcel cache entries for the affected parcel
 *      so the next taxService.forecast() call re-fetches fresh data.
 *   2. Triggers tax reconciliation: compares the newly arrived actual tax bill
 *      against the active projection and stores reconciliation state (D3-W7).
 *
 * Consumer group: 'tax-bill-cache-invalidation-group'
 * Topics:         tax.bill.uploaded
 */

import { consumerManager, MessageHandler } from '../kafka-consumer-manager.service';
import { KAFKA_TOPICS } from '../event-schemas';
import { parcelCacheInvalidate } from '../../tax/parcelCache';
import { logger } from '../../../utils/logger';
import type { BaseEvent } from '../event-schemas';
import { getPool } from '../../../database/connection';
import {
  computeTaxReconciliation,
  extractActualTaxFromBill,
} from '../../tax-reconciliation.service';
import { taxProjectionService } from '../../tax/taxProjection.service';

// ── Event shape ───────────────────────────────────────────────────────────────

export interface TaxBillUploadedKafkaPayload extends BaseEvent {
  eventType: 'tax_bill_uploaded';
  parcelId: string;
  dealId: string;
  uploadedBy?: string;
  /** Optional extracted tax data from the upload pipeline. */
  extractedData?: Record<string, unknown>;
}

// ── Handler ───────────────────────────────────────────────────────────────────

const taxBillUploadedKafkaHandler: MessageHandler<TaxBillUploadedKafkaPayload> = async (event) => {
  const { parcelId, dealId, extractedData } = event;

  if (!parcelId) {
    logger.warn('[taxBillUploadedConsumer] Received event with no parcelId — skipping', { dealId });
    return;
  }

  // ── Phase 1: Cache invalidation (existing behavior) ─────────────────────────
  try {
    await parcelCacheInvalidate(parcelId);
    logger.info('[taxBillUploadedConsumer] Parcel cache invalidated', { parcelId, dealId });
  } catch (err: any) {
    logger.warn('[taxBillUploadedConsumer] Cache invalidation failed', {
      parcelId, dealId, err: err?.message,
    });
  }

  // ── Phase 2: Tax reconciliation (D3-W7) ────────────────────────────────────
  try {
    // 1. Get the latest projection for this deal
    const projection = await taxProjectionService.getProjectionByDeal(dealId);
    if (!projection) {
      logger.info('[taxBillUploadedConsumer] No active tax projection for deal — skipping reconciliation', { dealId });
      return;
    }

    // 2. Determine actual annual tax: from event payload OR fetch from DB
    let actualTax: number | null = null;
    let taxSource = 'unknown';

    if (extractedData) {
      const extracted = extractActualTaxFromBill(extractedData);
      if (extracted) {
        actualTax = extracted.annualTax;
        taxSource = extracted.source;
      }
    }

    // Fallback: query property_tax_records for the latest actual
    if (actualTax == null) {
      const pool = getPool();
      const ptrRes = await pool.query(
        `SELECT total_tax_amount, data_source
           FROM property_tax_records
          WHERE parcel_id = $1
          ORDER BY tax_year DESC, created_at DESC
          LIMIT 1`,
        [parcelId],
      );
      if (ptrRes.rows.length > 0) {
        actualTax = parseFloat(ptrRes.rows[0].total_tax_amount);
        taxSource = ptrRes.rows[0].data_source ?? 'property_tax_records';
      }
    }

    if (actualTax == null) {
      logger.info('[taxBillUploadedConsumer] No actual tax amount found — skipping reconciliation', { dealId, parcelId });
      return;
    }

    // 3. Compute and store reconciliation
    const recon = await computeTaxReconciliation({
      dealId,
      projectedAnnualTax: projection.projected_total_tax,
      actualAnnualTax: actualTax,
      projectionId: projection.id,
      taxBillSource: taxSource,
      actualProvenance: { parcelId, source: taxSource, uploadedAt: new Date().toISOString() },
    });

    logger.info('[taxBillUploadedConsumer] Tax reconciliation computed', {
      dealId,
      reconId: recon.id,
      status: recon.status,
      variancePct: recon.variancePct,
      isMaterial: recon.isMaterial,
      recommendation: recon.recommendation,
    });
  } catch (err: any) {
    logger.error('[taxBillUploadedConsumer] Tax reconciliation failed', {
      dealId, parcelId, err: err?.message,
    });
    // Non-fatal: cache invalidation already succeeded; reconciliation failure
    // is logged but doesn't roll back cache invalidation.
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
