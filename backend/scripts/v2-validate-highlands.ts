/**
 * Validation script: V2 — Query Highlands periodic_seed from DB
 * Run with: npx ts-node backend/scripts/v2-validate-highlands.ts
 */
import { getPool } from '../src/database/connection';
import { getFieldSeries } from '../src/services/proforma/periodic-seeder.service';

async function main() {
  const pool = getPool();

  // Find Highlands deal
  const dealResult = await pool.query(
    `SELECT id, deal_name, is_portfolio_asset FROM deals WHERE deal_name ILIKE $1 LIMIT 1`,
    ['%highlands%']
  );

  if (dealResult.rows.length === 0) {
    console.log('HIGHLANDS NOT FOUND');
    await pool.end();
    process.exit(1);
  }

  const deal = dealResult.rows[0];
  console.log(`DEAL: ${deal.id} | ${deal.deal_name} | is_portfolio_asset=${deal.is_portfolio_asset}`);

  // Fetch periodic_seed
  const seedResult = await pool.query(
    `SELECT periodic_seed FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
    [deal.id]
  );

  if (seedResult.rows.length === 0 || !seedResult.rows[0].periodic_seed) {
    console.log('NO PERIODIC SEED FOUND');
    await pool.end();
    process.exit(1);
  }

  const seed = typeof seedResult.rows[0].periodic_seed === 'string'
    ? JSON.parse(seedResult.rows[0].periodic_seed)
    : seedResult.rows[0].periodic_seed;

  console.log('\n--- BOUNDARY ---');
  console.log(JSON.stringify(seed.boundary, null, 2));

  console.log('\n--- META ---');
  console.log(JSON.stringify(seed._meta, null, 2));

  console.log('\n--- NOI SERIES (first 20 periods) ---');
  const noiSeries = getFieldSeries(seed, 'noi');
  if (noiSeries) {
    console.log(noiSeries.slice(0, 20).map(p => `${p.month} | ${p.zone} | ${p.resolved}`).join('\n'));
  } else {
    console.log('NO NOI FIELD');
  }

  console.log('\n--- ALL FIELD NAMES ---');
  console.log(Object.keys(seed.fields).join(', '));

  await pool.end();
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
