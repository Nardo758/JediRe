/**
 * JEDI RE Backend - Main Entry Point
 * Created: 2026-02-20
 * Consolidated index with all route registrations
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import env from './config/environment';

// Import route modules
import healthRoutes, { initHealthCheck } from './api/rest/health.routes';
import { createMarketIntelligenceRoutes } from './api/rest/market-intelligence.routes';
import inlineDealsRoutes from './api/rest/inline-deals.routes';
import inlineAuthRoutes from './api/rest/inline-auth.routes';
import inlineDataRoutes from './api/rest/inline-data.routes';
import inlineTasksRoutes from './api/rest/inline-tasks.routes';
import inlineInboxRoutes from './api/rest/inline-inbox.routes';
import { createMicrosoftInlineRoutes } from './api/rest/inline-microsoft.routes';
import inlineHealthRoutes from './api/rest/inline-health.routes';
import inlineZoningRoutes from './api/rest/inline-zoning-analyze.routes';
import propertyTypesRoutes from './api/rest/property-types.routes';
import gridRoutes from './api/rest/grid.routes';

// Middleware
import { authenticateToken, optionalAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

const app: Express = express();
const config = env.get();

// Database connection pool
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  } else {
    console.log('✅ Database connected:', res.rows[0].now);
  }
});

// Initialize health check with pool
initHealthCheck(pool);

// CORS configuration
const corsOptions = {
  origin: config.nodeEnv === 'production' 
    ? ['https://jedire.com', 'https://www.jedire.com']
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'JEDI RE API',
    version: config.appVersion,
    status: 'running',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// Health check routes (no auth required)
app.use('/', healthRoutes);
app.use('/api/v1', inlineHealthRoutes);

// Auth routes (no auth required)
app.use('/api/v1/auth', inlineAuthRoutes);

// Protected API routes (require authentication)
app.use('/api/v1/deals', authenticateToken, inlineDealsRoutes);
app.use('/api/v1/data', authenticateToken, inlineDataRoutes);
app.use('/api/v1/tasks', authenticateToken, inlineTasksRoutes);
app.use('/api/v1/inbox', authenticateToken, inlineInboxRoutes);
app.use('/api/v1/microsoft', authenticateToken, createMicrosoftInlineRoutes({
  clientId: process.env.MICROSOFT_CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  tenantId: process.env.MICROSOFT_TENANT_ID || '',
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || '',
  scopes: ['Mail.Read', 'Mail.Send', 'Calendars.Read'],
}));
app.use('/api/v1/zoning', authenticateToken, inlineZoningRoutes);
app.use('/api/v1/property-types', authenticateToken, propertyTypesRoutes);

// Grid routes (Pipeline & Assets Owned)
app.use('/api/v1/grid', gridRoutes);

// NEW: Market Intelligence routes (auth required for preferences, optional for data)
const marketIntelRoutes = createMarketIntelligenceRoutes(pool);
app.use('/api/v1/markets', optionalAuth, marketIntelRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Start server
const PORT = config.port || 3001;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║      JEDI RE Backend Server            ║
║                                        ║
║  🚀 Status: Running                    ║
║  🌐 Port: ${PORT}                        ║
║  📦 Environment: ${config.nodeEnv}        ║
║  🔗 Database: Connected                ║
║                                        ║
║  📍 API: http://localhost:${PORT}/api/v1  ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  await pool.end();
  process.exit(0);
});

export default app;
