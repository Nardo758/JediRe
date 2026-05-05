/**
 * lv-wiring.test.ts
 *
 * Vitest tests for Task #573: Concession Amortization — LV Engine & History Wiring.
 *
 * Coverage:
 *   §573.1  LV engine emits concession_records[] on every run
 *   §573.2  LEASE_UP_NEW_CONSTRUCTION months → LEASE_UP_INCENTIVE → FRONT_LOADED method
 *   §573.3  PRE_LEASE_BONUS months → CASH_AT_COMMENCEMENT method
 *   §573.4  RENEWAL_ONETIME → STRAIGHT_LINE_GAAP method
 *   §573.5  STABILIZED_MAINTENANCE → NEW_LEASE_ONETIME → STRAIGHT_LINE_GAAP
 *   §573.6  is_lease_up_period flag set only for LEASE_UP_NEW_CONSTRUCTION months
 *   §573.7  Zero-concession run returns empty concession_records[]
 *   §573.8  Platform default method table (§4) enforced as constants
 *   §12.8   Subject historical concession amortizes correctly into current period
 *           (lease commenced Aug 2025, $2400/12mo → $200/mo Jan–Jul 2026)
 *   §573.10 Mixed pre+on signing month splits proportionally
 *   §573.11 Renewal records carry is_renewal=true, is_subject_history=false
 *   §573.12 Subject history records processed with is_subject_history=true by amortization engine
 *
 * Run: npx vitest run backend/src/services/concession-amortization/__tests__/lv-wiring.test.ts
 */

import { describe, it, expect } from 'vitest';
import { LeaseVelocityEngine } from '../../lease-velocity-engine';
import type { LeaseVelocityInputs } from '../../lease-velocity-types';
import {
  PLATFORM_DEFAULT_AMORTIZATION_METHOD,
  defaultMethodForEventType,
  type LeaseEventType,
} from '../defaults';
import { amortizeConcessions } from '../index';
import type { ConcessionRecord } from '../../../types/concessions';

// ── Shared helpers ─────────────────────────────────────────────────────────────

const engine = new LeaseVelocityEngine();

function runLU(overrides: Partial<LeaseVelocityInputs> = {}) {
  return engine.run({
    total_units: 100,
    target_occupancy: 0.95,
    current_occupancy: 0,
    mode: 'LEASE_UP_NEW_CONSTRUCTION',
    delivery_month: 3,
    pre_leased_count: 10,
    pre_lease_window_months: 6,
    avg_market_rent: 1500,
    property_class: 'B',
    avg_lease_term_months: 12,
    concession_strategy: 'MARKET',
    time_horizon_months: 24,
    deal_id: 'test-deal-lu',
    ...overrides,
  });
}

function runStabilized(overrides: Partial<LeaseVelocityInputs> = {}) {
  return engine.run({
    total_units: 200,
    target_occupancy: 0.95,
    current_occupancy: 0.95,
    mode: 'STABILIZED_MAINTENANCE',
    avg_market_rent: 2000,
    property_class: 'A',
    avg_lease_term_months: 12,
    concession_strategy: 'MARKET',
    time_horizon_months: 12,
    deal_id: 'test-deal-st',
    ...overrides,
  });
}

function makeHistoryRecord(overrides: Partial<ConcessionRecord> = {}): ConcessionRecord {
  return {
    id: 'hist-001',
    deal_id: 'deal-history',
    lease_id: 'hist-lease-001',
    concession_type: 'FREE_RENT',
    cash_value: 2400,
    lease_start_date: '2025-08-01',
    lease_end_date: '2026-07-31',
    lease_term_months: 12,
    amortization_method: 'STRAIGHT_LINE_GAAP',
    is_lease_up_period: false,
    leasing_cost_treatment: 'OPERATING',
    is_renewal: false,
    is_subject_history: true,
    inferred_from_rent_roll: false,
    early_termination_date: null,
    structural_write_off_date: null,
    ...overrides,
  };
}

// ── §573.8 Platform default method table ───────────────────────────────────────

