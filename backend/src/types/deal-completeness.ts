/**
 * Deal Completeness Framework — Shared Types (Piece C1)
 *
 * DealCompleteness is computed from a signal registry.  Each signal evaluates
 * one observable gap in a deal's analysis substrate.  Missing or stale signals
 * produce visible indicators: a badge, per-signal recommended actions, and an
 * optional CTA to fix the gap.
 *
 * Operators can acknowledge a signal to suppress its badge contribution without
 * fixing the underlying gap.  Acknowledged signals remain visible in the panel
 * but are excluded from the unacknowledged badge count.
 */

export type SignalStatus   = 'incomplete' | 'complete' | 'degraded';
export type OverallStatus  = 'complete' | 'incomplete' | 'degraded';
export type SignalSeverity = 'blocker' | 'advisory';

/**
 * Evaluated state of a single completeness signal for a deal.
 */
export interface SignalState {
  id:                string;
  severity:          SignalSeverity;
  status:            SignalStatus;
  title:             string;
  description:       string;
  recommendedAction: string;
  ctaLabel?:         string;
  ctaLink?:          string;
  acknowledged:      boolean;
  acknowledgedAt?:   string;
  acknowledgedBy?:   string;
}

/**
 * Full completeness snapshot for a deal.
 *
 * overallStatus:
 *   'complete'   — all signals pass or are acknowledged
 *   'incomplete' — one or more blocker signals are unacknowledged
 *   'degraded'   — only advisory signals unacknowledged (no blockers)
 */
export interface DealCompleteness {
  dealId:           string;
  overallStatus:    OverallStatus;
  signals:          SignalState[];
  incompleteCount:  number;
  acknowledgedCount: number;
  computedAt:       string;
}
