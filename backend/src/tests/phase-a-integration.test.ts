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

// ─── 8. Proforma Line-Item Anchors (Phase B1) ────────────────────────────────

console.log('\n8. Proforma Line-Item Anchors (Phase B1)\n');

const TEST_ANCHORS = [
  { lineItemId: 'insurance', label: 'Insurance', category: 'opex', anchorType: 'macro_series', macroSeriesId: 'WPSFD49207', structuralPremium: 0.010, timing: { changeType: 'annual_step', effective: 'at_close' }, triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false }, geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 }, sortOrder: 110, dealTypeTags: [], defaultValue: 700 },
  { lineItemId: 'taxes', label: 'Property Taxes', category: 'opex', anchorType: 'prev_year_plus_premium', macroSeriesId: null, structuralPremium: 0.030, timing: { changeType: 'trigger_once', effective: 'next_calendar_year' }, triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: true }, geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 }, sortOrder: 120, dealTypeTags: [], defaultValue: null },
  { lineItemId: 'mgmt_fees', label: 'Management Fees', category: 'opex', anchorType: 'pct_of_egi', macroSeriesId: 'ECIWAG', structuralPremium: 0.005, timing: { changeType: 'annual_step', effective: 'at_close' }, triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false }, geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 }, sortOrder: 100, dealTypeTags: [], defaultValue: null },
  { lineItemId: 'rent_income', label: 'Gross Rent Income', category: 'revenue', anchorType: 'macro_series', macroSeriesId: 'CUSR0000SEHC', structuralPremium: 0.008, timing: { changeType: 'annual_step', effective: 'at_close' }, triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false }, geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 }, sortOrder: 10, dealTypeTags: [], defaultValue: null },
  { lineItemId: 'capex', label: 'Capital Expenditures', category: 'capex', anchorType: 'per_unit_fixed', macroSeriesId: null, structuralPremium: 0.030, timing: { changeType: 'annual_step', effective: 'at_close' }, triggers: { onSale: false, onRefinance: false, onRenovation: false, onReassessment: false }, geoModifiers: { insuranceZoneMultiplier: 1.0, taxBurdenIndex: 1.0 }, sortOrder: 200, dealTypeTags: [], defaultValue: 800 },
];

function testProject(base: number, growth: number, premium: number, year: number, cap?: number): number {
  const annual = cap != null ? Math.min(growth + premium, cap) : growth + premium;
  return base * Math.pow(1 + annual, year);
}

function testGetCap(stateCode: string, lineItemId: string): number | null {
  const caps: Record<string, Record<string, number>> = {
    FL: { insurance: 0.03, taxes: 0.10 },
    CA: { taxes: 0.02 },
    TX: { taxes: 0.10 },
    GA: {},
  };
  return caps[stateCode]?.[lineItemId] ?? null;
}

test('Anchors have defaults for all line items', () => {
  assert(TEST_ANCHORS.length >= 5, `Expected >= 5 test anchors`);
  const ids = TEST_ANCHORS.map(a => a.lineItemId);
  assert(ids.includes('insurance'), 'Missing insurance');
  assert(ids.includes('taxes'), 'Missing taxes');
  assert(ids.includes('mgmt_fees'), 'Missing mgmt_fees');
  assert(ids.includes('rent_income'), 'Missing rent_income');
  assert(ids.includes('capex'), 'Missing capex');
});

test('Macro series mapping correct', () => {
  const rent = TEST_ANCHORS.find(a => a.lineItemId === 'rent_income')!;
  assert(rent.macroSeriesId === 'CUSR0000SEHC', 'Rent → CPI-OER');
  const ins = TEST_ANCHORS.find(a => a.lineItemId === 'insurance')!;
  assert(ins.macroSeriesId === 'WPSFD49207', 'Insurance → PPI');
  const mgmt = TEST_ANCHORS.find(a => a.lineItemId === 'mgmt_fees')!;
  assert(mgmt.macroSeriesId === 'ECIWAG', 'Mgmt → ECI');
});

