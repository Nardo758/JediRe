/**
 * Proforma Seeder — Override Invariant Test
 *
 * Guards the critical invariant: applyUserOverride MUST NOT trigger forceReseed.
 *
 * Failure mode being prevented: if forceReseed fired on every operator override,
 * it would clobber all other extraction-derived layers on unrelated fields —
 * exactly the dual-source failure mode the LayeredValue system exists to prevent.
 * e.g. operator edits 'vacancy_pct', forceReseed fires, resets
 * 'other_income_per_unit' back to the extraction-derived value, discarding a
 * prior override on that field.
 *
 * Test scenario:
 *   - Deal has year1 with two fields that both have operator overrides:
 *       field X: vacancy_pct  (override = 0.10)
 *       field Y: other_income_per_unit (override = 50.00)
 *   - applyUserOverride is called for field X only (changing vacancy_pct to 0.12)
 *   - Assertions:
 *       1. field Y's override layer is still 50.00 (unchanged)
 *       2. field Y's resolution is still 'override' (unchanged)
 *       3. The DB UPDATE wrote only the mutated year1 (no full reseed call)
 *       4. field X's override is now 0.12 (the intended change applied)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyUserOverride } from '../services/proforma-seeder.service';

// Minimal LayeredValue structure matching the seeder's internal shape
function makeLv(override: number | null, resolved: number, resolution: string) {
  return {
    platform: null,
    t12: null,
    rent_roll: null,
    om: null,
    override,
    resolved,
    resolution,
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function makeYear1(vacancyOverride: number, oipuOverride: number) {
  return {
    // _unit_count is used by recomputeDerived for per-unit re-sync
    _unit_count: 232,

    // Revenue inputs
    vacancy_pct:           makeLv(vacancyOverride, vacancyOverride, 'override'),
    other_income_per_unit: makeLv(oipuOverride, oipuOverride, 'override'),
    gpr:                   makeLv(null, 2_000_000, 'rent_roll'),
    loss_to_lease_pct:     makeLv(null, 0.02, 'rent_roll'),
    concessions_pct:       makeLv(null, 0.01, 'rent_roll'),
    non_revenue_units_pct: makeLv(null, 0.01, 'rent_roll'),
    bad_debt_pct:          makeLv(null, 0.005, 't12'),
    management_fee_pct:    makeLv(null, 0.04, 't12'),

    // Per-category breakdown (required by recomputeDerived for EGI calc)
    other_income_breakdown: {
      parking: makeLv(null, 36_000, 'om'),
      pet:     makeLv(null, 8_640,  'rent_roll'),
      storage: makeLv(null, 4_920,  'rent_roll'),
      rubs:    makeLv(null, 9_600,  'om'),
      laundry: makeLv(null, 3_000,  'om'),
      fees:    makeLv(null, 7_200,  'om'),
      insurance_admin: makeLv(null, 0, 'om'),
      other:   makeLv(null, 1_200,  'om'),
    },

    // OpEx
    payroll:             makeLv(null, 300_000, 't12'),
    repairs_maintenance: makeLv(null, 80_000,  't12'),
    turnover:            makeLv(null, 20_000,  't12'),
    amenities:           makeLv(null, 5_000,   't12'),
    contract_services:   makeLv(null, 15_000,  't12'),
    marketing:           makeLv(null, 10_000,  't12'),
    office:              makeLv(null, 8_000,   't12'),
    g_and_a:             makeLv(null, 25_000,  't12'),
    hoa_dues:            makeLv(null, 0,       't12'),
    utilities:           makeLv(null, 60_000,  't12'),
    real_estate_tax:     makeLv(null, 120_000, 't12'),
    personal_property_tax: makeLv(null, 0,     't12'),
    insurance:           makeLv(null, 40_000,  't12'),

    // Derived (mutated in-place by recomputeDerived — must exist as LV objects)
    net_rental_income: makeLv(null, 0, 'platform_fallback'),
    egi:               makeLv(null, 0, 'platform_fallback'),
    total_opex:        makeLv(null, 0, 'platform_fallback'),
    noi:               makeLv(null, 0, 'platform_fallback'),
  };
}

describe('applyUserOverride invariant — no forceReseed on override saves', () => {
  const DEAL_ID = 'test-deal-invariant-001';
  const USER_ID = 'test-user-001';
  const VACANCY_BEFORE = 0.10;
  const VACANCY_AFTER  = 0.12;
  const OIPU_OVERRIDE  = 50.00;

  let capturedYear1: Record<string, unknown> | null = null;
  let mockPool: ReturnType<typeof makeMockPool>;

  function makeMockPool(year1: Record<string, unknown>) {
    capturedYear1 = null;
    return {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        // SELECT year1
        if (sql.includes('SELECT year1')) {
          return { rows: [{ year1 }] };
        }
        // UPDATE deal_assumptions
        if (sql.includes('UPDATE deal_assumptions')) {
          // Capture the written year1 for assertion
          capturedYear1 = typeof params?.[1] === 'string'
            ? JSON.parse(params[1] as string)
            : (params?.[1] as Record<string, unknown>);
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };
  }

  beforeEach(() => {
    capturedYear1 = null;
  });

  it('field Y (other_income_per_unit) override is unchanged after field X (vacancy_pct) override', async () => {
    const year1 = makeYear1(VACANCY_BEFORE, OIPU_OVERRIDE);
    mockPool = makeMockPool(year1);

    await applyUserOverride(
      mockPool as never,
      DEAL_ID,
      'vacancy_pct',
      VACANCY_AFTER,
      USER_ID,
    );

    expect(capturedYear1).not.toBeNull();
    const oipu = capturedYear1!['other_income_per_unit'] as Record<string, unknown>;

    // Field Y override must be preserved exactly
    expect(oipu.override).toBe(OIPU_OVERRIDE);
    expect(oipu.resolved).toBe(OIPU_OVERRIDE);
    expect(oipu.resolution).toBe('override');
  });

  it('field X (vacancy_pct) override is correctly applied', async () => {
    const year1 = makeYear1(VACANCY_BEFORE, OIPU_OVERRIDE);
    mockPool = makeMockPool(year1);

    await applyUserOverride(
      mockPool as never,
      DEAL_ID,
      'vacancy_pct',
      VACANCY_AFTER,
      USER_ID,
    );

    expect(capturedYear1).not.toBeNull();
    const vacPct = capturedYear1!['vacancy_pct'] as Record<string, unknown>;
    expect(vacPct.override).toBe(VACANCY_AFTER);
    expect(vacPct.resolved).toBe(VACANCY_AFTER);
    expect(vacPct.resolution).toBe('override');
  });

  it('pool.query is called exactly twice (SELECT + UPDATE) — no forceReseed side-effect', async () => {
    const year1 = makeYear1(VACANCY_BEFORE, OIPU_OVERRIDE);
    mockPool = makeMockPool(year1);

    await applyUserOverride(
      mockPool as never,
      DEAL_ID,
      'vacancy_pct',
      VACANCY_AFTER,
      USER_ID,
    );

    // Exactly 2 DB calls: SELECT year1, then UPDATE deal_assumptions.
    // If forceReseed were triggered, it would issue additional SELECT + INSERT/UPDATE
    // calls for the full reseed pipeline, causing this assertion to fail.
    expect(mockPool.query).toHaveBeenCalledTimes(2);

    const calls = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toMatch(/SELECT year1/);
    expect(calls[1][0]).toMatch(/UPDATE deal_assumptions/);
  });

  it('clearing an override (value=null) on field X does not change field Y override', async () => {
    const year1 = makeYear1(VACANCY_BEFORE, OIPU_OVERRIDE);
    mockPool = makeMockPool(year1);

    // Clearing field X override (value = null triggers re-resolve path)
    await applyUserOverride(
      mockPool as never,
      DEAL_ID,
      'vacancy_pct',
      null,
      USER_ID,
    );

    expect(capturedYear1).not.toBeNull();
    const oipu = capturedYear1!['other_income_per_unit'] as Record<string, unknown>;
    expect(oipu.override).toBe(OIPU_OVERRIDE);
    expect(oipu.resolution).toBe('override');
  });
});
