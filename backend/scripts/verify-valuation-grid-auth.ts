/**
 * Behavioral verification for commit 60f2f9be2 (auth precedence fix in
 * valuation-grid.routes.ts). Mounts the real router + real requireAuth with
 * real JWTs against the real DB, and checks:
 *   1. No token                         -> 401
 *   2. Non-admin, no org access         -> 404 (gate blocks; pre-fix this passed through)
 *   3. Non-admin, deal owner/org member -> passes gate (not a gate 404)
 *   4. Admin (random user)              -> passes gate (not a gate 404)
 */
import express from 'express';
import request from 'supertest';
import { generateAccessToken } from '../src/auth/jwt';
import { getPool } from '../src/database/connection';
import valuationGridRoutes from '../src/api/rest/valuation-grid.routes';

const DEAL_ID = process.argv[2] || '3f32276f-aacd-4da3-b306-317c5109b403'; // Bishop

async function main() {
  const pool = getPool();
  const dealRow = await pool.query('SELECT id, user_id, org_id FROM deals WHERE id = $1', [DEAL_ID]);
  if (!dealRow.rows.length) throw new Error(`Deal ${DEAL_ID} not found`);
  const deal = dealRow.rows[0];
  console.log(`Deal: ${deal.id}  owner=${deal.user_id}  org=${deal.org_id}`);

  // Find a real user who is NOT in the deal's org and is not the owner and not admin
  const outsider = await pool.query(
    `SELECT id, email, role FROM users
     WHERE role != 'admin' AND id != $1
       AND (org_id IS NULL OR org_id IS DISTINCT FROM $2)
     LIMIT 1`,
    [deal.user_id, deal.org_id]
  ).catch(async () => {
    // fallback if users has no org_id column
    return pool.query(`SELECT id, email, role FROM users WHERE role != 'admin' AND id != $1 LIMIT 1`, [deal.user_id]);
  });
  const outsiderUser = outsider.rows[0];
  console.log(`Outsider: ${outsiderUser?.id} (${outsiderUser?.email}, role=${outsiderUser?.role})`);

  const owner = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [deal.user_id]);
  const ownerUser = owner.rows[0];

  const app = express();
  app.use(express.json());
  app.use('/api/v1', valuationGridRoutes);

  const tok = (u: { id: string; email: string; role: string }) =>
    generateAccessToken({ userId: u.id, email: u.email, role: u.role } as any);

  const url = `/api/v1/deals/${DEAL_ID}/valuation-grid`;
  const results: string[] = [];
  const check = (name: string, cond: boolean, got: string) =>
    results.push(`${cond ? '✅' : '❌'} ${name} (got: ${got})`);

  // 1. No token
  const r1 = await request(app).get(url);
  check('No token -> 401', r1.status === 401, String(r1.status));

  // 2. Non-admin outsider -> 404 (the fixed gate)
  if (outsiderUser) {
    const r2 = await request(app).get(url).set('Authorization', `Bearer ${tok(outsiderUser)}`);
    check('Non-admin outsider -> 404 gate block', r2.status === 404 && /not found/i.test(r2.body?.error || ''), `${r2.status} ${JSON.stringify(r2.body).slice(0, 80)}`);
  } else {
    results.push('⚠️  No outsider user found to test case 2');
  }

  // 3. Owner (non-admin path via org/owner match) -> passes gate
  if (ownerUser) {
    const r3 = await request(app).get(url).set('Authorization', `Bearer ${tok(ownerUser)}`);
    check('Owner passes gate (200 or non-gate error)', r3.status !== 401 && !(r3.status === 404 && r3.body?.error === 'Deal not found.'), `${r3.status}`);
  } else {
    results.push('⚠️  Deal owner user row not found for case 3');
  }

  // 4. Admin with random userId (no org access) -> passes gate because role==='admin'
  const r4 = await request(app).get(url).set('Authorization',
    `Bearer ${tok({ id: '00000000-0000-0000-0000-000000000001', email: 'admin-test@example.com', role: 'admin' })}`);
  check('Admin bypasses org gate (not gate 404)', r4.status !== 401 && !(r4.status === 404 && r4.body?.error === 'Deal not found.'), `${r4.status}`);

  console.log('\n=== GATE BEHAVIOR RESULTS ===');
  results.forEach(r => console.log(r));
  const pass = results.every(r => !r.startsWith('❌'));
  console.log(pass ? '\n✅ BEHAVIORAL CHECK PASS' : '\n❌ BEHAVIORAL CHECK FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
