/**
 * Unit coverage for the `meta.usedOcr` flag returned by `parseOM` (Task #391).
 *
 * `runOmPipeline` branches on this flag to distinguish OCR-stage failures
 * (`ocr_failed`) from text-layer parse failures (`parse_failed`). The flag
 * must therefore be correct on EVERY return path the parser can take:
 *
 *   1. text-layer extraction succeeds            → usedOcr = false
 *   2. text-layer empty, OCR succeeds, AI runs   → usedOcr = true
 *   3. text-layer empty, OCR throws              → usedOcr = true, ocrError set
 *   4. text-layer empty, OCR returns < 500 chars → usedOcr = true (insufficient)
 *   5. text-layer extraction itself throws       → usedOcr = false (outer catch)
 *
 * NOTE on pdf-parse mocking: the OM parser loads pdf-parse via a runtime
 * `require('pdf-parse')` inside its `requirePdfParse()` helper. Vitest's
 * `vi.mock` intercepts static `import` declarations but does NOT intercept
 * runtime `require` calls for node_modules, so we poison Node's `require.cache`
 * directly with a fake PDFParse class before any test runs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pdfTextMock = vi.fn();
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const p = require.resolve('pdf-parse');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (require.cache as any)[p] = {
    id: p, filename: p, loaded: true,
    exports: {
      PDFParse: class FakePDFParse {
        constructor(_opts: { data: Buffer }) { /* no-op */ }
        async getText(): Promise<{ text: string; total: number }> {
          return pdfTextMock();
        }
      },
    },
    children: [], paths: [], parent: null, require: require as any,
  };
}

vi.mock('../../ocr.service', () => ({
  ocrPdf: vi.fn(),
  OCR_MIN_TEXT_THRESHOLD: 50,
}));

vi.mock('../../../ai/aiService', () => ({
  jediAI: { generate: vi.fn() },
}));

vi.mock('../../../../database/connection', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('../../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ocrPdf } from '../../ocr.service';
import { jediAI } from '../../../ai/aiService';
import { parseOM } from '../om-parser';

const ocrMock = ocrPdf as unknown as ReturnType<typeof vi.fn>;
const aiGenerateMock = jediAI.generate as unknown as ReturnType<typeof vi.fn>;

// Minimal valid JSON for the AI extraction step. `normalizeExtraction`
// tolerates any subset of fields, so an empty object is fine — we just need
// JSON that parses.
const VALID_EXTRACTION_JSON = JSON.stringify({
  property: { name: 'Test Property', units: 100 },
});

const aiTextMessage = (text: string) => ({
  content: [{ type: 'text', text }],
});

describe('parseOM meta.usedOcr flag', () => {
  beforeEach(() => {
    pdfTextMock.mockReset();
    ocrMock.mockReset();
    aiGenerateMock.mockReset();
  });

  it('returns usedOcr=false when the embedded text layer is sufficient', async () => {
    pdfTextMock.mockResolvedValue({ text: 'x'.repeat(2000), total: 12 });
    aiGenerateMock.mockResolvedValue(aiTextMessage(VALID_EXTRACTION_JSON));

    const r = await parseOM(Buffer.from('dummy'), 'good.pdf', { userId: 'u1' });

    expect(r.success).toBe(true);
    expect(r.meta.usedOcr).toBe(false);
    expect(r.meta.ocrError).toBeUndefined();
    expect(ocrMock).not.toHaveBeenCalled();
  });

  it('returns usedOcr=true when the OCR fallback succeeds', async () => {
    pdfTextMock.mockResolvedValue({ text: '', total: 0 });
    ocrMock.mockResolvedValue({ text: 'y'.repeat(2000), pageCount: 8, durationMs: 1234 });
    aiGenerateMock.mockResolvedValue(aiTextMessage(VALID_EXTRACTION_JSON));

    const r = await parseOM(Buffer.from('dummy'), 'scanned.pdf', { userId: 'u1' });

    expect(r.success).toBe(true);
    expect(r.meta.usedOcr).toBe(true);
    expect(r.meta.ocrError).toBeUndefined();
    expect(ocrMock).toHaveBeenCalledTimes(1);
  });

  it('returns usedOcr=true with ocrError when the OCR fallback throws', async () => {
    pdfTextMock.mockResolvedValue({ text: '', total: 0 });
    ocrMock.mockRejectedValue(new Error('tesseract crashed'));

    const r = await parseOM(Buffer.from('dummy'), 'scanned.pdf', { userId: 'u1' });

    expect(r.success).toBe(false);
    expect(r.meta.usedOcr).toBe(true);
    expect(r.meta.ocrError).toBe('tesseract crashed');
    expect(r.error).toContain('OCR fallback failed');
    expect(aiGenerateMock).not.toHaveBeenCalled();
  });

  it('returns usedOcr=true when OCR succeeds but yields insufficient text', async () => {
    pdfTextMock.mockResolvedValue({ text: '', total: 0 });
    // > OCR_MIN_TEXT_THRESHOLD (50) so the OCR branch is taken, but < 500 so
    // the post-OCR length guard fails.
    ocrMock.mockResolvedValue({
      text: 'short but past threshold ' + 'a'.repeat(80),
      pageCount: 1,
      durationMs: 50,
    });

    const r = await parseOM(Buffer.from('dummy'), 'scanned.pdf', { userId: 'u1' });

    expect(r.success).toBe(false);
    expect(r.meta.usedOcr).toBe(true);
    expect(r.error).toContain('OCR returned insufficient text');
    expect(aiGenerateMock).not.toHaveBeenCalled();
  });

  it('returns usedOcr=false when text-layer extraction itself throws (outer catch)', async () => {
    pdfTextMock.mockRejectedValue(new Error('corrupt PDF'));

    const r = await parseOM(Buffer.from('dummy'), 'broken.pdf', { userId: 'u1' });

    expect(r.success).toBe(false);
    expect(r.meta.usedOcr).toBe(false);
    expect(r.meta.ocrError).toBeUndefined();
    expect(r.error).toContain('Failed to parse PDF');
    expect(ocrMock).not.toHaveBeenCalled();
  });
});
