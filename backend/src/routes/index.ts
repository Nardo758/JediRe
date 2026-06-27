/**
 * Route Mount Registry
 *
 * Centralizes all Express route mounting so index.replit.ts stays readable.
 * Each mount function is a self-contained domain cluster with its own imports.
 * Ordering comments are preserved — they matter for Express first-match routing.
 */

import { Express } from 'express';
import { requireAuth, optionalAuth, requireRole, requireSurface } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimit';

// ─── Admin Routes ───────────────────────────────────────────────────────────
// Admin routes MUST be registered before generic /api/v1 routes

import dataTrackerRoutes from '../api/rest/data-tracker.routes';
import adminRouter from '../api/rest/admin.routes';
import dotAdminRouter from '../api/rest/dot-admin.routes';
import atlantaUrlDiscoveryRouter from '../api/rest/atlanta-url-discovery.routes';
import enrichmentAdminRouter from '../api/rest/enrichment-admin.routes';
import adminApiKeyRouter from '../api/rest/admin-api-key.routes';
import adminDataCoverageRouter from '../api/rest/admin-data-coverage.routes';

export function mountAdminRoutes(app: Express) {
  // A4-F6: Admin routes MUST be protected with auth + role check
  app.use('/api/v1/admin/data-tracker', requireAuth, requireRole('admin'), dataTrackerRoutes);
  app.use('/api/v1/admin/data-coverage', requireAuth, requireRole('admin'), adminDataCoverageRouter);
  app.use('/api/v1/admin', requireAuth, requireRole('admin'), adminRouter);
  app.use('/api/v1/admin', requireAuth, requireRole('admin'), dotAdminRouter);
  app.use('/api/v1/admin/atlanta-url-discovery', requireAuth, requireRole('admin'), atlantaUrlDiscoveryRouter);
  app.use('/api/v1/admin', requireAuth, requireRole('admin'), enrichmentAdminRouter);
  app.use('/api/v1/admin-api', requireAuth, requireRole('admin'), adminApiKeyRouter);
}

// ─── Zoning Routes ──────────────────────────────────────────────────────────

import propertyBoundaryRouter from '../api/rest/property-boundary.routes';
import siteIntelligenceRouter from '../api/rest/site-intelligence.routes';
import zoningCapacityRouter from '../api/rest/zoning-capacity.routes';
import { createZoningIntelligenceRoutes } from '../api/rest/zoning-intelligence.routes';
import { createZoningLearningRoutes } from '../api/rest/zoning-learning.routes';
import zoningVerificationRouter from '../api/rest/zoning-verification.routes';
import zoningProfileRouter from '../api/rest/zoning-profile.routes';
import developmentScenariosRouter from '../api/rest/development-scenarios.routes';

export function mountZoningRoutes(app: Express, pool: any) {
  app.use('/api/v1', requireAuth, propertyBoundaryRouter);
  app.use('/api/v1', requireAuth, siteIntelligenceRouter);
  app.use('/api/v1', requireAuth, zoningCapacityRouter);
  app.use('/api/v1/zoning-intelligence', requireAuth, createZoningIntelligenceRoutes(pool));
  app.use('/api/v1/zoning-learning', requireAuth, createZoningLearningRoutes(pool));
  app.use('/api/v1/zoning-verification', requireAuth, zoningVerificationRouter);
  app.use('/api/v1', requireAuth, zoningProfileRouter);
  app.use('/api/v1', requireAuth, developmentScenariosRouter);
}

// ─── M35 Routes ─────────────────────────────────────────────────────────────

import m35ConnectorsRouter from '../routes/m35-connectors.routes';
import m35PlaybooksRouter from '../routes/m35-playbooks.routes';
import m35ForecastsRouter from '../routes/m35-forecasts.routes';
import m35BacktestRouter from '../routes/m35-backtest.routes';
import m35EventsRouter from '../routes/m35-events.routes';

export function mountM35Routes(app: Express) {
  app.use('/api/v1/m35/connectors', requireAuth, m35ConnectorsRouter);
  app.use('/api/v1/m35', requireAuth, m35PlaybooksRouter);
  app.use('/api/v1/m35', requireAuth, m35ForecastsRouter);
  app.use('/api/v1/m35', requireAuth, m35BacktestRouter);
  app.use('/api/v1/m35', requireAuth, m35EventsRouter);
}

