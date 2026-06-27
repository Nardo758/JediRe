import { Pool } from 'pg';
import { seedProFormaYear1 } from '../src/services/proforma-seeder.service';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dealId = 'eaabeb9f-830e-44f9-a923-56679ad0329d';
    console.log('=== V-A: Seeding Highlands via portfolio actuals path ===');
    const result = await seedProFormaYear1(pool, dealId);
    console.log('seeded:', result.seeded, '| fields_seeded:', result.fields_seeded, '| resolved_noi:', result.resolved_noi);
    if (result.warnings?.length) console.log('warnings:', result.warnings);

    const q = await pool.query(`
      SELECT
        (SELECT count(*) FROM jsonb_array_elements(periodic_seed->'fields'->'gpr'->'periods') p
          WHERE p->>'zone'='actual')     AS actual_ct,
        (SELECT count(*) FROM jsonb_array_elements(periodic_seed->'fields'->'gpr'->'periods') p
          WHERE p->>'zone'='gap')        AS gap_ct,
        (SELECT count(*) FROM jsonb_array_elements(periodic_seed->'fields'->'gpr'->'periods') p
          WHERE p->>'zone'='projection') AS proj_ct,
        (SELECT p->>'month' FROM jsonb_array_elements(periodic_seed->'fields'->'gpr'->'periods') p
          WHERE p->>'zone'='actual' ORDER BY (p->>'periodIndex')::int LIMIT 1) AS first_actual,
        (SELECT p->>'month' FROM jsonb_array_elements(periodic_seed->'fields'->'gpr'->'periods') p
          WHERE p->>'zone'='actual' ORDER BY (p->>'periodIndex')::int DESC LIMIT 1) AS last_actual,
        (SELECT p->>'month' FROM jsonb_array_elements(periodic_seed->'fields'->'gpr'->'periods') p
          WHERE p->>'zone'='projection' ORDER BY (p->>'periodIndex')::int LIMIT 1) AS first_proj_month,
        (SELECT p->>'resolved' FROM jsonb_array_elements(periodic_seed->'fields'->'gpr'->'periods') p
          WHERE p->>'zone'='projection' ORDER BY (p->>'periodIndex')::int LIMIT 1) AS first_proj_gpr,
        (SELECT p->>'resolved' FROM jsonb_array_elements(periodic_seed->'fields'->'gpr'->'periods') p
          WHERE p->>'zone'='projection' ORDER BY (p->>'periodIndex')::int LIMIT 1 OFFSET 11) AS proj_gpr_month12
      FROM deal_assumptions WHERE deal_id = $1
    `, [dealId]);
    if (q.rows.length === 0) {
      console.log('ERROR: no deal_assumptions row written — seeder did not create row');
    } else {
      console.log('\n=== Highlands sub-shape ===');
      console.log(JSON.stringify(q.rows[0], null, 2));
    }

    const atm = await pool.query(`SELECT actuals_through_month FROM deals WHERE id=$1`, [dealId]);
    console.log('\nactuals_through_month after seed:', atm.rows[0]?.actuals_through_month);
  } finally {
    await pool.end();
  }
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
