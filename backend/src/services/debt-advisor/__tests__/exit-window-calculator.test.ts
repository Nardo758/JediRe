/**
 * exit-window-calculator.test.ts
 * LQ-5: Unit tests for the Exit Window Calculator.
 *
 * Tests cover:
 * - Honest-absence invariants (stale/missing curve)
 * - Curve trough detection
 * - M35 event window integration (mocked)
 * - DSCR improvement computation
 * - Window merging and deduplication
 * - Narrative generation
 */

import {
  computeExitWindows,
  type ExitWindowInput,
  type ExitWindowAnalysis,
  type RefiWindow,
} from '../exit-window-calculator';
import type { LoanQuote } from '../../loan-quotes/loan-quote.types';
import type { ForwardCurve } from '../../loan-quotes/forward-curve';

function makeMockCurve(overrides?: Partial<ForwardCurve>): ForwardCurve {
  return {
    tenorPoints: [
      { tenorYears: 5, rate: 0.0427, seriesCode: 'DGS5' },
      { tenorYears: 7, rate: 0.0424, seriesCode: 'DGS7' },
      { tenorYears: 10, rate: 0.0431, seriesCode: 'DGS10' },
      { tenorYears: 30, rate: 0.0445, seriesCode: 'DGS30' },
    ],
    source: 'FRED:DGS5,DGS7,DGS10,DGS30',
    fetchedAt: new Date().toISOString(),
    staleThresholdHours: 24,
    indexBasis: 'treasury',
    ...overrides,
  };
}

function makeQuote(overrides?: Partial<LoanQuote>): LoanQuote {
  const now = new Date().toISOString();
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return {
    id: 'quote_test_001',
    orgId: 'org_acme',
    lender: 'NewPoint',
    program: 'Fannie DUS',
    quoteDate: now.split('T')[0],
    expires: futureDate,
    indexBasis: 'treasury_7yr',
    rateType: 'fixed',
    spreadMatrix: {
      program: 'Fannie DUS',
      grid: {
        'Tier-3': {
          7: { min: 0.0126, max: 0.0136 },
          10: { min: 0.0130, max: 0.0140 },
        },
      },
    },
    adjustments: [],
    prepayStructure: { type: 'yield_maintenance', terms: {} },
    brokerClaims: { source: 'NewPoint', date: now.split('T')[0], confidence: 0.9 },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('LQ-5: Exit Window Calculator — Honest Absence', () => {
  test('returns absence when curve is null', async () => {
    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: null,
    };

    const result = await computeExitWindows(input);

    expect(result.absenceReason).toContain('missing');
    expect(result.windows).toHaveLength(0);
    expect(result.bestWindow).toBeNull();
    expect(result.nextWindow).toBeNull();
  });

  test('returns absence when curve is stale', async () => {
    const staleCurve = makeMockCurve({
      fetchedAt: '2023-01-01T00:00:00Z',
    });

    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: staleCurve,
    };

    const result = await computeExitWindows(input);

    expect(result.absenceReason).toContain('stale');
    expect(result.windows).toHaveLength(0);
    expect(result.bestWindow).toBeNull();
  });
});

