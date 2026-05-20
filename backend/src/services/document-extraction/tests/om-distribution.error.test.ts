/**
 * Contract test for `distributeOmExtraction`'s failure mode (Task #391).
 *
 * When any per-row INSERT inside the txn raises an error caught at the
 * SAVEPOINT, the function MUST:
 *   1. ROLLBACK the whole transaction so no partial market-comps rows survive
 *   2. throw an `OmDistributionError`
 *   3. expose `partialCounts` reflecting the would-have-been inserts per
 *      category (so the operator sees what the OM yielded before the abort)
 *   4. expose `failures` containing every captured per-row error message
 *
 * Verified here by injecting a fake pg Pool + Client whose INSERTs into
 * `market_sale_comps` throw while every other INSERT succeeds.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Stub the KG fan-out path — pulled in via dynamic import after a successful
// commit. The error path never reaches it, but keep it safe regardless.
vi.mock('../../neural-network/graph-ingestion-listener', () => ({
  getGraphIngestionListener: () => ({ handleEvent: vi.fn() }),
}));
vi.mock('../../../database/connection', () => ({
  getPool: vi.fn(),
}));

import {
  distributeOmExtraction,
  OmDistributionError,
} from '../om-distribution.service';

function makeExtraction() {
  return {
    property: {
      name: 'Test',
      address: '1 Main',
      city: 'Atlanta',
      state: 'GA',
      zip: '30303',
      units: 100,
      yearBuilt: 2010,
      netRentableSF: 80000,
      propertyType: 'mid-rise',
    },
    metadata: { broker: 'CBRE' },
    marketComps: {
      rentComps: [{ name: 'RC1', avgRent: 1500, units: 80, occupancy: 0.94 }],
      saleComps: [{ name: 'SC1', salePrice: 25_000_000, units: 100, capRate: 0.05 }],
      submarketName: 'Buckhead',
    },
    replacementCost: {
      totalReplacementCost: 30_000_000,
      replacementCostPerUnit: 300_000,
      source: 'broker_estimate',
    },
    investmentThesis: 'Bullish on Buckhead.',
    investmentHighlights: ['great schools'],
  } as any;
}

const HAPPY_GEO = {
  msaKey: 'msa:12060',
  submarketKey: 'submarket:cbre:atl-buckhead',
  msaName: 'Atlanta',
  submarketName: 'Buckhead',
  lat: 0, lng: 0,
};

/** Build a fake pg PoolClient that fails INSERT INTO market_sale_comps. */
function makeFakePoolWithSaleFailure() {
  const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
  let committed = false;
  let rolledBack = false;

  const client = {
    async query(sql: string, params: readonly unknown[] = []) {
      calls.push({ sql, params });
      const trimmed = sql.trim();
      if (/^INSERT\s+INTO\s+market_sale_comps/i.test(trimmed)) {
        throw new Error('duplicate key value violates unique constraint');
      }
      if (/^COMMIT/i.test(trimmed)) committed = true;
      if (/^ROLLBACK\s*$/i.test(trimmed)) rolledBack = true;
      return { rows: [], rowCount: 0 };
    },
    release() { /* no-op */ },
  };

  const pool = {
    connect: async () => client,
  } as any;

  return { pool, client, calls, get committed() { return committed; }, get rolledBack() { return rolledBack; } };
}

describe('distributeOmExtraction error contract', () => {
  it('throws OmDistributionError with partialCounts + failures when an INSERT fails', async () => {
    const fake = makeFakePoolWithSaleFailure();

    let caught: unknown = null;
    try {
      await distributeOmExtraction({
        pool: fake.pool,
        fileId: 99,
        extraction: makeExtraction(),
        geo: HAPPY_GEO,
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(OmDistributionError);
    const err = caught as OmDistributionError;

    // Would-have-been counts: rent + replacement + narrative all succeeded
    // pre-rollback; only sale failed.
    expect(err.partialCounts).toEqual({
      rentComps: 1,
      saleComps: 0,
      replacementCostRows: 1,
      narratives: 2, // 1 thesis + 1 highlight
    });

    expect(err.failures).toHaveLength(1);
    expect(err.failures[0]).toMatch(/sale comp "SC1"/);
    expect(err.message).toMatch(/Distribution had 1 insert failure/);

    // The transaction must have ROLLBACK'd, not committed.
    expect(fake.rolledBack).toBe(true);
    expect(fake.committed).toBe(false);
  });
});
