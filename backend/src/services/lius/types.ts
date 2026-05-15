/**
 * LIUS — Line-Item Underwriting Schema
 *
 * Core type system for the deterministic line-item underwriting engine.
 * Every F9 proforma line item gets a schema file that defines:
 *  - Which archetype (A-F) governs resolution
 *  - Source preference tier order
 *  - Hard rules (jurisdiction overrides, deal-type exceptions)
 *  - Cross-checks to validate the result
 *  - Trajectory events that modify year-over-year behavior
 *  - Collision detection thresholds
 *  - Reasoning templates for LLM prose generation
 */

import { z } from 'zod';

// ─── Archetypes ──────────────────────────────────────────────────────────────

/**
 * Six archetypes. Each schema file declares one.
 * A = index-anchored growth          (revenue, management fee)
 * B = T12-anchored, cross-validated  (most OpEx: R&M, payroll, admin)
 * C = ruleset-driven                 (taxes, insurance — jurisdiction-dependent)
 * D = originator / broker-sourced    (debt assumptions, exit cap)
 * E = zero-rule baseline             (replacement reserves, vacancy/credit)
 * F = market-index driven            (rent growth, expense inflation)
 */
export const ARCHETYPES = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type Archetype = typeof ARCHETYPES[number];

// ─── Entity Ids ──────────────────────────────────────────────────────────────

/**
 * Stable, location-independent entity ID for cross-system reference.
 * Never changes between schema versions.
 * Format: {section}.{key} — e.g. "opex.propertyTax", "income.markToMarket"
 */
export type Liuid = string;

// ─── Lifecycle Phases ────────────────────────────────────────────────────────

export const LIFECYCLE_PHASES = [
  'lease_up',
  'lease_up_transition',
  'stabilized',
  'transition',
  'disposition_prep',
] as const;
export type LifecyclePhase = typeof LIFECYCLE_PHASES[number];

// ─── Deal Types ──────────────────────────────────────────────────────────────

export const DEAL_TYPES = ['acquisition', 'development', 'refi', 'reforecast', 'disposition'] as const;
export type DealType = typeof DEAL_TYPES[number];

// ─── Tier Enum ───────────────────────────────────────────────────────────────

export const TIERS = [1, 2, 2.5, 3, 4, 5] as const;
export type Tier = typeof TIERS[number];

// ─── Source References ───────────────────────────────────────────────────────

export const SourceSchema = z.object({
  tier: z.number(),          // 1 | 2 | 2.5 | 3 | 4 | 5
  sourceKey: z.string(),     // 't12', 'deal_data', 'profile_benchmark', 'archive', 'broker_om', 'agent_default'
  sourceLabel: z.string(),
  value: z.number().nullable(),
  perUnit: z.number().nullable(),
  pctEgi: z.number().nullable(),
  n: z.number().optional(),  // sample count for benchmarks
  freshness: z.number().optional(), // 0-1
});

export type EvidenceSource = z.infer<typeof SourceSchema>;

// ─── Trajectory Events ───────────────────────────────────────────────────────

export const TrajectoryPrimitives = [
  'rate_delta',     // Y1→Y2 grows at X% instead of base growth rate
  'level_reset',    // value resets to new base at year Y (tax reassessment, FL insurance)
  'discrete_spike', // single-year spike then return (storm damage, HVAC replacement)
] as const;
export type TrajectoryPrimitive = typeof TrajectoryPrimitives[number];

export const TrajectoryEventSchema = z.object({
  primitive: z.enum(TrajectoryPrimitives),
  year: z.number(),                     // 1-indexed year in hold period
  description: z.string(),
  value: z.number().nullable().default(null),         // absolute value for level_reset / discrete_spike
  deltaPct: z.number().nullable().default(null),      // percentage for rate_delta
  source: z.string(),                   // 'schema' | 'profile' | 'kg' | 'user'
  confidence: z.number(),               // 0-1
  binding: z.boolean().default(false),  // if true, cannot be overridden
});

