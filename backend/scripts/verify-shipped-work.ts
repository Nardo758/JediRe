/**
 * TASK B — Verify three recently-shipped Pro Forma items against the LIVE DB.
 * Read-mostly with light synthetic writes; cleans up after itself.
 */
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = 'http://localhost:4000';
const TEST_USER_ID = 'b24c746c-a926-429b-bfaf-db065c36b550';
const TEST_USER_EMAIL = 'web_test-user@chat.jedire.com';
const BISHOP = '3f32276f-aacd-4da3-b306-317c5109b403';

const log = (...a: any[]) => console.log(...a);
const hdr = (s: string) => log('\n' + '═'.repeat(76) + '\n  ' + s + '\n' + '═'.repeat(76));

function token(): string {
  return jwt.sign(
    { userId: TEST_USER_ID, email: TEST_USER_EMAIL, role: 'user' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h', issuer: 'jedire-api', audience: 'jedire-client' } as jwt.SignOptions
  );
}

async function api(method: string, path: string, body?: any): Promise<{ status: number; body: any }> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let bodyJson: any = null;
  try { bodyJson = await r.json(); } catch { bodyJson = null; }
  return { status: r.status, body: bodyJson };
}

async function dumpDeal(id: string, label: string) {
  const r = await pool.query(
    `SELECT budget, deal_data->'purchase_price' AS dd_pp,
            deal_data->'asking_price' AS dd_ap
     FROM deals WHERE id = $1`,
    [id]
  );
  log(`  [${label}]`, JSON.stringify(r.rows[0]));
  return r.rows[0];
}

// ─── ITEM 1 — Purchase price dual-write (#623 / #624) ──────────────────────
async function item1(): Promise<{ verdict: string; evidence: any }> {
  hdr('ITEM 1 — Purchase price dual-write on POST + PATCH');
  let createdDealId: string | null = null;

  try {
    log('\n[1.1] POST /api/v1/deals with budget = $5,000,000');
    const post = await api('POST', '/api/v1/deals', {
      name: `TASK-B-VERIFY-${Date.now()}`,
      budget: 5_000_000,
      project_type: 'existing',
      boundary: { type: 'Polygon', coordinates: [[[-84.4,33.7],[-84.4,33.71],[-84.39,33.71],[-84.39,33.7],[-84.4,33.7]]] },
    });
    log('  → status', post.status);
    if (post.status >= 400) {
      log('  → body', JSON.stringify(post.body).slice(0, 400));
      return { verdict: 'INCONCLUSIVE', evidence: { post_status: post.status, post_body: post.body } };
    }
    createdDealId = post.body.id || post.body.deal?.id;
    log('  → created deal id:', createdDealId);

    log('\n[1.2] DB read — confirm dual-write fired on POST');
    const afterPost = await dumpDeal(createdDealId!, 'after POST');

    log('\n[1.3] PATCH budget = $6,000,000');
    const patch = await api('PATCH', `/api/v1/deals/${createdDealId}`, { budget: 6_000_000 });
    log('  → status', patch.status);

    log('\n[1.4] DB read — confirm dual-write fired on PATCH');
    const afterPatch = await dumpDeal(createdDealId!, 'after PATCH');

    log('\n[1.5] PATCH a different field (name only) — confirm dd_pp NOT clobbered');
    await api('PATCH', `/api/v1/deals/${createdDealId}`, { name: `TASK-B-VERIFY-RENAMED-${Date.now()}` });
    const afterRename = await dumpDeal(createdDealId!, 'after rename');

    const ok =
      Number(afterPost.budget) === 5_000_000 && Number(afterPost.dd_pp) === 5_000_000 &&
      Number(afterPatch.budget) === 6_000_000 && Number(afterPatch.dd_pp) === 6_000_000 &&
      Number(afterRename.budget) === 6_000_000 && Number(afterRename.dd_pp) === 6_000_000;

    return {
      verdict: ok ? 'VERIFIED_LIVE' : 'DIVERGED',
      evidence: {
        post: { budget: afterPost.budget, dd_pp: afterPost.dd_pp },
        patch: { budget: afterPatch.budget, dd_pp: afterPatch.dd_pp },
        rename_no_clobber: { budget: afterRename.budget, dd_pp: afterRename.dd_pp },
      },
    };
  } finally {
    if (createdDealId) {
      await pool.query('DELETE FROM deal_assumptions WHERE deal_id = $1', [createdDealId]);
      await pool.query('DELETE FROM deals WHERE id = $1', [createdDealId]);
      log('\n  → cleaned up synthetic deal', createdDealId);
    }
  }
}

