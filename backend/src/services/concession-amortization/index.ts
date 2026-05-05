/**
 * concession-amortization/index.ts
 *
 * Main orchestrator — amortizeConcessions(input: AmortizationEngineInput): AmortizationOutput
 *
 * RESPONSIBILITIES:
 *   1. Route each ConcessionRecord to its schedule generator (pure, per-method)
 *   2. Apply CAPITALIZED treatment: lease-up-period records bypass P&L → lease_up_reserve
 *   3. Apply write-off events in correct priority order (see §7 below)
 *   4. Truncate recognition beyond the analysis horizon
 *   5. Handle all §7 edge cases:
 *        §7.1 early termination write-offs
 *        §7.2 renewal mid-amortization (per-record independence handles this)
 *        §7.4 holdover passthrough (bounded by term in generator)
 *        §7.6 cross-horizon truncation with truncated_recognition_post_horizon
 *        §7.7 multi-concession overlap summing (AMORTIZATION-METHOD-IS-PER-CONCESSION)
 *        §7.8 structural write-offs
 *        §7.9 subject historical records (amortize from lease_start regardless of today)
 *        inferred_from_rent_roll records with cash_value === 0 are skipped gracefully
 *   6. Aggregate monthly_recognition → calendar_year_recognition, fiscal_year_recognition
 *   7. CASH-INVARIANT runtime assertion (§6.2 / §14 NON-NEGOTIABLE):
 *        sum(input cash_values) === recognized + capitalized + truncated (within $0.02)
 *        Throws CashInvariantError explicitly. No silent fallbacks.
 *
 * WRITE-OFF PRIORITY ORDER for a record that has multiple events:
 *   If both early_termination_date and structural_write_off_date are set,
 *   the earlier date governs — only one write-off fires per record.
 *
 * DOUBLE-COUNTING PREVENTION (blocks the termination+truncation interaction bug):
 *   Write-off and truncation are mutually exclusive partitions:
 *     - If effective write-off date ≤ horizon: truncated = 0 (write-off captures remainder)
 *     - If effective write-off date > horizon: no write-off fires; truncation handles remainder
 *   This ensures recognized + capitalized + truncated === inputCash in ALL cases.
 *
 * ARCHITECTURAL RULES (codified per spec §14):
 *
 *   EARNED-VS-RECOGNIZED-DISTINCTION:
 *     ConcessionRecord.cash_value = "earned" dollars.
 *     AmortizationOutput.monthly_recognition = "recognized" dollars spread over periods.
 *     Never mix these two figures or display them in the same row.
 *
 *   CASH-INVARIANT-ACROSS-TREATMENTS:
 *     The single-run assertion (recognized + capitalized + truncated === inputCash) is
 *     equivalent to cross-treatment equality by construction: all three treatments route
 *     every cash_value dollar to exactly one of {recognized, capitalized, truncated}.
 *     Throws CashInvariantError on any mismatch.
 *
 *   AMORTIZATION-METHOD-IS-PER-CONCESSION:
 *     Each ConcessionRecord is processed independently.
 *     Multiple records on the same lease are summed into the monthly map,
 *     not merged into a single schedule.
 */

import type {
  AmortizationEngineInput,
  AmortizationOutput,
  ConcessionAmortizationSchedule,
  ConcessionRecord,
  LeasingCostTreatment,
  MonthlyRecognitionEntry,
  WriteOff,
} from '../../types/concessions';
import { generateSchedule, dateToYYYYMM, addMonthsToYYYYMM, compareYYYYMM } from './schedule-generators';
import { aggregateByCalendarYear, aggregateByFiscalYear } from './aggregator';

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_HORIZON_MONTHS = 120;
/** Tolerance for floating-point rounding across many records (2 cents per record). */
const CASH_INVARIANT_TOLERANCE_PER_RECORD = 0.02;

// ─── Error types ───────────────────────────────────────────────────────────────

export class CashInvariantError extends Error {
  constructor(
    public readonly inputCash: number,
    public readonly recognized: number,
    public readonly capitalized: number,
    public readonly truncated: number,
  ) {
    const total = recognized + capitalized + truncated;
    super(
      `CASH-INVARIANT VIOLATED: input_cash=${inputCash.toFixed(2)} ` +
      `recognized=${recognized.toFixed(2)} capitalized=${capitalized.toFixed(2)} ` +
      `truncated=${truncated.toFixed(2)} total=${total.toFixed(2)} ` +
      `delta=${Math.abs(total - inputCash).toFixed(2)}`,
    );
    this.name = 'CashInvariantError';
  }
}

