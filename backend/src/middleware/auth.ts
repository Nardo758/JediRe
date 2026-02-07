/**
 * Authentication Middleware
 * Protect routes with JWT verification
 * Sets RLS user context via dedicated client from shared pool
 */

import { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyAccessToken } from '../auth/jwt';
import { logger } from '../utils/logger';
import { getClient } from '../database/connection';
import { PoolClient } from 'pg';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
  dbClient?: PoolClient;
}

/**
 * Require authentication
 * Acquires a dedicated DB client, sets RLS user context within a transaction,
 * and attaches the client to the request for downstream handlers.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'No authentication token provided',
    });
    return;
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
    return;
  }

  let client: PoolClient | null = null;
  try {
    client = await getClient();
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', String(payload.userId)]);
    req.dbClient = client;
  } catch (error) {
    logger.error('Failed to set RLS user context:', error);
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      client.release();
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to establish database context',
    });
    return;
  }

  const releaseClient = async () => {
    const cl = req.dbClient;
    if (cl) {
      req.dbClient = undefined;
      try {
        await cl.query('COMMIT');
      } catch (err) {
        try { await cl.query('ROLLBACK'); } catch (_) {}
      } finally {
        try { cl.release(); } catch (_) {}
      }
    }
  };

  res.on('finish', releaseClient);
  res.on('close', releaseClient);

  req.user = payload;
  next();
}

/**
 * Optional authentication (don't fail if not authenticated)
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}

/**
 * Require specific role
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Requires role: ${roles.join(' or ')}`,
      });
      return;
    }

    next();
  };
}

export const authMiddleware = {
  requireAuth,
  optionalAuth,
  requireRole,
};
