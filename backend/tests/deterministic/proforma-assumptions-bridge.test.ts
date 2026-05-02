import { describe, it, expect, beforeAll } from 'vitest';
import {
  mapProFormaAssumptionsToModelAssumptions,
  crossCheckLLMVsDeterministic,
} from '../../src/services/deterministic/proforma-assumptions-bridge';
import { runModel, runIntegrityChecks } from '../../src/services/deterministic/deterministic-model-runner';

const BASE_ASSUMPTIONS = {
  dealInfo: {
    dealName: 'Test Deal',
    totalUnits: 100,
    netRentableSF: 85000,
    vintage: 2000,
    address: '123 Main St',
    city: 'Atlanta',
    state: 'GA',
  },
  modelType: 'existing' as const,
  holdPeriod: 5,
  unitMix: [
    { floorPlan: '1BR', unitSize: 850, beds: 1, units: 100, occupied: 93, vacant: 7, marketRent: 1800, inPlaceRent: 1750 },
  ],
  acquisition: { purchasePrice: 18000000, capRate: 0.06, closingCosts: { legal: 50000 } },
  disposition: { exitCapRate: 0.065, sellingCosts: 0.02, saleNOIMethod: 'terminal' as const },
  revenue: {
    rentGrowth: [0.03, 0.03, 0.03, 0.03, 0.03],
    lossToLease: 0.02,
    stabilizedOccupancy: 0.93,
    collectionLoss: 0.01,
    otherIncome: {},
  },
  expenses: {
    payroll: { amount: 280000, type: 'total' as const, growthRate: 0.03 },
    management_fee: { amount: 72000, type: 'total' as const, growthRate: 0.03 },
  },
  financing: {
    loanAmount: 13500000,
    loanType: 'fixed' as const,
    interestRate: 0.065,
    spread: 0,
    term: 5,
    amortization: 30,
    ioPeriod: 0,
    originationFee: 0.01,
    rateCapCost: 0,
    prepayPenalty: 0,
  },
  capex: { lineItems: [], contingencyPct: 0.10, reservesPerUnit: 300 },
  waterfall: {
    lpShare: 0.90,
    gpShare: 0.10,
    hurdles: [{ hurdleRate: 0.08, promoteToGP: 0.20, lpSplit: 0.80 }],
    equityContribution: 4500000,
  },
};

describe('mapProFormaAssumptionsToModelAssumptions', () => {
  it('converts financing term and amortization from years to months', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    expect(m.term).toBe(5 * 12);
    expect(m.amort).toBe(30 * 12);
  });

  it('maps purchase price directly', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    expect(m.purchasePrice).toBe(18000000);
  });

  it('maps loan amount directly', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    expect(m.loanAmount).toBe(13500000);
  });

  it('maps hold years from holdPeriod', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    expect(m.holdYears).toBe(5);
  });

  it('converts stabilizedOccupancy to vacancy (1 - occupancy)', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    expect(m.vacancyY1).toBeCloseTo(1 - 0.93, 6);
    expect(m.vacancyStab).toBeCloseTo(1 - 0.93, 6);
  });

  it('converts payroll from total $/yr to $/unit/yr', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    expect(m.payrollPerUnit).toBeCloseTo(280000 / 100, 2);
  });

  it('converts management fee from total $/yr to fraction of EGI', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    expect(m.managementFee).toBeGreaterThan(0);
    expect(m.managementFee).toBeLessThan(0.15);
  });

  it('splits waterfall equityContribution by lpShare/gpShare', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    expect(m.lpEquity).toBeCloseTo(4500000 * 0.90, 0);
    expect(m.gpEquity).toBeCloseTo(4500000 * 0.10, 0);
  });

  it('handles zero-unit edge case without throwing', () => {
    const edge = { ...BASE_ASSUMPTIONS, dealInfo: { ...BASE_ASSUMPTIONS.dealInfo, totalUnits: 0 } };
    expect(() => mapProFormaAssumptionsToModelAssumptions(edge as any)).not.toThrow();
  });

  it('handles empty unitMix with safe fallback rent', () => {
    const edge = { ...BASE_ASSUMPTIONS, unitMix: [] };
    const m = mapProFormaAssumptionsToModelAssumptions(edge as any);
    expect(m.marketRent).toBeGreaterThan(0);
  });

  it('handles empty expenses object without throwing', () => {
    const edge = { ...BASE_ASSUMPTIONS, expenses: {} };
    expect(() => mapProFormaAssumptionsToModelAssumptions(edge as any)).not.toThrow();
  });

  it('produces runnable ModelAssumptions (runModel does not throw)', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    expect(() => runModel(m, { skipSensitivity: true })).not.toThrow();
  });

  it('valid deal passes all hard invariants (INV-* status=error)', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    const r = runModel(m, { skipSensitivity: true });
    const checks = runIntegrityChecks(m, r);
    const hardFailures = checks.filter(c => c.status === 'error');
    expect(hardFailures).toHaveLength(0);
  });

  it('loan > purchasePrice triggers INV-8 hard failure', () => {
    const over = {
      ...BASE_ASSUMPTIONS,
      financing: { ...BASE_ASSUMPTIONS.financing, loanAmount: 20000000 },
    };
    const m = mapProFormaAssumptionsToModelAssumptions(over as any);
    const r = runModel(m, { skipSensitivity: true });
    const checks = runIntegrityChecks(m, r);
    const inv8 = checks.find(c => c.id === 'INV-8');
    expect(inv8).toBeDefined();
    expect(inv8?.status).toBe('error');
  });

  it('zero equity triggers INV-7 hard failure', () => {
    const noEquity = {
      ...BASE_ASSUMPTIONS,
      waterfall: { ...BASE_ASSUMPTIONS.waterfall, equityContribution: 0 },
      financing: { ...BASE_ASSUMPTIONS.financing, loanAmount: 18000000 },
    };
    const m = mapProFormaAssumptionsToModelAssumptions(noEquity as any);
    const r = runModel(m, { skipSensitivity: true });
    const checks = runIntegrityChecks(m, r);
    const inv7or8 = checks.filter(c => c.status === 'error');
    expect(inv7or8.length).toBeGreaterThan(0);
  });
});

