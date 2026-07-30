/**
 * Security Verification: Auth precedence fix in valuation-grid.routes.ts
 *
 * Commit: 60f2f9be2 — changed !req.user?.role === 'admin' → role !== 'admin'
 * across 11 routes.
 *
 * This script verifies the behavioral fix: admin bypasses checks,
 * non-admin is blocked.
 *
 * Run in Replit after backend is started:
 *   npx ts-node --transpile-only backend/scripts/security-auth-verification.ts
 */

import { getPool } from '../src/database/connection';

const TEST_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403'; // Bishop
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function getTestUser(role: 'admin' | 'user'): Promise<{ id: string; token: string } | null> {
  const pool = getPool();

  // Find or create a test user with the given role
  const email = `security-test-${role}@jedire.test`;

  const existing = await pool.query(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );

  let userId: string;
  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
  } else {
    const created = await pool.query(
      `INSERT INTO users (email, role, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id`,
      [email, role]
    );
    userId = created.rows[0].id;
  }

  // Get or create a token for this user
  const tokenResult = await pool.query(
    `SELECT token FROM auth_tokens
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  let token: string;
  if (tokenResult.rows.length > 0) {
    token = tokenResult.rows[0].token;
  } else {
    token = `test-token-${role}-${Date.now()}`;
    await pool.query(
      `INSERT INTO auth_tokens (user_id, token, created_at, expires_at)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '1 day')`,
      [userId, token]
    );
  }

  return { id: userId, token };
}

async function testRoute(token: string, expectedStatus: number, label: string) {
  const url = `${BASE_URL}/api/v1/valuation-grid/${TEST_DEAL_ID}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const ok = res.status === expectedStatus;
    console.log(`  ${ok ? '✅' : '❌'} ${label}: expected ${expectedStatus}, got ${res.status}`);
    return ok;
  } catch (err) {
    console.log(`  ❌ ${label}: fetch failed (${err})`);
    return false;
  }
}

async function run() {
  console.log('=== Security Auth Verification ===\n');

  const admin = await getTestUser('admin');
  const user = await getTestUser('user');

  if (!admin || !user) {
    console.log('❌ Failed to set up test users');
    process.exit(1);
  }

  console.log('--- Admin access (should bypass, get 200 or 404) ---');
  const adminOk = await testRoute(admin.token, 200, 'Admin access');
  // Note: 404 is also acceptable if deal not found; 403 is the failure mode

  console.log('\n--- Non-admin access (should be blocked, get 403) ---');
  const userOk = await testRoute(user.token, 403, 'Non-admin blocked');

  console.log('\n=== SUMMARY ===');
  if (adminOk && userOk) {
    console.log('✅ PASS — Auth precedence fix verified');
  } else {
    console.log('❌ FAIL — Auth behavior incorrect');
    console.log('  Admin should get 200 (or 404 if deal missing)');
    console.log('  Non-admin should get 403');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
