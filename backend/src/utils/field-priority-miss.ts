/**
 * DC-31 Item 2: Shared priority-chain resolver for FIELD_PRIORITIES lookups.
 *
 * Both `resolve()` and `reResolveClearedLayeredValue()` read FIELD_PRIORITIES.
 * Previously they disagreed on map-miss behavior:
 *   - resolve() used `[]` (empty walk → platform fallback, no log)
 *   - reResolveClearedLayeredValue() used a hidden 6-source fallback
 *
 * This helper unifies both behind a single definition. On no-priority,
 * callers emit a diagnostic and set resolution = 'unresolved_no_priority'.
 */

export type Resolution =
  | 'platform' | 't12' | 'rent_roll' | 'tax_bill' | 'box_score' | 'aged_ar' | 'om'
  | 'override' | 'platform_fallback' | 'unresolved_no_priority';

export function resolvePriorityChain(
  fieldName: string,
  fieldPriorities: Record<string, string[]>,
  inlinePriority?: Resolution[],
): { chain: Resolution[]; unresolvedReason?: 'no_priority' } {
  if (inlinePriority && inlinePriority.length) {
    return { chain: inlinePriority };
  }
  const mapped = fieldPriorities[fieldName];
  if (mapped && mapped.length) {
    return { chain: mapped as Resolution[] };
  }
  return { chain: [], unresolvedReason: 'no_priority' };
}