export type TrajectoryEvent = z.infer<typeof TrajectoryEventSchema>;

// ─── Cross-Checks ────────────────────────────────────────────────────────────

export const CHECK_SEVERITIES = ['pass', 'warn', 'fail'] as const;
export type CheckSeverity = typeof CHECK_SEVERITIES[number];

export const CrossCheckSchema = z.object({
  check: z.string(),                     // name of the check function
  result: z.enum(CHECK_SEVERITIES),
  message: z.string(),
  autoCorrected: z.boolean().optional(), // did the engine auto-adjust?
  autoCorrectedTo: z.number().nullable().optional(),
  threshold: z.number().optional(),      // threshold that triggered
});

export type CrossCheck = z.infer<typeof CrossCheckSchema>;

// ─── Collision Report ────────────────────────────────────────────────────────

export const COLLISION_MAGNITUDES = ['minor', 'material', 'severe'] as const;
export type CollisionMagnitude = typeof COLLISION_MAGNITUDES[number];

export const CollisionReportSchema = z.object({
  agentValue: z.number().nullable(),
  brokerValue: z.number().nullable(),
  deltaPct: z.number().nullable(),
  deltaAbs: z.number().nullable(),
  magnitude: z.nativeEnum({
    minor: 'minor' as const,
    material: 'material' as const,
    severe: 'severe' as const,
  }),
  direction: z.enum(['agent_higher', 'agent_lower', 'equal']),
  narrative: z.string(),
});

export type CollisionReport = z.infer<typeof CollisionReportSchema>;

// ─── Confidence Score ────────────────────────────────────────────────────────

export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const ConfidenceScoreSchema = z.object({
  score: z.number().min(0).max(1),
  level: ConfidenceLevelSchema,
  posteriorP10: z.number().nullable(),
  posteriorP90: z.number().nullable(),
  weakestLinks: z.array(z.string()),
});

export type ConfidenceScore = z.infer<typeof ConfidenceScoreSchema>;

// ─── Hard Rule ───────────────────────────────────────────────────────────────

export const HardRuleSchema = z.object({
  condition: z.string(),                // human-readable: "FL coastal acquisition"
  description: z.string(),              // what this rule does
  effect: z.object({
    sourceActions: z.array(z.object({
      tier: z.number(),
      action: z.enum(['replace', 'remove']),
      replacement: z.string().optional(), // source key to use instead
    })),
    trajectoryOverrides: z.array(z.object({
      year: z.number(),
      primitive: z.enum(TrajectoryPrimitives),
      value: z.number().nullable(),
      binding: z.boolean().default(true),
    })).optional(),
  }),
});

export type HardRule = z.infer<typeof HardRuleSchema>;

// ─── Materiality Threshold ───────────────────────────────────────────────────

export const MaterialityThresholdSchema = z.object({
  absoluteMin: z.number(),              // $0 — always flag if broker delta > $200K
  pctMin: z.number(),                   // 0.30 — only flag if >30% AND >absMin
  group: z.string().optional(),         // group for aggregate materiality roll-ups
});

export type MaterialityThreshold = z.infer<typeof MaterialityThresholdSchema>;

// ─── Reasoning Template ──────────────────────────────────────────────────────

export const ReasoningTemplateSchema = z.object({
  archetype: z.enum(ARCHETYPES),
  template: z.string(),                 // Handlebars-style template string
  sections: z.array(z.string()),        // Ordered sections: ['derivation', 'cross_validation', 'decision']
});

export type ReasoningTemplate = z.infer<typeof ReasoningTemplateSchema>;

// ─── Full Schema ─────────────────────────────────────────────────────────────

