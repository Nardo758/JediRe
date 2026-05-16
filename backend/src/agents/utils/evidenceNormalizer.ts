/**
 * Cashflow Agent — Evidence Normalizer
 *
 * Defensive post-processor utility that coerces malformed `evidence` fields
 * on proforma_fields entries into the canonical structured shape required by
 * the output schema.
 *
 * Problem this solves:
 *   The Cash Flow Agent (DeepSeek-backed) occasionally emits `evidence` as a
 *   plain string ("Broker OM page 14 states stabilized NOI of $2.99M") instead
 *   of the structured object the schema requires. Downstream consumers (F9
 *   rendering, archive cohort queries, M36 plausibility input) expect the
 *   structured shape. String evidence breaks them silently.
 *
 * Why a normalizer instead of a prompt fix:
 *   Prompt fix is best-effort — agent drift can return at any time. The
 *   normalizer is deterministic. We still want the prompt fix as a second
 *   layer to reduce normalization work, but the normalizer is the guarantee.
 *
 * Integration:
 *   Called from cashflowPostProcess before the output is returned for schema
 *   validation. See cashflow.postprocess.ts.
 *
 * Telemetry:
 *   Every normalization is logged at info level and emits a metric. Silent
 *   repair hides drift; loud repair lets us watch conformance trends.
 */

