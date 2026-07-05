/**
 * Synthetic fixture — engine-level regression guard.
 *
 * Purpose: prove the turn-cohort engine produces correct disposition math on a
 * Highlands-shape deal (fully-occupied start, steady-state turnover, floor binding m1).
 *
 * Originally created as a degenerate-case guard (EM < 1, IRR = 0) when Finding K
 * (off-by-one in exit-year NOI) corrupted disposition output. Re-pinned 2026-07-04
 * after Finding K fix — now validates positive exit value, IRR, and equity multiple.
 *
 * Generated: 2026-07-04 via generate-synthetic-fixture.ts
 * Engine version: deterministic-model-runner.ts @ HEAD (post Finding K fix)
 */

import type { GoldenFixture } from './golden.types';

export const syntheticDegenerateFixture: GoldenFixture = {
  dealId: 'synthetic-degenerate-001',
  dealIdFull: null,
  dealName: 'SyntheticDegenerate',
  fixtureClass: 'synthetic',
  rawAssumptions: null, // ModelAssumptions are inline in the test; no ProFormaAssumptions envelope
  expected: {
    noiYear1: 3802873,
    egiYear1: 5756364,
    irr: 0.2707,
    equityMultiple: 2.916,
    dscrY1: 1.8573,
    cashOnCashY1: 0.1178,
    goingInCapRate: 0.0845,
    exitCapRate: 0.065,
    yieldOnCost: 0.0926,
    totalEquity: 14900000,
    totalDebt: 31500000,
    netProceeds: 64795605,
  },
  provenance: {
    captureDate: '2026-07-05T00:00:00Z',
    source: 'synthetic_engine',
    buildEndpoint: 'runFullModel() direct — run-full-model.ts (M11 cycle exercised)',
    inputSnapshot: 'synthetic-degenerate-v2',
    bodySource: 'Highlands-shape: fully-occupied, steady-state turnover, floor binding m1. RE-PINNED after Fix 4 (runFullModel extraction + Finding O equity recompute) — M11 cycle now exercises debt optimizer, equity recomputed to match resized loan.',
    pathBoundRule: true,
  },
};
