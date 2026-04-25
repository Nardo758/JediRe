/**
 * REST API Routes Setup
 * Organize all REST endpoints
 */

import { Application } from 'express';
import authRoutes from './auth.routes';
import agentAuthRoutes from './agent-auth.routes';
import propertyRoutes from './property.routes';
import createUnifiedPropertiesRoutes from './unified-properties.routes';
import zoningRoutes from './zoning.routes';
import marketRoutes from './market.routes';
import agentRoutes from './agent.routes';
import llmRoutes from './llm.routes';
import microsoftRoutes from './microsoft.routes';
import preferencesRoutes from './preferences.routes';
import emailExtractionsRoutes from './email-extractions.routes';
import mapsRoutes from './maps.routes';
import proposalsRoutes from './proposals.routes';
import notificationsRoutes from './notifications.routes';
import pipelineRoutes from './pipeline';
import tasksRoutes from './tasks.routes';
import taskCompletionRoutes from './task-completion.routes';
import emailRoutes from './email.routes';
import inboxRoutes from './inbox.routes';
import gmailRoutes from './gmail.routes';
import newsRoutes from './news.routes';
import newsConnectionsRoutes from './news-connections.routes';
import tradeAreasRoutes from './trade-areas.routes';
import geographicContextRoutes from './geographic-context.routes';
import geographyRoutes from './geography.routes';
import isochroneRoutes from './isochrone.routes';
import trafficAiRoutes from './traffic-ai.routes';
import trafficPredictionRoutes from './trafficPrediction.routes';
import layersRoutes from './layers.routes';
import mapConfigsRoutes from './map-configs.routes';
import gridRoutes from './grid.routes';
import modulesRoutes from './modules.routes';
import financialModelsRoutes from './financial-models.routes';
import strategyAnalysesRoutes from './strategy-analyses.routes';
import ddChecklistsRoutes from './dd-checklists.routes';
import propertyTypeStrategiesRoutes from './property-type-strategies.routes';
import propertyTypesRoutes from './property-types.routes';
import dashboardRoutes from './dashboard.routes';
import demandRoutes from './demand.routes';
import supplyRoutes from './supply.routes';
import jediRoutes from './jedi.routes';
import riskRoutes from './risk.routes';
import proformaRoutes from './proforma.routes';
import auditRoutes from './audit.routes';
import scenariosRoutes from './scenarios.routes';
import credibilityRoutes from './credibility.routes';
import kafkaEventsRoutes from './kafka-events.routes';
import documentsFilesRoutes from './documentsFiles.routes';
import assetMapIntelligenceRoutes, { noteCategoriesRoutes } from './asset-map-intelligence.routes';
import mapAnnotationsRoutes from './mapAnnotations.routes';
import leasingTrafficRoutes from './leasing-traffic.routes';
import moduleLibrariesRoutes from './module-libraries.routes';
import neighboringPropertiesRoutes from './neighboringProperties.routes';
import qwenRoutes from './qwen.routes';
import competitionRoutes from './competition.routes';
import dataTrackerRoutes from './data-tracker.routes';
import entitlementRoutes from './entitlement.routes';
import regulatoryAlertRoutes from './regulatory-alert.routes';
import dealTimelineRoutes from './deal-timeline.routes';
import zoningComparatorRoutes from './zoning-comparator.routes';
import zoningVerificationRoutes from './zoning-verification.routes';
import zoningProfileRoutes from './zoning-profile.routes';
import zoningTriangulationRoutes from './zoning-triangulation.routes';
import developmentScenariosRoutes from './development-scenarios.routes';
import trafficDataRoutes from './traffic-data.routes';
import trafficCompsRoutes from './traffic-comps.routes';
import correlationRoutes from './correlation.routes';
import leadLagRoutes from './lead-lag.routes';
import backtestRoutes from './backtest.routes';
import dealContextRoutes from './deal-context.routes';
import dealMarketIntelligenceRoutes from './deal-market-intelligence.routes';
import createMarketIntelligenceRoutes from './market-intelligence.routes';
import demandIntelligenceRoutes from './demand-intelligence.routes';
import rankingsRoutes from './rankings.routes';
import clawdbotWebhooksRoutes from './clawdbot-webhooks.routes';
import buildingDesign3DRoutes from './building-design-3d.routes';
import aiRenderingRoutes from './ai-rendering.routes';
import designAssistantRoutes from './design-assistant.routes';
import m28CycleIntelligenceRoutes from './m28-cycle-intelligence.routes';
import apartmentLocatorRoutes from './apartment-locator.routes';
import commandCenterRoutes from './command-center.routes';
import scrapeRoutes from './scrape.routes';
import metricsCatalogRoutes from './metrics-catalog.routes';
import marketMetricsRoutes from './market-metrics.routes';
import customStrategiesRoutes from './custom-strategies.routes';
import ingestionRoutes from './ingestion.routes';
import strategiesRoutes from './strategy-definitions.routes';
import m08StrategiesRoutes from './strategies.routes';
import { createCapsuleRoutes } from './capsule.routes';
import { createDataLibraryAssetsRoutes } from './data-library-assets.routes';
import inlineDealsRoutes from './inline-deals.routes';
import dealTemplatesRoutes from './deal-templates.routes';
import reportingPackageRoutes from './reporting-package.routes';
import dealActivityRoutes from './deal-activity.routes';
import dealTrafficRoutes from './deal-traffic.routes';
import { notFoundHandler } from '../../middleware/errorHandler';
import { createUnitMixRoutes } from './unitMix.routes';
import dealCompSetsRoutes from './deal-comp-sets.routes';
import capitalStructureRoutes from './capital-structure.routes';
import buildingEnvelopeRoutes from './building-envelope.routes';
import moduleWiringRoutes from './module-wiring.routes';
import corporateHealthRoutes from './corporate-health.routes';
import opportunityEngineRoutes from './opportunity-engine.routes';
import benchmarkTimelineRoutes from './benchmark-timeline.routes';
import tickerRoutes from './ticker.routes';
import economicContextRoutes from './economic-context.routes';
import agentSettingsRoutes from './agent-settings.routes';
import settingsAiRoutes from './settings-ai.routes';
import columnPreferencesRoutes from './column-preferences.routes';
import timeSeriesRoutes from './time-series.routes';
import driverAnalysisRoutes from './driver-analysis.routes';
import agentRunsRoutes, { dealAgentRunsRouter } from './agent-runs.routes';
import cashflowUnderwritingRoutes, { dealUnderwritingRouter } from './cashflow-underwriting.routes';
import investorCapitalRoutes from './investor-capital.routes';
import skillChatRoutes from './skill-chat.routes';
import agentsRoutes from './agents.routes';
import morningBriefRoutes from './morning-brief.routes';
import propertyEnrichmentRoutes from './property-enrichment.routes';
import propertyDiscoveryRoutes from './property-discovery.routes';
import georgiaIngestionRoutes from './georgia-ingestion.routes';
import proximityRoutes, { setPool as setProximityPool } from './proximity.routes';
import dataMatrixRoutes from './data-matrix.routes';
import inflationRoutes from './inflation.routes';
import createKnowledgeGraphRoutes from './knowledge-graph.routes';
import createContextAwarenessRoutes from './context-awareness.routes';
import columnCatalogRoutes from './column-catalog.routes';
import plannerRoutes from './planner.routes';
import scheduledRefreshRoutes from './scheduled-refresh.routes';

