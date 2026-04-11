import * as XLSX from 'xlsx';
import { AgedReceivablesData, AgingRecord, ExtractionResult } from '../types';

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

const UNIT_PATTERNS = [/^unit/i, /^apt/i, /^space/i, /^#/];
const TENANT_PATTERNS = [/tenant/i, /resident/i, /name/i, /occupant/i];
const BUCKET_0_30 = [/0[\s-]*30/i, /current/i, /0-30/];
const BUCKET_31_60 = [/31[\s-]*60/i];
const BUCKET_61_90 = [/61[\s-]*90/i];
const BUCKET_90_PLUS = [/90[\s+]*\+/i, /over[\s]*90/i, /90[\s-]*plus/i, /91\+/i, /90\+/i];
const PREPAID_PATTERNS = [/prepaid/i, /credit/i, /prepay/i];
const TOTAL_PATTERNS = [/total/i, /balance/i, /amount[\s_-]*due/i];

function findCol(headers: string[], patterns: RegExp[]): string | null {
  for (const h of headers) {
    for (const p of patterns) {
      if (p.test(h)) return h;
    }
  }
  return null;
}

export function parseAgedReceivables(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });

    if (rows.length === 0) {
      return { documentType: 'AGED_RECEIVABLES', success: false, error: 'No data rows', data: null, summary: {}, warnings };
    }

    const headers = Object.keys(rows[0]);
    const unitCol = findCol(headers, UNIT_PATTERNS);
    const tenantCol = findCol(headers, TENANT_PATTERNS);
    const b030Col = findCol(headers, BUCKET_0_30);
    const b3160Col = findCol(headers, BUCKET_31_60);
    const b6190Col = findCol(headers, BUCKET_61_90);
    const b90Col = findCol(headers, BUCKET_90_PLUS);
    const prepaidCol = findCol(headers, PREPAID_PATTERNS);
    const totalCol = findCol(headers, TOTAL_PATTERNS);

    if (!unitCol && !tenantCol) {
      return { documentType: 'AGED_RECEIVABLES', success: false, error: 'Could not identify unit or tenant columns', data: null, summary: {}, warnings };
    }

    const records: AgingRecord[] = [];

    for (const row of rows) {
      const unitNum = unitCol ? String(row[unitCol] || '').trim() : '';
      if (!unitNum || /^(total|subtotal|grand|summary)/i.test(unitNum)) continue;

      const b030 = b030Col ? parseNum(row[b030Col]) : 0;
      const b3160 = b3160Col ? parseNum(row[b3160Col]) : 0;
      const b6190 = b6190Col ? parseNum(row[b6190Col]) : 0;
      const b90 = b90Col ? parseNum(row[b90Col]) : 0;
      const prepaid = prepaidCol ? parseNum(row[prepaidCol]) : 0;
      const total = totalCol ? parseNum(row[totalCol]) : (b030 + b3160 + b6190 + b90 + prepaid);

      records.push({
        unitNumber: unitNum,
        tenantName: tenantCol ? String(row[tenantCol] || '').trim() || null : null,
        currentBalance: b030,
        bucket_0_30: b030,
        bucket_31_60: b3160,
        bucket_61_90: b6190,
        bucket_90_plus: b90,
        prepaid: prepaid,
        totalBalance: total,
        leaseStatus: null,
      });
    }

    const totalAR = records.reduce((s, r) => s + Math.max(0, r.totalBalance), 0);
    const total_0_30 = records.reduce((s, r) => s + r.bucket_0_30, 0);
    const total_31_60 = records.reduce((s, r) => s + r.bucket_31_60, 0);
    const total_61_90 = records.reduce((s, r) => s + r.bucket_61_90, 0);
    const total_90_plus = records.reduce((s, r) => s + r.bucket_90_plus, 0);
    const totalPrepaid = records.reduce((s, r) => s + r.prepaid, 0);

    const seriousDelinquent = records.filter(r => r.bucket_61_90 > 0 || r.bucket_90_plus > 0).length;
    const seriousDelinquencyRate = records.length > 0 ? seriousDelinquent / records.length : 0;

    const data: AgedReceivablesData = {
      records,
      summary: {
        totalAR,
        total_0_30,
        total_31_60,
        total_61_90,
        total_90_plus,
        totalPrepaid,
        seriousDelinquencyRate,
        unitsDelinquent: seriousDelinquent,
        totalUnits: records.length,
      },
    };

    return {
      documentType: 'AGED_RECEIVABLES',
      success: true,
      data,
      summary: data.summary,
      warnings,
    };
  } catch (err) {
    return {
      documentType: 'AGED_RECEIVABLES',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null,
      summary: {},
      warnings,
    };
  }
}
