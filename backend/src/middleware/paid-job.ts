/**
 * Gates for jobs that spend provider quota or org AI credits.
 * Platform-wide jobs (county ingest, graph refresh) are admin-only.
 * Caller-owned jobs (design generation, deal analysis chat) require a
 * session and stop when the org credit pool is already empty.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { createRateLimiter } from './rateLimit';
import { resolveOrgForUser } from '../services/ai/orgCreditService';
import { query } from '../database/connection';

export const paidJobLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: 'Too many paid job requests. Please wait before trying again.',
});

export function requirePaidJobAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  const role = req.user.role;
  if (role !== 'admin' && role !== 'service') {
    res.status(403).json({ success: false, error: 'Admin or service role required' });
    return;
  }
  next();
}

/**
 * Hard stop used by the agent runtime: an org with a credit row at or below
 * zero cannot start another paid call. No org row means there is no pool to
 * enforce (same rule as MeteringAdapter).
 */
export async function requireOrgCreditHeadroom(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  try {
    const orgId = await resolveOrgForUser(userId);
    if (!orgId) {
      next();
      return;
    }
    const gate = await query(
      `SELECT credits_remaining FROM org_credit_balances WHERE org_id = $1`,
      [orgId]
    );
    if (gate.rows.length > 0) {
      const remaining = parseFloat(gate.rows[0].credits_remaining ?? '0');
      if (remaining <= 0) {
        res.status(402).json({
          success: false,
          error: 'AI usage limit reached for this billing period.',
          creditsRemaining: remaining,
        });
        return;
      }
    }
    next();
  } catch (err: any) {
    console.error('[requireOrgCreditHeadroom] error:', err?.message);
    res.status(500).json({ success: false, error: 'Credit check failed' });
  }
}
