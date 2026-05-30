/**
 * CoStar DataTable Parser
 *
 * Parses CoStar's single-submarket time-series export ("DataTable.xlsx").
 * Produces CoStarSubmarketData: one row per valid, non-future, non-estimated
 * period.
 *
 * Skip conditions (both evaluated; either triggers a skip):
 *   1. Period string contains EST or QTD (estimated / quarter-to-date)
 *   2. Parsed period date is after today (future projection)
 *
 * Column names are matched case-insensitively via colVal() so minor
 * whitespace/capitalisation variants in CoStar exports don't break parsing.
 *
 * @see docs/architecture/deal-capsule-blueprint.md §CoStar Data Integration
 */

import * as XLSX from 'xlsx';
import type { CoStarSubmarketData, CoStarSubmarketRow } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function colVal(row: Record<string, unknown>, ...candidates: string[]): string | null {
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]),
  );
  for (const c of candidates) {
    const v = lower[c.toLowerCase().trim()];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

function parseNum(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,%$]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseInt2(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,%$]/g, '').trim();
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/**
 * Parse CoStar period strings to a JS Date (first day of the period).
 *
 * Recognised formats:
 *   "2023 Q1" | "Q1 2023"        → Jan 1 2023
 *   "2023"                       → Jan 1 2023
 *   "Jan 2023" | "January 2023"  → Jan 1 2023
 *   "2023-01" | "2023-01-01"     → Jan 1 2023
 */
function parseCoStarPeriod(raw: string): Date | null {
  const s = raw.trim();

  // "2023 Q1" or "Q1 2023"
  const qMatch = s.match(/(?:(\d{4})\s*Q(\d)|Q(\d)\s*(\d{4}))/i);
  if (qMatch) {
    const year = parseInt(qMatch[1] ?? qMatch[4], 10);
    const quarter = parseInt(qMatch[2] ?? qMatch[3], 10);
    if (quarter < 1 || quarter > 4) return null;
    const month = (quarter - 1) * 3;
    return new Date(Date.UTC(year, month, 1));
  }

  // Bare year "2023"
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return new Date(Date.UTC(parseInt(yearOnly[1], 10), 0, 1));

  // "Jan 2023" or "January 2023"
  const monthName = s.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (monthName) {
    const m = MONTH_MAP[monthName[1].toLowerCase()];
    if (m !== undefined) return new Date(Date.UTC(parseInt(monthName[2], 10), m, 1));
  }

  // ISO "2023-01" or "2023-01-01"
  const isoMonth = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMonth) {
    return new Date(Date.UTC(parseInt(isoMonth[1], 10), parseInt(isoMonth[2], 10) - 1, 1));
  }

  return null;
}

const SKIP_SUFFIX_RE = /\b(EST|QTD)\b/i;

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseCoStarSubmarket(buffer: Buffer, filename: string): CoStarSubmarketData {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  if (!workbook.SheetNames.length) {
    return { rows: [], skippedRows: 0, skipReasons: [] };
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  const validRows: CoStarSubmarketRow[] = [];
  let skippedRows = 0;
  const skipReasons: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    const periodRaw = colVal(
      row,
      'Period',
      'Date',
      'Period Date',
      'Quarter',
      'As Of',
      'Survey Date',
    );
    if (!periodRaw) {
      skippedRows++;
      skipReasons.push(`Row ${i + 2}: no Period value`);
      continue;
    }

    // Skip condition 1: EST or QTD suffix
    if (SKIP_SUFFIX_RE.test(periodRaw)) {
      skippedRows++;
      skipReasons.push(`Row ${i + 2}: skipped — suffix '${periodRaw}' matches EST/QTD`);
      continue;
    }

    const periodDate = parseCoStarPeriod(periodRaw);
    if (!periodDate) {
      skippedRows++;
      skipReasons.push(`Row ${i + 2}: could not parse period '${periodRaw}'`);
      continue;
    }

    // Skip condition 2: future date
    if (periodDate > today) {
      skippedRows++;
      skipReasons.push(`Row ${i + 2}: skipped — period ${periodRaw} is in the future`);
      continue;
    }

    const vacancyRaw = colVal(row, 'Vacancy Rate', 'Vacancy %', 'Vacancy');
    let vacancyRate = parseNum(vacancyRaw);
    if (vacancyRate != null && vacancyRate < 1) vacancyRate = vacancyRate * 100;

    const rentRaw = colVal(
      row,
      'Market Asking Rent/Unit',
      'Asking Rent/Unit',
      'Market Asking Rent Per Unit',
      'Avg Asking Rent/Unit',
    );
    const askingRentPerUnit = parseNum(rentRaw);

    const growthRaw = colVal(
      row,
      'Annual Rent Growth',
      'Rent Growth',
      'YoY Rent Growth',
      'Asking Rent Growth',
      'Ann. Rent Growth',
    );
    let yoyRentGrowth = parseNum(growthRaw);
    if (yoyRentGrowth != null && Math.abs(yoyRentGrowth) < 1) yoyRentGrowth = yoyRentGrowth * 100;

    const inventoryRaw = colVal(row, 'Inventory Units', 'Inventory', 'Total Inventory');
    const inventoryUnits = parseInt2(inventoryRaw);

    const ucRaw = colVal(
      row,
      'Under Constr Units',
      'Under Construction',
      'Under Constr.',
      'Under Construction Units',
    );
    const underConstructionUnits = parseInt2(ucRaw);

    const absorpRaw = colVal(
      row,
      '12 Mo Absorp Units',
      '12 Mo Absorption Units',
      'Net Absorption',
      'Absorption',
      '12Mo Absorp',
    );
    const absorption12mo = parseInt2(absorpRaw);

    const capRateRaw = colVal(row, 'Market Cap Rate', 'Cap Rate', 'Avg Cap Rate');
    let capRate = parseNum(capRateRaw);
    if (capRate != null && capRate < 1) capRate = capRate * 100;

    const ppuRaw = colVal(
      row,
      'Market Sale Price/Unit',
      'Sale Price/Unit',
      'Avg Sale Price/Unit',
      'Price/Unit',
    );
    const salePricePerUnit = parseNum(ppuRaw);

    validRows.push({
      periodDate: periodDate.toISOString().slice(0, 10),
      vacancyRate,
      askingRentPerUnit,
      yoyRentGrowth,
      inventoryUnits,
      underConstructionUnits,
      absorption12mo,
      capRate,
      salePricePerUnit,
    });
  }

  return {
    rows: validRows,
    skippedRows,
    skipReasons,
  };
}
