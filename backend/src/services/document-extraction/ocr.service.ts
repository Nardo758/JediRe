/**
 * OCR Service — scanned-PDF fallback for the OM ingestion pipeline (Task #383)
 *
 * pdf-parse only extracts the embedded text layer; scanned/image-based broker
 * OMs return ~empty text. When that happens we render each page to PNG with
 * `pdftoppm` (poppler-utils, already on PATH in the Replit runtime) and run
 * tesseract.js OCR on each page. The result is a single concatenated text
 * string that flows back into the existing `parseOM()` pipeline unchanged.
 *
 * No silent fallbacks: if pdftoppm fails or the OCR engine cannot initialise
 * we throw with a clear message so the caller can surface "ocr_failed" status
 * to the operator. We never return a partial blank string.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createWorker, type Worker } from 'tesseract.js';
import { logger } from '../../utils/logger';

export const OCR_MIN_TEXT_THRESHOLD = 50;

export interface OcrResult {
  text: string;
  pageCount: number;
  durationMs: number;
  engine: 'tesseract.js';
}

function runPdftoppm(pdfPath: string, outPrefix: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('pdftoppm', [
      '-r', '200',
      '-png',
      pdfPath,
      outPrefix,
    ]);
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      if (code === 0) return resolve();
      reject(new Error(`pdftoppm exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function listPagePngs(dir: string, prefix: string): Promise<string[]> {
  const all = await fs.promises.readdir(dir);
  const base = path.basename(prefix);
  return all
    .filter(n => n.startsWith(base) && n.endsWith('.png'))
    .sort()
    .map(n => path.join(dir, n));
}

/**
 * Run OCR over a scanned PDF and return the concatenated text from every page.
 * Throws on any irrecoverable error — never returns silently empty.
 */
export async function ocrPdf(pdfPath: string): Promise<OcrResult> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`OCR source PDF not found: ${pdfPath}`);
  }
  const startedAt = Date.now();

  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'om-ocr-'));
  const prefix = path.join(workDir, 'page');

  let worker: Worker | null = null;
  try {
    await runPdftoppm(pdfPath, prefix);
    const pageFiles = await listPagePngs(workDir, prefix);
    if (pageFiles.length === 0) {
      throw new Error('pdftoppm produced no page images for OCR');
    }

    logger.info(`[ocr] starting tesseract for ${pageFiles.length} page(s)`, { pdfPath });
    worker = await createWorker('eng');

    const pageTexts: string[] = [];
    for (const file of pageFiles) {
      const { data } = await worker.recognize(file);
      pageTexts.push(data.text || '');
    }

    const text = pageTexts.join('\n\n').trim();
    if (text.length === 0) {
      throw new Error('OCR returned no text from any page');
    }

    return {
      text,
      pageCount: pageFiles.length,
      durationMs: Date.now() - startedAt,
      engine: 'tesseract.js',
    };
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch { /* worker termination errors are non-fatal */ }
    }
    try { await fs.promises.rm(workDir, { recursive: true, force: true }); } catch { /* tmp cleanup is best-effort */ }
  }
}
