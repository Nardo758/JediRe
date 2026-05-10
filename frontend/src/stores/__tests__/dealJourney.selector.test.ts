import { describe, it, expect } from 'vitest';
import { computeJourneyGap } from '../dealJourney.selector';
import type { JourneyStateA, JourneyStateB } from '../dealJourney.types';

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
      updatedAt: null,
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
