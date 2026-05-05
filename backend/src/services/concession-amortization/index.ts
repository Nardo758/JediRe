/**
 * concession-amortization/index.ts
 *
 * Main orchestrator — amortizeConcessions(input: AmortizationEngineInput): AmortizationOutput
 *
 * RESPONSIBILITIES:
 *   1. Route each ConcessionRecord to its schedule generator (pure, per-method)
 *   2. Apply CAPITALIZED treatment: lease-up-period records bypass P&L → lease_up_reserve
 *   3. Apply write-off events in correct priority order (see §7 below)
 *   4. Apply cent-precision rounding throughout (never Math.round to whole dollars)
 *   5. Truncate recognition beyond the analysis horizon
 *   6. Handle all §7 edge cases:
 *        §7.1  early termination write-offs
 *        §7.2  renewal mid-amortization (per-record independence handles this)
 *        §7.4  holdover passthrough (bounded by term in generator)
 *        §7.6  cross-horizon truncation with truncated_recognition_post_horizon
 *        §7.7  multi-concession overlap summing (AMORTIZATION-METHOD-IS-PER-CONCESSION)
 *        §7.8  structural write-offs
 *        §7.9  subject historical records (amortize from lease_start regardless of today)
 *        inferred_from_rent_roll records with cash_value === 0 are skipped gracefully
 *   7. Aggregate monthly_recognition → calendar_year_recognition, fiscal_year_recognition
 *   8. CASH-INVARIANT runtime assertion — TWO LEVELS (§6.2 / §14 NON-NEGOTIABLE):
 *        Level 1 (single-run): recognized + capitalized + truncated === inputCash ±tolerance
 *        Level 2 (cross-treatment): run all 3 treatments, assert cash totals are equal.
 *        Throws CashInvariantError explicitly. No silent fallbacks.
 *
 * WRITE-OFF PRIORITY ORDER (§7.1 + §7.8):
 *   When both early_termination_date and structural_write_off_date are set,
 *   the earlier date governs — only one write-off fires per record.
 *
 * DOUBLE-COUNTING PREVENTION (termination+truncation interaction):
 *   Write-off and truncation are mutually exclusive partitions:
 *     Case A (write-off ≤ horizon): write-off captures entire remainder; truncated=0
 *     Case B (write-off > horizon): no write-off fires; horizon truncation applies
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
 *     amortizeConcessions() explicitly runs all 3 treatments and asserts:
 *       cashTotal(OPERATING) === cashTotal(CAPITALIZED) === cashTotal(HYBRID).
 *     Throws CashInvariantError on any mismatch (cross-treatment).
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
import {
  generateSchedule,
  dateToYYYYMM,
  addMonthsToYYYYMM,
  compareYYYYMM,
  roundCents,
} from './schedule-generators';
import { aggregateByCalendarYear, aggregateByFiscalYear } from './aggregator';

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_HORIZON_MONTHS = 120;
/**
 * Tolerance per record for floating-point cent rounding accumulated across many records.
 * $0.02 per record covers up to 2 one-cent rounding errors per record (generator + aggregator).
 */
const CASH_INVARIANT_TOLERANCE_PER_RECORD = 0.02;

// ─── Error types ───────────────────────────────────────────────────────────────

