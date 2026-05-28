/**
 * CoStar Comp Upload Service — Task #1389 / Task #1392
 *
 * Parses an operator-uploaded CoStar CSV/XLSX export and ingests rows into
 * market_sale_comps or market_rent_comps with source='costar_upload'.
 *
 * CoStar usage constraint: operator uploads their own export; platform stores
 * for that deal only; raw CoStar data is never re-exported with CoStar branding.
 *
 * Auto-detection: if the file contains 'Sale Date' or 'Sale Price' columns →
 * sale comps; otherwise if it contains rent columns → rent comps.
 *
 * Column mappings per comp-profiles-spec.md §7.1 and §7.2.
 *
 * Task #1392 adds:
 *   previewCoStarUpload  — parse + dedup-check, no DB writes; returns CompPreviewResult
 *   commitCoStarUpload   — applies per-row operator overrides, then inserts
 */

import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import type { Pool } from 'pg';

// ── Types ──────────────────────────────────────────────────────────────────────

export type CompType = 'sale' | 'rent' | 'submarket';

export interface UploadRowError {
  row: number;
  address: string;
  reason: string;
}

export interface CompUploadResult {
  compType: CompType;
  totalRows: number;
  inserted: number;
  skippedDup: number;
  skippedInvalid: number;
  errors: UploadRowError[];
  rejected: boolean;
  rejectReason?: string;
}

// ── Preview types (Task #1392) ─────────────────────────────────────────────────

export interface CompPreviewRow {
  rowIndex: number;
  propertyName: string | null;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  submarket: string | null;
  units: number | null;
  yearBuilt: number | null;
  assetClass: string | null;
  // Sale-specific
  saleDate: string | null;
  salePrice: number | null;
  pricePerUnit: number | null;
  capRate: number | null;
  // Rent-specific
  snapshotDate: string | null;
  avgAskingRent: number | null;
  avgEffectiveRent: number | null;
  occupancyPct: number | null;
  // Validation state
  isValid: boolean;
  validationError: string | null;
  isDuplicate: boolean;
}

export interface CompPreviewResult {
  compType: CompType;
  detectedCompType: CompType | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: CompPreviewRow[];
  rejected: boolean;
  rejectReason?: string;
}

// ── Commit types (Task #1392) ──────────────────────────────────────────────────

export interface RowOverride {
  rowIndex: number;
  assetClass?: string | null;
  excluded: boolean;
  overwriteDuplicate: boolean;
}

export interface CompCommitOptions {
  buffer: Buffer;
  filename: string;
  compType?: CompType;
  snapshotDate?: string;
  /** CoStar export generation date (provenance). Distinct from ingested_at (server time). */
  dataAsOf?: string;
  fileId?: number | null;
  dealId: string;
  overrides: RowOverride[];
}

interface ParsedRow {
  [key: string]: string | number | null | undefined;
}

// ── Column name normalisation ──────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function colVal(row: ParsedRow, ...candidates: string[]): string | null {
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

// ── Scalar transforms ──────────────────────────────────────────────────────────

function parseNum(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,%\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseInt2(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9-]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // XLSX serial date (number stored as string)
  const serial = parseFloat(s);
  if (!isNaN(serial) && serial > 1000) {
    const d = XLSX.SSF.parse_date_code(serial);
    if (d) {
      const m = String(d.m).padStart(2, '0');
      const day = String(d.d).padStart(2, '0');
      return `${d.y}-${m}-${day}`;
    }
  }
  // M/D/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YY
  const mdyShort = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdyShort) {
    const yr = parseInt(mdyShort[3], 10) + (parseInt(mdyShort[3], 10) >= 50 ? 1900 : 2000);
    return `${yr}-${mdyShort[1].padStart(2, '0')}-${mdyShort[2].padStart(2, '0')}`;
  }
  return null;
}

function normaliseState(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  return s.length >= 2 ? s.slice(0, 2) : null;
}

function normaliseClass(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const match = s.match(/\b([ABCD])\b/i);
  if (match) return match[1].toUpperCase();
  const single = s.replace(/class\s*/i, '').trim().toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(single)) return single;
  return null;
}

// ── File parser ───────────────────────────────────────────────────────────────

function parseFileBuffer(buffer: Buffer, filename: string): { headers: string[]; rows: ParsedRow[] } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: null, raw: false });

  if (raw.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(raw[0]);
  return { headers, rows: raw };
}

// ── Auto-detect comp type ─────────────────────────────────────────────────────

export function detectCompType(headers: string[]): CompType | null {
  const normed = headers.map(norm);
  const hasSale = normed.some(h => h.includes('saledate') || h.includes('saleprice'));
  const hasRent = normed.some(h =>
    h.includes('askingrents') ||
    h.includes('askingrentunit') ||
    h.includes('avgaskingrent') ||
    h.includes('effectiverentunit') ||
    h.includes('avgeffrent') ||
    h.includes('avgeffrents')
  );
  // Submarket performance: has 'submarket' + 'vacancy' or 'netabsorption' or 'underconst'
  const hasSubmarket = normed.some(h => h === 'submarket') &&
    normed.some(h => h.includes('vacancy') || h.includes('netabsorption') || h.includes('underconstruction') || h.includes('deliveries'));
  if (hasSale) return 'sale';
  if (hasRent) return 'rent';
  if (hasSubmarket) return 'submarket';
  return null;
}

