import * as XLSX from 'xlsx';
import { T12Data, T12Month, ExtractionResult } from '../types';
import { findHeaderRow, parseSheetFromRow } from './workbook-utils';

const GL_CATEGORY_MAP: Record<string, string> = {
  '40': 'grossPotentialRent',
  '41': 'lossToLease',
  '42': 'vacancyLoss',
  '43': 'concessions',
  '44': 'badDebt',
  '441': 'grossPotentialRent',
  '442': 'concessions',
  '45': 'otherIncome',
  '46': 'utilityReimbursement',
  '47': 'lateFees',
  '48': 'miscIncome',
};

const HEADER_CATEGORY_MAP: Record<string, string> = {
  'gross potential rent': 'grossPotentialRent',
  'market rent': 'grossPotentialRent',
  'gpr': 'grossPotentialRent',
  'loss to lease': 'lossToLease',
  'gain/loss to lease': 'lossToLease',
  'vacancy loss': 'vacancyLoss',
  'vacancy': 'vacancyLoss',
  'concessions': 'concessions',
  'concession': 'concessions',
  'bad debt': 'badDebt',
  'write-offs': 'badDebt',
  'other income': 'otherIncome',
  'other revenue': 'otherIncome',
  'utility reimbursement': 'utilityReimbursement',
  'rubs': 'utilityReimbursement',
  'late fees': 'lateFees',
  'late charges': 'lateFees',
  'misc income': 'miscIncome',
  'effective gross income': 'effectiveGrossIncome',
  'egi': 'effectiveGrossIncome',
  'total revenue': 'effectiveGrossIncome',
  'payroll': 'payroll',
  'personnel': 'payroll',
  'salary': 'payroll',
  'repairs & maintenance': 'repairsMaintenance',
  'repairs and maintenance': 'repairsMaintenance',
  'repair and maintenance': 'repairsMaintenance',
  'r&m': 'repairsMaintenance',
  'maintenance': 'repairsMaintenance',
  'turnover': 'turnoverCosts',
  'make ready': 'turnoverCosts',
  'marketing': 'marketing',
  'advertising': 'marketing',
  'admin': 'adminGeneral',
  'g&a': 'adminGeneral',
  'general & admin': 'adminGeneral',
  'management fee': 'managementFee',
  'mgmt fee': 'managementFee',
  'utilities': 'utilities',
  'utility expense': 'utilities',
  'contract services': 'contractServices',
  'property tax': 'propertyTax',
  'real estate tax': 'propertyTax',
  'taxes': 'propertyTax',
  'insurance': 'insurance',
  'total operating expenses': 'totalOpex',
  'total opex': 'totalOpex',
  'total expenses': 'totalOpex',
  'operating expenses': 'totalOpex',
  'net operating income': 'noi',
  'noi': 'noi',
  'net rental income': 'netRentalIncome',
  'nri': 'netRentalIncome',
};

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseNum(val: any): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  let s = String(val).trim();
  if (!s || s === '-' || s === '—') return null;
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) { negative = true; s = s.slice(1, -1); }
  else if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  s = s.replace(/[$,%\s]/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -n : n;
}

function detectMonthColumns(headers: string[]): Array<{ header: string; month: string }> {
  const results: Array<{ header: string; month: string }> = [];

  for (const header of headers) {
    const lower = header.toLowerCase().trim();

    const dateMatch = lower.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (dateMatch) {
      const yr = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
      const monthNum = dateMatch[1].padStart(2, '0');
      results.push({ header, month: `${yr}-${monthNum}-01` });
      continue;
    }

    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const monthAbbr = MONTH_NAMES[i];
      const re = new RegExp(`\\b${monthAbbr}[a-z]*[\\s-/]*'?(\\d{2,4})?\\b`, 'i');
      const match = lower.match(re);
      if (match) {
        let year = match[1] ? (match[1].length === 2 ? `20${match[1]}` : match[1]) : new Date().getFullYear().toString();
        const monthNum = String(i + 1).padStart(2, '0');
        results.push({ header, month: `${year}-${monthNum}-01` });
        break;
      }
    }
  }

  return results;
}

type T12MonthKey = keyof Omit<T12Month, 'reportMonth'>;

function setMonthField(month: T12Month, field: string, value: number | null): void {
  if (value == null) return;
  if (field in month && field !== 'reportMonth') {
    (month as unknown as Record<string, number | null>)[field] = value;
  }
}

function categorizeRow(row: Record<string, any>, headers: string[]): string | null {
  const firstCol = String(row[headers[0]] || '').trim();

  const glMatch = firstCol.match(/^(4\d{1,2})\d{2,4}/);
  if (glMatch) {
    const code3 = glMatch[1].length >= 3 ? glMatch[1].substring(0, 3) : null;
    const code2 = glMatch[1].substring(0, 2);
    return (code3 && GL_CATEGORY_MAP[code3]) || GL_CATEGORY_MAP[code2] || null;
  }

  if (/^\d{5,7}\s*-/.test(firstCol)) return null;

  const lower = firstCol.toLowerCase();
  if (lower.includes('non-operating') || lower.includes('non operating')) return null;
  for (const [pattern, category] of Object.entries(HEADER_CATEGORY_MAP)) {
    if (lower.includes(pattern)) return category;
  }

  return null;
}

