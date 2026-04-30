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
import financialModelRoutes from './financial-model.routes';
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
import createAgentStatusRoutes from './agent-status.routes';
import columnCatalogRoutes from './column-catalog.routes';
import plannerRoutes from './planner.routes';
import scheduledRefreshRoutes from './scheduled-refresh.routes';
import brokerNarrativesRoutes from './broker-narratives.routes';
import intelligenceRefreshRoutes from './intelligence-refresh.routes';
import replacementCostRoutes from './replacement-cost.routes';
import sentimentRoutes from './sentiment.routes';
import capsuleIntelligenceRoutes from './capsule-intelligence.routes';
import { designMassingRouter } from '../../services/design/design-massing.service';
import { sceneStorageRouter } from '../../services/design/scene-storage.service';

const API_PREFIX = '/api/v1';

/*
 * setupRESTRoutes — DEAD CODE (never called from any entry point)
 *
 * This entire block was originally ~410 lines of route registrations that
 * duplicated what index.replit.ts already does inline. It was never invoked.
 *
 * Kept as a 3-line shim for any external module that imports it.
 * See backend/src/index.replit.ts for actual route mounts.
 */
export function setupRESTRoutes(_app: Application): void {
  void _app;
}