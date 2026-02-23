/**
 * Health Check Endpoints
 * 
 * Monitoring endpoints for deployment platforms and uptime monitoring.
 * Used by Railway, Kubernetes, load balancers, etc.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import env from '../../config/environment';

const router = Router();

// Database pool for health checks (reuse existing connection)
let dbPool: Pool | null = null;

/**
 * Initialize database connection for health checks
 */
export function initHealthCheck(pool: Pool) {
  dbPool = pool;
}

/**
 * GET /health
 * 
 * Basic health check - server is alive and responding
 */
router.get('/health', async (req: Request, res: Response) => {
  const config = env.get();
  
  // Check database connection
  let databaseStatus = 'unknown';
  if (dbPool) {
    try {
      await dbPool.query('SELECT 1');
      databaseStatus = 'connected';
    } catch (error) {
      databaseStatus = 'disconnected';
    }
  }
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: config.appVersion,
    environment: config.nodeEnv,
    database: databaseStatus,
    uptime: process.uptime(),
  });
});

/**
 * GET /health/db
 * 
 * Detailed database health check with latency measurement
 */
router.get('/health/db', async (req: Request, res: Response) => {
  if (!dbPool) {
    return res.status(503).json({
      connected: false,
      error: 'Database pool not initialized',
    });
  }
  
  try {
    const start = Date.now();
    const result = await dbPool.query('SELECT NOW() as time, version() as version');
    const latency = Date.now() - start;
    
    res.status(200).json({
      connected: true,
      latency,
      timestamp: result.rows[0].time,
      version: result.rows[0].version,
    });
  } catch (error: any) {
    res.status(503).json({
      connected: false,
      error: error.message,
    });
  }
});

/**
 * GET /health/ready
 * 
 * Readiness check - is the service ready to accept traffic?
 * Checks all critical dependencies
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  const checks: { [key: string]: boolean } = {};
  let allHealthy = true;
  
  // Check database
  if (dbPool) {
    try {
      await dbPool.query('SELECT 1');
      checks.database = true;
    } catch (error) {
      checks.database = false;
      allHealthy = false;
    }
  } else {
    checks.database = false;
    allHealthy = false;
  }
  
  // Check if migrations have run (optional but recommended)
  if (dbPool && checks.database) {
    try {
      // Check if a key table exists (adjust to your schema)
      const result = await dbPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        )
      `);
      checks.migrations = result.rows[0].exists;
      if (!checks.migrations) {
        allHealthy = false;
      }
    } catch (error) {
      checks.migrations = false;
      allHealthy = false;
    }
  } else {
    checks.migrations = false;
  }
  
  // Check environment configuration
  try {
    const config = env.get();
    checks.config = !!config.jwtSecret && !!config.databaseUrl;
    if (!checks.config) {
      allHealthy = false;
    }
  } catch (error) {
    checks.config = false;
    allHealthy = false;
  }
  
  const statusCode = allHealthy ? 200 : 503;
  
  res.status(statusCode).json({
    ready: allHealthy,
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /health/live
 * 
 * Liveness check - is the service alive?
 * Used by Kubernetes to determine if container should be restarted
 */
router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
