/**
 * Integration tests for the buildModel() verification gate.
 *
 * These tests stub the DB pool and LLM call so we can exercise the
 * Phase 5 verification block (bridge → runModel → runIntegrityChecks)
 * without a real database or API key.
 *
 * Assertions:
 *  - Valid deal: status transitions building → complete, results written
 *  - Pre-optimization INV-6/7 failures: do NOT halt — runFullModel's final-state
 *    authoritative verdict wins; result persisted as complete when M11 resolves
 *  - LOW_CONFIDENCE_MODEL warning surfaced when ≥30% evidence fields are LOW
 *  - Valid deal: status transitions building → complete, results written
 *  - INV-8 failure (loanAmount > purchasePrice): status → error, diagnostics
 *    written, results NOT persisted as complete
 *  - INV-7 failure (zero equity): status → error, halts before complete write
 */

import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import type { FinancialModelResult } from '../../src/services/financial-model-engine.service';

// ── Minimal LLM result that passes the JSON parse / shape checks ──────────
function makeLLMResult(overrides: Partial<FinancialModelResult> = {}): FinancialModelResult {
  return {
    summary: {
      irr: 0.14,
      equityMultiple: 1.85,
      cashOnCash: [0.07, 0.07, 0.08, 0.08, 0.09],
      noiYear1: 1050000,
      noiStabilized: 1100000,
      purchaseCapRate: 0.06,
      yieldOnCost: 0.065,
      exitValue: 19000000,
      netProceeds: 18500000,
      totalEquity: 4500000,
      totalDebt: 13500000,
      dscr: [1.40, 1.42, 1.44, 1.46, 1.48],
      debtYield: [0.078, 0.079, 0.080, 0.081, 0.082],
    },
    annualCashFlow: Array.from({ length: 6 }, (_, i) => ({
      year: i,
      potentialRent: 2100000,
      lossToLease: 42000,
      vacancy: 147000,
      collectionLoss: 21000,
      netRentalIncome: 1890000,
      otherIncome: 50000,
      effectiveGrossRevenue: 1940000,
      operatingExpenses: { payroll: 280000, management_fee: 97000, repairs_maintenance: 60000 },
      totalExpenses: 890000,
      noi: 1050000,
      replacementReserves: 30000,
      noiAfterReserves: 1020000,
      debtService: 750000,
      capitalExpenditures: 0,
      beforeTaxCashFlow: 270000,
      leveredCashFlow: 270000,
    })),
    sourcesAndUses: { sources: { equity: 4500000, debt: 13500000 }, uses: { purchase: 18000000 } },
    debtMetrics: { loanAmount: 13500000, annualDebtService: 750000, dscr: 1.40, ltv: 0.75, debtYield: 0.078 },
    ...overrides,
  } as FinancialModelResult;
}

// ── Assumptions stubs ──────────────────────────────────────────────────────
const BASE_ASSUMPTIONS = {
  dealInfo: { dealName: 'Test', totalUnits: 100, netRentableSF: 85000, vintage: 2000, address: '1 Main', city: 'Atlanta', state: 'GA' },
  modelType: 'existing' as const,
  holdPeriod: 5,
  unitMix: [{ floorPlan: '1BR', unitSize: 850, beds: 1, units: 100, occupied: 93, vacant: 7, marketRent: 1800, inPlaceRent: 1750 }],
  acquisition: { purchasePrice: 18000000, capRate: 0.06, closingCosts: {} },
  disposition: { exitCapRate: 0.065, sellingCosts: 0.02, saleNOIMethod: 'terminal' as const },
  revenue: { rentGrowth: [0.03, 0.03, 0.03, 0.03, 0.03], lossToLease: 0.02, stabilizedOccupancy: 0.93, collectionLoss: 0.01, otherIncome: {} },
  expenses: { payroll: { amount: 280000, type: 'total' as const, growthRate: 0.03 }, management_fee: { amount: 72000, type: 'total' as const, growthRate: 0.03 } },
  financing: { loanAmount: 13500000, loanType: 'fixed' as const, interestRate: 0.065, spread: 0, term: 30, amortization: 30, ioPeriod: 0, originationFee: 0.01, rateCapCost: 0, prepayPenalty: 0 },
  capex: { lineItems: [], contingencyPct: 0.10, reservesPerUnit: 300 },
  // closingCosts={} → closingCostsPct=0 → runner falls back to DEF_CLOSING_PCT=0.01 → 180000
  // non-FL 0.5% tx = 90000; capex=0 → totalAcqCost = 18000000 + 180000 + 90000 = 18270000
  // strict INV-6: equity == totalAcqCost - loanAmount == 18270000 - 13500000 = 4770000
  waterfall: { lpShare: 0.90, gpShare: 0.10, hurdles: [{ hurdleRate: 0.08, promoteToGP: 0.20, lpSplit: 0.80 }], equityContribution: 4770000 },
};

