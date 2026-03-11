import { Pool } from 'pg';

export interface EntitlementInput {
  dealId?: string;
  parcelAddress?: string;
  type: string;
  fromDistrict?: string;
  toDistrict?: string;
  status?: string;
  riskLevel?: string;
  filedDate?: string;
  nextMilestone?: string;
  nextMilestoneDate?: string;
  hearingDate?: string;
  approvalDate?: string;
  estCostLow?: number;
  estCostHigh?: number;
  estTimelineMonths?: number;
  successProbability?: number;
  documents?: any[];
  contacts?: any[];
  aiRiskFactors?: any[];
  notes?: string;
}

export interface MilestoneInput {
  entitlementId: string;
  name: string;
  status?: string;
  scheduledDate?: string;
  actualDate?: string;
  notes?: string;
  sortOrder?: number;
}

export class EntitlementService {
  constructor(private pool: Pool) {}

  async getById(id: string) {
    const result = await this.pool.query(
      `SELECT e.*, 
        json_agg(DISTINCT jsonb_build_object(
          'id', m.id, 'name', m.name, 'status', m.status,
          'scheduledDate', m.scheduled_date, 'actualDate', m.actual_date,
          'notes', m.notes, 'sortOrder', m.sort_order
        )) FILTER (WHERE m.id IS NOT NULL) as milestones
       FROM entitlements e
       LEFT JOIN entitlement_milestones m ON m.entitlement_id = e.id
       WHERE e.id = $1
       GROUP BY e.id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getByDeal(dealId: string) {
    const result = await this.pool.query(
      `SELECT e.*, 
        json_agg(DISTINCT jsonb_build_object(
          'id', m.id, 'name', m.name, 'status', m.status,
          'scheduledDate', m.scheduled_date, 'actualDate', m.actual_date,
          'notes', m.notes, 'sortOrder', m.sort_order
        )) FILTER (WHERE m.id IS NOT NULL) as milestones
       FROM entitlements e
       LEFT JOIN entitlement_milestones m ON m.entitlement_id = e.id
       WHERE e.deal_id = $1
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [dealId]
    );
    return result.rows;
  }

  async getKanbanView(filters?: { market?: string; type?: string; dealId?: string }) {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters?.dealId) {
      conditions.push(`e.deal_id = $${idx++}`);
      params.push(filters.dealId);
    }
    if (filters?.type) {
      conditions.push(`e.type = $${idx++}`);
      params.push(filters.type);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.pool.query(
      `SELECT e.id, e.deal_id, e.parcel_address, e.type, e.from_district,
              e.to_district, e.status, e.risk_level, e.filed_date,
              e.next_milestone, e.next_milestone_date, e.hearing_date,
              e.est_cost_low, e.est_cost_high, e.est_timeline_months,
              e.ai_risk_factors
       FROM entitlements e
       ${where}
       ORDER BY e.status, e.next_milestone_date ASC NULLS LAST`,
      params
    );

    const statuses = ['pre_application', 'submitted', 'under_review', 'hearing', 'approved'];
    const kanban: Record<string, any[]> = {};
    for (const s of statuses) {
      kanban[s] = [];
    }
    for (const row of result.rows) {
      const col = kanban[row.status] || kanban['pre_application'];
      col.push(row);
    }
    return kanban;
  }

