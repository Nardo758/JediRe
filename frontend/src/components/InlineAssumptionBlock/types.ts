/**
 * InlineAssumptionBlock — type definitions
 *
 * All types are local to this component family. Upstream store selector
 * contracts are expressed here so consumers know what shape to pass.
 */

// ─── Field format mask ─────────────────────────────────────────────────────

export type FieldFormat = 'pct' | 'num' | 'currency' | 'months' | 'days' | 'ratio';

// ─── Single assumption field ───────────────────────────────────────────────

export interface AssumptionFieldDef {
  fieldId: string;
  label: string;
  format: FieldFormat;
  /** Increment per Up/Down keystroke (Shift = 10×) */
  precision: number;
  min?: number;
  max?: number;
  /** Platform peer-set posterior (read-only) */
  peerValue: number | null;
  /** Subject-history value (S1+); null when no rent roll uploaded */
  subjectValue: number | null;
  /** Bayesian blended effective value shown in EFFECTIVE column */
  effectiveValue: number | null;
  /** Source tag driving the EFFECTIVE value (drives badge) */
  source: string;
  confidence: 'HIGH' | 'MED' | 'LOW';
  /** Active user override on this field, if any */
  overrideValue?: number | null;
  /** Optional engine-provided narrative for drilldown modal */
  narrative?: string | null;
  /** Weight used in Bayesian blend (0-1); null when no subject */
  blendWeight?: number | null;
}

// ─── Collision entry ───────────────────────────────────────────────────────

export type CollisionSeverity = 'material' | 'severe';

export interface CollisionEntry {
  fieldId: string;
  /** Absolute sigma deviation: |subject − peer| / (peer × 0.15) */
  deltaSigma: number;
  subjectValue: number;
  peerValue: number;
  /** Engine-supplied narrative bullet (optional) */
  narrative?: string | null;
  severity: CollisionSeverity;
}

// ─── Block props ───────────────────────────────────────────────────────────

export interface InlineAssumptionBlockProps {
  blockId: string;
  blockLabel: string;
  dealId?: string;
  fields: AssumptionFieldDef[];
  /** Whether the deal has ≥S1 subject history (drives 2-col vs 3-col mode) */
  hasSubjectHistory: boolean;
  subjectTier?: 'S1' | 'S2' | 'S3' | 'S4';
  subjectSnapshotCount?: number;
  collisions?: CollisionEntry[];
  defaultExpanded?: boolean;
  onOverride?: (fieldId: string, value: number) => void;
  onRevert?: (fieldId: string) => void;
}

// ─── Ref interface (F-key / focus-edit from parent) ───────────────────────

export interface AssumptionBlockRef {
  /** Focus edit mode on a specific field by id */
  focusEdit: (fieldId: string) => void;
}

// ─── Drift sigma output ────────────────────────────────────────────────────

export interface DriftResult {
  sigma: number;
  direction: 'up' | 'down' | 'neutral';
}

// ─── Drilldown layer row ───────────────────────────────────────────────────

export interface DrilldownLayer {
  label: string;
  value: number | null;
  active: boolean;
  note?: string;
}