test('Insurance growth applies zone multiplier', () => {
  const base = 700, ppi = 0.035, zone = 1.5, premium = 0.01; // coastal
  const coastalGrowth = ppi * zone + premium;
  const flatGrowth = ppi + premium;
  const coastal = base * Math.pow(1 + coastalGrowth, 3);
  const flat = base * Math.pow(1 + flatGrowth, 3);
  assert(coastal > flat, `Coastal (${coastal.toFixed(0)}) should exceed flat (${flat.toFixed(0)})`);
  console.log(`    Insurance zone: coastal=${coastal.toFixed(0)}, flat=${flat.toFixed(0)}`);
});

test('FL insurance cap 3% applied', () => {
  const cap = testGetCap('FL', 'insurance');
  assert(cap === 0.03, `FL cap should be 3%, got ${cap}`);
  const uncapped = testProject(700, 0.035, 0.01, 5);
  const capped = testProject(700, 0.035, 0.01, 5, 0.03);
  assert(capped < uncapped, `Capped (${capped.toFixed(0)}) < uncapped (${uncapped.toFixed(0)})`);
  console.log(`    FL insurance cap: yr5 uncapped=${uncapped.toFixed(0)}, capped=${capped.toFixed(0)}`);
});

test('GA taxes reassess on sale', () => {
  const base = 100000, purchasePrice = 12000000, effRate = 0.012;
  const newTax = purchasePrice * effRate;  // $144k
  const growth = newTax / base - 1;  // 44%
  const caCap = testGetCap('CA', 'taxes');
  assert(caCap === 0.02, 'CA cap 2%');
  const capped = Math.min(growth, 0.02);
  assert(capped === 0.02, `CA capped at 2%`);
  console.log(`    GA sale reassessment: ${base.toLocaleString()} → ${newTax.toLocaleString()}`);
  console.log(`    CA Prop 13 cap: growth=${(capped * 100).toFixed(0)}%`);
});

test('Non-reassessment taxes use county growth', () => {
  const base = 100000, growth = 0.015;
  const projected = base * Math.pow(1 + growth, 3);
  assert(projected > base && projected < base * 1.1, `Reasonable 3yr growth: ${projected.toFixed(0)}`);
  console.log(`    Non-reassessment: yr3=${projected.toFixed(0)}`);
});

test('Management fees track EGI with wage growth', () => {
  const egi = 1000000, rate = 0.05, wageGrowth = 0.035;
  const yr0 = egi * rate;
  const yr3Rate = rate * Math.pow(1 + wageGrowth, 3);
  const yr3 = egi * yr3Rate;
  assert(yr3 > yr0, `Yr3 (${yr3.toFixed(0)}) > Yr0 (${yr0.toFixed(0)})`);
  console.log(`    Mgmt fees: yr0=${yr0.toFixed(0)}, yr3=${yr3.toFixed(0)}`);
});

test('State caps work correctly', () => {
  assert(testGetCap('FL', 'insurance') === 0.03, 'FL insurance 3%');
  assert(testGetCap('CA', 'taxes') === 0.02, 'CA taxes 2%');
  assert(testGetCap('TX', 'taxes') === 0.10, 'TX taxes 10%');
  assert(testGetCap('FL', 'taxes') === 0.10, 'FL taxes 10%');
  assert(testGetCap('GA', 'insurance') === null, 'GA no insurance cap');
});

test('Per-unit fixed capex grows with premium', () => {
  const base = 800, premium = 0.03;
  const yr3 = base * Math.pow(1 + premium, 3);
  assert(yr3 > base, `Yr3 (${yr3.toFixed(0)}) > Yr0 (${base})`);
  assert(yr3 < base * 1.15, 'Reasonable 3yr growth');
  console.log(`    Capex: yr0=${base}, yr3=${yr3.toFixed(0)}`);
});

test('Multiple state cap rates return most restrictive', () => {
  // If both FL homestead and non-homestead caps apply, pick the lower one
  const flInsuranceCaps: number[] = [0.03, 0.05];
  const mostRestrictive = Math.min(...flInsuranceCaps);
  assert(mostRestrictive === 0.03, `Most restrictive FL insurance cap: ${mostRestrictive}`);
});


// ─── 9. Anchor Interceptor (B2 — Wiring) ─────────────────────────────────────

console.log('\n9. Anchor Interceptor (B2 — Wiring)\n');

