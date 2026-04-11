import * as XLSX from 'xlsx';
import { OtherIncomeData, OtherIncomeCategory, ExtractionResult } from '../types';

function parseNum(val: any): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  let s = String(val).trim().replace(/[$,%\s]/g, '');
  if (!s || s === '-' || s === '—') return null;
  let neg = false;
  if (s.startsWith('(') && s.endsWith(')')) { neg = true; s = s.slice(1, -1); }
  else if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  const n = parseFloat(s);
  return isNaN(n) ? null : (neg ? -n : n);
}

function findCol(headers: string[], patterns: RegExp[]): string | null {
  for (const h of headers) {
    for (const p of patterns) {
      if (p.test(h)) return h;
    }
  }
  return null;
}

export function parseOtherIncome(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });

    if (rows.length === 0) {
      return { documentType: 'OTHER_INCOME', success: false, error: 'No data rows', data: null, summary: {}, warnings };
    }

    const headers = Object.keys(rows[0]);
    const categoryCol = findCol(headers, [/category/i, /income[\s_-]*type/i, /source/i, /item/i, /description/i, /line[\s_-]*item/i]) || headers[0];
    const descCol = findCol(headers, [/description/i, /detail/i, /note/i]);
    const unitCountCol = findCol(headers, [/unit[\s_-]*count/i, /units/i, /quantity/i, /qty/i, /count/i]);
    const perUnitCol = findCol(headers, [/per[\s_-]*unit/i, /\/[\s]*unit/i, /unit[\s_-]*rate/i, /rate/i]);
    const annualCol = findCol(headers, [/annual/i, /yearly/i, /total[\s_-]*annual/i, /year/i]);
    const monthlyCol = findCol(headers, [/monthly/i, /month/i, /per[\s_-]*month/i]);
    const assumptionCol = findCol(headers, [/assumption/i, /basis/i, /note/i, /methodology/i]);

    const categories: OtherIncomeCategory[] = [];

    for (const row of rows) {
      const cat = String(row[categoryCol] || '').trim();
      if (!cat || /^(total|subtotal|grand|summary)/i.test(cat)) continue;

      const unitCount = unitCountCol ? parseNum(row[unitCountCol]) : null;
      const perUnit = perUnitCol ? parseNum(row[perUnitCol]) : null;
      let annual = annualCol ? parseNum(row[annualCol]) : null;
      let monthly = monthlyCol ? parseNum(row[monthlyCol]) : null;

      if (annual == null && monthly != null) annual = monthly * 12;
      if (monthly == null && annual != null) monthly = annual / 12;
      if (annual == null && perUnit != null && unitCount != null) {
        annual = perUnit * unitCount * 12;
        monthly = perUnit * unitCount;
      }

      categories.push({
        category: cat,
        description: descCol && descCol !== categoryCol ? String(row[descCol] || '').trim() || null : null,
        unitCount: unitCount ? Math.round(unitCount) : null,
        perUnitAmount: perUnit,
        totalAnnual: annual || 0,
        totalMonthly: monthly || 0,
        assumptions: assumptionCol ? String(row[assumptionCol] || '').trim() || null : null,
      });
    }

    const totalAnnual = categories.reduce((s, c) => s + c.totalAnnual, 0);
    const totalMonthly = categories.reduce((s, c) => s + c.totalMonthly, 0);
    const totalUnits = categories.find(c => c.unitCount != null)?.unitCount || null;

    const data: OtherIncomeData = {
      categories,
      summary: {
        totalAnnual,
        totalMonthly,
        categoryCount: categories.length,
        perUnitTotal: totalUnits && totalUnits > 0 ? totalAnnual / totalUnits : null,
      },
    };

    return { documentType: 'OTHER_INCOME', success: true, data, summary: data.summary, warnings };
  } catch (err) {
    return {
      documentType: 'OTHER_INCOME', success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null, summary: {}, warnings,
    };
  }
}
