/**
 * Pro Forma Template — Frontend types
 * =====================================
 *
 * Mirrors the backend `ProFormaTemplateEmission` shape produced by
 * `backend/src/services/proforma/template-emitter.ts`. Kept as a single
 * lightweight type file so the F9 renderer doesn't need to import the
 * blueprint module directly.
 *
 * Spec source: docs/architecture/f9-proforma-spec.md §4, §11.
 */

export type ProFormaTemplateId =
  | 'acquisition_stabilized'
  | 'acquisition_value_add'
  | 'development_ground_up'
  | 'redevelopment'
  | 'flip'
  | 'str_shortterm'
  | 'land_hold';

export type RevenueFormulaId =
  | 'mark_to_market'
  | 'in_place_compounding'
  | 'renewal_aware'
  | 'rent_ramp_value_add'
  | 'gpr_minus_loss_to_lease';

export interface ProFormaSectionSpec {
  id: string;
  title: string;
  required: boolean;
  fields: string[];
}

export interface ProFormaTemplateEmission {
  template: ProFormaTemplateId;
  templateLabel: string;
  horizon: number;
  periodicity: 'monthly' | 'quarterly' | 'annual';
  sections: ProFormaSectionSpec[];
  revenueFormulas: RevenueFormulaId[];
  defaultRevenueFormula: RevenueFormulaId;
  selectedBy: 'strategy' | 'deal_type' | 'user_override' | 'fallback';
  selectionRationale: string;
}

/** Provenance envelope shape (mirrors backend `ProvenancedValue<T>`). */
export type ProvenanceSource = 'user' | 'platform' | 'broker';
export type QualityFlag = 'green' | 'yellow' | 'red' | 'unknown';

export interface ProvenancedValue<T> {
  value: T | null;
  source: ProvenanceSource;
  origin: string;
  confidence: number;
  qualityFlag: QualityFlag;
  asOf: string;
  rationale?: string;
  sourceRefs?: Array<{
    moduleId?: string;
    formulaId?: string;
    documentId?: string;
    note?: string;
  }>;
  modelVersion?: string;
  userReviewed?: boolean;
}
