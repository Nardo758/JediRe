/**
 * engine.test.ts
 *
 * Vitest unit tests for the Concession Amortization Engine.
 * Implements all §12 test fixtures (12.1–12.10) from the spec.
 *
 * Run: npx vitest run backend/src/services/concession-amortization/__tests__/engine.test.ts
 */

import { describe, it, expect } from 'vitest';
import { amortizeConcessions, CashInvariantError } from '../index';
import { generateStraightLineGaap, generateBurnOff, generateFrontLoaded, generateCashAtCommencement, generateCustom, FRONT_LOADED_CURVE_12MO } from '../schedule-generators';
import { aggregateByCalendarYear, aggregateByFiscalYear, computeFiscalYear } from '../aggregator';
import type { ConcessionRecord, AmortizationEngineInput } from '../../../types/concessions';

// ─── Shared fixture factory ────────────────────────────────────────────────────

function makeRecord(overrides: Partial<ConcessionRecord> = {}): ConcessionRecord {
  return {
    id: 'rec-001',
    deal_id: 'deal-001',
    lease_id: 'lease-001',
    concession_type: 'FREE_RENT',
    cash_value: 1200,
    lease_start_date: '2025-01-01',
    lease_end_date: '2025-12-31',
    lease_term_months: 12,
    amortization_method: 'STRAIGHT_LINE_GAAP',
    is_lease_up_period: false,
    leasing_cost_treatment: 'OPERATING',
    is_renewal: false,
    is_subject_history: false,
    early_termination_date: null,
    fiscal_year_start_month: 1,
    ...overrides,
  };
}

function makeInput(
  records: ConcessionRecord[],
  overrides: Partial<Omit<AmortizationEngineInput, 'records'>> = {},
): AmortizationEngineInput {
  return {
    records,
    leasing_cost_treatment: 'OPERATING',
    current_date: '2025-01-01',
    horizon_months: 120,
    fiscal_year_start_month: 1,
    ...overrides,
  };
}

// ─── §12.1: STRAIGHT_LINE_GAAP ────────────────────────────────────────────────

describe('§12.1 STRAIGHT_LINE_GAAP', () => {
  it('spreads cash_value evenly across all months', () => {
    const record = makeRecord({ cash_value: 1200, lease_term_months: 12 });
    const entries = generateStraightLineGaap(record);
    expect(entries).toHaveLength(12);
    const amounts = entries.map(e => e.amount);
    expect(amounts.every(a => a === 100)).toBe(true);
    expect(amounts.reduce((s, a) => s + a, 0)).toBe(1200);
  });

  it('pushes rounding remainder to last month', () => {
    const record = makeRecord({ cash_value: 1000, lease_term_months: 3 });
    const entries = generateStraightLineGaap(record);
    expect(entries).toHaveLength(3);
    const total = entries.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(1000);
  });

  it('first entry month matches lease_start_date', () => {
    const record = makeRecord({ lease_start_date: '2025-03-01' });
    const entries = generateStraightLineGaap(record);
    expect(entries[0].month).toBe('202503');
  });

  it('passes cash-invariant assertion via amortizeConcessions', () => {
    const record = makeRecord();
    const output = amortizeConcessions(makeInput([record]));
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(Math.abs(total - record.cash_value)).toBeLessThanOrEqual(0.02);
  });
});

// ─── §12.2: CASH_AT_COMMENCEMENT ──────────────────────────────────────────────

describe('§12.2 CASH_AT_COMMENCEMENT', () => {
  it('recognizes 100% in the commencement month', () => {
    const record = makeRecord({
      amortization_method: 'CASH_AT_COMMENCEMENT',
      cash_value: 2500,
      lease_start_date: '2025-04-01',
    });
    const entries = generateCashAtCommencement(record);
    expect(entries).toHaveLength(1);
    expect(entries[0].month).toBe('202504');
    expect(entries[0].amount).toBe(2500);
  });

  it('passes cash-invariant via amortizeConcessions', () => {
    const record = makeRecord({ amortization_method: 'CASH_AT_COMMENCEMENT', cash_value: 2500 });
    const output = amortizeConcessions(makeInput([record]));
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(Math.abs(total - 2500)).toBeLessThanOrEqual(0.02);
  });
});