// ─── Deal & Document Routes ─────────────────────────────────────────────────
//
// This is the largest route cluster. Ordering matters for Express first-match:
//   1. Capsule sharing (early, unauthenticated) must precede dealsRouter
//   2. Scene storage must precede documentsFilesRoutes
//   3. Phase 10 validation precedes Phase 11 unit-mix propagation

import capsuleSharingRoutes from '../api/rest/capsule-sharing.routes';
import dealsRouter from '../api/rest/inline-deals.routes';
import tasksRouter from '../api/rest/tasks.routes';
import inboxRouter from '../api/rest/inline-inbox.routes';
import agentRunsRouter, { dealAgentRunsRouter } from '../api/rest/agent-runs.routes';
import cashflowUnderwritingRoutes, { dealUnderwritingRouter } from '../api/rest/cashflow-underwriting.routes';
import { roadmapRouter } from '../api/rest/roadmap.routes';
import dealMarketIntelligenceRoutes from '../api/rest/deal-market-intelligence.routes';
import dealCompSetsRoutes from '../api/rest/deal-comp-sets.routes';
import dealPhotosRoutes from '../api/rest/deal-photos.routes';
import dealContextRoutes from '../api/rest/deal-context.routes';
import financialModelRoutes from '../api/rest/financial-model.routes';
import dealValidationRoutes from '../api/rest/deal-validation.routes';
import fieldDivergencesRoutes from '../api/rest/field-divergences.routes';
import dealCompletenessRoutes from '../api/rest/deal-completeness.routes';
import vendorFreshnessRoutes from '../api/rest/vendor-freshness.routes';
import unitMixPropagationRoutes from '../api/rest/unit-mix-propagation.routes';
import competitionRouter from '../api/rest/competition.routes';
import stabilizedPotentialRouter from '../api/rest/stabilized-potential.routes';
import proformaRouter from '../api/rest/proforma.routes';
import dealAssumptionsRoutes from '../api/rest/deal-assumptions.routes';
import financialDocumentsRoutes from '../api/rest/financial-documents.routes';
import sourceDocumentsRoutes from '../api/rest/source-documents.routes';
import dealSharesRoutes from '../api/rest/deal-shares.routes';
import { sceneStorageRouter } from '../services/design/scene-storage.service';
import documentsFilesRoutes from '../api/rest/documentsFiles.routes';
import submarketDocumentsRoutes from '../api/rest/submarketDocuments.routes';
import ddChecklistsRouter from '../api/rest/dd-checklists.routes';
import dealStrategyRouter from '../api/rest/deal-strategy.routes';
import jediRoutes from '../api/rest/jedi.routes';

