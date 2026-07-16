/**
 * loan-quote-store.unit.test.ts
 * Unit tests for PostgresLoanQuoteStore — mocks the query layer.
 *
 * These tests verify SQL generation, org-scoping, honest-absence invariants,
 * and JSONB serialization without requiring a real PostgreSQL connection.
 *
 * Uses vitest (matches project test runner).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostgresLoanQuoteStore, QuoteNotFoundError } from '../loan-quote-store';
import type {
  LoanQuote,
  SpreadMatrix,
  Adjustment,
  PrepayStructure,
  BrokerClaimsProvenance,
} from '../loan-quote.types';

// Mock the database connection
vi.mock('../../../database/connection', () => ({
  query: vi.fn(),
  transaction: vi.fn((cb: any) => cb({ query: vi.fn() })),
}));

import { query } from '../../../database/connection';

const mockedQuery = vi.mocked(query);

function makeSpreadMatrix(): SpreadMatrix {
  return {
    program: 'Fannie DUS',
    grid: {
      'Tier-3': {
        7: { min: 0.0126, max: 0.0136 },
        10: { min: 0.0130, max: 0.0140 },
      },
    },
  };
}

function makeAdjustments(): Adjustment[] {
  return [
    { name: 'Green building', bps: -20, provenance: 'sheet:green' },
    { name: 'MAH', bps: -30, provenance: 'sheet:maht' },
  ];
}

function makePrepayStructure(): PrepayStructure {
  return {
    type: 'yield_maintenance',
    terms: { lockoutMonths: 0, formula: 'treasury_rate + spread - note_rate' },
  };
}

function makeProvenance(): BrokerClaimsProvenance {
  return {
    source: 'manual_entry',
    date: '2024-06-25T00:00:00Z',
    confidence: 1.0,
    sourceId: 'user_42',
    context: 'Manually entered by user_42',
  };
}

function makeDbRow(overrides?: Partial<any>): any {
  const now = new Date().toISOString();
  return {
    id: 'quote-test-001',
    org_id: 'org_acme',
    lender: 'NewPoint',
    program: 'Fannie DUS',
    quote_date: '2024-06-25',
    expires: '2024-07-25',
    index_basis: 'treasury_7yr',
    rate_type: 'fixed',
    spread_matrix: makeSpreadMatrix(),
    adjustments: makeAdjustments(),
    prepay_structure: makePrepayStructure(),
    broker_claims: makeProvenance(),
    notes: 'Test note',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeCreateInput(): Omit<LoanQuote, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    orgId: 'org_acme',
    lender: 'NewPoint',
    program: 'Fannie DUS',
    quoteDate: '2024-06-25',
    expires: '2024-07-25',
    indexBasis: 'treasury_7yr',
    rateType: 'fixed',
    spreadMatrix: makeSpreadMatrix(),
    adjustments: makeAdjustments(),
    prepayStructure: makePrepayStructure(),
    brokerClaims: makeProvenance(),
    notes: 'Test note',
  };
}

describe('PostgresLoanQuoteStore', () => {
  let store: PostgresLoanQuoteStore;

  beforeEach(() => {
    store = new PostgresLoanQuoteStore();
    mockedQuery.mockClear();
  });

  // ── CREATE ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('inserts a quote and returns the created domain object with generated id', async () => {
      const dbRow = makeDbRow({ id: 'quote-generated-uuid' });
      mockedQuery.mockResolvedValueOnce({ rows: [dbRow], command: 'INSERT', rowCount: 1, oid: 0, fields: [] } as any);

      const input = makeCreateInput();
      const result = await store.create(input);

      expect(result.id).toBe('quote-generated-uuid');
      expect(result.orgId).toBe('org_acme');
      expect(result.lender).toBe('NewPoint');
      expect(result.spreadMatrix.grid['Tier-3'][7]).toEqual({ min: 0.0126, max: 0.0136 });
      expect(result.adjustments).toHaveLength(2);
      expect(result.brokerClaims.confidence).toBe(1.0);

      // Verify SQL was called with serialized JSONB
      expect(mockedQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockedQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO loan_quotes');
      expect(params).toContain('org_acme');
      expect(params).toContain('NewPoint');
      expect(params).toContain(JSON.stringify(input.spreadMatrix));
      expect(params).toContain(JSON.stringify(input.adjustments));
      expect(params).toContain(JSON.stringify(input.prepayStructure));
      expect(params).toContain(JSON.stringify(input.brokerClaims));
    });
  });

  // ── READ ──────────────────────────────────────────────────────────────────

  describe('read', () => {
    it('returns a LoanQuote when found and org matches', async () => {
      const dbRow = makeDbRow();
      mockedQuery.mockResolvedValueOnce({ rows: [dbRow], command: 'SELECT', rowCount: 1, oid: 0, fields: [] } as any);

      const result = await store.read('quote-test-001', 'org_acme');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('quote-test-001');
      expect(result!.orgId).toBe('org_acme');
      expect(result!.lender).toBe('NewPoint');

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM loan_quotes WHERE id = $1 AND org_id = $2'),
        ['quote-test-001', 'org_acme']
      );
    });

    it('returns null when quote not found (honest absence)', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] } as any);

      const result = await store.read('nonexistent', 'org_acme');

      expect(result).toBeNull();
    });

    it('returns null when org mismatch (honest absence, Lane B privacy)', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] } as any);

      const result = await store.read('quote-test-001', 'org_other');

      expect(result).toBeNull();
    });
  });

  // ── LIST ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns all quotes for an org ordered by quote_date DESC', async () => {
      const dbRows = [
        makeDbRow({ id: 'quote-002', quote_date: '2024-06-26' }),
        makeDbRow({ id: 'quote-001', quote_date: '2024-06-25' }),
      ];
      mockedQuery.mockResolvedValueOnce({ rows: dbRows, command: 'SELECT', rowCount: 2, oid: 0, fields: [] } as any);

      const result = await store.list('org_acme');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('quote-002');
      expect(result[1].id).toBe('quote-001');

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('org_id = $1'),
        ['org_acme']
      );
    });

    it('filters by lender when provided', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] } as any);

      await store.list('org_acme', { lender: 'NewPoint' });

      const [sql, params] = mockedQuery.mock.calls[0];
      expect(sql).toContain('lender = $2');
      expect(params).toEqual(['org_acme', 'NewPoint']);
    });

    it('filters by program when provided', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] } as any);

      await store.list('org_acme', { program: 'Fannie DUS' });

      const [sql, params] = mockedQuery.mock.calls[0];
      expect(sql).toContain('program = $2');
      expect(params).toEqual(['org_acme', 'Fannie DUS']);
    });

    it('filters by both lender and program', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] } as any);

      await store.list('org_acme', { lender: 'NewPoint', program: 'Fannie DUS' });

      const [sql, params] = mockedQuery.mock.calls[0];
      expect(sql).toContain('lender = $2');
      expect(sql).toContain('program = $3');
      expect(params).toEqual(['org_acme', 'NewPoint', 'Fannie DUS']);
    });

    it('returns empty array when no quotes exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] } as any);

      const result = await store.list('org_empty');

      expect(result).toEqual([]);
    });
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates fields and returns updated quote', async () => {
      // First read check
      const existingRow = makeDbRow();
      // Update return
      const updatedRow = makeDbRow({ lender: 'UpdatedLender', notes: 'Updated note' });

      mockedQuery
        .mockResolvedValueOnce({ rows: [existingRow], command: 'SELECT', rowCount: 1, oid: 0, fields: [] } as any)
        .mockResolvedValueOnce({ rows: [updatedRow], command: 'UPDATE', rowCount: 1, oid: 0, fields: [] } as any);

      const result = await store.update('quote-test-001', 'org_acme', {
        lender: 'UpdatedLender',
        notes: 'Updated note',
      });

      expect(result.lender).toBe('UpdatedLender');
      expect(result.notes).toBe('Updated note');
    });

    it('throws QuoteNotFoundError when quote does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] } as any);

      await expect(
        store.update('nonexistent', 'org_acme', { lender: 'X' })
      ).rejects.toThrow(QuoteNotFoundError);
    });

    it('throws QuoteNotFoundError on org mismatch', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] } as any);

      await expect(
        store.update('quote-test-001', 'org_other', { lender: 'X' })
      ).rejects.toThrow(QuoteNotFoundError);
    });

    it('returns existing quote when patch is empty (no fields to update)', async () => {
      const existingRow = makeDbRow();
      mockedQuery.mockResolvedValueOnce({ rows: [existingRow], command: 'SELECT', rowCount: 1, oid: 0, fields: [] } as any);

      const result = await store.update('quote-test-001', 'org_acme', {});

      expect(result.id).toBe('quote-test-001');
      expect(mockedQuery).toHaveBeenCalledTimes(1); // No UPDATE issued
    });

    it('serializes JSONB fields correctly', async () => {
      const existingRow = makeDbRow();
      const newMatrix: SpreadMatrix = {
        program: 'Freddie Mac',
        grid: {
          'Tier-1': { 5: { min: 0.0100, max: 0.0110 } },
        },
      };
      const updatedRow = makeDbRow({ spread_matrix: newMatrix });

      mockedQuery
        .mockResolvedValueOnce({ rows: [existingRow], command: 'SELECT', rowCount: 1, oid: 0, fields: [] } as any)
        .mockResolvedValueOnce({ rows: [updatedRow], command: 'UPDATE', rowCount: 1, oid: 0, fields: [] } as any);

      await store.update('quote-test-001', 'org_acme', { spreadMatrix: newMatrix });

      const [, params] = mockedQuery.mock.calls[1];
      expect(params).toContain(JSON.stringify(newMatrix));
    });
  });

  // ── DELETE ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('returns true when quote is deleted', async () => {
      const dbRow = makeDbRow();
      mockedQuery.mockResolvedValueOnce({ rows: [dbRow], command: 'DELETE', rowCount: 1, oid: 0, fields: [] } as any);

      const result = await store.delete('quote-test-001', 'org_acme');

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM loan_quotes WHERE id = $1 AND org_id = $2'),
        ['quote-test-001', 'org_acme']
      );
    });

    it('returns false when quote not found (honest absence)', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'DELETE', rowCount: 0, oid: 0, fields: [] } as any);

      const result = await store.delete('nonexistent', 'org_acme');

      expect(result).toBe(false);
    });

    it('returns false on org mismatch (Lane B privacy)', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'DELETE', rowCount: 0, oid: 0, fields: [] } as any);

      const result = await store.delete('quote-test-001', 'org_other');

      expect(result).toBe(false);
    });
  });

  // ── FIND STALE ────────────────────────────────────────────────────────────

  describe('findStale', () => {
    it('returns expired quotes for an org', async () => {
      const pastDate = '2024-01-01';
      const dbRows = [
        makeDbRow({ id: 'stale-001', expires: pastDate }),
        makeDbRow({ id: 'stale-002', expires: pastDate }),
      ];
      mockedQuery.mockResolvedValueOnce({ rows: dbRows, command: 'SELECT', rowCount: 2, oid: 0, fields: [] } as any);

      const result = await store.findStale('org_acme');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('stale-001');
      expect(result[1].id).toBe('stale-002');

      const [sql, params] = mockedQuery.mock.calls[0];
      expect(sql).toContain('expires < CURRENT_DATE');
      expect(sql).toContain('org_id = $1');
      expect(params).toEqual(['org_acme']);
    });

    it('returns empty array when no stale quotes exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] } as any);

      const result = await store.findStale('org_acme');

      expect(result).toEqual([]);
    });

    it('is org-scoped — does not return stale quotes from other orgs', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] } as any);

      const result = await store.findStale('org_other');

      expect(result).toEqual([]);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('org_id = $1'),
        ['org_other']
      );
    });
  });

  // ── JSONB ROUND-TRIP ──────────────────────────────────────────────────────

  describe('JSONB serialization', () => {
    it('spreadMatrix round-trips through JSONB', async () => {
      const matrix: SpreadMatrix = {
        program: 'Test',
        grid: {
          'Tier-A': {
            5: { min: 0.01, max: 0.02 },
            10: { min: 0.015, max: 0.025 },
          },
        },
      };
      const dbRow = makeDbRow({ spread_matrix: matrix });
      mockedQuery.mockResolvedValueOnce({ rows: [dbRow], command: 'SELECT', rowCount: 1, oid: 0, fields: [] } as any);

      const result = await store.read('quote-test-001', 'org_acme');

      expect(result!.spreadMatrix).toEqual(matrix);
    });

    it('adjustments round-trip through JSONB', async () => {
      const adjs: Adjustment[] = [
        { name: 'Size premium', bps: 15, provenance: 'sheet:row5' },
      ];
      const dbRow = makeDbRow({ adjustments: adjs });
      mockedQuery.mockResolvedValueOnce({ rows: [dbRow], command: 'SELECT', rowCount: 1, oid: 0, fields: [] } as any);

      const result = await store.read('quote-test-001', 'org_acme');

      expect(result!.adjustments).toEqual(adjs);
    });

    it('prepayStructure round-trips through JSONB', async () => {
      const prepay: PrepayStructure = {
        type: 'step_down',
        terms: { schedule: [{ year: 1, penaltyPct: 0.03 }, { year: 2, penaltyPct: 0.02 }] },
      };
      const dbRow = makeDbRow({ prepay_structure: prepay });
      mockedQuery.mockResolvedValueOnce({ rows: [dbRow], command: 'SELECT', rowCount: 1, oid: 0, fields: [] } as any);

      const result = await store.read('quote-test-001', 'org_acme');

      expect(result!.prepayStructure).toEqual(prepay);
    });
  });
});
