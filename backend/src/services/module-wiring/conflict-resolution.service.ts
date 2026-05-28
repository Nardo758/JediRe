/**
 * D-MOD-2 — Cross-Module Conflict Resolution Service
 *
 * Implements the three-step rule for assumption derivation when multiple modules
 * contribute values for the same field:
 *
 *   Step 1 — Authoritative wins:
 *     The module designated as authoritative in ASSUMPTION_MODULE_MAPPINGS always
 *     provides the base resolved value. Its output is never overridden.
 *
 *   Step 2 — Supporting adjusts within confidence band:
 *     If one or more supporting modules report a value that is WITHIN the
 *     conflict band (+/- conflictBandPct/2 of the authoritative value), the
 *     resolved value is blended toward the supporting value by a factor
 *     proportional to the supporting module's confidence. The adjustment is
 *     clamped so the resolved value never moves more than (conflictBandPct / 2)
 *     away from the authoritative baseline.
 *
 *   Step 3 — Material divergence surfaces in evidence trail:
 *     When any supporting module's value diverges from the authoritative value by
 *     more than conflictBandPct, a conflict is flagged in the evidence entry so
 *     the analyst can investigate before finalising underwriting.
 *
 * This service does NOT write to the database — it returns a ConflictResolutionResult
 * that callers (buildModel D-MOD pass) persist via pool.query to underwriting_evidence.
 */

import type { ModuleId } from './module-registry';
import type { AssumptionField } from './assumption-module-mapping.config';
import { getAssumptionMapping } from './assumption-module-mapping.config';
import { logger } from '../../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModuleValueInput {
  moduleId:        ModuleId | string;
  value:           number | null;
  /** 0–1 confidence from the module's own calculation. */
  confidence:      number;
  /** True = this module is the one designated as authoritative in the mapping. */
  isAuthoritative: boolean;
  /** Optional: human-readable label for this module's source. */
  sourceLabel?:    string;
}

export interface ConflictResolutionResult {
  field:             AssumptionField;
  /**
   * Final resolved value.
   *   - Step 1: starts as authValue
   *   - Step 2: blended toward supporting value if within band (bandAdjusted=true)
   *   - Step 3: if divergence > band, stays as authValue but conflictFlagged=true
   */
  resolvedValue:     number | null;
  authoritativeId:   string;
  /** True = Step 2 blend was applied (supporting within band, adjusted resolved value). */
  bandAdjusted:      boolean;
  /**
   * True = Step 3 conflict flagged (supporting diverges beyond conflict band).
   * Resolved value is still authValue, but the evidence trail must show the divergence.
   */
  conflictFlagged:   boolean;
  /** Structured evidence entry for writing to underwriting_evidence. */
  evidenceEntry: {
    field_path:       string;
    primary_tier:     1 | 2 | 3 | 4;
    confidence:       'high' | 'medium' | 'low';
    reasoning:        string;
    data_points:      EvidenceDataPoint[];
    conflict_flagged: boolean;
    band_adjusted:    boolean;
    conflict_detail?: ConflictDetail;
  };
  /** Per-supporting-module analysis for debugging / audit. */
  supportingAnalysis: SupportingModuleAnalysis[];
}

export interface EvidenceDataPoint {
  tier:    1 | 2 | 3 | 4;
  source:  string;
  label:   string;
  value:   number | string | null;
  weight:  number;
  notes?:  string;
}

export interface ConflictDetail {
  authoritativeValue:  number;
  divergingModuleId:   string;
  divergingValue:      number;
  divergencePct:       number;
  bandThresholdPct:    number;
  narrative:           string;
}

export interface SupportingModuleAnalysis {
  moduleId:          string;
  value:             number | null;
  divergencePct:     number | null;
  withinBand:        boolean;
  /** True if Step 2 blend was applied using this module's value. */
  clamped:           boolean;
  /** The adjustment applied to authValue (positive = blended toward supporting). */
  appliedAdjustment: number;
}

// ─── Core resolution function ─────────────────────────────────────────────────

/**
 * Resolve a single assumption field given values from multiple modules.
 *
 * Three-step D-MOD-2 rule:
 *   1. Authoritative module value is the baseline resolved value.
 *   2. Supporting modules within the conflict band nudge the resolved value
 *      by up to (supporting.confidence × 0.30) × (supportingValue - authValue),
 *      clamped at ±(conflictBandPct/2) of authValue.
 *   3. Supporting modules beyond the band set conflictFlagged=true and leave
 *      the resolved value unchanged.
 *
 * @param field   — Canonical field path from ASSUMPTION_MODULE_MAPPINGS
 * @param inputs  — Values from all modules (exactly one must have isAuthoritative=true)
 */
