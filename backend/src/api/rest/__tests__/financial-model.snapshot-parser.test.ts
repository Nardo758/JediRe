import { describe, it, expect } from 'vitest';
import { parseSummaryMetrics, computeAnnualDebtService } from '../financial-model.snapshot-parser';

describe('parseSummaryMetrics', () => {
  describe('IRR', () => {
    it('parses "Projected 5-yr IRR 18.1%"', () => {
      const r = parseSummaryMetrics(
        'Stabilized GPR $4.93M, EGI $4.69M. Projected 5-yr IRR 18.1% at 5.5% exit cap.',
      );
      expect(r.irr).toBeCloseTo(0.181, 5);
    });

    it('parses "5-yr IRR estimated at -7.5%"', () => {
      const r = parseSummaryMetrics(
        'stabilized NOI projected ~$2.0M. 5-yr IRR estimated at -7.5% reflecting heavy lease-up drag.',
      );
      expect(r.irr).toBeCloseTo(-0.075, 5);
    });

    it('parses "5 year IRR of 14.3%"', () => {
      const r = parseSummaryMetrics('5 year IRR of 14.3% on a 7-year hold.');
      expect(r.irr).toBeCloseTo(0.143, 5);
    });

    it('returns undefined when IRR is not mentioned', () => {
      const r = parseSummaryMetrics(
        'Deal shows negative T12 NOI (-$495K). Negative cash flow through Year 5.',
      );
      expect(r.irr).toBeUndefined();
    });

    it('does not produce false positive from "IRR implications" text', () => {
      const r = parseSummaryMetrics('High IRR implications — market risk is elevated.');
      expect(r.irr).toBeUndefined();
    });
  });

  describe('NOI', () => {
    it('parses "$1.5M NOI" (dollar-first pattern)', () => {
      const r = parseSummaryMetrics(
        'Stabilized proforma projects ~$1.5M NOI at 5% vacancy.',
      );
      expect(r.noi).toBeCloseTo(1_500_000, 0);
    });

    it('parses "NOI projected ~$2.0M" (NOI-first pattern)', () => {
      const r = parseSummaryMetrics('stabilized NOI projected ~$2.0M at 93% occupancy.');
      expect(r.noi).toBeCloseTo(2_000_000, 0);
    });

    it('parses comma-separated dollar amounts "$1,500,000 NOI"', () => {
      const r = parseSummaryMetrics('Stabilized ~$1,500,000 NOI at 5% vacancy.');
      expect(r.noi).toBeCloseTo(1_500_000, 0);
    });

    it('does not match "$1.99M total opex" as NOI', () => {
      const r = parseSummaryMetrics(
        'Stabilized pro forma assumes 95% occupancy. $1.99M total opex.',
      );
      expect(r.noi).toBeUndefined();
    });

    it('returns undefined when no NOI figure is mentioned', () => {
      const r = parseSummaryMetrics('Deal shows negative cash flow. No stabilized projections.');
      expect(r.noi).toBeUndefined();
    });
  });

  describe('cash-on-cash', () => {
    it('parses "cash-on-cash 8.2%"', () => {
      const r = parseSummaryMetrics('Projected cash-on-cash 8.2% in Year 3.');
      expect(r.cashOnCash).toBeCloseTo(0.082, 5);
    });

    it('parses "cash on cash: 8.2%"', () => {
      const r = parseSummaryMetrics('Year 1 cash on cash: 8.2%.');
      expect(r.cashOnCash).toBeCloseTo(0.082, 5);
    });

    it('parses "CoC 8.2%"', () => {
      const r = parseSummaryMetrics('Expected CoC 8.2% once stabilized.');
      expect(r.cashOnCash).toBeCloseTo(0.082, 5);
    });

    it('returns undefined when not mentioned', () => {
      const r = parseSummaryMetrics('Deal projects $1.5M NOI. No CoC data.');
      expect(r.cashOnCash).toBeUndefined();
    });
  });

  describe('purchase price', () => {
    it('parses "on $50M purchase price"', () => {
      const r = parseSummaryMetrics('yielding 3.0% on $50M purchase price at current NOI.');
      expect(r.purchasePrice).toBeCloseTo(50_000_000, 0);
    });

    it('parses "$50M assumed basis"', () => {
      const r = parseSummaryMetrics('Exit at 5.5% cap yields ~$33.3M, well below $50M assumed basis.');
      expect(r.purchasePrice).toBeCloseTo(50_000_000, 0);
    });

    it('parses comma-separated "$50,000,000 purchase price"', () => {
      const r = parseSummaryMetrics('on $50,000,000 purchase price.');
      expect(r.purchasePrice).toBeCloseTo(50_000_000, 0);
    });

    it('returns undefined when not mentioned', () => {
      const r = parseSummaryMetrics('Purchase price unknown — debt sizing is estimate.');
      expect(r.purchasePrice).toBeUndefined();
    });
  });

  describe('empty / null input', () => {
    it('returns all undefined for empty string', () => {
      const r = parseSummaryMetrics('');
      expect(r.irr).toBeUndefined();
      expect(r.noi).toBeUndefined();
      expect(r.cashOnCash).toBeUndefined();
      expect(r.purchasePrice).toBeUndefined();
    });
  });
});

describe('computeAnnualDebtService', () => {
  const LOAN = 32_500_000;
  const RATE_DECIMAL = 0.0605;
  const RATE_PERCENT = 6.05;
  const AMORT = 30;

  it('computes ADS from decimal interest rate', () => {
    const ads = computeAnnualDebtService(LOAN, RATE_DECIMAL, AMORT);
    expect(ads).toBeCloseTo(2_350_799, -2);
  });

  it('normalizes percent-format interest rate (> 1) identically', () => {
    const adsDecimal = computeAnnualDebtService(LOAN, RATE_DECIMAL, AMORT)!;
    const adsPercent = computeAnnualDebtService(LOAN, RATE_PERCENT, AMORT)!;
    expect(adsPercent).toBeCloseTo(adsDecimal, 1);
  });

  it('defaults to 30-year amortization when not provided', () => {
    const ads30 = computeAnnualDebtService(LOAN, RATE_DECIMAL, 30)!;
    const adsDefault = computeAnnualDebtService(LOAN, RATE_DECIMAL, undefined)!;
    expect(adsDefault).toBeCloseTo(ads30, 1);
  });

  it('handles zero interest rate (interest-only case)', () => {
    const ads = computeAnnualDebtService(1_200_000, 0, 30)!;
    expect(ads).toBeCloseTo(40_000, -1);
  });

  it('returns undefined when loanAmount is missing', () => {
    expect(computeAnnualDebtService(undefined, RATE_DECIMAL, AMORT)).toBeUndefined();
  });

  it('returns undefined when interestRate is missing', () => {
    expect(computeAnnualDebtService(LOAN, undefined, AMORT)).toBeUndefined();
  });
});
