import { Router, Response } from 'express';
import { z } from 'zod';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logActivity } from '../../services/activity-log.service';
import { getDealActivity, getOrgActivity } from '../../services/activity-log.service';

const router = Router();

async function verifyDealAccess(dealId: string, userId: string): Promise<boolean> {
  try {
    // B4a: org-scoped access check
    const pool = getPool();
    const { assertDealOrgAccess } = await import('../../services/deal-scoping.service');
    const deal = await assertDealOrgAccess(dealId, userId, pool);
    return !!deal;
  } catch {
    return false;
  }
}

async function verifyDealPermission(dealId: string, userId: string, minLevel: string): Promise<boolean> {
  const levels: Record<string, number> = { view: 1, comment: 2, edit: 3, admin: 4 };
  const pool = getPool();
  // B4a: org-scoped owner check
  const { assertDealOrgAccess } = await import('../../services/deal-scoping.service');
  const ownerCheck = await assertDealOrgAccess(dealId, userId, pool);
  if (ownerCheck) return true;
  const memberCheck = await pool.query(
    'SELECT permission_level FROM deal_team_members WHERE deal_id = $1 AND user_id = $2 AND status = $3',
    [dealId, userId, 'active']
  );
  if (memberCheck.rows.length === 0) return false;
  return (levels[memberCheck.rows[0].permission_level] || 0) >= (levels[minLevel] || 0);
}

const AddCollaboratorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().default('member'),
  permission_level: z.enum(['view', 'comment', 'edit', 'admin']).default('view'),
  company: z.string().optional(),
});

const UpdateCollaboratorSchema = z.object({
  permission_level: z.enum(['view', 'comment', 'edit', 'admin']).optional(),
  role: z.string().optional(),
  status: z.enum(['active', 'inactive', 'removed']).optional(),
});

const CreateCommentSchema = z.object({
  content: z.string().min(1),
  module_anchor: z.string().optional(),
  parent_comment_id: z.string().uuid().optional(),
});