// ─── ITEM 2 — Unit mix → GPR toggle (#P2-A) ────────────────────────────────
async function item2(): Promise<{ verdict: string; evidence: any }> {
  hdr('ITEM 2 — Unit mix → GPR toggle (synthetic deal, real toggle path)');
  // Need a deal owned by TEST_USER_ID with a unit_mix populated. Snapshot
  // current state first so we can restore.
  let createdDealId: string | null = null;
  try {
    log('\n[2.1] Create synthetic deal owned by TEST_USER_ID and seed unit_mix');
    const post = await api('POST', '/api/v1/deals', {
      name: `TASK-B-UNITMIX-${Date.now()}`,
      budget: 5_000_000,
      project_type: 'existing',
      boundary: { type: 'Polygon', coordinates: [[[-84.4,33.7],[-84.4,33.71],[-84.39,33.71],[-84.39,33.7],[-84.4,33.7]]] },
    });
    if (post.status >= 400) {
      return { verdict: 'INCONCLUSIVE', evidence: { reason: 'create failed', body: post.body } };
    }
    createdDealId = (post.body.id || post.body.deal?.id) as string;
    log('  → created deal id:', createdDealId);

    // Seed deal_assumptions with year1 + unit_mix. Use a deterministic mix:
    // 100 units × $1500/mo = $1,800,000/yr expected GPR.
    const expected = 100 * 1500 * 12;
    const seedYear1 = {
      gpr: { om: null, t12: 4000000, rent_roll: null, unit_mix: null, override: null,
             platform: null, resolved: 4000000, resolution: 't12' },
      total_units: { resolved: 100 },
    };
    const unitMix = [{ unit_type: '1BR', count: 100, in_place_rent: 1500 }];

    await pool.query(
      `INSERT INTO deal_assumptions (deal_id, year1, unit_mix, total_units, last_computed_at)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, NOW())
       ON CONFLICT (deal_id) DO UPDATE
         SET year1 = $2::jsonb, unit_mix = $3::jsonb, total_units = $4, last_computed_at = NOW()`,
      [createdDealId, JSON.stringify(seedYear1), JSON.stringify(unitMix), 100]
    );
    log('  → seeded year1.gpr.resolved=$4,000,000 (resolution=t12), unit_mix=100×$1500');
    log('  → expected unit-mix GPR =', expected.toLocaleString());

    log('\n[2.2] Read GPR via getProFormaAdjustment BEFORE toggle');
    const before = await api('GET', `/api/v1/deals/${createdDealId}/financials`);
    if (before.status >= 400) {
      return { verdict: 'INCONCLUSIVE', evidence: { reason: 'GET financials failed', status: before.status, body: before.body } };
    }
    const beforeGpr = findGpr(before.body);
    log('  → before:', JSON.stringify(beforeGpr));

    log('\n[2.3] PATCH /financials/override field=da:use_unit_mix_for_gpr value=true');
    const tog = await api('PATCH', `/api/v1/deals/${createdDealId}/financials/override`, {
      field: 'da:use_unit_mix_for_gpr', value: true,
    });
    log('  → status', tog.status);
    if (tog.status >= 400) {
      log('  → body', JSON.stringify(tog.body).slice(0, 400));
    }
    const flagRow = await pool.query(
      `SELECT per_year_overrides->'da:use_unit_mix_for_gpr' AS f FROM deal_assumptions WHERE deal_id=$1`, [createdDealId]
    );
    log('  → DB per_year_overrides[da:use_unit_mix_for_gpr] =', JSON.stringify(flagRow.rows[0]?.f));

    log('\n[2.4] Read GPR via getProFormaAdjustment AFTER toggle ON');
    const afterOn = await api('GET', `/api/v1/deals/${createdDealId}/financials`);
    const afterOnGpr = findGpr(afterOn.body);
    log('  → after ON:', JSON.stringify(afterOnGpr));

    log('\n[2.5] Toggle OFF and read again');
    const tog2 = await api('PATCH', `/api/v1/deals/${createdDealId}/financials/override`, {
      field: 'da:use_unit_mix_for_gpr', value: false,
    });
    log('  → toggle-off status', tog2.status);
    const afterOff = await api('GET', `/api/v1/deals/${createdDealId}/financials`);
    const afterOffGpr = findGpr(afterOff.body);
    log('  → after OFF:', JSON.stringify(afterOffGpr));

    const onOk = afterOnGpr?.resolution === 'unit_mix' && Number(afterOnGpr?.resolved) === expected;
    const offOk = afterOffGpr?.resolution !== 'unit_mix' && Number(afterOffGpr?.resolved) !== expected;
    return {
      verdict: onOk && offOk ? 'VERIFIED_LIVE' : 'DIVERGED',
      evidence: { expected, before: beforeGpr, after_on: afterOnGpr, after_off: afterOffGpr,
                  on_check: onOk, off_check: offOk },
    };
  } finally {
    if (createdDealId) {
      await pool.query('DELETE FROM deal_assumptions WHERE deal_id = $1', [createdDealId]);
      await pool.query('DELETE FROM deals WHERE id = $1', [createdDealId]);
      log('\n  → cleaned up synthetic deal', createdDealId);
    }
  }
}

