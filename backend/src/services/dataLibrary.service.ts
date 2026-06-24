import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { getPool } from '../database/connection';
import { parseOM } from './document-extraction/parsers/om-parser';
import { tagOmWithMarket } from './document-extraction/om-geo';
import { distributeOmExtraction } from './document-extraction/om-distribution.service';
import { scoreBrokerSentiment } from './document-extraction/broker-sentiment.service';
import { isOmTerminalFailureStage } from './document-extraction/om-pipeline-stages';

export interface DataLibraryFile {
  id: number;
  user_id: string | null;
  deal_id: string | null;
  scope_id: string;
  redistribution_restricted: boolean;
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
  parser_status: string;
  parser_error: string | null;
  uploaded_at: Date;
}

export type DealStatus =
  | 'lead' | 'evaluating' | 'underwriting' | 'negotiating'
  | 'in_diligence' | 'closing' | 'owned' | 'closed' | 'portfolio' | 'archived';

export interface DealFolderManifestEntry {
  deal_id: string;
  deal_name: string;
  deal_status: DealStatus;
  file_count: number;
  total_size_bytes: number;
  last_upload_at: Date | null;
}

export interface DealFolderManifest {
  active: DealFolderManifestEntry[];
  archived: DealFolderManifestEntry[];
  unaffiliated_file_count: number;
  unaffiliated_total_size: number;
}

export interface DataLibraryUploadParams {
  userId?: string;
  dealId?: string;
  assetId?: string;
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
        (user_id, deal_id, asset_id, file_name, file_path, file_size, mime_type, city, zip_code, property_type, property_height, year_built, unit_count, source_type, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        params.userId || null,
        params.dealId || null,
        params.assetId || null,
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

  private async setStage(fileId: number, stage: string): Promise<void> {
    await this.pool.query(
      `UPDATE data_library_files
          SET parser_used = $2,
              parser_status = CASE
                WHEN $2 IN ('routed','complete') THEN 'success'
                WHEN $2 = 'error' THEN 'failed'
                ELSE 'running'
              END
        WHERE id = $1`,
      [fileId, stage],
    );
  }

  /**
   * Background processor for an uploaded file. Public so the routes layer can
   * invoke it on the Retry endpoint.
   */
  async parseFileAsync(fileId: number, filePath: string, mimeType: string): Promise<void> {
    await this.setStage(fileId, 'pending');

    try {
      if (mimeType === 'text/csv' || mimeType === 'application/csv') {
        await this.setStage(fileId, 'parsing');
        const parsedData = await this.parseCSV(filePath);
        await this.pool.query(
          `UPDATE data_library_files
              SET parser_status='success', parser_used='csv-parser', parsed_data=$1, parser_error=NULL
            WHERE id=$2`,
          [JSON.stringify(parsedData), fileId],
        );
        this.extractAndStoreCalibration(fileId, parsedData).catch(() => {});
        return;
      }

      if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          mimeType === 'application/vnd.ms-excel') {
        const parsedData = { type: 'excel', status: 'requires_xlsx_parser', fileName: path.basename(filePath) };
        await this.pool.query(
          `UPDATE data_library_files
              SET parser_status='success', parser_used='xlsx-stub', parsed_data=$1, parser_error=NULL
            WHERE id=$2`,
          [JSON.stringify(parsedData), fileId],
        );
        return;
      }

      if (mimeType === 'application/pdf') {
        await this.runOmPipeline(fileId, filePath);
        return;
      }

      const parsedData = { type: 'unknown', mimeType };
      await this.pool.query(
        `UPDATE data_library_files
            SET parser_status='success', parser_used='unknown-stub', parsed_data=$1
          WHERE id=$2`,
        [JSON.stringify(parsedData), fileId],
      );
    } catch (err: any) {
      // Preserve any specific terminal stage already written by runOmPipeline
      // so the operator sees WHERE the pipeline broke, not just a generic
      // 'error'. The set of preserved stages is the shared
      // OM_TERMINAL_FAILURE_STAGES constant — keep it as the single source
      // of truth across backend + frontend.
      const cur = await this.pool.query<{ parser_used: string | null }>(
        `SELECT parser_used FROM data_library_files WHERE id=$1`,
        [fileId],
      );
      const existing = cur.rows[0]?.parser_used ?? null;
      if (isOmTerminalFailureStage(existing)) {
        // Stage + parsing_errors are already set by the inner handler.
        return;
      }
      await this.pool.query(
        `UPDATE data_library_files
            SET parser_status='failed', parser_used='error', parser_error=$1
          WHERE id=$2`,
        [err?.message ?? 'unknown error', fileId],
      );
    }
  }

