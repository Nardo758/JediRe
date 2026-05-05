/**
 * engine.test.ts
 *
 * Vitest unit tests for the Concession Amortization Engine.
 * Implements all §12 test fixtures (12.1–12.10) from the spec, plus
 * additional coverage for:
 *   - early termination + horizon truncation interaction (blocking double-count bug)
 *   - structural write-offs (§7.8)
 *   - treatment metadata on schedule matches runtime treatment, not record-level
 *   - renewal mid-amortization independence (§7.2)
 *   - inferred_from_rent_roll zero-value skip
 *
 * Run: npx vitest run backend/src/services/concession-amortization/__tests__/engine.test.ts
 */

import { describe, it, expect } from 'vitest';
import { amortizeConcessions, CashInvariantError } from '../index';
import {
  generateStraightLineGaap,
  generateBurnOff,
  generateFrontLoaded,
  generateCashAtCommencement,
  generateCustom,
  FRONT_LOADED_CURVE_12MO,
} from '../schedule-generators';
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
    structural_write_off_date: null,
    inferred_from_rent_roll: false,
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
    // $100 * 12 = $1200 exactly (100 is exactly representable in binary float)
    expect(amounts.reduce((s, a) => s + a, 0)).toBe(1200);
  });

  it('pushes rounding remainder to last month', () => {
    const record = makeRecord({ cash_value: 1000, lease_term_months: 3 });
    const entries = generateStraightLineGaap(record);
    expect(entries).toHaveLength(3);
    // Engine distributes exactly 100000 cents; dollar sum may have ±$0.01 float drift.
    const total = entries.reduce((s, e) => s + e.amount, 0);
    expect(Math.abs(total - 1000)).toBeLessThanOrEqual(0.01);
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
    // Engine distributes exactly N cents; dollar-level sum may have ±$0.01 float drift.
    expect(Math.abs(total - 1200)).toBeLessThanOrEqual(0.01);
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
    // Renormalized weights produce non-round cent values; dollar sum within $0.01.
    expect(Math.abs(total - 600)).toBeLessThanOrEqual(0.01);
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
    expect(Math.abs(total - 1800)).toBeLessThanOrEqual(0.01);
  });

  it('curve for 18-month lease: tail months 13–18 get non-zero weight', () => {
    // Regression test for the n>12 bug where FRONT_LOADED_CURVE_12MO already sums to 1.0,
    // causing remainder ≈ 0 and months 13+ getting zero weight.
    const record = makeRecord({
      amortization_method: 'FRONT_LOADED',
      cash_value: 1800,
      lease_term_months: 18,
      lease_end_date: '2026-06-30',
    });
    const entries = generateFrontLoaded(record);
    expect(entries).toHaveLength(18);
    // All 18 entries must have a positive amount — no zero-weight tail months.
    for (let i = 12; i < 18; i++) {
      expect(entries[i].amount).toBeGreaterThan(0);
    }
    // Front-loaded: month 1 should still exceed any tail month.
    expect(entries[0].amount).toBeGreaterThan(entries[12].amount);
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
    // Engine distributes exactly N cents; dollar-level sum may have ±$0.01 float drift.
    expect(Math.abs(total - 3000)).toBeLessThanOrEqual(0.01);
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
    // Total recognition (entries + write-offs) must equal cash_value
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
    const termMonthRecognized = output.monthly_recognition['202506'] ?? 0;
    expect(termMonthRecognized).toBeGreaterThan(0);
  });

  it('§7.1+§7.6 interaction — early termination within short horizon: no double-counting', () => {
    // Lease runs Jan–Dec 2025 (12 months)
    // Horizon is only 6 months (cuts off at Jun 2025)
    // Early termination at Apr 2025
    // Write-off fires in Apr 2025 (within horizon) for ALL remaining months (May–Dec = 8 months)
    // truncated MUST be 0 — write-off already captured the horizon tail
    const record = makeRecord({
      cash_value: 1200,
      lease_term_months: 12,
      lease_start_date: '2025-01-01',
      lease_end_date: '2025-12-31',
      early_termination_date: '2025-04-01',
    });
    const output = amortizeConcessions(
      makeInput([record], { current_date: '2025-01-01', horizon_months: 6 }),
    );
    const schedule = output.schedules[0];
    // Write-off fires in 202504
    expect(output.write_offs).toHaveLength(1);
    expect(output.write_offs[0].write_off_month).toBe('202504');
    // truncated must be 0 — no double-counting
    expect(schedule.truncated_recognition_post_horizon).toBe(0);
    // recognized = Jan+Feb+Mar slices + write-off for Apr–Dec
    const recognized = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(Math.abs(recognized - 1200)).toBeLessThanOrEqual(0.02);
    // Cash invariant holds
    expect(() => amortizeConcessions(makeInput([record], { horizon_months: 6 }))).not.toThrow(CashInvariantError);
  });

  it('§7.1+§7.6 interaction — early termination beyond horizon: only truncation, no write-off', () => {
    // Lease runs Jan–Dec 2025, horizon only 3 months (Jan–Mar 2025)
    // Early termination date Aug 2025 — beyond the horizon
    // No write-off should fire; only horizon truncation applies
    const record = makeRecord({
      cash_value: 1200,
      lease_term_months: 12,
      early_termination_date: '2025-08-01',
    });
    const output = amortizeConcessions(
      makeInput([record], { current_date: '2025-01-01', horizon_months: 3 }),
    );
    // No write-off fires (termination is beyond horizon)
    expect(output.write_offs).toHaveLength(0);
    // Truncated captures months 4–12
    const schedule = output.schedules[0];
    expect(schedule.truncated_recognition_post_horizon).toBeGreaterThan(0);
    // recognized + truncated = cash_value
    const recognized = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    const total = recognized + schedule.truncated_recognition_post_horizon;
    expect(Math.abs(total - 1200)).toBeLessThanOrEqual(0.02);
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

  it('total cash (recognized + capitalized) is identical across all three treatments', () => {
    const treatmentTotals = (['OPERATING', 'CAPITALIZED', 'HYBRID'] as const).map(t => {
      const output = amortizeConcessions(makeInput([baseRecord], { leasing_cost_treatment: t }));
      return (
        Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0) +
        output.lease_up_reserve_required
      );
    });
    treatmentTotals.forEach(total => expect(Math.abs(total - 3600)).toBeLessThanOrEqual(0.02));
    // All three totals must be equal to each other (cross-treatment invariant)
    expect(Math.abs(treatmentTotals[0] - treatmentTotals[1])).toBeLessThanOrEqual(0.02);
    expect(Math.abs(treatmentTotals[1] - treatmentTotals[2])).toBeLessThanOrEqual(0.02);
  });

  it('schedule.treatment reflects runtime treatment, not record-level treatment', () => {
    // record has leasing_cost_treatment: 'OPERATING', but we run with CAPITALIZED
    const record = makeRecord({
      leasing_cost_treatment: 'OPERATING',
      is_lease_up_period: true,
      cash_value: 1200,
    });
    const output = amortizeConcessions(makeInput([record], { leasing_cost_treatment: 'CAPITALIZED' }));
    // schedule.treatment must be the RUNTIME treatment (CAPITALIZED), not OPERATING
    expect(output.schedules[0].treatment).toBe('CAPITALIZED');
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
    const output = amortizeConcessions(
      makeInput([record], { current_date: '2025-01-01', horizon_months: 6 }),
    );
    const schedule = output.schedules[0];
    expect(schedule.truncated_recognition_post_horizon).toBeGreaterThan(0);
    const recognized = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    const total = recognized + schedule.truncated_recognition_post_horizon;
    expect(Math.abs(total - 1200)).toBeLessThanOrEqual(0.02);
  });

  it('no write-offs generated when only horizon truncation applies', () => {
    const record = makeRecord({ cash_value: 1200, lease_term_months: 12 });
    const output = amortizeConcessions(
      makeInput([record], { current_date: '2025-01-01', horizon_months: 6 }),
    );
    expect(output.write_offs).toHaveLength(0);
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
    // Commencement month (202501) = straight-line slice (100) + full gift card (500)
    const commencementMonth = output.monthly_recognition['202501'] ?? 0;
    expect(commencementMonth).toBe(100 + 500);
  });
});

