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
import { applyUserOverride, isExcludedFromOpex } from '../services/proforma-seeder.service';

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

/**
 * S1-01 custom opex filter — regression guard for the four gap patterns
 * added 2026-05-08.
 *
 * Each test feeds isExcludedFromOpex() one real-world GL label that slipped
 * through EXCLUDE_FROM_CUSTOM_OPEX before the patch and asserts it is now
 * correctly classified as non-opex.  A final set of assertions confirms that
 * genuine opex labels still pass through (are NOT excluded).
 */
describe('isExcludedFromOpex — S1-01 gap patterns', () => {
  describe('gap 1: rental revenue (≠ rental income)', () => {
    it('excludes "Multifamily Rental Revenue Net"', () => {
      expect(isExcludedFromOpex('Multifamily Rental Revenue Net')).toBe(true);
    });
    it('excludes "Rental Revenue"', () => {
      expect(isExcludedFromOpex('Rental Revenue')).toBe(true);
    });
    it('excludes "Gross Rental Revenue"', () => {
      expect(isExcludedFromOpex('Gross Rental Revenue')).toBe(true);
    });
  });

  describe('gap 2: net loss/profit P&L rollup', () => {
    it('excludes "Net Loss/Profit"', () => {
      expect(isExcludedFromOpex('Net Loss/Profit')).toBe(true);
    });
    it('excludes "Net Loss"', () => {
      expect(isExcludedFromOpex('Net Loss')).toBe(true);
    });
    it('excludes "Net Profit"', () => {
      expect(isExcludedFromOpex('Net Profit')).toBe(true);
    });
  });

  describe('gap 3: GL labels ending with "Income"', () => {
    it('excludes "Administrative Income"', () => {
      expect(isExcludedFromOpex('Administrative Income')).toBe(true);
    });
    it('excludes "Storage Income"', () => {
      expect(isExcludedFromOpex('Storage Income')).toBe(true);
    });
    it('excludes "Valet Trash Income"', () => {
      expect(isExcludedFromOpex('Valet Trash Income')).toBe(true);
    });
    it('excludes "Water/Sewer Occupied Income"', () => {
      expect(isExcludedFromOpex('Water/Sewer Occupied Income')).toBe(true);
    });
    it('excludes "Cable/Satellite TV Income"', () => {
      expect(isExcludedFromOpex('Cable/Satellite TV Income')).toBe(true);
    });
  });

  describe('gap 4: reserve replacement word-order variant', () => {
    it('excludes "Reserve Replacement"', () => {
      expect(isExcludedFromOpex('Reserve Replacement')).toBe(true);
    });
    it('excludes "Reserve_Replacement" (underscore separator)', () => {
      expect(isExcludedFromOpex('Reserve_Replacement')).toBe(true);
    });
    it('still excludes "Replacement Reserve" (original word order)', () => {
      expect(isExcludedFromOpex('Replacement Reserve')).toBe(true);
    });
  });

  describe('S1-01 follow-up gaps (live-DB residuals after forceReseed:true)', () => {
    it('excludes "NET (LOSS) / PROFIT" — open-paren after net', () => {
      expect(isExcludedFromOpex('NET (LOSS) / PROFIT')).toBe(true);
    });
    it('excludes "Net (Profit)" — paren-wrapped profit', () => {
      expect(isExcludedFromOpex('Net (Profit)')).toBe(true);
    });
    it('excludes "Net Income (Loss)" — net-income mid-label', () => {
      expect(isExcludedFromOpex('Net Income (Loss)')).toBe(true);
    });
    it('excludes "Net Income" alone', () => {
      expect(isExcludedFromOpex('Net Income')).toBe(true);
    });
    it('excludes "Revenue Share Contract"', () => {
      expect(isExcludedFromOpex('Revenue Share Contract')).toBe(true);
    });
    it('excludes "Revenue Share"', () => {
      expect(isExcludedFromOpex('Revenue Share')).toBe(true);
    });
    it('excludes "Storage Income (multifamily only)" — qualifier suffix', () => {
      expect(isExcludedFromOpex('Storage Income (multifamily only)')).toBe(true);
    });
    it('excludes "Other Income (Misc)" — generic qualifier suffix', () => {
      expect(isExcludedFromOpex('Other Income (Misc)')).toBe(true);
    });
  });

  describe('genuine opex labels must NOT be excluded', () => {
    it('passes through "Payroll & Benefits"', () => {
      expect(isExcludedFromOpex('Payroll & Benefits')).toBe(false);
    });
    it('passes through "Repairs & Maintenance"', () => {
      expect(isExcludedFromOpex('Repairs & Maintenance')).toBe(false);
    });
    it('passes through "Contract Services"', () => {
      expect(isExcludedFromOpex('Contract Services')).toBe(false);
    });
    it('passes through "Utilities"', () => {
      expect(isExcludedFromOpex('Utilities')).toBe(false);
    });
    it('passes through "Property Insurance"', () => {
      expect(isExcludedFromOpex('Property Insurance')).toBe(false);
    });
    it('passes through "Marketing & Advertising"', () => {
      expect(isExcludedFromOpex('Marketing & Advertising')).toBe(false);
    });
    it('passes through "Grounds Maintenance"', () => {
      expect(isExcludedFromOpex('Grounds Maintenance')).toBe(false);
    });
    it('passes through "Turnover/Make-Ready"', () => {
      expect(isExcludedFromOpex('Turnover/Make-Ready')).toBe(false);
    });
  });

  describe('S1-01 normalization: snake_case forms must be excluded after _→space', () => {
    // Revenue lines (patterns use \s+ which fails on underscores)
    it('excludes "gross_potential_rent"', () => {
      expect(isExcludedFromOpex('gross_potential_rent')).toBe(true);
    });
    it('excludes "effective_gross_income"', () => {
      expect(isExcludedFromOpex('effective_gross_income')).toBe(true);
    });
    it('excludes "rental_income"', () => {
      expect(isExcludedFromOpex('rental_income')).toBe(true);
    });
    it('excludes "other_income"', () => {
      expect(isExcludedFromOpex('other_income')).toBe(true);
    });
    it('excludes "rental_revenue"', () => {
      expect(isExcludedFromOpex('rental_revenue')).toBe(true);
    });
    it('excludes "revenue_share"', () => {
      expect(isExcludedFromOpex('revenue_share')).toBe(true);
    });
    it('excludes "net_rental"', () => {
      expect(isExcludedFromOpex('net_rental')).toBe(true);
    });
    it('excludes "loss_to_lease"', () => {
      expect(isExcludedFromOpex('loss_to_lease')).toBe(true);
    });
    it('excludes "vacancy_loss"', () => {
      expect(isExcludedFromOpex('vacancy_loss')).toBe(true);
    });
    it('excludes "bad_debt"', () => {
      expect(isExcludedFromOpex('bad_debt')).toBe(true);
    });
    it('excludes "administrative_income"', () => {
      expect(isExcludedFromOpex('administrative_income')).toBe(true);
    });
    it('excludes "storage_income"', () => {
      expect(isExcludedFromOpex('storage_income')).toBe(true);
    });
    // Rollup / subtotal
    it('excludes "total_opex"', () => {
      expect(isExcludedFromOpex('total_opex')).toBe(true);
    });
    it('excludes "net_operating_income"', () => {
      expect(isExcludedFromOpex('net_operating_income')).toBe(true);
    });
    it('excludes "subtotal_expenses"', () => {
      expect(isExcludedFromOpex('subtotal_expenses')).toBe(true);
    });
    it('excludes "net_loss"', () => {
      expect(isExcludedFromOpex('net_loss')).toBe(true);
    });
    // Below-the-line
    it('excludes "debt_service"', () => {
      expect(isExcludedFromOpex('debt_service')).toBe(true);
    });
    it('excludes "interest_expense"', () => {
      expect(isExcludedFromOpex('interest_expense')).toBe(true);
    });
    it('excludes "capital_expenditure"', () => {
      expect(isExcludedFromOpex('capital_expenditure')).toBe(true);
    });
    it('excludes "replacement_reserve"', () => {
      expect(isExcludedFromOpex('replacement_reserve')).toBe(true);
    });
    // Genuine opex snake_case must still pass through
    it('passes through "payroll_benefits"', () => {
      expect(isExcludedFromOpex('payroll_benefits')).toBe(false);
    });
    it('passes through "repairs_maintenance"', () => {
      expect(isExcludedFromOpex('repairs_maintenance')).toBe(false);
    });
    it('passes through "contract_services"', () => {
      expect(isExcludedFromOpex('contract_services')).toBe(false);
    });
    it('passes through "utilities"', () => {
      expect(isExcludedFromOpex('utilities')).toBe(false);
    });
  });
});

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
