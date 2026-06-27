import { Pool } from 'pg';
import { seedProFormaYear1 } from '../src/services/proforma-seeder.service';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const dealId = '3f32276f-aacd-4da3-b306-317c5109b403';

  const dr = await pool.query(`SELECT deal_data FROM deals WHERE id=$1`, [dealId]);
  const raw = dr.rows[0].deal_data;
  const deal_data: Record<string, any> = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const originalMonths: any[] = deal_data?.extraction_t12?.months ?? [];

  console.log('Current T12 month count:', originalMonths.length);
  const lastMonth = originalMonths[originalMonths.length - 1];
  console.log('Last T12 month:', lastMonth?.reportMonth);

  // Show old gap values for first gap month (2018-08)
  const psQ = await pool.query(`
    SELECT
      (SELECT p->>'month' FROM jsonb_array_elements(da.periodic_seed->'fields'->'gpr'->'periods') p
        WHERE p->>'zone'='gap' ORDER BY (p->>'periodIndex')::int LIMIT 1) AS first_gap_month,
      (SELECT p->>'resolved' FROM jsonb_array_elements(da.periodic_seed->'fields'->'gpr'->'periods') p
        WHERE p->>'zone'='gap' ORDER BY (p->>'periodIndex')::int LIMIT 1) AS first_gap_gpr_projected
    FROM deal_assumptions da WHERE deal_id=$1
  `, [dealId]);
  console.log('Old periodic_seed first gap period (the projected value):', JSON.stringify(psQ.rows[0]));

  // Synthetic months covering gap zone (2018-08, 2018-09, 2018-10) with -8% GPR vs projected
  // (to ensure material variance > 5% threshold)
  const syntheticMonths = ['2018-08-01', '2018-09-01', '2018-10-01'].map(date => ({
    ...lastMonth,
    reportMonth: date,
    grossPotentialRent: Math.round((lastMonth.grossPotentialRent || 200000) * 0.92),
    noi: Math.round((lastMonth.noi || 100000) * 0.93),
  }));
  console.log('\nSynthetic month gpr:', syntheticMonths[0].grossPotentialRent, '(for 2018-08)');

  const newMonths = [...originalMonths, ...syntheticMonths];
  const newDealData = { ...deal_data, extraction_t12: { ...deal_data.extraction_t12, months: newMonths } };
  await pool.query(`UPDATE deals SET deal_data=$2::jsonb WHERE id=$1`, [dealId, JSON.stringify(newDealData)]);
  console.log('\nExtended T12 to', newMonths.length, 'months');

  await pool.query(`DELETE FROM deal_reconciliation_log WHERE deal_id=$1`, [dealId]);
  console.log('Cleared deal_reconciliation_log for this deal');

  console.log('\n=== V-C: Running seedProFormaYear1 (triggers Part 1 variance gate) ===');
  const result = await seedProFormaYear1(pool, dealId);
  console.log('seeded:', result.seeded, '| fields_seeded:', result.fields_seeded);

  const logQ = await pool.query(`
    SELECT field_name, to_char(period_month,'YYYY-MM') AS month,
           round(projected_value) AS projected, round(actual_value) AS actual,
           round(variance_abs) AS var_abs, round(variance_pct*100,2) AS var_pct,
           material, trigger_path
    FROM deal_reconciliation_log
    WHERE deal_id=$1
    ORDER BY period_month, field_name
  `, [dealId]);
  console.log('\n=== deal_reconciliation_log rows ===');
  console.log('Total rows:', logQ.rows.length);
  for (const r of logQ.rows) console.log(JSON.stringify(r));

  // Restore original deal_data
  await pool.query(`UPDATE deals SET deal_data=$2::jsonb WHERE id=$1`, [dealId, JSON.stringify(deal_data)]);
  console.log('\nRestored original deal_data (3 synthetic months removed)');

  await pool.end();
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