// ─── §7.2: Renewal mid-amortization independence ──────────────────────────────

describe('§7.2 Renewal mid-amortization', () => {
  it('original and renewal concession records amortize independently', () => {
    const original = makeRecord({
      id: 'rec-orig',
      lease_id: 'lease-001',
      cash_value: 1200,
      lease_term_months: 12,
      is_renewal: false,
    });
    const renewal = makeRecord({
      id: 'rec-renew',
      lease_id: 'lease-001-renewal',
      cash_value: 600,
      lease_term_months: 6,
      is_renewal: true,
      lease_start_date: '2025-07-01',
      lease_end_date: '2025-12-31',
      amortization_method: 'STRAIGHT_LINE_GAAP',
    });
    const output = amortizeConcessions(makeInput([original, renewal]));
    expect(output.schedules).toHaveLength(2);
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    // Both records' cash_value should be fully recognized (within rounding)
    expect(Math.abs(total - 1800)).toBeLessThanOrEqual(0.02);
  });
});

// ─── §7.8: Structural write-offs ──────────────────────────────────────────────

describe('§7.8 Structural write-offs', () => {
  it('writes off remaining balance on structural_write_off_date', () => {
    const record = makeRecord({
      cash_value: 1200,
      lease_term_months: 12,
      structural_write_off_date: '2025-04-01',
    });
    const output = amortizeConcessions(makeInput([record]));
    expect(output.write_offs).toHaveLength(1);
    expect(output.write_offs[0].reason).toBe('structural');
    expect(output.write_offs[0].write_off_month).toBe('202504');
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(Math.abs(total - 1200)).toBeLessThanOrEqual(0.02);
  });

  it('structural write-off beyond horizon causes truncation, not write-off', () => {
    const record = makeRecord({
      cash_value: 1200,
      lease_term_months: 12,
      structural_write_off_date: '2025-09-01',
    });
    const output = amortizeConcessions(
      makeInput([record], { current_date: '2025-01-01', horizon_months: 6 }),
    );
    // Write-off date (Sep) > horizon (Jun) — no write-off fires
    expect(output.write_offs).toHaveLength(0);
    // Truncation applies to post-horizon months
    expect(output.schedules[0].truncated_recognition_post_horizon).toBeGreaterThan(0);
  });

  it('when both early_termination and structural dates set, earlier date governs', () => {
    // early term = Feb, structural = Apr — Feb governs → reason = 'early_termination'
    const record = makeRecord({
      cash_value: 1200,
      lease_term_months: 12,
      early_termination_date: '2025-02-01',
      structural_write_off_date: '2025-04-01',
    });
    const output = amortizeConcessions(makeInput([record]));
    expect(output.write_offs).toHaveLength(1);
    expect(output.write_offs[0].write_off_month).toBe('202502');
    expect(output.write_offs[0].reason).toBe('early_termination');
  });

  it('when structural date is earlier than early_termination, structural governs', () => {
    const record = makeRecord({
      cash_value: 1200,
      lease_term_months: 12,
      early_termination_date: '2025-06-01',
      structural_write_off_date: '2025-03-01',
    });
    const output = amortizeConcessions(makeInput([record]));
    expect(output.write_offs[0].write_off_month).toBe('202503');
    expect(output.write_offs[0].reason).toBe('structural');
  });
});

// ─── inferred_from_rent_roll zero-skip ────────────────────────────────────────

describe('inferred_from_rent_roll zero-value skip', () => {
  it('skips records with cash_value=0 and inferred_from_rent_roll=true', () => {
    const badRecord = makeRecord({ cash_value: 0, inferred_from_rent_roll: true });
    const goodRecord = makeRecord({ id: 'rec-good', cash_value: 1200 });
    const output = amortizeConcessions(makeInput([badRecord, goodRecord]));
    // Only goodRecord contributes to recognition
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(Math.abs(total - 1200)).toBeLessThanOrEqual(0.02);
  });

  it('does not throw for a zero-value inferred record', () => {
    const record = makeRecord({ cash_value: 0, inferred_from_rent_roll: true });
    expect(() => amortizeConcessions(makeInput([record]))).not.toThrow();
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
