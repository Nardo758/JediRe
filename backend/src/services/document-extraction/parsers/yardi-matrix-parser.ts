/**
 * Yardi Matrix Parser — Piece A2 (Second Vendor Abstraction Proof)
 *
 * Parses two Yardi Matrix export types:
 *
 *   YARDI_MATRIX_RENT_SURVEY    — submarket quarterly rent/vacancy snapshots
 *   YARDI_MATRIX_SUPPLY_PIPELINE — per-property supply pipeline records
 *
 * DB write targets (per yardi-matrix.vendor.ts writeTargets):
 *   Rent Survey    → yardi_matrix_rent_survey + historical_observations (aggregation)
 *   Supply Pipeline → yardi_matrix_supply_pipeline
 *
 * Column naming: Yardi Matrix exports use "Geography" for submarket,
 * "Market" for metro, "Occ Rate" for occupancy, and "Yardi Matrix ID"
 * as a cross-vendor anchor.
 *
 * The write helpers accept a `QueryFn` (the `query` export from
 * `database/connection`) rather than a raw Pool to avoid circular
 * dependencies and to stay testable without a live DB.
 */

import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';

// ── Query function type ───────────────────────────────────────────────────────

/** Matches the signature of `query` from `src/database/connection`. */
export type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;

// ── Shared utilities ──────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function colVal(row: Record<string, unknown>, ...candidates: string[]): string | null {
  for (const c of candidates) {
    const n = norm(c);
    for (const key of Object.keys(row)) {
      if (norm(key) === n) {
        const v = row[key];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
    }
  }
  return null;
}