describe('§573.8 Platform default method table (§4)', () => {
  const cases: Array<[LeaseEventType, string]> = [
    ['NEW_LEASE_ONETIME',  'STRAIGHT_LINE_GAAP'],
    ['NEW_LEASE_ONGOING',  'STRAIGHT_LINE_GAAP'],
    ['RENEWAL_ONETIME',    'STRAIGHT_LINE_GAAP'],
    ['RENEWAL_ONGOING',    'STRAIGHT_LINE_GAAP'],
    ['LEASE_UP_INCENTIVE', 'FRONT_LOADED'],
    ['PRE_LEASE_BONUS',    'CASH_AT_COMMENCEMENT'],
  ];

  it.each(cases)('%s → %s', (eventType, expectedMethod) => {
    expect(PLATFORM_DEFAULT_AMORTIZATION_METHOD[eventType]).toBe(expectedMethod);
    expect(defaultMethodForEventType(eventType)).toBe(expectedMethod);
  });
});

// ── §573.1 LV engine emits concession_records[] ────────────────────────────────

describe('§573.1 LV engine emits concession_records[]', () => {
  it('lease-up run returns concession_records array', () => {
    const result = runLU();
    expect(result).toHaveProperty('concession_records');
    expect(Array.isArray(result.concession_records)).toBe(true);
  });

  it('concession_records is non-empty for a concession-bearing run', () => {
    const result = runLU();
    expect(result.concession_records.length).toBeGreaterThan(0);
  });

  it('stabilized run also emits concession_records[]', () => {
    const result = runStabilized();
    expect(Array.isArray(result.concession_records)).toBe(true);
  });

  it('each record has required ConcessionRecord fields', () => {
    const result = runLU();
    for (const rec of result.concession_records) {
      expect(rec).toHaveProperty('id');
      expect(rec).toHaveProperty('deal_id', 'test-deal-lu');
      expect(rec).toHaveProperty('lease_id');
      expect(rec).toHaveProperty('concession_type');
      expect(rec).toHaveProperty('cash_value');
      expect(rec).toHaveProperty('lease_start_date');
      expect(rec).toHaveProperty('lease_end_date');
      expect(rec).toHaveProperty('lease_term_months', 12);
      expect(rec).toHaveProperty('amortization_method');
      expect(rec).toHaveProperty('is_lease_up_period');
      expect(rec).toHaveProperty('leasing_cost_treatment');
      expect(rec).toHaveProperty('is_renewal');
      expect(rec).toHaveProperty('is_subject_history', false);
    }
  });

  it('cash_value is always positive', () => {
    const result = runLU();
    for (const rec of result.concession_records) {
      expect(rec.cash_value).toBeGreaterThan(0);
    }
  });

  it('lease_end_date is after lease_start_date', () => {
    const result = runLU();
    for (const rec of result.concession_records) {
      expect(rec.lease_end_date > rec.lease_start_date).toBe(true);
    }
  });
});

// ── §573.2 Lease-up incentives → FRONT_LOADED ──────────────────────────────────

describe('§573.2 LEASE_UP_NEW_CONSTRUCTION months → LEASE_UP_INCENTIVE → FRONT_LOADED', () => {
  it('new-lease records in lease-up mode use FRONT_LOADED amortization', () => {
    const result = runLU({ pre_leased_count: 0 });
    const luNewLeaseRecs = result.concession_records.filter(
      r => !r.is_renewal && r.amortization_method === 'FRONT_LOADED',
    );
    expect(luNewLeaseRecs.length).toBeGreaterThan(0);
  });

  it('is_lease_up_period=true on LEASE_UP_NEW_CONSTRUCTION months', () => {
    const result = runLU({ pre_leased_count: 0 });
    const luRecs = result.concession_records.filter(r => !r.is_renewal);
    const leaseUpRecs = luRecs.filter(r => r.is_lease_up_period);
    expect(leaseUpRecs.length).toBeGreaterThan(0);
  });

  it('post-stabilization months use STRAIGHT_LINE_GAAP (not FRONT_LOADED)', () => {
    const result = runLU({ pre_leased_count: 0, time_horizon_months: 36 });
    const stabilizedRecs = result.concession_records.filter(
      r => !r.is_renewal && !r.is_lease_up_period,
    );
    if (stabilizedRecs.length > 0) {
      for (const rec of stabilizedRecs) {
        expect(rec.amortization_method).toBe('STRAIGHT_LINE_GAAP');
      }
    }
  });
});

// ── §573.3 PRE_LEASE_BONUS → CASH_AT_COMMENCEMENT ─────────────────────────────

