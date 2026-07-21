import { MultifamilyTrafficService, PropertyLeasingInput } from '../src/services/multifamilyTrafficService';
import { pool } from '../src/database';

async function run() {
  const result = await pool.query(
    `SELECT id, units, current_occupancy, submarket_id, avg_rent, market_rent
     FROM properties
     WHERE deal_id = (SELECT id FROM deals WHERE name LIKE '%Bishop%' LIMIT 1)
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    console.log('❌ Bishop property not found');
    process.exit(1);
  }

  const p = result.rows[0];
  const occ = p.current_occupancy > 2 ? p.current_occupancy / 100 : p.current_occupancy || 0.90;

  const input: PropertyLeasingInput = {
    units: p.units,
    occupancy: occ,
    submarket_id: p.submarket_id,
    avg_rent: p.avg_rent || 1500,
    market_rent: p.market_rent || 1500
  };

  const service = new MultifamilyTrafficService(pool);
  const pred = await service.predictWeeklyLeasingTraffic(input);

  const oldLeases = pred.weekly_traffic * 0.99 * pred.closing_ratio;
  const newLeases = pred.expected_leases;
  const reduction = ((1 - newLeases / oldLeases) * 100).toFixed(1);

  console.log('=== P0 Live Proof: Bishop ===');
  console.log(`Property:          ${p.id}`);
  console.log(`Units:             ${p.units}`);
  console.log(`Occupancy:         ${(occ * 100).toFixed(1)}%`);
  console.log(`Weekly traffic:    ${pred.weekly_traffic}`);
  console.log(`Visit→tour ratio:  ${pred.visit_to_tour_ratio}`);
  console.log(`Weekly tours:      ${pred.weekly_tours}`);
  console.log(`Closing ratio:     ${(pred.closing_ratio * 100).toFixed(1)}%`);
  console.log(`Expected leases:   ${pred.expected_leases}/wk`);
  console.log('');
  console.log(`OLD (0.99 path):   ${oldLeases.toFixed(2)} leases/wk`);
  console.log(`NEW (0.50 path):   ${newLeases.toFixed(2)} leases/wk`);
  console.log(`Reduction:         ${reduction}%`);
  console.log(`Status:            ${Number(reduction) >= 45 ? '✅ PASS' : '❌ FAIL'}`);
  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
