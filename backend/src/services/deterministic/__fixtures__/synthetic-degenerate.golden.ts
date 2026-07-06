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

import type { SyntheticFixture } from './golden.types';

export const syntheticDegenerateFixture: SyntheticFixture = {
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
    captureDate: '2026-07-05T12:38:00Z',
    source: 'synthetic_engine',
    buildEndpoint: 'runFullModel() direct — run-full-model.ts (canonical orchestration: pass-1 -> M11 -> M14 -> equity reconcile -> pass-2)',
    inputSnapshot: 'synthetic-degenerate-v3',
    bodySource: 'Highlands-shape: fully-occupied, steady-state turnover, floor binding m1. RE-PINNED after Fix-4b (corrected orchestration: explicit pass-1 feeds M11 sizing, equity reconciled AFTER M14 from final loan+cost, pass-2 produces final result). Values identical to v2 — M11 was already computing NOI internally, but canonical ordering is now structurally enforced.',
    pathBoundRule: true,
  },
};
