/**
 * Synthetic degenerate fixture generator — v4 (correct field access).
 */

import { runModel } from '../src/services/deterministic/deterministic-model-runner';

async function main() {
  const assumptions = {
    units: 376,
    avgUnitSf: 850,
    marketRent: 1400,
    inPlaceRent: 1400,
    purchasePrice: 45_000_000,
    closingCostsPct: 0.015,
    isFlorida: false,
    docStampsPct: 0,
    intangibleTaxPct: 0,
    titleInsurancePct: 0,
    capexBudget: 500_000,
    rentGrowth: [0.03, 0.03, 0.03, 0.03, 0.03],
    lossToLease: 0,
    vacancyY1: 0.038,
    vacancyStab: 0.038,
    underwritingVacancyFloor: 0.05,
    concessions: 0.01,
    badDebt: 0.015,
    otherIncomePerUnit: 200,
    expenseGrowth: 0.025,
    payrollPerUnit: 1200,
    maintenancePerUnit: 450,
    contractServicesPerUnit: 300,
    marketingPerUnit: 150,
    utilitiesPerUnit: 400,
    adminPerUnit: 200,
    insurancePerUnit: 350,
    managementFee: 0.03,
    replacementReserves: 250,
    loanAmount: 31_500_000,
    ltv: 0.70,
    term: 360,
    amort: 360,
    ioPeriod: 0,
    rate: 0.065,
    originationFeePct: 0.01,
    prepayPenalty: 0,
    exitCap: 0.065,
    saleCosts: 0.02,
    holdYears: 5,
    lpEquity: 13_185_000,
    gpEquity: 270_000,
    preferredReturn: 0.08,
    promoteTiers: [0.08, 0.12, 0.15] as [number, number, number],
    promoteSplits: [0.20, 0.30, 0.50] as [number, number, number],
    dealType: 'existing',
    dealMode: 'existing' as const,
    occupancyAtClose: 1.0,
    standardTurnDowntimeDays: 14,
    annualTurnoverRate: 0.50,
    newLeaseConcessionMonths: 1,
  };

  const result = runModel(assumptions, { skipSensitivity: true });
  const acf = result.annualCashFlow[0];
  const s = result.summary;
  const yoc = s.yieldOnCost as any;

  const expected = {
    noiYear1: Math.round(s.noiYear1),
    egiYear1: Math.round(acf.effectiveGrossIncome),
    irr: s.irr ?? 0,
    equityMultiple: s.equityMultiple ?? 0,
    dscrY1: s.dscrByYear?.[0] ?? 0,
    cashOnCashY1: s.cashOnCashByYear?.[0] ?? 0,
    goingInCapRate: s.goingInCapRate,
    exitCapRate: s.exitCapRate,
    yieldOnCost: typeof yoc === 'number' ? yoc : (yoc?.trended ?? 0),
    totalEquity: s.totalEquity,
    totalDebt: s.loanAmount,
    netProceeds: result.disposition?.netSaleProceeds ?? 0,
  };

  console.log('=== Synthetic Degenerate Fixture ===');
  console.log(JSON.stringify(expected, null, 2));
  console.log('');

  const months = result.monthlyCashFlow;
  const m1 = months[0];
  const m12 = months[11];

  console.log('=== Degenerate-case checks ===');
  console.log(`  m1 floorBinding: ${m1.floorBinding} (expect true)`);
  console.log(`  m12 floorBinding: ${m12.floorBinding} (expect true)`);
  console.log(`  m1 effectiveVacancy: ${(m1.effectiveVacancy ?? 0).toFixed(4)} (expect 0.05)`);
  console.log(`  m1 physical vacancy: ${m1.vacancy.toFixed(4)} (expect < 0.05)`);

  const y1Nois = months.slice(0, 12).map(m => m.noi);
  const variance = Math.max(...y1Nois) - Math.min(...y1Nois);
  console.log(`  Y1 intra-year variance: ${Math.round(variance)}`);
  console.log(`  _unmatchedOpexKeys: ${JSON.stringify(result._unmatchedOpexKeys ?? [])}`);
  console.log(`  _orphanedOpexKeys: ${JSON.stringify(result._orphanedOpexKeys ?? [])}`);

  console.log('');
  console.log('=== Fixture-ready TS ===');
  console.log(`expected: {`);
  console.log(`  noiYear1: ${expected.noiYear1},`);
  console.log(`  egiYear1: ${expected.egiYear1},`);
  console.log(`  irr: ${expected.irr.toFixed(6)},`);
  console.log(`  equityMultiple: ${expected.equityMultiple.toFixed(6)},`);
  console.log(`  dscrY1: ${expected.dscrY1.toFixed(6)},`);
  console.log(`  cashOnCashY1: ${expected.cashOnCashY1.toFixed(6)},`);
  console.log(`  goingInCapRate: ${expected.goingInCapRate.toFixed(6)},`);
  console.log(`  exitCapRate: ${expected.exitCapRate.toFixed(6)},`);
  console.log(`  yieldOnCost: ${expected.yieldOnCost.toFixed(6)},`);
  console.log(`  totalEquity: ${expected.totalEquity},`);
  console.log(`  totalDebt: ${expected.totalDebt},`);
  console.log(`  netProceeds: ${Math.round(expected.netProceeds)},`);
  console.log(`},`);
}

main();