// ── Sale comp mapper ──────────────────────────────────────────────────────────

interface SaleCompRow {
  id: string;
  property_name: string | null;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  county: string | null;
  msa: string | null;
  submarket: string | null;
  property_type: string;
  units: number | null;
  sqft: number | null;
  year_built: number | null;
  asset_class: string | null;
  stories: number | null;
  sale_date: string;
  sale_price: number;
  price_per_unit: number | null;
  price_per_sqft: number | null;
  cap_rate: number | null;
  buyer: string | null;
  seller: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  qualified: boolean;
  file_id: number | null;
  data_as_of: string | null;
}

function mapSaleRow(row: ParsedRow, fileId: number | null, dataAsOf?: string): { comp: SaleCompRow | null; reason?: string } {
  const address = colVal(row, 'Address');
  const city = colVal(row, 'City');
  const stateRaw = colVal(row, 'State');
  const saleDateRaw = colVal(row, 'Sale Date', 'SaleDate', 'Close Date');
  const salePriceRaw = colVal(row, 'Sale Price', 'SalePrice', 'Sale Amount');

  if (!address) return { comp: null, reason: 'Missing Address' };
  if (!city) return { comp: null, reason: 'Missing City' };
  const state = normaliseState(stateRaw);
  if (!state) return { comp: null, reason: 'Missing or invalid State' };
  const sale_date = parseDate(saleDateRaw);
  if (!sale_date) return { comp: null, reason: `Invalid Sale Date: "${saleDateRaw}"` };
  const sale_price = parseNum(salePriceRaw);
  if (!sale_price || sale_price <= 0) return { comp: null, reason: `Invalid Sale Price: "${salePriceRaw}"` };

  const capRateRaw = colVal(row, 'Cap Rate', 'CapRate', 'Going-In Cap Rate');
  const capRate = parseNum(capRateRaw);
  const units = parseInt2(colVal(row, '# Units', 'Units', 'NumberOfUnits', 'No. Units'));
  const sqft = parseInt2(colVal(row, 'Bldg SF', 'Building SF', 'BuildingSF', 'GLA', 'Bldg Sq Ft'));

  return {
    comp: {
      id: randomUUID(),
      property_name: colVal(row, 'Property Name', 'PropertyName', 'Name'),
      address: address.trim(),
      city: city.trim(),
      state,
      zip: colVal(row, 'Zip', 'Zip Code', 'Postal Code'),
      county: colVal(row, 'County'),
      msa: colVal(row, 'MSA'),
      submarket: colVal(row, 'Submarket'),
      property_type: 'multifamily',
      units,
      sqft,
      year_built: parseInt2(colVal(row, 'Year Built', 'YearBuilt')),
      asset_class: normaliseClass(colVal(row, 'Building Class', 'Class', 'BuildingClass', 'Asset Class')),
      stories: parseInt2(colVal(row, '# Stories', 'Stories', 'NumberOfStories', 'Floors')),
      sale_date,
      sale_price,
      price_per_unit: units && units > 0 ? Math.round(sale_price / units) : null,
      price_per_sqft: sqft && sqft > 0 ? Math.round((sale_price / sqft) * 100) / 100 : null,
      cap_rate: capRate != null && capRate > 1 ? capRate : capRate != null ? capRate * 100 : null,
      buyer: colVal(row, 'Buyer', 'Buyer Name'),
      seller: colVal(row, 'Seller', 'Seller Name'),
      latitude: parseNum(colVal(row, 'Latitude', 'Lat')),
      longitude: parseNum(colVal(row, 'Longitude', 'Long', 'Lng')),
      source: 'costar_upload',
      qualified: true,
      file_id: fileId,
      data_as_of: dataAsOf ?? null,
    },
  };
}

// ── Rent comp mapper ──────────────────────────────────────────────────────────

interface RentCompRow {
  id: string;
  property_name: string | null;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  msa: string | null;
  submarket: string | null;
  units: number | null;
  year_built: number | null;
  asset_class: string | null;
  snapshot_date: string;
  avg_asking_rent: number | null;
  avg_effective_rent: number | null;
  occupancy_pct: number | null;
  concession_pct: number | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  file_id: number | null;
  data_as_of: string | null;
}

