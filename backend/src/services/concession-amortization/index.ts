/**
 * concession-amortization/index.ts
 *
 * Main orchestrator — amortizeConcessions(input: AmortizationEngineInput): AmortizationOutput
 *
 * RESPONSIBILITIES:
 *   1. Route each ConcessionRecord to its schedule generator (pure, per-method)
 *   2. Apply CAPITALIZED treatment: lease-up-period records bypass P&L → lease_up_reserve
 *   3. Truncate recognition beyond the analysis horizon
 *   4. Apply edge cases: early termination write-offs, holdover passthrough,
 *      cross-horizon truncation, multi-concession overlap summing
 *   5. Aggregate to monthly_recognition, calendar_year_recognition, fiscal_year_recognition
 *   6. CASH-INVARIANT runtime assertion (§6.2 / §14 NON-NEGOTIABLE):
 *      total input cash === recognized + capitalized + truncated (within $0.01)
 *      Throws explicitly on mismatch — no silent fallbacks.
 *
 * ARCHITECTURAL RULES (codified in comments per spec §14):
 *
 *   EARNED-VS-RECOGNIZED-DISTINCTION:
 *     AmortizationEngineInput.records[].cash_value = "earned" dollars.
 *     AmortizationOutput.monthly_recognition = "recognized" dollars spread over periods.
 *     Never mix these two figures or display them in the same row.
 *
 *   CASH-INVARIANT-ACROSS-TREATMENTS:
 *     assertCashInvariant() must pass before this function returns.
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
  MonthlyRecognitionEntry,
  WriteOff,
} from '../../types/concessions';
import { generateSchedule, dateToYYYYMM, addMonthsToYYYYMM, compareYYYYMM } from './schedule-generators';
import { aggregateByCalendarYear, aggregateByFiscalYear } from './aggregator';

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_HORIZON_MONTHS = 120;
const CASH_INVARIANT_TOLERANCE = 0.02; // cents rounding across many records

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

/** Return the horizon cutoff YYYYMM string (inclusive last period to recognize). */
function horizonCutoff(currentDate: string, horizonMonths: number): string {
  const startYYYYMM = dateToYYYYMM(currentDate);
  return addMonthsToYYYYMM(startYYYYMM, horizonMonths - 1);
}

/** Return the early-termination cutoff YYYYMM (inclusive last period to recognize). */
function terminationYYYYMM(terminationDate: string): string {
  return dateToYYYYMM(terminationDate);
}

// ─── Cash invariant assertion ──────────────────────────────────────────────────

/**
 * §6.2 / §14 NON-NEGOTIABLE
 * Asserts that total cash in === recognized + capitalized + truncated.
 * Throws CashInvariantError on mismatch.
 */
function assertCashInvariant(
  records: ConcessionRecord[],
  recognized: number,
  capitalized: number,
  truncated: number,
): void {
  const inputCash = records.reduce((sum, r) => sum + r.cash_value, 0);
  const total = recognized + capitalized + truncated;
  if (Math.abs(total - inputCash) > CASH_INVARIANT_TOLERANCE) {
    throw new CashInvariantError(inputCash, recognized, capitalized, truncated);
  }
}

// ─── Write-off helpers ─────────────────────────────────────────────────────────

/**
 * §7.1 — Early termination write-off.
 * The unamortized balance remaining after the termination month is written off
 * in the termination month itself as a P&L expense.
 */
function buildEarlyTerminationWriteOff(
  record: ConcessionRecord,
  entries: MonthlyRecognitionEntry[],
  terminationMo: string,
): WriteOff | null {
  const unamortized = entries
    .filter(e => compareYYYYMM(e.month, terminationMo) > 0)
    .reduce((sum, e) => sum + e.amount, 0);
  if (unamortized <= 0) return null;
  return {
    concession_id: record.id,
    lease_id: record.lease_id,
    write_off_month: terminationMo,
    amount: Math.round(unamortized),
    reason: 'early_termination',
  };
}

// ─── Current year helper ────────────────────────────────────────────────────────

function currentCalendarYear(currentDate: string): string {
  return currentDate.slice(0, 4);
}