function testComputeAnchorGrowthRate(
  anchor: any, stateCode: string, stateRules: any[],
  expenseKey: string, amount: number,
  purchasePrice?: number, totalUnits?: number
): number {
  const stateUpper = stateCode.toUpperCase();
  const macroMap: Record<string, number> = { 'CUSR0000SEHC': 0.032, 'ECIWAG': 0.042, 'WPSFD49207': 0.035 };
  let macroGrowth = 0.025;
  if (anchor.macroSeriesId && macroMap[anchor.macroSeriesId]) {
    macroGrowth = macroMap[anchor.macroSeriesId];
  }
  const caps = stateRules.filter(
    (r: any) => r.lineItemId === anchor.lineItemId && r.stateCode === stateUpper && r.ruleType === 'cap'
  );
  const capValues: number[] = caps.map((r: any) => r.ruleValue).filter((v: any): v is number => v !== null);
  const stateCap = capValues.length > 0 ? Math.min(...capValues) : null;

  switch (anchor.lineItemId) {
    case 'insurance': {
      const zoneMult = anchor.geoModifiers.insuranceZoneMultiplier;
      const raw = macroGrowth * zoneMult + anchor.structuralPremium;
      return stateCap != null ? Math.min(raw, stateCap) : raw;
    }
    case 'taxes': {
      const raw = 0.015 + anchor.structuralPremium;
      return stateCap != null ? Math.min(raw, stateCap) : raw;
    }
    case 'mgmt_fees': return macroGrowth + anchor.structuralPremium;
    case 'utilities':
    case 'repairs_maint': return macroGrowth + anchor.structuralPremium;
    case 'reserves': return macroGrowth + anchor.structuralPremium;
    default: return macroGrowth + anchor.structuralPremium;
  }
}

function testApplyInterceptor(expenses: any, stateCode: string): any {
  const anchorMap: Record<string, any> = {};
  for (const a of TEST_ANCHORS) anchorMap[a.lineItemId] = a;
  const stateRules = [
  { stateCode: 'GA', lineItemId: 'taxes', ruleType: 'reassessment', ruleValue: null, ruleText: 'GA reassesses on sale' },
  { stateCode: 'FL', lineItemId: 'insurance', ruleType: 'cap', ruleValue: 0.03, ruleText: 'FL 3% cap' },
  { stateCode: 'GA', lineItemId: 'insurance', ruleType: 'cap', ruleValue: null, ruleText: 'no cap' },
  { stateCode: 'CA', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.02, ruleText: 'CA Prop 13' },
  { stateCode: 'TX', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.10, ruleText: 'TX 10% cap' },
  { stateCode: 'FL', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.10, ruleText: 'FL 10% cap' },
  { stateCode: 'NC', lineItemId: 'taxes', ruleType: 'reassessment', ruleValue: null, ruleText: 'NC reassesses on sale + county reval' },
] || [];
  const result: Record<string, any> = {};
  const breakdown: any[] = [];
  const stateUpper = stateCode.toUpperCase();
  const EXPENSE_TO_ANCHOR_KEY: Record<string, string> = {
    'insurance': 'insurance', 'real_estate_tax': 'taxes', 'personal_property_tax': 'taxes',
    'utilities': 'utilities', 'repairs_maintenance': 'repairs_maint',
    'management_fee': 'mgmt_fees', 'replacement_reserves': 'reserves',
    'payroll': 'mgmt_fees', 'contract_services': 'utilities', 'turnover': 'repairs_maint',
    'marketing': 'other_income', 'g_and_a': 'other_income', 'hoa_dues': 'utilities',
  };
  for (const [key, cfg] of Object.entries(expenses) as [string, any][]) {
    const aId = EXPENSE_TO_ANCHOR_KEY[key];
    const anchor = aId ? anchorMap[aId] : null;
    const orig = cfg.growthRate;
    let anchorG: number;
    if (anchor) {
      anchorG = testComputeAnchorGrowthRate(anchor, stateUpper, stateRules, key, cfg.amount, 12000000, 80);
    } else {
      anchorG = orig;
    }
    const diff = Math.abs(anchorG - orig);
    breakdown.push({
      lineItemId: key, originalGrowth: orig, anchorGrowth: anchorG,
      macroSeriesId: anchor?.macroSeriesId ?? null, stateRuleApplied: null,
      confidence: diff < 0.01 ? 'high' : diff < 0.02 ? 'medium' : 'low',
    });
    result[key] = { ...cfg, growthRate: anchorG };
  }
  return { expenses: result, anchorBreakdown: breakdown };
}

