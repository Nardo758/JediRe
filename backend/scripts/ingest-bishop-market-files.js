/**
 * One-shot ingest: parse the 3 Market Data Excel files uploaded for 464 Bishop
 * and load them into:
 *   market_rent_comps      ← Rent Comp Properties PID 9600360.xlsx
 *   market_sale_comps      ← Near By Sales PID 9600360.xlsx
 *   costar_submarket_stats ← DataTable.xlsx (West Midtown quarterly series)
 *
 * Run: node backend/scripts/ingest-bishop-market-files.js
 */
'use strict';

const XLSX = require('xlsx');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';
const BASE = path.join(__dirname, '../uploads/deals', DEAL_ID);

// deal_file UUIDs stored in source_id (text) for traceability
const FILE_IDS = {
  rentComps:   '043be3ba-7282-4608-a90c-3925f824249a',
  nearbySales: 'f2d01178-6dfa-4f33-b864-be9213dccfba',
  dataTable:   '282f4b27-b9a0-4bd0-905d-3036b991004c',
};

const FILES = {
  rentComps:   path.join(BASE, 'e7bc3b4dad0e727cc551bc57becf4f7e.xlsx'),
  nearbySales: path.join(BASE, 'f07f4a291ad598a5676e3023391de35f.xlsx'),
  dataTable:   path.join(BASE, '78ee57ef7e7cce8936e4fd381e63fd4e.xlsx'),
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Helpers ───────────────────────────────────────────────────────────────────

function readSheet(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
}

function sf(v) {
  if (v === null || v === undefined || v === '-' || v === '') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : null;
}

function si(v) {
  const n = sf(v);
  return n !== null ? Math.round(n) : null;
}

/** "Jun 2024" → "2024-06-01" */
function parseSaleDate(s) {
  if (!s) return null;
  const months = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6,
                   Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
  const m = String(s).match(/^(\w{3})\s+(\d{4})$/);
  if (!m) return null;
  const mo = months[m[1]];
  return mo ? `${m[2]}-${String(mo).padStart(2,'0')}-01` : null;
}

/** "2017/-" or "2013/2020" → first 4-digit year */
function parseYearBuilt(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

/** "2024 Q1" → first day of that quarter */
function parsePeriod(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})\s+Q(\d)$/);
  if (!m) return null;
  const mo = [1,4,7,10][parseInt(m[2])-1];
  return `${m[1]}-${String(mo).padStart(2,'0')}-01`;
}

// ── 1. Rent Comps ─────────────────────────────────────────────────────────────

async function ingestRentComps(client) {
  const rows = readSheet(FILES.rentComps);
  let inserted = 0, skipped = 0;

  await client.query(`DELETE FROM market_rent_comps WHERE deal_id = $1`, [DEAL_ID]);

  for (const r of rows) {
    // Map # = "-" means subject property row — skip
    if (String(r['Map #'] ?? '').trim() === '-' || r['Map #'] === null) {
      skipped++; continue;
    }

    const rentsByType = {
      studio:   { rent: sf(r['Studio']),  units: si(r['#Studio'])  },
      oneBed:   { rent: sf(r['1 Beds']),  units: si(r['#1 Beds'])  },
      twoBed:   { rent: sf(r['2 Beds']),  units: si(r['#2 Beds'])  },
      threeBed: { rent: sf(r['3 Beds']),  units: si(r['#3 Beds'])  },
    };

    await client.query(`
      INSERT INTO market_rent_comps
        (property_name, address, city, state, units, year_built, submarket,
         avg_asking_rent, occupancy_pct, concession_pct,
         rents_by_type, source, deal_id,
         snapshot_date, data_as_of, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW(),NOW())
    `, [
      r['Building Name'],
      r['Address'],
      'Atlanta',
      'GA',
      si(r['Units']),
      parseYearBuilt(r['Yr Blt/Ren']),
      r['Neighborhood'] || null,
      sf(r['Rent/Unit']),
      sf(r['Occ %']),
      sf(r['Concess %']),
      JSON.stringify(rentsByType),
      'apartments_com',
      DEAL_ID,
    ]);
    inserted++;
  }
  console.log(`✓ market_rent_comps: ${inserted} inserted, ${skipped} skipped (subject row)`);
}

// ── 2. Nearby Sales ───────────────────────────────────────────────────────────

async function ingestNearbySales(client) {
  const rows = readSheet(FILES.nearbySales);
  let inserted = 0;

  await client.query(`DELETE FROM market_sale_comps WHERE deal_id = $1`, [DEAL_ID]);

  for (const r of rows) {
    if (!r['Name'] && !r['Address']) continue;

    await client.query(`
      INSERT INTO market_sale_comps
        (property_name, address, city, state, submarket, property_type,
         units, year_built,
         sale_date, sale_price, price_per_unit, price_per_sqft, cap_rate,
         source, deal_id,
         data_as_of, created_at, qualified)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW(),true)
    `, [
      r['Name'],
      r['Address'],
      'Atlanta',
      'GA',
      r['Submarket'] || null,
      r['Type'] || 'Multifamily',
      si(r['Units']),
      si(r['Yr Blt/Renov']),
      parseSaleDate(r['Sale Date']),
      sf(r['Sale Price']),
      sf(r['Price/Unit']),
      sf(r['Price/SF']),
      sf(r['Cap Rate']),
      'apartments_com',
      DEAL_ID,
    ]);
    inserted++;
  }
  console.log(`✓ market_sale_comps: ${inserted} inserted`);
}

// ── 3. DataTable (West Midtown quarterly series) ──────────────────────────────

async function ingestDataTable(client) {
  const rows = readSheet(FILES.dataTable);
  let inserted = 0, skipped = 0;

  await client.query(
    `DELETE FROM costar_submarket_stats WHERE deal_id = $1`,
    [DEAL_ID]
  );

  for (const r of rows) {
    const periodDate = parsePeriod(r['Period']);
    if (!periodDate) { skipped++; continue; }

    const underConstr = (r['Under Constr Units'] === null || String(r['Under Constr Units']).trim() === '-')
      ? null : si(r['Under Constr Units']);

    await client.query(`
      INSERT INTO costar_submarket_stats
        (submarket, city, state, msa,
         period_date,
         vacancy_rate, asking_rent_per_unit,
         yoy_rent_growth, absorption_units,
         total_inventory_units, under_construction_units,
         source, deal_id, data_as_of)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      ON CONFLICT DO NOTHING
    `, [
      'West Midtown',
      'Atlanta',
      'GA',
      'Atlanta-Sandy Springs-Alpharetta, GA',
      periodDate,
      sf(r['Vacancy Rate']),
      sf(r['Market Asking Rent/Unit']),
      sf(r['Annual Rent Growth']),
      si(r['12 Mo Absorp Units']),
      si(r['Inventory Units']),
      underConstr,
      'apartments_com',
      DEAL_ID,
    ]);
    inserted++;
  }
  console.log(`✓ costar_submarket_stats: ${inserted} inserted, ${skipped} skipped (bad period)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ingestRentComps(client);
    await ingestNearbySales(client);
    await ingestDataTable(client);
    await client.query('COMMIT');
    console.log('\n✅ All 3 files ingested successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Ingestion failed, rolled back:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