  /**
   * Broker OM ingestion → market intelligence pipeline (Task #383):
   *   1. parseOM (with OCR fallback for scanned PDFs)
   *   2. geocode address → MSA / submarket canonical keys
   *   3. distribute extracted comps + replacement cost + narratives
   *   4. score broker sentiment → market_sentiment_history
   * Each stage updates `parsing_stage` so the operator sees live progress.
   */
  private async runOmPipeline(fileId: number, filePath: string): Promise<void> {
    const file = await this.getFile(fileId);
    if (!file) throw new Error(`Data library file ${fileId} not found`);

    await this.setStage(fileId, 'parsing');
    const buffer = fs.readFileSync(filePath);
    // Stage callback so the operator sees `parsing_stage='ocr'` the moment the
    // OCR fallback engages — required by the Data Library status spec
    // (Pending / OCR / Parsing / Routed / Error).
    const onStageChange = async (stage: 'ocr' | 'analyzing'): Promise<void> => {
      await this.setStage(fileId, stage);
    };
    const result = await parseOM(
      buffer,
      file.file_name,
      file.user_id
        ? { userId: file.user_id, onStageChange }
        // Even without a userId we still want stage transitions for the UI.
        : { userId: '', onStageChange },
    );

    if (!result.success || !result.data) {
      // Distinguish OCR-stage failures from text-layer parse failures using the
      // explicit `meta.usedOcr` flag the parser sets — never infer from warnings.
      const usedOcr = result.meta?.usedOcr === true;
      await this.pool.query(
        `UPDATE data_library_files
            SET parser_status='failed', parser_used=$2, parser_error=$1
          WHERE id=$3`,
        [result.error ?? 'OM parse failed', usedOcr ? 'ocr_failed' : 'parse_failed', fileId],
      );
      return;
    }

    await this.setStage(fileId, 'geocoding');
    const geo = await tagOmWithMarket(this.pool, {
      address: result.data.property.address,
      city: result.data.property.city,
      state: result.data.property.state,
      zip: result.data.property.zip,
    });

    await this.pool.query(
      `UPDATE data_library_files
          SET om_extraction = $1::jsonb,
              msa_key = $2,
              submarket_key = $3,
              parsed_data = $4::jsonb,
              parser_error = NULL
        WHERE id = $5`,
      [
        JSON.stringify(result.data),
        geo.msaKey,
        geo.submarketKey,
        JSON.stringify({ type: 'pdf', kind: 'om', summary: result.summary, warnings: result.warnings }),
        fileId,
      ],
    );

    await this.setStage(fileId, 'distributing');
    let counts;
    try {
      counts = await distributeOmExtraction({
        pool: this.pool,
        fileId,
        extraction: result.data,
        geo,
      });
    } catch (err) {
      // Per Task #383 "no silent fallbacks": any insert failure during
      // distribution must mark the file with a terminal failure stage so the
      // operator sees that comps/cost/narratives are NOT all in.
      const msg = err instanceof Error ? err.message : String(err);
      await this.pool.query(
        `UPDATE data_library_files
            SET parser_status='failed', parser_used='distribute_failed',
                parser_error=$1
          WHERE id=$2`,
        [msg, fileId],
      );
      throw err;
    }

    // Sentiment scoring is part of the contract. If the LLM call fails we
    // mark the file as 'sentiment_failed' (a terminal stage that surfaces the
    // partial state) — Retry will re-run the whole pipeline.
    try {
      await scoreBrokerSentiment({
        thesis: result.data.investmentThesis,
        highlights: result.data.investmentHighlights,
        msaKey: geo.msaKey,
        submarketKey: geo.submarketKey,
        userId: file.user_id ?? null,
        fileId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.pool.query(
        `UPDATE data_library_files
            SET parser_status='failed', parser_used='sentiment_failed',
                parser_error=$1
          WHERE id=$2`,
        [`sentiment: ${msg}`, fileId],
      );
      throw err;
    }

    await this.pool.query(
      `UPDATE data_library_files
          SET parser_status='success', parser_used='om-pipeline',
              parser_error = NULL
        WHERE id=$1`,
      [fileId],
    );

    console.log(
      `[OM pipeline] file ${fileId} routed — rent_comps=${counts.rentComps} sale_comps=${counts.saleComps} ` +
      `replacement=${counts.replacementCostRows} narratives=${counts.narratives} ` +
      `msa=${geo.msaKey ?? 'unmapped'} submarket=${geo.submarketKey ?? 'unmapped'}`,
    );
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

  /**
   * Fetch a file by id. When `userId` is supplied, the row is returned ONLY
   * if it is owned by that user — used by REST routes to enforce row-level
   * authorization (closes the IDOR gap flagged in T383 architect review).
   * Internal callers (parseFileAsync, runOmPipeline) omit `userId` because
   * they already operate inside an authenticated/owner context.
   */
  async getFile(id: number, userId?: string): Promise<DataLibraryFile | null> {
    if (userId !== undefined) {
      const result = await this.pool.query(
        `SELECT * FROM data_library_files WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      return result.rows[0] || null;
    }
    const result = await this.pool.query(`SELECT * FROM data_library_files WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  /**
   * Atomically claim a file for re-parse. Returns the file row only when
   * the claim succeeded (file existed, was owned by `userId` if provided,
   * and was not already in flight). Returns null otherwise — the caller
   * maps that to 409 Conflict / 404 Not Found.
   *
   * Race-safe because the UPDATE...WHERE...RETURNING is a single statement;
   * concurrent retry calls cannot both observe `parsing_status != 'parsing'`
   * and both transition it to 'parsing'.
   */
  async claimForRetry(id: number, userId?: string): Promise<DataLibraryFile | null> {
    const ownerClause = userId !== undefined ? 'AND user_id = $2' : '';
    const params: (number | string)[] = userId !== undefined ? [id, userId] : [id];
    const result = await this.pool.query<DataLibraryFile>(
      `UPDATE data_library_files
          SET parser_status = 'running',
              parser_used   = 'pending',
              parser_error  = NULL
        WHERE id = $1 ${ownerClause}
          AND parser_status <> 'running'
        RETURNING *`,
      params,
    );
    return result.rows[0] || null;
  }

  async updateFile(
    id: number,
    updates: Partial<DataLibraryFile>,
    userId?: string,
  ): Promise<DataLibraryFile | null> {
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

    if (fields.length === 0) return this.getFile(id, userId);

    values.push(id);
    let where = `WHERE id = $${idx}`;
    if (userId !== undefined) {
      idx++;
      values.push(userId);
      where += ` AND user_id = $${idx}`;
    }
    const result = await this.pool.query(
      `UPDATE data_library_files SET ${fields.join(', ')} ${where} RETURNING *`,
      values,
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a file. When `userId` is supplied, the delete is scoped to rows
   * owned by that user — returns false if the file doesn't exist or is
   * owned by someone else. Closes the IDOR gap on DELETE /:id.
   */
  async deleteFile(id: number, userId?: string): Promise<boolean> {
    const file = await this.getFile(id, userId);
    if (!file) return false;
    if (fs.existsSync(file.file_path)) {
      try { fs.unlinkSync(file.file_path); } catch { /* best-effort */ }
    }
    const ownerClause = userId !== undefined ? 'AND user_id = $2' : '';
    const params: (number | string)[] = userId !== undefined ? [id, userId] : [id];
    const result = await this.pool.query(
      `DELETE FROM data_library_files WHERE id = $1 ${ownerClause}`,
      params,
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getFilesByDeal(
    dealId: string,
    options?: { includeRestricted?: boolean },
  ): Promise<DataLibraryFile[]> {
    const restrictedClause = options?.includeRestricted ? '' : 'AND redistribution_restricted = FALSE';
    const result = await this.pool.query<DataLibraryFile>(
      `SELECT * FROM data_library_files
        WHERE deal_id = $1 ${restrictedClause}
        ORDER BY uploaded_at DESC`,
      [dealId],
    );
    return result.rows;
  }

  async getDealFolderManifest(userId: string): Promise<DealFolderManifest> {
    const dealRows = await this.pool.query<{
      deal_id: string;
      deal_name: string;
      deal_status: DealStatus;
      file_count: string;
      total_size_bytes: string;
      last_upload_at: Date | null;
    }>(
      `SELECT
         d.id                               AS deal_id,
         d.name                             AS deal_name,
         d.status                           AS deal_status,
         COUNT(f.id)                        AS file_count,
         COALESCE(SUM(f.file_size), 0)      AS total_size_bytes,
         MAX(f.uploaded_at)                 AS last_upload_at
       FROM deals d
       LEFT JOIN data_library_files f
         ON f.deal_id = d.id
        AND f.redistribution_restricted = FALSE
       WHERE d.user_id = $1
       GROUP BY d.id, d.name, d.status
       ORDER BY d.status = 'archived' ASC, d.updated_at DESC`,
      [userId],
    );

    const unaffiliatedRow = await this.pool.query<{
      file_count: string;
      total_size: string;
    }>(
      `SELECT COUNT(*) AS file_count, COALESCE(SUM(file_size), 0) AS total_size
         FROM data_library_files
        WHERE user_id = $1
          AND deal_id IS NULL
          AND redistribution_restricted = FALSE`,
      [userId],
    );

    const toEntry = (row: typeof dealRows.rows[0]): DealFolderManifestEntry => ({
      deal_id: row.deal_id,
      deal_name: row.deal_name,
      deal_status: row.deal_status,
      file_count: parseInt(row.file_count, 10),
      total_size_bytes: parseInt(row.total_size_bytes, 10),
      last_upload_at: row.last_upload_at,
    });

    const active = dealRows.rows.filter(r => r.deal_status !== 'archived').map(toEntry);
    const archived = dealRows.rows.filter(r => r.deal_status === 'archived').map(toEntry);
    const ua = unaffiliatedRow.rows[0];

    return {
      active,
      archived,
      unaffiliated_file_count: parseInt(ua.file_count, 10),
      unaffiliated_total_size: parseInt(ua.total_size, 10),
    };
  }

  async getUnaffiliatedFiles(
    userId: string,
    options?: { includeRestricted?: boolean },
  ): Promise<DataLibraryFile[]> {
    const restrictedClause = options?.includeRestricted ? '' : 'AND redistribution_restricted = FALSE';
    const result = await this.pool.query<DataLibraryFile>(
      `SELECT * FROM data_library_files
        WHERE user_id = $1
          AND deal_id IS NULL
          ${restrictedClause}
        ORDER BY uploaded_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async findComparables(params: { city?: string; propertyType?: string; unitCount?: number; propertyHeight?: string }): Promise<DataLibraryFile[]> {
    const conditions: string[] = ['parser_status = \'success\''];
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

// ─────────────────────────────────────────────────────────────────────────────
// Singleton instance — capsule-intelligence and other consumers import this.
// Without this export, `dataLibraryService.findComparables(...)` was throwing
// `Cannot read properties of undefined (reading 'findComparables')`, which the
// catch block in pullDataLibraryComps swallowed silently — making the entire
// Data Library comp pull return 0 every time.
// ─────────────────────────────────────────────────────────────────────────────
export const dataLibraryService = new DataLibraryService(getPool());
