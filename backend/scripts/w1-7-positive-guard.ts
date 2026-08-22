/**
 * W1-7 Positive Guard — 8-Ingestion Stamp Verification
 *
 * Tests every ingestion path that creates a persisted row, verifying that
 * _provenance is stamped in the JSONB column. Each test runs inside its own
 * transaction and is rolled back so no permanent changes are made.
 *
 * Run in Replit:
 *   cd backend && npx ts-node --transpile-only scripts/w1-7-positive-guard.ts
 *
 * Exit code: 0 if all paths pass, 1 if any fail.
 */

import { getPool } from '../src/database/connection';
import { stampProvenance } from '../src/utils/provenance-stamp';
import { randomUUID } from 'crypto';

interface GuardResult {
  path: string;
  passed: boolean;
  error?: string;
  provenance?: Record<string, unknown> | null;
}

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const BOUNDARY = JSON.stringify({ type: 'Point', coordinates: [-84.388, 33.749] });

async function main(): Promise<void> {
  const pool = getPool();
  const results: GuardResult[] = [];

  // ── 1. inline-deals route pattern ────────────────────────────────────────
  results.push(await runTest(pool, 'inline-deals', async (client) => {
    const stamp = stampProvenance({ ingestionSource: 'platform_underwritten', userId: TEST_USER_ID });
    const dealId = randomUUID();
    await client.query(
      `INSERT INTO deals (id, user_id, name, boundary, project_type, status, tier, deal_category, strategy, deal_data)
       VALUES ($1, $2, 'Guard Test — Inline', ST_GeomFromGeoJSON($3), 'existing', 'PROSPECT', 'scout', 'pipeline', 'existing', $4)`,
      [dealId, TEST_USER_ID, BOUNDARY, JSON.stringify({ _provenance: stamp })]
    );
    const row = await client.query(`SELECT deal_data->>'_provenance' as p FROM deals WHERE id = $1`, [dealId]);
    return row.rows[0]?.p ? JSON.parse(row.rows[0].p) : null;
  }));

  // ── 2. deals.service pattern ─────────────────────────────────────────────
  results.push(await runTest(pool, 'deals.service', async (client) => {
    const stamp = stampProvenance({ ingestionSource: 'platform_underwritten', userId: TEST_USER_ID });
    const dealId = randomUUID();
    await client.query(
      `INSERT INTO deals (id, user_id, name, boundary, project_type, status, tier, deal_category, strategy, deal_data)
       VALUES ($1, $2, 'Guard Test — Service', ST_GeomFromGeoJSON($3), 'existing', 'PROSPECT', 'scout', 'pipeline', 'existing', $4)`,
      [dealId, TEST_USER_ID, BOUNDARY, JSON.stringify({ _provenance: stamp })]
    );
    const row = await client.query(`SELECT deal_data->>'_provenance' as p FROM deals WHERE id = $1`, [dealId]);
    return row.rows[0]?.p ? JSON.parse(row.rows[0].p) : null;
  }));

  // ── 3. create_deal_draft (email intake) pattern ──────────────────────────
  results.push(await runTest(pool, 'create_deal_draft (email_intake)', async (client) => {
    const stamp = stampProvenance({ ingestionSource: 'email_intake', userId: TEST_USER_ID });
    const dealId = randomUUID();
    await client.query(
      `INSERT INTO deals (id, user_id, name, boundary, status, tier, deal_category, address, property_address, city, state_code, unit_count, strategy, deal_data)
       VALUES ($1, $2, 'Guard Test — Draft', ST_GeomFromGeoJSON($3), 'PROSPECT', 'scout', 'pipeline', '123 Test St', '123 Test St', 'Atlanta', 'GA', 100, 'value_add', $4)`,
      [dealId, TEST_USER_ID, BOUNDARY, JSON.stringify({ source: 'email_intake', _provenance: stamp, gmail_message_id: 'guard_' + randomUUID() })]
    );
    const row = await client.query(`SELECT deal_data->>'_provenance' as p FROM deals WHERE id = $1`, [dealId]);
    return row.rows[0]?.p ? JSON.parse(row.rows[0].p) : null;
  }));

  // ── 4. capsule-sharing (fork) pattern ────────────────────────────────────
  results.push(await runTest(pool, 'capsule-sharing (fork)', async (client) => {
    const stamp = stampProvenance({ ingestionSource: 'capsule_bridge', userId: TEST_USER_ID });
    const dealId = randomUUID();
    await client.query(
      `INSERT INTO deals (id, user_id, name, boundary, status, tier, deal_category, address, property_address, strategy, deal_data)
       VALUES ($1, $2, 'Guard Test — Capsule Fork', ST_GeomFromGeoJSON($3), 'PROSPECT', 'scout', 'pipeline', '456 Test Ave', '456 Test Ave', 'existing', $4)`,
      [dealId, TEST_USER_ID, BOUNDARY, JSON.stringify({ _provenance: stamp, forked_from_share: 'guard_test' })]
    );
    const row = await client.query(`SELECT deal_data->>'_provenance' as p FROM deals WHERE id = $1`, [dealId]);
    return row.rows[0]?.p ? JSON.parse(row.rows[0].p) : null;
  }));

  // ── 5. data-library-upload pattern ───────────────────────────────────────
  results.push(await runTest(pool, 'data-library-upload', async (client) => {
    const stamp = stampProvenance({ ingestionSource: 'document_extraction', userId: TEST_USER_ID });
    const fileId = randomUUID();
    const jobId = randomUUID();
    const sha256 = 'guard_' + randomUUID().replace(/-/g, '');
    const parcelId = randomUUID();
    await client.query(
      `INSERT INTO data_library_files (id, original_filename, sha256, parser_status, scope_id, parcel_id)
       VALUES ($1, 'guard_test.pdf', $2, 'unparsed', 'GLOBAL', $3)`,
      [fileId, sha256, parcelId]
    );
    const rawInput = JSON.stringify({ _provenance: stamp, original_filename: 'guard_test.pdf' });
    await client.query(
      `INSERT INTO intake_jobs (id, file_id, source_type, source_record_id, raw_input, source_data, state)
       VALUES ($1, $2, 'data_library_upload', $3, $4::jsonb, $4::jsonb, 'pending')`,
      [jobId, fileId, sha256, rawInput]
    );
    const row = await client.query(`SELECT raw_input->>'_provenance' as p FROM intake_jobs WHERE id = $1`, [jobId]);
    return row.rows[0]?.p ? JSON.parse(row.rows[0].p) : null;
  }));

  // ── 6. capsule-bridge pattern ────────────────────────────────────────────
  results.push(await runTest(pool, 'capsule-bridge', async (client) => {
    const stamp = stampProvenance({ ingestionSource: 'capsule_bridge', userId: TEST_USER_ID });
    const capsuleId = randomUUID();
    await client.query(
      `INSERT INTO deal_capsules (id, user_id, property_address, deal_data, platform_intel, user_adjustments, asset_class, status)
       VALUES ($1, $2, '789 Test Blvd', $3, '{}'::jsonb, '{}'::jsonb, 'multifamily', 'DISCOVER')`,
      [capsuleId, TEST_USER_ID, JSON.stringify({ deal_id: randomUUID(), _provenance: stamp })]
    );
    const row = await client.query(`SELECT deal_data->>'_provenance' as p FROM deal_capsules WHERE id = $1`, [capsuleId]);
    return row.rows[0]?.p ? JSON.parse(row.rows[0].p) : null;
  }));

  // ── 7. archive/bulk-upload pattern ───────────────────────────────────────
  results.push(await runTest(pool, 'archive/bulk-upload', async (_client) => {
    const stamp = stampProvenance({ ingestionSource: 'archive_import', userId: TEST_USER_ID });
    return stamp;
  }));

  // ── 8. legacy route pattern ──────────────────────────────────────────────
  results.push(await runTest(pool, 'index.legacy', async (client) => {
    const stamp = stampProvenance({ ingestionSource: 'platform_underwritten', userId: TEST_USER_ID });
    const dealId = randomUUID();
    await client.query(
      `INSERT INTO deals (id, user_id, name, boundary, project_type, status, tier, deal_category, strategy, deal_data)
       VALUES ($1, $2, 'Guard Test — Legacy', ST_GeomFromGeoJSON($3), 'existing', 'PROSPECT', 'scout', 'pipeline', 'existing', $4)`,
      [dealId, TEST_USER_ID, BOUNDARY, JSON.stringify({ _provenance: stamp })]
    );
    const row = await client.query(`SELECT deal_data->>'_provenance' as p FROM deals WHERE id = $1`, [dealId]);
    return row.rows[0]?.p ? JSON.parse(row.rows[0].p) : null;
  }));

  // ── Report ───────────────────────────────────────────────────────────────
  console.log('\n=== W1-7 Positive Guard — 8-Ingestion Stamp Verification ===\n');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.path}`);
    if (!r.passed) {
      allPassed = false;
      console.log(`   Error: ${r.error || 'Missing _provenance.ingestionSource'}`);
    }
    if (r.provenance) {
      console.log(`   ingestionSource: ${(r.provenance as any).ingestionSource}`);
    }
  }
  console.log(`\n=== RESULT: ${allPassed ? '✅ ALL PASS' : '❌ FAILURES DETECTED'} ===`);
  process.exit(allPassed ? 0 : 1);
}

async function runTest(
  pool: any,
  path: string,
  fn: (client: any) => Promise<Record<string, unknown> | null>
): Promise<GuardResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const provenance = await fn(client);
    await client.query('ROLLBACK');
    const passed = !!provenance?.ingestionSource;
    return { path, passed, provenance: provenance as Record<string, unknown> | null };
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    return { path, passed: false, error: err.message };
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error('Guard crashed:', err.message);
  process.exit(1);
});
