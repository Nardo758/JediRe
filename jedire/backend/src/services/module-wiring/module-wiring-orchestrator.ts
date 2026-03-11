/**
 * Module Wiring Orchestrator
 *
 * Central orchestration layer that connects all JEDI RE modules according to
 * the Implementation Priority plan (Blueprint Sheet 7). Manages the execution
 * order, cascade recalculations, and wiring between existing services.
 *
 * Implementation Priority Order:
 *   P0-1: M25 JEDI Score → M01 Overview
 *   P0-2: M19 News → M06 Demand + M04 Supply
 *   P0-3: M02 Zoning → M03 Dev Cap → M08 Strategy
 *   P0-4: M04 Supply + M06 Demand → M14 Risk
 *   P0-5: M08 Strategy Arbitrage Engine
 *   P1-1: M09 ProForma auto-sync
 *   P1-2: M10 Scenario → M09 ProForma
 *   P1-3: M15 Competition → M05 Market
 *   P1-4: M11 Debt analysis wiring
 *   P2-1: M07 Traffic Intelligence
 *   P2-2: M12 Exit Analysis
 *   P2-3: M22 Portfolio + M09 actuals
 */

import { ModuleId, MODULE_REGISTRY, getModuleBuildOrder, Priority } from './module-registry';
import { FormulaId, FORMULA_REGISTRY, executeFormula } from './formula-engine';
import { dataFlowRouter, DataFlowResult } from './data-flow-router';
import { moduleEventBus, ModuleEventType, ModuleEvent } from './module-event-bus';
import { strategyArbitrageEngine, StrategySignalInputs } from './strategy-arbitrage-engine';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface WiringPipeline {
  id: string;
  name: string;
  priority: string;
  modules: ModuleId[];
  formulas: FormulaId[];
  description: string;
  blockedBy: string;
  effort: string;
  impact: string;
}

export interface ModuleExecutionResult {
  moduleId: ModuleId;
  dealId: string;
  success: boolean;
  outputs: Record<string, any>;
  formulasExecuted: FormulaId[];
  duration: number;
  error?: string;
}

export interface CascadeResult {
  triggerModule: ModuleId;
  dealId: string;
  modulesRecalculated: ModuleExecutionResult[];
  totalDuration: number;
  timestamp: Date;
}

export interface OrchestratorStatus {
  initialized: boolean;
  activeSubscriptions: number;
  pendingRecalculations: number;
  lastCascade?: CascadeResult;
  moduleHealth: Record<ModuleId, { status: 'ready' | 'partial' | 'missing'; lastRun?: Date }>;
}

// ============================================================================
// Implementation Priority Pipelines (Blueprint Sheet 7)
// ============================================================================

