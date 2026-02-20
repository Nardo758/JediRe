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
 * Verifies JWT and attaches user payload to request.
 * Route handlers use getPool() for queries; no per-request client is held.
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

/**
 * Require API Key (for external integrations)
 * Checks X-API-Key header against allowed API keys
 */
export function requireApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required',
    });
    return;
  }

  // List of valid API keys (from environment)
  const validKeys = [
    process.env.API_KEY_APARTMENT_LOCATOR,
  ].filter(Boolean);

  if (!validKeys.includes(apiKey)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
    return;
  }

  // Set a pseudo-user for API key auth (for logging/tracking)
  req.user = {
    userId: 'api-key-apartment-locator',
    email: 'apartment-locator-ai@system',
    role: 'api_client',
  };

  next();
}

export const authMiddleware = {
  requireAuth,
  optionalAuth,
  requireRole,
  requireApiKey,
};
