/**
 * Weekly Report Parser
 *
 * Parses weekly leasing / operations report Excel files (e.g. BPI "Weekly Reports" format).
 *
 * Known tab structure:
 *   "Weekly"              — week-by-week activity (traffic, leases, occupancy).
 *                           Two merged header rows (R0 = section labels, R1 = column names).
 *   "Renewal & Trade Out" — unit-level lease history rows — skipped for KPI aggregation.
 *   "New lease trade out" — unit-level trade-out rows — skipped for KPI aggregation.
 *
 * Weekly tab column layout (fixed, 0-indexed):
 *   0  Week Ending      8  Closing Ratio%   16 Unrented Vacant  24 Occ%
 *   1  Total Units      9  Beg Occ #        17 Total Vacant      25 Leased%
 *   2  Traffic         10  Move Ins         18 Rented Notice     26 Avail%
 *   3  In-Person Tours 11  Move Outs        19 Unrented Notice   27 Avg Mkt Rent
 *   4  Apps            12  Transfers        20 Total Notice       28 Gross Mkt Rent
 *   5  Cancellations   13  End Occ #        21 1BR Notice         29 Gross Rent PSF
 *   6  Denials         14  Model Units      22 2BR Notice         30 Effective Rent
 *   7  Net Leases      15  Rented Vacant    23 3BR Notice         31 Eff Rent PSF
 */

import * as XLSX from 'xlsx';
import { WeeklyReportData, WeeklyReportKPI, ExtractionResult } from '../types';
import { parseDate, parseNum } from './workbook-utils';

const WEEKLY_ACTIVITY_RE = /^weekly$/i;
const SKIP_TABS_RE = /renewal|trade[\s_-]*out|unit[\s_-]*mix/i;

function extractPropertyCode(filename: string): string {
  const m = filename.match(/p(\d{4})/i);
  return m ? `p${m[1]}` : 'UNKNOWN';
}

function extractReportDate(filename: string): string | null {
  const m = filename.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

function parseWeeklyTab(sheet: XLSX.WorkSheet): WeeklyReportKPI[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const result: WeeklyReportKPI[] = [];

  // Headers are at R1 (R0 is merged section labels).
  // Data starts at R2. Skip the very last row if it looks like a total.
  const DATA_START = 2;

  for (let r = DATA_START; r <= range.e.r; r++) {
    const dateCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    if (!dateCell?.v) continue;

    const week = parseDate(dateCell.v) ?? String(dateCell.v);
    const totalUnits = parseNum(sheet[XLSX.utils.encode_cell({ r, c: 1 })]?.v);
    // Skip aggregate/total rows that have no total units
    if (totalUnits == null || totalUnits === 0) continue;

    const occ = parseNum(sheet[XLSX.utils.encode_cell({ r, c: 24 })]?.v);
    const leasedPct = parseNum(sheet[XLSX.utils.encode_cell({ r, c: 25 })]?.v);
    // Values in cols 24-25 are already fractions (e.g. 0.8344) in this format
    // Guard: if > 1 treat as percentage
    const normOcc    = occ    != null && occ    > 1 ? occ    / 100 : occ;
    const normLeased = leasedPct != null && leasedPct > 1 ? leasedPct / 100 : leasedPct;

    result.push({
      week,
      newLeases:        parseNum(sheet[XLSX.utils.encode_cell({ r, c: 7  })]?.v),  // Net Leases
      renewals:         null,                                                         // on separate tab
      moveIns:          parseNum(sheet[XLSX.utils.encode_cell({ r, c: 10 })]?.v),
      moveOuts:         parseNum(sheet[XLSX.utils.encode_cell({ r, c: 11 })]?.v),
      netTraffic:       parseNum(sheet[XLSX.utils.encode_cell({ r, c: 2  })]?.v),  // Traffic
      occupancy:        normOcc,
      avgEffectiveRent: parseNum(sheet[XLSX.utils.encode_cell({ r, c: 30 })]?.v),
      leasedPct:        normLeased,
      concessions:      null,
      notices:          parseNum(sheet[XLSX.utils.encode_cell({ r, c: 20 })]?.v),  // Total Notice
    });
  }

  return result;
}

function emptyKPI(): WeeklyReportKPI {
  return {
    week: null, newLeases: null, renewals: null, moveIns: null,
    moveOuts: null, netTraffic: null, occupancy: null,
    avgEffectiveRent: null, leasedPct: null, concessions: null, notices: null,
  };
}

export function parseWeeklyReport(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    if (workbook.SheetNames.length === 0) {
      return { documentType: 'WEEKLY_REPORT', success: false, error: 'No sheets found', data: null, summary: {}, warnings };
    }

    const propertyCode = extractPropertyCode(filename);
    const reportDate   = extractReportDate(filename);
    const tabsSeen     = workbook.SheetNames.slice();

    let history: WeeklyReportKPI[] = [];

    // Try the canonical "Weekly" tab first
    const weeklyTabName = workbook.SheetNames.find(n => WEEKLY_ACTIVITY_RE.test(n));
    if (weeklyTabName) {
      history = parseWeeklyTab(workbook.Sheets[weeklyTabName]);
    } else {
      // Fallback: try any tab that isn't unit-level data
      for (const name of workbook.SheetNames) {
        if (SKIP_TABS_RE.test(name)) continue;
        const kpis = parseWeeklyTab(workbook.Sheets[name]);
        if (kpis.length > history.length) history = kpis;
      }
      if (history.length === 0) warnings.push('No "Weekly" tab found — could not identify activity tab');
    }

    if (history.length === 0) warnings.push('No weekly KPI rows extracted');

    const currentWeek = history.length > 0 ? history[history.length - 1] : emptyKPI();

    const data: WeeklyReportData = {
      propertyCode,
      reportDate,
      currentWeek,
      weeklyHistory: history,
      tabsSeen,
      warnings,
    };

    return {
      documentType: 'WEEKLY_REPORT',
      success: true,
      data,
      summary: {
        propertyCode,
        reportDate,
        tabsSeen:        tabsSeen.join(', '),
        weeksOfHistory:  history.length,
        currentOccupancy:  currentWeek.occupancy,
        currentNewLeases:  currentWeek.newLeases,
        currentEffRent:    currentWeek.avgEffectiveRent,
        oldestWeek:        history.length > 0 ? history[0].week : null,
        newestWeek:        history.length > 0 ? history[history.length - 1].week : null,
      },
      warnings,
    };
  } catch (err: any) {
    return {
      documentType: 'WEEKLY_REPORT',
      success: false,
      error: `Failed to parse weekly report: ${err.message}`,
      data: null,
      summary: {},
      warnings,
    };
  }
}
