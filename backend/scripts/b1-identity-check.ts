import { mapProFormaAssumptionsToModelAssumptions } from '../src/services/deterministic/proforma-assumptions-bridge';
import { bishopFixture } from '../src/services/deterministic/__fixtures__/bishop.golden';

const raw = bishopFixture.rawAssumptions;
if (!raw) {
  console.log('No rawAssumptions');
  process.exit(1);
}

// Identity check: Bishop rate before/after bridge
const m = mapProFormaAssumptionsToModelAssumptions(raw as any);
console.log('=== Bishop Identity Check ===');
console.log('Input rate (rawAssumptions.financing.interestRate):', raw.financing?.interestRate);
console.log('Output rate (bridge ModelAssumptions.rate):', m.rate);
console.log('Rate unchanged:', m.rate === raw.financing?.interestRate ? 'YES ✅' : 'NO ❌');

// Arbiter check: user override wins
const overridden = {
  ...raw,
  financing: { ...raw.financing, interestRate: 0.045 },
};
const m2 = mapProFormaAssumptionsToModelAssumptions(overridden as any);
console.log('\n=== Arbiter Check ===');
console.log('Override rate (financing.interestRate):', 0.045);
console.log('Bridge output rate:', m2.rate);
console.log('Override wins:', m2.rate === 0.045 ? 'YES ✅' : 'NO ❌');

// Fallback check: no rate provided -> bridge default 0.065
const noRate = {
  ...raw,
  financing: { ...raw.financing, interestRate: undefined as any },
};
const m3 = mapProFormaAssumptionsToModelAssumptions(noRate as any);
console.log('\n=== Fallback Check ===');
console.log('No rate provided -> bridge default:', m3.rate);
console.log('Fallback to 0.065:', m3.rate === 0.065 ? 'YES ✅' : 'NO ❌');
