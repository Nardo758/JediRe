/**
 * taxService.forecast() — determinism & Section C regression tests
 *
 * Verifies:
 *  1. Byte-identical output for identical TaxContext inputs (determinism requirement)
 *  2. Section C bonus depreciation schedule matches federal-2026.json (2025→0.40, 2026→0.20, 2027→0.00)
 *  3. Section C depreciation life: multifamily=27.5yr, office=39yr
 *  4. Federal income tax rates by entity type (c_corp=0.21, reit=0.00, pass_through=0.2968)
 *  5. effectiveCombinedRate = federalIncomeTaxRate + stateIncomeTaxRate
 *  6. depreciableBase and annualDepreciation arithmetic
 *
 * Run: npx ts-node src/services/tax/taxService.test.ts
 */

import { taxService } from './taxService';
import { _resetLoaderForTests, initRateSheets } from './rateSheets/loader';
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

function run(): void {
  console.log('\n[taxService.test] taxService.forecast() determinism & Section C tests\n');

  // Ensure rate sheets are loaded fresh for this test run
  _resetLoaderForTests();
  initRateSheets();

  // ── 1. Determinism ──────────────────────────────────────────────────────────
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

  // ── 2. Bonus depreciation schedule ─────────────────────────────────────────
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

  // ── 3. Depreciation life by asset class ─────────────────────────────────────
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

  // ── 4. Federal income tax rates by entity type ───────────────────────────────
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
    // stateIncomeTaxRate must be 0 for FL (no state income tax)
    assertClose(
      f.sectionC.stateIncomeTaxRate,
      0,
      `stateIncomeTaxRate for FL/${entityType} = 0`,
    );
    // effectiveCombinedRate = federal + state
    assertClose(
      f.sectionC.effectiveCombinedRate,
      expectedRate + 0,
      `effectiveCombinedRate for FL/${entityType} = ${expectedRate}`,
    );
  }

  // ── 5. depreciableBase arithmetic ────────────────────────────────────────────
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

  // ── 6. Null purchasePrice → null depreciableBase / annualDepreciation ─────────
  const fNull = taxService.forecast({ ...BASE_CTX, purchasePrice: null });
  assert(fNull.sectionC.depreciableBase   === null, 'depreciableBase = null when purchasePrice = null');
  assert(fNull.sectionC.annualDepreciation === null, 'annualDepreciation = null when purchasePrice = null');

  // ── 7. costSegAvailablePct > 0 for all standard asset classes ────────────────
  for (const assetClass of ['multifamily', 'sfr', 'retail', 'office', 'industrial', 'hospitality'] as const) {
    const f = taxService.forecast({ ...BASE_CTX, propertyType: assetClass });
    assert(f.sectionC.costSegAvailablePct > 0, `costSegAvailablePct > 0 for ${assetClass}`);
  }

  // ── 8. landAllocationPct recorded correctly ───────────────────────────────────
  const fLand = taxService.forecast({ ...BASE_CTX, landAllocationPct: 0.30 });
  assertClose(fLand.sectionC.landAllocationPct, 0.30, 'landAllocationPct echoed from ctx');

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n[taxService.test] ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