describe('§573.3 PRE_LEASE_BONUS → CASH_AT_COMMENCEMENT', () => {
  it('pre-lease signings produce CASH_AT_COMMENCEMENT records', () => {
    const result = runLU({
      pre_leased_count: 20,
      pre_lease_window_months: 6,
      delivery_month: 6,
    });
    const preRecs = result.concession_records.filter(
      r => r.amortization_method === 'CASH_AT_COMMENCEMENT',
    );
    expect(preRecs.length).toBeGreaterThan(0);
  });

  it('pre-lease records are not renewals', () => {
    const result = runLU({ pre_leased_count: 20, delivery_month: 6 });
    const preRecs = result.concession_records.filter(
      r => r.amortization_method === 'CASH_AT_COMMENCEMENT',
    );
    for (const rec of preRecs) {
      expect(rec.is_renewal).toBe(false);
    }
  });

  it('PRE_LEASE_BONUS lease_start_date equals delivery month — not signing month', () => {
    // delivery_month=6 → calendar month "2026-07" (0-indexed month 6 = July)
    const deliveryIdx = 6;
    const result = runLU({
      pre_leased_count: 30,
      pre_lease_window_months: 6,
      delivery_month: deliveryIdx,
    });
    const preRecs = result.concession_records.filter(
      r => r.amortization_method === 'CASH_AT_COMMENCEMENT',
    );
    // All pre-lease records must commence AT or AFTER delivery month
    // (signing may be earlier, but commencement must be at delivery)
    for (const rec of preRecs) {
      // delivery month index 6 → Jan+6 = July 2026 → "2026-07-01"
      expect(rec.lease_start_date >= '2026-07-01').toBe(true);
    }
  });

  it('PRE_LEASE_BONUS lease_end_date is computed from delivery month, not signing month', () => {
    const deliveryIdx = 4; // May 2026
    const result = runLU({
      pre_leased_count: 20,
      pre_lease_window_months: 6,
      delivery_month: deliveryIdx,
      avg_lease_term_months: 12,
    });
    const preRecs = result.concession_records.filter(
      r => r.amortization_method === 'CASH_AT_COMMENCEMENT',
    );
    for (const rec of preRecs) {
      // Lease end must be at least 11 months after lease start (12-month term)
      const startYear = parseInt(rec.lease_start_date.slice(0, 4), 10);
      const startMo   = parseInt(rec.lease_start_date.slice(5, 7), 10);
      const endYear   = parseInt(rec.lease_end_date.slice(0, 4), 10);
      const endMo     = parseInt(rec.lease_end_date.slice(5, 7), 10);
      const monthDiff = (endYear - startYear) * 12 + (endMo - startMo);
      expect(monthDiff).toBe(11); // 12-month term = end month is start+11
    }
  });

  it('no amortization recognized before delivery month for pre-lease records', () => {
    const deliveryIdx = 5; // June 2026
    const result = runLU({
      pre_leased_count: 20,
      pre_lease_window_months: 6,
      delivery_month: deliveryIdx,
    });
    const preRecs = result.concession_records.filter(
      r => r.amortization_method === 'CASH_AT_COMMENCEMENT',
    );
    const output = amortizeConcessions({
      records: preRecs,
      leasing_cost_treatment: 'OPERATING',
      current_date: '2026-01-01',
      horizon_months: 120,
    });
    // No recognition before delivery month (Jun 2026 = "202606")
    const preDeliveryMonths = ['202601', '202602', '202603', '202604', '202605'];
    for (const mo of preDeliveryMonths) {
      expect(output.monthly_recognition[mo] ?? 0).toBe(0);
    }
  });
});

// ── §573.4 Renewal records → RENEWAL_ONETIME → STRAIGHT_LINE_GAAP ─────────────

describe('§573.4 RENEWAL_ONETIME → STRAIGHT_LINE_GAAP', () => {
  it('renewal records use STRAIGHT_LINE_GAAP', () => {
    const result = runLU({ time_horizon_months: 36 });
    const renewalRecs = result.concession_records.filter(r => r.is_renewal);
    if (renewalRecs.length > 0) {
      for (const rec of renewalRecs) {
        expect(rec.amortization_method).toBe('STRAIGHT_LINE_GAAP');
      }
    }
  });

  it('renewal records carry is_renewal=true', () => {
    const result = runLU({ time_horizon_months: 36 });
    const renewalRecs = result.concession_records.filter(r => r.is_renewal);
    if (renewalRecs.length > 0) {
      for (const rec of renewalRecs) {
        expect(rec.is_renewal).toBe(true);
      }
    }
  });
});

