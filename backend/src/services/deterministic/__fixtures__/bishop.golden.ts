/**
 * Bishop golden fixture — build path.
 *
 * Re-captured 2026-07-13 via f5-bishop-capture.ts (HEAD c111753e4) using the
 * same buildModel() route as the HTTP build endpoint (F-P1-A store-sourced contract).
 * This is the post-debt-arc state: B1–B6 all active (amortizing sizing, >= 0 zero-IO
 * fix, monthsToStabilize wired).
 *
 * effectiveAssumptions = pre-M11 modelAssumptions at the runFullModel boundary.
 *   loanAmount: $39,000,000  (raw 65% LTV; M11 DSCR-sizes to $33,076,993)
 *   term/amort: 4320  (Finding W: bridge treats stored months as years — known)
 *   ioPeriod: 36  (3yr IO; M11 constraint: user_override)
 *
 * DETERMINISM PIN — not oracle-validated.
 *   These values were produced by running runFullModel(effectiveAssumptions) and
 *   recording the output. The test verifies that the model still produces the same
 *   numbers on a future run — it does NOT verify that those numbers are correct.
 *   External-oracle validation (Excel parity, analyst sign-off) is the eventual
 *   correctness check. That is why F5-2 (fixture capture from the live build path)
 *   matters for this desk: the captured input contract must be right before the
 *   determinism pin is meaningful.
 *
 *   Per-field provenance (result accessor → pinned value):
 *     noiYear1       → result.summary.noiYear1
 *     egiYear1       → result.annualCashFlow[0].effectiveGrossIncome
 *     irr            → result.summary.irr
 *     equityMultiple → result.summary.equityMultiple
 *     dscrY1         → result.summary.dscrByYear[0]
 *     cashOnCashY1   → result.summary.cashOnCashByYear[0]
 *     goingInCapRate → result.summary.goingInCapRate
 *     exitCapRate    → result.summary.exitCapRate   (input passthrough; 0.05)
 *     yieldOnCost    → result.summary.yieldOnCost   (number branch; .trended fallback unused)
 *     totalEquity    → result.summary.totalEquity   (M11-adjusted: purchasePrice − DSCR-sized loan)
 *     totalDebt      → result.summary.loanAmount    (M11 DSCR-sized: $33,076,993)
 *     netProceeds    → result.disposition.netSaleProceeds
 *
 * IRR = −4.3%, EM = 0.81: reflects zero rent growth (Y1–Y5) + 19.83% vacancy +
 *   4.2% going-in cap on a $60M purchase. Model output, not a model error.
 */

import type { BuildPathFixture } from './golden.types';

