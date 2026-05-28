/**
 * D-MOD-3 — Agent Reasoning Order Pipeline
 *
 * Defines the 11-stage dependency chain the proforma agent must follow.
 * Stage gates check both upstream stage completion AND the presence of
 * required module data in the DataFlowRouter for the deal.
 *
 * Stage order (dependency chain):
 *   1  subject          — load deal context + deal documents (T12, rent roll, tax bill)
 *   2  zoning           — M02 entitlement path, use restrictions
 *   3  comps            — M27 CoStar / M15 competition
 *   4  market           — M05 rent, vacancy, submarket rank
 *   5  demand_supply    — M06 demand + M04 supply pipeline
 *   6  strategy         — M08 recommended strategy + hold period
 *   7  proforma         — M09 NOI, GPR, assumptions resolution
 *   8  capital_structure— M11 debt sizing, waterfall, rate environment
 *   9  exit             — M12 exit cap, reversion value, optimal hold year
 *  10  risk_jedi        — M14 risk adjustments + M25 JEDI score
 *  11  valuation_grid   — M17/M27 comp-anchored value range
 *
 * NOTE: Stage gates with requiredModules must have those modules publishing data
 * to the DataFlowRouter (via publishModuleData) for the stage to be satisfied.
 * Stages without requiredModules pass based purely on upstream dependencies.
 * M20 (Exit Analysis v2) and M28 (Macro) are placeholders; their absence never blocks.
 */

import type { ModuleId } from './module-registry';
import { dataFlowRouter } from './data-flow-router';
import { logger } from '../../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReasoningStage {
  id:              string;
  ordinal:         number;
  name:            string;
  description:     string;
  /** Stages that must be satisfied before this one can start. */
  dependsOn:       string[];
  /**
   * Module IDs that MUST have data published in DataFlowRouter for the deal.
   * All must be present for the stage to be considered satisfied.
   * If a stage has no required modules, satisfaction depends only on dependsOn.
   */
  requiredModules: ModuleId[];
  /**
   * Optional modules — their absence lowers confidence but does not block the stage.
   */
  optionalModules: ModuleId[];
  primaryAgentTool: string | null;
}

export interface StageGateResult {
  stageId:         string;
  satisfied:       boolean;
  /** Required modules not found in DataFlowRouter for this deal. */
  missingModules:  string[];
  /** Unsatisfied upstream stage IDs. */
  unsatisfiedDeps: string[];
  warnings:        string[];
}

export interface PipelineState {
  dealId:             string;
  evaluatedAt:        Date;
  stages:             Map<string, StageGateResult>;
  highestSatisfied:   number;
  /** First stage that is not satisfied, or null if all satisfied. */
  gatedStageId:       string | null;
  gatedReason:        string | null;
  completedStageIds:  string[];
  fullyResolved:      boolean;
}

/** A gate violation — records an assumption set without its prerequisite stage satisfied. */
export interface StageGateViolation {
  /** D-MOD-3 stage ID that was not satisfied. */
  violatedStageId:   string;
  /** The assumption field that was derived without the stage being satisfied. */
  assumptionField:   string;
  /** Human-readable explanation. */
  narrative:         string;
  /** Severity: warn = stage optional/partial; error = critical stage missing. */
  severity:          'warn' | 'error';
}

// ─── Stage Definitions ────────────────────────────────────────────────────────

