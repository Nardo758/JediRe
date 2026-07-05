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
 * final model run + integrity checks.
 *
 * No DB reads. Deterministic: same input → same output.
 */
export function runFullModel(
  assumptions: ModelAssumptions,
  options: RunFullModelOptions = {},
): RunFullModelResult {
  const { skipSensitivity = false, maxM11Iter = 3, m14Data } = options;

  // ── M11 Debt Optimizer ─────────────────────────────────────────────────
  const m11: M11CycleResult = runM11Cycle(assumptions, maxM11Iter);
  let adjusted: ModelAssumptions = m11.assumptions;
  const m11Warnings: IntegrityCheck[] = [];
  if (!m11.converged) {
    m11Warnings.push({
      id: 'capital_stack_unconverged',
      status: 'warn',
      message: `M11 debt optimizer did not converge after ${m11.iterations} iterations`,
    });
  }

  // ── M14 Risk Adjustments (pure, data passed as parameter) ────────────────
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

  // ── Final deterministic run ────────────────────────────────────────────
  const result: ModelResults = runModel(adjusted, { skipSensitivity });

  // ── Integrity checks on the FINAL result (post-M11/M14) ────────────────
  // Forensic: previously runIntegrityChecks was called only on the pre-M11
  // result, so post-M11 equity divergence (Finding O) was never evaluated.
  // Moving the check here ensures the resized loan + recomputed equity are
  // validated.
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
