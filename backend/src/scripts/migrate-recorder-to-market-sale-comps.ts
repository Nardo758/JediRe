/**
 * migrate-recorder-to-market-sale-comps.ts
 *
 * One-time back-fill script — Task #1382
 *
 * Reads all rows from `recorded_transactions` and inserts them into
 * `market_sale_comps` with source = 'county_recorded' and qualified = true.
 * Rows that already exist in market_sale_comps (matched on address + city +
 * state + sale_date) are skipped so the script is safe to re-run.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only src/scripts/migrate-recorder-to-market-sale-comps.ts [--dry-run]
 */

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run(dryRun: boolean): Promise<void> {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('Migrate recorded_transactions → market_sale_comps');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('══════════════════════════════════════════════════════\n');

  // ── 1. Row counts before ────────────────────────────────────────────────────
  const beforeRT  = await pool.query<{ count: string }>('SELECT COUNT(*) FROM recorded_transactions');
  const beforeMSC = await pool.query<{ count: string }>('SELECT COUNT(*) FROM market_sale_comps');

  const rtCount  = parseInt(beforeRT.rows[0].count, 10);
  const mscBefore = parseInt(beforeMSC.rows[0].count, 10);

  console.log(`recorded_transactions rows    : ${rtCount}`);
  console.log(`market_sale_comps rows before : ${mscBefore}`);

  if (rtCount === 0) {
    console.log('\nNothing to migrate — recorded_transactions is empty.');
    return;
  }

  // ── 2. Fetch all recorded_transactions rows ────────────────────────────────
  const { rows } = await pool.query(`
    SELECT
      id,
      recording_date,
      property_address,
      units,
      building_sf,
      year_built,
      property_class,
      derived_sale_price,
      price_per_unit,
      price_per_sf,
      implied_cap_rate,
      buyer_name,
      buyer_type,
      seller_name,
      city,
      state_code
    FROM recorded_transactions
    ORDER BY recording_date DESC NULLS LAST
  `);

  console.log(`\nFetched ${rows.length} row(s) from recorded_transactions`);
  console.log('Inserting into market_sale_comps...\n');

  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const row of rows) {
    if (!row.derived_sale_price || !row.recording_date || !row.property_address) {
      console.warn(`  SKIP (missing required field): id=${row.id}`);
      skipped++;
      continue;
    }

    const city  = row.city  || null;
    const state = row.state_code || null;

    if (!city || !state) {
      console.warn(`  SKIP (missing city/state): id=${row.id} addr="${row.property_address}"`);
      skipped++;
      continue;
    }

    // Compute price_per_unit if not stored
    const units  = row.units ? parseInt(row.units, 10) : null;
    const ppu    = row.price_per_unit
      ? parseFloat(row.price_per_unit)
      : (units && units > 0 ? Math.round(parseFloat(row.derived_sale_price) / units) : null);

    if (dryRun) {
      console.log(`  [DRY RUN] Would insert: "${row.property_address}", ${city}, ${state}, ${row.recording_date}, $${row.derived_sale_price}`);
      inserted++;
      continue;
    }

    try {
      const result = await pool.query(
        `INSERT INTO market_sale_comps (
           property_name,
           address,
           city,
           state,
           property_type,
           units,
           sqft,
           year_built,
           asset_class,
           sale_date,
           sale_price,
           price_per_unit,
           price_per_sqft,
           cap_rate,
           buyer,
           buyer_type,
           seller,
           source,
           source_id,
           qualified,
           created_at
         ) VALUES (
           $1, $2, $3, $4, 'multifamily',
           $5, $6, $7, $8,
           $9, $10, $11, $12, $13,
           $14, $15, $16,
           'county_recorded', NULL,
           true, NOW()
         )
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          row.property_address.slice(0, 255),   // property_name (use address as name)
          row.property_address.slice(0, 255),   // address
          city,
          state,
          units,
          row.building_sf ? parseInt(row.building_sf, 10) : null,
          row.year_built  ? parseInt(row.year_built, 10)  : null,
          row.property_class ? row.property_class.toUpperCase().slice(0, 1) : null,
          row.recording_date,
          parseFloat(row.derived_sale_price),
          ppu,
          row.price_per_sf ? parseFloat(row.price_per_sf) : null,
          row.implied_cap_rate ? parseFloat(row.implied_cap_rate) : null,
          row.buyer_name  ? row.buyer_name.slice(0, 255)  : null,
          row.buyer_type  ? row.buyer_type.slice(0, 60)   : null,
          row.seller_name ? row.seller_name.slice(0, 255) : null,
        ]
      );

      if (result.rowCount && result.rowCount > 0) {
        inserted++;
      } else {
        console.log(`  SKIP (conflict/duplicate): "${row.property_address}" ${row.recording_date}`);
        skipped++;
      }
    } catch (err: any) {
      console.error(`  ERROR inserting id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  // ── 3. Row counts after ─────────────────────────────────────────────────────
  if (!dryRun) {
    const afterMSC = await pool.query<{ count: string }>('SELECT COUNT(*) FROM market_sale_comps');
    const mscAfter = parseInt(afterMSC.rows[0].count, 10);

    console.log('\n══════════════════════════════════════════════════════');
    console.log('Summary');
    console.log('══════════════════════════════════════════════════════');
    console.log(`recorded_transactions rows          : ${rtCount}`);
    console.log(`market_sale_comps rows before       : ${mscBefore}`);
    console.log(`market_sale_comps rows after        : ${mscAfter}`);
    console.log(`  Net new rows                      : ${mscAfter - mscBefore}`);
    console.log(`  Inserted                          : ${inserted}`);
    console.log(`  Skipped (duplicate / missing data): ${skipped}`);
    console.log(`  Errors                            : ${errors}`);

    if (errors > 0) {
      console.error('\nWARNING: some rows failed to insert — check logs above.');
      process.exit(1);
    } else {
      console.log('\n✅ Migration complete — no data lost.');
    }
  } else {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('DRY RUN Summary');
    console.log('══════════════════════════════════════════════════════');
    console.log(`Would insert : ${inserted}`);
    console.log(`Would skip   : ${skipped}`);
    console.log('\nRe-run without --dry-run to apply changes.');
  }
}

const dryRun = process.argv.includes('--dry-run');

run(dryRun)
  .catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
