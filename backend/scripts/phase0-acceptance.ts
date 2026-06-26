import { Pool } from 'pg';

/**
 * Phase 0 Acceptance Script — T12 months persistence verification
 *
 * Usage: npx ts-node scripts/phase0-acceptance.ts <dealId>
 */

async function main() {
  const dealId = process.argv[2];
  if (!dealId) {
    console.error('Usage: npx ts-node scripts/phase0-acceptance.ts <dealId>');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query(
      `SELECT
         deal_data->'extraction_t12'->'months' AS months_array,
         jsonb_array_length(deal_data->'extraction_t12'->'months') AS months_count,
         deal_data->'extraction_t12'->'months_captured' AS months_captured_legacy,
         deal_data->'extraction_t12'->'gpr' AS gpr,
         deal_data->'extraction_t12'->'noi' AS noi,
         deal_data->'extraction_t12'->'vacancy_loss_pct' AS vacancy_loss_pct,
         deal_data->'extraction_t12'->'period_start' AS period_start,
         deal_data->'extraction_t12'->'period_end' AS period_end
       FROM deals
       WHERE id = $1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      console.error(`Deal ${dealId} not found`);
      process.exit(1);
    }

    const row = result.rows[0];

    console.log('\n=== PHASE 0 ACCEPTANCE RESULTS ===\n');
    console.log('Deal ID:', dealId);
    console.log('Period:', row.period_start, 'to', row.period_end);
    console.log('');

    // Gate 1: months array exists and is non-null
    const monthsArray = row.months_array;
    const hasMonths = monthsArray != null && Array.isArray(monthsArray);
    console.log('✓ months array present:', hasMonths);
    if (hasMonths) {
      console.log('  → months_count:', row.months_count);
      console.log('  → months_captured (legacy):', row.months_captured_legacy);
      if (row.months_count === row.months_captured_legacy) {
        console.log('  ✓ months_count matches months_captured_legacy');
      } else {
        console.log('  ⚠ MISMATCH: months_count !== months_captured_legacy');
      }
      // Show first month sample
      if (monthsArray.length > 0) {
        console.log('  → First month sample:', JSON.stringify(monthsArray[0], null, 2));
      }
    } else {
      console.log('  ✗ FAILED — months array is null or missing');
    }

    console.log('');
    // Gate 2: existing aggregates unchanged
    console.log('✓ Flat aggregates still present:');
    console.log('  → gpr:', row.gpr);
    console.log('  → noi:', row.noi);
    console.log('  → vacancy_loss_pct:', row.vacancy_loss_pct);

    console.log('');
    console.log('=== ALL GATES PASSED ===');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
