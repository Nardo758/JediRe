/**
 * Highlands golden fixture — placeholder.
 *
 * TODO (W4/W5): Populate `expected` with verified-correct outputs from the
 * unified deterministic engine after live acceptance. Highlands is the
 * universal regression canary — its values must not drift.
 */

import type { GoldenFixture } from './golden.types';

export const highlandsFixture: GoldenFixture = {
  dealId: 'eaabeb9f',
  dealName: 'Highlands',
  // Placeholder assumptions — portfolio asset, no acquisition date.
  // Replace with actual Highlands assumption set after extraction review.
  assumptions: {
    units: 196,
    avgUnitSf: 920,
    marketRent: 1600,
    inPlaceRent: 1550,
    purchasePrice: 28000000,
    closingCostsPct: 0.015,
    isFlorida: false,
    docStampsPct: 0,
    intangibleTaxPct: 0,
    titleInsurancePct: 0,
    capexBudget: 300000,
    rentGrowth: [0.025, 0.025, 0.025, 0.025, 0.025],
    lossToLease: 0.02,
    vacancyY1: 0.05,
    vacancyStab: 0.05,
    concessions: 0.005,
    badDebt: 0.005,
    otherIncomePerUnit: 250,
    expenseGrowth: 0.025,
    payrollPerUnit: 1000,
    maintenancePerUnit: 500,
    contractServicesPerUnit: 350,
    marketingPerUnit: 150,
    utilitiesPerUnit: 450,
    adminPerUnit: 250,
    insurancePerUnit: 400,
    managementFee: 0.04,
    replacementReserves: 200,
    loanAmount: 19600000,
    ltv: 0.7,
    term: 300,
    amort: 300,
    ioPeriod: 0,
    rate: 0.05,
    originationFeePct: 0.01,
    prepayPenalty: 0,
    exitCap: 0.06,
    saleCosts: 0.02,
    holdYears: 5,
    lpEquity: 7840000,
    gpEquity: 560000,
    preferredReturn: 0.08,
    promoteTiers: [0.08, 0.12, 0.15],
    promoteSplits: [0.2, 0.3, 0.5],
    dealType: 'existing',
  },
  expected: null, // PIN AFTER W4/W5 — see D2b dispatch W3
};
