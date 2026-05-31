/**
 * JediRe Backend - Replit Entry Point
 * Route handlers extracted to dedicated router modules
 */
import cron from 'node-cron';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { requireAuth, optionalAuth } from './middleware/auth';
import { getPool } from './database/connection';
import { logger } from './utils/logger';
import { emailSyncScheduler } from './services/email-sync-scheduler';
import { agentAlertService } from './services/agent-alert.service';
import { taskCoordinatorService } from './services/task-coordinator.service';
import { createTrainingRoutes } from './api/rest/training.routes';
import analogRouter from './api/rest/analog.routes';
import calibrationRouter from './api/rest/calibration.routes';
import causalDisciplineRouter from './api/rest/causal-discipline.routes';
import peerIntelligenceRouter from './api/rest/peer-intelligence.routes';
import { createCapsuleRoutes } from './api/rest/capsule.routes';
import { createDealCapsuleBridge } from './api/rest/capsule-bridge.routes';
import { createRenovationRoutes } from './api/rest/renovation.routes';
import zoningTriangulationRouter from './api/rest/zoning-triangulation.routes';
import preferencesRouter from './api/rest/preferences.routes';
import propertyTypesRouter from './api/rest/property-types.routes';
import propertyTypeStrategiesRouter from './api/rest/property-type-strategies.routes';
import customStrategiesRouter from './api/rest/custom-strategies.routes';
import strategiesRouter from './api/rest/strategies.routes';
import strategyDefinitionsRouter from './api/rest/strategy-definitions.routes';
import dealStrategyRouter from './api/rest/deal-strategy.routes';
import metricsCatalogRouter from './api/rest/metrics-catalog.routes';
import marketMetricsRouter from './api/rest/market-metrics.routes';
import f40PerformanceRoutes from './api/rest/f40-performance.routes';
import opportunityEngineRoutes from './api/rest/opportunity-engine.routes';
import settingsAiRouter from './api/rest/settings-ai.routes';
import settingsBrandingRouter from './api/rest/settings-branding.routes';
import billingRouter from './api/rest/billing.routes';

import healthRouter from './api/rest/inline-health.routes';
import authRouter from './api/rest/inline-auth.routes';
import dataRouter from './api/rest/inline-data.routes';
import dealsRouter from './api/rest/inline-deals.routes';
import tasksRouter from './api/rest/tasks.routes';
import inboxRouter from './api/rest/inline-inbox.routes';
import zoningAnalyzeRouter from './api/rest/inline-zoning-analyze.routes';
import { createMicrosoftInlineRoutes } from './api/rest/inline-microsoft.routes';
import microsoftRouter from './api/rest/microsoft.routes';

import newsRouter from './api/rest/news.routes';
import tradeAreasRoutes from './api/rest/trade-areas.routes';
import intelligenceRouter from './api/rest/intelligence.routes';
import geographicContextRoutes from './api/rest/geographic-context.routes';
import isochroneRoutes from './api/rest/isochrone.routes';
import trafficAiRoutes from './api/rest/traffic-ai.routes';
import mapConfigsRouter from './api/rest/map-configs.routes';
import gridRouter from './api/rest/grid.routes';
import modulesRouter from './api/rest/modules.routes';
import financialModelsRouter from './api/rest/financial-models.routes';
import strategyAnalysesRouter from './api/rest/strategy-analyses.routes';
import ddChecklistsRouter from './api/rest/dd-checklists.routes';
import dashboardRouter from './api/rest/dashboard.routes';
import gmailRouter from './api/rest/gmail.routes';
import emailRouter from './api/rest/email.routes';
import emailExtractionsRouter from './api/rest/email-extractions.routes';
import marketResearchRoutes from './api/rest/marketResearch.routes';
import supplyRoutes, { supplyExtraRouter } from './api/rest/supply.routes';
import demandRoutes from './api/rest/demand.routes';
import trafficPredictionRoutes from './api/rest/trafficPrediction.routes';
import propertyProxyRoutes from './api/rest/property-proxy.routes';
import leasingTrafficRoutes from './api/rest/leasing-traffic.routes';
import moduleLibrariesRouter from './api/rest/module-libraries.routes';
import marketIntelligenceRouter from './api/rest/market-intelligence.routes';
import { createEnhancedMarketIntelligenceRoutes } from './api/rest/market-intelligence-enhanced.routes';
import { createPropertyMetricsRouter } from './api/rest/property-metrics.routes';
import { createPropertyScoringRouter } from './api/rest/property-scoring.routes';
import { createOpusRoutes } from './api/rest/opus.routes';
import { createDataLibraryRoutes } from './api/rest/data-library.routes';
import { createDataLibraryAssetsRoutes } from './api/rest/data-library-assets.routes';
import { createReplacementCostRoutes } from './api/rest/replacement-cost.routes';
import { createBrokerNarrativesRoutes } from './api/rest/broker-narratives.routes';
import { createIntelligenceRefreshRoutes } from './api/rest/intelligence-refresh.routes';
import { createKnowledgeGraphRoutes } from './api/rest/knowledge-graph.routes';
import { createKGDealIngestionRoutes } from './services/knowledge-graph/kg-deal-ingestion.routes';
import { createKGDealContextRoutes } from './services/knowledge-graph/kg-deal-context.routes';
import { createContextAwarenessRoutes } from './api/rest/context-awareness.routes';
import scheduledRefreshRoutes from './api/rest/scheduled-refresh.routes';
import dataMatrixRoutes from './api/rest/data-matrix.routes';
import propertyBoundaryRouter from './api/rest/property-boundary.routes';
import siteIntelligenceRouter from './api/rest/site-intelligence.routes';
import zoningCapacityRouter from './api/rest/zoning-capacity.routes';
import teamManagementRouter from './api/rest/team-management.routes';
import collaborationRouter from './api/rest/collaboration.routes';
import contactsSyncRouter from './api/rest/contacts-sync.routes';
import notarizeRouter from './api/rest/notarize.routes';
import contextTrackerRouter from './api/rest/context-tracker.routes';
import { createZoningIntelligenceRoutes } from './api/rest/zoning-intelligence.routes';
import { createZoningLearningRoutes } from './api/rest/zoning-learning.routes';
import zoningVerificationRouter from './api/rest/zoning-verification.routes';
import zoningProfileRouter from './api/rest/zoning-profile.routes';
import developmentScenariosRouter from './api/rest/development-scenarios.routes';
import moduleWiringRouter from './api/rest/module-wiring.routes';
import taskCompletionRouter from './api/rest/task-completion.routes';
import capitalStructureRouter from './api/rest/capital-structure.routes';
import debtAdvisorRouter from './api/rest/debt-advisor.routes';
import dataUploadRouter from './api/rest/data-upload.routes';
import pstUploadRouter from './api/rest/pst-upload.routes';
import uploadTemplatesRouter from './api/rest/upload-templates.routes';
import uploadRouter from './api/rest/upload.routes';
import compQueryRouter from './api/rest/comp-query.routes';
import proformaGeneratorRouter from './api/rest/proforma-generator.routes';
import proformaRouter from './api/rest/proforma.routes';
import stabilizedPotentialRouter from './api/rest/stabilized-potential.routes';
import benchmarkTimelineRouter from './api/rest/benchmark-timeline.routes';
import adminApiKeyRouter from './api/rest/admin-api-key.routes';
import entitlementRouter from './api/rest/entitlement.routes';
import regulatoryAlertRouter from './api/rest/regulatory-alert.routes';
import scenariosRouter from './api/rest/scenarios.routes';
import riskRouter from './api/rest/risk.routes';
import kafkaEventsRouter from './api/rest/kafka-events.routes';
import adminDataCoverageRouter from './api/rest/admin-data-coverage.routes';
import municodeRouter from './api/rest/municode.routes';
import scrapeRouter from './api/rest/scrape.routes';
import designReferencesRouter from './api/rest/design-references.routes';
import financialModelRouter from './api/rest/financial-model.routes';
import financialDashboardRouter from './api/rest/financial-dashboard.routes';
import visibilityRouter from './api/rest/visibility.routes';
import propertyAnalyticsRouter from './api/rest/property-analytics.routes';
import trafficDataRouter from './api/rest/traffic-data.routes';
import trafficCompsRouter from './api/rest/traffic-comps.routes';
import m07CalibrationRouter from './api/rest/m07-calibration.routes';
import macroIndicatorsRouter from './api/rest/macro-indicators.routes';
import correlationRouter from './api/rest/correlation.routes';
import rankingsRouter from './api/rest/rankings.routes';
import marketRouter from './api/rest/market.routes';
import portfolioRouter from './api/rest/portfolio.routes';
import competitionRouter from './api/rest/competition.routes';
import dealMarketIntelligenceRoutes from './api/rest/deal-market-intelligence.routes';
import dealCompSetsRoutes from './api/rest/deal-comp-sets.routes';
import { createCoStarUploadRoutes } from './api/rest/costar-upload.routes';
import dealPhotosRoutes from './api/rest/deal-photos.routes';
import dealContextRoutes from './api/rest/deal-context.routes';
import exitTrajectoryRouter from './api/rest/exit-trajectory.routes';
import forwardSupplyRouter from './api/rest/forward-supply.routes';
import financialModelRoutes from './api/rest/financial-model.routes';
import deterministicModelRouter from './api/rest/deterministic-model.routes';
import clawdbotWebhooksRouter from './api/rest/clawdbot-webhooks.routes';
import oppgridRouter from './api/rest/oppgrid.routes';
import rentScraperAdminRouter from './api/rest/rent-scraper-admin.routes';
import m26TaxRouter from './api/rest/m26-tax.routes';
import m27CompsRouter from './api/rest/m27-comps.routes';
import m28CycleIntelligenceRoutes from './api/rest/m28-cycle-intelligence.routes';
import { createUnitMixRoutes } from './api/rest/unitMix.routes';
import dealValidationRoutes from './api/rest/deal-validation.routes';
import fieldDivergencesRoutes from './api/rest/field-divergences.routes';
import dealCompletenessRoutes from './api/rest/deal-completeness.routes';
import vendorFreshnessRoutes from './api/rest/vendor-freshness.routes';
import unitMixPropagationRoutes from './api/rest/unit-mix-propagation.routes';
import dealAssumptionsRoutes from './api/rest/deal-assumptions.routes';
import financialDocumentsRoutes from './api/rest/financial-documents.routes';
import sourceDocumentsRoutes from './api/rest/source-documents.routes';
import capsuleSharingRoutes from './api/rest/capsule-sharing.routes';
import workspaceRouter from './api/rest/workspace.routes';
import dealSharesRoutes from './api/rest/deal-shares.routes';
import jediRoutes from './api/rest/jedi.routes';
import agentChatRouter from './routes/agent-chat.routes';
import m35ConnectorsRouter from './routes/m35-connectors.routes';
import m35EventsRouter from './routes/m35-events.routes';
import m35PlaybooksRouter from './routes/m35-playbooks.routes';
import m35ForecastsRouter from './routes/m35-forecasts.routes';
import m35BacktestRouter from './routes/m35-backtest.routes';
import corporateHealthRouter from './api/rest/corporate-health.routes';
import mediaRouter from './api/rest/media.routes';
import orgRouter from './api/rest/org.routes';
import underwritingScenariosRouter from './api/rest/underwriting-scenarios.routes';
import { errorWebhookMiddleware, setupUnhandledRejectionHandler, setupUncaughtExceptionHandler } from './middleware/errorWebhook';
import { startM28Scheduler } from './services/m28-scheduler.service';

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const httpServer = createServer(app);
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5000', 'http://0.0.0.0:5000', 'http://localhost:4000', 'http://0.0.0.0:4000', 'http://localhost:3000'];
const allowedOriginPatterns = [/\.replit\.dev(:\d+)?$/, /\.replit\.app(:\d+)?$/, /\.repl\.co(:\d+)?$/];

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (!isProduction) return true;
  if (allowedOrigins.includes(origin)) return true;
  return allowedOriginPatterns.some(pattern => pattern.test(origin));
}

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

