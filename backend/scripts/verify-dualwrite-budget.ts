import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const USER_ID = '6253ba3f-d40d-4597-86ab-270c8397a857';
const BASE    = 'http://localhost:4000';
const tok = jwt.sign(
  { userId: USER_ID, email: 'test@jedire.com', role: 'user' },
  process.env.JWT_SECRET!,
  { expiresIn: '1h', issuer: 'jedire-api', audience: 'jedire-client' } as jwt.SignOptions
);
const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok };

// Highlands at Satellite — has a real budget, owned by USER_ID
const DEAL_ID = 'eaabeb9f-830e-44f9-a923-56679ad0329d';

async function getState() {
  const r = await pool.query(
    `SELECT budget, deal_data->'purchase_price' AS pp FROM deals WHERE id=$1`,
    [DEAL_ID]
  );
  return { budget: Number(r.rows[0]?.budget), pp: Number(r.rows[0]?.pp) };
}

(async () => {
  const baseline = await getState();
  console.log('BASELINE | budget:', baseline.budget, '| deal_data.purchase_price:', baseline.pp);

  // PATCH budget to probe value
  const probeBudget = 55_000_001;
  const pa1 = await fetch(`${BASE}/api/v1/deals/${DEAL_ID}`, {
    method: 'PATCH', headers: h, body: JSON.stringify({ budget: probeBudget })
  });
  console.log('PATCH budget → HTTP', pa1.status);
  const s1 = await getState();
  console.log('AFTER budget PATCH | budget:', s1.budget, '| pp:', s1.pp);
  const patchOk = s1.budget === probeBudget && s1.pp === probeBudget;
  console.log('PATCH dual-write OK:', patchOk);

  // PATCH name only — must NOT clobber purchase_price
  const pa2 = await fetch(`${BASE}/api/v1/deals/${DEAL_ID}`, {
    method: 'PATCH', headers: h, body: JSON.stringify({ name: 'Highlands at Satellite' })
  });
  console.log('PATCH name-only → HTTP', pa2.status);
  const s2 = await getState();
  console.log('AFTER name-only | budget:', s2.budget, '| pp:', s2.pp);
  const noclobber = s2.pp === probeBudget;
  console.log('No-clobber OK:', noclobber);

  // Restore original budget
  await fetch(`${BASE}/api/v1/deals/${DEAL_ID}`, {
    method: 'PATCH', headers: h, body: JSON.stringify({ budget: baseline.budget })
  });
  const s3 = await getState();
  console.log('RESTORED | budget:', s3.budget, '| pp:', s3.pp);
  const restored = s3.budget === baseline.budget && s3.pp === baseline.budget;
  console.log('Restore dual-write OK:', restored);

  console.log('\nOVERALL:', (patchOk && noclobber && restored) ? 'PASS ✓' : 'FAIL ✗');
  await pool.end();
})().catch(async (e) => {
  console.error('FATAL', e.message);
  await pool.end();
  process.exit(1);
});
