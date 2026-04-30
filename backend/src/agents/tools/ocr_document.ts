/**
 * ocr_document
 *
 * Extracts plain text from base64-encoded PDF attachments for deal intake.
 *
 * Design note — why we do NOT use services/document-extraction:
 *   The existing extraction pipeline (processDocument / processDealDocuments)
 *   is a *structured-format parser*: it classifies documents as T12, Rent
 *   Roll, Tax Bill, etc., runs schema-specific parsers, and writes structured
 *   rows into deal capsule tables.  It requires a dealId, an uploadedBy user,
 *   and a file path on disk — it is not a generic text extractor, and it
 *   has no handler for generic "offering memo" PDFs.
 *
 *   For email intake we need a lightweight text extractor that works on any
 *   PDF (offering memos, OM summaries, broker flyers).  pdftotext (poppler)
 *   is the right tool here: fast, reliable on text-layer PDFs, and produces
 *   the raw text the LLM extractor needs.  Once a deal is created and the
 *   user uploads documents formally, the structured pipeline runs as normal.
 *
 * Returns extracted plain text, or empty string on failure / unsupported type.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const PDF_MIME = 'application/pdf';
const EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);
// Image MIME types are recognised but cannot produce text without an OCR
// service (Tesseract / Google Vision). They return empty string so the
// caller degrades gracefully to email body text alone, rather than
// throwing an unsupported-type error.
const IMAGE_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/webp',
]);

const SUPPORTED_MIME_TYPES = new Set([
  PDF_MIME,
  ...EXCEL_MIMES,
  ...IMAGE_MIMES,
]);

const MAX_PDF_CHARS = 20000;
const MAX_EXCEL_CHARS = 20000;

/**
 * Extract plain text from a base64-encoded PDF, Excel, or image file.
 * - PDF:   pdftotext (poppler-utils) via execFileSync with arg array (no shell injection)
 * - Excel: xlsx package, reads all sheets in-memory → CSV text
 * - Image: returns empty string (no image-OCR service available at runtime)
 *
 * Returns empty string on unsupported type or extraction failure.
 */
export async function ocrDocument(
  base64Content: string,
  mimeType: string,
  filename: string
): Promise<string> {
  const normalizedMime = mimeType.toLowerCase();

  if (!SUPPORTED_MIME_TYPES.has(normalizedMime)) {
    logger.debug('ocr_document: unsupported MIME type, skipping', { mimeType, filename });
    return '';
  }

  // Image types: recognised for future extensibility, but return empty
  // string until an image-OCR service (e.g. Google Vision) is integrated.
  if (IMAGE_MIMES.has(normalizedMime)) {
    logger.debug('ocr_document: image attachment — no OCR service configured, skipping', { mimeType, filename });
    return '';
  }

  try {
    const buffer = Buffer.from(base64Content, 'base64');

    // ── Excel extraction via xlsx package ────────────────────────────────
    // Broker packages are frequently sent as .xlsx summaries. The xlsx package
    // reads sheets in-memory — no temp file or shell command needed.
    if (EXCEL_MIMES.has(normalizedMime)) {
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const lines: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
          if (csv.trim()) lines.push(`[Sheet: ${sheetName}]\n${csv}`);
        }
        const text = lines.join('\n\n').slice(0, MAX_EXCEL_CHARS);
        logger.debug('ocr_document: excel extracted', { filename, chars: text.length });
        return text;
      } catch (err) {
        logger.warn('ocr_document: excel extraction failed', { filename, err });
        return '';
      }
    }

    // ── PDF extraction via pdftotext ─────────────────────────────────────
    // Use execFileSync with an explicit argument array — never interpolate
    // user-supplied filenames into a shell command string.
    // Temp file uses a MIME-derived extension (never from user input).
    if (normalizedMime === PDF_MIME) {
      const ext = '.pdf';
      const tmpPath = path.join(os.tmpdir(), `jedire-ocr-${crypto.randomBytes(8).toString('hex')}${ext}`);
      try {
        fs.writeFileSync(tmpPath, buffer);
        const { execFileSync } = await import('child_process');
        const text = execFileSync('pdftotext', [tmpPath, '-'], { timeout: 15000 })
          .toString('utf-8')
          .slice(0, MAX_PDF_CHARS);
        if (text.trim().length > 50) {
          logger.debug('ocr_document: pdf extracted via pdftotext', { filename, chars: text.length });
          return text;
        }
      } catch {
        // pdftotext not available — fall through to return ''
      } finally {
        try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup errors */ }
      }
    }

    logger.debug('ocr_document: no text extractor succeeded for', { mimeType, filename });
    return '';
  } catch (err) {
    logger.warn('ocr_document: extraction failed', { filename, err });
    return '';
  }
}


export const ocrDocumentTool = {
  name: 'ocr_document',
  description: `Extract plain text from base64-encoded PDF attachments.
Tries pdftotext first, falls back to pdf-parse.
For generic documents — uses a simpler pipeline than document-extraction service.
Returns extracted text as string (empty if all extractors fail).`,
  inputSchema: z.object({
    content_base64: z.string().describe('Base64-encoded PDF content'),
    filename: z.string().optional().describe('Original filename for logging'),
    mime_type: z.string().optional().describe('MIME type (default: application/pdf)'),
  }),
  outputSchema: z.string(),
  execute: ocrDocument,
};
