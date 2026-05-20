import * as XLSX from 'xlsx';
import { LeasingStatsData, LeasingStatsActivity, LeasingStatsLease, ExtractionResult } from '../types';
import { findSectionStartRow, parseSheetFromRow, parseNum, parseDate } from './workbook-utils';

/**
 * Leasing Stats Parser — v1
 *
 * Extracts leasing velocity data from Yardi OneSite BoxScore XLSX/XLS files.
 *
 * Target format (OneSite Rents v3.0 BOXSCORE):
 *   Section 4 — "Leasing - <date_range>" (rows 47-68 typically):
 *     Columns: Floor Plan, Units, Move-Ins, Move-Outs, Net Change,
 *              Units Reserved, Signed Renewals, Transferring, Cancelled/Denied,
 *              Net Leases, Waitlist, Cancelled/Denied W, Net Waitlist
 *
 *   Section 5 — "Leases - New Residents - Vacant Units Leased - <date_range>":
 *     Columns: Unit, Floor Plan, Name, Apply Date, Move-In Date, Lease Term,
 *              Market Rent, Lease Rent, Credits, Other Charges, Deposits,
 *              Ad Source, Leased By, Effective Rent
 *
 * Data quality tier: C1 on the corpus tier scale (velocity is a high-quality
 * signal when present and per-property).
 *
 * NOTE: PDF boxscore files are NOT handled here — they should be routed through
 * pdf-parse text extraction first. This parser handles XLSX/XLS only.
 */

const HEADER_PATTERNS = [
  /floor[\s_-]*plan/i, /unit/i,
  /move[\s_-]*in/i, /move[\s_-]*out/i,
  /reserved/i, /renewal/i,
  /cancel/i, /denied/i,
  /waitlist/i, /net[\s_-]*lease/i,
];

const NEW_LEASE_HEADER_PATTERNS = [
  /unit/i, /floor[\s_-]*plan/i,
  /apply/i, /move[\s_-]*in/i,
  /lease[\s_-]*term/i, /market[\s_-]*rent/i,
  /ad[\s_-]*source/i, /effective[\s_-]*rent/i,
  /credits/i, /deposit/i,
  /lease[\s_-]*rent/i,
];

const ACTIVITY_COL_MAP: Record<string, string> = {
  'floor_plan': 'floor_plan|floor_plan_group|floorplan|floor plan group|name',
  'units': 'units|unit_count|total_units',
  'move_ins': 'move-ins',
  'move_outs': 'move-outs',
  'net_change': 'net change',
  'units_reserved': 'units reserved',
  'signed_renewals': 'signed renewals',
  'transferring': 'transferring',
  'cancelled_denied': 'cancelled/denied',
  'net_leases': 'net leases',
  'waitlist': 'waitlist',
  'waitlist_cancelled': 'cancelled/denied',
  'net_waitlist': 'net waitlist',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]+/g, '_').replace(/[^a-z0-9_/]/g, '');
}

function findActivityCol(headers: string[], activityField: string): number | null {
  const patterns = ACTIVITY_COL_MAP[activityField] || activityField;
  const pList = patterns.split('|');
  for (let i = 0; i < headers.length; i++) {
    if (!headers[i]) continue;
    const h = normalizeHeader(headers[i]);
    for (const p of pList) {
      const np = normalizeHeader(p);
      if (h.includes(np) || np.includes(h)) return i;
    }
  }
  return null;
}

