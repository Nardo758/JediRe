/**
 * Regression tests for applyUserOverride — Task #832.
 *
 * Core invariant: an operator override save must NEVER clobber agent sub-keys
 * written by the Cashflow Agent to any field in year1.
 *
 * The previous implementation did:
 *   SET year1 = $full_seed::jsonb
 * which overwrote all 16 AGENT_FIELD_TO_YEAR1 fields on every operator save.
 *
 * The fix uses a two-layer jsonb merge-set:
 *   Layer A — derived fields via top-level `year1 || $derivedUpdate`
 *   Layer B — target field via `jsonb_set(…, path, COALESCE(object) || $field, true)`
 *
 * These tests verify:
 *   1. SQL uses jsonb_set with CASE scalar-guard — not the old full-replace.
 *   2. $3 (derivedUpdate) does NOT include the target field's root key.
 *   3. $4 (fieldForDb) is the in-memory field object, not the whole seed.
 *   4. Derived fields ARE present in $3 (Layer A).
 *   5. Version snapshot is attempted after the DB write.
 *   6. Version snapshot failure does not throw / roll back the operator save.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { applyUserOverride } from '../proforma-seeder.service';

// ── Mock DealVersionsService (dynamic import inside applyUserOverride) ────────
vi.mock('../proforma/deal-versions.service', () => ({
  DealVersionsService: vi.fn().mockImplementation(() => ({
    saveVersion: vi.fn().mockResolvedValue({ id: 'v-test', version_number: 1 }),
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

type LV = {
  t12: number | null;
  om: number | null;
  platform: number | null;
  override: number | null;
  resolved: number | null;
  resolution: string;
  updated_at: string;
  agent?: number;
};

function lv(resolved = 0, extra: Partial<LV> = {}): LV {
  return {
    t12: null,
    om: null,
    platform: null,
    override: null,
    resolved,
    resolution: 'platform_fallback',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...extra,
  };
}

/**
 * Minimal ProFormaYear1Seed that satisfies recomputeDerived's requirements.
 * All the fields recomputeDerived assigns to (net_rental_income, egi, etc.)
 * must be non-null objects; everything else is accessed via `r()` which
 * safely falls back to 0.
 */
function makeMinimalSeed(): Record<string, unknown> {
  return {
    gpr:                   lv(1_000_000),
    loss_to_lease_pct:     lv(0.01),
    vacancy_pct:           lv(0.05),
    concessions_pct:       lv(0.01),
    non_revenue_units_pct: lv(0),
    bad_debt_pct:          lv(0.01),
    management_fee_pct:    lv(0.05),
    payroll:               lv(55_000),
    real_estate_tax:       lv(80_000),
    insurance:             lv(50_000, { agent: 125_280, resolved: 125_280, resolution: 'agent' }),
    repairs_maintenance:   lv(0),
    turnover:              lv(0),
    amenities:             lv(0),
    contract_services:     lv(0),
    marketing:             lv(0),
    office:                lv(0),
    g_and_a:               lv(0),
    hoa_dues:              lv(0),
    utilities:             lv(0),
    personal_property_tax: lv(0),
    landscaping:           lv(0),
    // required targets for recomputeDerived assignments
    net_rental_income:     lv(900_000),
    egi:                   lv(900_000),
    total_opex:            lv(400_000),
    noi:                   lv(500_000),
    _unit_count:           100,
  };
}

// ── Shared mock state ─────────────────────────────────────────────────────────

let queryCalls: Array<{ sql: string; params: unknown[] }> = [];

