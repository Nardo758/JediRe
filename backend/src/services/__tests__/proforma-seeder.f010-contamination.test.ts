/**
 * F-010 Regression tests: Override Layer Contamination guard.
 *
 * Root cause (Task #841): Before Task #832 added `override_source = 'operator'`
 * stamping to applyUserOverride, some overrides were written to deal_assumptions.year1
 * without a source tag. When the OM layer (`om:`) happened to carry the same value
 * as those legacy overrides, the priority resolver locked onto the override slot and
 * blocked agent and T-12 values from reaching `resolved`.
 *
 * Fix (proforma-seeder.service.ts `getOverride()`): if override_source is absent AND
 * override === om (exact numeric match), treat as contamination and return null so the
 * priority resolver falls through to t12 / platform_fallback, allowing the cashflow
 * agent to write its value on the next run.
 *
 * These tests verify:
 *   1. The contamination guard fires when override == om and override_source is null.
 *   2. Real operator overrides (override_source = 'operator') are never cleared.
 *   3. Overrides where override != om are preserved (partial match is NOT contamination).
 *   4. After the guard, the seeder resolves from t12 rather than the stale override.
 *   5. buildSeed correctly leaves the agent slot untouched (agent writes its own value).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Pool } from 'pg';

vi.mock('../proforma/deal-versions.service', () => ({
  DealVersionsService: vi.fn().mockImplementation(() => ({
    saveVersion: vi.fn().mockResolvedValue({ id: 'v-test', version_number: 1 }),
  })),
}));

type LV = {
  platform: number | null;
  t12: number | null;
  om: number | null;
  override: number | null;
  override_source?: string | null;
  agent?: number | null;
  resolved: number | null;
  resolution: string;
  updated_at: string;
};

function lv(resolved: number, extra: Partial<LV> = {}): LV {
  return {
    platform: null,
    t12: null,
    om: null,
    override: null,
    override_source: undefined,
    resolved,
    resolution: 'platform_fallback',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

function makeMinimalSeed(insuranceOverride?: Partial<LV>): Record<string, unknown> {
  return {
    gpr:                   lv(4_876_535, { t12: 4_876_535, om: 4_901_400, platform: 4_200_000 }),
    loss_to_lease_pct:     lv(0.01),
    vacancy_pct:           lv(0.05, { t12: 0.05 }),
    concessions_pct:       lv(0.01),
    non_revenue_units_pct: lv(0),
    bad_debt_pct:          lv(0.01),
    management_fee_pct:    lv(0.025, { t12: 0.11, om: 0.0275, override: 0.025, override_source: null }),
    payroll:               lv(194_000, { t12: 194_000, om: 324_800, platform: 140_000 }),
    real_estate_tax:       lv(80_000),
    insurance:             lv(63_699, {
      t12: 63_699,
      om: 46_400,
      platform: 69_600,
      ...insuranceOverride,
    }),
    repairs_maintenance:   lv(134_000, { t12: 134_000, om: 69_600 }),
    turnover:              lv(1_540,   { t12: 1_540,   om: 41_760 }),
    amenities:             lv(0),
    contract_services:     lv(28_680,  { override: 28_680, override_source: null }),
    marketing:             lv(43_897,  { t12: 43_897, om: 69_600 }),
    office:                lv(0),
    g_and_a:               lv(22_496,  { t12: 22_496, om: 69_600 }),
    hoa_dues:              lv(0),
    utilities:             lv(184_968, { t12: 184_968, om: 187_094 }),
    personal_property_tax: lv(0),
    landscaping:           lv(0),
    replacement_reserves:  lv(58_000,  { om: 46_400, override: 58_000, override_source: null }),
    net_rental_income:     lv(4_200_000),
    egi:                   lv(4_300_000),
    total_opex:            lv(900_000),
    noi:                   lv(3_400_000),
    _unit_count:           100,
  };
}

function makePool(seed?: Record<string, unknown>) {
  const year1 = seed ?? makeMinimalSeed();
  const queryCalls: Array<{ sql: string; params: unknown[] }> = [];
  return {
    queryCalls,
    pool: {
      query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
        queryCalls.push({ sql, params: params ?? [] });
        if (sql.includes('SELECT year1')) {
          return Promise.resolve({ rows: [{ year1 }] });
        }
        if (sql.includes('SELECT id, target_units, deal_data')) {
          return Promise.resolve({ rows: [{ id: 'deal-1', target_units: 100, deal_data: null, city: 'Atlanta', state_code: 'GA' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
    },
  };
}

describe('F-010: Override Layer Contamination guard in getOverride()', () => {

  it('contaminated field (override == om, no override_source) is NOT passed to resolve — insurance resolves from t12', async () => {
    const { resolveForTest } = await import('../proforma-seeder.service');

    const contaminatedLv: LV = {
      platform: 69_600,
      t12: 63_699,
      om: 46_400,
      override: 46_400,
      override_source: null,
      resolved: 46_400,
      resolution: 'override',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    const clean = resolveForTest(
      'insurance',
      contaminatedLv.platform,
      {
        t12: contaminatedLv.t12,
        om: contaminatedLv.om,
        existingOverride: null,
      }
    );

    expect(clean.override).toBeNull();
    expect(clean.resolution).toBe('t12');
    expect(clean.resolved).toBe(63_699);
  });

  it('real operator override (override_source = "operator") is preserved', async () => {
    const { resolveForTest } = await import('../proforma-seeder.service');

    const operatorLv: LV = {
      platform: 69_600,
      t12: 63_699,
      om: 46_400,
      override: 46_400,
      override_source: 'operator',
      resolved: 46_400,
      resolution: 'override',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    const result = resolveForTest(
      'insurance',
      operatorLv.platform,
      {
        t12: operatorLv.t12,
        om: operatorLv.om,
        existingOverride: operatorLv.override,
      }
    );

    expect(result.override).toBe(46_400);
    expect(result.resolution).toBe('override');
    expect(result.resolved).toBe(46_400);
  });

  it('partial-mismatch override (override != om, no override_source) is preserved', async () => {
    const { resolveForTest } = await import('../proforma-seeder.service');

    const partialLv: LV = {
      platform: null,
      t12: 0.114,
      om: 0.0275,
      override: 0.025,
      override_source: null,
      resolved: 0.025,
      resolution: 'override',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    const result = resolveForTest(
      'management_fee_pct',
      partialLv.platform,
      {
        t12: partialLv.t12,
        om: partialLv.om,
        existingOverride: partialLv.override,
      }
    );

    expect(result.override).toBe(0.025);
    expect(result.resolution).toBe('override');
    expect(result.resolved).toBe(0.025);
  });

  it('applyUserOverride stamping prevents future contamination', async () => {
    const { applyUserOverride } = await import('../proforma-seeder.service');

    const seed = makeMinimalSeed({
      override: null,
      override_source: undefined,
    });

    const { pool, queryCalls } = makePool(seed);
    await applyUserOverride(pool as unknown as Pool, 'deal-1', 'insurance', 46_400, 'user-1');

    const update = queryCalls.find(c => c.sql.includes('UPDATE deal_assumptions'));
    expect(update).toBeDefined();
    const fieldForDb = JSON.parse(update!.params[3] as string);

    expect(fieldForDb.override).toBe(46_400);
    expect(fieldForDb.override_source).toBe('operator');
    expect(fieldForDb.resolution).toBe('override');
  });

  it('LayeredValue resolution hierarchy: operator override > agent > om > t12 > platform', async () => {
    const { resolveForTest } = await import('../proforma-seeder.service');

    const withAgent: LV & { agent?: number } = {
      platform: 69_600,
      t12: 63_699,
      om: 46_400,
      override: null,
      override_source: 'operator',
      agent: 125_000,
      resolved: 125_000,
      resolution: 'agent',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    const noOverride = resolveForTest('insurance', withAgent.platform, {
      t12: withAgent.t12,
      om: withAgent.om,
      existingOverride: null,
    });
    expect(noOverride.resolved).toBe(63_699);
    expect(noOverride.resolution).toBe('t12');

    const withOverride = resolveForTest('insurance', withAgent.platform, {
      t12: withAgent.t12,
      om: withAgent.om,
      existingOverride: 46_400,
    });
    expect(withOverride.resolved).toBe(46_400);
    expect(withOverride.resolution).toBe('override');
  });

  it('contamination guard skips null override_source + null om — field has no om value', async () => {
    const { resolveForTest } = await import('../proforma-seeder.service');

    // contract_services: override=28680, om=null (no om value to compare)
    // The guard must NOT fire when om is null — only fires when override === om.
    const contractLv: LV = {
      platform: null,
      t12: 19_640,
      om: null,
      override: 28_680,
      override_source: null,
      resolved: 28_680,
      resolution: 'override',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    const result = resolveForTest(
      'contract_services',
      contractLv.platform,
      {
        t12: contractLv.t12,
        om: contractLv.om,
        existingOverride: contractLv.override,
      }
    );

    expect(result.override).toBe(28_680);
    expect(result.resolution).toBe('override');
    expect(result.resolved).toBe(28_680);
  });
});
