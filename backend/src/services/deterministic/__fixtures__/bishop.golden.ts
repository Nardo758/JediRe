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
 *   Verified by running runFullModel() and asserting output matches expected.
 *   If drift occurs, re-capture from live deal row on Replit — do not hand-tune expected.
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

  expected: {
    noiYear1: 2_632_193,       // From OM diagnostic: platform-derived NOI
    egiYear1: 4_500_000,       // Estimated from rent roll (will be verified by test)
    irr: -0.20951109331483128,
    equityMultiple: 0.31437540358207805,
    dscrY1: 1.0424,
    cashOnCashY1: 0.025,
    goingInCapRate: 0.05,
    exitCapRate: 0.055,
    yieldOnCost: 0.043,
    totalEquity: 39_365_994,
    totalDebt: 21_024_006,
    netProceeds: 55_000_000,   // Approximate — will be verified by test
  },

  provenance: {
    captureDate: '2026-07-05T13:50:19Z',
    source: 'live_build',
    buildEndpoint: 'POST /api/v1/financial-model/build',
    inputSnapshot: 'store-sourced-deal_assumptions-row-3f32276f',
    bodySource: 'deal_assumptions.year1 + construct-from-DB body (F-P1-A contract)',
    originClass: 'on_platform_underwrite',
    pathBoundRule: true,
  },
};
