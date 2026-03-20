import { Pool } from 'pg';
import { zoningEventBus, ZONING_EVENTS } from './zoning-event-bus.service';

export interface PrecedentRecord {
  id: string;
  municipality: string;
  state: string;
  districtCode: string;
  applicationType: string;
  applicationId: string;
  address: string;
  outcome: string;
  conditions: string[];
  keyFactors: any;
  supportFactors: string[];
  opposeFactors: string[];
  timelineMonths: number;
  decisionMakers: string;
  voteDetails: string;
  attorney: string;
  similarCases: string[];
  scaleUnits: number | null;
  scaleSqft: number | null;
  scaleHeightFt: number | null;
  costEstimate: number | null;
  actualCost: number | null;
  filedDate: string | null;
  decidedDate: string | null;
  dealId: string | null;
  source: string;
  decisionDetails: string;
  createdAt: Date;
}

export interface PrecedentSearchParams {
  municipality?: string;
  state?: string;
  districtCode?: string;
  applicationType?: string;
  outcome?: string;
  minScale?: number;
  maxScale?: number;
  limit?: number;
  offset?: number;
}

export interface PatternAnalysis {
  totalCases: number;
  approvalRate: number;
  avgTimelineMonths: number;
  commonConditions: { condition: string; count: number }[];
  commonSupportFactors: { factor: string; count: number }[];
  commonOpposeFactors: { factor: string; count: number }[];
  outcomeBreakdown: { outcome: string; count: number; pct: number }[];
}

export class ZoningPrecedentService {
  constructor(private pool: Pool) {}

  async addPrecedent(data: Partial<PrecedentRecord>): Promise<PrecedentRecord> {
    const result = await this.pool.query(
      `INSERT INTO zoning_precedents
       (municipality, state, district_code, application_type, application_id,
        address, outcome, conditions, key_factors, support_factors, oppose_factors,
        timeline_months, decision_makers, vote_details, attorney, similar_cases,
        scale_units, scale_sqft, scale_height_ft, cost_estimate, actual_cost,
        filed_date, decided_date, deal_id, source, decision_details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *`,
      [
        data.municipality, data.state, data.districtCode, data.applicationType,
        data.applicationId || '', data.address || '', data.outcome || 'pending',
        data.conditions || [], data.keyFactors ? JSON.stringify(data.keyFactors) : '{}',
        data.supportFactors || [], data.opposeFactors || [],
        data.timelineMonths || null, data.decisionMakers || null, data.voteDetails || null,
        data.attorney || null, data.similarCases || [],
        data.scaleUnits || null, data.scaleSqft || null, data.scaleHeightFt || null,
        data.costEstimate || null, data.actualCost || null,
        data.filedDate || null, data.decidedDate || null,
        data.dealId || null, data.source || 'manual', data.decisionDetails || null,
      ]
    );

    const precedent = this.mapRow(result.rows[0]);

    zoningEventBus.publish(ZONING_EVENTS.PRECEDENT_ADDED, {
      precedentId: precedent.id,
      municipality: precedent.municipality,
      districtCode: precedent.districtCode,
      applicationType: precedent.applicationType,
      outcome: precedent.outcome,
    });

    return precedent;
  }

  async search(params: PrecedentSearchParams): Promise<{ precedents: PrecedentRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.municipality) {
      conditions.push(`LOWER(municipality) = LOWER($${idx++})`);
      values.push(params.municipality);
    }
    if (params.state) {
      conditions.push(`LOWER(state) = LOWER($${idx++})`);
      values.push(params.state);
    }
    if (params.districtCode) {
      conditions.push(`LOWER(district_code) = LOWER($${idx++})`);
      values.push(params.districtCode);
    }
    if (params.applicationType) {
      conditions.push(`LOWER(application_type) = LOWER($${idx++})`);
      values.push(params.applicationType);
    }
    if (params.outcome) {
      conditions.push(`LOWER(outcome) = LOWER($${idx++})`);
      values.push(params.outcome);
    }
    if (params.minScale !== undefined) {
      conditions.push(`scale_units >= $${idx++}`);
      values.push(params.minScale);
    }
    if (params.maxScale !== undefined) {
      conditions.push(`scale_units <= $${idx++}`);
      values.push(params.maxScale);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 20;
    const offset = params.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM zoning_precedents ${where}`, values
    );

    values.push(limit, offset);
    const result = await this.pool.query(
      `SELECT * FROM zoning_precedents ${where}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      values
    );