import { setSocketIo } from './services/socket-registry';
setSocketIo(io);

const PORT = process.env.PORT || 3000;

const pool = getPool();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
// Stripe webhook MUST be before express.json() for raw body signature verification
import { WebhookHandlers } from './services/stripe/webhookHandlers';
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Stripe webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/health', healthRouter);
app.use('/api/v1/auth', authRouter);

// Admin routes MUST be registered before generic /api/v1 routes
import dataTrackerRoutes from './api/rest/data-tracker.routes';
app.use('/api/v1/admin/data-tracker', dataTrackerRoutes);
app.use('/api/v1/admin/data-coverage', adminDataCoverageRouter);
import adminRouter from './api/rest/admin.routes';
app.use('/api/v1/admin', adminRouter);
import dotAdminRouter from './api/rest/dot-admin.routes';
app.use('/api/v1/admin', dotAdminRouter);
import atlantaUrlDiscoveryRouter from './api/rest/atlanta-url-discovery.routes';
app.use('/api/v1/admin/atlanta-url-discovery', atlantaUrlDiscoveryRouter);
import enrichmentAdminRouter from './api/rest/enrichment-admin.routes';
app.use('/api/v1/admin', enrichmentAdminRouter);
app.use('/api/v1/admin-api', adminApiKeyRouter);

// Supply Signal routes under the /supply prefix (deal-scoped pipeline +
// trade-area metrics). Provides GET /api/v1/supply/deals/:dealId/supply that
// fetch_costar_metrics calls via PlatformClient. Mounted BEFORE the inline
// dataRouter so its GET /supply/:market handler doesn't shadow our
// single-segment routes (e.g. /api/v1/supply/events). Auth is enforced here
// to match the access-control posture of the existing /api/v1 mount of the
// same router on line ~459.
app.use('/api/v1/supply', requireAuth, supplyRoutes);

app.use('/api/v1', dataRouter);
// Capsule sharing routes mounted here (second, early mount) so that the
// unauthenticated GET /api/v1/deals/:dealId/deal-book endpoint is reachable
// before the authenticated dealsRouter at the next line intercepts the request.
app.use('/api/v1', capsuleSharingRoutes);
app.use('/api/v1/deals', dealsRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/inbox', inboxRouter);
app.use('/api/v1', zoningAnalyzeRouter);

app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/f40', f40PerformanceRoutes);
app.use('/api/v1/opportunities', opportunityEngineRoutes);

const microsoftConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:4000/api/v1/microsoft/auth/callback',
  scopes: ['User.Read', 'Mail.Read', 'Mail.Send', 'Calendars.Read', 'Calendars.ReadWrite']
};
// Inline router mounted first: handles /auth/init, /auth/callback, /status
// with a lightweight config-less implementation.
// Full microsoftRouter mounted second: handles the remaining 13 unique routes.
// Express first-match means /auth/callback and /status go to inline router.
app.use('/api/v1/microsoft', createMicrosoftInlineRoutes(microsoftConfig));
app.use('/api/v1/microsoft', microsoftRouter);

app.use('/api/v1/clawdbot', clawdbotWebhooksRouter);
app.use('/api/v1/oppgrid', oppgridRouter);
app.use('/api/v1/admin/rent-scraper', rentScraperAdminRouter);
app.use('/api/v1', m26TaxRouter);
app.use('/api/v1', m27CompsRouter);
app.use('/api/v1/cycle-intelligence', m28CycleIntelligenceRoutes);

import valuationGridRouter from './api/rest/valuation-grid.routes';
app.use('/api/v1', valuationGridRouter);

import taxCompAnalysisRouter from './api/rest/tax-comp-analysis.routes';
app.use('/api/v1', taxCompAnalysisRouter);

// FRED macro ticker â€” public (no auth required) â€” used by TerminalPage ticker bar
import tickerRoutes from './api/rest/ticker.routes';
app.use('/api/v1/ticker', tickerRoutes);

// Time Series Explorer â€” public (no auth required) â€” used by TimeSeriesExplorerPage
import timeSeriesRoutes from './api/rest/time-series.routes';
app.use('/api/v1/time-series', timeSeriesRoutes);

import driverAnalysisRoutes from './api/rest/driver-analysis.routes';
app.use('/api/v1/driver-analysis', driverAnalysisRoutes);

import derivedMetricsRoutes from './api/rest/derived-metrics.routes';
app.use('/api/v1/derived-metrics', derivedMetricsRoutes);

import columnCatalogRoutes, { catalogHandler, gridDataHandler, insightsHandler } from './api/rest/column-catalog.routes';
app.use('/api/v1/columns', columnCatalogRoutes);
app.get('/api/v1/column-catalog', catalogHandler);
app.get('/api/v1/grid-data', gridDataHandler);
app.get('/api/v1/column-insights', insightsHandler);

import gridTemplatesRoutes from './api/rest/grid-templates.routes';
app.use('/api/v1/grid-templates', optionalAuth, gridTemplatesRoutes);

app.use('/api/v1/markets', optionalAuth, marketIntelligenceRouter(pool));
app.use('/api/v1/markets', optionalAuth, createEnhancedMarketIntelligenceRoutes(pool));

import createUnifiedPropertiesRoutes from './api/rest/unified-properties.routes';
app.use('/api/v1/properties', createUnifiedPropertiesRoutes(pool));

// Property CRUD routes (mounted AFTER unified so /unified isn't shadowed by
// /:id). Provides the GET /properties/:id, POST /properties, PUT /:id, etc.
// endpoints that agent tools (e.g. fetch_parcel, fetch_ownership) call via
// PlatformClient.
import propertyRoutes from './api/rest/property.routes';
app.use('/api/v1/properties', propertyRoutes);

app.use('/api/v1/grid', optionalAuth, gridRouter);
app.use('/api/v1/rankings', optionalAuth, rankingsRouter);
app.use('/api/v1/portfolio', portfolioRouter);

// Neural Network Hub: GET /api/v1/agents/status â€” must be mounted BEFORE the
// broader /api/v1/agents routers below so the existing GET /status in
// agent-chat.routes.ts (which returns hard-coded fake data) doesn't shadow it.
import { createAgentStatusRoutes } from './api/rest/agent-status.routes';
app.use('/api/v1/agents/status', createAgentStatusRoutes(pool));

import agentRouter from './api/rest/agent.routes';
app.use('/api/v1/agents', agentRouter);

// Agent runtime routes (Phase 3): trigger, run detail, steps
import agentRunsRouter, { dealAgentRunsRouter } from './api/rest/agent-runs.routes';
app.use('/api/v1/agents', agentRunsRouter);
app.use('/api/v1/deals', dealAgentRunsRouter);

// CashFlow underwriting routes: POST /api/v1/agents/cashflow/underwrite + deal-scoped evidence endpoints
import cashflowUnderwritingRoutes, { dealUnderwritingRouter } from './api/rest/cashflow-underwriting.routes';
app.use('/api/v1/agents', cashflowUnderwritingRoutes);
app.use('/api/v1/deals', dealUnderwritingRouter);

