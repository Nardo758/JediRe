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

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/tiff',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

const MAX_PDF_CHARS = 20000;

/**
 * Extract plain text from a base64-encoded PDF, image, or Excel file.
 * Returns empty string if extraction fails or MIME type is unsupported.
 */
export async function ocrDocument(
  base64Content: string,
  mimeType: string,
  filename: string
): Promise<string> {
  if (!SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase())) {
    logger.debug('ocr_document: unsupported MIME type, skipping', { mimeType, filename });
    return '';
  }

  // Always derive the temp-file extension from the whitelisted MIME map,
  // never from the (potentially attacker-controlled) attachment filename.
  const ext = extensionForMime(mimeType);
  const tmpPath = path.join(os.tmpdir(), `jedire-ocr-${crypto.randomBytes(8).toString('hex')}${ext}`);

  try {
    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(tmpPath, buffer);

    // For PDFs, use pdftotext (poppler-utils) if available for fast extraction.
    // Use execFileSync with an explicit argument array — never interpolate
    // user-supplied filenames into a shell command string.
    if (mimeType === 'application/pdf') {
      try {
        const { execFileSync } = await import('child_process');
        // Args: input file, output file ('-' = stdout)
        const text = execFileSync('pdftotext', [tmpPath, '-'], { timeout: 15000 })
          .toString('utf-8')
          .slice(0, MAX_PDF_CHARS);
        if (text.trim().length > 50) return text;
      } catch {
        // pdftotext not available — fall through
      }
    }

    // pdftotext not available — no fallback text extractor.
    // Return empty string so the caller degrades gracefully on email body alone.
    logger.debug('ocr_document: no text extractor available for', { mimeType, filename });
    return '';
  } catch (err) {
    logger.warn('ocr_document: extraction failed', { filename, err });
    return '';
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup errors */ }
  }
}

function extensionForMime(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/tiff': '.tiff',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls',
  };
  return map[mime] ?? '.bin';
}
