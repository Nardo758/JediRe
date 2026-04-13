/**
 * M08 Strategy Output Service — Debt Advisor Contract Adapter
 *
 * Adapts the M08 v2 Strategies contract for the Debt Advisor formulator.
 * Delegates to getPrimaryStrategyForDeal() from the M08 v2 strategies
 * service — the same function that backs GET /api/v1/deals/:dealId/strategies.
 *
 * The formulator calls this function instead of making an HTTP call
 * (same process, same function — no round-trip needed).
 * Returns null when no M08 strategy_analyses entry exists for the deal.
 *
 * strategyDrivers extracts phase-driving inputs directly from M08 v2 outputs
 * (assumptions + roiMetrics) so the formulator can be driven by M08 plan
 * parameters rather than solely relying on slug-to-static-mapping fallbacks.
 */
import { Pool } from 'pg';
import { getPrimaryStrategyForDeal } from '../m08-strategies.service';

export interface M08StrategyDrivers {
  holdMonths: number | null;
  targetLtv: number | null;
  targetDscr: number | null;
  triggerOccupancy: number | null;
  exitCapRate: number | null;
  targetIrr: number | null;
  phase2Product: string | null;
  phase2TriggerMonth: number | null;
}

export interface M08StrategyOutput {
  strategySlug: string;
  strategyName: string;
  riskScore: number;
  roiMetrics: {
    leveragedIrr?: number;
    unleveredIrr?: number;
    equityMultiple?: number;
    dscr?: number;
    exitCapRate?: number;
    targetIrr?: number;
    noi?: number;
    debtYield?: number;
  };
  assumptions: Record<string, any>;
  recommended: boolean;
  source: 'strategy_analyses';
  strategyDrivers: M08StrategyDrivers;
}

function extractStrategyDrivers(
  assumptions: Record<string, any>,
  roiMetrics: Record<string, any>
): M08StrategyDrivers {
  const a = assumptions || {};
  const r = roiMetrics || {};

  const holdMonths: number | null =
    (a.hold_period_months != null ? Number(a.hold_period_months) : null) ??
    (a.holdPeriodMonths != null ? Number(a.holdPeriodMonths) : null) ??
    (a.hold_months != null ? Number(a.hold_months) : null) ??
    (a.holdMonths != null ? Number(a.holdMonths) : null) ??
    (a.hold_period_years != null ? Number(a.hold_period_years) * 12 : null) ??
    (a.holdYears != null ? Number(a.holdYears) * 12 : null) ??
    null;

  const targetLtv: number | null =
    (a.target_ltv != null ? Number(a.target_ltv) : null) ??
    (a.targetLtv != null ? Number(a.targetLtv) : null) ??
    (a.ltv != null ? Number(a.ltv) : null) ??
    (a.target_ltc != null ? Number(a.target_ltc) : null) ??
    null;

  const targetDscr: number | null =
    (a.target_dscr != null ? Number(a.target_dscr) : null) ??
    (a.targetDscr != null ? Number(a.targetDscr) : null) ??
    (r.dscr != null ? Number(r.dscr) : null) ??
    null;

  const triggerOccupancy: number | null =
    (a.trigger_occupancy != null ? Number(a.trigger_occupancy) : null) ??
    (a.triggerOccupancy != null ? Number(a.triggerOccupancy) : null) ??
    (a.stabilization_occ != null ? Number(a.stabilization_occ) : null) ??
    (a.stabilizationOcc != null ? Number(a.stabilizationOcc) : null) ??
    (a.target_occ != null ? Number(a.target_occ) : null) ??
    null;

  const exitCapRate: number | null =
    (r.exitCapRate != null ? Number(r.exitCapRate) : null) ??
    (r.exit_cap_rate != null ? Number(r.exit_cap_rate) : null) ??
    (a.exit_cap_rate != null ? Number(a.exit_cap_rate) : null) ??
    (a.exitCapRate != null ? Number(a.exitCapRate) : null) ??
    null;

  const targetIrr: number | null =
    (r.targetIrr != null ? Number(r.targetIrr) : null) ??
    (r.target_irr != null ? Number(r.target_irr) : null) ??
    (a.target_irr != null ? Number(a.target_irr) : null) ??
    null;

  const phase2Product: string | null =
    a.refi_product ?? a.refiProduct ?? a.phase2_product ?? a.phase2Product ?? null;

  const phase2TriggerMonth: number | null =
    (a.refi_month != null ? Number(a.refi_month) : null) ??
    (a.refiMonth != null ? Number(a.refiMonth) : null) ??
    (a.phase2_trigger_month != null ? Number(a.phase2_trigger_month) : null) ??
    null;

  return {
    holdMonths: holdMonths != null && holdMonths > 0 ? holdMonths : null,
    targetLtv: targetLtv != null && targetLtv > 0 && targetLtv <= 1 ? targetLtv : null,
    targetDscr: targetDscr != null && targetDscr > 0 ? targetDscr : null,
    triggerOccupancy: triggerOccupancy != null && triggerOccupancy > 0 ? triggerOccupancy : null,
    exitCapRate: exitCapRate != null && exitCapRate > 0 ? exitCapRate : null,
    targetIrr: targetIrr != null && targetIrr > 0 ? targetIrr : null,
    phase2Product: phase2Product || null,
    phase2TriggerMonth: phase2TriggerMonth != null && phase2TriggerMonth > 0 ? phase2TriggerMonth : null,
  };
}

export async function getM08StrategyOutput(
  pool: Pool,
  dealId: string
): Promise<M08StrategyOutput | null> {
  const primary = await getPrimaryStrategyForDeal(pool, dealId);
  if (!primary) return null;

  const strategyDrivers = extractStrategyDrivers(primary.assumptions, primary.roiMetrics);

  return {
    strategySlug: primary.strategySlug,
    strategyName: primary.strategyName,
    riskScore: primary.riskScore,
    roiMetrics: primary.roiMetrics,
    assumptions: primary.assumptions,
    recommended: primary.recommended,
    source: 'strategy_analyses',
    strategyDrivers,
  };
}
