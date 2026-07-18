/**
 * agent-overlay-writer.test.ts
 * Unit tests for writeAgentConfirmedOverlay and writeBrokerClaimFlag.
 *
 * Mocks the DB pool layer; no real PostgreSQL connection required.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  writeAgentConfirmedOverlay,
  writeBrokerClaimFlag,
} from '../agent-overlay-writer';

// Mock the database connection — overlay-writer uses getPool().connect()
vi.mock('../../../database/connection', () => ({
  getPool: vi.fn(),
}));

import { getPool } from '../../../database/connection';
const mockedGetPool = vi.mocked(getPool);

function makeTxnClient(results: TxnResult[] = []) {
  let resultIdx = 0;
  return {
    query: vi.fn(async (sql: string, _params?: any[]) => {
      // Transaction control statements are always OK and do NOT consume results
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [], command: sql, rowCount: 0, oid: 0, fields: [] };
      }
      const res = results[resultIdx] ?? { rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] };
      resultIdx += 1;
      return res;
    }),
    release: vi.fn(),
  };
}

interface TxnResult {
  rows: any[];
  command: string;
  rowCount: number;
  oid: number;
  fields: any[];
}

function hashRes(assumptions_hash: string | null): TxnResult {
  return {
    rows: assumptions_hash ? [{ assumptions_hash }] : [],
    command: 'SELECT', rowCount: assumptions_hash ? 1 : 0, oid: 0, fields: [],
  };
}

function supersedeRes(ids: string[]): TxnResult {
  return {
    rows: ids.map(id => ({ id })),
    command: 'UPDATE', rowCount: ids.length, oid: 0, fields: [],
  };
}

function insertRes(id: string): TxnResult {
  return {
    rows: [{ id }],
    command: 'INSERT', rowCount: 1, oid: 0, fields: [],
  };
}

function okRes(): TxnResult {
  return { rows: [], command: 'UPDATE', rowCount: 1, oid: 0, fields: [] };
}

describe('agent-overlay-writer', () => {
  beforeEach(() => {
    mockedGetPool.mockClear();
  });

  // ── W2: basic overlay write ────────────────────────────────────────────────

  describe('writeAgentConfirmedOverlay', () => {
    it('(a) inserts overlay row with source_tag=agent_confirmed and correct fields', async () => {
      // exit_year has NO year1 mapping → only 3 real queries (hash, supersede, insert)
      const client = makeTxnClient([
        hashRes('hash-abc123'),   // hash lookup
        supersedeRes([]),         // no previous rows
        insertRes('ovly-001'),    // insert
      ]);
      mockedGetPool.mockReturnValueOnce({ connect: vi.fn().mockResolvedValueOnce(client) } as any);

      const result = await writeAgentConfirmedOverlay({
        dealId: 'deal-001',
        fieldKey: 'exit_year',
        value: 5,
        confidence: 'HIGH',
        reasoning: 'Test reasoning',
      });

      expect(result.overlayId).toBe('ovly-001');
      expect(result.confidence).toBe('HIGH');
      expect(result.outOfBounds).toBe(false);
      expect(result.year1Patched).toBe(false);
      expect(result.buildHash).toBe('hash-abc123');

      const realCalls = client.query.mock.calls.filter(([sql]) =>
        sql !== 'BEGIN' && sql !== 'COMMIT' && sql !== 'ROLLBACK'
      );
      expect(realCalls).toHaveLength(3);

      const insertCall = realCalls[2];
      const [insertSql, insertParams] = insertCall;
      expect(insertSql).toContain('INSERT INTO deal_assumption_overlays');
      expect(insertSql).toContain('agent_confirmed'); // hardcoded in SQL
      expect(insertParams).toContain('deal-001');
      expect(insertParams).toContain('exit_year');
      expect(insertParams).toContain(5);
      expect(insertParams).toContain('HIGH');
      expect(insertParams).toContain('Test reasoning');
    });

    it('(d) patches year1 JSONB for mapped fields (e.g. interest_rate → rate)', async () => {
      // interest_rate HAS year1 mapping → 4 real queries (hash, patch, supersede, insert)
      const client = makeTxnClient([
        hashRes(null),            // no hash
        okRes(),                  // year1 patch
        supersedeRes([]),         // no previous
        insertRes('ovly-002'),    // insert
      ]);
      mockedGetPool.mockReturnValueOnce({ connect: vi.fn().mockResolvedValueOnce(client) } as any);

      const result = await writeAgentConfirmedOverlay({
        dealId: 'deal-002',
        fieldKey: 'interest_rate',
        value: 0.065,
      });

      expect(result.year1Patched).toBe(true);
      expect(result.buildHash).toBeNull();

      const realCalls = client.query.mock.calls.filter(([sql]) =>
        sql !== 'BEGIN' && sql !== 'COMMIT' && sql !== 'ROLLBACK'
      );
      expect(realCalls).toHaveLength(4);

      const patchCall = realCalls[1];
      const [patchSql, patchParams] = patchCall;
      expect(patchSql).toContain('UPDATE deal_assumptions');
      expect(patchSql).toContain('jsonb_set');
      expect(patchParams).toContain('rate');
      expect(patchParams).toContain(0.065);
      expect(patchParams).toContain('deal-002');
    });

    it('(b) out-of-bounds value forces LOW confidence and note, but still writes (R4)', async () => {
      // vacancy_rate HAS year1 mapping ('vacancy_pct') → 4 real queries
      const client = makeTxnClient([
        hashRes('hash-xyz'),      // hash
        okRes(),                  // year1 patch
        supersedeRes([]),         // no previous
        insertRes('ovly-003'),    // insert
      ]);
      mockedGetPool.mockReturnValueOnce({ connect: vi.fn().mockResolvedValueOnce(client) } as any);

      // vacancy_rate bound is [0.00, 0.50]; 0.99 is out of bounds
      const result = await writeAgentConfirmedOverlay({
        dealId: 'deal-003',
        fieldKey: 'vacancy_rate',
        value: 0.99,
        confidence: 'HIGH',
      });

      expect(result.outOfBounds).toBe(true);
      expect(result.confidence).toBe('LOW');

      const realCalls = client.query.mock.calls.filter(([sql]) =>
        sql !== 'BEGIN' && sql !== 'COMMIT' && sql !== 'ROLLBACK'
      );
      const insertCall = realCalls[3];
      const [, insertParams] = insertCall;
      expect(insertParams).toContain('LOW');
      expect(insertParams).toEqual(
        expect.arrayContaining([expect.stringContaining('OUT_OF_BOUNDS')])
      );
    });

    it('(c) superseded previous agent_confirmed rows get superseded_at + superseded_by', async () => {
      // ltv_pct HAS year1 mapping ('ltv') → 5 real queries (hash, patch, supersede, insert, backfill)
      const client = makeTxnClient([
        hashRes('hash-old'),                    // hash
        okRes(),                                // year1 patch
        supersedeRes(['prev-001', 'prev-002']), // two previous rows
        insertRes('ovly-new'),                  // insert
        okRes(),                                // back-fill superseded_by
      ]);
      mockedGetPool.mockReturnValueOnce({ connect: vi.fn().mockResolvedValueOnce(client) } as any);

      await writeAgentConfirmedOverlay({
        dealId: 'deal-004',
        fieldKey: 'ltv_pct',
        value: 0.70,
      });

      const realCalls = client.query.mock.calls.filter(([sql]) =>
        sql !== 'BEGIN' && sql !== 'COMMIT' && sql !== 'ROLLBACK'
      );
      expect(realCalls).toHaveLength(5);

      // 3rd real call = supersede UPDATE
      const supersedeCall = realCalls[2];
      const [supersedeSql, supersedeParams] = supersedeCall;
      expect(supersedeSql).toContain('UPDATE deal_assumption_overlays');
      expect(supersedeSql).toContain('superseded_at = NOW()');
      expect(supersedeSql).toContain('agent_confirmed'); // hardcoded in SQL
      expect(supersedeParams).toContain('deal-004');
      expect(supersedeParams).toContain('ltv_pct');

      // 5th real call = back-fill superseded_by
      const backfillCall = realCalls[4];
      const [backfillSql, backfillParams] = backfillCall;
      expect(backfillSql).toContain('superseded_by = $1');
      expect(backfillParams[0]).toBe('ovly-new');
      expect(backfillParams[1]).toEqual(['prev-001', 'prev-002']);
    });

    it('(e) stamps build hash from deal_financial_models.assumptions_hash', async () => {
      // cap_rate has NO year1 mapping → 3 real queries (hash, supersede, insert)
      const client = makeTxnClient([
        hashRes('build-hash-42'), // latest build hash
        supersedeRes([]),
        insertRes('ovly-004'),
      ]);
      mockedGetPool.mockReturnValueOnce({ connect: vi.fn().mockResolvedValueOnce(client) } as any);

      const result = await writeAgentConfirmedOverlay({
        dealId: 'deal-005',
        fieldKey: 'cap_rate',
        value: 0.05,
      });

      expect(result.buildHash).toBe('build-hash-42');

      const realCalls = client.query.mock.calls.filter(([sql]) =>
        sql !== 'BEGIN' && sql !== 'COMMIT' && sql !== 'ROLLBACK'
      );
      expect(realCalls).toHaveLength(3);

      const hashCall = realCalls[0];
      const [hashSql, hashParams] = hashCall;
      expect(hashSql).toContain('deal_financial_models');
      expect(hashSql).toContain('assumptions_hash');
      expect(hashParams).toContain('deal-005');
    });

    it('rolls back transaction and throws on error', async () => {
      const client = {
        query: vi.fn(async (sql: string) => {
          if (sql === 'BEGIN') return { rows: [], command: 'BEGIN', rowCount: 0, oid: 0, fields: [] };
          throw new Error('DB failure');
        }),
        release: vi.fn(),
      };
      mockedGetPool.mockReturnValueOnce({ connect: vi.fn().mockResolvedValueOnce(client) } as any);

      await expect(
        writeAgentConfirmedOverlay({ dealId: 'deal-err', fieldKey: 'x', value: 1 })
      ).rejects.toThrow('DB failure');

      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalled();
    });
  });

  // ── W4: broker claim flag ──────────────────────────────────────────────────

  describe('writeBrokerClaimFlag', () => {
    it('inserts broker_claim overlay with NULL value and MEDIUM confidence', async () => {
      const client = makeTxnClient([
        supersedeRes([]),         // no previous broker_claim
        insertRes('ovly-flag-001'), // insert
      ]);
      mockedGetPool.mockReturnValueOnce({ connect: vi.fn().mockResolvedValueOnce(client) } as any);

      const result = await writeBrokerClaimFlag({
        dealId: 'deal-006',
        fieldKey: 'real_estate_tax.broker_flag',
        reasoning: 'Broker claims $450k but OM shows $380k',
      });

      expect(result.overlayId).toBe('ovly-flag-001');

      const realCalls = client.query.mock.calls.filter(([sql]) =>
        sql !== 'BEGIN' && sql !== 'COMMIT' && sql !== 'ROLLBACK'
      );
      expect(realCalls).toHaveLength(2);

      const insertCall = realCalls[1];
      const [insertSql, insertParams] = insertCall;
      expect(insertSql).toContain('INSERT INTO deal_assumption_overlays');
      expect(insertSql).toContain('broker_claim'); // hardcoded in SQL
      expect(insertSql).toContain('FLAG');         // hardcoded in SQL
      expect(insertSql).toContain('MEDIUM');       // hardcoded in SQL
      expect(insertParams).toContain('real_estate_tax.broker_flag');
    });

    it('supersedes previous broker_claim for the same field', async () => {
      const client = makeTxnClient([
        supersedeRes(['old-flag-001']),
        insertRes('ovly-flag-002'),
        okRes(), // back-fill
      ]);
      mockedGetPool.mockReturnValueOnce({ connect: vi.fn().mockResolvedValueOnce(client) } as any);

      await writeBrokerClaimFlag({
        dealId: 'deal-007',
        fieldKey: 'insurance.broker_flag',
        reasoning: 'Updated discrepancy',
      });

      const realCalls = client.query.mock.calls.filter(([sql]) =>
        sql !== 'BEGIN' && sql !== 'COMMIT' && sql !== 'ROLLBACK'
      );
      expect(realCalls).toHaveLength(3);

      const supersedeCall = realCalls[0];
      expect(supersedeCall[0]).toContain('superseded_at = NOW()');

      const backfillCall = realCalls[2];
      expect(backfillCall[0]).toContain('superseded_by = $1');
      expect(backfillCall[1][0]).toBe('ovly-flag-002');
    });
  });
});
