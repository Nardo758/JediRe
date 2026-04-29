/**
 * M08 → M09 Template Emitter
 * ===========================
 *
 * Per Spec §4 (F5 → F9 structural mutation): when M08 picks a strategy, it
 * emits a structured payload that M09 (Pro Forma) consumes verbatim:
 *
 *   { template, sections[], horizon, periodicity, revenueFormulas[] }
 *
 * The F9 sub-tab renderer reads `sections[]` and lays out one tab per section.
 */

import {
  PROFORMA_TEMPLATES,
  ProFormaTemplateId,
  REVENUE_FORMULAS,
  RevenueFormulaId,
  DEFAULT_REVENUE_FORMULA,
} from './blueprint/proforma-blueprint';
import {
  pickTemplateForStrategy,
  defaultTemplateForDealType,
  defaultRevenueFormulasFor,
} from './blueprint';

export interface ProFormaTemplateEmission {
  template: ProFormaTemplateId;
  templateLabel: string;
  horizon: number;             // months
  periodicity: 'monthly' | 'quarterly' | 'annual';
  sections: Array<{
    id: string;
    title: string;
    required: boolean;
    fields: string[];
  }>;
  revenueFormulas: RevenueFormulaId[];
  defaultRevenueFormula: RevenueFormulaId;
  /** Where the template choice came from (auditing). */
  selectedBy: 'strategy' | 'deal_type' | 'user_override' | 'fallback';
  selectionRationale: string;
}

export interface EmitOptions {
  /** M08 strategy slug. Wins over dealType if both supplied. */
  strategy?: string | null;
  /** Deal type used as fallback when strategy is missing. */
  dealType?: 'existing' | 'development' | 'redevelopment' | null;
  /** Explicit user override (bypasses both). */
  userTemplateOverride?: ProFormaTemplateId | null;
  /** User-selected revenue formula. */
  userRevenueFormula?: RevenueFormulaId | null;
}

export function emitProFormaTemplate(opts: EmitOptions = {}): ProFormaTemplateEmission {
  let templateId: ProFormaTemplateId;
  let selectedBy: ProFormaTemplateEmission['selectedBy'];
  let rationale: string;

  if (opts.userTemplateOverride && opts.userTemplateOverride in PROFORMA_TEMPLATES) {
    templateId = opts.userTemplateOverride;
    selectedBy = 'user_override';
    rationale = `User explicitly selected template "${templateId}".`;
  } else if (opts.strategy) {
    templateId = pickTemplateForStrategy(opts.strategy);
    selectedBy = 'strategy';
    rationale = `Selected via M08 strategy "${opts.strategy}".`;
  } else if (opts.dealType) {
    templateId = defaultTemplateForDealType(opts.dealType);
    selectedBy = 'deal_type';
    rationale = `Selected via deal type "${opts.dealType}" (no strategy yet).`;
  } else {
    templateId = 'acquisition_stabilized';
    selectedBy = 'fallback';
    rationale = 'No strategy or deal type provided; defaulting to acquisition_stabilized.';
  }

  const template = PROFORMA_TEMPLATES[templateId];
  const formulasForStrategy = opts.strategy
    ? defaultRevenueFormulasFor(opts.strategy)
    : Object.keys(REVENUE_FORMULAS) as RevenueFormulaId[];
  const revenueFormulas = formulasForStrategy.length > 0
    ? formulasForStrategy
    : ([DEFAULT_REVENUE_FORMULA] as RevenueFormulaId[]);

  const defaultRevenueFormula =
    (opts.userRevenueFormula && opts.userRevenueFormula in REVENUE_FORMULAS)
      ? opts.userRevenueFormula
      : (revenueFormulas[0] ?? DEFAULT_REVENUE_FORMULA);

  return {
    template: templateId,
    templateLabel: template.label,
    horizon: template.defaultHorizonMonths,
    periodicity: template.periodicity,
    sections: template.sections.map(s => ({
      id: s.id,
      title: s.title,
      required: s.required,
      fields: [...s.fields],
    })),
    revenueFormulas,
    defaultRevenueFormula,
    selectedBy,
    selectionRationale: rationale,
  };
}