export function mountDealRoutes(app: Express) {
  // Capsule sharing routes mounted here (second, early mount) so that the
  // unauthenticated GET /api/v1/deals/:dealId/deal-book endpoint is reachable
  // before the authenticated dealsRouter at the next line intercepts the request.
  app.use('/api/v1', capsuleSharingRoutes);

  // A5-F2: Surface access enforcement — web routes require 'web' surface.
  // Scout tier (chat-only) cannot access web deal management endpoints.
  const requireWeb = requireSurface('web');

  // Core deal lifecycle
  app.use('/api/v1/deals', requireWeb, dealsRouter);
  app.use('/api/v1/tasks', requireWeb, tasksRouter);
  app.use('/api/v1/inbox', requireWeb, inboxRouter);

  // Agent runtime — deal-scoped (shared surface; individual routes gate themselves)
  app.use('/api/v1/agents', agentRunsRouter);
  app.use('/api/v1/deals', dealAgentRunsRouter);
  app.use('/api/v1/agents', cashflowUnderwritingRoutes);
  app.use('/api/v1/deals', dealUnderwritingRouter);

  // Roadmap Mode
  app.use('/api/v1/deals', requireAuth, requireWeb, roadmapRouter);

  // Deal market intelligence & context
  app.use('/api/v1/deals', requireWeb, dealMarketIntelligenceRoutes);
  app.use('/api/v1/deals', requireWeb, dealCompSetsRoutes);
  app.use('/api/v1/deals', requireAuth, requireWeb, dealPhotosRoutes);
  app.use('/api/v1/deals', requireAuth, requireWeb, dealContextRoutes);
  app.use('/api/v1/deals', requireAuth, requireWeb, financialModelRoutes);
  app.use('/api/v1/financial-models', requireAuth, requireWeb, financialModelRoutes);
  app.use('/api/v1/jedi', requireWeb, jediRoutes);

  // Phase 10: Cross-Module Validation
  app.use('/api/v1/deals', requireAuth, requireWeb, dealValidationRoutes);
  app.use('/api/v1/deals', requireAuth, requireWeb, fieldDivergencesRoutes);
  app.use('/api/v1/deals', requireAuth, requireWeb, dealCompletenessRoutes);
  app.use('/api/v1/deals', requireAuth, requireWeb, vendorFreshnessRoutes);

  // Phase 11: Unit Mix Propagation
  app.use('/api/v1/deals', requireAuth, requireWeb, unitMixPropagationRoutes);
  app.use('/api/v1/deals', requireAuth, requireWeb, competitionRouter);

  // Proforma & financial documents
  app.use('/api/v1/proforma', requireAuth, requireWeb, stabilizedPotentialRouter);
  app.use('/api/v1/proforma', requireAuth, requireWeb, proformaRouter);
  app.use('/api/v1/deals', requireWeb, dealAssumptionsRoutes);
  app.use('/api/v1/deals', requireWeb, financialDocumentsRoutes);
  app.use('/api/v1/deals', requireAuth, requireWeb, sourceDocumentsRoutes);

  // Deal-level share management (owner-only)
  app.use('/api/v1/deals', requireAuth, requireWeb, dealSharesRoutes);

  // Capsule Sharing: authenticated capsule-owner actions
  app.use('/api/v1/capsules-ext', requireAuth, requireWeb, capsuleSharingRoutes);

  // Scene storage for 3D scenes — must be BEFORE documentsFilesRoutes so
  // /:dealId/files/3d-scene wins match against /:dealId/files/:fileId
  app.use('/api/v1/deals', requireAuth, requireWeb, sceneStorageRouter);

  // Document file routes
  app.use('/api/v1', requireWeb, documentsFilesRoutes);
  app.use('/api/v1', requireWeb, submarketDocumentsRoutes);

  // DD checklists
  app.use('/api/v1/dd-checklists', requireAuth, requireWeb, ddChecklistsRouter);

  // Deal strategy
  app.use('/api/v1/deals', requireAuth, requireWeb, dealStrategyRouter);
}

// ─── Property & Data Library Routes ─────────────────────────────────────────
//
// Consolidates property CRUD, types, metrics, discovery, archive, data library,
// uploads, and comp query. Ordering matters for Express first-match on
// /api/v1/properties (unified before CRUD so /unified isn't shadowed by /:id).

import propertyTypesRouter from '../api/rest/property-types.routes';
import propertyTypeStrategiesRouter from '../api/rest/property-type-strategies.routes';
import propertyProxyRoutes from '../api/rest/property-proxy.routes';
import propertyRoutes from '../api/rest/property.routes';
import { createPropertyMetricsRouter } from '../api/rest/property-metrics.routes';
import { createPropertyScoringRouter } from '../api/rest/property-scoring.routes';
import propertyAnalyticsRouter from '../api/rest/property-analytics.routes';
import { createEventsRoutes } from '../api/rest/events.routes';
import propertyDiscoveryRouter from '../api/rest/property-discovery.routes';
import { createArchivePropertiesRouter } from '../api/rest/archive-properties.routes';
import createUnifiedPropertiesRoutes from '../api/rest/unified-properties.routes';
import buildingEnvelopeRoutes from '../api/rest/building-envelope.routes';
import moduleLibrariesRouter from '../api/rest/module-libraries.routes';
import { createDataLibraryRoutes } from '../api/rest/data-library.routes';
import { createDataLibraryAssetsRoutes } from '../api/rest/data-library-assets.routes';
import { createDataLibraryFilesRoutes } from '../api/rest/data-library-files.routes';
import { createIntakeJobsRoutes } from '../api/rest/intake-jobs.routes';
import dataMatrixRoutes from '../api/rest/data-matrix.routes';
import dataUploadRouter from '../api/rest/data-upload.routes';
import pstUploadRouter from '../api/rest/pst-upload.routes';
import uploadTemplatesRouter from '../api/rest/upload-templates.routes';
import uploadRouter from '../api/rest/upload.routes';
import compQueryRouter from '../api/rest/comp-query.routes';
import proformaGeneratorRouter from '../api/rest/proforma-generator.routes';

