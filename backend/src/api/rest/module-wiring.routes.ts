/**
 * Module Wiring API Routes
 *
 * REST endpoints for the module wiring system.
 * Provides access to module registry, formula engine, data flow,
 * strategy arbitrage, and orchestration controls.
 */

import { Router, Request, Response } from 'express';
import {
  MODULE_REGISTRY,
  ALL_MODULE_IDS,
  getModule,
  getModulesByPriority,
  getModuleBuildOrder,
  FORMULA_REGISTRY,
  ALL_FORMULA_IDS,
  executeFormula,
  getFormulasForModule,
  dataFlowRouter,
  DATA_FLOW_CONNECTIONS,
  strategyArbitrageEngine,
  STRATEGY_WEIGHTS,
  moduleWiringOrchestrator,
  WIRING_PIPELINES,
  wireJediScore,
  wireNewsToSignals,
  wireZoningToStrategy,
  wireSignalsToRisk,
  wireStrategyArbitrage,
  wireP0Pipeline,
  setupP0Subscriptions,
  wireProFormaSync,
  wireProFormaInit,
  wireScenarioGeneration,
  wireScenarioRecalculate,
  wireCompetitionToMarket,
  wireDebtAnalysis,
  wireP1Pipeline,
  setupP1Subscriptions,
  wireTrafficIntelligence,
  wireTrafficForecast,
  wireExitAnalysis,
  wirePortfolioPerformance,
  wireP2Pipeline,
  setupP2Subscriptions,
} from '../../services/module-wiring';
import type { ModuleId, FormulaId } from '../../services/module-wiring';

const router = Router();

// ============================================================================
// Module Registry Endpoints
// ============================================================================

/** GET /modules/registry - List all modules */
router.get('/modules/registry', (_req: Request, res: Response) => {
  res.json({
    modules: MODULE_REGISTRY,
    count: ALL_MODULE_IDS.length,
    buildOrder: getModuleBuildOrder(),
  });
});

/** GET /modules/registry/:id - Get a single module definition */
router.get('/modules/registry/:id', (req: Request, res: Response) => {
  const moduleId = req.params.id as ModuleId;
  const moduleDef = MODULE_REGISTRY[moduleId];
  if (!moduleDef) {
    return res.status(404).json({ error: `Module not found: ${moduleId}` });
  }
  res.json(moduleDef);
});

/** GET /modules/priority/:priority - Get modules by priority */
router.get('/modules/priority/:priority', (req: Request, res: Response) => {
  const priority = req.params.priority as 'P0' | 'P1' | 'P2';
  const modules = getModulesByPriority(priority);
  res.json({ priority, modules, count: modules.length });
});

/** GET /modules/build-order - Get topological build order */
router.get('/modules/build-order', (_req: Request, res: Response) => {
  res.json({ buildOrder: getModuleBuildOrder() });
});

// ============================================================================
// Formula Engine Endpoints
// ============================================================================

/** GET /formulas - List all formulas */
router.get('/formulas', (_req: Request, res: Response) => {
  const formulas = Object.values(FORMULA_REGISTRY).map(f => ({
    id: f.id,
    name: f.name,
    modules: f.modules,
    category: f.category,
    description: f.description,
    inputKeys: f.inputKeys,
    outputKey: f.outputKey,
    unit: f.unit,
    status: f.status,
  }));
  res.json({ formulas, count: formulas.length });
});

/** GET /formulas/:id - Get formula definition */
router.get('/formulas/:id', (req: Request, res: Response) => {
  const formulaId = req.params.id as FormulaId;
  const formula = FORMULA_REGISTRY[formulaId];
  if (!formula) {
    return res.status(404).json({ error: `Formula not found: ${formulaId}` });
  }
  res.json({
    id: formula.id,
    name: formula.name,
    modules: formula.modules,
    category: formula.category,
    description: formula.description,
    inputKeys: formula.inputKeys,
    outputKey: formula.outputKey,
    unit: formula.unit,
    status: formula.status,
  });
});

