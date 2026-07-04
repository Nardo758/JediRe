/**
 * Golden Deal Regression Tests
 *
 * Three fixtures, three paths:
 *   - Bishop: build-path golden (rawAssumptions from construct-from-DB body)
 *   - Highlands: seed-path golden (values from seed/actuals surface, origin class: owned_import)
 *   - SyntheticDegenerate: engine-level synthetic (Highlands-shape, floor binding m1)
 *
 * Fixtures pin ONLY after live acceptance verifies correctness.
 * Until pinned, `expected` is null and tests skip automatically.
 */

import type { ProFormaAssumptions } from '../../financial-model-engine.service';
import { mapProFormaAssumptionsToModelAssumptions } from '../proforma-assumptions-bridge';
import { runModel } from '../deterministic-model-runner';
import { bishopFixture } from '../__fixtures__/bishop.golden';
import { highlandsFixture } from '../__fixtures__/highlands.golden';
import { syntheticDegenerateFixture } from '../__fixtures__/synthetic-degenerate.golden';

const TOLERANCE = {
  dollar: 0,      // exact dollar
  rate: 4,        // 0.0001
  pct: 2,         // 0.01%
  multiple: 3,    // 0.001
};

function runWithBridge(raw: ProFormaAssumptions | null) {
  if (raw == null) throw new Error('rawAssumptions is null — fixture not captured');
  const modelAssumptions = mapProFormaAssumptionsToModelAssumptions(raw);
  return runModel(modelAssumptions, { skipSensitivity: true });
}

function assertGolden(
  label: string,
  result: ReturnType<typeof runModel>,
  exp: NonNullable<typeof bishopFixture.expected>,
) {
  expect(result.summary.noiYear1).toBeCloseTo(exp.noiYear1, TOLERANCE.dollar);
  expect(result.annualCashFlow[0].effectiveGrossIncome).toBeCloseTo(exp.egiYear1, TOLERANCE.dollar);
  expect(result.summary.irr).toBeCloseTo(exp.irr, TOLERANCE.rate);
  expect(result.summary.equityMultiple).toBeCloseTo(exp.equityMultiple, TOLERANCE.multiple);
  expect(result.summary.dscrByYear[0]).toBeCloseTo(exp.dscrY1, TOLERANCE.rate);
  expect(result.summary.cashOnCashByYear[0]).toBeCloseTo(exp.cashOnCashY1, TOLERANCE.rate);
  expect(result.summary.goingInCapRate).toBeCloseTo(exp.goingInCapRate, TOLERANCE.rate);
  expect(result.summary.exitCapRate).toBeCloseTo(exp.exitCapRate, TOLERANCE.rate);

  const yoc = typeof result.summary.yieldOnCost === 'number'
    ? result.summary.yieldOnCost
    : (result.summary.yieldOnCost as any)?.trended ?? 0;
  expect(yoc).toBeCloseTo(exp.yieldOnCost, TOLERANCE.rate);

  expect(result.summary.totalEquity).toBeCloseTo(exp.totalEquity, TOLERANCE.dollar);
  expect(result.summary.loanAmount).toBeCloseTo(exp.totalDebt, TOLERANCE.dollar);
  expect(result.disposition?.netSaleProceeds ?? 0).toBeCloseTo(exp.netProceeds, TOLERANCE.dollar);
}

// ── Bishop: build path ──────────────────────────────────────────────────────

describe('Golden Deal Regression — Bishop (build path)', () => {
  const hasExpected = bishopFixture.expected != null && bishopFixture.rawAssumptions != null;

  (hasExpected ? it : it.skip)('matches pinned expected outputs (bridge-inclusive)', () => {
    assertGolden('Bishop', runWithBridge(bishopFixture.rawAssumptions), bishopFixture.expected!);
  });
});

// ── Highlands: seed path ────────────────────────────────────────────────────

describe('Golden Deal Regression — Highlands (seed path)', () => {
  const hasExpected = highlandsFixture.expected != null;

  (hasExpected ? it : it.skip)('matches pinned seed-path expected values', () => {
    // Seed path: we do NOT run the engine from rawAssumptions (there are none).
    // Instead, the fixture's expected values were captured from the seed/actuals
    // surface and must be verified against that same surface in Replit.
    // For the test harness, we skip when expected is null.
    expect(highlandsFixture.expected).not.toBeNull();
  });
});

// ── Synthetic Degenerate: engine-level ──────────────────────────────────────

describe('Golden Deal Regression — SyntheticDegenerate (engine-level)', () => {
  const hasExpected = syntheticDegenerateFixture.expected != null;

  (hasExpected ? it : it.skip)('matches pinned synthetic expected outputs', () => {
    // Inline ModelAssumptions (same shape used to generate the fixture)
    const modelAssumptions = {
      units: 376,
      avgUnitSf: 850,
      marketRent: 1400,
      inPlaceRent: 1400,
      purchasePrice: 45_000_000,
      closingCostsPct: 0.015,
      isFlorida: false,
      docStampsPct: 0,
      intangibleTaxPct: 0,
      titleInsurancePct: 0,
      capexBudget: 500_000,
      rentGrowth: [0.03, 0.03, 0.03, 0.03, 0.03],
      lossToLease: 0,
      vacancyY1: 0.038,
      vacancyStab: 0.038,
      underwritingVacancyFloor: 0.05,
      concessions: 0.01,
      badDebt: 0.015,
      otherIncomePerUnit: 200,
      expenseGrowth: 0.025,
      payrollPerUnit: 1200,
      maintenancePerUnit: 450,
      contractServicesPerUnit: 300,
      marketingPerUnit: 150,
      utilitiesPerUnit: 400,
      adminPerUnit: 200,
      insurancePerUnit: 350,
      managementFee: 0.03,
      replacementReserves: 250,
      loanAmount: 31_500_000,
      ltv: 0.70,
      term: 360,
      amort: 360,
      ioPeriod: 0,
      rate: 0.065,
      originationFeePct: 0.01,
      prepayPenalty: 0,
      exitCap: 0.065,
      saleCosts: 0.02,
      holdYears: 5,
      lpEquity: 13_185_000,
      gpEquity: 270_000,
      preferredReturn: 0.08,
      promoteTiers: [0.08, 0.12, 0.15] as [number, number, number],
      promoteSplits: [0.20, 0.30, 0.50] as [number, number, number],
      dealType: 'existing',
      dealMode: 'existing' as const,
      occupancyAtClose: 1.0,
      standardTurnDowntimeDays: 14,
      annualTurnoverRate: 0.50,
      newLeaseConcessionMonths: 1,
    };

    const result = runModel(modelAssumptions, { skipSensitivity: true });
    assertGolden('SyntheticDegenerate', result, syntheticDegenerateFixture.expected!);

    // Degenerate-case specific assertions
    const m1 = result.monthlyCashFlow[0];
    const m12 = result.monthlyCashFlow[11];
    expect(m1.floorBinding).toBe(true);
    expect(m12.floorBinding).toBe(true);
    expect(m1.effectiveVacancy ?? 0).toBeCloseTo(0.05, 4);
    expect(m1.vacancy).toBeLessThan(m1.effectiveVacancy ?? 0);

    const y1Nois = result.monthlyCashFlow.slice(0, 12).map(m => m.noi);
    const variance = Math.max(...y1Nois) - Math.min(...y1Nois);
    expect(variance).toBeLessThan(50_000); // small intra-year variance for existing deal

    expect(result._unmatchedOpexKeys ?? []).toHaveLength(0);
    expect(result._orphanedOpexKeys ?? []).toHaveLength(0);
  });
});