export function mountPropertyRoutes(app: Express, pool: any) {
  // Unified properties (mounted BEFORE CRUD so /unified isn't shadowed by /:id)
  app.use('/api/v1/properties', createUnifiedPropertiesRoutes(pool));

  // Property CRUD
  app.use('/api/v1/properties', propertyRoutes);

  // Property types & strategies
  app.use('/api/v1/property-types', requireAuth, propertyTypesRouter);
  app.use('/api/v1/property-type-strategies', requireAuth, propertyTypeStrategiesRouter);
  app.use('/api/v1/property-metrics', requireAuth, createPropertyMetricsRouter(pool));
  app.use('/api/v1/property-scoring', requireAuth, createPropertyScoringRouter(pool));
  app.use('/api/v1/property-analytics', requireAuth, propertyAnalyticsRouter);
  app.use('/api/v1/events', requireAuth, createEventsRoutes(pool));
  app.use('/api/events', requireAuth, createEventsRoutes(pool));
  app.use('/api/v1/property-discovery', propertyDiscoveryRouter);

  // Archive & building envelope
  app.use('/api/v1/properties', requireAuth, createArchivePropertiesRouter(pool));
  app.use('/api/v1', requireAuth, buildingEnvelopeRoutes);

  // Data Library
  app.use('/api/v1/module-libraries', requireAuth, moduleLibrariesRouter);
  app.use('/api/v1/data-library', requireAuth, createDataLibraryRoutes(pool));
  app.use('/api/v1/data-library-assets', requireAuth, createDataLibraryAssetsRoutes(pool));
  app.use('/api/v1/data-library-files', requireAuth, createDataLibraryFilesRoutes(pool));
  app.use('/api/v1/intake-jobs', requireAuth, createIntakeJobsRoutes(pool));
  app.use('/api/v1/data-matrix', dataMatrixRoutes);

  // Uploads & ingestion
  app.use('/api/v1/properties', requireAuth, dataUploadRouter);
  app.use('/api/v1/data-upload/pst', requireAuth, pstUploadRouter);
  app.use('/api/v1/upload-templates', requireAuth, uploadTemplatesRouter);
  app.use('/api/v1/uploads', requireAuth, uploadRouter);
  app.use('/api/v1/comps', requireAuth, compQueryRouter);

  // Proforma generator (property-scoped)
  app.use('/api/v1/properties', requireAuth, proformaGeneratorRouter);

  // Property proxy (must be after specific property sub-routes)
  app.use('/api/v1', requireAuth, propertyProxyRoutes);
}

// ─── Grid & Portfolio Routes ────────────────────────────────────────────────
//
// Market intelligence, grid, rankings, and portfolio routes.
// Mounted after property routes so /properties isn't shadowed.

import gridRouter from '../api/rest/grid.routes';
import rankingsRouter from '../api/rest/rankings.routes';
import portfolioRouter from '../api/rest/portfolio.routes';
import marketIntelligenceRouter from '../api/rest/market-intelligence.routes';
import { createEnhancedMarketIntelligenceRoutes } from '../api/rest/market-intelligence-enhanced.routes';

export function mountGridPortfolioRoutes(app: Express, pool: any) {
  app.use('/api/v1/markets', optionalAuth, marketIntelligenceRouter(pool));
  app.use('/api/v1/markets', optionalAuth, createEnhancedMarketIntelligenceRoutes(pool));
  app.use('/api/v1/grid', optionalAuth, gridRouter);
  app.use('/api/v1/rankings', optionalAuth, rankingsRouter);
  app.use('/api/v1/portfolio', portfolioRouter);
}

// ─── Email & Communication Routes ───────────────────────────────────────────
//
// Gmail, email extractions, contacts sync, team management, collaboration,
// and notarize routes. Mounted after deal routes but before financial routes.