// ─── §12.3: FRONT_LOADED ──────────────────────────────────────────────────────

describe('§12.3 FRONT_LOADED', () => {
  it('applies platform curve for a 12-month lease', () => {
    const record = makeRecord({ amortization_method: 'FRONT_LOADED', cash_value: 1200, lease_term_months: 12 });
    const entries = generateFrontLoaded(record);
    expect(entries).toHaveLength(12);
    const total = entries.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(1200);
    // Month 1 should have the largest single-month amount (weight 0.20)
    expect(entries[0].amount).toBeGreaterThan(entries[11].amount);
  });

  it('curve for 6-month lease is renormalized subset', () => {
    const record = makeRecord({
      amortization_method: 'FRONT_LOADED',
      cash_value: 600,
      lease_term_months: 6,
      lease_end_date: '2025-06-30',
    });
    const entries = generateFrontLoaded(record);
    expect(entries).toHaveLength(6);
    const total = entries.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(600);
    // Earlier months should have more weight
    expect(entries[0].amount).toBeGreaterThan(entries[5].amount);
  });

  it('curve for 18-month lease covers all 18 months', () => {
    const record = makeRecord({
      amortization_method: 'FRONT_LOADED',
      cash_value: 1800,
      lease_term_months: 18,
      lease_end_date: '2026-06-30',
    });
    const entries = generateFrontLoaded(record);
    expect(entries).toHaveLength(18);
    const total = entries.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(1800);
  });

  it('FRONT_LOADED_CURVE_12MO constant sums to 1.0', () => {
    const sum = FRONT_LOADED_CURVE_12MO.reduce((s, w) => s + w, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThanOrEqual(0.001);
  });
});

// ─── §12.4: BURN_OFF ──────────────────────────────────────────────────────────

describe('§12.4 BURN_OFF', () => {
  it('is front-heavy: month 1 > month n', () => {
    const record = makeRecord({ amortization_method: 'BURN_OFF', cash_value: 1200, lease_term_months: 12 });
    const entries = generateBurnOff(record);
    expect(entries).toHaveLength(12);
    expect(entries[0].amount).toBeGreaterThan(entries[11].amount);
  });

  it('total equals cash_value', () => {
    const record = makeRecord({ amortization_method: 'BURN_OFF', cash_value: 3000, lease_term_months: 12 });
    const entries = generateBurnOff(record);
    const total = entries.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(3000);
  });

  it('single-month term: all in month 1', () => {
    const record = makeRecord({ amortization_method: 'BURN_OFF', cash_value: 500, lease_term_months: 1 });
    const entries = generateBurnOff(record);
    expect(entries).toHaveLength(1);
    expect(entries[0].amount).toBe(500);
  });
});

// ─── §12.5: CUSTOM schedule ───────────────────────────────────────────────────

describe('§12.5 CUSTOM schedule', () => {
  it('uses caller-supplied schedule verbatim', () => {
    const custom_schedule = [
      { month: '202501', amount: 600 },
      { month: '202506', amount: 600 },
    ];
    const record = makeRecord({
      amortization_method: 'CUSTOM',
      cash_value: 1200,
      custom_schedule,
    });
    const entries = generateCustom(record);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ month: '202501', amount: 600 });
    expect(entries[1]).toEqual({ month: '202506', amount: 600 });
  });

  it('throws when sum does not match cash_value', () => {
    const record = makeRecord({
      amortization_method: 'CUSTOM',
      cash_value: 1200,
      custom_schedule: [{ month: '202501', amount: 900 }],
    });
    expect(() => generateCustom(record)).toThrow('does not match cash_value');
  });

  it('throws when custom_schedule is missing', () => {
    const record = makeRecord({ amortization_method: 'CUSTOM', custom_schedule: undefined });
    expect(() => generateCustom(record)).toThrow('custom_schedule is empty or missing');
  });

  it('passes cash-invariant via amortizeConcessions', () => {
    const record = makeRecord({
      amortization_method: 'CUSTOM',
      cash_value: 1200,
      custom_schedule: [
        { month: '202501', amount: 800 },
        { month: '202506', amount: 400 },
      ],
    });
    const output = amortizeConcessions(makeInput([record]));
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(Math.abs(total - 1200)).toBeLessThanOrEqual(0.02);
  });
});