// Roadmap Mode routes: POST/GET /api/v1/deals/:dealId/roadmap
import { roadmapRouter } from './api/rest/roadmap.routes';
app.use('/api/v1/deals', requireAuth, roadmapRouter);

// Inngest durable function serve handler
// In dev: Inngest Dev Server proxies to /api/inngest
// In prod: Inngest cloud calls this endpoint
import { serve } from 'inngest/express';
import { inngest } from './lib/inngest';
import { researchOnDealCreated } from './agents/research.inngest';
import { zoningOnDealCreated } from './agents/zoning.inngest';
import { supplyOnDealCreated } from './agents/supply.inngest';
import {
  cashflowOnDealCreated,
  cashflowOnResearchCompleted,
  cashflowOnWalkthroughRequested,
} from './agents/cashflow.inngest';
import { commentaryOnResearchCompleted } from './agents/commentary.inngest';
import { archiveAggregationFunction } from './inngest/functions/archive-aggregation.function';
import { emailIntakeFunction } from './inngest/functions/email-intake.function';
import { captureMonthlySnapshotsFunction } from './inngest/functions/capture-monthly-snapshots';
import { syncMartaGtfsFunction } from './inngest/functions/sync-marta-gtfs';
import { syncOsmPoisFunction } from './inngest/functions/sync-osm-pois';
import { syncAtlantaPdCrimeFunction } from './inngest/functions/sync-atlanta-pd-crime';
import { snapshotSentimentDaily } from './inngest/functions/snapshot-sentiment.function';
import { rateSheetStalenessCron } from './inngest/functions/rateSheetStaleness.cron';
import { taxBillUploadedHandler } from './inngest/functions/taxBillUploaded.handler';
import { historicalObservationsBackfill } from './inngest/functions/historicalObservationsBackfill';
import { dataCorpusReminderCron } from './inngest/functions/dataCorpusReminderCron';
import { weeklyCorpusDigestCron } from './inngest/functions/weeklyCorpusDigestCron';
import { trafficCalibrationCron } from './inngest/functions/trafficCalibrationCron';
import { correlationRollingComputeCron } from './inngest/functions/correlation-rolling-compute';
import { nightlyEventExtractionCron } from './inngest/functions/nightly-event-extraction';
import { nightlyApartmentSyncCron } from './inngest/functions/nightly-apartment-sync';
import { calibrationRealizationCron } from './inngest/functions/calibrationRealizationCron';
import { macroSignalsMonthly } from './inngest/functions/macro-signals-monthly';
import { syncPlanningApplicationsCron } from './inngest/functions/sync-planning-applications';
import { syncAccelaPlanningCron } from './inngest/functions/sync-accela-planning';
import { syncMiamiDadePlanningCron } from './inngest/functions/sync-miami-dade-planning';
import { georgiaCompEnrichmentWeekly } from './inngest/functions/georgia-comp-enrichment-weekly';
import { georgiaArcGisIngestCron } from './inngest/functions/georgia-arcgis-ingest.cron';
import { propertyReconciliationNightly } from './inngest/functions/property-reconciliation-nightly';
import { scheduledAgentFunctions } from './services/agents/scheduled-jobs';
import { scheduledDiscoveryFunctions } from './services/discovery/scheduled-discovery';
app.use(
  '/api/inngest',
  serve({
    client: inngest,
    functions: [
      researchOnDealCreated,
      zoningOnDealCreated,
      supplyOnDealCreated,
      cashflowOnDealCreated,
      cashflowOnResearchCompleted,
      cashflowOnWalkthroughRequested,
      commentaryOnResearchCompleted,
      archiveAggregationFunction,
      emailIntakeFunction,
      captureMonthlySnapshotsFunction,
      // Real-data sources (Task #363): MARTA GTFS, OSM Overpass, Atlanta PD crime
      syncMartaGtfsFunction,
      syncOsmPoisFunction,
      syncAtlantaPdCrimeFunction,
      // Daily sentiment-history snapshot (Task #382)
      snapshotSentimentDaily,
      // Tax Service Phase 4 (Task #592): weekly rate sheet staleness check + cache invalidation
      rateSheetStalenessCron,
      taxBillUploadedHandler,
      // Historical Observations (Task #716 follow-up): nightly realized output backfill
      historicalObservationsBackfill,
      // Historical Observations (Phase 1): monthly reminder + weekly Monday digest
      dataCorpusReminderCron,
      weeklyCorpusDigestCron,
      // M07 Traffic Engine (FIX-1): weekly Bayesian calibration update
      trafficCalibrationCron,
      // Task #919: nightly rolling correlation compute (12m + 36m windows → correlation_history)
      correlationRollingComputeCron,
      // Task #1078: nightly market event extraction from news_article_cache (03:00 UTC)
      nightlyEventExtractionCron,
      // Task #635: nightly apartment locator sync — all metros (04:00 UTC)
      nightlyApartmentSyncCron,
      // M38: nightly realization ingestion + pairing so drift detection activates (Task #587)
      calibrationRealizationCron,
      // Task #1050: monthly FRED + BLS macro signals → historical_observations (2nd of month, 09:00 UTC)
      macroSignalsMonthly,
      // Task #1075: nightly Atlanta DPCD + Fulton County planning application ingest (01:00 UTC)
      syncPlanningApplicationsCron,
      // Task #1076: nightly Gwinnett + DeKalb + Cobb Accela planning ingest (02:00 UTC)
      syncAccelaPlanningCron,
      // Task #1077: nightly Miami-Dade BCC planning application ingest (03:30 UTC)
      syncMiamiDadePlanningCron,
      // Task #1478: weekly Georgia comp promote + enrich — every Monday 02:00 UTC (no ArcGIS ingest)
      georgiaCompEnrichmentWeekly,
      // Task #1477: weekly Fulton + Gwinnett ArcGIS ingestion — real unit counts → Bishop comps (Sun 02:00 UTC)
      georgiaArcGisIngestCron,
      // Task #1488: nightly property dual-write reconciliation — row-count parity + sample audit (03:00 UTC)
      propertyReconciliationNightly,
      // Autonomous agents (Task #327): morning briefings, compliance,
      // portfolio reviews, market intelligence, threshold monitoring.
      ...scheduledAgentFunctions,
      // Discovery jobs (Task #327): hourly rates/REITs, daily news,
      // weekly market scan, on-demand triggers.
      ...scheduledDiscoveryFunctions,
    ],
  })
);

import chatRouter from './api/rest/chat.routes';
app.use('/api/v1/chat', chatRouter);

import { MessageRouter } from './services/chat/messageRouter';
const messageRouter = new MessageRouter();
app.use('/', messageRouter.createRouter());

// Correlations - public read, admin-key-protected compute
app.use('/api/v1/correlations', correlationRouter);
app.use('/api/v1/workspaces', workspaceRouter);

// Lead/Lag Discovery - public read, admin-key-protected compute
import leadLagRoutes from './api/rest/lead-lag.routes';
app.use('/api/v1/lead-lag', leadLagRoutes);

// News Subscriptions (per-user inbound email + RSS + enterprise OAuth stub).
// Mounted BEFORE the global '/api/v1' requireAuth middleware below so the
// /inbound-email webhook can be POSTed publicly (token-gated by unique address).
// Auth is enforced per-route inside the router for everything else.
import newsConnectionsRoutes from './api/rest/news-connections.routes';
app.use('/api/v1/news-connections', newsConnectionsRoutes);

// Archive management routes — mounted BEFORE all catch-all '/api/v1' requireAuth
// middleware so that /ingest-rows (secret-header auth) is reachable externally.
// Existing archive routes carry per-route requireAuth guards internally.
import archiveRouter from './api/rest/archive.routes';
app.use('/api/v1/archive', archiveRouter);

// Per-Property Visibility Substrate — unified summary + file-list endpoints.
// Mounted before requireAuth catch-alls; each route guards itself.
import { createArchivePropertiesRouter } from './api/rest/archive-properties.routes';
app.use('/api/v1/properties', requireAuth, createArchivePropertiesRouter(pool));

// Building Envelope - requires auth
import buildingEnvelopeRoutes from './api/rest/building-envelope.routes';
app.use('/api/v1', requireAuth, buildingEnvelopeRoutes);

app.use('/api/v1/dashboard', requireAuth, dashboardRouter);
app.use('/api/v1/gmail', requireAuth, gmailRouter);
app.use('/api/v1/news', requireAuth, newsRouter);
app.use('/api/v1/intelligence', requireAuth, intelligenceRouter);
app.use('/api/v1/trade-areas', requireAuth, tradeAreasRoutes);
app.use('/api/v1/isochrone', requireAuth, isochroneRoutes);
app.use('/api/v1/traffic-ai', requireAuth, trafficAiRoutes);
app.use('/api/v1', requireAuth, geographicContextRoutes);
app.use('/api/v1/deals', requireAuth, geographicContextRoutes);
app.use('/api/v1/deals', dealMarketIntelligenceRoutes);
app.use('/api/v1/deals', dealCompSetsRoutes);
app.use('/api/v1/deals', requireAuth, dealPhotosRoutes);
app.use('/api/v1/deals', requireAuth, dealContextRoutes);
app.use('/api/v1/deals', requireAuth, financialModelRoutes);
app.use('/api/v1/financial-models', requireAuth, financialModelRoutes);
app.use('/api/v1/jedi', jediRoutes);
app.use('/api/v1/agents', agentChatRouter);
app.use('/api/v1/corporate-health', requireAuth, corporateHealthRouter);
app.use('/api/media', mediaRouter);
// org.routes.ts: role-gated org CRUD, member management, invitations (/api/v1/orgs/:orgId/...)
app.use('/api/v1/orgs', requireAuth, orgRouter);

