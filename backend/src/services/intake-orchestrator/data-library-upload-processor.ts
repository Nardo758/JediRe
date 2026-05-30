/**
 * Data Library Upload — document parsing step for the intake worker.
 *
 * When the intake worker picks up a job with source_type='data_library_upload',
 * it calls processDataLibraryUploadFile() before the standard enrichment chain
 * (municipal lookup, web search, etc.).  This function:
 *
 *   1. Fetches the data_library_files row (UUID id schema).
 *   2. Downloads the file from Cloudflare R2 via the S3-compatible API.
 *   3. Routes to the appropriate parser:
 *        PDF              → OM pipeline (parseOM)
 *        XLSX / CSV / XLS → classifyDocument → sync parser
 *   4. Updates data_library_files.parser_used / parser_status / parser_error.
 *
 * The function is intentionally non-fatal from the caller's perspective:
 * a parse failure updates parser_status to 'failed' but the intake_job
 * continues through the enrichment chain so the status chip can still
 * transition to complete/blocked rather than hanging in 'parsing'.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

// ── R2 client ────────────────────────────────────────────────────────────────

function buildR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error('R2_ACCOUNT_ID not configured');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });
}

async function downloadFromR2(storageKey: string, bucket: string): Promise<Buffer> {
  const s3  = buildR2Client();
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
  if (!res.Body) throw new Error('Empty response body from R2');
  const bytes = await (res.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray();
  return Buffer.from(bytes);
}

// ── parser_status helpers ─────────────────────────────────────────────────────

async function setParserStatus(
  fileId: string,
  parserUsed: string,
  status: 'running' | 'success' | 'failed',
  error?: string,
): Promise<void> {
  await query(
    `UPDATE data_library_files
        SET parser_used   = $2,
            parser_status = $3,
            parser_error  = $4
      WHERE id = $1`,
    [fileId, parserUsed, status, error ?? null],
  );
}

// ── Result type ───────────────────────────────────────────────────────────────

export interface DataLibraryParseResult {
  success:      boolean;
  documentType: string;
  parserUsed:   string;
  error?:       string;
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function processDataLibraryUploadFile(
  fileId:     string,
  sourceData: Record<string, unknown>,
): Promise<DataLibraryParseResult> {
  // ── Fetch file row ────────────────────────────────────────────────────────
  const fileRes = await query<{
    original_filename: string;
    mime_type:         string | null;
    storage_key:       string | null;
    storage_bucket:    string | null;
    document_type:     string | null;
    uploaded_by:       string | null;
  }>(
    `SELECT original_filename, mime_type, storage_key, storage_bucket,
            document_type, uploaded_by
       FROM data_library_files WHERE id = $1`,
    [fileId],
  );

  if (fileRes.rows.length === 0) {
    throw new Error(`[data-library-upload-processor] data_library_files row not found: file_id=${fileId}`);
  }

  const file        = fileRes.rows[0];
  const mimeType    = file.mime_type    ?? (sourceData.mime_type    as string | undefined) ?? '';
  const filename    = file.original_filename;
  const docType     = file.document_type ?? (sourceData.document_type as string | undefined) ?? 'OTHER';
  const storageKey  = file.storage_key  ?? (sourceData.storage_key  as string | undefined) ?? '';
  const bucket      = file.storage_bucket ?? process.env.R2_BUCKET_NAME ?? '';

  if (!storageKey) {
    throw new Error(`[data-library-upload-processor] no storage_key for file_id=${fileId}`);
  }

  // ── Download from R2 ──────────────────────────────────────────────────────
  let buffer: Buffer;
  try {
    buffer = await downloadFromR2(storageKey, bucket);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setParserStatus(fileId, 'download_failed', 'failed', msg);
    logger.warn(`[data-library-upload-processor] R2 download failed file_id=${fileId}: ${msg}`);
    return { success: false, documentType: docType, parserUsed: 'download_failed', error: msg };
  }

  // ── Route by MIME type ────────────────────────────────────────────────────
  const isPdf =
    mimeType === 'application/pdf' ||
    /\.pdf$/i.test(filename);

  if (isPdf) {
    return parsePdfFile(fileId, buffer, filename, file.uploaded_by ?? '');
  }

  const isSpreadsheet =
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'text/csv' ||
    mimeType === 'application/csv' ||
    /\.(xlsx?|csv)$/i.test(filename);

  if (isSpreadsheet) {
    return parseSpreadsheetFile(fileId, buffer, filename, docType);
  }

  const msg = `Unsupported file type: ${mimeType || 'unknown'}`;
  await setParserStatus(fileId, 'unsupported', 'failed', msg);
  return { success: false, documentType: docType, parserUsed: 'unsupported', error: msg };
}

// ── PDF → OM pipeline ─────────────────────────────────────────────────────────

async function parsePdfFile(
  fileId:     string,
  buffer:     Buffer,
  filename:   string,
  uploadedBy: string,
): Promise<DataLibraryParseResult> {
  await setParserStatus(fileId, 'parsing', 'running');

  try {
    const { parseOM } = await import('../document-extraction/parsers/om-parser');

    const onStageChange = async (stage: 'ocr' | 'analyzing'): Promise<void> => {
      await setParserStatus(fileId, stage, 'running');
    };

    const result = await parseOM(buffer, filename, {
      userId:        uploadedBy || 'intake-worker',
      onStageChange,
    });

    if (!result.success || !result.data) {
      const usedOcr = result.meta?.usedOcr === true;
      const stage   = usedOcr ? 'ocr_failed' : 'parse_failed';
      const msg     = result.error ?? 'OM parse failed';
      await setParserStatus(fileId, stage, 'failed', msg);
      return { success: false, documentType: 'OM', parserUsed: stage, error: msg };
    }

    await setParserStatus(fileId, 'om-pipeline', 'success');
    logger.info(`[data-library-upload-processor] PDF parsed OK file_id=${fileId} units=${result.data.property?.units ?? '?'}`);
    return { success: true, documentType: 'OM', parserUsed: 'om-pipeline' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setParserStatus(fileId, 'parse_failed', 'failed', msg);
    return { success: false, documentType: 'OM', parserUsed: 'parse_failed', error: msg };
  }
}

// ── XLSX / CSV → sync spreadsheet parsers ────────────────────────────────────

async function parseSpreadsheetFile(
  fileId:      string,
  buffer:      Buffer,
  filename:    string,
  hintDocType: string,
): Promise<DataLibraryParseResult> {
  await setParserStatus(fileId, 'classifying', 'running');

  // Classify from content; fall back to user-supplied document_type
  let resolvedType = hintDocType;
  try {
    const { classifyDocument } = await import('../document-extraction/classifier');
    const classification = await classifyDocument(buffer, filename);
    if (classification.documentType !== 'UNKNOWN') resolvedType = classification.documentType;
  } catch (_) {
    // Non-fatal: proceed with hintDocType
  }

  const parserUsed = `${resolvedType.toLowerCase()}-extractor`;
  await setParserStatus(fileId, parserUsed, 'running');

  try {
    let result: { success: boolean; error?: string } | null = null;

    // ── Registry-driven vendor dispatch ────────────────────────────────────
    // If the resolved document type belongs to a vendor that has registered a
    // vendorParser function, call it directly. This means adding a new vendor
    // requires ZERO changes to this switch — only a new VendorDeclaration with
    // a `vendorParser` implementation.
    try {
      const { vendorRegistry } = await import('../document-extraction/vendor-registry');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vendorEntry = vendorRegistry.getVendorByDocType(resolvedType as any);
      if (vendorEntry?.fileType.vendorParser) {
        result = await vendorEntry.fileType.vendorParser(buffer, { fileId });
      }
    } catch (vendorErr) {
      logger.warn(`[data-library-upload-processor] vendor dispatch failed for type=${resolvedType}`, { error: vendorErr });
      // Fall through to the switch below
    }

    if (!result) switch (resolvedType) {
      case 'T12': {
        const { parseT12 } = await import('../document-extraction/parsers/t12-parser');
        result = parseT12(buffer, filename);
        break;
      }
      case 'RENT_ROLL': {
        const { parseRentRoll } = await import('../document-extraction/parsers/rent-roll-parser');
        result = parseRentRoll(buffer, filename);
        break;
      }
      case 'TAX_BILL': {
        const { parseTaxBill } = await import('../document-extraction/parsers/tax-bill-parser');
        result = parseTaxBill(buffer, filename);
        break;
      }
      case 'AGED_RECEIVABLES': {
        const { parseAgedReceivables } = await import('../document-extraction/parsers/aged-receivables-parser');
        result = parseAgedReceivables(buffer, filename);
        break;
      }
      case 'BOX_SCORE': {
        const { parseBoxScore } = await import('../document-extraction/parsers/box-score-parser');
        result = parseBoxScore(buffer, filename);
        break;
      }
      case 'CONCESSION_BURNOFF': {
        const { parseConcessionBurnoff } = await import('../document-extraction/parsers/concession-burnoff-parser');
        result = parseConcessionBurnoff(buffer, filename);
        break;
      }
      case 'T30_LTO': {
        const { parseLTO } = await import('../document-extraction/parsers/lto-parser');
        result = parseLTO(buffer, filename);
        break;
      }
      case 'LEASING_STATS': {
        const { parseLeasingStats } = await import('../document-extraction/parsers/leasing-stats-parser');
        result = parseLeasingStats(buffer, filename);
        break;
      }
      default:
        result = { success: false, error: `No spreadsheet parser for type: ${resolvedType}` };
    }

    if (result?.success) {
      await setParserStatus(fileId, parserUsed, 'success');
      logger.info(`[data-library-upload-processor] spreadsheet parsed OK file_id=${fileId} type=${resolvedType}`);
      return { success: true, documentType: resolvedType, parserUsed };
    }

    const errMsg = result?.error ?? 'Parse returned no data';
    await setParserStatus(fileId, parserUsed, 'failed', errMsg);
    return { success: false, documentType: resolvedType, parserUsed, error: errMsg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setParserStatus(fileId, parserUsed, 'failed', msg);
    return { success: false, documentType: resolvedType, parserUsed, error: msg };
  }
}
