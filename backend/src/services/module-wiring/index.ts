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
} from './data-flow-router';

export type {
  DataFlowStrength,
  DataFlowConnection,
  ModuleDataPacket,
  DataFlowResult,
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
