/**
 * useBlockCollisions — collision selector hook
 *
 * Derives CollisionEntry[] from a list of AssumptionFieldDef objects.
 * A collision is any field where |subject − peer| / (peer × 0.20) >= 1.5σ.
 *
 * PEER_SIGMA_PCT = 0.20 matches useLayeredValue drift sigma so collision
 * thresholds and drift arrows are consistent across the component family.
 *
 * If upstream selectors exist (`selectBlockCollisions`), replace this with
 * a store-connected implementation. Until then, derivation is done locally
 * from the props data — the component remains dumb w.r.t. backend.
 */
import { useMemo } from 'react';
import type { AssumptionFieldDef, CollisionEntry } from './types';

/** σ threshold for material collision */
const MATERIAL_SIGMA = 1.5;
/** σ threshold for severe collision */
const SEVERE_SIGMA = 2.5;
/**
 * Peer σ prior: 20% of |peer value|.
 * Matches drift sigma in useLayeredValue (drift_sigma = Δ / (peer × 0.20)).
 */
const PEER_SIGMA_PCT = 0.20;

export function useBlockCollisions(
  fields: AssumptionFieldDef[],
): CollisionEntry[] {
  return useMemo(() => {
    const collisions: CollisionEntry[] = [];
    for (const field of fields) {
      if (field.subjectValue == null || field.peerValue == null || field.peerValue === 0) {
        continue;
      }
      const peerSigma = Math.abs(field.peerValue) * PEER_SIGMA_PCT;
      if (peerSigma === 0) continue;
      const deltaSigma = Math.abs(field.subjectValue - field.peerValue) / peerSigma;
      if (deltaSigma >= MATERIAL_SIGMA) {
        collisions.push({
          fieldId: field.fieldId,
          deltaSigma,
          subjectValue: field.subjectValue,
          peerValue: field.peerValue,
          narrative: field.narrative ?? null,
          severity: deltaSigma >= SEVERE_SIGMA ? 'severe' : 'material',
        });
      }
    }
    return collisions.sort((a, b) => b.deltaSigma - a.deltaSigma);
  }, [fields]);
}
