import { describe, it, expect } from 'vitest';
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
