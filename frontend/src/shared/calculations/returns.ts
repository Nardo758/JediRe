/**
 * Shared Return Calculations
 *
 * Used by both ExitCapitalModule and ProFormaTab/SensitivityTab.
 * Single source of truth for exit return computations.
 *
 * D1 (CE-04 P0): No hardcoded 21-year rent-growth / cap-rate series.
 * `computeExitReturns` requires the caller to provide rentGrowth and
 * exitCapRate. When the live source is unavailable, callers MUST
 * surface the absence (render "—") rather than silently invoking a
 * constant.
 */

export const NOW_IDX = 40;
export const TOTAL_Q = 84;

export interface ExitReturns {
  holdYears: string;
  exitNOI: number;
  grossValue: number;
  netProceeds: number;
  totalReturn: number;
  irr: number;
  em: number;
  exitCap: number;
  rss?: number;
  absIdx: number;
}

export type DealType = 'existing' | 'development' | 'redevelopment';

/**
 * Compute exit returns for a given forward quarter index and deal type.
 *
 * @param fwdIdx Forward quarter index (0 = Q1 2026, i.e. NOW_IDX)
 * @param dealType Deal type affecting base economics
 * @param rentGrowth Annual rent growth % applied across the hold (scalar)
 * @param exitCapRate Exit cap rate at disposition (scalar, %)
 *
 * Returns null when either required input is missing — there is no
 * hardcoded fallback. Callers must render "—" / "not available".
 */
export function computeExitReturns(
  fwdIdx: number,
  dealType: DealType,
  rentGrowth: number | null | undefined,
  exitCapRate: number | null | undefined
): ExitReturns | null {
  if (rentGrowth == null || exitCapRate == null) return null;

  const absIdx = NOW_IDX + fwdIdx;
  const holdYears = Math.max(0.25, (fwdIdx + 1) / 4);

  // Base deal economics by type
  // NOTE: These per-deal-type defaults remain until D-series wires
  // baseNOI / totalBasis / equity / debt service from useDealModule
  // context. They are flagged here so a future D-pass can excise them.
  const baseNOI = dealType === 'development' ? 2800000 : 3420000;
  const totalBasis = dealType === 'development' ? 52000000 : 46420000;
  const equity = dealType === 'development' ? 18200000 : 14920000;
  const annualDS = 2340000;

  // Build NOI through hold period
  let noiMult = 1;
  for (let i = NOW_IDX; i <= absIdx && i < TOTAL_Q; i++) {
    noiMult *= 1 + rentGrowth / 100 / 4;
  }
  const exitNOI = baseNOI * noiMult;

  // Exit valuation
  const exitCap = exitCapRate / 100;
  if (exitCap <= 0) return null;
  const grossValue = exitNOI / exitCap;
  const sellingCosts = grossValue * 0.02;
  const loanPayoff = totalBasis - equity;
  const netProceeds = grossValue - sellingCosts - loanPayoff;

  // Cash flow through hold
  const yrs = Math.ceil(holdYears);
  let totalCF = 0;
  for (let y = 0; y < yrs; y++) {
    let ym = 1;
    for (let q = 0; q < 4 && y * 4 + q < fwdIdx; q++) {
      ym *= 1 + rentGrowth / 100 / 4;
    }
    totalCF += baseNOI * ym - annualDS;
  }

  const totalReturn = totalCF + netProceeds;
  const em = equity > 0 ? totalReturn / equity : 0;
  const irr = holdYears > 0 && equity > 0
    ? (Math.pow(Math.max(0.01, totalReturn / equity), 1 / holdYears) - 1) * 100
    : 0;

  return {
    holdYears: holdYears.toFixed(1),
    exitNOI,
    grossValue,
    netProceeds,
    totalReturn,
    irr: Math.max(0, Math.min(50, irr)),
    em: Math.max(0, em),
    exitCap: exitCapRate,
    absIdx,
  };
}

/**
 * IRR sensitivity adjustment for the SensitivityTab grid.
 * Pure math, no hardcoded series.
 */
export function computeSensitivityIRR(
  dealType: DealType,
  rentGrowthAdjustment: number,
  exitCapAdjustment: number,
  baseReturnIRR: number
): number {
  const capAdj = -exitCapAdjustment * 3;
  const rentAdj = rentGrowthAdjustment * 1.5;
  return Math.max(0, Math.min(40, baseReturnIRR + capAdj + rentAdj));
}
