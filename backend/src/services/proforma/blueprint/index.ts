/**
 * Pro Forma Blueprint — public surface
 * =====================================
 *
 * Re-exports the canonical blueprint plus helpers used by:
 *   - Opus prompt builder (slice & inject)
 *   - Runtime payload validator (gate Opus output)
 *   - Drift test (compare blueprint against module-registry)
 */

export * from './proforma-blueprint';

import {
  PROFORMA_BLUEPRINT,
  PROFORMA_TEMPLATES,
  REVENUE_FORMULAS,
  ProFormaTemplateId,
  RevenueFormulaId,
  M09_INPUTS,
} from './proforma-blueprint';

// ────────────────────────────────────────────────────────────────────────────
// Helpers — selection
// ────────────────────────────────────────────────────────────────────────────

/**
 * Pick the right Pro Forma template for an M08 strategy slug.
 * Falls back to acquisition_stabilized if the strategy is unknown.
 */
export function pickTemplateForStrategy(strategySlug: string): ProFormaTemplateId {
  // Normalize display names ("Build-to-Sell", "Value-Add") and slugs ("build_to_sell")
  // to the same underscore form so call sites don't need to pre-normalize.
  // Task #1265 — added hyphen/space → underscore normalization to handle raw DB values.
  const slug = (strategySlug || '').toLowerCase().replace(/[\s-]+/g, '_');
  for (const [id, spec] of Object.entries(PROFORMA_TEMPLATES)) {
    if (spec.strategyTriggers.some(t => t === slug)) {
      return id as ProFormaTemplateId;
    }
  }
  return 'acquisition_stabilized';
}

/** Default template for a given deal type (when no strategy is set yet).
 * Covers all 6 DealTypeKey values so proformaTemplateId is never wrong
 * for pre-Task-#1233 deals that have deal_type but no investmentStrategy.
 * Task #1265 — extended from 3-type to 6-type coverage.
 */
export function defaultTemplateForDealType(
  dealType: string | null | undefined
): ProFormaTemplateId {
  switch (dealType) {
    case 'development':   return 'development_ground_up';
    case 'redevelopment': return 'redevelopment';
    case 'value_add':
    case 'value-add':     return 'acquisition_value_add';
    case 'lease_up':
    case 'lease-up':      return 'acquisition_stabilized';   // Phase 1 approximation; Phase 2 adds lease_up template
    case 'stabilized':
    case 'existing':
    default:              return 'acquisition_stabilized';
  }
}

/** Default revenue formula list for a given strategy. */
export function defaultRevenueFormulasFor(strategySlug: string): RevenueFormulaId[] {
  const slug = (strategySlug || '').toLowerCase();
  return Object.values(REVENUE_FORMULAS)
    .filter(f => f.appropriateFor.some(s => s === slug))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    .map(f => f.id);
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers — Opus prompt slicing
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a compact JSON-ish slice of the blueprint suitable for inclusion in
 * the Opus system prompt. We strip verbose objects (passes, descriptions) to
 * keep the token footprint small while still giving Opus the schema it needs.
 */
export function buildOpusBlueprintSlice(opts?: {
  templateId?: ProFormaTemplateId;
  dealType?: 'existing' | 'development' | 'redevelopment';
}): string {
  const templateId = opts?.templateId
    ?? (opts?.dealType ? defaultTemplateForDealType(opts.dealType) : 'acquisition_stabilized');
  const template = PROFORMA_TEMPLATES[templateId];

  const slice = {
    version: PROFORMA_BLUEPRINT.version,
    activeTemplate: {
      id: template.id,
      label: template.label,
      horizonMonths: template.defaultHorizonMonths,
      periodicity: template.periodicity,
      sections: template.sections.map(s => ({
        id: s.id,
        title: s.title,
        required: s.required,
        fields: s.fields,
      })),
    },
    fkeyMap: PROFORMA_BLUEPRINT.fkeyMap,
    m09Inputs: M09_INPUTS.map(i => ({
      moduleId: i.moduleId,
      strength: i.strength,
      requiredByDealType: i.requiredByDealType,
      dataKeys: i.dataKeys,
    })),
    rentTerms: PROFORMA_BLUEPRINT.rentTerms,
    opexLineItems: PROFORMA_BLUEPRINT.opexLineItems.map(o => ({ key: o.key, label: o.label })),
    revenueFormulas: Object.values(REVENUE_FORMULAS).map(f => ({
      id: f.id,
      label: f.label,
      isDefault: f.isDefault,
      inputs: f.inputs,
    })),
    provenanceRules: {
      resolutionOrder: PROFORMA_BLUEPRINT.provenanceRules.resolutionOrder,
      refusalThreshold: PROFORMA_BLUEPRINT.provenanceRules.refusalThreshold,
    },
  };

  return JSON.stringify(slice, null, 2);
}

/** Plain-English rules of the road appended after the blueprint slice. */
export function buildOpusBlueprintRules(): string {
  return [
    '## Pro Forma Blueprint Rules (MUST follow)',
    '1. Output JSON inside ```proforma fences. The `template` field MUST be one of the templates listed in `activeTemplate.id`.',
    '2. Every section in `activeTemplate.sections` whose `required: true` MUST appear in your `sections[]` array, with the listed `fields` populated.',
    '3. Never invent a module ID, F-key, formula ID, or OPEX line item that is not in the blueprint above.',
    '4. Wrap every assumption in a ProvenancedValue envelope: `{ value, source, origin, confidence, qualityFlag, asOf, rationale }`. Never emit a bare number.',
    '5. If you do not have a value, set it to `{ value: null, source: "platform", origin: "placeholder", confidence: 0, qualityFlag: "unknown", asOf: "<now>" }` — do NOT make up numbers.',
    '6. The default revenue formula is `mark_to_market`. Use a different formula only when the user explicitly asks or the asset class requires it (per `appropriateFor`).',
    '7. Resolution order for conflicting values is user > platform > broker.',
  ].join('\n');
}
