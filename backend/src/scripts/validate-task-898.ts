/**
 * Task #898 — End-to-end validation script
 * Runs 8 validation steps and prints PASS/FAIL for each.
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'http://localhost:4000';
const CAPSULE_ID = '58661e80-1b03-4375-bcce-9b8b44a89c51';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

async function run() {
  const results: { step: number; label: string; pass: boolean; note: string }[] = [];

  const rec = (step: number, label: string, pass: boolean, note: string) => {
    results.push({ step, label, pass, note });
    console.log(`[Step ${step}] ${pass ? 'PASS' : 'FAIL'} — ${label}: ${note}`);
  };

  // ── DB connection ──
  const { getPool, connectDatabase } = await import('../database/connection');
  await connectDatabase();
  const pool = getPool();

  // ── Step 1: Migration applied — capsule_external_shares has preview columns ──
  try {
    const r = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'capsule_external_shares'
       ORDER BY ordinal_position`
    );
    const cols = r.rows.map((x: any) => x.column_name);
    const pass = cols.includes('preview_text') && cols.includes('preview_metadata') && cols.includes('access_token');
    rec(1, 'Migration applied (capsule_external_shares with preview cols)', pass,
      `cols: ${cols.join(', ')}`);
  } catch (e: any) {
    rec(1, 'Migration applied', false, e.message);
  }

  // ── Mint a test JWT directly ──
  const { generateAccessToken } = await import('../auth/jwt');
  const token = generateAccessToken({
    userId: TEST_USER_ID,
    email: 'validator@jedire.internal',
    role: 'admin',
  } as any);
  const authHeader = { Authorization: `Bearer ${token}` };

  // ── Step 2: Create share WITH preview_text — resolution returns it verbatim ──
  let tokenWithPreview = '';
  try {
    const res = await axios.post(
      `${BASE}/api/v1/capsules-ext/${CAPSULE_ID}/share/external`,
      {
        recipient_email: 'validator+preview@test.com',
        share_type: 'external_agent_enabled',
        preview_text: 'Validation preview — 37 chars exact.',
      },
      { headers: authHeader }
    );
    tokenWithPreview = res.data.access_token;

    const resolveRes = await axios.get(`${BASE}/api/v1/capsules/${tokenWithPreview}`);
    const match = resolveRes.data.preview_text === 'Validation preview — 37 chars exact.';
    rec(2, 'Share WITH preview_text resolves verbatim', match,
      `resolved preview_text="${resolveRes.data.preview_text}" agent_enabled=${resolveRes.data.agent_enabled}`);
  } catch (e: any) {
    rec(2, 'Share WITH preview_text resolves verbatim', false,
      e.response?.data?.error ?? e.message);
  }

  // ── Step 3: Create share WITHOUT preview_text — resolution returns null + must_connect_api ──
  let tokenNoPreview = '';
  try {
    const res = await axios.post(
      `${BASE}/api/v1/capsules-ext/${CAPSULE_ID}/share/external`,
      {
        recipient_email: 'validator+nopreview@test.com',
        share_type: 'external_view',
      },
      { headers: authHeader }
    );
    tokenNoPreview = res.data.access_token;

    const resolveRes = await axios.get(`${BASE}/api/v1/capsules/${tokenNoPreview}`);
    const pass = resolveRes.data.preview_text === null && resolveRes.data.must_connect_api === true;
    rec(3, 'Share WITHOUT preview_text returns null + must_connect_api', pass,
      `preview_text=${resolveRes.data.preview_text} must_connect_api=${resolveRes.data.must_connect_api}`);
  } catch (e: any) {
    rec(3, 'Share WITHOUT preview_text returns null + must_connect_api', false,
      e.response?.data?.error ?? e.message);
  }

  // ── Step 4: preview_text stored on capsule_external_shares, not derived from deals ──
  const routesSrc = fs.readFileSync(
    path.join(__dirname, '../api/rest/capsule-sharing.routes.ts'), 'utf-8'
  );
  // Resolution query must read from capsule_external_shares, not JOIN deals
  const hasCorrectQuery = routesSrc.includes('FROM capsule_external_shares ces');
  const doesNotJoinDeals = !(/FROM capsule_external_shares.*\n.*JOIN deals/s.test(routesSrc));
  rec(4, 'preview_text stored on share table only (not derived from deals)',
    hasCorrectQuery && doesNotJoinDeals,
    hasCorrectQuery && doesNotJoinDeals
      ? 'Resolution SELECT reads capsule_external_shares only — no JOIN to deals'
      : 'WARNING: resolution query may touch deals table');

  // ── Step 5: Bypass blocked — unauthenticated deal access returns 401 ──
  try {
    await axios.get(`${BASE}/api/v1/deals/${CAPSULE_ID}`);
    rec(5, 'Unauthenticated deal access blocked', false, 'Expected 401, got 200');
  } catch (e: any) {
    const s = e.response?.status;
    rec(5, 'Unauthenticated deal access blocked', s === 401 || s === 403,
      `Returned ${s} (expected 401/403)`);
  }

  // ── Step 6: Rate limiting — 6th capsule resolution within 10 min returns 429 ──
  // Use a consistent fake token so the rate-limit key accumulates
  const fakeToken = `rl_test_898_${Math.floor(Date.now() / 60000)}`; // stable within same minute
  let got429 = false;
  let attemptCount = 0;
  for (let i = 1; i <= 7; i++) {
    attemptCount = i;
    try {
      await axios.get(`${BASE}/api/v1/capsules/${fakeToken}`);
    } catch (e: any) {
      if (e.response?.status === 429) { got429 = true; break; }
      if (e.response?.status !== 404) {
        // Unexpected non-404 non-429 — log and continue
      }
    }
  }
  rec(6, 'Rate limiting returns 429 after repeated attempts', got429,
    got429 ? `Got 429 within ${attemptCount} attempts` :
    `No 429 after ${attemptCount} attempts — rate limiter may use IP-based key not matching this runner`);

  // ── Step 7: Encryption present — api_key_encrypted column exists + encryptToken used ──
  const hasEncryptCall = routesSrc.includes('encryptToken(api_key)');
  const encColRes = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='recipient_api_connections' AND column_name='api_key_encrypted'`
  );
  const hasEncCol = encColRes.rows.length > 0;
  rec(7, 'Encryption: api_key_encrypted column + encryptToken called',
    hasEncryptCall && hasEncCol,
    `api_key_encrypted column present: ${hasEncCol}, encryptToken(api_key) in handler: ${hasEncryptCall}`);

  // ── Step 8: Stripe metering present in query handler ──
  const executorSrc = fs.readFileSync(
    path.join(__dirname, '../services/recipient-agent-executor.service.ts'), 'utf-8'
  );
  const hasStripe = executorSrc.includes('stripe.billing.meterEvents.create');
  rec(8, 'Stripe metering present in query handler', hasStripe,
    hasStripe
      ? 'stripe.billing.meterEvents.create confirmed in executeRecipientQuery'
      : 'No Stripe meter event call found');

  // ── Summary ──
  const passed = results.filter(r => r.pass).length;
  console.log(`\n══════════════════════════════════════`);
  console.log(`Validation: ${passed}/${results.length} steps passed`);
  if (passed === results.length) console.log('ALL PASS ✓');
  else results.filter(r => !r.pass).forEach(r => console.log(`  FAIL Step ${r.step}: ${r.label}`));

  return results;
}

run().then(results => {
  process.exit(results.every(r => r.pass) ? 0 : 1);
}).catch(e => {
  console.error('SCRIPT ERROR:', e.message);
  process.exit(1);
});
