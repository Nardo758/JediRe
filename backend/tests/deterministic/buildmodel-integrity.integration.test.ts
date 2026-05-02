/**
 * Integration tests for the buildModel() verification gate.
 *
 * These tests stub the DB pool and LLM call so we can exercise the
 * Phase 5 verification block (bridge → runModel → runIntegrityChecks)
 * without a real database or API key.
 *
 * Assertions:
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
  financing: { loanAmount: 13500000, loanType: 'fixed' as const, interestRate: 0.065, spread: 0, term: 5, amortization: 30, ioPeriod: 0, originationFee: 0.01, rateCapCost: 0, prepayPenalty: 0 },
  capex: { lineItems: [], contingencyPct: 0.10, reservesPerUnit: 300 },
  waterfall: { lpShare: 0.90, gpShare: 0.10, hurdles: [{ hurdleRate: 0.08, promoteToGP: 0.20, lpSplit: 0.80 }], equityContribution: 4500000 },
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
  let callLLMSpy: MockInstance;

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
    callLLMSpy = vi.spyOn(service as any, 'callLLMForModel');
    (engineModule as any)._testService = service;
  });

  it('persists status=complete on a structurally valid deal', async () => {
    const service = (engineModule as any)._testService as InstanceType<typeof engineModule.FinancialModelEngineService>;
    callLLMSpy.mockResolvedValue(makeLLMResult());

    await service.buildModel('deal-valid', BASE_ASSUMPTIONS as any);

    const completeCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*complete/i.test(c.sql));
    expect(completeCall).toBeDefined();

    const errorCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*error/i.test(c.sql));
    expect(errorCall).toBeUndefined();
  });

  it('writes status=error and halts when loanAmount > purchasePrice (INV-8)', async () => {
    const overAssumptions = {
      ...BASE_ASSUMPTIONS,
      financing: { ...BASE_ASSUMPTIONS.financing, loanAmount: 20000000 },
    };

    const service = (engineModule as any)._testService as InstanceType<typeof engineModule.FinancialModelEngineService>;
    callLLMSpy.mockResolvedValue(makeLLMResult());

    await expect(service.buildModel('deal-inv8', overAssumptions as any)).rejects.toThrow(/F9 integrity checks failed/);

    const errorCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*error/i.test(c.sql));
    expect(errorCall).toBeDefined();
    const diagnostics = String(errorCall?.params?.[0] ?? '');
    expect(diagnostics).toContain('INV-8');

    const completeCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*complete/i.test(c.sql));
    expect(completeCall).toBeUndefined();
  });

  it('writes status=error when equity is zero (INV-7)', async () => {
    const noEquityAssumptions = {
      ...BASE_ASSUMPTIONS,
      waterfall: { ...BASE_ASSUMPTIONS.waterfall, equityContribution: 0 },
      financing: { ...BASE_ASSUMPTIONS.financing, loanAmount: 18000000 },
    };

    const service = (engineModule as any)._testService as InstanceType<typeof engineModule.FinancialModelEngineService>;
    callLLMSpy.mockResolvedValue(makeLLMResult());

    await expect(service.buildModel('deal-inv7', noEquityAssumptions as any)).rejects.toThrow(/F9 integrity checks failed/);

    const errorCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*error/i.test(c.sql));
    expect(errorCall).toBeDefined();

    const completeCall = poolSpy.calls.find(c => /UPDATE deal_financial_models.*status.*complete/i.test(c.sql));
    expect(completeCall).toBeUndefined();
  });
});
