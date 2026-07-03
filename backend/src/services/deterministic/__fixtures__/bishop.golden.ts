/**
 * Bishop golden fixture — placeholder.
 *
 * TODO (W4/W5): Populate `expected` with verified-correct outputs from the
 * unified deterministic engine after live acceptance. Do NOT pin current
 * unproven values — the Excel-parity step (operator workbook as oracle)
 * closes the pin.
 */

import type { GoldenFixture } from './golden.types';

export const bishopFixture: GoldenFixture = {
  dealId: '3f32276f',
  dealName: 'Bishop',
  // Placeholder assumptions — reasonable defaults for a mid-market MF deal.
  // Replace with actual Bishop assumption set after extraction review.
  assumptions: {
    units: 232,
    avgUnitSf: 850,
    marketRent: 1850,
    inPlaceRent: 1750,
    purchasePrice: 50000000,
    closingCostsPct: 0.02,
    isFlorida: false,
    docStampsPct: 0,
    intangibleTaxPct: 0,
    titleInsurancePct: 0,
    capexBudget: 500000,
    rentGrowth: [0.03, 0.03, 0.03, 0.03, 0.03],
    lossToLease: 0.03,
    vacancyY1: 0.07,
    vacancyStab: 0.07,
    concessions: 0.01,
    badDebt: 0.01,
    otherIncomePerUnit: 300,
    expenseGrowth: 0.03,
    payrollPerUnit: 1200,
    maintenancePerUnit: 600,
    contractServicesPerUnit: 400,
    marketingPerUnit: 200,
    utilitiesPerUnit: 500,
    adminPerUnit: 300,
    insurancePerUnit: 450,
    managementFee: 0.05,
    replacementReserves: 250,
    loanAmount: 35000000,
    ltv: 0.7,
    term: 360,
    amort: 360,
    ioPeriod: 0,
    rate: 0.055,
    originationFeePct: 0.01,
    prepayPenalty: 0,
    exitCap: 0.065,
    saleCosts: 0.02,
    holdYears: 5,
    lpEquity: 14000000,
    gpEquity: 1000000,
    preferredReturn: 0.08,
    promoteTiers: [0.08, 0.12, 0.15],
    promoteSplits: [0.2, 0.3, 0.5],
    dealType: 'existing',
  },
  expected: null, // PIN AFTER W4/W5 — see D2b dispatch W3
};