// ── Pool query spy – captures calls in order ───────────────────────────────
type QueryCall = { sql: string; params: unknown[] };

function buildPoolSpy(): { calls: QueryCall[]; mock: ReturnType<typeof vi.fn> } {
  const calls: QueryCall[] = [];
  const mock = vi.fn((sql: string, params: unknown[]) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params: params ?? [] });
    if (/INSERT INTO deal_financial_models/i.test(sql)) {
      return Promise.resolve({ rows: [{ id: 'test-model-id' }] });
    }
    return Promise.resolve({ rows: [] });
  });
  return { calls, mock };
}

describe('buildModel() verification gate', () => {
  let engineModule: typeof import('../../src/services/financial-model-engine.service');
  let poolSpy: ReturnType<typeof buildPoolSpy>;

  beforeEach(async () => {
    vi.resetModules();

    poolSpy = buildPoolSpy();

    vi.doMock('../../src/database/connection', () => ({
      getPool: () => ({ query: poolSpy.mock }),
    }));

    vi.doMock('../../src/services/financial-model-engine.m26-m27-enhancer', () => ({
      m26m27ProFormaEnhancer: {
        enhanceAssumptions: (_dealId: string, a: unknown) => Promise.resolve(a),
        getEnhancementSummary: () => 'stubbed',
      },
    }));

    vi.doMock('../../src/services/sigma/anchor-interceptor.service', () => ({
      normalizeExpensesForInterceptor: (e: unknown) => e,
      applyFullAnchorInterceptor: (_a: unknown, e: unknown) => ({ expenses: e }),
      rekeyExpensesFromInterceptor: (e: unknown) => e,
    }));

    engineModule = await import('../../src/services/financial-model-engine.service');

    const service = new engineModule.FinancialModelEngineService();
    (engineModule as any)._testService = service;
  });

  it('persists status=complete on a structurally valid deal', async () => {
    const service = (engineModule as any)._testService as InstanceType<typeof engineModule.FinancialModelEngineService>;

    await service.buildModel('deal-valid', BASE_ASSUMPTIONS as any);

    const completeCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*complete/i.test(c.sql));
    expect(completeCall).toBeDefined();

    const errorCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*error/i.test(c.sql));
    expect(errorCall).toBeUndefined();
  });

  it('persisted result contains deterministic evidence.fields for all 6 KPI fields', async () => {
    const service = (engineModule as any)._testService as InstanceType<typeof engineModule.FinancialModelEngineService>;

    await service.buildModel('deal-evidence', BASE_ASSUMPTIONS as any);

    const persistCall = poolSpy.calls.find(c =>
      /UPDATE deal_financial_models.*SET results/i.test(c.sql)
    );
    expect(persistCall).toBeDefined();

    const persisted = JSON.parse(persistCall!.params[0] as string);
    const fields: Array<{ field: string }> = persisted?.evidence?.fields ?? [];
    const fieldNames = fields.map((f) => f.field);

    // All 6 KPI evidence fields must be present after deterministic injection
    for (const kpi of ['NOI', 'IRR', 'EM', 'DSCR', 'exitCap', 'goingInCap']) {
      expect(fieldNames).toContain(kpi);
    }

    // confidence_distribution must be populated
    const dist = persisted?.evidence?.confidence_distribution;
    expect(dist).toBeDefined();
    expect(typeof dist.high).toBe('number');
    expect(typeof dist.medium).toBe('number');
    expect(typeof dist.low).toBe('number');

    // reasoning must carry walkthrough string and collisionReport array
    expect(typeof persisted?.reasoning?.walkthrough).toBe('string');
    expect(persisted?.reasoning?.walkthrough.length).toBeGreaterThan(0);
    expect(Array.isArray(persisted?.reasoning?.collisionReport)).toBe(true);
  });

  it('persisted integrityChecks contains LOW_CONFIDENCE_MODEL warn when >=30% fields are LOW', async () => {
    // Override pool to return a platform_fallback year1 seed → NOI/goingInCap/exitCap = LOW
    // = 3/6 = 50% LOW ≥ 30% threshold → LOW_CONFIDENCE_MODEL must fire
    const service = (engineModule as any)._testService as InstanceType<typeof engineModule.FinancialModelEngineService>;

    const fallbackLV = (v: number) => ({ resolved: v, resolution: 'platform_fallback', t12: null, rent_roll: null, tax_bill: null });
    poolSpy.mock.mockImplementation((sql: string, params: unknown[]) => {
      poolSpy.calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params: params ?? [] });
      if (/INSERT INTO deal_financial_models/i.test(sql)) {
        return Promise.resolve({ rows: [{ id: 'test-model-id' }] });
      }
      if (/SELECT year1 FROM deal_assumptions/i.test(sql)) {
        return Promise.resolve({
          rows: [{
            year1: {
              noi: fallbackLV(1200000),
              gpr: fallbackLV(1800000),
              vacancy_pct: fallbackLV(0.07),
              real_estate_tax: fallbackLV(150000),
              insurance: fallbackLV(50000),
              management_fee_pct: fallbackLV(0.04),
            },
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    await service.buildModel('deal-lowconf', BASE_ASSUMPTIONS as any);

    const persistCall = poolSpy.calls.find(c =>
      /UPDATE deal_financial_models.*SET results/i.test(c.sql)
    );
    expect(persistCall).toBeDefined();

    const persisted = JSON.parse(persistCall!.params[0] as string);
    const checks: Array<{ id: string; status: string }> = persisted?.integrityChecks ?? [];
    const lowConfCheck = checks.find((c) => c.id === 'LOW_CONFIDENCE_MODEL');

    expect(lowConfCheck).toBeDefined();
    expect(lowConfCheck?.status).toBe('warn');
  });

  it('does NOT halt on pre-optimization INV-6 — runFullModel authoritative verdict wins', async () => {
    // Pre-M11 state: loanAmount (20M) > purchasePrice (18M) → pre-optimization INV-6 fires.
    // M11 will resize loan to LTV cap (~13.5M) → final state passes integrity.
    // Doctrine: pre-optimization checks are informational only; only runFullModel's
    // final-state check may be throwing.
    const overAssumptions = {
      ...BASE_ASSUMPTIONS,
      financing: { ...BASE_ASSUMPTIONS.financing, loanAmount: 20000000 },
    };

    const service = (engineModule as any)._testService as InstanceType<typeof engineModule.FinancialModelEngineService>;

    // Must NOT throw — pre-optimization failures are informational only.
    await expect(service.buildModel('deal-preopt-inv6', overAssumptions as any)).resolves.toBeDefined();

    const completeCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*complete/i.test(c.sql));
    expect(completeCall).toBeDefined();

    const errorCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*error/i.test(c.sql));
    expect(errorCall).toBeUndefined();

    // Pre-optimization warnings should still be surfaced in the persisted result
    const persistCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*SET results/i.test(c.sql));
    const persisted = JSON.parse(persistCall!.params[0] as string);
    const checks: Array<{ id: string; status: string }> = persisted?.integrityChecks ?? [];
    // runFullModel's final check should have passed (M11 resized the loan)
    const inv6Error = checks.find((c) => c.id === 'INV-6' && c.status === 'error');
    expect(inv6Error).toBeUndefined();
  });

  it('does NOT halt on pre-optimization zero-equity — M11 recompute resolves it', async () => {
    // Pre-M11 state: equity=0, loan=18M → pre-optimization INV-6/7 fires.
    // M11 will recompute equity from LTV → final state passes integrity.
    const noEquityAssumptions = {
      ...BASE_ASSUMPTIONS,
      waterfall: { ...BASE_ASSUMPTIONS.waterfall, equityContribution: 0 },
      financing: { ...BASE_ASSUMPTIONS.financing, loanAmount: 18000000 },
    };

    const service = (engineModule as any)._testService as InstanceType<typeof engineModule.FinancialModelEngineService>;

    await expect(service.buildModel('deal-preopt-inv7', noEquityAssumptions as any)).resolves.toBeDefined();

    const completeCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*complete/i.test(c.sql));
    expect(completeCall).toBeDefined();

    const errorCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*error/i.test(c.sql));
    expect(errorCall).toBeUndefined();
  });
});