function mapRentRow(
  row: ParsedRow,
  snapshotDate: string,
  fileId: number | null,
  dataAsOf?: string
): { comp: RentCompRow | null; reason?: string } {
  const address = colVal(row, 'Address');
  const city = colVal(row, 'City');
  const stateRaw = colVal(row, 'State');

  if (!address) return { comp: null, reason: 'Missing Address' };
  if (!city) return { comp: null, reason: 'Missing City' };
  const state = normaliseState(stateRaw);
  if (!state) return { comp: null, reason: 'Missing or invalid State' };

  const askingRentRaw = colVal(
    row,
    'Asking Rent/Unit', 'Avg Asking Rent', 'AvgAskingRent', 'Asking Rents',
    'Asking Rent Per Unit', 'Asking Rent'
  );
  const askingRent = parseNum(askingRentRaw);
  if (!askingRent || askingRent <= 0) {
    return { comp: null, reason: `Missing or invalid Avg Asking Rent: "${askingRentRaw}"` };
  }

  const occupancyRaw = colVal(row, 'Occupancy', 'Occupancy Rate', 'OccupancyRate', 'Occ %', 'Occ%');
  let occupancyPct = parseNum(occupancyRaw);
  if (occupancyPct != null && occupancyPct <= 1) occupancyPct = occupancyPct * 100;

  const concessionRaw = colVal(row, 'Concession %', 'Concessions %', 'ConcessionPct', 'Concession Pct');
  let concessionPct = parseNum(concessionRaw);
  if (concessionPct != null && concessionPct <= 1) concessionPct = concessionPct * 100;

  const effRentRaw = colVal(
    row,
    'Effective Rent/Unit', 'Avg Eff Rent', 'AvgEffRent', 'Effective Rent',
    'Avg Effective Rent', 'Eff Rent/Unit'
  );

  return {
    comp: {
      id: randomUUID(),
      property_name: colVal(row, 'Property Name', 'PropertyName', 'Name'),
      address: address.trim(),
      city: city.trim(),
      state,
      zip: colVal(row, 'Zip', 'Zip Code', 'Postal Code'),
      msa: colVal(row, 'MSA'),
      submarket: colVal(row, 'Submarket'),
      units: parseInt2(colVal(row, '# Units', 'Units', 'NumberOfUnits', 'No. Units')),
      year_built: parseInt2(colVal(row, 'Year Built', 'YearBuilt')),
      asset_class: normaliseClass(colVal(row, 'Building Class', 'Class', 'BuildingClass', 'Asset Class')),
      snapshot_date: snapshotDate,
      avg_asking_rent: askingRent,
      avg_effective_rent: parseNum(effRentRaw),
      occupancy_pct: occupancyPct,
      concession_pct: concessionPct,
      latitude: parseNum(colVal(row, 'Latitude', 'Lat')),
      longitude: parseNum(colVal(row, 'Longitude', 'Long', 'Lng')),
      source: 'costar_upload',
      file_id: fileId,
      data_as_of: dataAsOf ?? null,
    },
  };
}

// ── Submarket performance mapper ─────────────────────────────────────────────

interface SubmarketStatsRow {
  id: string;
  deal_id: string;
  submarket: string;
  city: string | null;
  state: string | null;
  msa: string | null;
  period_date: string;
  vacancy_rate: number | null;
  asking_rent_per_unit: number | null;
  effective_rent_per_unit: number | null;
  yoy_rent_growth: number | null;
  absorption_units: number | null;
  net_deliveries_units: number | null;
  total_inventory_units: number | null;
  under_construction_units: number | null;
  occupancy_pct: number | null;
  concession_pct: number | null;
  source: string;
  file_id: number | null;
  data_as_of: string | null;
}

function mapSubmarketRow(
  row: ParsedRow,
  dealId: string,
  fileId: number | null,
  fallbackPeriodDate: string,
  dataAsOf?: string
): { comp: SubmarketStatsRow | null; reason?: string } {
  const submarket = colVal(row, 'Submarket');
  if (!submarket) return { comp: null, reason: 'Missing Submarket' };

  const periodRaw = colVal(row, 'Period', 'Date', 'Period Date', 'Survey Date', 'Quarter', 'As Of');
  const periodDate = parseDate(periodRaw) ?? fallbackPeriodDate;
  if (!periodDate) return { comp: null, reason: 'Missing Period / Date' };

  const vacancyRaw = colVal(row, 'Vacancy Rate', 'Vacancy %', 'Vacancy', 'Overall Vacancy', 'Vac. Rate');
  let vacancyRate = parseNum(vacancyRaw);
  if (vacancyRate != null && vacancyRate <= 1) vacancyRate = vacancyRate * 100;

  const occRaw = colVal(row, 'Occupancy', 'Occupancy Rate', 'Occupancy %', 'Occ %');
  let occupancyPct = parseNum(occRaw);
  if (occupancyPct != null && occupancyPct <= 1) occupancyPct = occupancyPct * 100;

  const rentGrowthRaw = colVal(row, 'Rent Growth', 'Rent Growth %', 'YoY Rent Growth', 'Asking Rent Growth', 'Ann. Rent Growth');
  let rentGrowth = parseNum(rentGrowthRaw);
  if (rentGrowth != null && Math.abs(rentGrowth) <= 1) rentGrowth = rentGrowth * 100;

  return {
    comp: {
      id: randomUUID(),
      deal_id: dealId,
      submarket: submarket.trim(),
      city: colVal(row, 'City'),
      state: normaliseState(colVal(row, 'State')),
      msa: colVal(row, 'Market', 'MSA', 'Market/MSA', 'Metro Area'),
      period_date: periodDate,
      vacancy_rate: vacancyRate,
      asking_rent_per_unit: parseNum(colVal(row, 'Asking Rent/Unit', 'Asking Rent', 'Asking Rents', 'Avg Asking Rent/Unit')),
      effective_rent_per_unit: parseNum(colVal(row, 'Eff Rent/Unit', 'Effective Rent/Unit', 'Effective Rent', 'Eff. Rent/Unit', 'Avg Eff Rent/Unit')),
      yoy_rent_growth: rentGrowth,
      absorption_units: parseInt2(colVal(row, 'Net Absorption', 'Absorption', 'Net Abs', 'Net Abs. Units')),
      net_deliveries_units: parseInt2(colVal(row, 'Deliveries', 'Net Deliveries', 'Delivered Units', 'Completions')),
      total_inventory_units: parseInt2(colVal(row, 'Inventory', 'Total Inventory', 'Inventory Units', 'Total Units')),
      under_construction_units: parseInt2(colVal(row, 'Under Construction', 'Under Const.', 'Under Const', 'UC Units')),
      occupancy_pct: occupancyPct,
      concession_pct: parseNum(colVal(row, 'Concession %', 'Concessions %', 'ConcessionPct')),
      source: 'costar_upload',
      file_id: fileId,
      data_as_of: dataAsOf ?? null,
    },
  };
}