function makePool(seedOverride?: Record<string, unknown>) {
  const year1 = seedOverride ?? makeMinimalSeed();
  queryCalls = [];
  return {
    query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
      queryCalls.push({ sql, params: params ?? [] });
      if (sql.includes('SELECT year1')) {
        return Promise.resolve({ rows: [{ year1 }] });
      }
      return Promise.resolve({ rows: [] });
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('applyUserOverride: Task #832 — agent sub-key preservation', () => {

  beforeEach(() => { queryCalls = []; });

  it('UPDATE SQL uses jsonb_set merge pattern — not the old full-replace', async () => {
    const pool = makePool();
    await applyUserOverride(pool as any, 'deal-1', 'payroll', 60_000, 'user-1');

    const update = queryCalls.find(c => c.sql.includes('UPDATE deal_assumptions'));
    expect(update, 'UPDATE call must exist').toBeDefined();

    // New pattern — must contain jsonb_set with CASE scalar guard
    expect(update!.sql).toContain('jsonb_set');
    expect(update!.sql).toContain('jsonb_typeof');
    expect(update!.sql).toContain('CASE');

    // Must NOT be the old full-replace that clobbered agent sub-keys
    expect(update!.sql).not.toMatch(/SET year1\s*=\s*\$2::jsonb/);
  });

  it('$2 (path) equals the split fieldPath for a top-level field', async () => {
    const pool = makePool();
    await applyUserOverride(pool as any, 'deal-1', 'payroll', 60_000, 'user-1');

    const update = queryCalls.find(c => c.sql.includes('UPDATE deal_assumptions'));
    expect(update!.params[1]).toEqual(['payroll']);
  });

  it('$2 (path) carries the full path array for a nested field', async () => {
    const seed = makeMinimalSeed();
    // Add a nested field structure so the path-navigation doesn't throw
    (seed as any).utilities_breakdown = {
      water_sewer: lv(12_000),
    };
    const pool = makePool(seed);
    await applyUserOverride(
      pool as any, 'deal-1', 'utilities_breakdown.water_sewer', 13_000, 'user-1'
    );

    const update = queryCalls.find(c => c.sql.includes('UPDATE deal_assumptions'));
    expect(update!.params[1]).toEqual(['utilities_breakdown', 'water_sewer']);
  });

  it('$3 (derivedUpdate) contains the standard derived fields', async () => {
    const pool = makePool();
    await applyUserOverride(pool as any, 'deal-1', 'payroll', 60_000, 'user-1');

    const update = queryCalls.find(c => c.sql.includes('UPDATE deal_assumptions'));
    const derived = JSON.parse(update!.params[2] as string);

    // All four mandatory derived fields must be present
    expect(derived).toHaveProperty('net_rental_income');
    expect(derived).toHaveProperty('egi');
    expect(derived).toHaveProperty('total_opex');
    expect(derived).toHaveProperty('noi');
  });

  it('$3 (derivedUpdate) does NOT include the target field root key', async () => {
    const pool = makePool();
    // Override payroll — its root key must not appear in derivedUpdate
    await applyUserOverride(pool as any, 'deal-1', 'payroll', 60_000, 'user-1');

    const update = queryCalls.find(c => c.sql.includes('UPDATE deal_assumptions'));
    const derived = JSON.parse(update!.params[2] as string);

    expect(derived).not.toHaveProperty('payroll');
  });

  it('$4 (fieldForDb) does NOT contain the agent sub-key for the target field', async () => {
    // This is the core regression assertion:
    // The field being overridden is payroll.  The agent never wrote to payroll
    // in our minimal seed, so the in-memory field has no `agent` key.
    // If the full seed were serialised as $4, the insurance field (which has
    // agent: 125_280) would appear — this test catches that regression.
    const pool = makePool();
    await applyUserOverride(pool as any, 'deal-1', 'payroll', 60_000, 'user-1');

    const update = queryCalls.find(c => c.sql.includes('UPDATE deal_assumptions'));
    const fieldForDb = JSON.parse(update!.params[3] as string);

    // Must be the payroll field object, NOT the whole seed
    // (if it were the whole seed it would have an 'insurance' key)
    expect(fieldForDb).not.toHaveProperty('insurance');
    expect(fieldForDb).not.toHaveProperty('gpr');
    // Must contain the operator override value
    expect(fieldForDb.override).toBe(60_000);
    expect(fieldForDb.resolved).toBe(60_000);
    expect(fieldForDb.resolution).toBe('override');
    expect(fieldForDb.override_source).toBe('operator');
  });

  it('insurance.agent sub-key is not in $4 when overriding a different field', async () => {
    // Verify that a concurrent agent write to insurance.agent (125_280) would
    // be preserved by the SQL COALESCE merge — confirmed by checking that $4
    // contains only the payroll field (no insurance key) so insurance is
    // untouched by the jsonb_set path parameter.
    const pool = makePool();
    await applyUserOverride(pool as any, 'deal-1', 'payroll', 60_000, 'user-1');

    const update = queryCalls.find(c => c.sql.includes('UPDATE deal_assumptions'));
    const fieldForDb = JSON.parse(update!.params[3] as string);
    // Confirm $4 is the payroll LayeredValue, not the full seed
    expect(fieldForDb).not.toHaveProperty('insurance');
  });

  it('scalar guard — CASE jsonb_typeof present in UPDATE SQL', async () => {
    // Verifies that the scalar guard protecting legacy raw-number DB values is
    // present in the generated SQL so it cannot be accidentally removed.
    const pool = makePool();
    await applyUserOverride(pool as any, 'deal-1', 'insurance', 46_400, 'user-1');

    const update = queryCalls.find(c => c.sql.includes('UPDATE deal_assumptions'));
    expect(update!.sql).toContain('jsonb_typeof');
    expect(update!.sql).toContain("'object'");
    expect(update!.sql).toContain("'{}'::jsonb");
  });

  it('clears an override without throwing (value = null)', async () => {
    const seed = makeMinimalSeed();
    (seed as any).payroll = {
      ...lv(55_000),
      override: 99_000,
      resolved: 99_000,
      resolution: 'override',
    };
    const pool = makePool(seed);
    await expect(
      applyUserOverride(pool as any, 'deal-1', 'payroll', null, 'user-1')
    ).resolves.toBeUndefined();

    const update = queryCalls.find(c => c.sql.includes('UPDATE deal_assumptions'));
    expect(update).toBeDefined();
    const fieldForDb = JSON.parse(update!.params[3] as string);
    expect(fieldForDb.override).toBeNull();
    // override_source is explicitly null on clear so JSON.stringify includes it
    // and the JSONB || merge removes the stale 'operator' value from the DB.
    expect(fieldForDb.override_source).toBeNull();
  });

  it('version snapshot is attempted after the DB write', async () => {
    const pool = makePool();
    await applyUserOverride(pool as any, 'deal-1', 'payroll', 60_000, 'user-1');

    // DealVersionsService.saveVersion should have been called once
    const { DealVersionsService } = await import('../proforma/deal-versions.service');
    const instance = (DealVersionsService as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(instance?.saveVersion).toHaveBeenCalledTimes(1);
    const call = instance.saveVersion.mock.calls[0][0];
    expect(call.trigger).toBe('operator_override');
    expect(call.note).toBe('operator_override:payroll');
    expect(call.dealId).toBe('deal-1');
  });

  it('version snapshot failure does not propagate — override still succeeds', async () => {
    // Simulate a failing version save
    const { DealVersionsService } = await import('../proforma/deal-versions.service');
    (DealVersionsService as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      saveVersion: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    }));

    const pool = makePool();
    // Must not throw even though saveVersion rejects
    await expect(
      applyUserOverride(pool as any, 'deal-1', 'payroll', 60_000, 'user-1')
    ).resolves.toBeUndefined();
  });
});