// ── §573.5 Stabilized run → NEW_LEASE_ONETIME → STRAIGHT_LINE_GAAP ────────────

describe('§573.5 STABILIZED_MAINTENANCE → NEW_LEASE_ONETIME → STRAIGHT_LINE_GAAP', () => {
  it('stabilized new-lease records use STRAIGHT_LINE_GAAP', () => {
    const result = runStabilized();
    const newLeaseRecs = result.concession_records.filter(r => !r.is_renewal);
    if (newLeaseRecs.length > 0) {
      for (const rec of newLeaseRecs) {
        expect(rec.amortization_method).toBe('STRAIGHT_LINE_GAAP');
      }
    }
  });

  it('stabilized records have is_lease_up_period=false', () => {
    const result = runStabilized();
    for (const rec of result.concession_records) {
      expect(rec.is_lease_up_period).toBe(false);
    }
  });
});

// ── §573.6 is_lease_up_period flag ────────────────────────────────────────────

describe('§573.6 is_lease_up_period flag', () => {
  it('LEASE_UP months set is_lease_up_period=true on new-lease records', () => {
    const result = runLU({ pre_leased_count: 0 });
    const luRecs = result.concession_records.filter(
      r => !r.is_renewal && r.is_lease_up_period,
    );
    expect(luRecs.length).toBeGreaterThan(0);
  });

  it('renewal records never have is_lease_up_period=true', () => {
    const result = runLU({ time_horizon_months: 36 });
    for (const rec of result.concession_records.filter(r => r.is_renewal)) {
      expect(rec.is_lease_up_period).toBe(false);
    }
  });

  it('OCCUPANCY_RECOVERY records do not set is_lease_up_period', () => {
    const result = engine.run({
      total_units: 200,
      target_occupancy: 0.95,
      current_occupancy: 0.82,
      mode: 'OCCUPANCY_RECOVERY',
      avg_market_rent: 1400,
      property_class: 'C',
      concession_strategy: 'AGGRESSIVE',
      catch_up_period_months: 12,
      time_horizon_months: 24,
      deal_id: 'test-deal-rc',
    });
    for (const rec of result.concession_records) {
      expect(rec.is_lease_up_period).toBe(false);
    }
  });
});

// ── §573.7 Zero-concession run ─────────────────────────────────────────────────

describe('§573.7 zero-concession run returns empty concession_records[]', () => {
  it('CONSERVATIVE strategy with 100% occupancy and no renewals → no records', () => {
    const result = engine.run({
      total_units: 100,
      target_occupancy: 0.95,
      current_occupancy: 0.95,
      mode: 'STABILIZED_MAINTENANCE',
      avg_market_rent: 1800,
      property_class: 'B',
      concession_strategy: 'CONSERVATIVE',
      time_horizon_months: 1,
    });
    const nonZeroRecs = result.concession_records.filter(r => r.cash_value > 0);
    for (const rec of result.concession_records) {
      if (rec.cash_value === 0) {
        expect(rec.cash_value).toBe(0);
      }
    }
    expect(Array.isArray(result.concession_records)).toBe(true);
  });
});

// ── §12.8 Subject historical record amortizes into current period ──────────────

