/**
 * Ingest Highlands Weekly Reports → leasing_weekly_observations + historical_observations rollup
 * Source: Highlands_Weekly_Reports_05.26.26_1780275853900.xlsx → Weekly tab
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/ingest-highlands-weekly.ts
 */

import * as path from 'path';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';

const PROPERTY_CODE = 'p2122';
const TOTAL_UNITS = 290;
const DEAL_ID = 'eaabeb9f-830e-44f9-a923-56679ad0329d';

const BACKEND_ROOT = path.resolve(__dirname, '..');
const DEAL_DIR = path.join(BACKEND_ROOT, 'uploads/deals', DEAL_ID);
const WEEKLY_FILE = path.join(DEAL_DIR, 'Highlands_Weekly_Reports_05.26.26_1780275853900.xlsx');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function excelDateToISO(serial: number): string {
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeOccPct(v: number | null | undefined): number | null {
  if (v == null || typeof v !== 'number') return null;
  // Mixed encoding: mostly fractional (0.93) but some whole-number pct (97.6) or small whole (1.4)
  const norm = Math.abs(v) > 1.5 ? v / 100 : v;
  if (norm < 0 || norm > 1.05) {
    console.warn(`  ⚠ occ_pct out of range [0,1.05]: raw=${v} → norm=${norm}`);
  }
  return norm;
}

function safeInt(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n);
}

