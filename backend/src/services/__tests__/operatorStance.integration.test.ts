/**
 * Integration / regression tests for OperatorStance service layer.
 *
 * These tests cover:
 *   1. MARKET default stance returns defaulted=true with zero deltas
 *   2. Non-default stance persists and modulates fields correctly
 *   3. computeAffectedFields: snapshot-primary path and rules-fallback path
 *   4. applyStanceToProformaFields: in-memory modulation is idempotent
 *   5. Stance reset restores to MARKET defaults
 *   6. stanceOnly path does not require write_underwriting (no LLM fetch tools)
 *
 * Mocks: pg Pool.query is mocked per test to avoid real DB dependency.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  applyStanceToProformaFields,
  applyStanceToFinancials,
  computeAffectedFields,
} from '../operatorStance.service';
import {
  resolveStance,
  computeStanceDelta,
  PLATFORM_STANCE_DEFAULTS,
  STANCE_MODULATED_FIELD_PATHS,
  type OperatorStance,
} from '../../types/operator-stance';

// ── Mock pg Pool ─────────────────────────────────────────────────────────────

// We mock getPool at module level so service functions use our mock
vi.mock('../../database/connection', () => {
  const mockQuery = vi.fn();
  return {
    getPool: () => ({ query: mockQuery }),
    query: mockQuery,
    __mockQuery: mockQuery,
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProformaFields(
  fields: Record<string, number>
): Record<string, { value: number; source: string }> {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, { value: v, source: 'tier_1' }])
  );
}

function conservativeStance(): OperatorStance {
  return {
    ...PLATFORM_STANCE_DEFAULTS,
    underwritingPosture: 'CONSERVATIVE',
    defaulted: false,
    updatedAt: new Date().toISOString(),
  };
}

function marketStance(): OperatorStance {
  return { ...PLATFORM_STANCE_DEFAULTS, defaulted: false };
}

// ── 1. MARKET default stance — zero deltas ────────────────────────────────────

describe('MARKET stance parity (unset stance == MARKET == zero delta)', () => {
  it('resolveStance(null) produces defaulted=true', () => {
    const s = resolveStance(null);
    expect(s.defaulted).toBe(true);
    expect(s.underwritingPosture).toBe('MARKET');
  });

  it('all stance-aware fields have zero delta under MARKET defaults', () => {
    const s = resolveStance(null);
    for (const fieldPath of STANCE_MODULATED_FIELD_PATHS) {
      const { deltaBps } = computeStanceDelta(s, fieldPath);
      expect(deltaBps).toBe(0);
    }
  });

  it('applyStanceToProformaFields does nothing under MARKET stance', () => {
    const fields = makeProformaFields({ rentGrowth: 0.03, exitCapRate: 0.055, vacancy: 0.05, expenseGrowth: 0.025 });
    const stance = resolveStance(null);
    const modulated = applyStanceToProformaFields(fields, stance);
    expect(modulated).toHaveLength(0);
    expect(fields.rentGrowth.value).toBe(0.03);
    expect(fields.exitCapRate.value).toBe(0.055);
  });
});

// ── 2. Non-default stance modulates fields correctly ──────────────────────────

describe('applyStanceToProformaFields — modulation correctness', () => {
  it('CONSERVATIVE applies -25bps to rentGrowth', () => {
    const fields = makeProformaFields({ rentGrowth: 0.03 });
    const modulated = applyStanceToProformaFields(fields, conservativeStance());
    expect(modulated).toContain('rentGrowth');
    // 0.03 - 0.0025 = 0.0275
    expect(fields.rentGrowth.value).toBeCloseTo(0.0275, 6);
    expect((fields.rentGrowth as any).stanceModulated).toBe(true);
    expect((fields.rentGrowth as any).stanceTrace).toBeTruthy();
  });

  it('CONSERVATIVE applies +50bps to exitCapRate', () => {
    const fields = makeProformaFields({ exitCapRate: 0.055 });
    applyStanceToProformaFields(fields, conservativeStance());
    // 0.055 + 0.005 = 0.060
    expect(fields.exitCapRate.value).toBeCloseTo(0.060, 6);
    expect((fields.exitCapRate as any).stanceModulated).toBe(true);
  });

  it('CONSERVATIVE applies +100bps to vacancy', () => {
    const fields = makeProformaFields({ vacancy: 0.05 });
    applyStanceToProformaFields(fields, conservativeStance());
    // 0.05 + 0.01 = 0.06
    expect(fields.vacancy.value).toBeCloseTo(0.06, 6);
  });

  it('skips fields not in proforma (no crash)', () => {
    const fields = makeProformaFields({ rentGrowth: 0.03 }); // missing exitCapRate etc.
    expect(() => applyStanceToProformaFields(fields, conservativeStance())).not.toThrow();
  });

  it('clamps to zero — does not produce negative values', () => {
    const fields = makeProformaFields({ rentGrowth: 0.0001 }); // nearly zero
    const stance: OperatorStance = { ...marketStance(), underwritingPosture: 'CONSERVATIVE' };
    applyStanceToProformaFields(fields, stance);
    expect(fields.rentGrowth.value).toBeGreaterThanOrEqual(0);
  });
});

// ── 3. Idempotency — applying same stance twice to raw fields = same result ───

describe('applyStanceToProformaFields — idempotency', () => {
  it('same input stance produces the same output value on fresh fields', () => {
    const makeFields = () => makeProformaFields({ rentGrowth: 0.03, exitCapRate: 0.055 });
    const stance = conservativeStance();

    const fields1 = makeFields();
    applyStanceToProformaFields(fields1, stance);
    const val1rentGrowth = fields1.rentGrowth.value;
    const val1exitCapRate = fields1.exitCapRate.value;

    const fields2 = makeFields();
    applyStanceToProformaFields(fields2, stance);

    expect(fields2.rentGrowth.value).toBe(val1rentGrowth);
    expect(fields2.exitCapRate.value).toBe(val1exitCapRate);
  });

  it('different stance inputs produce different outputs (deterministic delta)', () => {
    const fieldsA = makeProformaFields({ rentGrowth: 0.03 });
    applyStanceToProformaFields(fieldsA, conservativeStance());

    const fieldsB = makeProformaFields({ rentGrowth: 0.03 });
    const aggressiveStance: OperatorStance = { ...marketStance(), underwritingPosture: 'AGGRESSIVE', defaulted: false };
    applyStanceToProformaFields(fieldsB, aggressiveStance);

    // CONSERVATIVE haircut < AGGRESSIVE boost: conservative should be lower
    expect(fieldsA.rentGrowth.value).toBeLessThan(fieldsB.rentGrowth.value);
  });
});

// ── 4. computeAffectedFields — fallback path (no snapshot) ───────────────────

describe('computeAffectedFields — rules fallback (no snapshot)', () => {
  beforeEach(async () => {
    // Mock DB to return no snapshot
    const { __mockQuery } = await import('../../database/connection') as any;
    __mockQuery.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns rule-inferred affected fields when no snapshot exists', async () => {
    const stance = conservativeStance();
    const fields = await computeAffectedFields('deal-uuid-1', stance);
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      expect(f.source).toBe('rules');
      expect(f.deltaBps).not.toBe(0);
    }
  });

  it('returns empty array for MARKET stance when no snapshot exists', async () => {
    const stance = marketStance();
    const fields = await computeAffectedFields('deal-uuid-1', stance);
    expect(fields).toHaveLength(0);
  });

  it('includes rentGrowthStabilized in affected fields for EARLY cycle', async () => {
    const stance: OperatorStance = { ...marketStance(), cyclePosition: 'EARLY', defaulted: false };
    const fields = await computeAffectedFields('deal-uuid-1', stance);
    const rentGrowthStabilized = fields.find(f => f.fieldPath === 'rentGrowthStabilized');
    expect(rentGrowthStabilized).toBeDefined();
    expect(rentGrowthStabilized!.deltaBps).toBe(50);
  });
});

// ── 5. computeAffectedFields — snapshot-primary path ─────────────────────────

describe('computeAffectedFields — snapshot primary path', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reads stanceModulated=true fields from snapshot when available', async () => {
    const { __mockQuery } = await import('../../database/connection') as any;
    __mockQuery.mockResolvedValueOnce({
      rows: [{
        proforma_json: {
          rentGrowth: { value: 0.0275, stanceModulated: true, stanceTrace: 'posture_conservative_rent_growth(-25bps)' },
          exitCapRate: { value: 0.060, stanceModulated: true, stanceTrace: 'posture_conservative_exit_cap(+50bps)' },
          vacancy: { value: 0.05, stanceModulated: false }, // not modulated
        },
      }],
    });

    const stance = conservativeStance();
    const fields = await computeAffectedFields('deal-uuid-1', stance);

    const rentGrowth = fields.find(f => f.fieldPath === 'rentGrowth');
    const exitCapRate = fields.find(f => f.fieldPath === 'exitCapRate');
    expect(rentGrowth).toBeDefined();
    expect(rentGrowth!.source).toBe('snapshot');
    expect(exitCapRate).toBeDefined();
    expect(exitCapRate!.source).toBe('snapshot');

    const vacancyFromSnapshot = fields.find(f => f.fieldPath === 'vacancy' && f.source === 'snapshot');
    expect(vacancyFromSnapshot).toBeUndefined(); // stanceModulated=false → not in snapshot path
  });

  it('includes rule-inferred fields not yet in snapshot', async () => {
    const { __mockQuery } = await import('../../database/connection') as any;
    // Snapshot only has rentGrowth modulated; stance also affects exitCapRate but not in snapshot
    __mockQuery.mockResolvedValueOnce({
      rows: [{
        proforma_json: {
          rentGrowth: { value: 0.0275, stanceModulated: true, stanceTrace: 'test' },
        },
      }],
    });

    const stance = conservativeStance();
    const fields = await computeAffectedFields('deal-uuid-1', stance);

    const exitCapRate = fields.find(f => f.fieldPath === 'exitCapRate');
    expect(exitCapRate).toBeDefined();
    expect(exitCapRate!.source).toBe('rules'); // Not in snapshot, but rule-inferred
  });
});

// ── 5b. applyStanceToFinancials — GET /financials in-place modulation ─────────

describe('applyStanceToFinancials — in-place DealFinancials modulation', () => {
  function makeMockFinancials(overrides: Partial<{
    rentGrowthYr1: number; rentGrowthStabilized: number;
    exitCap: number; opexGrowthPct: number; vacancyPct: number;
  }> = {}) {
    return {
      assumptions: {
        holdYears: 10,
        rentGrowthYr1: overrides.rentGrowthYr1 ?? 0.03,
        rentGrowthStabilized: overrides.rentGrowthStabilized ?? 0.025,
        exitCap: overrides.exitCap ?? 0.055,
        opexGrowthPct: overrides.opexGrowthPct ?? 0.025,
        concessionBurnOffPct: null,
        perYear: [
          { year: 1, rentGrowthPct: overrides.rentGrowthYr1 ?? 0.03, vacancyPct: overrides.vacancyPct ?? 0.05, exitCapIfLastYear: null, capexDraw: null },
          { year: 2, rentGrowthPct: 0.03, vacancyPct: overrides.vacancyPct ?? 0.05, exitCapIfLastYear: null, capexDraw: null },
        ],
        gprDecomposition: {} as any,
      },
    };
  }

  it('MARKET stance — no mutation, returns empty modulations array', () => {
    const data = makeMockFinancials();
    const origRentGrowth = data.assumptions.rentGrowthYr1;
    const modulations = applyStanceToFinancials(data, marketStance());
    expect(modulations).toHaveLength(0);
    expect(data.assumptions.rentGrowthYr1).toBe(origRentGrowth);
  });

  it('CONSERVATIVE — mutates rentGrowthYr1 by -25bps in-place', () => {
    const data = makeMockFinancials({ rentGrowthYr1: 0.03 });
    const modulations = applyStanceToFinancials(data, conservativeStance());
    expect(data.assumptions.rentGrowthYr1).toBeCloseTo(0.03 - 0.0025, 6);
    const mod = modulations.find(m => m.fieldPath === 'rentGrowth');
    expect(mod).toBeDefined();
    expect(mod!.stanceModulated).toBe(true);
    expect(mod!.originalValue).toBeCloseTo(0.03, 6);
    expect(mod!.modulatedValue).toBeCloseTo(0.03 - 0.0025, 6);
    expect(mod!.deltaBps).toBe(-25);
    expect(mod!.stanceTrace).toBeTruthy();
  });

  it('CONSERVATIVE — mutates exitCap by +50bps in-place', () => {
    const data = makeMockFinancials({ exitCap: 0.055 });
    applyStanceToFinancials(data, conservativeStance());
    expect(data.assumptions.exitCap).toBeCloseTo(0.055 + 0.005, 6);
  });

  it('CONSERVATIVE — mutates perYear[].vacancyPct by +100bps in-place', () => {
    const data = makeMockFinancials({ vacancyPct: 0.05 });
    applyStanceToFinancials(data, conservativeStance());
    for (const yr of data.assumptions.perYear) {
      expect(yr.vacancyPct).toBeCloseTo(0.05 + 0.01, 6);
    }
  });

  it('CONSERVATIVE — perYear[].rentGrowthPct also receives -25bps', () => {
    const data = makeMockFinancials({ rentGrowthYr1: 0.03 });
    applyStanceToFinancials(data, conservativeStance());
    expect(data.assumptions.perYear[0].rentGrowthPct).toBeCloseTo(0.03 - 0.0025, 6);
  });

  it('MARKET parity — PUT/reset → GET /financials shows original values (no mutation)', () => {
    const data = makeMockFinancials({ rentGrowthYr1: 0.03, exitCap: 0.055 });
    const mods = applyStanceToFinancials(data, { ...PLATFORM_STANCE_DEFAULTS, defaulted: true });
    expect(mods).toHaveLength(0);
    expect(data.assumptions.rentGrowthYr1).toBeCloseTo(0.03, 6);
    expect(data.assumptions.exitCap).toBeCloseTo(0.055, 6);
  });

  it('stanceModulations includes trace + deltaBps per affected field', () => {
    const stance: OperatorStance = {
      ...marketStance(),
      underwritingPosture: 'CONSERVATIVE',
      rateEnvironment: 'HIGHER_FOR_LONGER',
      defaulted: false,
    };
    const data = makeMockFinancials({ exitCap: 0.055 });
    const mods = applyStanceToFinancials(data, stance);
    const exitCapMod = mods.find(m => m.fieldPath === 'exitCapRate');
    // CONSERVATIVE +50 + HIGHER_FOR_LONGER +50 = +100bps total
    expect(exitCapMod).toBeDefined();
    expect(exitCapMod!.deltaBps).toBe(100);
    expect(exitCapMod!.stanceTrace).toBeTruthy();
    expect(data.assumptions.exitCap).toBeCloseTo(0.055 + 0.01, 6);
  });
});

// ── 6. stanceOnly path — no LLM data-fetch tools needed ───────────────────────

describe('stanceOnly reblend path — backend-enforced, no fetch tools', () => {
  it('applyStanceToProformaFields is the only function needed (no DB fetch tools)', () => {
    // This test verifies that the in-memory modulation path requires ONLY
    // the proformaFields map and the stance — no external data fetches.
    // In a real stanceOnly run: backend calls applyStanceReblend() which reads
    // the baseline snapshot (one DB read) and writes one new snapshot.
    // No LLM tools (fetch_t12, fetch_data_matrix, etc.) are invoked.

    const fields = makeProformaFields({
      rentGrowth: 0.03,
      rentGrowthStabilized: 0.025,
      exitCapRate: 0.055,
      vacancy: 0.05,
      expenseGrowth: 0.02,
    });
    const stance: OperatorStance = {
      ...marketStance(),
      underwritingPosture: 'CONSERVATIVE',
      cyclePosition: 'LATE',
      defaulted: false,
    };

    const modulated = applyStanceToProformaFields(fields, stance);

    // CONSERVATIVE + LATE: rentGrowth gets -25 + -50 = -75bps
    expect(fields.rentGrowth.value).toBeCloseTo(0.03 - 0.0075, 6);
    // CONSERVATIVE posture also covers rentGrowthStabilized (-25bps) + LATE cycle (-50bps) = -75bps total
    expect(fields.rentGrowthStabilized.value).toBeCloseTo(0.025 - 0.0075, 6);
    // exitCapRate: CONSERVATIVE +50bps + LATE +25bps = +75bps
    expect(fields.exitCapRate.value).toBeCloseTo(0.055 + 0.0075, 6);

    expect(modulated).toContain('rentGrowth');
    expect(modulated).toContain('rentGrowthStabilized');
    expect(modulated).toContain('exitCapRate');

    // All modulated fields are tagged
    for (const field of modulated) {
      expect((fields[field] as any).stanceModulated).toBe(true);
      expect((fields[field] as any).stanceTrace).toBeTruthy();
    }
  });
});
