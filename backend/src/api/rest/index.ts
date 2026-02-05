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
import mapsRoutes from './maps.routes';
import proposalsRoutes from './proposals.routes';
import notificationsRoutes from './notifications.routes';
import pipelineRoutes from './pipeline';
import { notFoundHandler } from '../../middleware/errorHandler';

const API_PREFIX = '/api/v1';

export function setupRESTRoutes(app: Application): void {
  // Authentication routes
  app.use(`${API_PREFIX}/auth`, authRoutes);

  // User preferences routes
  app.use(`${API_PREFIX}/preferences`, preferencesRoutes);

  // Property extraction routes
  app.use(`${API_PREFIX}/extractions`, extractionsRoutes);

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

  // 404 handler for API routes
  app.use(`${API_PREFIX}/*`, notFoundHandler);
}