function extractDateFromPeriodLabel(label: string): { start: string; end: string } | null {
  if (!label) return null;
  const rangeMatch = label.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}).*?(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
  if (rangeMatch) {
    const s = parseDate(rangeMatch[1]);
    const e = parseDate(rangeMatch[2]);
    if (s && e) return { start: s, end: e };
  }
  const singleMatch = label.match(/as[\s_]+of[\s_]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
  if (singleMatch) {
    const d = parseDate(singleMatch[1]);
    if (d) return { start: d, end: d };
  }
  return null;
}

function parseLeasingSection(
  sheet: XLSX.WorkSheet,
  leasingStartRow: number
): { activity: LeasingStatsActivity[]; period: { start: string; end: string } | null } | null {
  // Find the header row within the leasing section (first row with column headers after section title)
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const maxRow = Math.min(range.e.r, leasingStartRow + 20);
  let headerRow: number | null = null;

  for (let r = leasingStartRow + 1; r <= maxRow; r++) {
    const rowValues: string[] = [];
    const maxCol = Math.min(range.e.c, 30);
    for (let c = range.s.c; c <= maxCol; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v != null) {
        rowValues.push(String(cell.v).trim().toLowerCase());
      }
    }
    const rowStr = rowValues.join(' ');
    if (/floor[\s_-]*plan/i.test(rowStr) && /move[\s_-]*in/i.test(rowStr)) {
      headerRow = r;
      break;
    }
  }

  if (headerRow === null) return null;

  // Parse headers
  const headers: string[] = [];
  for (let c = range.s.c; c <= Math.min(range.e.c, 30); c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    headers.push(cell && cell.v != null ? String(cell.v).trim() : '');
  }

  // Read data rows
  const activity: LeasingStatsActivity[] = [];
  let foundPeriod: { start: string; end: string } | null = null;

  // Also extract the period from the section title
  for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 5); c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: leasingStartRow, c })];
    if (cell && cell.v != null) {
      const period = extractDateFromPeriodLabel(String(cell.v));
      if (period) foundPeriod = period;
    }
  }

  for (let r = headerRow + 1; r <= Math.min(range.e.r, headerRow + 40); r++) {
    const rowValues: string[] = [];
    const maxCol = Math.min(range.e.c, 30);
    for (let c = range.s.c; c <= maxCol; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      rowValues.push(cell && cell.v != null ? String(cell.v).trim() : '');
    }

    // Find floor plan and units columns dynamically
    const fpColIdx = findActivityCol(headers, 'floor_plan');
    const unitsColIdx = findActivityCol(headers, 'units');

    const fp = fpColIdx !== null && fpColIdx < rowValues.length ? rowValues[fpColIdx] : (rowValues[0] || '');
    const totalUnitsStr = unitsColIdx !== null && unitsColIdx < rowValues.length ? rowValues[unitsColIdx] : (rowValues[1] || '');

    // Skip empty rows, subtotal rows, or section header rows
    if (!fp || !totalUnitsStr) continue;
    if (/^(total|subtotal|grand|leasing)/i.test(fp)) continue;
    if (/^\d/.test(fp)) continue; // Skip numeric-only first column (likely part of a split header)

    const units = parseNum(totalUnitsStr) ?? 0;
    if (units === 0) continue;

    const getVal = (idx: number | null): number => {
      if (idx === null) return 0;
      return parseNum(rowValues[idx]) ?? 0;
    };

    activity.push({
      floor_plan: fp,
      units,
      move_ins: getVal(findActivityCol(headers, 'move_ins')),
      move_outs: getVal(findActivityCol(headers, 'move_outs')),
      net_change: getVal(findActivityCol(headers, 'net_change')),
      units_reserved: getVal(findActivityCol(headers, 'units_reserved')),
      signed_renewals: getVal(findActivityCol(headers, 'signed_renewals')),
      transferring: getVal(findActivityCol(headers, 'transferring')),
      cancelled_denied: getVal(findActivityCol(headers, 'cancelled_denied')),
      net_leases: getVal(findActivityCol(headers, 'net_leases')),
      waitlist: getVal(findActivityCol(headers, 'waitlist')),
      waitlist_cancelled: getVal(findActivityCol(headers, 'waitlist_cancelled')),
      net_waitlist: getVal(findActivityCol(headers, 'net_waitlist')),
    });
  }

  if (activity.length === 0) return null;

  return { activity, period: foundPeriod };
}

