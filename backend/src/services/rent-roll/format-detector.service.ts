/**
 * M07: Rent Roll Format Detector
 *
 * Detects whether an uploaded file is:
 *   - Yardi CSV / Yardi XLSX
 *   - Generic CSV / Generic XLSX
 *
 * Returns a format code and the header row for downstream field mapping.
 */

import fs from 'fs';
import path from 'path';

export type RentRollFormat = 'yardi_csv' | 'yardi_xlsx' | 'generic_csv' | 'generic_xlsx';

export interface FormatDetectionResult {
  format: RentRollFormat;
  headers: string[];
  confidence: number;   // 0.0–1.0: how certain we are of the format
}

// Yardi-specific header fingerprints (case-insensitive substring matches)
const YARDI_FINGERPRINTS = [
  'unit status',
  'charge code',
  'lease from',
  'lease to',
  'move in',
  'move out',
  'market rent',
  'lease rent',
  'resident id',
  'building',
];

export class FormatDetectorService {

  /**
   * Detect the format of a rent roll file from its path.
   * Reads only the first row for CSV; uses sheetjs for XLSX.
   */
  async detect(filePath: string): Promise<FormatDetectionResult> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.csv') {
      return this.detectCsv(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      return this.detectXlsx(filePath);
    }

    throw new Error(`Unsupported file extension: ${ext}. Supported: .csv, .xlsx, .xls`);
  }

  private async detectCsv(filePath: string): Promise<FormatDetectionResult> {
    const headers = await this.readCsvHeaders(filePath);
    const isYardi = this.matchesYardiFingerprint(headers);

    return {
      format: isYardi ? 'yardi_csv' : 'generic_csv',
      headers,
      confidence: isYardi ? 0.9 : 0.7,
    };
  }

  private async detectXlsx(filePath: string): Promise<FormatDetectionResult> {
    const XLSX = await this.loadXlsx();
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const headers = (rows[0] || []).map((h: any) => String(h).trim());
    const isYardi = this.matchesYardiFingerprint(headers);

    return {
      format: isYardi ? 'yardi_xlsx' : 'generic_xlsx',
      headers,
      confidence: isYardi ? 0.9 : 0.7,
    };
  }

  private matchesYardiFingerprint(headers: string[]): boolean {
    const headerLower = headers.map(h => h.toLowerCase());
    let matches = 0;
    for (const fingerprint of YARDI_FINGERPRINTS) {
      if (headerLower.some(h => h.includes(fingerprint))) {
        matches++;
      }
    }
    // Need at least 3 fingerprint matches to call it Yardi
    return matches >= 3;
  }

  private async readCsvHeaders(filePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      let firstLine = '';
      let found = false;

      stream.on('data', (chunk: string) => {
        if (found) return;
        const nl = chunk.indexOf('\n');
        if (nl >= 0) {
          firstLine += chunk.slice(0, nl);
          found = true;
          stream.destroy();
        } else {
          firstLine += chunk;
        }
      });

      stream.on('close', () => resolve(this.parseCsvLine(firstLine.trim())));
      stream.on('error', reject);
    });
  }

  private parseCsvLine(line: string): string[] {
    // Simple CSV parser for the header line (handles quoted fields)
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  private async loadXlsx(): Promise<any> {
    try {
      return await import('xlsx');
    } catch {
      throw new Error('xlsx package not available. Install with: npm install xlsx');
    }
  }
}

export const formatDetectorService = new FormatDetectorService();