import gmailRouter from '../api/rest/gmail.routes';
import emailRouter from '../api/rest/email.routes';
import emailExtractionsRouter from '../api/rest/email-extractions.routes';
import teamManagementRouter from '../api/rest/team-management.routes';
import collaborationRouter from '../api/rest/collaboration.routes';
import contactsSyncRouter from '../api/rest/contacts-sync.routes';
import notarizeRouter from '../api/rest/notarize.routes';
import contextTrackerRouter from '../api/rest/context-tracker.routes';

export function mountEmailRoutes(app: Express) {
  app.use('/api/v1/gmail', requireAuth, gmailRouter);
  app.use('/api/v1/emails', emailRouter);
  app.use('/api/v1/email-extractions', emailExtractionsRouter);
  app.use('/api/v1', requireAuth, teamManagementRouter);
  app.use('/api/v1', requireAuth, collaborationRouter);
  app.use('/api/v1', requireAuth, contactsSyncRouter);
  app.use('/api/v1', notarizeRouter);
  app.use('/api/v1/context', requireAuth, contextTrackerRouter);
}

// ─── Financial & Strategy Routes ────────────────────────────────────────────
//
// Consolidates financial models, strategy analysis, market research, supply,
// demand, traffic, preferences, settings, metrics, and financial operations.

import modulesRouter from '../api/rest/modules.routes';
import marketRouter from '../api/rest/market.routes';
import underwritingScenariosRouter from '../api/rest/underwriting-scenarios.routes';
import deterministicModelRouter from '../api/rest/deterministic-model.routes';
import financialModelsRouter from '../api/rest/financial-models.routes';
import strategyAnalysesRouter from '../api/rest/strategy-analyses.routes';
import marketResearchRoutes from '../api/rest/marketResearch.routes';
import supplyRoutes, { supplyExtraRouter } from '../api/rest/supply.routes';
import demandRoutes from '../api/rest/demand.routes';
import trafficPredictionRoutes from '../api/rest/trafficPrediction.routes';
import leasingTrafficRoutes from '../api/rest/leasing-traffic.routes';
import preferencesRouter from '../api/rest/preferences.routes';
import settingsAiRouter from '../api/rest/settings-ai.routes';
import settingsBrandingRouter from '../api/rest/settings-branding.routes';
import customStrategiesRouter from '../api/rest/custom-strategies.routes';
import strategiesRouter from '../api/rest/strategies.routes';
import strategyDefinitionsRouter from '../api/rest/strategy-definitions.routes';
import metricsCatalogRouter from '../api/rest/metrics-catalog.routes';
import marketMetricsRouter from '../api/rest/market-metrics.routes';
import { createOpusRoutes } from '../api/rest/opus.routes';
import { createReplacementCostRoutes } from '../api/rest/replacement-cost.routes';
import { createBrokerNarrativesRoutes } from '../api/rest/broker-narratives.routes';
import { createIntelligenceRefreshRoutes } from '../api/rest/intelligence-refresh.routes';
import moduleWiringRouter from '../api/rest/module-wiring.routes';
import taskCompletionRouter from '../api/rest/task-completion.routes';
import capitalStructureRouter from '../api/rest/capital-structure.routes';
import debtAdvisorRouter from '../api/rest/debt-advisor.routes';
import benchmarkTimelineRouter from '../api/rest/benchmark-timeline.routes';
import entitlementRouter from '../api/rest/entitlement.routes';
import regulatoryAlertRouter from '../api/rest/regulatory-alert.routes';
import scenariosRouter from '../api/rest/scenarios.routes';
import riskRouter from '../api/rest/risk.routes';
import kafkaEventsRouter from '../api/rest/kafka-events.routes';
import municodeRouter from '../api/rest/municode.routes';
import scrapeRouter from '../api/rest/scrape.routes';
import designReferencesRouter from '../api/rest/design-references.routes';
import financialModelRouter from '../api/rest/financial-model.routes';
import financialDashboardRouter from '../api/rest/financial-dashboard.routes';
import visibilityRouter from '../api/rest/visibility.routes';
import trafficDataRouter from '../api/rest/traffic-data.routes';
import trafficCompsRouter from '../api/rest/traffic-comps.routes';
import m07CalibrationRouter from '../api/rest/m07-calibration.routes';
import macroIndicatorsRouter from '../api/rest/macro-indicators.routes';
import { sentimentRouter } from '../api/rest/sentiment.routes';

