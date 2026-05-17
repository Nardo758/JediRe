/**
 * Unit-Mix Source Symmetry Regression Test — Task #829
 *
 * PRIMARY INVARIANTS:
 *   1. fetch_unit_mix returns per-floor-plan data when deal_assumptions.unit_mix exists
 *   2. Sponsor overrides in unit_mix_overrides are applied before returning results
 *   3. override_applied flag is true only on rows with active overrides
 *   4. When unit_mix is absent, falls back to extraction_rent_roll.floor_plan_mix
 *   5. DataMatrixService.buildContext() populates extractedData.rentRoll.floorPlanMix
 *      from the REAL hydration path (not re-implemented helpers)
 *   6. DataMatrixService.buildContext() populates extractedData.rentRoll.otherIncomeMonthly
 *   7. Source symmetry: fetch_unit_mix override-applied values are the canonical agent path;
 *      a deal with sponsor overrides shows overridden rents through fetch_unit_mix and
 *      unmodified extraction rents through extractedData.rentRoll.floorPlanMix.
 *      Any future refactor that silently drops overrides or hydration will break this test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock for the fetch_unit_mix tool (uses ../../database/connection) ──────

const mockToolQuery = vi.fn();

vi.mock('../../../database/connection', () => ({
  query: (...args: unknown[]) => mockToolQuery(...args),
  getPool: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { fetchUnitMixTool } from '../fetch_unit_mix';
import { DataMatrixService } from '../../../services/neural-network/data-matrix.service';
import type { Pool } from 'pg';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const DEAL_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

/** Extraction capsule floor_plan_mix as stored in deals.deal_data JSON */
const CAPSULE_FLOOR_PLAN_MIX = {
  Studio: { count: 20, avg_sqft: 480, avg_effective_rent: 1080, avg_market_rent: 1200, occupancy_pct: 95 },
  '1BR':  { count: 80, avg_sqft: 700, avg_effective_rent: 1380, avg_market_rent: 1500, occupancy_pct: 93 },
  '2BR':  { count: 50, avg_sqft: 950, avg_effective_rent: 1760, avg_market_rent: 1950, occupancy_pct: 90 },
};

const CAPSULE_OTHER_INCOME_MONTHLY = {
  parking: 1500,
  pet: 800,
  laundry: 400,
  storage: 200,
};

/** deal_assumptions.unit_mix — same underlying units as capsule */
const BASE_UNIT_MIX = [
  { type: 'Studio', count: 20, avg_sqft: 480, in_place_rent: 1080, market_rent: 1200, occupancy_pct: 95 },
  { type: '1BR',    count: 80, avg_sqft: 700, in_place_rent: 1380, market_rent: 1500, occupancy_pct: 93 },
  { type: '2BR',    count: 50, avg_sqft: 950, in_place_rent: 1760, market_rent: 1950, occupancy_pct: 90 },
  { type: 'Vacant', count: 0,  avg_sqft: 700, in_place_rent: null, market_rent: null, occupancy_pct: 0  },
];

// ── Pool factory (for DataMatrixService) ──────────────────────────────────────

/**
 * Build a minimal mock Pool for DataMatrixService.
 * Called with: SELECT deal_data->... FROM deals WHERE id = $1
 * All other layer queries are suppressed via includeXxx:false + lat/lng on deal.
 */
