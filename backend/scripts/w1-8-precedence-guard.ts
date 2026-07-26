/**
 * W1-8 Precedence Resolver Guard — Tests the LayeredValue resolution chain.
 *
 * Injects LayeredValues into deal_assumptions.year1 via transaction,
 * reads back via the SAME transaction client, and verifies resolveLv()
 * picks the highest-precedence layer: override > agent_confirmed > detected > platform > resolved.
 *
 * Run in Replit (needs live DB):
 *   npx ts-node --transpile-only backend/scripts/w1-8-precedence-guard.ts
 *
 * SAFE: uses a transaction, always ROLLBACKs.
 */

import { getPool } from '../src/database/connection';
import { resolveLv } from '../src/services/assumption-store-builder';

const TEST_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403'; // Bishop

interface TestCase {
  name: string;
  blob: Record<string, number>;
  expected: number | null;
}

const UNIT_TESTS: TestCase[] = [
  { name: 'override wins over all',         blob: { override: 10, agent_confirmed: 20, detected: 30, platform: 40, resolved: 50 }, expected: 10 },
  { name: 'agent_confirmed beats detected', blob: { agent_confirmed: 20, detected: 30, platform: 40, resolved: 50 }, expected: 20 },
  { name: 'detected beats platform',        blob: { detected: 30, platform: 40, resolved: 50 }, expected: 30 },
  { name: 'platform beats resolved',        blob: { platform: 40, resolved: 50 }, expected: 40 },
  { name: 'resolved alone',                 blob: { resolved: 50 }, expected: 50 },
  { name: 'empty blob → null',              blob: {}, expected: null },
];

async function main() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('=== W1-8 Precedence Resolver Guard ===\n');

    // ── 1. Unit tests for resolveLv() ────────────────────────────────────────
    console.log('--- resolveLv() unit tests ---');
    let allPass = true;
    for (const t of UNIT_TESTS) {
      const got = resolveLv(t.blob);
      const pass = got === t.expected;
      allPass = allPass && pass;
      console.log(`  ${pass ? '✅' : '❌'} ${t.name}: expected=${t.expected} got=${got}`);
    }

    // ── 2. Integration: inject LV into year1, read back via SAME client ──────
    console.log('\n--- Integration: DB round-trip via transaction ---');

    // Ensure deal_assumptions row exists
    const exists = await client.query(`SELECT 1 FROM deal_assumptions WHERE deal_id = $1`, [TEST_DEAL_ID]);
    if (exists.rows.length === 0) {
      await client.query(
        `INSERT INTO deal_assumptions (deal_id) VALUES ($1)`,
        [TEST_DEAL_ID]
      );
    }

    // Test A: override = 7.5 should win
    const lvA = { override: 7.5, agent_confirmed: 5.0, detected: 3.5, platform: 3.0, resolved: 3.0 };
    await client.query(`
      UPDATE deal_assumptions
      SET year1 = jsonb_set(COALESCE(year1, '{}'::jsonb), '{rent_growth}', $1::jsonb)
      WHERE deal_id = $2
    `, [JSON.stringify(lvA), TEST_DEAL_ID]);

    const readA = await client.query(`SELECT year1->'rent_growth' as rg FROM deal_assumptions WHERE deal_id = $1`, [TEST_DEAL_ID]);
    const gotA = resolveLv(readA.rows[0].rg);
    const passA = gotA === 7.5;
    allPass = allPass && passA;
    console.log(`  ${passA ? '✅' : '❌'} rent_growth override=7.5: expected=7.5 got=${gotA}`);

    // Test B: clear override, agent_confirmed = 5.0 should win
    const lvB = { agent_confirmed: 5.0, detected: 3.5, platform: 3.0, resolved: 3.0 };
    await client.query(`
      UPDATE deal_assumptions
      SET year1 = jsonb_set(COALESCE(year1, '{}'::jsonb), '{rent_growth}', $1::jsonb)
      WHERE deal_id = $2
    `, [JSON.stringify(lvB), TEST_DEAL_ID]);

    const readB = await client.query(`SELECT year1->'rent_growth' as rg FROM deal_assumptions WHERE deal_id = $1`, [TEST_DEAL_ID]);
    const gotB = resolveLv(readB.rows[0].rg);
    const passB = gotB === 5.0;
    allPass = allPass && passB;
    console.log(`  ${passB ? '✅' : '❌'} rent_growth agent_confirmed=5.0: expected=5.0 got=${gotB}`);

    // Test C: only platform = 4.0
    const lvC = { platform: 4.0, resolved: 3.0 };
    await client.query(`
      UPDATE deal_assumptions
      SET year1 = jsonb_set(COALESCE(year1, '{}'::jsonb), '{rent_growth}', $1::jsonb)
      WHERE deal_id = $2
    `, [JSON.stringify(lvC), TEST_DEAL_ID]);

    const readC = await client.query(`SELECT year1->'rent_growth' as rg FROM deal_assumptions WHERE deal_id = $1`, [TEST_DEAL_ID]);
    const gotC = resolveLv(readC.rows[0].rg);
    const passC = gotC === 4.0;
    allPass = allPass && passC;
    console.log(`  ${passC ? '✅' : '❌'} rent_growth platform=4.0: expected=4.0 got=${gotC}`);

    // Test D: detected = 6.0 beats platform
    const lvD = { detected: 6.0, platform: 4.0, resolved: 3.0 };
    await client.query(`
      UPDATE deal_assumptions
      SET year1 = jsonb_set(COALESCE(year1, '{}'::jsonb), '{rent_growth}', $1::jsonb)
      WHERE deal_id = $2
    `, [JSON.stringify(lvD), TEST_DEAL_ID]);

    const readD = await client.query(`SELECT year1->'rent_growth' as rg FROM deal_assumptions WHERE deal_id = $1`, [TEST_DEAL_ID]);
    const gotD = resolveLv(readD.rows[0].rg);
    const passD = gotD === 6.0;
    allPass = allPass && passD;
    console.log(`  ${passD ? '✅' : '❌'} rent_growth detected=6.0 beats platform: expected=6.0 got=${gotD}`);

    // ── Result ───────────────────────────────────────────────────────────────
    console.log('\n=== GUARD RESULT ===');
    console.log(allPass ? '✅ W1-8 PASS — Precedence resolver works correctly' : '❌ W1-8 FAIL — Resolver divergence detected');

    await client.query('ROLLBACK');
    console.log('(Rolled back — no permanent changes)');
    process.exit(allPass ? 0 : 1);

  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Guard failed with error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

main();