export function resolveAssumptionConflict(
  field:  AssumptionField,
  inputs: ModuleValueInput[],
): ConflictResolutionResult {
  const mapping = getAssumptionMapping(field);

  const authInput = inputs.find(i => i.isAuthoritative);
  const supportingInputs = inputs.filter(i => !i.isAuthoritative && i.value !== null);

  if (!mapping) {
    logger.warn(`[D-MOD-2] No mapping found for field "${field}" — skipping conflict resolution`);
    const fallback = authInput ?? inputs[0];
    return _noMappingResult(field, fallback, supportingInputs);
  }

  if (!authInput || authInput.value === null) {
    const supportingFallback = supportingInputs.find(i => i.value !== null);
    logger.warn(`[D-MOD-2] Authoritative module "${mapping.authoritativeModule}" has no value for "${field}" — falling back to first supporting module`);
    return _noAuthResult(field, mapping, inputs, supportingFallback);
  }

  const authValue    = authInput.value;
  const bandPct      = mapping.conflictBandPct;
  const maxAdjust    = authValue !== 0 ? Math.abs(authValue) * (bandPct / 2) : bandPct / 2;

  let resolvedValue         = authValue;
  let totalAdjustment       = 0;
  let conflictFlagged       = false;
  let bandAdjusted          = false;
  let conflictDetail: ConflictDetail | undefined;
  const supportingAnalysis: SupportingModuleAnalysis[] = [];

  // Step 2 & 3: process each supporting module
  for (const supporting of supportingInputs) {
    if (supporting.value === null) continue;

    const delta        = supporting.value - authValue;
    const divergencePct = Math.abs(authValue) > 0
      ? Math.abs(delta) / Math.abs(authValue)
      : (supporting.value !== 0 ? 1.0 : 0.0);

    const withinBand = divergencePct <= bandPct;

    if (withinBand) {
      // Step 2: blend toward supporting value, proportional to confidence
      // blendFactor ∈ [0, 0.30] — supporting never overrides more than 30%
      const blendFactor  = supporting.confidence * 0.30;
      const rawAdjust    = delta * blendFactor;
      // Clamp so total adjustment never exceeds maxAdjust
      const remaining    = maxAdjust - Math.abs(totalAdjustment);
      const clampedAdjust = Math.sign(rawAdjust) * Math.min(Math.abs(rawAdjust), remaining);

      if (Math.abs(clampedAdjust) > 1e-10) {
        totalAdjustment += clampedAdjust;
        resolvedValue    = authValue + totalAdjustment;
        bandAdjusted     = true;
      }

      supportingAnalysis.push({
        moduleId:          supporting.moduleId,
        value:             supporting.value,
        divergencePct,
        withinBand:        true,
        clamped:           Math.abs(rawAdjust) > Math.abs(clampedAdjust),
        appliedAdjustment: clampedAdjust,
      });
    } else {
      // Step 3: beyond band — flag conflict, don't adjust resolved value
      conflictFlagged = true;
      if (!conflictDetail || divergencePct > conflictDetail.divergencePct) {
        conflictDetail = {
          authoritativeValue:  authValue,
          divergingModuleId:   supporting.moduleId,
          divergingValue:      supporting.value,
          divergencePct,
          bandThresholdPct:    bandPct,
          narrative:           _conflictNarrative(field, mapping.authoritativeModule, supporting.moduleId, authValue, supporting.value, divergencePct, bandPct),
        };
      }
      supportingAnalysis.push({
        moduleId:          supporting.moduleId,
        value:             supporting.value,
        divergencePct,
        withinBand:        false,
        clamped:           false,
        appliedAdjustment: 0,
      });
    }
  }

  const confidence: 'high' | 'medium' | 'low' =
    authInput.confidence >= 0.80 ? 'high' :
    authInput.confidence >= 0.50 ? 'medium' : 'low';

  const tier: 1 | 2 | 3 | 4 =
    authInput.confidence >= 0.80 ? 1 :
    authInput.confidence >= 0.60 ? 2 : 3;

  return {
    field,
    resolvedValue,
    authoritativeId:  authInput.moduleId,
    bandAdjusted,
    conflictFlagged,
    evidenceEntry: {
      field_path:       field,
      primary_tier:     tier,
      confidence,
      reasoning:        _reasoningText(field, mapping, authInput, resolvedValue, supportingAnalysis, conflictFlagged, bandAdjusted),
      data_points:      _buildDataPoints(inputs),
      conflict_flagged: conflictFlagged,
      band_adjusted:    bandAdjusted,
      conflict_detail:  conflictDetail,
    },
    supportingAnalysis,
  };
}

// ─── Batch resolution ─────────────────────────────────────────────────────────

