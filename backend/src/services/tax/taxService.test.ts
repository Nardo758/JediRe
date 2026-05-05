/**
 * taxService.forecast() — regression tests (Phase 2 + Phase 3)
 *
 * Verifies:
 *  Phase 2:
 *  1. Byte-identical output for identical TaxContext inputs (determinism requirement)
 *  2. Section C bonus depreciation schedule matches federal-2026.json (2025→0.40, 2026→0.20, 2027→0.00)
 *  3. Section C depreciation life: multifamily=27.5yr, office=39yr
 *  4. Federal income tax rates by entity type (c_corp=0.21, reit=0.00, pass_through=0.2968)
 *  5. effectiveCombinedRate = federalIncomeTaxRate + stateIncomeTaxRate
 *  6. depreciableBase and annualDepreciation arithmetic
 *  7. costSegAvailablePct > 0 for all standard asset classes
 *  8. landAllocationPct echoed correctly
 *
 *  Phase 3 (Section B + C rulesets, county overlays):
 *  9.  GA state income tax rate = 5.39% for all entity types (SB 56 flat)
 * 10.  GA conformsToBonusDep = false (GA decouples from IRC §168(k))
 * 11.  TX stateIncomeTaxRate = 0 for all entity types (no TX income tax)
 * 12.  TX conformsToBonusDep = true
 * 13.  FL c_corp stateIncomeTaxRate = 5.5%; all others = 0
 * 14.  FL conformsToBonusDep = true
 * 15.  Miami-Dade county overlay — millage from fl-miami-dade-2026.json (19.8344)
 * 16.  Miami-Dade county surtax math: $50M → $350K state deed stamp + $225K county surtax = $575K
 * 17.  Broward overlay — millage = 19.5073 mills from fl-broward-2026.json
 * 18.  Palm Beach overlay — millage = 21.2765 mills from fl-palm-beach-2026.json
 * 19.  Fulton County overlay — millage = 11.60 mills from ga-fulton-2026.json
 * 20.  Harris County overlay — millage = 22.00 mills from tx-harris-2026.json
 * 21.  jurisdictionMapped = true for FL, GA, TX; false for unknown state
 * 22.  confidence = 'high' with county overlay; 'medium' state-only; 'low' unmapped
 * 23.  FL TPP tppExemptionAmount = $25,000 from fl-2026.json
 * 24.  GA TPP tppExemptionAmount = $7,500 from ga-2026.json
 * 25.  TX TPP tppExemptionAmount = $0 from tx-2026.json
 *
 * Run: npx ts-node src/services/tax/taxService.test.ts
 */

import { taxService } from './taxService';
import { _resetLoaderForTests, initRateSheets } from './rateSheets/loader';
import { resolveRulesetStack } from './resolver';
import type { TaxContext } from './types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  assert(ok, label, ok ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertClose(actual: number, expected: number, label: string, tol = 1e-9): void {
  const ok = Math.abs(actual - expected) <= tol;
  assert(ok, label, ok ? undefined : `expected ${expected}, got ${actual}`);
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

const BASE_CTX: TaxContext = {
  state: 'FL',
  county: null,
  city: null,
  purchasePrice: 10_000_000,
  loanAmount: 7_000_000,
  assessedValueOverride: null,
  millageRateOverride: null,
  countyOverride: null,
  units: 100,
  t12AnnualTax: 120_000,
  holdYears: 5,
  isRefi: false,
  refiEnabled: false,
  refiTriggerYear: 3,
  refiNewLoanType: null,
  propertyType: 'multifamily',
  entityType: 'pass_through',
  placedInServiceYear: 2026,
  landAllocationPct: 0.20,
};

const GA_CTX: TaxContext = { ...BASE_CTX, state: 'GA', county: null, city: null, loanAmount: null };
const TX_CTX: TaxContext = { ...BASE_CTX, state: 'TX', county: null, city: null, loanAmount: null };