const API_PREFIX = '/api/v1';

export function setupRESTRoutes(app: Application): void {
  // Authentication routes
  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/auth`, agentAuthRoutes);

  // Dashboard routes
  app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);

  // User preferences routes
  app.use(`${API_PREFIX}/preferences`, preferencesRoutes);

  // Property Type Strategies routes (Settings > Property Types)
  app.use(`${API_PREFIX}/property-type-strategies`, propertyTypeStrategiesRoutes);

  // Property Types routes (Deal Creation)
  app.use(`${API_PREFIX}/property-types`, propertyTypesRoutes);

  // Email extraction routes (Property + News from emails)
  app.use(`${API_PREFIX}/email-extractions`, emailExtractionsRoutes);

  // Maps & pins routes
  app.use(`${API_PREFIX}/maps`, mapsRoutes);

  // Collaboration proposals routes
  app.use(`${API_PREFIX}/proposals`, proposalsRoutes);

  // Notifications routes
  app.use(`${API_PREFIX}/notifications`, notificationsRoutes);

  // Property routes
  // Unified Properties routes (must be before propertyRoutes to avoid /:id catching 'unified')
  const { getPool: getUnifiedPool } = require('../../database/connection');
  app.use(`${API_PREFIX}/properties`, createUnifiedPropertiesRoutes(getUnifiedPool()));

  app.use(`${API_PREFIX}/properties`, propertyRoutes);

  // Zoning routes
  app.use(`${API_PREFIX}/zoning`, zoningRoutes);

  // Market data routes
  app.use(`${API_PREFIX}/market`, marketRoutes);

  // Agent routes (orchestration)
  app.use(`${API_PREFIX}/agents`, agentRoutes);

  // Agent runtime routes (Phase 3): /agents/:agentId/run, /agents/runs/:runId, etc.
  app.use(`${API_PREFIX}/agents`, agentRunsRoutes);

  // Autonomous Agent System: /agents/chat, /agents/:agentId/chat, /agents/notifications, etc.
  app.use(`${API_PREFIX}/agents`, agentsRoutes);

  // Morning Brief: /morning-brief
  app.use(`${API_PREFIX}/morning-brief`, morningBriefRoutes);

  // Deal agent-run listing: GET /deals/:dealId/agent-runs
  app.use(`${API_PREFIX}/deals`, dealAgentRunsRouter);

  // Skill Chat routes: POST /deals/:dealId/skills/chat, GET /deals/:dealId/skills/list
  app.use(`${API_PREFIX}/deals`, skillChatRoutes);

  // CashFlow Evidence System routes: /agents/cashflow/underwrite, /agents/runs/:runId/underwriting
  app.use(`${API_PREFIX}/agents`, cashflowUnderwritingRoutes);

  // Deal-scoped underwriting routes: assumptions evidence, overrides, walkthrough
  app.use(`${API_PREFIX}/deals`, dealUnderwritingRouter);

  // Agent Settings routes (model selection, workforce config)
  app.use(`${API_PREFIX}/settings/agents`, agentSettingsRoutes);

  // AI Model Preferences routes (user's LLM preference)
  app.use(`${API_PREFIX}/settings/ai-preferences`, settingsAiRoutes);

  app.use(`${API_PREFIX}/column-preferences`, columnPreferencesRoutes);

  // LLM routes (AI-powered features)
  app.use(`${API_PREFIX}/llm`, llmRoutes);

  // Microsoft integration (Outlook, Calendar)
  app.use(`${API_PREFIX}/microsoft`, microsoftRoutes);

  // Data pipeline routes (Python integration)
  app.use(`${API_PREFIX}/pipeline`, pipelineRoutes);

  // Tasks routes (Global Tasks Module)
  app.use(`${API_PREFIX}/tasks`, tasksRoutes);

  // Task Completion Detection routes (Email Intelligence)
  app.use(`${API_PREFIX}/tasks`, taskCompletionRoutes);

  // Email routes (Email AI Integration)
  app.use(`${API_PREFIX}/emails`, emailRoutes);

  // Gmail routes (Gmail Sync Integration)
  app.use(`${API_PREFIX}/gmail`, gmailRoutes);

  // Inbox routes (Email Management)
  app.use(`${API_PREFIX}/inbox`, inboxRoutes);

  // News Intelligence routes
  app.use(`${API_PREFIX}/news`, newsRoutes);
  app.use(`${API_PREFIX}/news-connections`, newsConnectionsRoutes);

  // Trade Areas routes (Geographic Definition System)
  app.use(`${API_PREFIX}/trade-areas`, tradeAreasRoutes);

  // Geographic Context routes (Deal → Trade Area/Submarket/MSA linking)
  app.use(`${API_PREFIX}/deals`, geographicContextRoutes);
  app.use(`${API_PREFIX}`, geographicContextRoutes); // For /submarkets/lookup, /msas/lookup

  // Deal Context routes (Full deal data hydration)
  app.use(`${API_PREFIX}/deals`, dealContextRoutes);

  // Geography routes (Complete Geographic Assignment Engine)
  app.use(`${API_PREFIX}/geography`, geographyRoutes);

  // Demand Signal routes (JEDI RE Phase 1, Week 2 - Housing Demand Projections)
  app.use(`${API_PREFIX}/demand`, demandRoutes);

  // Supply Signal routes (JEDI RE Phase 2, Component 2 - Construction Pipeline Tracking)
  app.use(`${API_PREFIX}/supply`, supplyRoutes);

  // JEDI Score & Alerts routes (JEDI RE Phase 1, Week 3 - Score Integration + Alert System)
  app.use(`${API_PREFIX}/jedi`, jediRoutes);

  // Risk Scoring routes (JEDI RE Phase 2, Component 3 - Supply Risk + Demand Risk)
  app.use(`${API_PREFIX}/risk`, riskRoutes);

  // Pro Forma Adjustments routes (JEDI RE Phase 2, Component 1 - News → Financial Model Integration)
  app.use(`${API_PREFIX}/proforma`, proformaRoutes);

  // Audit Trail routes (JEDI RE Phase 2, Component 4 - Evidence Chain Auditability)
  app.use(`${API_PREFIX}/audit`, auditRoutes);

  // Scenario Generation routes (JEDI RE Phase 3, Component 2 - Evidence-Based Scenario Generation)
  app.use(`${API_PREFIX}/scenarios`, scenariosRoutes);

  // Source Credibility routes (JEDI RE Phase 3, Component 4 - Source Credibility Learning)
  app.use(`${API_PREFIX}/credibility`, credibilityRoutes);

  // Kafka Events routes (JEDI RE Phase 3, Component 3 - Kafka Event Bus Monitoring)
  app.use(`${API_PREFIX}/kafka-events`, kafkaEventsRoutes);

  // Isochrone routes (Drive-time boundary generation)
  app.use(`${API_PREFIX}/isochrone`, isochroneRoutes);

  // Traffic-AI routes (AI-powered trade area generation)
  app.use(`${API_PREFIX}/traffic-ai`, trafficAiRoutes);

  // Map Layers routes (data sources for map rendering)
  app.use(`${API_PREFIX}/layers`, layersRoutes);

  // Map Configurations routes (saved map tabs and War Maps)
  app.use(`${API_PREFIX}/map-configs`, mapConfigsRoutes);

  // Grid View routes (Pipeline & Assets Owned grids)
  app.use(`${API_PREFIX}/grid`, gridRoutes);

  // Module System routes (Settings > Modules page)
  app.use(`${API_PREFIX}/modules`, modulesRoutes);

  // Module Libraries routes (Historical data for Opus learning)
  app.use(`${API_PREFIX}/module-libraries`, moduleLibrariesRoutes);

  // Data Library Assets routes (Settings > Data Library)
  const { getPool: getDLPool } = require('../../database/connection');
  app.use(`${API_PREFIX}/data-library-assets`, createDataLibraryAssetsRoutes(getDLPool()));

  // Financial Models routes (Module-enhanced feature)
  app.use(`${API_PREFIX}/financial-models`, financialModelsRoutes);

  // Strategy Analyses routes (Module-enhanced feature)
  app.use(`${API_PREFIX}/strategy-analyses`, strategyAnalysesRoutes);

  // Due Diligence Checklists routes (Module-enhanced feature)
  app.use(`${API_PREFIX}/dd-checklists`, ddChecklistsRoutes);

  // Unified Documents & Files routes (Deal-level file management)
  app.use(`${API_PREFIX}`, documentsFilesRoutes);

  // Asset Map Intelligence routes (Notes, Replies, News Links, Real-time Sync)
  app.use(`${API_PREFIX}/assets`, assetMapIntelligenceRoutes);
  app.use(`${API_PREFIX}/note-categories`, noteCategoriesRoutes);

  // Map Annotations routes (Drawing tools for Pipeline & Assets maps)
  app.use(`${API_PREFIX}/map-annotations`, mapAnnotationsRoutes);

  // Leasing Traffic Prediction routes (Multifamily leasing traffic predictions)
  app.use(`${API_PREFIX}/leasing-traffic`, leasingTrafficRoutes);

  // Apartment Locator AI routes (Rent data sync and enrichment)
  app.use(`${API_PREFIX}/apartment-locator`, apartmentLocatorRoutes);

  // Command Center routes (Admin data sync orchestration)
  app.use(`${API_PREFIX}/command-center`, commandCenterRoutes);

  // Neighboring Properties routes (AI-enhanced assemblage analysis)
  app.use(`${API_PREFIX}/properties`, neighboringPropertiesRoutes);

  // Qwen AI routes (Multimodal AI for development intelligence)
  app.use(`${API_PREFIX}/ai`, qwenRoutes);

  // Competition Analysis routes (Development deal competitive analysis)
  app.use(`${API_PREFIX}/deals`, competitionRoutes);

  // Deal Comp Sets routes (Tiered comp discovery & management)
  app.use(`${API_PREFIX}/deals`, dealCompSetsRoutes);

  // Market Intelligence routes (preferences, available markets, overview)
  const { getPool: getMarketPool } = require('../../database/connection');
  app.use(`${API_PREFIX}/markets`, createMarketIntelligenceRoutes(getMarketPool()));

  // Deal Market Intelligence routes
  app.use(`${API_PREFIX}/deals`, dealMarketIntelligenceRoutes);

  // Data Tracker routes (Admin data coverage & completeness tracking)
  app.use(`${API_PREFIX}/admin/data-tracker`, dataTrackerRoutes);

  // Entitlement Tracker routes (Zoning & Entitlements Module)
  app.use(`${API_PREFIX}/entitlements`, entitlementRoutes);

  // Regulatory Alert routes (Zoning & Entitlements Module)
  app.use(`${API_PREFIX}/regulatory-alerts`, regulatoryAlertRoutes);

  // Deal Timeline routes (Zoning & Entitlements Module - Time-to-Shovel)
  app.use(`${API_PREFIX}/deal-timelines`, dealTimelineRoutes);

  // Zoning Comparator routes (Zoning & Entitlements Module - District/Parcel/Jurisdiction comparison)
  app.use(`${API_PREFIX}/zoning-comparator`, zoningComparatorRoutes);

  // Zoning Verification routes (Verification-First Pipeline)
  app.use(`${API_PREFIX}/zoning-verification`, zoningVerificationRoutes);

  // Zoning Triangulation routes (Nearby Entitlements, Parcel Ingestion, Property Linking)
  app.use(`${API_PREFIX}`, zoningTriangulationRoutes);

  // Zoning Profile routes (Constraint Set per deal)
  app.use(`${API_PREFIX}`, zoningProfileRoutes);

  // Development Scenarios routes (Use-mix scenario modeling)
  app.use(`${API_PREFIX}`, developmentScenariosRoutes);

  // Traffic Data routes (M07 Traffic Engine - ADT ingestion, station queries, property linking)
  app.use(`${API_PREFIX}/traffic-data`, trafficDataRoutes);

  // Traffic Comps routes (M07 Traffic Engine - comp traffic analysis per deal)
  app.use(`${API_PREFIX}/traffic-comps`, trafficCompsRoutes);

  // Traffic Prediction routes (foot traffic predictions, calibration, validation)
  app.use(`${API_PREFIX}/traffic`, trafficPredictionRoutes);

  // Correlation Engine routes (COR-01 through COR-20 market correlations)
  app.use(`${API_PREFIX}/correlations`, correlationRoutes);

  // Lead/Lag Discovery routes
  app.use(`${API_PREFIX}/lead-lag`, leadLagRoutes);

  // Backtesting Engine routes
  app.use(`${API_PREFIX}/backtest`, backtestRoutes);

  // Metrics Catalog routes (Strategy Engine - metric definitions and historical data)
  app.use(`${API_PREFIX}/metrics`, metricsCatalogRoutes);

  app.use(`${API_PREFIX}/market-metrics`, marketMetricsRoutes);

  // Custom Strategies routes (Strategy Engine - user-defined strategy management)
  app.use(`${API_PREFIX}/custom-strategies`, customStrategiesRoutes);

  // Strategy Definitions & Execution routes (Strategy Engine - new execution engine)
  app.use(`${API_PREFIX}/strategies`, strategiesRoutes);

  // M08 Signal-Weight Arbitrage Strategy Builder (new spec-compliant endpoint)
  app.use(`${API_PREFIX}/m08/strategies`, m08StrategiesRoutes);

  // Demand Intelligence routes (Full parsed demand signals + user preferences)
  app.use(`${API_PREFIX}/demand-intelligence`, demandIntelligenceRoutes);

  // Rankings routes (Property Competitive Scores, Performance Rankings, Pipeline Intelligence)
  app.use(`${API_PREFIX}/rankings`, rankingsRoutes);

  // Clawdbot Webhook routes (Receive commands and queries from Clawdbot)
  app.use(`${API_PREFIX}/clawdbot`, clawdbotWebhooksRoutes);

  // Building 3D Design routes (3D massing editor persistence)
  app.use(`${API_PREFIX}/deals`, buildingDesign3DRoutes);

  // AI Rendering routes (Massing → Photorealistic rendering via ControlNet)
  app.use(`${API_PREFIX}/ai`, aiRenderingRoutes);

  // Design Assistant routes (LLM-powered design modifications)
  app.use(`${API_PREFIX}/design-assistant`, designAssistantRoutes);

  // Unit Mix Intelligence routes (Unit type composition analysis + comp set discovery)
  const { getPool: getUnitMixPool } = require('../../database/connection');
  app.use(`${API_PREFIX}/unit-mix`, createUnitMixRoutes(getUnitMixPool()));

  // M28 Cycle Intelligence routes (Investment cycle timing analysis)
  app.use(`${API_PREFIX}/cycle-intelligence`, m28CycleIntelligenceRoutes);

  // Scraping routes (Cloudflare Browser Rendering — zoning code, property records, Municode)
  app.use(`${API_PREFIX}/scrape`, scrapeRoutes);

  // Data Ingestion routes (Admin-only — Zillow, FRED, other data sources)
  app.use(`${API_PREFIX}/admin/ingest`, ingestionRoutes);

  app.use(`${API_PREFIX}/time-series`, timeSeriesRoutes);

  app.use(`${API_PREFIX}/driver-analysis`, driverAnalysisRoutes);

  // Deal Capsule routes (3-layer capsule CRUD, documents, shares, collision)
  const { getPool: getCapsulePool } = require('../../database/connection');
  app.use(`${API_PREFIX}/capsules`, createCapsuleRoutes(getCapsulePool()));

  // Capital Structure Engine routes (M11 — capital stack, waterfall, rates, lifecycle)
  app.use(`${API_PREFIX}/capital-structure`, capitalStructureRoutes);

  // Building Envelope routes (M03 — envelope calc, HBU, AI recommendations)
  app.use(`${API_PREFIX}`, buildingEnvelopeRoutes);

  // Module Wiring routes (orchestration, pipelines, keystone cascade)
  app.use(`${API_PREFIX}/module-wiring`, moduleWiringRoutes);

  // Corporate Health routes (M33 — REIT earnings, sector rotation, alerts)
  app.use(`${API_PREFIX}/corporate-health`, corporateHealthRoutes);

  // Opportunity Engine routes (detect, rankings, market opportunities)
  app.use(`${API_PREFIX}/opportunity-engine`, opportunityEngineRoutes);

  // Benchmark Timeline routes (Monte Carlo simulation, entitlement benchmarks)
  app.use(`${API_PREFIX}/benchmark-timeline`, benchmarkTimelineRoutes);

  // Ticker feed — public macro data (FRED: 10Y Treasury, SOFR, CPI, Unemployment)
  // No auth required — mounts before the 404 handler so it is always reachable
  app.use(`${API_PREFIX}/ticker`, tickerRoutes);

  // Economic context — FRED macro + BLS MSA labor data
  app.use(`${API_PREFIX}/economic-context`, economicContextRoutes);

  // Inline Deals routes (Deal Capsule document upload, extraction, reprocessing)
  app.use(`${API_PREFIX}/inline-deals`, inlineDealsRoutes);

  // Deal Templates routes (F9 Settings — org-scoped template CRUD)
  app.use(`${API_PREFIX}/org/templates`, dealTemplatesRoutes);

  // Investor Capital routes (LP/GP investors, capital calls, distributions, waterfall)
  app.use(`${API_PREFIX}/capital`, investorCapitalRoutes);

  // Reporting Package routes (monthly package upload, variance data)
  app.use(`${API_PREFIX}/reporting-package`, reportingPackageRoutes);

  // Property Enrichment routes (county GIS + rent data)
  app.use(`${API_PREFIX}/property-enrichment`, propertyEnrichmentRoutes);

  // Property Discovery routes (auto-discovery, matching, data library enrichment)
  app.use(`${API_PREFIX}/property-discovery`, propertyDiscoveryRoutes);

  // Georgia Metro data ingestion routes
  app.use(`${API_PREFIX}/georgia`, georgiaIngestionRoutes);

  // Proximity, Events & Backtest routes
  const { getPool: getProxPool } = require('../../database/connection');
  setProximityPool(getProxPool());
  app.use(`${API_PREFIX}/proximity`, proximityRoutes);

  // Data Matrix routes (neural network layer)
  app.use(`${API_PREFIX}/data-matrix`, dataMatrixRoutes);

  // Inflation Engine routes
  app.use(`${API_PREFIX}/inflation`, inflationRoutes);

  // Knowledge Graph routes (neural network graph layer)
  const { getPool: getKGPool } = require('../../database/connection');
  app.use(`${API_PREFIX}/knowledge-graph`, createKnowledgeGraphRoutes(getKGPool()));

  // Context Awareness routes (analyst brain - thinks like a real estate person)
  const { getPool: getCAPool } = require('../../database/connection');
  app.use(`${API_PREFIX}/context`, createContextAwarenessRoutes(getCAPool()));

  // Column Catalog routes (F4 Markets data grid)
  app.use(`${API_PREFIX}/columns`, columnCatalogRoutes);

  // Planner-Executor routes (Claude plans, DeepSeek executes - 10x cheaper)
  app.use(`${API_PREFIX}/planner`, plannerRoutes);

  // Scheduled Refresh routes (cron job for knowledge graph staleness)
  app.use(`${API_PREFIX}/scheduled-refresh`, scheduledRefreshRoutes);

  // Deal Activity routes (emails, tasks, unified activity)
  app.use(`${API_PREFIX}/deals`, dealActivityRoutes);

  // Deal Traffic routes (forecast vs actuals)
  app.use(`${API_PREFIX}/deals`, dealTrafficRoutes);

  // 404 handler for API routes
  app.use(`${API_PREFIX}/*`, notFoundHandler);
}
