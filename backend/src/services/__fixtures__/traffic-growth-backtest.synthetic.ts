/**
 * SYNTHETIC back-test fixture for the traffic volume estimator (DL-192).
 *
 * These are NOT Highlands readings and NOT real DOT counts. The Highlands
 * golden fixture (deterministic/__fixtures__/highlands.golden.ts) holds
 * monthly financial actuals only — no travel times, no hourly counts, no
 * AADT — and trafficCalibrationJob.ts calibrates the leasing funnel, so
 * neither can back-test a speed–flow estimate.
 *
 * Every number below is fixed and was produced from the uncalibrated default
 * curve, t/t0 = 1 + 0.15 (v/c)^4, with a stated error applied to the "DOT
 * count" side. The fixture proves the back-test arithmetic; it says nothing
 * about how accurate the estimator is on a real road.
 *
 * A real back-test needs, for one counted road: (a) travel-time samples from
 * the sampler over at least one window and (b) that station's DOT hourly
 * counts for the same hours.
 */

import type { BacktestCase, GrowthSignPair } from '../traffic-growth-backtest';

const FREE_FLOW_SECONDS = 100;

/**
 * Arterial, 4 lanes, 850 vph per lane → 3,400 vph capacity.
 * inTrafficSeconds = 100 × (1 + 0.15 × (estimatedVph / 3400)^4).
 */
export const SYNTHETIC_BACKTEST_CASES: readonly BacktestCase[] = [
  // Hour 8: estimator output 3,060 vph (v/c 0.9). Counts 3,060 and 3,400 → errors 0% and 10%.
  { roadClass: 'Arterial', hour: 8, freeFlowSeconds: FREE_FLOW_SECONDS, inTrafficSeconds: 109.8415, lanes: 4, countedVph: 3060 },
  { roadClass: 'Arterial', hour: 8, freeFlowSeconds: FREE_FLOW_SECONDS, inTrafficSeconds: 109.8415, lanes: 4, countedVph: 3400 },
  // Hour 17: estimator output 3,400 vph (v/c 1.0). Counts 2,720 and 4,250 → errors 25% and 20%.
  { roadClass: 'Arterial', hour: 17, freeFlowSeconds: FREE_FLOW_SECONDS, inTrafficSeconds: 115, lanes: 4, countedVph: 2720 },
  { roadClass: 'Arterial', hour: 17, freeFlowSeconds: FREE_FLOW_SECONDS, inTrafficSeconds: 115, lanes: 4, countedVph: 4250 },
  // Hour 3: free flow. Volume is not identifiable from speed, so the case is excluded, not scored.
  { roadClass: 'Arterial', hour: 3, freeFlowSeconds: FREE_FLOW_SECONDS, inTrafficSeconds: 100, lanes: 4, countedVph: 170 },
  // Interstate, 6 lanes, 2,000 vph per lane → 12,000 vph capacity. Hour 17: output 9,600 vph (v/c 0.8). Count 8,000 → error 20%.
  { roadClass: 'Interstate', hour: 17, freeFlowSeconds: FREE_FLOW_SECONDS, inTrafficSeconds: 106.144, lanes: 6, countedVph: 8000 },
];

/** Growth estimate vs DOT YoY for five made-up roads: three agree in sign, two do not. */
export const SYNTHETIC_GROWTH_SIGN_PAIRS: readonly GrowthSignPair[] = [
  { estimatedGrowthPct: 4.2, dotYoyPct: 2.1 },
  { estimatedGrowthPct: -1.5, dotYoyPct: -0.4 },
  { estimatedGrowthPct: 8.0, dotYoyPct: 1.0 },
  { estimatedGrowthPct: 3.0, dotYoyPct: -2.0 },
  { estimatedGrowthPct: -6.0, dotYoyPct: 1.5 },
];
