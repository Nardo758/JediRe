/**
 * D-MOD-3 — Agent Reasoning Order Pipeline
 *
 * Defines the 11-stage dependency chain the proforma agent must follow.
 * Enforces stage gates: a downstream stage cannot begin until all required
 * upstream stages have resolved (i.e. their key module data is present in
 * the data flow router or has been directly provided).
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
 * NOTE: Modules M20 (Exit Analysis v2) and M28 (Macro Intelligence) are
 * referenced in mappings as PLACEHOLDERS and must not block the pipeline.
 */

import type { ModuleId } from './module-registry';
import { dataFlowRouter } from './data-flow-router';
import { logger } from '../../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReasoningStage {
  /** Canonical stage identifier — used as stageDependency in assumption mappings. */
  id:              string;
  ordinal:         number;
  name:            string;
  description:     string;
  /** Stages that must be complete before this stage can start. */
  dependsOn:       string[];
  /**
   * Module IDs whose data presence in DataFlowRouter signals stage completion.
   * All listed modules must have data published for the deal.
   * Stages with no required modules are auto-satisfied (e.g. 'subject').
   */
  requiredModules: ModuleId[];
  /**
   * Optional modules — if missing, stage still proceeds but downstream
   * assumptions that depend on them use a lower-confidence fallback.
   */
  optionalModules: ModuleId[];
  /**
   * Agent tool to call to satisfy this stage (informational for prompt injection).
   * The pipeline does NOT call tools directly — it validates data presence.
   */
  primaryAgentTool: string | null;
}

export interface StageGateResult {
  stageId:       string;
  satisfied:     boolean;
  missingModules: string[];
  warnings:       string[];
}

export interface PipelineState {
  dealId:             string;
  evaluatedAt:        Date;
  stages:             Map<string, StageGateResult>;
  highestSatisfied:   number;
  gatedStageId:       string | null;
  gatedReason:        string | null;
  /** Flat ordered list of stage IDs that are satisfied. */
  completedStageIds:  string[];
  /** True if all 11 stages are satisfied. */
  fullyResolved:      boolean;
}

// ─── Stage Definitions ────────────────────────────────────────────────────────

