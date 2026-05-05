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

  // All required rate sheets must be present (Phase 1 seeds + Phase 3 additions)
  const requiredKeys = [
    'federal-2026',
    'fl-2026', 'fl-miami-dade-2026', 'fl-broward-2026', 'fl-palm-beach-2026',
    'ga-2026', 'ga-fulton-2026',
    'tx-2026', 'tx-harris-2026',
  ];
  for (const key of requiredKeys) {
    const sheet = getRateSheet(
      key.replace(/-\d+$/, ''),
      parseInt(key.match(/\d+$/)?.[0] ?? '2026'),
    );
    assert(sheet !== null, `Required sheet "${key}" is present`);
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

  // Phase 3 county sheets
  const flBroward = getRateSheet('fl-broward', 2026);
  assert(flBroward?.level === 'county', 'fl-broward sheet level = "county"');
  assert(Math.abs((flBroward?.millage?.aggregate ?? 0) - 19.5073) < 0.001, 'fl-broward aggregate millage ≈ 19.5073');

  const flPB = getRateSheet('fl-palm-beach', 2026);
  assert(flPB?.level === 'county', 'fl-palm-beach sheet level = "county"');
  assert(Math.abs((flPB?.millage?.aggregate ?? 0) - 21.2765) < 0.001, 'fl-palm-beach aggregate millage ≈ 21.2765');

  const ga = getRateSheet('ga', 2026);
  assert(ga?.level === 'state', 'ga-2026 sheet level = "state"');
  assert(ga?.tpp?.taxed === true, 'ga-2026 tpp.taxed = true');
  assert(ga?.tpp?.exemption_amount === 7500, 'ga-2026 tpp.exemption_amount = 7500');
  assert(ga?.conforms_to_bonus_dep === false, 'ga-2026 conforms_to_bonus_dep = false');

  const gaFulton = getRateSheet('ga-fulton', 2026);
  assert(gaFulton?.level === 'county', 'ga-fulton sheet level = "county"');
  assert(Math.abs((gaFulton?.millage?.aggregate ?? 0) - 11.60) < 0.01, 'ga-fulton aggregate millage ≈ 11.60');

  const tx = getRateSheet('tx', 2026);
  assert(tx?.level === 'state', 'tx-2026 sheet level = "state"');
  assert(tx?.tpp?.taxed === true, 'tx-2026 tpp.taxed = true (BPP)');
  assert(tx?.conforms_to_bonus_dep === true, 'tx-2026 conforms_to_bonus_dep = true');

  const txHarris = getRateSheet('tx-harris', 2026);
  assert(txHarris?.level === 'county', 'tx-harris sheet level = "county"');
  assert(Math.abs((txHarris?.millage?.aggregate ?? 0) - 22.00) < 0.01, 'tx-harris aggregate millage ≈ 22.00');

  // Unknown jurisdiction returns null
  assert(getRateSheet('zz-unknown', 2026) === null, 'Unknown jurisdiction returns null');

  // Summary
  console.log(`\n[loader.test] ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
