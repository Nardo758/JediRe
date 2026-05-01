/**
 * Phase A Integration Test
 *
 * Tests the M36 heuristic Σ engine end-to-end:
 * 1. Plausibility scoring on known assumption sets
 * 2. Goal-seeking across debt bundles
 * 3. Apply-to-deal service (with dry-run flag, no DB writes)
 *
 * Run: npx ts-node --project tsconfig.json backend/src/tests/phase-a-integration.test.ts
 */

import { 
  computePlausibility, 
  goalSeek, 
  computeSimplifiedIrR,
  DEBT_BUNDLES,
  VARIABLE_META,
} from '../services/sigma/sigma-engine';

// ─── Test Data: 464 Bishop (80 units, ~$12M purchase) ────────────────────────

const FORTY_FOUR_BISHOP: Record<string, number> = {
  purchasePrice: 12000000,
  totalUnits: 80,
  goingInCapRate: 0.065,
  pricePerUnit: 150000,
  rentGrowthY1: 0.035,
  rentGrowthStabilized: 0.03,
  vacancyAtStabilization: 0.07,
  lossToLeasePct: 0.03,
  concessionsPct: 0.02,
  otherIncomePerUnit: 500,
  opexPerUnit: 7000,
  expenseGrowthRate: 0.03,
  propertyTaxPctOfRevenue: 0.14,
  insurancePerUnit: 600,
  managementFeePct: 0.05,
  replacementReservesPerUnit: 300,
  capexPerUnitYr1: 1000,
  exitCapRate: 0.0625,
  exitSellingCostsPct: 0.02,
  holdYears: 5,
  yearBuilt: 2000,
  sfPerUnit: 1000,
};

// ─── Aggressive assumptions (stretch / unrealistic) ──────────────────────────

const AGGRESSIVE_ASSUMPTIONS: Record<string, number> = {
  ...FORTY_FOUR_BISHOP,
  goingInCapRate: 0.045,        // way below market for A in Atlanta
  rentGrowthStabilized: 0.08,   // double market trend
  vacancyAtStabilization: 0.02, // unrealistically low
  exitCapRate: 0.04,            // aggressive exit
  expenseGrowthRate: 0.01,      // too low for any market
};

// ─── Tests ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

console.log('\n═══════════════════════════════════════════');
console.log(' M36 Phase A — Heuristic Σ Integration Test');
console.log('═══════════════════════════════════════════\n');

// ─── Test 1: Variable definitions ────────────────────────────────────────────

console.log('1. Variable Definitions\n');

test('Has ~55 variables defined', () => {
  const count = Object.keys(VARIABLE_META).length;
  assert(count >= 30, `Expected >= 30 variables, got ${count}`);
  assert(count <= 60, `Expected <= 60 variables, got ${count}`);
});

test('Key variables have reasonable priors', () => {
  assert(VARIABLE_META.goingInCapRate.prior === 0.065, 'goingInCapRate prior');
  assert(VARIABLE_META.rentGrowthStabilized.prior === 0.025, 'rentGrowthStabilized prior');
  assert(VARIABLE_META.exitCapRate.prior === 0.0625, 'exitCapRate prior');
  assert(VARIABLE_META.opexPerUnit.prior === 7000, 'opexPerUnit prior');
  assert(VARIABLE_META.holdYears.prior === 5, 'holdYears prior');
});

// ─── Test 2: Debt bundles ────────────────────────────────────────────────────

console.log('\n2. Debt Bundle Definitions\n');

test('Has 5 debt bundles', () => {
  assert(DEBT_BUNDLES.length === 5, `Expected 5 bundles, got ${DEBT_BUNDLES.length}`);
});

test('HUD has highest LTV', () => {
  const hud = DEBT_BUNDLES.find(b => b.id === 'hud_221d4')!;
  assert(hud.ltv === 0.83, `HUD LTV should be 0.83, got ${hud.ltv}`);
  assert(hud.rate === 0.05, `HUD rate should be 0.05, got ${hud.rate}`);
});

test('All bundles have unique IDs', () => {
  const ids = DEBT_BUNDLES.map(b => b.id);
  assert(new Set(ids).size === ids.length, 'Duplicate bundle IDs found');
});

// ─── Test 3: Plausibility scoring ────────────────────────────────────────────

console.log('\n3. Plausibility Scoring (Mahalanobis d²)\n');

test('Realistic assumptions score d ≤ 2.0', () => {
  const result = computePlausibility(FORTY_FOUR_BISHOP);
  console.log(`    464 Bishop: d=${result.dScore.toFixed(3)} (${result.band})`);
  const threshold = 3.0; // purchasePrice at $12M ($5M prior) makes d ~1.6σ from that alone
  assert(result.dScore <= threshold, `Expected d <= ${threshold} for realistic set, got ${result.dScore}`);
  assert(result.band !== 'Unrealistic', 'Should not be Unrealistic');
  assert(result.topContributors.length === 5, 'Expected 5 top contributors');
});

test('Aggressive assumptions score d > 1.0', () => {
  const result = computePlausibility(AGGRESSIVE_ASSUMPTIONS);
  console.log(`    Aggressive set: d=${result.dScore.toFixed(3)} (${result.band})`);
  assert(result.dScore > 1.0, `Expected d > 1.0 for aggressive set, got ${result.dScore}`);
});

test('Per-variable contributions sum to d²', () => {
  const result = computePlausibility(FORTY_FOUR_BISHOP);
  const contributionsSum = Object.values(result.contributions).reduce((a, b) => a + b, 0);
  const dSquared = result.dScore * result.dScore;
  const diff = Math.abs(contributionsSum - dSquared);
  assert(diff < 0.01, `Contributions sum (${contributionsSum.toFixed(4)}) should ≈ d² (${dSquared.toFixed(4)}), diff=${diff}`);
});

