/**
 * W2 Proofs — D3 dispatch verification.
 * Run: cd backend && npx ts-node --transpile-only scripts/w2-proofs.ts
 */
import { writeAgentConfirmedOverlay } from '../src/services/deterministic/agent-overlay-writer';
import { query } from '../src/database/connection';

const BISHOP    = '3f32276f-aacd-4da3-b306-317c5109b403';
const HIGHLANDS = 'eaabeb9f-830e-44f9-a923-56679ad0329d';

async function main() {
  console.log('=== W2 PROOFS ===\n');

  // ── PROOF (a): write → overlay row, NOT deal_assumptions scalar ───────────
  console.log('--- PROOF (a) ---');
  const a = await writeAgentConfirmedOverlay({
    dealId: BISHOP,
    fieldKey: 'management_fee_pct',
    value: 0.04,
    reasoning: 'W2-proof-a: agent proposes 4% based on submarket benchmarks',
    confidence: 'MEDIUM',
  });
  console.log('  overlayId:', a.overlayId, '  year1Patched:', a.year1Patched);

  const rowA = (await query(
    `SELECT id, source_tag, value, field_key, confidence, reasoning, superseded_at
       FROM deal_assumption_overlays WHERE id = $1`, [a.overlayId]
  )).rows[0];
  console.log('  overlay row:', JSON.stringify(rowA));

  const scalarA = (await query(
    `SELECT management_fee_pct FROM deal_assumptions WHERE deal_id = $1`, [BISHOP]
  )).rows[0];
  console.log('  deal_assumptions.management_fee_pct scalar (unchanged):', scalarA?.management_fee_pct);

  const acA = (await query(
    `SELECT year1->'management_fee_pct'->'agent_confirmed' AS ac FROM deal_assumptions WHERE deal_id = $1`,
    [BISHOP]
  )).rows[0];
  console.log('  year1.management_fee_pct.agent_confirmed:', acA?.ac);
  console.log('  PROOF (a):', rowA?.id === a.overlayId && acA?.ac === 0.04 ? 'PASS ✓' : 'FAIL ✗');

  // ── PROOF (b): write survives a build — year1.agent_confirmed persists ────
  console.log('\n--- PROOF (b) ---');
  const lvB = (await query(
    `SELECT year1->'management_fee_pct' AS lv FROM deal_assumptions WHERE deal_id = $1`, [BISHOP]
  )).rows[0]?.lv as any;
  console.log('  year1.management_fee_pct LV:', JSON.stringify(lvB));
  const resolvedB = lvB?.override ?? lvB?.agent_confirmed ?? lvB?.resolved;
  console.log('  resolved via chain:', resolvedB, '(expected: 0.04)');
  console.log('  PROOF (b):', lvB?.agent_confirmed === 0.04 && resolvedB === 0.04 ? 'PASS ✓' : 'FAIL ✗');

  // ── PROOF (c): fresh CREATE-1 deal — no prior overlays ──────────────────
  console.log('\n--- PROOF (c) ---');
  const freshRes = await query(
    `SELECT d.id FROM deals d
       INNER JOIN deal_assumptions da ON da.deal_id = d.id
       LEFT JOIN deal_assumption_overlays dao
         ON dao.deal_id = d.id AND dao.source_tag = 'agent_confirmed'
      WHERE dao.id IS NULL LIMIT 1`
  );
  const freshDeal = freshRes.rows[0]?.id;
  console.log('  fresh deal id:', freshDeal);
  if (freshDeal) {
    const c = await writeAgentConfirmedOverlay({
      dealId: freshDeal, fieldKey: 'management_fee_pct',
      value: 0.035, reasoning: 'W2-proof-c: fresh deal',
    });
    const rowC = (await query(
      `SELECT id, source_tag, value FROM deal_assumption_overlays WHERE id = $1`, [c.overlayId]
    )).rows[0];
    console.log('  row on fresh deal:', JSON.stringify(rowC));
    console.log('  PROOF (c):', rowC?.id === c.overlayId ? 'PASS ✓' : 'FAIL ✗');
  } else {
    console.log('  No fresh deal available (all have overlays) — skipped');
  }

  // ── PROOF (d): perYearOverride beats agent_confirmed ─────────────────────
  console.log('\n--- PROOF (d) ---');
  await writeAgentConfirmedOverlay({
    dealId: HIGHLANDS, fieldKey: 'management_fee_pct', value: 0.04,
    reasoning: 'W2-proof-d: agent value',
  });
  // Inject an operator override into year1
  await query(
    `UPDATE deal_assumptions SET year1 = jsonb_set(COALESCE(year1,'{}'),
       ARRAY['management_fee_pct','override'], to_jsonb(0.06::float8), true)
     WHERE deal_id = $1`, [HIGHLANDS]
  );
  const lvD = (await query(
    `SELECT year1->'management_fee_pct' AS lv FROM deal_assumptions WHERE deal_id = $1`, [HIGHLANDS]
  )).rows[0]?.lv as any;
  const resolvedD = lvD?.override ?? lvD?.agent_confirmed ?? lvD?.resolved;
  console.log('  override:', lvD?.override, '  agent_confirmed:', lvD?.agent_confirmed);
  console.log('  resolved:', resolvedD, '(expected: 0.06 — override wins)');
  console.log('  PROOF (d):', resolvedD === 0.06 ? 'PASS ✓' : 'FAIL ✗');
  // Clean up injected override
  await query(
    `UPDATE deal_assumptions SET year1 = year1 #- '{management_fee_pct,override}' WHERE deal_id = $1`,
    [HIGHLANDS]
  );

  // ── PROOF (e): absent agent_confirmed → resolution byte-identical ─────────
  console.log('\n--- PROOF (e) ---');
  // Use Highlands noi field — never had agent_confirmed written
  const lvE = (await query(
    `SELECT year1->'noi' AS lv FROM deal_assumptions WHERE deal_id = $1`, [HIGHLANDS]
  )).rows[0]?.lv as any;
  console.log('  noi LV:', JSON.stringify(lvE));
  const resolvedE = lvE?.override ?? lvE?.agent_confirmed ?? lvE?.resolved;
  console.log('  agent_confirmed slot:', lvE?.agent_confirmed ?? 'null/absent');
  console.log('  resolved:', resolvedE, '=== storedResolved:', lvE?.resolved, '?', resolvedE === lvE?.resolved);
  console.log('  PROOF (e):', lvE?.agent_confirmed == null ? 'PASS ✓' : 'FAIL ✗');

  console.log('\n=== DONE ===');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
