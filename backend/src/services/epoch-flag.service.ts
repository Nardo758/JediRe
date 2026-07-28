/**
 * W1-10: Epoch Flag Event Service
 *
 * Detects mode mismatches (e.g. classified lease_up but occupancy ≥95%)
 * and emits epoch flag events. Consumers bust M08 cache and trigger
 * re-derivation.
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { bustM08Cache } from './m08-strategies.service';
import { inferModelType } from './model-type-inference.service';

const EPOCH_OCCUPANCY_THRESHOLD = 0.95; // 95% sustained occupancy

export interface EpochFlagEvent {
  dealId: string;
  expectedMode: string;
  observedMode: string;
  detectedAt: Date;
  metadata?: {
    occupancyPct?: number;
    t12Months?: number;
    source?: string;
  };
}

/**
 * Check whether a deal's T12 data shows sustained occupancy above the epoch
 * threshold. Returns the average occupancy across the most recent 3 months
 * of T12 rows, or null if insufficient data.
 */
async function getSustainedOccupancy(
  dealId: string,
  pool: Pool,
): Promise<number | null> {
  try {
    const result = await pool.query(
      `SELECT AVG(occupancy_rate) as avg_occ, COUNT(*) as month_count
       FROM (
         SELECT occupancy_rate
         FROM deal_monthly_actuals
         WHERE deal_id = $1
           AND is_budget = false
           AND is_proforma = false
           AND occupancy_rate IS NOT NULL
         ORDER BY report_month DESC
         LIMIT 3
       ) recent`,
      [dealId],
    );
    const row = result.rows[0];
    if (!row || parseInt(row.month_count) < 2) return null;
    return parseFloat(row.avg_occ);
  } catch (err) {
    logger.warn('Error computing sustained occupancy for epoch check', { err, dealId });
    return null;
  }
}

/**
 * W1-10: Detect and emit an epoch flag event when a deal's observed operating
 * mode diverges from its classified mode.
 *
 * Current detection: classified `lease_up` but sustained occupancy ≥95%
 *   → the deal has likely stabilized and should be re-analyzed.
 *
 * Side effect: busts M08 cache so the next strategy analysis is recomputed.
 *
 * @returns The emitted event if a mismatch was detected, null otherwise.
 */
export async function detectAndEmitEpochFlag(
  dealId: string,
  pool: Pool,
): Promise<EpochFlagEvent | null> {
  const classifiedMode = await inferModelType(dealId);

  // Only check lease_up deals for now (the primary epoch mismatch)
  if (classifiedMode !== 'lease_up') {
    return null;
  }

  const sustainedOccupancy = await getSustainedOccupancy(dealId, pool);
  if (sustainedOccupancy === null) {
    return null; // Insufficient T12 data
  }

  if (sustainedOccupancy < EPOCH_OCCUPANCY_THRESHOLD) {
    return null; // Not yet stabilized
  }

  // Mismatch detected: classified lease_up but occupancy is ≥95%
  const event: EpochFlagEvent = {
    dealId,
    expectedMode: classifiedMode,
    observedMode: 'stabilized',
    detectedAt: new Date(),
    metadata: {
      occupancyPct: Math.round(sustainedOccupancy * 1000) / 1000,
      source: 'sustained_occupancy_t12',
    },
  };

  // Persist the event (append-only log)
  try {
    await pool.query(
      `INSERT INTO deal_epoch_events (deal_id, expected_mode, observed_mode, detected_at, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [event.dealId, event.expectedMode, event.observedMode, event.detectedAt, JSON.stringify(event.metadata)],
    );
  } catch (err) {
    logger.warn('Failed to persist epoch flag event', { err, dealId });
    // Non-blocking: continue to bust cache even if persist fails
  }

  // Consumer: bust M08 cache so next analysis is recomputed
  bustM08Cache(dealId);
  logger.info('W1-10: Epoch flag emitted — M08 cache busted', {
    dealId,
    expectedMode: event.expectedMode,
    observedMode: event.observedMode,
    occupancyPct: event.metadata?.occupancyPct,
  });

  return event;
}

/**
 * W1-10: Query the most recent epoch flag event for a deal.
 */
export async function getLatestEpochFlag(
  dealId: string,
  pool: Pool,
): Promise<EpochFlagEvent | null> {
  try {
    const result = await pool.query(
      `SELECT deal_id, expected_mode, observed_mode, detected_at, metadata
       FROM deal_epoch_events
       WHERE deal_id = $1
       ORDER BY detected_at DESC
       LIMIT 1`,
      [dealId],
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      dealId: r.deal_id,
      expectedMode: r.expected_mode,
      observedMode: r.observed_mode,
      detectedAt: r.detected_at,
      metadata: r.metadata,
    };
  } catch (err) {
    logger.warn('Error fetching latest epoch flag', { err, dealId });
    return null;
  }
}
