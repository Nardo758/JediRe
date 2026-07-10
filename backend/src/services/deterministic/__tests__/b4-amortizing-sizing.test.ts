/**
 * B4: R1 — Amortizing sizing test
 *
 * Proves:
 * 1. IO sizing vs amortizing sizing produce different loan amounts
 * 2. Amortizing sizing produces a smaller loan (when IO < 12 months)
 * 3. DSCR of sized loan is exactly at the floor (1.25) with true amortizing debt service
 * 4. Full-year IO produces same loan as IO proxy (no regression)
 * 5. Bishop new epoch: loan moves from ~$39M to ~$32.5M
 */

import {
  computeYear1DebtService,
  computeDscrWithAmortizing,
  computeMaxLoanByDscr,
} from '../deterministic-model-runner';
import { getRecommendedTerms } from '../../module-wiring/capital-structure-adapter';

describe('B4: R1 — Amortizing sizing', () => {
  const BISHOP_NOI = 2_925_000;
  const BISHOP_RATE = 0.06;
  const BISHOP_PURCHASE_PRICE = 52_000_000;
  const BISHOP_LTV = 0.75;
  const BISHOP_MAX_BY_LTV = 39_000_000; // 75% of $52M
  const BISHOP_TERM = 360;
  const BISHOP_AMORT = 360;
  const BISHOP_IO = 0; // no IO

  // ─────────────────────────────────────────────
  // 1. IO proxy vs amortizing sizing produce different loans
  // ─────────────────────────────────────────────
  test('IO proxy sizing differs from amortizing sizing (no IO)', () => {
    const dscrFloor = 1.25;
    const ioProxyLoan = Math.round(BISHOP_NOI / (dscrFloor * BISHOP_RATE));
    const amortizingLoan = computeMaxLoanByDscr(
      BISHOP_NOI, dscrFloor, BISHOP_RATE, BISHOP_TERM, BISHOP_AMORT, BISHOP_IO, BISHOP_MAX_BY_LTV
    );
    expect(amortizingLoan).not.toBe(ioProxyLoan);
    expect(amortizingLoan).toBeLessThan(ioProxyLoan);
  });

  // ─────────────────────────────────────────────
  // 2. Amortizing sizing produces smaller loan
  // ─────────────────────────────────────────────
  test('amortizing sizing produces smaller loan than IO proxy', () => {
    const dscrFloor = 1.25;
    const ioProxyLoan = Math.round(BISHOP_NOI / (dscrFloor * BISHOP_RATE));
    const amortizingLoan = computeMaxLoanByDscr(
      BISHOP_NOI, dscrFloor, BISHOP_RATE, BISHOP_TERM, BISHOP_AMORT, BISHOP_IO, BISHOP_MAX_BY_LTV
    );
    expect(amortizingLoan).toBeLessThan(ioProxyLoan);
    const dscrAtIoProxy = computeDscrWithAmortizing(
      BISHOP_NOI, ioProxyLoan, BISHOP_RATE, BISHOP_TERM, BISHOP_AMORT, BISHOP_IO
    );
    expect(dscrAtIoProxy).toBeLessThan(dscrFloor);
  });

  // ─────────────────────────────────────────────
  // 3. DSCR at sized loan is exactly at floor
  // ─────────────────────────────────────────────
  test('DSCR of sized loan is at floor (within tolerance)', () => {
    const dscrFloor = 1.25;
    const loan = computeMaxLoanByDscr(
      BISHOP_NOI, dscrFloor, BISHOP_RATE, BISHOP_TERM, BISHOP_AMORT, BISHOP_IO, BISHOP_MAX_BY_LTV
    );
    const dscr = computeDscrWithAmortizing(
      BISHOP_NOI, loan, BISHOP_RATE, BISHOP_TERM, BISHOP_AMORT, BISHOP_IO
    );
    expect(dscr).toBeGreaterThanOrEqual(dscrFloor - 0.01);
    expect(dscr).toBeLessThanOrEqual(dscrFloor + 0.01);
  });

  // ─────────────────────────────────────────────
  // 4. IO period covering full year 1 = no change from IO proxy
  // ─────────────────────────────────────────────
  test('full-year IO produces same loan as IO proxy', () => {
    const dscrFloor = 1.25;
    const ioProxyLoan = Math.round(BISHOP_NOI / (dscrFloor * BISHOP_RATE));
    const amortizingLoanWithIO = computeMaxLoanByDscr(
      BISHOP_NOI, dscrFloor, BISHOP_RATE, BISHOP_TERM, BISHOP_AMORT, 12, BISHOP_MAX_BY_LTV
    );
    expect(amortizingLoanWithIO).toBe(ioProxyLoan);
  });

  // ─────────────────────────────────────────────
  // 5. Partial IO (6 months) produces intermediate loan
  // ─────────────────────────────────────────────
  test('partial IO produces loan between IO proxy and full amortizing', () => {
    const dscrFloor = 1.25;
    const ioProxyLoan = Math.round(BISHOP_NOI / (dscrFloor * BISHOP_RATE));
    const fullAmortizingLoan = computeMaxLoanByDscr(
      BISHOP_NOI, dscrFloor, BISHOP_RATE, BISHOP_TERM, BISHOP_AMORT, 0, BISHOP_MAX_BY_LTV
    );
    const partialIoLoan = computeMaxLoanByDscr(
      BISHOP_NOI, dscrFloor, BISHOP_RATE, BISHOP_TERM, BISHOP_AMORT, 6, BISHOP_MAX_BY_LTV
    );
    expect(partialIoLoan).toBeLessThan(ioProxyLoan);
    expect(partialIoLoan).toBeGreaterThan(fullAmortizingLoan);
  });

  // ─────────────────────────────────────────────
  // 6. getRecommendedTerms integration
  // ─────────────────────────────────────────────
  test('getRecommendedTerms returns amortizing-sized loan', () => {
    const result = getRecommendedTerms({
      noiY1: BISHOP_NOI,
      purchasePrice: BISHOP_PURCHASE_PRICE,
      ltv: BISHOP_LTV,
      rate: BISHOP_RATE,
      termMonths: BISHOP_TERM,
      amortMonths: BISHOP_AMORT,
      ioPeriodMonths: BISHOP_IO,
    });
    const ioProxyLoan = Math.round(BISHOP_NOI / (1.25 * BISHOP_RATE));
    expect(result.recommendedLoanAmount).toBeLessThan(ioProxyLoan);
    expect(result.recommendedLoanAmount).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────
  // 7. Bishop new epoch values
  // ─────────────────────────────────────────────
  test('Bishop new epoch — loan reduced from IO proxy', () => {
    const ioProxyLoan = 39_000_000; // old epoch: noi / (1.25 * 0.06) = 2,925,000 / 0.075 = 39,000,000

    const result = getRecommendedTerms({
      noiY1: BISHOP_NOI,
      purchasePrice: BISHOP_PURCHASE_PRICE,
      ltv: BISHOP_LTV,
      rate: BISHOP_RATE,
      termMonths: BISHOP_TERM,
      amortMonths: BISHOP_AMORT,
      ioPeriodMonths: BISHOP_IO,
    });

    console.log('=== BISHOP NEW EPOCH ===');
    console.log('Before (IO proxy): $' + ioProxyLoan.toLocaleString());
    console.log('After (amortizing): $' + result.recommendedLoanAmount.toLocaleString());
    console.log('Delta: -$' + (ioProxyLoan - result.recommendedLoanAmount).toLocaleString());
    console.log('Cause: B4 amortizing sizing — true P+I debt service > IO proxy');

    expect(result.recommendedLoanAmount).toBeLessThan(ioProxyLoan);
    expect(result.recommendedLoanAmount).toBeGreaterThan(30_000_000); // sanity: still a large loan
    // Expected: ~2,524,364 for Bishop with 30yr term, 30yr amort, no IO
    expect(result.recommendedLoanAmount).toBeCloseTo(32_524_364, -3); // within ,000
  });
});
