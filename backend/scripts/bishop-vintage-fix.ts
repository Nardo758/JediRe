/**
 * Bishop Vintage Fix (T1-C gap)
 *
 * Problem: Bishop golden fixture has yearBuilt: 2014, but DB deal_data->>'year_built' is null.
 * This blocks the land/development case where year_built is required at contract level.
 *
 * Steps:
 * 1. Populate deal_data->>'year_built' = 2014 in DB
 * 2. Re-run buildModel() to capture fresh effective_assumptions
 * 3. Update bishop.golden.ts fixture with captured values
 *
 * Run in Replit:
 *   npx ts-node --transpile-only backend/scripts/bishop-vintage-fix.ts
 */

import { getPool } from '../src/database/connection';
import { financialModelEngine } from '../src/services/financial-model-engine.service';
import * as fs from 'fs';
import * as path from 'path';

const BISHOP_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';
const BISHOP_YEAR_BUILT = 2014;
const USER_ID = 'system-fix';

async function run() {
  const pool = getPool();
  console.log('=== Bishop Vintage Fix ===\n');

  // ── Step 1: Check current state ────────────────────────────────────────────
  console.log('--- Step 1: Check current DB state ---');
  const before = await pool.query(
    `SELECT deal_data->>'year_built' as year_built FROM deals WHERE id = $1`,
    [BISHOP_DEAL_ID]
  );
  const beforeYearBuilt = before.rows[0]?.year_built;
  console.log(`  Before: deal_data->>'year_built' = ${beforeYearBuilt ?? 'NULL'}`);

  // ── Step 2: Populate year_built ────────────────────────────────────────────
  console.log('\n--- Step 2: Populate year_built ---');
  await pool.query(
    `UPDATE deals
     SET deal_data = jsonb_set(
       COALESCE(deal_data, '{}'::jsonb),
       '{year_built}',
       $2::jsonb
     )
     WHERE id = $1`,
    [BISHOP_DEAL_ID, JSON.stringify(BISHOP_YEAR_BUILT)]
  );

  const after = await pool.query(
    `SELECT deal_data->>'year_built' as year_built FROM deals WHERE id = $1`,
    [BISHOP_DEAL_ID]
  );
  const afterYearBuilt = after.rows[0]?.year_built;
  console.log(`  After:  deal_data->>'year_built' = ${afterYearBuilt}`);

  if (afterYearBuilt !== String(BISHOP_YEAR_BUILT)) {
    console.log('  ❌ UPDATE failed');
    process.exit(1);
  }
  console.log('  ✅ year_built populated');

  // ── Step 3: Re-capture effective_assumptions ───────────────────────────────
  console.log('\n--- Step 3: Re-capture effective_assumptions ---');

  // Build assumptions from store (same path as HTTP route)
  const { buildAssumptionsFromStore } = await import('../src/services/assumption-store-builder');
  const assumptions = await buildAssumptionsFromStore(BISHOP_DEAL_ID, pool);

  // Run buildModel (same as the real route)
  const result = await financialModelEngine.buildModel(BISHOP_DEAL_ID, assumptions, USER_ID);

  // Log the key fields for verification
  console.log('  Captured effective_assumptions key fields:');
  console.log(`    purchasePrice: ${result.assumptions.acquisition?.purchasePrice}`);
  console.log(`    units: ${result.assumptions.dealInfo?.totalUnits}`);
  console.log(`    loanAmount: ${result.assumptions.financing?.loanAmount}`);
  console.log(`    rate: ${result.assumptions.financing?.interestRate}`);
  console.log(`    holdYears: ${result.assumptions.holdPeriod?.holdYears}`);
  console.log(`    vintage (from deal_data): ${BISHOP_YEAR_BUILT}`);

  // ── Step 4: Save capture for fixture update ────────────────────────────────
  console.log('\n--- Step 4: Save capture ---');
  const capturePath = '/tmp/bishop_effective_assumptions_v2.json';
  fs.writeFileSync(capturePath, JSON.stringify({
    modelAssumptions: assumptions,
    effectiveAssumptions: result.assumptions,
    capturedAt: new Date().toISOString(),
    yearBuilt: BISHOP_YEAR_BUILT,
  }, null, 2));
  console.log(`  ✅ Saved to ${capturePath}`);

  console.log('\n=== NEXT STEPS ===');
  console.log('1. Copy the captured assumptions from the JSON file above');
  console.log('2. Update backend/tests/deterministic/bishop.golden.ts effectiveAssumptions');
  console.log('3. Commit with message: "T1-C: re-pin Bishop fixture with yearBuilt 2014"');
}

run().catch(err => {
  console.error('Fix failed:', err);
  process.exit(1);
});