// ─── §12.6: Early termination write-off ───────────────────────────────────────

describe('§12.6 Early termination write-off', () => {
  it('writes off unamortized balance in the termination month', () => {
    const record = makeRecord({
      cash_value: 1200,
      lease_term_months: 12,
      early_termination_date: '2025-06-01',
    });
    const output = amortizeConcessions(makeInput([record]));
    expect(output.write_offs).toHaveLength(1);
    expect(output.write_offs[0].reason).toBe('early_termination');
    expect(output.write_offs[0].write_off_month).toBe('202506');
    expect(output.write_offs[0].amount).toBeGreaterThan(0);
    // Total recognition (entries + write-offs) must still equal cash_value
    const totalRecognized = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(Math.abs(totalRecognized - 1200)).toBeLessThanOrEqual(0.02);
  });

  it('write-off amount hits the monthly_recognition map in termination month', () => {
    const record = makeRecord({
      cash_value: 1200,
      lease_term_months: 12,
      early_termination_date: '2025-06-01',
    });
    const output = amortizeConcessions(makeInput([record]));
    // The write-off amount should appear in monthly_recognition for 202506
    const termMonthRecognized = output.monthly_recognition['202506'] ?? 0;
    expect(termMonthRecognized).toBeGreaterThan(0);
  });
});

// ─── §12.7: Cash invariant across all three treatments ────────────────────────

describe('§12.7 Cash invariant across treatments', () => {
  const baseRecord = makeRecord({
    id: 'rec-007',
    cash_value: 3600,
    lease_term_months: 12,
    is_lease_up_period: true,
    amortization_method: 'STRAIGHT_LINE_GAAP',
  });

  it('OPERATING: all cash flows to monthly_recognition', () => {
    const output = amortizeConcessions(makeInput([baseRecord], { leasing_cost_treatment: 'OPERATING' }));
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(Math.abs(total - 3600)).toBeLessThanOrEqual(0.02);
    expect(output.lease_up_reserve_required).toBe(0);
  });

  it('CAPITALIZED: lease-up-period cash flows to reserve, not monthly_recognition', () => {
    const output = amortizeConcessions(makeInput([baseRecord], { leasing_cost_treatment: 'CAPITALIZED' }));
    const totalRecognized = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(totalRecognized).toBe(0);
    expect(output.lease_up_reserve_required).toBe(3600);
  });

  it('HYBRID: all cash flows to monthly_recognition (amortized)', () => {
    const output = amortizeConcessions(makeInput([baseRecord], { leasing_cost_treatment: 'HYBRID' }));
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(Math.abs(total - 3600)).toBeLessThanOrEqual(0.02);
    expect(output.lease_up_reserve_required).toBe(0);
  });

  it('No CashInvariantError for any treatment', () => {
    for (const t of ['OPERATING', 'CAPITALIZED', 'HYBRID'] as const) {
      expect(() =>
        amortizeConcessions(makeInput([baseRecord], { leasing_cost_treatment: t })),
      ).not.toThrow(CashInvariantError);
    }
  });

  it('total cash is identical across treatments (invariant holds)', () => {
    const treatmentTotals = (['OPERATING', 'CAPITALIZED', 'HYBRID'] as const).map(t => {
      const output = amortizeConcessions(makeInput([baseRecord], { leasing_cost_treatment: t }));
      return (
        Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0) +
        output.lease_up_reserve_required
      );
    });
    // All three totals should equal cash_value = 3600
    treatmentTotals.forEach(total => expect(Math.abs(total - 3600)).toBeLessThanOrEqual(0.02));
  });
});

// ─── §12.8: Subject history record (amortization tail) ────────────────────────

