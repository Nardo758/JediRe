/**
 * Bishop golden fixture — build path.
 *
 * Pinned 2026-07-05 from live POST /build capture on Replit (commit 66c13f8f5).
 * Body constructed from stored deal_assumptions row (store-sourced, F-P1-A contract).
 * Pre-optimization throw demotion fix active — M11 resize + equity reconcile verified.
 *
 * Capture values (from /tmp/bishop_final.json):
 *   loan: $21,024,006  |  equity: $39,365,994  |  irr: −20.95%  |  em: 0.314
 *   dscr: 1.0424 (debtMetrics.dscr)  |  ALL_INVARIANTS: pass
 *
 * Provenance: store-sourced body · engine commit 66c13f8f5 · M11/M14 full cycle
 *   · capture timestamp 2026-07-05T13:50:19Z · "pinned post-Findings A–O + pre-opt demotion"
 *
 * rawAssumptions: best-effort reconstruction from deal DB row + capture context.
 *   This is a DETERMINISM pin (same inputs → same outputs), NOT external-correctness
 *   validation. The expected values below are what the engine produced on the
 *   capture date, bugs included. Correctness against an external oracle (Excel
 *   parity) is pending — do not treat these numbers as ground truth until that
 *   gate passes. If drift occurs, re-capture from live deal row on Replit — do
 *   not hand-tune expected.
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

  // PINNED 2026-07-13 (commit ab9e126aa) — P3 re-pin after B3/B4/B5/B6 debt-layer fixes.
  // Prior July-5 values are OBSOLETE: loan $21.0M → $33.1M, equity $39.4M → $27.3M,
  // IRR −20.95% → −4.26%, EM 0.314 → 0.813, DSCR 1.04 → 1.28.
  // These are the CORRECT post-fix outputs; the July-5 capture was under a different
  // capital-structure regime (pre-B3/B4/B5/B6, pre-debt-layer audit fixes).
  //
  // Per-field extraction provenance (all from runFullModel result, post-M11/M14):
  //   noiYear1:      result.summary.noiYear1
  //   egiYear1:      result.annualCashFlow[0].effectiveGrossIncome
  //   irr:            result.summary.irr
  //   equityMultiple: result.summary.equityMultiple
  //   dscrY1:         result.summary.dscrByYear[0]
  //   cashOnCashY1:   result.summary.cashOnCashByYear[0]
  //   goingInCapRate: result.summary.goingInCapRate
  //   exitCapRate:    result.summary.exitCapRate
  //   yieldOnCost:    result.summary.yieldOnCost (trended)
  //   totalEquity:    result.summary.totalEquity
  //   totalDebt:      result.summary.loanAmount
  //   netProceeds:    result.disposition.netSaleProceeds
  expected: {
    noiYear1: 2531954.251,
    egiYear1: 3484162.369,
    irr: -0.0426,
    equityMultiple: 0.8129,
    dscrY1: 1.2758,
    cashOnCashY1: 0.0200,
    goingInCapRate: 0.0422,
    exitCapRate: 0.0500,
    yieldOnCost: 0.0439,
    totalEquity: 27313007,
    totalDebt: 33076993,
    netProceeds: 52003168.02,
  },

  provenance: {
    captureDate: '2026-07-13T00:00:00Z',
    source: 'live_build_post_debt_fixes',
    buildEndpoint: 'runFullModel(effectiveAssumptions, skipSensitivity)',
    inputSnapshot: 'effectiveAssumptions from F5-1 instrumentation (pre-M11 boundary)',
    bodySource: 'P3 re-pin script (f5-2-p3-pin.ts) — per-field extraction with provenance',
    originClass: 'platform_underwritten',
    pathBoundRule: true,
  },

  // P1 FIX (2026-07-13): effectiveAssumptions now contains the MODEL INPUT CONTRACT
  // (post-enhancement-phases, PRE-M11), not the adjustedAssumptions (post-M11 output).
  // The prior value was circular: pinning an output as the test's input made the model
  // replay its own post-optimization state. This block is the first object the F5-1
  // instrumentation logged at the runFullModel() boundary.
  //
  // Rate: 6.0% (confirms enhancement-phase hypothesis; raw store had 6.5%).
  // Loan: $39,000,000 (raw 65% LTV; M11 will DSCR-size to ~$33.1M).
  // Term/Amort: 4320/4320 (Finding W: bridge double-conversion, months treated as years).
  //   These are the ACTUAL values the engine received at this epoch — warts and all.
  //   If Finding W is fixed, this fixture must be re-pinned.
  // LP Equity: $20,790,000 | GP Equity: $210,000 (pre-M11, pre-reconcile).
  //
  // Provenance: captured at runFullModel() boundary during live Bishop build 2026-07-09;
  //   post-enhancement-phases, pre-M11 — the model's true input contract.
  //   Source: /tmp/bishop_effective_assumptions.json (F5-1 instrumentation).

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

    // PRE-M11 INPUT CONTRACT (not post-M11 sized output)
    loanAmount: 39000000,
    ltv: 0.65,
    term: 4320,    // Finding W: bridge treats store months as years (4320 = 360yr)
    amort: 4320,   // Same double-conversion. Actual intended: 360 months = 30yr.
    ioPeriod: 36,

    rate: 0.06,
    originationFeePct: 1,
    prepayPenalty: 0,
    exitCap: 0.05,
    saleCosts: 0.02,
    holdYears: 5,

    // PRE-M11 equity (M11 will resize loan, then equity reconcile will adjust these)
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
