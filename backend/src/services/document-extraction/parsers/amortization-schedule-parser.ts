/**
 * Amortization / Prepaid Expense Schedule Parser
 *
 * Handles two related document types:
 *
 * 1. Prepaid & Accrual Expense Schedules (BPI format — tabs: "Prepaid Insurance",
 *    "Prepaid other", "Accrued other", "RE tax")
 *    Cols: description | coverage_start | coverage_end | amount | months | per_month | months_expensed | payments
 *
 * 2. Loan Amortization Schedules
 *    Cols: period | date | beg_balance | payment | principal | interest | end_balance
 *
 * The parser auto-detects which format is present based on tab names and headers.
 */

import * as XLSX from 'xlsx';
import { AmortizationScheduleData, AmortizationRow, ExtractionResult } from '../types';
import { findHeaderRow, parseSheetFromRow, parseNum, parseDate } from './workbook-utils';

function extractPropertyCode(filename: string): string {
  const m = filename.match(/p(\d{4})/i);
  return m ? `p${m[1]}` : 'UNKNOWN';
}

function extractPeriodDate(sheet: XLSX.WorkSheet): string | null {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  for (let r = 0; r < Math.min(6, range.e.r); r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    if (!cell?.v) continue;
    const d = parseDate(cell.v);
    if (d) return d;
  }
  return null;
}

// ── Prepaid/Accrual schedule detection ─────────────────────────────────────

const PREPAID_TAB_RE = /prepaid|accrued|accrual|insurance|re\s*tax|tax\s*accrual/i;

interface PrepaidEntry {
  description: string;
  coverageStart: string | null;
  coverageEnd: string | null;
  totalAmount: number | null;
  monthsInPeriod: number | null;
  perMonth: number | null;
  monthsExpensed: number | null;
  payments: number | null;
  balance: number | null;
  accountType: string;
}

function parsePrepaidSheet(sheet: XLSX.WorkSheet, accountType: string): PrepaidEntry[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const entries: PrepaidEntry[] = [];

  // Find the header row (look for "Coverage Period" or "Months")
  let headerRow = -1;
  for (let r = 0; r < Math.min(15, range.e.r); r++) {
    let hasCoverage = false, hasMonths = false;
    for (let c = 0; c <= range.e.c; c++) {
      const v = String(sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? '').toLowerCase();
      if (/coverage|policy|prepaid|accrued/.test(v)) hasCoverage = true;
      if (/month|per month/.test(v)) hasMonths = true;
    }
    if (hasCoverage && hasMonths) { headerRow = r; break; }
  }

  if (headerRow < 0) return entries;

  // Read header columns
  const headers: string[] = [];
  for (let c = 0; c <= range.e.c; c++) {
    headers.push(String(sheet[XLSX.utils.encode_cell({ r: headerRow, c })]?.v ?? '').trim().toLowerCase());
  }

  const descIdx    = headers.findIndex(h => /policy|prepaid|accrued|description|state|type/i.test(h));
  const startIdx   = headers.findIndex(h => /coverage\s*period|start/i.test(h));
  const endIdx     = headers.findIndex((h, i) => i > startIdx && (/end|to/i.test(h) || h === ' ' || h === ''));
  const amtIdx     = headers.findIndex(h => /premium|amount|total/i.test(h));
  const monthsIdx  = headers.findIndex(h => /months\s+in\s+coverage|months\s+in\s+period/i.test(h));
  const perMoIdx   = headers.findIndex(h => /per\s+month/i.test(h));
  const expIdx     = headers.findIndex(h => /months\s+expensed/i.test(h));
  const payIdx     = headers.findIndex(h => /payments?/i.test(h));
  const balIdx     = headers.findIndex(h => /balance|prepaid.*accrual/i.test(h));

  // Regex to skip rows where col-0 has been coerced to a Date toString()
  const DATE_TOSTRING_RE = /^\w{3}\s+\w{3}\s+\d{2}\s+\d{4}|^\d{4}-\d{2}-\d{2}T\d{2}/;

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const descCell = sheet[XLSX.utils.encode_cell({ r, c: Math.max(0, descIdx) })];
    // Skip accumulation/monthly-rundown rows that have a serialised Date in col-0
    if (descCell?.t === 'd' || (descCell?.v instanceof Date)) continue;
    const desc = String(descCell?.v ?? '').trim();
    if (!desc || DATE_TOSTRING_RE.test(desc)) continue;
    const amt = amtIdx >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: amtIdx })]?.v) : null;
    const perMo = perMoIdx >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: perMoIdx })]?.v) : null;
    if (amt == null && perMo == null) continue;

    entries.push({
      description:    desc,
      coverageStart:  startIdx >= 0 ? parseDate(sheet[XLSX.utils.encode_cell({ r, c: startIdx })]?.v) : null,
      coverageEnd:    endIdx   >= 0 ? parseDate(sheet[XLSX.utils.encode_cell({ r, c: endIdx })]?.v)   : null,
      totalAmount:    amt,
      monthsInPeriod: monthsIdx >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: monthsIdx })]?.v) : null,
      perMonth:       perMo,
      monthsExpensed: expIdx >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: expIdx })]?.v) : null,
      payments:       payIdx >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: payIdx })]?.v) : null,
      balance:        balIdx >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: balIdx })]?.v) : null,
      accountType,
    });
  }

  return entries;
}