describe('§12.8 Subject history record', () => {
  it('amortizes from historical lease_start_date including past periods', () => {
    const record = makeRecord({
      is_subject_history: true,
      lease_start_date: '2024-01-01',
      lease_end_date: '2024-12-31',
      lease_term_months: 12,
      cash_value: 1200,
    });
    const output = amortizeConcessions(
      makeInput([record], { current_date: '2024-07-01', horizon_months: 120 }),
    );
    // Months 202401–202406 should be in the schedule (past, but still recognized)
    const schedule = output.schedules[0];
    const months = schedule.monthly_entries.map(e => e.month);
    expect(months).toContain('202401');
    expect(months).toContain('202407');
    const totalRecognized = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(Math.abs(totalRecognized - 1200)).toBeLessThanOrEqual(0.02);
  });
});

// ─── §12.9: Cross-horizon truncation ─────────────────────────────────────────

describe('§12.9 Cross-horizon truncation', () => {
  it('truncates entries beyond the horizon and tracks truncated amount', () => {
    const record = makeRecord({
      cash_value: 1200,
      lease_term_months: 12,
      lease_start_date: '2025-01-01',
      lease_end_date: '2025-12-31',
    });
    // Only 6 months of horizon — truncates the back half of the lease
    const output = amortizeConcessions(
      makeInput([record], { current_date: '2025-01-01', horizon_months: 6 }),
    );
    const schedule = output.schedules[0];
    expect(schedule.truncated_recognition_post_horizon).toBeGreaterThan(0);
    const recognized = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    const total = recognized + schedule.truncated_recognition_post_horizon;
    // recognized + truncated should = cash_value (within rounding)
    expect(Math.abs(total - 1200)).toBeLessThanOrEqual(0.02);
  });
});

// ─── §12.10: Multi-concession overlap ─────────────────────────────────────────

describe('§12.10 Multi-concession overlap (AMORTIZATION-METHOD-IS-PER-CONCESSION)', () => {
  it('both records amortize independently and monthly amounts are summed', () => {
    const record1 = makeRecord({
      id: 'rec-010a',
      concession_type: 'FREE_RENT',
      cash_value: 1200,
      lease_term_months: 12,
      amortization_method: 'STRAIGHT_LINE_GAAP',
    });
    const record2 = makeRecord({
      id: 'rec-010b',
      concession_type: 'GIFT_CARD',
      cash_value: 500,
      lease_term_months: 12,
      amortization_method: 'CASH_AT_COMMENCEMENT',
    });
    const output = amortizeConcessions(makeInput([record1, record2]));
    expect(output.schedules).toHaveLength(2);
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(Math.abs(total - 1700)).toBeLessThanOrEqual(0.02);
    // Commencement month (202501) should contain straight-line slice + full gift card
    const commencementMonth = output.monthly_recognition['202501'] ?? 0;
    expect(commencementMonth).toBe(100 + 500); // 100/mo straight-line + 500 cash-at-commence
  });
});

// ─── Aggregator tests ──────────────────────────────────────────────────────────

describe('aggregateByCalendarYear', () => {
  it('groups YYYYMM keys by year', () => {
    const monthly = { '202501': 100, '202506': 200, '202601': 300 };
    const result = aggregateByCalendarYear(monthly);
    expect(result['2025']).toBe(300);
    expect(result['2026']).toBe(300);
  });
});

describe('aggregateByFiscalYear / computeFiscalYear', () => {
  it('fiscalStart=7: July → next year label', () => {
    expect(computeFiscalYear('202507', 7)).toBe('2026');
  });

  it('fiscalStart=7: June → current year label', () => {
    expect(computeFiscalYear('202506', 7)).toBe('2025');
  });

  it('fiscalStart=1: calendar year = fiscal year', () => {
    expect(computeFiscalYear('202503', 1)).toBe('2025');
  });

  it('aggregates correctly with July fiscal start', () => {
    const monthly = { '202507': 1000, '202508': 1000, '202601': 500 };
    const result = aggregateByFiscalYear(monthly, 7);
    // Jul + Aug 2025 → FY2026; Jan 2026 → FY2026
    expect(result['2026']).toBe(2500);
  });
});