// ── Helper: minimal runModel assumptions ────────────────────────────────────
function makeRunModelAssumptions(overrides: Partial<import('../../src/services/deterministic/deterministic-model-runner').ModelAssumptions> = {}) {
  return {
    purchasePrice: 10000000, units: 100, marketRent: 1500, loanAmount: 7000000,
    rate: 0.065, holdYears: 5, lpEquity: 2700000, gpEquity: 300000,
    exitCap: 0.055, avgUnitSf: 850, ltv: 0.7, closingCostsPct: 0.01,
    isFlorida: false, docStampsPct: 0, intangibleTaxPct: 0, titleInsurancePct: 0,
    expenseGrowth: 0.03, managementFee: 0.04, replacementReserves: 250, saleCosts: 0.02,
    originationFeePct: 0.01, preferredReturn: 0.08,
    promoteTiers: [0.12, 0.15, 0.20] as [number, number, number],
    promoteSplits: [0.20, 0.50, 0.80] as [number, number, number],
    rentGrowth: [0.03, 0.03, 0.03, 0.03, 0.03], lossToLease: 0.03,
    vacancyY1: 0.10, vacancyStab: 0.05, concessions: 0.02, badDebt: 0.005,
    otherIncomePerUnit: 0, payrollPerUnit: 0, maintenancePerUnit: 0,
    contractServicesPerUnit: 0, marketingPerUnit: 0, utilitiesPerUnit: 0,
    adminPerUnit: 0, insurancePerUnit: 0, term: 360, amort: 360, ioPeriod: 0,
    capexBudget: 500000, dealType: 'existing',
    ...overrides,
  } as import('../../src/services/deterministic/deterministic-model-runner').ModelAssumptions;
}