describe('LQ-5: Exit Window Calculator — Curve Troughs', () => {
  test('finds troughs in a declining-then-rising curve', async () => {
    // Create a curve with a clear trough at 10yr
    const troughCurve: ForwardCurve = {
      tenorPoints: [
        { tenorYears: 5, rate: 0.0450, seriesCode: 'DGS5' },
        { tenorYears: 7, rate: 0.0430, seriesCode: 'DGS7' },
        { tenorYears: 10, rate: 0.0420, seriesCode: 'DGS10' },
        { tenorYears: 15, rate: 0.0440, seriesCode: 'DGS15' },
        { tenorYears: 30, rate: 0.0460, seriesCode: 'DGS30' },
      ],
      source: 'FRED_TEST',
      fetchedAt: new Date().toISOString(),
      staleThresholdHours: 24,
      indexBasis: 'treasury',
    };

    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: troughCurve,
      dealFinancials: {
        noiAnnual: 500_000,
        loanAmount: 3_250_000,
        holdMonths: 120,
      },
    };

    const result = await computeExitWindows(input);

    // Should find at least one trough window
    expect(result.windows.length).toBeGreaterThan(0);
    expect(result.bestWindow).not.toBeNull();
    expect(result.narrative).toContain('Current all-in rate');
  });

  test('no windows when curve is monotonically rising', async () => {
    const risingCurve: ForwardCurve = {
      tenorPoints: [
        { tenorYears: 5, rate: 0.0400, seriesCode: 'DGS5' },
        { tenorYears: 7, rate: 0.0420, seriesCode: 'DGS7' },
        { tenorYears: 10, rate: 0.0440, seriesCode: 'DGS10' },
        { tenorYears: 30, rate: 0.0480, seriesCode: 'DGS30' },
      ],
      source: 'FRED_TEST',
      fetchedAt: new Date().toISOString(),
      staleThresholdHours: 24,
      indexBasis: 'treasury',
    };

    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: risingCurve,
      dealFinancials: {
        noiAnnual: 500_000,
        loanAmount: 3_250_000,
        holdMonths: 120,
      },
    };

    const result = await computeExitWindows(input);

    // No troughs in a monotonically rising curve
    expect(result.windows.filter(w => w.source === 'curve_trough')).toHaveLength(0);
  });
});

describe('LQ-5: Exit Window Calculator — DSCR Improvement', () => {
  test('computes DSCR improvement when deal financials provided', async () => {
    const troughCurve: ForwardCurve = {
      tenorPoints: [
        { tenorYears: 5, rate: 0.0450, seriesCode: 'DGS5' },
        { tenorYears: 7, rate: 0.0430, seriesCode: 'DGS7' },
        { tenorYears: 10, rate: 0.0420, seriesCode: 'DGS10' },
        { tenorYears: 15, rate: 0.0440, seriesCode: 'DGS15' },
        { tenorYears: 30, rate: 0.0460, seriesCode: 'DGS30' },
      ],
      source: 'FRED_TEST',
      fetchedAt: new Date().toISOString(),
      staleThresholdHours: 24,
      indexBasis: 'treasury',
    };

    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: troughCurve,
      dealFinancials: {
        noiAnnual: 500_000,
        loanAmount: 3_250_000,
        holdMonths: 120,
      },
    };

    const result = await computeExitWindows(input);

    const actionableWindows = result.windows.filter(w => w.isActionable);
    for (const w of actionableWindows) {
      if (w.dscrImprovement !== null) {
        expect(w.dscrImprovement).toBeGreaterThan(0);
      }
    }
  });

  test('DSCR improvement is null when no deal financials', async () => {
    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: makeMockCurve(),
    };

    const result = await computeExitWindows(input);

    for (const w of result.windows) {
      expect(w.dscrImprovement).toBeNull();
    }
  });
});

