import * as XLSX from 'xlsx';
import { ConcessionBurnoffData, ConcessionRecord, ExtractionResult } from '../types';
import { smartParseSheet, parseDate as sharedParseDate } from './workbook-utils';

function parseNum(val: any): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let s = String(val).trim().replace(/[$,%\s]/g, '');
  if (!s || s === '-' || s === '—') return 0;
  let neg = false;
  if (s.startsWith('(') && s.endsWith(')')) { neg = true; s = s.slice(1, -1); }
  else if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : (neg ? -n : n);
}

const parseDate = sharedParseDate;

function findCol(headers: string[], patterns: RegExp[]): string | null {
  for (const h of headers) {
    for (const p of patterns) {
      if (p.test(h)) return h;
    }
  }
  return null;
}

const CONCESSION_HEADER_PATTERNS = [/unit|apt/i, /concession|recurring/i, /tenant|resident|name/i, /amount|remaining|balance/i, /end|expir|burn/i];

export function parseConcessionBurnoff(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const { headers, rows } = smartParseSheet(sheet, CONCESSION_HEADER_PATTERNS, 2);

    if (rows.length === 0) {
      return { documentType: 'CONCESSION_BURNOFF', success: false, error: 'No data rows found (checked up to 20 title rows)', data: null, summary: {}, warnings };
    }
    const unitCol = findCol(headers, [/^unit/i, /^apt/i, /^space/i]);
    const tenantCol = findCol(headers, [/tenant/i, /resident/i, /name/i]);
    const typeCol = findCol(headers, [/type/i, /plan/i, /model/i]);
    const recurringCol = findCol(headers, [/recurring/i, /total[\s_-]*concession/i]);
    const currentCol = findCol(headers, [/current/i, /monthly/i, /amount/i]);
    const remainingCol = findCol(headers, [/remaining/i, /balance/i]);
    const endDateCol = findCol(headers, [/end[\s_-]*date/i, /expir/i, /burn[\s_-]*off/i]);
    const termCol = findCol(headers, [/term/i, /months/i, /lease[\s_-]*term/i]);
    const marketRentCol = findCol(headers, [/market[\s_-]*rent/i, /mkt/i]);
    const leaseRentCol = findCol(headers, [/lease[\s_-]*rent/i, /contract/i, /actual/i]);

    if (!unitCol) {
      return { documentType: 'CONCESSION_BURNOFF', success: false, error: 'Could not identify unit column', data: null, summary: {}, warnings };
    }

    const records: ConcessionRecord[] = [];

    for (const row of rows) {
      const unitNum = String(row[unitCol] || '').trim();
      if (!unitNum || /^(total|subtotal|grand|summary)/i.test(unitNum)) continue;

      records.push({
        unitNumber: unitNum,
        tenantName: tenantCol ? String(row[tenantCol] || '').trim() || null : null,
        unitType: typeCol ? String(row[typeCol] || '').trim() || null : null,
        totalRecurring: recurringCol ? parseNum(row[recurringCol]) : 0,
        currentConcession: currentCol ? parseNum(row[currentCol]) : 0,
        remainingAmount: remainingCol ? parseNum(row[remainingCol]) : 0,
        endDate: endDateCol ? parseDate(row[endDateCol]) : null,
        leaseTerm: termCol ? parseNum(row[termCol]) || null : null,
        marketRent: marketRentCol ? parseNum(row[marketRentCol]) || null : null,
        leaseRent: leaseRentCol ? parseNum(row[leaseRentCol]) || null : null,
      });
    }

    const activeConcessions = records.filter(r => r.currentConcession > 0 || r.remainingAmount > 0);
    const totalLiability = records.reduce((s, r) => s + r.totalRecurring, 0);
    const totalRemaining = records.reduce((s, r) => s + r.remainingAmount, 0);

    const avgDepth = activeConcessions.length > 0
      ? activeConcessions.reduce((s, r) => {
          if (r.marketRent && r.marketRent > 0) {
            return s + r.currentConcession / r.marketRent;
          }
          return s;
        }, 0) / activeConcessions.filter(r => r.marketRent && r.marketRent > 0).length || 0
      : 0;

    const burnoffCalendar: Array<{ month: string; expiringAmount: number; expiringUnits: number }> = [];
    const monthMap = new Map<string, { amount: number; count: number }>();

    for (const r of records) {
      if (r.endDate) {
        const monthKey = r.endDate.substring(0, 7);
        const existing = monthMap.get(monthKey) || { amount: 0, count: 0 };
        existing.amount += r.currentConcession;
        existing.count++;
        monthMap.set(monthKey, existing);
      }
    }

    for (const [month, data] of Array.from(monthMap.entries()).sort()) {
      burnoffCalendar.push({
        month: `${month}-01`,
        expiringAmount: data.amount,
        expiringUnits: data.count,
      });
    }

    const byFloorPlan: Record<string, { count: number; avgConcession: number; totalLiability: number }> = {};
    for (const r of records) {
      const fp = r.unitType || 'unknown';
      if (!byFloorPlan[fp]) byFloorPlan[fp] = { count: 0, avgConcession: 0, totalLiability: 0 };
      byFloorPlan[fp].count++;
      byFloorPlan[fp].totalLiability += r.currentConcession;
    }
    for (const fp of Object.keys(byFloorPlan)) {
      byFloorPlan[fp].avgConcession = byFloorPlan[fp].count > 0 ? byFloorPlan[fp].totalLiability / byFloorPlan[fp].count : 0;
    }

    const data: ConcessionBurnoffData = {
      records,
      summary: {
        totalActiveConcessions: activeConcessions.length,
        totalLiability,
        totalRemainingLiability: totalRemaining,
        avgConcessionDepth: avgDepth,
        burnoffCalendar,
        byFloorPlan,
      },
    };

    if (records.length === 0) {
      return {
        documentType: 'CONCESSION_BURNOFF', success: false,
        error: 'No concession records extracted — columns found but no valid unit rows',
        data: null, summary: {}, warnings,
      };
    }

    if (totalLiability === 0 && totalRemaining === 0 && records.every(r => r.currentConcession === 0 && r.totalRecurring === 0)) {
      return {
        documentType: 'CONCESSION_BURNOFF', success: false,
        error: 'All concession values are zero — likely header detection failure',
        data: null, summary: {}, warnings,
      };
    }

    return { documentType: 'CONCESSION_BURNOFF', success: true, data, summary: data.summary, warnings };
  } catch (err) {
    return {
      documentType: 'CONCESSION_BURNOFF', success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null, summary: {}, warnings,
    };
  }
}
