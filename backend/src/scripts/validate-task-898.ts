/**
 * Task #898 — End-to-end validation script
 * Runs 8 validation steps and prints PASS/FAIL for each.
 *
 * Endpoints tested (per task spec):
 *   Share creation: POST /api/v1/deals/:dealId/share/external
 *   Resolution:     GET  /api/v1/capsules/:accessToken
 *   (Aliases also confirmed: /capsules-ext/:id/share/external, /capsule-links/:token)
 *
 * Note on Step 6 (rate limiting):
 *   The in-memory rate limiter tracks per-IP (not per-token).
 *   Steps 2 and 3 each call GET /api/v1/capsules/:token once = 2 pre-consumed hits.
 *   The limiter allows 5 hits per 10 minutes from the same IP (127.0.0.1 here).
 *   Step 6 sends additional requests; the cumulative 6th+ triggers 429.
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'http://localhost:4000';
const CAPSULE_ID = '58661e80-1b03-4375-bcce-9b8b44a89c51';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

async function run() {
  const results: { step: number; label: string; pass: boolean; note: string }[] = [];
  let totalResolutionHits = 0;

  const rec = (step: number, label: string, pass: boolean, note: string) => {
    results.push({ step, label, pass, note });
    console.log(`[Step ${step}] ${pass ? 'PASS' : 'FAIL'} — ${label}: ${note}`);
  };

  // ── DB connection ──
  const { getPool, connectDatabase } = await import('../database/connection');
  await connectDatabase();
  const pool = getPool();

  // ── Step 1: Migration verified ──
  // 1a) capsule_external_shares has all required columns (capsule_piece4_tables.sql)
  // 1b) capsule_shares has preview_text + preview_metadata (capsule_sharing_preview.sql)
  try {
    const extCols = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'capsule_external_shares' ORDER BY ordinal_position`
    );
    const extColNames = extCols.rows.map((x: any) => x.column_name);
    const extPass = ['preview_text', 'preview_metadata', 'access_token'].every(c => extColNames.includes(c));

    const legacyCols = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'capsule_shares' ORDER BY ordinal_position`
    );
    const legacyColNames = legacyCols.rows.map((x: any) => x.column_name);
    const legacyPass = legacyColNames.includes('preview_text') && legacyColNames.includes('preview_metadata');

    const pass = extPass && legacyPass;
    rec(1, 'Migrations applied (capsule_external_shares + capsule_shares preview cols)',
      pass,
      [
        `capsule_external_shares: ${extColNames.join(', ')}`,
        `capsule_shares has preview_text: ${legacyColNames.includes('preview_text')}, preview_metadata: ${legacyColNames.includes('preview_metadata')}`,
      ].join(' | ')
    );
  } catch (e: any) {
    rec(1, 'Migrations applied', false, e.message);
  }

  // ── Mint a test JWT directly ──
  const { generateAccessToken } = await import('../auth/jwt');
  const token = generateAccessToken({
    userId: TEST_USER_ID,
    email: 'validator@jedire.internal',
    role: 'admin',
  } as any);
  const authHeader = { Authorization: `Bearer ${token}` };

  // ── Step 2: Create share WITH preview_text via spec endpoint POST /deals/:id/share/external
  //           Resolve via spec endpoint GET /capsules/:accessToken — returns preview verbatim ──
  let tokenWithPreview = '';
  try {
    const createRes = await axios.post(
      `${BASE}/api/v1/deals/${CAPSULE_ID}/share/external`,
      {
        recipient_email: 'validator+preview@test.com',
        share_type: 'external_agent_enabled',
        preview_text: 'Validation preview — 37 chars exact.',
      },
      { headers: authHeader }
    );
    tokenWithPreview = createRes.data.access_token;

    // Resolution via spec endpoint — counts as 1 hit toward rate-limit window
    const resolveRes = await axios.get(`${BASE}/api/v1/capsules/${tokenWithPreview}`);
    totalResolutionHits++;

    const match = resolveRes.data.preview_text === 'Validation preview — 37 chars exact.';
    rec(2, 'POST /deals/:id/share/external + GET /capsules/:token resolves preview verbatim',
      match,
      `preview_text="${resolveRes.data.preview_text}" agent_enabled=${resolveRes.data.agent_enabled}`);
  } catch (e: any) {
    rec(2, 'POST /deals/:id/share/external + GET /capsules/:token', false,
      e.response?.data?.error ?? e.message);
  }

  // ── Step 3: Create share WITHOUT preview_text — resolution returns null + must_connect_api ──
  let tokenNoPreview = '';
  try {
    const createRes = await axios.post(
      `${BASE}/api/v1/deals/${CAPSULE_ID}/share/external`,
      {
        recipient_email: 'validator+nopreview@test.com',
        share_type: 'external_view',
      },
      { headers: authHeader }
    );
    tokenNoPreview = createRes.data.access_token;

    const resolveRes = await axios.get(`${BASE}/api/v1/capsules/${tokenNoPreview}`);
    totalResolutionHits++;

    const pass = resolveRes.data.preview_text === null && resolveRes.data.must_connect_api === true;
    rec(3, 'GET /capsules/:token (no preview) returns null + must_connect_api:true', pass,
      `preview_text=${resolveRes.data.preview_text} must_connect_api=${resolveRes.data.must_connect_api}`);
  } catch (e: any) {
    rec(3, 'GET /capsules/:token no-preview', false, e.response?.data?.error ?? e.message);
  }

  // ── Verify GET /capsules/:uuid (UUID) still returns 401 (authenticated capsule detail), not 404 ──
  try {
    await axios.get(`${BASE}/api/v1/capsules/${CAPSULE_ID}`);
  } catch (e: any) {
    const status = e.response?.status;
    if (status !== 401 && status !== 403 && status !== 200) {
      console.log(`[Route sanity] WARNING: GET /api/v1/capsules/${CAPSULE_ID} (UUID) returned ${status} — expected 401/403/200`);
    } else {
      console.log(`[Route sanity] GET /api/v1/capsules/${CAPSULE_ID} (UUID) → ${status} (correct — UUID passed to auth route)`);
    }
  }

  // ── Step 4: preview_text stored on capsule_external_shares only, not derived from deals ──
  const routesSrc = fs.readFileSync(
    path.join(__dirname, '../api/rest/capsule-sharing.routes.ts'), 'utf-8'
  );
  const hasCorrectQuery = routesSrc.includes('FROM capsule_external_shares ces');
  const doesNotJoinDeals = !/FROM capsule_external_shares[\s\S]{0,300}JOIN deals/m.test(routesSrc);
  rec(4, 'preview_text stored on share table only (no JOIN to deals in resolution)',
    hasCorrectQuery && doesNotJoinDeals,
    hasCorrectQuery && doesNotJoinDeals
      ? 'Resolution SELECT reads capsule_external_shares only — confirmed no JOIN to deals'
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

  // ── Step 6: Rate limiting — confirm 429 after exceeding 5-per-10min threshold ──
  // Steps 2+3 already consumed ${totalResolutionHits} hits against the same IP window.
  // Remaining budget: ${5 - totalResolutionHits} more before 429. Sending 7 attempts.
  const fakeToken = `rl_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let got429 = false;
  let loopAttempt = 0;
  for (let i = 1; i <= 7; i++) {
    loopAttempt = i;
    try {
      await axios.get(`${BASE}/api/v1/capsules/${fakeToken}`);
      totalResolutionHits++;
    } catch (e: any) {
      totalResolutionHits++;
      if (e.response?.status === 429) { got429 = true; break; }
    }
  }
  rec(6, 'Rate limiting: 429 returned after threshold exceeded', got429,
    got429
      ? `429 at loop attempt ${loopAttempt} (${totalResolutionHits} cumulative resolution calls this session)`
      : `No 429 after ${loopAttempt} loop attempts (${totalResolutionHits} total hits)`);

  // ── Step 7: Encryption present — api_key_encrypted column + encryptToken called ──
  const hasEncryptCall = routesSrc.includes('encryptToken(api_key)');
  const encColRes = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='recipient_api_connections' AND column_name='api_key_encrypted'`
  );
  const hasEncCol = encColRes.rows.length > 0;
  rec(7, 'Encryption: api_key_encrypted column + encryptToken in handler',
    hasEncryptCall && hasEncCol,
    `api_key_encrypted column present: ${hasEncCol}, encryptToken(api_key) called: ${hasEncryptCall}`);

  // ── Step 8: Stripe metering present in query handler ──
  const executorSrc = fs.readFileSync(
    path.join(__dirname, '../services/recipient-agent-executor.service.ts'), 'utf-8'
  );
  const hasStripe = executorSrc.includes('stripe.billing.meterEvents.create');
  rec(8, 'Stripe metering in query handler (stripe.billing.meterEvents.create)',
    hasStripe,
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
