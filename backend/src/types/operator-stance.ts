/**
 * OperatorStance — the meta-layer that modulates how the Cashflow Agent
 * exercises discretion when deriving assumptions.
 *
 * ARCHITECTURE NOTE:
 *   LayeredValue<T> answers: "What is this number, and where did it come from?"
 *   OperatorStance answers:  "How should the agent derive numbers when it has discretion?"
 *
 * OperatorStance is a SIBLING of LayeredValue, not a layer of it.
 * It modulates blend weights and adds floors/ceilings AFTER the tier hierarchy
 * resolves a value, tagging each modulated LayeredValue with:
 *   { stanceModulated: true, stanceTrace: "rule that fired" }
 *
 * Persisted as JSONB in deals.operator_stance. Null treated as MARKET defaults.
 * Per-deal only — no presets or multi-user ownership in v1.
 */

import { z } from 'zod';

// ── Core enums ─────────────────────────────────────────────────────────────

export const RateEnvironmentSchema = z.enum(['CUTTING', 'NORMALIZING', 'HIGHER_FOR_LONGER']);
export type RateEnvironment = z.infer<typeof RateEnvironmentSchema>;

export const CyclePositionSchema = z.enum(['EARLY', 'MID', 'LATE']);
export type CyclePosition = z.infer<typeof CyclePositionSchema>;

export const UnderwritingPostureSchema = z.enum(['CONSERVATIVE', 'MARKET', 'AGGRESSIVE']);
export type UnderwritingPosture = z.infer<typeof UnderwritingPostureSchema>;

export const ConcessionStrategySchema = z.enum(['CONSERVATIVE', 'MARKET', 'AGGRESSIVE']);
export type ConcessionStrategy = z.infer<typeof ConcessionStrategySchema>;

export const MarketingIntensitySchema = z.enum(['LOW', 'MARKET', 'AGGRESSIVE']);
export type MarketingIntensity = z.infer<typeof MarketingIntensitySchema>;

export const ExpenseGrowthPostureSchema = z.enum(['CONTAINED', 'INFLATION', 'STRESSED']);
export type ExpenseGrowthPosture = z.infer<typeof ExpenseGrowthPostureSchema>;

// ── OperatorStance schema ──────────────────────────────────────────────────