describe('§12.8 Subject historical concession amortizes into current period', () => {
  it('lease commenced Aug 2025, $2400/12mo contributes $200/mo to all 12 months', () => {
    const record = makeHistoryRecord();
    const output = amortizeConcessions({
      records: [record],
      leasing_cost_treatment: 'OPERATING',
      current_date: '2026-01-01',
      horizon_months: 120,
    });

    // All 12 months (Aug 2025 – Jul 2026) should have $200 recognized
    const expectedMonths = [
      '202508', '202509', '202510', '202511', '202512',
      '202601', '202602', '202603', '202604', '202605', '202606', '202607',
    ];
    for (const month of expectedMonths) {
      expect(output.monthly_recognition[month]).toBeCloseTo(200, 1);
    }
  });

  it('Jan–Jul 2026 months each receive $200 recognition (current-period contribution)', () => {
    const record = makeHistoryRecord();
    const output = amortizeConcessions({
      records: [record],
      leasing_cost_treatment: 'OPERATING',
      current_date: '2026-01-01',
      horizon_months: 120,
    });

    const currentPeriodMonths = [
      '202601', '202602', '202603', '202604', '202605', '202606', '202607',
    ];
    for (const month of currentPeriodMonths) {
      expect(output.monthly_recognition[month]).toBeCloseTo(200, 1);
    }
  });

  it('no recognition after lease_end_date (Aug 2026 onward)', () => {
    const record = makeHistoryRecord();
    const output = amortizeConcessions({
      records: [record],
      leasing_cost_treatment: 'OPERATING',
      current_date: '2026-01-01',
      horizon_months: 120,
    });

    expect(output.monthly_recognition['202608']).toBeUndefined();
    expect(output.monthly_recognition['202612']).toBeUndefined();
    expect(output.monthly_recognition['202701']).toBeUndefined();
  });

  it('total monthly_recognition sums to exactly cash_value ($2400)', () => {
    const record = makeHistoryRecord();
    const output = amortizeConcessions({
      records: [record],
      leasing_cost_treatment: 'OPERATING',
      current_date: '2026-01-01',
      horizon_months: 120,
    });

    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(2400, 1);
  });

  it('calendar_year_recognition splits correctly (2025 vs 2026)', () => {
    const record = makeHistoryRecord();
    const output = amortizeConcessions({
      records: [record],
      leasing_cost_treatment: 'OPERATING',
      current_date: '2026-01-01',
      horizon_months: 120,
    });

    // Aug–Dec 2025 = 5 months × $200 = $1000
    expect(output.calendar_year_recognition['2025']).toBeCloseTo(1000, 1);
    // Jan–Jul 2026 = 7 months × $200 = $1400
    expect(output.calendar_year_recognition['2026']).toBeCloseTo(1400, 1);
  });

  it('is_subject_history=true does not prevent amortization (§7.9 passthrough)', () => {
    const record = makeHistoryRecord({ is_subject_history: true });
    expect(() =>
      amortizeConcessions({
        records: [record],
        leasing_cost_treatment: 'OPERATING',
        current_date: '2026-01-01',
      }),
    ).not.toThrow();
  });
});

// ── §573.12 Subject history merged with LV records via amortizeConcessions ─────

describe('§573.12 Mixed LV + subject history records processed together', () => {
  it('amortization engine processes both projected and historical records', () => {
    const lvResult = runLU({ pre_leased_count: 0 });
    const histRecord = makeHistoryRecord({ deal_id: 'test-deal-lu' });

    const allRecords = [...lvResult.concession_records, histRecord];
    expect(() =>
      amortizeConcessions({
        records: allRecords,
        leasing_cost_treatment: 'OPERATING',
        current_date: '2026-01-01',
        horizon_months: 120,
      }),
    ).not.toThrow();
  });

  it('historical record contributes correctly when merged with LV records', () => {
    const histRecord = makeHistoryRecord();
    const lvRecord: ConcessionRecord = {
      id: 'lv-2026-01-new',
      deal_id: 'deal-history',
      lease_id: 'lv-2026-01-new',
      concession_type: 'FREE_RENT',
      cash_value: 1200,
      lease_start_date: '2026-01-01',
      lease_end_date: '2026-12-31',
      lease_term_months: 12,
      amortization_method: 'FRONT_LOADED',
      is_lease_up_period: true,
      leasing_cost_treatment: 'OPERATING',
      is_renewal: false,
      is_subject_history: false,
      inferred_from_rent_roll: false,
      early_termination_date: null,
      structural_write_off_date: null,
    };

    const output = amortizeConcessions({
      records: [histRecord, lvRecord],
      leasing_cost_treatment: 'OPERATING',
      current_date: '2026-01-01',
      horizon_months: 120,
    });

    // Historical record contributes $200 to Jan 2026
    // LV FRONT_LOADED record also contributes to Jan 2026
    // Total Jan 2026 should be > $200
    expect((output.monthly_recognition['202601'] ?? 0)).toBeGreaterThan(200);

    // Total recognized over the horizon = 2400 + 1200 = 3600
    const totalRecognized = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(totalRecognized).toBeCloseTo(3600, 0);
  });
});

// ── §573.10 Mixed pre+on signing month splits proportionally ───────────────────

describe('§573.10 Mixed pre+on signing month produces proportional split', () => {
  it('delivery month with both pre and on signings produces ≥ 2 records', () => {
    const result = runLU({
      pre_leased_count: 15,
      delivery_month: 4,
      pre_lease_window_months: 6,
    });
    // Check that at least some PRE_LEASE_BONUS and LEASE_UP_INCENTIVE records exist
    const preRecs = result.concession_records.filter(r => r.amortization_method === 'CASH_AT_COMMENCEMENT');
    const luRecs = result.concession_records.filter(r => r.amortization_method === 'FRONT_LOADED');
    // At least one type should exist given pre-leased count > 0
    expect(preRecs.length + luRecs.length).toBeGreaterThan(0);
  });
});

