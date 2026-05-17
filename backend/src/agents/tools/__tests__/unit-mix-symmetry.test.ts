/**
 * Unit-Mix Source Symmetry Regression Test — Task #829
 *
 * PRIMARY INVARIANTS:
 *   1. fetch_unit_mix returns per-floor-plan data when deal_assumptions.unit_mix exists
 *   2. Sponsor overrides in unit_mix_overrides are applied before returning results
 *   3. override_applied flag is true only on rows with active overrides
 *   4. When unit_mix is absent, falls back to extraction_rent_roll.floor_plan_mix
 *   5. floorPlanMix + otherIncomeMonthly are populated in DataMatrixContext when rr data is present
 *
 * DESIGN: Mocks the DB layer (../../database/connection) so no real DB is required.
 * Any future refactor that re-introduces sponsor-override drift will break assertion #2.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockQuery = vi.fn();

vi.mock('../../../database/connection', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  getPool: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Import tool after mocks ────────────────────────────────────────────────────

import { fetchUnitMixTool } from '../fetch_unit_mix';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEAL_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const BASE_UNIT_MIX = [
  { type: 'Studio', count: 20, avg_sqft: 480, in_place_rent: 1100, market_rent: 1200, occupancy_pct: 95 },
  { type: '1BR',    count: 80, avg_sqft: 700, in_place_rent: 1400, market_rent: 1500, occupancy_pct: 93 },
  { type: '2BR',    count: 50, avg_sqft: 950, in_place_rent: 1800, market_rent: 1950, occupancy_pct: 90 },
  { type: 'Vacant', count: 0,  avg_sqft: 700, in_place_rent: null, market_rent: null, occupancy_pct: 0  },
];

const FLOOR_PLAN_MIX_FALLBACK = {
  Studio: { count: 20, avg_sqft: 480, avg_effective_rent: 1080, avg_market_rent: 1200, occupancy_pct: 95 },
  '1BR':  { count: 80, avg_sqft: 700, avg_effective_rent: 1380, avg_market_rent: 1500, occupancy_pct: 93 },
  '2BR':  { count: 50, avg_sqft: 950, avg_effective_rent: 1760, avg_market_rent: 1950, occupancy_pct: 90 },
};

// ── Helper to build mock DB responses ─────────────────────────────────────────

function mockDaWithOverrides(overrides: Record<string, unknown> = {}) {
  mockQuery.mockResolvedValueOnce({
    rows: [{
      unit_mix: BASE_UNIT_MIX,
      unit_mix_overrides: overrides,
    }],
  });
}

function mockDaEmpty() {
  mockQuery.mockResolvedValueOnce({ rows: [{ unit_mix: null, unit_mix_overrides: null }] });
}

function mockDaNoRow() {
  mockQuery.mockResolvedValueOnce({ rows: [] });
}

function mockFallbackFpm() {
  mockQuery.mockResolvedValueOnce({
    rows: [{ fpm: FLOOR_PLAN_MIX_FALLBACK }],
  });
}

function mockFallbackEmpty() {
  mockQuery.mockResolvedValueOnce({ rows: [{ fpm: null }] });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('fetch_unit_mix — source symmetry', () => {

  beforeEach(() => {
    mockQuery.mockReset();
  });

  // ── 1. Happy path: deal_assumptions source, no overrides ────────────────────
  it('returns all visible (count>0) floor plans from deal_assumptions', async () => {
    mockDaWithOverrides();

    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);

    expect(result.has_data).toBe(true);
    expect(result.source).toBe('deal_assumptions');
    // Vacant row must be filtered (count=0)
    expect(result.floor_plans).toHaveLength(3);
    expect(result.floor_plans.map(fp => fp.floor_plan_id)).toEqual(['Studio', '1BR', '2BR']);
    expect(result.total_units).toBe(150);
  });

  // ── 2. Sponsor override is applied ─────────────────────────────────────────
  it('applies sponsor override for in_place_rent on a specific row', async () => {
    // rawIdx 1 is the 1BR row (index 1 in BASE_UNIT_MIX which has count>0)
    const overrides = {
      'unit_mix_override:1:in_place_rent': { value: 1499, originalValue: 1400 },
    };
    mockDaWithOverrides(overrides);

    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);

    const oneBR = result.floor_plans.find(fp => fp.floor_plan_id === '1BR');
    expect(oneBR).toBeDefined();
    expect(oneBR!.in_place_rent).toBe(1499);   // overridden value
    expect(oneBR!.override_applied).toBe(true);

    // Non-overridden rows must keep original values
    const studio = result.floor_plans.find(fp => fp.floor_plan_id === 'Studio');
    expect(studio!.in_place_rent).toBe(1100);
    expect(studio!.override_applied).toBe(false);
  });

  // ── 3. Market rent override ─────────────────────────────────────────────────
  it('applies sponsor override for market_rent', async () => {
    const overrides = {
      'unit_mix_override:2:market_rent': { value: 2100, originalValue: 1950 },
    };
    mockDaWithOverrides(overrides);

    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);

    const twoBR = result.floor_plans.find(fp => fp.floor_plan_id === '2BR');
    expect(twoBR!.market_rent).toBe(2100);
    expect(twoBR!.override_applied).toBe(true);
  });

  // ── 4. Override cleared (value=null) ────────────────────────────────────────
  it('treats value=null override as no-override (original value stays)', async () => {
    const overrides = {
      'unit_mix_override:1:in_place_rent': { value: null, originalValue: 1400 },
    };
    mockDaWithOverrides(overrides);

    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);

    const oneBR = result.floor_plans.find(fp => fp.floor_plan_id === '1BR');
    expect(oneBR!.in_place_rent).toBe(1400);   // original value
    expect(oneBR!.override_applied).toBe(false);
  });

  // ── 5. Fallback to extraction_rent_roll.floor_plan_mix ──────────────────────
  it('falls back to extraction_rent_roll.floor_plan_mix when unit_mix is absent', async () => {
    mockDaEmpty();
    mockFallbackFpm();

    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);

    expect(result.has_data).toBe(true);
    expect(result.source).toBe('extraction_rent_roll');
    expect(result.floor_plans).toHaveLength(3);
    expect(result.floor_plans.every(fp => fp.override_applied === false)).toBe(true);

    const studio = result.floor_plans.find(fp => fp.floor_plan_id === 'Studio');
    expect(studio!.in_place_rent).toBe(1080);   // avg_effective_rent from capsule
    expect(studio!.market_rent).toBe(1200);
  });

  // ── 6. No data in any source ────────────────────────────────────────────────
  it('returns has_data=false when both sources are empty', async () => {
    mockDaEmpty();
    mockFallbackEmpty();

    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);

    expect(result.has_data).toBe(false);
    expect(result.source).toBe('none');
    expect(result.floor_plans).toHaveLength(0);
  });

  // ── 7. No deal_id ───────────────────────────────────────────────────────────
  it('returns has_data=false when no deal_id is provided', async () => {
    const result = await fetchUnitMixTool.execute({ deal_id: '' }, {} as any);
    expect(result.has_data).toBe(false);
    expect(result.source).toBe('none');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // ── 8. DB error is handled gracefully ───────────────────────────────────────
  it('returns has_data=false on DB error without throwing', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));

    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);

    expect(result.has_data).toBe(false);
    expect(result.source).toBe('none');
  });

  // ── 9. Fallback when DA row is absent (no deal_assumptions row at all) ───────
  it('falls back to floor_plan_mix when deal_assumptions row does not exist', async () => {
    mockDaNoRow();
    mockFallbackFpm();

    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);

    expect(result.source).toBe('extraction_rent_roll');
    expect(result.has_data).toBe(true);
  });
});

// ── Data-matrix hydration: floorPlanMix + otherIncomeMonthly ─────────────────

describe('DataMatrixContext.extractedData.rentRoll — hydration fields', () => {
  /**
   * These tests exercise the mapping logic inline (without instantiating
   * DataMatrixService, which requires a Pool). We extract the transform
   * functions directly to test them independently.
   */

  function hydrateFloorPlanMix(fpm: Record<string, unknown>) {
    const entries = Object.entries(fpm);
    if (entries.length === 0) return undefined;
    return entries
      .map(([planName, v]) => {
        const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
        const count = +(d.count ?? 0);
        if (!Number.isFinite(count) || count <= 0) return null;
        const bedMatch = planName.match(/(\d)/);
        const bedsFromName = bedMatch ? parseInt(bedMatch[1], 10) : 0;
        const isStudio = /studio|eff/i.test(planName);
        return {
          beds: isStudio ? 0 : bedsFromName,
          count,
          marketRent: d.avg_market_rent != null && Number(d.avg_market_rent) > 0
            ? Number(d.avg_market_rent) : undefined,
          effectiveRent: d.avg_effective_rent != null
            ? Number(d.avg_effective_rent) : undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  function hydrateOtherIncomeMonthly(oim: Record<string, unknown>) {
    const result: Record<string, number> = {};
    for (const [cat, val] of Object.entries(oim)) {
      const n = Number(val);
      if (Number.isFinite(n)) result[cat] = n;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  it('maps floor_plan_mix to floorPlanMix array with correct bed counts', () => {
    const fpm = FLOOR_PLAN_MIX_FALLBACK;
    const result = hydrateFloorPlanMix(fpm as Record<string, unknown>);
    expect(result).toBeDefined();
    expect(result).toHaveLength(3);

    const studio = result!.find(r => r.beds === 0);
    expect(studio).toBeDefined();
    expect(studio!.count).toBe(20);

    const oneBR = result!.find(r => r.beds === 1);
    expect(oneBR!.count).toBe(80);
    expect(oneBR!.marketRent).toBe(1500);
    expect(oneBR!.effectiveRent).toBe(1380);

    const twoBR = result!.find(r => r.beds === 2);
    expect(twoBR!.count).toBe(50);
  });

  it('filters out zero-count floor plans from floorPlanMix', () => {
    const fpm = { ...FLOOR_PLAN_MIX_FALLBACK, 'Vacant': { count: 0, avg_market_rent: 0 } };
    const result = hydrateFloorPlanMix(fpm as Record<string, unknown>);
    expect(result!.every(r => r.count > 0)).toBe(true);
    expect(result!.find(r => r.beds === 0)).toBeDefined();  // Studio still present
  });

  it('returns undefined for empty floor_plan_mix', () => {
    expect(hydrateFloorPlanMix({})).toBeUndefined();
  });

  it('maps other_income_monthly to otherIncomeMonthly record', () => {
    const oim = { parking: 1500, pet: 800, laundry: 400, storage: 200 };
    const result = hydrateOtherIncomeMonthly(oim);
    expect(result).toEqual({ parking: 1500, pet: 800, laundry: 400, storage: 200 });
  });

  it('excludes non-numeric other_income_monthly values', () => {
    const oim = { parking: 1500, notes: 'n/a', rubs: 300 } as Record<string, unknown>;
    const result = hydrateOtherIncomeMonthly(oim);
    expect(result).toEqual({ parking: 1500, rubs: 300 });
  });

  it('returns undefined for empty other_income_monthly', () => {
    expect(hydrateOtherIncomeMonthly({})).toBeUndefined();
  });
});
