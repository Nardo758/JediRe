/**
 * divergence-ledger.stub.ts — Piece D ledger write stub
 *
 * Records a divergence observation for the Piece D ledger when it ships.
 * Currently a no-op: the `divergence_observations` table does not exist yet.
 * When T-D1 creates the table, replace this stub with real persistence.
 *
 * The stub is intentionally called at divergence detection time in the
 * field-access service so that wiring debt is eliminated when Piece D ships —
 * not a new call site to find and add, just a stub to fill in.
 */

import { logger } from '../../utils/logger';

export interface DivergenceObservation {
  dealId:       string;
  fieldName:    string;
  alertLevel:   'warn' | 'block';
  resolvedValue: number | null;
  maxAbsDelta:  number;
  pointCount:   number;
  observedAt:   string;
}

/**
 * recordDivergenceObservation — stub for Piece D ledger persistence.
 *
 * Logs the observation at debug level. No database write occurs.
 * Replace with real INSERT when T-D1 creates divergence_observations table.
 *
 * @param obs  The observation to record.
 */
export function recordDivergenceObservation(obs: DivergenceObservation): void {
  logger.debug('divergence-ledger stub: observation (not persisted — T-D1 pending)', {
    dealId:    obs.dealId,
    field:     obs.fieldName,
    alertLevel: obs.alertLevel,
    delta:     obs.maxAbsDelta,
    points:    obs.pointCount,
  });
}
