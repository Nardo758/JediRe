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
    user_type?: 'human' | 'agent';
    agent_id?: string;
    capabilities?: string[];
  };
}

// Extract API key from x-api-key header or Authorization: Bearer <key>.
// IMPORTANT: When the credential arrives via `Authorization: Bearer ...` we
// must distinguish opaque API keys from real JWTs — otherwise every browser
// JWT gets routed into the API-key validator and rejected as "Invalid API
// key" before the JWT verifier ever runs (the regression that caused the
// whole UI to 403). JWTs always have exactly 3 dot-separated segments
// (header.payload.signature); our env-var API keys are opaque random strings
// with no embedded dots. Anything that doesn't match the JWT shape is
// treated as an API-key candidate; JWT-shaped tokens are left for
// verifyAccessToken to handle in the normal JWT path.
function looksLikeJwt(token: string): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  // base64url segments — non-empty, alphanumeric/-/_ only.
  return parts.every(p => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p));
}

function extractApiKey(req: Request): string | null {
  const fromHeader = req.headers['x-api-key'] as string | undefined;
  if (fromHeader) return fromHeader;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    if (looksLikeJwt(token)) return null;
    return token;
  }
  return null;
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
  // Allow API key auth on any route that requires auth
  const apiKey = extractApiKey(req);
  if (apiKey) {
    return requireApiKey(req, res, next);
  }

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
 * Require a specific capability (for agent tokens).
 * Human users pass unconditionally — capability enforcement only applies to agent tokens.
 * Usage: router.post('/path', requireAuth, requireCapability('write:zoning_analysis'), handler)
 */
export function requireCapability(required: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    if (req.user.user_type === 'agent') {
      const caps = req.user.capabilities ?? [];
      if (!caps.includes(required) && !caps.includes('read:all') && !caps.includes('write:all')) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Agent lacks capability: ${required}`,
        });
        return;
      }
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
  const apiKey = extractApiKey(req);

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

  if (process.env.ROCKEMAN_API_KEY) {
    keyIdentities[process.env.ROCKEMAN_API_KEY] = {
      userId: 'c0c0a000-0000-4000-8000-000000000001',
      email: 'rockeman@jedire.system',
      role: 'admin',
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
  const apiKey = extractApiKey(req);
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
  requireCapability,
  requireApiKey,
};