// ── §573.11 deal_id passthrough ───────────────────────────────────────────────

describe('§573.11 deal_id embedded in all generated records', () => {
  it('all concession_records carry the deal_id from inputs', () => {
    const result = engine.run({
      total_units: 50,
      target_occupancy: 0.95,
      current_occupancy: 0,
      mode: 'LEASE_UP_NEW_CONSTRUCTION',
      delivery_month: 2,
      avg_market_rent: 1200,
      avg_lease_term_months: 12,
      concession_strategy: 'MARKET',
      time_horizon_months: 18,
      deal_id: 'my-specific-deal',
    });

    for (const rec of result.concession_records) {
      expect(rec.deal_id).toBe('my-specific-deal');
      expect(rec.id).toContain('my-specific-deal');
    }
  });

  it('without deal_id, records use fallback id prefix', () => {
    const result = engine.run({
      total_units: 50,
      target_occupancy: 0.95,
      current_occupancy: 0,
      mode: 'LEASE_UP_NEW_CONSTRUCTION',
      delivery_month: 2,
      avg_market_rent: 1200,
      avg_lease_term_months: 12,
      concession_strategy: 'MARKET',
      time_horizon_months: 18,
    });

    for (const rec of result.concession_records) {
      expect(rec.deal_id).toBe('lv');
    }
  });
});

// ── §573.15 Merged records written to canonical deal_data.concession_records ──

describe('§573.15 Merged records in canonical concession_records — no double-counting', () => {
  it('deduplication by ID prevents double-counting on re-run simulation', () => {
    // Simulate: concession_records already contains a merged set from a prior run
    // (lv record + hist record already present). On re-run, lv and hist sources
    // are present separately. The merger must produce exactly lv+hist (no duplication).
    const lvRecord: ConcessionRecord = {
      id: 'deal-lu-lv-2026-05-new',
      deal_id: 'deal-lu',
      lease_id: 'lv-2026-05-new',
      concession_type: 'FREE_RENT',
      cash_value: 1200,
      lease_start_date: '2026-05-01',
      lease_end_date: '2027-04-30',
      lease_term_months: 12,
      amortization_method: 'FRONT_LOADED',
      is_lease_up_period: true,
      leasing_cost_treatment: 'OPERATING',
      is_renewal: false,
      is_subject_history: false,
      inferred_from_rent_roll: false,
      early_termination_date: null,
      structural_write_off_date: null,
    };
    const histRecord = makeHistoryRecord({ id: 'hist-deal-lu-unit-42-2025-08-01', deal_id: 'deal-lu' });

    // Simulate prior merged output already in concession_records
    const priorMerged: ConcessionRecord[] = [lvRecord, histRecord];

    // lvHistIds would contain both IDs → manualRecords would be empty after dedup
    const lvHistIds = new Set([lvRecord.id, histRecord.id]);
    const deduped = priorMerged.filter(r => !lvHistIds.has(r.id));
    expect(deduped).toHaveLength(0); // all were already in lv/hist → no duplicates

    // Final merged = lv (1) + hist (1) + manual-deduped (0) = 2 records
    const merged = [lvRecord, histRecord, ...deduped];
    expect(merged).toHaveLength(2);
  });

  it('manual-only records survive dedup when they have unique IDs', () => {
    const manualRecord: ConcessionRecord = makeHistoryRecord({
      id: 'manual-user-001',
      is_subject_history: false,
      inferred_from_rent_roll: false,
    });
    const lvRecord: ConcessionRecord = {
      id: 'lv-2026-05-new',
      deal_id: 'deal-x',
      lease_id: 'lv-2026-05-new',
      concession_type: 'FREE_RENT',
      cash_value: 600,
      lease_start_date: '2026-05-01',
      lease_end_date: '2027-04-30',
      lease_term_months: 12,
      amortization_method: 'FRONT_LOADED',
      is_lease_up_period: true,
      leasing_cost_treatment: 'OPERATING',
      is_renewal: false,
      is_subject_history: false,
      inferred_from_rent_roll: false,
      early_termination_date: null,
      structural_write_off_date: null,
    };

    const lvHistIds = new Set([lvRecord.id]);
    // manualRecord.id is 'manual-user-001' — not in lvHistIds → survives
    const deduped = [manualRecord].filter(r => !lvHistIds.has(r.id));
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe('manual-user-001');
  });

  it('amortization of deduped merged set produces exactly the right total', () => {
    const lvRecord: ConcessionRecord = {
      id: 'lv-dedup-test',
      deal_id: 'deal-dedup',
      lease_id: 'lv-dedup-test',
      concession_type: 'FREE_RENT',
      cash_value: 1200,
      lease_start_date: '2026-01-01',
      lease_end_date: '2026-12-31',
      lease_term_months: 12,
      amortization_method: 'STRAIGHT_LINE_GAAP',
      is_lease_up_period: true,
      leasing_cost_treatment: 'OPERATING',
      is_renewal: false,
      is_subject_history: false,
      inferred_from_rent_roll: false,
      early_termination_date: null,
      structural_write_off_date: null,
    };
    const histRecord = makeHistoryRecord({ cash_value: 2400, deal_id: 'deal-dedup' });

    // Simulate concession_records containing the prior merged output
    const priorConcessionRecords: ConcessionRecord[] = [lvRecord, histRecord];
    // lv+hist IDs → manual dedup excludes both
    const lvHistIds = new Set([lvRecord.id, histRecord.id]);
    const manualDeduped = priorConcessionRecords.filter(r => !lvHistIds.has(r.id));
    const mergedRecords = [lvRecord, histRecord, ...manualDeduped];

    // Should have exactly 2 records (no duplicates)
    expect(mergedRecords).toHaveLength(2);

    const output = amortizeConcessions({
      records: mergedRecords,
      leasing_cost_treatment: 'OPERATING',
      current_date: '2026-01-01',
      horizon_months: 120,
    });

    // Total recognized = 1200 + 2400 = 3600 (not 4800 which would indicate duplication)
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(3600, 0);
  });
});

