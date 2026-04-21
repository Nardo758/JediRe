/**
 * Deal Templates Routes
 * CRUD endpoints for org-scoped document templates (F9 Settings)
 * Mount at: /api/v1/org/templates
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

const DEFAULT_TEMPLATES = [
  {
    name: 'Multifamily ProForma — Base',
    category: 'ProForma',
    description: 'Standard 10-year DCF for multifamily acquisitions',
    sections: [],
    is_default: true,
  },
  {
    name: 'Industrial ProForma — NNN',
    category: 'ProForma',
    description: 'Triple-net lease cash flow model',
    sections: [],
    is_default: true,
  },
  {
    name: 'Letter of Intent — Standard',
    category: 'LOI',
    description: 'Non-binding offer template with standard CRE terms',
    sections: [],
    is_default: true,
  },
  {
    name: 'PSA — Simple Purchase',
    category: 'PSA',
    description: 'Simplified purchase and sale agreement for direct deals',
    sections: [],
    is_default: true,
  },
  {
    name: 'Investment Committee Memo',
    category: 'Investment Memo',
    description: 'IC memo template with executive summary, underwriting, risks',
    sections: [],
    is_default: true,
  },
  {
    name: 'Due Diligence Checklist',
    category: 'Due Diligence',
    description: 'Comprehensive DD checklist covering physical, legal, financial',
    sections: [],
    is_default: true,
  },
  {
    name: 'Seller Outreach Email',
    category: 'Email',
    description: 'Initial off-market outreach email to property owners',
    sections: [],
    is_default: false,
  },
];

async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await query(
    `SELECT org_id FROM org_members WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.org_id ?? null;
}

async function seedDefaultTemplates(orgId: string, userId: string): Promise<void> {
  for (const t of DEFAULT_TEMPLATES) {
    await query(
      `INSERT INTO deal_templates (org_id, name, category, description, sections, is_default, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [orgId, t.name, t.category, t.description, JSON.stringify(t.sections), t.is_default, userId]
    );
  }
}

/**
 * GET /api/v1/org/templates
 * List all templates for the authenticated user's org.
 * Seeds defaults if the org has no templates yet.
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);
    if (!orgId) {
      return res.json({ templates: [] });
    }

    const existing = await query(
      `SELECT * FROM deal_templates WHERE org_id = $1 ORDER BY is_default DESC, created_at ASC`,
      [orgId]
    );

    if (existing.rows.length === 0) {
      await seedDefaultTemplates(orgId, userId);
      const seeded = await query(
        `SELECT * FROM deal_templates WHERE org_id = $1 ORDER BY is_default DESC, created_at ASC`,
        [orgId]
      );
      return res.json({ templates: seeded.rows });
    }

    res.json({ templates: existing.rows });
  } catch (err: any) {
    logger.error('deal-templates GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/org/templates
 * Create a new template for the user's org.
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);
    if (!orgId) {
      return res.status(400).json({ error: 'User is not a member of any organization' });
    }

    const { name, category, description, sections } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'name and category are required' });
    }

    const result = await query(
      `INSERT INTO deal_templates (org_id, name, category, description, sections, is_default, created_by)
       VALUES ($1, $2, $3, $4, $5, false, $6)
       RETURNING *`,
      [orgId, name, category, description ?? null, JSON.stringify(sections ?? []), userId]
    );

    res.status(201).json({ template: result.rows[0] });
  } catch (err: any) {
    logger.error('deal-templates POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/v1/org/templates/:id
 * Update a template (name, category, description, sections).
 * Only non-default templates can be edited.
 */
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);
    if (!orgId) {
      return res.status(400).json({ error: 'User is not a member of any organization' });
    }

    const { name, category, description, sections } = req.body;

    const result = await query(
      `UPDATE deal_templates
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           description = COALESCE($3, description),
           sections = COALESCE($4, sections),
           updated_at = NOW()
       WHERE id = $5 AND org_id = $6
       RETURNING *`,
      [
        name ?? null,
        category ?? null,
        description ?? null,
        sections != null ? JSON.stringify(sections) : null,
        req.params.id,
        orgId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: result.rows[0] });
  } catch (err: any) {
    logger.error('deal-templates PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/v1/org/templates/:id
 * Delete a custom template (default templates are protected).
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);
    if (!orgId) {
      return res.status(400).json({ error: 'User is not a member of any organization' });
    }

    const result = await query(
      `DELETE FROM deal_templates
       WHERE id = $1 AND org_id = $2 AND is_default = false
       RETURNING id`,
      [req.params.id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found or cannot be deleted' });
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error('deal-templates DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
