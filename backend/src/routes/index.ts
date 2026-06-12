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