export function parseT12(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const T12_HEADER_PATTERNS = [/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/i, /\b(?:gross|rent|revenue|income|expense|noi|actual|budget|total)\b/i];
    const headerRow = findHeaderRow(sheet, T12_HEADER_PATTERNS, 20, 1);
    const { headers, rows } = parseSheetFromRow(sheet, headerRow);

    if (rows.length === 0) {
      return { documentType: 'T12', success: false, error: 'No data rows found (checked up to 20 title rows)', data: null, summary: {}, warnings };
    }

    const monthCols = detectMonthColumns(headers);

    if (monthCols.length === 0) {
      warnings.push('No month columns detected — attempting row-based layout');
    }

    const months: Map<string, T12Month> = new Map();

    if (monthCols.length > 0) {
      for (const mc of monthCols) {
        months.set(mc.month, createEmptyMonth(mc.month));
      }

      for (const row of rows) {
        const category = categorizeRow(row, headers);
        if (!category) continue;

        for (const mc of monthCols) {
          const val = parseNum(row[mc.header]);
          if (val == null) continue;
          const m = months.get(mc.month)!;
          setMonthField(m, category, val);
        }
      }
    } else {
      const dateCol = headers.find(h => /month|date|period/i.test(h));
      if (dateCol) {
        for (const row of rows) {
          const dateVal = row[dateCol];
          const month = parseDateToMonth(dateVal);
          if (!month) continue;

          if (!months.has(month)) {
            months.set(month, createEmptyMonth(month));
          }
          const m = months.get(month)!;

          for (const [header, val] of Object.entries(row)) {
            if (header === dateCol) continue;
            const category = HEADER_CATEGORY_MAP[header.toLowerCase().trim()];
            if (category) {
              setMonthField(m, category, parseNum(val));
            }
          }
        }
      }
    }

    const monthArr = Array.from(months.values()).sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));

    for (const m of monthArr) {
      if (m.totalOpex == null) {
        const computed = (m.payroll || 0) + (m.repairsMaintenance || 0) + (m.turnoverCosts || 0) +
          (m.marketing || 0) + (m.adminGeneral || 0) + (m.managementFee || 0) +
          (m.utilities || 0) + (m.contractServices || 0) + (m.propertyTax || 0) + (m.insurance || 0);
        if (computed > 0) m.totalOpex = computed;
      }
    }

    const t12Revenue = monthArr.reduce((s, m) => s + (m.effectiveGrossIncome || m.grossPotentialRent || 0), 0);
    const t12OpEx = monthArr.reduce((s, m) => s + (m.totalOpex || 0), 0);
    const t12NOI = monthArr.reduce((s, m) => s + (m.noi || (m.effectiveGrossIncome || 0) - (m.totalOpex || 0)), 0);
    const expenseRatio = t12Revenue > 0 ? t12OpEx / t12Revenue : 0;

    const data: T12Data = {
      months: monthArr,
      summary: {
        t12Revenue,
        t12OpEx,
        t12NOI,
        expenseRatio,
        impliedOccupancy: null,
        totalUnits: null,
        periodStart: monthArr[0]?.reportMonth || '',
        periodEnd: monthArr[monthArr.length - 1]?.reportMonth || '',
      },
    };

    if (monthArr.length < 12) {
      warnings.push(`Only ${monthArr.length} months detected (expected 12)`);
    }

    if (monthArr.length === 0 || (t12Revenue === 0 && t12OpEx === 0 && t12NOI === 0)) {
      return {
        documentType: 'T12',
        success: false,
        error: monthArr.length === 0 ? 'No monthly periods extracted' : 'All financial values are zero — likely header detection failure',
        data: null,
        summary: {},
        warnings,
      };
    }

    return {
      documentType: 'T12',
      success: true,
      data,
      summary: data.summary,
      warnings,
    };
  } catch (err) {
    return {
      documentType: 'T12',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null,
      summary: {},
      warnings,
    };
  }
}

function createEmptyMonth(reportMonth: string): T12Month {
  return {
    reportMonth,
    grossPotentialRent: null, lossToLease: null, vacancyLoss: null, concessions: null,
    badDebt: null, netRentalIncome: null, otherIncome: null, utilityReimbursement: null,
    lateFees: null, miscIncome: null, effectiveGrossIncome: null, payroll: null,
    repairsMaintenance: null, turnoverCosts: null, marketing: null, adminGeneral: null,
    managementFee: null, utilities: null, contractServices: null, propertyTax: null,
    insurance: null, totalOpex: null, noi: null, totalUnits: null, occupiedUnits: null,
  };
}

function parseDateToMonth(val: any): string | null {
  if (val == null) return null;
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-01`;
  }
  const s = String(val).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-01`;
  const monMatch = s.match(/^([a-zA-Z]+)\s*[-/]?\s*(\d{4})/);
  if (monMatch) {
    const idx = MONTH_NAMES.indexOf(monMatch[1].substring(0, 3).toLowerCase());
    if (idx >= 0) return `${monMatch[2]}-${String(idx + 1).padStart(2, '0')}-01`;
  }
  return null;
}