// Phase 10: Cross-Module Validation
app.use('/api/v1/deals', requireAuth, dealValidationRoutes);
app.use('/api/v1/deals', requireAuth, fieldDivergencesRoutes);
app.use('/api/v1/deals', requireAuth, dealCompletenessRoutes);
app.use('/api/v1/deals', requireAuth, vendorFreshnessRoutes);

// Phase 11: Unit Mix Propagation
app.use('/api/v1/deals', requireAuth, unitMixPropagationRoutes);
app.use('/api/v1/deals', requireAuth, competitionRouter);
app.use('/api/v1/proforma', requireAuth, stabilizedPotentialRouter);
app.use('/api/v1/proforma', requireAuth, proformaRouter);
app.use('/api/v1/deals', dealAssumptionsRoutes);
app.use('/api/v1/deals', financialDocumentsRoutes);
app.use('/api/v1/deals', requireAuth, sourceDocumentsRoutes);
// Deal-level share management (Task B) — owner-only endpoints.
// GET  /api/v1/deals/:dealId/shares
// POST /api/v1/deals/:dealId/shares/:shareId/revoke
app.use('/api/v1/deals', requireAuth, dealSharesRoutes);

// Capsule Sharing: authenticated capsule-owner actions at /api/v1/capsules-ext.
// Token-based recipient actions are already mounted above (before requireAuth handlers).
app.use('/api/v1/capsules-ext', requireAuth, capsuleSharingRoutes);

// Scene storage for 3D scenes â€” must be BEFORE documentsFilesRoutes so
// /:dealId/files/3d-scene wins match against /:dealId/files/:fileId (Express first-match)
import { sceneStorageRouter } from './services/design/scene-storage.service';
app.use('/api/v1/deals', requireAuth, sceneStorageRouter);

import documentsFilesRoutes from './api/rest/documentsFiles.routes';
app.use('/api/v1', documentsFilesRoutes);
import submarketDocumentsRoutes from './api/rest/submarketDocuments.routes';
app.use('/api/v1', submarketDocumentsRoutes);

app.use('/api/v1/map-configs', requireAuth, mapConfigsRouter);
app.use('/api/v1/modules', requireAuth, modulesRouter);
app.use('/api/v1/financial-models', requireAuth, financialModelsRouter);
app.use('/api/v1/strategy-analyses', requireAuth, strategyAnalysesRouter);
app.use('/api/v1/dd-checklists', requireAuth, ddChecklistsRouter);
app.use('/api/v1/market-research', requireAuth, marketResearchRoutes);
app.use('/api/v1/market', requireAuth, marketRouter);
app.use('/api/v1', requireAuth, supplyRoutes);
app.use('/api/v1/supply', requireAuth, supplyExtraRouter);
import { sentimentRouter } from './api/rest/sentiment.routes';
app.use('/api/v1/sentiment', requireAuth, sentimentRouter);
app.use('/api/v1', requireAuth, demandRoutes);
app.use('/api/v1/traffic', requireAuth, trafficPredictionRoutes);
app.use('/api/v1', requireAuth, propertyProxyRoutes);
app.use('/api/v1/leasing-traffic', requireAuth, leasingTrafficRoutes);
app.use('/api/v1/preferences', requireAuth, preferencesRouter);
app.use('/api/v1/settings/ai-preferences', settingsAiRouter);
app.use('/api/v1/settings/branding', settingsBrandingRouter);
app.use('/api/v1/property-types', requireAuth, propertyTypesRouter);
app.use('/api/v1/property-type-strategies', requireAuth, propertyTypeStrategiesRouter);
app.use('/api/v1/custom-strategies', requireAuth, customStrategiesRouter);
app.use('/api/v1/strategies', requireAuth, strategiesRouter);
app.use('/api/v1/strategy-definitions', requireAuth, strategyDefinitionsRouter);
app.use('/api/v1/deals', requireAuth, dealStrategyRouter);
app.use('/api/v1/metrics', requireAuth, metricsCatalogRouter);
app.use('/api/v1/market-metrics', requireAuth, marketMetricsRouter);
app.use('/api/v1/module-libraries', requireAuth, moduleLibrariesRouter);
app.use('/api/v1/property-metrics', requireAuth, createPropertyMetricsRouter(pool));
app.use('/api/v1/property-scoring', requireAuth, createPropertyScoringRouter(pool));
app.use('/api/v1/opus', requireAuth, createOpusRoutes(pool));
app.use('/api/v1/data-library', requireAuth, createDataLibraryRoutes(pool));
app.use('/api/v1/data-library-assets', requireAuth, createDataLibraryAssetsRoutes(pool));
import { createDataLibraryFilesRoutes } from './api/rest/data-library-files.routes';
app.use('/api/v1/data-library-files', requireAuth, createDataLibraryFilesRoutes(pool));
import { createIntakeJobsRoutes } from './api/rest/intake-jobs.routes';
app.use('/api/v1/intake-jobs', requireAuth, createIntakeJobsRoutes(pool));
app.use('/api/v1/replacement-cost', createReplacementCostRoutes(pool));
app.use('/api/v1/broker-narratives', createBrokerNarrativesRoutes(pool));
app.use('/api/v1/intelligence', createIntelligenceRefreshRoutes());
app.use('/api/v1/knowledge-graph', createKnowledgeGraphRoutes(pool));
app.use('/api/v1/knowledge-graph', createKGDealIngestionRoutes(pool));
app.use('/api/v1/knowledge-graph/context', requireAuth, createKGDealContextRoutes(pool));

// KG Deal Listener â€” auto-ingests deal analysis results into the knowledge graph.
// Hooks into zoning analysis, market analysis, and program target events.
// Initialized lazily â€” no background thread, no blocking startup.
import { getKGDealListener } from './services/knowledge-graph/kg-deal-listener.service';

// Initialize KG Deal Listener â€” hooks into deal lifecycle events
// and pushes analysis results into the knowledge graph.
getKGDealListener(pool);
// Knowledge Graph public path aliases â€” see kg-aliases.routes.ts.
// Mounted at /api (not /api/v1) to satisfy the contracted public paths:
//   GET  /api/kg/semantic-search
//   POST /api/admin/kg/embeddings/backfill
const { createKgAliasRoutes } = require('./api/rest/kg-aliases.routes');
app.use('/api', createKgAliasRoutes(pool));
// Context Awareness â€” analyst brain (analyze, supply-pipeline, gaps, what-if,
// query). Wrapped in requireAuth so the LLM-backed /query endpoint can never
// be reached unauthenticated even if the broader '/api/v1' requireAuth chain
// above is reordered in the future.
app.use('/api/v1/context', requireAuth, createContextAwarenessRoutes(pool));
app.use('/api/v1/scheduled-refresh', scheduledRefreshRoutes);
app.use('/api/v1/data-matrix', dataMatrixRoutes);
app.use('/api/v1', requireAuth, propertyBoundaryRouter);
app.use('/api/v1', requireAuth, siteIntelligenceRouter);
app.use('/api/v1', requireAuth, zoningCapacityRouter);
app.use('/api/v1/zoning-intelligence', requireAuth, createZoningIntelligenceRoutes(pool));
app.use('/api/v1/zoning-learning', requireAuth, createZoningLearningRoutes(pool));
app.use('/api/v1/zoning-verification', requireAuth, zoningVerificationRouter);
app.use('/api/v1', requireAuth, zoningProfileRouter);
app.use('/api/v1', requireAuth, developmentScenariosRouter);
app.use('/api/v1', requireAuth, teamManagementRouter);
app.use('/api/v1', requireAuth, collaborationRouter);
app.use('/api/v1/emails', emailRouter);
app.use('/api/v1/email-extractions', emailExtractionsRouter);
app.use('/api/v1', requireAuth, contactsSyncRouter);
app.use('/api/v1', notarizeRouter);
app.use('/api/v1/context', requireAuth, contextTrackerRouter);
app.use('/api/v1/module-wiring', requireAuth, moduleWiringRouter);
app.use('/api/v1/task-completion', requireAuth, taskCompletionRouter);
app.use('/api/v1/capital-structure', requireAuth, capitalStructureRouter);
app.use('/api/v1/deals', debtAdvisorRouter);
app.use('/api/v1/properties', requireAuth, dataUploadRouter);
app.use('/api/v1/data-upload/pst', requireAuth, pstUploadRouter);
app.use('/api/v1/upload-templates', requireAuth, uploadTemplatesRouter);
app.use('/api/v1/uploads', requireAuth, uploadRouter);
app.use('/api/v1/comps', requireAuth, compQueryRouter);
app.use('/api/v1/properties', requireAuth, proformaGeneratorRouter);
app.use('/api/v1/benchmark-timeline', requireAuth, benchmarkTimelineRouter);
app.use('/api/v1/entitlements', requireAuth, entitlementRouter);
app.use('/api/v1/regulatory-alerts', requireAuth, regulatoryAlertRouter);
app.use('/api/v1/scenarios', requireAuth, scenariosRouter);
app.use('/api/v1/deals', requireAuth, underwritingScenariosRouter);
app.use('/api/v1/risk', requireAuth, riskRouter);
app.use('/api/v1/events', requireAuth, kafkaEventsRouter);
app.use('/api/v1/m35/connectors', requireAuth, m35ConnectorsRouter);
app.use('/api/v1/m35', requireAuth, m35PlaybooksRouter);
app.use('/api/v1/m35', requireAuth, m35ForecastsRouter);
app.use('/api/v1/m35', requireAuth, m35BacktestRouter);
app.use('/api/v1/m35', requireAuth, m35EventsRouter);
app.use('/api/v1/municode', requireAuth, municodeRouter);
app.use('/api/v1/scrape', requireAuth, scrapeRouter);
app.use('/api/v1/design-references', requireAuth, designReferencesRouter);
app.use('/api/v1/financial-model', requireAuth, financialModelRouter);
app.use('/api/v1/deterministic', deterministicModelRouter);
app.use('/api/v1/financial-dashboard', requireAuth, financialDashboardRouter);
app.use('/api/v1/visibility', requireAuth, visibilityRouter);
app.use('/api/v1/property-analytics', requireAuth, propertyAnalyticsRouter);
app.use('/api/v1/traffic-data', requireAuth, trafficDataRouter);
app.use('/api/v1/traffic-comps', requireAuth, trafficCompsRouter);
app.use('/api/v1/calibration', requireAuth, m07CalibrationRouter);
app.use('/api/v1/macro', requireAuth, macroIndicatorsRouter);