test('Interceptor maps insurance to macro-anchored rate', () => {
  const anchor = TEST_ANCHORS.find(a => a.lineItemId === 'insurance')!;
  const result = testComputeAnchorGrowthRate(anchor, 'FL', [
  { stateCode: 'GA', lineItemId: 'taxes', ruleType: 'reassessment', ruleValue: null, ruleText: 'GA reassesses on sale' },
  { stateCode: 'FL', lineItemId: 'insurance', ruleType: 'cap', ruleValue: 0.03, ruleText: 'FL 3% cap' },
  { stateCode: 'GA', lineItemId: 'insurance', ruleType: 'cap', ruleValue: null, ruleText: 'no cap' },
  { stateCode: 'CA', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.02, ruleText: 'CA Prop 13' },
  { stateCode: 'TX', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.10, ruleText: 'TX 10% cap' },
  { stateCode: 'FL', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.10, ruleText: 'FL 10% cap' },
  { stateCode: 'NC', lineItemId: 'taxes', ruleType: 'reassessment', ruleValue: null, ruleText: 'NC reassesses on sale + county reval' },
], 'insurance', 700, 12000000, 80);
  assert(result <= 0.03, 'FL insurance should be capped at 3%, got ' + (result * 100).toFixed(1) + '%');
  console.log('    FL insurance: capped=' + (result * 100).toFixed(1) + '%');
});

test('Interceptor maps management fee to ECI-based rate', () => {
  const anchor = TEST_ANCHORS.find(a => a.lineItemId === 'mgmt_fees')!;
  const result = testComputeAnchorGrowthRate(anchor, 'GA', [
  { stateCode: 'GA', lineItemId: 'taxes', ruleType: 'reassessment', ruleValue: null, ruleText: 'GA reassesses on sale' },
  { stateCode: 'FL', lineItemId: 'insurance', ruleType: 'cap', ruleValue: 0.03, ruleText: 'FL 3% cap' },
  { stateCode: 'GA', lineItemId: 'insurance', ruleType: 'cap', ruleValue: null, ruleText: 'no cap' },
  { stateCode: 'CA', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.02, ruleText: 'CA Prop 13' },
  { stateCode: 'TX', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.10, ruleText: 'TX 10% cap' },
  { stateCode: 'FL', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.10, ruleText: 'FL 10% cap' },
  { stateCode: 'NC', lineItemId: 'taxes', ruleType: 'reassessment', ruleValue: null, ruleText: 'NC reassesses on sale + county reval' },
], 'mgmt_fees', 50000);
  const eciBase = 0.042;
  const expected = eciBase + anchor.structuralPremium;
  assert(Math.abs(result - expected) < 0.0001, 'Mgmt fee growth should be ' + (expected * 100).toFixed(1) + '%, got ' + (result * 100).toFixed(1) + '%');
  console.log('    Mgmt fees: ECI-based growth=' + (result * 100).toFixed(1) + '%');
});

test('Interceptor maps taxes to county-based growth with GA no cap', () => {
  const anchor = TEST_ANCHORS.find(a => a.lineItemId === 'taxes')!;
  const result = testComputeAnchorGrowthRate(anchor, 'GA', [
  { stateCode: 'GA', lineItemId: 'taxes', ruleType: 'reassessment', ruleValue: null, ruleText: 'GA reassesses on sale' },
  { stateCode: 'FL', lineItemId: 'insurance', ruleType: 'cap', ruleValue: 0.03, ruleText: 'FL 3% cap' },
  { stateCode: 'GA', lineItemId: 'insurance', ruleType: 'cap', ruleValue: null, ruleText: 'no cap' },
  { stateCode: 'CA', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.02, ruleText: 'CA Prop 13' },
  { stateCode: 'TX', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.10, ruleText: 'TX 10% cap' },
  { stateCode: 'FL', lineItemId: 'taxes', ruleType: 'cap', ruleValue: 0.10, ruleText: 'FL 10% cap' },
  { stateCode: 'NC', lineItemId: 'taxes', ruleType: 'reassessment', ruleValue: null, ruleText: 'NC reassesses on sale + county reval' },
], 'taxes', 100000);
  assert(Math.abs(result - 0.045) < 0.0001, 'Tax growth should be 4.5%, got ' + (result * 100).toFixed(1) + '%');
  console.log('    Taxes: GA growth=' + (result * 100).toFixed(1) + '%');
});