function parseNewLeaseSection(
  sheet: XLSX.WorkSheet,
  startRow: number
): LeasingStatsLease[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  let headerRow: number | null = null;

  for (let r = startRow + 1; r <= Math.min(range.e.r, startRow + 10); r++) {
    const rowValues: string[] = [];
    const maxCol = Math.min(range.e.c, 30);
    for (let c = range.s.c; c <= maxCol; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v != null) {
        rowValues.push(String(cell.v).trim().toLowerCase());
      }
    }
    const rowStr = rowValues.join(' ');
    if (/apply/i.test(rowStr) && /move[\s_-]*in/i.test(rowStr)) {
      headerRow = r;
      break;
    }
  }

  if (headerRow === null) return [];

  const headers: string[] = [];
  for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 20); c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    headers.push(cell && cell.v != null ? String(cell.v).trim() : '');
  }

  const normalizedHeaders = headers.map(h => normalizeHeader(h));

  const colIdx = (pattern: RegExp): number | null => {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (pattern.test(normalizedHeaders[i])) return i;
    }
    return null;
  };

  const leases: LeasingStatsLease[] = [];

  for (let r = headerRow + 1; r <= Math.min(range.e.r, headerRow + 200); r++) {
    const rowValues: string[] = [];
    const maxCol = Math.min(range.e.c, 30);
    for (let c = range.s.c; c <= maxCol; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      rowValues.push(cell && cell.v != null ? String(cell.v).trim() : '');
    }

    const unit = rowValues[0] || '';
    if (!unit || /^(total|subtotal|grand)/i.test(unit)) continue;
    // Skip header rows
    if (/^lease[\s_-]*term|market[\s_-]*rent|ad[\s_-]*source/i.test(String(rowValues[1]))) continue;
    if (/apply|move[\s_-]*in/i.test(unit) && /date/i.test(unit)) continue;

    const unitCol = colIdx(/^unit$/);
    const fpCol = colIdx(/floor[\s_-]*plan/);
    const nameCol = colIdx(/name|tenant|resident/);
    const applyCol = colIdx(/apply|application/);
    const moveInCol = colIdx(/move[\s_-]*in/);
    const termCol = colIdx(/term|months/);
    const mktRentCol = colIdx(/market[\s_-]*rent|mkt/);
    const leaseRentCol = colIdx(/lease[\s_-]*rent|rent$/);
    const effectiveCol = colIdx(/effective|eff_rent/);
    const creditsCol = colIdx(/credit|conc|discount/);
    const sourceCol = colIdx(/ad[\s_-]*source|source|lead[\s_-]*source/);

    const fp = fpCol !== null ? rowValues[fpCol] : null;
    const applyDate = applyCol !== null ? parseDate(rowValues[applyCol]) : null;
    const moveInDate = moveInCol !== null ? parseDate(rowValues[moveInCol]) : null;
    const termMonths = termCol !== null ? (parseNum(rowValues[termCol]) || null) : null;
    const marketRent = mktRentCol !== null ? parseNum(rowValues[mktRentCol]) : null;
    const leaseRent = leaseRentCol !== null ? parseNum(rowValues[leaseRentCol]) : null;
    const effectiveRent = effectiveCol !== null ? parseNum(rowValues[effectiveCol]) : null;
    const credits = creditsCol !== null ? parseNum(rowValues[creditsCol]) : null;
    const source = sourceCol !== null ? rowValues[sourceCol] : null;

    // Only add if we have at least a unit identifier and some meaningful data
    if (termMonths === null && marketRent === null && leaseRent === null) continue;

    leases.push({
      signed_date: applyDate,
      unit: rowValues[unitCol ?? 0],
      floor_plan: fp,
      term_months: termMonths,
      market_rent: marketRent,
      lease_rent: leaseRent,
      effective_rent: effectiveRent,
      concession: credits ? Math.abs(credits) : null,
      source,
      tenant_name: nameCol !== null ? rowValues[nameCol] : null,
    });
  }

  return leases;
}

// ─── BoxScoreSummary format parser ──────────────────────────────────────────
//
// The BoxScoreSummary is a compressed single-sheet report with sections:
//   "Availability"     — units, occupancy, avg rent, sqft per floor plan
//   "Resident Activity" — move-ins, move-outs, transfers, cancels per floor plan
//   "Conversion Ratios" — calls, walk-ins, tours, web leads
//
// This parser extracts from "Resident Activity" as a proxy for leasing velocity.