function buildMockPool(overrides: {
  floorPlanMix?: Record<string, unknown>;
  otherIncomeMonthly?: Record<string, unknown>;
  noData?: boolean;
}): Pool {
  const mockPoolQuery = vi.fn().mockImplementation((sql: string) => {
    // extractedData injection query
    if (typeof sql === 'string' && sql.includes('extraction_t12')) {
      if (overrides.noData) return Promise.resolve({ rows: [] });
      return Promise.resolve({
        rows: [{
          t12: null,
          rr: {
            total_units: 150,
            occupied_units: 140,
            vacant_units: 10,
            occupancy_by_unit_pct: 0.933,
            avg_market_rent: 1490,
            avg_effective_rent: 1320,
            gpr_monthly: 223500,
            loss_to_lease_monthly: 25000,
            egi_in_place_annualized: 2386800,
            floor_plan_mix: overrides.floorPlanMix ?? CAPSULE_FLOOR_PLAN_MIX,
            other_income_monthly: overrides.otherIncomeMonthly ?? CAPSULE_OTHER_INCOME_MONTHLY,
          },
          bc: null,
        }],
      });
    }
    // Any other unexpected query — return empty to fail fast
    return Promise.resolve({ rows: [] });
  });

  return { query: mockPoolQuery } as unknown as Pool;
}

/** Deal fixture with lat/lng to skip geocode pool.query in resolveCoordinates */
const MOCK_DEAL = {
  id: DEAL_ID,
  propertyName: 'Test Property',
  address: '123 Main St',
  city: 'Atlanta',
  state: 'GA',
  units: 150,
  latitude: 33.749,
  longitude: -84.388,
};

// ── Helpers for tool query mocks ─────────────────────────────────────────────

function mockDaWithOverrides(overrides: Record<string, unknown> = {}) {
  mockToolQuery.mockResolvedValueOnce({
    rows: [{ unit_mix: BASE_UNIT_MIX, unit_mix_overrides: overrides }],
  });
}

function mockDaEmpty() {
  mockToolQuery.mockResolvedValueOnce({ rows: [{ unit_mix: null, unit_mix_overrides: null }] });
}

function mockDaNoRow() {
  mockToolQuery.mockResolvedValueOnce({ rows: [] });
}

function mockFallbackFpm() {
  mockToolQuery.mockResolvedValueOnce({
    rows: [{ fpm: CAPSULE_FLOOR_PLAN_MIX }],
  });
}

