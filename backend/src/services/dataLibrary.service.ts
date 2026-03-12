import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

export interface DataLibraryFile {
  id: number;
  user_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  city: string | null;
  zip_code: string | null;
  property_type: string | null;
  property_height: string | null;
  year_built: string | null;
  unit_count: number | null;
  source_type: string;
  tags: string[];
  parsed_data: any;
  parsing_status: string;
  parsing_errors: string | null;
  uploaded_at: Date;
}

export interface DataLibraryUploadParams {
  userId?: string;
  file: {
    originalname: string;
    buffer: Buffer;
    mimetype: string;
    size: number;
  };
  city?: string;
  zipCode?: string;
  propertyType?: string;
  propertyHeight?: string;
  yearBuilt?: string;
  unitCount?: number;
  sourceType?: string;
  tags?: string[];
}

export interface DataLibrarySearchParams {
  city?: string;
  zipCode?: string;
  propertyType?: string;
  propertyHeight?: string;
  yearBuilt?: string;
  unitCountMin?: number;
  unitCountMax?: number;
  sourceType?: string;
  limit?: number;
}

export class DataLibraryService {
  private pool: Pool;
  private uploadDir: string;

  constructor(pool: Pool) {
    this.pool = pool;
    this.uploadDir = path.join(process.cwd(), 'uploads', 'data-library');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.').slice(0, 200);
  }

