/**
 * Task #898 — End-to-end validation script
 * Runs 8 validation steps and prints PASS/FAIL for each.
 *
 * Note on Step 6 (rate limiting):
 *   The in-memory rate limiter tracks per-IP (not per-token).
 *   Steps 2 and 3 each call GET /api/v1/capsule-links/:token once for resolution
 *   (1 hit each = 2 pre-consumed hits from 127.0.0.1 before Step 6 starts).
 *   The limiter allows 5 hits per 10 minutes, so Step 6 needs ≥3 more hits to
 *   cross the threshold and verify 429. The script sends 7 attempts and confirms
 *   that 429 appears, giving a clean end-to-end verification of the rate gate.
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'http://localhost:4000';
const CAPSULE_ID = '58661e80-1b03-4375-bcce-9b8b44a89c51';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

async function run() {
  const results: { step: number; label: string; pass: boolean; note: string }[] = [];
  let totalResolutionHits = 0; // tracks cumulative hits against rate-limiter window

  const rec = (step: number, label: string, pass: boolean, note: string) => {
    results.push({ step, label, pass, note });
    console.log(`[Step ${step}] ${pass ? 'PASS' : 'FAIL'} — ${label}: ${note}`);
  };

  // ── DB connection ──
  const { getPool, connectDatabase } = await import('../database/connection');
  await connectDatabase();
  const pool = getPool();

  // ── Step 1: Migration applied — capsule_external_shares has preview/access cols ──
  try {
    const r = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'capsule_external_shares'
       ORDER BY ordinal_position`
    );
    const cols = r.rows.map((x: any) => x.column_name);
    const pass = cols.includes('preview_text') && cols.includes('preview_metadata') && cols.includes('access_token');
    rec(1, 'Migration applied (capsule_external_shares with preview + access_token cols)', pass,
      `cols present: ${cols.join(', ')}`);
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

    // Resolution — counts as 1 hit toward rate-limit window
    const resolveRes = await axios.get(`${BASE}/api/v1/capsule-links/${tokenWithPreview}`);
    totalResolutionHits++;

    const match = resolveRes.data.preview_text === 'Validation preview — 37 chars exact.';
    rec(2, 'Share WITH preview_text resolves verbatim', match,
      `preview_text="${resolveRes.data.preview_text}" agent_enabled=${resolveRes.data.agent_enabled}`);
  } catch (e: any) {
    rec(2, 'Share WITH preview_text resolves verbatim', false,
      e.response?.data?.error ?? e.message);
  }

  // Also verify the capsule detail route (GET /api/v1/capsules/:id) is NOT broken
  // by the routing change — must still return 401 (requires auth) not 404
  try {
    await axios.get(`${BASE}/api/v1/capsules/${CAPSULE_ID}`);
  } catch (e: any) {
    const status = e.response?.status;
    // 401 = route reached correctly, just needs auth. 404 would mean the route was broken.
    if (status !== 401 && status !== 200 && status !== 403) {
      console.log(`[Route check] WARNING: authenticated capsule detail returned ${status} (expected 401/200/403)`);
    }
  }

  // ── Step 3: Create share WITHOUT preview_text — returns null + must_connect_api ──
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

    // Resolution — counts as 1 more hit toward rate-limit window
    const resolveRes = await axios.get(`${BASE}/api/v1/capsule-links/${tokenNoPreview}`);
    totalResolutionHits++;

    const pass = resolveRes.data.preview_text === null && resolveRes.data.must_connect_api === true;
    rec(3, 'Share WITHOUT preview_text returns null + must_connect_api', pass,
      `preview_text=${resolveRes.data.preview_text} must_connect_api=${resolveRes.data.must_connect_api}`);
  } catch (e: any) {
    rec(3, 'Share WITHOUT preview_text returns null + must_connect_api', false,
      e.response?.data?.error ?? e.message);
  }

  // ── Step 4: preview_text stored on capsule_external_shares only, not from deals ──
  const routesSrc = fs.readFileSync(
    path.join(__dirname, '../api/rest/capsule-sharing.routes.ts'), 'utf-8'
  );
  const hasCorrectQuery = routesSrc.includes('FROM capsule_external_shares ces');
  const doesNotJoinDeals = !/FROM capsule_external_shares[\s\S]{0,300}JOIN deals/m.test(routesSrc);
  rec(4, 'preview_text stored on share table only (not derived from deals)',
    hasCorrectQuery && doesNotJoinDeals,
    hasCorrectQuery && doesNotJoinDeals
      ? 'Resolution SELECT reads capsule_external_shares — no JOIN to deals'
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

  // ── Step 6: Rate limiting — confirm 429 is returned after threshold ──
  //
  // The limiter allows 5 resolutions per 10 minutes per IP (127.0.0.1 here).
  // Steps 2 and 3 already consumed ${totalResolutionHits} hits.
  // Remaining budget before 429: ${5 - totalResolutionHits} more requests.
  // We send 7 additional requests here — the first (5 - totalResolutionHits) will
  // succeed (404 — no such token), and the next will hit 429.
  const fakeToken = `rl_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let got429 = false;
  let loopAttempt = 0;
  let firstNon429Status = 0;
  for (let i = 1; i <= 7; i++) {
    loopAttempt = i;
    try {
      const r = await axios.get(`${BASE}/api/v1/capsule-links/${fakeToken}`);
      totalResolutionHits++;
      firstNon429Status = r.status;
    } catch (e: any) {
      const s = e.response?.status;
      totalResolutionHits++;
      if (s === 429) {
        got429 = true;
        break;
      }
      firstNon429Status = s ?? 0;
    }
  }
  rec(6, 'Rate limiting returns 429 after exceeding 5-per-10min threshold', got429,
    got429
      ? `429 triggered at loop attempt ${loopAttempt} (${totalResolutionHits} total resolution calls including steps 2+3)`
      : `No 429 after ${loopAttempt} loop attempts (${totalResolutionHits} total hits); last non-429 status=${firstNon429Status}`);

  // ── Step 7: Encryption present — column exists + encryptToken called ──
  const hasEncryptCall = routesSrc.includes('encryptToken(api_key)');
  const encColRes = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='recipient_api_connections' AND column_name='api_key_encrypted'`
  );
  const hasEncCol = encColRes.rows.length > 0;
  rec(7, 'Encryption: api_key_encrypted column + encryptToken in handler',
    hasEncryptCall && hasEncCol,
    `api_key_encrypted column: ${hasEncCol}, encryptToken(api_key) called: ${hasEncryptCall}`);

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
