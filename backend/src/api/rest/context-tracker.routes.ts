import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';

const router = Router();

// ============== NOTES ==============
router.get('/deals/:dealId/notes', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const result = await pool.query(
      `SELECT * FROM deal_notes WHERE deal_id = $1 AND deleted_at IS NULL ORDER BY pinned DESC, created_at DESC`,
      [dealId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deals/:dealId/notes', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const { title, content, content_html, tags, category, pinned } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const userName = (req as any).user?.name || 'System User';
    const result = await pool.query(
      `INSERT INTO deal_notes (deal_id, author_id, author_name, title, content, content_html, tags, category, pinned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [dealId, userId, userName, title, content, content_html, tags || [], category, pinned || false]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/notes/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { title, content, content_html, tags, category, pinned } = req.body;
    const result = await pool.query(
      `UPDATE deal_notes SET title=$1, content=$2, content_html=$3, tags=$4, category=$5, pinned=$6
       WHERE id=$7 RETURNING *`,
      [title, content, content_html, tags, category, pinned, id]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/notes/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    await pool.query(`UPDATE deal_notes SET deleted_at = NOW() WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============== ACTIVITY ==============
router.get('/deals/:dealId/activity', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await pool.query(
      `SELECT * FROM deal_activity WHERE deal_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [dealId, limit]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deals/:dealId/activity', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const { action_type, activity_type, module_name, title, description, changes } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const userName = (req as any).user?.name || 'System User';
    const actionType = action_type || activity_type || 'update';
    const result = await pool.query(
      `INSERT INTO deal_activity (deal_id, action_type, entity_type, user_id, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [dealId, actionType, module_name || 'general', userId, description || title, changes ? JSON.stringify(changes) : null]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============== CONTACTS ==============
router.get('/deals/:dealId/contacts', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const result = await pool.query(
      `SELECT * FROM deal_contacts WHERE deal_id = $1 ORDER BY is_primary DESC, name ASC`,
      [dealId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deals/:dealId/contacts', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const { name, role, company, email, phone, linkedin_url, website, notes, tags, is_primary } = req.body;
    const result = await pool.query(
      `INSERT INTO deal_contacts (deal_id, name, role, company, email, phone, linkedin_url, website, notes, tags, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [dealId, name, role, company, email, phone, linkedin_url, website, notes, tags || [], is_primary || false]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { name, role, company, email, phone, linkedin_url, website, notes, tags, is_primary, status } = req.body;
    const result = await pool.query(
      `UPDATE deal_contacts SET name=$1, role=$2, company=$3, email=$4, phone=$5, linkedin_url=$6,
       website=$7, notes=$8, tags=$9, is_primary=$10, status=$11 WHERE id=$12 RETURNING *`,
      [name, role, company, email, phone, linkedin_url, website, notes, tags, is_primary, status, id]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    await pool.query(`DELETE FROM deal_contacts WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============== DOCUMENTS ==============
router.get('/deals/:dealId/documents', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const result = await pool.query(
      `SELECT * FROM deal_documents WHERE deal_id = $1 AND deleted_at IS NULL ORDER BY uploaded_at DESC`,
      [dealId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deals/:dealId/documents', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const { file_name, file_type, file_url, file_size, metadata } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    if (!userId || !file_name || !file_type || !file_url) {
      return res.status(400).json({ error: 'file_name, file_type, file_url, and authenticated user are required' });
    }
    const result = await pool.query(
      `INSERT INTO deal_documents (deal_id, file_name, file_type, file_url, file_size, uploaded_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [dealId, file_name, file_type, file_url, file_size || 0, userId, metadata || {}]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/documents/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    await pool.query(`UPDATE deal_documents SET deleted_at = NOW() WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============== KEY DATES ==============
router.get('/deals/:dealId/key-dates', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const result = await pool.query(
      `SELECT * FROM deal_key_dates WHERE deal_id = $1 ORDER BY date ASC`,
      [dealId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deals/:dealId/key-dates', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const { title, date, date_type, status, description, reminder_days_before } = req.body;
    const result = await pool.query(
      `INSERT INTO deal_key_dates (deal_id, title, date, date_type, status, description, reminder_days_before)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [dealId, title, date, date_type, status || 'upcoming', description, reminder_days_before || []]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/key-dates/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { title, date, date_type, status, description, reminder_days_before, completed_at } = req.body;
    const result = await pool.query(
      `UPDATE deal_key_dates SET title=$1, date=$2, date_type=$3, status=$4, description=$5,
       reminder_days_before=$6, completed_at=$7 WHERE id=$8 RETURNING *`,
      [title, date, date_type, status, description, reminder_days_before, completed_at, id]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/key-dates/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    await pool.query(`DELETE FROM deal_key_dates WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============== DECISIONS ==============
router.get('/deals/:dealId/decisions', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const result = await pool.query(
      `SELECT * FROM deal_decisions WHERE deal_id = $1 ORDER BY created_at DESC`,
      [dealId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deals/:dealId/decisions', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const { title, decision_type, status, rationale, alternatives_considered, impact_description,
      budget_impact, timeline_impact_days, decided_by, decision_date, next_actions, next_review_date } = req.body;
    const result = await pool.query(
      `INSERT INTO deal_decisions (deal_id, title, decision_type, status, rationale, alternatives_considered,
       impact_description, budget_impact, timeline_impact_days, decided_by, decision_date, next_actions, next_review_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [dealId, title, decision_type, status, rationale, alternatives_considered, impact_description,
        budget_impact, timeline_impact_days, decided_by || [], decision_date, next_actions || [], next_review_date]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/decisions/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { title, decision_type, status, rationale, alternatives_considered, impact_description,
      budget_impact, timeline_impact_days, decided_by, decision_date, next_actions, next_review_date } = req.body;
    const result = await pool.query(
      `UPDATE deal_decisions SET title=$1, decision_type=$2, status=$3, rationale=$4, alternatives_considered=$5,
       impact_description=$6, budget_impact=$7, timeline_impact_days=$8, decided_by=$9, decision_date=$10,
       next_actions=$11, next_review_date=$12 WHERE id=$13 RETURNING *`,
      [title, decision_type, status, rationale, alternatives_considered, impact_description,
        budget_impact, timeline_impact_days, decided_by, decision_date, next_actions, next_review_date, id]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/decisions/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    await pool.query(`DELETE FROM deal_decisions WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============== RISKS ==============
router.get('/deals/:dealId/risks', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const result = await pool.query(
      `SELECT * FROM deal_risks WHERE deal_id = $1 ORDER BY
       CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
       created_at DESC`,
      [dealId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deals/:dealId/risks', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const { title, description, category, impact, likelihood, mitigation_strategy,
      contingency_plan, budget_contingency, status, assigned_to_name, review_date } = req.body;
    const result = await pool.query(
      `INSERT INTO deal_risks (deal_id, title, description, category, impact, likelihood,
       mitigation_strategy, contingency_plan, budget_contingency, status, assigned_to_name, review_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [dealId, title, description, category, impact, likelihood, mitigation_strategy,
        contingency_plan, budget_contingency, status || 'active', assigned_to_name, review_date]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/risks/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { title, description, category, impact, likelihood, mitigation_strategy,
      contingency_plan, budget_contingency, status, assigned_to_name, review_date, closed_date } = req.body;
    const result = await pool.query(
      `UPDATE deal_risks SET title=$1, description=$2, category=$3, impact=$4, likelihood=$5,
       mitigation_strategy=$6, contingency_plan=$7, budget_contingency=$8, status=$9,
       assigned_to_name=$10, review_date=$11, closed_date=$12 WHERE id=$13 RETURNING *`,
      [title, description, category, impact, likelihood, mitigation_strategy,
        contingency_plan, budget_contingency, status, assigned_to_name, review_date, closed_date, id]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/risks/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    await pool.query(`DELETE FROM deal_risks WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