function parseBoxScoreSummary(sheet: XLSX.WorkSheet): {
  activity: LeasingStatsActivity[];
  period: { start: string; end: string } | null;
  occupancy: { units: number; occupied: number } | null;
} | null {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  // Find sections by title row
  let availabilityHeaderRow = -1;
  let activityHeaderRow = -1;
  let period: { start: string; end: string } | null = null;

  // First pass: locate sections
  for (let r = 0; r <= Math.min(range.e.r, 100); r++) {
    const cellVal = (sheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v as string) || '';

    // Check for period date in the header area
    const dateMatch = cellVal.match(/date\s*=\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*\-\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (dateMatch) {
      const s = parseDate(dateMatch[1]);
      const e = parseDate(dateMatch[2]);
      if (s && e) period = { start: s, end: e };
    }

    if (/^availability$/i.test(cellVal.trim())) {
      availabilityHeaderRow = r;
    } else if (/^resident\s+activity$/i.test(cellVal.trim())) {
      activityHeaderRow = r;
    }
  }

  if (activityHeaderRow < 0) return null;

  // Parse header row (row after section title)
  const headerRowIndex = activityHeaderRow + 1;
  const headerRow: string[] = [];
  for (let c = 0; c <= Math.min(range.e.c, 15); c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIndex, c })];
    headerRow.push(cell?.v != null ? String(cell.v).trim().toLowerCase() : '');
  }

  // Column index finder
  const findCol = (pattern: RegExp): number | null => {
    for (let i = 0; i < headerRow.length; i++) {
      if (pattern.test(headerRow[i])) return i;
    }
    return null;
  };

  const fpCol = 1; // "Name" column (index 1)
  const unitCol = findCol(/^units$/);
  const moveInCol = findCol(/move\s*in/);
  const moveOutCol = findCol(/move\s*out/);
  const cancelCol = findCol(/cancel/i);
  const transferCol = findCol(/transfer/i);

  // Parse data rows until next section or end
  const activity: LeasingStatsActivity[] = [];
  let dataRowStart = headerRowIndex + 1;

  for (let r = dataRowStart; r <= Math.min(range.e.r, dataRowStart + 30); r++) {
    const fp = (sheet[XLSX.utils.encode_cell({ r, c: fpCol })]?.v as string) || '';
    if (!fp) continue;

    // Stop at totals or next section
    const trimmed = fp.trim().toLowerCase();
    if (/^total[\s]*$|conversion/i.test(trimmed)) break;

    // Skip code-like entries (A1AC0C91 format)
    const code = (sheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v as string) || '';
    if (/^[A-Z0-9]{5,}$/i.test(code.replace(/[\s\-_]/g, ''))) {
      // This is a code row, use the name column for floor plan
    }

    const units = unitCol !== null ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: unitCol })]?.v) : null;
    if (units === null || units === 0) continue;

    const moveIns = moveInCol !== null ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: moveInCol })]?.v) ?? 0 : 0;
    const moveOuts = moveOutCol !== null ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: moveOutCol })]?.v) ?? 0 : 0;

    activity.push({
      floor_plan: fp,
      units,
      move_ins: moveIns,
      move_outs: moveOuts,
      net_change: moveIns - moveOuts,
      units_reserved: 0,
      signed_renewals: 0,
      transferring: transferCol !== null ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: transferCol })]?.v) ?? 0 : 0,
      cancelled_denied: cancelCol !== null ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: cancelCol })]?.v) ?? 0 : 0,
      net_leases: moveIns,
      waitlist: 0,
      waitlist_cancelled: 0,
      net_waitlist: 0,
    });
  }

  // Compute occupancy from Availability section
  let totalUnits = 0;
  let totalOccupied = 0;
  if (availabilityHeaderRow >= 0) {
    const availHeaderRow = availabilityHeaderRow + 1;
    const availHeaders: string[] = [];
    for (let c = 0; c <= Math.min(range.e.c, 15); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: availHeaderRow, c })];
      availHeaders.push(cell?.v != null ? String(cell.v).trim().toLowerCase() : '');
    }

    const availUnitCol = availHeaders.findIndex(h => h === 'units');
    const occupiedCol = availHeaders.findIndex(h => /occupied/.test(h) && !/vacant|notice/.test(h));

    for (let r = availHeaderRow + 1; r <= Math.min(range.e.r, availHeaderRow + 25); r++) {
      const code = (sheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v as string) || '';
      if (/^total[s]?$/i.test(code.trim())) {
        if (availUnitCol >= 0) totalUnits = parseNum(sheet[XLSX.utils.encode_cell({ r, c: availUnitCol })]?.v) ?? 0;
        if (occupiedCol >= 0) totalOccupied = parseNum(sheet[XLSX.utils.encode_cell({ r, c: occupiedCol })]?.v) ?? 0;
        break;
      }
    }
  }

  if (activity.length === 0) return null;

  return {
    activity,
    period,
    occupancy: totalUnits > 0 ? { units: totalUnits, occupied: totalOccupied } : null,
  };
}