export const WIRING_PIPELINES: WiringPipeline[] = [
  {
    id: 'P0-1',
    name: 'JEDI Score → Overview',
    priority: 'P0',
    modules: ['M25', 'M01'],
    formulas: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06'],
    description: 'Wire JEDI Score service to Overview display. Score recalculation triggers on sub-score change.',
    blockedBy: 'Sub-score services need data feeds',
    effort: 'Medium',
    impact: 'Critical',
  },
  {
    id: 'P0-2',
    name: 'News → Demand + Supply',
    priority: 'P0',
    modules: ['M19', 'M06', 'M04'],
    formulas: ['F10', 'F11'],
    description: 'News classification pipeline: raw article → LLM classification → structured event → demand/supply service.',
    blockedBy: 'LLM integration, news API setup',
    effort: 'High',
    impact: 'Critical',
  },
  {
    id: 'P0-3',
    name: 'Zoning → Dev Cap → Strategy',
    priority: 'P0',
    modules: ['M02', 'M03', 'M08'],
    formulas: ['F13', 'F14', 'F15'],
    description: 'Zoning output feeds building envelope calculator, which feeds strategy-specific development feasibility.',
    blockedBy: 'Zoning Agent data quality',
    effort: 'High',
    impact: 'Critical',
  },
  {
    id: 'P0-4',
    name: 'Supply + Demand → Risk',
    priority: 'P0',
    modules: ['M04', 'M06', 'M14'],
    formulas: ['F07', 'F08', 'F09', 'F06'],
    description: 'Supply pressure + demand concentration → composite risk score → risk sub-score → JEDI.',
    blockedBy: 'Supply/demand data feeds',
    effort: 'Medium',
    impact: 'High',
  },
  {
    id: 'P0-5',
    name: 'Strategy Arbitrage Engine',
    priority: 'P0',
    modules: ['M08'],
    formulas: ['F23', 'F24'],
    description: 'Wire all signals into 4-strategy scoring. Apply strategy-specific weights. Flag arbitrage.',
    blockedBy: 'Needs M02-M07 all wired first',
    effort: 'Very High',
    impact: 'Critical',
  },
  {
    id: 'P1-1',
    name: 'ProForma Auto-Sync',
    priority: 'P1',
    modules: ['M09'],
    formulas: ['F16', 'F17', 'F18', 'F19', 'F20', 'F32', 'F33'],
    description: 'Market data + news adjustments auto-populate proforma assumptions. User override layer on top.',
    blockedBy: 'M05 market data feed',
    effort: 'High',
    impact: 'High',
  },
  {
    id: 'P1-2',
    name: 'Scenario → ProForma',
    priority: 'P1',
    modules: ['M10', 'M09'],
    formulas: ['F30', 'F31'],
    description: 'Evidence-based scenarios from actual events. Scenario parameters modify proforma assumptions.',
    blockedBy: 'M06+M04 event feeds',
    effort: 'Medium',
    impact: 'High',
  },
  {
    id: 'P1-3',
    name: 'Competition → Market',
    priority: 'P1',
    modules: ['M15', 'M05'],
    formulas: ['F26', 'F27'],
    description: 'Comp set data feeds into market analysis. Rent comps calibrate proforma assumptions.',
    blockedBy: 'Apartments.com scraper',
    effort: 'Medium',
    impact: 'Medium',
  },
  {
    id: 'P1-4',
    name: 'Debt Analysis Wiring',
    priority: 'P1',
    modules: ['M11'],
    formulas: ['F21', 'F22'],
    description: 'NOI from proforma feeds DSCR/LTV calculations. Rate sensitivity matrix.',
    blockedBy: 'M09 proforma',
    effort: 'Medium',
    impact: 'Medium',
  },
  {
    id: 'P2-1',
    name: 'Traffic Intelligence',
    priority: 'P2',
    modules: ['M07'],
    formulas: ['F28', 'F29'],
    description: 'Built: 4-source traffic intelligence (DOT ADT, SpyFu Domain Analytics, Market Intel, Visibility Scoring) → cascades to M05 Market, M08 Strategy, M09 ProForma, M14 Risk, M25 JEDI Score.',
    blockedBy: '',
    effort: 'Very High',
    impact: 'High',
  },
  {
    id: 'P2-2',
    name: 'Exit Analysis',
    priority: 'P2',
    modules: ['M12'],
    formulas: ['F34'],
    description: 'Optimal exit timing from proforma projections. Cap rate forecasting.',
    blockedBy: 'M09 multi-year proforma',
    effort: 'Medium',
    impact: 'Medium',
  },
  {
    id: 'P2-3',
    name: 'Portfolio + Actuals',
    priority: 'P2',
    modules: ['M22', 'M09'],
    formulas: ['F35'],
    description: 'Actual financial uploads vs projected. Portfolio-level aggregation.',
    blockedBy: 'M09 proforma, user data uploads',
    effort: 'Medium',
    impact: 'Medium',
  },
];

// ============================================================================
// Module Wiring Orchestrator
// ============================================================================

class ModuleWiringOrchestrator {
  private initialized = false;
  private pendingRecalculations = new Set<string>();
  private lastCascade?: CascadeResult;
  private moduleHealth = new Map<ModuleId, { status: 'ready' | 'partial' | 'missing'; lastRun?: Date }>();

