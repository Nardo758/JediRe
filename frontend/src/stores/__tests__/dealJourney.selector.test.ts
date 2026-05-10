// ============================================================================
// JEDI RE — dealJourney.selector.test.ts
// ============================================================================
//
// Tests for:
//   - computeJourneyGap (pure function — no React, no store)
//   - useDealJourney (React hook — renderHook with typed DealContext fixture)
//
// Fixture: makeCtx() builds a minimal, fully-typed ExistingDealContext.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { computeJourneyGap, useDealJourney } from '../dealJourney.selector';
import { layered, type LayeredValue } from '../dealContext.types';
import type { JourneyStateA, JourneyStateB } from '../dealJourney.types';
import type { ExistingDealContext } from '../dealContext.types';

// ---------------------------------------------------------------------------
// Typed fixture helpers
// ---------------------------------------------------------------------------

function lv<T>(v: T, src: 'broker' | 'platform' | 'user' = 'broker'): LayeredValue<T> {
  return layered(v, src, src === 'user' ? 0.95 : src === 'broker' ? 0.75 : 0.6);
}

type CtxOverrides = {
  currentNOI?: number;
  outputNoi?: number | null;
  occupancy?: number;
  rentGrowth?: number;
  expenseGrowth?: number;
  vacancy?: number;
  exitCapRate?: number;
  holdPeriod?: number;
  capexPerUnit?: number;
  managementFee?: number;
  totalUnits?: number;
  marketRent?: number;
};

