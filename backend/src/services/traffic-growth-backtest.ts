/**
 * Back-test for the traffic volume estimator and growth index (DL-192).
 *
 * Pure functions: given paired readings (a travel-time sample and the DOT
 * hourly count for the same road and hour) they report the estimator's error
 * by hour and road class, and how often the growth estimate agrees in sign
 * with the DOT year-over-year trend. No I/O and no network.
 */

import { RoadClass, SpeedFlowParams, estimateHourlyVolume } from './traffic-volume-estimator';

export interface BacktestCase {
  roadClass: RoadClass;
  /** Local hour 0–23. */
  hour: number;
  freeFlowSeconds: number;
  inTrafficSeconds: number;
  lanes: number | null;
  /** DOT hourly count for the same road and hour, vehicles per hour. */
  countedVph: number;
}

export interface BacktestCell {
  roadClass: RoadClass;
  hour: number;
  sampleCount: number;
  /** Mean absolute percentage error of estimated vs counted volume. */
  mapePct: number;
}

export interface GrowthSignPair {
  estimatedGrowthPct: number;
  dotYoyPct: number;
}

export interface SignAgreement {
  pairCount: number;
  agreeingCount: number;
  /** Null when there are no pairs to compare. */
  agreementPct: number | null;
}

export interface BacktestReport {
  caseCount: number;
  /** Cases dropped because the reading sat at free flow, where volume is not identifiable. */
  excludedFreeFlowCount: number;
  /** Null when no case could be scored. */
  overallMapePct: number | null;
  byHourAndRoadClass: BacktestCell[];
  signAgreement: SignAgreement;
}

export function growthSignAgreement(pairs: readonly GrowthSignPair[]): SignAgreement {
  const agreeingCount = pairs.filter(
    (p) => Math.sign(p.estimatedGrowthPct) === Math.sign(p.dotYoyPct),
  ).length;
  return {
    pairCount: pairs.length,
    agreeingCount,
    agreementPct: pairs.length === 0 ? null : (agreeingCount / pairs.length) * 100,
  };
}

export function runBacktest(
  cases: readonly BacktestCase[],
  paramsByRoadClass: Readonly<Record<RoadClass, SpeedFlowParams>>,
  growthPairs: readonly GrowthSignPair[],
): BacktestReport {
  const cells = new Map<string, { roadClass: RoadClass; hour: number; n: number; apeSum: number }>();
  let scored = 0;
  let apeTotal = 0;
  let excludedFreeFlow = 0;

  for (const c of cases) {
    if (!(c.countedVph > 0)) {
      throw new RangeError(`Back-test case has a non-positive DOT count (${c.countedVph})`);
    }
    const estimate = estimateHourlyVolume({
      freeFlowSeconds: c.freeFlowSeconds,
      inTrafficSeconds: c.inTrafficSeconds,
      lanes: c.lanes,
      params: paramsByRoadClass[c.roadClass],
    });
    if (estimate.status === 'free_flow') {
      excludedFreeFlow++;
      continue;
    }
    const ape = (Math.abs(estimate.volumeVph - c.countedVph) / c.countedVph) * 100;
    scored++;
    apeTotal += ape;
    const key = `${c.roadClass}:${c.hour}`;
    const cell = cells.get(key) ?? { roadClass: c.roadClass, hour: c.hour, n: 0, apeSum: 0 };
    cell.n++;
    cell.apeSum += ape;
    cells.set(key, cell);
  }

  return {
    caseCount: cases.length,
    excludedFreeFlowCount: excludedFreeFlow,
    overallMapePct: scored === 0 ? null : apeTotal / scored,
    byHourAndRoadClass: [...cells.values()]
      .sort((a, b) => a.roadClass.localeCompare(b.roadClass) || a.hour - b.hour)
      .map((cell) => ({
        roadClass: cell.roadClass,
        hour: cell.hour,
        sampleCount: cell.n,
        mapePct: cell.apeSum / cell.n,
      })),
    signAgreement: growthSignAgreement(growthPairs),
  };
}
