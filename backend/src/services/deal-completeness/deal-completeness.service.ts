/**
 * Deal Completeness Service (Piece C1)
 *
 * Evaluates all signals in the registry for a given deal and assembles the
 * DealCompleteness snapshot.  Results are NOT cached — the endpoint is
 * lightweight and callers (UI badge) refresh on page load only.
 *
 * Acknowledgement storage uses the `deal_signal_acknowledgements` table so
 * that operators can mark a signal as "known gap, proceeding anyway" without
 * resolving the underlying condition.
 */

import { Pool } from 'pg';
import { logger } from '../../utils/logger';
import type { DealCompleteness, SignalState, OverallStatus } from '../../types/deal-completeness';
import { getSignalRegistry } from './signal-registry';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute the completeness snapshot for a deal.
 * Runs all signal checks in parallel and aggregates results.
 */
export async function evaluateCompleteness(
  pool:   Pool,
  dealId: string,
  userId: string,
): Promise<DealCompleteness> {
  const registry = getSignalRegistry();

  // Resolve deal's property_id once (needed for M07 check)
  const dealRow = await pool.query<{ property_id: string | null }>(
    `SELECT property_id FROM deals WHERE id = $1 LIMIT 1`,
    [dealId],
  );
  const propertyId: string | null = dealRow.rows[0]?.property_id ?? null;

  // Load all acknowledgements for this deal in a single query
  const ackRows = await pool.query<{
    signal_id: string;
    acknowledged_at: string;
    user_id: string;
  }>(
    `SELECT signal_id, acknowledged_at, user_id
     FROM deal_signal_acknowledgements
     WHERE deal_id = $1`,
    [dealId],
  );
  const ackMap = new Map(
    ackRows.rows.map(r => [r.signal_id, { acknowledgedAt: r.acknowledged_at, userId: r.user_id }]),
  );

  // Evaluate all signals in parallel
  const evaluated = await Promise.allSettled(
    registry.map(async (def) => {
      const status = await def.evaluate(dealId, propertyId, pool);
      const ack = ackMap.get(def.id);
      const signal: SignalState = {
        id:                def.id,
        severity:          def.severity,
        status,
        title:             def.title,
        description:       def.description,
        recommendedAction: def.recommendedAction,
        ctaLabel:          def.ctaLabel,
        ctaLink:           def.ctaLink ? def.ctaLink(dealId) : undefined,
        acknowledged:      ack !== undefined,
        acknowledgedAt:    ack?.acknowledgedAt,
      };
      return signal;
    }),
  );

  const signals: SignalState[] = evaluated.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    logger.warn('Signal evaluation failed', { signalId: registry[i].id, error: (result.reason as Error).message });
    // On evaluation failure: treat as complete (fail-open — don't falsely alarm)
    return {
      id:                registry[i].id,
      severity:          registry[i].severity,
      status:            'complete' as const,
      title:             registry[i].title,
      description:       registry[i].description,
      recommendedAction: registry[i].recommendedAction,
      ctaLabel:          registry[i].ctaLabel,
      acknowledged:      false,
    };
  });

  const unacknowledged = signals.filter(s => !s.acknowledged);
  const incomplete     = signals.filter(s => !s.acknowledged && s.status !== 'complete');
  const blockers       = incomplete.filter(s => s.severity === 'blocker');

  const overallStatus: OverallStatus =
    blockers.length > 0                        ? 'incomplete'
    : incomplete.length > 0                    ? 'degraded'
    : unacknowledged.some(s => s.status !== 'complete') ? 'degraded'
    : 'complete';

  return {
    dealId,
    overallStatus,
    signals,
    incompleteCount:   incomplete.length,
    acknowledgedCount: signals.filter(s => s.acknowledged).length,
    computedAt:        new Date().toISOString(),
  };
}

/**
 * Record that an operator has acknowledged a specific signal.
 * Upserts — re-acknowledging an already-acknowledged signal is a no-op.
 */
export async function acknowledgeSignal(
  pool:     Pool,
  dealId:   string,
  signalId: string,
  userId:   string,
  notes?:   string,
): Promise<void> {
  const registry = getSignalRegistry();
  if (!registry.some(s => s.id === signalId)) {
    throw new Error(`Unknown signal ID: ${signalId}`);
  }

  await pool.query(
    `INSERT INTO deal_signal_acknowledgements
       (deal_id, signal_id, user_id, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (deal_id, signal_id)
     DO UPDATE SET
       user_id         = EXCLUDED.user_id,
       acknowledged_at = NOW(),
       notes           = EXCLUDED.notes`,
    [dealId, signalId, userId, notes ?? null],
  );

  logger.info('Signal acknowledged', { dealId, signalId, userId });
}

/**
 * Retract a prior acknowledgement.
 */
export async function unacknowledgeSignal(
  pool:     Pool,
  dealId:   string,
  signalId: string,
  userId:   string,
): Promise<void> {
  await pool.query(
    `DELETE FROM deal_signal_acknowledgements
     WHERE deal_id = $1 AND signal_id = $2`,
    [dealId, signalId],
  );
  logger.info('Signal acknowledgement retracted', { dealId, signalId, userId });
}
