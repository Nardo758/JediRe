/**
 * runFullModel — Pure full-model runner (engine public boundary)
 *
 * Orchestrates: M11 debt optimizer → optional M14 risk adjustments → final
 * deterministic model → integrity checks.
 *
 * Pure: no DB reads, no side effects. Same input → same output.
 * The service layer fetches M14 data from dataFlowRouter and passes it as
 * the `m14Data` parameter; this module never touches the DB.
 */

import type { ModelAssumptions, ModelResults, IntegrityCheck } from './deterministic-model-runner';
import { runModel, runIntegrityChecks } from './deterministic-model-runner';
import {
  runM11Cycle,
  type M11CycleResult,
  type M14AdjustmentResult,
} from '../module-wiring/capital-structure-adapter';

export interface M14DataInput {
  capRateAdjBps?: number;
  reserveOverrides?: Record<string, number>;
  dscrFloor?: number;
}

export interface RunFullModelOptions {
  skipSensitivity?: boolean;
  maxM11Iter?: number;
  m14Data?: M14DataInput;
}

export interface RunFullModelResult {
  result: ModelResults;
  adjustedAssumptions: ModelAssumptions;
  integrityChecks: IntegrityCheck[];
  m11Iterations: number;
  m11Converged: boolean;
  m14Applied: boolean;
  m14CapRateAdjBps: number;
  m14DscrFloor: number;
  m11Warnings: IntegrityCheck[];
}

/**
 * Pure version of M14 risk adjustments — takes data as parameter instead of
 * reading from dataFlowRouter. Called by runFullModel().
 *
 * Hidden-dependency finding: the impure applyM14RiskAdjustments() reads
 * dataFlowRouter.getModuleData('M14', dealId) inside the adapter. By
 * extracting the pure logic here, runFullModel() stays deterministic and
 * testable — the service layer is responsible for fetching and injecting
 * m14Data.
 */
export function applyM14AdjustmentsPure(
  assumptions: ModelAssumptions,
  m14Data: M14DataInput,
): M14AdjustmentResult {
  const dscrFloor: number =
    typeof m14Data?.dscrFloor === 'number' && m14Data.dscrFloor > 0
      ? m14Data.dscrFloor
      : 1.25;

  if (
    (m14Data.capRateAdjBps == null || m14Data.capRateAdjBps === 0) &&
    (m14Data.reserveOverrides?.replacementReserves == null)
  ) {
    return { assumptions, applied: false, capRateAdjBps: 0, dscrFloor };
  }

  const capRateAdjBps: number = m14Data.capRateAdjBps ?? 0;
  const reserveOverrides: Record<string, number> = m14Data.reserveOverrides ?? {};

  const updated: ModelAssumptions = { ...assumptions };
  if (capRateAdjBps !== 0) {
    updated.exitCap = assumptions.exitCap + capRateAdjBps / 10000;
  }
  if (reserveOverrides.replacementReserves != null) {
    updated.replacementReserves = reserveOverrides.replacementReserves;
  }
  return { assumptions: updated, applied: true, capRateAdjBps, dscrFloor };
}

/**
 * Pure full-model runner: M11 debt optimizer + optional M14 adjustments +
 * equity reconciliation + final model run + integrity checks.
 *
 * Canonical orchestration (single mutation zone):
 *   pass-1 runModel() → M11 cycle (sized from pass-1 NOI) → M14 pure adjustments
 *   → equity reconciliation from FINAL loan+cost → pass-2 runModel()
 *   → assemble once → runIntegrityChecks on final result.
 *
 * One mutation zone. One reconciliation after it. One validation after that.
 * Anything derived from mutable state is computed after the LAST mutation.
 *
 * No DB reads. Deterministic: same input → same output.
 */
