/**
 * Cross-module event dispatch utilities.
 * Follows the F9 cross-tab event pattern documented in replit.md §Cross-tab Events
 * (basis.changed, hold_period.changed, exit_cap.changed, deal:strategy-changed).
 */

/**
 * Dispatch `assumptions.module-applied` after a successful call to
 * POST /:dealId/assumptions/apply-from-module.
 *
 * F9's ProFormaTab listens for this event, reloads the affected assumption
 * values from the API, and triggers a model rebuild — so operators see
 * updated projections immediately without a manual refresh.
 *
 * @param source - LayeredValueSource literal (e.g. 'strategy:entry', 'strategy:exit')
 * @param fields - Field paths that were applied (e.g. ['acquisition.purchasePrice', 'hold.holdPeriodYears'])
 */
export function dispatchModuleApplied(source: string, fields: string[]): void {
  window.dispatchEvent(
    new CustomEvent('assumptions.module-applied', {
      detail: { source, fields },
    })
  );
}
