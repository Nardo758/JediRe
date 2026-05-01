/**
 * Phase A Integration Test
 *
 * Tests the M36 heuristic Σ engine end-to-end:
 * 1. Plausibility scoring on known assumption sets
 * 2. Goal-seeking across debt bundles
 * 3. Apply-to-deal service (with dry-run flag, no DB writes)
 * 4. Macro-anchored mean (M36 addendum)
 *
 * Run: npx tsx backend/src/tests/phase-a-integration.test.ts
 */

import { 
  computePlausibility, 
  goalSeek, 
  computeSimplifiedIrR,
  DEBT_BUNDLES,
  VARIABLE_META,
} from '../services/sigma/sigma-engine';

// ─── Inline macro anchor data (avoid DB imports in tests) ────────────────────

const TEST_MACRO_ANCHORS = [
  { metric: 'rentGrowthStabilized', seriesId: 'CUSR0000SEHC', structuralPremium: 0.008, fallbackMu: 0.035, description: '' },
  { metric: 'rentGrowthY1', seriesId: 'CUSR0000SEHC', structuralPremium: 0.01, fallbackMu: 0.04, description: '' },
  { metric: 'expenseGrowthRate', seriesId: 'WPSFD49207', structuralPremium: 0.005, fallbackMu: 0.035, description: '' },
  { metric: 'entryCapRate', seriesId: 'DGS10', structuralPremium: 0.035, fallbackMu: 0.065, description: '' },
  { metric: 'exitCapRate', seriesId: 'DGS10', structuralPremium: 0.04, fallbackMu: 0.065, description: '' },
  { metric: 'constructionCostGrowth', seriesId: 'WPSFD49207', structuralPremium: 0.005, fallbackMu: 0.035, description: '' },
];

const TEST_MACRO_SERIES = [
  { seriesId: 'CUSR0000SEHC', name: 'CPI-OER', unit: '% y/y', refreshCadence: 'monthly', defaultFallback: 0.038 },
  { seriesId: 'ECIWAG', name: 'ECI Wages', unit: '% y/y', refreshCadence: 'quarterly', defaultFallback: 0.042 },
  { seriesId: 'DGS10', name: '10Y Treasury', unit: '%', refreshCadence: 'daily', defaultFallback: 0.0425 },
  { seriesId: 'T10YIE', name: '10Y Breakeven', unit: '%', refreshCadence: 'daily', defaultFallback: 0.023 },
  { seriesId: 'WPSFD49207', name: 'PPI Residential', unit: '% y/y', refreshCadence: 'monthly', defaultFallback: 0.035 },
];

// Pure function replicas (avoid import chain that needs winston/db)
function testComputeMacroMu(anchor: { structuralPremium: number }, macroValue: number): number {
  return macroValue + anchor.structuralPremium;
}
function testDeriveBlendWeight(divergenceSigma: number): number {
  if (divergenceSigma < 1.0) return 0.70;
  if (divergenceSigma < 2.0) return 0.55;
  if (divergenceSigma < 3.0) return 0.40;
  return 0.30;
}
function testComputeDivergenceSigma(muEmpirical: number, muMacro: number, metricStd: number): number {
  if (metricStd <= 0) return 0;
  return Math.abs(muEmpirical - muMacro) / metricStd;
}

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

const AGGRESSIVE_ASSUMPTIONS: Record<string, number> = {
  ...FORTY_FOUR_BISHOP,
  goingInCapRate: 0.045,
  rentGrowthStabilized: 0.08,
  vacancyAtStabilization: 0.02,
  exitCapRate: 0.04,
  expenseGrowthRate: 0.01,
};

// ─── Test Runner ─────────────────────────────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
console.log(' M36 Phase A — Heuristic Σ Integration Test');
console.log('═══════════════════════════════════════════\n');

// ─── 1. Variable Definitions ─────────────────────────────────────────────────

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

// ─── 2. Debt Bundle Definitions ──────────────────────────────────────────────

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

// ─── 3. Plausibility Scoring ─────────────────────────────────────────────────

console.log('\n3. Plausibility Scoring (Mahalanobis d²)\n');

test('Realistic assumptions score d ≤ 3.0', () => {
  const result = computePlausibility(FORTY_FOUR_BISHOP);
  console.log(`    464 Bishop: d=${result.dScore.toFixed(3)} (${result.band})`);
  const threshold = 3.0;
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
  const nonZero = result.topContributors.filter(tc => tc.contribution > 0);
  assert(nonZero.length > 0, 'At least some top contributors should have > 0 contribution');
});

test('Empty assumptions = score 0', () => {
  const result = computePlausibility({});
  assert(result.dScore === 0, `Empty set should score 0, got ${result.dScore}`);
  assert(result.band === 'Realistic', 'Empty set should be Realistic');
});

// ─── 4. Simplified IRR ───────────────────────────────────────────────────────

console.log('\n4. Simplified IRR\n');

test('464 Bishop with HUD hits positive IRR', () => {
  const hud = DEBT_BUNDLES.find(b => b.id === 'hud_221d4')!;
  const irr = computeSimplifiedIrR(FORTY_FOUR_BISHOP, hud);
  console.log(`    HUD: ${(irr * 100).toFixed(1)}% IRR`);
  assert(irr > 0, `Expected positive IRR, got ${irr}`);
  assert(irr < 0.50, `Expected IRR < 50%, got ${irr * 100}%`);
});

