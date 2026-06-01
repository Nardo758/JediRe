/**
 * Ingest Highlands Renewal & Trade Out tab → lease_tradeout_events
 * Source: Highlands_Weekly_Reports_05.26.26_1780275853900.xlsx → "Renewal & Trade Out" tab
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/ingest-highlands-tradeouts.ts
 */

import * as path from 'path';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';

const PROPERTY_CODE = 'p2122';
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

function safeNum(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function safeInt(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n);
}

function normalizeEventType(raw: any): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (t === 'new') return 'new';
  if (t === 'renewal') return 'renewal';
  return null;
}

async function main() {
  console.log('[Tradeouts→DB] Starting — Highlands trade-out ingestion');
  console.log(`[Tradeouts→DB] File: ${WEEKLY_FILE}`);

  const wb = XLSX.readFile(WEEKLY_FILE, { sheetStubs: true });

  const SHEET_NAME = 'Renewal & Trade Out';
  if (!wb.SheetNames.includes(SHEET_NAME)) {
    throw new Error(`No "${SHEET_NAME}" sheet found`);
  }

  const ws = wb.Sheets[SHEET_NAME];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`[Tradeouts→DB] Total rows: ${rows.length}`);

  // Row 0 = header, data from row 1
  const dataRows = rows.slice(1);

  const records: Record<string, any>[] = [];
  let skipped = 0;
  const eventTypeCounts: Record<string, number> = {};

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const unit = row[0];
    const leaseStartRaw = row[4];
    const eventTypeRaw = row[3];

    if (unit == null || leaseStartRaw == null) {
      skipped++;
      continue;
    }

    const eventType = normalizeEventType(eventTypeRaw);
    if (!eventType) {
      console.warn(`  Row ${i + 2}: unknown event_type="${eventTypeRaw}", unit=${unit} — skipped`);
      skipped++;
      continue;
    }

    eventTypeCounts[eventType] = (eventTypeCounts[eventType] ?? 0) + 1;

    const leaseStartDate = typeof leaseStartRaw === 'number' ? excelDateToISO(leaseStartRaw) : String(leaseStartRaw);

    const marketRent = safeNum(row[5]);
    const priorRent = safeNum(row[6]);
    const newRent = safeNum(row[7]);
    const priorRentPsf = safeNum(row[8]);
    const newRentPsf = safeNum(row[10]);
    const sqft = safeInt(row[2]);

    // Recompute deltas server-side (sheet cols J/L are unreliable on new rows)
    const tradeoutDelta = (newRent != null && priorRent != null) ? newRent - priorRent : null;
    const tradeoutPct = (tradeoutDelta != null && priorRent != null && priorRent !== 0)
      ? tradeoutDelta / priorRent : null;
    const lossToLease = (newRent != null && marketRent != null) ? newRent - marketRent : null;

    records.push({
      property_code: PROPERTY_CODE,
      unit: String(unit).trim(),
      unit_type: row[1] != null ? String(row[1]).trim() : null,
      sqft,
      event_type: eventType,
      lease_start_date: leaseStartDate,
      market_rent_at_exec: marketRent,
      prior_rent: priorRent,
      new_rent: newRent,
      tradeout_delta: tradeoutDelta,
      tradeout_pct: tradeoutPct,
      loss_to_lease: lossToLease,
      prior_rent_psf: priorRentPsf,
      new_rent_psf: newRentPsf,
      source_file: path.basename(WEEKLY_FILE),
    });
  }

  console.log(`[Tradeouts→DB] Parsed ${records.length} events, skipped ${skipped}`);
  console.log(`[Tradeouts→DB] Event types:`, eventTypeCounts);

  // QA gate: expect ~943 new / ~570 renewal
  const newCount = eventTypeCounts['new'] ?? 0;
  const renewalCount = eventTypeCounts['renewal'] ?? 0;
  if (newCount < 900 || newCount > 1000) {
    console.warn(`  ⚠ QA: new count=${newCount}, expected ~943`);
  }
  if (renewalCount < 530 || renewalCount > 620) {
    console.warn(`  ⚠ QA: renewal count=${renewalCount}, expected ~570`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let inserted = 0;
    let conflicted = 0;
    for (const r of records) {
      const res = await client.query(
        `INSERT INTO lease_tradeout_events (
           property_code, unit, unit_type, sqft,
           event_type, lease_start_date,
           market_rent_at_exec, prior_rent, new_rent,
           tradeout_delta, tradeout_pct, loss_to_lease,
           prior_rent_psf, new_rent_psf, source_file
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
         )
         ON CONFLICT (property_code, unit, lease_start_date, event_type) DO UPDATE SET
           unit_type=EXCLUDED.unit_type, sqft=EXCLUDED.sqft,
           market_rent_at_exec=EXCLUDED.market_rent_at_exec,
           prior_rent=EXCLUDED.prior_rent, new_rent=EXCLUDED.new_rent,
           tradeout_delta=EXCLUDED.tradeout_delta, tradeout_pct=EXCLUDED.tradeout_pct,
           loss_to_lease=EXCLUDED.loss_to_lease,
           prior_rent_psf=EXCLUDED.prior_rent_psf, new_rent_psf=EXCLUDED.new_rent_psf,
           source_file=EXCLUDED.source_file`,
        [
          r.property_code, r.unit, r.unit_type, r.sqft,
          r.event_type, r.lease_start_date,
          r.market_rent_at_exec, r.prior_rent, r.new_rent,
          r.tradeout_delta, r.tradeout_pct, r.loss_to_lease,
          r.prior_rent_psf, r.new_rent_psf, r.source_file,
        ]
      );
      inserted++;
    }

    await client.query('COMMIT');
    console.log(`[Tradeouts→DB] ✓ Upserted ${inserted} rows into lease_tradeout_events`);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log('[Tradeouts→DB] Done');
  await pool.end();
}

main().catch(err => {
  console.error('[Tradeouts→DB] FATAL:', err);
  process.exit(1);
});
