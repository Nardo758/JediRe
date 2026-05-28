/**
 * D-MOD-1 — Assumption → Module Mapping Config
 *
 * Maps each of the 10 critical F9 proforma assumptions to:
 *   - authoritativeModule: The module whose output wins on disagreement
 *   - supportingModules:   Modules that contribute evidence / cross-checks
 *   - conflictBandPct:     Relative % divergence that triggers a conflict flag
 *                          (e.g. 0.15 = 15%: if supporting differs from auth by >15%, flag it)
 *   - placeholderModules:  Modules referenced but not yet implemented (M20, M28)
 *   - stageDependency:     D-MOD-3 pipeline stage that must be satisfied before this
 *                          assumption can be derived
 *
 * Source: Master Plan Part 4.2 (JEDI RE architecture spec).
 * Module IDs match MODULE_REGISTRY keys in module-registry.ts.
 *
 * IMPORTANT — When modules disagree beyond conflictBandPct, the evidence trail must
 * show a "conflict_flagged: true" entry. The authoritative module value is still used
 * but the analyst is explicitly notified.  See conflict-resolution.service.ts (D-MOD-2).
 */

import type { ModuleId } from './module-registry';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssumptionField =
  | 'revenue.rentGrowth.y1'
  | 'revenue.rentGrowth.longRun'
  | 'revenue.stabilizedOccupancy'
  | 'expenses.real_estate_tax'
  | 'expenses.insurance'
  | 'disposition.exitCapRate'
  | 'financing.loanAmount'
  | 'financing.interestRate'
  | 'holdPeriod'
  | 'revenue.absorptionRate';

export interface AssumptionModuleMapping {
  field:               AssumptionField;
  label:               string;
  description:         string;
  /** Module whose value wins when divergence exceeds conflictBandPct. */
  authoritativeModule: ModuleId;
  /** Modules that provide cross-check evidence. */
  supportingModules:   ModuleId[];
  /**
   * Relative divergence threshold (0–1) beyond which conflict is flagged.
   * Formula: |auth - supporting| / |auth| > conflictBandPct → conflict_flagged = true.
   */
  conflictBandPct:     number;
  /**
   * Modules referenced in the mapping but not yet built (placeholders).
   * Their absence must not block the pipeline — treat as optional evidence.
   */
  placeholderModules:  string[];
  /**
   * D-MOD-3 reasoning stage that must be complete before this assumption is derived.
   * Prevents exit cap derivation before market intel, debt sizing before proforma, etc.
   */
  stageDependency:     string;
  notes:               string;
}

// ─── Mapping Table ────────────────────────────────────────────────────────────

