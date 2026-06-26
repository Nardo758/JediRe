// Transition guard service — validates and enforces lifecycle state machine
// Per DEAL_LIFECYCLE_TIMELINE_ALIGNMENT_SPEC.md §1 state diagram

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export type DealStatus =
  | 'PROSPECT'
  | 'UNDERWRITING'
  | 'UNDER_CONTRACT'
  | 'CLOSED_OWNED'
  | 'MONITORING'
  | 'DISPOSITION'
  | 'SOLD'
  | 'HISTORICAL_RECORD'
  | 'PASSED';

export interface TransitionResult {
  allowed: boolean;
  reason?: string; // human-readable rejection / deprecation reason
  sideEffects?: SideEffect[];
}

export interface SideEffect {
  type: 'set_acquisition_date' | 'set_archived_at' | 'trigger_notification' | 'freeze_baseline';
  payload: Record<string, unknown>;
}

// Allowed transitions per spec diagram
export const ALLOWED_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  PROSPECT: ['UNDERWRITING', 'PASSED'],
  UNDERWRITING: ['UNDER_CONTRACT', 'PASSED', 'PROSPECT'], // re-engagement
  UNDER_CONTRACT: ['CLOSED_OWNED', 'UNDERWRITING', 'PASSED'], // fell-through
  CLOSED_OWNED: ['MONITORING'],
  MONITORING: ['DISPOSITION', 'SOLD'],
  DISPOSITION: ['SOLD', 'MONITORING'], // sale falls through
  SOLD: ['HISTORICAL_RECORD'],
  HISTORICAL_RECORD: [], // terminal
  PASSED: ['UNDERWRITING', 'PROSPECT'], // re-engaged
};

// Backward-compatibility mapping: legacy free-text values → canonical enum
export const STATUS_BACKFILL_MAP: Record<string, DealStatus> = {
  // underwriting bucket
  active: 'UNDERWRITING',
  screening: 'UNDERWRITING',
  underwriting: 'UNDERWRITING',
  analysis: 'UNDERWRITING',
  // under contract bucket
  loi: 'UNDER_CONTRACT',
  due_diligence: 'UNDER_CONTRACT',
  closing: 'UNDER_CONTRACT',
  contract: 'UNDER_CONTRACT',
  // closed/owned bucket
  portfolio: 'CLOSED_OWNED',
  owned: 'CLOSED_OWNED',
  closed: 'CLOSED_OWNED',
  closed_won: 'CLOSED_OWNED',
  won: 'CLOSED_OWNED',
  // prospect bucket
  prospect: 'PROSPECT',
  lead: 'PROSPECT',
  new: 'PROSPECT',
  // monitoring bucket
  monitoring: 'MONITORING',
  operations: 'MONITORING',
  // disposition bucket
  disposition: 'DISPOSITION',
  listing: 'DISPOSITION',
  listed: 'DISPOSITION',
  // sold bucket
  sold: 'SOLD',
  exited: 'SOLD',
  // historical record bucket
  archived: 'HISTORICAL_RECORD',
  historical_record: 'HISTORICAL_RECORD',
  archive: 'HISTORICAL_RECORD',
  // passed bucket
  dead: 'PASSED',
  passed: 'PASSED',
  rejected: 'PASSED',
  lost: 'PASSED',
};

export const HARD_ENFORCE = process.env.LIFECYCLE_HARD_ENFORCE === 'true';

/**
 * Normalize a free-text or legacy status string into the canonical enum.
 * Falls back to upper-casing the input if no known mapping exists.
 */
