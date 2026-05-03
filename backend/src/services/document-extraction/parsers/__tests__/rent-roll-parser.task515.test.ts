/**
 * Task #515 — Test coverage for the rent-roll extraction quality flags
 * introduced in Task #514.
 *
 * Three coverage areas:
 *
 *  1. Per-bucket lease-expiration classification:
 *     null leaseExpiration  → unknown
 *     past date             → mtm
 *     +1 month              → months_0_3
 *     +5 months             → months_3_6
 *     +9 months             → months_6_12
 *     +18 months            → months_12_plus
 *
 *  2. expiration_extraction_status state machine:
 *     unknown=0                 → 'ok'
 *     0 < unknown < occupied    → 'partial'
 *     unknown >= occupied       → 'failed'
 *
 *  3. Upload-completion alert/KPI surfacing:
 *     The "Rent roll extraction quality:" KPI line appears in the
 *     ExtractionResult.warnings array (which downstream pipeline code
 *     forwards into pipelineResult.alerts on the upload completion path).
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseRentRoll } from '../rent-roll-parser';
import type { ExtractionResult } from '../../types';

type Cell = string | number | null;

/**
 * Narrow shape of the rent-roll capsuleExtras fields exercised by these
 * tests. Keeps the assertions strongly typed without pulling in the full
 * production capsule type (which has 30+ unrelated fields).
 */
interface RentRollCapsuleExtrasForTest {
  expiration_curve: {
    months_0_3: number;
    months_3_6: number;
    months_6_12: number;
    months_12_plus: number;
    mtm: number;
    unknown: number;
  };
  expiration_extraction_status: 'ok' | 'partial' | 'failed';
  occupied_units: number;
  floor_plan_mix: Record<string, {
    expiration_extraction_status: 'ok' | 'partial' | 'failed';
    expiration_curve: RentRollCapsuleExtrasForTest['expiration_curve'];
  }>;
}

type RentRollResult = ExtractionResult & { capsuleExtras?: RentRollCapsuleExtrasForTest };

function runParse(buf: Buffer): RentRollResult {
  return parseRentRoll(buf, 'fixture.xlsx') as RentRollResult;
}

/**
 * Build a Yardi RRwLC sheet with a fixed As-Of date so bucket math is
 * deterministic regardless of when the test runs. The As-Of header at row 0
 * drives the parser's `today` clock for bucketing.
 */