export function parseLeasingStats(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    if (workbook.SheetNames.length === 0) {
      return {
        documentType: 'LEASING_STATS', success: false,
        error: 'Empty workbook',
        data: null, summary: {}, warnings,
      };
    }

    let allActivity: LeasingStatsActivity[] = [];
    let allNewLeases: LeasingStatsLease[] = [];
    let reportingPeriod: { start: string; end: string } | null = null;
    let boxScoreOccupancy: { units: number; occupied: number } | null = null;

    // First pass: try BoxScoreSummary format (single-sheet "Resident Activity" section)
    if (workbook.SheetNames.length === 1) {
      const summarySheet = workbook.Sheets[workbook.SheetNames[0]];
      const summaryResult = parseBoxScoreSummary(summarySheet);
      if (summaryResult && summaryResult.activity.length > 0) {
        allActivity = summaryResult.activity;
        reportingPeriod = summaryResult.period;
        boxScoreOccupancy = summaryResult.occupancy;
      }
    }

    // Second pass: full BoxScore format (multi-section "Leasing Activity" + "New Resident Detail")
    if (allActivity.length === 0) {
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];

        // Find "Leasing" section
        let leasingSectionRow = findSectionStartRow(sheet, /leasing/i, 0, 100);
        if (leasingSectionRow < 0) {
          // Try broader search
          leasingSectionRow = findSectionStartRow(sheet, /move[\s_-]*in.*move[\s_-]*out/i, 0, 150);
        }

        if (leasingSectionRow >= 0) {
          const result = parseLeasingSection(sheet, leasingSectionRow);
          if (result) {
            allActivity = [...allActivity, ...result.activity];
            if (result.period && !reportingPeriod) {
              reportingPeriod = result.period;
            }
          }
        }

        // Find new leases/residents section
        const newLeaseRow = findSectionStartRow(sheet, /new[\s_-]*resident/i, 0, 200);
        if (newLeaseRow < 0) {
          // Alternative header patterns
          const altRow = findSectionStartRow(sheet, /vacant[\s_-]*units[\s_-]*leased/i, 0, 200);
          if (altRow >= 0) {
            const leases = parseNewLeaseSection(sheet, altRow);
            allNewLeases = [...allNewLeases, ...leases];
          }
        } else {
          const leases = parseNewLeaseSection(sheet, newLeaseRow);
          allNewLeases = [...allNewLeases, ...leases];
        }
      }
    }

    // Summary computation
    const totalMoveIns = allActivity.reduce((s, a) => s + a.move_ins, 0);
    const totalMoveOuts = allActivity.reduce((s, a) => s + a.move_outs, 0);
    const totalRenewals = allActivity.reduce((s, a) => s + a.signed_renewals, 0);
    const totalCancelled = allActivity.reduce((s, a) => s + a.cancelled_denied, 0);
    const totalWaitlist = allActivity.reduce((s, a) => s + a.waitlist, 0);

    // Get total units / occupied from the last activity row (totals row)
    const totalActivityRow = allActivity.find(a => /^total/i.test(a.floor_plan));
    const totalUnits = boxScoreOccupancy?.units || totalActivityRow?.units || allActivity.reduce((s, a) => s + a.units, 0);
    const totalOccupied = boxScoreOccupancy?.occupied || 0; // Not available in leasing section (but BoxScoreSummary has it)

    const data: LeasingStatsData = {
      reporting_period: reportingPeriod || { start: '', end: '' },
      new_leases: allNewLeases,
      activity: allActivity,
      summary: {
        total_move_ins: totalMoveIns,
        total_move_outs: totalMoveOuts,
        net_absorption: totalMoveIns - totalMoveOuts,
        total_new_leases: allNewLeases.length,
        total_renewals: totalRenewals,
        total_cancelled: totalCancelled,
        total_waitlist: totalWaitlist,
        total_units: totalUnits,
        total_occupied: totalOccupied,
        occupancy_pct: totalUnits > 0 ? totalOccupied / totalUnits : 0,
      },
    };

    if (allActivity.length === 0 && allNewLeases.length === 0) {
      return {
        documentType: 'LEASING_STATS', success: false,
        error: 'No leasing activity or new lease data extracted',
        data: null, summary: {}, warnings,
      };
    }

    return {
      documentType: 'LEASING_STATS', success: true,
      data,
      summary: {
        ...data.summary,
        period_start: reportingPeriod?.start || '',
        period_end: reportingPeriod?.end || '',
        activity_types: allActivity.length,
        new_leases_count: allNewLeases.length,
      },
      warnings,
    };
  } catch (err) {
    return {
      documentType: 'LEASING_STATS', success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null, summary: {}, warnings,
    };
  }
}