// ── Loan amortization schedule ──────────────────────────────────────────────

const LOAN_HEADER_PATTERNS = [/period|pmt\s*#/i, /principal/i, /interest/i, /balance/i];

function findColumnIndex(headers: string[], patterns: RegExp[]): number {
  for (const p of patterns) {
    const idx = headers.findIndex(h => p.test(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function extractLoanMeta(sheet: XLSX.WorkSheet): Record<string, any> {
  const meta: Record<string, any> = {};
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const metaPatterns = [
    { re: /loan\s*amount|original\s*balance/i, field: 'loanAmount' },
    { re: /interest\s*rate|annual\s*rate/i, field: 'interestRate' },
    { re: /term/i, field: 'termMonths' },
    { re: /monthly\s*payment/i, field: 'monthlyPayment' },
    { re: /start\s*date|first\s*payment/i, field: 'startDate' },
  ];
  for (let r = 0; r < Math.min(20, range.e.r); r++) {
    const label = String(sheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v ?? '').trim();
    for (const { re, field } of metaPatterns) {
      if (re.test(label) && meta[field] == null) {
        const v = sheet[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
        meta[field] = field === 'startDate' ? parseDate(v) :
                      field === 'interestRate' ? (() => { const n = parseNum(v); return n != null && n > 1 ? n / 100 : n; })() :
                      parseNum(v);
      }
    }
  }
  return meta;
}

function parseLoanAmortSheet(sheet: XLSX.WorkSheet): AmortizationRow[] {
  const headerRow = findHeaderRow(sheet, LOAN_HEADER_PATTERNS, 30, 2);
  const { headers, rows } = parseSheetFromRow(sheet, headerRow);
  if (rows.length === 0) return [];

  const periodIdx  = findColumnIndex(headers, [/^period$|^pmt|^#$/i, /^no\.?$/i]);
  const dateIdx    = findColumnIndex(headers, [/date/i]);
  const begBalIdx  = findColumnIndex(headers, [/begin|opening|start/i]);
  const pmtIdx     = findColumnIndex(headers, [/^payment$|^pmt$|scheduled/i]);
  const princIdx   = findColumnIndex(headers, [/principal/i]);
  const intIdx     = findColumnIndex(headers, [/interest/i]);
  const endBalIdx  = findColumnIndex(headers, [/end|closing|remain|balance/i]);
  const escrowIdx  = findColumnIndex(headers, [/escrow/i]);

  const result: AmortizationRow[] = [];
  let counter = 1;
  for (const row of rows) {
    const vals = Object.values(row) as any[];
    const principal = princIdx >= 0 ? parseNum(vals[princIdx]) : null;
    const interest  = intIdx   >= 0 ? parseNum(vals[intIdx])   : null;
    const endBal    = endBalIdx >= 0 ? parseNum(vals[endBalIdx]) : null;
    if (principal == null && interest == null && endBal == null) continue;
    const rawPeriod = periodIdx >= 0 ? vals[periodIdx] : null;
    result.push({
      period:           Math.round(parseNum(rawPeriod) ?? counter),
      paymentDate:      dateIdx   >= 0 ? parseDate(vals[dateIdx])         : null,
      beginningBalance: begBalIdx >= 0 ? parseNum(vals[begBalIdx])        : null,
      scheduledPayment: pmtIdx    >= 0 ? parseNum(vals[pmtIdx])           : null,
      principal, interest,
      endingBalance:    endBal,
      escrow:           escrowIdx >= 0 ? parseNum(vals[escrowIdx])        : null,
    });
    counter++;
  }
  return result;
}

// ── Main export ─────────────────────────────────────────────────────────────

export function parseAmortizationSchedule(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    if (workbook.SheetNames.length === 0) {
      return { documentType: 'AMORTIZATION_SCHEDULE', success: false, error: 'No sheets found', data: null, summary: {}, warnings };
    }

    const propertyCode = extractPropertyCode(filename);
    const isPrepaid = workbook.SheetNames.some(n => PREPAID_TAB_RE.test(n));

    if (isPrepaid) {
      // Prepaid/Accrual expense schedule
      const allEntries: PrepaidEntry[] = [];
      let periodDate: string | null = null;

      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        if (!periodDate) periodDate = extractPeriodDate(sheet);
        const entries = parsePrepaidSheet(sheet, name);
        allEntries.push(...entries);
      }

      if (allEntries.length === 0) warnings.push('No prepaid/accrual entries found');
      if (!periodDate) { warnings.push('Period date not found'); periodDate = new Date().toISOString().slice(0, 10); }

      const totalPerMonth = allEntries.reduce((s, e) => s + (e.perMonth ?? 0), 0);
      const totalAmount   = allEntries.reduce((s, e) => s + (e.totalAmount ?? 0), 0);

      // Return as AmortizationScheduleData with rows mapped from prepaid entries
      const data: AmortizationScheduleData = {
        propertyCode,
        loanAmount:     null,
        interestRate:   null,
        termMonths:     null,
        startDate:      periodDate,
        monthlyPayment: totalPerMonth,
        rows: [],
        summary: {
          totalPayments:   totalAmount,
          totalInterest:   0,
          totalPrincipal:  0,
          remainingBalance: null,
          periodsFound:    allEntries.length,
        },
      };

      return {
        documentType: 'AMORTIZATION_SCHEDULE',
        success: true,
        data,
        summary: {
          propertyCode,
          scheduleType: 'PREPAID_ACCRUAL',
          periodDate,
          entriesFound: allEntries.length,
          totalMonthlyExpense: totalPerMonth,
          totalPrepaidAmount:  totalAmount,
          tabs: workbook.SheetNames.join(', '),
          entries: allEntries.slice(0, 20),
        },
        warnings,
      };
    }

    // Loan amortization schedule
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const meta = extractLoanMeta(sheet);
    const rows = parseLoanAmortSheet(sheet);

    if (rows.length === 0) warnings.push('No amortization rows found');

    const totalPrincipal = rows.reduce((s, r) => s + (r.principal ?? 0), 0);
    const totalInterest  = rows.reduce((s, r) => s + (r.interest  ?? 0), 0);
    const totalPayments  = rows.reduce((s, r) => s + (r.scheduledPayment ?? 0), 0);
    const remainingBal   = rows.length > 0 ? (rows[rows.length - 1].endingBalance ?? null) : null;

    const data: AmortizationScheduleData = {
      propertyCode,
      loanAmount:     meta.loanAmount     ?? null,
      interestRate:   meta.interestRate   ?? null,
      termMonths:     meta.termMonths     ?? null,
      startDate:      meta.startDate      ?? null,
      monthlyPayment: meta.monthlyPayment ?? null,
      rows,
      summary: { totalPayments, totalInterest, totalPrincipal, remainingBalance: remainingBal, periodsFound: rows.length },
    };

    return {
      documentType: 'AMORTIZATION_SCHEDULE',
      success: true,
      data,
      summary: { propertyCode, scheduleType: 'LOAN', loanAmount: data.loanAmount, interestRate: data.interestRate, periodsFound: rows.length, remainingBalance: remainingBal },
      warnings,
    };
  } catch (err: any) {
    return {
      documentType: 'AMORTIZATION_SCHEDULE',
      success: false,
      error: `Failed to parse amortization schedule: ${err.message}`,
      data: null,
      summary: {},
      warnings,
    };
  }
}
