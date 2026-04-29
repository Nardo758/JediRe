/**
 * Pro Forma Payload Validator
 * ============================
 *
 * Runtime gate for any pro forma JSON object Opus emits, or any payload that
 * downstream services try to write to opus_proforma_versions. Validates against
 * the active template's required sections + fields.
 *
 * This is INTENTIONALLY non-throwing: it returns a structured result that the
 * caller can use to either fall back to a stub, prompt Opus to retry, or warn
 * the user.
 */

import {
  PROFORMA_TEMPLATES,
  ProFormaTemplateId,
  REVENUE_FORMULAS,
  PROVENANCE_RULES,
} from './proforma-blueprint';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  templateId: ProFormaTemplateId | null;
  issues: ValidationIssue[];
  /** Section IDs that passed validation. */
  validSections: string[];
  /** Section IDs that failed (missing or incomplete). */
  invalidSections: string[];
}

/**
 * Validate a pro forma payload Opus emitted.
 *
 * Expected payload shape:
 * {
 *   template: 'acquisition_stabilized',
 *   horizon: 60,
 *   periodicity: 'annual',
 *   revenueFormula?: 'mark_to_market',
 *   sections: [ { id, title, fields: { fieldKey: ProvenancedValue } } ]
 * }
 *
 * If `options.expectedTemplate` is supplied, the validator additionally fails
 * when `payload.template` does not match — preventing Opus from silently
 * picking a different (still-known) template than the one resolved from the
 * deal context (spec §1: template selection is bound to the active deal).
 */