  async list(filters?: {
    status?: string;
    type?: string;
    riskLevel?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters?.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters?.type) {
      conditions.push(`type = $${idx++}`);
      params.push(filters.type);
    }
    if (filters?.riskLevel) {
      conditions.push(`risk_level = $${idx++}`);
      params.push(filters.riskLevel);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM entitlements ${where}`, params
    );

    params.push(limit, offset);
    const result = await this.pool.query(
      `SELECT * FROM entitlements ${where}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    return { entitlements: result.rows, total: parseInt(countResult.rows[0].count) };
  }

  async create(input: EntitlementInput) {
    const result = await this.pool.query(
      `INSERT INTO entitlements
       (deal_id, parcel_address, type, from_district, to_district, status,
        risk_level, filed_date, next_milestone, next_milestone_date,
        hearing_date, approval_date, est_cost_low, est_cost_high,
        est_timeline_months, success_probability, documents, contacts,
        ai_risk_factors, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [
        input.dealId || null,
        input.parcelAddress || null,
        input.type,
        input.fromDistrict || null,
        input.toDistrict || null,
        input.status || 'pre_application',
        input.riskLevel || 'low',
        input.filedDate || null,
        input.nextMilestone || null,
        input.nextMilestoneDate || null,
        input.hearingDate || null,
        input.approvalDate || null,
        input.estCostLow || null,
        input.estCostHigh || null,
        input.estTimelineMonths || null,
        input.successProbability || null,
        JSON.stringify(input.documents || []),
        JSON.stringify(input.contacts || []),
        JSON.stringify(input.aiRiskFactors || []),
        input.notes || null,
      ]
    );
    return result.rows[0];
  }

  async update(id: string, input: Partial<EntitlementInput>) {
    const fields: string[] = [];
    const params: any[] = [id];
    let idx = 2;

    const mapping: Record<string, string> = {
      dealId: 'deal_id',
      parcelAddress: 'parcel_address',
      type: 'type',
      fromDistrict: 'from_district',
      toDistrict: 'to_district',
      status: 'status',
      riskLevel: 'risk_level',
      filedDate: 'filed_date',
      nextMilestone: 'next_milestone',
      nextMilestoneDate: 'next_milestone_date',
      hearingDate: 'hearing_date',
      approvalDate: 'approval_date',
      estCostLow: 'est_cost_low',
      estCostHigh: 'est_cost_high',
      estTimelineMonths: 'est_timeline_months',
      successProbability: 'success_probability',
      notes: 'notes',
    };

    for (const [key, col] of Object.entries(mapping)) {
      if ((input as any)[key] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        params.push((input as any)[key]);
      }
    }

    if (input.documents !== undefined) {
      fields.push(`documents = $${idx++}`);
      params.push(JSON.stringify(input.documents));
    }
    if (input.contacts !== undefined) {
      fields.push(`contacts = $${idx++}`);
      params.push(JSON.stringify(input.contacts));
    }
    if (input.aiRiskFactors !== undefined) {
      fields.push(`ai_risk_factors = $${idx++}`);
      params.push(JSON.stringify(input.aiRiskFactors));
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = NOW()');

    const result = await this.pool.query(
      `UPDATE entitlements SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async delete(id: string) {
    const result = await this.pool.query(
      `DELETE FROM entitlements WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rowCount > 0;
  }

  async addMilestone(input: MilestoneInput) {
    const result = await this.pool.query(
      `INSERT INTO entitlement_milestones
       (entitlement_id, name, status, scheduled_date, actual_date, notes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.entitlementId,
        input.name,
        input.status || 'upcoming',
        input.scheduledDate || null,
        input.actualDate || null,
        input.notes || null,
        input.sortOrder || 0,
      ]
    );
    return result.rows[0];
  }

  async updateMilestone(id: string, input: Partial<MilestoneInput>) {
    const fields: string[] = [];
    const params: any[] = [id];
    let idx = 2;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); params.push(input.name); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); params.push(input.status); }
    if (input.scheduledDate !== undefined) { fields.push(`scheduled_date = $${idx++}`); params.push(input.scheduledDate); }
    if (input.actualDate !== undefined) { fields.push(`actual_date = $${idx++}`); params.push(input.actualDate); }
    if (input.notes !== undefined) { fields.push(`notes = $${idx++}`); params.push(input.notes); }
    if (input.sortOrder !== undefined) { fields.push(`sort_order = $${idx++}`); params.push(input.sortOrder); }

    if (fields.length === 0) return null;

    const result = await this.pool.query(
      `UPDATE entitlement_milestones SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async identifyRiskFactors(id: string): Promise<any[]> {
    const entitlement = await this.getById(id);
    if (!entitlement) return [];

    const factors: any[] = [];

    if (entitlement.type === 'rezone') {
      factors.push({ type: 'warning', text: 'Rezoning requires legislative approval — longer timeline and lower success rate than variances' });
    }
    if (entitlement.type === 'variance' && entitlement.risk_level === 'high') {
      factors.push({ type: 'warning', text: 'High-risk variance — community opposition or non-conforming use may trigger denial' });
    }
    if (entitlement.hearing_date) {
      const daysToHearing = Math.ceil((new Date(entitlement.hearing_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysToHearing < 14 && daysToHearing > 0) {
        factors.push({ type: 'warning', text: `Hearing in ${daysToHearing} days — ensure all submissions are complete` });
      }
      if (daysToHearing < 0) {
        factors.push({ type: 'info', text: 'Hearing date has passed — awaiting decision' });
      }
    }
    if (entitlement.status === 'pre_application') {
      factors.push({ type: 'positive', text: 'Pre-application stage allows time to address potential issues before formal submittal' });
    }
    if (entitlement.est_timeline_months && entitlement.est_timeline_months > 12) {
      factors.push({ type: 'warning', text: `Estimated timeline of ${entitlement.est_timeline_months} months exceeds typical entitlement window — consider carrying cost impact` });
    }
    if (entitlement.from_district && entitlement.to_district && entitlement.from_district !== entitlement.to_district) {
      factors.push({ type: 'info', text: `District change from ${entitlement.from_district} to ${entitlement.to_district} — verify compatibility with comprehensive plan` });
    }

    return factors;
  }
}