export const bishopFixture: BuildPathFixture = {
  dealId: '3f32276f',
  dealIdFull: '3f32276f-aacd-4da3-b306-317c5109b403',
  dealName: 'Bishop',
  fixtureClass: 'build_path',

  rawAssumptions: {
    dealInfo: {
      dealName: '464 Bishop',
      totalUnits: 232,
      netRentableSF: 196196,
      vintage: 2014,
      address: '464 Bishop Street Northwest',
      city: 'Atlanta',
      state: 'GA',
    },
    modelType: 'existing',
    holdPeriod: 5,
    unitMix: [
      { floorPlan: '1BR', unitSize: 850, beds: 1, units: 116, occupied: 110, vacant: 6, marketRent: 1650, inPlaceRent: 1600 },
      { floorPlan: '2BR', unitSize: 1100, beds: 2, units: 92, occupied: 88, vacant: 4, marketRent: 2100, inPlaceRent: 2050 },
      { floorPlan: '3BR', unitSize: 1350, beds: 3, units: 24, occupied: 22, vacant: 2, marketRent: 2600, inPlaceRent: 2550 },
    ],
    acquisition: {
      purchasePrice: 60_000_000,
      capRate: 0.05,
      closingCosts: { legal: 100000, title: 150000, inspection: 50000 },
    },
    disposition: {
      exitCapRate: 0.055,
      sellingCosts: 0.02,
      saleNOIMethod: 'terminal',
    },
    revenue: {
      rentGrowth: [0.025, 0.025, 0.025, 0.025, 0.025],
      lossToLease: 0.03,
      stabilizedOccupancy: 0.95,
      collectionLoss: 0.015,
      otherIncome: {
        pet_rent: { perUnitMonth: 25, penetration: 0.30 },
        parking: { perUnitMonth: 75, penetration: 0.85 },
      },
    },
    expenses: {
      real_estate_tax: { amount: 420000, type: 'total', growthRate: 0.03 },
      insurance: { amount: 180000, type: 'total', growthRate: 0.03 },
      utilities: { amount: 280000, type: 'total', growthRate: 0.025 },
      repairs_maintenance: { amount: 320000, type: 'total', growthRate: 0.025 },
      payroll: { amount: 580000, type: 'total', growthRate: 0.03 },
      contract_services: { amount: 140000, type: 'total', growthRate: 0.025 },
      marketing: { amount: 90000, type: 'total', growthRate: 0.02 },
      g_and_a: { amount: 120000, type: 'total', growthRate: 0.025 },
      management_fee: { amount: 0, type: 'pct_of_egi', growthRate: 0 },
      replacement_reserves: { amount: 300, type: 'per_unit', growthRate: 0.025 },
    },
    financing: {
      loanAmount: 39_000_000,
      loanType: 'fixed',
      interestRate: 0.065,
      spread: 0,
      term: 30,
      amortization: 30,
      ioPeriod: 24,
      originationFee: 0.01,
      rateCapCost: 0,
      prepayPenalty: 0,
    },
    capex: {
      lineItems: [{ description: 'Unit Turnover', amount: 400000 }],
      contingencyPct: 0.10,
      reservesPerUnit: 300,
    },
    waterfall: {
      lpShare: 0.90,
      gpShare: 0.10,
      hurdles: [
        { hurdleRate: 0.08, promoteToGP: 0.20, lpSplit: 0.80 },
        { hurdleRate: 0.12, promoteToGP: 0.30, lpSplit: 0.70 },
        { hurdleRate: 0.15, promoteToGP: 0.50, lpSplit: 0.50 },
      ],
      equityContribution: 21_390_000,
    },
  },

  // DETERMINISM PIN — 2026-07-13. Source: f5-bishop-pin-expected.ts → runFullModel(effectiveAssumptions).
  // All 12 fields payload-traced from result accessors listed in the header. None estimated.
  expected: {
    noiYear1:       2531954.2507873233,   // result.summary.noiYear1
    egiYear1:       3484162.3692498137,   // result.annualCashFlow[0].effectiveGrossIncome
    irr:            -0.04264430564621519, // result.summary.irr
    equityMultiple: 0.8128695967056253,   // result.summary.equityMultiple
    dscrY1:         1.2757882046025784,   // result.summary.dscrByYear[0]
    cashOnCashY1:   0.020039341358032203, // result.summary.cashOnCashByYear[0]
    goingInCapRate: 0.04219923751312205,  // result.summary.goingInCapRate
    exitCapRate:    0.05,                 // result.summary.exitCapRate  (input passthrough)
    yieldOnCost:    0.043934804738431865, // result.summary.yieldOnCost  (number branch)
    totalEquity:    27313007,             // result.summary.totalEquity  (M11-adjusted)
    totalDebt:      33076993,             // result.summary.loanAmount   (M11 DSCR-sized from $39M)
    netProceeds:    52003168.01981644,    // result.disposition.netSaleProceeds
  },

  provenance: {
    captureDate: '2026-07-13T03:34:42Z',
    source: 'live_build',
    buildEndpoint: 'buildModel() via f5-bishop-capture.ts (mirrors POST /build F-P1-A path)',
    inputSnapshot: 'store-sourced-deal_assumptions-3f32276f-HEAD-c111753e4',
    bodySource: 'deal_financial_models.assumptions + deal_assumptions.year1 B1/B2 overlay',
    originClass: 'on_platform_underwrite',
    pathBoundRule: true,
  },

  // effectiveAssumptions: pre-M11 modelAssumptions captured at runFullModel boundary.
  // Confirmed identical to fresh 2026-07-13 capture (f5-bishop-capture.ts):
  //   loanAmount=$39M  term=4320  amort=4320  ioPeriod=36  rate=6%
  // Finding W (known): term/amort=4320 = bridge reading stored months as years.
  // Finding X ruled (b): M11 normalises to 60/360 as intended platform defaults.

  effectiveAssumptions: {
    units: 232,
    avgUnitSf: 800,
    marketRent: 1500,
    inPlaceRent: 1400,
    purchasePrice: 60000000,
    closingCostsPct: 0.0015,
    isFlorida: false,
    docStampsPct: 0,
    intangibleTaxPct: 0,
    titleInsurancePct: 0,
    capexBudget: 0,
    rentGrowth: [0, 0, 0, 0, 0, 0.03],
    lossToLease: 0.03,
    vacancyY1: 19.83,
    vacancyStab: 19.83,
    concessions: 0,
    badDebt: 0.015,
    otherIncomePerUnit: 0,
    expenseGrowth: 0.031,
    payrollPerUnit: 0,
    maintenancePerUnit: 0,
    contractServicesPerUnit: 0,
    marketingPerUnit: 0,
    utilitiesPerUnit: 0,
    adminPerUnit: 0,
    insurancePerUnit: 0,
    managementFee: 0.05,
    replacementReserves: 250,

    loanAmount: 39000000,
    ltv: 0.65,
    term: 4320,
    amort: 4320,
    ioPeriod: 36,

    rate: 0.06,
    originationFeePct: 1,
    prepayPenalty: 0,
    exitCap: 0.05,
    saleCosts: 0.02,
    holdYears: 5,

    lpEquity: 20790000,
    gpEquity: 210000,

    preferredReturn: 0.08,
    promoteTiers: [0.08, 0.12, 0.15],
    promoteSplits: [0.2, 0.3, 0.5],
    dealType: 'existing',
    dealMode: 'lease_up',
    standardTurnDowntimeDays: 14,
    newLeaseConcessionMonths: 1,
    annualTurnoverRate: 0.5,
    occupancyAtClose: 0.9310344827586207,
    underwritingVacancyFloor: 0.05,
    _meta: { opexKeyRuleVersion: '2026-07-04a' },
    _unmatchedOpexKeys: ['payroll', 'repairs_maintenance', 'contract_services', 'marketing', 'utilities', 'g_and_a', 'insurance'],
    _evidenceHints: {},
    _collisionReport: [],

  },

};
