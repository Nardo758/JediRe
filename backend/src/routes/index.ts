/**
 * Route Mount Registry
 *
 * Centralizes all Express route mounting so index.replit.ts stays readable.
 * Each mount function is a self-contained domain cluster with its own imports.
 * Ordering comments are preserved — they matter for Express first-match routing.
 */

import { Express } from 'express';
import { requireAuth } from '../middleware/auth';

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
  app.use('/api/v1/admin/data-tracker', dataTrackerRoutes);
  app.use('/api/v1/admin/data-coverage', adminDataCoverageRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/admin', dotAdminRouter);
  app.use('/api/v1/admin/atlanta-url-discovery', atlantaUrlDiscoveryRouter);
  app.use('/api/v1/admin', enrichmentAdminRouter);
  app.use('/api/v1/admin-api', adminApiKeyRouter);
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

  // Core deal lifecycle
  app.use('/api/v1/deals', dealsRouter);
  app.use('/api/v1/tasks', tasksRouter);
  app.use('/api/v1/inbox', inboxRouter);

  // Agent runtime — deal-scoped
  app.use('/api/v1/agents', agentRunsRouter);
  app.use('/api/v1/deals', dealAgentRunsRouter);
  app.use('/api/v1/agents', cashflowUnderwritingRoutes);
  app.use('/api/v1/deals', dealUnderwritingRouter);

  // Roadmap Mode
  app.use('/api/v1/deals', requireAuth, roadmapRouter);

  // Deal market intelligence & context
  app.use('/api/v1/deals', dealMarketIntelligenceRoutes);
  app.use('/api/v1/deals', dealCompSetsRoutes);
  app.use('/api/v1/deals', requireAuth, dealPhotosRoutes);
  app.use('/api/v1/deals', requireAuth, dealContextRoutes);
  app.use('/api/v1/deals', requireAuth, financialModelRoutes);
  app.use('/api/v1/financial-models', requireAuth, financialModelRoutes);
  app.use('/api/v1/jedi', jediRoutes);

  // Phase 10: Cross-Module Validation
  app.use('/api/v1/deals', requireAuth, dealValidationRoutes);
  app.use('/api/v1/deals', requireAuth, fieldDivergencesRoutes);
  app.use('/api/v1/deals', requireAuth, dealCompletenessRoutes);
  app.use('/api/v1/deals', requireAuth, vendorFreshnessRoutes);

  // Phase 11: Unit Mix Propagation
  app.use('/api/v1/deals', requireAuth, unitMixPropagationRoutes);
  app.use('/api/v1/deals', requireAuth, competitionRouter);

  // Proforma & financial documents
  app.use('/api/v1/proforma', requireAuth, stabilizedPotentialRouter);
  app.use('/api/v1/proforma', requireAuth, proformaRouter);
  app.use('/api/v1/deals', dealAssumptionsRoutes);
  app.use('/api/v1/deals', financialDocumentsRoutes);
  app.use('/api/v1/deals', requireAuth, sourceDocumentsRoutes);

  // Deal-level share management (owner-only)
  app.use('/api/v1/deals', requireAuth, dealSharesRoutes);

  // Capsule Sharing: authenticated capsule-owner actions
  app.use('/api/v1/capsules-ext', requireAuth, capsuleSharingRoutes);

  // Scene storage for 3D scenes — must be BEFORE documentsFilesRoutes so
  // /:dealId/files/3d-scene wins match against /:dealId/files/:fileId
  app.use('/api/v1/deals', requireAuth, sceneStorageRouter);

  // Document file routes
  app.use('/api/v1', documentsFilesRoutes);
  app.use('/api/v1', submarketDocumentsRoutes);

  // DD checklists
  app.use('/api/v1/dd-checklists', requireAuth, ddChecklistsRouter);

  // Deal strategy
  app.use('/api/v1/deals', requireAuth, dealStrategyRouter);
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