/** POST /formulas/:id/execute - Execute a formula with given inputs */
router.post('/formulas/:id/execute', (req: Request, res: Response) => {
  const formulaId = req.params.id as FormulaId;
  const formula = FORMULA_REGISTRY[formulaId];
  if (!formula) {
    return res.status(404).json({ error: `Formula not found: ${formulaId}` });
  }
  try {
    const result = executeFormula(formulaId, req.body);
    res.json({ formulaId, result, inputs: req.body });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/** GET /formulas/module/:moduleId - Get formulas for a module */
router.get('/formulas/module/:moduleId', (req: Request, res: Response) => {
  const formulas = getFormulasForModule(req.params.moduleId);
  res.json({ moduleId: req.params.moduleId, formulas: formulas.map(f => ({ id: f.id, name: f.name, status: f.status })) });
});

// ============================================================================
// Data Flow Endpoints
// ============================================================================

/** GET /data-flow/matrix - Get full data flow matrix */
router.get('/data-flow/matrix', (_req: Request, res: Response) => {
  res.json({
    connections: DATA_FLOW_CONNECTIONS,
    count: DATA_FLOW_CONNECTIONS.length,
  });
});

/** GET /data-flow/incoming/:moduleId - Get incoming connections for a module */
router.get('/data-flow/incoming/:moduleId', (req: Request, res: Response) => {
  const moduleId = req.params.moduleId as ModuleId;
  const connections = dataFlowRouter.getIncomingConnections(moduleId);
  res.json({ moduleId, incoming: connections });
});

/** GET /data-flow/outgoing/:moduleId - Get outgoing connections for a module */
router.get('/data-flow/outgoing/:moduleId', (req: Request, res: Response) => {
  const moduleId = req.params.moduleId as ModuleId;
  const connections = dataFlowRouter.getOutgoingConnections(moduleId);
  res.json({ moduleId, outgoing: connections });
});

/** GET /data-flow/cascade/:moduleId - Get cascade chain for a module */
router.get('/data-flow/cascade/:moduleId', (req: Request, res: Response) => {
  const moduleId = req.params.moduleId as ModuleId;
  const chain = dataFlowRouter.getCascadeChain(moduleId);
  res.json({ moduleId, cascadeChain: chain, affectedCount: chain.length });
});

/** GET /data-flow/readiness/:dealId - Get readiness report for a deal */
router.get('/data-flow/readiness/:dealId', (req: Request, res: Response) => {
  const report = dataFlowRouter.getReadinessReport(req.params.dealId);
  res.json({ dealId: req.params.dealId, readiness: report });
});

/** GET /data-flow/cycles - Check for circular dependencies */
router.get('/data-flow/cycles', (_req: Request, res: Response) => {
  const cycles = dataFlowRouter.detectCycles();
  res.json({ hasCycles: cycles.length > 0, cycles });
});

// ============================================================================
// Strategy Arbitrage Endpoints
// ============================================================================

/** POST /strategy/analyze/:dealId - Run strategy arbitrage analysis */
router.post('/strategy/analyze/:dealId', async (req: Request, res: Response) => {
  try {
    const result = await strategyArbitrageEngine.analyze(req.params.dealId, req.body.signals);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** GET /strategy/weights - Get strategy weight matrix */
router.get('/strategy/weights', (_req: Request, res: Response) => {
  res.json({ weights: STRATEGY_WEIGHTS });
});

/** POST /strategy/compare - Compare two strategies */
router.post('/strategy/compare', (req: Request, res: Response) => {
  const { strategyA, strategyB, signals } = req.body;
  if (!strategyA || !strategyB || !signals) {
    return res.status(400).json({ error: 'strategyA, strategyB, and signals are required' });
  }
  const result = strategyArbitrageEngine.compareStrategies(strategyA, strategyB, signals);
  res.json(result);
});

// ============================================================================
// Orchestrator Endpoints
// ============================================================================

/** GET /orchestrator/status - Get orchestrator status */
router.get('/orchestrator/status', (_req: Request, res: Response) => {
  res.json(moduleWiringOrchestrator.getStatus());
});

/** POST /orchestrator/initialize - Initialize the orchestrator */
router.post('/orchestrator/initialize', (_req: Request, res: Response) => {
  moduleWiringOrchestrator.initialize();
  res.json({ status: 'initialized' });
});

/** POST /orchestrator/execute/:moduleId/:dealId - Execute a single module */
router.post('/orchestrator/execute/:moduleId/:dealId', async (req: Request, res: Response) => {
  try {
    const result = await moduleWiringOrchestrator.executeModule(
      req.params.moduleId as ModuleId,
      req.params.dealId,
      req.body,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /orchestrator/cascade/:moduleId/:dealId - Execute cascade from a module */
router.post('/orchestrator/cascade/:moduleId/:dealId', async (req: Request, res: Response) => {
  try {
    const result = await moduleWiringOrchestrator.executeCascade(
      req.params.moduleId as ModuleId,
      req.params.dealId,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /orchestrator/pipeline/:pipelineId/:dealId - Execute a wiring pipeline */
router.post('/orchestrator/pipeline/:pipelineId/:dealId', async (req: Request, res: Response) => {
  try {
    const results = await moduleWiringOrchestrator.executePipeline(
      req.params.pipelineId,
      req.params.dealId,
      req.body,
    );
    res.json({ pipelineId: req.params.pipelineId, results });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /orchestrator/p0/:dealId - Execute all P0 wiring for a deal */
router.post('/orchestrator/p0/:dealId', async (req: Request, res: Response) => {
  try {
    const results = await moduleWiringOrchestrator.executeP0Wiring(req.params.dealId, req.body);
    res.json({ dealId: req.params.dealId, results });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** GET /orchestrator/pipelines - List all wiring pipelines */
router.get('/orchestrator/pipelines', (_req: Request, res: Response) => {
  res.json({ pipelines: moduleWiringOrchestrator.getWiringPipelines() });
});

/** GET /orchestrator/validate - Validate wiring configuration */
router.get('/orchestrator/validate', (_req: Request, res: Response) => {
  res.json(moduleWiringOrchestrator.validateWiring());
});

/** GET /orchestrator/deal-readiness/:dealId - Get deal readiness report */
router.get('/orchestrator/deal-readiness/:dealId', (req: Request, res: Response) => {
  const readiness = moduleWiringOrchestrator.getDealReadiness(req.params.dealId);
  res.json({ dealId: req.params.dealId, readiness });
});

// ============================================================================
// P0 Service Wiring Endpoints
// ============================================================================

/** POST /wire/p0/:dealId - Run full P0 pipeline for a deal */
router.post('/wire/p0/:dealId', async (req: Request, res: Response) => {
  try {
    const result = await wireP0Pipeline(req.params.dealId, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/jedi-score/:dealId - Wire JEDI Score calculation */
router.post('/wire/jedi-score/:dealId', async (req: Request, res: Response) => {
  try {
    await wireJediScore(req.params.dealId, req.body.triggerType);
    const scoreData = dataFlowRouter.getModuleData('M25', req.params.dealId);
    res.json({ dealId: req.params.dealId, ...scoreData?.data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/news/:dealId - Wire a news event through demand/supply */
router.post('/wire/news/:dealId', async (req: Request, res: Response) => {
  try {
    await wireNewsToSignals(req.params.dealId, req.body);
    res.json({ dealId: req.params.dealId, status: 'routed' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/zoning/:dealId - Wire zoning -> dev cap -> strategy */
router.post('/wire/zoning/:dealId', async (req: Request, res: Response) => {
  try {
    await wireZoningToStrategy(req.params.dealId, req.body);
    const strategyData = dataFlowRouter.getModuleData('M08', req.params.dealId);
    const devCapData = dataFlowRouter.getModuleData('M03', req.params.dealId);
    res.json({
      dealId: req.params.dealId,
      devCap: devCapData?.data,
      strategy: strategyData?.data,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/risk/:dealId - Wire supply + demand -> risk */
router.post('/wire/risk/:dealId', async (req: Request, res: Response) => {
  try {
    const { tradeAreaId } = req.body;
    if (!tradeAreaId) {
      return res.status(400).json({ error: 'tradeAreaId is required' });
    }
    await wireSignalsToRisk(req.params.dealId, tradeAreaId);
    const riskData = dataFlowRouter.getModuleData('M14', req.params.dealId);
    res.json({ dealId: req.params.dealId, ...riskData?.data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/strategy/:dealId - Wire strategy arbitrage */
router.post('/wire/strategy/:dealId', async (req: Request, res: Response) => {
  try {
    await wireStrategyArbitrage(req.params.dealId);
    const strategyData = dataFlowRouter.getModuleData('M08', req.params.dealId);
    res.json({ dealId: req.params.dealId, ...strategyData?.data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/subscriptions/setup - Set up auto-cascade subscriptions */
router.post('/wire/subscriptions/setup', (_req: Request, res: Response) => {
  setupP0Subscriptions();
  res.json({ status: 'P0 auto-cascade subscriptions initialized' });
});

// ============================================================================
// P1 Service Wiring Endpoints
// ============================================================================

/** POST /wire/p1/:dealId - Run full P1 pipeline for a deal */
router.post('/wire/p1/:dealId', async (req: Request, res: Response) => {
  try {
    const result = await wireP1Pipeline(req.params.dealId, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/proforma/sync/:dealId - Recalculate proforma assumptions */
router.post('/wire/proforma/sync/:dealId', async (req: Request, res: Response) => {
  try {
    const { triggerType, triggerEventId } = req.body;
    await wireProFormaSync(req.params.dealId, triggerType || 'periodic_update', triggerEventId);
    const proformaData = dataFlowRouter.getModuleData('M09', req.params.dealId);
    res.json({ dealId: req.params.dealId, ...proformaData?.data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/proforma/init/:dealId - Initialize proforma for a deal */
router.post('/wire/proforma/init/:dealId', async (req: Request, res: Response) => {
  try {
    const { strategy } = req.body;
    await wireProFormaInit(req.params.dealId, strategy || 'rental');
    const proformaData = dataFlowRouter.getModuleData('M09', req.params.dealId);
    res.json({ dealId: req.params.dealId, ...proformaData?.data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/scenarios/:dealId - Generate scenarios for a deal */
router.post('/wire/scenarios/:dealId', async (req: Request, res: Response) => {
  try {
    await wireScenarioGeneration(req.params.dealId, req.body);
    const scenarioData = dataFlowRouter.getModuleData('M10', req.params.dealId);
    res.json({ dealId: req.params.dealId, ...scenarioData?.data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/scenarios/recalculate/:scenarioId - Recalculate a specific scenario */
router.post('/wire/scenarios/recalculate/:scenarioId', async (req: Request, res: Response) => {
  try {
    await wireScenarioRecalculate(req.params.scenarioId, req.body.userId);
    res.json({ scenarioId: req.params.scenarioId, status: 'recalculated' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/competition/:dealId - Wire competition -> market */
router.post('/wire/competition/:dealId', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, tradeAreaId, subjectRent } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }
    await wireCompetitionToMarket(req.params.dealId, { latitude, longitude, tradeAreaId, subjectRent });
    const competitionData = dataFlowRouter.getModuleData('M05', req.params.dealId);
    res.json({ dealId: req.params.dealId, ...competitionData?.data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/debt/:dealId - Wire debt analysis */
router.post('/wire/debt/:dealId', async (req: Request, res: Response) => {
  try {
    await wireDebtAnalysis(req.params.dealId, req.body);
    const debtData = dataFlowRouter.getModuleData('M11', req.params.dealId);
    res.json({ dealId: req.params.dealId, ...debtData?.data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/subscriptions/p1/setup - Set up P1 auto-cascade subscriptions */
router.post('/wire/subscriptions/p1/setup', (_req: Request, res: Response) => {
  setupP1Subscriptions();
  res.json({ status: 'P1 auto-cascade subscriptions initialized' });
});

// ============================================================================
// P2 Service Wiring Endpoints
// ============================================================================

/** POST /wire/p2/:dealId - Run full P2 pipeline for a deal */
router.post('/wire/p2/:dealId', async (req: Request, res: Response) => {
  try {
    const result = await wireP2Pipeline(req.params.dealId, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/traffic/:dealId - Wire traffic intelligence */
router.post('/wire/traffic/:dealId', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }
    await wireTrafficIntelligence(req.params.dealId, req.body);
    const trafficData = dataFlowRouter.getModuleData('M16', req.params.dealId);
    res.json({ dealId: req.params.dealId, ...trafficData?.data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/traffic/forecast/:dealId - Wire traffic forecast */
router.post('/wire/traffic/forecast/:dealId', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }
    await wireTrafficForecast(req.params.dealId, req.body);
    const forecastData = dataFlowRouter.getModuleData('M16', req.params.dealId);
    res.json({ dealId: req.params.dealId, ...forecastData?.data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/exit/:dealId - Wire exit analysis */
router.post('/wire/exit/:dealId', async (req: Request, res: Response) => {
  try {
    const { purchasePrice } = req.body;
    if (!purchasePrice) {
      return res.status(400).json({ error: 'purchasePrice is required' });
    }
    await wireExitAnalysis(req.params.dealId, req.body);
    const exitData = dataFlowRouter.getModuleData('M12', req.params.dealId);
    res.json({ dealId: req.params.dealId, ...exitData?.data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/portfolio - Wire portfolio performance */
router.post('/wire/portfolio', async (req: Request, res: Response) => {
  try {
    const { assets } = req.body;
    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ error: 'assets array is required with at least one entry' });
    }
    await wirePortfolioPerformance(assets);
    const portfolioData = dataFlowRouter.getModuleData('M22', 'PORTFOLIO');
    res.json(portfolioData?.data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** POST /wire/subscriptions/p2/setup - Set up P2 auto-cascade subscriptions */
router.post('/wire/subscriptions/p2/setup', (_req: Request, res: Response) => {
  setupP2Subscriptions();
  res.json({ status: 'P2 auto-cascade subscriptions initialized' });
});

/** POST /wire/subscriptions/all/setup - Set up all auto-cascade subscriptions (P0+P1+P2) */
router.post('/wire/subscriptions/all/setup', (_req: Request, res: Response) => {
  setupP0Subscriptions();
  setupP1Subscriptions();
  setupP2Subscriptions();
  res.json({ status: 'All auto-cascade subscriptions initialized (P0 + P1 + P2)' });
});

export default router;
