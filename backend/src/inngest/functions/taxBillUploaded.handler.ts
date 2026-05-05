/**
 * Inngest Event Handler: tax/bill.uploaded
 *
 * Triggered when a tax bill document is uploaded for a deal (via the
 * TAX_BILL_UPLOADED Kafka event, which is bridged to Inngest by the
 * document upload route).
 *
 * Responsibility:
 *   - Invalidate ALL fiscal-year cache entries for the parcel so the next
 *     taxService.forecast() call re-fetches fresh data from ATTOM or the
 *     newly uploaded PDF.
 *
 * This is the authoritative consumer path for cache invalidation.
 * The REST route also calls parcelCacheInvalidate directly as a
 * belt-and-suspenders measure, but this handler ensures the event-driven
 * contract is met independently of the upload request lifecycle.
 *
 * Event payload: { parcelId: string; dealId: string; uploadedBy: string }
 */

import { inngest } from '../../lib/inngest';
import { parcelCacheInvalidate } from '../../services/tax/parcelCache';
import { logger } from '../../utils/logger';

export const TAX_BILL_UPLOADED_EVENT = 'tax/bill.uploaded' as const;

export interface TaxBillUploadedEvent {
  name: typeof TAX_BILL_UPLOADED_EVENT;
  data: {
    parcelId: string;
    dealId: string;
    uploadedBy?: string;
  };
}

export const taxBillUploadedHandler = inngest.createFunction(
  {
    id: 'tax-bill-uploaded-invalidate-parcel-cache',
    name: 'Tax: invalidate parcel cache on tax bill upload',
    triggers: [{ event: TAX_BILL_UPLOADED_EVENT }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { parcelId, dealId } = event.data;

    if (!parcelId) {
      logger.warn('[taxBillUploaded] No parcelId in event payload — skipping cache invalidation', { dealId });
      return { skipped: true, reason: 'no_parcel_id' };
    }

    await step.run('invalidate-parcel-cache', async () => {
      // Invalidate ALL fiscal years so the upload takes effect regardless of
      // which fiscal year the deal is modelled in (see parcelCache.ts).
      await parcelCacheInvalidate(parcelId);
      logger.info('[taxBillUploaded] Parcel cache invalidated', { parcelId, dealId });
    });

    return { invalidated: true, parcelId, dealId };
  },
);