// ── Dedup checkers ────────────────────────────────────────────────────────────

async function checkSaleDup(
  pool: Pool,
  dealId: string,
  address: string,
  city: string,
  state: string,
  saleDate: string
): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM market_sale_comps
     WHERE LOWER(address) = LOWER($1)
       AND LOWER(city) = LOWER($2)
       AND UPPER(state) = UPPER($3)
       AND sale_date = $4::date
       AND source = 'costar_upload'
       AND deal_id = $5::uuid
     LIMIT 1`,
    [address, city, state, saleDate, dealId]
  );
  return res.rows.length > 0;
}

async function checkRentDup(
  pool: Pool,
  dealId: string,
  address: string,
  city: string,
  state: string,
  snapshotDate: string
): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM market_rent_comps
     WHERE LOWER(address) = LOWER($1)
       AND LOWER(city) = LOWER($2)
       AND UPPER(state) = UPPER($3)
       AND snapshot_date = $4::date
       AND source = 'costar_upload'
       AND deal_id = $5::uuid
     LIMIT 1`,
    [address, city, state, snapshotDate, dealId]
  );
  return res.rows.length > 0;
}

// ── Main upload function ──────────────────────────────────────────────────────

export interface CompUploadOptions {
  buffer: Buffer;
  filename: string;
  compType?: CompType;
  snapshotDate?: string;
  /** CoStar export generation date (provenance). Distinct from ingested_at (server time). */
  dataAsOf?: string;
  fileId?: number | null;
  /** Required: scopes uploaded rows to this deal. Prevents cross-deal comp bleed. */
  dealId: string;
}

