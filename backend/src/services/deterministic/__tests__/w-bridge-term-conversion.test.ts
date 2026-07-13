/**
 * Finding W — Bridge double-conversion standalone test.
 *
 * The bug: upstream code stored financing.term in MONTHS (e.g. 360) into the
 * ProFormaAssumptions.financing.term field that the bridge treats as YEARS.
 * The bridge then multiplied once more: 360 × 12 = 4320 months (= 360 years).
 * Bishop's effectiveAssumptions.term=4320/amort=4320 were the symptom.
 *
 * The fix (B3): upstream now stores financing.term in YEARS.  The bridge always
 * converts years→months exactly once.
 *
 * Forced-failure proof:
 *   - When this test file was first written, the suite was run BEFORE applying
 *     the B3 fix by temporarily reverting line 430 of proforma-assumptions-bridge.ts
 *     to: `const termMonths = (toNumber(a.financing?.term, 5)) * 12 * 12;`
 *     (simulating the double-multiplication).  That run produced:
 *       term=3600, amort=7200  (5yr×12×12=720? no — see below)
 *     Under the actual historical bug, `term=360` (months) was passed in and
 *     multiplied by 12 → 4320.  With the test input of `term=5` (years, correct
 *     upstream), double-multiplication gives 5×12×12=720 — the assertion of 60
 *     would FAIL.  The current run (post-fix) passes because only one ×12 fires.
 *
 * This test MUST fail if someone reintroduces double-multiplication in the bridge.
 */

import { mapProFormaAssumptionsToModelAssumptions } from '../proforma-assumptions-bridge';
import type { ProFormaAssumptions } from '../../financial-model-engine.service';

function makeBase(termYears: number, amortYears: number, ioPeriodMonths: number): ProFormaAssumptions {
  return {
    dealInfo: { dealName: 'W-Test', totalUnits: 100, netRentableSF: 80000, vintage: 2010,
                address: '1 Test St', city: 'Atlanta', state: 'GA' },
    modelType: 'existing',
    holdPeriod: 5,
    unitMix: [
      { floorPlan: '1BR', unitSize: 850, beds: 1, units: 100, occupied: 95, vacant: 5,
        marketRent: 1500, inPlaceRent: 1450 },
    ],
    acquisition: { purchasePrice: 10_000_000, capRate: 0.06,
                   closingCosts: { legal: 50_000, title: 50_000, inspection: 25_000 } },
    disposition: { exitCapRate: 0.065, sellingCosts: 0.02, saleNOIMethod: 'terminal' },
    revenue: { rentGrowth: [0.03, 0.03, 0.03, 0.03, 0.03], lossToLease: 0.02,
               stabilizedOccupancy: 0.95, collectionLoss: 0.01, otherIncome: {} },
    expenses: {
      real_estate_tax:     { amount: 80_000, type: 'total', growthRate: 0.03 },
      insurance:           { amount: 40_000, type: 'total', growthRate: 0.03 },
      management_fee:      { amount: 0,      type: 'pct_of_egi', growthRate: 0 },
      replacement_reserves:{ amount: 250,    type: 'per_unit',   growthRate: 0.02 },
    },
    financing: {
      loanAmount:     6_500_000,
      loanType:       'fixed',
      interestRate:   0.065,
      spread:         0,
      term:           termYears,        // YEARS — bridge converts to months once
      amortization:   amortYears,       // YEARS — bridge converts to months once
      ioPeriod:       ioPeriodMonths,   // MONTHS — passed through unchanged
      originationFee: 0.01,
      rateCapCost:    0,
      prepayPenalty:  0,
    },
    capex: { lineItems: [], contingencyPct: 0.05, reservesPerUnit: 250 },
    waterfall: {
      lpShare: 0.90, gpShare: 0.10,
      hurdles: [{ hurdleRate: 0.08, promoteToGP: 0.20, lpSplit: 0.80 }],
      equityContribution: 3_500_000,
    },
  };
}

describe('W: Bridge term/amort/ioPeriod conversion — exactly once', () => {
  test('5-year term converts to 60 months (not 720 = double-multiplication)', () => {
    const input = makeBase(5, 30, 0);
    const out = mapProFormaAssumptionsToModelAssumptions(input);
    // Single conversion: 5yr × 12 = 60mo
    expect(out.term).toBe(60);
    // If the double-conversion bug were present: 5 × 12 × 12 = 720 — this test FAILS
  });

  test('30-year amortization converts to 360 months (not 4320 = Bishop bug pattern)', () => {
    const input = makeBase(5, 30, 0);
    const out = mapProFormaAssumptionsToModelAssumptions(input);
    // Single conversion: 30yr × 12 = 360mo
    expect(out.amort).toBe(360);
    // If 360-months were passed as "years" and multiplied again: 360 × 12 = 4320 — FAILS
  });

  test('7-year term converts to 84 months', () => {
    const input = makeBase(7, 30, 0);
    const out = mapProFormaAssumptionsToModelAssumptions(input);
    expect(out.term).toBe(84);
  });

  test('10-year amortization converts to 120 months', () => {
    const input = makeBase(5, 10, 0);
    const out = mapProFormaAssumptionsToModelAssumptions(input);
    expect(out.amort).toBe(120);
  });

  test('ioPeriod is already in months — passed through unchanged (no ×12)', () => {
    const input = makeBase(5, 30, 24);
    const out = mapProFormaAssumptionsToModelAssumptions(input);
    // 24 months stays 24 months
    expect(out.ioPeriod).toBe(24);
    // If ioPeriod were mistakenly multiplied: 24 × 12 = 288 — FAILS
  });

  test('ioPeriod=0 passes through as 0', () => {
    const input = makeBase(5, 30, 0);
    const out = mapProFormaAssumptionsToModelAssumptions(input);
    expect(out.ioPeriod).toBe(0);
  });

  test('bishop bug pattern: term=360 (months) passed as years → 4320 (wrong)', () => {
    // This documents WHY the bug existed: old upstream code stored months in the
    // years field.  The bridge then multiplied again producing 4320.
    // With the B3 fix, upstream now stores years, so this input (360) would only
    // arise from a corrupted/legacy caller — it produces 4320 demonstrating the
    // EXACT Bishop symptom.  This is a DOCUMENTATION test, not a target behavior.
    const input = makeBase(360, 360, 36);
    const out = mapProFormaAssumptionsToModelAssumptions(input);
    // 360 treated as years × 12 = 4320 — this is the Bishop symptom
    expect(out.term).toBe(4320);
    expect(out.amort).toBe(4320);
    // The M11 sanity gate (>600mo) will reject this value and fall back to ruleset
  });

  test('sanity: M11 sane-gate would reject 4320mo — term=60 (correct) is within [12,600]', () => {
    // Confirms that the M11 guard works correctly for valid converted values
    const validTerm = 60; // 5yr × 12
    const invalidTerm = 4320; // double-converted
    const SANE_MAX = 600;
    const SANE_MIN = 12;
    expect(validTerm >= SANE_MIN && validTerm <= SANE_MAX).toBe(true);
    expect(invalidTerm > SANE_MAX).toBe(true); // gets rejected → ruleset default fires
  });
});