export function mountFinancialRoutes(app: Express, pool: any) {
  // Strategy & Research
  app.use('/api/v1/modules', requireAuth, modulesRouter);
  app.use('/api/v1/financial-models', requireAuth, financialModelsRouter);
  app.use('/api/v1/strategy-analyses', requireAuth, strategyAnalysesRouter);
  app.use('/api/v1/market-research', requireAuth, marketResearchRoutes);
  app.use('/api/v1/market', requireAuth, marketRouter);
  app.use('/api/v1', requireAuth, supplyRoutes);
  app.use('/api/v1/supply', requireAuth, supplyExtraRouter);
  app.use('/api/v1/sentiment', requireAuth, sentimentRouter);
  app.use('/api/v1', requireAuth, demandRoutes);
  app.use('/api/v1/traffic', requireAuth, trafficPredictionRoutes);
  app.use('/api/v1/leasing-traffic', requireAuth, leasingTrafficRoutes);
  app.use('/api/v1/preferences', requireAuth, preferencesRouter);
  app.use('/api/v1/settings/ai-preferences', settingsAiRouter);
  app.use('/api/v1/settings/branding', settingsBrandingRouter);
  app.use('/api/v1/custom-strategies', requireAuth, customStrategiesRouter);
  app.use('/api/v1/strategies', requireAuth, strategiesRouter);
  app.use('/api/v1/strategy-definitions', requireAuth, strategyDefinitionsRouter);
  app.use('/api/v1/metrics', requireAuth, metricsCatalogRouter);
  app.use('/api/v1/market-metrics', requireAuth, marketMetricsRouter);
  app.use('/api/v1/opus', requireAuth, createOpusRoutes(pool));
  app.use('/api/v1/replacement-cost', createReplacementCostRoutes(pool));
  app.use('/api/v1/broker-narratives', createBrokerNarrativesRoutes(pool));
  app.use('/api/v1/intelligence', createIntelligenceRefreshRoutes());

  // Financial Operations
  app.use('/api/v1/module-wiring', requireAuth, moduleWiringRouter);
  app.use('/api/v1/task-completion', requireAuth, taskCompletionRouter);
  app.use('/api/v1/capital-structure', requireAuth, capitalStructureRouter);
  app.use('/api/v1/deals', debtAdvisorRouter);
  app.use('/api/v1/benchmark-timeline', requireAuth, benchmarkTimelineRouter);
  app.use('/api/v1/entitlements', requireAuth, entitlementRouter);
  app.use('/api/v1/regulatory-alerts', requireAuth, regulatoryAlertRouter);
  app.use('/api/v1/scenarios', requireAuth, scenariosRouter);
  app.use('/api/v1/deals', requireAuth, underwritingScenariosRouter);
  app.use('/api/v1/risk', requireAuth, riskRouter);
  app.use('/api/v1/events', requireAuth, kafkaEventsRouter);
  app.use('/api/v1/municode', requireAuth, municodeRouter);
  app.use('/api/v1/scrape', requireAuth, scrapeRouter);
  app.use('/api/v1/design-references', requireAuth, designReferencesRouter);
  app.use('/api/v1/financial-model', requireAuth, financialModelRouter);
  app.use('/api/v1/deterministic', deterministicModelRouter);
  app.use('/api/v1/financial-dashboard', requireAuth, financialDashboardRouter);
  app.use('/api/v1/visibility', requireAuth, visibilityRouter);
  app.use('/api/v1/traffic-data', requireAuth, trafficDataRouter);
  app.use('/api/v1/traffic-comps', requireAuth, trafficCompsRouter);
  app.use('/api/v1/calibration', requireAuth, m07CalibrationRouter);
  app.use('/api/v1/macro', requireAuth, macroIndicatorsRouter);
}

// ─── Knowledge Graph & Context Routes ───────────────────────────────────────
//
// Knowledge graph ingestion, context awareness, and scheduled refresh routes.