  async uploadFile(params: DataLibraryUploadParams): Promise<DataLibraryFile> {
    const safeName = this.sanitizeFilename(params.file.originalname);
    const fileName = `${Date.now()}-${safeName}`;
    const filePath = path.join(this.uploadDir, fileName);

    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(this.uploadDir);
    if (!resolvedPath.startsWith(resolvedDir)) {
      throw new Error('Invalid file path');
    }

    fs.writeFileSync(filePath, params.file.buffer);

    const result = await this.pool.query(
      `INSERT INTO data_library_files
        (user_id, file_name, file_path, file_size, mime_type, city, zip_code, property_type, property_height, year_built, unit_count, source_type, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        params.userId || null,
        params.file.originalname,
        filePath,
        params.file.size,
        params.file.mimetype,
        params.city || null,
        params.zipCode || null,
        params.propertyType || null,
        params.propertyHeight || null,
        params.yearBuilt || null,
        params.unitCount || null,
        params.sourceType || 'owned',
        JSON.stringify(params.tags || []),
      ]
    );

    const file = result.rows[0];
    this.parseFileAsync(file.id, filePath, params.file.mimetype).catch(err => {
      console.error('Background parsing failed:', err);
    });

    return file;
  }

  private async parseFileAsync(fileId: number, filePath: string, mimeType: string): Promise<void> {
    await this.pool.query(
      `UPDATE data_library_files SET parsing_status = 'parsing' WHERE id = $1`,
      [fileId]
    );

    try {
      let parsedData: any = {};

      if (mimeType === 'text/csv' || mimeType === 'application/csv') {
        parsedData = await this.parseCSV(filePath);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                 mimeType === 'application/vnd.ms-excel') {
        parsedData = { type: 'excel', status: 'requires_xlsx_parser', fileName: path.basename(filePath) };
      } else if (mimeType === 'application/pdf') {
        parsedData = { type: 'pdf', status: 'requires_pdf_parser', fileName: path.basename(filePath) };
      } else {
        parsedData = { type: 'unknown', mimeType };
      }

      await this.pool.query(
        `UPDATE data_library_files SET parsing_status = 'complete', parsed_data = $1 WHERE id = $2`,
        [JSON.stringify(parsedData), fileId]
      );

      this.extractAndStoreCalibration(fileId, parsedData).catch(() => {});
    } catch (err: any) {
      await this.pool.query(
        `UPDATE data_library_files SET parsing_status = 'error', parsing_errors = $1 WHERE id = $2`,
        [err.message, fileId]
      );
    }
  }

  private async extractAndStoreCalibration(fileId: number, parsedData: any): Promise<void> {
    if (!parsedData?.preview || parsedData.preview.length < 2) return;
    if (!parsedData.headers || !Array.isArray(parsedData.headers)) return;

    const fileRow = await this.pool.query(
      `SELECT city, zip_code, property_type FROM data_library_files WHERE id = $1`,
      [fileId]
    ).then(r => r.rows[0]).catch(() => null);

    if (!fileRow || !fileRow.city) return;

    const city = fileRow.city;
    const rows: Record<string, string>[] = parsedData.preview;
    const headers = parsedData.headers as string[];

    const findCol = (keywords: string[]) =>
      headers.find(h => keywords.some(k => h.toLowerCase().includes(k))) || null;

    const trafficCol = findCol(['traffic', 'walk', 'foot', 'visits', 'prospects']);
    const tourCol = findCol(['tour', 'showing']);
    const appCol = findCol(['app', 'application', 'applicant']);
    const leaseCol = findCol(['lease', 'net lease', 'move-in', 'move_in', 'movein']);

    if (!trafficCol) return;

    let tourRateSum = 0, tourRateCount = 0;
    let appRateSum = 0, appRateCount = 0;
    let leaseRateSum = 0, leaseRateCount = 0;
    let closingRatioSum = 0, closingRatioCount = 0;

    for (const row of rows) {
      const traffic = parseFloat(row[trafficCol] || '0');
      if (!traffic || traffic <= 0) continue;

      const tours = tourCol ? parseFloat(row[tourCol] || '0') : 0;
      const apps = appCol ? parseFloat(row[appCol] || '0') : 0;
      const leases = leaseCol ? parseFloat(row[leaseCol] || '0') : 0;

      if (tourCol && tours >= 0 && tours <= traffic * 2) {
        tourRateSum += tours / traffic;
        tourRateCount++;
      }

      if (appCol && tourCol && tours > 0 && apps >= 0 && apps <= tours * 2) {
        appRateSum += apps / tours;
        appRateCount++;
      }

      if (leaseCol && appCol && apps > 0 && leases >= 0 && leases <= apps * 2) {
        leaseRateSum += leases / apps;
        leaseRateCount++;
      }

      if (leaseCol && traffic > 0 && leases >= 0 && leases <= traffic) {
        closingRatioSum += leases / traffic;
        closingRatioCount++;
      }
    }

    const avgTourConversion = tourRateCount >= 2 ? tourRateSum / tourRateCount : null;
    const avgClosingRatio = closingRatioCount >= 2 ? closingRatioSum / closingRatioCount : null;

    if (!avgTourConversion && !avgClosingRatio) return;

    await this.pool.query(
      `INSERT INTO traffic_submarket_calibration
        (submarket_id, msa_id, city, state, avg_tour_conversion, avg_closing_ratio, sample_count, last_updated)
       VALUES ('', '', $1, '', $2, $3, $4, NOW())
       ON CONFLICT (submarket_id, msa_id, city, state) DO UPDATE SET
         avg_tour_conversion = COALESCE($2, traffic_submarket_calibration.avg_tour_conversion),
         avg_closing_ratio = COALESCE($3, traffic_submarket_calibration.avg_closing_ratio),
         sample_count = traffic_submarket_calibration.sample_count + 1,
         last_updated = NOW()`,
      [city, avgTourConversion, avgClosingRatio, 1]
    );

    console.log(`📊 Data Library calibration extracted from file ${fileId}: tour_conv=${avgTourConversion?.toFixed(3)}, closing_ratio=${avgClosingRatio?.toFixed(3)}, app_rate=${appRateCount >= 2 ? (appRateSum / appRateCount).toFixed(3) : 'n/a'}, lease_rate=${leaseRateCount >= 2 ? (leaseRateSum / leaseRateCount).toFixed(3) : 'n/a'}`);
  }

  private async parseCSV(filePath: string): Promise<any> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) return { rows: 0, headers: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < Math.min(lines.length, 101); i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }

    return {
      type: 'csv',
      totalRows: lines.length - 1,
      previewRows: rows.length,
      headers,
      preview: rows,
    };
  }

  async getFiles(params: DataLibrarySearchParams = {}): Promise<DataLibraryFile[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.city) {
      conditions.push(`city ILIKE $${idx}`);
      values.push(`%${params.city}%`);
      idx++;
    }
    if (params.zipCode) {
      conditions.push(`zip_code = $${idx}`);
      values.push(params.zipCode);
      idx++;
    }
    if (params.propertyType) {
      conditions.push(`property_type ILIKE $${idx}`);
      values.push(`%${params.propertyType}%`);
      idx++;
    }
    if (params.propertyHeight) {
      conditions.push(`property_height ILIKE $${idx}`);
      values.push(`%${params.propertyHeight}%`);
      idx++;
    }
    if (params.sourceType) {
      conditions.push(`source_type = $${idx}`);
      values.push(params.sourceType);
      idx++;
    }
    if (params.unitCountMin) {
      conditions.push(`unit_count >= $${idx}`);
      values.push(params.unitCountMin);
      idx++;
    }
    if (params.unitCountMax) {
      conditions.push(`unit_count <= $${idx}`);
      values.push(params.unitCountMax);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 50;

    const result = await this.pool.query(
      `SELECT * FROM data_library_files ${where} ORDER BY uploaded_at DESC LIMIT ${limit}`,
      values
    );

    return result.rows;
  }

  async getFile(id: number): Promise<DataLibraryFile | null> {
    const result = await this.pool.query(`SELECT * FROM data_library_files WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async updateFile(id: number, updates: Partial<DataLibraryFile>): Promise<DataLibraryFile | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowedFields = ['city', 'zip_code', 'property_type', 'property_height', 'year_built', 'unit_count', 'source_type', 'tags'];

    for (const field of allowedFields) {
      const camelKey = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if ((updates as any)[camelKey] !== undefined || (updates as any)[field] !== undefined) {
        fields.push(`${field} = $${idx}`);
        const val = (updates as any)[camelKey] ?? (updates as any)[field];
        values.push(field === 'tags' ? JSON.stringify(val) : val);
        idx++;
      }
    }

    if (fields.length === 0) return this.getFile(id);

    values.push(id);
    const result = await this.pool.query(
      `UPDATE data_library_files SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async deleteFile(id: number): Promise<void> {
    const file = await this.getFile(id);
    if (file && fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }
    await this.pool.query(`DELETE FROM data_library_files WHERE id = $1`, [id]);
  }

  async findComparables(params: { city?: string; propertyType?: string; unitCount?: number; propertyHeight?: string }): Promise<DataLibraryFile[]> {
    const conditions: string[] = ['parsing_status = \'complete\''];
    const values: any[] = [];
    let idx = 1;

    if (params.city) {
      conditions.push(`city ILIKE $${idx}`);
      values.push(`%${params.city}%`);
      idx++;
    }
    if (params.propertyType) {
      conditions.push(`property_type ILIKE $${idx}`);
      values.push(`%${params.propertyType}%`);
      idx++;
    }

    const result = await this.pool.query(
      `SELECT * FROM data_library_files WHERE ${conditions.join(' AND ')} ORDER BY uploaded_at DESC LIMIT 20`,
      values
    );

    if (params.unitCount && params.unitCount > 0) {
      result.rows.sort((a: any, b: any) => {
        const diffA = Math.abs((a.unit_count || 0) - params.unitCount!);
        const diffB = Math.abs((b.unit_count || 0) - params.unitCount!);
        return diffA - diffB;
      });
    }

    return result.rows.slice(0, 10);
  }
}
