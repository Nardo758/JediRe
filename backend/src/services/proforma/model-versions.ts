/**
 * Model Versions Registry — F9 Pro Forma Tier-2 (Spec §13).
 *
 * Every released forecast component carries a semver tag. The version is
 * stamped onto every ProvenancedValue it emits and snapshotted into
 * `deal_versions.model_versions` so audit + retraining can reproduce a
 * historical platform value exactly.
 *
 * Bump rules:
 *   patch  — bug fix or test-only change
 *   minor  — additive parameter change, no math regression
 *   major  — calibration change that moves output for unchanged inputs
 */

import type { ProvenancedValue } from '../../types/provenanced-value';

export const MODEL_VERSIONS = {
  rent_growth: 'v1.0',
  opex_growth: 'v1.0',
  gordon_validator: 'v1.0',
  confidence_bands: 'v1.0',
  agent_fill_in: 'v1.0',
  correlation_engine: 'v1.0',
  proforma_generator: 'v1.0',
} as const;

export type ModelKey = keyof typeof MODEL_VERSIONS;

/** Stamp a model version onto a ProvenancedValue. Mutates and returns. */
export function stampModelVersion<T>(
  pv: ProvenancedValue<T>,
  key: ModelKey
): ProvenancedValue<T> {
  pv.modelVersion = MODEL_VERSIONS[key];
  return pv;
}

/** Snapshot of every released model version, for deal_versions.model_versions. */
export function snapshotModelVersions(): Record<ModelKey, string> {
  return { ...MODEL_VERSIONS };
}