import type { Logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';

// ---------------------------------------------------------------------------
// Types — Canonical Evidence Shape
// ---------------------------------------------------------------------------

/**
 * Canonical shape of evidence as expected by downstream consumers.
 * Mirrors the output schema definition for `proforma_fields[i].evidence`.
 */
export interface CanonicalEvidence {
  source_tier: 1 | 2 | 3 | 4;
  source_label: string;
  source_doc_ref?: string | null;
  source_doc_excerpt?: string | null;
  data_points?: Array<{
    key: string;
    value: string | number;
    unit?: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
  derivation_chain?: string[];
  collision_with_broker?: {
    broker_value: number;
    agent_value: number;
    delta_pct: number;
    severity: 'minor' | 'material' | 'major';
    narrative: string;
  } | null;
}

/**
 * Permissive input type — what the agent might actually emit before normalization.
 */
export type RawEvidence =
  | undefined
  | null
  | string
  | Partial<CanonicalEvidence>
  | Record<string, unknown>;

export interface NormalizationResult {
  evidence: CanonicalEvidence;
  was_repaired: boolean;
  repair_actions: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_EVIDENCE: CanonicalEvidence = {
  source_tier: 4,
  source_label: 'UNANCHORED',
  source_doc_ref: null,
  source_doc_excerpt: null,
  data_points: [],
  confidence: 'low',
  derivation_chain: [],
  collision_with_broker: null,
};

/**
 * Heuristics for extracting source tier from a narrative string.
 * Order matters — earlier rules take precedence.
 */
const SOURCE_TIER_HEURISTICS: Array<{
  pattern: RegExp;
  tier: 1 | 2 | 3 | 4;
  label: string;
}> = [
  { pattern: /\bT-?12\b/i,                                            tier: 1, label: 'T12' },
  { pattern: /\brent[\s-]?roll\b/i,                                   tier: 1, label: 'RENT_ROLL' },
  { pattern: /\bassumption[s]?\b.*\b(panel|input|user)/i,             tier: 1, label: 'USER_ASSUMPTION' },
  { pattern: /\bowned[\s-]?(portfolio|asset|properties)/i,            tier: 2, label: 'OWNED_PORTFOLIO' },
  { pattern: /\bsponsor[\']?s? portfolio\b/i,                         tier: 2, label: 'OWNED_PORTFOLIO' },
  { pattern: /\bM0[1-9]|\bM1[0-5]\b/i,                               tier: 3, label: 'PLATFORM_MODULE' },
  { pattern: /\barchive\b/i,                                          tier: 3, label: 'ARCHIVE_COHORT' },
  { pattern: /\bcomp[\s-]?set\b|\bM05\b/i,                           tier: 3, label: 'PLATFORM_M05' },
  { pattern: /\bM07\b|\babsorption\b/i,                               tier: 3, label: 'PLATFORM_M07' },
  { pattern: /\bM35\b|\bevent[s]?\b/i,                               tier: 3, label: 'PLATFORM_M35' },
  { pattern: /\bbroker[\']?s? (OM|memo|brochure)\b/i,                tier: 4, label: 'BROKER_OM' },
  { pattern: /\bOM\b/i,                                               tier: 4, label: 'BROKER_OM' },
];

/**
 * Heuristics for extracting confidence level from a narrative string.
 * Defaults to 'medium' when no signal found — the agent produced something,
 * so we shouldn't penalise it for not stating confidence explicitly.
 */
const CONFIDENCE_HEURISTICS: Array<{
  pattern: RegExp;
  confidence: 'high' | 'medium' | 'low';
}> = [
  { pattern: /\bhigh[\s-]?confidence\b|\bvalidated\b|\bconfirmed\b/i,                            confidence: 'high' },
  { pattern: /\blow[\s-]?confidence\b|\bsparse\b|\binsufficient\b|\buncertain\b|\bestimated\b/i, confidence: 'low' },
  { pattern: /\bmedium[\s-]?confidence\b|\bmoderate\b/i,                                         confidence: 'medium' },
];

// ---------------------------------------------------------------------------
// Core Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a single `evidence` value into the canonical structured shape.
 *
 * @param raw        The raw evidence value emitted by the agent
 * @param fieldPath  The proforma field path (for logging context)
 * @param reasoning  Optional sibling `reasoning` text; used as fallback
 *                   content for the excerpt slot when evidence is sparse
 */
export function normalizeEvidence(
  raw: RawEvidence,
  fieldPath: string,
  reasoning?: string | null,
): NormalizationResult {
  const repairActions: string[] = [];

  // Case 1: undefined or null — fabricate default
  if (raw === undefined || raw === null) {
    repairActions.push('fabricated_default_evidence');
    return {
      evidence: {
        ...DEFAULT_EVIDENCE,
        source_doc_excerpt: reasoning?.slice(0, 280) ?? null,
      },
      was_repaired: true,
      repair_actions: repairActions,
    };
  }

  // Case 2: string — parse heuristically into structured form
  if (typeof raw === 'string') {
    repairActions.push('coerced_string_to_object');
    return {
      evidence: coerceStringToEvidence(raw, repairActions),
      was_repaired: true,
      repair_actions: repairActions,
    };
  }

  // Case 3: not a string and not an object — wrap with default
  if (typeof raw !== 'object') {
    repairActions.push('wrapped_non_object_with_default');
    return {
      evidence: {
        ...DEFAULT_EVIDENCE,
        source_doc_excerpt: String(raw).slice(0, 280),
      },
      was_repaired: true,
      repair_actions: repairActions,
    };
  }

  // Case 4: partial or full object — fill missing fields, validate enums
  return validateAndFillObject(
    raw as Partial<CanonicalEvidence> & Record<string, unknown>,
    reasoning,
    repairActions,
  );
}

/**
 * Parse a narrative string into structured evidence via regex heuristics.
 */
function coerceStringToEvidence(text: string, repairActions: string[]): CanonicalEvidence {
  let sourceTier: 1 | 2 | 3 | 4 = DEFAULT_EVIDENCE.source_tier;
  let sourceLabel: string = DEFAULT_EVIDENCE.source_label;

  for (const rule of SOURCE_TIER_HEURISTICS) {
    if (rule.pattern.test(text)) {
      sourceTier = rule.tier;
      sourceLabel = rule.label;
      repairActions.push(`inferred_source_${rule.label.toLowerCase()}`);
      break;
    }
  }

  let confidence: 'high' | 'medium' | 'low' = 'medium';
  for (const rule of CONFIDENCE_HEURISTICS) {
    if (rule.pattern.test(text)) {
      confidence = rule.confidence;
      repairActions.push(`inferred_confidence_${rule.confidence}`);
      break;
    }
  }

  const excerpt = text.length > 280 ? text.slice(0, 277) + '...' : text;

  return {
    source_tier: sourceTier,
    source_label: sourceLabel,
    source_doc_ref: null,
    source_doc_excerpt: excerpt,
    data_points: [],
    confidence,
    derivation_chain: [text],
    collision_with_broker: null,
  };
}

/**
 * Validate a partial evidence object and fill any missing required fields.
 */
function validateAndFillObject(
  raw: Partial<CanonicalEvidence> & Record<string, unknown>,
  reasoning: string | null | undefined,
  repairActions: string[],
): NormalizationResult {
  let wasRepaired = false;

  // source_tier
  let sourceTier: 1 | 2 | 3 | 4;
  if (typeof raw.source_tier === 'number' && [1, 2, 3, 4].includes(raw.source_tier)) {
    sourceTier = raw.source_tier as 1 | 2 | 3 | 4;
  } else if (typeof raw.source_tier === 'string') {
    const parsed = parseInt(String(raw.source_tier).replace(/\D/g, ''), 10);
    if ([1, 2, 3, 4].includes(parsed)) {
      sourceTier = parsed as 1 | 2 | 3 | 4;
      repairActions.push('coerced_source_tier_from_string');
      wasRepaired = true;
    } else {
      sourceTier = DEFAULT_EVIDENCE.source_tier;
      repairActions.push('defaulted_invalid_source_tier');
      wasRepaired = true;
    }
  } else if (
    // Accept legacy field names: primary_tier (from EvidenceSchema), tier, evidence_tier
    typeof (raw as Record<string, unknown>).primary_tier === 'number' &&
    [1, 2, 3, 4].includes((raw as Record<string, unknown>).primary_tier as number)
  ) {
    sourceTier = (raw as Record<string, unknown>).primary_tier as 1 | 2 | 3 | 4;
    repairActions.push('mapped_primary_tier_to_source_tier');
    wasRepaired = true;
  } else {
    sourceTier = DEFAULT_EVIDENCE.source_tier;
    repairActions.push('filled_missing_source_tier');
    wasRepaired = true;
  }

  // source_label — accept legacy 'source' field too
  let sourceLabel: string;
  if (typeof raw.source_label === 'string' && raw.source_label.length > 0) {
    sourceLabel = raw.source_label;
  } else if (typeof (raw as Record<string, unknown>).source === 'string') {
    sourceLabel = (raw as Record<string, unknown>).source as string;
    repairActions.push('mapped_source_to_source_label');
    wasRepaired = true;
  } else {
    sourceLabel = DEFAULT_EVIDENCE.source_label;
    repairActions.push('filled_missing_source_label');
    wasRepaired = true;
  }

  // confidence
  let confidence: 'high' | 'medium' | 'low';
  if (typeof raw.confidence === 'string' && ['high', 'medium', 'low'].includes(raw.confidence)) {
    confidence = raw.confidence as 'high' | 'medium' | 'low';
  } else {
    confidence = 'medium';
    repairActions.push('defaulted_invalid_confidence');
    wasRepaired = true;
  }

  // data_points — must be array of objects with key + value
  let dataPoints: NonNullable<CanonicalEvidence['data_points']> = [];
  if (Array.isArray(raw.data_points)) {
    dataPoints = (raw.data_points as unknown[]).filter(
      (dp): dp is { key: string; value: string | number; unit?: string } =>
        typeof dp === 'object' &&
        dp !== null &&
        typeof (dp as { key?: unknown }).key === 'string' &&
        ['string', 'number'].includes(typeof (dp as { value?: unknown }).value),
    );
    if (dataPoints.length !== raw.data_points.length) {
      repairActions.push('dropped_malformed_data_points');
      wasRepaired = true;
    }
  } else if (raw.data_points !== undefined) {
    repairActions.push('dropped_non_array_data_points');
    wasRepaired = true;
  }

  // derivation_chain — must be array of strings; accept legacy 'reasoning' string
  let derivationChain: string[] = [];
  if (Array.isArray(raw.derivation_chain)) {
    derivationChain = (raw.derivation_chain as unknown[])
      .filter((s): s is string => typeof s === 'string');
    if (derivationChain.length !== raw.derivation_chain.length) {
      repairActions.push('filtered_non_string_derivation_chain');
      wasRepaired = true;
    }
  } else if (typeof raw.derivation_chain === 'string') {
    derivationChain = [raw.derivation_chain];
    repairActions.push('coerced_string_derivation_chain_to_array');
    wasRepaired = true;
  } else if (typeof (raw as Record<string, unknown>).reasoning === 'string') {
    // Legacy: use 'reasoning' field as the first derivation chain entry
    derivationChain = [(raw as Record<string, unknown>).reasoning as string];
    repairActions.push('mapped_reasoning_to_derivation_chain');
    wasRepaired = true;
  }

  // source_doc_ref and source_doc_excerpt
  const sourceDocRef =
    typeof raw.source_doc_ref === 'string' ? raw.source_doc_ref : null;

  let sourceDocExcerpt: string | null = null;
  if (typeof raw.source_doc_excerpt === 'string') {
    sourceDocExcerpt =
      raw.source_doc_excerpt.length > 280
        ? raw.source_doc_excerpt.slice(0, 277) + '...'
        : raw.source_doc_excerpt;
  } else if (reasoning && !derivationChain.length) {
    sourceDocExcerpt =
      reasoning.length > 280 ? reasoning.slice(0, 277) + '...' : reasoning;
    repairActions.push('filled_excerpt_from_reasoning');
    wasRepaired = true;
  }

  // collision_with_broker — validate or null
  let collisionWithBroker: CanonicalEvidence['collision_with_broker'] = null;
  if (raw.collision_with_broker && typeof raw.collision_with_broker === 'object') {
    const c = raw.collision_with_broker as Record<string, unknown>;
    if (
      typeof c.broker_value === 'number' &&
      typeof c.agent_value === 'number' &&
      typeof c.delta_pct === 'number' &&
      typeof c.severity === 'string' &&
      ['minor', 'material', 'major'].includes(c.severity) &&
      typeof c.narrative === 'string'
    ) {
      collisionWithBroker = {
        broker_value: c.broker_value,
        agent_value: c.agent_value,
        delta_pct: c.delta_pct,
        severity: c.severity as 'minor' | 'material' | 'major',
        narrative: c.narrative,
      };
    } else {
      repairActions.push('dropped_malformed_collision');
      wasRepaired = true;
    }
  }

  return {
    evidence: {
      source_tier: sourceTier,
      source_label: sourceLabel,
      source_doc_ref: sourceDocRef,
      source_doc_excerpt: sourceDocExcerpt,
      data_points: dataPoints,
      confidence,
      derivation_chain: derivationChain,
      collision_with_broker: collisionWithBroker,
    },
    was_repaired: wasRepaired,
    repair_actions: repairActions,
  };
}

// ---------------------------------------------------------------------------
// Top-level — Normalize the full proforma_fields collection
// ---------------------------------------------------------------------------

interface ProformaField {
  field_path: string;
  evidence?: RawEvidence;
  reasoning?: string | null;
  [key: string]: unknown;
}

export interface NormalizationSummary {
  total_fields: number;
  fields_repaired: number;
  fields_clean: number;
  repair_breakdown: Record<string, number>;
  repaired_field_paths: string[];
}

/**
 * Walk every entry in proforma_fields and normalize the `evidence` slot.
 * Emits structured logs and metrics for every repair.
 *
 * @returns the normalized proforma_fields array + a summary for monitoring.
 */
export function normalizeProformaFields(
  proformaFields: ProformaField[],
  context: {
    deal_id: string;
    run_id: string;
    prompt_version: string;
    logger: Logger;
  },
): { proformaFields: ProformaField[]; summary: NormalizationSummary } {
  const summary: NormalizationSummary = {
    total_fields: proformaFields.length,
    fields_repaired: 0,
    fields_clean: 0,
    repair_breakdown: {},
    repaired_field_paths: [],
  };

  const normalized = proformaFields.map((field) => {
    const reasoning =
      typeof field.reasoning === 'string' ? field.reasoning : null;

    const result = normalizeEvidence(
      field.evidence as RawEvidence,
      field.field_path,
      reasoning,
    );

    if (result.was_repaired) {
      summary.fields_repaired += 1;
      summary.repaired_field_paths.push(field.field_path);

      for (const action of result.repair_actions) {
        summary.repair_breakdown[action] =
          (summary.repair_breakdown[action] ?? 0) + 1;
      }

      context.logger.info('evidence_normalized', {
        deal_id: context.deal_id,
        run_id: context.run_id,
        prompt_version: context.prompt_version,
        field_path: field.field_path,
        repair_actions: result.repair_actions,
      });

      metrics.increment('cashflow.evidence.repaired', 1, {
        prompt_version: context.prompt_version,
        repair_actions: result.repair_actions.join(','),
      });
    } else {
      summary.fields_clean += 1;
    }

    return { ...field, evidence: result.evidence };
  });

  if (summary.total_fields > 0) {
    const conformanceRate = summary.fields_clean / summary.total_fields;

    metrics.gauge('cashflow.evidence.conformance_rate', conformanceRate, {
      prompt_version: context.prompt_version,
    });

    context.logger.info('evidence_normalization_summary', {
      deal_id: context.deal_id,
      run_id: context.run_id,
      prompt_version: context.prompt_version,
      total_fields: summary.total_fields,
      fields_repaired: summary.fields_repaired,
      fields_clean: summary.fields_clean,
      conformance_rate: conformanceRate,
      repair_breakdown: summary.repair_breakdown,
    });

    if (conformanceRate < 0.9) {
      context.logger.warn('evidence_conformance_degraded', {
        deal_id: context.deal_id,
        run_id: context.run_id,
        prompt_version: context.prompt_version,
        conformance_rate: conformanceRate,
        threshold: 0.9,
      });
    }
  }

  return { proformaFields: normalized, summary };
}
