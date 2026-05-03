/**
 * useLayeredValue — selector hook
 *
 * Reads a layered value for a specific field from dealStore.
 * The component is "dumb" w.r.t. data fetching; this hook bridges
 * the store and the component props contract.
 *
 * If the upstream selector `selectLayeredValueAtPath` does not exist on the
 * store yet, the hook returns null (typed stub). The parent is responsible
 * for passing field data directly as props in that case.
 */
import { useMemo } from 'react';
import type { AssumptionFieldDef } from './types';

/**
 * Selector contract — implemented by dealStore when the IAB integration
 * is wired end-to-end. Stub returns null until then.
 */
export type LayeredValueSelector = (
  dealId: string,
  fieldPath: string,
) => AssumptionFieldDef | null;

/**
 * useLayeredValue
 *
 * Currently returns null (stub). When dealStore exposes
 * `selectLayeredValueAtPath`, replace the body with:
 *   return useDealStore(s => s.selectLayeredValueAtPath(dealId, fieldPath));
 */
export function useLayeredValue(
  _dealId: string | undefined,
  _fieldPath: string,
): AssumptionFieldDef | null {
  return null;
}

/**
 * useFieldDriftAnalysis
 *
 * Computes drift sigma inline from subject and peer values.
 * drift_sigma = (subject − peer) / (peer × 0.20)
 * ±0.5σ threshold → neutral; above → up; below → down.
 */
export function useFieldDriftAnalysis(
  subjectValue: number | null,
  peerValue: number | null,
): { sigma: number; direction: 'up' | 'down' | 'neutral' } {
  return useMemo(() => {
    if (subjectValue == null || peerValue == null || peerValue === 0) {
      return { sigma: 0, direction: 'neutral' };
    }
    const sigma = (subjectValue - peerValue) / (Math.abs(peerValue) * 0.20);
    const direction = Math.abs(sigma) < 0.5 ? 'neutral' : sigma > 0 ? 'up' : 'down';
    return { sigma, direction };
  }, [subjectValue, peerValue]);
}