export const REASONING_STAGES: readonly ReasoningStage[] = [
  {
    id:              'subject',
    ordinal:         1,
    name:            'Subject Property Context',
    description:     'Load deal context, deal documents (T12, rent roll, tax bill), and extracted deal data. This is always stage 1 and is auto-satisfied when fetch_data_matrix has been called.',
    dependsOn:       [],
    requiredModules: [],
    optionalModules: [],
    primaryAgentTool: 'fetch_data_matrix',
  },
  {
    id:              'zoning',
    ordinal:         2,
    name:            'Zoning & Entitlement',
    description:     'M02 zoning lookup: entitlement path, FAR, setbacks, use restrictions, entitlement risk score.',
    dependsOn:       ['subject'],
    requiredModules: [],
    optionalModules: ['M02'],
    primaryAgentTool: null,
  },
  {
    id:              'comps',
    ordinal:         3,
    name:            'Comparable Sales & Competition',
    description:     'M27 CoStar comp upload pipeline (D-COSTAR series) + M15 competition analysis.',
    dependsOn:       ['subject'],
    requiredModules: [],
    optionalModules: ['M15'],
    primaryAgentTool: 'fetch_comp_set',
  },
  {
    id:              'market',
    ordinal:         4,
    name:            'Market Intelligence',
    description:     'M05: submarket rent levels, vacancy rate, rent growth trend, submarket rank. Gates rent growth and vacancy assumption derivation.',
    dependsOn:       ['subject'],
    requiredModules: ['M05'],
    optionalModules: ['M07'],
    primaryAgentTool: 'fetch_market_trends',
  },
  {
    id:              'demand_supply',
    ordinal:         5,
    name:            'Demand & Supply',
    description:     'M06 demand score + M04 supply pipeline pressure. Gates stabilised occupancy and absorption rate derivation.',
    dependsOn:       ['market'],
    requiredModules: [],
    optionalModules: ['M04', 'M06'],
    primaryAgentTool: null,
  },
  {
    id:              'strategy',
    ordinal:         6,
    name:            'Strategy Selection',
    description:     'M08 recommended strategy + hold period. Gates proforma construction. Agent must choose strategy before deriving NOI projections.',
    dependsOn:       ['market', 'demand_supply'],
    requiredModules: [],
    optionalModules: ['M08'],
    primaryAgentTool: 'fetch_data_matrix',
  },
  {
    id:              'proforma',
    ordinal:         7,
    name:            'Pro Forma Construction',
    description:     'M09: full NOI/GPR/EGI/cash-flow projection. All income and expense assumptions resolved here. Cannot proceed before market + strategy stages.',
    dependsOn:       ['subject', 'market', 'demand_supply', 'strategy'],
    requiredModules: [],
    optionalModules: ['M09'],
    primaryAgentTool: 'compute_proforma',
  },
  {
    id:              'capital_structure',
    ordinal:         8,
    name:            'Capital Structure',
    description:     'M11: debt sizing (F40 triple constraint), rate environment (SOFR classification), waterfall. Cannot size debt before Y1 NOI is known.',
    dependsOn:       ['proforma'],
    requiredModules: [],
    optionalModules: ['M11'],
    primaryAgentTool: 'fetch_rate_environment',
  },
  {
    id:              'exit',
    ordinal:         9,
    name:            'Exit Analysis',
    description:     'M12: exit cap rate, reversion value, optimal hold year. Cannot be derived before market intel and capital structure are complete.',
    dependsOn:       ['market', 'capital_structure'],
    requiredModules: [],
    optionalModules: ['M12'],
    primaryAgentTool: 'fetch_comp_set',
  },
  {
    id:              'risk_jedi',
    ordinal:         10,
    name:            'Risk Dashboard & JEDI Score',
    description:     'M14 risk adjustments (cap rate adj bps, stress tests) + M25 JEDI score computation. Requires all upstream assumptions to be settled.',
    dependsOn:       ['proforma', 'capital_structure', 'exit'],
    requiredModules: [],
    optionalModules: ['M14', 'M25'],
    primaryAgentTool: 'fetch_cycle_intelligence',
  },
  {
    id:              'valuation_grid',
    ordinal:         11,
    name:            'Valuation Grid',
    description:     'Comp-anchored value range (M17/M27). Synthesises comps + NOI + exit cap into a per-unit value band. Final stage — all other stages must be resolved first.',
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

// ─── Pipeline runner ──────────────────────────────────────────────────────────

/**
 * Evaluate the pipeline for a deal against the current DataFlowRouter state.
 *
 * For each stage, checks:
 *   1. All dependsOn stages are themselves satisfied.
 *   2. All requiredModules have data published in the router for this dealId.
 *
 * Returns PipelineState — callers should check gatedStageId for the first
 * blocked stage. If gatedStageId is null, all stages are satisfied.
 */
export function evaluatePipeline(dealId: string): PipelineState {
  const stageResults = new Map<string, StageGateResult>();
  const completedStageIds: string[] = [];
  let highestSatisfied = 0;
  let gatedStageId: string | null = null;
  let gatedReason: string | null = null;

  for (const stage of REASONING_STAGES) {
    const result = evaluateStage(stage, dealId, stageResults);
    stageResults.set(stage.id, result);

    if (result.satisfied) {
      completedStageIds.push(stage.id);
      highestSatisfied = stage.ordinal;
    } else if (gatedStageId === null) {
      gatedStageId  = stage.id;
      gatedReason   = result.missingModules.length > 0
        ? `Missing required module data: ${result.missingModules.join(', ')}`
        : `Upstream stages not satisfied: ${stage.dependsOn.filter(d => !stageResults.get(d)?.satisfied).join(', ')}`;
    }
  }

  const fullyResolved = completedStageIds.length === REASONING_STAGES.length;

  logger.debug('[D-MOD-3] Pipeline evaluated', {
    dealId,
    completed: completedStageIds.length,
    total: REASONING_STAGES.length,
    gatedAt: gatedStageId ?? 'none',
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
 * Check whether the pipeline is gated at or before the given stage.
 * Returns false if it is safe to proceed to that stage.
 */
export function isGatedBefore(pipelineState: PipelineState, stageId: string): boolean {
  const stage = STAGE_BY_ID.get(stageId);
  if (!stage) return false;
  return pipelineState.gatedStageId !== null &&
    (STAGE_BY_ID.get(pipelineState.gatedStageId)?.ordinal ?? 0) <= stage.ordinal;
}

/**
 * Assert a stage is satisfied, logging a warning if not.
 * Useful for buildModel() to enforce "no exit cap before market intel".
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
      `"${stageId}" is not satisfied — proceeding anyway but pipeline is out of order. ` +
      `Upstream stages must publish module data to DataFlowRouter before downstream stages.`
    );
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function evaluateStage(
  stage:        ReasoningStage,
  dealId:       string,
  priorResults: Map<string, StageGateResult>,
): StageGateResult {
  const missingModules: string[] = [];
  const warnings:       string[] = [];

  // Stage 1 (subject) is auto-satisfied — the calling code always has deal context.
  if (stage.id === 'subject' || stage.dependsOn.length === 0 && stage.requiredModules.length === 0) {
    return { stageId: stage.id, satisfied: true, missingModules: [], warnings: [] };
  }

  // Check upstream stages
  const unsatisfiedUpstream = stage.dependsOn.filter(dep => !priorResults.get(dep)?.satisfied);
  if (unsatisfiedUpstream.length > 0) {
    return {
      stageId:        stage.id,
      satisfied:      false,
      missingModules,
      warnings:       [`Upstream stages not satisfied: ${unsatisfiedUpstream.join(', ')}`],
    };
  }

  // Check required modules via DataFlowRouter
  for (const moduleId of stage.requiredModules) {
    const data = dataFlowRouter.getModuleData(moduleId, dealId);
    if (!data) {
      missingModules.push(moduleId);
    }
  }

  // Warn on missing optional modules
  for (const moduleId of stage.optionalModules) {
    const data = dataFlowRouter.getModuleData(moduleId, dealId);
    if (!data) {
      warnings.push(`Optional module ${moduleId} has no data for deal ${dealId}`);
    }
  }

  return {
    stageId:        stage.id,
    satisfied:      missingModules.length === 0,
    missingModules,
    warnings,
  };
}