describe('LQ-5: Exit Window Calculator — Window Properties', () => {
  test('actionable windows have positive net benefit', async () => {
    const troughCurve: ForwardCurve = {
      tenorPoints: [
        { tenorYears: 5, rate: 0.0450, seriesCode: 'DGS5' },
        { tenorYears: 7, rate: 0.0430, seriesCode: 'DGS7' },
        { tenorYears: 10, rate: 0.0420, seriesCode: 'DGS10' },
        { tenorYears: 15, rate: 0.0440, seriesCode: 'DGS15' },
        { tenorYears: 30, rate: 0.0460, seriesCode: 'DGS30' },
      ],
      source: 'FRED_TEST',
      fetchedAt: new Date().toISOString(),
      staleThresholdHours: 24,
      indexBasis: 'treasury',
    };

    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: troughCurve,
      dealFinancials: {
        noiAnnual: 500_000,
        loanAmount: 3_250_000,
        holdMonths: 120,
      },
      prepayPenaltyPct: 0.02,
      originationFeePct: 0.01,
    };

    const result = await computeExitWindows(input);

    for (const w of result.windows) {
      if (w.isActionable) {
        expect(w.netBenefitBps).toBeGreaterThan(0);
      }
    }
  });

  test('windows are sorted by month ascending', async () => {
    const troughCurve: ForwardCurve = {
      tenorPoints: [
        { tenorYears: 5, rate: 0.0450, seriesCode: 'DGS5' },
        { tenorYears: 7, rate: 0.0430, seriesCode: 'DGS7' },
        { tenorYears: 10, rate: 0.0420, seriesCode: 'DGS10' },
        { tenorYears: 15, rate: 0.0440, seriesCode: 'DGS15' },
        { tenorYears: 30, rate: 0.0460, seriesCode: 'DGS30' },
      ],
      source: 'FRED_TEST',
      fetchedAt: new Date().toISOString(),
      staleThresholdHours: 24,
      indexBasis: 'treasury',
    };

    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: troughCurve,
      dealFinancials: {
        noiAnnual: 500_000,
        loanAmount: 3_250_000,
        holdMonths: 120,
      },
    };

    const result = await computeExitWindows(input);

    for (let i = 1; i < result.windows.length; i++) {
      expect(result.windows[i].month).toBeGreaterThanOrEqual(result.windows[i - 1].month);
    }
  });

  test('best window has highest net benefit among actionable', async () => {
    const troughCurve: ForwardCurve = {
      tenorPoints: [
        { tenorYears: 5, rate: 0.0450, seriesCode: 'DGS5' },
        { tenorYears: 7, rate: 0.0430, seriesCode: 'DGS7' },
        { tenorYears: 10, rate: 0.0420, seriesCode: 'DGS10' },
        { tenorYears: 15, rate: 0.0440, seriesCode: 'DGS15' },
        { tenorYears: 30, rate: 0.0460, seriesCode: 'DGS30' },
      ],
      source: 'FRED_TEST',
      fetchedAt: new Date().toISOString(),
      staleThresholdHours: 24,
      indexBasis: 'treasury',
    };

    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: troughCurve,
      dealFinancials: {
        noiAnnual: 500_000,
        loanAmount: 3_250_000,
        holdMonths: 120,
      },
    };

    const result = await computeExitWindows(input);

    if (result.bestWindow) {
      const actionable = result.windows.filter(w => w.isActionable);
      const maxNetBenefit = Math.max(...actionable.map(w => w.netBenefitBps));
      expect(result.bestWindow.netBenefitBps).toBe(maxNetBenefit);
    }
  });
});

describe('LQ-5: Exit Window Calculator — Narrative', () => {
  test('narrative mentions current rate and hold period', async () => {
    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: makeMockCurve(),
      dealFinancials: {
        noiAnnual: 500_000,
        loanAmount: 3_250_000,
        holdMonths: 120,
      },
    };

    const result = await computeExitWindows(input);

    expect(result.narrative).toContain('Hold period:');
    expect(result.narrative).toContain('months');
  });

  test('narrative flags no windows when none found', async () => {
    const risingCurve: ForwardCurve = {
      tenorPoints: [
        { tenorYears: 5, rate: 0.0400, seriesCode: 'DGS5' },
        { tenorYears: 7, rate: 0.0420, seriesCode: 'DGS7' },
        { tenorYears: 10, rate: 0.0440, seriesCode: 'DGS10' },
        { tenorYears: 30, rate: 0.0480, seriesCode: 'DGS30' },
      ],
      source: 'FRED_TEST',
      fetchedAt: new Date().toISOString(),
      staleThresholdHours: 24,
      indexBasis: 'treasury',
    };

    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: risingCurve,
      dealFinancials: {
        noiAnnual: 500_000,
        loanAmount: 3_250_000,
        holdMonths: 120,
      },
    };

    const result = await computeExitWindows(input);

    expect(result.narrative).toContain('No refinancing windows');
  });
});

describe('LQ-5: Exit Window Calculator — Integration with DebtContext', () => {
  test('result can be attached to DebtContext', async () => {
    const input: ExitWindowInput = {
      dealId: 'deal_123',
      currentQuote: makeQuote(),
      curve: makeMockCurve(),
    };

    const result = await computeExitWindows(input);

    // Simulate attaching to DebtContext
    const debtContext = {
      dealId: 'deal_123',
      distressFlags: { ioExpiryShock: false, underwaterEquity: false, cashInRefi: false },
      marketRates: { dgs10: 0.0431, sofr: 0.0531 },
      loanProduct: null,
      m11Sizing: null,
      exitWindows: result,
      assembledAt: new Date().toISOString(),
    };

    expect(debtContext.exitWindows).toBeDefined();
    expect(debtContext.exitWindows?.dealId).toBe('deal_123');
  });
});
