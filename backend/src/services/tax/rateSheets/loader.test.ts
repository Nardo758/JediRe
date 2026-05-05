/**
 * Rate Sheet Loader — startup smoke test
 *
 * Verifies that all three seed rate sheets (federal-2026, fl-2026,
 * fl-miami-dade-2026) load and validate cleanly in the same runtime
 * mode used for deployment. This catches schema drift, bad JSON, and
 * packaging failures before they reach production.
 *
 * Run: npx ts-node src/services/tax/rateSheets/loader.test.ts
 */

import { initRateSheets, getRateSheet, getAllRateSheets, _resetLoaderForTests } from './loader';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

function run(): void {
  console.log('\n[loader.test] Rate sheet loader smoke tests\n');

  _resetLoaderForTests();

  // Boot must not throw
  try {
    initRateSheets();
    assert(true, 'initRateSheets() completes without throwing');
  } catch (err) {
    assert(false, `initRateSheets() must not throw — got: ${(err as Error).message}`);
    process.exit(1);
  }

  // Idempotent re-call
  try {
    initRateSheets();
    assert(true, 'initRateSheets() is idempotent on second call');
  } catch (err) {
    assert(false, `initRateSheets() threw on second call: ${(err as Error).message}`);
  }

  // All three seed sheets present
  const all = getAllRateSheets();
  assert(all.length >= 3, `getAllRateSheets() returns ≥ 3 sheets (got ${all.length})`);

  // federal-2026
  const fed = getRateSheet('federal', 2026);
  assert(fed !== null, 'getRateSheet("federal", 2026) is non-null');
  assert(fed?.level === 'federal', 'federal sheet level = "federal"');
  assert(Array.isArray(fed?.bonus_depreciation) && (fed?.bonus_depreciation?.length ?? 0) >= 4, 'federal sheet has bonus_depreciation entries');
  assert(fed?.depreciation_lives?.multifamily === 27.5, 'federal multifamily dep life = 27.5');

  // fl-2026
  const fl = getRateSheet('fl', 2026);
  assert(fl !== null, 'getRateSheet("fl", 2026) is non-null');
  assert(fl?.level === 'state', 'fl sheet level = "state"');
  assert(fl?.tpp?.taxed === true, 'fl sheet tpp.taxed = true');
  assert(fl?.tpp?.exemption_amount === 25000, 'fl sheet tpp.exemption_amount = 25000');

  // fl-miami-dade-2026
  const md = getRateSheet('fl-miami-dade', 2026);
  assert(md !== null, 'getRateSheet("fl-miami-dade", 2026) is non-null');
  assert(md?.level === 'county', 'fl-miami-dade sheet level = "county"');
  assert((md?.millage?.breakdown?.length ?? 0) >= 4, 'fl-miami-dade sheet has ≥ 4 millage breakdown lines');

  // Miss returns null
  const miss = getRateSheet('zz-unknown', 2026);
  assert(miss === null, 'getRateSheet for unknown jurisdiction returns null');

  // Summary
  console.log(`\n[loader.test] ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