    return {
      precedents: result.rows.map(r => this.mapRow(r)),
      total: parseInt(countResult.rows[0].count),
    };
  }

  async findSimilar(
    districtCode: string,
    municipality: string,
    applicationType: string,
    scaleUnits?: number
  ): Promise<PrecedentRecord[]> {
    let query = `
      SELECT *, 
        CASE
          WHEN LOWER(district_code) = LOWER($1) AND LOWER(municipality) = LOWER($2)
               AND LOWER(application_type) = LOWER($3) THEN 3
          WHEN LOWER(district_code) = LOWER($1) AND LOWER(application_type) = LOWER($3) THEN 2
          WHEN LOWER(municipality) = LOWER($2) AND LOWER(application_type) = LOWER($3) THEN 1
          ELSE 0
        END as relevance_score
      FROM zoning_precedents
      WHERE (LOWER(district_code) = LOWER($1) OR LOWER(municipality) = LOWER($2))
        AND LOWER(application_type) = LOWER($3)
      ORDER BY relevance_score DESC, created_at DESC
      LIMIT 20
    `;

    const result = await this.pool.query(query, [districtCode, municipality, applicationType]);
    return result.rows.map(r => this.mapRow(r));
  }

  async analyzePatterns(
    municipality: string,
    districtCode?: string,
    applicationType?: string
  ): Promise<PatternAnalysis> {
    const conditions = ['LOWER(municipality) = LOWER($1)'];
    const params: any[] = [municipality];
    let idx = 2;

    if (districtCode) {
      conditions.push(`LOWER(district_code) = LOWER($${idx++})`);
      params.push(districtCode);
    }
    if (applicationType) {
      conditions.push(`LOWER(application_type) = LOWER($${idx++})`);
      params.push(applicationType);
    }

    const where = conditions.join(' AND ');

    const statsResult = await this.pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE LOWER(outcome) IN ('approved', 'approved_with_conditions')) as approved_count,
         AVG(timeline_months) FILTER (WHERE timeline_months IS NOT NULL) as avg_timeline
       FROM zoning_precedents WHERE ${where}`,
      params
    );

    const stats = statsResult.rows[0];
    const total = parseInt(stats.total);
    const approvedCount = parseInt(stats.approved_count);

    const outcomeResult = await this.pool.query(
      `SELECT outcome, COUNT(*) as cnt
       FROM zoning_precedents WHERE ${where}
       GROUP BY outcome ORDER BY cnt DESC`,
      params
    );

    const conditionsResult = await this.pool.query(
      `SELECT unnest(conditions) as condition, COUNT(*) as cnt
       FROM zoning_precedents WHERE ${where} AND conditions IS NOT NULL AND array_length(conditions, 1) > 0
       GROUP BY condition ORDER BY cnt DESC LIMIT 10`,
      params
    );

    const supportResult = await this.pool.query(
      `SELECT unnest(support_factors) as factor, COUNT(*) as cnt
       FROM zoning_precedents WHERE ${where} AND support_factors IS NOT NULL AND array_length(support_factors, 1) > 0
       GROUP BY factor ORDER BY cnt DESC LIMIT 10`,
      params
    );

    const opposeResult = await this.pool.query(
      `SELECT unnest(oppose_factors) as factor, COUNT(*) as cnt
       FROM zoning_precedents WHERE ${where} AND oppose_factors IS NOT NULL AND array_length(oppose_factors, 1) > 0
       GROUP BY factor ORDER BY cnt DESC LIMIT 10`,
      params
    );

    return {
      totalCases: total,
      approvalRate: total > 0 ? (approvedCount / total) * 100 : 0,
      avgTimelineMonths: parseFloat(stats.avg_timeline) || 0,
      commonConditions: conditionsResult.rows.map(r => ({
        condition: r.condition, count: parseInt(r.cnt),
      })),
      commonSupportFactors: supportResult.rows.map(r => ({
        factor: r.factor, count: parseInt(r.cnt),
      })),
      commonOpposeFactors: opposeResult.rows.map(r => ({
        factor: r.factor, count: parseInt(r.cnt),
      })),
      outcomeBreakdown: outcomeResult.rows.map(r => ({
        outcome: r.outcome,
        count: parseInt(r.cnt),
        pct: total > 0 ? (parseInt(r.cnt) / total) * 100 : 0,
      })),
    };
  }

  async getJurisdictionStats(municipality: string): Promise<{
    totalPrecedents: number;
    totalCorrections: number;
    totalOutcomes: number;
    oldestRecord: Date | null;
  }> {
    const result = await this.pool.query(
      `SELECT
         (SELECT COUNT(*) FROM zoning_precedents WHERE LOWER(municipality) = LOWER($1)) as precedents,
         (SELECT COUNT(*) FROM zoning_corrections WHERE LOWER(municipality) = LOWER($1) AND verification_status = 'verified') as corrections,
         (SELECT COUNT(*) FROM zoning_outcomes WHERE LOWER(municipality) = LOWER($1)) as outcomes,
         (SELECT MIN(created_at) FROM zoning_precedents WHERE LOWER(municipality) = LOWER($1)) as oldest
      `,
      [municipality]
    );

    const row = result.rows[0];
    return {
      totalPrecedents: parseInt(row.precedents),
      totalCorrections: parseInt(row.corrections),
      totalOutcomes: parseInt(row.outcomes),
      oldestRecord: row.oldest,
    };
  }

  private mapRow(row: any): PrecedentRecord {
    return {
      id: row.id,
      municipality: row.municipality,
      state: row.state,
      districtCode: row.district_code,
      applicationType: row.application_type,
      applicationId: row.application_id,
      address: row.address,
      outcome: row.outcome,
      conditions: row.conditions || [],
      keyFactors: row.key_factors || {},
      supportFactors: row.support_factors || [],
      opposeFactors: row.oppose_factors || [],
      timelineMonths: parseFloat(row.timeline_months) || 0,
      decisionMakers: row.decision_makers,
      voteDetails: row.vote_details,
      attorney: row.attorney,
      similarCases: row.similar_cases || [],
      scaleUnits: row.scale_units ? parseInt(row.scale_units) : null,
      scaleSqft: row.scale_sqft ? parseInt(row.scale_sqft) : null,
      scaleHeightFt: row.scale_height_ft ? parseInt(row.scale_height_ft) : null,
      costEstimate: row.cost_estimate ? parseFloat(row.cost_estimate) : null,
      actualCost: row.actual_cost ? parseFloat(row.actual_cost) : null,
      filedDate: row.filed_date,
      decidedDate: row.decided_date,
      dealId: row.deal_id,
      source: row.source,
      decisionDetails: row.decision_details,
      createdAt: row.created_at,
    };
  }
}