export class CashInvariantError extends Error {
  constructor(
    public readonly inputCash: number,
    public readonly recognized: number,
    public readonly capitalized: number,
    public readonly truncated: number,
    public readonly context?: string,
  ) {
    const total = recognized + capitalized + truncated;
    super(
      `CASH-INVARIANT VIOLATED${context ? ` (${context})` : ''}: ` +
      `input_cash=${inputCash.toFixed(2)} ` +
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

// ─── Tolerance helper ──────────────────────────────────────────────────────────

function toleranceFor(records: ConcessionRecord[]): number {
  return CASH_INVARIANT_TOLERANCE_PER_RECORD * Math.max(1, records.length);
}

// ─── Effective write-off date ──────────────────────────────────────────────────

/**
 * Determine the effective write-off event for a record.
 * When both early_termination_date and structural_write_off_date are set,
 * the earlier date governs — only one write-off fires per record.
 */
function effectiveWriteOffEvent(
  record: ConcessionRecord,
): { date: string; reason: WriteOff['reason'] } | null {
  const et = record.early_termination_date ?? null;
  const sw = record.structural_write_off_date ?? null;
  if (!et && !sw) return null;
  if (et && !sw) return { date: et, reason: 'early_termination' };
  if (!et && sw) return { date: sw, reason: 'structural' };
  return compareYYYYMM(dateToYYYYMM(et!), dateToYYYYMM(sw!)) <= 0
    ? { date: et!, reason: 'early_termination' }
    : { date: sw!, reason: 'structural' };
}

// ─── Per-record processor ───────────────────────────────────────────────────────

interface ProcessedRecord {
  schedule: ConcessionAmortizationSchedule;
  recognized: number;
  capitalized: number;
  truncated: number;
}

/**
 * Process a single ConcessionRecord and return its schedule + accounting buckets.
 *
 * All monetary values use cent-precision (roundCents) rather than whole-dollar rounding.
 *
 * Termination/truncation ordering (prevents double-counting):
 *   Case A — write-off date ≤ horizon:
 *     activeEntries = entries ≤ write-off month
 *     writeOff = sum(all entries after write-off month)  ← captures horizon-tail too
 *     truncated = 0
 *   Case B — write-off date > horizon (or no write-off):
 *     activeEntries = entries ≤ horizon
 *     truncated = sum(entries > horizon)
 *     writeOff = none
 *
 * RENEWAL MID-AMORTIZATION (§7.2):
 *   Handled by AMORTIZATION-METHOD-IS-PER-CONCESSION: the original concession record
 *   continues to amortize independently until its lease_end_date or write-off event.
 *   A new ConcessionRecord for the renewal is submitted separately.
 */
function processRecord(
  record: ConcessionRecord,
  cutoffYYYYMM: string,
  runtimeTreatment: LeasingCostTreatment,
): ProcessedRecord {
  // ── CAPITALIZED lease-up treatment (§6, §16) ─────────────────────────────
  if (runtimeTreatment === 'CAPITALIZED' && record.is_lease_up_period) {
    const schedule: ConcessionAmortizationSchedule = {
      concession_id: record.id,
      lease_id: record.lease_id,
      method: record.amortization_method,
      treatment: runtimeTreatment,
      is_lease_up_period: true,
      monthly_entries: [],
      write_offs: [],
      truncated_recognition_post_horizon: 0,
    };
    return {
      schedule,
      recognized: 0,
      capitalized: roundCents(record.cash_value),
      truncated: 0,
    };
  }

  // ── §7.9: inferred zero-value skip ────────────────────────────────────────
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
      // Case A: write-off within horizon
      activeEntries = rawEntries.filter(e => compareYYYYMM(e.month, writeOffMo) <= 0);
      const unamortized = roundCents(
        rawEntries
          .filter(e => compareYYYYMM(e.month, writeOffMo) > 0)
          .reduce((sum, e) => sum + e.amount, 0),
      );
      if (unamortized > 0) {
        writeOffs.push({
          concession_id: record.id,
          lease_id: record.lease_id,
          write_off_month: writeOffMo,
          amount: unamortized,
          reason: writeOffEvent.reason,
        });
      }
      truncated = 0;
    } else {
      // Case B: write-off beyond horizon — treat as truncation only
      activeEntries = rawEntries.filter(e => compareYYYYMM(e.month, cutoffYYYYMM) <= 0);
      truncated = roundCents(
        rawEntries
          .filter(e => compareYYYYMM(e.month, cutoffYYYYMM) > 0)
          .reduce((sum, e) => sum + e.amount, 0),
      );
    }
  } else {
    activeEntries = rawEntries.filter(e => compareYYYYMM(e.month, cutoffYYYYMM) <= 0);
    truncated = roundCents(
      rawEntries
        .filter(e => compareYYYYMM(e.month, cutoffYYYYMM) > 0)
        .reduce((sum, e) => sum + e.amount, 0),
    );
  }

  const recognizedFromEntries = roundCents(activeEntries.reduce((sum, e) => sum + e.amount, 0));
  const recognizedFromWriteOffs = roundCents(writeOffs.reduce((sum, w) => sum + w.amount, 0));
  const recognized = roundCents(recognizedFromEntries + recognizedFromWriteOffs);

  const schedule: ConcessionAmortizationSchedule = {
    concession_id: record.id,
    lease_id: record.lease_id,
    method: record.amortization_method,
    treatment: runtimeTreatment,
    is_lease_up_period: record.is_lease_up_period,
    monthly_entries: activeEntries,
    write_offs: writeOffs,
    truncated_recognition_post_horizon: truncated,
  };

  return { schedule, recognized, capitalized: 0, truncated };
}

// ─── Cash invariant helpers ────────────────────────────────────────────────────

interface TreatmentTotals {
  treatment: LeasingCostTreatment;
  recognized: number;
  capitalized: number;
  truncated: number;
  cashTotal: number;
}

/**
 * Compute accounting totals for a specific treatment without running the full
 * orchestrator. Used by the cross-treatment invariant assertion to avoid recursion.
 */
function computeTotalsForTreatment(
  records: ConcessionRecord[],
  treatment: LeasingCostTreatment,
  cutoff: string,
): TreatmentTotals {
  let recognized = 0;
  let capitalized = 0;
  let truncated = 0;
  for (const record of records) {
    const p = processRecord(record, cutoff, treatment);
    recognized = roundCents(recognized + p.recognized);
    capitalized = roundCents(capitalized + p.capitalized);
    truncated = roundCents(truncated + p.truncated);
  }
  return {
    treatment,
    recognized,
    capitalized,
    truncated,
    cashTotal: roundCents(recognized + capitalized + truncated),
  };
}

/**
 * §6.2 / §14 NON-NEGOTIABLE — Level 1: single-run bucket balance.
 * Asserts: sum(input cash_values) === recognized + capitalized + truncated.
 */
function assertSingleRunInvariant(
  records: ConcessionRecord[],
  recognized: number,
  capitalized: number,
  truncated: number,
): void {
  const inputCash = roundCents(records.reduce((sum, r) => sum + r.cash_value, 0));
  const total = roundCents(recognized + capitalized + truncated);
  const tolerance = toleranceFor(records);
  if (Math.abs(total - inputCash) > tolerance) {
    throw new CashInvariantError(inputCash, recognized, capitalized, truncated, 'single-run');
  }
}

/**
 * §6.2 / §14 NON-NEGOTIABLE — Level 2: explicit cross-treatment equality.
 * Runs all three treatments and asserts:
 *   cashTotal(OPERATING) === cashTotal(CAPITALIZED) === cashTotal(HYBRID)
 *
 * This directly implements the spec requirement:
 *   assert(cashTotal_OPERATING === cashTotal_CAPITALIZED === cashTotal_HYBRID)
 *
 * Note: each treatment routes dollars differently (P&L vs capitalized) but the
 * SUM (recognized + capitalized + truncated) must be identical across all three.
 */
function assertCrossTreatmentInvariant(
  records: ConcessionRecord[],
  cutoff: string,
): void {
  if (records.length === 0) return;
  const treatments: LeasingCostTreatment[] = ['OPERATING', 'CAPITALIZED', 'HYBRID'];
  const totals = treatments.map(t => computeTotalsForTreatment(records, t, cutoff));
  const reference = totals[0].cashTotal; // OPERATING as reference
  const tolerance = toleranceFor(records);
  for (const t of totals.slice(1)) {
    if (Math.abs(t.cashTotal - reference) > tolerance) {
      throw new CashInvariantError(
        reference,
        t.recognized,
        t.capitalized,
        t.truncated,
        `cross-treatment: OPERATING=${reference.toFixed(2)} vs ${t.treatment}=${t.cashTotal.toFixed(2)}`,
      );
    }
  }
}

// ─── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * amortizeConcessions — primary entry point.
 *
 * Processes all ConcessionRecord inputs and produces a fully-populated
 * AmortizationOutput. Runs both levels of the cash-invariant assertion:
 *   Level 1: bucket balance for the requested treatment.
 *   Level 2: cross-treatment equality (OPERATING = CAPITALIZED = HYBRID).
 *
 * Throws CashInvariantError on any invariant violation.
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