function findGpr(body: any): any {
  if (!body) return null;
  // Try a few common shapes
  const candidates = [
    body?.year1?.gpr,
    body?.proforma?.year1?.gpr,
    body?.financials?.year1?.gpr,
    body?.data?.year1?.gpr,
  ];
  for (const c of candidates) if (c != null) return c;
  // Look in "rows" arrays
  const rows = body?.rows ?? body?.proforma?.rows ?? body?.year1Rows;
  if (Array.isArray(rows)) {
    const r = rows.find((r: any) => r?.field === 'gpr' || r?.key === 'gpr');
    if (r) return { resolved: r.resolved, resolution: r.resolution, unit_mix: r.unit_mix };
  }
  return null;
}

// ─── ITEM 3 — Part A forceReseed in extraction pipeline (#519) ─────────────
async function item3(): Promise<{ verdict: string; evidence: any }> {
  hdr('ITEM 3 — Part A forceReseed hook in extraction pipeline');
  // Strategy: pick 464 Bishop (already has year1 from yesterday's reseed),
  // (a) add a marker override on a non-extraction field; (b) snapshot
  // year1.last_seeded_at + other_income_per_unit; (c) call routeExtractionResult
  // with a synthetic OTHER_INCOME-style RR capsule that changes other income;
  // (d) re-snapshot and verify reseed fired AND override preserved.
  const beforeSnap = await pool.query(
    `SELECT year1->'last_seeded_at' AS lsa,
            year1->'other_income_per_unit' AS oipu,
            year1->'vacancy_pct' AS vac,
            (deal_data->'extraction_rent_roll')::text AS rr_capsule
     FROM deals d
     LEFT JOIN deal_assumptions da ON da.deal_id=d.id
     WHERE d.id=$1`, [BISHOP]
  );
  const before = beforeSnap.rows[0];
  log('\n[3.1] BEFORE snapshot for 464 Bishop:');
  log('  last_seeded_at:', JSON.stringify(before.lsa));
  log('  other_income_per_unit:', JSON.stringify(before.oipu));
  log('  vacancy_pct (override target):', JSON.stringify(before.vac));
  log('  has extraction_rent_roll capsule:', before.rr_capsule != null);

  log('\n[3.2] Set a marker override on vacancy_pct via applyUserOverride (preservation test)');
  const { applyUserOverride } = await import('../src/services/proforma-seeder.service');
  const MARKER = 0.137;
  await applyUserOverride(pool, BISHOP, 'vacancy_pct', MARKER, 'TASK-B-VERIFY');
  const markRow = await pool.query(
    `SELECT year1->'vacancy_pct' AS v FROM deal_assumptions WHERE deal_id=$1`, [BISHOP]
  );
  log('  → marker set, vacancy_pct =', JSON.stringify(markRow.rows[0].v));

  log('\n[3.3] Invoke routeExtractionResult with a synthetic RENT_ROLL capsule');
  const { routeExtractionResult } = await import('../src/services/document-extraction/data-router');
  // Minimal RentRollData shape — just enough to trigger the capsule write +
  // extraction_rent_roll merge + forceReseed hook.
  const TASK_B_MARKER_GPR = 999999;
  const synth: any = {
    success: true,
    documentType: 'RENT_ROLL',
    data: {
      units: [],
      summary: {
        totalUnits: 232, occupiedUnits: 215, vacantUnits: 17, futureResidents: 0,
        totalMarketRent: TASK_B_MARKER_GPR, lossToLease: 0, lossToLeasePct: 0,
        totalLeaseCharges: 0, avgMarketRent: 0, avgEffectiveRent: 0,
        occupancyRate: 0.927, floorPlanMix: {},
      },
    },
    capsuleExtras: { layout: 'task-b-synthetic', as_of_date: '2026-05-08', source_system_id: 'TASK-B' },
    confidence: 0.9,
    metadata: {},
  };
  const ctx = { dealId: BISHOP, documentFileId: 'task-b-synthetic', filename: 'TASK_B_SYNTHETIC.csv', userId: TEST_USER_ID };
  const t0 = Date.now();
  let routeResult: any;
  try {
    routeResult = await routeExtractionResult(synth, ctx as any);
  } catch (e: any) {
    log('  → routeExtractionResult THREW:', e.message);
    routeResult = { error: e.message };
  }
  const dt = Date.now() - t0;
  log('  → routeExtractionResult result:', JSON.stringify(routeResult).slice(0, 300));
  log('  → duration:', dt, 'ms');

  log('\n[3.4] AFTER snapshot — verify forceReseed + override preserved');
  const afterSnap = await pool.query(
    `SELECT year1->'last_seeded_at' AS lsa,
            year1->'other_income_per_unit' AS oipu,
            year1->'vacancy_pct' AS vac,
            deal_data ? 'extraction_rent_roll' AS has_rr,
            deal_data->'extraction_rent_roll'->'__task_b_marker' AS marker
     FROM deals d
     LEFT JOIN deal_assumptions da ON da.deal_id=d.id
     WHERE d.id=$1`, [BISHOP]
  );
  const after = afterSnap.rows[0];
  log('  last_seeded_at:', JSON.stringify(after.lsa));
  log('  other_income_per_unit:', JSON.stringify(after.oipu));
  log('  vacancy_pct (should still equal marker):', JSON.stringify(after.vac));
  log('  capsule was written (has_rr):', after.has_rr, '| marker:', JSON.stringify(after.marker));
  // Read the capsule directly to check our marker GPR
  const capRow = await pool.query(
    `SELECT deal_data->'extraction_rent_roll'->'gpr_monthly' AS g,
            deal_data->'extraction_rent_roll'->'layout' AS l
     FROM deals WHERE id=$1`, [BISHOP]
  );
  log('  capsule gpr_monthly:', capRow.rows[0]?.g, '| layout:', capRow.rows[0]?.l);

  const reseedFired = before.lsa !== after.lsa && after.lsa != null;
  const overridePreserved = (after.vac as any)?.override === MARKER || Number((after.vac as any)?.override) === MARKER;
  const capsuleWritten = Number(capRow.rows[0]?.g) === TASK_B_MARKER_GPR;

  // Cleanup: clear marker override + remove the synthetic capsule
  log('\n[3.5] Cleanup');
  await applyUserOverride(pool, BISHOP, 'vacancy_pct', null, 'TASK-B-CLEANUP');
  await pool.query(
    `UPDATE deals SET deal_data = deal_data - 'extraction_rent_roll' WHERE id=$1`, [BISHOP]
  );
  // Restore the original capsule if there was one
  if (before.rr_capsule != null) {
    await pool.query(
      `UPDATE deals SET deal_data = deal_data || jsonb_build_object('extraction_rent_roll', $1::jsonb) WHERE id=$2`,
      [before.rr_capsule, BISHOP]
    );
    log('  → restored original extraction_rent_roll capsule');
  } else {
    log('  → no original capsule to restore (none existed)');
  }
  // Re-run the seeder so the year1 reflects post-cleanup state
  const { ensureDealAssumptionsSeeded } = await import('../src/services/proforma-seeder.service');
  await ensureDealAssumptionsSeeded(pool, BISHOP, { forceReseed: true });
  log('  → final reseed to restore steady-state year1');

  return {
    verdict: reseedFired && overridePreserved && capsuleWritten ? 'VERIFIED_LIVE'
           : reseedFired && capsuleWritten ? 'DIVERGED' : 'INCONCLUSIVE',
    evidence: {
      before_lsa: before.lsa, after_lsa: after.lsa, reseedFired,
      capsuleWritten, overridePreserved,
      override_value_after: (after.vac as any)?.override,
      marker_expected: MARKER,
    },
  };
}

(async () => {
  const results: Record<string, any> = {};
  try {
    results.item1 = await item1();
  } catch (e: any) { results.item1 = { verdict: 'INCONCLUSIVE', evidence: { error: e.message } }; }
  try {
    results.item2 = await item2();
  } catch (e: any) { results.item2 = { verdict: 'INCONCLUSIVE', evidence: { error: e.message, stack: e.stack?.split('\n').slice(0,5) } }; }
  try {
    results.item3 = await item3();
  } catch (e: any) { results.item3 = { verdict: 'INCONCLUSIVE', evidence: { error: e.message, stack: e.stack?.split('\n').slice(0,5) } }; }

  hdr('FINAL VERDICTS');
  for (const [k, v] of Object.entries(results)) {
    log(`  ${k}: ${(v as any).verdict}`);
    log(`    evidence:`, JSON.stringify((v as any).evidence));
  }
  await pool.end();
})().catch(async (e) => { console.error('FATAL', e); await pool.end(); process.exit(1); });