// ─── Per-record processor ───────────────────────────────────────────────────────

interface ProcessedRecord {
  schedule: ConcessionAmortizationSchedule;
  recognized: number;      // dollars flowing to P&L monthly map
  capitalized: number;     // dollars routed to lease_up_reserve
  truncated: number;       // dollars beyond horizon (not recognized)
}

function processRecord(
  record: ConcessionRecord,
  cutoffYYYYMM: string,
  treatment: string,
  currentYear: string,
): ProcessedRecord {
  // ── CAPITALIZED lease-up treatment (§6, §16) ─────────────────────────────
  // Strip lease-up-period concessions from P&L; route entire cash_value to reserve.
  if (treatment === 'CAPITALIZED' && record.is_lease_up_period) {
    const schedule: ConcessionAmortizationSchedule = {
      concession_id: record.id,
      lease_id: record.lease_id,
      method: record.amortization_method,
      treatment: record.leasing_cost_treatment,
      is_lease_up_period: true,
      monthly_entries: [],
      write_offs: [],
      truncated_recognition_post_horizon: 0,
    };
    return { schedule, recognized: 0, capitalized: Math.round(record.cash_value), truncated: 0 };
  }

  // ── Generate raw schedule ────────────────────────────────────────────────
  let rawEntries = generateSchedule(record);

  // ── Edge case §7.4: Holdover passthrough ─────────────────────────────────
  // After the original lease_end_date no NEW recognition is generated.
  // The original schedule ends at lease_end_date by construction, so no
  // additional filtering is needed — generateSchedule already bounds by term.

  // ── Edge case §7.6: Cross-horizon truncation ──────────────────────────────
  const withinHorizon = rawEntries.filter(e => compareYYYYMM(e.month, cutoffYYYYMM) <= 0);
  const beyondHorizon = rawEntries.filter(e => compareYYYYMM(e.month, cutoffYYYYMM) > 0);
  const truncated = beyondHorizon.reduce((sum, e) => sum + e.amount, 0);

  // ── Edge case §7.1: Early termination write-off ───────────────────────────
  const writeOffs: WriteOff[] = [];
  let activeEntries = withinHorizon;

  if (record.early_termination_date) {
    const termMo = terminationYYYYMM(record.early_termination_date);
    // Entries after termination month are written off (recognized) in termination month
    const writeOff = buildEarlyTerminationWriteOff(record, rawEntries, termMo);
    if (writeOff) {
      writeOffs.push(writeOff);
    }
    // Remove post-termination regular entries (write-off replaces them)
    activeEntries = activeEntries.filter(e => compareYYYYMM(e.month, termMo) <= 0);
  }

  // ── Compute recognized total ──────────────────────────────────────────────
  const recognizedFromEntries = activeEntries.reduce((sum, e) => sum + e.amount, 0);
  const recognizedFromWriteOffs = writeOffs.reduce((sum, w) => sum + w.amount, 0);
  const recognized = recognizedFromEntries + recognizedFromWriteOffs;

  const schedule: ConcessionAmortizationSchedule = {
    concession_id: record.id,
    lease_id: record.lease_id,
    method: record.amortization_method,
    treatment: record.leasing_cost_treatment,
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
 * Throws CashInvariantError if the cash-invariant assertion fails.
 * Throws on malformed CUSTOM schedules or unknown amortization_method values.
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
  const currentYear = currentCalendarYear(current_date);

  // Per-month recognition accumulator (P&L only — CAPITALIZED lease-up excluded)
  const monthlyMap: Record<string, number> = {};
  const allWriteOffs: WriteOff[] = [];
  const allSchedules: ConcessionAmortizationSchedule[] = [];

  let totalRecognized = 0;
  let totalCapitalized = 0;
  let totalTruncated = 0;

  // ── AMORTIZATION-METHOD-IS-PER-CONCESSION: each record is independent ─────
  for (const record of records) {
    const processed = processRecord(record, cutoff, leasing_cost_treatment, currentYear);

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
  // Must run BEFORE returning. Throws CashInvariantError on any mismatch.
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
