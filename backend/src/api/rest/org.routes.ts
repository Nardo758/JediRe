import { Router, Response } from 'express';
import { z } from 'zod';
import * as crypto from 'crypto';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { requireOrgRole, requireOrgRoleForOrg, OrgAuthenticatedRequest } from '../../middleware/rbac';
import { emailService } from '../../services/email.service';

const router = Router();

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(255),
});

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['principal', 'analyst', 'viewer']).default('analyst'),
});

const UpdateRoleSchema = z.object({
  role: z.enum(['principal', 'analyst', 'viewer']),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const data = CreateOrgSchema.parse(req.body);
    const userId = req.user!.userId;
    const slug = slugify(data.name) + '-' + crypto.randomBytes(4).toString('hex');

    await client.query('BEGIN');

    const orgResult = await client.query(
      `INSERT INTO organizations (name, slug, owner_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.name, slug, userId]
    );
    const org = orgResult.rows[0];

    await client.query(
      `INSERT INTO org_members (org_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [org.id, userId]
    );

    await client.query('COMMIT');
    res.status(201).json(org);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  } finally {
    client.release();
  }
});

router.get('/mine', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT o.*, om.role as my_role
       FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = $1
       ORDER BY o.created_at ASC`,
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orgs:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/:orgId', requireAuth, requireOrgRoleForOrg('viewer'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM organizations WHERE id = $1', [req.params.orgId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Organization not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching org:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

router.get('/:orgId/members', requireAuth, requireOrgRoleForOrg('viewer'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT om.id, om.org_id, om.user_id, om.role, om.joined_at,
              u.email, u.full_name, u.first_name, u.last_name
       FROM org_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.org_id = $1
       ORDER BY om.joined_at ASC`,
      [req.params.orgId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

router.post('/:orgId/invitations', requireAuth, requireOrgRoleForOrg('principal'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const data = InviteMemberSchema.parse(req.body);
    const pool = getPool();
    const orgId = req.params.orgId;

    // Institutional-only gate: only orgs on the Institutional tier can invite members.
    const tierResult = await pool.query(
      `SELECT subscription_tier FROM org_credit_balances WHERE org_id = $1`,
      [orgId]
    );
    if (!tierResult.rows.length || tierResult.rows[0].subscription_tier !== 'institutional') {
      return res.status(403).json({ error: 'Team invitations are available on the Institutional tier only' });
    }

    // Fetch org name + inviter display name for the email (in parallel)
    const [orgResult, inviterResult] = await Promise.all([
      pool.query('SELECT name FROM organizations WHERE id = $1', [orgId]),
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(full_name), ''), email) AS display_name FROM users WHERE id = $1`,
        [req.user!.userId]
      ),
    ]);
    const orgName = (orgResult.rows[0]?.name as string) || 'your organization';
    const inviterName = (inviterResult.rows[0]?.display_name as string) || 'A teammate';

    const existingMember = await pool.query(
      `SELECT om.id FROM org_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.org_id = $1 AND u.email = $2`,
      [orgId, data.email]
    );
    if (existingMember.rows.length > 0) {
      return res.status(409).json({ error: 'User is already a member of this organization' });
    }

    const existingInvite = await pool.query(
      `SELECT id FROM org_invitations
       WHERE org_id = $1 AND email = $2 AND status = 'pending' AND expires_at > NOW()`,
      [orgId, data.email]
    );
    if (existingInvite.rows.length > 0) {
      return res.status(409).json({ error: 'Pending invitation already exists for this email' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO org_invitations (org_id, email, role, token, invited_by, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING *`,
      [orgId, data.email, data.role, token, req.user!.userId, expiresAt]
    );

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
    const baseUrl = `https://${domain}`;
    const acceptUrl = `${baseUrl}/accept-invite?token=${token}`;

    // Send invitation email — non-blocking, so email failures don't reject the invite creation.
    emailService.sendOrgInvitation({
      to: data.email,
      inviterName,
      orgName,
      acceptUrl,
      expiresAt: expiresAt.toISOString(),
    }).catch((err: Error) => {
      console.error('Failed to send org invitation email:', err);
    });

    res.status(201).json({
      ...result.rows[0],
      accept_url: acceptUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Error creating invitation:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

router.get('/:orgId/invitations', requireAuth, requireOrgRoleForOrg('analyst'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT oi.*, u.email as invited_by_email, u.full_name as invited_by_name
       FROM org_invitations oi
       JOIN users u ON u.id = oi.invited_by
       WHERE oi.org_id = $1
       ORDER BY oi.created_at DESC`,
      [req.params.orgId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

router.post('/invitations/:token/accept', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { token } = req.params;

    const invResult = await client.query(
      `SELECT * FROM org_invitations WHERE token = $1 AND status = 'pending' AND expires_at > NOW()`,
      [token]
    );

    if (invResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or expired' });
    }

    const invitation = invResult.rows[0];

    if (invitation.email.toLowerCase() !== req.user!.email.toLowerCase()) {
      return res.status(403).json({ error: 'This invitation was sent to a different email address' });
    }

    await client.query('BEGIN');

    const existingMember = await client.query(
      'SELECT id FROM org_members WHERE org_id = $1 AND user_id = $2',
      [invitation.org_id, req.user!.userId]
    );
    if (existingMember.rows.length > 0) {
      await client.query(
        `UPDATE org_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
        [invitation.id]
      );
      await client.query('COMMIT');
      return res.json({ message: 'Already a member of this organization' });
    }

    await client.query(
      `INSERT INTO org_members (org_id, user_id, role, invited_by)
       VALUES ($1, $2, $3, $4)`,
      [invitation.org_id, req.user!.userId, invitation.role, invitation.invited_by]
    );

    await client.query(
      `UPDATE org_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
      [invitation.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Invitation accepted', org_id: invitation.org_id });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  } finally {
    client.release();
  }
});

router.put('/:orgId/members/:memberId/role', requireAuth, requireOrgRoleForOrg('owner'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const data = UpdateRoleSchema.parse(req.body);
    const pool = getPool();
    const { orgId, memberId } = req.params;

    const memberResult = await pool.query(
      'SELECT * FROM org_members WHERE id = $1 AND org_id = $2',
      [memberId, orgId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (memberResult.rows[0].role === 'owner') {
      return res.status(400).json({ error: 'Cannot change the owner role' });
    }

    const result = await pool.query(
      `UPDATE org_members SET role = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3 RETURNING *`,
      [data.role, memberId, orgId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

router.delete('/:orgId/members/:memberId', requireAuth, requireOrgRoleForOrg('owner'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { orgId, memberId } = req.params;

    const memberResult = await pool.query(
      'SELECT * FROM org_members WHERE id = $1 AND org_id = $2',
      [memberId, orgId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (memberResult.rows[0].role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove the organization owner' });
    }

    await pool.query('DELETE FROM org_members WHERE id = $1 AND org_id = $2', [memberId, orgId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
