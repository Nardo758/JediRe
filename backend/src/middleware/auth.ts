/**
 * Authentication Middleware
 * Protect routes with JWT verification
 * Simplified: Only verifies JWT and sets req.user. No DB client held per-request.
 * Route handlers use getPool() directly for database access.
 */

import { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyAccessToken } from '../auth/jwt';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Require authentication
 * Verifies JWT token and sets req.user. No per-request DB client acquisition.
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

  const keyIdentities: Record<string, { userId: string; email: string; role: string }> = {};

  if (process.env.API_KEY_APARTMENT_LOCATOR) {
    keyIdentities[process.env.API_KEY_APARTMENT_LOCATOR] = {
      userId: 'api-key-apartment-locator',
      email: 'apartment-locator-ai@system',
      role: 'api_client',
    };
  }

  if (process.env.JEDIRE_AGENT_API_KEY) {
    keyIdentities[process.env.JEDIRE_AGENT_API_KEY] = {
      userId: 'jedire-user-agent',
      email: 'user-agent@jedire.system',
      role: 'agent_client',
    };
  }

  const identity = keyIdentities[apiKey];
  if (!identity) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
    return;
  }

  req.user = identity;
  next();
}

/**
 * Accept either JWT auth or API key auth
 */
export async function requireAuthOrApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    return requireApiKey(req, res, next);
  }

  return requireAuth(req, res, next);
}

export const authenticateToken = requireAuth;

export const authMiddleware = {
  requireAuth,
  optionalAuth,
  requireRole,
  requireApiKey,
};