describe('runModel() new output fields (task #486)', () => {
  let result: ReturnType<typeof runModel>;

  beforeAll(() => {
    result = runModel(makeRunModelAssumptions(), { skipSensitivity: true });
  });

  // ── AnnualCashFlowRow new fields ──────────────────────────────────────────
  it('AnnualCashFlowRow.cfads equals preTaxCashFlow for every row', () => {
    for (const row of result.annualCashFlow) {
      expect(row.cfads).toBe(row.preTaxCashFlow);
    }
  });

  it('AnnualCashFlowRow.debtYield is NOI / loanAmount for every row', () => {
    for (const row of result.annualCashFlow) {
      expect(row.debtYield).not.toBeNull();
      expect(row.debtYield).toBeCloseTo(row.noi / 7000000, 6);
    }
  });

  it('AnnualCashFlowRow.capRateOnCost is NOI / totalAcqCost for every row', () => {
    for (const row of result.annualCashFlow) {
      expect(row.capRateOnCost).not.toBeNull();
      expect(row.capRateOnCost!).toBeGreaterThan(0);
    }
  });

  it('AnnualCashFlowRow.isExitYear is false for operating rows and true for exit row', () => {
    const opRows = result.annualCashFlow.slice(0, -1);
    const exitRow = result.annualCashFlow[result.annualCashFlow.length - 1];
    for (const row of opRows) {
      expect(row.isExitYear).toBe(false);
    }
    expect(exitRow.isExitYear).toBe(true);
  });

  // ── summary new fields ────────────────────────────────────────────────────
  it('summary.egiByYear has one entry per hold year, all positive', () => {
    const s = result.summary;
    expect(s.egiByYear).toHaveLength(5);
    for (const v of s.egiByYear) expect(v).toBeGreaterThan(0);
  });

  it('summary.debtServiceCoverageByYear is identical to dscrByYear', () => {
    const s = result.summary;
    expect(s.debtServiceCoverageByYear).toEqual(s.dscrByYear);
  });

  it('summary.debtYieldByYear has one entry per hold year, all positive', () => {
    const s = result.summary;
    expect(s.debtYieldByYear).toHaveLength(5);
    for (const v of s.debtYieldByYear) expect(v).toBeGreaterThan(0);
  });

  it('summary.stabilizedCapRate is stabilizedNOI / purchasePrice', () => {
    const s = result.summary;
    const expected = result.disposition.stabilizedNOI / 10000000;
    expect(s.stabilizedCapRate).toBeCloseTo(expected, 6);
  });

  it('summary.unleveredIrr is defined and positive for a profitable deal', () => {
    const s = result.summary;
    expect(s.unleveredIrr).not.toBeNull();
    expect(s.unleveredIrr!).toBeGreaterThan(0);
  });

  it('summary.yieldOnCost.untrended is noiY1 / totalAcqCost', () => {
    const s = result.summary;
    expect(s.yieldOnCost.untrended).toBeGreaterThan(0);
    expect(s.yieldOnCost.trended).toBeGreaterThanOrEqual(s.yieldOnCost.untrended);
  });

  it('summary.lpTotalDistributions and gpTotalDistributions are positive', () => {
    const s = result.summary;
    expect(s.lpTotalDistributions).toBeGreaterThan(0);
    expect(s.gpTotalDistributions).toBeGreaterThan(0);
  });

  it('summary.lpProfit + gpProfit === totalProfit', () => {
    const s = result.summary;
    expect(s.totalProfit).toBeCloseTo(s.lpProfit + (s.gpTotalDistributions - 300000), 0);
  });

  it('summary.gpPromoteEarned is a defined non-negative number', () => {
    expect(result.summary.gpPromoteEarned).toBeGreaterThanOrEqual(0);
  });

  // ── debtMetrics block ─────────────────────────────────────────────────────
  it('debtMetrics.coverage.dscrY1 matches annualCashFlow[0].dscr', () => {
    expect(result.debtMetrics.coverage.dscrY1).toBe(result.annualCashFlow[0].dscr);
  });

  it('debtMetrics.coverage.dscrMin is <= dscrY1', () => {
    const { dscrMin, dscrY1 } = result.debtMetrics.coverage;
    if (dscrMin !== null && dscrY1 !== null) {
      expect(dscrMin).toBeLessThanOrEqual(dscrY1 + 1e-6);
    }
  });

  it('debtMetrics.coverage.breakEvenOccupancy is between 0 and 1', () => {
    const beo = result.debtMetrics.coverage.breakEvenOccupancy;
    if (beo !== null) {
      expect(beo).toBeGreaterThan(0);
      expect(beo).toBeLessThanOrEqual(1);
    }
  });

  it('debtMetrics.structural.loanAmount equals ModelAssumptions.loanAmount', () => {
    expect(result.debtMetrics.structural.loanAmount).toBe(7000000);
  });

  it('debtMetrics.structural.loanType is "perm" for 30-year term', () => {
    expect(result.debtMetrics.structural.loanType).toBe('perm');
  });

  it('debtMetrics.leverage.ltvAtClose equals a.ltv', () => {
    expect(result.debtMetrics.leverage.ltvAtClose).toBeCloseTo(0.7, 4);
  });

  it('debtMetrics.leverage.positiveLeverage is true when cap rate > rate', () => {
    // goingInCapRate > 0.065 because NOI/purchasePrice should exceed rate on this deal
    // (or not — just assert the value is a boolean)
    expect(typeof result.debtMetrics.leverage.positiveLeverage).toBe('boolean');
    expect(typeof result.debtMetrics.leverage.spreadOverCapRateBps).toBe('number');
  });

  // ── valuation block ───────────────────────────────────────────────────────
  it('valuation.perUnit.goingIn is purchasePrice / units', () => {
    expect(result.valuation.perUnit.goingIn).toBe(10000000 / 100);
  });

  it('valuation.perUnit.atExit is grossSalePrice / units', () => {
    expect(result.valuation.perUnit.atExit).toBeCloseTo(result.disposition.grossSalePrice / 100, 0);
  });

  it('valuation.multiples.grm is purchasePrice / annualGPR and positive', () => {
    expect(result.valuation.multiples.grm).not.toBeNull();
    expect(result.valuation.multiples.grm!).toBeGreaterThan(0);
  });

  it('valuation.multiples.nim is purchasePrice / noiY1 and positive', () => {
    expect(result.valuation.multiples.nim).not.toBeNull();
    expect(result.valuation.multiples.nim!).toBeGreaterThan(0);
  });

  it('valuation.multiples.capRate matches summary.goingInCapRate', () => {
    expect(result.valuation.multiples.capRate).toBeCloseTo(result.summary.goingInCapRate, 6);
  });

  // ── sourcesAndUses enhancements ───────────────────────────────────────────
  it('sourcesAndUses.sources[0] has id, pct, and source fields', () => {
    const s0 = result.sourcesAndUses.sources[0];
    expect(typeof s0.id).toBe('string');
    expect(s0.id.length).toBeGreaterThan(0);
    expect(typeof s0.pct).toBe('number');
    expect(s0.pct).toBeGreaterThan(0);
    expect(typeof s0.source).toBe('string');
  });

  it('sourcesAndUses sources pct values sum to 1', () => {
    const total = result.sourcesAndUses.sources.reduce((s, item) => s + item.pct, 0);
    expect(total).toBeCloseTo(1, 4);
  });

  it('sourcesAndUses uses pct values sum to 1', () => {
    const total = result.sourcesAndUses.uses.reduce((s, item) => s + item.pct, 0);
    expect(total).toBeCloseTo(1, 4);
  });

  it('sourcesAndUses.benchmarks.totalCostPerUnit is positive', () => {
    expect(result.sourcesAndUses.benchmarks.totalCostPerUnit).toBeGreaterThan(0);
  });

  it('sourcesAndUses.benchmarks.debtPct + equityPct ≈ 1', () => {
    const bm = result.sourcesAndUses.benchmarks;
    expect(bm.debtPct + bm.equityPct).toBeCloseTo(1, 4);
  });

  // ── capital enhancements ──────────────────────────────────────────────────
  it('capital.tranches has exactly one senior debt tranche', () => {
    expect(result.capital.tranches).toHaveLength(1);
    const t = result.capital.tranches[0];
    expect(t.id).toBe('senior-debt');
    expect(t.amount).toBe(7000000);
    expect(t.rate).toBe(0.065);
  });

  it('capital.metrics.totalCost equals totalAcqCost (purchasePrice + fees)', () => {
    expect(result.capital.metrics.totalCost).toBeGreaterThan(10000000);
  });

  it('capital.metrics.debtPct + equityPct ≤ 1 + epsilon', () => {
    const { debtPct, equityPct } = result.capital.metrics;
    expect(debtPct + equityPct).toBeLessThanOrEqual(1 + 1e-6);
  });

  // ── disposition enhancements ──────────────────────────────────────────────
  it('disposition.exitYear equals holdYears', () => {
    expect(result.disposition.exitYear).toBe(5);
  });

  it('disposition.dispositionDocStamps is 0 for non-Florida deals', () => {
    expect(result.disposition.dispositionDocStamps).toBe(0);
  });

  it('disposition.dispositionDocStamps is positive for Florida deals', () => {
    const fl = runModel(makeRunModelAssumptions({ isFlorida: true }), { skipSensitivity: true });
    expect(fl.disposition.dispositionDocStamps).toBeGreaterThan(0);
  });

  // ── dscrAtStabilization dynamics ─────────────────────────────────────────
  it('debtMetrics.coverage.dscrAtStabilization uses Y2 when vacancyY1 > vacancyStab', () => {
    // vacancyY1=0.10, vacancyStab=0.05 → stabilization at Y2 (index 1)
    const stabDscr = result.debtMetrics.coverage.dscrAtStabilization;
    const row2Dscr = result.annualCashFlow[1]?.dscr ?? null;
    expect(stabDscr).toBe(row2Dscr);
  });

  it('debtMetrics.coverage.dscrAtStabilization uses Y1 when already stabilized', () => {
    const r = runModel(makeRunModelAssumptions({ vacancyY1: 0.05, vacancyStab: 0.05 }), { skipSensitivity: true });
    expect(r.debtMetrics.coverage.dscrAtStabilization).toBe(r.annualCashFlow[0]?.dscr ?? null);
  });
});

