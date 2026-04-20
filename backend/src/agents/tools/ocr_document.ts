/**
 * ocr_document
 *
 * Thin wrapper around the existing document extraction pipeline.
 * Writes base64-encoded PDF/image content to a temp file, runs the
 * extraction pipeline's text extraction, then cleans up.
 *
 * Returns extracted plain text. For offering memos and PDFs, this
 * provides the text that extract_deal_fields needs for field extraction.
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

  const ext = filename.includes('.') ? path.extname(filename) : extensionForMime(mimeType);
  const tmpPath = path.join(os.tmpdir(), `jedire-ocr-${crypto.randomBytes(8).toString('hex')}${ext}`);

  try {
    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(tmpPath, buffer);

    // For PDFs, use pdftotext (poppler-utils) if available for fast extraction
    if (mimeType === 'application/pdf') {
      try {
        const { execSync } = await import('child_process');
        const text = execSync(`pdftotext "${tmpPath}" -`, { timeout: 15000 })
          .toString('utf-8')
          .slice(0, MAX_PDF_CHARS);
        if (text.trim().length > 50) return text;
      } catch {
        // pdftotext not available — fall through to classifier
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
