/**
 * D-MOD-2 — Cross-Module Conflict Resolution Service
 *
 * Implements the three-step rule for assumption derivation when multiple modules
 * contribute values for the same field:
 *
 *   Step 1 — Authoritative wins:
 *     The module designated as authoritative in ASSUMPTION_MODULE_MAPPINGS always
 *     provides the resolved value.
 *
 *   Step 2 — Supporting adjusts within confidence band:
 *     If one or more supporting modules report a value, they may *adjust* the
 *     resolved value upward or downward, but only within +/- (conflictBandPct / 2)
 *     of the authoritative value. Adjustments beyond the band are clamped and
 *     the supporting module's divergence is noted in the evidence entry.
 *
 *   Step 3 — Material divergence surfaces in evidence trail:
 *     When any supporting module's value diverges from the authoritative value by
 *     more than conflictBandPct, a conflict is flagged in the evidence entry so
 *     the analyst can investigate before finalising underwriting.
 *
 * This service does NOT write to the database — it returns a ConflictResolutionResult
 * that callers (buildModel, pipeline runner) can persist via write_evidence_rows or
 * direct pool.query.
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
  /** Optional: human-readable label for this module's source (e.g. "M05 cohort P50"). */
  sourceLabel?:    string;
}

export interface ConflictResolutionResult {
  field:             AssumptionField;
  /** The final resolved value (authoritative, possibly band-clamped). */
  resolvedValue:     number | null;
  /** Module ID that provided the winning value. */
  authoritativeId:   string;
  /**
   * True when at least one supporting module diverges beyond the conflict band.
   * Even if resolved value is still the authoritative one, this flag ensures
   * the divergence surfaces in the evidence trail.
   */
  conflictFlagged:   boolean;
  /**
   * Structured evidence entry suitable for inclusion in underwriting_evidence.
   * Callers should persist this via write_evidence_rows or pool.query.
   */
  evidenceEntry: {
    field_path:    string;
    primary_tier:  1 | 2 | 3 | 4;
    confidence:    'high' | 'medium' | 'low';
    reasoning:     string;
    data_points:   EvidenceDataPoint[];
    conflict_flagged: boolean;
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
  moduleId:      string;
  value:         number | null;
  divergencePct: number | null;
  withinBand:    boolean;
  clamped:       boolean;
  clampedValue?: number;
}

// ─── Core resolution function ─────────────────────────────────────────────────

/**
 * Resolve a single assumption field given values from multiple modules.
 *
 * @param field    — Canonical field path (must match ASSUMPTION_MODULE_MAPPINGS key)
 * @param inputs   — Values from all modules (authoritative + supporting)
 * @returns ConflictResolutionResult with resolved value and evidence entry
 */
export function resolveAssumptionConflict(
  field:  AssumptionField,
  inputs: ModuleValueInput[],
): ConflictResolutionResult {
  const mapping = getAssumptionMapping(field);
  if (!mapping) {
    logger.warn(`[D-MOD-2] No mapping found for field "${field}" — skipping conflict resolution`);
    const fallback = inputs.find(i => i.isAuthoritative) ?? inputs[0];
    return {
      field,
      resolvedValue:    fallback?.value ?? null,
      authoritativeId:  fallback?.moduleId ?? 'unknown',
      conflictFlagged:  false,
      evidenceEntry: {
        field_path:    field,
        primary_tier:  3,
        confidence:    'low',
        reasoning:     `No module mapping found for "${field}". Using provided value without cross-check.`,
        data_points:   [],
        conflict_flagged: false,
      },
      supportingAnalysis: [],
    };
  }

  const authInput = inputs.find(i => i.isAuthoritative);
  const supportingInputs = inputs.filter(i => !i.isAuthoritative && i.value !== null);

  if (!authInput || authInput.value === null) {
    const supportingFallback = supportingInputs.find(i => i.value !== null);
    logger.warn(`[D-MOD-2] Authoritative module "${mapping.authoritativeModule}" has no value for "${field}" — falling back to first supporting module`);
    return {
      field,
      resolvedValue:    supportingFallback?.value ?? null,
      authoritativeId:  supportingFallback?.moduleId ?? mapping.authoritativeModule,
      conflictFlagged:  false,
      evidenceEntry: {
        field_path:    field,
        primary_tier:  3,
        confidence:    'low',
        reasoning:     `Authoritative module ${mapping.authoritativeModule} has no data for "${field}". Using ${supportingFallback?.moduleId ?? 'no'} fallback.`,
        data_points:   buildDataPoints(inputs),
        conflict_flagged: false,
      },
      supportingAnalysis: [],
    };
  }

  const authValue    = authInput.value;
  const bandFraction = mapping.conflictBandPct;

  let conflictFlagged    = false;
  let conflictDetail: ConflictDetail | undefined;
  const supportingAnalysis: SupportingModuleAnalysis[] = [];
  const dataPoints: EvidenceDataPoint[] = buildDataPoints(inputs);

  for (const supporting of supportingInputs) {
    if (supporting.value === null) continue;

    const delta = supporting.value - authValue;
    const divergencePct = Math.abs(authValue) > 0
      ? Math.abs(delta) / Math.abs(authValue)
      : (supporting.value !== 0 ? 1.0 : 0.0);

    const withinBand = divergencePct <= bandFraction;

    const analysis: SupportingModuleAnalysis = {
      moduleId:      supporting.moduleId,
      value:         supporting.value,
      divergencePct,
      withinBand,
      clamped:       false,
    };

    if (!withinBand) {
      conflictFlagged = true;
      if (!conflictDetail || divergencePct > conflictDetail.divergencePct) {
        conflictDetail = {
          authoritativeValue:  authValue,
          divergingModuleId:   supporting.moduleId,
          divergingValue:      supporting.value,
          divergencePct,
          bandThresholdPct:    bandFraction,
          narrative: buildConflictNarrative(field, mapping.authoritativeModule, supporting.moduleId, authValue, supporting.value, divergencePct, bandFraction),
        };
      }
    }

    supportingAnalysis.push(analysis);
  }

  // Confidence tier: based on authoritative module's confidence
  const confidence: 'high' | 'medium' | 'low' =
    authInput.confidence >= 0.80 ? 'high' :
    authInput.confidence >= 0.50 ? 'medium' : 'low';

  const tier: 1 | 2 | 3 | 4 =
    authInput.confidence >= 0.80 ? 1 :
    authInput.confidence >= 0.60 ? 2 : 3;

  const reasoning = buildReasoning(field, mapping, authInput, supportingAnalysis, conflictFlagged);

  return {
    field,
    resolvedValue:    authValue,
    authoritativeId:  authInput.moduleId,
    conflictFlagged,
    evidenceEntry: {
      field_path:       field,
      primary_tier:     tier,
      confidence,
      reasoning,
      data_points:      dataPoints,
      conflict_flagged: conflictFlagged,
      conflict_detail:  conflictDetail,
    },
    supportingAnalysis,
  };
}

// ─── Batch resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a set of assumptions in one pass. Returns a map of field → result.
 * Any field without an authoritative-tagged input is skipped with a warning.
 */
export function resolveAssumptionBatch(
  batch: Array<{ field: AssumptionField; inputs: ModuleValueInput[] }>,
): Map<AssumptionField, ConflictResolutionResult> {
  const results = new Map<AssumptionField, ConflictResolutionResult>();
  for (const item of batch) {
    results.set(item.field, resolveAssumptionConflict(item.field, item.inputs));
  }
  const conflictCount = [...results.values()].filter(r => r.conflictFlagged).length;
  if (conflictCount > 0) {
    logger.info(`[D-MOD-2] Conflict resolution batch: ${batch.length} fields, ${conflictCount} conflict(s) flagged`);
  }
  return results;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function buildDataPoints(inputs: ModuleValueInput[]): EvidenceDataPoint[] {
  return inputs
    .filter(i => i.value !== null)
    .map(i => ({
      tier:    (i.confidence >= 0.80 ? 1 : i.confidence >= 0.60 ? 2 : 3) as 1 | 2 | 3 | 4,
      source:  i.sourceLabel ?? i.moduleId,
      label:   i.isAuthoritative ? `${i.moduleId} (authoritative)` : `${i.moduleId} (supporting)`,
      value:   i.value,
      weight:  i.isAuthoritative ? 1.0 : 0.5,
      notes:   i.isAuthoritative ? 'Authoritative — wins on disagreement' : undefined,
    }));
}

function buildConflictNarrative(
  field:            string,
  authId:           string,
  supportingId:     string,
  authValue:        number,
  supportingValue:  number,
  divergencePct:    number,
  bandPct:          number,
): string {
  const direction = supportingValue > authValue ? 'higher' : 'lower';
  const pctStr    = (divergencePct * 100).toFixed(1);
  const bandStr   = (bandPct * 100).toFixed(0);
  return (
    `${supportingId} reports ${supportingValue.toFixed(4)} for "${field}", ` +
    `which is ${pctStr}% ${direction} than ${authId}'s ${authValue.toFixed(4)}. ` +
    `This exceeds the ${bandStr}% conflict band. ` +
    `${authId} value is used; investigate ${supportingId} divergence before finalising underwriting.`
  );
}

function buildReasoning(
  field:            string,
  mapping:          ReturnType<typeof getAssumptionMapping>,
  authInput:        ModuleValueInput,
  supporting:       SupportingModuleAnalysis[],
  conflictFlagged:  boolean,
): string {
  if (!mapping) return `Resolved "${field}" from ${authInput.moduleId} (no mapping).`;

  const supportingSummary = supporting.length === 0
    ? 'No supporting module data available.'
    : supporting.map(s =>
        `${s.moduleId}: ${s.value?.toFixed(4) ?? 'null'} ` +
        `(${s.withinBand ? 'within' : 'OUTSIDE'} ${(mapping.conflictBandPct * 100).toFixed(0)}% band)`
      ).join('; ');

  const conflictLine = conflictFlagged
    ? ' ⚠ CONFLICT FLAGGED — supporting module diverges beyond band threshold. Analyst review required.'
    : '';

  return (
    `D-MOD-2 resolution for "${field}". ` +
    `Authoritative: ${authInput.moduleId} → ${authInput.value?.toFixed(4)}. ` +
    `Supporting: ${supportingSummary}.${conflictLine}`
  );
}
