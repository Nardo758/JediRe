/**
 * SOFR Freshness Monitor — W-07 Follow-up C
 *
 * Lightweight monitoring service for SOFR data freshness.
 * Logs fallback_heuristic events to stderr for ops visibility.
 * Production monitoring tickets become follow-up work.
 *
 * @version 1.0.0
 * @date 2026-05-19
 */

import { logger } from '../../utils/logger';

export function logSofrFallback(details: {
  dealId?: string;
  reason: string;
  timestamp: string;
}): void {
  logger.warn('SOFR data unavailable — fallback_heuristic triggered', {
    ...details,
    severity: 'ops_visibility',
    action_required: 'Verify FRED API connection and SOFR data pipeline',
    component: 'cycle-intelligence',
  });
}
