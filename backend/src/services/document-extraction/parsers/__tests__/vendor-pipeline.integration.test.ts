/**
 * Vendor Market Data Pipeline — End-to-End Integration Tests
 *
 * Exercises every layer of the vendor market data ingestion path:
 *
 *   XLSX buffer → parse → vendor table write → historical_observations write
 *
 * Four test suites with increasing scope:
 *
 *   Suite 1 — Parse layer (no DB)
 *     Validates that parseYardiRentSurvey correctly extracts rows from a
 *     structurally valid XLSX buffer. No DB interaction.
 *
 *   Suite 2 — Dual-write layer (real DB, transaction rollback)
 *     Calls writeYardiRentSurveyRows + upsertYardiHistoricalObservations via a
 *     transactional PoolClient. Asserts rows are present in both tables within
 *     the transaction, then rolls back — zero persistent test data, fully
 *     idempotent, validates actual schema compatibility.
 *
 *   Suite 3 — Registry dispatch layer (real DB, sentinel cleanup)
 *     Calls the vendorParser registered in the VendorRegistry for
 *     YARDI_MATRIX_RENT_SURVEY. This exercises the zero-switch-change
 *     dispatch path in data-library-upload-processor.ts. Uses a sentinel
 *     submarket name so afterAll can clean up rows.
 *
 *   Suite 4 — Processor layer (real DB + R2 stub)
 *     Calls processDataLibraryUploadFile() end-to-end: real data_library_files
 *     row in DB, real classification + dispatch + dual-write, but with R2
 *     download stubbed via vi.mock('@aws-sdk/client-s3') to return our synthetic
 *     XLSX buffer. This is the true E2E boundary — the same entry point that
 *     the intake worker calls in production.
 *
 * Adding a future vendor:
 *   1. Write a `makeVendorBuffer()` helper for the new vendor's XLSX shape.
 *   2. Copy Suite 2 + 3 patterns, substituting the new parse/write functions
 *      and the new `documentType` key. Zero framework changes required.
 *
 * Constraints met:
 *   - Real DB connection (no mocked query) — validates actual schema compatibility.
 *   - Idempotent — Suite 2 uses transaction rollback; Suites 3 + 4 use sentinel
 *     cleanup in afterAll; all are safe to re-run.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';

// ── R2 mock ───────────────────────────────────────────────────────────────────
//
// vi.mock is hoisted before imports by vitest's transform. The factory function
// closes over `r2MockBuffer` (a module-scope let) and reads its current value
// at call time — not at parse time — so `beforeAll` can set it before the test
// runs and the mock will return the correct buffer.

let r2MockBuffer: Buffer | null = null;

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockImplementation(async () => {
      if (!r2MockBuffer) throw new Error('r2MockBuffer not set by test beforeAll');
      const bytes = r2MockBuffer;
      return {
        Body: {
          transformToByteArray: async (): Promise<Uint8Array> => new Uint8Array(bytes),
        },
      };
    }),
  })),
  GetObjectCommand: vi.fn().mockImplementation(() => ({})),
}));

import { query, getClient } from '../../../../database/connection';
import {
  parseYardiRentSurvey,
  writeYardiRentSurveyRows,
  upsertYardiHistoricalObservations,
  type QueryFn,
} from '../yardi-matrix-parser';
import { vendorRegistry } from '../../vendor-registry';

// ── Sentinel values (Suite 3 only) ───────────────────────────────────────────
//
// The registry-dispatch vendorParser uses the global `query` function (not a
// transactional client), so we use a unique sentinel submarket name to identify
// and delete test rows in afterAll.

const RUN_ID      = `ci-${Date.now()}`;
const SENTINEL_SM = `__vendor-pipeline-integration-test-${RUN_ID}__`;

// Suite 4 — processor layer; separate sentinel so assertions don't mix with Suite 3
const PROC_SM      = `__proc-integration-test-${RUN_ID}__`;
const PROC_FILE_ID = randomUUID();

// ── XLSX fixture helpers ──────────────────────────────────────────────────────

/**
 * Builds a structurally valid Yardi Matrix Rent Survey XLSX buffer.
 *
 * Column names match the canonical Yardi Matrix export format that
 * `parseYardiRentSurvey` is designed to read. One data row per call.
 */