app.use('/api/v1', requireAuth, zoningTriangulationRouter);

// Cloud storage integration routes
import cloudStorageRouter from './api/rest/cloud-storage.routes';
app.use('/api/v1/cloud-storage', cloudStorageRouter);

// Bulk upload routes
import bulkUploadRouter from './api/rest/bulk-upload.routes';
app.use('/api/v1/bulk-upload', bulkUploadRouter);

import propertyDiscoveryRouter from './api/rest/property-discovery.routes';
app.use('/api/v1/property-discovery', propertyDiscoveryRouter);

import apartmentLocatorRouter from './api/rest/apartment-locator.routes';
app.use('/api/v1/apartment-locator', apartmentLocatorRouter);

// Georgia Metro data ingestion + market intelligence routes (auth enforced per-route internally)
import georgiaIngestionRouter from './api/rest/georgia-ingestion.routes';
app.use('/api/v1/georgia', georgiaIngestionRouter);

// Learning feedback system routes
import learningRouter from './api/rest/learning.routes';
app.use('/api/v1/learning', learningRouter);

// Operations intelligence routes (revenue management)
import operationsRouter from './api/rest/operations.routes';
app.use('/api/v1/operations', operationsRouter);

// Full lifecycle routes (disposition, reforecast, debt, comp sets, capex)
import lifecycleRouter from './api/rest/lifecycle.routes';
app.use('/api/v1/lifecycle', lifecycleRouter);

// Investor & capital tracking routes (F8 — LP/GP, capital calls, distributions, waterfall)
import investorCapitalRoutes from './api/rest/investor-capital.routes';
app.use('/api/v1/capital', requireAuth, investorCapitalRoutes);

// organization.routes.ts: deal team assignments, phase handoffs, context tracker, DocuSign/Notarize/Plaid credentials (/api/v1/organization/...)
import organizationRouter from './api/rest/organization.routes';
import sigmaRouter from './api/rest/sigma.routes';
import sigmaFullRouter from './api/rest/sigma-full.routes';
import { designMassingRouter } from './services/design/design-massing.service';
import leaseVelocityRouter from './api/rest/lease-velocity.routes';
import historicalObservationsRoutes from './api/rest/historical-observations.routes';
app.use('/api/v1/organization', organizationRouter);

// Design 3D â€” AI massing generation
app.use('/api/v1/design', requireAuth, designMassingRouter);

// M36 Joint Distribution Engine â€” plausibility scoring + goal-seeking
app.use('/api/v1/sigma', requireAuth, sigmaRouter);
app.use('/api/v2/sigma', requireAuth, sigmaFullRouter);
app.use('/api/v1/analogs', analogRouter);
app.use('/api/v1/lease-velocity', leaseVelocityRouter);

// Historical Observations — empirical calibration substrate
app.use('/api/v1/historical-observations', requireAuth, historicalObservationsRoutes);

// Vendor Registry — file-type catalogue + filename classifier for Market Data UI
import vendorRegistryRoutes from './api/rest/vendor-registry.routes';
app.use('/api/v1/vendor-registry', requireAuth, vendorRegistryRoutes);

app.use('/api/v1/unit-mix', requireAuth, createUnitMixRoutes(pool));

