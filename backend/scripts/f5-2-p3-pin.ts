/**
 * F5-2 P3: Pin Bishop expected outputs from live build capture
 *
 * Run this from the backend directory AFTER P2 reproduces:
 *   npx ts-node scripts/f5-2-p3-pin.ts
 *
 * This runs the model with the corrected input contract and generates
 * the 12-field expected block with per-field extraction provenance.
 */

import { runFullModel } from '../src/services/deterministic/run-full-model';
import { bishopFixture } from '../src/services/deterministic/__fixtures__/bishop.golden';

async function main() {
  const assumptions = bishopFixture.effectiveAssumptions;
  if (!assumptions) {
    console.error('effectiveAssumptions is null — P1 not complete');
    process.exit(1);
  }

  console.log('=== F5-2 P3: Pin Bishop Expected Outputs ===');
  console.log('');

  const full = runFullModel(assumptions, { skipSensitivity: true });
  const result = full.result;

  // Extract the 12 fields for the expected block
  const pinned = {
    noiYear1: result.summary.noiYear1,
    egiYear1: result.annualCashFlow[0]?.effectiveGrossIncome ?? 0,
    irr: result.summary.irr,
    equityMultiple: result.summary.equityMultiple,
    dscrY1: result.summary.dscrByYear[0] ?? 0,
    cashOnCashY1: result.summary.cashOnCashByYear[0] ?? 0,
    goingInCapRate: result.summary.goingInCapRate,
    exitCapRate: result.summary.exitCapRate,
    yieldOnCost: typeof result.summary.yieldOnCost === 'number'
      ? result.summary.yieldOnCost
      : (result.summary.yieldOnCost as any)?.trended ?? 0,
    totalEquity: result.summary.totalEquity,
    totalDebt: result.summary.loanAmount,
    netProceeds: result.disposition?.netSaleProceeds ?? 0,
  };

  console.log('// Copy this block into bishop.golden.ts as the `expected` field:');
  console.log('');
  console.log('  expected: {');
  console.log(`    noiYear1: ${pinned.noiYear1.toLocaleString()},`);
  console.log(`    egiYear1: ${pinned.egiYear1.toLocaleString()},`);
  console.log(`    irr: ${pinned.irr.toFixed(4)},`);
  console.log(`    equityMultiple: ${pinned.equityMultiple.toFixed(4)},`);
  console.log(`    dscrY1: ${pinned.dscrY1.toFixed(4)},`);
  console.log(`    cashOnCashY1: ${pinned.cashOnCashY1.toFixed(4)},`);
  console.log(`    goingInCapRate: ${pinned.goingInCapRate.toFixed(4)},`);
  console.log(`    exitCapRate: ${pinned.exitCapRate.toFixed(4)},`);
  console.log(`    yieldOnCost: ${pinned.yieldOnCost.toFixed(4)},`);
  console.log(`    totalEquity: ${pinned.totalEquity.toLocaleString()},`);
  console.log(`    totalDebt: ${pinned.totalDebt.toLocaleString()},`);
  console.log(`    netProceeds: ${pinned.netProceeds.toLocaleString()},`);
  console.log('  },');
  console.log('');

  // Per-field extraction provenance
  console.log('// Per-field extraction provenance (paste into fixture comments):');
  console.log('//   noiYear1: result.summary.noiYear1');
  console.log('//   egiYear1: result.annualCashFlow[0].effectiveGrossIncome');
  console.log('//   irr: result.summary.irr');
  console.log('//   equityMultiple: result.summary.equityMultiple');
  console.log('//   dscrY1: result.summary.dscrByYear[0]');
  console.log('//   cashOnCashY1: result.summary.cashOnCashByYear[0]');
  console.log('//   goingInCapRate: result.summary.goingInCapRate');
  console.log('//   exitCapRate: result.summary.exitCapRate');
  console.log('//   yieldOnCost: result.summary.yieldOnCost (trended fallback)');
  console.log('//   totalEquity: result.summary.totalEquity');
  console.log('//   totalDebt: result.summary.loanAmount');
  console.log('//   netProceeds: result.disposition.netSaleProceeds');
  console.log('');

  // Evidence fields for P4 reference
  console.log('=== Evidence fields (for P4 — Finding V comparison) ===');
  if (result.evidence?.fields) {
    const fields = result.evidence.fields.map((f: any) => ({
      field: f.field,
      value: f.value,
      reasoning: f.reasoning?.substring(0, 80) + '...' || '(no reasoning)',
    }));
    console.log(JSON.stringify(fields, null, 2));
  }

  console.log('');
  console.log('=== adjustedAssumptions (post-M11, for reference) ===');
  console.log(JSON.stringify(full.adjustedAssumptions, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