export const OperatorStanceSchema = z.object({
  // ── Macro view ─────────────────────────────────────────────────
  /** Federal Reserve rate trajectory — modulates exit cap and opex growth. */
  rateEnvironment: RateEnvironmentSchema.default('NORMALIZING'),
  /** Where we are in the real estate cycle — modulates rent growth and vacancy assumptions. */
  cyclePosition: CyclePositionSchema.default('MID'),
  /** Subjective recession probability 0–1 — activates stress overlays above 0.4. */
  recessionProbability: z.number().min(0).max(1).default(0.15),

  // ── Conservatism dial ──────────────────────────────────────────
  /**
   * Master underwriting posture. Modulates rent growth, exit cap, and vacancy
   * simultaneously. The "one dial" version of stance for operators who want
   * simple control without per-driver tuning.
   */
  underwritingPosture: UnderwritingPostureSchema.default('MARKET'),

  // ── Per-driver stances ─────────────────────────────────────────
  /** How aggressively to project concession burn-off. */
  concessionStrategy: ConcessionStrategySchema.default('MARKET'),
  /** Lease-up marketing spend assumption. */
  marketingIntensity: MarketingIntensitySchema.default('MARKET'),
  /** Controllable expense growth — independent of insurance/tax which use jurisdiction models. */
  expenseGrowthPosture: ExpenseGrowthPostureSchema.default('INFLATION'),

  // ── Stress dials (explicit overrides, applied on top of posture) ──
  /** Additional haircut on rent growth Y1-Y3, in basis points (e.g. 25 = -0.25%). */
  stressRentGrowthHaircut: z.number().min(0).max(500).default(0),
  /** Additional widening of exit cap rate, in basis points (e.g. 50 = +0.50%). */
  stressExitCapWiden: z.number().min(0).max(300).default(0),
  /** Additional vacancy floor added on top of posture-derived floor, in percentage points. */
  stressVacancyFloor: z.number().min(0).max(20).default(0),

  // ── Provenance ─────────────────────────────────────────────────
  /** True when all values are platform-derived defaults (operator has not touched this deal). */
  defaulted: z.boolean().default(true),
  /** ISO timestamp of last operator edit. */
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export type OperatorStance = z.infer<typeof OperatorStanceSchema>;

/** Partial input for PUT /stance — any subset of fields can be provided. */
export const OperatorStancePatchSchema = OperatorStanceSchema
  .omit({ defaulted: true, updatedAt: true })
  .partial();

export type OperatorStancePatch = z.infer<typeof OperatorStancePatchSchema>;

// ── Platform defaults (MARKET posture everywhere) ─────────────────────────

export const PLATFORM_STANCE_DEFAULTS: OperatorStance = {
  rateEnvironment: 'NORMALIZING',
  cyclePosition: 'MID',
  recessionProbability: 0.15,
  underwritingPosture: 'MARKET',
  concessionStrategy: 'MARKET',
  marketingIntensity: 'MARKET',
  expenseGrowthPosture: 'INFLATION',
  stressRentGrowthHaircut: 0,
  stressExitCapWiden: 0,
  stressVacancyFloor: 0,
  defaulted: true,
  updatedAt: new Date().toISOString(),
};

/**
 * Resolve effective stance for a deal. Returns persisted stance if set,
 * otherwise platform defaults. The `defaulted` flag signals which case.
 */
export function resolveStance(persisted: Partial<OperatorStance> | null | undefined): OperatorStance {
  if (!persisted) return { ...PLATFORM_STANCE_DEFAULTS, updatedAt: new Date().toISOString() };
  return {
    ...PLATFORM_STANCE_DEFAULTS,
    ...persisted,
    defaulted: persisted.defaulted ?? false,
  };
}

// ── Modulation rule descriptors ────────────────────────────────────────────
// Human-readable rules used by both the modulation engine and the future
// Thesis tab to display "what does this dial actually do?"

export interface StanceModulationRule {
  /** Unique rule ID — referenced in `stanceTrace` on modulated LayeredValues. */
  id: string;
  /** Which stance field triggers this rule. */
  trigger: keyof OperatorStance;
  /** Which value(s) of the trigger field activate this rule. */
  triggerValues: string[];
  /** Which LayeredValue field path(s) this rule touches. */
  affectedFields: string[];
  /** Human-readable description shown in the Thesis tab. */
  description: string;
  /**
   * The numeric delta applied.
   * Positive = increase, negative = decrease.
   * Units depend on `affectedFields` (bps for rates, pp for vacancy).
   */
  deltaBps: number;
}

export const STANCE_MODULATION_RULES: StanceModulationRule[] = [
  // ── underwritingPosture ─────────────────────────────────────────
  {
    id: 'posture_conservative_rent_growth',
    trigger: 'underwritingPosture',
    triggerValues: ['CONSERVATIVE'],
    affectedFields: ['rentGrowth', 'rentGrowthStabilized'],
    description: 'CONSERVATIVE posture shaves 25bps off Y1-Y3 rent growth to reflect downside risk.',
    deltaBps: -25,
  },
  {
    id: 'posture_conservative_exit_cap',
    trigger: 'underwritingPosture',
    triggerValues: ['CONSERVATIVE'],
    affectedFields: ['exitCapRate'],
    description: 'CONSERVATIVE posture widens exit cap by 50bps vs MARKET baseline.',
    deltaBps: 50,
  },
  {
    id: 'posture_conservative_vacancy',
    trigger: 'underwritingPosture',
    triggerValues: ['CONSERVATIVE'],
    affectedFields: ['vacancy'],
    description: 'CONSERVATIVE posture adds 100bps to stabilized vacancy floor.',
    deltaBps: 100,
  },
  {
    id: 'posture_aggressive_rent_growth',
    trigger: 'underwritingPosture',
    triggerValues: ['AGGRESSIVE'],
    affectedFields: ['rentGrowth', 'rentGrowthStabilized'],
    description: 'AGGRESSIVE posture adds 25bps to Y1-Y3 rent growth vs MARKET baseline.',
    deltaBps: 25,
  },
  {
    id: 'posture_aggressive_exit_cap',
    trigger: 'underwritingPosture',
    triggerValues: ['AGGRESSIVE'],
    affectedFields: ['exitCapRate'],
    description: 'AGGRESSIVE posture tightens exit cap by 25bps (optimistic exit pricing).',
    deltaBps: -25,
  },
  {
    id: 'posture_aggressive_vacancy',
    trigger: 'underwritingPosture',
    triggerValues: ['AGGRESSIVE'],
    affectedFields: ['vacancy'],
    description: 'AGGRESSIVE posture removes 50bps from stabilized vacancy floor.',
    deltaBps: -50,
  },

  // ── rateEnvironment ─────────────────────────────────────────────
  {
    id: 'rate_cutting_exit_cap',
    trigger: 'rateEnvironment',
    triggerValues: ['CUTTING'],
    affectedFields: ['exitCapRate'],
    description: 'Rate-cutting environment compresses exit cap by 25bps (buyers accept lower yield).',
    deltaBps: -25,
  },
  {
    id: 'rate_higher_for_longer_exit_cap',
    trigger: 'rateEnvironment',
    triggerValues: ['HIGHER_FOR_LONGER'],
    affectedFields: ['exitCapRate'],
    description: 'Higher-for-longer widens exit cap by 50bps (buyers require higher yield).',
    deltaBps: 50,
  },
  {
    id: 'rate_higher_for_longer_opex',
    trigger: 'rateEnvironment',
    triggerValues: ['HIGHER_FOR_LONGER'],
    affectedFields: ['expenseGrowth'],
    description: 'Higher-for-longer adds 50bps to expense growth (insurance, debt service pressure).',
    deltaBps: 50,
  },

  // ── cyclePosition ───────────────────────────────────────────────
  {
    id: 'cycle_early_rent_growth',
    trigger: 'cyclePosition',
    triggerValues: ['EARLY'],
    affectedFields: ['rentGrowth'],
    description: 'Early cycle: add 50bps to rent growth — demand outpaces supply.',
    deltaBps: 50,
  },
  {
    id: 'cycle_late_rent_growth',
    trigger: 'cyclePosition',
    triggerValues: ['LATE'],
    affectedFields: ['rentGrowth'],
    description: 'Late cycle: shave 50bps from rent growth — supply catching up to demand.',
    deltaBps: -50,
  },
  {
    id: 'cycle_late_vacancy',
    trigger: 'cyclePosition',
    triggerValues: ['LATE'],
    affectedFields: ['vacancy'],
    description: 'Late cycle: add 50bps to vacancy — increased competition from new supply.',
    deltaBps: 50,
  },
  {
    id: 'cycle_late_exit_cap',
    trigger: 'cyclePosition',
    triggerValues: ['LATE'],
    affectedFields: ['exitCapRate'],
    description: 'Late cycle: widen exit cap by 25bps — risk premium at cycle peak.',
    deltaBps: 25,
  },

  // ── expenseGrowthPosture ────────────────────────────────────────
  {
    id: 'expense_contained',
    trigger: 'expenseGrowthPosture',
    triggerValues: ['CONTAINED'],
    affectedFields: ['expenseGrowth'],
    description: 'CONTAINED posture: -50bps on controllable expense growth vs INFLATION baseline.',
    deltaBps: -50,
  },
  {
    id: 'expense_stressed',
    trigger: 'expenseGrowthPosture',
    triggerValues: ['STRESSED'],
    affectedFields: ['expenseGrowth'],
    description: 'STRESSED posture: +100bps on controllable expense growth (insurance spike, payroll pressure).',
    deltaBps: 100,
  },
];

/**
 * Compute the net bps delta that stance applies to a given field path.
 * Sums all fired rules for the field. Returns 0 when no rules fire.
 * Used by the modulation engine to produce deterministic adjustments.
 */
export function computeStanceDelta(
  stance: OperatorStance,
  fieldPath: string,
): { deltaBps: number; firedRules: StanceModulationRule[] } {
  const firedRules: StanceModulationRule[] = [];

  for (const rule of STANCE_MODULATION_RULES) {
    if (!rule.affectedFields.some(f => f === fieldPath || fieldPath.startsWith(f))) continue;
    const triggerValue = stance[rule.trigger];
    if (typeof triggerValue === 'string' && rule.triggerValues.includes(triggerValue)) {
      firedRules.push(rule);
    }
  }

  // Add explicit stress dials on top of rule-based modulation
  let stressDelta = 0;
  if (fieldPath === 'rentGrowth' || fieldPath === 'rentGrowthStabilized') {
    stressDelta -= stance.stressRentGrowthHaircut;
  }
  if (fieldPath === 'exitCapRate') {
    stressDelta += stance.stressExitCapWiden;
  }
  if (fieldPath === 'vacancy') {
    stressDelta += stance.stressVacancyFloor * 100; // convert pp to bps
  }

  const ruleTotal = firedRules.reduce((sum, r) => sum + r.deltaBps, 0);
  const deltaBps = ruleTotal + stressDelta;

  return { deltaBps, firedRules };
}

/**
 * Build the stanceTrace string for a modulated LayeredValue.
 * Surfaced in the Thesis tab and per-row provenance drawers.
 */
export function buildStanceTrace(
  stance: OperatorStance,
  fieldPath: string,
  deltaBps: number,
  firedRules: StanceModulationRule[],
): string {
  const parts: string[] = [];
  for (const rule of firedRules) {
    parts.push(`${rule.id}(${rule.deltaBps > 0 ? '+' : ''}${rule.deltaBps}bps)`);
  }
  if (stance.stressRentGrowthHaircut > 0 && (fieldPath === 'rentGrowth' || fieldPath === 'rentGrowthStabilized')) {
    parts.push(`stressRentGrowthHaircut(-${stance.stressRentGrowthHaircut}bps)`);
  }
  if (stance.stressExitCapWiden > 0 && fieldPath === 'exitCapRate') {
    parts.push(`stressExitCapWiden(+${stance.stressExitCapWiden}bps)`);
  }
  if (stance.stressVacancyFloor > 0 && fieldPath === 'vacancy') {
    parts.push(`stressVacancyFloor(+${stance.stressVacancyFloor * 100}bps)`);
  }
  return `stance: net ${deltaBps > 0 ? '+' : ''}${deltaBps}bps [${parts.join(', ')}]`;
}

/** Fields that OperatorStance can modulate — used by GET /stance/affected-fields. */
export const STANCE_MODULATED_FIELD_PATHS = [
  'rentGrowth',
  'rentGrowthStabilized',
  'exitCapRate',
  'vacancy',
  'expenseGrowth',
] as const;

export type StanceModulatedFieldPath = typeof STANCE_MODULATED_FIELD_PATHS[number];
