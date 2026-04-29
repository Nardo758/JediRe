/**
 * ProvenancedValue<T>
 * ====================
 *
 * Per F9 Pro Forma Architecture Spec §12 (Graceful Degradation & Provenance).
 *
 * Every mutable Pro Forma assumption is wrapped in this envelope so the model
 * can answer: "where did this number come from, how confident are we in it,
 * and what should happen when it is missing?"
 *
 * This type is the **canonical** envelope on the backend. The frontend has a
 * sibling concept (`LayeredValue<T>` in `dealContext.types.ts`) that predates
 * this spec; ProvenancedValue is the new authoritative structure for any
 * field flowing through M09 (Pro Forma) and consumed by Opus.
 *
 * Resolution order when multiple sources provide a value: USER > PLATFORM > BROKER.
 */

// ────────────────────────────────────────────────────────────────────────────
// Source enum: WHO supplied the value
// ────────────────────────────────────────────────────────────────────────────

/** The agent that supplied the value. Resolution priority: user > platform > broker. */
export type ProvenanceSource = 'user' | 'platform' | 'broker';

/** The mechanical origin of the value (where it actually came from). */
export type ProvenanceOrigin =
  | 'user_input'         // typed in the F9 sheet
  | 'om_extracted'       // pulled from offering memorandum
  | 't12_extracted'      // pulled from trailing-12 P&L
  | 'rent_roll'          // derived from a rent roll
  | 'comp_set'           // M15 / M27 comp-driven
  | 'market_agent'       // M05 market analysis
  | 'tax_intel'          // M26 tax projection
  | 'cap_structure'      // M11 capital structure
  | 'risk_engine'        // M14 risk dashboard
  | 'platform_default'   // hard-coded sane default
  | 'opus_inferred'      // Opus filled it in
  | 'derived'            // computed from other ProvenancedValues
  | 'placeholder';       // explicit "we don't have this yet"

/** Quality flag exposed in UI — drives the cell colour and refusal threshold. */
export type QualityFlag = 'green' | 'yellow' | 'red' | 'unknown';

// ────────────────────────────────────────────────────────────────────────────
// Core envelope
// ────────────────────────────────────────────────────────────────────────────

export interface ProvenancedValue<T> {
  /** The actual value. Nullable so we can carry "missing" forward without faking it. */
  value: T | null;

  /** WHO supplied this value. Drives resolution order. */
  source: ProvenanceSource;

  /** WHERE the value mechanically came from. */
  origin: ProvenanceOrigin;

  /** 0-1 model confidence in the value. */
  confidence: number;

  /** UI-facing quality flag. green = use, yellow = warn, red = reject, unknown = missing. */
  qualityFlag: QualityFlag;

  /** ISO-8601 timestamp the value was last refreshed. */
  asOf: string;

  /** Free-text justification (cap rate explanation, comp citation, etc.). */
  rationale?: string;

  /** Pointer to the upstream module / formula that produced this value. */
  sourceRefs?: Array<{
    moduleId?: string;       // e.g. 'M05', 'M27'
    formulaId?: string;      // e.g. 'F09', 'F32'
    documentId?: string;     // attachment reference
    note?: string;
  }>;

  /** Version of the model / agent that produced this value. */
  modelVersion?: string;

  /** Explicit "user has reviewed and accepted" flag. */
  userReviewed?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();

/** Wrap a raw value with default platform provenance. */
export function provenanced<T>(
  value: T | null,
  source: ProvenanceSource = 'platform',
  confidence = 0.5,
  origin: ProvenanceOrigin = 'platform_default',
  rationale?: string
): ProvenancedValue<T> {
  return {
    value,
    source,
    origin,
    confidence,
    qualityFlag: deriveQualityFlag(value, confidence),
    asOf: nowIso(),
    rationale,
  };
}

/** Explicit "missing" placeholder, never a fake number. */
export function missing<T>(rationale = 'value not yet available'): ProvenancedValue<T> {
  return {
    value: null,
    source: 'platform',
    origin: 'placeholder',
    confidence: 0,
    qualityFlag: 'unknown',
    asOf: nowIso(),
    rationale,
  };
}

/** Derive quality flag from raw signals. Used when callers don't override. */
export function deriveQualityFlag(value: unknown, confidence: number): QualityFlag {
  if (value === null || value === undefined) return 'unknown';
  if (confidence >= 0.75) return 'green';
  if (confidence >= 0.45) return 'yellow';
  return 'red';
}

/**
 * Given a list of candidate ProvenancedValues for the same field, return the
 * one that wins under the user > platform > broker resolution rule.
 * Within the same source bucket, higher confidence wins.
 */
export function resolveProvenance<T>(
  candidates: Array<ProvenancedValue<T> | null | undefined>
): ProvenancedValue<T> | null {
  const valid = candidates.filter((c): c is ProvenancedValue<T> => Boolean(c) && c!.value !== null);
  if (valid.length === 0) return null;

  const order: Record<ProvenanceSource, number> = { user: 0, platform: 1, broker: 2 };
  valid.sort((a, b) => {
    const ord = order[a.source] - order[b.source];
    if (ord !== 0) return ord;
    return b.confidence - a.confidence;
  });
  return valid[0];
}

/** Type guard. */
export function isProvenanced(v: unknown): v is ProvenancedValue<unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    'value' in v &&
    'source' in v &&
    'confidence' in v &&
    'qualityFlag' in v
  );
}

/** Strip the envelope and return the raw value (or null). */
export function unwrap<T>(v: ProvenancedValue<T> | null | undefined): T | null {
  return v?.value ?? null;
}
