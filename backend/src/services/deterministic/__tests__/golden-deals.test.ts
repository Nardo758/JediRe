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
import type { ModelResults } from '../deterministic-model-runner';
import { runFullModel } from '../run-full-model';
import { aggregateSeedActuals } from '../seed-actuals-aggregator';
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
  return runFullModel(modelAssumptions, { skipSensitivity: true }).result;
}

function assertGolden(
  label: string,
  result: ModelResults,
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
    const raw = bishopFixture.rawAssumptions;
    if (raw == null) throw new Error('Bishop rawAssumptions is null');
    const modelAssumptions = mapProFormaAssumptionsToModelAssumptions(raw);
    const full = runFullModel(modelAssumptions, { skipSensitivity: true });

    // Finding P: capture effective assumptions at the runFullModel boundary
    // (post-M11 loan resize + M14 adjustments + equity reconciliation)
    if (bishopFixture.effectiveAssumptions == null) {
      // First verified run: log the effective assumptions for manual pinning
      console.log('[Finding P] Bishop effectiveAssumptions (copy into fixture):');
      console.log(JSON.stringify(full.adjustedAssumptions, null, 2));
    } else {
      // Subsequent runs: verify effective assumptions are byte-identical
      expect(full.adjustedAssumptions).toEqual(bishopFixture.effectiveAssumptions);
    }

    assertGolden('Bishop', full.result, bishopFixture.expected!);
  });
    assertGolden('Bishop', runWithBridge(bishopFixture.rawAssumptions), bishopFixture.expected!);
  });
});

// ── Highlands: seed path ────────────────────────────────────────────────────

