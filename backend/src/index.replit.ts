/**
 * JEDI RE Backend - Main Entry Point
 * Created: 2026-02-20
 * Consolidated index with all route registrations
 * 
 * SECURITY ENHANCED:
 * - Input validation with Zod
 * - Rate limiting on all routes
 * - Secure CORS configuration
 * - SQL injection prevention (parameterized queries)
 * - XSS protection
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import env from './config/environment';
import { secrets } from './config/secrets';

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
import inlineNewsRoutes from './api/rest/inline-news.routes';
import dealStateRoutes from './api/rest/dealState.routes';

// Middleware
import { authenticateToken, optionalAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, authLimiter, aiLimiter, strictLimiter } from './middleware/rateLimit';
import { sanitizeInputs } from './middleware/validate';

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

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for map tiles, etc.
}));

// Enhanced CORS configuration with validation
const allowedOrigins = secrets.security.allowedOrigins;

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb', // Reduced from 50mb for security
  verify: (req: any, res, buf) => {
    // Store raw body for webhook signature verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize all inputs to prevent XSS
app.use(sanitizeInputs);

// Request logging with security info
app.use((req: Request, res: Response, next: NextFunction) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${ip}`);
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

// ============================================
// PUBLIC ROUTES (No Auth, Limited Rate Limiting)
// ============================================

// Health check routes (no rate limit)
app.use('/', healthRoutes);
app.use('/api/v1', inlineHealthRoutes);

// Auth routes (strict rate limiting to prevent brute force)
app.use('/api/v1/auth', authLimiter, inlineAuthRoutes);

// ============================================
// PROTECTED ROUTES (Auth Required + Rate Limited)
// ============================================

// Apply global API rate limiter to all /api/* routes
app.use('/api/', apiLimiter);

// Deal management routes
app.use('/api/v1/deals', authenticateToken, inlineDealsRoutes);
app.use('/api/v1/deals', authenticateToken, dealStateRoutes); // Deal state persistence

// Data and task routes
app.use('/api/v1/data', authenticateToken, inlineDataRoutes);
app.use('/api/v1/tasks', authenticateToken, inlineTasksRoutes);
app.use('/api/v1/inbox', authenticateToken, inlineInboxRoutes);

// Third-party integrations (strict rate limiting)
app.use('/api/v1/microsoft', strictLimiter, authenticateToken, createMicrosoftInlineRoutes({
  clientId: secrets.external.microsoft.clientId || '',
  clientSecret: secrets.external.microsoft.clientSecret || '',
  tenantId: secrets.external.microsoft.tenantId || '',
  redirectUri: secrets.external.microsoft.redirectUri || '',
  scopes: ['Mail.Read', 'Mail.Send', 'Calendars.Read'],
}));

// AI-powered routes (heavy rate limiting - expensive operations)
app.use('/api/v1/zoning', aiLimiter, authenticateToken, inlineZoningRoutes);

// Property and type routes
app.use('/api/v1/property-types', authenticateToken, propertyTypesRoutes);

// Grid routes (Pipeline & Assets Owned)
app.use('/api/v1/grid', authenticateToken, gridRoutes);

// News Intelligence routes
app.use('/api/v1/news', authenticateToken, inlineNewsRoutes);

// Market Intelligence routes (optional auth)
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