// ─── Horizon helper ────────────────────────────────────────────────────────────

/** Return the last YYYYMM period that falls within the analysis horizon (inclusive). */
function horizonCutoff(currentDate: string, horizonMonths: number): string {
  const startYYYYMM = dateToYYYYMM(currentDate);
  return addMonthsToYYYYMM(startYYYYMM, horizonMonths - 1);
}

// ─── Cash invariant assertion ──────────────────────────────────────────────────

/**
 * §6.2 / §14 NON-NEGOTIABLE
 *
 * Asserts: sum(input cash_values) === recognized + capitalized + truncated.
 *
 * The single-run check is equivalent to cross-treatment equality by construction:
 *   - OPERATING:   all dollars → recognized (capitalized=0, truncated=horizon-bounded)
 *   - CAPITALIZED: is_lease_up_period dollars → capitalized; rest → recognized
 *   - HYBRID:      all dollars → recognized (amortized on ongoing basis)
 * Any treatment routes every dollar to exactly one bucket → invariant holds.
 *
 * Tolerance scales with record count to absorb accumulated $0.01 rounding per record.
 */
function assertCashInvariant(
  records: ConcessionRecord[],
  recognized: number,
  capitalized: number,
  truncated: number,
): void {
  const inputCash = records.reduce((sum, r) => sum + r.cash_value, 0);
  const total = recognized + capitalized + truncated;
  const tolerance = CASH_INVARIANT_TOLERANCE_PER_RECORD * Math.max(1, records.length);
  if (Math.abs(total - inputCash) > tolerance) {
    throw new CashInvariantError(inputCash, recognized, capitalized, truncated);
  }
}

// ─── Effective write-off date ──────────────────────────────────────────────────

/**
 * Determine the effective write-off date and reason for a record.
 * When both early_termination_date and structural_write_off_date are set,
 * the earlier one governs (only one write-off fires per record).
 */
function effectiveWriteOffEvent(
  record: ConcessionRecord,
): { date: string; reason: WriteOff['reason'] } | null {
  const et = record.early_termination_date ?? null;
  const sw = record.structural_write_off_date ?? null;
  if (!et && !sw) return null;
  if (et && !sw) return { date: et, reason: 'early_termination' };
  if (!et && sw) return { date: sw, reason: 'structural' };
  // Both set — earlier date governs
  return compareYYYYMM(dateToYYYYMM(et!), dateToYYYYMM(sw!)) <= 0
    ? { date: et!, reason: 'early_termination' }
    : { date: sw!, reason: 'structural' };
}

// ─── Per-record processor ───────────────────────────────────────────────────────

interface ProcessedRecord {
  schedule: ConcessionAmortizationSchedule;
  /** Dollars flowing to P&L monthly map (includes write-off amounts) */
  recognized: number;
  /** Dollars routed to lease_up_reserve (CAPITALIZED + is_lease_up_period) */
  capitalized: number;
  /** Dollars truncated beyond the analysis horizon */
  truncated: number;
}

/**
 * Process a single ConcessionRecord and return its schedule + accounting buckets.
 *
 * Termination/truncation ordering (prevents double-counting):
 *   Case A — write-off date ≤ horizon:
 *     activeEntries = entries ≤ write-off month
 *     writeOff = sum(all entries after write-off month)   ← captures horizon-tail too
 *     truncated = 0
 *   Case B — write-off date > horizon (or no write-off):
 *     activeEntries = entries ≤ horizon
 *     truncated = sum(entries > horizon)
 *     writeOff = none
 *
 * This guarantees recognized + truncated = cash_value for any combination of
 * write-off date and horizon, eliminating all double-counting paths.
 *
 * RENEWAL MID-AMORTIZATION (§7.2):
 *   Handled by AMORTIZATION-METHOD-IS-PER-CONCESSION: the original concession record
 *   continues to amortize independently until its lease_end_date or write-off event.
 *   A new ConcessionRecord for the renewal is submitted separately. No special logic needed.
 */