export const REASONING_STAGES: readonly ReasoningStage[] = [
  {
    id:              'subject',
    ordinal:         1,
    name:            'Subject Property Context',
    description:     'Load deal context, deal documents (T12, rent roll, tax bill), and extracted deal data. Auto-satisfied when deal context is available.',
    dependsOn:       [],
    requiredModules: [],
    optionalModules: [],
    primaryAgentTool: 'fetch_data_matrix',
  },
  {
    id:              'zoning',
    ordinal:         2,
    name:            'Zoning & Entitlement',
    description:     'M02 zoning lookup: entitlement path, FAR, setbacks, use restrictions. Optional — proceeds without M02 but with lower strategy confidence.',
    dependsOn:       ['subject'],
    requiredModules: [],
    optionalModules: ['M02'],
    primaryAgentTool: null,
  },
  {
    id:              'comps',
    ordinal:         3,
    name:            'Comparable Sales & Competition',
    description:     'M15 competition analysis + M27 CoStar comp pipeline. Optional — if absent, exit cap and valuation grid use lower-confidence estimates.',
    dependsOn:       ['subject'],
    requiredModules: [],
    optionalModules: ['M15'],
    primaryAgentTool: 'fetch_comp_set',
  },
  {
    id:              'market',
    ordinal:         4,
    name:            'Market Intelligence',
    description:     'M05 rent levels, vacancy rate, rent growth trend. REQUIRED — M05 must have published data for this stage to be satisfied. Gates rent growth and vacancy assumptions.',
    dependsOn:       ['subject'],
    requiredModules: ['M05'],
    optionalModules: ['M07'],
    primaryAgentTool: 'fetch_market_trends',
  },
  {
    id:              'demand_supply',
    ordinal:         5,
    name:            'Demand & Supply',
    description:     'M06 demand + M04 supply pipeline. Optional — if absent, occupancy and absorption use market stage data only.',
    dependsOn:       ['market'],
    requiredModules: [],
    optionalModules: ['M04', 'M06'],
    primaryAgentTool: null,
  },
  {
    id:              'strategy',
    ordinal:         6,
    name:            'Strategy Selection',
    description:     'M08 recommended strategy + hold period. Optional — if absent, hold period defaults to operator input. Must precede proforma.',
    dependsOn:       ['market', 'demand_supply'],
    requiredModules: [],
    optionalModules: ['M08'],
    primaryAgentTool: 'fetch_data_matrix',
  },
  {
    id:              'proforma',
    ordinal:         7,
    name:            'Pro Forma Construction',
    description:     'Full NOI/GPR/EGI projection via compute_proforma. Depends on subject + market + strategy. Cannot proceed before market stage satisfies M05 requirement.',
    dependsOn:       ['subject', 'market', 'demand_supply', 'strategy'],
    requiredModules: [],
    optionalModules: [],
    primaryAgentTool: 'compute_proforma',
  },
  {
    id:              'capital_structure',
    ordinal:         8,
    name:            'Capital Structure',
    description:     'M11 debt sizing (triple constraint F40), SOFR rate environment. REQUIRED after proforma — loanAmount cannot be sized without NOI.',
    dependsOn:       ['proforma'],
    requiredModules: [],
    optionalModules: ['M11'],
    primaryAgentTool: 'fetch_rate_environment',
  },
  {
    id:              'exit',
    ordinal:         9,
    name:            'Exit Analysis',
    description:     'M12 exit cap rate, reversion value, optimal hold year. REQUIRED after market and capital structure — exit cap cannot be derived before market comp set and rate environment are known.',
    dependsOn:       ['market', 'capital_structure'],
    requiredModules: [],
    optionalModules: ['M12'],
    primaryAgentTool: 'fetch_comp_set',
  },
  {
    id:              'risk_jedi',
    ordinal:         10,
    name:            'Risk Dashboard & JEDI Score',
    description:     'M14 risk adjustments + M25 JEDI score. Depends on proforma + capital_structure + exit all being resolved.',
    dependsOn:       ['proforma', 'capital_structure', 'exit'],
    requiredModules: [],
    optionalModules: ['M14', 'M25'],
    primaryAgentTool: 'fetch_cycle_intelligence',
  },
  {
    id:              'valuation_grid',
    ordinal:         11,
    name:            'Valuation Grid',
    description:     'Comp-anchored value range (M17/M27). Terminal stage — all other stages must be resolved first.',
    dependsOn:       ['comps', 'proforma', 'exit', 'risk_jedi'],
    requiredModules: [],
    optionalModules: [],
    primaryAgentTool: 'fetch_data_library_comps',
  },
] as const;

// ─── Stage lookup ─────────────────────────────────────────────────────────────

const STAGE_BY_ID = new Map<string, ReasoningStage>(
  REASONING_STAGES.map(s => [s.id, s])
);

export function getStage(id: string): ReasoningStage | undefined {
  return STAGE_BY_ID.get(id);
}

// ─── Pipeline evaluation ──────────────────────────────────────────────────────

/**
 * Evaluate the pipeline for a deal against the current DataFlowRouter state.
 *
 * For each stage, checks:
 *   1. All dependsOn stages are satisfied.
 *   2. All requiredModules have data published in the DataFlowRouter for this dealId.
 *
 * The market stage (ordinal 4) is the first meaningful gate — it requires M05 data.
 * All stages that depend on market (demand_supply, strategy, proforma, capital_structure, exit,
 * risk_jedi, valuation_grid) will cascade to "not satisfied" if market isn't satisfied.
 */
