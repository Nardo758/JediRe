/**
 * Frontend mirror of F9 Pro Forma Tier-1 protector types.
 * Kept structurally identical to backend so server payloads can be cast.
 *
 * Source of truth: docs/architecture/f9-proforma-spec.md §6-§9
 *                  backend/src/services/proforma/{validators,layered-growth}/
 */

export interface ConfidenceBands {
  forecast: number;
  sigmaTotal: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
}

export type OverrideClassification = 'within' | 'soft_warning' | 'hard_warning';

export interface OverrideClassificationResult {
  classification: OverrideClassification;
  requireJustification: boolean;
  zDistance: number;
  message: string;
}

export type GordonFlag = 'GORDON_OVER_PROMISE' | 'GORDON_CONSERVATIVE';
export type GordonSeverity = 'high' | 'medium' | 'info';

export interface GordonValidationResult {
  valid: boolean;
  impliedCap: number | null;
  divergenceBps: number | null;
  flag?: GordonFlag;
  severity?: GordonSeverity;
  message?: string;
}

export type ValidationFlagSeverity = 'high' | 'medium' | 'info';

export interface ValidationFlag {
  /** Stable id so the UI can de-dupe identical re-fires. */
  id: string;
  /** Originating module / validator. */
  source: 'gordon' | 'override' | 'refusal' | 'noi_identity';
  severity: ValidationFlagSeverity;
  /** Field path the flag attaches to (e.g. 'exitCapRate', 'rentGrowthStabilized'). */
  field?: string;
  message: string;
  /** Free-form payload — chart data, divergence bps, etc. */
  data?: Record<string, unknown>;
  /** When user dismisses with a justification, captured here. */
  justification?: string;
  dismissed?: boolean;
  raisedAt: string;
}

export interface RefusalDecision {
  refuse: boolean;
  reason?: 'INSUFFICIENT_DATA';
  required?: string;
  available?: { comps: number; history_years: number; asset_class_present: boolean };
  message?: string;
}
