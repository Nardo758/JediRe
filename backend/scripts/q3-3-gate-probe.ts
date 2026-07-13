/**
 * Q3.3 GATE PROBE — Live build, two term configs, same deal.
 * Proves that a user's loan term change actually reaches the amortization schedule.
 * Run: cd backend && npx ts-node --transpile-only scripts/q3-3-gate-probe.ts
 */
import { mapProFormaAssumptionsToModelAssumptions } from '../src/services/deterministic/proforma-assumptions-bridge';
import { runFullModel } from '../src/services/deterministic/run-full-model';
import type { ProFormaAssumptions } from '../src/services/financial-model-engine.service';

const BASE: ProFormaAssumptions = {
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
    { floorPlan: '1BR', unitSize: 850, beds: 1, units: 116, occupied: 110, vacant: 6,  marketRent: 1650, inPlaceRent: 1600 },
    { floorPlan: '2BR', unitSize: 1100, beds: 2, units: 92,  occupied: 88,  vacant: 4,  marketRent: 2100, inPlaceRent: 2050 },
    { floorPlan: '3BR', unitSize: 1350, beds: 3, units: 24,  occupied: 22,  vacant: 2,  marketRent: 2600, inPlaceRent: 2550 },
  ],
  acquisition: {
    purchasePrice: 60_000_000,
    capRate: 0.05,
    closingCosts: { legal: 100_000, title: 150_000, inspection: 50_000 },
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
      pet_rent:  { perUnitMonth: 25, penetration: 0.30 },
      parking:   { perUnitMonth: 75, penetration: 0.85 },
    },
  },
  expenses: {
    real_estate_tax:      { amount: 420_000, type: 'total',      growthRate: 0.03  },
    insurance:            { amount: 180_000, type: 'total',      growthRate: 0.03  },
    utilities:            { amount: 280_000, type: 'total',      growthRate: 0.025 },
    repairs_maintenance:  { amount: 320_000, type: 'total',      growthRate: 0.025 },
    payroll:              { amount: 580_000, type: 'total',      growthRate: 0.03  },
    contract_services:    { amount: 140_000, type: 'total',      growthRate: 0.025 },
    marketing:            { amount:  90_000, type: 'total',      growthRate: 0.02  },
    g_and_a:              { amount: 120_000, type: 'total',      growthRate: 0.025 },
    management_fee:       { amount:       0, type: 'pct_of_egi', growthRate: 0     },
    replacement_reserves: { amount:     300, type: 'per_unit',   growthRate: 0.025 },
  },
  financing: {
    loanAmount:     39_000_000,
    loanType:       'fixed',
    interestRate:   0.065,
    spread:         0,
    term:           5,    // VARIES: 5 or 7 (years)
    amortization:   30,   // same both runs
    ioPeriod:       0,    // months
    originationFee: 0.01,
    rateCapCost:    0,
    prepayPenalty:  0,
  },
  capex: {
    lineItems: [{ description: 'Unit Turnover', amount: 400_000 }],
    contingencyPct:  0.10,
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
};

function fmt(n: number | null | undefined, prefix = '$'): string {
  if (n == null) return '        N/A';
  return `${prefix}${Math.round(n).toLocaleString()}`.padStart(14);
}

