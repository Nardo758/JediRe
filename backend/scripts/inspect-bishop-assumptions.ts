import { connectDatabase, getPool, closeDatabase } from '../src/database/connection';
import { getDealFinancials } from '../src/services/proforma-adjustment.service';

const DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';

(async () => {
  await connectDatabase();
  const pool = getPool();

  // Raw DB columns
  const r = await pool.query(
    `SELECT year1->'rent_growth' AS rg_lv,
            year1->'gpr' AS gpr_lv,
            year1->'noi' AS noi_lv
     FROM deal_assumptions WHERE deal_id = $1`,
    [DEAL_ID]
  );
  console.log('year1.rent_growth LV:', JSON.stringify(r.rows[0]?.rg_lv));
  console.log('year1.gpr LV:', JSON.stringify(r.rows[0]?.gpr_lv));
  console.log('year1.noi LV:', JSON.stringify(r.rows[0]?.noi_lv));

  // getDealFinancials — what assumptions come back?
  const fin = await getDealFinancials(pool, DEAL_ID, 10);
  const asmp = (fin as any)?.assumptions;
  console.log('\nresolved assumptions:');
  console.log('  rentGrowthYr1:', asmp?.rentGrowthYr1);
  console.log('  rentGrowthPct:', asmp?.rentGrowthPct);
  console.log('  opexGrowthPct:', asmp?.opexGrowthPct);
  console.log('  vacancyPct:',   asmp?.vacancyPct);
  console.log('  exitCap:',      asmp?.exitCap);

  // First few projection rows
  const projs = (fin as any)?.projections ?? (fin as any)?.proforma?.projections ?? [];
  console.log('\nraw projections (first 3 rows):');
  projs.slice(0, 3).forEach((p: any, i: number) => {
    console.log(`  Y${i + 1}: noi=${p?.noi} cfbt=${p?.cfbt} exitValue=${p?.exitValue ?? '—'}`);
  });

  await closeDatabase();
})().catch(async (e) => {
  console.error('FATAL', e.message, e.stack?.split('\n').slice(0, 4).join('\n'));
  await closeDatabase();
  process.exit(1);
});
