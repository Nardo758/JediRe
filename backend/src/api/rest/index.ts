/**
 * REST API Routes Setup
 * Organize all REST endpoints
 */

import { Application } from 'express';
import authRoutes from './auth.routes';
import propertyRoutes from './property.routes';
import zoningRoutes from './zoning.routes';
import marketRoutes from './market.routes';
import agentRoutes from './agent.routes';
import llmRoutes from './llm.routes';
import microsoftRoutes from './microsoft.routes';
import preferencesRoutes from './preferences.routes';
import extractionsRoutes from './extractions.routes';
import emailExtractionsRoutes from './email-extractions.routes';
import mapsRoutes from './maps.routes';
import proposalsRoutes from './proposals.routes';
import notificationsRoutes from './notifications.routes';
import pipelineRoutes from './pipeline';
import analysisRoutes from './analysis.routes';
import tasksRoutes from './tasks.routes';
import taskCompletionRoutes from './task-completion.routes';
import emailRoutes from './email.routes';
import inboxRoutes from './inbox.routes';
import gmailRoutes from './gmail.routes';
import newsRoutes from './news.routes';
import tradeAreasRoutes from './trade-areas.routes';
import geographicContextRoutes from './geographic-context.routes';
import geographyRoutes from './geography.routes';
import isochroneRoutes from './isochrone.routes';
import trafficAiRoutes from './traffic-ai.routes';
import layersRoutes from './layers.routes';
import mapConfigsRoutes from './map-configs.routes';
import gridRoutes from './grid.routes';
import modulesRoutes from './modules.routes';
import financialModelsRoutes from './financial-models.routes';
import strategyAnalysesRoutes from './strategy-analyses.routes';
import ddChecklistsRoutes from './dd-checklists.routes';
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
import filesRoutes from './files.routes';
import documentsFilesRoutes from './documentsFiles.routes';
import assetMapIntelligenceRoutes, { noteCategoriesRoutes } from './asset-map-intelligence.routes';
import mapAnnotationsRoutes from './mapAnnotations.routes';
import { notFoundHandler } from '../../middleware/errorHandler';

const API_PREFIX = '/api/v1';

export function setupRESTRoutes(app: Application): void {
  // Authentication routes
  app.use(`${API_PREFIX}/auth`, authRoutes);

  // Dashboard routes
  app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);

  // User preferences routes
  app.use(`${API_PREFIX}/preferences`, preferencesRoutes);

  // Property extraction routes
  app.use(`${API_PREFIX}/extractions`, extractionsRoutes);

  // Email extraction routes (Property + News from emails)
  app.use(`${API_PREFIX}/email-extractions`, emailExtractionsRoutes);

  // Maps & pins routes
  app.use(`${API_PREFIX}/maps`, mapsRoutes);

  // Collaboration proposals routes
  app.use(`${API_PREFIX}/proposals`, proposalsRoutes);

  // Notifications routes
  app.use(`${API_PREFIX}/notifications`, notificationsRoutes);

  // Property routes
  app.use(`${API_PREFIX}/properties`, propertyRoutes);

  // Zoning routes
  app.use(`${API_PREFIX}/zoning`, zoningRoutes);

  // Market data routes
  app.use(`${API_PREFIX}/market`, marketRoutes);

  // Agent routes (orchestration)
  app.use(`${API_PREFIX}/agents`, agentRoutes);

  // LLM routes (AI-powered features)
  app.use(`${API_PREFIX}/llm`, llmRoutes);

  // Microsoft integration (Outlook, Calendar)
  app.use(`${API_PREFIX}/microsoft`, microsoftRoutes);

  // Data pipeline routes (Python integration)
  app.use(`${API_PREFIX}/pipeline`, pipelineRoutes);

  // Market analysis routes (JEDI RE Phase 1 engines)
  app.use(`${API_PREFIX}/analysis`, analysisRoutes);

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

  // Trade Areas routes (Geographic Definition System)
  app.use(`${API_PREFIX}/trade-areas`, tradeAreasRoutes);

  // Geographic Context routes (Deal → Trade Area/Submarket/MSA linking)
  app.use(`${API_PREFIX}/deals`, geographicContextRoutes);
  app.use(`${API_PREFIX}`, geographicContextRoutes); // For /submarkets/lookup, /msas/lookup

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

  // Financial Models routes (Module-enhanced feature)
  app.use(`${API_PREFIX}/financial-models`, financialModelsRoutes);

  // Strategy Analyses routes (Module-enhanced feature)
  app.use(`${API_PREFIX}/strategy-analyses`, strategyAnalysesRoutes);

  // Due Diligence Checklists routes (Module-enhanced feature)
  app.use(`${API_PREFIX}/dd-checklists`, ddChecklistsRoutes);

  // File Management routes (Asset Map Intelligence - Note Attachments)
  app.use(`${API_PREFIX}`, filesRoutes);

  // Unified Documents & Files routes (Deal-level file management)
  app.use(`${API_PREFIX}`, documentsFilesRoutes);

  // Asset Map Intelligence routes (Notes, Replies, News Links, Real-time Sync)
  app.use(`${API_PREFIX}/assets`, assetMapIntelligenceRoutes);
  app.use(`${API_PREFIX}/note-categories`, noteCategoriesRoutes);

  // Map Annotations routes (Drawing tools for Pipeline & Assets maps)
  app.use(`${API_PREFIX}/map-annotations`, mapAnnotationsRoutes);

  // 404 handler for API routes
  app.use(`${API_PREFIX}/*`, notFoundHandler);
}
