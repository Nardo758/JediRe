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
import preferencesRouter from './api/rest/preferences.routes';
import propertyTypesRouter from './api/rest/property-types.routes';
import propertyTypeStrategiesRouter from './api/rest/property-type-strategies.routes';
import customStrategiesRouter from './api/rest/custom-strategies.routes';

import healthRouter from './api/rest/inline-health.routes';
import authRouter from './api/rest/inline-auth.routes';
import dataRouter from './api/rest/inline-data.routes';
import dealsRouter from './api/rest/inline-deals.routes';
import tasksRouter from './api/rest/inline-tasks.routes';
import inboxRouter from './api/rest/inline-inbox.routes';
import zoningAnalyzeRouter from './api/rest/inline-zoning-analyze.routes';
import { createApartmentSyncRoutes } from './api/rest/inline-apartment-sync.routes';
import { createMicrosoftInlineRoutes } from './api/rest/inline-microsoft.routes';

import { initializeApartmentLocatorIntegration } from './services/apartmentLocatorIntegration';
import { ApartmentDataSyncService } from './services/apartmentDataSync';

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
import apartmentMarketRoutes from './api/rest/apartmentMarket.routes';
import trafficPredictionRoutes from './api/rest/trafficPrediction.routes';
import propertyProxyRoutes from './api/rest/property-proxy.routes';
import marketIntelRoutes from './api/rest/marketIntel.routes';
import leasingTrafficRoutes from './api/rest/leasingTraffic.routes';
import moduleLibrariesRouter from './api/rest/module-libraries.routes';
import marketIntelligenceRouter from './api/rest/market-intelligence.routes';

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const httpServer = createServer(app);
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5000', 'http://0.0.0.0:5000'];
const allowedOriginPatterns = [/\.replit\.dev$/, /\.replit\.app$/];

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
app.use('/api/v1', dataRouter);
app.use('/api/v1/deals', dealsRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/inbox', inboxRouter);
app.use('/api/v1', zoningAnalyzeRouter);

initializeApartmentLocatorIntegration({
  baseUrl: process.env.APARTMENT_LOCATOR_API_URL || 'https://apartment-locator-ai-real.replit.app',
  timeout: 30000,
  apiKey: process.env.APARTMENT_LOCATOR_API_KEY || process.env.API_KEY_APARTMENT_LOCATOR,
});

const apartmentSyncService = new ApartmentDataSyncService(pool);
app.use('/api/v1/apartment-sync', createApartmentSyncRoutes(apartmentSyncService));

const microsoftConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:4000/api/v1/microsoft/auth/callback',
  scopes: ['User.Read', 'Mail.Read', 'Mail.Send', 'Calendars.Read', 'Calendars.ReadWrite']
};
app.use('/api/v1/microsoft', createMicrosoftInlineRoutes(microsoftConfig));

app.use('/api/v1/dashboard', requireAuth, dashboardRouter);
app.use('/api/v1/gmail', requireAuth, gmailRouter);
app.use('/api/v1/news', requireAuth, newsRouter);
app.use('/api/v1/trade-areas', requireAuth, tradeAreasRoutes);
app.use('/api/v1/isochrone', requireAuth, isochroneRoutes);
app.use('/api/v1/traffic-ai', requireAuth, trafficAiRoutes);
app.use('/api/v1', requireAuth, geographicContextRoutes);
app.use('/api/v1/deals', requireAuth, geographicContextRoutes);
app.use('/api/v1/map-configs', requireAuth, mapConfigsRouter);
app.use('/api/v1/grid', requireAuth, gridRouter);
app.use('/api/v1/modules', requireAuth, modulesRouter);
app.use('/api/v1/financial-models', requireAuth, financialModelsRouter);
app.use('/api/v1/strategy-analyses', requireAuth, strategyAnalysesRouter);
app.use('/api/v1/dd-checklists', requireAuth, ddChecklistsRouter);
app.use('/api/v1/market-research', requireAuth, marketResearchRoutes);
app.use('/api/v1/apartment-market', requireAuth, apartmentMarketRoutes);
app.use('/api/v1/market-intel', requireAuth, marketIntelRoutes);
app.use('/api/v1/traffic', requireAuth, trafficPredictionRoutes);
app.use('/api/v1', requireAuth, propertyProxyRoutes);
app.use('/api/v1/leasing-traffic', requireAuth, leasingTrafficRoutes);
app.use('/api/v1/preferences', requireAuth, preferencesRouter);
app.use('/api/v1/property-types', requireAuth, propertyTypesRouter);
app.use('/api/v1/property-type-strategies', requireAuth, propertyTypeStrategiesRouter);
app.use('/api/v1/custom-strategies', requireAuth, customStrategiesRouter);
app.use('/api/v1/module-libraries', requireAuth, moduleLibrariesRouter);
app.use('/api/v1/markets', marketIntelligenceRouter);

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

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

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
