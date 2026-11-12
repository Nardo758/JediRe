import { Response, NextFunction, Router } from 'express';
import { getPool } from '../database/connection';
import { AuthenticatedRequest } from './auth';
import { assertDealOrgAccess } from '../services/deal-scoping.service';

/**
 * Resolve a user's set of organization_id memberships.
 * Returns an empty array if the user has no memberships.
 *
 * Legacy helper retained for callers that still read the older
 * organization_members table. Deal access itself goes through
 * assertDealOrgAccess (deals.org_id + org_members).
 */
export async function getUserOrganizationIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const pool = getPool();
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id FROM organization_members WHERE user_id = $1`,
    [userId]
  );
  return r.rows.map((row) => row.organization_id).filter(Boolean);
}

function dealIdFromRequest(req: AuthenticatedRequest, source: 'param' | 'body'): string | undefined {
  if (source === 'param') {
    const fromParam = req.params?.dealId;
    return typeof fromParam === 'string' && fromParam.length > 0 ? fromParam : undefined;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const raw = body.dealId ?? body.deal_id;
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

/**
 * Refuse the request unless the caller can access the deal.
 * Same rule as agent runs: deals.org_id matches the caller's org, or the
 * deal has no org and the caller is the legacy creator. Missing and
 * forbidden both answer 404 so the id is not confirmed to another org.
 */
export function requireDealAccessFrom(source: 'param' | 'body') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    const dealId = dealIdFromRequest(req, source);
    if (!dealId) {
      res.status(400).json({ success: false, error: 'dealId is required' });
      return;
    }

    try {
      const deal = await assertDealOrgAccess(dealId, userId, getPool());
      if (!deal) {
        res.status(404).json({ success: false, error: 'Deal not found' });
        return;
      }
      next();
    } catch (err: any) {
      console.error('[requireDealAccess] error:', err?.message);
      res.status(500).json({ success: false, error: 'Authorization check failed' });
    }
  };
}

export const requireDealAccess = requireDealAccessFrom('param');
export const requireDealBodyAccess = requireDealAccessFrom('body');

/** Gate every :dealId route on this router. Does not affect routes without that param. */
export function bindDealParam(router: Router): void {
  router.param('dealId', (req, res, next) => {
    void requireDealAccess(req as AuthenticatedRequest, res, next);
  });
}

/**
 * Routes keyed by deal_scenarios.id. Resolves the parent deal, then applies
 * the same org check.
 */
export async function requireScenarioDealAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const scenarioId = req.params?.scenarioId;
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  if (!scenarioId) {
    res.status(400).json({ success: false, error: 'scenarioId is required' });
    return;
  }
  try {
    const pool = getPool();
    const found = await pool.query<{ deal_id: string }>(
      `SELECT deal_id FROM deal_scenarios WHERE id = $1`,
      [scenarioId]
    );
    if (found.rows.length === 0 || !found.rows[0].deal_id) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
    }
    req.params.dealId = found.rows[0].deal_id;
    await requireDealAccess(req, res, next);
  } catch (err: any) {
    console.error('[requireScenarioDealAccess] error:', err?.message);
    res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
}
