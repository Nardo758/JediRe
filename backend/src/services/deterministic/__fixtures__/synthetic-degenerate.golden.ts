/**
 * Synthetic degenerate fixture — engine-level.
 *
 * Purpose: prove the turn-cohort engine degenerates gracefully on a Highlands-shape
 * deal (fully-occupied start, steady-state turnover, floor binding m1, no death spiral).
 *
 * This fixture is NOT economically realistic (EM < 1, IRR = 0 by construction due to
 * purchase price assumptions). Its job is degenerate-case guard only.
 *
 * Generated: 2026-07-04 via generate-synthetic-fixture.ts
 * Engine version: deterministic-model-runner.ts @ HEAD
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
    irr: 0,
    equityMultiple: 0.472000,
    dscrY1: 1.591682,
    cashOnCashY1: 0.105065,
    goingInCapRate: 0.084508,
    exitCapRate: 0.065,
    yieldOnCost: 0,
    totalEquity: 13455000,
    totalDebt: 31500000,
    netProceeds: 0,
  },
  provenance: {
    captureDate: '2026-07-04T00:00:00Z',
    source: 'synthetic_engine',
    buildEndpoint: 'runModel() direct — deterministic-model-runner.ts',
    inputSnapshot: 'synthetic-degenerate-v1',
    bodySource: 'Highlands-shape: fully-occupied, steady-state turnover, floor binding m1',
    pathBoundRule: true,
  },
};