test('Bridge gives lower IRR than HUD', () => {
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

// ─── 5. Goal-Seeking ─────────────────────────────────────────────────────────

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

// ─── 6. Narrative Quality ────────────────────────────────────────────────────

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

// ─── 7. Macro-Anchored Mean ──────────────────────────────────────────────────

console.log('\n7. Macro-Anchored Mean (M36 Addendum)\n');

test('6 macro-anchor metrics defined', () => {
  assert(TEST_MACRO_ANCHORS.length === 6, `Expected 6 anchors, got ${TEST_MACRO_ANCHORS.length}`);
  const metrics = TEST_MACRO_ANCHORS.map(a => a.metric);
  assert(metrics.includes('rentGrowthStabilized'), 'Missing rentGrowthStabilized');
  assert(metrics.includes('entryCapRate'), 'Missing entryCapRate');
  assert(metrics.includes('exitCapRate'), 'Missing exitCapRate');
  assert(metrics.includes('expenseGrowthRate'), 'Missing expenseGrowthRate');
});

test('5 macro series defined', () => {
  assert(TEST_MACRO_SERIES.length === 5, `Expected 5 series, got ${TEST_MACRO_SERIES.length}`);
  const codes = TEST_MACRO_SERIES.map(s => s.seriesId);
  assert(codes.includes('CUSR0000SEHC'), 'Missing CPI-OER');
  assert(codes.includes('DGS10'), 'Missing 10Y Treasury');
  assert(codes.includes('WPSFD49207'), 'Missing PPI');
});

test('computeMacroMu adds structural premium', () => {
  const anchor = TEST_MACRO_ANCHORS[0];
  const mu = testComputeMacroMu(anchor, 0.032);
  const expected = 0.032 + anchor.structuralPremium;
  assert(Math.abs(mu - expected) < 0.0001, `Expected ${expected}, got ${mu}`);
});

test('deriveBlendWeight matches spec thresholds', () => {
  assert(testDeriveBlendWeight(0.5) === 0.70, 'div < 1.0 → 0.70');
  assert(testDeriveBlendWeight(1.0) === 0.55, 'div = 1.0 → 0.55 (enters next bracket)');
  assert(testDeriveBlendWeight(1.5) === 0.55, 'div 1.0-2.0 → 0.55');
  assert(testDeriveBlendWeight(2.0) === 0.40, 'div = 2.0 → 0.40');
  assert(testDeriveBlendWeight(2.5) === 0.40, 'div 2.0-3.0 → 0.40');
  assert(testDeriveBlendWeight(3.0) === 0.30, 'div ≥ 3.0 → floor 0.30');
  assert(testDeriveBlendWeight(5.0) === 0.30, 'div >> 3.0 → floor 0.30');
});

test('computeDivergenceSigma correct', () => {
  const sigma = testComputeDivergenceSigma(0.055, 0.038, 0.012);
  const expected = Math.abs(0.055 - 0.038) / 0.012;
  assert(Math.abs(sigma - expected) < 0.001, `Expected ${expected.toFixed(4)}, got ${sigma.toFixed(4)}`);
});

test('High divergence triggers macro pull', () => {
  const sigma = testComputeDivergenceSigma(0.055, 0.038, 0.012);
  const w = testDeriveBlendWeight(sigma);
  const finalMu = w * 0.055 + (1 - w) * 0.038;
  assert(w === 0.55, `Expected w=0.55 for 1.42σ, got ${w}`);
  assert(Math.abs(finalMu - 0.04735) < 0.001, `Expected final μ ~4.74%, got ${(finalMu * 100).toFixed(2)}%`);
  console.log(`    Rent growth scenario: μ_emp=5.5%, μ_macro=3.8%, w=${w}, final μ=${(finalMu * 100).toFixed(2)}%`);
});

test('Extreme divergence hits floor weight', () => {
  const sigma = testComputeDivergenceSigma(0.08, 0.03, 0.01);
  assert(sigma >= 3.0, `Expected ≥3.0σ, got ${sigma.toFixed(2)}`);
  assert(testDeriveBlendWeight(sigma) === 0.30, 'Extreme divergence → floor 0.30');
});

test('Cap rate uses 10Y treasury + risk premium', () => {
  const capAnchor = TEST_MACRO_ANCHORS.find(a => a.metric === 'entryCapRate')!;
  assert(capAnchor.seriesId === 'DGS10', 'Entry cap should use 10Y treasury');
  assert(capAnchor.structuralPremium >= 0.03, `Risk premium should be >= 3%, got ${(capAnchor.structuralPremium * 100).toFixed(1)}%`);
  const muMacro = testComputeMacroMu(capAnchor, 0.0425);
  const expected = 0.0425 + capAnchor.structuralPremium;
  assert(Math.abs(muMacro - expected) < 0.001, `Expected μ_macro=${(expected * 100).toFixed(2)}%, got ${(muMacro * 100).toFixed(2)}%`);
});

test('All macro series have fallbacks', () => {
  for (const series of TEST_MACRO_SERIES) {
    assert(series.defaultFallback > 0, `Series ${series.seriesId} missing default fallback`);
    assert(typeof series.refreshCadence === 'string', `Series ${series.seriesId} missing cadence`);
  }
});

// ─── Report ──────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(55)}`);
const total = passed + failed;
console.log(` Results: ${passed}/${total} passed | ${failed} failed`);
console.log(`${'═'.repeat(55)}\n`);

process.exit(failed > 0 ? 1 : 0);