function processRecord(
  record: ConcessionRecord,
  cutoffYYYYMM: string,
  runtimeTreatment: LeasingCostTreatment,
): ProcessedRecord {
  // ── CAPITALIZED lease-up treatment (§6, §16) ─────────────────────────────
  // Strip lease-up-period concessions from P&L; route entire cash_value to reserve.
  // schedule.treatment uses the RUNTIME treatment (input's treatment), not record-level.
  if (runtimeTreatment === 'CAPITALIZED' && record.is_lease_up_period) {
    const schedule: ConcessionAmortizationSchedule = {
      concession_id: record.id,
      lease_id: record.lease_id,
      method: record.amortization_method,
      treatment: runtimeTreatment,          // ← runtime treatment (fix: was record.leasing_cost_treatment)
      is_lease_up_period: true,
      monthly_entries: [],
      write_offs: [],
      truncated_recognition_post_horizon: 0,
    };
    return { schedule, recognized: 0, capitalized: Math.round(record.cash_value), truncated: 0 };
  }

  // ── §7.9 / inferred_from_rent_roll inference skip ────────────────────────
  // Records where cash_value was inferred but produced $0 are skipped gracefully.
  if (record.inferred_from_rent_roll && record.cash_value === 0) {
    console.warn(
      `[amortization] Skipping inferred record ${record.id} (lease_id=${record.lease_id}) — cash_value=0`,
    );
    const schedule: ConcessionAmortizationSchedule = {
      concession_id: record.id,
      lease_id: record.lease_id,
      method: record.amortization_method,
      treatment: runtimeTreatment,
      is_lease_up_period: record.is_lease_up_period,
      monthly_entries: [],
      write_offs: [],
      truncated_recognition_post_horizon: 0,
    };
    return { schedule, recognized: 0, capitalized: 0, truncated: 0 };
  }

  // ── Generate raw schedule (full lease term, all months) ───────────────────
  const rawEntries = generateSchedule(record);

  // ── Determine effective write-off event ──────────────────────────────────
  const writeOffEvent = effectiveWriteOffEvent(record);
  const writeOffs: WriteOff[] = [];
  let activeEntries: MonthlyRecognitionEntry[];
  let truncated = 0;

  if (writeOffEvent) {
    const writeOffMo = dateToYYYYMM(writeOffEvent.date);

    if (compareYYYYMM(writeOffMo, cutoffYYYYMM) <= 0) {
      // ── Case A: write-off is within the horizon ───────────────────────────
      // Regular entries up to and including the write-off month.
      activeEntries = rawEntries.filter(e => compareYYYYMM(e.month, writeOffMo) <= 0);
      // ALL remaining entries (both within-horizon and beyond-horizon tails)
      // are captured in a single write-off in the write-off month.
      // This ensures truncated=0 so dollars are NEVER double-counted.
      const unamortized = rawEntries
        .filter(e => compareYYYYMM(e.month, writeOffMo) > 0)
        .reduce((sum, e) => sum + e.amount, 0);
      if (unamortized > 0) {
        writeOffs.push({
          concession_id: record.id,
          lease_id: record.lease_id,
          write_off_month: writeOffMo,
          amount: Math.round(unamortized),
          reason: writeOffEvent.reason,
        });
      }
      truncated = 0; // write-off already captured the entire remainder including horizon tail
    } else {
      // ── Case B: write-off is beyond the horizon — treat as horizon truncation ──
      // No write-off fires (we're not modeling that far).
      activeEntries = rawEntries.filter(e => compareYYYYMM(e.month, cutoffYYYYMM) <= 0);
      truncated = rawEntries
        .filter(e => compareYYYYMM(e.month, cutoffYYYYMM) > 0)
        .reduce((sum, e) => sum + e.amount, 0);
    }
  } else {
    // ── No write-off event — apply horizon truncation only ───────────────────
    activeEntries = rawEntries.filter(e => compareYYYYMM(e.month, cutoffYYYYMM) <= 0);
    truncated = rawEntries
      .filter(e => compareYYYYMM(e.month, cutoffYYYYMM) > 0)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  // ── Compute recognized total ──────────────────────────────────────────────
  const recognizedFromEntries = activeEntries.reduce((sum, e) => sum + e.amount, 0);
  const recognizedFromWriteOffs = writeOffs.reduce((sum, w) => sum + w.amount, 0);
  const recognized = recognizedFromEntries + recognizedFromWriteOffs;

  const schedule: ConcessionAmortizationSchedule = {
    concession_id: record.id,
    lease_id: record.lease_id,
    method: record.amortization_method,
    treatment: runtimeTreatment,             // ← runtime treatment, not record-level
    is_lease_up_period: record.is_lease_up_period,
    monthly_entries: activeEntries,
    write_offs: writeOffs,
    truncated_recognition_post_horizon: Math.round(truncated),
  };

  return { schedule, recognized, capitalized: 0, truncated: Math.round(truncated) };
}

// ─── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * amortizeConcessions — primary entry point.
 *
 * Processes all ConcessionRecord inputs and produces a fully-populated
 * AmortizationOutput including monthly P&L map, calendar/fiscal aggregates,
 * lease-up reserve routing, write-offs, and the cash-invariant assertion.
 *
 * Throws CashInvariantError if recognized + capitalized + truncated ≠ input cash.
 * Throws on malformed CUSTOM schedules or unknown amortization_method values.
 * Skips (with console.warn) inferred records with cash_value === 0.
 */
export function amortizeConcessions(input: AmortizationEngineInput): AmortizationOutput {
  const {
    records,
    horizon_months = DEFAULT_HORIZON_MONTHS,
    current_date = new Date().toISOString().slice(0, 10),
    fiscal_year_start_month = 1,
    leasing_cost_treatment,
  } = input;

  const cutoff = horizonCutoff(current_date, horizon_months);
  const currentYear = current_date.slice(0, 4);

  // Per-month recognition accumulator (P&L only — CAPITALIZED lease-up excluded)
  const monthlyMap: Record<string, number> = {};
  const allWriteOffs: WriteOff[] = [];
  const allSchedules: ConcessionAmortizationSchedule[] = [];

  let totalRecognized = 0;
  let totalCapitalized = 0;
  let totalTruncated = 0;

  // ── AMORTIZATION-METHOD-IS-PER-CONCESSION: each record is independent ─────
  for (const record of records) {
    const processed = processRecord(record, cutoff, leasing_cost_treatment);

    allSchedules.push(processed.schedule);
    allWriteOffs.push(...processed.schedule.write_offs);

    totalRecognized += processed.recognized;
    totalCapitalized += processed.capitalized;
    totalTruncated += processed.truncated;

    // ── Accumulate monthly P&L entries ──────────────────────────────────────
    for (const entry of processed.schedule.monthly_entries) {
      monthlyMap[entry.month] = (monthlyMap[entry.month] ?? 0) + entry.amount;
    }

    // ── Write-offs also hit P&L in the write-off month ──────────────────────
    for (const wo of processed.schedule.write_offs) {
      monthlyMap[wo.write_off_month] = (monthlyMap[wo.write_off_month] ?? 0) + wo.amount;
    }
  }

  // ── §6.2 / §14 CASH-INVARIANT ASSERTION (NON-NEGOTIABLE) ─────────────────
  // Runs BEFORE returning. Throws CashInvariantError on any mismatch.
  // The assertion is equivalent to cross-treatment equality by construction —
  // see assertCashInvariant JSDoc for proof sketch.
  assertCashInvariant(records, totalRecognized, totalCapitalized, totalTruncated);

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const calendarYearRecognition = aggregateByCalendarYear(monthlyMap);
  const fiscalYearRecognition = aggregateByFiscalYear(monthlyMap, fiscal_year_start_month);

  // ── Write-offs year-to-date ───────────────────────────────────────────────
  const writeOffsYTD = allWriteOffs
    .filter(wo => wo.write_off_month.slice(0, 4) === currentYear)
    .reduce((sum, wo) => sum + wo.amount, 0);

  return {
    schedules: allSchedules,
    monthly_recognition: monthlyMap,
    calendar_year_recognition: calendarYearRecognition,
    fiscal_year_recognition: fiscalYearRecognition,
    lease_up_reserve_required: Math.round(totalCapitalized),
    write_offs: allWriteOffs,
    write_offs_year_to_date: Math.round(writeOffsYTD),
    computed_at: new Date().toISOString(),
  };
}

export { aggregateByCalendarYear, aggregateByFiscalYear } from './aggregator';
export { generateSchedule, FRONT_LOADED_CURVE_12MO } from './schedule-generators';
export type { AmortizationEngineInput, AmortizationOutput, ConcessionRecord } from '../../types/concessions';