function safeNum(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

async function main() {
  console.log('[Weekly→DB] Starting — Highlands weekly ingestion');
  console.log(`[Weekly→DB] File: ${WEEKLY_FILE}`);

  const wb = XLSX.readFile(WEEKLY_FILE, { sheetStubs: true });
  if (!wb.SheetNames.includes('Weekly')) {
    throw new Error('No "Weekly" sheet found in file');
  }

  const ws = wb.Sheets['Weekly'];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`[Weekly→DB] Total rows: ${rows.length}`);

  // Data starts at row index 2; row 1 is the column label header
  const dataRows = rows.slice(2);

  const records: Record<string, any>[] = [];
  let skippedTrailing = 0;

  for (const row of dataRows) {
    const weekEndingRaw = row[0];
    const trafficRaw = row[2];

    // Cutoff: trailing formula rows have null traffic and are beyond real data
    if (weekEndingRaw == null) {
      skippedTrailing++;
      continue;
    }
    if (typeof weekEndingRaw !== 'number') {
      skippedTrailing++;
      continue;
    }
    // If traffic is null AND closing ratio is a string (DIV/0 error), skip
    if (trafficRaw == null && typeof row[8] === 'string') {
      skippedTrailing++;
      continue;
    }

    const weekEnding = excelDateToISO(weekEndingRaw);
    const closing = row[8];
    const closingRatio = (closing == null || typeof closing === 'string' || Number(row[2]) === 0)
      ? null : safeNum(closing);

    records.push({
      property_code: PROPERTY_CODE,
      week_ending: weekEnding,
      total_units: safeInt(row[1]),
      traffic: safeInt(row[2]),
      tours_inperson: safeInt(row[3]),
      apps: safeInt(row[4]),
      cancellations: safeInt(row[5]),
      denials: safeInt(row[6]),
      net_leases: safeInt(row[7]),
      closing_ratio: closingRatio,
      beg_occ_units: safeInt(row[9]),
      move_ins: safeInt(row[10]),
      move_outs: safeInt(row[11]),
      transfers: safeInt(row[12]),
      end_occ_units: safeInt(row[13]),
      notice_rented: safeInt(row[15]),
      notice_unrented: safeInt(row[16]),
      total_notice: safeInt(row[20]),
      occ_pct: normalizeOccPct(row[24]),
      leased_pct: normalizeOccPct(row[25]),
      avail_pct: normalizeOccPct(row[26]),
      avg_market_rent: safeNum(row[27]),
      gross_market_rent: safeNum(row[28]),
      gross_rent_psf: safeNum(row[29]),
      effective_rent: safeNum(row[30]),
      effective_rent_psf: safeNum(row[31]),
      source_file: path.basename(WEEKLY_FILE),
    });
  }

  console.log(`[Weekly→DB] Parsed ${records.length} real rows, skipped ${skippedTrailing} trailing`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let inserted = 0;
    for (const r of records) {
      await client.query(
        `INSERT INTO leasing_weekly_observations (
           property_code, week_ending,
           total_units, traffic, tours_inperson, apps, cancellations, denials,
           net_leases, closing_ratio,
           beg_occ_units, move_ins, move_outs, transfers, end_occ_units,
           notice_rented, notice_unrented, total_notice,
           occ_pct, leased_pct, avail_pct,
           avg_market_rent, gross_market_rent, gross_rent_psf,
           effective_rent, effective_rent_psf, source_file
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
           $11,$12,$13,$14,$15,$16,$17,$18,
           $19,$20,$21,$22,$23,$24,$25,$26,$27
         )
         ON CONFLICT (property_code, week_ending) DO UPDATE SET
           total_units=EXCLUDED.total_units, traffic=EXCLUDED.traffic,
           tours_inperson=EXCLUDED.tours_inperson, apps=EXCLUDED.apps,
           cancellations=EXCLUDED.cancellations, denials=EXCLUDED.denials,
           net_leases=EXCLUDED.net_leases, closing_ratio=EXCLUDED.closing_ratio,
           beg_occ_units=EXCLUDED.beg_occ_units, move_ins=EXCLUDED.move_ins,
           move_outs=EXCLUDED.move_outs, transfers=EXCLUDED.transfers,
           end_occ_units=EXCLUDED.end_occ_units,
           notice_rented=EXCLUDED.notice_rented, notice_unrented=EXCLUDED.notice_unrented,
           total_notice=EXCLUDED.total_notice,
           occ_pct=EXCLUDED.occ_pct, leased_pct=EXCLUDED.leased_pct, avail_pct=EXCLUDED.avail_pct,
           avg_market_rent=EXCLUDED.avg_market_rent, gross_market_rent=EXCLUDED.gross_market_rent,
           gross_rent_psf=EXCLUDED.gross_rent_psf, effective_rent=EXCLUDED.effective_rent,
           effective_rent_psf=EXCLUDED.effective_rent_psf, source_file=EXCLUDED.source_file`,
        [
          r.property_code, r.week_ending,
          r.total_units, r.traffic, r.tours_inperson, r.apps, r.cancellations, r.denials,
          r.net_leases, r.closing_ratio,
          r.beg_occ_units, r.move_ins, r.move_outs, r.transfers, r.end_occ_units,
          r.notice_rented, r.notice_unrented, r.total_notice,
          r.occ_pct, r.leased_pct, r.avail_pct,
          r.avg_market_rent, r.gross_market_rent, r.gross_rent_psf,
          r.effective_rent, r.effective_rent_psf, r.source_file,
        ]
      );
      inserted++;
    }

    await client.query('COMMIT');
    console.log(`[Weekly→DB] ✓ Upserted ${inserted} rows into leasing_weekly_observations`);

    // QA: verify end_occ_units continuity (each week's beg = prior week's end ± transfers)
    let continuityErrors = 0;
    for (let i = 1; i < records.length; i++) {
      const prev = records[i - 1];
      const curr = records[i];
      if (prev.end_occ_units != null && curr.beg_occ_units != null) {
        const diff = Math.abs(curr.beg_occ_units - prev.end_occ_units);
        if (diff > 5) {
          console.warn(`  ⚠ Continuity gap at ${curr.week_ending}: beg=${curr.beg_occ_units} prev_end=${prev.end_occ_units} diff=${diff}`);
          continuityErrors++;
        }
      }
    }
    if (continuityErrors === 0) {
      console.log('[Weekly→DB] ✓ QA: end_occ_units continuity OK');
    } else {
      console.warn(`[Weekly→DB] ⚠ QA: ${continuityErrors} continuity gaps`);
    }

    // Roll up weekly → monthly and write to historical_observations
    await rollupToHistoricalObservations(client, records);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log('[Weekly→DB] Done');
  await pool.end();
}

async function rollupToHistoricalObservations(client: any, records: Record<string, any>[]) {
  console.log('[Weekly→DB] Rolling up weekly → monthly → historical_observations');

  // Group by year-month
  const monthly = new Map<string, Record<string, any>[]>();
  for (const r of records) {
    const key = r.week_ending.slice(0, 7); // YYYY-MM
    if (!monthly.has(key)) monthly.set(key, []);
    monthly.get(key)!.push(r);
  }

  // Delete existing property-level monthly rows for this property (idempotent rollup)
  await client.query(
    `DELETE FROM historical_observations
     WHERE geography_level = 'property' AND parcel_id = $1 AND observation_window = 'monthly'`,
    [PROPERTY_CODE]
  );

  let inserted = 0;
  for (const [ym, weeks] of monthly.entries()) {
    // Use last week's end_occ_units for occ_pct; average effective_rent
    const lastWeek = weeks[weeks.length - 1];
    const avgEffRent = weeks.reduce((s, w) => s + (w.effective_rent ?? 0), 0) / weeks.filter(w => w.effective_rent != null).length;
    const avgMktRent = weeks.reduce((s, w) => s + (w.avg_market_rent ?? 0), 0) / weeks.filter(w => w.avg_market_rent != null).length;

    const occPct = lastWeek.occ_pct;
    const leasedPct = lastWeek.leased_pct;

    // observation_date = first of the month
    const obsDate = ym + '-01';

    // Realized occupancy for trajectory (monthly occ %)
    await client.query(
      `INSERT INTO historical_observations (
         geography_level, parcel_id, observation_date, observation_window,
         property_occupancy, property_avg_rent, property_unit_count,
         is_subject_property, source_signals
       ) VALUES (
         'property', $1, $2, 'monthly',
         $3, $4, $5,
         true, ARRAY['leasing_weekly_observations']
       )`,
      [PROPERTY_CODE, obsDate, occPct, avgEffRent || null, TOTAL_UNITS]
    );
    inserted++;
  }

  console.log(`[Weekly→DB] ✓ Upserted ${inserted} monthly rows into historical_observations`);
}

main().catch(err => {
  console.error('[Weekly→DB] FATAL:', err);
  process.exit(1);
});
