/**
 * loan-quote-store.ts
 * LQ-2: PostgreSQL-backed LoanQuoteStore implementation.
 *
 * Org-scoped CRUD with raw SQL. All operations filter by orgId — Lane B privacy.
 * JSONB is used for spread_matrix, adjustments, prepay_structure, broker_claims.
 *
 * Honest-absence invariant: read() returns null (not throws) when a quote is
 * missing or belongs to a different org. The caller decides how to handle absence.
 */

import { query, getClient } from '../../database/connection';
import type {
  LoanQuote,
  LoanQuoteStore,
  SpreadMatrix,
  Adjustment,
  PrepayStructure,
  BrokerClaimsProvenance,
} from './loan-quote.types';

// ============================================================================
// Row ↔ Domain mapping
// ============================================================================

interface LoanQuoteRow {
  id: string;
  org_id: string;
  lender: string;
  program: string;
  quote_date: string;
  expires: string;
  index_basis: string;
  rate_type: string;
  spread_matrix: unknown;
  adjustments: unknown;
  prepay_structure: unknown;
  broker_claims: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToQuote(row: LoanQuoteRow): LoanQuote {
  return {
    id: row.id,
    orgId: row.org_id,
    lender: row.lender,
    program: row.program,
    quoteDate: row.quote_date,
    expires: row.expires,
    indexBasis: row.index_basis as LoanQuote['indexBasis'],
    rateType: row.rate_type as LoanQuote['rateType'],
    spreadMatrix: (row.spread_matrix as SpreadMatrix) ?? { program: row.program, grid: {} },
    adjustments: (row.adjustments as Adjustment[]) ?? [],
    prepayStructure: (row.prepay_structure as PrepayStructure) ?? { type: 'yield_maintenance', terms: {} },
    brokerClaims: (row.broker_claims as BrokerClaimsProvenance) ?? { source: 'unknown', date: row.quote_date, confidence: 0 },
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function quoteToInsertable(
  quote: Omit<LoanQuote, 'id' | 'createdAt' | 'updatedAt'>
): [string, unknown[]] {
  const sql = `
    INSERT INTO loan_quotes
      (org_id, lender, program, quote_date, expires, index_basis, rate_type,
       spread_matrix, adjustments, prepay_structure, broker_claims, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `;
  const params = [
    quote.orgId,
    quote.lender,
    quote.program,
    quote.quoteDate,
    quote.expires,
    quote.indexBasis,
    quote.rateType,
    JSON.stringify(quote.spreadMatrix),
    JSON.stringify(quote.adjustments),
    JSON.stringify(quote.prepayStructure),
    JSON.stringify(quote.brokerClaims),
    quote.notes ?? null,
  ];
  return [sql, params];
}

// ============================================================================
// Store Implementation
// ============================================================================

export const loanQuoteStore: LoanQuoteStore = {
  /**
   * Create a new quote. Returns the created quote with generated id.
   */
  async create(quote): Promise<LoanQuote> {
    const [sql, params] = quoteToInsertable(quote);
    const result = await query<LoanQuoteRow>(sql, params);
    return rowToQuote(result.rows[0]);
  },

  /**
   * Read a single quote by id (org-scoped: must match the quote's orgId).
   * Returns null if not found or org mismatch — honest absence.
   */
  async read(id, orgId): Promise<LoanQuote | null> {
    const result = await query<LoanQuoteRow>(
      `SELECT * FROM loan_quotes WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );
    if (result.rows.length === 0) return null;
    return rowToQuote(result.rows[0]);
  },

  /**
   * List all quotes for an org, optionally filtered by lender or program.
   */
  async list(orgId, filters = {}): Promise<LoanQuote[]> {
    const conditions: string[] = ['org_id = $1'];
    const params: unknown[] = [orgId];

    if (filters.lender) {
      params.push(filters.lender);
      conditions.push(`lender = $${params.length}`);
    }
    if (filters.program) {
      params.push(filters.program);
      conditions.push(`program = $${params.length}`);
    }

    const sql = `SELECT * FROM loan_quotes WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const result = await query<LoanQuoteRow>(sql, params);
    return result.rows.map(rowToQuote);
  },

  /**
   * Update a quote. Returns the updated quote.
   * Throws if the quote does not exist or belongs to a different org.
   */
  async update(id, orgId, patch): Promise<LoanQuote> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Verify existence + org scope (honest-absence: throw if missing)
      const check = await client.query<LoanQuoteRow>(
        `SELECT * FROM loan_quotes WHERE id = $1 AND org_id = $2 FOR UPDATE`,
        [id, orgId]
      );
      if (check.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error(`Quote not found: ${id} (org=${orgId})`);
      }

      const fields: string[] = [];
      const params: unknown[] = [];

      if (patch.lender !== undefined) {
        fields.push(`lender = $${fields.length + 1}`);
        params.push(patch.lender);
      }
      if (patch.program !== undefined) {
        fields.push(`program = $${fields.length + 1}`);
        params.push(patch.program);
      }
      if (patch.quoteDate !== undefined) {
        fields.push(`quote_date = $${fields.length + 1}`);
        params.push(patch.quoteDate);
      }
      if (patch.expires !== undefined) {
        fields.push(`expires = $${fields.length + 1}`);
        params.push(patch.expires);
      }
      if (patch.indexBasis !== undefined) {
        fields.push(`index_basis = $${fields.length + 1}`);
        params.push(patch.indexBasis);
      }
      if (patch.rateType !== undefined) {
        fields.push(`rate_type = $${fields.length + 1}`);
        params.push(patch.rateType);
      }
      if (patch.spreadMatrix !== undefined) {
        fields.push(`spread_matrix = $${fields.length + 1}`);
        params.push(JSON.stringify(patch.spreadMatrix));
      }
      if (patch.adjustments !== undefined) {
        fields.push(`adjustments = $${fields.length + 1}`);
        params.push(JSON.stringify(patch.adjustments));
      }
      if (patch.prepayStructure !== undefined) {
        fields.push(`prepay_structure = $${fields.length + 1}`);
        params.push(JSON.stringify(patch.prepayStructure));
      }
      if (patch.brokerClaims !== undefined) {
        fields.push(`broker_claims = $${fields.length + 1}`);
        params.push(JSON.stringify(patch.brokerClaims));
      }
      if (patch.notes !== undefined) {
        fields.push(`notes = $${fields.length + 1}`);
        params.push(patch.notes ?? null);
      }

      if (fields.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('No fields provided for update');
      }

      params.push(id);
      params.push(orgId);
      const updateSql = `UPDATE loan_quotes SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${fields.length + 1} AND org_id = $${fields.length + 2} RETURNING *`;
      const updateResult = await client.query<LoanQuoteRow>(updateSql, params);

      await client.query('COMMIT');
      return rowToQuote(updateResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Delete a quote (org-scoped). Returns true if a row was deleted.
   */
  async delete(id, orgId): Promise<boolean> {
    const result = await query(
      `DELETE FROM loan_quotes WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Find quotes that have expired (expires < now) for an org.
   */
  async findStale(orgId): Promise<LoanQuote[]> {
    const result = await query<LoanQuoteRow>(
      `SELECT * FROM loan_quotes WHERE org_id = $1 AND expires < CURRENT_DATE`,
      [orgId]
    );
    return result.rows.map(rowToQuote);
  },
};

export default loanQuoteStore;
