import 'dotenv/config';
import { Pool } from 'pg';
import { getCapsuleIntelligence } from '../src/services/capsule-intelligence.service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DIAGNOSTIC_USER_ID = '00000000-0000-0000-0000-000000d1a9c0';
const DIAGNOSTIC_CAPSULE_ID = '00000000-0000-0000-0000-0000d1a90ca5';

let pipelineFailed = false;

async function runTests() {
  console.log('\n══════════════════════════════════════');
  console.log('JEDI RE — NEURAL NETWORK DIAGNOSTIC');
  console.log('══════════════════════════════════════\n');

  // ── 1. KG Market nodes ──────────────────────────────────────
  console.log('TEST 1: Knowledge Graph — Market nodes');
  const markets = await pool.query(
    `SELECT id, name, properties FROM knowledge_graph_nodes WHERE type = 'Market' ORDER BY id`
  );
  console.log(`  Markets: ${markets.rows.length}`);
  markets.rows.forEach(r => console.log(`    ✅ ${r.id} — ${r.name}`));

  // ── 2. KG Submarket nodes (Atlanta, resolved via IN_MARKET edges) ──────
  console.log('\nTEST 2: Knowledge Graph — Atlanta submarkets');
  const subs = await pool.query(`
    SELECT n.id, n.name
    FROM knowledge_graph_nodes n
    JOIN knowledge_graph_edges e
      ON e.source_id = n.id
     AND e.type = 'IN_MARKET'
     AND e.target_id = 'market:atlanta'
    WHERE n.type = 'Submarket'
    ORDER BY n.id
    LIMIT 15
  `);
  console.log(`  Submarkets: ${subs.rows.length}`);
  subs.rows.forEach(r => console.log(`    ✅ ${r.name} (${r.id})`));

  // ── 3. Development projects ─────────────────────────────────
  console.log('\nTEST 3: Development Projects — Atlanta pipeline');
  const projects = await pool.query(
    `SELECT name, submarket, units, construction_status
     FROM development_projects
     WHERE market_id = 'atlanta'
     ORDER BY units DESC NULLS LAST
     LIMIT 5`
  );
  const projectTotal = await pool.query(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(units), 0)::int AS total
     FROM development_projects WHERE market_id = 'atlanta'`
  );
  console.log(`  Projects: ${projectTotal.rows[0].count}, Total units: ${projectTotal.rows[0].total}`);
  projects.rows.forEach(r =>
    console.log(`    • ${r.name}: ${r.units ?? '—'} units (${r.construction_status ?? 'unknown'})`)
  );

  // ── 4. KG edges ─────────────────────────────────────────────
  console.log('\nTEST 4: Knowledge Graph — Edge types');
  const edges = await pool.query(
    `SELECT type, COUNT(*)::int AS count FROM knowledge_graph_edges GROUP BY type ORDER BY count DESC`
  );
  edges.rows.forEach(r => console.log(`    ${r.type}: ${r.count}`));

  // ── 5. Create / reuse Atlanta test capsule ──────────────────
  // Idempotent: keyed by fixed DIAGNOSTIC_CAPSULE_ID so re-runs always
  // mutate the SAME row and never accidentally touch any other capsule.
  console.log('\nTEST 5: Create Atlanta test capsule');
  await pool.query(
    `
    INSERT INTO deal_capsules (id, user_id, property_address, deal_data, platform_intel, status)
    VALUES (
      $1::uuid,
      $2::uuid,
      '100 Peachtree St NE, Atlanta, GA',
      '{"city":"Atlanta","state":"GA","property_type":"multifamily","units":200,"diagnostic":true}'::jsonb,
      '{}'::jsonb,
      'active'
    )
    ON CONFLICT (id) DO NOTHING
    `,
    [DIAGNOSTIC_CAPSULE_ID, DIAGNOSTIC_USER_ID]
  );

  // Sanity-check the row we will mutate is in fact the diagnostic row.
  // Guardrail does NOT abort the run — it only skips TESTs 6/7 so the rest
  // of the diagnostic (KG queries, Data Library survey, summary) still prints.
  const verify = await pool.query(
    `SELECT id, user_id, property_address, deal_data->>'diagnostic' AS diag_flag
     FROM deal_capsules WHERE id = $1::uuid`,
    [DIAGNOSTIC_CAPSULE_ID]
  );
  let capsuleId: string | null = null;
  if (
    !verify.rows[0] ||
    verify.rows[0].user_id !== DIAGNOSTIC_USER_ID ||
    verify.rows[0].diag_flag !== 'true'
  ) {
    pipelineFailed = true;
    console.log(
      `  ⚠️  Diagnostic capsule guardrail failed — TESTs 6/7 will be skipped to avoid mutating a non-diagnostic row. Row: ${JSON.stringify(verify.rows[0] ?? null)}`
    );
  } else {
    capsuleId = verify.rows[0].id;
    console.log(`  Using diagnostic capsule: ${capsuleId} (${verify.rows[0].property_address})`);
  }

  // ── 6. Seed capsule intelligence ────────────────────────────
  console.log('\nTEST 6: Capsule Intelligence — Seeding from Data Library + KG');
  if (!capsuleId) {
    console.log('  ⏭  Skipped — guardrail in TEST 5 prevented capsule selection.');
  } else try {
    const intel = await getCapsuleIntelligence().seedCapsule({
      capsuleId,
      propertyAddress: '100 Peachtree St NE',
      city: 'Atlanta',
      state: 'GA',
      propertyType: 'multifamily',
      units: 200,
    });
    console.log(`  ✅ Data quality score: ${intel.dataQualityScore}/100`);
    console.log(`  ✅ Comps found: ${intel.dataLibraryCompsFound}`);
    console.log(`  ✅ KG linked: ${intel.knowledgeGraphLinked}`);
    console.log(`  Assumptions seeded:`);
    if (intel.marketRent)
      console.log(
        `    • Market rent: $${intel.marketRent.value} (${(intel.marketRent.confidence * 100).toFixed(0)}% confidence) — ${intel.marketRent.source}`
      );
    if (intel.vacancyRate)
      console.log(`    • Vacancy: ${intel.vacancyRate.value}% — ${intel.vacancyRate.source}`);
    if (intel.expenseRatio)
      console.log(`    • Expense ratio: ${intel.expenseRatio.value}% — ${intel.expenseRatio.source}`);
    if (intel.goingInCapRate)
      console.log(`    • Cap rate: ${intel.goingInCapRate.value}% — ${intel.goingInCapRate.source}`);
    if (intel.supplyRisk)
      console.log(`    • Supply risk: ${intel.supplyRisk.value} (${intel.supplyRisk.notes ?? ''})`);
    if (intel.pipelineUnits) console.log(`    • Pipeline units: ${intel.pipelineUnits.value}`);
    console.log(`  Gaps: ${intel.gaps.join(', ') || 'none'}`);
    console.log(`  Recommendations:`);
    intel.recommendations.forEach(r => console.log(`    → ${r}`));
  } catch (err) {
    pipelineFailed = true;
    console.log(`  ❌ FAILED: ${err}`);
    if (err instanceof Error && err.stack) console.log(err.stack);
  }

  // ── 7. Verify capsule platform_intel populated ───────────────
  console.log('\nTEST 7: Verify platform_intel saved to DB');
  if (!capsuleId) {
    console.log('  ⏭  Skipped — guardrail in TEST 5 prevented capsule selection.');
  } else {
    const saved = await pool.query(
      `
      SELECT 
        platform_intel->'intelligence'->>'dataQualityScore' AS quality,
        platform_intel->'intelligence'->>'compsFound' AS comps,
        platform_intel->'intelligence'->'gaps' AS gaps,
        platform_intel->'intelligence'->'assumptions' AS assumptions
      FROM deal_capsules WHERE id = $1
      `,
      [capsuleId]
    );
    if (saved.rows[0]?.quality !== null && saved.rows[0]?.quality !== undefined) {
      const row = saved.rows[0];
      console.log(`  ✅ platform_intel populated — quality: ${row.quality}, comps: ${row.comps}`);
      const assumptionKeys = row.assumptions ? Object.keys(row.assumptions) : [];
      console.log(`  Assumption keys saved: ${assumptionKeys.join(', ') || '(none)'}`);
      console.log(`  Gaps persisted: ${JSON.stringify(row.gaps)}`);
    } else {
      pipelineFailed = true;
      console.log(`  ❌ platform_intel NOT populated`);
    }
  }

  // ── 8. Check Deal node in KG ────────────────────────────────
  console.log('\nTEST 8: Knowledge Graph — Deal nodes');
  const dealNode = await pool.query(
    `SELECT id, type, name FROM knowledge_graph_nodes WHERE type = 'Deal' LIMIT 5`
  );
  if (dealNode.rows.length > 0) {
    console.log(`  ✅ Deal nodes: ${dealNode.rows.length}`);
    dealNode.rows.forEach(r => console.log(`    • ${r.id} — ${r.name}`));
  } else {
    console.log(
      `  ⚠️  No Deal nodes in graph (expected — seedCapsule writes platform_intel only, does not insert KG Deal node)`
    );
  }

  // ── 9. KG node summary ──────────────────────────────────────
  console.log('\nTEST 9: Knowledge Graph — All node types');
  const allNodes = await pool.query(
    `SELECT type, COUNT(*)::int AS count FROM knowledge_graph_nodes GROUP BY type ORDER BY count DESC`
  );
  allNodes.rows.forEach(r => console.log(`    ${r.type}: ${r.count}`));

  // ── 10. Data Library — Atlanta files + assets ───────────────
  console.log('\nTEST 10: Data Library — Atlanta comps available');
  try {
    const dlFiles = await pool.query(`
      SELECT id, file_name, city, unit_count, property_type, source_type, parsing_status
      FROM data_library_files
      WHERE city ILIKE '%atlanta%'
         OR msa_key ILIKE '%atlanta%'
         OR submarket_key ILIKE '%atlanta%'
      LIMIT 5
    `);
    console.log(`  Files: ${dlFiles.rows.length}`);
    dlFiles.rows.forEach(r =>
      console.log(`    • ${r.file_name} — ${r.city ?? '?'}, ${r.unit_count ?? '?'} units, parse=${r.parsing_status ?? '?'}`)
    );
    if (dlFiles.rows.length === 0) {
      console.log(`  ℹ️  No Atlanta files yet — upload T12s/OMs to Data Library to improve seeding`);
    }

    const dlAssets = await pool.query(`
      SELECT property_name, city, state, unit_count, cap_rate, avg_rent, expense_ratio
      FROM data_library_assets
      WHERE city ILIKE '%atlanta%' OR address ILIKE '%atlanta%' OR msa_name ILIKE '%atlanta%'
      LIMIT 5
    `);
    console.log(`  Assets: ${dlAssets.rows.length}`);
    dlAssets.rows.forEach(r =>
      console.log(
        `    • ${r.property_name ?? '(unnamed)'} — ${r.city ?? '?'}, ${r.unit_count ?? '?'} units, cap=${r.cap_rate ?? '—'}, avgRent=${r.avg_rent ?? '—'}, expRatio=${r.expense_ratio ?? '—'}`
      )
    );
  } catch (err) {
    console.log(`  ❌ ${err}`);
  }

  // ── SUMMARY ──────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════');
  console.log('SUMMARY');
  console.log('══════════════════════════════════════');
  const nodeCount = await pool.query(`SELECT COUNT(*)::int AS n FROM knowledge_graph_nodes`);
  const edgeCount = await pool.query(`SELECT COUNT(*)::int AS n FROM knowledge_graph_edges`);
  const capsuleCount = await pool.query(
    `SELECT COUNT(*)::int AS n FROM deal_capsules WHERE platform_intel != '{}'::jsonb`
  );
  console.log(`  KG Nodes:          ${nodeCount.rows[0].n}`);
  console.log(`  KG Edges:          ${edgeCount.rows[0].n}`);
  console.log(`  Seeded capsules:   ${capsuleCount.rows[0].n}`);
  console.log(`  Pipeline projects: ${projectTotal.rows[0].count}`);

  if (pipelineFailed) {
    console.log('\nDiagnostic complete — PIPELINE FAILURE detected (see TESTs 5/6/7).\n');
  } else {
    console.log('\nDiagnostic complete.\n');
  }
}

async function main() {
  try {
    await runTests();
  } finally {
    try {
      await pool.end();
    } catch {
      // ignore pool teardown errors
    }
  }
}

main()
  .then(() => process.exit(pipelineFailed ? 2 : 0))
  .catch(err => {
    console.error('Diagnostic crashed:', err);
    process.exit(1);
  });
