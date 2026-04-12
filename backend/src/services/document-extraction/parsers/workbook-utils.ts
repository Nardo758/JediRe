import * as XLSX from 'xlsx';

export interface SheetParseResult {
  headers: string[];
  rows: Record<string, any>[];
  headerRowIndex: number;
}

export function findHeaderRow(
  sheet: XLSX.WorkSheet,
  requiredPatterns: RegExp[],
  maxScanRows: number = 20,
  minMatches: number = 2
): number {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const maxRow = Math.min(range.e.r, maxScanRows - 1);

  let bestRow = 0;
  let bestScore = -Infinity;

  for (let r = 0; r <= maxRow; r++) {
    const rowValues: string[] = [];
    let populatedCells = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v != null) {
        rowValues.push(String(cell.v).trim().toLowerCase());
        populatedCells++;
      }
    }
    const rowStr = rowValues.join(' ');
    const matches = requiredPatterns.filter(p => p.test(rowStr)).length;
    if (matches >= minMatches) {
      const cellDensityBonus = populatedCells >= 4 ? populatedCells * 0.1 : 0;
      const isSingleLongText = populatedCells <= 2 && rowStr.length > 60;
      const score = matches + cellDensityBonus - (isSingleLongText ? 3 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestRow = r;
      }
    }
  }

  return bestRow;
}

export function parseSheetFromRow(
  sheet: XLSX.WorkSheet,
  headerRow: number
): SheetParseResult {
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: null,
    range: headerRow,
  });

  if (rows.length === 0) {
    return { headers: [], rows: [], headerRowIndex: headerRow };
  }

  const headers = Object.keys(rows[0]);
  return { headers, rows, headerRowIndex: headerRow };
}

export function smartParseSheet(
  sheet: XLSX.WorkSheet,
  headerPatterns: RegExp[],
  minHeaderMatches: number = 2
): SheetParseResult {
  const headerRow = findHeaderRow(sheet, headerPatterns, 20, minHeaderMatches);
  return parseSheetFromRow(sheet, headerRow);
}

export function findSectionStartRow(
  sheet: XLSX.WorkSheet,
  sectionPattern: RegExp,
  startFromRow: number = 0,
  maxScanRows: number = 100
): number {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const maxRow = Math.min(range.e.r, startFromRow + maxScanRows);

  for (let r = startFromRow; r <= maxRow; r++) {
    for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 3); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v != null && sectionPattern.test(String(cell.v).trim())) {
        return r;
      }
    }
  }
  return -1;
}

export function parseNum(val: any): number | null {
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

export function parseDate(val: any): string | null {
  if (val == null || val === '') return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  const usMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (usMatch) {
    const yr = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];
    return `${yr}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  }
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
}