export const ASSUMPTION_MODULE_MAPPINGS: readonly AssumptionModuleMapping[] = [
  {
    field:               'revenue.rentGrowth.y1',
    label:               'Rent Growth — Year 1',
    description:         'Y1 rent growth % applied to GPR. Anchors to cohort P50; M07/M06 deltas overlay.',
    authoritativeModule: 'M05',
    supportingModules:   ['M07', 'M06'],
    conflictBandPct:     0.15,
    placeholderModules:  [],
    stageDependency:     'market',
    notes:               'M05 cohort archive P50 is baseline; M07 absorption trend and M06 demand score produce ±deltas.',
  },
  {
    field:               'revenue.rentGrowth.longRun',
    label:               'Rent Growth — Long-Run (Y2+)',
    description:         'Annualised rent growth rate for years 2 through hold period.',
    authoritativeModule: 'M05',
    supportingModules:   ['M11'],
    conflictBandPct:     0.20,
    placeholderModules:  ['M28'],
    stageDependency:     'market',
    notes:               'M11 rate regime classification (SOFR Dropping/Flat/Rising) adjusts long-run growth ±bps. M28 macro placeholder — treat as absent.',
  },
  {
    field:               'revenue.stabilizedOccupancy',
    label:               'Stabilised Occupancy / Vacancy Rate',
    description:         'Steady-state occupancy used for GPR → EGI conversion.',
    authoritativeModule: 'M05',
    supportingModules:   ['M04', 'M07'],
    conflictBandPct:     0.10,
    placeholderModules:  [],
    stageDependency:     'demand_supply',
    notes:               'M04 supply pipeline pressure adjusts vacancy up; M07 traffic capture rate adjusts it down (demand signal).',
  },
  {
    field:               'expenses.real_estate_tax',
    label:               'Real Estate Tax',
    description:         'Annual property tax expense. Post-acquisition reassessment modelling required.',
    authoritativeModule: 'M26',
    supportingModules:   ['M14'],
    conflictBandPct:     0.20,
    placeholderModules:  [],
    stageDependency:     'subject',
    notes:               'M26 tax enhancer provides jurisdiction-specific reassessment model (millage × assessed value). M14 risk flags if M26 output diverges from T12 actuals by >20%.',
  },
  {
    field:               'expenses.insurance',
    label:               'Insurance',
    description:         'Annual property + casualty insurance cost per unit.',
    authoritativeModule: 'M26',
    supportingModules:   ['M14'],
    conflictBandPct:     0.25,
    placeholderModules:  [],
    stageDependency:     'subject',
    notes:               'M26 insurance forecast uses state-specific benchmarks (FL/TX/GA have premium rate rules). Divergence from OM/T12 of >25% flags material collision.',
  },
  {
    field:               'disposition.exitCapRate',
    label:               'Exit Cap Rate',
    description:         'Reversion cap rate at end of hold period. Cannot be derived before market intel is complete.',
    authoritativeModule: 'M12',
    supportingModules:   ['M05', 'M11'],
    conflictBandPct:     0.15,
    placeholderModules:  ['M20'],
    stageDependency:     'exit',
    notes:               'M12 anchors on going-in cap + risk premium spread. M05 comp set (fetch_comp_set) cross-checks market level. M11 rate cycle adjusts direction/magnitude. M20 exit analysis placeholder.',
  },
  {
    field:               'financing.loanAmount',
    label:               'Loan Amount / LTV Sizing',
    description:         'Senior debt quantum. Triple-constrained: LTC, LTV, DSCR (F40).',
    authoritativeModule: 'M11',
    supportingModules:   ['M14'],
    conflictBandPct:     0.10,
    placeholderModules:  [],
    stageDependency:     'capital_structure',
    notes:               'M11 F40 formula (sizeSeniorDebt) is authoritative. M14 risk score can add covenant-based buffer. Debt cannot be sized until proforma NOI is resolved (stageDependency).',
  },
  {
    field:               'financing.interestRate',
    label:               'Interest Rate / All-In Rate',
    description:         'Blended interest rate on senior debt = index + spread (F48).',
    authoritativeModule: 'M11',
    supportingModules:   [],
    conflictBandPct:     0.10,
    placeholderModules:  ['M28'],
    stageDependency:     'capital_structure',
    notes:               'M11 SOFR rate environment classification drives the all-in rate band. M28 macro placeholder — treat as absent and use M11 alone.',
  },
  {
    field:               'holdPeriod',
    label:               'Hold Period (Years)',
    description:         'Intended hold period in years. Strategy-driven; must precede all IRR/exit calculations.',
    authoritativeModule: 'M08',
    supportingModules:   ['M12'],
    conflictBandPct:     0.20,
    placeholderModules:  [],
    stageDependency:     'strategy',
    notes:               'M08 recommended strategy (value-add, stabilised, BTS) implies a default hold range. M12 can recommend shortening/extending based on optimal IRR year.',
  },
  {
    field:               'revenue.absorptionRate',
    label:               'Absorption / Lease-Up Rate',
    description:         'Monthly lease-up velocity expressed as pct of vacant units absorbed per month.',
    authoritativeModule: 'M07',
    supportingModules:   ['M06'],
    conflictBandPct:     0.20,
    placeholderModules:  [],
    stageDependency:     'demand_supply',
    notes:               'M07 traffic capture rate and predicted_leases_week are the primary signal. M06 demand units phased provides macro validation. For stabilised deals absorption is not critical path.',
  },
] as const;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Return the mapping for a specific assumption field. */
export function getAssumptionMapping(field: AssumptionField): AssumptionModuleMapping | undefined {
  return ASSUMPTION_MODULE_MAPPINGS.find(m => m.field === field);
}

/** Return all mappings whose authoritative module is the given module. */
export function getMappingsByAuthoritativeModule(moduleId: ModuleId): AssumptionModuleMapping[] {
  return ASSUMPTION_MODULE_MAPPINGS.filter(m => m.authoritativeModule === moduleId);
}

/** Return all mappings whose stage dependency matches the given stage. */
export function getMappingsByStage(stageId: string): AssumptionModuleMapping[] {
  return ASSUMPTION_MODULE_MAPPINGS.filter(m => m.stageDependency === stageId);
}

/** All unique module IDs referenced (authoritative + supporting). */
export const ALL_REFERENCED_MODULES: readonly ModuleId[] = Array.from(
  new Set(
    ASSUMPTION_MODULE_MAPPINGS.flatMap(m => [m.authoritativeModule, ...m.supportingModules])
  )
) as ModuleId[];