function mockFallbackEmpty() {
  mockToolQuery.mockResolvedValueOnce({ rows: [{ fpm: null }] });
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: fetch_unit_mix tool behavior
// ─────────────────────────────────────────────────────────────────────────────

describe('fetch_unit_mix — source symmetry', () => {

  beforeEach(() => {
    mockToolQuery.mockReset();
  });

  it('returns all visible (count>0) floor plans from deal_assumptions', async () => {
    mockDaWithOverrides();
    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);
    expect(result.has_data).toBe(true);
    expect(result.source).toBe('deal_assumptions');
    expect(result.floor_plans).toHaveLength(3);   // Vacant row filtered
    expect(result.floor_plans.map(fp => fp.floor_plan_id)).toEqual(['Studio', '1BR', '2BR']);
    expect(result.total_units).toBe(150);
  });

  it('applies sponsor override for in_place_rent on a specific row', async () => {
    // rawIdx 1 = 1BR row (second row in BASE_UNIT_MIX, count > 0)
    mockDaWithOverrides({ 'unit_mix_override:1:in_place_rent': { value: 1499, originalValue: 1380 } });
    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);
    const oneBR = result.floor_plans.find(fp => fp.floor_plan_id === '1BR')!;
    expect(oneBR.in_place_rent).toBe(1499);
    expect(oneBR.override_applied).toBe(true);
    // Non-overridden row unchanged
    expect(result.floor_plans.find(fp => fp.floor_plan_id === 'Studio')!.override_applied).toBe(false);
  });

  it('applies sponsor override for market_rent', async () => {
    mockDaWithOverrides({ 'unit_mix_override:2:market_rent': { value: 2100, originalValue: 1950 } });
    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);
    expect(result.floor_plans.find(fp => fp.floor_plan_id === '2BR')!.market_rent).toBe(2100);
  });

  it('treats value=null override as cleared (original value is used)', async () => {
    mockDaWithOverrides({ 'unit_mix_override:1:in_place_rent': { value: null, originalValue: 1380 } });
    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);
    const oneBR = result.floor_plans.find(fp => fp.floor_plan_id === '1BR')!;
    expect(oneBR.in_place_rent).toBe(1380);
    expect(oneBR.override_applied).toBe(false);
  });

  it('falls back to extraction_rent_roll.floor_plan_mix when unit_mix is absent', async () => {
    mockDaEmpty();
    mockFallbackFpm();
    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);
    expect(result.source).toBe('extraction_rent_roll');
    expect(result.has_data).toBe(true);
    expect(result.floor_plans).toHaveLength(3);
    expect(result.floor_plans.every(fp => fp.override_applied === false)).toBe(true);
    expect(result.floor_plans.find(fp => fp.floor_plan_id === 'Studio')!.market_rent).toBe(1200);
  });

  it('returns has_data=false when both sources are empty', async () => {
    mockDaEmpty();
    mockFallbackEmpty();
    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);
    expect(result.has_data).toBe(false);
    expect(result.source).toBe('none');
  });

  it('returns has_data=false when no deal_id is provided', async () => {
    const result = await fetchUnitMixTool.execute({ deal_id: '' }, {} as any);
    expect(result.has_data).toBe(false);
    expect(mockToolQuery).not.toHaveBeenCalled();
  });

  it('returns has_data=false on DB error without throwing', async () => {
    mockToolQuery.mockRejectedValueOnce(new Error('connection refused'));
    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);
    expect(result.has_data).toBe(false);
  });

  it('falls back to floor_plan_mix when deal_assumptions row does not exist', async () => {
    mockDaNoRow();
    mockFallbackFpm();
    const result = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);
    expect(result.source).toBe('extraction_rent_roll');
    expect(result.has_data).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: DataMatrixService hydration — real service with mocked Pool
// Tests that the ACTUAL production hydration code (data-matrix.service.ts lines
// 415-462) correctly populates floorPlanMix and otherIncomeMonthly.
// ─────────────────────────────────────────────────────────────────────────────

describe('DataMatrixService.buildContext() — extractedData hydration', () => {

  it('populates floorPlanMix from extraction_rent_roll.floor_plan_mix', async () => {
    const pool = buildMockPool({});
    const service = new DataMatrixService(pool);
    const ctx = await service.buildContext(MOCK_DEAL, {
      includePropertyInfo: false,
      includeRentData:     false,
      includeSalesComps:   false,
      includeProximity:    false,
      includeEvents:       false,
      includeBacktest:     false,
      includeBenchmarks:   false,
      includeMacro:        false,
      includeMarketTrends: false,
    });

    const fpm = ctx.extractedData?.rentRoll?.floorPlanMix;
    expect(fpm).toBeDefined();
    expect(Array.isArray(fpm)).toBe(true);
    expect(fpm!.length).toBe(3);

    // Studio → beds=0
    const studio = fpm!.find(r => r.beds === 0);
    expect(studio).toBeDefined();
    expect(studio!.count).toBe(20);
    expect(studio!.marketRent).toBe(1200);
    expect(studio!.effectiveRent).toBe(1080);

    // 1BR → beds=1
    const oneBR = fpm!.find(r => r.beds === 1);
    expect(oneBR!.count).toBe(80);

    // 2BR → beds=2
    const twoBR = fpm!.find(r => r.beds === 2);
    expect(twoBR!.count).toBe(50);
    expect(twoBR!.marketRent).toBe(1950);
  });

  it('populates otherIncomeMonthly from extraction_rent_roll.other_income_monthly', async () => {
    const pool = buildMockPool({});
    const service = new DataMatrixService(pool);
    const ctx = await service.buildContext(MOCK_DEAL, {
      includePropertyInfo: false, includeRentData: false, includeSalesComps: false,
      includeProximity: false,    includeEvents:   false, includeBacktest:   false,
      includeBenchmarks: false,   includeMacro:    false, includeMarketTrends: false,
    });

    const oim = ctx.extractedData?.rentRoll?.otherIncomeMonthly;
    expect(oim).toBeDefined();
    expect(oim).toEqual({ parking: 1500, pet: 800, laundry: 400, storage: 200 });
  });

  it('omits floorPlanMix and otherIncomeMonthly when rent roll capsule is absent', async () => {
    const pool = buildMockPool({ noData: true });
    const service = new DataMatrixService(pool);
    const ctx = await service.buildContext(MOCK_DEAL, {
      includePropertyInfo: false, includeRentData: false, includeSalesComps: false,
      includeProximity: false,    includeEvents:   false, includeBacktest:   false,
      includeBenchmarks: false,   includeMacro:    false, includeMarketTrends: false,
    });
    expect(ctx.extractedData?.rentRoll?.floorPlanMix).toBeUndefined();
    expect(ctx.extractedData?.rentRoll?.otherIncomeMonthly).toBeUndefined();
  });

  it('filters out zero-count floor plans during hydration', async () => {
    const fpmWithZero = {
      ...CAPSULE_FLOOR_PLAN_MIX,
      'Vacant': { count: 0, avg_market_rent: 0 },
    };
    const pool = buildMockPool({ floorPlanMix: fpmWithZero });
    const service = new DataMatrixService(pool);
    const ctx = await service.buildContext(MOCK_DEAL, {
      includePropertyInfo: false, includeRentData: false, includeSalesComps: false,
      includeProximity: false,    includeEvents:   false, includeBacktest:   false,
      includeBenchmarks: false,   includeMacro:    false, includeMarketTrends: false,
    });
    const fpm = ctx.extractedData?.rentRoll?.floorPlanMix;
    expect(fpm!.every(r => r.count > 0)).toBe(true);
    // 3 valid plans, Vacant excluded
    expect(fpm!.length).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: Source-symmetry assertion
// Verifies the intended canonical wiring documented in Task #829:
//   - fetch_unit_mix IS the agent's override-aware floor-plan source
//   - DataMatrixService provides extraction-only background context
//   - A sponsor override MUST appear through fetch_unit_mix but NOT through
//     extractedData.rentRoll.floorPlanMix (which reflects only extracted docs)
// Any future refactor that silently breaks either side will fail here.
// ─────────────────────────────────────────────────────────────────────────────

describe('Unit Mix source-symmetry — override appears via fetch_unit_mix, not extractedData', () => {

  beforeEach(() => {
    mockToolQuery.mockReset();
  });

  it('sponsor override is visible through fetch_unit_mix but absent from extractedData', async () => {
    // ── fetch_unit_mix path: DA unit_mix with 1BR override ────────────────
    mockDaWithOverrides({ 'unit_mix_override:1:in_place_rent': { value: 1599, originalValue: 1380 } });
    const toolResult = await fetchUnitMixTool.execute({ deal_id: DEAL_ID }, { dealId: DEAL_ID } as any);
    const toolOneBR = toolResult.floor_plans.find(fp => fp.floor_plan_id === '1BR')!;

    // ── DataMatrixService path: extraction capsule has original 1380 ───────
    const pool = buildMockPool({});  // capsule has avg_effective_rent: 1380 for 1BR
    const service = new DataMatrixService(pool);
    const ctx = await service.buildContext(MOCK_DEAL, {
      includePropertyInfo: false, includeRentData: false, includeSalesComps: false,
      includeProximity: false,    includeEvents:   false, includeBacktest:   false,
      includeBenchmarks: false,   includeMacro:    false, includeMarketTrends: false,
    });
    const ctxOneBR = ctx.extractedData?.rentRoll?.floorPlanMix?.find(r => r.beds === 1);

    // fetch_unit_mix reflects the 1599 override
    expect(toolOneBR.in_place_rent).toBe(1599);
    expect(toolOneBR.override_applied).toBe(true);

    // extractedData still shows unmodified extraction rent (1380)
    expect(ctxOneBR?.effectiveRent).toBe(1380);

    // Canonical wiring: fetch_unit_mix is the agent's override-aware call path
    expect(toolOneBR.in_place_rent).not.toBe(ctxOneBR?.effectiveRent);
  });
});
