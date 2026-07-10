/**
 * B3 Proof Test: Loan-product ruleset override verification
 *
 * Demonstrates that:
 * 1. Default path (no override) resolves to agency 5/30 product
 * 2. Override path (term=84, amort=300, ioPeriod=120) respects user/agent values
 * 3. Debt service schedule changes materially between the two
 */

import { describe, it, expect } from 'vitest';
import { runFullModel } from '../run-full-model';
import type { ModelAssumptions } from '../deterministic-model-runner';
import { resolveLoanProduct } from '../../debt-advisor/rulesets/loan-product.ruleset';

// Base assumptions — a midsize multifamily deal
// LTV = 0.60 so ioPeriod derives to 0 (LTV ≤ 0.65 → no IO)
const baseAssumptions: ModelAssumptions = {
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
  loanAmount: 9_000_000, // 60% LTV
  ltv: 0.60,
  term: 60,    // 5 years — default agency product
  amort: 360,  // 30 years
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
  promoteTiers: [0.08, 0.12, 0.15],
  promoteSplits: [0.20, 0.30, 0.50],
  dealType: 'existing',
  dealMode: 'existing',
  occupancyAtClose: 1.0,
  standardTurnDowntimeDays: 14,
  annualTurnoverRate: 0.50,
  newLeaseConcessionMonths: 1,
};

describe('B3 — R2: M11 accepts terms + loan-product ruleset', () => {
  it('default path resolves to agency 5/30 (identity)', () => {
    const result = runFullModel(baseAssumptions, { skipSensitivity: true });

    // Identity: defaults resolve to 5/30
    expect(result.adjustedAssumptions.term).toBe(60);
    expect(result.adjustedAssumptions.amort).toBe(360);
    // LTV = 0.60 ≤ 0.65 → ioPeriod = 0 by LTV-tier derivation
    expect(result.adjustedAssumptions.ioPeriod).toBe(0);

    // Loan amount should be sized by DSCR + LTV constraint
    expect(result.adjustedAssumptions.loanAmount).toBeGreaterThan(0);
    expect(result.result.summary.loanAmount).toBeGreaterThan(0);
  });

  it('override path respects user/agent term/amort/ioPeriod (7/25/10)', () => {
    const overrideAssumptions: ModelAssumptions = {
      ...baseAssumptions,
      term: 84,      // 7 years
      amort: 300,    // 25 years
      ioPeriod: 120, // 10 years IO
    };

    const result = runFullModel(overrideAssumptions, { skipSensitivity: true });

    // Override should be respected
    expect(result.adjustedAssumptions.term).toBe(84);
    expect(result.adjustedAssumptions.amort).toBe(300);
    expect(result.adjustedAssumptions.ioPeriod).toBe(120);
  });

  it('debt service schedule materially changes with override', () => {
    const defaultResult = runFullModel(baseAssumptions, { skipSensitivity: true });
    const overrideAssumptions: ModelAssumptions = {
      ...baseAssumptions,
      term: 84,
      amort: 300,
      ioPeriod: 120,
    };
    const overrideResult = runFullModel(overrideAssumptions, { skipSensitivity: true });

    // During IO period (10 years = 120 months), principal should be 0
    // Years 1-5 are all within the 10-year IO period
    const overrideCapital = overrideResult.result.capital;
    const overridePrincipal = overrideCapital.amortizationSchedule.map(r => r.principal);
    expect(overridePrincipal[0]).toBe(0); // Y1: all interest during IO
    expect(overridePrincipal[1]).toBe(0); // Y2: all interest during IO
    expect(overridePrincipal[2]).toBe(0); // Y3: all interest during IO
    expect(overridePrincipal[3]).toBe(0); // Y4: all interest during IO
    expect(overridePrincipal[4]).toBe(0); // Y5: all interest during IO

    // Default has no IO, so principal should be positive from Y1
    const defaultCapital = defaultResult.result.capital;
    const defaultPrincipal = defaultCapital.amortizationSchedule.map(r => r.principal);
    expect(defaultPrincipal[0]).toBeGreaterThan(0);

    // Balloon timing differs: default at year 5, override at year 7
    expect(defaultCapital.amortizationSchedule[4].endingBalance).toBe(0);
    expect(overrideCapital.amortizationSchedule[4].endingBalance).toBeGreaterThan(0);
  });

  it('balloon timing matches term (5-year vs 7-year)', () => {
    const defaultResult = runFullModel(baseAssumptions, { skipSensitivity: true });
    const overrideAssumptions: ModelAssumptions = {
      ...baseAssumptions,
      term: 84,
      amort: 300,
      ioPeriod: 120,
    };
    const overrideResult = runFullModel(overrideAssumptions, { skipSensitivity: true });

    const defaultSchedule = defaultResult.result.capital.amortizationSchedule;
    const overrideSchedule = overrideResult.result.capital.amortizationSchedule;

    // Default (5-year): balloon at year 5, balance goes to 0
    expect(defaultSchedule[4].endingBalance).toBe(0); // Year 5

    // Override (7-year): balloon at year 7, balance still positive at year 5
    expect(overrideSchedule[4].endingBalance).toBeGreaterThan(0); // Year 5
  });

  it('provenance: loan-product ruleset has descriptive strings', () => {
    const product = resolveLoanProduct({ lenderType: 'agency' });

    expect(product.provenance).toContain('Fannie');
    expect(product.provenance).toContain('5-year');
    expect(product.provenance).toContain('30-year');
    expect(product.termYears).toBe(5);
    expect(product.amortYears).toBe(30);
  });
});