export function runFullModel(
  assumptions: ModelAssumptions,
  options: RunFullModelOptions = {},
): RunFullModelResult {
  const { skipSensitivity = false, maxM11Iter = 3, m14Data } = options;

  // ── pass-1: initial model run ──────────────────────────────────────────
  // M11 sizes debt from computed NOI. Without pass-1, getRecommendedTerms is
  // starved and the constraint never binds, so the initial loan passes through
  // unchanged (Defect A).
  const pass1: ModelResults = runModel(assumptions, { skipSensitivity });

  // ── Z: wire monthsToStabilize from pass-1 actual stabilization profile ──
  // For lease-up deals, B5 IO derivation keys on this field.  When absent
  // (M07 data not available), derive it from pass-1 annual occupancy rows so
  // the IO period reflects the true lease-up profile rather than a silent
  // platform default.  Log loudly when neither source produces a value.
  let stabAssumptions: ModelAssumptions = assumptions;
  if (assumptions.dealMode === 'lease_up' &&
      (assumptions.monthsToStabilize == null || assumptions.monthsToStabilize <= 0)) {
    const stabOcc = 1 - assumptions.vacancyStab;
    // pass-1 annualCashFlow rows carry per-year occupancy; find first year at/
    // above the stabilized band (same -0.01 tolerance used by the monthly path).
    const stabYearIdx = pass1.annualCashFlow.findIndex(r => r.occupancy >= stabOcc - 0.01);
    let derived: number;
    if (stabYearIdx >= 0) {
      // Convert year-index (0-based) to months: first full 12-month block that
      // contains or follows the stabilization crossing. IO periods are sized in
      // 12-month increments, so rounding up is conservative and safe.
      derived = (stabYearIdx + 1) * 12;
    } else {
      // True fallback — pass-1 never crossed the stabilized band within the hold.
      derived = 12;
      console.warn(
        '[Z] monthsToStabilize defaulted to 12 — no stabilization month from engine ' +
        '(pass-1 annual rows never reached stabilized occupancy target of ' +
        `${(stabOcc * 100).toFixed(1)}%). IO period may be understated for lease-up deal.`
      );
    }
    stabAssumptions = { ...assumptions, monthsToStabilize: derived };
  }

  // ── M11 Debt Optimizer (sized from pass-1 computed NOI) ──────────────
  const noiY1 = pass1.summary.noiYear1;
  const m11: M11CycleResult = runM11Cycle(stabAssumptions, noiY1, maxM11Iter);
  let adjusted: ModelAssumptions = m11.assumptions;
  const m11Warnings: IntegrityCheck[] = [];
  if (!m11.converged) {
    m11Warnings.push({
      id: 'capital_stack_unconverged',
      status: 'warn',
      message: `M11 debt optimizer did not converge after ${m11.iterations} iterations`,
    });
  }

  // ── M14 Risk Adjustments (pure, data passed as parameter) ──────────────
  let m14Applied = false;
  let m14CapRateAdjBps = 0;
  let m14DscrFloor = 1.25;
  if (m14Data) {
    const m14: M14AdjustmentResult = applyM14AdjustmentsPure(adjusted, m14Data);
    adjusted = m14.assumptions;
    m14Applied = m14.applied;
    m14CapRateAdjBps = m14.capRateAdjBps;
    m14DscrFloor = m14.dscrFloor;
  }

  // ── Equity reconciliation from FINAL loan + FINAL cost ───────────────
  // After all mutations (M11 loan resize + M14 cost adjustments), derive
  // totalEquity from totalAcqCost − loanAmount so staleness is structurally
  // impossible. The residual must be zero by construction, not tolerance.
  // LP/GP split rule: preserve the ORIGINAL ratio from the input assumptions.
  {
    const costResult: ModelResults = runModel(adjusted, { skipSensitivity: true });
    const totalAcqCost = costResult.capital.metrics.totalCost;
    const newTotalEquity = totalAcqCost - adjusted.loanAmount;
    const originalTotalEquity = assumptions.lpEquity + assumptions.gpEquity;
    if (originalTotalEquity > 0) {
      const lpRatio = assumptions.lpEquity / originalTotalEquity;
      adjusted = {
        ...adjusted,
        lpEquity: newTotalEquity * lpRatio,
        gpEquity: newTotalEquity * (1 - lpRatio),
      };
    } else {
      adjusted = {
        ...adjusted,
        lpEquity: newTotalEquity,
        gpEquity: 0,
      };
    }
  }

  // ── pass-2: final model run with fully adjusted assumptions ────────────
  const result: ModelResults = runModel(adjusted, { skipSensitivity });

  // ── Integrity checks on the FINAL result (post-M11/M14/reconciliation) ──
  const integrityChecks: IntegrityCheck[] = runIntegrityChecks(adjusted, result);

  return {
    result,
    adjustedAssumptions: adjusted,
    integrityChecks,
    m11Iterations: m11.iterations,
    m11Converged: m11.converged,
    m14Applied,
    m14CapRateAdjBps,
    m14DscrFloor,
    m11Warnings,
  };
}