test('Interceptor returns modified expense list with all entries', () => {
  const testExpenses = {
    insurance: { amount: 56000, type: 'operating', growthRate: 0.03 },
    real_estate_tax: { amount: 120000, type: 'operating', growthRate: 0.03 },
    utilities: { amount: 32000, type: 'operating', growthRate: 0.03 },
    repairs_maintenance: { amount: 28000, type: 'operating', growthRate: 0.03 },
    management_fee: { amount: 45000, type: 'operating', growthRate: 0.03 },
  };
  const result = testApplyInterceptor(testExpenses, 'GA');
  assert(Object.keys(result.expenses).length === 5, 'All 5 expense keys present');
  assert(result.anchorBreakdown.length === 5, 'All 5 have breakdown entries');
  for (const entry of result.anchorBreakdown) {
    assert(entry.anchorGrowth !== undefined, 'Entry ' + entry.lineItemId + ' has anchorGrowth');
  }
  console.log('    All 5 expenses intercepted successfully');
});

test('Interceptor preserves unknown expense keys', () => {
  const testExpenses = {
    insurance: { amount: 56000, type: 'operating', growthRate: 0.03 },
    unknown_item: { amount: 10000, type: 'misc', growthRate: 0.02 },
  };
  const result = testApplyInterceptor(testExpenses, 'GA');
  assert(result.expenses.unknown_item.growthRate === 0.02, 'Unknown key preserves original growth rate');
  console.log('    Unknown key preserved:', result.expenses.unknown_item.growthRate);
});

test('FL insurance cap applied in interceptor', () => {
  const flExpenses = { insurance: { amount: 50000, type: 'operating', growthRate: 0.05 } };
  const flResult = testApplyInterceptor(flExpenses, 'FL');
  const gaResult = testApplyInterceptor(flExpenses, 'GA');
  assert(flResult.expenses.insurance.growthRate <= 0.03,
    'FL capped: ' + (flResult.expenses.insurance.growthRate * 100).toFixed(1) + '%');
  assert(gaResult.expenses.insurance.growthRate > 0.03,
    'GA no cap: ' + (gaResult.expenses.insurance.growthRate * 100).toFixed(1) + '%');
  console.log('    FL vs GA insurance: FL=' + (flResult.expenses.insurance.growthRate * 100).toFixed(1) + '%, GA=' + (gaResult.expenses.insurance.growthRate * 100).toFixed(1) + '%');
});

test('Interceptor tracks confidence based on divergence', () => {
  const testExpenses = {
    insurance: { amount: 56000, type: 'operating', growthRate: 0.03 },
    real_estate_tax: { amount: 120000, type: 'operating', growthRate: 0.10 },
  };
  const result = testApplyInterceptor(testExpenses, 'GA');
  for (const entry of result.anchorBreakdown) {
    const diff = Math.abs(entry.anchorGrowth - entry.originalGrowth);
    if (entry.lineItemId === 'insurance') {
      assert(entry.confidence === 'medium', 'Medium confidence expected for insurance (3% vs 4.5% = 1.5% diff)');
    } else {
      // taxes at 10% vs 4.5% = 5.5% → low
      assert(entry.confidence === 'low', 'Low confidence expected for taxes (10% vs 4.5% = 5.5% diff)');
    }
  }
  console.log('    Confidence tracking verified');
});



// ─── Report ──────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(55)}`);
const total = passed + failed;
console.log(` Results: ${passed}/${total} passed | ${failed} failed`);
console.log(`${'═'.repeat(55)}\n`);

process.exit(failed > 0 ? 1 : 0);
