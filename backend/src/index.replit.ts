/**
 * JediRe Backend - Replit Entry Point
 * Route handlers extracted to dedicated router modules
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { requireAuth } from './middleware/auth';
import { getPool } from './database/connection';
import { emailSyncScheduler } from './services/email-sync-scheduler';
import { createTrainingRoutes } from './api/rest/training.routes';
import { createCalibrationRoutes } from './api/rest/calibration.routes';
import { createCapsuleRoutes } from './api/rest/capsule.routes';
import zoningTriangulationRouter from './api/rest/zoning-triangulation.routes';
import preferencesRouter from './api/rest/preferences.routes';
import propertyTypesRouter from './api/rest/property-types.routes';
import propertyTypeStrategiesRouter from './api/rest/property-type-strategies.routes';
import customStrategiesRouter from './api/rest/custom-strategies.routes';
import f40PerformanceRoutes from './api/rest/f40-performance.routes';
import opportunityEngineRoutes from './api/rest/opportunity-engine.routes';

import healthRouter from './api/rest/inline-health.routes';
import authRouter from './api/rest/inline-auth.routes';
import dataRouter from './api/rest/inline-data.routes';
import dealsRouter from './api/rest/inline-deals.routes';
import tasksRouter from './api/rest/inline-tasks.routes';
import inboxRouter from './api/rest/inline-inbox.routes';
import zoningAnalyzeRouter from './api/rest/inline-zoning-analyze.routes';
import { createMicrosoftInlineRoutes } from './api/rest/inline-microsoft.routes';

import newsRouter from './api/rest/news.routes';
import tradeAreasRoutes from './api/rest/trade-areas.routes';
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
import marketResearchRoutes from './api/rest/marketResearch.routes';
import supplyRoutes from './api/rest/supply.routes';
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
import propertyBoundaryRouter from './api/rest/property-boundary.routes';
import siteIntelligenceRouter from './api/rest/site-intelligence.routes';
import zoningCapacityRouter from './api/rest/zoning-capacity.routes';
import teamManagementRouter from './api/rest/team-management.routes';
import contactsSyncRouter from './api/rest/contacts-sync.routes';
import contextTrackerRouter from './api/rest/context-tracker.routes';
import { createZoningIntelligenceRoutes } from './api/rest/zoning-intelligence.routes';
import { createZoningLearningRoutes } from './api/rest/zoning-learning.routes';
import zoningVerificationRouter from './api/rest/zoning-verification.routes';
import zoningProfileRouter from './api/rest/zoning-profile.routes';
import developmentScenariosRouter from './api/rest/development-scenarios.routes';
import moduleWiringRouter from './api/rest/module-wiring.routes';
import capitalStructureRouter from './api/rest/capital-structure.routes';
import dataUploadRouter from './api/rest/data-upload.routes';
import uploadTemplatesRouter from './api/rest/upload-templates.routes';
import uploadRouter from './api/rest/upload.routes';
import compQueryRouter from './api/rest/comp-query.routes';
import proformaGeneratorRouter from './api/rest/proforma-generator.routes';
import proformaRouter from './api/rest/proforma.routes';
import benchmarkTimelineRouter from './api/rest/benchmark-timeline.routes';
import adminApiKeyRouter from './api/rest/admin-api-key.routes';
import entitlementRouter from './api/rest/entitlement.routes';
import regulatoryAlertRouter from './api/rest/regulatory-alert.routes';
import municodeRouter from './api/rest/municode.routes';
import designReferencesRouter from './api/rest/design-references.routes';
import financialModelRouter from './api/rest/financial-model.routes';
import financialDashboardRouter from './api/rest/financial-dashboard.routes';
import visibilityRouter from './api/rest/visibility.routes';
import propertyAnalyticsRouter from './api/rest/property-analytics.routes';
import trafficDataRouter from './api/rest/traffic-data.routes';
import trafficCompsRouter from './api/rest/traffic-comps.routes';
import correlationRouter from './api/rest/correlation.routes';
import rankingsRouter from './api/rest/rankings.routes';
import competitionRouter from './api/rest/competition.routes';
import dealMarketIntelligenceRoutes from './api/rest/deal-market-intelligence.routes';
import dealCompSetsRoutes from './api/rest/deal-comp-sets.routes';
import dealPhotosRoutes from './api/rest/deal-photos.routes';
import dealContextRoutes from './api/rest/deal-context.routes';
import financialModelRoutes from './api/rest/financial-model.routes';
import clawdbotWebhooksRouter from './api/rest/clawdbot-webhooks.routes';
import m26TaxRouter from './api/rest/m26-tax.routes';
import m27CompsRouter from './api/rest/m27-comps.routes';
import m28CycleIntelligenceRoutes from './api/rest/m28-cycle-intelligence.routes';
import { createUnitMixRoutes } from './api/rest/unitMix.routes';
import dealValidationRoutes from './api/rest/deal-validation.routes';
import unitMixPropagationRoutes from './api/rest/unit-mix-propagation.routes';
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
  if (allowedOrigins.includes(origin)) return true;
  return allowedOriginPatterns.some(pattern => pattern.test(origin));
}

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

const PORT = process.env.PORT || 3000;

const pool = getPool();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
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
import adminRouter from './api/rest/admin.routes';
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/admin-api', adminApiKeyRouter);

app.use('/api/v1', dataRouter);
app.use('/api/v1/deals', dealsRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/inbox', inboxRouter);
app.use('/api/v1', zoningAnalyzeRouter);

app.use('/api/v1/f40', f40PerformanceRoutes);
app.use('/api/v1/opportunities', opportunityEngineRoutes);

const microsoftConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:4000/api/v1/microsoft/auth/callback',
  scopes: ['User.Read', 'Mail.Read', 'Mail.Send', 'Calendars.Read', 'Calendars.ReadWrite']
};
app.use('/api/v1/microsoft', createMicrosoftInlineRoutes(microsoftConfig));

app.use('/api/v1/clawdbot', clawdbotWebhooksRouter);
app.use('/api/v1', m26TaxRouter);
app.use('/api/v1', m27CompsRouter);
app.use('/api/v1/cycle-intelligence', m28CycleIntelligenceRoutes);

import taxCompAnalysisRouter from './api/rest/tax-comp-analysis.routes';
app.use('/api/v1', taxCompAnalysisRouter);

app.use('/api/v1/markets', marketIntelligenceRouter(pool));
app.use('/api/v1/markets', createEnhancedMarketIntelligenceRoutes(pool));

// Building Envelope - requires auth
import buildingEnvelopeRoutes from './api/rest/building-envelope.routes';
app.use('/api/v1', requireAuth, buildingEnvelopeRoutes);

app.use('/api/v1/dashboard', requireAuth, dashboardRouter);
app.use('/api/v1/gmail', requireAuth, gmailRouter);
app.use('/api/v1/news', requireAuth, newsRouter);
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

// Phase 10: Cross-Module Validation
app.use('/api/v1/deals', requireAuth, dealValidationRoutes);

// Phase 11: Unit Mix Propagation
app.use('/api/v1/deals', requireAuth, unitMixPropagationRoutes);
app.use('/api/v1/deals', requireAuth, competitionRouter);
app.use('/api/v1/deals', requireAuth, proformaRouter);
app.use('/api/v1/map-configs', requireAuth, mapConfigsRouter);
app.use('/api/v1/grid', requireAuth, gridRouter);
app.use('/api/v1/modules', requireAuth, modulesRouter);
app.use('/api/v1/financial-models', requireAuth, financialModelsRouter);
app.use('/api/v1/strategy-analyses', requireAuth, strategyAnalysesRouter);
app.use('/api/v1/dd-checklists', requireAuth, ddChecklistsRouter);
app.use('/api/v1/market-research', requireAuth, marketResearchRoutes);
app.use('/api/v1', requireAuth, supplyRoutes);
app.use('/api/v1', requireAuth, demandRoutes);
app.use('/api/v1/traffic', requireAuth, trafficPredictionRoutes);
app.use('/api/v1', requireAuth, propertyProxyRoutes);
app.use('/api/v1/leasing-traffic', requireAuth, leasingTrafficRoutes);
app.use('/api/v1/preferences', requireAuth, preferencesRouter);
app.use('/api/v1/property-types', requireAuth, propertyTypesRouter);
app.use('/api/v1/property-type-strategies', requireAuth, propertyTypeStrategiesRouter);
app.use('/api/v1/custom-strategies', requireAuth, customStrategiesRouter);
app.use('/api/v1/module-libraries', requireAuth, moduleLibrariesRouter);
app.use('/api/v1/property-metrics', requireAuth, createPropertyMetricsRouter(pool));
app.use('/api/v1/property-scoring', requireAuth, createPropertyScoringRouter(pool));
app.use('/api/v1/opus', requireAuth, createOpusRoutes(pool));
app.use('/api/v1/data-library', requireAuth, createDataLibraryRoutes(pool));
app.use('/api/v1', requireAuth, propertyBoundaryRouter);
app.use('/api/v1', requireAuth, siteIntelligenceRouter);
app.use('/api/v1', requireAuth, zoningCapacityRouter);
app.use('/api/v1/zoning-intelligence', requireAuth, createZoningIntelligenceRoutes(pool));
app.use('/api/v1/zoning-learning', requireAuth, createZoningLearningRoutes(pool));
app.use('/api/v1/zoning-verification', requireAuth, zoningVerificationRouter);
app.use('/api/v1', requireAuth, zoningProfileRouter);
app.use('/api/v1', requireAuth, developmentScenariosRouter);
app.use('/api/v1', requireAuth, teamManagementRouter);
app.use('/api/v1', requireAuth, contactsSyncRouter);
app.use('/api/v1/context', requireAuth, contextTrackerRouter);
app.use('/api/v1/module-wiring', requireAuth, moduleWiringRouter);
app.use('/api/v1/capital-structure', requireAuth, capitalStructureRouter);
app.use('/api/v1/properties', requireAuth, dataUploadRouter);
app.use('/api/v1/upload-templates', requireAuth, uploadTemplatesRouter);
app.use('/api/v1/uploads', requireAuth, uploadRouter);
app.use('/api/v1/comps', requireAuth, compQueryRouter);
app.use('/api/v1/properties', requireAuth, proformaGeneratorRouter);
app.use('/api/v1/benchmark-timeline', requireAuth, benchmarkTimelineRouter);
app.use('/api/v1/entitlements', requireAuth, entitlementRouter);
app.use('/api/v1/regulatory-alerts', requireAuth, regulatoryAlertRouter);
app.use('/api/v1/municode', requireAuth, municodeRouter);
app.use('/api/v1/design-references', requireAuth, designReferencesRouter);
app.use('/api/v1/financial-model', requireAuth, financialModelRouter);
app.use('/api/v1/financial-dashboard', requireAuth, financialDashboardRouter);
app.use('/api/v1/visibility', requireAuth, visibilityRouter);
app.use('/api/v1/property-analytics', requireAuth, propertyAnalyticsRouter);
app.use('/api/v1/traffic-data', requireAuth, trafficDataRouter);
app.use('/api/v1/traffic-comps', requireAuth, trafficCompsRouter);
app.use('/api/v1/correlations', requireAuth, correlationRouter);
app.use('/api/v1/rankings', requireAuth, rankingsRouter);
app.use('/api/v1', requireAuth, zoningTriangulationRouter);

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

app.use('/api/training', requireAuth, createTrainingRoutes(pool));
app.use('/api/calibration', requireAuth, createCalibrationRoutes(pool));
app.use('/api/capsules', requireAuth, createCapsuleRoutes(pool));

const activeUsers = new Map<string, any>();

io.on('connection', (socket) => {
  console.log(`WebSocket connected: ${socket.id}`);
  
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
  
  socket.on('disconnect', () => {
    console.log(`WebSocket disconnected: ${socket.id}`);
    activeUsers.delete(socket.id);
    io.emit('users:update', Array.from(activeUsers.values()));
  });
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
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

setupUnhandledRejectionHandler();
setupUncaughtExceptionHandler();

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('🚀 JediRe Backend (Replit Edition)');
  console.log('='.repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log(`Server bound to 0.0.0.0:${PORT} (accessible externally)`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/api/v1`);
  console.log('='.repeat(60));
  
  try {
    startM28Scheduler();
    emailSyncScheduler.start(15);
    console.log('Email sync scheduler started (every 15 minutes)');
  } catch (error) {
    console.error('Failed to start email sync scheduler:', error);
  }
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