export function validateProformaPayload(
  payload: any,
  options?: { expectedTemplate?: ProFormaTemplateId | null }
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const validSections: string[] = [];
  const invalidSections: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      templateId: null,
      issues: [{ severity: 'error', path: '$', message: 'Payload is not an object' }],
      validSections,
      invalidSections,
    };
  }

  // ── Template ──────────────────────────────────────────────────────────────
  const templateId = payload.template as ProFormaTemplateId;
  if (!templateId || !(templateId in PROFORMA_TEMPLATES)) {
    issues.push({
      severity: 'error',
      path: '$.template',
      message: `Unknown or missing template "${templateId}". Must be one of: ${Object.keys(PROFORMA_TEMPLATES).join(', ')}`,
    });
    return { ok: false, templateId: null, issues, validSections, invalidSections };
  }
  const template = PROFORMA_TEMPLATES[templateId];

  // Active-template enforcement: payload must use the template the platform
  // resolved for this deal, not a different template Opus picked on its own.
  if (options?.expectedTemplate && options.expectedTemplate !== templateId) {
    issues.push({
      severity: 'error',
      path: '$.template',
      message: `Payload template "${templateId}" does not match active deal template "${options.expectedTemplate}"`,
    });
    return { ok: false, templateId, issues, validSections, invalidSections };
  }

  // ── Horizon / periodicity ────────────────────────────────────────────────
  if (typeof payload.horizon !== 'number' || payload.horizon <= 0) {
    issues.push({
      severity: 'warning',
      path: '$.horizon',
      message: `Missing or invalid horizon; defaulting to template (${template.defaultHorizonMonths} months)`,
    });
  }
  if (payload.periodicity && payload.periodicity !== template.periodicity) {
    issues.push({
      severity: 'warning',
      path: '$.periodicity',
      message: `Periodicity "${payload.periodicity}" does not match template default "${template.periodicity}"`,
    });
  }

  // ── Revenue formula ──────────────────────────────────────────────────────
  if (payload.revenueFormula && !(payload.revenueFormula in REVENUE_FORMULAS)) {
    issues.push({
      severity: 'error',
      path: '$.revenueFormula',
      message: `Unknown revenue formula "${payload.revenueFormula}". Must be one of: ${Object.keys(REVENUE_FORMULAS).join(', ')}`,
    });
  }

  // ── Sections ─────────────────────────────────────────────────────────────
  if (!Array.isArray(payload.sections)) {
    issues.push({
      severity: 'error',
      path: '$.sections',
      message: 'sections[] must be an array',
    });
    return { ok: false, templateId, issues, validSections, invalidSections };
  }

  type SectionPayload = { id?: string; title?: string; fields?: Record<string, unknown> };

  const sectionMap: Record<string, SectionPayload> = {};
  for (const s of payload.sections as unknown[]) {
    if (s && typeof s === 'object' && typeof (s as SectionPayload).id === 'string') {
      const sec = s as SectionPayload;
      sectionMap[sec.id as string] = sec;
    }
  }

  // ── Reject UNKNOWN sections (spec §1: blueprint is the only allowed schema) ──
  const allowedSectionIds = new Set(template.sections.map(s => s.id));
  for (const actualId of Object.keys(sectionMap)) {
    if (!allowedSectionIds.has(actualId)) {
      issues.push({
        severity: 'error',
        path: `$.sections[${actualId}]`,
        message: `Unknown section id "${actualId}" — not declared in template "${templateId}". Allowed: ${[...allowedSectionIds].join(', ')}`,
      });
      invalidSections.push(actualId);
    }
  }

  for (const expected of template.sections) {
    const actual = sectionMap[expected.id];
    if (!actual) {
      if (expected.required) {
        issues.push({
          severity: 'error',
          path: `$.sections[${expected.id}]`,
          message: `Required section "${expected.id}" (${expected.title}) is missing`,
        });
        invalidSections.push(expected.id);
      }
      continue;
    }

    const fields: Record<string, unknown> = actual.fields ?? {};
    const missing: string[] = [];
    for (const field of expected.fields) {
      if (!(field in fields)) missing.push(field);
    }
    let sectionInvalid = missing.length > 0 && expected.required;
    if (sectionInvalid) {
      issues.push({
        severity: 'error',
        path: `$.sections[${expected.id}].fields`,
        message: `Required fields missing: ${missing.join(', ')}`,
      });
      invalidSections.push(expected.id);
    }

    // Reject UNKNOWN field keys — Opus must not invent fields.
    const allowedFieldKeys = new Set(expected.fields);
    for (const fieldKey of Object.keys(fields)) {
      if (!allowedFieldKeys.has(fieldKey)) {
        issues.push({
          severity: 'error',
          path: `$.sections[${expected.id}].fields.${fieldKey}`,
          message: `Unknown field "${fieldKey}" — not declared in section "${expected.id}". Allowed: ${[...allowedFieldKeys].join(', ')}`,
        });
        if (!sectionInvalid) {
          invalidSections.push(expected.id);
          sectionInvalid = true;
        }
      }
    }

    if (!sectionInvalid) validSections.push(expected.id);

    // Provenance check: every value should be wrapped (or null+rationale).
    for (const [fieldKey, fieldValue] of Object.entries(fields)) {
      if (!allowedFieldKeys.has(fieldKey)) continue; // already errored above
      if (fieldValue === null || fieldValue === undefined) continue;
      if (typeof fieldValue !== 'object') {
        issues.push({
          severity: 'warning',
          path: `$.sections[${expected.id}].fields.${fieldKey}`,
          message: `Bare value emitted; expected ProvenancedValue envelope`,
        });
        continue;
      }
      const v = fieldValue as Record<string, unknown>;
      if (!('value' in v) || !('source' in v) || !('confidence' in v)) {
        issues.push({
          severity: 'warning',
          path: `$.sections[${expected.id}].fields.${fieldKey}`,
          message: `Value object missing ProvenancedValue keys (value, source, confidence)`,
        });
        continue;
      }
      const confidence = v.confidence;
      if (typeof confidence === 'number' && confidence < PROVENANCE_RULES.refusalThreshold && v.value !== null) {
        issues.push({
          severity: 'warning',
          path: `$.sections[${expected.id}].fields.${fieldKey}`,
          message: `Confidence ${confidence} below refusal threshold ${PROVENANCE_RULES.refusalThreshold}; should be marked qualityFlag=red or set value=null`,
        });
      }
    }
  }

  const errors = issues.filter(i => i.severity === 'error');
  return {
    ok: errors.length === 0,
    templateId,
    issues,
    validSections,
    invalidSections,
  };
}