function buildYardiSheet(rows: Cell[][], asOfText = 'As Of = 1/15/2025'): Buffer {
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

/**
 * Convenience: an occupied Yardi unit row with a given lease expiration date
 * (or null). All other fields are populated with realistic values so the row
 * passes occupancy classification (resident name + non-zero rent => occupied).
 */
function occupiedRow(unit: string, leaseExpiration: string | null): Cell[] {
  return [unit, 'A1', 750, `Tenant ${unit}`, 1500, 'rent', 1450, null, null,
          '2024-06-01', leaseExpiration, null, 0];
}

describe('Task #515 — expiration bucket classification', () => {
  // As-Of = 2025-01-15. Pick lease end dates that unambiguously land in
  // each bucket (avoid month-boundary edge cases that could flicker between
  // adjacent buckets due to monthsBetween rounding).
  it('null leaseExpiration → unknown bucket (does NOT silently fall to MTM)', () => {
    const buf = buildYardiSheet([occupiedRow('101', null)]);
    const out = runParse(buf);
    expect(out.success).toBe(true);
    const c = out.capsuleExtras!.expiration_curve;
    expect(c.unknown).toBe(1);
    expect(c.mtm).toBe(0);
    expect(c.months_0_3 + c.months_3_6 + c.months_6_12 + c.months_12_plus).toBe(0);
  });

  it('past lease end → mtm bucket', () => {
    // As-of 2025-01-15, lease ended 2024-06-30 → ~7mo in the past
    const buf = buildYardiSheet([occupiedRow('102', '2024-06-30')]);
    const out = runParse(buf);
    expect(out.success).toBe(true);
    const c = out.capsuleExtras!.expiration_curve;
    expect(c.mtm).toBe(1);
    expect(c.unknown).toBe(0);
  });

  it('+2 months → months_0_3 bucket', () => {
    // As-of 2025-01-15, lease ends 2025-03-20 → ~2 months forward
    const buf = buildYardiSheet([occupiedRow('103', '2025-03-20')]);
    const out = runParse(buf);
    const c = out.capsuleExtras!.expiration_curve;
    expect(c.months_0_3).toBe(1);
    expect(c.months_3_6).toBe(0);
    expect(c.months_6_12).toBe(0);
    expect(c.months_12_plus).toBe(0);
  });

  it('+5 months → months_3_6 bucket', () => {
    // As-of 2025-01-15, lease ends 2025-06-20 → ~5 months forward
    const buf = buildYardiSheet([occupiedRow('104', '2025-06-20')]);
    const out = runParse(buf);
    const c = out.capsuleExtras!.expiration_curve;
    expect(c.months_3_6).toBe(1);
    expect(c.months_0_3).toBe(0);
    expect(c.months_6_12).toBe(0);
    expect(c.months_12_plus).toBe(0);
  });

  it('+9 months → months_6_12 bucket', () => {
    // As-of 2025-01-15, lease ends 2025-10-20 → ~9 months forward
    const buf = buildYardiSheet([occupiedRow('105', '2025-10-20')]);
    const out = runParse(buf);
    const c = out.capsuleExtras!.expiration_curve;
    expect(c.months_6_12).toBe(1);
    expect(c.months_3_6).toBe(0);
    expect(c.months_12_plus).toBe(0);
  });

  it('+18 months → months_12_plus bucket', () => {
    // As-of 2025-01-15, lease ends 2026-07-20 → ~18 months forward
    const buf = buildYardiSheet([occupiedRow('106', '2026-07-20')]);
    const out = runParse(buf);
    const c = out.capsuleExtras!.expiration_curve;
    expect(c.months_12_plus).toBe(1);
    expect(c.months_6_12).toBe(0);
  });

  it('mixed cohort populates every bucket exactly once', () => {
    const buf = buildYardiSheet([
      occupiedRow('201', null),         // unknown
      occupiedRow('202', '2024-06-30'), // mtm
      occupiedRow('203', '2025-03-20'), // 0-3
      occupiedRow('204', '2025-06-20'), // 3-6
      occupiedRow('205', '2025-10-20'), // 6-12
      occupiedRow('206', '2026-07-20'), // 12+
    ]);
    const out = runParse(buf);
    const c = out.capsuleExtras!.expiration_curve;
    expect(c).toMatchObject({
      unknown: 1, mtm: 1, months_0_3: 1, months_3_6: 1, months_6_12: 1, months_12_plus: 1,
    });
  });
});

describe('Task #515 — expiration_extraction_status transitions', () => {
  it("status='ok' when every occupied lease parsed (unknown=0)", () => {
    const buf = buildYardiSheet([
      occupiedRow('301', '2025-06-20'),
      occupiedRow('302', '2025-10-20'),
      occupiedRow('303', '2026-07-20'),
    ]);
    const out = runParse(buf);
    expect(out.capsuleExtras!.expiration_curve.unknown).toBe(0);
    expect(out.capsuleExtras!.expiration_extraction_status).toBe('ok');
  });

  it("status='partial' when 0 < unknown < occupied (some leases parsed, some not)", () => {
    const buf = buildYardiSheet([
      occupiedRow('401', '2025-06-20'), // parsed
      occupiedRow('402', '2025-10-20'), // parsed
      occupiedRow('403', null),         // unknown
    ]);
    const out = runParse(buf);
    const cap = out.capsuleExtras!;
    expect(cap.expiration_curve.unknown).toBe(1);
    expect(cap.occupied_units).toBe(3);
    expect(cap.expiration_extraction_status).toBe('partial');
  });

  it("status='failed' when unknown >= occupied (every lease end null)", () => {
    const buf = buildYardiSheet([
      occupiedRow('501', null),
      occupiedRow('502', null),
    ]);
    const out = runParse(buf);
    const cap = out.capsuleExtras!;
    expect(cap.expiration_curve.unknown).toBe(2);
    expect(cap.occupied_units).toBe(2);
    expect(cap.expiration_extraction_status).toBe('failed');
  });

  it("per-floor-plan status reflects only that floor plan's coverage", () => {
    // FP A1: all parsed → ok. FP B1: all null → failed. Deal-wide: partial.
    const buf = buildYardiSheet([
      ['601', 'A1', 750, 'T A1-1', 1500, 'rent', 1450, null, null, '2024-06-01', '2025-06-20', null, 0],
      ['602', 'A1', 750, 'T A1-2', 1500, 'rent', 1450, null, null, '2024-06-01', '2025-10-20', null, 0],
      ['603', 'B1', 950, 'T B1-1', 1800, 'rent', 1750, null, null, '2024-06-01', null, null, 0],
      ['604', 'B1', 950, 'T B1-2', 1800, 'rent', 1750, null, null, '2024-06-01', null, null, 0],
    ]);
    const out = runParse(buf);
    const fpm = out.capsuleExtras!.floor_plan_mix;
    expect(fpm.A1.expiration_extraction_status).toBe('ok');
    expect(fpm.B1.expiration_extraction_status).toBe('failed');
    expect(out.capsuleExtras!.expiration_extraction_status).toBe('partial');
  });
});

describe('Task #515 — upload-completion alerts include extraction-quality KPI', () => {
  // The integration contract: parseRentRoll pushes a "Rent roll extraction
  // quality:" KPI line into ExtractionResult.warnings, which the upstream
  // pipeline (extraction-pipeline.ts:112,134,235; data-router.ts:32) merges
  // into pipelineResult.alerts. Asserting the warning line is present here
  // covers the surface contract that the upload UI consumes.

  it('emits the "Rent roll extraction quality:" KPI line in warnings', () => {
    const buf = buildYardiSheet([
      occupiedRow('701', '2025-06-20'),
      occupiedRow('702', '2025-10-20'),
    ]);
    const out = parseRentRoll(buf, 'fixture.xlsx') as ExtractionResult;
    const kpi = out.warnings.find(w => w.startsWith('Rent roll extraction quality:'));
    expect(kpi).toBeDefined();
    expect(kpi).toContain('2 occupied units detected');
    expect(kpi).toContain('Lease expiration mapped: 2 of 2');
    expect(kpi).toContain('Effective rent mapped: 2 of 2');
    expect(kpi).toContain('Coverage OK.');
  });

  it('KPI line reports partial mapping accurately and recommends review', () => {
    const buf = buildYardiSheet([
      occupiedRow('801', '2025-06-20'), // parsed
      occupiedRow('802', null),         // unknown
      occupiedRow('803', null),         // unknown
    ]);
    const out = parseRentRoll(buf, 'fixture.xlsx') as ExtractionResult;
    const kpi = out.warnings.find(w => w.startsWith('Rent roll extraction quality:'));
    expect(kpi).toBeDefined();
    expect(kpi).toContain('3 occupied units detected');
    expect(kpi).toContain('Lease expiration mapped: 1 of 3');
    expect(kpi).toContain('Review recommended.');
  });

  it('KPI line reports failed extraction (0 of N mapped) and recommends review', () => {
    const buf = buildYardiSheet([
      occupiedRow('901', null),
      occupiedRow('902', null),
    ]);
    const out = parseRentRoll(buf, 'fixture.xlsx') as ExtractionResult;
    const kpi = out.warnings.find(w => w.startsWith('Rent roll extraction quality:'));
    expect(kpi).toBeDefined();
    expect(kpi).toContain('Lease expiration mapped: 0 of 2');
    expect(kpi).toContain('Review recommended.');
  });

});