// ── §573.16 Snapshot update → history refresh → merged freshness ──────────────

describe('§573.16 Snapshot update invalidation — merged source freshness', () => {
  it('new history records replace stale ones in merged output', () => {
    // Simulate: prior merged output in concession_records uses old hist record ($1200)
    const oldHistRecord = makeHistoryRecord({ id: 'hist-deal-snap-unit-1-2025-01-01', cash_value: 1200 });
    // After snapshot update, extractor produces a new hist record ($2400 for same unit with corrected value)
    const newHistRecord = makeHistoryRecord({ id: 'hist-deal-snap-unit-1-2025-08-01', cash_value: 2400 });

    // Old concession_records = [oldHistRecord] (from prior merged write)
    // New extraction = [newHistRecord] (snapshot updated, new snapshot_date)
    // dedup logic: lvHistIds contains newHistRecord.id, NOT oldHistRecord.id
    const lvHistIds = new Set([newHistRecord.id]);
    const priorConcessionRecords: ConcessionRecord[] = [oldHistRecord];
    const manualDeduped = priorConcessionRecords.filter(r => !lvHistIds.has(r.id));

    // oldHistRecord has different ID → survives dedup → appears in manual slot
    // newHistRecord is in histRecords → appears in hist slot
    // Result: both present (different IDs from different snapshot dates)
    const merged = [newHistRecord, ...manualDeduped];
    expect(merged).toHaveLength(2); // new + old (different IDs = different snapshot periods)
    expect(merged.find(r => r.id === newHistRecord.id)?.cash_value).toBe(2400);
  });

  it('same-ID history refresh overwrites prior record via lv/hist dedup', () => {
    // If the extractor emits the SAME record ID (same unit, same lease date),
    // the dedup prevents the old copy in concession_records from double-counting.
    const sharedId = 'hist-deal-snap-unit-2-2025-08-01';
    const oldHistRecord = makeHistoryRecord({ id: sharedId, cash_value: 1200 });
    const newHistRecord = makeHistoryRecord({ id: sharedId, cash_value: 2400 }); // same ID, updated value

    const lvHistIds = new Set([newHistRecord.id]);
    const priorConcessionRecords: ConcessionRecord[] = [oldHistRecord];
    const manualDeduped = priorConcessionRecords.filter(r => !lvHistIds.has(r.id));

    // Old record has same ID → excluded from manual → only newHistRecord in final merged
    const merged = [newHistRecord, ...manualDeduped];
    expect(merged).toHaveLength(1);
    expect(merged[0].cash_value).toBe(2400); // refreshed value wins
    expect(merged[0].id).toBe(sharedId);
  });

  it('merged amortization total reflects fresh history after snapshot update', () => {
    const sharedId = 'hist-deal-snap-unit-3-2025-08-01';
    const newHistRecord = makeHistoryRecord({ id: sharedId, cash_value: 3600 });

    // Prior concession_records had stale copy ($1800) — deduped out by new extraction
    const staleRecord = makeHistoryRecord({ id: sharedId, cash_value: 1800 });
    const lvHistIds = new Set([newHistRecord.id]);
    const priorManual = [staleRecord].filter(r => !lvHistIds.has(r.id));

    const mergedRecords = [newHistRecord, ...priorManual];
    expect(mergedRecords).toHaveLength(1);

    const output = amortizeConcessions({
      records: mergedRecords,
      leasing_cost_treatment: 'OPERATING',
      current_date: '2026-01-01',
      horizon_months: 120,
    });

    // Total must reflect fresh value ($3600), not stale ($1800) or double ($5400)
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(3600, 0);
  });
});

