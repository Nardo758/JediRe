/**
 * Golden Deal Regression Tests
 *
 * These tests compare the deterministic engine's output against pinned
 * expected values for Bishop and Highlands. Fixtures pin ONLY after W4/W5
 * live acceptance verifies correctness (Excel parity + operator sign-off).
 *
 * Until pinned, `expected` is null and tests skip automatically.
 */

import { describe, it, expect } from 'vitest';
import { runModel } from '../deterministic-model-runner';
import { bishopFixture } from '../__fixtures__/bishop.golden';
import { highlandsFixture } from '../__fixtures__/highlands.golden';

const TOLERANCE = {
  dollar: 0,      // exact dollar
  rate: 4,        // 0.0001
  pct: 2,         // 0.01%
  multiple: 3,    // 0.001
};

describe('Golden Deal Regression — Bishop', () => {
  const hasExpected = bishopFixture.expected != null;

  (hasExpected ? it : it.skip)('matches pinned expected outputs', () => {
    const exp = bishopFixture.expected!;
    const result = runModel(bishopFixture.assumptions, { skipSensitivity: true });

    expect(result.summary.noiYear1).toBeCloseTo(exp.noiYear1, TOLERANCE.dollar);
    expect(result.summary.effectiveGrossIncome).toBeCloseTo(exp.egiYear1, TOLERANCE.dollar);
    expect(result.summary.irr).toBeCloseTo(exp.irr, TOLERANCE.rate);
    expect(result.summary.equityMultiple).toBeCloseTo(exp.equityMultiple, TOLERANCE.multiple);
    expect(result.summary.dscr).toBeCloseTo(exp.dscrY1, TOLERANCE.rate);
    expect(result.summary.cashOnCash?.[0] ?? 0).toBeCloseTo(exp.cashOnCashY1, TOLERANCE.rate);
    expect(result.summary.purchaseCapRate).toBeCloseTo(exp.goingInCapRate, TOLERANCE.rate);
    expect(result.summary.exitCapRate).toBeCloseTo(exp.exitCapRate, TOLERANCE.rate);
    expect(result.summary.yieldOnCost).toBeCloseTo(exp.yieldOnCost, TOLERANCE.rate);
    expect(result.summary.totalEquity).toBeCloseTo(exp.totalEquity, TOLERANCE.dollar);
    expect(result.summary.totalDebt).toBeCloseTo(exp.totalDebt, TOLERANCE.dollar);
    expect(result.summary.netProceeds).toBeCloseTo(exp.netProceeds, TOLERANCE.dollar);
  });
});

describe('Golden Deal Regression — Highlands', () => {
  const hasExpected = highlandsFixture.expected != null;

  (hasExpected ? it : it.skip)('matches pinned expected outputs', () => {
    const exp = highlandsFixture.expected!;
    const result = runModel(highlandsFixture.assumptions, { skipSensitivity: true });

    expect(result.summary.noiYear1).toBeCloseTo(exp.noiYear1, TOLERANCE.dollar);
    expect(result.summary.effectiveGrossIncome).toBeCloseTo(exp.egiYear1, TOLERANCE.dollar);
    expect(result.summary.irr).toBeCloseTo(exp.irr, TOLERANCE.rate);
    expect(result.summary.equityMultiple).toBeCloseTo(exp.equityMultiple, TOLERANCE.multiple);
    expect(result.summary.dscr).toBeCloseTo(exp.dscrY1, TOLERANCE.rate);
    expect(result.summary.cashOnCash?.[0] ?? 0).toBeCloseTo(exp.cashOnCashY1, TOLERANCE.rate);
    expect(result.summary.purchaseCapRate).toBeCloseTo(exp.goingInCapRate, TOLERANCE.rate);
    expect(result.summary.exitCapRate).toBeCloseTo(exp.exitCapRate, TOLERANCE.rate);
    expect(result.summary.yieldOnCost).toBeCloseTo(exp.yieldOnCost, TOLERANCE.rate);
    expect(result.summary.totalEquity).toBeCloseTo(exp.totalEquity, TOLERANCE.dollar);
    expect(result.summary.totalDebt).toBeCloseTo(exp.totalDebt, TOLERANCE.dollar);
    expect(result.summary.netProceeds).toBeCloseTo(exp.netProceeds, TOLERANCE.dollar);
  });
});