export async function processCoStarUpload(
  pool: Pool,
  opts: CompUploadOptions
): Promise<CompUploadResult> {
  const { buffer, filename, fileId = null, dealId } = opts;

  const { headers, rows } = parseFileBuffer(buffer, filename);

  if (rows.length === 0) {
    return {
      compType: opts.compType ?? 'sale',
      totalRows: 0,
      inserted: 0,
      skippedDup: 0,
      skippedInvalid: 0,
      errors: [],
      rejected: true,
      rejectReason: 'File is empty or could not be parsed.',
    };
  }

  const compType = opts.compType ?? detectCompType(headers);
  if (!compType) {
    return {
      compType: 'sale',
      totalRows: rows.length,
      inserted: 0,
      skippedDup: 0,
      skippedInvalid: 0,
      errors: [],
      rejected: true,
      rejectReason:
        'Could not detect comp type. File headers did not match CoStar sale, rent, or submarket export patterns. ' +
        'Please select the comp type manually.',
    };
  }

  if (compType === 'rent' && !opts.snapshotDate) {
    return {
      compType: 'rent',
      totalRows: rows.length,
      inserted: 0,
      skippedDup: 0,
      skippedInvalid: 0,
      errors: [],
      rejected: true,
      rejectReason: 'Snapshot date (as-of date) is required for rent comp uploads.',
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const dataAsOf = opts.dataAsOf ?? today;
  const errors: UploadRowError[] = [];
  let inserted = 0;
  let skippedDup = 0;
  let skippedInvalid = 0;
  const totalRows = rows.length;

  // First pass: validate all rows (to gate on >20% failure)
  const mapped: Array<{ comp: SaleCompRow | RentCompRow | SubmarketStatsRow | null; reason?: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (compType === 'sale') {
      mapped.push(mapSaleRow(row, fileId, dataAsOf));
    } else if (compType === 'submarket') {
      mapped.push(mapSubmarketRow(row, dealId, fileId, opts.snapshotDate ?? today, dataAsOf));
    } else {
      mapped.push(mapRentRow(row, opts.snapshotDate!, fileId, dataAsOf));
    }
  }

  const invalidCount = mapped.filter(m => !m.comp).length;
  const failurePct = invalidCount / totalRows;
  if (failurePct > 0.2) {
    return {
      compType,
      totalRows,
      inserted: 0,
      skippedDup: 0,
      skippedInvalid: invalidCount,
      errors: mapped
        .map((m, i) =>
          !m.comp
            ? {
                row: i + 2,
                address: String(rows[i]['Address'] ?? rows[i]['address'] ?? '—'),
                reason: m.reason ?? 'Validation failed',
              }
            : null
        )
        .filter(Boolean) as UploadRowError[],
      rejected: true,
      rejectReason: `${Math.round(failurePct * 100)}% of rows failed validation (threshold: 20%). Fix the file and re-upload.`,
    };
  }

  // Second pass: dedup + insert
  for (let i = 0; i < mapped.length; i++) {
    const { comp, reason } = mapped[i];
    if (!comp) {
      skippedInvalid++;
      errors.push({
        row: i + 2,
        address: String(rows[i]['Address'] ?? rows[i]['address'] ?? '—'),
        reason: reason ?? 'Validation failed',
      });
      continue;
    }

    try {
      if (compType === 'sale') {
        const sc = comp as SaleCompRow;
        const isDup = await checkSaleDup(pool, dealId, sc.address, sc.city, sc.state, sc.sale_date);
        if (isDup) {
          skippedDup++;
          continue;
        }
        await pool.query(
          `INSERT INTO market_sale_comps
             (id, property_name, address, city, state, zip, county, msa, submarket,
              property_type, units, sqft, year_built, asset_class, stories,
              sale_date, sale_price, price_per_unit, price_per_sqft, cap_rate, buyer, seller,
              latitude, longitude, source, qualified, file_id, deal_id, data_as_of, created_at)
           VALUES
             ($1,$2,$3,$4,$5,$6,$7,$8,$9,
              $10,$11,$12,$13,$14,$15,
              $16,$17,$18,$19,$20,$21,$22,
              $23,$24,$25,$26,$27,$28,$29,NOW())`,
          [
            sc.id, sc.property_name, sc.address, sc.city, sc.state, sc.zip, sc.county, sc.msa, sc.submarket,
            sc.property_type, sc.units, sc.sqft, sc.year_built, sc.asset_class, sc.stories,
            sc.sale_date, sc.sale_price, sc.price_per_unit, sc.price_per_sqft, sc.cap_rate, sc.buyer, sc.seller,
            sc.latitude, sc.longitude, sc.source, sc.qualified, sc.file_id, dealId, sc.data_as_of,
          ]
        );
        inserted++;
      } else if (compType === 'submarket') {
        const ss = comp as SubmarketStatsRow;
        await pool.query(
          `INSERT INTO costar_submarket_stats
             (id, deal_id, submarket, city, state, msa, period_date,
              vacancy_rate, asking_rent_per_unit, effective_rent_per_unit, yoy_rent_growth,
              absorption_units, net_deliveries_units, total_inventory_units, under_construction_units,
              occupancy_pct, concession_pct, source, file_id, data_as_of)
           VALUES
             ($1,$2,$3,$4,$5,$6,$7,
              $8,$9,$10,$11,
              $12,$13,$14,$15,
              $16,$17,$18,$19,$20)
           ON CONFLICT (deal_id, submarket, state, period_date) DO UPDATE SET
             vacancy_rate = EXCLUDED.vacancy_rate,
             asking_rent_per_unit = EXCLUDED.asking_rent_per_unit,
             effective_rent_per_unit = EXCLUDED.effective_rent_per_unit,
             yoy_rent_growth = EXCLUDED.yoy_rent_growth,
             absorption_units = EXCLUDED.absorption_units,
             net_deliveries_units = EXCLUDED.net_deliveries_units,
             total_inventory_units = EXCLUDED.total_inventory_units,
             under_construction_units = EXCLUDED.under_construction_units,
             occupancy_pct = EXCLUDED.occupancy_pct,
             concession_pct = EXCLUDED.concession_pct,
             data_as_of = EXCLUDED.data_as_of,
             ingested_at = NOW()`,
          [
            ss.id, ss.deal_id, ss.submarket, ss.city, ss.state, ss.msa, ss.period_date,
            ss.vacancy_rate, ss.asking_rent_per_unit, ss.effective_rent_per_unit, ss.yoy_rent_growth,
            ss.absorption_units, ss.net_deliveries_units, ss.total_inventory_units, ss.under_construction_units,
            ss.occupancy_pct, ss.concession_pct, ss.source, ss.file_id, ss.data_as_of,
          ]
        );
        inserted++;
      } else {
        const rc = comp as RentCompRow;
        const isDup = await checkRentDup(pool, dealId, rc.address, rc.city, rc.state, rc.snapshot_date);
        if (isDup) {
          skippedDup++;
          continue;
        }
        await pool.query(
          `INSERT INTO market_rent_comps
             (id, property_name, address, city, state, zip, msa, submarket,
              units, year_built, asset_class, snapshot_date,
              avg_asking_rent, avg_effective_rent, occupancy_pct, concession_pct,
              latitude, longitude, source, file_id, deal_id, data_as_of, created_at)
           VALUES
             ($1,$2,$3,$4,$5,$6,$7,$8,
              $9,$10,$11,$12,
              $13,$14,$15,$16,
              $17,$18,$19,$20,$21,$22,NOW())`,
          [
            rc.id, rc.property_name, rc.address, rc.city, rc.state, rc.zip, rc.msa, rc.submarket,
            rc.units, rc.year_built, rc.asset_class, rc.snapshot_date,
            rc.avg_asking_rent, rc.avg_effective_rent, rc.occupancy_pct, rc.concession_pct,
            rc.latitude, rc.longitude, rc.source, rc.file_id, dealId, rc.data_as_of,
          ]
        );
        inserted++;
      }
    } catch (err: any) {
      skippedInvalid++;
      errors.push({
        row: i + 2,
        address: (comp as any).address ?? (comp as any).submarket ?? '—',
        reason: `DB error: ${err.message?.slice(0, 120) ?? 'unknown'}`,
      });
    }
  }

  return {
    compType,
    totalRows,
    inserted,
    skippedDup,
    skippedInvalid,
    errors,
    rejected: false,
  };
}

// ── Preview (Task #1392) ───────────────────────────────────────────────────────

export interface CompPreviewOptions {
  buffer: Buffer;
  filename: string;
  compType?: CompType;
  snapshotDate?: string;
  /** CoStar export generation date (provenance). Distinct from ingested_at (server time). */
  dataAsOf?: string;
  dealId: string;
}

export async function previewCoStarUpload(
  pool: Pool,
  opts: CompPreviewOptions
): Promise<CompPreviewResult> {
  const { buffer, filename, dealId } = opts;
  const { headers, rows } = parseFileBuffer(buffer, filename);

  if (rows.length === 0) {
    return {
      compType: opts.compType ?? 'sale',
      detectedCompType: null,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      rows: [],
      rejected: true,
      rejectReason: 'File is empty or could not be parsed.',
    };
  }

  const detectedCompType = detectCompType(headers);
  const compType = opts.compType ?? detectedCompType;

  if (!compType) {
    return {
      compType: 'sale',
      detectedCompType: null,
      totalRows: rows.length,
      validRows: 0,
      invalidRows: rows.length,
      duplicateRows: 0,
      rows: [],
      rejected: true,
      rejectReason:
        'Could not detect comp type. File headers did not match CoStar sale or rent export patterns. ' +
        'Please select the comp type manually.',
    };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const snapshotDate = opts.snapshotDate ?? todayStr;
  const dataAsOf = opts.dataAsOf ?? todayStr;

  const previewRows: CompPreviewRow[] = [];
  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let isValid = true;
    let validationError: string | null = null;
    let isDuplicate = false;

    if (compType === 'submarket') {
      const { comp, reason } = mapSubmarketRow(row, dealId, null, snapshotDate, dataAsOf);
      if (!comp) {
        isValid = false;
        validationError = reason ?? 'Validation failed';
        invalidRows++;
      } else {
        validRows++;
      }
      previewRows.push({
        rowIndex: i,
        propertyName: null,
        address: comp?.submarket ?? String(row['Submarket'] ?? '—'),
        city: comp?.city ?? String(row['City'] ?? ''),
        state: comp?.state ?? String(row['State'] ?? ''),
        zip: null,
        submarket: comp?.submarket ?? null,
        units: comp?.total_inventory_units ?? null,
        yearBuilt: null,
        assetClass: null,
        saleDate: null,
        salePrice: null,
        pricePerUnit: null,
        capRate: null,
        snapshotDate: comp?.period_date ?? null,
        avgAskingRent: comp?.asking_rent_per_unit ?? null,
        avgEffectiveRent: comp?.effective_rent_per_unit ?? null,
        occupancyPct: comp?.occupancy_pct ?? null,
        isValid,
        validationError,
        isDuplicate: false,
      } as CompPreviewRow);
      continue;
    }

    if (compType === 'sale') {
      const { comp, reason } = mapSaleRow(row, null, dataAsOf);
      if (!comp) {
        isValid = false;
        validationError = reason ?? 'Validation failed';
        invalidRows++;
        previewRows.push({
          rowIndex: i,
          propertyName: String(row['Property Name'] ?? row['PropertyName'] ?? ''),
          address: String(row['Address'] ?? row['address'] ?? '—'),
          city: String(row['City'] ?? row['city'] ?? ''),
          state: String(row['State'] ?? row['state'] ?? ''),
          zip: null,
          submarket: null,
          units: null,
          yearBuilt: null,
          assetClass: null,
          saleDate: null,
          salePrice: null,
          pricePerUnit: null,
          capRate: null,
          snapshotDate: null,
          avgAskingRent: null,
          avgEffectiveRent: null,
          occupancyPct: null,
          isValid,
          validationError,
          isDuplicate,
        });
      } else {
        validRows++;
        isDuplicate = await checkSaleDup(pool, dealId, comp.address, comp.city, comp.state, comp.sale_date);
        if (isDuplicate) duplicateRows++;
        previewRows.push({
          rowIndex: i,
          propertyName: comp.property_name,
          address: comp.address,
          city: comp.city,
          state: comp.state,
          zip: comp.zip,
          submarket: comp.submarket,
          units: comp.units,
          yearBuilt: comp.year_built,
          assetClass: comp.asset_class,
          saleDate: comp.sale_date,
          salePrice: comp.sale_price,
          pricePerUnit: comp.price_per_unit,
          capRate: comp.cap_rate,
          snapshotDate: null,
          avgAskingRent: null,
          avgEffectiveRent: null,
          occupancyPct: null,
          isValid,
          validationError,
          isDuplicate,
        });
      }
    } else {
      const { comp, reason } = mapRentRow(row, snapshotDate, null, dataAsOf);
      if (!comp) {
        isValid = false;
        validationError = reason ?? 'Validation failed';
        invalidRows++;
        previewRows.push({
          rowIndex: i,
          propertyName: String(row['Property Name'] ?? row['PropertyName'] ?? ''),
          address: String(row['Address'] ?? row['address'] ?? '—'),
          city: String(row['City'] ?? row['city'] ?? ''),
          state: String(row['State'] ?? row['state'] ?? ''),
          zip: null,
          submarket: null,
          units: null,
          yearBuilt: null,
          assetClass: null,
          saleDate: null,
          salePrice: null,
          pricePerUnit: null,
          capRate: null,
          snapshotDate,
          avgAskingRent: null,
          avgEffectiveRent: null,
          occupancyPct: null,
          isValid,
          validationError,
          isDuplicate,
        });
      } else {
        validRows++;
        isDuplicate = await checkRentDup(pool, dealId, comp.address, comp.city, comp.state, comp.snapshot_date);
        if (isDuplicate) duplicateRows++;
        previewRows.push({
          rowIndex: i,
          propertyName: comp.property_name,
          address: comp.address,
          city: comp.city,
          state: comp.state,
          zip: comp.zip,
          submarket: comp.submarket,
          units: comp.units,
          yearBuilt: comp.year_built,
          assetClass: comp.asset_class,
          saleDate: null,
          salePrice: null,
          pricePerUnit: null,
          capRate: null,
          snapshotDate: comp.snapshot_date,
          avgAskingRent: comp.avg_asking_rent,
          avgEffectiveRent: comp.avg_effective_rent,
          occupancyPct: comp.occupancy_pct,
          isValid,
          validationError,
          isDuplicate,
        });
      }
    }
  }

  return {
    compType,
    detectedCompType,
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateRows,
    rows: previewRows,
    rejected: false,
  };
}

// ── Commit with per-row operator overrides (Task #1392) ───────────────────────

export async function commitCoStarUpload(
  pool: Pool,
  opts: CompCommitOptions
): Promise<CompUploadResult> {
  const { buffer, filename, fileId = null, dealId, overrides } = opts;

  const { headers, rows } = parseFileBuffer(buffer, filename);

  if (rows.length === 0) {
    return {
      compType: opts.compType ?? 'sale',
      totalRows: 0,
      inserted: 0,
      skippedDup: 0,
      skippedInvalid: 0,
      errors: [],
      rejected: true,
      rejectReason: 'File is empty or could not be parsed.',
    };
  }

  const compType = opts.compType ?? detectCompType(headers);
  if (!compType) {
    return {
      compType: 'sale',
      totalRows: rows.length,
      inserted: 0,
      skippedDup: 0,
      skippedInvalid: 0,
      errors: [],
      rejected: true,
      rejectReason:
        'Could not detect comp type. Please specify comp type explicitly.',
    };
  }

  const todayCommit = new Date().toISOString().slice(0, 10);
  const snapshotDate = opts.snapshotDate ?? todayCommit;
  const dataAsOf = opts.dataAsOf ?? todayCommit;

  // Build a quick-lookup map from rowIndex → override
  const overrideMap = new Map<number, RowOverride>();
  for (const ov of overrides) {
    overrideMap.set(ov.rowIndex, ov);
  }

  const errors: UploadRowError[] = [];
  let inserted = 0;
  let skippedDup = 0;
  let skippedInvalid = 0;
  const totalRows = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ov = overrideMap.get(i);

    // Operator explicitly excluded this row
    if (ov?.excluded) {
      skippedInvalid++;
      continue;
    }

    if (compType === 'submarket') {
      const { comp, reason } = mapSubmarketRow(row, dealId, fileId, snapshotDate, dataAsOf);
      if (!comp) {
        skippedInvalid++;
        errors.push({
          row: i + 2,
          address: String(rows[i]['Submarket'] ?? '—'),
          reason: reason ?? 'Validation failed',
        });
        continue;
      }
      try {
        await pool.query(
          `INSERT INTO costar_submarket_stats
             (id, deal_id, submarket, city, state, msa, period_date,
              vacancy_rate, asking_rent_per_unit, effective_rent_per_unit, yoy_rent_growth,
              absorption_units, net_deliveries_units, total_inventory_units, under_construction_units,
              occupancy_pct, concession_pct, source, file_id, data_as_of)
           VALUES
             ($1,$2,$3,$4,$5,$6,$7,
              $8,$9,$10,$11,
              $12,$13,$14,$15,
              $16,$17,$18,$19,$20)
           ON CONFLICT (deal_id, submarket, state, period_date) DO UPDATE SET
             vacancy_rate = EXCLUDED.vacancy_rate,
             asking_rent_per_unit = EXCLUDED.asking_rent_per_unit,
             effective_rent_per_unit = EXCLUDED.effective_rent_per_unit,
             yoy_rent_growth = EXCLUDED.yoy_rent_growth,
             absorption_units = EXCLUDED.absorption_units,
             net_deliveries_units = EXCLUDED.net_deliveries_units,
             total_inventory_units = EXCLUDED.total_inventory_units,
             under_construction_units = EXCLUDED.under_construction_units,
             occupancy_pct = EXCLUDED.occupancy_pct,
             concession_pct = EXCLUDED.concession_pct,
             data_as_of = EXCLUDED.data_as_of,
             ingested_at = NOW()`,
          [
            comp.id, comp.deal_id, comp.submarket, comp.city, comp.state, comp.msa, comp.period_date,
            comp.vacancy_rate, comp.asking_rent_per_unit, comp.effective_rent_per_unit, comp.yoy_rent_growth,
            comp.absorption_units, comp.net_deliveries_units, comp.total_inventory_units, comp.under_construction_units,
            comp.occupancy_pct, comp.concession_pct, comp.source, comp.file_id, comp.data_as_of,
          ]
        );
        inserted++;
      } catch (err: any) {
        skippedInvalid++;
        errors.push({
          row: i + 2,
          address: comp.submarket,
          reason: `DB error: ${err.message?.slice(0, 120) ?? 'unknown'}`,
        });
      }
      continue;
    }

    if (compType === 'sale') {
      const { comp, reason } = mapSaleRow(row, fileId, dataAsOf);
      if (!comp) {
        skippedInvalid++;
        errors.push({
          row: i + 2,
          address: String(rows[i]['Address'] ?? rows[i]['address'] ?? '—'),
          reason: reason ?? 'Validation failed',
        });
        continue;
      }

      // Apply asset_class override if provided
      if (ov && ov.assetClass !== undefined) {
        comp.asset_class = ov.assetClass ? normaliseClass(ov.assetClass) : null;
      }

      try {
        const isDup = await checkSaleDup(pool, dealId, comp.address, comp.city, comp.state, comp.sale_date);
        if (isDup) {
          if (!ov?.overwriteDuplicate) {
            skippedDup++;
            continue;
          }
          // Delete the existing duplicate so INSERT below succeeds cleanly
          await pool.query(
            `DELETE FROM market_sale_comps
             WHERE LOWER(address) = LOWER($1)
               AND LOWER(city) = LOWER($2)
               AND UPPER(state) = UPPER($3)
               AND sale_date = $4::date
               AND source = 'costar_upload'
               AND deal_id = $5::uuid`,
            [comp.address, comp.city, comp.state, comp.sale_date, dealId]
          );
        }
        await pool.query(
          `INSERT INTO market_sale_comps
             (id, property_name, address, city, state, zip, county, msa, submarket,
              property_type, units, sqft, year_built, asset_class, stories,
              sale_date, sale_price, price_per_unit, price_per_sqft, cap_rate, buyer, seller,
              latitude, longitude, source, qualified, file_id, deal_id, data_as_of, created_at)
           VALUES
             ($1,$2,$3,$4,$5,$6,$7,$8,$9,
              $10,$11,$12,$13,$14,$15,
              $16,$17,$18,$19,$20,$21,$22,
              $23,$24,$25,$26,$27,$28,$29,NOW())`,
          [
            comp.id, comp.property_name, comp.address, comp.city, comp.state, comp.zip, comp.county, comp.msa, comp.submarket,
            comp.property_type, comp.units, comp.sqft, comp.year_built, comp.asset_class, comp.stories,
            comp.sale_date, comp.sale_price, comp.price_per_unit, comp.price_per_sqft, comp.cap_rate, comp.buyer, comp.seller,
            comp.latitude, comp.longitude, comp.source, comp.qualified, comp.file_id, dealId, comp.data_as_of,
          ]
        );
        inserted++;
      } catch (err: any) {
        skippedInvalid++;
        errors.push({
          row: i + 2,
          address: comp.address,
          reason: `DB error: ${err.message?.slice(0, 120) ?? 'unknown'}`,
        });
      }
    } else {
      const { comp, reason } = mapRentRow(row, snapshotDate, fileId, dataAsOf);
      if (!comp) {
        skippedInvalid++;
        errors.push({
          row: i + 2,
          address: String(rows[i]['Address'] ?? rows[i]['address'] ?? '—'),
          reason: reason ?? 'Validation failed',
        });
        continue;
      }

      // Apply asset_class override if provided
      if (ov && ov.assetClass !== undefined) {
        comp.asset_class = ov.assetClass ? normaliseClass(ov.assetClass) : null;
      }

      try {
        const isDup = await checkRentDup(pool, dealId, comp.address, comp.city, comp.state, comp.snapshot_date);
        if (isDup) {
          if (!ov?.overwriteDuplicate) {
            skippedDup++;
            continue;
          }
          await pool.query(
            `DELETE FROM market_rent_comps
             WHERE LOWER(address) = LOWER($1)
               AND LOWER(city) = LOWER($2)
               AND UPPER(state) = UPPER($3)
               AND snapshot_date = $4::date
               AND source = 'costar_upload'
               AND deal_id = $5::uuid`,
            [comp.address, comp.city, comp.state, comp.snapshot_date, dealId]
          );
        }
        await pool.query(
          `INSERT INTO market_rent_comps
             (id, property_name, address, city, state, zip, msa, submarket,
              units, year_built, asset_class, snapshot_date,
              avg_asking_rent, avg_effective_rent, occupancy_pct, concession_pct,
              latitude, longitude, source, file_id, deal_id, data_as_of, created_at)
           VALUES
             ($1,$2,$3,$4,$5,$6,$7,$8,
              $9,$10,$11,$12,
              $13,$14,$15,$16,
              $17,$18,$19,$20,$21,$22,NOW())`,
          [
            comp.id, comp.property_name, comp.address, comp.city, comp.state, comp.zip, comp.msa, comp.submarket,
            comp.units, comp.year_built, comp.asset_class, comp.snapshot_date,
            comp.avg_asking_rent, comp.avg_effective_rent, comp.occupancy_pct, comp.concession_pct,
            comp.latitude, comp.longitude, comp.source, comp.file_id, dealId, comp.data_as_of,
          ]
        );
        inserted++;
      } catch (err: any) {
        skippedInvalid++;
        errors.push({
          row: i + 2,
          address: comp.address,
          reason: `DB error: ${err.message?.slice(0, 120) ?? 'unknown'}`,
        });
      }
    }
  }

  return {
    compType,
    totalRows,
    inserted,
    skippedDup,
    skippedInvalid,
    errors,
    rejected: false,
  };
}
