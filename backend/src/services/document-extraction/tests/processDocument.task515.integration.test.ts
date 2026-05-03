/**
 * Task #515 — Integration test for the upload-completion alert surface.
 *
 * Exercises the real `processDocument()` pipeline end-to-end (classifier
 * → parser → merge) and asserts that the
 *
 *     "Rent roll extraction quality: ..."
 *
 * KPI line — emitted into ExtractionResult.warnings by rent-roll-parser.ts
 * (lines 765-774) — flows all the way into the final
 * `pipelineResult.alerts` array that the upload UI consumes (extraction-
 * pipeline.ts line 134).
 *
 * The DB-bound `routeExtractionResult` is mocked so this test does not
 * require a Postgres connection — but the classifier and parser run for
 * real, and the alerts merge in extraction-pipeline.ts is the actual
 * production code path. This locks down the warning→alert hand-off that
 * unit-level parser tests cannot cover on their own.
 */

import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as XLSX from 'xlsx';

// Mock the data-router so processDocument's switch path doesn't try to
// open a Postgres connection. The merge in extraction-pipeline.ts (line
// 134) is `[...alerts, ...routeResult.alerts, ...extractionResult.warnings]`
// — we keep routeResult.alerts empty to isolate the assertion to the
// parser-warnings hand-off.
vi.mock('../data-router', () => ({
  routeExtractionResult: vi.fn().mockResolvedValue({
    rowsInserted: 0,
    capsuleUpdated: false,
    libraryUpdated: false,
    proformaSeeded: false,
    crossValidationVariances: 0,
    alerts: [],
  }),
}));

// Import AFTER vi.mock so the mocked module is what extraction-pipeline.ts
// actually wires up at module-evaluation time.
import { processDocument } from '../extraction-pipeline';

type Cell = string | number | null;

function buildYardiSheetBuffer(rows: Cell[][], asOfText = 'As Of = 1/15/2025'): Buffer {
  const aoa: Cell[][] = [
    [asOfText, null, null, null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null, null, null, null],
    ['Unit', 'Unit Type', 'Sq Ft', 'Resident', 'Market', 'Charge', 'Amount',
     'Resident Deposit', 'Other Deposit', 'Move-In', 'Lease Expiration', 'Move-Out', 'Balance'],
    [null, null, null, null, 'Rent', 'Code', null, null, null, null, null, null, null],
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function occupiedRow(unit: string, leaseExpiration: string | null): Cell[] {
  return [unit, 'A1', 750, `Tenant ${unit}`, 1500, 'rent', 1450, null, null,
          '2024-06-01', leaseExpiration, null, 0];
}

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task515-pipeline-'));
});

afterAll(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

/**
 * Writes a buffer to a temp .xlsx file with a filename that the classifier's
 * filename matcher (classifyByFilename) recognizes as a rent roll, so we
 * deterministically route to parseRentRoll without depending on header
 * heuristics or AI fallback.
 */
function writeFixture(name: string, buf: Buffer): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

describe('Task #515 — processDocument upload alerts surface KPI line', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('OK coverage: pipelineResult.alerts contains "Rent roll extraction quality:" with "Coverage OK."', async () => {
    const buf = buildYardiSheetBuffer([
      occupiedRow('101', '2025-06-20'),
      occupiedRow('102', '2025-10-20'),
      occupiedRow('103', '2026-07-20'),
    ]);
    const filePath = writeFixture('rent_roll_ok.xlsx', buf);

    const result = await processDocument(
      filePath,
      'rent_roll_ok.xlsx',
      'test-deal-id',
      'test-user-id',
      'test-doc-id',
    );

    expect(result.success).toBe(true);
    expect(result.documentType).toBe('RENT_ROLL');
    const kpi = result.alerts.find(a => a.startsWith('Rent roll extraction quality:'));
    expect(kpi, `pipelineResult.alerts must include the KPI line. Got: ${JSON.stringify(result.alerts)}`).toBeDefined();
    expect(kpi).toContain('3 occupied units detected');
    expect(kpi).toContain('Lease expiration mapped: 3 of 3');
    expect(kpi).toContain('Effective rent mapped: 3 of 3');
    expect(kpi).toContain('Coverage OK.');
  });

  it('PARTIAL coverage: pipelineResult.alerts KPI line reports "Review recommended."', async () => {
    const buf = buildYardiSheetBuffer([
      occupiedRow('201', '2025-06-20'), // parsed
      occupiedRow('202', null),         // unknown
      occupiedRow('203', null),         // unknown
    ]);
    const filePath = writeFixture('rent_roll_partial.xlsx', buf);

    const result = await processDocument(
      filePath,
      'rent_roll_partial.xlsx',
      'test-deal-id',
      'test-user-id',
      'test-doc-id',
    );

    expect(result.success).toBe(true);
    const kpi = result.alerts.find(a => a.startsWith('Rent roll extraction quality:'));
    expect(kpi).toBeDefined();
    expect(kpi).toContain('Lease expiration mapped: 1 of 3');
    expect(kpi).toContain('Review recommended.');
  });

  it('FAILED coverage: pipelineResult.alerts KPI line reports 0/N mapped + "Review recommended."', async () => {
    const buf = buildYardiSheetBuffer([
      occupiedRow('301', null),
      occupiedRow('302', null),
    ]);
    const filePath = writeFixture('rent_roll_failed.xlsx', buf);

    const result = await processDocument(
      filePath,
      'rent_roll_failed.xlsx',
      'test-deal-id',
      'test-user-id',
      'test-doc-id',
    );

    expect(result.success).toBe(true);
    const kpi = result.alerts.find(a => a.startsWith('Rent roll extraction quality:'));
    expect(kpi).toBeDefined();
    expect(kpi).toContain('Lease expiration mapped: 0 of 2');
    expect(kpi).toContain('Review recommended.');
  });
});
