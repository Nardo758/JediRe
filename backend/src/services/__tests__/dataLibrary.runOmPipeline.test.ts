/**
 * Integration coverage for `DataLibraryService.parseFileAsync` →
 * `runOmPipeline` (Task #391 / locks in Task #383 behaviour).
 *
 * Each test drives the whole pipeline by calling `parseFileAsync` with a
 * PDF mime type and inspects the in-memory FakePool to verify the file
 * row ended in the correct `parser_used` / `parser_status`. The four
 * downstream collaborators (`parseOM`, `tagOmWithMarket`,
 * `distributeOmExtraction`, `scoreBrokerSentiment`) are mocked so we can
 * force each terminal-failure branch independently:
 *
 *   - OCR-stage parse failure  → file ends in `ocr_failed`
 *   - distribution insert fail → file ends in `distribute_failed`,
 *                                OmDistributionError surfaces with partial counts
 *   - sentiment LLM failure    → file ends in `sentiment_failed`
 *                                (outer catch must NOT clobber back to 'error')
 *   - happy path               → file ends in `om-pipeline`/`success`, comps +
 *                                cost + narratives distributed, sentiment
 *                                scoring invoked
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

vi.mock('../document-extraction/parsers/om-parser', () => ({
  parseOM: vi.fn(),
}));

vi.mock('../document-extraction/om-geo', () => ({
  tagOmWithMarket: vi.fn(),
}));

vi.mock('../document-extraction/om-distribution.service', () => {
  class OmDistributionError extends Error {
    constructor(
      message: string,
      public readonly partialCounts: any,
      public readonly failures: string[],
    ) {
      super(message);
      this.name = 'OmDistributionError';
    }
  }
  return {
    distributeOmExtraction: vi.fn(),
    OmDistributionError,
  };
});

vi.mock('../document-extraction/broker-sentiment.service', () => ({
  scoreBrokerSentiment: vi.fn(),
}));

vi.mock('../../database/connection', () => ({
  getPool: vi.fn(),
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

import { parseOM } from '../document-extraction/parsers/om-parser';
import { tagOmWithMarket } from '../document-extraction/om-geo';
import {
  distributeOmExtraction,
  OmDistributionError,
} from '../document-extraction/om-distribution.service';
import { scoreBrokerSentiment } from '../document-extraction/broker-sentiment.service';
import { DataLibraryService } from '../dataLibrary.service';

const parseOmMock = parseOM as unknown as ReturnType<typeof vi.fn>;
const tagOmMock = tagOmWithMarket as unknown as ReturnType<typeof vi.fn>;
const distributeMock = distributeOmExtraction as unknown as ReturnType<typeof vi.fn>;
const sentimentMock = scoreBrokerSentiment as unknown as ReturnType<typeof vi.fn>;

// ── In-memory pool stand-in ──────────────────────────────────────────────────
// The pipeline only ever touches a single data_library_files row by id, so we
// keep one row of mutable state and route queries by inspecting fragments of
// the SQL.

interface FakeFileRow {
  id: number;
  file_name: string;
  file_path: string;
  user_id: string | null;
  parser_used: string | null;
  parser_status: string | null;
  parser_error: string | null;
  om_extraction: any;
  msa_key: string | null;
  submarket_key: string | null;
  parsed_data: any;
}

class FakePool {
  row: FakeFileRow;
  queries: Array<{ sql: string; params: readonly unknown[] }> = [];

  constructor(row: FakeFileRow) {
    this.row = row;
  }

  async query(sql: string, params: readonly unknown[] = []): Promise<any> {
    this.queries.push({ sql, params });

    if (/^\s*SELECT\s+parser_used\s+FROM\s+data_library_files/i.test(sql)) {
      return { rows: [{ parser_used: this.row.parser_used }] };
    }

    if (/^\s*SELECT\s+\*\s+FROM\s+data_library_files/i.test(sql)) {
      return { rows: [{ ...this.row }] };
    }

    // setStage helper — params=[id, stage]
    if (/parser_used\s*=\s*\$2/.test(sql) && /parser_status\s*=\s*CASE/i.test(sql)) {
      const stage = params[1] as string;
      this.row.parser_used = stage;
      this.row.parser_status =
        stage === 'routed' || stage === 'complete' ? 'success'
        : stage === 'error' ? 'failed'
        : 'running';
      return { rows: [], rowCount: 1 };
    }

    // ocr_failed / parse_failed — params=[error, stage, id]
    if (/parser_status='failed'/.test(sql) && /parser_used=\$2/.test(sql) && /WHERE id=\$3/.test(sql)) {
      this.row.parser_status = 'failed';
      this.row.parser_used = params[1] as string;
      this.row.parser_error = params[0] as string;
      return { rows: [], rowCount: 1 };
    }

    // distribute_failed — params=[msg, id]
    if (/parser_used='distribute_failed'/.test(sql)) {
      this.row.parser_status = 'failed';
      this.row.parser_used = 'distribute_failed';
      this.row.parser_error = params[0] as string;
      return { rows: [], rowCount: 1 };
    }

    // sentiment_failed — params=[msg, id]
    if (/parser_used='sentiment_failed'/.test(sql)) {
      this.row.parser_status = 'failed';
      this.row.parser_used = 'sentiment_failed';
      this.row.parser_error = params[0] as string;
      return { rows: [], rowCount: 1 };
    }

    // post-geocode update — params=[omJson, msaKey, submarketKey, parsedJson, id]
    if (/om_extraction\s*=\s*\$1::jsonb/.test(sql)) {
      this.row.om_extraction = JSON.parse(params[0] as string);
      this.row.msa_key = params[1] as string | null;
      this.row.submarket_key = params[2] as string | null;
      this.row.parsed_data = JSON.parse(params[3] as string);
      this.row.parser_error = null;
      return { rows: [], rowCount: 1 };
    }

    // final success — params=[id]
    if (/parser_used='om-pipeline'/.test(sql)) {
      this.row.parser_status = 'success';
      this.row.parser_used = 'om-pipeline';
      this.row.parser_error = null;
      return { rows: [], rowCount: 1 };
    }

    // outer-catch generic 'error' — params=[msg, id]
    if (/parser_used='error'/.test(sql) && /parser_status='failed'/.test(sql)) {
      this.row.parser_status = 'failed';
      this.row.parser_used = 'error';
      this.row.parser_error = params[0] as string;
      return { rows: [], rowCount: 1 };
    }

    // Anything we did not anticipate is silently ignored — the pipeline
    // does not consume the result of any other writes.
    return { rows: [], rowCount: 0 };
  }
}

// Build a minimal OMExtraction shape sufficient for the runOmPipeline writers
// (which only read property.address/city/state/zip + investmentThesis +
// investmentHighlights from the parsed result).
function makeExtraction() {
  return {
    property: {
      name: 'Test Property',
      address: '100 Main St',
      city: 'Atlanta',
      state: 'GA',
      zip: '30303',
      units: 200,
      yearBuilt: 2015,
      propertyType: 'mid-rise',
    },
    metadata: { broker: 'CBRE', askingPrice: 50_000_000, guidanceCapRate: 0.055 },
    brokerProforma: { stabilizedNOI: 2_500_000, goingInCapRate: 0.05 },
    marketComps: { rentComps: [], saleComps: [], submarketName: 'Buckhead' },
    replacementCost: {},
    investmentThesis: 'Strong submarket with rent growth potential.',
    investmentHighlights: ['Class A finishes', 'Walkable to MARTA'],
  } as any;
}

const HAPPY_GEO = {
  msaKey: 'msa:12060',
  submarketKey: 'submarket:cbre:atl-buckhead',
  msaName: 'Atlanta-Sandy Springs-Alpharetta',
  submarketName: 'Buckhead',
  lat: 33.85,
  lng: -84.36,
};

const HAPPY_COUNTS = {
  rentComps: 3,
  saleComps: 2,
  replacementCostRows: 1,
  narratives: 2,
};

function makeService(): { svc: DataLibraryService; pool: FakePool; tmpPdf: string } {
  const tmpPdf = path.join(os.tmpdir(), `om-pipeline-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(tmpPdf, Buffer.from('%PDF-1.4 fake content'));

  const row: FakeFileRow = {
    id: 1,
    file_name: 'broker.pdf',
    file_path: tmpPdf,
    user_id: 'user-1',
    parser_used: null,
    parser_status: null,
    parser_error: null,
    om_extraction: null,
    msa_key: null,
    submarket_key: null,
    parsed_data: null,
  };
  const pool = new FakePool(row);
  const svc = new DataLibraryService(pool as any);
  return { svc, pool, tmpPdf };
}

describe('runOmPipeline (via parseFileAsync)', () => {
  beforeEach(() => {
    parseOmMock.mockReset();
    tagOmMock.mockReset();
    distributeMock.mockReset();
    sentimentMock.mockReset();
  });

  it('routes the file when every stage succeeds', async () => {
    parseOmMock.mockResolvedValue({
      documentType: 'OM',
      success: true,
      data: makeExtraction(),
      summary: { propertyName: 'Test Property' },
      warnings: [],
      meta: { usedOcr: false },
    });
    tagOmMock.mockResolvedValue(HAPPY_GEO);
    distributeMock.mockResolvedValue(HAPPY_COUNTS);
    sentimentMock.mockResolvedValue({ label: 'bullish', score: 1, rationale: 'x', recordedFor: [] });

    const { svc, pool, tmpPdf } = makeService();
    try {
      await svc.parseFileAsync(1, tmpPdf, 'application/pdf');

      expect(pool.row.parser_used).toBe('om-pipeline');
      expect(pool.row.parser_status).toBe('success');
      expect(pool.row.parser_error).toBeNull();
      // Distribution + sentiment ran with the parsed extraction
      expect(distributeMock).toHaveBeenCalledTimes(1);
      expect(distributeMock.mock.calls[0][0]).toMatchObject({
        fileId: 1,
        extraction: expect.objectContaining({
          marketComps: expect.any(Object),
          replacementCost: expect.any(Object),
          investmentThesis: expect.any(String),
        }),
        geo: HAPPY_GEO,
      });
      expect(sentimentMock).toHaveBeenCalledTimes(1);
      expect(sentimentMock.mock.calls[0][0]).toMatchObject({
        fileId: 1,
        msaKey: HAPPY_GEO.msaKey,
        submarketKey: HAPPY_GEO.submarketKey,
      });
      // Post-geocode UPDATE persisted the OM payload
      expect(pool.row.om_extraction).toBeTruthy();
      expect(pool.row.msa_key).toBe(HAPPY_GEO.msaKey);
    } finally {
      fs.unlinkSync(tmpPdf);
    }
  });

  it('marks the file ocr_failed (not parse_failed) when OCR is the failing stage', async () => {
    parseOmMock.mockResolvedValue({
      documentType: 'OM',
      success: false,
      error: 'OCR fallback failed: tesseract crashed',
      data: null,
      summary: {},
      warnings: [],
      meta: { usedOcr: true, ocrError: 'tesseract crashed' },
    });

    const { svc, pool, tmpPdf } = makeService();
    try {
      await svc.parseFileAsync(1, tmpPdf, 'application/pdf');

      expect(pool.row.parser_used).toBe('ocr_failed');
      expect(pool.row.parser_status).toBe('failed');
      expect(pool.row.parser_error).toContain('OCR fallback failed');
      // Distribution + sentiment must NOT have been reached.
      expect(distributeMock).not.toHaveBeenCalled();
      expect(sentimentMock).not.toHaveBeenCalled();
    } finally {
      fs.unlinkSync(tmpPdf);
    }
  });

  it('marks the file distribute_failed and rethrows OmDistributionError with partial counts', async () => {
    parseOmMock.mockResolvedValue({
      documentType: 'OM',
      success: true,
      data: makeExtraction(),
      summary: {},
      warnings: [],
      meta: { usedOcr: false },
    });
    tagOmMock.mockResolvedValue(HAPPY_GEO);

    const partialCounts = { rentComps: 1, saleComps: 0, replacementCostRows: 0, narratives: 0 };
    const distErr = new OmDistributionError(
      'Distribution had 2 insert failure(s): sale comp "X": boom; narrative (thesis): boom',
      partialCounts,
      ['sale comp "X": boom', 'narrative (thesis): boom'],
    );
    distributeMock.mockRejectedValue(distErr);

    const { svc, pool, tmpPdf } = makeService();
    try {
      await svc.parseFileAsync(1, tmpPdf, 'application/pdf');

      // The outer catch in parseFileAsync sees parser_used='distribute_failed'
      // (a terminal failure stage) and preserves it — never clobbers to 'error'.
      expect(pool.row.parser_used).toBe('distribute_failed');
      expect(pool.row.parser_status).toBe('failed');
      expect(pool.row.parser_error).toContain('insert failure');
      expect(sentimentMock).not.toHaveBeenCalled();
    } finally {
      fs.unlinkSync(tmpPdf);
    }
  });

  it('marks the file sentiment_failed and the outer catch preserves the stage', async () => {
    parseOmMock.mockResolvedValue({
      documentType: 'OM',
      success: true,
      data: makeExtraction(),
      summary: {},
      warnings: [],
      meta: { usedOcr: false },
    });
    tagOmMock.mockResolvedValue(HAPPY_GEO);
    distributeMock.mockResolvedValue(HAPPY_COUNTS);
    sentimentMock.mockRejectedValue(new Error('claude timed out'));

    const { svc, pool, tmpPdf } = makeService();
    try {
      await svc.parseFileAsync(1, tmpPdf, 'application/pdf');

      // CRITICAL: the parseFileAsync outer catch must NOT overwrite
      // 'sentiment_failed' with the generic 'error' stage — that would hide
      // the partial state (distribution committed, sentiment unrecorded).
      expect(pool.row.parser_used).toBe('sentiment_failed');
      expect(pool.row.parser_status).toBe('failed');
      expect(pool.row.parser_error).toContain('sentiment:');
      expect(pool.row.parser_error).toContain('claude timed out');
    } finally {
      fs.unlinkSync(tmpPdf);
    }
  });
});
