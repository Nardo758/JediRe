/**
 * F5-2 P2: Prove reproduction — run model with corrected effectiveAssumptions
 * 
 * Run this from the backend directory:
 *   npx ts-node scripts/f5-2-p2-reproduction.ts
 * 
 * This feeds the captured modelAssumptions (pre-M11, rate 6.0%, loan $39M)
 * into runFullModel and checks the five July-5 values.
 */

import { runFullModel } from '../src/services/deterministic/run-full-model';
import { bishopFixture } from '../src/services/deterministic/__fixtures__/bishop.golden';

async function main() {
  const assumptions = bishopFixture.effectiveAssumptions;
  if (!assumptions) {
    console.error('effectiveAssumptions is null — P1 not complete');
    process.exit(1);
  }

  console.log('=== F5-2 P2: Reproduction Test ===');
  console.log('Input contract (effectiveAssumptions):');
  console.log(`  rate: ${(assumptions.rate * 100).toFixed(2)}%`);
  console.log(`  loanAmount: $${assumptions.loanAmount.toLocaleString()}`);
  console.log(`  term: ${assumptions.term} months (${assumptions.term / 12} years)`);
  console.log(`  amort: ${assumptions.amort} months (${assumptions.amort / 12} years)`);
  console.log('');

  const full = runFullModel(assumptions, { skipSensitivity: true });
  const result = full.result;

  // Five July-5 values
  const july5 = {
    loan: 21_024_006,
    equity: 39_365_994,
    irr: -0.2095,
    em: 0.3144,
    dscr: 1.0424,
  };

  const actual = {
    loan: full.adjustedAssumptions?.loanAmount ?? result.summary.loanAmount,
    equity: (full.adjustedAssumptions?.lpEquity ?? 0) + (full.adjustedAssumptions?.gpEquity ?? 0),
    irr: result.summary.irr,
    em: result.summary.equityMultiple,
    dscr: result.summary.dscrByYear[0],
  };

  console.log('=== Outputs ===');
  console.log(`loan:    $${actual.loan.toLocaleString()}  (July-5: $${july5.loan.toLocaleString()})`);
  console.log(`equity:  $${actual.equity.toLocaleString()}  (July-5: $${july5.equity.toLocaleString()})`);
  console.log(`IRR:     ${(actual.irr * 100).toFixed(2)}%  (July-5: ${(july5.irr * 100).toFixed(2)}%)`);
  console.log(`EM:      ${actual.em.toFixed(4)}  (July-5: ${july5.em.toFixed(4)})`);
  console.log(`DSCR:    ${actual.dscr?.toFixed(4) ?? 'n/a'}  (July-5: ${july5.dscr.toFixed(4)})`);
  console.log('');

  // Check reproduction within tolerance
  const TOLERANCE = {
    dollar: 5000,    // $5K tolerance for loan/equity
    rate: 0.005,    // 0.5% tolerance for IRR
    multiple: 0.02, // 0.02 tolerance for EM
    dscr: 0.02,     // 0.02 tolerance for DSCR
  };

  const reproduces = {
    loan: Math.abs(actual.loan - july5.loan) <= TOLERANCE.dollar,
    equity: Math.abs(actual.equity - july5.equity) <= TOLERANCE.dollar,
    irr: Math.abs(actual.irr - july5.irr) <= TOLERANCE.rate,
    em: Math.abs(actual.em - july5.em) <= TOLERANCE.multiple,
    dscr: Math.abs((actual.dscr ?? 0) - july5.dscr) <= TOLERANCE.dscr,
  };

  console.log('=== Reproduction Verdict ===');
  const allReproduce = Object.values(reproduces).every(v => v);
  if (allReproduce) {
    console.log('✅ ALL FIVE REPRODUCE — P2 GREEN');
    console.log('');
    console.log('=== adjustedAssumptions (for P3 pinning) ===');
    console.log(JSON.stringify(full.adjustedAssumptions, null, 2));
    console.log('');
    console.log('=== Full result.summary (for P3 pinning) ===');
    console.log(JSON.stringify(result.summary, null, 2));
  } else {
    console.log('❌ DOES NOT REPRODUCE — P2 RED');
    console.log('Diffs:');
    if (!reproduces.loan) console.log(`  loan: off by $${(actual.loan - july5.loan).toLocaleString()}`);
    if (!reproduces.equity) console.log(`  equity: off by $${(actual.equity - july5.equity).toLocaleString()}`);
    if (!reproduces.irr) console.log(`  IRR: off by ${((actual.irr - july5.irr) * 100).toFixed(2)}%`);
    if (!reproduces.em) console.log(`  EM: off by ${(actual.em - july5.em).toFixed(4)}`);
    if (!reproduces.dscr) console.log(`  DSCR: off by ${((actual.dscr ?? 0) - july5.dscr).toFixed(4)}`);
    console.log('');
    console.log('=== adjustedAssumptions ===');
    console.log(JSON.stringify(full.adjustedAssumptions, null, 2));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