function run(): void {
  console.log('\n[taxService.test] taxService.forecast() determinism, Phase 2 & Phase 3 tests\n');

  _resetLoaderForTests();
  initRateSheets();

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — SECTION C DETERMINISM & FEDERAL RATES
  // ══════════════════════════════════════════════════════════════════════════
  console.log('── Phase 2: Determinism & Section C ──────────────────────────────');

  // 1. Determinism
  const run1 = taxService.forecast({ ...BASE_CTX });
  const run2 = taxService.forecast({ ...BASE_CTX });
  assertEq(
    JSON.stringify(run1.sectionC),
    JSON.stringify(run2.sectionC),
    'Identical inputs → byte-identical sectionC output (determinism)',
  );
  assertEq(
    JSON.stringify(run1.reTax),
    JSON.stringify(run2.reTax),
    'Identical inputs → byte-identical reTax output (determinism)',
  );

  // 2. Bonus depreciation schedule
  const bonusCases: Array<[number, number]> = [
    [2022, 1.00],
    [2023, 0.80],
    [2024, 0.60],
    [2025, 0.40],
    [2026, 0.20],
    [2027, 0.00],
  ];
  for (const [year, expectedPct] of bonusCases) {
    const f = taxService.forecast({ ...BASE_CTX, placedInServiceYear: year });
    assertClose(
      f.sectionC.bonusDepreciationCurrentYearPct,
      expectedPct,
      `Bonus dep pct for placed-in-service ${year} = ${expectedPct}`,
    );
  }

  // 3. Depreciation life by asset class
  const deprecLifeCases: Array<[TaxContext['propertyType'], number]> = [
    ['multifamily', 27.5],
    ['sfr',         27.5],
    ['retail',      39],
    ['office',      39],
    ['industrial',  39],
    ['hospitality', 39],
  ];
  for (const [assetClass, expectedLife] of deprecLifeCases) {
    const depBase = 10_000_000 * 0.80;
    const expectedAnnual = Math.round(depBase / expectedLife);
    const f = taxService.forecast({ ...BASE_CTX, propertyType: assetClass });
    assertClose(
      f.sectionC.annualDepreciation ?? -1,
      expectedAnnual,
      `annualDepreciation for ${assetClass} = depBase / ${expectedLife} = ${expectedAnnual}`,
    );
  }

  // 4. Federal income tax rates by entity type
  const federalRateCases: Array<[TaxContext['entityType'], number]> = [
    ['c_corp',       0.21],
    ['reit',         0.00],
    ['pass_through', 0.2968],
    ['partnership',  0.2968],
    ['individual',   0.2968],
  ];
  for (const [entityType, expectedRate] of federalRateCases) {
    const f = taxService.forecast({ ...BASE_CTX, entityType });
    assertClose(
      f.sectionC.federalIncomeTaxRate,
      expectedRate,
      `federalIncomeTaxRate for ${entityType} = ${expectedRate}`,
    );
    // FL state income tax: c_corp = 5.5% (FL corporate income tax); all others = 0
    const flStateRate = entityType === 'c_corp' ? 0.055 : 0;
    assertClose(
      f.sectionC.stateIncomeTaxRate,
      flStateRate,
      `stateIncomeTaxRate for FL/${entityType} = ${flStateRate}`,
      1e-4,
    );
    assertClose(
      f.sectionC.effectiveCombinedRate,
      expectedRate + flStateRate,
      `effectiveCombinedRate for FL/${entityType} = ${expectedRate + flStateRate}`,
      1e-4,
    );
  }

  // 5. depreciableBase arithmetic
  {
    const purchasePrice = 8_000_000;
    const landPct = 0.25;
    const expectedBase = Math.round(purchasePrice * (1 - landPct));
    const f5 = taxService.forecast({ ...BASE_CTX, purchasePrice, landAllocationPct: landPct });
    assertEq(f5.sectionC.depreciableBase, expectedBase, `depreciableBase = purchasePrice × (1 - landAllocationPct)`);
    assertEq(
      f5.sectionC.annualDepreciation,
      Math.round(expectedBase / 27.5),
      `annualDepreciation = depreciableBase / 27.5 (multifamily)`,
    );
  }

  // 6. Null purchasePrice → null depreciableBase / annualDepreciation
  const fNull = taxService.forecast({ ...BASE_CTX, purchasePrice: null });
  assert(fNull.sectionC.depreciableBase   === null, 'depreciableBase = null when purchasePrice = null');
  assert(fNull.sectionC.annualDepreciation === null, 'annualDepreciation = null when purchasePrice = null');

  // 7. costSegAvailablePct > 0 for all standard asset classes
  for (const assetClass of ['multifamily', 'sfr', 'retail', 'office', 'industrial', 'hospitality'] as const) {
    const f = taxService.forecast({ ...BASE_CTX, propertyType: assetClass });
    assert(f.sectionC.costSegAvailablePct > 0, `costSegAvailablePct > 0 for ${assetClass}`);
  }

  // 8. landAllocationPct echoed
  const fLand = taxService.forecast({ ...BASE_CTX, landAllocationPct: 0.30 });
  assertClose(fLand.sectionC.landAllocationPct, 0.30, 'landAllocationPct echoed from ctx');

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 3 — STATE RULESETS (B + C) + COUNTY OVERLAYS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n── Phase 3: State Rulesets B+C & County Overlays ─────────────────');

  // 9. GA state income tax rates by entity type
  //    SB 56 flat rate: 5.39% for ALL entity types (GA does not carve out REIT treatment)
  const gaStateTaxCases: Array<[TaxContext['entityType'], number]> = [
    ['c_corp',       0.0539],
    ['pass_through', 0.0539],
    ['individual',   0.0539],
    ['partnership',  0.0539],
    ['reit',         0.0539],  // GA SB 56 flat rate applies to all entity types
  ];
  for (const [et, expectedGARate] of gaStateTaxCases) {
    const f = taxService.forecast({ ...GA_CTX, entityType: et });
    assertClose(
      f.sectionC.stateIncomeTaxRate,
      expectedGARate,
      `GA stateIncomeTaxRate for ${et} = ${expectedGARate}`,
      1e-4,
    );
  }

  // 10. GA conformsToBonusDep = false (decouples from IRC §168(k))
  {
    const f = taxService.forecast({ ...GA_CTX });
    assert(f.sectionC.conformsToBonusDep === false, 'GA conformsToBonusDep = false (GA decouples from §168(k))');
    assert(f.sectionC.conformsToCostSeg  === true,  'GA conformsToCostSeg = true');
  }

  // 11. TX stateIncomeTaxRate = 0 for all entity types
  const allEntityTypes: Array<TaxContext['entityType']> = ['c_corp', 'pass_through', 'individual', 'reit', 'partnership'];
  for (const et of allEntityTypes) {
    const f = taxService.forecast({ ...TX_CTX, entityType: et });
    assertClose(
      f.sectionC.stateIncomeTaxRate,
      0,
      `TX stateIncomeTaxRate for ${et} = 0`,
    );
  }

  // 12. TX conformsToBonusDep = true
  {
    const f = taxService.forecast({ ...TX_CTX });
    assert(f.sectionC.conformsToBonusDep === true, 'TX conformsToBonusDep = true');
  }

  // 13. FL c_corp stateIncomeTaxRate = 5.5%; others = 0
  {
    const fCCorp = taxService.forecast({ ...BASE_CTX, entityType: 'c_corp' });
    assertClose(fCCorp.sectionC.stateIncomeTaxRate, 0.055, 'FL c_corp stateIncomeTaxRate = 5.5%', 1e-4);
    const fPT = taxService.forecast({ ...BASE_CTX, entityType: 'pass_through' });
    assertClose(fPT.sectionC.stateIncomeTaxRate, 0, 'FL pass_through stateIncomeTaxRate = 0');
    const fREIT = taxService.forecast({ ...BASE_CTX, entityType: 'reit' });
    assertClose(fREIT.sectionC.stateIncomeTaxRate, 0, 'FL reit stateIncomeTaxRate = 0');
  }

  // 14. FL conformsToBonusDep = true
  {
    const f = taxService.forecast({ ...BASE_CTX });
    assert(f.sectionC.conformsToBonusDep === true, 'FL conformsToBonusDep = true');
  }

  // 15. Miami-Dade county overlay millage = 19.8344
  {
    const f = taxService.forecast({ ...BASE_CTX, county: 'Miami-Dade', purchasePrice: 10_000_000, t12AnnualTax: null });
    const y1 = f.reTax.perYear[0];
    assertClose(
      y1.millageRate,
      19.8344,
      `Miami-Dade Y1 millage = 19.8344 (from fl-miami-dade-2026.json)`,
      0.0001,
    );
    assert(f.confidence === 'high', 'confidence = high when county overlay present (Miami-Dade)');
  }

  // 16. Miami-Dade county surtax math: $50M → $350K state deed stamp + $225K county surtax = $575K
  {
    const f = taxService.forecast({
      ...BASE_CTX,
      county: 'Miami-Dade',
      purchasePrice: 50_000_000,
      loanAmount: null,
      t12AnnualTax: null,
    });
    const tt = f.transferTax;
    assertClose(tt.docStampAmount   ?? -1, 350_000, 'Miami-Dade $50M → state deed stamp = $350K (0.70%)');
    assertClose(tt.countySurtaxAmount ?? -1, 225_000, 'Miami-Dade $50M → county surtax = $225K (0.45%)');
    assertClose(tt.totalTransferTax  ?? -1, 575_000, 'Miami-Dade $50M → total transfer tax = $575K (1.15%)');
  }

  // 17. Broward overlay millage = 19.5073
  {
    const f = taxService.forecast({ ...BASE_CTX, county: 'Broward', purchasePrice: 10_000_000, t12AnnualTax: null, loanAmount: null });
    const y1 = f.reTax.perYear[0];
    assertClose(y1.millageRate, 19.5073, 'Broward Y1 millage = 19.5073 (from fl-broward-2026.json)', 0.0001);
    assert(f.confidence === 'high', 'confidence = high when county overlay present (Broward)');
    // Broward has no county surtax
    assert(
      f.transferTax.countySurtaxAmount == null || f.transferTax.countySurtaxAmount === 0,
      'Broward countySurtaxAmount = null (no county deed stamp surtax for Broward)',
    );
  }

  // 18. Palm Beach overlay millage = 21.2765
  {
    const f = taxService.forecast({ ...BASE_CTX, county: 'Palm Beach', purchasePrice: 10_000_000, t12AnnualTax: null, loanAmount: null });
    const y1 = f.reTax.perYear[0];
    assertClose(y1.millageRate, 21.2765, 'Palm Beach Y1 millage = 21.2765 (from fl-palm-beach-2026.json)', 0.0001);
  }

  // 19. Fulton County overlay millage = 11.60
  {
    const f = taxService.forecast({ ...GA_CTX, county: 'Fulton', purchasePrice: 10_000_000, t12AnnualTax: null });
    const y1 = f.reTax.perYear[0];
    assertClose(y1.millageRate, 11.60, 'Fulton County Y1 millage = 11.60 (from ga-fulton-2026.json)', 0.01);
    assert(f.confidence === 'high', 'confidence = high when county overlay present (Fulton)');
  }

  // 20. Harris County overlay millage = 22.00
  {
    const f = taxService.forecast({ ...TX_CTX, county: 'Harris', purchasePrice: 10_000_000, t12AnnualTax: null });
    const y1 = f.reTax.perYear[0];
    assertClose(y1.millageRate, 22.00, 'Harris County Y1 millage = 22.00 (from tx-harris-2026.json)', 0.01);
    assert(f.confidence === 'high', 'confidence = high when county overlay present (Harris)');
  }

  // 21. jurisdictionMapped flags
  {
    const flForecast = taxService.forecast({ ...BASE_CTX });
    assert(flForecast.jurisdictionMapped === true,  'FL jurisdictionMapped = true');
    const gaForecast = taxService.forecast({ ...GA_CTX });
    assert(gaForecast.jurisdictionMapped === true,  'GA jurisdictionMapped = true');
    const txForecast = taxService.forecast({ ...TX_CTX });
    assert(txForecast.jurisdictionMapped === true,  'TX jurisdictionMapped = true');
    const unknownForecast = taxService.forecast({ ...BASE_CTX, state: 'ZZ' });
    assert(unknownForecast.jurisdictionMapped === false, 'ZZ (unknown state) jurisdictionMapped = false');
  }

  // 22. confidence level tiers
  {
    const flMD   = taxService.forecast({ ...BASE_CTX, county: 'Miami-Dade' });
    const flOnly = taxService.forecast({ ...BASE_CTX, county: null });
    const unknown = taxService.forecast({ ...BASE_CTX, state: 'ZZ' });
    assertEq(flMD.confidence,   'high',   'confidence = high with county overlay');
    assertEq(flOnly.confidence, 'medium', 'confidence = medium state-only');
    assertEq(unknown.confidence,'low',    'confidence = low unmapped jurisdiction');
  }

  // 23. FL TPP tppExemptionAmount = $25,000
  {
    const stack = resolveRulesetStack('FL', null);
    assertEq(stack.state.tppExemptionAmount(), 25000, 'FL tppExemptionAmount = $25,000 from fl-2026.json');
    assert(stack.state.taxesTPP() === true, 'FL taxesTPP() = true');
    const filingReq = stack.state.tppFilingRequirement();
    assert(filingReq?.formName === 'DR-405', 'FL TPP filing form = DR-405');
    assert(filingReq?.deadline === 'April 1', 'FL TPP deadline = April 1');
  }

  // 24. GA TPP tppExemptionAmount = $7,500
  {
    const stack = resolveRulesetStack('GA', null);
    assertEq(stack.state.tppExemptionAmount(), 7500, 'GA tppExemptionAmount = $7,500 from ga-2026.json');
    assert(stack.state.taxesTPP() === true, 'GA taxesTPP() = true');
    const filingReq = stack.state.tppFilingRequirement();
    assert(filingReq?.formName === 'PT-50R', 'GA TPP filing form = PT-50R');
    assert(filingReq?.deadline === 'April 1', 'GA TPP deadline = April 1');
  }

  // 25. TX TPP tppExemptionAmount = $0
  {
    const stack = resolveRulesetStack('TX', null);
    assertEq(stack.state.tppExemptionAmount(), 0, 'TX tppExemptionAmount = $0 from tx-2026.json');
    assert(stack.state.taxesTPP() === true, 'TX taxesTPP() = true (BPP)');
    const filingReq = stack.state.tppFilingRequirement();
    assert(filingReq?.formName === 'Rendition Form 50-144', 'TX BPP filing form = Rendition Form 50-144');
    assert(filingReq?.deadline === 'April 15', 'TX BPP deadline = April 15');
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n[taxService.test] ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