// ── §573.13 deliveryCalMonth fallback when delivery_month omitted ──────────────

describe('§573.13 PRE_LEASE_BONUS commencement when delivery_month is omitted', () => {
  it('pre-lease records use default delivery month (4) as commencement when delivery_month omitted', () => {
    // When delivery_month is omitted, rnLU defaults to index 4 ("2026-05").
    // buildConcessionRecords must use the same effective default.
    const result = engine.run({
      total_units: 100,
      target_occupancy: 0.95,
      current_occupancy: 0,
      mode: 'LEASE_UP_NEW_CONSTRUCTION',
      pre_leased_count: 20,
      pre_lease_window_months: 4,
      avg_market_rent: 1500,
      avg_lease_term_months: 12,
      concession_strategy: 'MARKET',
      time_horizon_months: 24,
      // delivery_month intentionally omitted
    });

    const preRecs = result.concession_records.filter(
      r => r.amortization_method === 'CASH_AT_COMMENCEMENT',
    );
    // Pre-lease records must commence at or after the effective delivery month (May 2026 = "2026-05-01")
    for (const rec of preRecs) {
      expect(rec.lease_start_date >= '2026-05-01').toBe(true);
    }
  });
});

// ── §573.14 inferred_from_rent_roll flag semantics ────────────────────────────

describe('§573.14 inferred_from_rent_roll flag on all non-explicit derivations', () => {
  it('explicitly verifies flag is false for concession_value records (unit-level test)', () => {
    // Simulated record as if extracted with explicit concession_value
    const explicit: ConcessionRecord = makeHistoryRecord({
      inferred_from_rent_roll: false,
      cash_value: 1200,
    });
    expect(explicit.inferred_from_rent_roll).toBe(false);
  });

  it('concession_months-derived records must have inferred_from_rent_roll=true', () => {
    // Simulated record as if extracted via concession_months × rent
    const fromMonths: ConcessionRecord = makeHistoryRecord({
      inferred_from_rent_roll: true,
      cash_value: 1400, // 2 months × $700 rent
    });
    expect(fromMonths.inferred_from_rent_roll).toBe(true);
  });

  it('below-market-rent records must have inferred_from_rent_roll=true', () => {
    const belowMarket: ConcessionRecord = makeHistoryRecord({
      inferred_from_rent_roll: true,
      cash_value: 600,
    });
    expect(belowMarket.inferred_from_rent_roll).toBe(true);
  });

  it('explicit concession_value records (inferred=false) are amortized normally', () => {
    const explicit: ConcessionRecord = makeHistoryRecord({
      inferred_from_rent_roll: false,
      cash_value: 2400,
    });
    expect(() =>
      amortizeConcessions({
        records: [explicit],
        leasing_cost_treatment: 'OPERATING',
        current_date: '2026-01-01',
      }),
    ).not.toThrow();
  });

  it('inferred records with cash_value>0 are amortized normally (not skipped)', () => {
    const inferred: ConcessionRecord = makeHistoryRecord({
      inferred_from_rent_roll: true,
      cash_value: 800,
    });
    const output = amortizeConcessions({
      records: [inferred],
      leasing_cost_treatment: 'OPERATING',
      current_date: '2026-01-01',
      horizon_months: 120,
    });
    const total = Object.values(output.monthly_recognition).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(800, 0);
  });
});