  // Per-month recognition accumulator (P&L only)
  const monthlyMap: Record<string, number> = {};
  const allWriteOffs: WriteOff[] = [];
  const allSchedules: ConcessionAmortizationSchedule[] = [];

  let totalRecognized = 0;
  let totalCapitalized = 0;
  let totalTruncated = 0;

  // ── AMORTIZATION-METHOD-IS-PER-CONCESSION ────────────────────────────────
  for (const record of records) {
    const processed = processRecord(record, cutoff, leasing_cost_treatment);

    allSchedules.push(processed.schedule);
    allWriteOffs.push(...processed.schedule.write_offs);

    totalRecognized = roundCents(totalRecognized + processed.recognized);
    totalCapitalized = roundCents(totalCapitalized + processed.capitalized);
    totalTruncated = roundCents(totalTruncated + processed.truncated);

    for (const entry of processed.schedule.monthly_entries) {
      monthlyMap[entry.month] = roundCents((monthlyMap[entry.month] ?? 0) + entry.amount);
    }
    for (const wo of processed.schedule.write_offs) {
      monthlyMap[wo.write_off_month] = roundCents((monthlyMap[wo.write_off_month] ?? 0) + wo.amount);
    }
  }

  // ── §6.2 / §14 Level 1: single-run bucket balance ────────────────────────
  assertSingleRunInvariant(records, totalRecognized, totalCapitalized, totalTruncated);

  // ── §6.2 / §14 Level 2: explicit cross-treatment equality ─────────────────
  // assert(cashTotal_OPERATING === cashTotal_CAPITALIZED === cashTotal_HYBRID)
  assertCrossTreatmentInvariant(records, cutoff);

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const calendarYearRecognition = aggregateByCalendarYear(monthlyMap);
  const fiscalYearRecognition = aggregateByFiscalYear(monthlyMap, fiscal_year_start_month);

  // ── Write-offs year-to-date ───────────────────────────────────────────────
  const writeOffsYTD = roundCents(
    allWriteOffs
      .filter(wo => wo.write_off_month.slice(0, 4) === currentYear)
      .reduce((sum, wo) => sum + wo.amount, 0),
  );

  return {
    schedules: allSchedules,
    monthly_recognition: monthlyMap,
    calendar_year_recognition: calendarYearRecognition,
    fiscal_year_recognition: fiscalYearRecognition,
    lease_up_reserve_required: roundCents(totalCapitalized),
    write_offs: allWriteOffs,
    write_offs_year_to_date: writeOffsYTD,
    computed_at: new Date().toISOString(),
  };
}

export { aggregateByCalendarYear, aggregateByFiscalYear } from './aggregator';
export { generateSchedule, FRONT_LOADED_CURVE_12MO } from './schedule-generators';
export type { AmortizationEngineInput, AmortizationOutput, ConcessionRecord } from '../../types/concessions';
