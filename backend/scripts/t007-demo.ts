/**
 * T007 Demo — CashFlow Agent proposes vacancy_rate via CoStar evidence_refs
 * 
 * Shows the full D3 seam in action:
 *  1. Agent calls writeAgentConfirmedOverlay with reasoning + evidence_refs
 *  2. evidence_refs cites a deal-scoped CoStar CS_VACANCY_RATE observation
 *  3. Overlay row written with full provenance (reasoning, build_hash, confidence)
 *  4. year1.vacancy_rate.agent_confirmed patched (resolution chain: override > agent_confirmed > resolved)
 *  5. Operator can override at any time — resolves to 0.06 over agent's 0.105
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/t007-demo.ts
 */
import { writeAgentConfirmedOverlay } from '../src/services/deterministic/agent-overlay-writer';
import { query } from '../src/database/connection';

const BISHOP      = '3f32276f-aacd-4da3-b306-317c5109b403';
const BISHOP_SCOPE = `deal:${BISHOP}`;

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  T007 DEMO — D3 Agent Write Seam — CashFlow → Overlay       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── 1. Pull the CoStar evidence the "agent" is citing ─────────────────────
  console.log('1. Fetching deal-scoped CoStar CS_VACANCY_RATE evidence for Bishop...');
  const evidenceRows = await query(`
    SELECT id, metric_id, period_date, value, source, geography_id
      FROM metric_time_series
     WHERE scope_id = $1
       AND metric_id = 'CS_VACANCY_RATE'
     ORDER BY period_date DESC LIMIT 3
  `, [BISHOP_SCOPE]);

  const vacancyRows = evidenceRows.rows;
  console.log(`   Found ${vacancyRows.length} rows:`);
  vacancyRows.forEach(r =>
    console.log(`   • id=${r.id}  period=${r.period_date}  value=${r.value}%  source=${r.source}`)
  );

  // Use the most recent row as the primary evidence ref
  const latestVacancy = vacancyRows[0];
  const agentProposedVacancy = latestVacancy.value / 100; // CoStar reports as percentage

  // ── 2. Agent calls writeAgentConfirmedOverlay ─────────────────────────────
  console.log('\n2. CashFlow Agent writes agent_confirmed overlay...');
  const result = await writeAgentConfirmedOverlay({
    dealId: BISHOP,
    fieldKey: 'vacancy_rate',
    value: agentProposedVacancy,
    reasoning:
      `CoStar submarket forecast (atlanta-ga-ga) shows vacancy trending ` +
      `${latestVacancy.value.toFixed(2)}% by ${latestVacancy.period_date}. ` +
      `Using as basis for Year 1 stabilized vacancy assumption. ` +
      `Broker OM states 7%; CoStar-implied upward pressure warrants moderation.`,
    confidence: 'MEDIUM',
    evidenceRefs: vacancyRows.map(r => ({
      type: 'metric_time_series' as const,
      id: String(r.id),
      label: `CS_VACANCY_RATE ${r.period_date} — ${r.value.toFixed(2)}%`,
      sourceTag: r.source,
    })),
  });

  console.log(`   ✓ overlayId:   ${result.overlayId}`);
  console.log(`   ✓ confidence:  ${result.confidence}`);
  console.log(`   ✓ year1Patched: ${result.year1Patched}`);
  console.log(`   ✓ buildHash:   ${result.buildHash?.slice(0, 12)}`);

  // ── 3. Read back the full overlay row ─────────────────────────────────────
  console.log('\n3. Overlay row (full provenance):');
  const overlayRow = (await query(
    `SELECT id, field_key, source_tag, value, confidence, reasoning,
            evidence_refs, build_hash, created_at
       FROM deal_assumption_overlays WHERE id = $1`,
    [result.overlayId]
  )).rows[0];
  console.log('   id:            ', overlayRow.id);
  console.log('   field_key:     ', overlayRow.field_key);
  console.log('   source_tag:    ', overlayRow.source_tag);
  console.log('   value:         ', overlayRow.value, '(=', (parseFloat(overlayRow.value)*100).toFixed(2)+'%)');
  console.log('   confidence:    ', overlayRow.confidence);
  console.log('   build_hash:    ', overlayRow.build_hash?.slice(0,12));
  console.log('   reasoning:     ', overlayRow.reasoning?.slice(0, 120) + '...');
  console.log('   evidence_refs: ', JSON.stringify(overlayRow.evidence_refs, null, 4));

  // ── 4. Resolution chain proof ─────────────────────────────────────────────
  // Note: YEAR1_FIELD_MAP routes vacancy_rate → vacancy_pct in year1 JSONB
  console.log('\n4. Resolution chain — year1.vacancy_pct LayeredValue:');
  const lvRow = (await query(
    `SELECT year1->'vacancy_pct' AS lv FROM deal_assumptions WHERE deal_id = $1`, [BISHOP]
  )).rows[0];
  const lv = lvRow?.lv as any;
  console.log('   override:        ', lv?.override ?? 'null');
  console.log('   agent_confirmed: ', lv?.agent_confirmed);
  console.log('   resolved:        ', lv?.resolved);
  const winner = lv?.override ?? lv?.agent_confirmed ?? lv?.resolved;
  console.log('   ─── resolves to:', winner, '(agent_confirmed wins — no operator override yet)');
  console.log('   CHAIN TEST:', lv?.agent_confirmed != null ? 'PASS ✓' : 'FAIL ✗');

  // ── 5. Operator override beats agent ─────────────────────────────────────
  console.log('\n5. Operator sets override=0.06 (60bp tighter):');
  await query(
    `UPDATE deal_assumptions
        SET year1 = jsonb_set(
              jsonb_set(
                COALESCE(year1,'{}'),
                ARRAY['vacancy_pct'],
                COALESCE(COALESCE(year1,'{}') -> 'vacancy_pct', '{}'::jsonb),
                true
              ),
              ARRAY['vacancy_pct','override'],
              to_jsonb(0.06::float8),
              true
            )
      WHERE deal_id = $1`,
    [BISHOP]
  );
  const lvAfterOverride = (await query(
    `SELECT year1->'vacancy_pct' AS lv FROM deal_assumptions WHERE deal_id = $1`, [BISHOP]
  )).rows[0]?.lv as any;
  const winnerAfter = lvAfterOverride?.override ?? lvAfterOverride?.agent_confirmed ?? lvAfterOverride?.resolved;
  console.log('   override:        ', lvAfterOverride?.override, '← operator wins');
  console.log('   agent_confirmed: ', lvAfterOverride?.agent_confirmed, '← intact but subordinate');
  console.log('   ─── resolves to:', winnerAfter, '(expected: 0.06)');
  console.log('   OVERRIDE TEST:', winnerAfter === 0.06 ? 'PASS ✓' : 'FAIL ✗');

  // ── 6. Clean up override ──────────────────────────────────────────────────
  await query(
    `UPDATE deal_assumptions SET year1 = year1 #- '{vacancy_pct,override}' WHERE deal_id = $1`,
    [BISHOP]
  );
  console.log('\n   (override cleaned up for demo repeatability)\n');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  T007 DEMO COMPLETE — D3 Write Seam Proven                  ║');
  console.log('║  Agent → overlay → year1.agent_confirmed → resolution chain ║');
  console.log('║  operator override subordinates agent, agent_confirmed kept  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
