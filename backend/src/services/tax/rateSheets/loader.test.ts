/**
 * Rate Sheet Loader — startup smoke test
 *
 * Verifies that all sheets in _manifest.ts load and validate cleanly in
 * the same runtime mode used for deployment (ts-node / compiled dist).
 * Proves that adding a new JSON entry to _manifest.ts is all that is
 * required for it to be loaded and validated at boot.
 *
 * Run: npx ts-node src/services/tax/rateSheets/loader.test.ts
 */

import {
  initRateSheets,
  getRateSheet,
  getAllRateSheets,
  _resetLoaderForTests,
} from './loader';
import { ALL_RATE_SHEETS } from './_manifest';

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
    assert(false, `initRateSheets() threw at boot: ${(err as Error).message}`);
    process.exit(1);
  }

  // Idempotent re-call
  try {
    initRateSheets();
    assert(true, 'initRateSheets() is idempotent on second call');
  } catch (err) {
    assert(false, `initRateSheets() threw on second call: ${(err as Error).message}`);
  }

  // ALL_RATE_SHEETS manifest drives the load count (no hardcoded number)
  const all = getAllRateSheets();
  assert(
    all.length === ALL_RATE_SHEETS.length,
    `getAllRateSheets() returns exactly ${ALL_RATE_SHEETS.length} sheets ` +
    `(manifest length) — got ${all.length}`,
  );

  // Every manifest entry must produce a cached sheet
  for (const { filename } of ALL_RATE_SHEETS) {
    const inCache = all.some(s =>
      `${s.jurisdiction}-${s.year}.json` === filename ||
      filename.startsWith(s.jurisdiction),
    );
    assert(inCache, `Manifest entry "${filename}" is present in cache`);
  }

  // federal-2026 content assertions
  const fed = getRateSheet('federal', 2026);
  assert(fed !== null, 'getRateSheet("federal", 2026) is non-null');
  assert(fed?.level === 'federal', 'federal sheet level = "federal"');
  assert(
    Array.isArray(fed?.bonus_depreciation) && (fed?.bonus_depreciation?.length ?? 0) >= 4,
    'federal sheet has bonus_depreciation entries',
  );
  assert(fed?.depreciation_lives?.multifamily === 27.5, 'federal multifamily dep life = 27.5');

  // fl-2026 content assertions
  const fl = getRateSheet('fl', 2026);
  assert(fl !== null, 'getRateSheet("fl", 2026) is non-null');
  assert(fl?.level === 'state', 'fl sheet level = "state"');
  assert(fl?.tpp?.taxed === true, 'fl sheet tpp.taxed = true');
  assert(fl?.tpp?.exemption_amount === 25000, 'fl sheet tpp.exemption_amount = 25000');

  // fl-miami-dade-2026 content assertions
  const md = getRateSheet('fl-miami-dade', 2026);
  assert(md !== null, 'getRateSheet("fl-miami-dade", 2026) is non-null');
  assert(md?.level === 'county', 'fl-miami-dade sheet level = "county"');
  assert(
    (md?.millage?.breakdown?.length ?? 0) >= 4,
    'fl-miami-dade sheet has ≥ 4 millage breakdown lines',
  );

  // Unknown jurisdiction returns null
  const miss = getRateSheet('zz-unknown', 2026);
  assert(miss === null, 'getRateSheet for unknown jurisdiction returns null');

  // Summary
  console.log(`\n[loader.test] ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