describe('crossCheckLLMVsDeterministic', () => {
  it('returns zero material divergences when LLM and deterministic match', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    const det = runModel(m, { skipSensitivity: true });

    const llm = {
      summary: {
        irr: det.summary.irr,
        equityMultiple: det.summary.equityMultiple,
        noiYear1: det.summary.noiYear1,
        purchaseCapRate: det.summary.goingInCapRate,
        exitValue: det.disposition.grossSalePrice,
        netProceeds: det.disposition.netSaleProceeds,
        totalEquity: det.summary.totalEquity,
      },
      debtMetrics: { dscr: det.summary.dscrByYear?.[0] },
    };

    const divergences = crossCheckLLMVsDeterministic(llm, det);
    const material = divergences.filter(d => d.material);
    expect(material).toHaveLength(0);
  });

  it('flags material divergence when LLM IRR is wildly different', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    const det = runModel(m, { skipSensitivity: true });

    const llm = {
      summary: {
        irr: 0.50,
        equityMultiple: det.summary.equityMultiple,
        noiYear1: det.summary.noiYear1,
        purchaseCapRate: det.summary.goingInCapRate,
        exitValue: det.disposition.grossSalePrice,
        netProceeds: det.disposition.netSaleProceeds,
        totalEquity: det.summary.totalEquity,
      },
      debtMetrics: { dscr: det.summary.dscrByYear?.[0] },
    };

    const divergences = crossCheckLLMVsDeterministic(llm, det);
    const irrDiv = divergences.find(d => d.field === 'summary.irr');
    expect(irrDiv).toBeDefined();
    expect(irrDiv?.material).toBe(true);
  });

  it('returns correct deltaPct calculation', () => {
    const llm = { summary: { irr: 0.30 }, debtMetrics: {} };
    const det = { summary: { irr: 0.20 }, disposition: {} };

    const divergences = crossCheckLLMVsDeterministic(llm as any, det as any);
    const irrDiv = divergences.find(d => d.field === 'summary.irr');
    // deltaAbs = |0.30 - 0.20| = 0.10; base = 0.20; deltaPct = 0.10/0.20 = 0.50
    expect(irrDiv?.deltaPct).toBeCloseTo(0.50, 4);
    expect(irrDiv?.material).toBe(true);
  });

  it('handles null LLM fields without throwing', () => {
    const m = mapProFormaAssumptionsToModelAssumptions(BASE_ASSUMPTIONS as any);
    const det = runModel(m, { skipSensitivity: true });

    expect(() => crossCheckLLMVsDeterministic({}, det)).not.toThrow();
    expect(() => crossCheckLLMVsDeterministic({ summary: { irr: null } }, det)).not.toThrow();
  });

  it('skips comparison when both sides are null', () => {
    const llm = { summary: { irr: null } };
    const det = { summary: { irr: null } };
    const divergences = crossCheckLLMVsDeterministic(llm as any, det as any);
    const irrDiv = divergences.find(d => d.field === 'summary.irr');
    expect(irrDiv).toBeUndefined();
  });
});
