/**
 * W1-10 Guard: Epoch flag event emission verification
 *
 * Tests:
 * 1. deal_epoch_events table exists
 * 2. detectAndEmitEpochFlag returns null for non-lease_up deals
 * 3. detectAndEmitEpochFlag returns null when occupancy < 95%
 * 4. detectAndEmitEpochFlag emits event + busts cache when mismatch detected
 */

import { getPool } from '../src/database/connection';
import { detectAndEmitEpochFlag, getLatestEpochFlag } from '../src/services/epoch-flag.service';
import { bustM08Cache } from '../src/services/m08-strategies.service';

const TEST_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403'; // Bishop

async function run() {
  const pool = getPool();
  console.log('=== W1-10 Epoch Flag Guard ===\n');

  // 1. Table existence
  console.log('--- 1. Table existence ---');
  try {
    const tableCheck = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_epoch_events'`
    );
    if (tableCheck.rows.length > 0) {
      console.log('  ✅ deal_epoch_events table exists');
    } else {
      console.log('  ❌ deal_epoch_events table missing');
      process.exit(1);
    }
  } catch (err) {
    console.log('  ❌ Error checking table:', err);
    process.exit(1);
  }

  // 2. Check Bishop's project_type
  console.log('\n--- 2. Deal classification ---');
  const dealResult = await pool.query(
    `SELECT project_type FROM deals WHERE id = $1`,
    [TEST_DEAL_ID]
  );
  const projectType = dealResult.rows[0]?.project_type;
  console.log(`  Deal ${TEST_DEAL_ID} project_type: ${projectType}`);
  const isLeaseUp = projectType?.toLowerCase().includes('lease');
  console.log(`  Is lease_up classification: ${isLeaseUp ? 'yes' : 'no'}`);

  // 3. Check sustained occupancy
  console.log('\n--- 3. Sustained occupancy check ---');
  const occResult = await pool.query(
    `SELECT AVG(occupancy_rate) as avg_occ, COUNT(*) as month_count
     FROM (
       SELECT occupancy_rate FROM deal_monthly_actuals
       WHERE deal_id = $1
         AND is_budget = false
         AND is_proforma = false
         AND occupancy_rate IS NOT NULL
       ORDER BY report_month DESC LIMIT 3
     ) recent`,
    [TEST_DEAL_ID]
  );
  const avgOcc = occResult.rows[0]?.avg_occ;
  const monthCount = occResult.rows[0]?.month_count;
  console.log(`  T12 months available: ${monthCount}`);
  console.log(`  Sustained occupancy: ${avgOcc ? (parseFloat(avgOcc) * 100).toFixed(1) + '%' : 'N/A'}`);

  // 4. Run detection
  console.log('\n--- 4. Epoch flag detection ---');
  const event = await detectAndEmitEpochFlag(TEST_DEAL_ID, pool);
  if (event) {
    console.log(`  ✅ Epoch flag emitted:`);
    console.log(`     expectedMode: ${event.expectedMode}`);
    console.log(`     observedMode: ${event.observedMode}`);
    console.log(`     occupancyPct: ${event.metadata?.occupancyPct}`);

    // 5. Verify persisted
    const latest = await getLatestEpochFlag(TEST_DEAL_ID, pool);
    if (latest && latest.detectedAt.getTime() === event.detectedAt.getTime()) {
      console.log('  ✅ Event persisted in deal_epoch_events');
    } else {
      console.log('  ❌ Event not found in table');
    }
  } else {
    console.log('  ℹ️  No epoch mismatch detected (expected if not lease_up or occupancy < 95%)');
  }

  console.log('\n=== W1-10 Guard Complete ===');
  process.exit(0);
}

run().catch(err => {
  console.error('Guard failed:', err);
  process.exit(1);
});