export function evaluatePipeline(dealId: string): PipelineState {
  const stageResults = new Map<string, StageGateResult>();
  const completedStageIds: string[] = [];
  let highestSatisfied = 0;
  let gatedStageId: string | null = null;
  let gatedReason: string | null = null;

  for (const stage of REASONING_STAGES) {
    const result = _evaluateStage(stage, dealId, stageResults);
    stageResults.set(stage.id, result);

    if (result.satisfied) {
      completedStageIds.push(stage.id);
      highestSatisfied = stage.ordinal;
    } else if (gatedStageId === null) {
      gatedStageId = stage.id;
      gatedReason  = result.missingModules.length > 0
        ? `Required module data missing: ${result.missingModules.join(', ')}`
        : `Upstream stages not satisfied: ${result.unsatisfiedDeps.join(', ')}`;
    }
  }

  const fullyResolved = completedStageIds.length === REASONING_STAGES.length;

  logger.debug('[D-MOD-3] Pipeline evaluated', {
    dealId,
    completed:     completedStageIds.length,
    total:         REASONING_STAGES.length,
    gatedAt:       gatedStageId ?? 'none',
    gatedReason:   gatedReason ?? 'none',
  });

  return {
    dealId,
    evaluatedAt:     new Date(),
    stages:          stageResults,
    highestSatisfied,
    gatedStageId,
    gatedReason,
    completedStageIds,
    fullyResolved,
  };
}

/**
 * Enforce stage gates for a set of assumption fields being derived.
 *
 * For each assumption field, checks whether its required stageDependency is satisfied
 * in the pipeline. Returns a list of violations (assumption derived before its stage gate).
 *
 * Violations are non-blocking — they are recorded in the evidence trail so the analyst
 * can investigate. They do not prevent the model from being built.
 */
export function enforceStageGates(
  pipelineState: PipelineState,
  assumptionStageDeps: Array<{ field: string; stageDependency: string }>,
): StageGateViolation[] {
  const violations: StageGateViolation[] = [];

  for (const { field, stageDependency } of assumptionStageDeps) {
    const stage = STAGE_BY_ID.get(stageDependency);
    if (!stage) continue;

    const stageResult = pipelineState.stages.get(stageDependency);
    if (!stageResult?.satisfied) {
      const unsatisfiedReason = stageResult?.unsatisfiedDeps.length
        ? `upstream stages not satisfied: ${stageResult.unsatisfiedDeps.join(', ')}`
        : stageResult?.missingModules.length
          ? `required modules missing: ${stageResult.missingModules.join(', ')}`
          : 'stage not evaluated';

      violations.push({
        violatedStageId:  stageDependency,
        assumptionField:  field,
        narrative:        `D-MOD-3 gate violation: "${field}" requires stage "${stageDependency}" (${stage.name}) to be satisfied, but it was not. Reason: ${unsatisfiedReason}. This assumption was derived before its prerequisite stage completed — verify the derivation source.`,
        severity:         stage.requiredModules.length > 0 ? 'error' : 'warn',
      });
    }
  }

  return violations;
}

/**
 * Assert a stage is satisfied, logging a warning if not.
 */
export function assertStageSatisfied(
  pipelineState: PipelineState,
  stageId:       string,
  context:       string,
): void {
  const result = pipelineState.stages.get(stageId);
  if (!result?.satisfied) {
    logger.warn(
      `[D-MOD-3] Stage gate violation in ${context}: ` +
      `stage "${stageId}" is not satisfied. ` +
      `Missing: ${result?.missingModules.join(', ') ?? 'N/A'}. ` +
      `Unsatisfied deps: ${result?.unsatisfiedDeps.join(', ') ?? 'N/A'}.`
    );
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _evaluateStage(
  stage:        ReasoningStage,
  dealId:       string,
  priorResults: Map<string, StageGateResult>,
): StageGateResult {
  // Stage 1 (subject) is auto-satisfied — deal context is always present when buildModel is called.
  if (stage.id === 'subject') {
    return { stageId: stage.id, satisfied: true, missingModules: [], unsatisfiedDeps: [], warnings: [] };
  }

  // Check upstream stages
  const unsatisfiedDeps = stage.dependsOn.filter(dep => !priorResults.get(dep)?.satisfied);
  if (unsatisfiedDeps.length > 0) {
    return {
      stageId:         stage.id,
      satisfied:       false,
      missingModules:  [],
      unsatisfiedDeps,
      warnings:        [],
    };
  }

  // Check required modules via DataFlowRouter in-memory cache
  const missingModules: string[] = [];
  for (const moduleId of stage.requiredModules) {
    const cached = dataFlowRouter.getModuleData(moduleId, dealId);
    if (!cached) {
      missingModules.push(moduleId);
    }
  }

  // Warn on missing optional modules
  const warnings: string[] = [];
  for (const moduleId of stage.optionalModules) {
    const cached = dataFlowRouter.getModuleData(moduleId, dealId);
    if (!cached) {
      warnings.push(`Optional ${moduleId} has no cached data for deal ${dealId}`);
    }
  }

  return {
    stageId:         stage.id,
    satisfied:       missingModules.length === 0,
    missingModules,
    unsatisfiedDeps: [],
    warnings,
  };
}