/** Resolve a set of assumptions in one pass. */
export function resolveAssumptionBatch(
  batch: Array<{ field: AssumptionField; inputs: ModuleValueInput[] }>,
): Map<AssumptionField, ConflictResolutionResult> {
  const results = new Map<AssumptionField, ConflictResolutionResult>();
  for (const item of batch) {
    results.set(item.field, resolveAssumptionConflict(item.field, item.inputs));
  }
  const conflictCount = [...results.values()].filter(r => r.conflictFlagged).length;
  const blendCount    = [...results.values()].filter(r => r.bandAdjusted).length;
  logger.info(`[D-MOD-2] Batch resolved ${batch.length} fields: ${conflictCount} conflict(s), ${blendCount} band-adjusted`);
  return results;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _buildDataPoints(inputs: ModuleValueInput[]): EvidenceDataPoint[] {
  return inputs
    .filter(i => i.value !== null)
    .map(i => ({
      tier:    (i.confidence >= 0.80 ? 1 : i.confidence >= 0.60 ? 2 : 3) as 1 | 2 | 3 | 4,
      source:  i.sourceLabel ?? i.moduleId,
      label:   i.isAuthoritative ? `${i.moduleId} (authoritative)` : `${i.moduleId} (supporting)`,
      value:   i.value,
      weight:  i.isAuthoritative ? 1.0 : 0.5,
      notes:   i.isAuthoritative ? 'Authoritative — primary value, wins on disagreement' : 'Supporting — cross-check only; adjusts within band',
    }));
}

function _conflictNarrative(
  field: string, authId: string, supportingId: string,
  authValue: number, supportingValue: number, divergencePct: number, bandPct: number,
): string {
  const direction = supportingValue > authValue ? 'higher' : 'lower';
  const pctStr = (divergencePct * 100).toFixed(1);
  const bandStr = (bandPct * 100).toFixed(0);
  return (
    `${supportingId} reports ${supportingValue.toFixed(4)} for "${field}", ` +
    `${pctStr}% ${direction} than ${authId}'s ${authValue.toFixed(4)}. ` +
    `Exceeds ${bandStr}% conflict band. ${authId} value used; ` +
    `investigate ${supportingId} divergence before finalising.`
  );
}

function _reasoningText(
  field: string,
  mapping: NonNullable<ReturnType<typeof getAssumptionMapping>>,
  authInput: ModuleValueInput,
  resolvedValue: number,
  supporting: SupportingModuleAnalysis[],
  conflictFlagged: boolean,
  bandAdjusted: boolean,
): string {
  const supportingLine = supporting.length === 0
    ? 'No supporting module data.'
    : supporting.map(s =>
        `${s.moduleId}: ${s.value?.toFixed(4) ?? 'null'} ` +
        `(${s.withinBand ? `within band → adj ${s.appliedAdjustment >= 0 ? '+' : ''}${s.appliedAdjustment.toFixed(5)}` : `OUTSIDE ${(mapping.conflictBandPct * 100).toFixed(0)}% band → flagged`})`
      ).join('; ');

  const adjustLine = bandAdjusted
    ? ` Step 2 blend applied → resolved=${resolvedValue.toFixed(4)} (from auth=${authInput.value?.toFixed(4)}).`
    : '';
  const conflictLine = conflictFlagged
    ? ' ⚠ D-MOD-2 CONFLICT — supporting module diverges beyond band. Analyst review required.'
    : '';

  return (
    `D-MOD-2 for "${field}". Auth: ${authInput.moduleId}=${authInput.value?.toFixed(4)}.` +
    ` Supporting: ${supportingLine}.${adjustLine}${conflictLine}`
  );
}

function _noMappingResult(
  field: AssumptionField,
  fallback: ModuleValueInput | undefined,
  _supporting: ModuleValueInput[],
): ConflictResolutionResult {
  return {
    field,
    resolvedValue:    fallback?.value ?? null,
    authoritativeId:  fallback?.moduleId ?? 'unknown',
    bandAdjusted:     false,
    conflictFlagged:  false,
    evidenceEntry: {
      field_path:    field,
      primary_tier:  3,
      confidence:    'low',
      reasoning:     `No D-MOD-1 mapping for "${field}". Value used as-is, no cross-check.`,
      data_points:   [],
      conflict_flagged: false,
      band_adjusted:    false,
    },
    supportingAnalysis: [],
  };
}

function _noAuthResult(
  field: AssumptionField,
  mapping: NonNullable<ReturnType<typeof getAssumptionMapping>>,
  inputs: ModuleValueInput[],
  fallback: ModuleValueInput | undefined,
): ConflictResolutionResult {
  return {
    field,
    resolvedValue:    fallback?.value ?? null,
    authoritativeId:  fallback?.moduleId ?? mapping.authoritativeModule,
    bandAdjusted:     false,
    conflictFlagged:  false,
    evidenceEntry: {
      field_path:    field,
      primary_tier:  3,
      confidence:    'low',
      reasoning:     `Authoritative module ${mapping.authoritativeModule} has no data for "${field}". Using ${fallback?.moduleId ?? 'no'} fallback.`,
      data_points:   _buildDataPoints(inputs),
      conflict_flagged: false,
      band_adjusted:    false,
    },
    supportingAnalysis: [],
  };
}