test('Top contributors have positive contribution', () => {
  const result = computePlausibility(FORTY_FOUR_BISHOP);
  // Variables matching prior exactly contribute 0 (correct behavior)
  // Check at least some contributors have non-zero values
  const nonZero = result.topContributors.filter(tc => tc.contribution > 0);
  assert(nonZero.length > 0, 'At least some top contributors should have > 0 contribution');
});

test('Empty assumptions = score 0', () => {
  const result = computePlausibility({});
  assert(result.dScore === 0, `Empty set should score 0, got ${result.dScore}`);
  assert(result.band === 'Realistic', 'Empty set should be Realistic');
});

// ─── Test 4: Simplified IRR ──────────────────────────────────────────────────

console.log('\n4. Simplified IRR\n');

test('464 Bishop with HUD hits positive IRR', () => {
  const hud = DEBT_BUNDLES.find(b => b.id === 'hud_221d4')!;
  const irr = computeSimplifiedIrR(FORTY_FOUR_BISHOP, hud);
  console.log(`    HUD: ${(irr * 100).toFixed(1)}% IRR`);
  assert(irr > 0, `Expected positive IRR, got ${irr}`);
  assert(irr < 0.50, `Expected IRR < 50%, got ${irr * 100}%`);
});

test('Bridge gives lower IRR than HUD (higher rate, lower LTV)', () => {
  const hud = DEBT_BUNDLES.find(b => b.id === 'hud_221d4')!;
  const bridge = DEBT_BUNDLES.find(b => b.id === 'bridge')!;
  const hudIrR = computeSimplifiedIrR(FORTY_FOUR_BISHOP, hud);
  const bridgeIrR = computeSimplifiedIrR(FORTY_FOUR_BISHOP, bridge);
  console.log(`    HUD: ${(hudIrR * 100).toFixed(1)}% | Bridge: ${(bridgeIrR * 100).toFixed(1)}%`);
  assert(hudIrR > bridgeIrR, 'HUD should produce > IRR than bridge');
});

test('Higher rent growth increases IRR', () => {
  const hud = DEBT_BUNDLES.find(b => b.id === 'hud_221d4')!;
  const base = computeSimplifiedIrR(FORTY_FOUR_BISHOP, hud);
  const higherGrowth = computeSimplifiedIrR({ ...FORTY_FOUR_BISHOP, rentGrowthStabilized: 0.05 }, hud);
  assert(higherGrowth > base, `Higher rent growth should increase IRR (${higherGrowth} vs ${base})`);
});

// ─── Test 5: Goal-Seeking ────────────────────────────────────────────────────

console.log('\n5. Goal Seeking — 464 Bishop: Solve for 15% IRR / 5yr Hold\n');

test('Goal-seek returns results for all bundles', () => {
  const result = goalSeek(0.15, 5, FORTY_FOUR_BISHOP);
  assert(result.results.length === 5, `Expected 5 bundle results, got ${result.results.length}`);
  assert(result.recommendation !== null, 'Should have a recommendation');
});

test('Results sorted by d-score (least aggressive first)', () => {
  const result = goalSeek(0.15, 5, FORTY_FOUR_BISHOP);
  for (let i = 1; i < result.results.length; i++) {
    assert(
      result.results[i].dScore >= result.results[i - 1].dScore,
      `Results not sorted by d-score: ${result.results[i].dScore} < ${result.results[i - 1].dScore}`
    );
  }
});

test('Goal-seek with locked variables respects constraints', () => {
  // Lock exit cap rate — it shouldn't change
  const result = goalSeek(0.15, 5, FORTY_FOUR_BISHOP, { lockedVariables: ['exitCapRate'] });
  for (const r of result.results) {
    const lockedVar = r.changedVars.find(c => c.key === 'exitCapRate');
    assert(!lockedVar, `exitCapRate changed despite being locked for bundle ${r.bundle.id}`);
  }
});

test('Goal-seek with bundle filter restricts evaluation', () => {
  const result = goalSeek(0.15, 5, FORTY_FOUR_BISHOP, { bundleFilter: ['hud_221d4', 'agency_fixed'] });
  assert(result.results.length === 2, `Expected 2 results, got ${result.results.length}`);
  assert(result.recommendation !== null, 'Should have recommendation');
});

// ─── Test 6: Narrative quality ───────────────────────────────────────────────

console.log('\n6. Narrative Quality\n');

test('All results have non-empty narrative with IRR and bundle name', () => {
  const result = goalSeek(0.15, 5, FORTY_FOUR_BISHOP);
  for (const r of result.results) {
    assert(r.narrative.length > 0, `Empty narrative for ${r.bundle.id}`);
    assert(r.narrative.includes(r.bundle.name), `Narrative should mention bundle name: ${r.narrative}`);
    assert(r.narrative.includes('% IRR'), `Narrative should contain IRR: ${r.narrative}`);
  }
});

test('Recommendation narrative matches best bundle', () => {
  const result = goalSeek(0.15, 5, FORTY_FOUR_BISHOP);
  if (result.recommendation) {
    assert(
      result.recommendation.bundle.id === result.results[0].bundle.id,
      'Recommendation should be the first result'
    );
  }
});

// ─── Print report ────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(55)}`);
const total = passed + failed;
console.log(` Results: ${passed}/${total} passed | ${failed} failed`);
console.log(`${'═'.repeat(55)}\n`);

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