import { createKnowledgeGraphRoutes } from '../api/rest/knowledge-graph.routes';
import { createKGDealIngestionRoutes } from '../services/knowledge-graph/kg-deal-ingestion.routes';
import { createKGDealContextRoutes } from '../services/knowledge-graph/kg-deal-context.routes';
import { createContextAwarenessRoutes } from '../api/rest/context-awareness.routes';
import scheduledRefreshRoutes from '../api/rest/scheduled-refresh.routes';

export function mountKnowledgeGraphRoutes(app: Express, pool: any) {
  app.use('/api/v1/knowledge-graph', createKnowledgeGraphRoutes(pool));
  app.use('/api/v1/knowledge-graph', createKGDealIngestionRoutes(pool));
  app.use('/api/v1/knowledge-graph/context', requireAuth, createKGDealContextRoutes(pool));
  app.use('/api/v1/context', requireAuth, createContextAwarenessRoutes(pool));
  app.use('/api/v1/scheduled-refresh', scheduledRefreshRoutes);
}

// ─── Operations & Utility Routes ──────────────────────────────────────────────
//
// Cloud storage, bulk upload, apartment locator, Georgia ingestion, learning,
// operations, lifecycle, revenue, investor capital, organization, design,
// sigma, lease velocity, historical observations, vendor registry, and unit mix.

import cloudStorageRouter from '../api/rest/cloud-storage.routes';
import bulkUploadRouter from '../api/rest/bulk-upload.routes';
import apartmentLocatorRouter from '../api/rest/apartment-locator.routes';
import georgiaIngestionRouter from '../api/rest/georgia-ingestion.routes';
import learningRouter from '../api/rest/learning.routes';
import operationsRouter from '../api/rest/operations.routes';
import lifecycleRouter from '../api/rest/lifecycle.routes';
import customMetricsRouter from '../api/rest/custom-metrics.routes';
import revenueRouter from '../api/rest/revenue.routes';
import investorCapitalRoutes from '../api/rest/investor-capital.routes';
import organizationRouter from '../api/rest/organization.routes';
import sigmaRouter from '../api/rest/sigma.routes';
import sigmaFullRouter from '../api/rest/sigma-full.routes';
import { designMassingRouter } from '../services/design/design-massing.service';
import leaseVelocityRouter from '../api/rest/lease-velocity.routes';
import historicalObservationsRoutes from '../api/rest/historical-observations.routes';
import vendorRegistryRoutes from '../api/rest/vendor-registry.routes';
import analogRouter from '../api/rest/analog.routes';
import { createUnitMixRoutes } from '../api/rest/unitMix.routes';

export function mountOperationsRoutes(app: Express, pool: any) {
  app.use('/api/v1/cloud-storage', cloudStorageRouter);
  app.use('/api/v1/bulk-upload', bulkUploadRouter);
  app.use('/api/v1/apartment-locator', apartmentLocatorRouter);
  app.use('/api/v1/georgia', georgiaIngestionRouter);
  app.use('/api/v1/learning', learningRouter);
  app.use('/api/v1/operations', operationsRouter);
  app.use('/api/v1/lifecycle', lifecycleRouter);
  app.use('/api/v1/custom-metrics', customMetricsRouter);
  app.use('/api/v1/revenue', revenueRouter);
  app.use('/api/v1/capital', requireAuth, investorCapitalRoutes);
  app.use('/api/v1/organization', organizationRouter);
  app.use('/api/v1/design', requireAuth, designMassingRouter);
  app.use('/api/v1/sigma', requireAuth, sigmaRouter);
  app.use('/api/v2/sigma', requireAuth, sigmaFullRouter);
  app.use('/api/v1/analogs', analogRouter);
  app.use('/api/v1/lease-velocity', leaseVelocityRouter);
  app.use('/api/v1/historical-observations', requireAuth, historicalObservationsRoutes);
  app.use('/api/v1/vendor-registry', requireAuth, vendorRegistryRoutes);
  app.use('/api/v1/unit-mix', requireAuth, createUnitMixRoutes(pool));
}

// ─── Analytics & Dashboard Routes ────────────────────────────────────────────
//
// Dashboard, news, intelligence, trade areas, geographic context, and
// corporate health routes.

