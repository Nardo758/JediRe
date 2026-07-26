/**
 * W1-8 Precedence Resolver Guard — Tests the LayeredValue resolution chain.
 *
 * Injects a LayeredValue `rent_growth` into deal_assumptions.year1 with all
 * 5 layers populated, then verifies resolveLv() picks the highest-precedence
 * layer in the correct order: override > agent_confirmed > detected > platform > resolved.
 *
 * Run in Replit (needs live DB):
 *   npx ts-node --transpile-only backend/scripts/w1-8-precedence-guard.ts
 *
 * SAFE: uses a transaction, always ROLLBACKs.
 */

import { getPool } from '../src/database/connection';
import { buildAssumptionsFromStore, resolveLv } from '../src/services/assumption-store-builder';

const TEST_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403'; // Bishop

interface TestCase {
  name: string;
  blob: Record<string, number>;
  expected: number;
}

const TESTS: TestCase[] = [
  { name: 'override wins over all',      blob: { override: 10, agent_confirmed: 20, detected: 30, platform: 40, resolved: 50 }, expected: 10 },
  { name: 'agent_confirmed beats detected', blob: { agent_confirmed: 20, detected: 30, platform: 40, resolved: 50 }, expected: 20 },
  { name: 'detected beats platform',     blob: { detected: 30, platform: 40, resolved: 50 }, expected: 30 },
  { name: 'platform beats resolved',     blob: { platform: 40, resolved: 50 }, expected: 40 },
  { name: 'resolved alone',              blob: { resolved: 50 }, expected: 50 },
  { name: 'empty blob → null',           blob: {}, expected: 0 }, // resolveLv returns null, but buildAssumptionsFromStore won't overlay
];

async function main() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('=== W1-8 Precedence Resolver Guard ===\n');

    // ── Unit tests for resolveLv() ───────────────────────────────────────────
    console.log('--- resolveLv() unit tests ---');
    let unitPass = true;
    for (const t of TESTS) {
      const got = resolveLv(t.blob);
      const pass = got === t.expected;
      unitPass = unitPass && pass;
      console.log(`  ${pass ? '✅' : '❌'} ${t.name}: expected=${t.expected} got=${got}`);
    }

    // ── Integration test: buildAssumptionsFromStore overlays year1 LV ────────
    console.log('\n--- Integration: buildAssumptionsFromStore ---');

    // Ensure a completed model exists for Bishop
    const modelCheck = await client.query(
      `SELECT id FROM deal_financial_models WHERE deal_id = $1 AND status = 'complete' ORDER BY created_at DESC LIMIT 1`,
      [TEST_DEAL_ID]
    );
    if (modelCheck.rows.length === 0) {
      console.log('  ⚠️ No completed model for Bishop — skipping integration test');
    } else {
      // Inject a rent_growth LayeredValue with override = 7.5
      const rentGrowthLv = {
        override: 7.5,
        agent_confirmed: 5.0,
        detected: 3.5,
        platform: 3.0,
        resolved: 3.0,
      };

      await client.query(`
        UPDATE deal_assumptions
        SET year1 = jsonb_set(COALESCE(year1, '{}'::jsonb), '{rent_growth}', $1::jsonb)
        WHERE deal_id = $2
      `, [JSON.stringify(rentGrowthLv), TEST_DEAL_ID]);

      const assumptions = await buildAssumptionsFromStore(TEST_DEAL_ID, pool);
      const gotRentGrowth = (assumptions.revenue as any)?.rentGrowth?.[0];
      const integPass = gotRentGrowth === 7.5;

      console.log(`  ${integPass ? '✅' : '❌'} rent_growth overlay: expected=7.5 (override wins) got=${gotRentGrowth}`);
      unitPass = unitPass && integPass;

      // Now clear override and verify agent_confirmed wins
      const rentGrowthLv2 = {
        agent_confirmed: 5.0,
        detected: 3.5,
        platform: 3.0,
        resolved: 3.0,
      };
      await client.query(`
        UPDATE deal_assumptions
        SET year1 = jsonb_set(COALESCE(year1, '{}'::jsonb), '{rent_growth}', $1::jsonb)
        WHERE deal_id = $2
      `, [JSON.stringify(rentGrowthLv2), TEST_DEAL_ID]);

      const assumptions2 = await buildAssumptionsFromStore(TEST_DEAL_ID, pool);
      const gotRentGrowth2 = (assumptions2.revenue as any)?.rentGrowth?.[0];
      const integPass2 = gotRentGrowth2 === 5.0;

      console.log(`  ${integPass2 ? '✅' : '❌'} rent_growth after override cleared: expected=5.0 (agent_confirmed wins) got=${gotRentGrowth2}`);
      unitPass = unitPass && integPass2;
    }

    // ── Result ───────────────────────────────────────────────────────────────
    console.log('\n=== GUARD RESULT ===');
    console.log(unitPass ? '✅ W1-8 PASS — Precedence resolver works correctly' : '❌ W1-8 FAIL — Resolver divergence detected');

    await client.query('ROLLBACK');
    console.log('(Rolled back — no permanent changes)');
    process.exit(unitPass ? 0 : 1);

  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Guard failed with error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

main();