export const LIUSSchema = z.object({
  $schema: z.string().optional(),
  liuid: z.string(),                        // e.g. "opex.propertyTax"
  version: z.number().default(1),
  label: z.string(),                        // "Property Tax"
  section: z.string(),                      // "opex"
  archetype: z.enum(ARCHETYPES),
  
  // Deal type filter: which deal types this schema applies to
  applicableDealTypes: z.array(z.enum(DEAL_TYPES)).default(['acquisition', 'development', 'refi', 'reforecast']),
  
  // Lifecycle phase overrides
  lifecycleOverrides: z.array(z.object({
    phase: z.enum(LIFECYCLE_PHASES),
    sourcePreference: z.array(z.number()),  // overrides default source_preference
  })).default([]),
  
  // Default source preference order (by tier)
  sourcePreference: z.array(z.number()),
  
  // Cross-references: which lines this depends on (for DAG resolution order)
  dependsOn: z.object({
    required: z.array(z.string()).default([]),    // must be resolved first
    recommended: z.array(z.string()).default([]), // should be resolved first if available
  }).default({ required: [], recommended: [] }),
  
  // Hard rules: conditional overrides
  hardRules: z.array(HardRuleSchema).default([]),
  
  // Cross-checks
  crossChecks: z.array(z.object({
    check: z.string(),                      // function name in check registry
    thresholds: z.object({
      warn: z.number(),
      fail: z.number(),
    }),
    description: z.string(),
  })).default([]),
  
  // Trajectory events
  trajectory: z.object({
    baseGrowth: z.string().default('cpi'),  // growth driver from proforma-blueprint
    scheduledEvents: z.array(TrajectoryEventSchema).default([]),
    profileDerivedEvents: z.boolean().default(false),  // use building profile to generate events
  }).default({ baseGrowth: 'cpi', scheduledEvents: [], profileDerivedEvents: false }),
  
  // Collision detection
  collision: z.object({
    enabled: z.boolean().default(false),
    materiality: MaterialityThresholdSchema.optional(),
    brokerMapping: z.string().optional(),     // maps to broker OM field path
  }).default({ enabled: false }),
  
  // Reasoning template
  reasoningTemplate: z.string().optional(),
  
  // Confidence calibration
  confidence: z.object({
    minSampleForHigh: z.number().default(30),
    freshnessDays: z.number().default(365),
  }).default({ minSampleForHigh: 30, freshnessDays: 365 }),
  
  // Notes for schema maintainers
  notes: z.string().optional(),
});

export type LIUSchema = z.infer<typeof LIUSSchema>;

// ─── Evidence Output ─────────────────────────────────────────────────────────

export const EvidenceSchema = z.object({
  liuid: z.string(),
  schemaVersion: z.number(),
  archetype: z.enum(ARCHETYPES),
  
  // Resolved value
  posterior: z.object({
    value: z.number(),
    perUnit: z.number().nullable(),
    pctEgi: z.number().nullable(),
  }),
  
  source: z.object({
    primaryTier: z.number(),
    primarySource: z.string(),
    contributions: z.array(SourceSchema),
  }),
  
  trajectory: z.object({
    events: z.array(TrajectoryEventSchema),
    yearProjections: z.array(z.object({
      year: z.number(),
      value: z.number(),
      growth: z.number(),
      driver: z.string(),
    })),
  }),
  
  crossChecks: z.array(CrossCheckSchema).default([]),
  
  collision: CollisionReportSchema.nullable().default(null),
  
  confidence: ConfidenceScoreSchema,
  
  reasoning: z.string(),                  // LLM-generated prose
  
  metadata: z.object({
    computedAt: z.string(),
    elapsedMs: z.number(),
    schemaFile: z.string().optional(),
    agentRunId: z.string().optional(),
  }),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

// ─── Schema Catalog ──────────────────────────────────────────────────────────

export interface SchemaCatalogEntry {
  liuid: Liuid;
  schema: LIUSchema;
  filePath: string;
  source: 'yaml' | 'json' | 'typescript';
}

export interface SchemaCatalog {
  version: string;
  entries: SchemaCatalogEntry[];
  bySection: Record<string, SchemaCatalogEntry[]>;
  byLiuid: Record<Liuid, SchemaCatalogEntry>;
  dagOrder: Liuid[];                     // topological sort result
}
