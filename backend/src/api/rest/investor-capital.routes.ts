/**
 * Investor & Capital Tracking Routes
 * Mount at: /api/v1/capital
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { capitalStructureService } from '../../services/capital-structure.service';
import { gmailSyncService } from '../../services/gmail-sync.service';
import { MicrosoftGraphService, MicrosoftAuthService } from '../../services/microsoft-graph.service';

const msAuthService = new MicrosoftAuthService();

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

async function ownsDeal(dealId: string, userId: string): Promise<boolean> {
  const r = await query(
    'SELECT id FROM deals WHERE id=$1 AND user_id=$2 AND archived_at IS NULL',
    [dealId, userId],
  );
  return r.rows.length > 0;
}

function fmtInvestor(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    entityType: r.entity_type,
    email: r.email,
    phone: r.phone,
    address: r.address,
    kycStatus: r.kyc_status,
    kycCompletedAt: r.kyc_completed_at,
    accredited: r.accredited,
    federalWithholdingPct: r.federal_withholding_pct,
    stateWithholdingPct: r.state_withholding_pct,
    foreignWithholdingPct: r.foreign_withholding_pct,
    bankName: r.bank_name,
    taxIdLast4: r.tax_id_last4,
    notes: r.notes,
    metadata: r.metadata,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// INVESTORS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/investors', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, kyc_status, search } = req.query;
    const conditions: string[] = ['user_id=$1', 'archived_at IS NULL'];
    const params: unknown[] = [req.user!.userId];

    if (type)       { params.push(type);            conditions.push(`type=$${params.length}`); }
    if (kyc_status) { params.push(kyc_status);       conditions.push(`kyc_status=$${params.length}`); }
    if (search)     { params.push(`%${search}%`);   conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`); }

    const result = await query(
      `SELECT * FROM investors WHERE ${conditions.join(' AND ')} ORDER BY name`,
      params,
    );
    res.json({ success: true, investors: result.rows.map(fmtInvestor) });
  } catch (err) {
    logger.error('GET /investors', err);
    res.status(500).json({ success: false, error: 'Failed to fetch investors' });
  }
});

router.post('/investors', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name, type = 'lp', entity_type = 'individual', email, phone, address,
      kyc_status = 'pending', accredited = false,
      federal_withholding_pct = 0, state_withholding_pct = 0, foreign_withholding_pct = 0,
      bank_name, bank_routing, bank_account, tax_id_last4, notes, metadata,
    } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    const r = await query(
      `INSERT INTO investors
         (user_id,name,type,entity_type,email,phone,address,kyc_status,accredited,
          federal_withholding_pct,state_withholding_pct,foreign_withholding_pct,
          bank_name,bank_routing,bank_account,tax_id_last4,notes,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        req.user!.userId, name, type, entity_type,
        email ?? null, phone ?? null, address ? JSON.stringify(address) : null,
        kyc_status, accredited,
        federal_withholding_pct, state_withholding_pct, foreign_withholding_pct,
        bank_name ?? null, bank_routing ?? null, bank_account ?? null,
        tax_id_last4 ?? null, notes ?? null, metadata ? JSON.stringify(metadata) : null,
      ],
    );
    res.status(201).json({ success: true, investor: fmtInvestor(r.rows[0]) });
  } catch (err) {
    logger.error('POST /investors', err);
    res.status(500).json({ success: false, error: 'Failed to create investor' });
  }
});

router.get('/investors/:investorId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const r = await query(
      'SELECT * FROM investors WHERE id=$1 AND user_id=$2',
      [req.params.investorId, req.user!.userId],
    );
    if (!r.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, investor: fmtInvestor(r.rows[0]) });
  } catch (err) {
    logger.error('GET /investors/:id', err);
    res.status(500).json({ success: false, error: 'Failed to fetch investor' });
  }
});

router.patch('/investors/:investorId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allowed = [
      'name','type','entity_type','email','phone','address','kyc_status','kyc_completed_at',
      'accredited','federal_withholding_pct','state_withholding_pct','foreign_withholding_pct',
      'bank_name','bank_routing','bank_account','tax_id_last4','notes','metadata',
    ];
    const sets: string[] = [];
    const params: unknown[] = [req.params.investorId, req.user!.userId];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key]); sets.push(`${key}=$${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ success: false, error: 'No fields to update' });
    sets.push('updated_at=NOW()');
    const r = await query(
      `UPDATE investors SET ${sets.join(',')} WHERE id=$1 AND user_id=$2 RETURNING *`,
      params,
    );
    if (!r.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, investor: fmtInvestor(r.rows[0]) });
  } catch (err) {
    logger.error('PATCH /investors/:id', err);
    res.status(500).json({ success: false, error: 'Failed to update investor' });
  }
});

router.delete('/investors/:investorId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await query(
      'UPDATE investors SET archived_at=NOW() WHERE id=$1 AND user_id=$2',
      [req.params.investorId, req.user!.userId],
    );
    res.json({ success: true });
  } catch (err) {
    logger.error('DELETE /investors/:id', err);
    res.status(500).json({ success: false, error: 'Failed to archive investor' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DEAL INVESTMENTS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/deals/:dealId/investments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const r = await query(
      `SELECT di.*, i.name AS investor_name, i.type AS investor_type,
              i.email AS investor_email, i.kyc_status,
              (di.commitment_amount - COALESCE(di.funded_amount,0)) AS unfunded_amount
         FROM deal_investments di
         JOIN investors i ON i.id=di.investor_id
        WHERE di.deal_id=$1
        ORDER BY di.created_at`,
      [req.params.dealId],
    );
    res.json({ success: true, investments: r.rows });
  } catch (err) {
    logger.error('GET investments', err);
    res.status(500).json({ success: false, error: 'Failed to fetch investments' });
  }
});

router.post('/deals/:dealId/investments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const { investor_id, commitment_amount, ownership_pct, class: cls = 'class_a', notes } = req.body;
    if (!investor_id || !commitment_amount)
      return res.status(400).json({ success: false, error: 'investor_id and commitment_amount required' });
    const r = await query(
      `INSERT INTO deal_investments (deal_id,investor_id,commitment_amount,ownership_pct,class,notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (deal_id,investor_id,class)
       DO UPDATE SET commitment_amount=EXCLUDED.commitment_amount,
                     ownership_pct=EXCLUDED.ownership_pct, updated_at=NOW()
       RETURNING *`,
      [req.params.dealId, investor_id, commitment_amount, ownership_pct ?? null, cls, notes ?? null],
    );
    res.status(201).json({ success: true, investment: r.rows[0] });
  } catch (err) {
    logger.error('POST investments', err);
    res.status(500).json({ success: false, error: 'Failed to add investment' });
  }
});

router.patch('/deals/:dealId/investments/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const allowed = ['commitment_amount','ownership_pct','status','funded_amount','notes'];
    const sets: string[] = [];
    const params: unknown[] = [req.params.id, req.params.dealId];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key]); sets.push(`${key}=$${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ success: false, error: 'No fields' });
    sets.push('updated_at=NOW()');
    const r = await query(
      `UPDATE deal_investments SET ${sets.join(',')} WHERE id=$1 AND deal_id=$2 RETURNING *`,
      params,
    );
    if (!r.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, investment: r.rows[0] });
  } catch (err) {
    logger.error('PATCH investments/:id', err);
    res.status(500).json({ success: false, error: 'Failed to update investment' });
  }
});

router.delete('/deals/:dealId/investments/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    await query('DELETE FROM deal_investments WHERE id=$1 AND deal_id=$2', [req.params.id, req.params.dealId]);
    res.json({ success: true });
  } catch (err) {
    logger.error('DELETE investments/:id', err);
    res.status(500).json({ success: false, error: 'Failed to remove investment' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CAPITAL CALLS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/deals/:dealId/capital-calls', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const r = await query(
      `SELECT cc.*,
              COALESCE(SUM(cci.paid_amount),0)::numeric AS collected_amount,
              COUNT(cci.id) AS investor_count
         FROM capital_calls cc
         LEFT JOIN capital_call_items cci ON cci.capital_call_id=cc.id
        WHERE cc.deal_id=$1
        GROUP BY cc.id
        ORDER BY cc.call_number DESC`,
      [req.params.dealId],
    );
    res.json({ success: true, capitalCalls: r.rows });
  } catch (err) {
    logger.error('GET capital-calls', err);
    res.status(500).json({ success: false, error: 'Failed to fetch capital calls' });
  }
});

router.post('/deals/:dealId/capital-calls', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const { call_date, due_date, total_amount, purpose, allocation_method = 'pro_rata', notes } = req.body;
    if (!call_date || !due_date || !total_amount)
      return res.status(400).json({ success: false, error: 'call_date, due_date, total_amount required' });

    const nextNum = await query(
      'SELECT COALESCE(MAX(call_number),0)+1 AS n FROM capital_calls WHERE deal_id=$1',
      [req.params.dealId],
    );
    const r = await query(
      `INSERT INTO capital_calls
         (deal_id,call_number,call_date,due_date,total_amount,purpose,allocation_method,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.dealId, nextNum.rows[0].n, call_date, due_date, total_amount, purpose ?? null, allocation_method, notes ?? null, req.user!.userId],
    );
    const call = r.rows[0];

    if (allocation_method === 'pro_rata') {
      const investors = await query(
        'SELECT investor_id,commitment_amount FROM deal_investments WHERE deal_id=$1 AND status IN (\'committed\',\'funded\')',
        [req.params.dealId],
      );
      const totalCommit = investors.rows.reduce((s: number, x: Record<string,unknown>) => s + Number(x.commitment_amount), 0);
      if (totalCommit > 0) {
        for (const inv of investors.rows) {
          const pct = Number(inv.commitment_amount) / totalCommit;
          await query(
            'INSERT INTO capital_call_items (capital_call_id,investor_id,allocated_amount) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
            [call.id, inv.investor_id, Math.round(Number(total_amount) * pct * 100) / 100],
          );
        }
      }
    }
    res.status(201).json({ success: true, capitalCall: call });
  } catch (err) {
    logger.error('POST capital-calls', err);
    res.status(500).json({ success: false, error: 'Failed to create capital call' });
  }
});

router.get('/deals/:dealId/capital-calls/:callId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const [callRes, items] = await Promise.all([
      query('SELECT * FROM capital_calls WHERE id=$1 AND deal_id=$2', [req.params.callId, req.params.dealId]),
      query(
        `SELECT cci.*, i.name AS investor_name, i.email AS investor_email,
                (cci.allocated_amount - cci.paid_amount) AS outstanding,
                CASE WHEN cci.paid_at IS NULL
                     THEN GREATEST(0, (CURRENT_DATE - cc.due_date)::int)
                     ELSE 0 END AS days_overdue
           FROM capital_call_items cci
           JOIN investors i ON i.id=cci.investor_id
           JOIN capital_calls cc ON cc.id=cci.capital_call_id
          WHERE cci.capital_call_id=$1 ORDER BY i.name`,
        [req.params.callId],
      ),
    ]);
    if (!callRes.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, capitalCall: { ...callRes.rows[0], items: items.rows } });
  } catch (err) {
    logger.error('GET capital-calls/:id', err);
    res.status(500).json({ success: false, error: 'Failed to fetch capital call' });
  }
});

router.post('/deals/:dealId/capital-calls/:callId/send', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const r = await query(
      'UPDATE capital_calls SET status=\'sent\',sent_at=NOW(),updated_at=NOW() WHERE id=$1 AND deal_id=$2 AND status=\'draft\' RETURNING *',
      [req.params.callId, req.params.dealId],
    );
    if (!r.rows.length) return res.status(400).json({ success: false, error: 'Call not in draft status' });
    res.json({ success: true, capitalCall: r.rows[0] });
  } catch (err) {
    logger.error('POST capital-calls/send', err);
    res.status(500).json({ success: false, error: 'Failed to send capital call' });
  }
});

router.patch('/deals/:dealId/capital-calls/:callId/items/:itemId/pay', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const { paid_amount, paid_at } = req.body;
    if (!paid_amount) return res.status(400).json({ success: false, error: 'paid_amount required' });

    const r = await query(
      `UPDATE capital_call_items
          SET paid_amount=$1, paid_at=COALESCE($2::timestamptz,NOW()),
              status=CASE WHEN $1>=allocated_amount THEN 'paid' ELSE 'partial' END,
              updated_at=NOW()
        WHERE id=$3 RETURNING *`,
      [paid_amount, paid_at ?? null, req.params.itemId],
    );
    if (!r.rows.length) return res.status(404).json({ success: false, error: 'Item not found' });

    const summary = await query(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN status=\'paid\' THEN 1 ELSE 0 END) AS paid_count FROM capital_call_items WHERE capital_call_id=$1',
      [req.params.callId],
    );
    const { total, paid_count } = summary.rows[0];
    const callStatus = Number(paid_count) === Number(total) ? 'fully_paid' : 'partially_paid';
    await query('UPDATE capital_calls SET status=$1,updated_at=NOW() WHERE id=$2', [callStatus, req.params.callId]);

    const item = r.rows[0];
    await query(
      'INSERT INTO capital_account_entries (deal_id,investor_id,entry_type,amount,reference_id,reference_type,entry_date,description) VALUES ($1,$2,\'contribution\',$3,$4,\'capital_call\',CURRENT_DATE,$5)',
      [req.params.dealId, item.investor_id, paid_amount, req.params.callId, `Capital Call #${req.params.callId.slice(-6)}`],
    );
    res.json({ success: true, item: r.rows[0] });
  } catch (err) {
    logger.error('PATCH items/pay', err);
    res.status(500).json({ success: false, error: 'Failed to record payment' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DISTRIBUTIONS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/deals/:dealId/distributions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const r = await query(
      `SELECT d.*, COALESCE(SUM(di.gross_amount),0)::numeric AS allocated_amount,
              COUNT(di.id) AS investor_count
         FROM distributions d
         LEFT JOIN distribution_items di ON di.distribution_id=d.id
        WHERE d.deal_id=$1
        GROUP BY d.id ORDER BY d.distribution_number DESC`,
      [req.params.dealId],
    );
    res.json({ success: true, distributions: r.rows });
  } catch (err) {
    logger.error('GET distributions', err);
    res.status(500).json({ success: false, error: 'Failed to fetch distributions' });
  }
});

router.post('/deals/:dealId/distributions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const { distribution_date, total_amount, distribution_type = 'operating', allocation_method = 'pro_rata', tax_year, notes } = req.body;
    if (!distribution_date || !total_amount)
      return res.status(400).json({ success: false, error: 'distribution_date and total_amount required' });

    const nextNum = await query(
      'SELECT COALESCE(MAX(distribution_number),0)+1 AS n FROM distributions WHERE deal_id=$1',
      [req.params.dealId],
    );
    const r = await query(
      `INSERT INTO distributions (deal_id,distribution_number,distribution_date,total_amount,distribution_type,allocation_method,tax_year,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.dealId, nextNum.rows[0].n, distribution_date, total_amount, distribution_type, allocation_method, tax_year ?? new Date().getFullYear(), notes ?? null, req.user!.userId],
    );

    if (allocation_method === 'pro_rata') {
      const investors = await query(
        'SELECT investor_id,commitment_amount FROM deal_investments WHERE deal_id=$1 AND status IN (\'committed\',\'funded\')',
        [req.params.dealId],
      );
      const totalCommit = investors.rows.reduce((s: number, x: Record<string,unknown>) => s + Number(x.commitment_amount), 0);
      if (totalCommit > 0) {
        for (const inv of investors.rows) {
          const gross = Math.round(Number(total_amount) * (Number(inv.commitment_amount) / totalCommit) * 100) / 100;
          await query(
            'INSERT INTO distribution_items (distribution_id,investor_id,gross_amount,profit_share) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
            [r.rows[0].id, inv.investor_id, gross, gross],
          );
        }
      }
    }
    res.status(201).json({ success: true, distribution: r.rows[0] });
  } catch (err) {
    logger.error('POST distributions', err);
    res.status(500).json({ success: false, error: 'Failed to create distribution' });
  }
});

router.get('/deals/:dealId/distributions/:distId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const [dist, items] = await Promise.all([
      query('SELECT * FROM distributions WHERE id=$1 AND deal_id=$2', [req.params.distId, req.params.dealId]),
      query(
        `SELECT di.*, i.name AS investor_name, i.email AS investor_email
           FROM distribution_items di JOIN investors i ON i.id=di.investor_id
          WHERE di.distribution_id=$1 ORDER BY i.name`,
        [req.params.distId],
      ),
    ]);
    if (!dist.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, distribution: { ...dist.rows[0], items: items.rows } });
  } catch (err) {
    logger.error('GET distributions/:id', err);
    res.status(500).json({ success: false, error: 'Failed to fetch distribution' });
  }
});

router.post('/deals/:dealId/distributions/:distId/approve', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const r = await query(
      'UPDATE distributions SET status=\'approved\',approved_by=$1,approved_at=NOW(),updated_at=NOW() WHERE id=$2 AND deal_id=$3 AND status=\'draft\' RETURNING *',
      [req.user!.userId, req.params.distId, req.params.dealId],
    );
    if (!r.rows.length) return res.status(400).json({ success: false, error: 'Not in draft status' });
    res.json({ success: true, distribution: r.rows[0] });
  } catch (err) {
    logger.error('POST distributions/approve', err);
    res.status(500).json({ success: false, error: 'Failed to approve' });
  }
});

router.post('/deals/:dealId/distributions/:distId/process', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const dist = await query(
      'SELECT * FROM distributions WHERE id=$1 AND deal_id=$2 AND status=\'approved\'',
      [req.params.distId, req.params.dealId],
    );
    if (!dist.rows.length) return res.status(400).json({ success: false, error: 'Distribution not approved' });

    const items = await query('SELECT * FROM distribution_items WHERE distribution_id=$1', [req.params.distId]);
    for (const item of items.rows) {
      const net = item.net_amount ?? item.gross_amount;
      await query(
        'INSERT INTO capital_account_entries (deal_id,investor_id,entry_type,amount,reference_id,reference_type,entry_date,description) VALUES ($1,$2,\'distribution\',$3,$4,\'distribution\',CURRENT_DATE,$5)',
        [req.params.dealId, item.investor_id, net, dist.rows[0].id, `Distribution #${dist.rows[0].distribution_number}`],
      );
    }
    await query(
      'UPDATE distributions SET status=\'completed\',processed_at=NOW(),updated_at=NOW() WHERE id=$1',
      [req.params.distId],
    );
    res.json({ success: true, processed: items.rows.length });
  } catch (err) {
    logger.error('POST distributions/process', err);
    res.status(500).json({ success: false, error: 'Failed to process distribution' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WATERFALL
// ═══════════════════════════════════════════════════════════════════════════

router.get('/deals/:dealId/waterfall', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const wf = await query('SELECT * FROM deal_waterfalls WHERE deal_id=$1', [req.params.dealId]);
    if (!wf.rows.length) {
      return res.json({
        success: true, waterfall: null,
        defaultTiers: [
          { tier_order: 1, irr_hurdle_low: null,  irr_hurdle_high: 0.12, lp_pct: 80, gp_pct: 20 },
          { tier_order: 2, irr_hurdle_low: 0.12,  irr_hurdle_high: 0.18, lp_pct: 70, gp_pct: 30 },
          { tier_order: 3, irr_hurdle_low: 0.18,  irr_hurdle_high: null, lp_pct: 60, gp_pct: 40 },
        ],
      });
    }
    const tiers = await query('SELECT * FROM waterfall_tiers WHERE waterfall_id=$1 ORDER BY tier_order', [wf.rows[0].id]);
    res.json({ success: true, waterfall: { ...wf.rows[0], tiers: tiers.rows } });
  } catch (err) {
    logger.error('GET waterfall', err);
    res.status(500).json({ success: false, error: 'Failed to fetch waterfall' });
  }
});

router.put('/deals/:dealId/waterfall', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const { pref_rate = 0.08, catchup_pct = 1.0, clawback = false, clawback_lookback_months = 24, lp_gp_split_base = 80, notes, tiers } = req.body;
    const wf = await query(
      `INSERT INTO deal_waterfalls (deal_id,pref_rate,catchup_pct,clawback,clawback_lookback_months,lp_gp_split_base,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (deal_id) DO UPDATE SET pref_rate=$2,catchup_pct=$3,clawback=$4,
                     clawback_lookback_months=$5,lp_gp_split_base=$6,notes=$7,updated_at=NOW()
       RETURNING *`,
      [req.params.dealId, pref_rate, catchup_pct, clawback, clawback_lookback_months, lp_gp_split_base, notes ?? null],
    );
    // Only replace tiers when explicitly provided; omitting `tiers` preserves existing rows
    if (Array.isArray(tiers)) {
      await query('DELETE FROM waterfall_tiers WHERE waterfall_id=$1', [wf.rows[0].id]);
      for (const t of tiers) {
        await query(
          'INSERT INTO waterfall_tiers (waterfall_id,tier_order,irr_hurdle_low,irr_hurdle_high,lp_pct,gp_pct,notes) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [wf.rows[0].id, t.tier_order, t.irr_hurdle_low ?? null, t.irr_hurdle_high ?? null, t.lp_pct, t.gp_pct, t.notes ?? null],
        );
      }
    }
    const savedTiers = await query('SELECT * FROM waterfall_tiers WHERE waterfall_id=$1 ORDER BY tier_order', [wf.rows[0].id]);
    res.json({ success: true, waterfall: { ...wf.rows[0], tiers: savedTiers.rows } });
  } catch (err) {
    logger.error('PUT waterfall', err);
    res.status(500).json({ success: false, error: 'Failed to save waterfall' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CAPITAL ACCOUNT LEDGER
// ═══════════════════════════════════════════════════════════════════════════

router.get('/deals/:dealId/ledger', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const { investor_id, date_from, date_to, limit: lim, offset: off } = req.query;

    // Build outer (pagination + filter) params separate from deal-only param
    const outerFilters: string[] = [];
    const outerParams: unknown[] = [req.params.dealId]; // $1 = dealId used in both CTEs
    if (investor_id) { outerParams.push(investor_id); outerFilters.push(`c.investor_id=$${outerParams.length}`); }
    if (date_from)   { outerParams.push(String(date_from)); outerFilters.push(`c.entry_date>=$${outerParams.length}::date`); }
    if (date_to)     { outerParams.push(String(date_to));   outerFilters.push(`c.entry_date<=$${outerParams.length}::date`); }
    const outerWhere = outerFilters.length ? `WHERE ${outerFilters.join(' AND ')}` : '';

    // Capture filter-only params for the COUNT query before adding limit/offset
    const filterParams = [...outerParams];
    const parsedLim = Number(lim);
    const parsedOff = Number(off);
    const limitVal  = lim  ? (isFinite(parsedLim) ? Math.max(1, Math.min(500, parsedLim)) : 50) : 50;
    const offsetVal = off  ? (isFinite(parsedOff) ? Math.max(0, parsedOff)                : 0)  : 0;
    outerParams.push(limitVal);  const limitIdx  = outerParams.length;
    outerParams.push(offsetVal); const offsetIdx = outerParams.length;

    // CTE computes running_balance over the FULL deal history (no date filter inside),
    // so filtered views always carry forward the correct historical opening balance.
    const [r, countResult] = await Promise.all([
      query(
        `WITH full_history AS (
           SELECT e.*,
             i.name AS investor_name,
             COALESCE(
               e.running_balance,
               SUM(
                 CASE WHEN e.entry_type IN ('contribution','interest','appreciation')
                      THEN e.amount
                      ELSE -e.amount
                 END
               ) OVER (PARTITION BY e.investor_id ORDER BY e.entry_date ASC, e.created_at ASC
                       ROWS UNBOUNDED PRECEDING)
             ) AS running_balance
           FROM capital_account_entries e
           JOIN investors i ON i.id = e.investor_id
           WHERE e.deal_id=$1
         ),
         filtered AS (
           SELECT c.* FROM full_history c
           ${outerWhere}
         )
         SELECT * FROM filtered
         ORDER BY entry_date DESC, created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        outerParams,
      ),
      query(
        `SELECT COUNT(*) AS total
           FROM capital_account_entries c
          WHERE c.deal_id=$1 ${outerFilters.length ? `AND ${outerFilters.join(' AND ')}` : ''}`,
        filterParams,
      ),
    ]);
    res.json({ success: true, entries: r.rows, total: Number(countResult.rows[0]?.total ?? 0) });
  } catch (err) {
    logger.error('GET ledger', err);
    res.status(500).json({ success: false, error: 'Failed to fetch ledger' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DEAL CAPITAL SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// WATERFALL CALCULATION (uses capital-structure.service)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/deals/:dealId/waterfall/calculate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });

    const { exit_proceeds, hold_years = 5 } = req.body;
    if (!exit_proceeds) return res.status(400).json({ success: false, error: 'exit_proceeds required' });

    // Get waterfall config
    const wfRes = await query('SELECT * FROM deal_waterfalls WHERE deal_id=$1', [req.params.dealId]);
    const tiersRes = wfRes.rows.length 
      ? await query('SELECT * FROM waterfall_tiers WHERE waterfall_id=$1 ORDER BY tier_order', [wfRes.rows[0].id])
      : { rows: [] };

    // Get investments to calculate LP/GP capital
    const invRes = await query(
      `SELECT class, COALESCE(SUM(funded_amount),0) AS total FROM deal_investments WHERE deal_id=$1 GROUP BY class`,
      [req.params.dealId]
    );
    const lpCapital = invRes.rows
      .filter((r: any) => r.class !== 'gp' && r.class !== 'promote')
      .reduce((sum: number, r: any) => sum + Number(r.total), 0);
    const gpCapital = invRes.rows
      .filter((r: any) => r.class === 'gp' || r.class === 'promote')
      .reduce((sum: number, r: any) => sum + Number(r.total), 0);

    // Get operating distributions for pref calculation
    const distRes = await query(
      `SELECT COALESCE(SUM(total_amount),0) AS total FROM distributions WHERE deal_id=$1 AND distribution_type='operating' AND status='completed'`,
      [req.params.dealId]
    );
    const totalOperatingDist = Number(distRes.rows[0]?.total) || 0;
    const avgAnnualCashFlow = totalOperatingDist / hold_years;
    const annualCashFlows = Array(hold_years).fill(avgAnnualCashFlow);

    // Build waterfall config for capital structure service
    const wfConfig = wfRes.rows[0] || { pref_rate: 0.08, catchup_pct: 1.0, clawback: false };
    const tiers = tiersRes.rows.length ? tiersRes.rows : [
      { tier_order: 1, irr_hurdle_high: 0.12, lp_pct: 80, gp_pct: 20 },
      { tier_order: 2, irr_hurdle_low: 0.12, irr_hurdle_high: 0.18, lp_pct: 70, gp_pct: 30 },
      { tier_order: 3, irr_hurdle_low: 0.18, lp_pct: 60, gp_pct: 40 },
    ];

    const totalEquity = lpCapital + gpCapital;
    const config = {
      lpCapital,
      gpCapital,
      totalEquity,
      lpPercentage: totalEquity > 0 ? (lpCapital / totalEquity) * 100 : 80,
      gpPercentage: totalEquity > 0 ? (gpCapital / totalEquity) * 100 : 20,
      preferredReturn: Number(wfConfig.pref_rate) * 100 || 8,
      tiers: tiers.map((t: any) => ({
        id: `tier-${t.tier_order}`,
        name: t.tier_name || `Tier ${t.tier_order}`,
        hurdleRate: t.irr_hurdle_high ? Number(t.irr_hurdle_high) * 100 : 0,
        gpSplit: Number(t.gp_pct) / 100,
        lpSplit: Number(t.lp_pct) / 100,
      })),
      catchUpProvision: Number(wfConfig.catchup_pct) > 0,
      catchUpPercentage: Number(wfConfig.catchup_pct) * 100 || 100,
      clawbackProvision: wfConfig.clawback || false,
    };

    // Calculate waterfall
    const result = capitalStructureService.calculateWaterfall(config, exit_proceeds, hold_years, annualCashFlows);

    res.json({
      success: true,
      waterfall: {
        config: {
          lpCapital,
          gpCapital,
          totalEquity,
          prefRate: wfConfig.pref_rate,
          tiers: tiers.map((t: any) => ({ order: t.tier_order, lpPct: t.lp_pct, gpPct: t.gp_pct })),
        },
        result,
        exitProceeds: exit_proceeds,
        holdYears: hold_years,
      },
    });
  } catch (err) {
    logger.error('POST waterfall/calculate', err);
    res.status(500).json({ success: false, error: 'Failed to calculate waterfall' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DEAL CAPITAL SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

router.get('/deals/:dealId/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const [investments, calls, dists] = await Promise.all([
      query(
        `SELECT COUNT(*) AS investor_count,
                COALESCE(SUM(commitment_amount),0) AS total_committed,
                COALESCE(SUM(COALESCE(funded_amount,0)),0) AS total_funded
           FROM deal_investments WHERE deal_id=$1 AND status IN ('committed','funded')`,
        [req.params.dealId],
      ),
      query(
        `SELECT COUNT(*) AS total_calls,
                COUNT(*) FILTER (WHERE status NOT IN ('fully_paid','defaulted')) AS pending_calls,
                COALESCE(SUM(total_amount),0) AS total_called,
                COALESCE(SUM(total_amount) FILTER (WHERE status='fully_paid'),0) AS total_collected
           FROM capital_calls WHERE deal_id=$1`,
        [req.params.dealId],
      ),
      query(
        `SELECT COUNT(*) AS total_distributions,
                COALESCE(SUM(total_amount) FILTER (WHERE status='completed'),0) AS total_distributed
           FROM distributions WHERE deal_id=$1`,
        [req.params.dealId],
      ),
    ]);
    res.json({
      success: true,
      summary: { ...investments.rows[0], ...calls.rows[0], ...dists.rows[0] },
    });
  } catch (err) {
    logger.error('GET capital summary', err);
    res.status(500).json({ success: false, error: 'Failed to fetch summary' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// INVESTOR COMMUNICATIONS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/deals/:dealId/communications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const { comm_type, status, limit: lim = 50, offset: off = 0 } = req.query;
    const conditions = ['deal_id=$1'];
    const params: unknown[] = [req.params.dealId];
    if (comm_type) { params.push(comm_type); conditions.push(`comm_type=$${params.length}`); }
    if (status)    { params.push(status);    conditions.push(`status=$${params.length}`); }
    params.push(Number(lim) || 50);
    params.push(Number(off) || 0);
    const r = await query(
      `SELECT ic.*, i.name AS investor_name
         FROM investor_communications ic
         LEFT JOIN investors i ON i.id=ic.investor_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY ic.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ success: true, communications: r.rows });
  } catch (err) {
    logger.error('GET communications', err);
    res.status(500).json({ success: false, error: 'Failed to fetch communications' });
  }
});

router.post('/deals/:dealId/communications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });
    const { investor_id, comm_type, subject, body, delivery_method = 'email', attachments } = req.body;
    if (!comm_type || !subject) return res.status(400).json({ success: false, error: 'comm_type and subject required' });
    const r = await query(
      `INSERT INTO investor_communications (deal_id,investor_id,comm_type,subject,body,delivery_method,attachments,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.dealId, investor_id ?? null, comm_type, subject, body ?? null, delivery_method, attachments ? JSON.stringify(attachments) : null, req.user!.userId],
    );
    res.status(201).json({ success: true, communication: r.rows[0] });
  } catch (err) {
    logger.error('POST communications', err);
    res.status(500).json({ success: false, error: 'Failed to create communication' });
  }
});

router.post('/deals/:dealId/communications/:commId/send', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ownsDeal(req.params.dealId, req.user!.userId)))
      return res.status(404).json({ success: false, error: 'Deal not found' });

    // Fetch the draft communication (do not mark sent yet)
    const draft = await query(
      `SELECT ic.*, i.email AS investor_email
       FROM investor_communications ic
       LEFT JOIN investors i ON i.id = ic.investor_id
       WHERE ic.id = $1 AND ic.deal_id = $2 AND ic.status = 'draft'`,
      [req.params.commId, req.params.dealId],
    );
    if (!draft.rows.length) return res.status(400).json({ success: false, error: 'Not in draft status or not found' });

    const comm = draft.rows[0];
    const userId = req.user!.userId;

    // Validate investor email before attempting delivery
    if (!comm.investor_id) {
      logger.warn('investor_communications/send: communication has no investor_id', { commId: comm.id });
      return res.status(422).json({ success: false, error: 'No investor linked to this notice' });
    }
    if (!comm.investor_email) {
      logger.warn('investor_communications/send: investor has no email on file', {
        commId: comm.id,
        investorId: comm.investor_id,
      });
      return res.status(422).json({ success: false, error: 'Investor has no email address on file' });
    }

    const investorEmail = comm.investor_email as string;

    // Try Gmail first, then fall back to Microsoft Graph (synchronous — must succeed before marking sent)
    const gmailAccount = await query(
      `SELECT id FROM user_email_accounts WHERE user_id = $1 AND provider = 'google' AND sync_enabled = true ORDER BY created_at LIMIT 1`,
      [userId],
    );

    if (gmailAccount.rows.length) {
      await gmailSyncService.sendEmail(gmailAccount.rows[0].id, {
        to: [investorEmail],
        subject: comm.subject,
        body: comm.body ?? '',
        bodyType: 'text',
      });
      logger.info('investor_communications/send: email dispatched via Gmail', { commId: comm.id, to: investorEmail });
    } else {
      // Fall back to Microsoft Graph with token refresh
      const msAccount = await query(
        'SELECT access_token, refresh_token, token_expires_at FROM microsoft_accounts WHERE user_id = $1 AND is_active = true LIMIT 1',
        [userId],
      );

      if (!msAccount.rows.length) {
        logger.warn('investor_communications/send: no connected email account found; email not sent', { commId: comm.id, userId });
        return res.status(422).json({ success: false, error: 'No connected email account (Gmail or Microsoft) found' });
      }

      let accessToken = msAccount.rows[0].access_token as string;
      const expiresAt = new Date(msAccount.rows[0].token_expires_at).getTime();

      // Refresh token if expired or expiring within 5 minutes
      if (expiresAt - Date.now() < 5 * 60 * 1000) {
        const tokens = await msAuthService.refreshAccessToken(msAccount.rows[0].refresh_token);
        await query(
          'UPDATE microsoft_accounts SET access_token = $1, refresh_token = $2, token_expires_at = $3 WHERE user_id = $4',
          [tokens.accessToken, tokens.refreshToken, new Date(tokens.expiresAt), userId],
        );
        accessToken = tokens.accessToken;
      }

      const graphService = new MicrosoftGraphService(accessToken);
      await graphService.sendEmail({
        to: [investorEmail],
        subject: comm.subject,
        body: comm.body ?? '',
        bodyType: 'text',
      });
      logger.info('investor_communications/send: email dispatched via Microsoft Graph', { commId: comm.id, to: investorEmail });
    }

    // Mark as sent only after confirmed delivery — include deal_id + status guard for atomic correctness
    const updated = await query(
      `UPDATE investor_communications SET status='sent', sent_at=NOW() WHERE id=$1 AND deal_id=$2 AND status='draft' RETURNING *`,
      [comm.id, req.params.dealId],
    );

    res.json({ success: true, communication: updated.rows[0] });
  } catch (err) {
    logger.error('POST communications/send', err);
    res.status(500).json({ success: false, error: 'Failed to send' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MATERIALIZED VIEW REFRESH (admin/cron)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/admin/refresh-summaries', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await query('SELECT refresh_capital_summaries()');
    res.json({ success: true, message: 'Materialized views refreshed' });
  } catch (err) {
    logger.error('POST refresh-summaries', err);
    res.status(500).json({ success: false, error: 'Failed to refresh views' });
  }
});

export default router;
