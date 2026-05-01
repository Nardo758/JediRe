import { Response, NextFunction } from 'express';
import { getPool } from '../database/connection';
import { AuthenticatedRequest } from './auth';

/**
 * Resolve a user's set of organization_id memberships.
 * Returns an empty array if the user has no memberships.
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

/**
 * Express middleware: enforce that `req.user` is authenticated AND a member
 * of the organization that owns the deal at `req.params.dealId`.
 *
 * Tier-2 §13 + §3 audit-integrity: every write to deal-scoped audit/version
 * state passes through this gate so a JWT-holder cannot poison another
 * tenant's deal by guessing UUIDs.
 *
 * Failure modes:
 *   - 401 if no authenticated user (caller forgot requireAuth upstream)
 *   - 404 if the deal does not exist
 *   - 403 if the user has no membership matching the deal's organization_id
 *   - 403 if the deal has no organization_id and the user is not the creator
 */
export async function requireDealAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req.user as any)?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  const dealId = req.params.dealId;
  if (!dealId) {
    res.status(400).json({ success: false, error: 'dealId path parameter required' });
    return;
  }

  try {
    const pool = getPool();
    const r = await pool.query<{ organization_id: string | null; user_id: string | null }>(
      `SELECT organization_id, user_id FROM deals WHERE id = $1`,
      [dealId]
    );
    if (r.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
    }
    const { organization_id, user_id: ownerUserId } = r.rows[0];

    if (organization_id) {
      const memberOrgs = await getUserOrganizationIds(userId);
      if (!memberOrgs.includes(organization_id)) {
        res.status(403).json({ success: false, error: 'Forbidden: not a member of deal organization' });
        return;
      }
    } else {
      // Legacy/un-orged deal: only the creator may access. Fail closed if
      // user_id is also NULL — orphan deals with no owner are NOT publicly
      // writable; a tenant-bound owner must claim them before access works.
      if (!ownerUserId || ownerUserId !== userId) {
        res.status(403).json({ success: false, error: 'Forbidden: not the deal creator' });
        return;
      }
    }
    next();
  } catch (err: any) {
    console.error('[requireDealAccess] error:', err?.message);
    res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
}