describe('Golden Deal Regression — Highlands (seed path)', () => {
  const hasExpected = highlandsFixture.expected != null && highlandsFixture.snapshotRows != null;

  (hasExpected ? it : it.skip)('matches pinned seed-path expected values (bridge-inclusive, seed edition)', () => {
    // Seed path: there is no rawAssumptions/runModel() to exercise (Highlands
    // has no acquisition/financing/exit terms — see Finding K/N). Instead we
    // run the REAL production aggregator over a pinned snapshot of raw
    // deal_monthly_actuals rows, so the test exercises real aggregation logic
    // (including its is_budget/is_proforma exclusion) rather than comparing
    // two hand-computed constants to each other.
    const exp = highlandsFixture.expected!;
    const result = aggregateSeedActuals(highlandsFixture.snapshotRows!, exp.targetYear);

    expect(result.egiAnnual).toBeCloseTo(exp.egiAnnual, TOLERANCE.dollar);
    expect(result.noiMargin).toBeCloseTo(exp.noiMargin, TOLERANCE.rate);
    expect(result.opexRatio).toBeCloseTo(exp.opexRatio, TOLERANCE.rate);
    expect(result.boundary).toBe(exp.boundary);
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

    const result = runFullModel(modelAssumptions, { skipSensitivity: true }).result;
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

// ── Finding K-2: lease_up forced-failure test ───────────────────────────────

describe('Finding K-2 — INV-5 lease_up forced-failure', () => {
  it('stabilizedNOI <= 0 under mode lease_up produces INV-5 ERROR', () => {
    const assumptions = {
      units: 50,
      avgUnitSf: 850,
      marketRent: 500,
      inPlaceRent: 500,
      purchasePrice: 50_000_000,
      closingCostsPct: 0.015,
      isFlorida: false,
      docStampsPct: 0,
      intangibleTaxPct: 0,
      titleInsurancePct: 0,
      capexBudget: 0,
      rentGrowth: [0.0, 0.0, 0.0, 0.0, 0.0],
      lossToLease: 0,
      vacancyY1: 0.10,
      vacancyStab: 0.10,
      underwritingVacancyFloor: 0.10,
      concessions: 0,
      badDebt: 0.02,
      otherIncomePerUnit: 0,
      expenseGrowth: 0.02,
      payrollPerUnit: 5000,
      maintenancePerUnit: 2000,
      contractServicesPerUnit: 1000,
      marketingPerUnit: 500,
      utilitiesPerUnit: 2000,
      adminPerUnit: 1000,
      insurancePerUnit: 1500,
      managementFee: 0.03,
      replacementReserves: 1000,
      loanAmount: 35_000_000,
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
      lpEquity: 14_250_000,
      gpEquity: 750_000,
      preferredReturn: 0.08,
      promoteTiers: [0.08, 0.12, 0.15] as [number, number, number],
      promoteSplits: [0.20, 0.30, 0.50] as [number, number, number],
      dealType: 'lease_up',
      dealMode: 'lease_up' as const,
      occupancyAtClose: 0.50,
      standardTurnDowntimeDays: 14,
      annualTurnoverRate: 0.50,
      newLeaseConcessionMonths: 1,
    };

    const full = runFullModel(assumptions, { skipSensitivity: true });

    // The model must surface an INV-5 error (not warn) for stabilizedNOI <= 0 in lease_up mode
    const inv5 = full.integrityChecks.find(c => c.id === 'INV-5');
    expect(inv5).toBeDefined();
    expect(inv5!.status).toBe('error');
    expect(inv5!.message).toContain('stabilizedNOI');
    expect(inv5!.message).toContain('lease_up');
  });
});

// ── Determinism proof: runFullModel twice, byte-identical ────────────────────

describe('Determinism proof — runFullModel()', () => {
  it('produces byte-identical results on identical inputs', () => {
    const assumptions = {
      units: 100,
      avgUnitSf: 850,
      marketRent: 1200,
      inPlaceRent: 1200,
      purchasePrice: 15_000_000,
      closingCostsPct: 0.015,
      isFlorida: false,
      docStampsPct: 0,
      intangibleTaxPct: 0,
      titleInsurancePct: 0,
      capexBudget: 200_000,
      rentGrowth: [0.025, 0.025, 0.025, 0.025, 0.025],
      lossToLease: 0,
      vacancyY1: 0.05,
      vacancyStab: 0.05,
      underwritingVacancyFloor: 0.05,
      concessions: 0.01,
      badDebt: 0.015,
      otherIncomePerUnit: 150,
      expenseGrowth: 0.025,
      payrollPerUnit: 600,
      maintenancePerUnit: 350,
      contractServicesPerUnit: 150,
      marketingPerUnit: 75,
      utilitiesPerUnit: 250,
      adminPerUnit: 120,
      insurancePerUnit: 180,
      managementFee: 0.03,
      replacementReserves: 150,
      loanAmount: 10_500_000,
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
      lpEquity: 4_185_000,
      gpEquity: 315_000,
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

    const run1 = runFullModel(assumptions, { skipSensitivity: true });
    const run2 = runFullModel(assumptions, { skipSensitivity: true });

    // Deep equality via JSON serialization (byte-identical for deterministic output).
    // computedAt timestamps are stripped because they vary by milliseconds between runs.
    const stripComputedAt = (s: string) => s.replace(/"computedAt":"[^"]+"/g, '"computedAt":""');
    expect(stripComputedAt(JSON.stringify(run1.result))).toBe(stripComputedAt(JSON.stringify(run2.result)));
    expect(JSON.stringify(run1.adjustedAssumptions)).toBe(JSON.stringify(run2.adjustedAssumptions));
    expect(JSON.stringify(run1.integrityChecks)).toBe(JSON.stringify(run2.integrityChecks));
    expect(run1.m11Iterations).toBe(run2.m11Iterations);
    expect(run1.m11Converged).toBe(run2.m11Converged);
    expect(run1.m14Applied).toBe(run2.m14Applied);
    expect(run1.m14CapRateAdjBps).toBe(run2.m14CapRateAdjBps);
    expect(run1.m14DscrFloor).toBe(run2.m14DscrFloor);
    expect(JSON.stringify(run1.m11Warnings)).toBe(JSON.stringify(run2.m11Warnings));
  });
});