  /**
   * Initialize the orchestrator: set up event subscriptions for cascade recalculations.
   */
  initialize(): void {
    if (this.initialized) return;

    // Subscribe to data updates to trigger cascades
    moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
      await this.handleModuleDataUpdate(event);
    });

    // Subscribe to score changes for alert triggers
    moduleEventBus.on(ModuleEventType.SCORE_CHANGED, async (event) => {
      await this.handleScoreChange(event);
    });

    // Subscribe to news classification events
    moduleEventBus.on(ModuleEventType.NEWS_CLASSIFIED, async (event) => {
      await this.handleNewsClassified(event);
    });

    this.initialized = true;
    logger.info('Module Wiring Orchestrator initialized');
  }

  /**
   * Execute a full module calculation for a deal.
   * Runs all formulas associated with the module and publishes outputs.
   */
  async executeModule(moduleId: ModuleId, dealId: string, additionalInputs?: Record<string, any>): Promise<ModuleExecutionResult> {
    const startTime = Date.now();
    const moduleDef = MODULE_REGISTRY[moduleId];

    if (!moduleDef) {
      return {
        moduleId,
        dealId,
        success: false,
        outputs: {},
        formulasExecuted: [],
        duration: Date.now() - startTime,
        error: `Module ${moduleId} not found in registry`,
      };
    }

    // Gather inputs from upstream modules
    const flowResult = dataFlowRouter.gatherInputs(moduleId, dealId);
    const allInputs = {
      ...flowResult.optionalInputs,
      ...flowResult.requiredInputs,
      ...(additionalInputs || {}),
    };

    if (!flowResult.ready && Object.keys(additionalInputs || {}).length === 0) {
      logger.warn('Module missing required inputs', {
        moduleId,
        dealId,
        missing: flowResult.missingRequired,
      });
    }

    // Execute associated formulas
    const outputs: Record<string, any> = {};
    const formulasExecuted: FormulaId[] = [];

    for (const formulaId of moduleDef.formulas as FormulaId[]) {
      const formula = FORMULA_REGISTRY[formulaId];
      if (!formula) continue;

      try {
        const result = formula.calculate(allInputs);
        outputs[formula.outputKey] = result;
        formulasExecuted.push(formulaId);
      } catch (error) {
        logger.error('Formula execution failed', {
          formulaId,
          moduleId,
          dealId,
          error: (error as Error).message,
        });
      }
    }

    // Publish outputs to data flow router
    if (Object.keys(outputs).length > 0) {
      dataFlowRouter.publishModuleData(moduleId, dealId, outputs);
    }

    // Update module health
    this.moduleHealth.set(moduleId, {
      status: flowResult.ready ? 'ready' : 'partial',
      lastRun: new Date(),
    });

    const result: ModuleExecutionResult = {
      moduleId,
      dealId,
      success: true,
      outputs,
      formulasExecuted,
      duration: Date.now() - startTime,
    };

    logger.info('Module executed', {
      moduleId,
      dealId,
      formulasRun: formulasExecuted.length,
      outputKeys: Object.keys(outputs),
      duration: result.duration,
    });

    return result;
  }

  /**
   * Execute a cascade: recalculate all downstream modules affected by a data change.
   */
  async executeCascade(triggerModuleId: ModuleId, dealId: string): Promise<CascadeResult> {
    const cascadeKey = `${triggerModuleId}:${dealId}`;
    if (this.pendingRecalculations.has(cascadeKey)) {
      logger.debug('Cascade already pending, skipping', { triggerModuleId, dealId });
      return {
        triggerModule: triggerModuleId,
        dealId,
        modulesRecalculated: [],
        totalDuration: 0,
        timestamp: new Date(),
      };
    }

    this.pendingRecalculations.add(cascadeKey);
    const startTime = Date.now();

    try {
      // Get cascade chain (topologically ordered)
      const affectedModules = dataFlowRouter.getCascadeChain(triggerModuleId);
      const results: ModuleExecutionResult[] = [];

      logger.info('Cascade started', {
        trigger: triggerModuleId,
        dealId,
        affectedCount: affectedModules.length,
        modules: affectedModules,
      });

      // Execute affected modules in dependency order
      for (const moduleId of affectedModules) {
        // Special handling for strategy arbitrage
        if (moduleId === 'M08') {
          const arbResult = await strategyArbitrageEngine.analyze(dealId);
          results.push({
            moduleId: 'M08',
            dealId,
            success: true,
            outputs: {
              strategy_scores: Object.fromEntries(arbResult.strategies.map(s => [s.strategy, s.score])),
              recommended_strategy: arbResult.recommended,
              arbitrage_flag: arbResult.arbitrageFlag,
            },
            formulasExecuted: ['F23', 'F24'],
            duration: 0,
          });
          continue;
        }

        const result = await this.executeModule(moduleId, dealId);
        results.push(result);
      }

      const cascadeResult: CascadeResult = {
        triggerModule: triggerModuleId,
        dealId,
        modulesRecalculated: results,
        totalDuration: Date.now() - startTime,
        timestamp: new Date(),
      };

      this.lastCascade = cascadeResult;

      logger.info('Cascade completed', {
        trigger: triggerModuleId,
        dealId,
        modulesRecalculated: results.length,
        totalDuration: cascadeResult.totalDuration,
      });

      return cascadeResult;
    } finally {
      this.pendingRecalculations.delete(cascadeKey);
    }
  }

  /**
   * Execute a specific wiring pipeline (P0-1, P0-2, etc.).
   */
  async executePipeline(pipelineId: string, dealId: string, inputs?: Record<string, any>): Promise<ModuleExecutionResult[]> {
    const pipeline = WIRING_PIPELINES.find(p => p.id === pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    logger.info('Pipeline execution started', {
      pipelineId,
      name: pipeline.name,
      dealId,
      modules: pipeline.modules,
    });

    const results: ModuleExecutionResult[] = [];

    // Provide initial inputs if given
    if (inputs && pipeline.modules.length > 0) {
      const firstModule = pipeline.modules[0];
      dataFlowRouter.publishModuleData(firstModule, dealId, inputs);
    }

    // Execute each module in the pipeline
    for (const moduleId of pipeline.modules) {
      if (moduleId === 'M08') {
        const arbResult = await strategyArbitrageEngine.analyze(dealId);
        results.push({
          moduleId: 'M08',
          dealId,
          success: true,
          outputs: {
            strategy_scores: Object.fromEntries(arbResult.strategies.map(s => [s.strategy, s.score])),
            recommended_strategy: arbResult.recommended,
            arbitrage_flag: arbResult.arbitrageFlag,
          },
          formulasExecuted: ['F23', 'F24'],
          duration: 0,
        });
      } else {
        const result = await this.executeModule(moduleId, dealId);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Execute all P0 pipelines for a deal (full initial wiring).
   */
  async executeP0Wiring(dealId: string, inputs?: Record<string, any>): Promise<ModuleExecutionResult[]> {
    const p0Pipelines = WIRING_PIPELINES.filter(p => p.priority === 'P0');
    const allResults: ModuleExecutionResult[] = [];

    for (const pipeline of p0Pipelines) {
      const results = await this.executePipeline(pipeline.id, dealId, inputs);
      allResults.push(...results);
    }

    return allResults;
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle module data updates — trigger cascade recalculations.
   */
  private async handleModuleDataUpdate(event: ModuleEvent): Promise<void> {
    const { sourceModule, dealId } = event;

    // Check if any downstream modules need recalculation
    const downstream = dataFlowRouter.getAffectedModules(sourceModule);
    if (downstream.length === 0) return;

    // Debounce cascade via event bus
    moduleEventBus.emitDebounced({
      type: ModuleEventType.RECALCULATE,
      sourceModule,
      dealId,
      data: { affected: downstream },
      timestamp: new Date(),
    }, `cascade:${sourceModule}:${dealId}`);
  }

  /**
   * Handle JEDI score changes — notify alerts module.
   */
  private async handleScoreChange(event: ModuleEvent): Promise<void> {
    const { dealId, data } = event;
    const scoreDelta = data?.score_delta || 0;

    // Significant score change (>5 points) triggers alert
    if (Math.abs(scoreDelta) >= 5) {
      moduleEventBus.emit({
        type: ModuleEventType.RISK_ALERT,
        sourceModule: 'M25',
        dealId,
        data: {
          alert_type: 'jedi_score_change',
          score_delta: scoreDelta,
          new_score: data?.new_score,
          severity: Math.abs(scoreDelta) >= 10 ? 'high' : 'medium',
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle news classification — route to demand and supply modules.
   */
  private async handleNewsClassified(event: ModuleEvent): Promise<void> {
    const { dealId, data } = event;
    if (!data?.events) return;

    // Route demand events to M06
    const demandEvents = data.events.filter((e: any) =>
      ['employment', 'university', 'military', 'migration'].includes(e.category)
    );
    if (demandEvents.length > 0) {
      dataFlowRouter.publishModuleData('M19', dealId, {
        classified_demand_events: demandEvents,
      });
    }

    // Route supply events to M04
    const supplyEvents = data.events.filter((e: any) =>
      ['development', 'construction', 'permit', 'demolition'].includes(e.category)
    );
    if (supplyEvents.length > 0) {
      dataFlowRouter.publishModuleData('M19', dealId, {
        classified_supply_events: supplyEvents,
      });
    }
  }

  // ============================================================================
  // Status & Diagnostics
  // ============================================================================

  /**
   * Get orchestrator status.
   */
  getStatus(): OrchestratorStatus {
    const health: Record<string, { status: string; lastRun?: Date }> = {};
    for (const [id, h] of this.moduleHealth) {
      health[id] = h;
    }

    return {
      initialized: this.initialized,
      activeSubscriptions: moduleEventBus.getStats().subscriptionCount,
      pendingRecalculations: this.pendingRecalculations.size,
      lastCascade: this.lastCascade,
      moduleHealth: health as Record<ModuleId, { status: 'ready' | 'partial' | 'missing'; lastRun?: Date }>,
    };
  }

  /**
   * Get readiness report for a deal across all modules.
   */
  getDealReadiness(dealId: string): Record<ModuleId, DataFlowResult> {
    return dataFlowRouter.getReadinessReport(dealId);
  }

  /**
   * Get all wiring pipelines organized by priority.
   */
  getWiringPipelines(): Record<string, WiringPipeline[]> {
    const grouped: Record<string, WiringPipeline[]> = {};
    for (const pipeline of WIRING_PIPELINES) {
      if (!grouped[pipeline.priority]) {
        grouped[pipeline.priority] = [];
      }
      grouped[pipeline.priority].push(pipeline);
    }
    return grouped;
  }

  /**
   * Validate the wiring configuration for issues.
   */
  validateWiring(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for circular dependencies
    const cycles = dataFlowRouter.detectCycles();
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        issues.push(`Circular dependency detected: ${cycle.join(' → ')}`);
      }
    }

    // Check that all formula references in modules exist
    for (const [moduleId, moduleDef] of Object.entries(MODULE_REGISTRY)) {
      for (const formulaId of moduleDef.formulas) {
        if (!FORMULA_REGISTRY[formulaId as FormulaId]) {
          issues.push(`Module ${moduleId} references unknown formula: ${formulaId}`);
        }
      }
    }

    // Check that all module references in dependencies exist
    for (const [moduleId, moduleDef] of Object.entries(MODULE_REGISTRY)) {
      for (const dep of moduleDef.receivesFrom) {
        if (!MODULE_REGISTRY[dep.moduleId]) {
          issues.push(`Module ${moduleId} depends on unknown module: ${dep.moduleId}`);
        }
      }
      for (const target of moduleDef.feedsInto) {
        if (!MODULE_REGISTRY[target]) {
          issues.push(`Module ${moduleId} feeds into unknown module: ${target}`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const moduleWiringOrchestrator = new ModuleWiringOrchestrator();