import dashboardRouter from '../api/rest/dashboard.routes';
import newsRouter from '../api/rest/news.routes';
import intelligenceRouter from '../api/rest/intelligence.routes';
import tradeAreasRoutes from '../api/rest/trade-areas.routes';
import isochroneRoutes from '../api/rest/isochrone.routes';
import trafficAiRoutes from '../api/rest/traffic-ai.routes';
import geographicContextRoutes from '../api/rest/geographic-context.routes';
import corporateHealthRouter from '../api/rest/corporate-health.routes';
import orgRouter from '../api/rest/org.routes';

export function mountAnalyticsRoutes(app: Express) {
  app.use('/api/v1/dashboard', requireAuth, dashboardRouter);
  app.use('/api/v1/news', requireAuth, newsRouter);
  app.use('/api/v1/intelligence', requireAuth, intelligenceRouter);
  app.use('/api/v1/trade-areas', requireAuth, tradeAreasRoutes);
  app.use('/api/v1/isochrone', requireAuth, isochroneRoutes);
  app.use('/api/v1/traffic-ai', requireAuth, trafficAiRoutes);
  app.use('/api/v1', requireAuth, geographicContextRoutes);
  app.use('/api/v1/deals', requireAuth, geographicContextRoutes);
  app.use('/api/v1/corporate-health', requireAuth, corporateHealthRouter);
  app.use('/api/v1/orgs', requireAuth, orgRouter);
}

// ─── Misc & Extensions Routes ────────────────────────────────────────────────
//
// Remaining utility, tool, and extension routes that don't fit into the main
// domain clusters. Includes deal extensions, training, chat, and misc tools.

import chatRouter from '../api/rest/chat.routes';
import correlationRouter from '../api/rest/correlation.routes';
import workspaceRouter from '../api/rest/workspace.routes';
import leadLagRoutes from '../api/rest/lead-lag.routes';
import newsConnectionsRoutes from '../api/rest/news-connections.routes';
import archiveRouter from '../api/rest/archive.routes';
import calibrationRouter from '../api/rest/calibration.routes';
import causalDisciplineRouter from '../api/rest/causal-discipline.routes';
import peerIntelligenceRouter from '../api/rest/peer-intelligence.routes';
import { createCapsuleRoutes } from '../api/rest/capsule.routes';
import { createDealCapsuleBridge } from '../api/rest/capsule-bridge.routes';
import { createRenovationRoutes } from '../api/rest/renovation.routes';
import { createCoStarUploadRoutes } from '../api/rest/costar-upload.routes';
import verasetRouter from '../api/rest/veraset.routes';
import exitTrajectoryRouter from '../api/rest/exit-trajectory.routes';
import forwardSupplyRouter from '../api/rest/forward-supply.routes';

export function mountMiscRoutes(app: Express, pool: any) {
  // Chat & communication
  app.use('/api/v1/chat', aiLimiter, chatRouter);
  app.use('/api/v1/correlations', correlationRouter);
  app.use('/api/v1/workspaces', workspaceRouter);
  app.use('/api/v1/lead-lag', leadLagRoutes);
  app.use('/api/v1/news-connections', newsConnectionsRoutes);
  app.use('/api/v1/archive', archiveRouter);

  // Training & peer intelligence
  app.use('/api/v1/calibration-ledger', requireAuth, calibrationRouter);
  app.use('/api/v1/causal', requireAuth, causalDisciplineRouter);
  app.use('/api/v1/peers', requireAuth, peerIntelligenceRouter);

  // Capsules & deal extensions
  app.use('/api/v1/capsules', requireAuth, createCapsuleRoutes(pool));
  app.use('/api/v1/deals/:dealId/costar', createCoStarUploadRoutes(pool));
  app.use('/api/v1/deals/:dealId/capsule', requireAuth, createDealCapsuleBridge(pool));
  app.use('/api/v1/deals/:dealId/renovation', requireAuth, createRenovationRoutes(pool));
  app.use('/api/v1/deals', requireAuth, exitTrajectoryRouter);
  app.use('/api/v1/deals', requireAuth, forwardSupplyRouter);
  app.use('/api/v1/veraset', verasetRouter);
}
