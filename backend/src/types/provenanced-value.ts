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

/**
 * Data-quality dimension per Spec §12. Independent of `qualityFlag` (colour):
 * this signals where a value sits on the actual→default scale and drives
 * the F9 cell badge ("library" / "est" / "default") + tooltip.
 */
export type DataQuality = 'ACTUAL' | 'INFERRED' | 'ESTIMATED' | 'DEFAULT';

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

  /** Data-quality bucket for F9 badging (Spec §12). Optional for back-compat. */
  dataQuality?: DataQuality;

  /** Free-text describing how the value was filled (e.g. "regional_avg_class_b_2024"). */
  fillMethod?: string;
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
    dataQuality: deriveDataQuality(origin, source),
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
    dataQuality: 'DEFAULT',
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
 * Derive Spec-§12 data-quality bucket from origin + source.
 *
 *   ACTUAL    direct documented numbers (T12, rent roll, owner-supplied, OM)
 *   INFERRED  comp / market-derived (data library lookup, market agent)
 *   ESTIMATED algorithmic (Opus inference, formula derivation)
 *   DEFAULT   last-resort platform default or explicit placeholder
 *
 * User overrides keep ACTUAL — the user is the highest-trust source.
 */
export function deriveDataQuality(
  origin: ProvenanceOrigin,
  source: ProvenanceSource
): DataQuality {
  if (source === 'user') return 'ACTUAL';
  switch (origin) {
    case 't12_extracted':
    case 'rent_roll':
    case 'om_extracted':
    case 'user_input':
      return 'ACTUAL';
    case 'comp_set':
    case 'market_agent':
    case 'tax_intel':
    case 'cap_structure':
    case 'risk_engine':
      return 'INFERRED';
    case 'opus_inferred':
    case 'derived':
      return 'ESTIMATED';
    case 'platform_default':
    case 'placeholder':
    default:
      return 'DEFAULT';
  }
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
