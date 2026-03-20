import * as XLSX from 'xlsx';
import { Pool } from 'pg';
import path from 'path';

const DEAL_ID = 'highlands-2789-satellite';
const PROPERTY_NAME = 'Highlands at Satellite';

async function importHighlandsTraffic() {
  const filePath = path.resolve(__dirname, '../../../attached_assets/Highlands_Weekly_Report_03.02.26__1772939681482.xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['Weekly'];
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let imported = 0;
  let skipped = 0;

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0] || row[2] === undefined || row[2] === null) {
      skipped++;
      continue;
    }

    const excelDate = row[0];
    const daysSinceEpoch = excelDate - 25569;
    const totalDays = Math.round(daysSinceEpoch);
    const baseDate = new Date(Date.UTC(1970, 0, 1));
    baseDate.setUTCDate(baseDate.getUTCDate() + totalDays);
    const weekEnding = baseDate.toISOString().split('T')[0];

    const normalizeDecimalPct = (val: any): number | null => {
      if (val === null || val === undefined) return null;
      const n = Number(val);
      if (isNaN(n)) return null;
      return n > 1 ? n / 100 : n;
    };

    const values = [
      DEAL_ID,
      PROPERTY_NAME,
      weekEnding,
      row[1] || null,                  // total_units
      row[2] || 0,                     // traffic
      row[3] || 0,                     // in_person_tours
      0,                               // website_leads (not in Excel)
      row[4] || 0,                     // apps
      row[5] || 0,                     // cancellations
      row[6] || 0,                     // denials
      row[7] || 0,                     // net_leases
      normalizeDecimalPct(row[8]),      // closing_ratio
      row[9] || null,                  // beg_occ
      row[10] || 0,                    // move_ins
      row[11] || 0,                    // move_outs
      row[12] || 0,                    // transfers
      row[13] || null,                 // end_occ
      row[14] || 0,                    // vacant_model
      row[15] || 0,                    // vacant_rented
      row[16] || 0,                    // vacant_unrented
      row[17] || 0,                    // vacant_total
      row[18] || 0,                    // notice_rented
      row[19] || 0,                    // notice_unrented
      row[20] || 0,                    // notice_total
      row[21] || 0,                    // avail_1br
      row[22] || 0,                    // avail_2br
      row[23] || 0,                    // avail_3br
      normalizeDecimalPct(row[24]),     // occ_pct
      normalizeDecimalPct(row[25]),     // leased_pct
      normalizeDecimalPct(row[26]),     // avail_pct
      row[27] || null,                 // avg_market_rent
      row[28] || null,                 // gross_market_rent
      row[29] || null,                 // gross_rent_psf
      row[30] || null,                 // effective_rent
      row[31] || null,                 // effective_rent_psf
    ];

    await pool.query(
      `INSERT INTO weekly_traffic_snapshots (
        deal_id, property_name, week_ending, total_units,
        traffic, in_person_tours, website_leads, apps,
        cancellations, denials, net_leases, closing_ratio,
        beg_occ, move_ins, move_outs, transfers, end_occ,
        vacant_model, vacant_rented, vacant_unrented, vacant_total,
        notice_rented, notice_unrented, notice_total,
        avail_1br, avail_2br, avail_3br,
        occ_pct, leased_pct, avail_pct,
        avg_market_rent, gross_market_rent, gross_rent_psf,
        effective_rent, effective_rent_psf
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
      ) ON CONFLICT (deal_id, week_ending) DO UPDATE SET
        property_name = EXCLUDED.property_name,
        total_units = EXCLUDED.total_units,
        traffic = EXCLUDED.traffic,
        in_person_tours = EXCLUDED.in_person_tours,
        apps = EXCLUDED.apps,
        cancellations = EXCLUDED.cancellations,
        denials = EXCLUDED.denials,
        net_leases = EXCLUDED.net_leases,
        closing_ratio = EXCLUDED.closing_ratio,
        beg_occ = EXCLUDED.beg_occ,
        move_ins = EXCLUDED.move_ins,
        move_outs = EXCLUDED.move_outs,
        transfers = EXCLUDED.transfers,
        end_occ = EXCLUDED.end_occ,
        vacant_model = EXCLUDED.vacant_model,
        vacant_rented = EXCLUDED.vacant_rented,
        vacant_unrented = EXCLUDED.vacant_unrented,
        vacant_total = EXCLUDED.vacant_total,
        notice_rented = EXCLUDED.notice_rented,
        notice_unrented = EXCLUDED.notice_unrented,
        notice_total = EXCLUDED.notice_total,
        avail_1br = EXCLUDED.avail_1br,
        avail_2br = EXCLUDED.avail_2br,
        avail_3br = EXCLUDED.avail_3br,
        occ_pct = EXCLUDED.occ_pct,
        leased_pct = EXCLUDED.leased_pct,
        avail_pct = EXCLUDED.avail_pct,
        avg_market_rent = EXCLUDED.avg_market_rent,
        gross_market_rent = EXCLUDED.gross_market_rent,
        gross_rent_psf = EXCLUDED.gross_rent_psf,
        effective_rent = EXCLUDED.effective_rent,
        effective_rent_psf = EXCLUDED.effective_rent_psf`,
      values
    );

    imported++;
  }

  console.log(`Import complete: ${imported} rows imported, ${skipped} rows skipped`);

  const countResult = await pool.query(
    'SELECT COUNT(*) as total FROM weekly_traffic_snapshots WHERE deal_id = $1',
    [DEAL_ID]
  );
  console.log(`Total rows in DB for ${DEAL_ID}: ${countResult.rows[0].total}`);

  await pool.end();
}

importHighlandsTraffic().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
