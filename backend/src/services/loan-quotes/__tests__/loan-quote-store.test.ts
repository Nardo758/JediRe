/**
 * loan-quote-store.test.ts
 * LQ-2 integration tests for PostgresLoanQuoteStore.
 *
 * Tests org-scoped CRUD, honest-absence invariants, JSONB validation,
 * and stale-quote detection.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import {
  PostgresLoanQuoteStore,
  getLoanQuoteStore,
  resetLoanQuoteStore,
  validateQuoteShape,
} from './loan-quote-store';
import type { LoanQuote, SpreadMatrix, Adjustment, PrepayStructure, BrokerClaimsProvenance } from './loan-quote.types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSpreadMatrix(program = 'Fannie DUS'): SpreadMatrix {
  return {
    program,
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

function makeBrokerClaims(overrides?: Partial<BrokerClaimsProvenance>): BrokerClaimsProvenance {
  return {
    source: 'rate_sheet_upload',
    date: '2024-06-25',
    confidence: 0.9,
    ...overrides,
  };
}

function makeQuoteInput(
  overrides?: Partial<Omit<LoanQuote, 'id' | 'createdAt' | 'updatedAt'>>
): Omit<LoanQuote, 'id' | 'createdAt' | 'updatedAt'> {
  const now = new Date();
  const quoteDate = now.toISOString().split('T')[0];
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return {
    orgId: 'org_acme',
    lender: 'NewPoint',
    program: 'Fannie DUS',
    quoteDate,
    expires,
    indexBasis: 'treasury_10yr',
    rateType: 'fixed',
    spreadMatrix: makeSpreadMatrix(),
    adjustments: makeAdjustments(),
    prepayStructure: makePrepayStructure(),
    brokerClaims: makeBrokerClaims(),
    notes: 'Test quote',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/jedire_test';

let pool: Pool;
let store: PostgresLoanQuoteStore;

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DATABASE_URL });
  store = new PostgresLoanQuoteStore(pool);

  // Ensure table exists (run migration inline for test isolation)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_quotes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL,
      lender TEXT NOT NULL,
      program TEXT NOT NULL,
      quote_date DATE NOT NULL,
      expires DATE NOT NULL,
      index_basis TEXT NOT NULL
        CHECK (index_basis IN ('SOFR','treasury_5yr','treasury_7yr','treasury_10yr','treasury_30yr')),
      rate_type TEXT NOT NULL CHECK (rate_type IN ('fixed','floating')),
      spread_matrix JSONB NOT NULL DEFAULT '{}'::jsonb,
      adjustments JSONB NOT NULL DEFAULT '[]'::jsonb,
      prepay_structure JSONB NOT NULL DEFAULT '{}'::jsonb,
      broker_claims JSONB NOT NULL DEFAULT '{}'::jsonb,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION update_loan_quotes_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  await pool.query(`
    DROP TRIGGER IF EXISTS trg_loan_quotes_updated_at ON loan_quotes;
    CREATE TRIGGER trg_loan_quotes_updated_at
      BEFORE UPDATE ON loan_quotes
      FOR EACH ROW
      EXECUTE FUNCTION update_loan_quotes_updated_at()
  `);
});

afterAll(async () => {
  await pool.query('DROP TABLE IF EXISTS loan_quotes CASCADE');
  await pool.end();
});

beforeEach(async () => {
  await pool.query('DELETE FROM loan_quotes');
  resetLoanQuoteStore();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostgresLoanQuoteStore', () => {
  describe('create', () => {
    test('creates a quote and returns it with generated id', async () => {
      const input = makeQuoteInput();
      const quote = await store.create(input);

      expect(quote.id).toBeDefined();
      expect(quote.orgId).toBe(input.orgId);
      expect(quote.lender).toBe(input.lender);
      expect(quote.program).toBe(input.program);
      expect(quote.createdAt).toBeDefined();
      expect(quote.updatedAt).toBeDefined();
    });

    test('rejects invalid spreadMatrix shape', async () => {
      const input = makeQuoteInput({ spreadMatrix: { program: 'X' } as any });
      await expect(store.create(input)).rejects.toThrow('spreadMatrix.grid must be an object');
    });

    test('rejects invalid adjustments shape', async () => {
      const input = makeQuoteInput({ adjustments: [{ name: 'Bad', bps: 'twenty' }] as any });
      await expect(store.create(input)).rejects.toThrow('adjustment.bps must be a number');
    });

    test('rejects invalid prepay type', async () => {
      const input = makeQuoteInput({ prepayStructure: { type: 'unknown', terms: {} } as any });
      await expect(store.create(input)).rejects.toThrow('prepayStructure.type must be one of');
    });
  });

  describe('read', () => {
    test('returns a quote by id and orgId', async () => {
      const input = makeQuoteInput();
      const created = await store.create(input);

      const found = await store.read(created.id, created.orgId);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.lender).toBe(created.lender);
    });

    test('returns null when quote does not exist (honest absence)', async () => {
      const result = await store.read('00000000-0000-0000-0000-000000000000', 'org_acme');
      expect(result).toBeNull();
    });

    test('returns null when quote belongs to a different org (Lane B)', async () => {
      const input = makeQuoteInput({ orgId: 'org_alpha' });
      const created = await store.create(input);

      const found = await store.read(created.id, 'org_beta');
      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    test('returns all quotes for an org ordered by created_at DESC', async () => {
      await store.create(makeQuoteInput({ lender: 'LenderA' }));
      await store.create(makeQuoteInput({ lender: 'LenderB' }));

      const quotes = await store.list('org_acme');
      expect(quotes).toHaveLength(2);
      expect(quotes[0].lender).toBe('LenderB'); // DESC order
      expect(quotes[1].lender).toBe('LenderA');
    });

    test('returns empty array when no quotes exist', async () => {
      const quotes = await store.list('org_nonexistent');
      expect(quotes).toEqual([]);
    });

    test('filters by lender', async () => {
      await store.create(makeQuoteInput({ lender: 'LenderA' }));
      await store.create(makeQuoteInput({ lender: 'LenderB' }));

      const quotes = await store.list('org_acme', { lender: 'LenderA' });
      expect(quotes).toHaveLength(1);
      expect(quotes[0].lender).toBe('LenderA');
    });

    test('filters by program', async () => {
      await store.create(makeQuoteInput({ program: 'Fannie DUS' }));
      await store.create(makeQuoteInput({ program: 'Freddie Mac' }));

      const quotes = await store.list('org_acme', { program: 'Freddie Mac' });
      expect(quotes).toHaveLength(1);
      expect(quotes[0].program).toBe('Freddie Mac');
    });
  });

  describe('update', () => {
    test('updates a quote and returns the updated version', async () => {
      const input = makeQuoteInput({ lender: 'OldLender' });
      const created = await store.create(input);

      const updated = await store.update(created.id, created.orgId, { lender: 'NewLender' });
      expect(updated.lender).toBe('NewLender');
      expect(updated.id).toBe(created.id);
    });

    test('auto-updates updated_at via trigger', async () => {
      const input = makeQuoteInput();
      const created = await store.create(input);

      // Small delay to ensure timestamp changes
      await new Promise((r) => setTimeout(r, 50));

      const updated = await store.update(created.id, created.orgId, { notes: 'Updated note' });
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(created.updatedAt).getTime()
      );
    });

    test('throws when quote not found', async () => {
      await expect(
        store.update('00000000-0000-0000-0000-000000000000', 'org_acme', { lender: 'X' })
      ).rejects.toThrow('LoanQuote not found');
    });

    test('validates patched JSONB fields', async () => {
      const input = makeQuoteInput();
      const created = await store.create(input);

      await expect(
        store.update(created.id, created.orgId, {
          adjustments: [{ name: 'Bad', bps: 'not_a_number' }] as any,
        })
      ).rejects.toThrow('adjustment.bps must be a number');
    });
  });

  describe('delete', () => {
    test('deletes a quote and returns true', async () => {
      const input = makeQuoteInput();
      const created = await store.create(input);

      const deleted = await store.delete(created.id, created.orgId);
      expect(deleted).toBe(true);

      const found = await store.read(created.id, created.orgId);
      expect(found).toBeNull();
    });

    test('returns false when quote does not exist', async () => {
      const result = await store.delete('00000000-0000-0000-0000-000000000000', 'org_acme');
      expect(result).toBe(false);
    });

    test('does not delete quote belonging to different org', async () => {
      const input = makeQuoteInput({ orgId: 'org_alpha' });
      const created = await store.create(input);

      const deleted = await store.delete(created.id, 'org_beta');
      expect(deleted).toBe(false);

      const found = await store.read(created.id, 'org_alpha');
      expect(found).not.toBeNull();
    });
  });

  describe('findStale', () => {
    test('returns quotes past their expiry date', async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      await store.create(makeQuoteInput({ lender: 'StaleLender', expires: pastDate }));
      await store.create(makeQuoteInput({ lender: 'FreshLender', expires: futureDate }));

      const stale = await store.findStale('org_acme');
      expect(stale).toHaveLength(1);
      expect(stale[0].lender).toBe('StaleLender');
    });

    test('returns empty array when no stale quotes', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await store.create(makeQuoteInput({ expires: futureDate }));

      const stale = await store.findStale('org_acme');
      expect(stale).toEqual([]);
    });
  });

  describe('singleton getLoanQuoteStore', () => {
    test('returns the same instance on repeated calls', () => {
      const s1 = getLoanQuoteStore(pool);
      const s2 = getLoanQuoteStore(pool);
      expect(s1).toBe(s2);
    });
  });
});

describe('validateQuoteShape', () => {
  test('accepts valid quote', () => {
    const input = makeQuoteInput();
    expect(() => validateQuoteShape(input)).not.toThrow();
  });

  test('rejects missing spreadMatrix.grid', () => {
    const input = makeQuoteInput({ spreadMatrix: { program: 'X' } as any });
    expect(() => validateQuoteShape(input)).toThrow('spreadMatrix.grid');
  });

  test('rejects invalid adjustment provenance type', () => {
    const input = makeQuoteInput({
      adjustments: [{ name: 'X', bps: 10, provenance: 123 }] as any,
    });
    expect(() => validateQuoteShape(input)).toThrow('adjustment.provenance must be a string');
  });
});