export function normalizeStatus(status: string | null | undefined): DealStatus {
  if (!status) return 'PROSPECT';
  const upper = status.toUpperCase().replace(/\s+/g, '_');
  if (ALLOWED_TRANSITIONS[upper as DealStatus]) return upper as DealStatus;
  const mapped = STATUS_BACKFILL_MAP[status.toLowerCase()];
  if (mapped) return mapped;
  // Final fallback: try the upper-cased version directly (e.g. "UNDER CONTRACT" → "UNDER_CONTRACT")
  const normalized = status.toUpperCase().replace(/\s+/g, '_').replace(/\//g, '_');
  if (ALLOWED_TRANSITIONS[normalized as DealStatus]) return normalized as DealStatus;
  return 'PROSPECT';
}

/**
 * Validate a deal status transition against the allowed state machine.
 *
 * Soft-enforcement mode (default): returns {allowed: true} with a deprecation
 * warning for invalid transitions.  Hard-enforcement mode (env toggle) rejects
 * them with {allowed: false}.
 */
export function validateTransition(
  from: DealStatus | string,
  to: DealStatus | string,
): TransitionResult {
  const fromNorm = normalizeStatus(from);
  const toNorm = normalizeStatus(to);

  if (fromNorm === toNorm) {
    return { allowed: true, reason: 'No transition (same status)' };
  }

  const allowedTargets = ALLOWED_TRANSITIONS[fromNorm] || [];
  if (allowedTargets.includes(toNorm)) {
    return {
      allowed: true,
      reason: `Transition ${fromNorm} → ${toNorm} is valid per state machine.`,
      sideEffects: computeSideEffects(fromNorm, toNorm),
    };
  }

  const reason = `Transition ${fromNorm} → ${toNorm} is not allowed. Allowed from ${fromNorm}: [${allowedTargets.join(', ')}]`;

  if (HARD_ENFORCE) {
    return { allowed: false, reason };
  }

  // Soft enforcement: log once, allow through with a deprecation warning
  logger.warn('[LifecycleGuard] Deprecated transition allowed (soft-enforce)', {
    from: fromNorm,
    to: toNorm,
    hardEnforce: false,
  });

  return {
    allowed: true,
    reason: `[DEPRECATED] ${reason}. This will be rejected after the hard-enforcement period ends. Set LIFECYCLE_HARD_ENFORCE=true to enforce now.`,
    sideEffects: [], // skip side effects on invalid soft-enforced transitions
  };
}

/**
 * Compute side effects that should accompany a specific transition.
 */
export function computeSideEffects(from: DealStatus, to: DealStatus): SideEffect[] {
  const effects: SideEffect[] = [];

  if (to === 'CLOSED_OWNED') {
    effects.push({
      type: 'set_acquisition_date',
      payload: { acquisition_date: 'NOW()' },
    });
  }

  if (to === 'SOLD') {
    effects.push({
      type: 'freeze_baseline',
      payload: { trigger: 'deal_sold' },
    });
    effects.push({
      type: 'trigger_notification',
      payload: { event: 'disposition_recorded', urgency: 'high' },
    });
  }

  if (to === 'HISTORICAL_RECORD') {
    effects.push({
      type: 'set_archived_at',
      payload: { archived_at: 'NOW()' },
    });
  }

  return effects;
}

/**
 * Build the extra SQL SET clauses and parameters required by side effects.
 * Returns {setClauses, params} that can be merged into an UPDATE statement.
 */
export function buildSideEffectSQL(dealId: string, sideEffects: SideEffect[]): { setClauses: string[]; params: unknown[] } {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  for (const effect of sideEffects) {
    switch (effect.type) {
      case 'set_acquisition_date':
        setClauses.push('acquisition_date = NOW()');
        break;
      case 'set_archived_at':
        setClauses.push('archived_at = NOW()');
        break;
      case 'freeze_baseline':
        // Baseline freeze is handled by downstream consumers; nothing to set on deals row
        break;
      case 'trigger_notification':
        // Notification is handled asynchronously; nothing to set on deals row
        break;
    }
  }

  return { setClauses, params };
}

/**
 * High-level guard helper: reads current deal status from DB, validates the
 * requested transition, and returns the result.  Useful in route handlers
 * that only have the dealId and target status.
 */
export async function guardTransition(
  dealId: string,
  toStatus: string,
): Promise<(TransitionResult & { currentStatus?: DealStatus })> {
  const result = await query('SELECT status::text as status FROM deals WHERE id = $1', [dealId]);
  const currentStatus = normalizeStatus(result.rows[0]?.status as string | undefined);
  const validation = validateTransition(currentStatus, toStatus);
  return { ...validation, currentStatus };
}