function parseNum(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,%\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseIntSafe(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9-]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

/**
 * Parse a date value from various Yardi Matrix formats.
 *
 * Supported formats:
 *   - ISO: "2025-12-31"
 *   - US slash: "12/31/2025" or "12/31/25"
 *   - "Q4 2025" → 2025-12-01 (first of last quarter month)
 *   - "2025 Q4" → 2025-12-01
 *   - XLSX serial number
 */
export function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // US slash: M/D/YYYY or M/D/YY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const yr = mdy[3].length === 2
      ? (parseInt(mdy[3]) >= 50 ? 1900 : 2000) + parseInt(mdy[3])
      : parseInt(mdy[3]);
    return `${yr}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }

  // "Q4 2025" format: Q first, then year
  const qFirst = s.match(/Q([1-4])[\s,]*(\d{4})/i);
  if (qFirst) {
    const q = parseInt(qFirst[1]);
    const yr = parseInt(qFirst[2]);
    const endMonth = q * 3;
    return `${yr}-${String(endMonth).padStart(2, '0')}-01`;
  }

  // "2025 Q4" format: year first, then Q
  const yrFirst = s.match(/(\d{4})[\s,]*Q([1-4])/i);
  if (yrFirst) {
    const yr = parseInt(yrFirst[1]);
    const q = parseInt(yrFirst[2]);
    const endMonth = q * 3;
    return `${yr}-${String(endMonth).padStart(2, '0')}-01`;
  }

  // XLSX serial number (dates stored as numbers in .xlsx)
  const serial = parseFloat(s);
  if (!isNaN(serial) && serial > 1000) {
    const d = XLSX.SSF.parse_date_code(serial);
    if (d) {
      const m = String(d.m).padStart(2, '0');
      const day = String(d.d).padStart(2, '0');
      return `${d.y}-${m}-${day}`;
    }
  }

  return null;
}

function normaliseState(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  return s.length >= 2 ? s.slice(0, 2) : null;
}

function parseFileRows(buffer: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
}

// ── Rent Survey ───────────────────────────────────────────────────────────────

export interface YardiRentSurveyRow {
  id:                    string;
  deal_id:               string | null;
  submarket:             string;
  metro:                 string | null;
  state:                 string | null;
  period_date:           string;
  avg_asking_rent:       number | null;
  avg_effective_rent:    number | null;
  occupancy_rate:        number | null;
  concession_value_mo:   number | null;
  total_inventory_units: number | null;
  new_supply_units:      number | null;
  net_absorption_units:  number | null;
  yardi_matrix_id:       string | null;
  source:                string;
  file_id:               string | null;
  data_as_of:            string | null;
}

export interface YardiRentSurveyParseResult {
  success:     boolean;
  rows:        YardiRentSurveyRow[];
  totalRows:   number;
  validRows:   number;
  invalidRows: number;
  errors:      Array<{ row: number; reason: string }>;
  error?:      string;
}

export function parseYardiRentSurvey(
  buffer:   Buffer,
  options?: { dealId?: string; fileId?: string; dataAsOf?: string },
): YardiRentSurveyParseResult {
  const errors: Array<{ row: number; reason: string }> = [];
  const rows: YardiRentSurveyRow[] = [];

  let raw: Record<string, unknown>[];
  try {
    raw = parseFileRows(buffer);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, rows: [], totalRows: 0, validRows: 0, invalidRows: 0, errors: [], error: `Workbook parse failed: ${msg}` };
  }

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];

    const submarket = colVal(row, 'Geography', 'Submarket', 'Geography/Submarket');
    if (!submarket) {
      errors.push({ row: i + 2, reason: 'Missing Geography/Submarket' });
      continue;
    }

    const periodRaw = colVal(row, 'As-Of Date', 'Period', 'Date', 'Quarter', 'As Of');
    const period_date = parseDate(periodRaw);
    if (!period_date) {
      errors.push({ row: i + 2, reason: `Invalid As-Of Date: "${periodRaw}"` });
      continue;
    }

    const askingRentRaw = colVal(row, 'Avg Asking Rent', 'Asking Rent', 'Avg Asking Rent ($/Unit)', 'Asking Rent ($/Unit)');
    let occupancyRate = parseNum(colVal(row, 'Occ Rate', 'Occupancy Rate', 'Occ %', 'Occupancy'));
    if (occupancyRate != null && occupancyRate <= 1) occupancyRate = occupancyRate * 100;

    rows.push({
      id:                    randomUUID(),
      deal_id:               options?.dealId ?? null,
      submarket:             submarket.trim(),
      metro:                 colVal(row, 'Market', 'Metro', 'MSA', 'Metro Area'),
      state:                 normaliseState(colVal(row, 'State')),
      period_date,
      avg_asking_rent:       parseNum(askingRentRaw),
      avg_effective_rent:    parseNum(colVal(row, 'Avg Eff Rent', 'Avg Effective Rent', 'Effective Rent ($/Unit)', 'Eff Rent ($/Unit)')),
      occupancy_rate:        occupancyRate,
      concession_value_mo:   parseNum(colVal(row, 'Concession Value ($ Per Month)', 'Concession Value', 'Concession $ Per Month')),
      total_inventory_units: parseIntSafe(colVal(row, 'Total Inventory', 'Inventory', 'Total Inventory (Units)')),
      new_supply_units:      parseIntSafe(colVal(row, 'New Supply', 'New Supply (Units)', 'Completions')),
      net_absorption_units:  parseIntSafe(colVal(row, 'Net Absorption', 'Net Absorption (Units)', 'Absorption')),
      yardi_matrix_id:       colVal(row, 'Yardi Matrix ID', 'YM ID', 'Property ID'),
      source:                'yardi_matrix',
      file_id:               options?.fileId ?? null,
      data_as_of:            options?.dataAsOf ?? null,
    });
  }

  return {
    success:     errors.length < raw.length || rows.length > 0,
    rows,
    totalRows:   raw.length,
    validRows:   rows.length,
    invalidRows: errors.length,
    errors,
  };
}

// ── Supply Pipeline ───────────────────────────────────────────────────────────

export interface YardiSupplyRow {
  id:              string;
  deal_id:         string | null;
  property_name:   string | null;
  address:         string | null;
  city:            string | null;
  state:           string | null;
  zip:             string | null;
  submarket:       string | null;
  metro:           string | null;
  status:          string | null;
  delivery_date:   string | null;
  total_units:     number | null;
  stories:         number | null;
  developer:       string | null;
  owner:           string | null;
  latitude:        number | null;
  longitude:       number | null;
  yardi_matrix_id: string | null;
  source:          string;
  file_id:         string | null;
  data_as_of:      string | null;
}

export interface YardiSupplyParseResult {
  success:     boolean;
  rows:        YardiSupplyRow[];
  totalRows:   number;
  validRows:   number;
  invalidRows: number;
  errors:      Array<{ row: number; reason: string }>;
  error?:      string;
}

export function parseYardiSupplyPipeline(
  buffer:   Buffer,
  options?: { dealId?: string; fileId?: string; dataAsOf?: string },
): YardiSupplyParseResult {
  const errors: Array<{ row: number; reason: string }> = [];
  const rows: YardiSupplyRow[] = [];

  let raw: Record<string, unknown>[];
  try {
    raw = parseFileRows(buffer);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, rows: [], totalRows: 0, validRows: 0, invalidRows: 0, errors: [], error: `Workbook parse failed: ${msg}` };
  }

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];

    const deliveryDateRaw = colVal(row, 'Delivery Date', 'Expected Delivery', 'Expected Delivery Date');
    const delivery_date = parseDate(deliveryDateRaw);
    const developer = colVal(row, 'Developer', 'Developer Name');

    // Soft validation: either delivery date or developer should be present
    if (!delivery_date && !developer) {
      errors.push({ row: i + 2, reason: 'Missing both Delivery Date and Developer — likely not a supply pipeline row' });
      continue;
    }

    rows.push({
      id:              randomUUID(),
      deal_id:         options?.dealId ?? null,
      property_name:   colVal(row, 'Property Name', 'Name', 'Building Name'),
      address:         colVal(row, 'Address', 'Street Address'),
      city:            colVal(row, 'City'),
      state:           normaliseState(colVal(row, 'State')),
      zip:             colVal(row, 'Zip', 'Zip Code', 'Postal Code'),
      submarket:       colVal(row, 'Geography', 'Submarket', 'Geography/Submarket'),
      metro:           colVal(row, 'Market', 'Metro', 'MSA'),
      status:          colVal(row, 'Status', 'Construction Status', 'Pipeline Status'),
      delivery_date,
      total_units:     parseIntSafe(colVal(row, 'Total Units', 'Units', '# Units')),
      stories:         parseIntSafe(colVal(row, 'Stories', 'Floors', '# Stories')),
      developer,
      owner:           colVal(row, 'Owner', 'Owner Name'),
      latitude:        parseNum(colVal(row, 'Latitude', 'Lat')),
      longitude:       parseNum(colVal(row, 'Longitude', 'Long', 'Lng')),
      yardi_matrix_id: colVal(row, 'Yardi Matrix ID', 'YM ID', 'Property ID'),
      source:          'yardi_matrix',
      file_id:         options?.fileId ?? null,
      data_as_of:      options?.dataAsOf ?? null,
    });
  }

  return {
    success:     errors.length < raw.length || rows.length > 0,
    rows,
    totalRows:   raw.length,
    validRows:   rows.length,
    invalidRows: errors.length,
    errors,
  };
}

// ── DB write helpers ──────────────────────────────────────────────────────────
//
// Accepts a QueryFn (the `query` export from src/database/connection) rather
// than a raw Pool. This avoids pulling the pool into test environments and
// makes the helpers independently testable with a mock.

export async function writeYardiRentSurveyRows(
  queryFn: QueryFn,
  rows:    YardiRentSurveyRow[],
): Promise<{ inserted: number; errors: number }> {
  if (rows.length === 0) return { inserted: 0, errors: 0 };

  let inserted = 0;
  let writeErrors = 0;

  for (const row of rows) {
    try {
      await queryFn(
        `INSERT INTO yardi_matrix_rent_survey
           (id, deal_id, submarket, metro, state, period_date,
            avg_asking_rent, avg_effective_rent, occupancy_rate, concession_value_mo,
            total_inventory_units, new_supply_units, net_absorption_units,
            yardi_matrix_id, source, file_id, data_as_of)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT DO NOTHING`,
        [
          row.id, row.deal_id, row.submarket, row.metro, row.state, row.period_date,
          row.avg_asking_rent, row.avg_effective_rent, row.occupancy_rate, row.concession_value_mo,
          row.total_inventory_units, row.new_supply_units, row.net_absorption_units,
          row.yardi_matrix_id, row.source, row.file_id, row.data_as_of,
        ],
      );
      inserted++;
    } catch {
      writeErrors++;
    }
  }

  return { inserted, errors: writeErrors };
}

export async function writeYardiSupplyRows(
  queryFn: QueryFn,
  rows:    YardiSupplyRow[],
): Promise<{ inserted: number; errors: number }> {
  if (rows.length === 0) return { inserted: 0, errors: 0 };

  let inserted = 0;
  let writeErrors = 0;

  for (const row of rows) {
    try {
      await queryFn(
        `INSERT INTO yardi_matrix_supply_pipeline
           (id, deal_id, property_name, address, city, state, zip,
            submarket, metro, status, delivery_date, total_units, stories,
            developer, owner, latitude, longitude, yardi_matrix_id,
            source, file_id, data_as_of)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT DO NOTHING`,
        [
          row.id, row.deal_id, row.property_name, row.address, row.city, row.state, row.zip,
          row.submarket, row.metro, row.status, row.delivery_date, row.total_units, row.stories,
          row.developer, row.owner, row.latitude, row.longitude, row.yardi_matrix_id,
          row.source, row.file_id, row.data_as_of,
        ],
      );
      inserted++;
    } catch {
      writeErrors++;
    }
  }

  return { inserted, errors: writeErrors };
}
