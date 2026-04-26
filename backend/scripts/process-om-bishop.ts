import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { DataLibraryService } from '../src/services/dataLibrary.service';
import { getCapsuleIntelligence } from '../src/services/capsule-intelligence.service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DIAGNOSTIC_USER_ID = '00000000-0000-0000-0000-000000d1a9c0';
const DIAGNOSTIC_CAPSULE_ID = '00000000-0000-0000-0000-0000d1a90ca5';
const PDF_PATH = path.resolve(
  __dirname,
  '../../attached_assets/464_Bishop_-_Offering_Memorandum_1777210022615.pdf',
);

async function main() {
  console.log('\n══════════════════════════════════════');
  console.log('OM PIPELINE — 464 BISHOP (ATLANTA, GA)');
  console.log('══════════════════════════════════════\n');

  if (!fs.existsSync(PDF_PATH)) {
    console.error(`PDF not found: ${PDF_PATH}`);
    process.exit(1);
  }
  const stat = fs.statSync(PDF_PATH);
  console.log(`PDF: ${PDF_PATH}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB\n`);

  // ── 1. Insert data_library_files row ─────────────────────────
  console.log('STEP 1: Insert data_library_files row');
  const fileInsert = await pool.query(
    `
    INSERT INTO data_library_files
      (user_id, file_name, file_path, file_size, mime_type, city, property_type, source_type, parsing_status)
    VALUES
      ($1, $2, $3, $4, 'application/pdf', 'Atlanta', 'multifamily', 'broker', 'pending')
    RETURNING id
    `,
    [
      DIAGNOSTIC_USER_ID,
      '464 Bishop - Offering Memorandum.pdf',
      PDF_PATH,
      stat.size,
    ],
  );
  const fileId: number = fileInsert.rows[0].id;
  console.log(`  ✅ file_id = ${fileId}\n`);

  // ── 2. Run real OM pipeline (parseOM + geocode + distribute + sentiment) ──
  console.log('STEP 2: Run OM pipeline (parseOM → geocode → distribute → sentiment)');
  console.log('  This calls Claude Sonnet via jediAI — typically 15–60s.\n');
  const dls = new DataLibraryService(pool);
  const t0 = Date.now();
  try {
    await dls.parseFileAsync(fileId, PDF_PATH, 'application/pdf');
  } catch (err) {
    console.error(`  ❌ Pipeline crashed: ${err instanceof Error ? err.message : err}`);
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  Pipeline finished in ${dt}s\n`);

  // ── 3. Inspect file row ──────────────────────────────────────
  console.log('STEP 3: Inspect resulting data_library_files row');
  const fileRow = await pool.query(
    `
    SELECT parsing_status, parsing_stage, parsing_errors, msa_key, submarket_key,
           om_extraction IS NOT NULL AS has_extraction,
           jsonb_typeof(om_extraction) AS extraction_type
    FROM data_library_files WHERE id = $1
    `,
    [fileId],
  );
  const f = fileRow.rows[0];
  console.log(`  parsing_status:  ${f.parsing_status}`);
  console.log(`  parsing_stage:   ${f.parsing_stage}`);
  console.log(`  parsing_errors:  ${f.parsing_errors ?? '(none)'}`);
  console.log(`  msa_key:         ${f.msa_key ?? '(unmapped)'}`);
  console.log(`  submarket_key:   ${f.submarket_key ?? '(unmapped)'}`);
  console.log(`  has om_extraction: ${f.has_extraction} (${f.extraction_type})\n`);

  // ── 4. Show extracted financial data ─────────────────────────
  console.log('STEP 4: Extracted financial data');
  const extraction = await pool.query(
    `
    SELECT
      om_extraction->'property'->>'name'              AS property_name,
      om_extraction->'property'->>'address'           AS address,
      om_extraction->'property'->>'city'              AS city,
      om_extraction->'property'->>'state'             AS state,
      om_extraction->'property'->>'zip'               AS zip,
      (om_extraction->'property'->>'units')::int      AS units,
      (om_extraction->'property'->>'yearBuilt')::int  AS year_built,
      om_extraction->'property'->>'propertyType'      AS property_type,
      (om_extraction->'metadata'->>'askingPrice')::numeric         AS asking_price,
      (om_extraction->'metadata'->>'guidancePricePerUnit')::numeric AS price_per_unit,
      (om_extraction->'metadata'->>'guidanceCapRate')::numeric     AS guidance_cap_rate,
      (om_extraction->'brokerProforma'->>'goingInCapRate')::numeric AS going_in_cap,
      (om_extraction->'brokerProforma'->>'exitCapRate')::numeric    AS exit_cap,
      (om_extraction->'brokerProforma'->>'stabilizedVacancy')::numeric AS stabilized_vacancy,
      (om_extraction->'replacementCost'->>'replacementCostPerUnit')::numeric AS replacement_cost_pu,
      jsonb_array_length(COALESCE(om_extraction->'marketComps'->'rentComps', '[]'::jsonb)) AS rent_comps,
      jsonb_array_length(COALESCE(om_extraction->'marketComps'->'saleComps', '[]'::jsonb)) AS sale_comps,
      om_extraction->'metadata'->>'broker' AS broker,
      (om_extraction->'metadata'->>'confidenceScore')::numeric AS confidence
    FROM data_library_files WHERE id = $1
    `,
    [fileId],
  );
  const e = extraction.rows[0] ?? {};
  if (!e.property_name && !e.units) {
    console.log('  ⚠️  No extracted data — pipeline likely failed; see errors above.\n');
  } else {
    console.log(`  Property:           ${e.property_name ?? '?'}`);
    console.log(`  Address:            ${e.address ?? '?'}, ${e.city ?? '?'}, ${e.state ?? '?'} ${e.zip ?? ''}`);
    console.log(`  Units:              ${e.units ?? '?'}`);
    console.log(`  Year Built:         ${e.year_built ?? '?'}`);
    console.log(`  Property Type:      ${e.property_type ?? '?'}`);
    console.log(`  Broker:             ${e.broker ?? '?'}`);
    console.log(`  Asking Price:       ${e.asking_price ? '$' + Number(e.asking_price).toLocaleString() : '?'}`);
    console.log(`  Price / Unit:       ${e.price_per_unit ? '$' + Number(e.price_per_unit).toLocaleString() : '?'}`);
    console.log(`  Guidance Cap Rate:  ${e.guidance_cap_rate ?? '?'}`);
    console.log(`  Going-In Cap:       ${e.going_in_cap ?? '?'}`);
    console.log(`  Exit Cap:           ${e.exit_cap ?? '?'}`);
    console.log(`  Stabilized Vacancy: ${e.stabilized_vacancy ?? '?'}`);
    console.log(`  Replacement $/Unit: ${e.replacement_cost_pu ? '$' + Number(e.replacement_cost_pu).toLocaleString() : '?'}`);
    console.log(`  Rent Comps:         ${e.rent_comps}`);
    console.log(`  Sale Comps:         ${e.sale_comps}`);
    console.log(`  Confidence:         ${e.confidence ?? '?'}\n`);
  }

  // ── 5. Show distribution rowcounts ───────────────────────────
  console.log('STEP 5: Distribution rowcounts (where the OM pipeline routes data)');
  for (const tbl of ['market_rent_comps', 'market_sale_comps', 'om_replacement_cost_data', 'broker_narratives']) {
    try {
      const r = await pool.query(`SELECT COUNT(*)::int AS n FROM ${tbl} WHERE file_id = $1`, [fileId]);
      console.log(`  ${tbl.padEnd(28)} rows for file_id=${fileId}: ${r.rows[0].n}`);
    } catch (err) {
      console.log(`  ${tbl.padEnd(28)} (skipped — ${err instanceof Error ? err.message.split('\n')[0] : err})`);
    }
  }
  console.log();

  // ── 6. Mirror extraction into data_library_assets so capsule intel can see it ──
  // capsule-intelligence.service queries data_library_assets directly. The OM
  // pipeline routes into market_rent_comps / market_sale_comps, NOT
  // data_library_assets, so we mirror the headline fields here.
  console.log('STEP 6: Mirror extraction into data_library_assets (capsule intel source)');
  if (e.units) {
    await pool.query(
      `
      INSERT INTO data_library_assets
        (source_type, property_name, address, city, state, zip_code,
         property_type, year_built, unit_count,
         avg_rent, occupancy_rate, expense_ratio, cap_rate,
         price_per_unit, asking_price, extraction_data, created_by)
      VALUES
        ('broker_om', $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11, $12,
         $13, $14, $15::jsonb, $16::uuid)
      `,
      [
        e.property_name,
        e.address,
        e.city,
        e.state,
        e.zip,
        e.property_type,
        e.year_built,
        e.units,
        // headline financials — pulled from broker proforma where present
        null, // avg_rent (would need rent roll parse; not exposed at top level)
        e.stabilized_vacancy != null ? Math.max(0, 1 - Number(e.stabilized_vacancy) / 100) : null,
        null, // expense_ratio (LLM doesn't surface as top-level)
        e.going_in_cap ?? e.guidance_cap_rate ?? null,
        e.price_per_unit,
        e.asking_price,
        JSON.stringify({ source_file_id: fileId, broker: e.broker, confidence: e.confidence }),
        DIAGNOSTIC_USER_ID,
      ],
    );
    console.log(`  ✅ Inserted asset row from extraction\n`);
  } else {
    console.log('  ⏭  Skipped — no extraction data\n');
  }

  // ── 7. Re-run capsule intelligence ───────────────────────────
  console.log('STEP 7: Re-run capsule intelligence on diagnostic capsule');
  try {
    const intel = await getCapsuleIntelligence().seedCapsule({
      capsuleId: DIAGNOSTIC_CAPSULE_ID,
      propertyAddress: '100 Peachtree St NE',
      city: 'Atlanta',
      state: 'GA',
      propertyType: 'multifamily',
      units: 200,
    });
    console.log(`  Data quality score: ${intel.dataQualityScore}/100`);
    console.log(`  Comps found:        ${intel.dataLibraryCompsFound}`);
    console.log(`  KG linked:          ${intel.knowledgeGraphLinked}`);
    console.log(`  Gaps:               ${intel.gaps.join(', ') || 'none'}`);
    if (intel.marketRent)
      console.log(`  Market rent:        $${intel.marketRent.value} (${(intel.marketRent.confidence * 100).toFixed(0)}% conf) — ${intel.marketRent.source}`);
    if (intel.vacancyRate)
      console.log(`  Vacancy:            ${intel.vacancyRate.value}% — ${intel.vacancyRate.source}`);
    if (intel.expenseRatio)
      console.log(`  Expense ratio:      ${intel.expenseRatio.value}% — ${intel.expenseRatio.source}`);
    if (intel.goingInCapRate)
      console.log(`  Cap rate:           ${intel.goingInCapRate.value}% — ${intel.goingInCapRate.source}`);
    console.log();
  } catch (err) {
    console.log(`  ❌ ${err instanceof Error ? err.message : err}\n`);
  }

  console.log('══════════════════════════════════════');
  console.log('Done.');
  console.log('══════════════════════════════════════\n');
}

main()
  .catch(err => {
    console.error('Fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await pool.end(); } catch { /* noop */ }
  });
