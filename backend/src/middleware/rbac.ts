import { Response, NextFunction } from 'express';
import { getPool } from '../database/connection';
import { AuthenticatedRequest } from './auth';

export interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: 'owner' | 'principal' | 'analyst' | 'viewer';
}

export interface OrgAuthenticatedRequest extends AuthenticatedRequest {
  orgMember?: OrgMember;
}

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4,
  principal: 3,
  analyst: 2,
  viewer: 1,
};

export function requireOrgRole(...roles: string[]) {
  return async (req: OrgAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT om.id, om.org_id, om.user_id, om.role
         FROM org_members om
         WHERE om.user_id = $1
         ORDER BY om.joined_at ASC
         LIMIT 1`,
        [req.user.userId]
      );

      if (result.rows.length === 0) {
        res.status(403).json({ error: 'Forbidden', message: 'Not a member of any organization' });
        return;
      }

      const member = result.rows[0];
      req.orgMember = {
        id: member.id,
        orgId: member.org_id,
        userId: member.user_id,
        role: member.role,
      };

      const hasRole = roles.some(r => ROLE_HIERARCHY[member.role] >= ROLE_HIERARCHY[r]);
      if (!hasRole) {
        res.status(403).json({ error: 'Forbidden', message: `Requires role: ${roles.join(' or ')}` });
        return;
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function requireOrgRoleForOrg(...roles: string[]) {
  return async (req: OrgAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const orgId = req.params.orgId;
    if (!orgId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT om.id, om.org_id, om.user_id, om.role
         FROM org_members om
         WHERE om.user_id = $1 AND om.org_id = $2`,
        [req.user.userId, orgId]
      );

      if (result.rows.length === 0) {
        res.status(403).json({ error: 'Forbidden', message: 'Not a member of this organization' });
        return;
      }

      const member = result.rows[0];
      req.orgMember = {
        id: member.id,
        orgId: member.org_id,
        userId: member.user_id,
        role: member.role,
      };

      const hasRole = roles.some(r => ROLE_HIERARCHY[member.role] >= ROLE_HIERARCHY[r]);
      if (!hasRole) {
        res.status(403).json({ error: 'Forbidden', message: `Requires role: ${roles.join(' or ')}` });
        return;
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * requireCapability(capability)
 *
 * Two-tier capability resolution (Task #878):
 *
 * 1. Role-capability matrix (role_capabilities table):
 *    Resolved from the user's platform_role. This is the primary, role-level
 *    grant and is always checked first.
 *
 * 2. Per-user override (user_capabilities table):
 *    Supports ad-hoc grants (e.g. admin-granted custom access). Checked as a
 *    fallback so that individual overrides remain effective.
 *
 * A user has the capability if EITHER lookup returns a row.
 *
 * LP and lender users have no edit:capital_structure / edit:operating_assumptions
 * in their role matrix, so those routes return 403 for them unless an explicit
 * per-user override was inserted.
 */
export function requireCapability(capability: string) {
  return async (req: OrgAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const pool = getPool();
      // Check role-capability matrix OR per-user override in one round-trip.
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
        [req.user.userId, capability]
      );
      if (result.rows.length === 0) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Requires capability: ${capability}`,
          capability,
        });
        return;
      }
      next();
    } catch (error) {
      console.error('Capability middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function requireDealPermission(...perms: string[]) {
  return async (req: OrgAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const dealId = req.params.dealId || req.params.id;
    if (!dealId) {
      res.status(400).json({ error: 'Deal ID required' });
      return;
    }

    try {
      const pool = getPool();
      const dealResult = await pool.query(
        'SELECT org_id, user_id FROM deals WHERE id = $1',
        [dealId]
      );

      if (dealResult.rows.length === 0) {
        res.status(404).json({ error: 'Deal not found' });
        return;
      }

      const deal = dealResult.rows[0];

      if (deal.user_id === req.user.userId) {
        next();
        return;
      }

      if (deal.org_id) {
        const memberResult = await pool.query(
          'SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2',
          [deal.org_id, req.user.userId]
        );

        if (memberResult.rows.length > 0) {
          const role = memberResult.rows[0].role;
          const permMap: Record<string, string[]> = {
            read: ['viewer', 'analyst', 'principal', 'owner'],
            write: ['analyst', 'principal', 'owner'],
            delete: ['principal', 'owner'],
            admin: ['owner'],
          };

          const hasAllPerms = perms.every(p => (permMap[p] || []).includes(role));
          if (hasAllPerms) {
            req.orgMember = {
              id: memberResult.rows[0].id || '',
              orgId: deal.org_id,
              userId: req.user.userId,
              role,
            };
            next();
            return;
          }
        }
      }

      res.status(403).json({ error: 'Forbidden', message: 'Insufficient deal permissions' });
    } catch (error) {
      console.error('Deal permission middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
