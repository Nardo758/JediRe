/**
 * Module Wiring System - Public API
 *
 * Central entry point for the JEDI RE module wiring infrastructure.
 * Provides access to the Module Registry, Formula Engine, Data Flow Router,
 * Event Bus, Strategy Engine, and Wiring Orchestrator.
 *
 * Usage:
 *   import { moduleWiringOrchestrator, executeFormula, dataFlowRouter } from './module-wiring';
 */

// Module Registry
export {
  MODULE_REGISTRY,
  getModule,
  getModulesByPriority,
  getModulesByStage,
  getModulesByCategory,
  getModulesByBuildStatus,
  getUpstreamModules,
  getDownstreamModules,
  getModuleBuildOrder,
  getTransitiveDependencies,
  ALL_MODULE_IDS,
} from './module-registry';

export type {
  ModuleId,
  ModuleStage,
  ModuleCategory,
  BuildStatus,
  Priority,
  ModuleOutput,
  ModuleDependency,
  ModuleDefinition,
} from './module-registry';

// Formula Engine
export {
  FORMULA_REGISTRY,
  executeFormula,
  getFormulasForModule,
  getFormulasByCategory,
  getFormulasByStatus,
  ALL_FORMULA_IDS,
} from './formula-engine';

export type {
  FormulaId,
  FormulaCategory,
  FormulaStatus,
  FormulaDefinition,
} from './formula-engine';

// Data Flow Router
export {
  dataFlowRouter,
  DATA_FLOW_CONNECTIONS,
  getFinancialInputsFromModules,
  setupFinancialModuleListeners,
} from './data-flow-router';

export type {
  DataFlowStrength,
  DataFlowConnection,
  ModuleDataPacket,
  DataFlowResult,
  FinancialModuleInputs,
} from './data-flow-router';

// Module Event Bus
export {
  moduleEventBus,
  ModuleEventType,
} from './module-event-bus';

export type {
  ModuleEvent,
  ModuleEventHandler,
  Subscription,
} from './module-event-bus';

// Strategy Arbitrage Engine
export {
  strategyArbitrageEngine,
  STRATEGY_WEIGHTS,
  STRATEGY_LABELS,
  KEY_INDICATORS,
} from './strategy-arbitrage-engine';

export type {
  StrategyType,
  StrategyWeights,
  StrategyAnalysis,
  ArbitrageResult,
  StrategySignalInputs,
} from './strategy-arbitrage-engine';

// Module Wiring Orchestrator
export {
  moduleWiringOrchestrator,
  WIRING_PIPELINES,
} from './module-wiring-orchestrator';

export type {
  WiringPipeline,
  ModuleExecutionResult,
  CascadeResult,
  OrchestratorStatus,
} from './module-wiring-orchestrator';

// P0 Service Adapters
export {
  wireJediScore,
  wireNewsToSignals,
  wireZoningToStrategy,
  wireSignalsToRisk,
  wireStrategyArbitrage,
  wireP0Pipeline,
  setupP0Subscriptions,
} from './p0-service-adapters';

// P1 Service Adapters
export {
  wireProFormaSync,
  wireProFormaInit,
  wireScenarioGeneration,
  wireScenarioRecalculate,
  wireCompetitionToMarket,
  wireDebtAnalysis,
  wireP1Pipeline,
  setupP1Subscriptions,
} from './p1-service-adapters';

// P2 Service Adapters
export {
  wireTrafficIntelligence,
  wireTrafficForecast,
  wireExitAnalysis,
  wirePortfolioPerformance,
  wireP2Pipeline,
  setupP2Subscriptions,
} from './p2-service-adapters';

// M07 → M09 Projections Adapter
export {
  m07ProjectionsAdapter,
  wireM07ToM09Projections,
  wireM07ToM09Override,
  M07ProjectionsAdapter,
  getProjectionsCtx,
  setProjectionsCtx,
} from './m07-projections-adapter';

export type {
  OccupancyLeasingRow,
  ConcessionsRow,
  ProjectionsOutput,
  ProjectionsDealContext,
  DealContextTraffic,
  CapexSchedule,
} from './m07-projections-adapter';

export {
  PROJECTIONS_DEPENDENCY_GRAPH,
  OVERRIDE_DOWNSTREAM,
  PROJECTIONS_INVARIANTS,
  assertProjectionsInvariants,
} from './projections-dependency-graph';

export type {
  PropagationRule,
  RowDependency,
  InvariantDefinition,
} from './projections-dependency-graph';

// Capital Structure Engine Adapter (M11+)
export {
  wireCapitalStack,
  wireWaterfallCalculation,
  wireScenarioComparison,
  wireRateAnalysis,
  wireCapitalStructurePipeline,
  setupCapitalStructureSubscriptions,
} from './capital-structure-adapter';
