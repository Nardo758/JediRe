/**
 * Trial Balance Parser
 *
 * Parses trial balance / general ledger detail Excel files (e.g. BPI "Cr Dr Details" format).
 *
 * Detected structure (fixed columns):
 *   C0: Account code  (e.g. "1000-1000")
 *   C1: Account name
 *   C2: Forward / Beginning balance
 *   C3: Debit
 *   C4: Credit
 *   C5: Ending balance
 *
 * Period line: "Period = Dec 2021" (row ~2).
 * Data rows start once account-code pattern appears.
 */

import * as XLSX from 'xlsx';
import { TrialBalanceData, TrialBalanceRow, ExtractionResult } from '../types';
import { parseNum } from './workbook-utils';

const ACCOUNT_CODE_RE = /^\d{4}[\-\/]\d{3,4}/;

const CATEGORY_PATTERNS: { pattern: RegExp; category: string }[] = [
  { pattern: /^1/,  category: 'Assets' },
  { pattern: /^2/,  category: 'Liabilities' },
  { pattern: /^3/,  category: 'Equity' },
  { pattern: /^4/,  category: 'Revenue' },
  { pattern: /^5/,  category: 'Expenses' },
  { pattern: /^6/,  category: 'Expenses' },
  { pattern: /^7/,  category: 'Other Income' },
  { pattern: /^8/,  category: 'Other Expense' },
];

function inferCategory(code: string): string | null {
  const prefix = code.replace(/\D.*/, '');
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(prefix)) return category;
  }
  return null;
}

function extractPropertyCode(filename: string): string {
  const m = filename.match(/p(\d{4})/i);
  return m ? `p${m[1]}` : 'UNKNOWN';
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function extractPeriod(sheet: XLSX.WorkSheet): string | null {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  for (let r = 0; r < Math.min(10, range.e.r); r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    if (!cell?.v) continue;
    const val = String(cell.v).trim();
    // "Period = Dec 2021"
    const m = val.match(/period\s*=\s*(\w+)\s+(\d{4})/i);
    if (m) {
      const mo = MONTH_MAP[m[1].slice(0, 3).toLowerCase()] ?? '01';
      return `${m[2]}-${mo}-01`;
    }
    // "Dec 2021" or "12/2021"
    const m2 = val.match(/(\w{3})\s+(\d{4})/);
    if (m2 && MONTH_MAP[m2[1].toLowerCase()]) {
      return `${m2[2]}-${MONTH_MAP[m2[1].toLowerCase()]}-01`;
    }
    const m3 = val.match(/(\d{1,2})\/(\d{4})/);
    if (m3) return `${m3[2]}-${m3[1].padStart(2, '0')}-01`;
  }
  return null;
}

function parseTrialBalanceSheet(sheet: XLSX.WorkSheet): TrialBalanceRow[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const rows: TrialBalanceRow[] = [];

  for (let r = 0; r <= range.e.r; r++) {
    const codeCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    const code = codeCell?.v ? String(codeCell.v).trim() : '';

    if (!ACCOUNT_CODE_RE.test(code)) continue;

    const nameCell = sheet[XLSX.utils.encode_cell({ r, c: 1 })];
    const name = nameCell?.v ? String(nameCell.v).trim() : '';

    const debit  = parseNum(sheet[XLSX.utils.encode_cell({ r, c: 3 })]?.v);
    const credit = parseNum(sheet[XLSX.utils.encode_cell({ r, c: 4 })]?.v);
    const ending = parseNum(sheet[XLSX.utils.encode_cell({ r, c: 5 })]?.v);

    const netBalance = ending ?? (debit != null && credit != null ? debit - credit : null);

    rows.push({ accountCode: code, accountName: name, debit, credit, netBalance, category: inferCategory(code) });
  }

  return rows;
}

export function parseTrialBalance(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    if (workbook.SheetNames.length === 0) {
      return { documentType: 'TRIAL_BALANCE', success: false, error: 'No sheets found', data: null, summary: {}, warnings };
    }

    const propertyCode = extractPropertyCode(filename);
    let reportPeriod: string | null = null;
    let allRows: TrialBalanceRow[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!reportPeriod) reportPeriod = extractPeriod(sheet);
      allRows = allRows.concat(parseTrialBalanceSheet(sheet));
    }

    if (allRows.length === 0) warnings.push('No account rows found — verify account code format');
    if (!reportPeriod) {
      warnings.push('Could not determine report period');
      reportPeriod = new Date().toISOString().slice(0, 7) + '-01';
    }

    const totalDebits  = allRows.reduce((s, r) => s + (r.debit  ?? 0), 0);
    const totalCredits = allRows.reduce((s, r) => s + (r.credit ?? 0), 0);
    const netEquity    = totalDebits - totalCredits;
    const assetRows    = allRows.filter(r => r.category === 'Assets');
    const liabRows     = allRows.filter(r => r.category === 'Liabilities');

    const data: TrialBalanceData = {
      propertyCode,
      reportPeriod,
      rows: allRows,
      summary: {
        totalDebits,
        totalCredits,
        netEquity,
        totalAssets:      assetRows.length ? assetRows.reduce((s, r) => s + (r.netBalance ?? 0), 0) : null,
        totalLiabilities: liabRows.length  ? liabRows.reduce((s, r)  => s + (r.netBalance ?? 0), 0) : null,
        rowCount: allRows.length,
      },
    };

    return {
      documentType: 'TRIAL_BALANCE',
      success: true,
      data,
      summary: { propertyCode, reportPeriod, rowCount: allRows.length, totalDebits, totalCredits, netEquity },
      warnings,
    };
  } catch (err: any) {
    return {
      documentType: 'TRIAL_BALANCE',
      success: false,
      error: `Failed to parse trial balance: ${err.message}`,
      data: null,
      summary: {},
      warnings,
    };
  }
}