router.get('/deals/:dealId/collaborators', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    if (!(await verifyDealAccess(dealId, req.user!.userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, deal_id, user_id, name, email, phone, company, role,
              permission_level, specialization, status, last_active_at, created_at
       FROM deal_team_members
       WHERE deal_id = $1 AND status != 'removed'
       ORDER BY created_at`,
      [dealId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching collaborators:', error);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

router.post('/deals/:dealId/collaborators', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    if (!(await verifyDealPermission(dealId, req.user!.userId, 'admin'))) {
      return res.status(403).json({ error: 'Admin permission required' });
    }
    const data = AddCollaboratorSchema.parse(req.body);
    const pool = getPool();

    const existing = await pool.query(
      'SELECT id FROM deal_team_members WHERE deal_id = $1 AND email = $2',
      [dealId, data.email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Collaborator already exists on this deal' });
    }

    const userLookup = await pool.query('SELECT id FROM users WHERE email = $1', [data.email]);
    const linkedUserId = userLookup.rows.length > 0 ? userLookup.rows[0].id : null;

    const result = await pool.query(
      `INSERT INTO deal_team_members (deal_id, user_id, name, email, company, role, permission_level, status, invited_by, invited_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, NOW())
       RETURNING *`,
      [dealId, linkedUserId, data.name, data.email, data.company || null, data.role, data.permission_level, req.user!.userId]
    );

    const deal = await pool.query('SELECT name, org_id FROM deals WHERE id = $1 /* B4a-safe: after verifyDealAccess */', [dealId]);
    await logActivity({
      dealId,
      orgId: deal.rows[0]?.org_id || undefined,
      userId: req.user!.userId,
      userName: req.user!.email || 'Unknown',
      userEmail: req.user!.email,
      action: 'collaborator_added',
      entityType: 'collaborator',
      entityId: result.rows[0].id,
      metadata: { collaborator_name: data.name, collaborator_email: data.email, permission_level: data.permission_level, deal_name: deal.rows[0]?.name },
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Error adding collaborator:', error);
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

router.put('/deals/:dealId/collaborators/:collabId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, collabId } = req.params;
    if (!(await verifyDealPermission(dealId, req.user!.userId, 'admin'))) {
      return res.status(403).json({ error: 'Admin permission required' });
    }
    const data = UpdateCollaboratorSchema.parse(req.body);
    const pool = getPool();

    const setClauses: string[] = [];
    const values: any[] = [dealId, collabId];
    let idx = 3;
    if (data.permission_level !== undefined) { setClauses.push(`permission_level = $${idx}`); values.push(data.permission_level); idx++; }
    if (data.role !== undefined) { setClauses.push(`role = $${idx}`); values.push(data.role); idx++; }
    if (data.status !== undefined) { setClauses.push(`status = $${idx}`); values.push(data.status); idx++; }

    if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const result = await pool.query(
      `UPDATE deal_team_members SET ${setClauses.join(', ')} WHERE deal_id = $1 AND id = $2 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Collaborator not found' });

    const deal = await pool.query('SELECT name, org_id FROM deals WHERE id = $1 /* B4a-safe: after verifyDealAccess */', [dealId]);
    await logActivity({
      dealId,
      orgId: deal.rows[0]?.org_id || undefined,
      userId: req.user!.userId,
      userName: req.user!.email || 'Unknown',
      userEmail: req.user!.email,
      action: 'collaborator_updated',
      entityType: 'collaborator',
      entityId: collabId,
      metadata: { changes: data, deal_name: deal.rows[0]?.name },
    });

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Error updating collaborator:', error);
    res.status(500).json({ error: 'Failed to update collaborator' });
  }
});

router.delete('/deals/:dealId/collaborators/:collabId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, collabId } = req.params;
    if (!(await verifyDealPermission(dealId, req.user!.userId, 'admin'))) {
      return res.status(403).json({ error: 'Admin permission required' });
    }
    const pool = getPool();

    const member = await pool.query(
      'SELECT name, email FROM deal_team_members WHERE deal_id = $1 AND id = $2',
      [dealId, collabId]
    );

    const result = await pool.query(
      `UPDATE deal_team_members SET status = 'removed' WHERE deal_id = $1 AND id = $2 RETURNING id`,
      [dealId, collabId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Collaborator not found' });

    const deal = await pool.query('SELECT name, org_id FROM deals WHERE id = $1 /* B4a-safe: after verifyDealAccess */', [dealId]);
    await logActivity({
      dealId,
      orgId: deal.rows[0]?.org_id || undefined,
      userId: req.user!.userId,
      userName: req.user!.email || 'Unknown',
      userEmail: req.user!.email,
      action: 'collaborator_removed',
      entityType: 'collaborator',
      entityId: collabId,
      metadata: { removed_name: member.rows[0]?.name, removed_email: member.rows[0]?.email, deal_name: deal.rows[0]?.name },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

router.get('/deals/:dealId/comments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    if (!(await verifyDealAccess(dealId, req.user!.userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const pool = getPool();
    const { module_anchor, include_resolved } = req.query;

    let sql = `SELECT * FROM deal_team_comments WHERE deal_id = $1 AND deleted_at IS NULL`;
    const values: any[] = [dealId];
    let idx = 2;

    if (module_anchor) {
      sql += ` AND module_anchor = $${idx}`;
      values.push(module_anchor);
      idx++;
    }

    if (include_resolved !== 'true') {
      sql += ` AND resolved_at IS NULL`;
    }

    sql += ` ORDER BY created_at ASC`;

    const result = await pool.query(sql, values);

    const threaded: any[] = [];
    const byId: Record<string, any> = {};
    for (const row of result.rows) {
      row.replies = [];
      byId[row.id] = row;
    }
    for (const row of result.rows) {
      if (row.parent_comment_id && byId[row.parent_comment_id]) {
        byId[row.parent_comment_id].replies.push(row);
      } else {
        threaded.push(row);
      }
    }

    res.json(threaded);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/deals/:dealId/comments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    if (!(await verifyDealPermission(dealId, req.user!.userId, 'comment'))) {
      return res.status(403).json({ error: 'Comment permission required' });
    }
    const data = CreateCommentSchema.parse(req.body);
    const pool = getPool();

    if (data.parent_comment_id) {
      const parentCheck = await pool.query(
        'SELECT id FROM deal_team_comments WHERE id = $1 AND deal_id = $2 AND deleted_at IS NULL',
        [data.parent_comment_id, dealId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Parent comment not found on this deal' });
      }
    }

    const contextType = data.module_anchor ? 'module' : 'general';

    const result = await pool.query(
      `INSERT INTO deal_team_comments (deal_id, context_type, author_id, author_name, content, module_anchor, parent_comment_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        dealId,
        contextType,
        req.user!.userId,
        req.user!.email || 'Unknown',
        data.content,
        data.module_anchor || null,
        data.parent_comment_id || null,
      ]
    );

    const deal = await pool.query('SELECT name, org_id FROM deals WHERE id = $1 /* B4a-safe: after verifyDealAccess */', [dealId]);
    const action = data.parent_comment_id ? 'comment_replied' : 'comment_added';
    await logActivity({
      dealId,
      orgId: deal.rows[0]?.org_id || undefined,
      userId: req.user!.userId,
      userName: req.user!.email || 'Unknown',
      userEmail: req.user!.email,
      action,
      entityType: 'comment',
      entityId: result.rows[0].id,
      metadata: {
        module_anchor: data.module_anchor,
        content_preview: data.content.substring(0, 100),
        deal_name: deal.rows[0]?.name,
      },
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

router.post('/deals/:dealId/comments/:commentId/resolve', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, commentId } = req.params;
    if (!(await verifyDealPermission(dealId, req.user!.userId, 'comment'))) {
      return res.status(403).json({ error: 'Comment permission required' });
    }
    const pool = getPool();
    const result = await pool.query(
      `UPDATE deal_team_comments SET resolved_at = NOW(), resolved_by = $3
       WHERE id = $1 AND deal_id = $2 AND parent_comment_id IS NULL
       RETURNING *`,
      [commentId, dealId, req.user!.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comment not found or is a reply' });

    const deal = await pool.query('SELECT name, org_id FROM deals WHERE id = $1 /* B4a-safe: after verifyDealAccess */', [dealId]);
    await logActivity({
      dealId,
      orgId: deal.rows[0]?.org_id || undefined,
      userId: req.user!.userId,
      userName: req.user!.email || 'Unknown',
      userEmail: req.user!.email,
      action: 'comment_resolved',
      entityType: 'comment',
      entityId: commentId,
      metadata: { deal_name: deal.rows[0]?.name },
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error resolving comment:', error);
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

router.get('/deals/:dealId/activity', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    if (!(await verifyDealAccess(dealId, req.user!.userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await getDealActivity(dealId, limit, offset);
    res.json(result);
  } catch (error) {
    console.error('Error fetching deal activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

router.get('/orgs/:orgId/activity', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    const pool = getPool();
    const membership = await pool.query(
      'SELECT id FROM org_members WHERE org_id = $1 AND user_id = $2',
      [orgId, req.user!.userId]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await getOrgActivity(orgId, limit, offset);
    res.json(result);
  } catch (error) {
    console.error('Error fetching org activity:', error);
    res.status(500).json({ error: 'Failed to fetch org activity' });
  }
});

export default router;
