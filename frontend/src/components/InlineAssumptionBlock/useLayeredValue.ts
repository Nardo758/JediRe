/**
 * useLayeredValue — selector hook
 *
 * Reads a layered value for a specific field from dealStore by path.
 * Path is dot-notation (e.g. "traffic.physical_occupancy").
 *
 * `selectLayeredValueAtPath` traverses the live store state identically to
 * how updateAssumption/revertAssumption write — so reads and writes are
 * always consistent.
 *
 * The return type is kept narrow: only the fields IAB needs (peerValue,
 * effectiveValue, hasUserOverride). The parent remains responsible for
 * assembling AssumptionFieldDef and passing all other display data as props.
 */
import { useMemo } from 'react';
import { useDealStore } from '../../stores/dealStore';

// ─── LayeredValue duck-type guard ─────────────────────────────────────────
// Avoids importing the full LayeredValue type from dealContext.types so the
// component family stays loosely coupled to the store.
function isLayeredValue(v: unknown): v is {
  value: number;
  resolvedFrom: string;
  layers?: {
    platform?: { value: number };
    broker?: { value: number };
    user?: { value: number };
  };
} {
  return (
    v != null &&
    typeof v === 'object' &&
    'value' in v &&
    'resolvedFrom' in v
  );
}

// ─── selectLayeredValueAtPath ─────────────────────────────────────────────
/**
 * Traverses the store state using a dot-notation path, returning the
 * LayeredValue<number> at that location or null if absent / not a LV.
 *
 * This is the read-path counterpart to updateAssumption's write-path.
 */
export function selectLayeredValueAtPath(
  state: Record<string, unknown>,
  fieldPath: string,
): { peerValue: number | null; effectiveValue: number; hasUserOverride: boolean } | null {
  const parts = fieldPath.split('.');
  let current: unknown = state;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[part];
  }
  if (!isLayeredValue(current)) return null;

  const peerValue =
    current.layers?.platform?.value ??
    current.layers?.broker?.value ??
    null;
  const effectiveValue = current.value;
  const hasUserOverride = current.layers?.user != null;

  return { peerValue, effectiveValue, hasUserOverride };
}

// ─── useLayeredValue ─────────────────────────────────────────────────────
/**
 * Hook wrapper around selectLayeredValueAtPath.
 *
 * Returns { peerValue, effectiveValue, hasUserOverride } when the store
 * has a LayeredValue at the given path, or null if not yet hydrated.
 *
 * The hook is stable: only re-renders the subscriber when peerValue,
 * effectiveValue, or hasUserOverride changes.
 */
export function useLayeredValue(
  _dealId: string | undefined,
  fieldPath: string,
): { peerValue: number | null; effectiveValue: number; hasUserOverride: boolean } | null {
  return useDealStore(s =>
    selectLayeredValueAtPath(s as unknown as Record<string, unknown>, fieldPath),
  );
}

// ─── selectFieldDriftAnalysis ─────────────────────────────────────────────
/**
 * Pure selector — computes drift sigma from subject and peer values.
 * drift_sigma = (subject − peer) / (peer × 0.20)
 *
 * PEER_SIGMA_PCT = 0.20 matches selectBlockCollisions so collision badges
 * and drift arrows are consistent across the component family.
 *
 * ±0.5σ threshold → neutral; above → up; below → down.
 *
 * Exported as a named selector so callers can use it outside of React
 * (e.g. in store selectors, tests, or memoized comparisons) without a hook.
 */
export function selectFieldDriftAnalysis(
  subjectValue: number | null,
  peerValue: number | null,
): { sigma: number; direction: 'up' | 'down' | 'neutral' } {
  if (subjectValue == null || peerValue == null || peerValue === 0) {
    return { sigma: 0, direction: 'neutral' };
  }
  const sigma = (subjectValue - peerValue) / (Math.abs(peerValue) * 0.20);
  const direction = Math.abs(sigma) < 0.5 ? 'neutral' : sigma > 0 ? 'up' : 'down';
  return { sigma, direction };
}

// ─── useFieldDriftAnalysis ────────────────────────────────────────────────
/** Hook wrapper — memoizes selectFieldDriftAnalysis. */
export function useFieldDriftAnalysis(
  subjectValue: number | null,
  peerValue: number | null,
): { sigma: number; direction: 'up' | 'down' | 'neutral' } {
  return useMemo(
    () => selectFieldDriftAnalysis(subjectValue, peerValue),
    [subjectValue, peerValue],
  );
}