app.get('/api/v1/apartment-sync/trends', requireAuth, async (req: any, res) => {
  try {
    const { city = 'Atlanta' } = req.query;
    const result = await pool.query(
      'SELECT * FROM apartment_trends WHERE city = $1 ORDER BY snapshot_date DESC LIMIT 30',
      [city]
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v1/apartment-sync/submarkets', requireAuth, async (req: any, res) => {
  try {
    const { city = 'Atlanta' } = req.query;
    const result = await pool.query(
      'SELECT * FROM apartment_submarkets WHERE city = $1 ORDER BY snapshot_date DESC LIMIT 30',
      [city]
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v1/apartment-sync/market-snapshots', requireAuth, async (req: any, res) => {
  try {
    const { city = 'Atlanta' } = req.query;
    const result = await pool.query(
      'SELECT * FROM apartment_market_snapshots WHERE city = $1 ORDER BY snapshot_date DESC LIMIT 30',
      [city]
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v1/apartment-sync/demand-signals', requireAuth, async (req: any, res) => {
  try {
    const { city } = req.query;
    const result = await pool.query(
      `SELECT analytics_type, data, synced_at FROM apartment_user_analytics
       WHERE analytics_type = 'demand-signals' ${city ? 'AND (city = $1 OR city IS NULL)' : ''}
       ORDER BY synced_at DESC LIMIT 20`,
      city ? [city] : []
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v1/apartment-sync/user-analytics', requireAuth, async (req: any, res) => {
  try {
    const { city, type } = req.query;
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (city) { params.push(city); where += ` AND (city = $${params.length} OR city IS NULL)`; }
    if (type) { params.push(type); where += ` AND analytics_type = $${params.length}`; }
    const result = await pool.query(
      `SELECT analytics_type, data, synced_at FROM apartment_user_analytics ${where} ORDER BY synced_at DESC LIMIT 50`,
      params
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v1/apartment-sync/rent-comps', requireAuth, async (req: any, res) => {
  try {
    const { city = 'Atlanta', submarket } = req.query;
    const params: any[] = [city];
    let where = 'WHERE city = $1';
    if (submarket) { params.push(submarket); where += ` AND submarket_name = $${params.length}`; }
    const result = await pool.query(
      `SELECT * FROM apartment_submarkets ${where} ORDER BY snapshot_date DESC LIMIT 30`,
      params
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Commentary + Strategy Scoring Endpoints
import { CommentaryAgent, CommentaryInput } from './agents/commentary.agent';
import { strategyArbitrageEngine, StrategySignalInputs } from './services/module-wiring/strategy-arbitrage-engine';
import { StrategyExecutionService } from './services/strategyExecution.service';

const commentaryAgent = new CommentaryAgent();

app.get('/api/v1/commentary/:entityType/:entityId', requireAuth, async (req: any, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { forceRefresh, entityName } = req.query;

    if (!['msa', 'submarket', 'property'].includes(entityType)) {
      return res.status(400).json({ success: false, error: 'entityType must be msa, submarket, or property' });
    }

    const input: CommentaryInput = {
      entityType: entityType as 'msa' | 'submarket' | 'property',
      entityId,
      entityName: entityName as string | undefined,
      forceRefresh: forceRefresh === 'true',
      userId: req.user?.id || req.userId,
    };

    const result = await commentaryAgent.execute(input);
    res.json({ success: true, commentary: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v1/commentary/:entityType/:entityId', requireAuth, async (req: any, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { entityName, signals, forceRefresh } = req.body;

    if (!['msa', 'submarket', 'property'].includes(entityType)) {
      return res.status(400).json({ success: false, error: 'entityType must be msa, submarket, or property' });
    }

    const input: CommentaryInput = {
      entityType: entityType as 'msa' | 'submarket' | 'property',
      entityId,
      entityName,
      signals,
      forceRefresh: forceRefresh === true,
      userId: req.user?.id || req.userId,
    };

    const result = await commentaryAgent.execute(input);
    res.json({ success: true, commentary: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v1/strategy-scoring/analyze', requireAuth, async (req: any, res) => {
  try {
    const { dealId, entityType, entityId, strategyId, signals, envelope } = req.body;

    const signalInputs: StrategySignalInputs | undefined = signals ? {
      demandScore: signals.demandScore ?? 50,
      supplyScore: signals.supplyScore ?? 50,
      momentumScore: signals.momentumScore ?? 50,
      positionScore: signals.positionScore ?? 50,
      riskScore: signals.riskScore ?? 50,
      budgetDistribution: signals.budgetDistribution,
      bedroomDemand: signals.bedroomDemand,
    } : undefined;

    if (strategyId) {
      try {
        const userId = req.user?.id || req.userId;
        const ownerCheck = await pool.query(
          `SELECT id FROM strategy_definitions WHERE id = $1 AND (user_id = $2 OR user_id IS NULL OR scope = 'preset')`,
          [strategyId, userId],
        );
        if (ownerCheck.rows.length === 0) {
          return res.status(403).json({ success: false, error: 'Strategy not found or not authorized' });
        }

        const strategyExec = new StrategyExecutionService(pool);
        const strategyResults = await strategyExec.executeStrategy(strategyId);

        const commentaryInput: CommentaryInput = {
          entityType: (entityType || 'msa') as 'msa' | 'submarket' | 'property',
          entityId: entityId || strategyId,
          signals: signalInputs,
          userId,
        };
        const commentary = await commentaryAgent.execute(commentaryInput);

        return res.json({
          success: true,
          analysis: {
            strategyResults: strategyResults.slice(0, 25),
            scores: commentary.strategyScores,
            recommendedStrategy: commentary.recommendedStrategy,
            arbitrageFlag: commentary.arbitrageFlag,
            arbitrageDelta: commentary.arbitrageDelta,
            jediScore: commentary.jediScore,
            gateResults: strategyResults.slice(0, 10).map(r => ({
              targetId: r.targetId,
              targetName: r.targetName,
              score: r.overallScore,
              rank: r.rank,
              passed: r.conditionResults.every(c => c.passed),
              conditionResults: r.conditionResults,
            })),
          },
        });
      } catch (stratErr: any) {
        logger.warn('Strategy execution failed, falling back to arbitrage engine', { error: stratErr.message });
      }
    }

    if (entityType && entityId) {
      const commentaryInput: CommentaryInput = {
        entityType: entityType as 'msa' | 'submarket' | 'property',
        entityId,
        signals: signalInputs,
        userId: req.user?.id || req.userId,
      };
      const commentary = await commentaryAgent.execute(commentaryInput);
      const filtered = strategyId
        ? commentary.strategyScores.filter(s => s.strategy === strategyId)
        : commentary.strategyScores;
      return res.json({
        success: true,
        analysis: {
          scores: filtered,
          recommendedStrategy: commentary.recommendedStrategy,
          arbitrageFlag: commentary.arbitrageFlag,
          arbitrageDelta: commentary.arbitrageDelta,
          jediScore: commentary.jediScore,
          gateResults: commentary.strategyScores.map(s => ({
            strategy: s.strategy,
            score: s.score,
            rank: s.rank,
            passed: s.score >= 40,
          })),
        },
      });
    }

    if (!dealId) {
      return res.status(400).json({ success: false, error: 'dealId or (entityType + entityId) is required' });
    }

    const result = envelope
      ? await strategyArbitrageEngine.analyzeWithEnvelope(dealId, envelope, signalInputs)
      : await strategyArbitrageEngine.analyze(dealId, signalInputs);

    res.json({ success: true, analysis: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use('/api/training', requireAuth, createTrainingRoutes(pool));
app.use('/api/v1/calibration-ledger', requireAuth, calibrationRouter);
app.use('/api/v1/causal', requireAuth, causalDisciplineRouter);
app.use('/api/v1/peers', requireAuth, peerIntelligenceRouter);
app.use('/api/capsules', requireAuth, createCapsuleRoutes(pool));
app.use('/api/v1/capsules', requireAuth, createCapsuleRoutes(pool));
app.use('/api/v1/email', emailRouter);

// â”€â”€ Deal Capsule Bridge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ── CoStar Comp Upload (D-COSTAR-1 / D-COSTAR-2, Task #1407) ────────────────
app.use('/api/v1/deals/:dealId/costar', createCoStarUploadRoutes(pool));

app.use('/api/v1/deals/:dealId/capsule', requireAuth, createDealCapsuleBridge(pool));

// â”€â”€ Renovation Data API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/api/v1/deals/:dealId/renovation', requireAuth, createRenovationRoutes(pool));

// -- Exit Trajectory (W-10 / CE-12) --
app.use('/api/v1/deals', requireAuth, exitTrajectoryRouter);

// -- Forward Supply (WS-3 Layers 1+2) --
app.use('/api/v1/deals', requireAuth, forwardSupplyRouter);

const activeUsers = new Map<string, any>();
const dealPresence = new Map<string, Map<string, { userId: string; email: string; activeModule?: string; joinedAt: number }>>();

function getDealParticipants(dealId: string) {
  const members = dealPresence.get(dealId);
  return members ? Array.from(members.values()) : [];
}

function broadcastDealPresence(dealId: string) {
  const room = `deal:${dealId}`;
  io.to(room).emit('deal:presence', { dealId, participants: getDealParticipants(dealId) });
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const { verifyAccessToken } = require('./auth/jwt');
      const payload = verifyAccessToken(token);
      if (payload) {
        (socket as any).userId = payload.userId;
        (socket as any).email = payload.email;
        return next();
      }
    } catch {}
  }
  (socket as any).userId = socket.id;
  (socket as any).email = 'anonymous';
  next();
});

io.on('connection', (socket) => {
  console.log(`WebSocket connected: ${socket.id} (user: ${(socket as any).userId})`);
  
  socket.on('user:join', (userData) => {
    activeUsers.set(socket.id, {
      ...userData,
      socketId: socket.id,
      connectedAt: new Date()
    });
    io.emit('users:update', Array.from(activeUsers.values()));
  });
  
  socket.on('cursor:move', (data) => {
    socket.broadcast.emit('cursor:update', {
      socketId: socket.id,
      ...data
    });
  });
  
  socket.on('property:select', (propertyId) => {
    socket.broadcast.emit('property:selected', {
      socketId: socket.id,
      propertyId
    });
  });
  
  const socketDeals = new Set<string>();

  socket.on('deal:join', (data: { dealId: string; activeModule?: string }) => {
    const { dealId, activeModule } = data;
    const room = `deal:${dealId}`;
    socket.join(room);
    socketDeals.add(dealId);

    if (!dealPresence.has(dealId)) dealPresence.set(dealId, new Map());
    dealPresence.get(dealId)!.set(socket.id, {
      userId: (socket as any).userId,
      email: (socket as any).email,
      activeModule,
      joinedAt: Date.now(),
    });
    broadcastDealPresence(dealId);
  });

  socket.on('deal:leave', (data: { dealId: string }) => {
    const { dealId } = data;
    socket.leave(`deal:${dealId}`);
    socketDeals.delete(dealId);
    dealPresence.get(dealId)?.delete(socket.id);
    if (dealPresence.get(dealId)?.size === 0) dealPresence.delete(dealId);
    broadcastDealPresence(dealId);
  });

  socket.on('deal:module_change', (data: { dealId: string; activeModule?: string }) => {
    const entry = dealPresence.get(data.dealId)?.get(socket.id);
    if (entry) {
      entry.activeModule = data.activeModule;
      broadcastDealPresence(data.dealId);
    }
  });

  socket.on('deal:field_change', (data: { dealId: string; module: string; field: string; value: any }) => {
    socket.to(`deal:${data.dealId}`).emit('deal:field_updated', {
      ...data,
      userId: (socket as any).userId,
      timestamp: Date.now(),
    });
  });

  socket.on('deal:comment_added', (data: { dealId: string; comment: any }) => {
    io.to(`deal:${data.dealId}`).emit('deal:new_comment', {
      ...data,
      userId: (socket as any).userId,
      timestamp: Date.now(),
    });
  });

  socket.on('deal:comment_resolved', (data: { dealId: string; commentId: string }) => {
    io.to(`deal:${data.dealId}`).emit('deal:comment_resolved', {
      ...data,
      userId: (socket as any).userId,
      timestamp: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    console.log(`WebSocket disconnected: ${socket.id}`);
    activeUsers.delete(socket.id);
    for (const dealId of socketDeals) {
      dealPresence.get(dealId)?.delete(socket.id);
      if (dealPresence.get(dealId)?.size === 0) dealPresence.delete(dealId);
      broadcastDealPresence(dealId);
    }
    io.emit('users:update', Array.from(activeUsers.values()));
  });
});

// ─── Legacy /capsule-link/:token → /share/:shortcode (301) ───────────────────
// Old token-based share links are redirected server-side to their shortcode
// equivalents. The token is hashed (sha256) and matched against access_token
// in capsule_external_shares. Works for both production static serving and
// dev (where Vite handles other routes) so old bookmarked URLs always resolve.
app.get('/capsule-link/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { getPool } = await import('./database/connection');
    const crypto = await import('crypto');
    const pool = getPool();
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      `SELECT shortcode FROM capsule_external_shares
       WHERE access_token = $1
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [hash]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Share link not found, expired, or revoked.');
    }
    const { shortcode } = result.rows[0];
    return res.redirect(301, `/share/${shortcode}`);
  } catch (err: any) {
    console.error('[capsule-link redirect] DB error:', err?.message);
    return res.status(500).send('Failed to resolve share link.');
  }
});

if (isProduction) {
  const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
  console.log(`Serving static files from: ${frontendPath}`);
  app.use(express.static(frontendPath));
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/health') && !req.path.startsWith('/socket.io')) {
      const indexPath = path.join(frontendPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('Error serving index.html:', err);
          res.status(404).send('Frontend not found. Please ensure the build completed successfully.');
        }
      });
    } else {
      next();
    }
  });
}

app.use(errorWebhookMiddleware);
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const statusCode = (err && typeof err.statusCode === 'number' && err.statusCode >= 100 && err.statusCode < 600) ? err.statusCode : 500;
  if (statusCode >= 500) console.error('Error:', err);
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

setupUnhandledRejectionHandler();
setupUncaughtExceptionHandler();

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('[Stripe] DATABASE_URL not set, skipping Stripe init');
    return;
  }

  try {
    const { runMigrations } = await import('stripe-replit-sync');
    console.log('[Stripe] Running schema migrations...');
    await runMigrations({ databaseUrl });
    console.log('[Stripe] Schema ready');

    const { getStripeSync } = await import('./services/stripe/stripeClient');
    const stripeSync = await getStripeSync();

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPLIT_DEV_DOMAIN;
    if (domain) {
      const webhookUrl = `https://${domain}/api/stripe/webhook`;
      const result = await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      console.log(`[Stripe] Webhook configured: ${result?.webhook?.url || webhookUrl}`);
    } else {
      console.warn('[Stripe] No domain found, skipping webhook registration');
    }

    stripeSync.syncBackfill()
      .then(() => console.log('[Stripe] Data sync complete'))
      .catch((err: any) => console.error('[Stripe] Backfill error:', err.message));
  } catch (error: any) {
    console.error('[Stripe] Init failed:', error.message);
  }
}

async function startServer() {
  // â”€â”€ Agent prompt seeding â€” runs before the server accepts any traffic â”€â”€â”€â”€
  // Fail-fast with explicit process.exit(1): do not rely on unhandled-rejection
  // behavior to catch seed errors. A partial seed is worse than a clean abort.
  try {
    const { seedAllAgentPrompts } = await import('./agents/seeds/index');
    await seedAllAgentPrompts();
  } catch (err: any) {
    console.error('[FATAL] Agent prompt seeding failed â€” aborting startup:', err.message);
    process.exit(1);
    return;
  }

  // â”€â”€ Seed system user for ROCKEMAN_API_KEY identity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // The API key identity in requireApiKey() uses a fixed UUID so that
  // metering queries (user_credit_balances, ai_usage_log) don't violate
  // foreign-key constraints. Ensure the row exists at startup.
  try {
    await pool.query(`
      INSERT INTO users (id, email, role)
      VALUES ('c0c0a000-0000-4000-8000-000000000001', 'rockeman@jedire.system', 'admin')
      ON CONFLICT (id) DO NOTHING
    `);
  } catch (err: any) {
    console.warn('[Startup] Could not seed rockeman user (may already exist):', err.message);
  }

  // â”€â”€ Schema migrations (Task #512) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Apply any unapplied .sql files in backend/src/{db,database}/migrations/
  // before accepting traffic. Without this, columns added in code (e.g.
  // assumptions_hash, error_message) silently miss the database and the
  // first request that touches them returns a 500. After migrations, run
  // a sanity check on a curated list of critical columns.
  //
  // Set SKIP_AUTO_MIGRATIONS=1 to bypass (e.g. when debugging a bad
  // migration interactively).
  // Fail-closed by default per Task #512: "verify schema is current before
  // server accepts requests". Operators who need to start with a partial
  // schema (e.g. mid-debugging) can opt out via SKIP_AUTO_MIGRATIONS=1
  // (skip everything) or LENIENT_SCHEMA_CHECK=1 (run migrations but do not
  // abort startup on per-file failures or missing critical columns).
  if (process.env.SKIP_AUTO_MIGRATIONS === '1') {
    console.warn('[Startup] SKIP_AUTO_MIGRATIONS=1 â€” schema migrations and verification skipped.');
  } else {
    const lenient = process.env.LENIENT_SCHEMA_CHECK === '1';
    try {
      const { runPendingMigrations, verifyCriticalSchema, assertCriticalSchema } =
        await import('./scripts/run-migrations');
      const res = await runPendingMigrations(pool);
      if (res.failed.length > 0) {
        const msg =
          `${res.failed.length} migration(s) failed â€” schema may be in a partial state. ` +
          `See [migrate] log lines above.`;
        if (lenient) {
          console.warn('[Startup] ' + msg + ' Continuing because LENIENT_SCHEMA_CHECK=1.');
        } else {
          throw new Error(msg);
        }
      }
      if (lenient) {
        await verifyCriticalSchema(pool);
      } else {
        await assertCriticalSchema(pool);
      }
    } catch (err: any) {
      if (lenient) {
        console.error('[Startup] Migration/verify error (lenient mode, continuing):', err.message);
      } else {
        console.error('[FATAL] Schema not current â€” aborting startup before listen():', err.message);
        console.error('[FATAL] Set LENIENT_SCHEMA_CHECK=1 to start anyway, or SKIP_AUTO_MIGRATIONS=1 to bypass entirely.');
        process.exit(1);
        return;
      }
    }
  }

  httpServer.listen(Number(PORT), '0.0.0.0', async () => {
  console.log('='.repeat(60));
  console.log('ðŸš€ JediRe Backend (Replit Edition)');
  console.log('='.repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log(`Server bound to 0.0.0.0:${PORT} (accessible externally)`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/api/v1`);
  console.log('='.repeat(60));

  // Embeddings layer (semantic memory): startup backfill + health probe,
  // followed by a periodic staleness sweep that re-embeds nodes whose
  // content has drifted (compared to the SHA256 hash in the cache).
  // Runs detached so it never delays the server from accepting traffic.
  (async () => {
    try {
      const { getPool } = await import('./database/connection');
      const { getEmbeddingsService } = await import('./services/neural-network/embeddings.service');
      const svc = getEmbeddingsService(getPool());
      await svc.ensureSweepHistoryTable();
      await svc.startupBackfillIfNeeded();
      await svc.healthCheck();

      // Periodic staleness sweep. Default: hourly. Override with
      // KG_REEMBED_INTERVAL_MS=0 to disable, or any positive ms value.
      const intervalMs = (() => {
        const raw = process.env.KG_REEMBED_INTERVAL_MS;
        if (!raw) return 60 * 60 * 1000;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) && n >= 0 ? n : 60 * 60 * 1000;
      })();

      if (intervalMs === 0) {
        console.log('[Embeddings] periodic staleness sweep DISABLED (KG_REEMBED_INTERVAL_MS=0)');
        return;
      }

      // Optional safety cap on the periodic sweep. Default = no cap (full
      // table). Set KG_REEMBED_MAX_PER_RUN to bound a single sweep when
      // the graph grows large enough that a full pass per hour is too much.
      const maxPerRun = (() => {
        const raw = process.env.KG_REEMBED_MAX_PER_RUN;
        if (!raw) return undefined;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })();

      // In-flight guard: if a previous sweep is still running when the
      // interval fires (large graph + slow OpenAI), skip this tick rather
      // than launching a duplicate sweep that doubles cost.
      let sweepInFlight = false;
      const runSweep = async () => {
        if (!svc.hasKey()) return;
        if (sweepInFlight) {
          console.log('[Embeddings] staleness sweep skipped â€” previous run still in flight');
          return;
        }
        sweepInFlight = true;
        const startedAt = new Date();
        const t0 = Date.now();
        try {
          const stats = await svc.reembedStale(
            maxPerRun ? { max: maxPerRun } : {}
          );
          const ms = Date.now() - t0;
          console.log(
            `[Embeddings] staleness sweep done in ${ms}ms: ` +
            `scanned=${stats.scanned} refreshed=${stats.refreshed} ` +
            `missing=${stats.missing} skipped=${stats.skipped} errors=${stats.errors}`
          );
          await svc.recordSweepRun({
            startedAt,
            durationMs: ms,
            stats,
          });
        } catch (err: any) {
          const ms = Date.now() - t0;
          const message = err?.message || String(err);
          console.warn('[Embeddings] staleness sweep failed:', message);
          await svc.recordSweepRun({
            startedAt,
            durationMs: ms,
            errorMessage: message,
          });
        } finally {
          sweepInFlight = false;
        }
      };

      console.log(`[Embeddings] staleness sweep scheduled every ${Math.round(intervalMs / 1000)}s`);
      const handle = setInterval(runSweep, intervalMs);
      // Keep the timer from preventing graceful shutdown
      if (typeof handle.unref === 'function') handle.unref();
    } catch (err) {
      console.warn('[Embeddings] startup hook skipped:', (err as any)?.message || err);
    }
  })();
  
  try {
    startM28Scheduler();
    emailSyncScheduler.start(15);
    console.log('Email sync scheduler started (every 15 minutes)');
  } catch (error) {
    console.error('Failed to start email sync scheduler:', error);
  }

  // Intake orchestrator worker — processes intake_jobs WHERE state='pending'
  // through the enrichment chain (other-docs check, municipal/web stubs).
  try {
    const { startIntakeWorker } = await import('./services/intake-orchestrator/worker');
    startIntakeWorker();
  } catch (error) {
    console.error('[intake-worker] Failed to start (non-fatal):', error);
  }

  // Task #329 Phase 2 â€” hourly poller for per-user authenticated RSS feeds.
  try {
    const { startRssPoller } = await import('./services/news-connections/rss-feeds');
    startRssPoller();
  } catch (error) {
    console.error('Failed to start news-connections RSS poller:', error);
  }

  // M35 Impact Measurement â€” nightly job (runs once a day at ~3:00 AM)
  try {
    const { runImpactMeasurementJob } = await import('./services/m35-impact.service');
    const scheduleM35ImpactJob = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(3, 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const msUntilRun = target.getTime() - now.getTime();
      setTimeout(async () => {
        try {
          const result = await runImpactMeasurementJob();
          console.log('[M35 Impact Job] Nightly run complete:', result);
        } catch (err) {
          console.error('[M35 Impact Job] Nightly run error:', err);
        }
        scheduleM35ImpactJob(); // reschedule for next day
      }, msUntilRun);
      console.log(`[M35 Impact Job] Scheduled for ${target.toISOString()}`);
    };
    scheduleM35ImpactJob();
  } catch (error) {
    console.error('[M35 Impact Job] Failed to schedule nightly job (non-fatal):', error);
  }

  try {
    const { runStartupPstBackflow } = await import('./services/pst-backflow.service');
    await runStartupPstBackflow();
  } catch (error) {
    console.error('PST backflow startup check failed (non-fatal):', error);
  }

  try {
    const { seedPeerCharacters } = await import('./services/sigma/peer-characters-seed');
    const m39Pool = getPool();
    const m39Result = await seedPeerCharacters(m39Pool);
    console.log(`[M39 Peer Intelligence] Character vectors loaded: ${m39Result.loaded} registered, ${m39Result.seeded} newly seeded`);
  } catch (error) {
    console.error('[M39 Peer Intelligence] Startup seed failed (non-fatal):', error);
  }

  try {
    const { initRateSheets } = await import('./services/tax/rateSheets/loader');
    initRateSheets();
  } catch (error) {
    console.error('[RateSheetLoader] Fatal: rate sheet validation failed at boot —', (error as Error).message);
    process.exit(1);
  }

  try {
    const { MetricCorrelationEngine } = await import('./services/metric-correlation-engine.service');
    const correlationPool = getPool();
    const correlationEngine = new MetricCorrelationEngine(correlationPool);
    correlationEngine.seedCorePairs().then(result => {
      console.log(`Correlation seeding complete: ${result.computed} computed, ${result.skipped} skipped`);
    }).catch(err => {
      console.error('Correlation seeding failed (non-fatal):', err);
    });
  } catch (error) {
    console.error('Correlation engine startup failed (non-fatal):', error);
  }

  try {
    const { CorrelationEngineService } = await import('./services/correlationEngine.service');
    const presetSeedPool = getPool();
    const presetSeedEngine = new CorrelationEngineService(presetSeedPool);
    presetSeedEngine.seedPresetStrategyCorrelations().then(result => {
      console.log(`Preset strategy correlation seeding: ${result.strategiesProcessed} strategies, ${result.correlationsComputed} correlations`);
    }).catch(err => {
      console.error('Preset strategy correlation seeding failed (non-fatal):', err);
    });
  } catch (error) {
    console.error('Preset correlation engine startup failed (non-fatal):', error);
  }

  try {
    const { LeadLagDiscoveryService } = await import('./services/leadLagDiscovery.service');
    const leadLagPool = getPool();
    const leadLagService = new LeadLagDiscoveryService(leadLagPool);
    const existingRes = await leadLagPool.query('SELECT COUNT(*) as cnt FROM metric_lead_lag_results');
    const existingCount = parseInt(existingRes.rows[0].cnt);
    if (existingCount === 0) {
      leadLagService.runDiscoveryPipeline('metro').then(async result => {
        console.log(`Lead/lag discovery pipeline: ${result.pairsProcessed} processed, ${result.pairsDiscovered} discovered, ${result.pairsSkipped} skipped`);
        try {
          const { applyEmpiricalLeadLag } = await import('./services/metricsCatalog.service');
          const overrides = await leadLagService.getEmpiricalCatalogOverrides();
          const applied = applyEmpiricalLeadLag(overrides);
          console.log(`Applied ${applied} empirical lead/lag overrides to metrics catalog`);
        } catch (e) {
          console.error('Failed to apply empirical overrides (non-fatal):', e);
        }
      }).catch(err => {
        console.error('Lead/lag discovery pipeline failed (non-fatal):', err);
      });
    } else {
      console.log(`Lead/lag discovery: ${existingCount} existing results, applying catalog overrides`);
      try {
        const { applyEmpiricalLeadLag } = await import('./services/metricsCatalog.service');
        const overrides = await leadLagService.getEmpiricalCatalogOverrides();
        const applied = applyEmpiricalLeadLag(overrides);
        console.log(`Applied ${applied} empirical lead/lag overrides to metrics catalog`);
      } catch (e) {
        console.error('Failed to apply empirical overrides (non-fatal):', e);
      }
    }
  } catch (error) {
    console.error('Lead/lag discovery startup failed (non-fatal):', error);
  }

  await initStripe();

  // M35 Phase 4: Nightly divergence tracking â€” fires at 2:00 AM UTC each day
  // Mirrors the fixed-time scheduling pattern used by the M35 impact job.
  function scheduleM35DivergenceJob() {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setUTCHours(2, 0, 0, 0);
    if (nextRun <= now) nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    const msUntilNextRun = nextRun.getTime() - now.getTime();

    const timer = setTimeout(async () => {
      try {
        const { runDivergenceTrackingJob } = await import('./services/m35-forecast.service');
        const result = await runDivergenceTrackingJob();
        console.log(`[M35 Divergence] Nightly check complete: ${result.checked} checked, ${result.diverged} diverged`);
      } catch (err) {
        console.error('[M35 Divergence] Nightly job failed (non-fatal):', err);
      }
      scheduleM35DivergenceJob(); // reschedule for tomorrow
    }, msUntilNextRun);
    timer.unref();
    console.log(`[M35 Divergence] Scheduled for ${nextRun.toISOString()}`);
  }
  scheduleM35DivergenceJob();

  // M35 Phase 5: monthly backtest â€” node-cron fires at 01:00 UTC on the 1st of each month.
  // node-cron avoids setTimeout overflow (max ~24.8 days) for month-length delays.
  cron.schedule('0 1 1 * *', async () => {
    try {
      const { runAllPendingBacktests } = await import('./services/m35-backtest.service');
      const result = await runAllPendingBacktests();
      console.log(`[M35 Backtest] Monthly run complete: ${JSON.stringify(result)}`);
    } catch (err) {
      console.error('[M35 Backtest] Monthly job failed (non-fatal):', err);
    }
  }, { timezone: 'UTC' });
  console.log('[M35 Backtest] Monthly job scheduled (cron: 0 1 1 * * UTC)');

  // Property Discovery: daily discovery + AL sync + matching
  const discoveryCron = process.env.DISCOVERY_CRON || '0 4 * * *';
  if (cron.validate(discoveryCron)) {
    cron.schedule(discoveryCron, async () => {
      try {
        console.log('[Property Discovery] Daily run startingâ€¦');
        const { getPropertyDiscoveryService } = await import('./services/property-enrichment/discovery/property-discovery.service');
        const { getPropertyMatcherService } = await import('./services/property-enrichment/matching/property-matcher.service');
        const { COUNTY_CONFIGS } = await import('./services/property-enrichment/property-info/county-configs');

        // 1) AL sync from legacy properties â†’ apartment_locator_properties
        //    (must run BEFORE matching so newly-onboarded AL rows are
        //    available to the matcher in the same daily cycle).
        try {
          const { syncApartmentLocatorTable } = await import('./services/property-enrichment/apartment-locator/sync-table.service');
          const stats = await syncApartmentLocatorTable({ minUnits: 50 });
          console.log(`[Property Discovery] AL synced inserted=${stats.inserted}, updated=${stats.updated}, source=${stats.source}`);
        } catch (e) {
          console.warn('[Property Discovery] AL sync failed:', (e as Error).message);
        }

        // 2) Discover-all: sweep every configured county.
        const discoverySvc = getPropertyDiscoveryService();
        let totalDiscovered = 0;
        for (const cfg of COUNTY_CONFIGS) {
          try {
            const r = await discoverySvc.discoverInCounty(cfg.county, cfg.state, { minUnits: 50 });
            totalDiscovered += r.propertiesFound || 0;
          } catch (e) {
            console.warn(`[Property Discovery] ${cfg.county}, ${cfg.state} failed:`, (e as Error).message);
          }
        }
        console.log(`[Property Discovery] Discovered ${totalDiscovered} properties`);

        // 3) Match per county
        const matcherSvc = getPropertyMatcherService();
        let totalMatched = 0;
        for (const cfg of COUNTY_CONFIGS) {
          try {
            const r = await matcherSvc.matchCounty(cfg.county, cfg.state);
            totalMatched += r.matched || 0;
          } catch (e) {
            console.warn(`[Property Discovery] match ${cfg.county}, ${cfg.state} failed:`, (e as Error).message);
          }
        }
        console.log(`[Property Discovery] Matched ${totalMatched} properties. Daily run complete.`);
      } catch (err) {
        console.error('[Property Discovery] Daily job failed (non-fatal):', err);
      }
    }, { timezone: 'UTC' });
    console.log(`[Property Discovery] Daily job scheduled (cron: ${discoveryCron} UTC)`);
  } else {
    console.warn(`[Property Discovery] Invalid DISCOVERY_CRON expression "${discoveryCron}", skipping schedule`);
  }

  // M35 Phase 4: drain forecast_regen_queue every minute (claims with SKIP LOCKED)
  setInterval(async () => {
    try {
      const { processForecastRegenQueue } = await import('./services/m35-forecast.service');
      await processForecastRegenQueue();
    } catch (err) { /* non-blocking */ }
  }, 60_000).unref();
  });
}

startServer().catch((err: any) => {
  console.error('[FATAL] Server startup failed:', err.message);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  try {
    emailSyncScheduler.stop();
    console.log('Email sync scheduler stopped');
  } catch (error) {
    console.error('Error stopping email sync scheduler:', error);
  }
  
  await pool.end();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, pool, io };