function makeYardiRentSurveyBuffer(
  submarket = 'Test Buckhead',
  periodDate = '2025-03-31',
): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    [
      'Geography',
      'Market',
      'State',
      'As-Of Date',
      'Avg Asking Rent',
      'Avg Eff Rent',
      'Occ Rate',
      'Concession Value ($ Per Month)',
      'Total Inventory',
      'New Supply',
      'Net Absorption',
      'Yardi Matrix ID',
    ],
    [
      submarket,
      'Atlanta',
      'GA',
      periodDate,
      '2100',
      '2050',
      '94.5',
      '50',
      '5000',
      '100',
      '80',
      'ATL-TEST-001',
    ],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ── Cleanup for Suite 3 ───────────────────────────────────────────────────────
//
// Run after all tests; cleans up rows written by the registry-dispatch test
// using the sentinel submarket name.

afterAll(async () => {
  for (const sm of [SENTINEL_SM, PROC_SM]) {
    try {
      await query(`DELETE FROM yardi_matrix_rent_survey WHERE submarket = $1`, [sm]);
    } catch (_) {}
    try {
      await query(
        `DELETE FROM historical_observations
           WHERE vendor_source = 'yardi_matrix'
             AND market_survey_snapshot->>'submarket' = $1`,
        [sm],
      );
    } catch (_) {}
  }
  // Clean up the data_library_files row created by Suite 4
  try {
    await query(`DELETE FROM data_library_files WHERE id = $1`, [PROC_FILE_ID]);
  } catch (_) {}
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: Parse layer (no DB)
// ─────────────────────────────────────────────────────────────────────────────

describe('Suite 1 — Parse layer (parseYardiRentSurvey, no DB)', () => {
  it('extracts rows from a valid Yardi Matrix Rent Survey XLSX buffer', () => {
    const buffer = makeYardiRentSurveyBuffer();
    const result = parseYardiRentSurvey(buffer, { fileId: 'test-file-id' });

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0];
    expect(row.submarket).toBe('Test Buckhead');
    expect(row.period_date).toBe('2025-03-31');
    expect(row.avg_asking_rent).toBe(2100);
    expect(row.avg_effective_rent).toBe(2050);
    expect(row.occupancy_rate).toBe(94.5);
    expect(row.total_inventory_units).toBe(5000);
    expect(row.new_supply_units).toBe(100);
    expect(row.net_absorption_units).toBe(80);
    expect(row.source).toBe('yardi_matrix');
    expect(row.file_id).toBe('test-file-id');
    expect(row.yardi_matrix_id).toBe('ATL-TEST-001');
    expect(typeof row.id).toBe('string');
    expect(row.id).toHaveLength(36); // UUID format
  });

  it('returns zero rows for a buffer with no valid submarket / as-of date', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['NotAGeography', 'NotADate'],
      ['some value', 'another value'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const result = parseYardiRentSurvey(buf);
    expect(result.rows).toHaveLength(0);
  });

  it('propagates dealId and fileId into parsed rows', () => {
    const buffer = makeYardiRentSurveyBuffer();
    const result = parseYardiRentSurvey(buffer, {
      dealId: 'deal-123',
      fileId: 'file-456',
    });
    expect(result.rows[0].deal_id).toBe('deal-123');
    expect(result.rows[0].file_id).toBe('file-456');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — Dual-write layer (real DB, transaction rollback)
// ─────────────────────────────────────────────────────────────────────────────
//
// Uses a real PostgreSQL PoolClient in a BEGIN/ROLLBACK block.
// Assertions run within the transaction so they see the uncommitted rows.
// ROLLBACK guarantees zero persistent test data.

describe('Suite 2 — Dual-write layer (real DB, transaction rollback)', () => {
  it('writes to yardi_matrix_rent_survey (vendor table) and rolls back cleanly', async () => {
    const buffer = makeYardiRentSurveyBuffer('Buckhead Tx Test', '2025-06-30');
    const parsed  = parseYardiRentSurvey(buffer, { fileId: 'suite2-vendor-table' });
    expect(parsed.rows).toHaveLength(1);

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const txQuery: QueryFn = (sql, params) =>
        client.query(sql, params as unknown[]) as Promise<unknown>;

      const writeResult = await writeYardiRentSurveyRows(txQuery, parsed.rows);
      expect(writeResult.inserted).toBe(1);
      expect(writeResult.errors).toBe(0);

      // Verify the row is present within the transaction
      const res = await client.query<{
        submarket:        string;
        period_date:      string;
        avg_asking_rent:  string;
        occupancy_rate:   string;
        source:           string;
      }>(
        `SELECT submarket, period_date::text, avg_asking_rent, occupancy_rate, source
           FROM yardi_matrix_rent_survey
          WHERE id = $1`,
        [parsed.rows[0].id],
      );
      expect(res.rows).toHaveLength(1);

      const vRow = res.rows[0];
      expect(vRow.submarket).toBe('Buckhead Tx Test');
      expect(vRow.period_date).toBe('2025-06-30');
      expect(parseFloat(vRow.avg_asking_rent)).toBe(2100);
      expect(parseFloat(vRow.occupancy_rate)).toBe(94.5);
      expect(vRow.source).toBe('yardi_matrix');

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  it('writes to historical_observations with correct vendor_source and vendor_license_posture', async () => {
    const buffer = makeYardiRentSurveyBuffer('Midtown Tx Test', '2025-06-30');
    const parsed  = parseYardiRentSurvey(buffer);
    expect(parsed.rows).toHaveLength(1);

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const txQuery: QueryFn = (sql, params) =>
        client.query(sql, params as unknown[]) as Promise<unknown>;

      const obsResult = await upsertYardiHistoricalObservations(txQuery, parsed.rows);
      expect(obsResult.inserted).toBe(1);
      expect(obsResult.errors).toBe(0);

      // Assert historical_observations row with all vendor attribution columns
      const res = await client.query<{
        vendor_source:          string;
        vendor_license_posture: string;
        geography_level:        string;
        submarket_avg_asking_rent:    string;
        submarket_avg_effective_rent: string;
        submarket_vacancy_rate:       string;
        market_survey_source:         string;
        market_survey_snapshot:       Record<string, unknown>;
      }>(
        `SELECT vendor_source, vendor_license_posture, geography_level,
                submarket_avg_asking_rent, submarket_avg_effective_rent,
                submarket_vacancy_rate, market_survey_source, market_survey_snapshot
           FROM historical_observations
          WHERE vendor_source = 'yardi_matrix'
            AND observation_date = $1
            AND market_survey_snapshot->>'submarket' = 'Midtown Tx Test'`,
        ['2025-06-30'],
      );

      expect(res.rows).toHaveLength(1);
      const obs = res.rows[0];

      // Core vendor attribution — the primary requirements
      expect(obs.vendor_source).toBe('yardi_matrix');
      expect(obs.vendor_license_posture).toBe('platform_only');
      expect(obs.geography_level).toBe('submarket');

      // Numeric field correctness
      expect(parseFloat(obs.submarket_avg_asking_rent)).toBe(2100);
      expect(parseFloat(obs.submarket_avg_effective_rent)).toBe(2050);
      // vacancy_rate = 100 - 94.5 = 5.5
      expect(parseFloat(obs.submarket_vacancy_rate)).toBeCloseTo(5.5, 1);

      // Source attribution
      expect(obs.market_survey_source).toBe('yardi_matrix');

      // Snapshot JSONB round-trip
      const snap =
        typeof obs.market_survey_snapshot === 'string'
          ? JSON.parse(obs.market_survey_snapshot)
          : obs.market_survey_snapshot;
      expect(snap.submarket).toBe('Midtown Tx Test');
      expect(snap.avg_asking_rent).toBe(2100);
      expect(snap.yardi_matrix_id).toBe('ATL-TEST-001');

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  it('dual-write (both tables) in a single transaction confirms schema compat', async () => {
    const buffer = makeYardiRentSurveyBuffer('Perimeter Tx Test', '2025-09-30');
    const parsed  = parseYardiRentSurvey(buffer, { fileId: 'suite2-dual-write' });
    expect(parsed.rows).toHaveLength(1);

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const txQuery: QueryFn = (sql, params) =>
        client.query(sql, params as unknown[]) as Promise<unknown>;

      // Both writes in the same transaction
      const vRes = await writeYardiRentSurveyRows(txQuery, parsed.rows);
      const oRes = await upsertYardiHistoricalObservations(txQuery, parsed.rows);

      expect(vRes.inserted).toBe(1);
      expect(vRes.errors).toBe(0);
      expect(oRes.inserted).toBe(1);
      expect(oRes.errors).toBe(0);

      // Both rows visible within the transaction
      const vtCount = await client.query(
        `SELECT count(*) AS n FROM yardi_matrix_rent_survey WHERE id = $1`,
        [parsed.rows[0].id],
      );
      const hoCount = await client.query(
        `SELECT count(*) AS n FROM historical_observations
          WHERE vendor_source = 'yardi_matrix'
            AND market_survey_snapshot->>'submarket' = 'Perimeter Tx Test'`,
      );
      expect(parseInt(vtCount.rows[0].n)).toBe(1);
      expect(parseInt(hoCount.rows[0].n)).toBe(1);

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — Registry dispatch layer (real DB, sentinel cleanup)
// ─────────────────────────────────────────────────────────────────────────────
//
// Exercises the zero-switch-change vendorParser registered in the VendorRegistry.
// This is the same code path that data-library-upload-processor.ts calls after
// it downloads and classifies the file from R2 — replacing the R2 download with
// an in-memory XLSX buffer. The afterAll cleanup deletes sentinel rows.

describe('Suite 3 — Registry dispatch layer (vendorParser, real DB)', () => {
  it('vendorRegistry resolves YARDI_MATRIX_RENT_SURVEY to a registered vendorParser', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = vendorRegistry.getVendorByDocType('YARDI_MATRIX_RENT_SURVEY' as any);

    expect(entry).toBeDefined();
    expect(entry!.vendor.vendorId).toBe('yardi_matrix');
    expect(entry!.vendor.licensePosture).toBe('platform_only');
    expect(entry!.fileType.vendorParser).toBeDefined();
    expect(typeof entry!.fileType.vendorParser).toBe('function');
  });

  it('classifyByFilename identifies a Yardi Matrix Rent Survey export', () => {
    const filename = 'YMRS_Q1_2025_Atlanta.xlsx';
    const match    = vendorRegistry.classifyByFilename(filename);

    expect(match).not.toBeNull();
    expect(match!.match.vendorId).toBe('yardi_matrix');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(match!.match.fileType.documentType).toBe('YARDI_MATRIX_RENT_SURVEY' as any);
    expect(match!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('vendorParser: buffer → parse → dual-write → both tables populated (real DB)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = vendorRegistry.getVendorByDocType('YARDI_MATRIX_RENT_SURVEY' as any);
    expect(entry?.fileType.vendorParser).toBeDefined();

    const buffer = makeYardiRentSurveyBuffer(SENTINEL_SM, '2025-03-31');

    // Call the registered vendorParser — this is exactly what the upload
    // processor calls after classifying the file. It uses the global `query`
    // function (not a transactional client) so rows are committed to the DB.
    const result = await entry!.fileType.vendorParser!(buffer, {
      fileId: `registry-dispatch-${RUN_ID}`,
    });

    expect(result.success).toBe(true);
    expect(result.rowsInserted).toBeGreaterThanOrEqual(1);
    expect(result.validRows).toBeGreaterThanOrEqual(1);

    // ── Vendor-specific table ────────────────────────────────────────────────
    const vtRes = await query<{ submarket: string; source: string; occupancy_rate: string }>(
      `SELECT submarket, source, occupancy_rate
         FROM yardi_matrix_rent_survey
        WHERE submarket = $1`,
      [SENTINEL_SM],
    );
    expect(vtRes.rows.length).toBeGreaterThan(0);
    expect(vtRes.rows[0].source).toBe('yardi_matrix');
    expect(parseFloat(vtRes.rows[0].occupancy_rate)).toBe(94.5);

    // ── historical_observations (cross-vendor corpus) ────────────────────────
    const hoRes = await query<{
      vendor_source:          string;
      vendor_license_posture: string;
      geography_level:        string;
      submarket_vacancy_rate: string;
    }>(
      `SELECT vendor_source, vendor_license_posture, geography_level, submarket_vacancy_rate
         FROM historical_observations
        WHERE vendor_source = 'yardi_matrix'
          AND market_survey_snapshot->>'submarket' = $1`,
      [SENTINEL_SM],
    );
    expect(hoRes.rows.length).toBeGreaterThan(0);

    const obs = hoRes.rows[0];
    expect(obs.vendor_source).toBe('yardi_matrix');
    expect(obs.vendor_license_posture).toBe('platform_only');
    expect(obs.geography_level).toBe('submarket');
    // vacancy_rate = 100 - 94.5 = 5.5
    expect(parseFloat(obs.submarket_vacancy_rate)).toBeCloseTo(5.5, 1);
  });

  it('ON CONFLICT DO NOTHING: re-running vendorParser for the same sentinel does not error', async () => {
    // Verifies idempotency at the DB level — re-ingesting the same file is safe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = vendorRegistry.getVendorByDocType('YARDI_MATRIX_RENT_SURVEY' as any);
    const buffer = makeYardiRentSurveyBuffer(SENTINEL_SM, '2025-03-31');

    const result = await entry!.fileType.vendorParser!(buffer, {
      fileId: `registry-dispatch-${RUN_ID}`,
    });

    // Should succeed without errors even if some rows conflict on the PK
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4 — Processor layer (processDataLibraryUploadFile, real DB + R2 stub)
// ─────────────────────────────────────────────────────────────────────────────
//
// This is the true end-to-end boundary. processDataLibraryUploadFile() is the
// exact entry point that the intake worker calls in production after it picks up
// a source_type='data_library_upload' job.
//
// What's real:
//   - data_library_files row in the actual dev DB (INSERT in beforeAll)
//   - classifyDocument() runs against the real XLSX buffer
//   - vendorRegistry.getVendorByDocType() dispatch
//   - writeYardiRentSurveyRows + upsertYardiHistoricalObservations via global query
//   - setParserStatus UPDATE back into data_library_files
//
// What's stubbed:
//   - @aws-sdk/client-s3 (via vi.mock at top of file) so downloadFromR2() returns
//     our synthetic XLSX buffer instead of hitting Cloudflare R2

describe('Suite 4 — Processor layer (processDataLibraryUploadFile, real DB + R2 stub)', () => {

  beforeAll(async () => {
    // Insert a minimal data_library_files row that the processor will fetch.
    // sha256 is NOT NULL with no default — we provide a test value.
    // The filename 'YMRS_Q1_2025_Atlanta.xlsx' matches the Yardi Matrix
    // filename pattern, so classifyDocument will detect YARDI_MATRIX_RENT_SURVEY.
    // parcel_id satisfies the CHECK (parcel_id IS NOT NULL OR deal_id IS NOT NULL) constraint.
    await query(
      `INSERT INTO data_library_files
         (id, parcel_id, original_filename, sha256, storage_key, storage_bucket, document_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        PROC_FILE_ID,
        'integration-test-parcel',
        'YMRS_Q1_2025_Atlanta.xlsx',
        'integration-test-sha256-suite4',
        'test/yardi-suite4.xlsx',
        'test-bucket',
        'YARDI_MATRIX_RENT_SURVEY',
      ],
    );

    // Set the R2 mock buffer. The vi.mock factory reads r2MockBuffer at call
    // time, so setting it here (after the mock is registered but before the
    // test runs) ensures downloadFromR2 returns the right bytes.
    r2MockBuffer = makeYardiRentSurveyBuffer(PROC_SM, '2025-06-30');

    // R2_ACCOUNT_ID must be non-empty or buildR2Client() throws before the
    // mocked S3Client is even constructed.
    process.env.R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? 'test-account-id';
  });

  it('classifies, dispatches, dual-writes, and updates parser_status in one call', async () => {
    const { processDataLibraryUploadFile } =
      await import('../../../../services/intake-orchestrator/data-library-upload-processor');

    const result = await processDataLibraryUploadFile(PROC_FILE_ID, {});

    // ── Processor result ────────────────────────────────────────────────────
    expect(result.success).toBe(true);
    expect(result.documentType).toBe('YARDI_MATRIX_RENT_SURVEY');
    // parserUsed is `${docType.toLowerCase()}-extractor` per the processor
    expect(result.parserUsed).toMatch(/yardi/i);
    expect(result.error).toBeUndefined();

    // ── data_library_files status updated ────────────────────────────────────
    const fileRes = await query<{ parser_used: string; parser_status: string }>(
      `SELECT parser_used, parser_status FROM data_library_files WHERE id = $1`,
      [PROC_FILE_ID],
    );
    expect(fileRes.rows).toHaveLength(1);
    expect(fileRes.rows[0].parser_status).toBe('success');
    expect(fileRes.rows[0].parser_used).toMatch(/yardi/i);

    // ── Vendor-specific table ────────────────────────────────────────────────
    const vtRes = await query<{ submarket: string; source: string; occupancy_rate: string }>(
      `SELECT submarket, source, occupancy_rate
         FROM yardi_matrix_rent_survey
        WHERE submarket = $1`,
      [PROC_SM],
    );
    expect(vtRes.rows.length).toBeGreaterThan(0);
    expect(vtRes.rows[0].source).toBe('yardi_matrix');
    expect(parseFloat(vtRes.rows[0].occupancy_rate)).toBe(94.5);

    // ── historical_observations (cross-vendor corpus) ─────────────────────────
    const hoRes = await query<{
      vendor_source:          string;
      vendor_license_posture: string;
      geography_level:        string;
      submarket_vacancy_rate: string;
    }>(
      `SELECT vendor_source, vendor_license_posture, geography_level, submarket_vacancy_rate
         FROM historical_observations
        WHERE vendor_source = 'yardi_matrix'
          AND market_survey_snapshot->>'submarket' = $1`,
      [PROC_SM],
    );
    expect(hoRes.rows.length).toBeGreaterThan(0);

    const obs = hoRes.rows[0];
    expect(obs.vendor_source).toBe('yardi_matrix');
    expect(obs.vendor_license_posture).toBe('platform_only');
    expect(obs.geography_level).toBe('submarket');
    // vacancy_rate = 100 - 94.5 = 5.5
    expect(parseFloat(obs.submarket_vacancy_rate)).toBeCloseTo(5.5, 1);
  });

  it('is idempotent: re-running the processor for the same file_id does not error', async () => {
    // The processor is non-fatal by design. Re-running should not throw even
    // though some underlying INSERTs may silently skip via ON CONFLICT DO NOTHING.
    const { processDataLibraryUploadFile } =
      await import('../../../../services/intake-orchestrator/data-library-upload-processor');

    const result = await processDataLibraryUploadFile(PROC_FILE_ID, {});
    expect(result.success).toBe(true);
  });
});
