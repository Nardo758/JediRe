import { Pool } from 'pg';

export interface RegulatoryAlertInput {
  municipality: string;
  state: string;
  category: string;
  severity: string;
  title: string;
  description?: string;
  affectedStrategies?: string[];
  sourceUrl?: string;
  sourceName?: string;
  publishedDate?: string;
  expiresDate?: string;
}

export class RegulatoryAlertService {
  constructor(private pool: Pool) {}

  async getById(id: string) {
    const result = await this.pool.query(
      `SELECT * FROM regulatory_alerts WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async list(filters?: {
    municipality?: string;
    state?: string;
    category?: string;
    severity?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters?.municipality) {
      conditions.push(`municipality ILIKE $${idx++}`);
      params.push(`%${filters.municipality}%`);
    }
    if (filters?.state) {
      conditions.push(`state = $${idx++}`);
      params.push(filters.state);
    }
    if (filters?.category) {
      conditions.push(`category = $${idx++}`);
      params.push(filters.category);
    }
    if (filters?.severity) {
      conditions.push(`severity = $${idx++}`);
      params.push(filters.severity);
    }
    if (filters?.activeOnly !== false) {
      conditions.push(`is_active = true`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM regulatory_alerts ${where}`, params
    );

    params.push(limit, offset);
    const result = await this.pool.query(
      `SELECT * FROM regulatory_alerts ${where}
       ORDER BY 
         CASE severity 
           WHEN 'critical' THEN 1 
           WHEN 'warning' THEN 2 
           WHEN 'watch' THEN 3 
           WHEN 'info' THEN 4 
           ELSE 5 
         END,
         published_date DESC NULLS LAST
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    return { alerts: result.rows, total: parseInt(countResult.rows[0].count) };
  }

  async getByMunicipality(municipality: string, state?: string) {
    const params: any[] = [municipality];
    let query = `SELECT * FROM regulatory_alerts WHERE municipality ILIKE $1 AND is_active = true`;
    if (state) {
      query += ` AND state = $2`;
      params.push(state);
    }
    query += ` ORDER BY 
      CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 WHEN 'watch' THEN 3 ELSE 4 END,
      published_date DESC`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async create(input: RegulatoryAlertInput) {
    const result = await this.pool.query(
      `INSERT INTO regulatory_alerts
       (municipality, state, category, severity, title, description,
        affected_strategies, source_url, source_name, published_date, expires_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.municipality,
        input.state,
        input.category,
        input.severity || 'info',
        input.title,
        input.description || null,
        JSON.stringify(input.affectedStrategies || []),
        input.sourceUrl || null,
        input.sourceName || null,
        input.publishedDate || null,
        input.expiresDate || null,
      ]
    );
    return result.rows[0];
  }

  async deactivate(id: string) {
    const result = await this.pool.query(
      `UPDATE regulatory_alerts SET is_active = false WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getStrategyImpactMatrix(municipality: string, state?: string) {
    const params: any[] = [municipality];
    let query = `SELECT category, severity, title, affected_strategies 
                 FROM regulatory_alerts 
                 WHERE municipality ILIKE $1 AND is_active = true`;
    if (state) {
      query += ` AND state = $2`;
      params.push(state);
    }

    const result = await this.pool.query(query, params);

    const strategies = ['BTS', 'Flip', 'Rental', 'STR'];
    const matrix: Record<string, Record<string, { impact: string; alerts: string[] }>> = {};

    for (const strategy of strategies) {
      matrix[strategy] = {};
    }

    for (const row of result.rows) {
      const affected = row.affected_strategies || [];
      for (const strategy of strategies) {
        if (affected.includes(strategy) || affected.includes(strategy.toLowerCase())) {
          if (!matrix[strategy][row.category]) {
            matrix[strategy][row.category] = { impact: 'none', alerts: [] };
          }
          matrix[strategy][row.category].alerts.push(row.title);
          if (row.severity === 'critical') {
            matrix[strategy][row.category].impact = 'high';
          } else if (row.severity === 'warning' && matrix[strategy][row.category].impact !== 'high') {
            matrix[strategy][row.category].impact = 'moderate';
          } else if (matrix[strategy][row.category].impact === 'none') {
            matrix[strategy][row.category].impact = 'low';
          }
        }
      }
    }

    return matrix;
  }

  async getCategoryBreakdown(municipality?: string) {
    const params: any[] = [];
    let where = 'WHERE is_active = true';
    if (municipality) {
      where += ` AND municipality ILIKE $1`;
      params.push(`%${municipality}%`);
    }

    const result = await this.pool.query(
      `SELECT category, severity, COUNT(*) as count
       FROM regulatory_alerts ${where}
       GROUP BY category, severity
       ORDER BY category, severity`,
      params
    );

    const breakdown: Record<string, { total: number; bySeverity: Record<string, number> }> = {};
    for (const row of result.rows) {
      if (!breakdown[row.category]) {
        breakdown[row.category] = { total: 0, bySeverity: {} };
      }
      const cnt = parseInt(row.count);
      breakdown[row.category].total += cnt;
      breakdown[row.category].bySeverity[row.severity] = cnt;
    }

    return breakdown;
  }
}
