/**
 * RealizedOutputsService — Backfill Realized Outputs (Stub)
 *
 * Phase 2 implementation. When fully implemented, this service:
 *
 *   1. For a given parcel, queries historical_observations rows ordered by date
 *   2. For each row that has a later row at T+3, T+12, T+24:
 *        - Computes realized_rent_change_t*  = (later_rent - current_rent) / current_rent
 *        - Computes realized_occupancy_change_t* = later_occupancy - current_occupancy
 *        - Updates the realized columns on the earlier row
 *   3. Sets realization_complete = TRUE once T+24 has been computed
 *
 * This is triggered:
 *   - On every new property performance insertion (via trigger)
 *   - On a nightly Inngest cron for rows that just hit their T+N anniversary
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 4.2, Section 7
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export class RealizedOutputsService {
  /**
   * Backfill realized_* columns for all rows at the given parcel that
   * have a later observation at T+3, T+12, or T+24.
   *
   * Currently a stub — returns 0.
   *
   * Full implementation planned for Phase 2.
   */
  async backfillForParcel(parcelId: string): Promise<number> {
    logger.info(
      '[RealizedOutputsService] backfillForParcel — stub, not yet implemented',
      { parcelId },
    );
    return 0;
  }

  /**
   * Backfill realized_* columns for ALL rows in the corpus where the
   * observation date is past the T+N window but realized columns are null.
   *
   * Runs nightly via Inngest cron. Currently a stub — returns 0.
   */
  async backfillAllOverdue(): Promise<{ processed: number; errors: number }> {
    logger.info(
      '[RealizedOutputsService] backfillAllOverdue — stub, not yet implemented',
    );
    return { processed: 0, errors: 0 };
  }
}

export const realizedOutputsService = new RealizedOutputsService();
