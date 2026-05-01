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
    const { headers: rawHeaders, rows: rawRows } = smartParseSheet(sheet, OI_HEADER_PATTERNS, 2);

    if (rawRows.length === 0) {
      return { documentType: 'OTHER_INCOME', success: false, error: 'No data rows found (checked up to 20 title rows)', data: null, summary: {}, warnings };
    }

    // Detect and merge multi-row headers (e.g., Market Rent Schedule spans 3 header rows).
    // A row is a header-continuation if its first column is empty and at least two other
    // columns contain non-empty strings (not numbers).
    let headers = rawHeaders;
    let rows = rawRows;
    for (let pass = 0; pass < 3; pass++) {
      const candidate = rows[0];
      if (!candidate) break;
      const firstVal = String(candidate[rawHeaders[0]] ?? '').trim();
      const stringCols = Object.entries(candidate).filter(([, v]) => typeof v === 'string' && (v as string).trim().length > 0);
      if (!firstVal && stringCols.length >= 2) {
        // Build a name map merging the continuation label into the column key
        const nameMap: Record<string, string> = {};
        for (const [col, contVal] of Object.entries(candidate)) {
          const label = typeof contVal === 'string' ? contVal.trim() : '';
          nameMap[col] = label ? `${col} ${label}` : col;
        }
        headers = headers.map(h => nameMap[h] || h);
        rows = rows.slice(1).map(row => {
          const newRow: Record<string, any> = {};
          for (const [k, v] of Object.entries(row)) {
            newRow[nameMap[k] || k] = v;
          }
          return newRow;
        });
      } else {
        break;
      }
    }

    const categoryCol = findCol(headers, [/category/i, /income[\s_-]*type/i, /source/i, /item/i, /description/i, /line[\s_-]*item/i, /unit[\s_-]*type/i, /floorplan/i, /plan/i]) || headers[0];
    const descCol = findCol(headers, [/description/i, /detail/i, /note/i]);
    const unitCountCol = findCol(headers, [/unit[\s_-]*count/i, /units/i, /quantity/i, /qty/i, /count/i]);
    const perUnitCol = findCol(headers, [/per[\s_-]*unit/i, /\/[\s]*unit/i, /unit[\s_-]*rate/i, /rate/i, /market[\s_-]*rent/i, /effective[\s_-]*rent/i, /asking[\s_-]*rent/i, /unit[\s_-]*rent/i, /\brent\b/i]);
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
