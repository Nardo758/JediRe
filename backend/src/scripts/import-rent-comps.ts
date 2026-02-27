import * as XLSX from 'xlsx';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function parsePercent(val: any): number | null {
  if (val == null || val === '-' || val === '') return null;
  const s = String(val).replace('%', '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseNumber(val: any): number | null {
  if (val == null || val === '-' || val === '') return null;
  const s = String(val).replace(/[$,]/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseYearBuilt(val: any): { built: number | null; renovated: number | null } {
  if (!val) return { built: null, renovated: null };
  const s = String(val);
  const parts = s.split('/');
  const built = parseInt(parts[0]) || null;
  const renovated = parts[1] && parts[1] !== '-' ? parseInt(parts[1]) : null;
  return { built, renovated };
}

async function importRentComps(filePath: string) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws);

  console.log(`Found ${rows.length} rent comp records`);

  const subjectPropertyId = rows.length > 0 ? String(rows[0]['Property Id'] || '') : null;

  let imported = 0;
  for (const row of rows) {
    const { built, renovated } = parseYearBuilt(row['Yr Blt/Ren']);

    const values = [
      String(row['Property Id'] || ''),
      row['Map #'] != null ? String(row['Map #']) : null,
      String(row['Building Name'] || ''),
      String(row['Address'] || ''),
      parseNumber(row['Rating']),
      row['Apartments.com Ad Level'] || null,
      parseNumber(row['Common View Last 60 Days']),
      parsePercent(row['% Overlap with Subject Property']),
      parseNumber(row['Units']),
      parseNumber(row['Stories']),
      built,
      renovated,
      parseNumber(row['Avg SF']),
      parseNumber(row['mi Away']),
      parseNumber(row['Rent/SF']),
      parseNumber(row['Rent/Unit']),
      parseNumber(row['Studio']),
      parseNumber(row['1 Beds']),
      parseNumber(row['2 Beds']),
      parseNumber(row['3 Beds']),
      parsePercent(row['Occ %']),
      parsePercent(row['Concess %']),
      parseNumber(row['#Studio']),
      parseNumber(row['#1 Beds']),
      parseNumber(row['#2 Beds']),
      parseNumber(row['#3 Beds']),
      row['Neighborhood'] || null,
      'West Palm Beach',
      subjectPropertyId
    ];

    await pool.query(
      `INSERT INTO rent_comps (
        property_id, map_number, building_name, address, rating, ad_level,
        common_views_60d, overlap_pct, units, stories, year_built, year_renovated,
        avg_sf, miles_away, rent_per_sf, rent_per_unit, studio_rent, one_bed_rent,
        two_bed_rent, three_bed_rent, occupancy_pct, concession_pct,
        studio_count, one_bed_count, two_bed_count, three_bed_count,
        neighborhood, market, subject_property_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
      ON CONFLICT DO NOTHING`,
      values
    );
    imported++;
    console.log(`  Imported: ${row['Building Name']}`);
  }

  console.log(`\nImported ${imported} rent comps successfully`);
  await pool.end();
}

const filePath = process.argv[2] || 'attached_assets/Rent_Comp_Properties_PID_11166416_1771810149013.xlsx';
importRentComps(filePath).catch(console.error);
