import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseRentRoll } from '../rent-roll-parser';

type Cell = string | number | null;

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

function buildGenericSheet(rows: Cell[][]): Buffer {
  const aoa: Cell[][] = [
    ['Unit', 'Unit Type', 'Sq Ft', 'Resident', 'Market Rent', 'Rent', 'Lease End'],
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('Task #514 — rent roll extraction confidence', () => {
  it('canonical Yardi with full lease dates → unknown=0, status=ok', () => {
    const buf = buildYardiSheet([
      ['101', 'A1', 750, 'Smith, J',  1500, 'rent', 1450, null, null, '2024-06-01', '2025-06-01', null, 0],
      ['102', 'A1', 750, 'Jones, K',  1500, 'rent', 1480, null, null, '2024-08-01', '2025-08-01', null, 0],
      ['103', 'B1', 950, 'Lee, M',    1800, 'rent', 1750, null, null, '2024-10-01', '2025-10-01', null, 0],
    ]);
    const out = parseRentRoll(buf, 'fixture.xlsx') as any;
    expect(out.success).toBe(true);
    expect(out.layout).toBe('yardi_rrwlc');
    const cap = out.capsuleExtras as Record<string, any>;
    expect(cap.expiration_curve.unknown).toBe(0);
    expect(cap.expiration_extraction_status).toBe('ok');
    expect(cap.column_coverage.lease_expiration).toBe('ok');
    expect(cap.human_review_needed).toBe(false);
  });

  it('Yardi with all-null lease dates → status=failed and unknown=occupied', () => {
    const buf = buildYardiSheet([
      ['201', 'A1', 750, 'Smith, J', 1500, 'rent', 1450, null, null, '2024-06-01', null, null, 0],
      ['202', 'A1', 750, 'Jones, K', 1500, 'rent', 1480, null, null, '2024-08-01', null, null, 0],
    ]);
    const out = parseRentRoll(buf, 'fixture.xlsx') as any;
    expect(out.success).toBe(true);
    const cap = out.capsuleExtras as Record<string, any>;
    expect(cap.expiration_curve.unknown).toBe(2);
    expect(cap.expiration_curve.mtm).toBe(0);
    expect(cap.expiration_extraction_status).toBe('failed');
  });

  it('historical as-of-date is honored; old lease dates do NOT fall to MTM', () => {
    // As-of 2018-08-15 (set in buildYardiSheet); leases ending 2019 are
    // still in-term as of the snapshot, NOT past-dated MTM.
    const aoa: Cell[][] = [
      ['As Of = 8/15/2018', null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null],
      ['Unit', 'Unit Type', 'Sq Ft', 'Resident', 'Market', 'Charge', 'Amount',
       'Resident Deposit', 'Other Deposit', 'Move-In', 'Lease Expiration', 'Move-Out', 'Balance'],
      [null, null, null, null, 'Rent', 'Code', null, null, null, null, null, null, null],
      ['301', 'A1', 750, 'Smith, J', 1500, 'rent', 1450, null, null, '2018-06-01', '2019-06-01', null, 0],
      ['302', 'A1', 750, 'Jones, K', 1500, 'rent', 1480, null, null, '2018-08-01', '2019-02-01', null, 0],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const out = parseRentRoll(buf, 'fixture.xlsx') as any;
    expect(out.success).toBe(true);
    const cap = out.capsuleExtras as Record<string, any>;
    expect(cap.as_of_date).toBe('2018-08-15');
    // Both leases end after as-of-date → must NOT be MTM.
    expect(cap.expiration_curve.mtm).toBe(0);
    const totalForward =
      cap.expiration_curve.months_0_3 +
      cap.expiration_curve.months_3_6 +
      cap.expiration_curve.months_6_12 +
      cap.expiration_curve.months_12_plus;
    expect(totalForward).toBe(2);
  });

  it('generic_flat → lease_expiration is not_supported and does NOT trigger human review by itself', () => {
    const buf = buildGenericSheet([
      ['401', 'A1', 750, 'Smith, J', 1500, 1450, null],
      ['402', 'A1', 750, 'Jones, K', 1500, 1480, null],
    ]);
    const out = parseRentRoll(buf, 'fixture.xlsx') as any;
    expect(out.success).toBe(true);
    expect(out.layout).toBe('generic_flat');
    const cap = out.capsuleExtras as Record<string, any>;
    expect(cap.column_coverage.lease_expiration).toBe('not_supported');
    expect(cap.column_coverage.charge_code).toBe('not_supported');
    // Required critical fields all populated → human review must not fire
    // solely because lease_expiration is not_supported.
    expect(cap.human_review_needed).toBe(false);
  });

  it('zero rent values are NOT counted as unreadable (presence-based coverage)', () => {
    // Model unit / fully-concession'd lease with $0 effective rent — must
    // still register as ok extraction, NOT trigger hard-fail.
    const buf = buildYardiSheet([
      ['501', 'A1', 750, 'Model',     0, 'rent', 0, null, null, '2024-06-01', '2025-06-01', null, 0],
      ['502', 'A1', 750, 'Smith, J', 1500, 'rent', 1450, null, null, '2024-08-01', '2025-08-01', null, 0],
    ]);
    const out = parseRentRoll(buf, 'fixture.xlsx') as any;
    expect(out.success).toBe(true);
    const cap = out.capsuleExtras as Record<string, any>;
    expect(cap.column_coverage.market_rent).toBe('ok');
    expect(cap.column_coverage.amount).toBe('ok');
    expect(cap.human_review_needed).toBe(false);
  });
});