function buildWith(termYears: number, label: string): ReturnType<typeof runFullModel> {
  const input: ProFormaAssumptions = {
    ...BASE,
    financing: { ...BASE.financing, term: termYears },
  };
  const bridged = mapProFormaAssumptionsToModelAssumptions(input);

  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  ${label}`);
  console.log(`  financing.term=${termYears}yr → bridge.term=${bridged.term}mo, bridge.amort=${bridged.amort}mo`);
  console.log(`${'═'.repeat(72)}`);

  const run = runFullModel(bridged, { skipSensitivity: true });
  const res = run.result;
  const adj = run.adjustedAssumptions;

  console.log(`  M11 final term:    ${adj.term}mo  (${(adj.term / 12).toFixed(1)}yr)`);
  console.log(`  M11 final amort:   ${adj.amort}mo (${(adj.amort / 12).toFixed(1)}yr)`);
  console.log(`  Structural termMo: ${res.debtMetrics.structural.termMonths}`);
  console.log(`  Structural amortMo:${res.debtMetrics.structural.amortMonths}`);
  console.log(`  Loan amount:       $${res.summary.loanAmount.toLocaleString()}`);
  console.log(`  DSCR Y1:           ${res.debtMetrics.coverage.dscrY1?.toFixed(4) ?? 'N/A'}`);
  console.log(`  IRR:               ${res.summary.irr != null ? (res.summary.irr * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`  EM:                ${res.summary.equityMultiple?.toFixed(3) ?? 'N/A'}x`);

  const sched = res.capital?.amortizationSchedule ?? [];
  if (sched.length > 0) {
    console.log(`\n  Amortization schedule (hold period only):`);
    console.log(`  ${'Yr'.padEnd(4)} ${'Beg Bal'.padStart(14)} ${'Principal'.padStart(12)} ${'Interest'.padStart(12)} ${'Total Pmt'.padStart(12)} ${'End Bal'.padStart(14)}`);
    for (const row of sched) {
      const totalPmt = row.principal + row.interest;
      console.log(
        `  ${String(row.year).padEnd(4)}` +
        `${fmt(row.beginningBalance)}` +
        `${fmt(row.principal).padStart(12)}` +
        `${fmt(row.interest).padStart(12)}` +
        `${fmt(totalPmt).padStart(12)}` +
        `${fmt(row.endingBalance)}`
      );
    }
    const last = sched[sched.length - 1];
    console.log(`\n  Balloon at exit: $${Math.round(last.endingBalance).toLocaleString()}`);
  } else {
    const balances = res.capital?.loanBalanceByYear ?? [];
    const ds = res.capital?.debtServiceByYear ?? [];
    console.log(`\n  (no amortizationSchedule — fallback to debtServiceByYear/loanBalanceByYear)`);
    console.log(`  DS by year:      ${ds.map(v => `$${Math.round(v).toLocaleString()}`).join('  ')}`);
    console.log(`  Balance by year: ${balances.map(v => `$${Math.round(v).toLocaleString()}`).join('  ')}`);
  }

  return run;
}

console.log('Q3.3 GATE PROBE — Bishop: 5-year term vs 7-year term');
console.log('Everything identical except financing.term (5yr vs 7yr, amort=30yr both).');

try {
  const run5 = buildWith(5, 'RUN A — 5-year balloon / 30-year amort');
  const run7 = buildWith(7, 'RUN B — 7-year balloon / 30-year amort');

  console.log(`\n${'═'.repeat(72)}`);
  console.log('  DIFF SUMMARY');
  console.log(`${'═'.repeat(72)}`);

  const adj5 = run5.adjustedAssumptions;
  const adj7 = run7.adjustedAssumptions;
  console.log(`  M11 term (A vs B): ${adj5.term}mo vs ${adj7.term}mo  — differ: ${adj5.term !== adj7.term}`);
  console.log(`  Loan amt  (A vs B): $${run5.result.summary.loanAmount.toLocaleString()} vs $${run7.result.summary.loanAmount.toLocaleString()}`);
  console.log(`  DSCR Y1   (A vs B): ${run5.result.debtMetrics.coverage.dscrY1?.toFixed(4)} vs ${run7.result.debtMetrics.coverage.dscrY1?.toFixed(4)}`);

  const sched5 = run5.result.capital?.amortizationSchedule ?? [];
  const sched7 = run7.result.capital?.amortizationSchedule ?? [];
  const bal5 = sched5[sched5.length - 1]?.endingBalance;
  const bal7 = sched7[sched7.length - 1]?.endingBalance;
  console.log(`  Balloon   (A vs B): $${bal5 != null ? Math.round(bal5).toLocaleString() : 'N/A'} vs $${bal7 != null ? Math.round(bal7).toLocaleString() : 'N/A'}`);

  const termsDiffer = adj5.term !== adj7.term;
  const schedDiffer = bal5 != null && bal7 != null && Math.abs(bal5 - bal7) > 100;
  const dscrDiffer  = Math.abs((run5.result.debtMetrics.coverage.dscrY1 ?? 0) - (run7.result.debtMetrics.coverage.dscrY1 ?? 0)) > 0.0001;
  const ds5 = run5.result.capital?.debtServiceByYear ?? [];
  const ds7 = run7.result.capital?.debtServiceByYear ?? [];
  const dsDiffer = ds5.some((v, i) => ds7[i] != null && Math.abs(v - ds7[i]) > 100);

  if (termsDiffer || schedDiffer || dscrDiffer || dsDiffer) {
    console.log('\n  ✅ VERDICT: SCHEDULES DIFFER — Finding X PROVEN CLOSED.');
    console.log('     User term reached the amortization schedule. Rail works end-to-end.');
    console.log('     Proceed to Z.');
  } else {
    console.log('\n  ❌ VERDICT: SCHEDULES IDENTICAL — STOP THE ARC.');
    console.log('     The term never reached the schedule. B3 fix is incomplete.');
    console.log('     Do not proceed to Z/U/W.');
  }

} catch (err) {
  console.error('\nFATAL:', err);
  process.exit(1);
}
