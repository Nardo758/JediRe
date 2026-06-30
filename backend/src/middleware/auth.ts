/**
 * Authentication Middleware
 * Protect routes with JWT verification
 * Simplified: Only verifies JWT and sets req.user. No DB client held per-request.
 * Route handlers use getPool() directly for database access.
 */

import { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyAccessToken } from '../auth/jwt';
import { getPool } from '../database/connection';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    user_type?: 'human' | 'agent' | 'human_sponsor' | 'human_lp' | 'human_lender' | 'system';
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

  // Accept Bearer header OR ?token= query param (used by direct browser downloads)
  const token =
    extractTokenFromHeader(req.headers.authorization) ||
    (req.query?.token as string | undefined) ||
    null;

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
 * Require a specific capability.
 *
 * - Agent tokens: checked synchronously against JWT capabilities claim.
 * - Human users (human_sponsor | human_lp | human_lender | human): checked
 *   against the role-capability matrix (role_capabilities table) keyed by
 *   users.platform_role, with per-user overrides from user_capabilities as
 *   fallback. This is the same two-tier resolution as rbac.requireCapability
 *   but lives here so all protected routes can use a single, consistent import.
 *
 * Usage: router.post('/path', requireAuth, requireCapability('edit:capital_structure'), handler)
 */
export function requireCapability(required: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    // Agent tokens: verify against JWT-embedded capabilities claim.
    if (req.user.user_type === 'agent') {
      const caps = req.user.capabilities ?? [];
      if (!caps.includes(required) && !caps.includes('read:all') && !caps.includes('write:all')) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Agent lacks capability: ${required}`,
        });
        return;
      }
      next();
      return;
    }

    // Human users: resolve capability from role-capability matrix OR per-user override.
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT 1
         FROM users u
         WHERE u.id = $1
           AND (
             EXISTS (
               SELECT 1 FROM role_capabilities rc
               WHERE rc.platform_role = u.platform_role AND rc.capability = $2
             )
             OR EXISTS (
               SELECT 1 FROM user_capabilities uc
               WHERE uc.user_id = $1 AND uc.capability = $2
             )
           )`,
        [req.user.userId, required]
      );
      if (result.rows.length === 0) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Requires capability: ${required}`,
          capability: required,
        });
        return;
      }
      next();
    } catch (err) {
      console.error('[auth.requireCapability] DB error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
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

  if (process.env.API_KEY_ADMIN) {
    keyIdentities[process.env.API_KEY_ADMIN] = {
      userId: 'api-key-admin',
      email: 'admin-api@jedire.system',
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

// Compat export: legacy route files import `authMiddleware.requireAuth`.
// Only requireAuth is used via this object; all other functions are exported individually above.
export const authMiddleware = { requireAuth };

export function requireSurface(surface: 'chat' | 'web' | 'api') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    try {
      const { CreditService } = await import('../services/ai/creditService');
      const creditService = new CreditService();
      const balance = await creditService.getBalance(req.user.userId);

      if (!balance) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'No subscription found. Please complete onboarding.',
        });
        return;
      }

      if (!creditService.canAccessSurface(balance.subscriptionTier, surface)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Your ${balance.subscriptionTier} tier does not include access to the ${surface} surface. Upgrade to unlock.`,
        });
        return;
      }

      next();
    } catch (err) {
      console.error('[auth.requireSurface] error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
