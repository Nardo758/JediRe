import * as XLSX from 'xlsx';
import { OtherIncomeData, OtherIncomeCategory, ExtractionResult } from '../types';
import { smartParseSheet, parseNum } from './workbook-utils';

const OI_HEADER_PATTERNS = [/category|income|source|item|description|line/i, /annual|monthly|amount|total|per.*unit|rate/i, /unit|qty|quantity|count/i];

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
    const { headers, rows } = smartParseSheet(sheet, OI_HEADER_PATTERNS, 2);

    if (rows.length === 0) {
      return { documentType: 'OTHER_INCOME', success: false, error: 'No data rows found (checked up to 20 title rows)', data: null, summary: {}, warnings };
    }
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

    if (categories.length === 0 || (totalAnnual === 0 && totalMonthly === 0)) {
      return {
        documentType: 'OTHER_INCOME', success: false,
        error: categories.length === 0 ? 'No income categories extracted' : 'All income values are zero — likely header detection failure',
        data: null, summary: {}, warnings,
      };
    }

    return { documentType: 'OTHER_INCOME', success: true, data, summary: data.summary, warnings };
  } catch (err) {
    return {
      documentType: 'OTHER_INCOME', success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null, summary: {}, warnings,
    };
  }
}