/** Build a minimal but fully-typed ExistingDealContext for tests. */
function makeCtx(overrides: CtxOverrides = {}): ExistingDealContext {
  const {
    currentNOI = 500_000,
    outputNoi = 850_000,
    occupancy = 0.88,
    rentGrowth = 0.03,
    expenseGrowth = 0.025,
    vacancy = 0.05,
    exitCapRate = 0.055,
    holdPeriod = 10,
    capexPerUnit = 5_000,
    managementFee = 0.04,
    totalUnits = 100,
    marketRent = 1_800,
  } = overrides;

  const ctx: ExistingDealContext = {
    projectType: 'existing',
    productType: 'mf_garden',
    zoningOutput: null,
    identity: {
      id: 'test-deal-001',
      name: 'Test Asset',
      address: '123 Main St',
      city: 'Atlanta',
      state: 'GA',
      zip: '30301',
      county: 'Fulton',
      parcelIds: [],
      coordinates: { lat: 33.749, lng: -84.388 },
      mode: 'existing',
      stage: 'screening',
      sponsor: 'Test Sponsor',
      capitalIntent: 'acquisition',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    site: {
      acreage: lv(5),
      buildableAcreage: lv(4.5),
      boundary: null,
      constraints: [],
      floodZone: lv(null),
    },
    zoning: {
      designation: lv('MF-R'),
      maxDensity: lv(30),
      maxHeight: lv(45),
      maxFAR: lv(2.0),
      maxLotCoverage: lv(0.6),
      setbacks: lv({ front: 20, side: 10, rear: 20 }),
      parkingRatio: lv(1.0),
      guestParkingRatio: lv(0.25),
      sourceUrl: null,
      verified: true,
      overlays: [],
      varianceAssumed: false,
    },
    developmentPaths: [],
    selectedDevelopmentPathId: null,
    developmentEnvelope: null,
    existingProperty: {
      yearBuilt: lv(1998),
      totalUnits: lv(totalUnits),
      totalSF: lv(totalUnits * 900),
      unitMixProgram: [
        {
          id: 'u1', unitType: '1br', label: '1BR/1BA',
          count: Math.round(totalUnits * 0.6),
          avgSF: 850, targetRent: lv(1_700, 'broker'), rentPerSF: 2.0,
          mixPct: 0.6,
        },
        {
          id: 'u2', unitType: '2br', label: '2BR/2BA',
          count: Math.round(totalUnits * 0.4),
          avgSF: 1_100, targetRent: lv(2_000, 'broker'), rentPerSF: 1.82,
          mixPct: 0.4,
        },
      ],
      occupancy: lv(occupancy),
      currentNOI: lv(currentNOI, 'broker'),
      askingPrice: lv(10_000_000),
      pricePerUnit: 100_000,
      goingInCapRate: currentNOI / 10_000_000,
      lastRenovated: lv(null),
      propertyClass: lv('B'),
      amenities: ['pool', 'gym'],
    },
    redevelopment: null,
    resolvedUnitMix: [],
    unitMixOverrides: {},
    totalUnits,
    market: {
      submarketName: 'Midtown Atlanta',
      submarketId: 'mkt-atl-midtown',
      avgRent: lv(marketRent),
      avgOccupancy: lv(0.92),
      rentGrowthYoY: lv(0.03),
      absorptionRate: lv(0.85),
      medianHHI: lv(72_000),
      popGrowthPct: lv(0.012),
      employmentGrowthPct: lv(0.018),
    },
    supply: {
      pipelineUnits: lv(800),
      supplyPressureRatio: 0.15,
      monthsOfSupply: 8,
      projects: [],
    },
    financial: {
      assumptions: {
        rentGrowth: lv(rentGrowth, 'platform'),
        expenseGrowth: lv(expenseGrowth, 'platform'),
        vacancy: lv(vacancy, 'platform'),
        exitCapRate: lv(exitCapRate, 'user'),
        holdPeriod: lv(holdPeriod, 'user'),
        capexPerUnit: lv(capexPerUnit, 'broker'),
        managementFee: lv(managementFee, 'platform'),
      },
      outputs: outputNoi != null ? {
        grossPotentialRent: 2_160_000,
        effectiveGrossIncome: 2_052_000,
        totalOpEx: 2_052_000 - outputNoi,
        noi: outputNoi,
        noiMargin: outputNoi / 2_052_000,
        irr: 0.142,
        equityMultiple: 1.8,
        cashOnCash: 0.07,
      } : undefined,
    },
    capital: {
      totalCapital: lv(10_000_000),
      debt: [],
      equity: [],
    },
    strategy: {
      scores: [],
      selectedStrategy: lv('rental' as const, 'platform'),
      arbitrageGap: 12.5,
      arbitrageAlert: false,
      verdict: 'RENTAL — preferred hold given Midtown submarket momentum',
    },
    scores: {
      overall: 72,
      demand: 75,
      supply: 68,
      momentum: 70,
      position: 66,
      risk: 60,
      score30dAgo: null,
      confidence: 0.78,
      verdict: 'Opportunity',
    },
    risk: {
      overall: 35,
      categories: {
        supply: 40, demand: 30, regulatory: 35, market: 32, execution: 38, climate: 25,
      },
      topRisk: {
        category: 'supply',
        score: 40,
        detail: 'Pipeline pressure in submarket',
        mitigationAvailable: true,
      },
    },
    operatorStance: null,
    stanceAffectedFields: null,
    editLog: [],
  };

  return ctx;
}

// ---------------------------------------------------------------------------
// computeJourneyGap — pure function tests (existing + preserved)
// ---------------------------------------------------------------------------

function makeStateA(overrides: Partial<JourneyStateA> = {}): JourneyStateA {
  return {
    asOf: new Date().toISOString(),
    noi: 500_000,
    occupancy: 0.75,
    inPlaceRentPerUnit: 1_400,
    marketRentPerUnit: 1_650,
    expenseRatio: 0.40,
    propertyClass: null,
    yearBuilt: null,
    capexBacklog: {
      value: 300_000,
      source: 'platform',
      resolvedFrom: 'platform',
      updatedAt: new Date().toISOString(),
      confidence: 0.5,
      alertLevel: 'none',
      userReviewed: false,
    },
    sourceLayers: { broker: 'absent', t12: 'absent', rentRoll: 'absent', taxBill: 'absent' },
    dataQualityFindings: 0,
    ...overrides,
  };
}

function makeStateB(overrides: Partial<JourneyStateB> = {}): JourneyStateB {
  return {
    targetNoi: 850_000,
    targetOccupancy: 0.95,
    targetRentPerUnit: 1_700,
    targetExpenseRatio: 0.35,
    exitCapRate: 0.055,
    holdPeriodYears: 7,
    yearOfStabilization: 2,
    ...overrides,
  };
}

describe('computeJourneyGap', () => {
  it('computes correct NOI uplift', () => {
    const stateA = makeStateA({ noi: 500_000 });
    const stateB = makeStateB({ targetNoi: 850_000 });
    const gap = computeJourneyGap(stateA, stateB);
    expect(gap.noiUplift.absolute).toBe(350_000);
    expect(gap.noiUplift.percent).toBeCloseTo(0.7, 5);
  });

  it('computes correct occupancy uplift', () => {
    const stateA = makeStateA({ occupancy: 0.75 });
    const stateB = makeStateB({ targetOccupancy: 0.95 });
    const gap = computeJourneyGap(stateA, stateB);
    expect(gap.occupancyUplift.points).toBeCloseTo(20, 5);
  });

  it('computes correct rent uplift', () => {
    const stateA = makeStateA({ inPlaceRentPerUnit: 1_400 });
    const stateB = makeStateB({ targetRentPerUnit: 1_700 });
    const gap = computeJourneyGap(stateA, stateB);
    expect(gap.rentUplift.perUnit).toBe(300);
    expect(gap.rentUplift.percent).toBeCloseTo(300 / 1_400, 5);
  });

  it('computes correct expense ratio change', () => {
    const stateA = makeStateA({ expenseRatio: 0.40 });
    const stateB = makeStateB({ targetExpenseRatio: 0.35 });
    const gap = computeJourneyGap(stateA, stateB);
    expect(gap.expenseRatioChange.points).toBeCloseTo(-5, 5);
  });

  it('passes through capex required from stateA', () => {
    const stateA = makeStateA();
    const stateB = makeStateB();
    const gap = computeJourneyGap(stateA, stateB);
    expect(gap.capexRequired).toBe(300_000);
  });

  it('handles zero NOI in stateA (no division by zero)', () => {
    const stateA = makeStateA({ noi: 0 });
    const stateB = makeStateB({ targetNoi: 400_000 });
    const gap = computeJourneyGap(stateA, stateB);
    expect(gap.noiUplift.absolute).toBe(400_000);
    expect(gap.noiUplift.percent).toBe(0);
  });

  it('handles negative gap (thesis regression)', () => {
    const stateA = makeStateA({ noi: 800_000, occupancy: 0.92 });
    const stateB = makeStateB({ targetNoi: 600_000, targetOccupancy: 0.85 });
    const gap = computeJourneyGap(stateA, stateB);
    expect(gap.noiUplift.absolute).toBe(-200_000);
    expect(gap.occupancyUplift.points).toBeCloseTo(-7, 5);
  });

  it('gap is zero when stateA === stateB metrics', () => {
    const stateA = makeStateA({ noi: 700_000, occupancy: 0.92, inPlaceRentPerUnit: 1_650 });
    const stateB = makeStateB({ targetNoi: 700_000, targetOccupancy: 0.92, targetRentPerUnit: 1_650 });
    const gap = computeJourneyGap(stateA, stateB);
    expect(gap.noiUplift.absolute).toBe(0);
    expect(gap.occupancyUplift.points).toBeCloseTo(0, 5);
    expect(gap.rentUplift.perUnit).toBe(0);
  });

  it('liftAggressiveness is undefined in Phase 1 (M36 pending)', () => {
    const gap = computeJourneyGap(makeStateA(), makeStateB());
    expect(gap.liftAggressiveness).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// useDealJourney — full hook tests with typed DealContext fixture
// ---------------------------------------------------------------------------

describe('useDealJourney', () => {
  it('returns null when ctx is null', () => {
    const { result } = renderHook(() => useDealJourney(null, 0));
    expect(result.current).toBeNull();
  });

  it('composes a valid DealJourney from a full DealContext', () => {
    const ctx = makeCtx();
    const { result } = renderHook(() => useDealJourney(ctx, 0));
    expect(result.current).not.toBeNull();
    const journey = result.current!;
    expect(journey).toHaveProperty('stateA');
    expect(journey).toHaveProperty('stateB');
    expect(journey).toHaveProperty('gap');
    expect(journey).toHaveProperty('path');
    expect(journey).toHaveProperty('levers');
    expect(journey).toHaveProperty('strategyFrame');
    expect(journey).toHaveProperty('scoreTrajectory');
  });

  // ── State A ────────────────────────────────────────────────────────────────

  describe('State A composition', () => {
    it('reads stateA.noi from existingProperty.currentNOI — not from financial.outputs', () => {
      // currentNOI=600k in docs; outputs.noi=900k from build model
      const ctx = makeCtx({ currentNOI: 600_000, outputNoi: 900_000 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      // stateA must reflect the in-place document value, not the forward-looking build output
      expect(result.current!.stateA.noi).toBeCloseTo(600_000);
    });

    it('reads stateA.occupancy from existingProperty.occupancy', () => {
      const ctx = makeCtx({ occupancy: 0.82 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.stateA.occupancy).toBeCloseTo(0.82);
    });

    it('computes stateA.inPlaceRentPerUnit from unitMixProgram weighted average', () => {
      // Fixture: 60 units × $1,700 + 40 units × $2,000 = 182,000 / 100 = $1,820
      const ctx = makeCtx({ totalUnits: 100 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.stateA.inPlaceRentPerUnit).toBeCloseTo(1_820, 0);
    });

    it('propagates dqaFindingCount into stateA.dataQualityFindings', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 7));
      expect(result.current!.stateA.dataQualityFindings).toBe(7);
    });

    it('detects broker source layer as present (capexPerUnit has broker source in fixture)', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.stateA.sourceLayers.broker).toBe('present');
    });

    it('reflects overall JEDI score in scoreTrajectory.scoreAtA', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.scoreTrajectory.scoreAtA).toBe(72);
    });
  });

  // ── State B ────────────────────────────────────────────────────────────────

  describe('State B composition', () => {
    it('reads stateB.targetNoi from financial.outputs.noi when build output is available', () => {
      const ctx = makeCtx({ currentNOI: 500_000, outputNoi: 850_000 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      // Build output is the canonical stabilized NOI — must take precedence
      expect(result.current!.stateB.targetNoi).toBeCloseTo(850_000);
    });

    it('falls back to estimation for stateB.targetNoi when outputs are absent', () => {
      const ctx = makeCtx({ outputNoi: null });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      // Should produce a positive estimate — not 0 and not the same as stateA.noi
      expect(result.current!.stateB.targetNoi).toBeGreaterThan(0);
    });

    it('reads stateB.exitCapRate from financial.assumptions.exitCapRate', () => {
      const ctx = makeCtx({ exitCapRate: 0.062 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.stateB.exitCapRate).toBeCloseTo(0.062);
    });

    it('reads stateB.holdPeriodYears from financial.assumptions.holdPeriod', () => {
      const ctx = makeCtx({ holdPeriod: 7 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.stateB.holdPeriodYears).toBe(7);
    });

    it('computes stateB.targetOccupancy as 1 - vacancy', () => {
      const ctx = makeCtx({ vacancy: 0.07 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.stateB.targetOccupancy).toBeCloseTo(0.93);
    });
  });

  // ── Gap ───────────────────────────────────────────────────────────────────

  describe('Gap composition', () => {
    it('gap.noiUplift.absolute === stateB.targetNoi - stateA.noi', () => {
      const ctx = makeCtx({ currentNOI: 500_000, outputNoi: 850_000 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      const j = result.current!;
      expect(j.gap.noiUplift.absolute).toBeCloseTo(j.stateB.targetNoi - j.stateA.noi);
    });

    it('gap.capexRequired === capexPerUnit × totalUnits', () => {
      const ctx = makeCtx({ capexPerUnit: 5_000, totalUnits: 100 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.gap.capexRequired).toBeCloseTo(500_000);
    });

    it('gap.occupancyUplift.points is positive when stateB occupancy > stateA occupancy', () => {
      // stateA.occupancy=0.88, stateB.targetOccupancy=1-0.05=0.95 → +7pp
      const ctx = makeCtx({ occupancy: 0.88, vacancy: 0.05 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.gap.occupancyUplift.points).toBeGreaterThan(0);
    });
  });

  // ── Levers ────────────────────────────────────────────────────────────────

  describe('Levers composition', () => {
    it('levers.rentGrowth.value matches financial.assumptions.rentGrowth', () => {
      const ctx = makeCtx({ rentGrowth: 0.035 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.levers.rentGrowth.value).toBeCloseTo(0.035);
    });

    it('levers.exitCapRate.resolvedFrom is user when user set it', () => {
      // Fixture sets exitCapRate with source='user'
      const ctx = makeCtx({ exitCapRate: 0.055 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.levers.exitCapRate.resolvedFrom).toBe('user');
    });

    it('levers.perLeverEvidence has entries for all 7 lever keys', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      const evidence = result.current!.levers.perLeverEvidence;
      const keys = ['rentGrowth', 'expenseGrowth', 'vacancy', 'exitCapRate', 'holdPeriod', 'capexPerUnit', 'managementFee'];
      expect(Object.keys(evidence).length).toBe(7);
      for (const key of keys) {
        const ev = evidence[key as keyof typeof evidence];
        expect(ev).toBeDefined();
        expect(ev!.sourceModule).toBeTruthy();
        expect(typeof ev!.sourceConfidence).toBe('number');
      }
    });

    it('levers.stanceModulators is null when operatorStance is null', () => {
      const ctx = makeCtx();
      expect(ctx.operatorStance).toBeNull();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.levers.stanceModulators).toBeNull();
    });

    it('levers.holdPeriod.value matches financial.assumptions.holdPeriod', () => {
      const ctx = makeCtx({ holdPeriod: 12 });
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.levers.holdPeriod.value).toBe(12);
    });
  });

  // ── Strategy Frame ────────────────────────────────────────────────────────

  describe('Strategy frame composition', () => {
    it('strategyFrame.detectedStrategy matches selectedStrategy', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.strategyFrame.detectedStrategy).toBe('rental');
    });

    it('strategyFrame.arbitrageGap matches ctx.strategy.arbitrageGap', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.strategyFrame.arbitrageGap).toBeCloseTo(12.5);
    });

    it('strategyFrame.verdict passes through from ctx.strategy.verdict', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.strategyFrame.verdict).toContain('RENTAL');
    });
  });

  // ── PENDING slots ─────────────────────────────────────────────────────────

  describe('PENDING slots are undefined/null in Phase 1', () => {
    it('aggressiveness is undefined (M36 PENDING)', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.aggressiveness).toBeUndefined();
    });

    it('calibration is undefined (M38 PENDING)', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.calibration).toBeUndefined();
    });

    it('gap.liftAggressiveness is undefined (M36 PENDING)', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.gap.liftAggressiveness).toBeUndefined();
    });

    it('path.eventAdjustedTrajectory is undefined (M35 PENDING)', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.path.eventAdjustedTrajectory).toBeUndefined();
    });

    it('path.pathConfidence is undefined (M38 PENDING)', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.path.pathConfidence).toBeUndefined();
    });

    it('path.leaseUpTimeline.weeksTo90 is null (M07 PENDING)', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.path.leaseUpTimeline.weeksTo90).toBeNull();
    });

    it('scoreTrajectory.scoreAtB is null (M25 extension PENDING)', () => {
      const ctx = makeCtx();
      const { result } = renderHook(() => useDealJourney(ctx, 0));
      expect(result.current!.scoreTrajectory.scoreAtB).toBeNull();
    });
  });
});
