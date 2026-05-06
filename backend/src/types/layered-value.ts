/**
 * LayeredValue — tiered provenance wrapper for every deal assumption.
 *
 * Three types:
 *   LayeredValue<T>     — base type used for most deal fields
 *   UnderwritingValue<T>— extends LayeredValue with full Evidence chain (CashFlow agent)
 *
 * Source tiers used by the CashFlow Evidence System:
 *   Tier 1: deal documents (t12, rent_roll, tax_bill)
 *   Tier 2: owned portfolio actuals (owned_asset)
 *   Tier 3: platform intelligence (market comps, jurisdiction forecasts)
 *   Tier 4: broker OM (lowest authority — subject to collision detection)
 */

import { z } from 'zod';

// ── Source literals ────────────────────────────────────────────────

export type LayeredValueSource =
  | 'tier1:t12'
  | 'tier1:rent_roll'
  | 'tier1:tax_bill'
  | 'tier2:owned_asset'
  | 'tier3:platform'
  | 'tier3:market_comp'
  | 'tier3:jurisdiction'
  | 'tier4:broker'
  | 'agent:research'
  | 'agent:zoning'
  | 'agent:supply'
  | 'agent:cashflow'
  | 'agent:commentary'
  /** M07 Subject History tiers: single snapshot (S1) through longitudinal history (S4) */
  | 'subject_history:s1'
  | 'subject_history:s2'
  | 'subject_history:s3'
  | 'subject_history:s4'
  | 't12'
  | 'rent_roll'
  | 'tax_bill'
  | 'override'
  | 'platform'
  | 'agent'
  | 'broker'
  | 'user'
  | 'computed';

// ── Base LayeredValue<T> ───────────────────────────────────────────

export interface LayeredValue<T> {
  value: T;
  source: LayeredValueSource | string;
  agentRunId?: string;
  agentId?: string;
  runAt?: string;
  metadata?: Record<string, unknown>;
  /**
   * True when OperatorStance modulated this value after tier-hierarchy resolution.
   * Drives the "yellow attention" marker in the Thesis / Assumptions UI.
   */
  stanceModulated?: boolean;
  /**
   * Human-readable trace of which stance rules fired and their net delta.
   * e.g. "stance: net +25bps [posture_aggressive_rent_growth(+25bps)]"
   */
  stanceTrace?: string;
}

// ── Evidence types ─────────────────────────────────────────────────

export interface EvidencePoint {
  tier: 1 | 2 | 3 | 4;
  source: LayeredValueSource | string;
  label: string;
  value: number | string | null;
  weight: number;
  notes?: string;
  run_id?: string;
}

export interface Alternative {
  source: LayeredValueSource | string;
  label: string;
  value: number | string | null;
  delta_pct?: number | null;
  reason_rejected: string;
}

export interface CollisionReport {
  field_path: string;
  agent_value: number | string | null;
  broker_value: number | string | null;
  delta_pct: number | null;
  magnitude: 'minor' | 'material' | 'severe';
  direction: 'agent_higher' | 'agent_lower' | 'equal';
  narrative: string;
}

export interface Evidence {
  field_path: string;
  primary_tier: 1 | 2 | 3 | 4;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  data_points: EvidencePoint[];
  alternatives: Alternative[];
  collision?: CollisionReport | null;
}

export interface UnderwritingValue<T> extends LayeredValue<T> {
  evidence: Evidence;
}

// ── Zod schemas (runtime validation) ──────────────────────────────

export const EvidencePointSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  source: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  weight: z.number().min(0).max(1),
  notes: z.string().optional(),
  run_id: z.string().optional(),
});

export const AlternativeSchema = z.object({
  source: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  delta_pct: z.number().nullable().optional(),
  reason_rejected: z.string(),
});

export const CollisionReportSchema = z.object({
  field_path: z.string(),
  agent_value: z.union([z.number(), z.string(), z.null()]),
  broker_value: z.union([z.number(), z.string(), z.null()]),
  delta_pct: z.number().nullable(),
  magnitude: z.enum(['minor', 'material', 'severe']),
  direction: z.enum(['agent_higher', 'agent_lower', 'equal']),
  narrative: z.string(),
});

export const EvidenceSchema = z.object({
  field_path: z.string(),
  primary_tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
  data_points: z.array(EvidencePointSchema),
  alternatives: z.array(AlternativeSchema),
  collision: CollisionReportSchema.nullable().optional(),
});

export const UnderwritingOutputFieldSchema = z.object({
  value: z.union([z.number(), z.string(), z.null()]),
  source: z.string(),
  evidence: EvidenceSchema,
});

export const UnderwritingOutputSchema = z.object({
  proforma_fields: z.record(z.string(), UnderwritingOutputFieldSchema),
  collision_summary: z.object({
    minor_count: z.number().int(),
    material_count: z.number().int(),
    severe_count: z.number().int(),
  }),
  confidence_distribution: z.object({
    high: z.number().int(),
    medium: z.number().int(),
    low: z.number().int(),
  }),
  tier_distribution: z.object({
    tier1: z.number().int(),
    tier2: z.number().int(),
    tier3: z.number().int(),
    tier4: z.number().int(),
  }),
  summary: z.string(),
  completed_at: z.string(),
});

export type UnderwritingOutput = z.infer<typeof UnderwritingOutputSchema>;
