/**
 * Rate Sheet Loader — startup smoke test
 *
 * Verifies that directory scanning loads and validates all *.json sheets
 * in the rateSheets directory, including the three required seed sheets.
 * Proves that adding a new JSON file to the directory (without any code
 * changes) is all that's required for it to be loaded and validated at boot.
 *
 * Run: npx ts-node src/services/tax/rateSheets/loader.test.ts
 */

import * as fs   from 'fs';
import * as path from 'path';
import {
  initRateSheets,
  getRateSheet,
  getAllRateSheets,
  _resetLoaderForTests,
} from './loader';

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

  const dir = path.join(__dirname);
  const jsonFilesOnDisk = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

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

  // Every *.json file in the directory must have been loaded (no silent skips)
  const all = getAllRateSheets();
  assert(
    all.length === jsonFilesOnDisk.length,
    `getAllRateSheets() returns ${jsonFilesOnDisk.length} sheet(s) ` +
    `(one per *.json file on disk) — got ${all.length}`,
  );

  // Required seed sheets present
  for (const key of ['federal-2026', 'fl-2026', 'fl-miami-dade-2026']) {
    const [jur, yr] = key.split('-').length === 2
      ? key.split('-')
      : [key.replace(/-\d+$/, ''), key.match(/\d+$/)?.[0] ?? '2026'];
    const sheet = getRateSheet(
      key.replace(/-\d+$/, ''),    // e.g. 'federal', 'fl', 'fl-miami-dade'
      parseInt(key.match(/\d+$/)?.[0] ?? '2026'),
    );
    assert(sheet !== null, `Required seed sheet "${key}" is present`);
  }

  // federal-2026 content
  const fed = getRateSheet('federal', 2026);
  assert(fed?.level === 'federal', 'federal sheet level = "federal"');
  assert(
    Array.isArray(fed?.bonus_depreciation) && (fed?.bonus_depreciation?.length ?? 0) >= 4,
    'federal sheet has bonus_depreciation entries',
  );
  assert(fed?.depreciation_lives?.multifamily === 27.5, 'federal multifamily dep life = 27.5');

  // fl-2026 content
  const fl = getRateSheet('fl', 2026);
  assert(fl?.level === 'state', 'fl sheet level = "state"');
  assert(fl?.tpp?.taxed === true, 'fl sheet tpp.taxed = true');
  assert(fl?.tpp?.exemption_amount === 25000, 'fl sheet tpp.exemption_amount = 25000');

  // fl-miami-dade-2026 content
  const md = getRateSheet('fl-miami-dade', 2026);
  assert(md?.level === 'county', 'fl-miami-dade sheet level = "county"');
  assert(
    (md?.millage?.breakdown?.length ?? 0) >= 4,
    'fl-miami-dade sheet has ≥ 4 millage breakdown lines',
  );

  // Unknown jurisdiction returns null
  assert(getRateSheet('zz-unknown', 2026) === null, 'Unknown jurisdiction returns null');

  // Summary
  console.log(`\n[loader.test] ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
