/**
 * W1-7 Verify Stamps — Close stamp-at-entry gaps in all ingestion routes.
 *
 * Validates that every deal and intake_job created after W1-7 deployment
 * carries a `_provenance` stamp and `origin_class` is set.
 *
 * Run:
 *   npx ts-node --transpile-only backend/scripts/w1-7-verify-stamps.ts
 */

import { getPool } from '../src/database/connection';

interface StampCheck {
  table: string;
  id: string;
  origin_class: string | null;
  has_provenance: boolean;
  ingestion_source: string | null;
}

async function main() {
  console.log('=== W1-7 Stamp Verification ===\n');
  const pool = getPool();

  // ── 1. Check deals for origin_class and _provenance in deal_data ──────────
  const dealResult = await pool.query<StampCheck>(`
    SELECT
      id,
      origin_class,
      deal_data->>'_provenance' IS NOT NULL AS has_provenance,
      deal_data->'_provenance'->>'ingestionSource' AS ingestion_source
    FROM deals
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 100
  `);

  console.log(`--- Deals (last 7 days, n=${dealResult.rows.length}) ---`);
  let dealMissingOrigin = 0;
  let dealMissingStamp = 0;
  for (const row of dealResult.rows) {
    const okOrigin = !!row.origin_class;
    const okStamp = row.has_provenance;
    if (!okOrigin) dealMissingOrigin++;
    if (!okStamp) dealMissingStamp++;
    const status = okOrigin && okStamp ? '✅' : '❌';
    console.log(`  ${status} ${row.id}  origin_class=${row.origin_class ?? 'NULL'}  source=${row.ingestion_source ?? 'NULL'}`);
  }
  console.log(`  Missing origin_class: ${dealMissingOrigin}`);
  console.log(`  Missing _provenance:  ${dealMissingStamp}\n`);

  // ── 2. Check intake_jobs for _provenance in raw_input ─────────────────────
  const jobResult = await pool.query<{
    id: string;
    source_type: string;
    has_provenance: boolean;
    ingestion_source: string | null;
  }>(`
    SELECT
      id,
      source_type,
      raw_input->>'_provenance' IS NOT NULL AS has_provenance,
      raw_input->'_provenance'->>'ingestionSource' AS ingestion_source
    FROM intake_jobs
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 100
  `);

  console.log(`--- Intake Jobs (last 7 days, n=${jobResult.rows.length}) ---`);
  let jobMissingStamp = 0;
  for (const row of jobResult.rows) {
    const okStamp = row.has_provenance;
    if (!okStamp) jobMissingStamp++;
    const status = okStamp ? '✅' : '❌';
    console.log(`  ${status} ${row.id}  source_type=${row.source_type}  ingestion_source=${row.ingestion_source ?? 'NULL'}`);
  }
  console.log(`  Missing _provenance: ${jobMissingStamp}\n`);

  // ── 3. Check deal_capsules for _provenance in deal_data ───────────────────
  const capsuleResult = await pool.query<{
    id: string;
    deal_id: string | null;
    has_provenance: boolean;
    ingestion_source: string | null;
  }>(`
    SELECT
      id,
      deal_data->>'deal_id' AS deal_id,
      deal_data->>'_provenance' IS NOT NULL AS has_provenance,
      deal_data->'_provenance'->>'ingestionSource' AS ingestion_source
    FROM deal_capsules
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 100
  `);

  console.log(`--- Deal Capsules (last 7 days, n=${capsuleResult.rows.length}) ---`);
  let capsuleMissingStamp = 0;
  for (const row of capsuleResult.rows) {
    const okStamp = row.has_provenance;
    if (!okStamp) capsuleMissingStamp++;
    const status = okStamp ? '✅' : '❌';
    console.log(`  ${status} ${row.id}  deal_id=${row.deal_id ?? 'NULL'}  ingestion_source=${row.ingestion_source ?? 'NULL'}`);
  }
  console.log(`  Missing _provenance: ${capsuleMissingStamp}\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalMissing = dealMissingOrigin + dealMissingStamp + jobMissingStamp + capsuleMissingStamp;
  const pass = totalMissing === 0;

  console.log('=== SUMMARY ===');
  console.log(`Deals missing origin_class:    ${dealMissingOrigin}`);
  console.log(`Deals missing _provenance:     ${dealMissingStamp}`);
  console.log(`Intake jobs missing _provenance: ${jobMissingStamp}`);
  console.log(`Capsules missing _provenance:  ${capsuleMissingStamp}`);
  console.log(`\n${pass ? '✅ W1-7 PASS' : '❌ W1-7 FAIL'} — Stamp verification ${pass ? 'complete' : 'found gaps'}`);

  process.exit(pass ? 0 : 1);
}

main().catch(err => {
  console.error('Uncaught error:', err);
  process.exit(1);
});
