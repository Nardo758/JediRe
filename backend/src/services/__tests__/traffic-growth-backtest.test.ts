import { describe, it, expect } from 'vitest';
import {
  SYNTHETIC_BACKTEST_CASES,
  SYNTHETIC_GROWTH_SIGN_PAIRS,
} from '../__fixtures__/traffic-growth-backtest.synthetic';
import { growthSignAgreement, runBacktest } from '../traffic-growth-backtest';
import { ROAD_CLASSES, RoadClass, SpeedFlowParams, defaultSpeedFlowParams } from '../traffic-volume-estimator';

const PARAMS = Object.fromEntries(ROAD_CLASSES.map((rc) => [rc, defaultSpeedFlowParams(rc)])) as Record<
  RoadClass,
  SpeedFlowParams
>;

describe('runBacktest (synthetic fixture, no network)', () => {
  const report = runBacktest(SYNTHETIC_BACKTEST_CASES, PARAMS, SYNTHETIC_GROWTH_SIGN_PAIRS);

  it('reports MAPE by hour and road class', () => {
    expect(report.byHourAndRoadClass).toHaveLength(3);
    const cell = (roadClass: RoadClass, hour: number) =>
      report.byHourAndRoadClass.find((c) => c.roadClass === roadClass && c.hour === hour);

    // (0% + 10%) / 2
    expect(cell('Arterial', 8)).toMatchObject({ sampleCount: 2, mapePct: expect.closeTo(5, 2) });
    // (25% + 20%) / 2
    expect(cell('Arterial', 17)).toMatchObject({ sampleCount: 2, mapePct: expect.closeTo(22.5, 2) });
    expect(cell('Interstate', 17)).toMatchObject({ sampleCount: 1, mapePct: expect.closeTo(20, 2) });
  });

  it('reports the overall MAPE across scored cases', () => {
    // (0 + 10 + 25 + 20 + 20) / 5
    expect(report.overallMapePct).toBeCloseTo(15, 2);
  });

  it('excludes free-flow readings from scoring and counts them', () => {
    expect(report.caseCount).toBe(6);
    expect(report.excludedFreeFlowCount).toBe(1);
    expect(report.byHourAndRoadClass.some((c) => c.hour === 3)).toBe(false);
  });

  it('reports growth-sign agreement with the DOT YoY trend', () => {
    expect(report.signAgreement).toEqual({ pairCount: 5, agreeingCount: 3, agreementPct: 60 });
  });
});

describe('runBacktest edge cases', () => {
  it('returns a null MAPE when nothing can be scored', () => {
    const report = runBacktest(
      [{ roadClass: 'Local', hour: 3, freeFlowSeconds: 100, inTrafficSeconds: 100, lanes: 2, countedVph: 40 }],
      PARAMS,
      [],
    );
    expect(report.overallMapePct).toBeNull();
    expect(report.byHourAndRoadClass).toEqual([]);
    expect(report.signAgreement).toEqual({ pairCount: 0, agreeingCount: 0, agreementPct: null });
  });

  it('rejects a case with no DOT count', () => {
    expect(() =>
      runBacktest(
        [{ roadClass: 'Local', hour: 8, freeFlowSeconds: 100, inTrafficSeconds: 110, lanes: 2, countedVph: 0 }],
        PARAMS,
        [],
      ),
    ).toThrow(RangeError);
  });
});

describe('growthSignAgreement', () => {
  it('treats flat against growing as disagreement', () => {
    expect(growthSignAgreement([{ estimatedGrowthPct: 0, dotYoyPct: 2 }])).toMatchObject({ agreeingCount: 0 });
  });
});
