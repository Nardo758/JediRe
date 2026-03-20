/**
 * Shared Return Calculations
 *
 * Used by both ExitCapitalModule and ProFormaTab for consistent IRR/return calculations.
 * This is the single source of truth for exit return computations.
 */

// 21-year quarterly data (shared with ExitCapitalModule)
export const RENT_GROWTH_21Y = [
  4.8, 4.9, 5.0, 4.6, 4.2, 4.0, 3.8, 3.5, 3.2, 3.0, 2.8, 2.5, 2.2, 2.4, 2.6, 2.8,
  1.2, -2.5, -1.0, 0.5, 2.0, 6.5, 11.0, 14.2, 12.0, 8.5, 5.0, 3.0, 2.0, 1.5, 1.8, 2.2,
  2.5, 2.8, 3.0, 3.1, 3.2, 3.3, 3.4, 3.5,
  3.6, 3.7, 3.8, 3.7, 3.5, 3.4, 3.2, 3.0, 2.8, 2.7, 2.5, 2.4, 2.3, 2.4, 2.5, 2.6,
  2.7, 2.8, 2.8, 2.9, 3.0, 3.0, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.4, 2.5, 2.6, 2.7,
  2.8, 2.9, 3.0, 3.0, 2.9, 2.8, 2.7, 2.6,
];

export const CAP_RATES_21Y = [
  6.0, 5.9, 5.8, 5.7, 5.6, 5.5, 5.4, 5.3, 5.2, 5.1, 5.0, 5.0, 4.9, 4.9, 5.0, 5.1,
  5.2, 5.8, 6.0, 5.8, 5.5, 5.0, 4.5, 4.2, 4.0, 4.1, 4.5, 4.8, 5.0, 5.2, 5.3, 5.4,
  5.4, 5.3, 5.2, 5.1, 5.1, 5.0, 5.0, 5.0,
  5.0, 4.9, 4.9, 4.8, 4.8, 4.8, 4.9, 5.0, 5.0, 5.1, 5.1, 5.2, 5.2, 5.2, 5.1, 5.1,
  5.0, 5.0, 5.0, 5.0, 5.1, 5.1, 5.2, 5.2, 5.2, 5.1, 5.1, 5.0, 5.0, 5.0, 5.0, 5.1,
  5.1, 5.2, 5.2, 5.2, 5.1, 5.1, 5.0, 5.0, 5.0, 5.0, 5.1, 5.1,
];

export const SUPPLY_21Y = [
  0, 120, 0, 200, 0, 0, 280, 0, 0, 350, 0, 0, 0, 180, 0, 300,
  0, 0, 0, 0, 0, 50, 180, 420, 650, 800, 400, 200, 0, 120, 280, 0,
  0, 380, 0, 0, 200, 0, 0, 180,
  0, 180, 320, 0, 0, 420, 0, 280, 0, 0, 560, 0, 0, 0, 380, 0,
  0, 200, 0, 300, 0, 0, 250, 0, 0, 180, 0, 400, 0, 0, 220, 0,
  0, 150, 0, 300, 0, 0, 280, 0, 0, 200, 0, 250,
];

export const T10_21Y = [
  1.8, 1.7, 1.5, 2.0, 2.4, 2.3, 2.2, 2.4, 2.7, 2.9, 3.0, 2.7, 2.7, 2.1, 1.7, 1.9,
  1.6, 0.7, 0.7, 0.9, 1.1, 1.5, 1.3, 1.5, 1.8, 2.9, 3.3, 3.9, 3.5, 3.8, 4.3, 3.9,
  4.1, 4.5, 4.3, 4.2, 4.6, 4.2, 4.0, 3.9,
  3.8, 3.7, 3.6, 3.5, 3.5, 3.4, 3.4, 3.3, 3.3, 3.3, 3.2, 3.2, 3.2, 3.3, 3.3, 3.4,
  3.4, 3.5, 3.5, 3.5, 3.5, 3.6, 3.6, 3.6, 3.6, 3.5, 3.5, 3.5, 3.4, 3.4, 3.3, 3.3,
  3.2, 3.2, 3.1, 3.1, 3.0, 3.0, 3.0, 2.9, 2.9, 2.9, 2.8, 2.8,
];

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
 * Compute exit returns for a given forward quarter index and deal type
 * @param fwdIdx Forward quarter index (0 = Q1 2026, NOW_IDX)
 * @param dealType Deal type affecting base economics
 * @param rentGrowth Optional override for rent growth multiplier (used in sensitivity)
 * @param exitCapRate Optional override for exit cap rate (used in sensitivity)
 */
export function computeExitReturns(
  fwdIdx: number,
  dealType: DealType,
  rentGrowth?: number,
  exitCapRate?: number
): ExitReturns {
  const absIdx = NOW_IDX + fwdIdx;
  const holdYears = Math.max(0.25, (fwdIdx + 1) / 4);

  // Base deal economics by type
  const baseNOI = dealType === 'development' ? 2800000 : 3420000;
  const totalBasis = dealType === 'development' ? 52000000 : 46420000;
  const equity = dealType === 'development' ? 18200000 : 14920000;
  const annualDS = 2340000;

  // Build NOI through hold period
  let noiMult = 1;
  for (let i = NOW_IDX; i <= absIdx && i < TOTAL_Q; i++) {
    const rg = rentGrowth !== undefined ? rentGrowth : RENT_GROWTH_21Y[i] ?? 2.5;
    noiMult *= 1 + rg / 100 / 4;
  }
  const exitNOI = baseNOI * noiMult;

  // Exit valuation
  const cap = exitCapRate !== undefined ? exitCapRate : CAP_RATES_21Y[absIdx] ?? 5.0;
  const exitCap = cap / 100;
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
      const rg = rentGrowth !== undefined ? rentGrowth : RENT_GROWTH_21Y[NOW_IDX + y * 4 + q] ?? 2.5;
      ym *= 1 + rg / 100 / 4;
    }
    totalCF += baseNOI * ym - annualDS;
  }

  const totalReturn = totalCF + netProceeds;
  const em = equity > 0 ? totalReturn / equity : 0;
  const irr = holdYears > 0 && equity > 0 ? (Math.pow(Math.max(0.01, totalReturn / equity), 1 / holdYears) - 1) * 100 : 0;

  return {
    holdYears: holdYears.toFixed(1),
    exitNOI,
    grossValue,
    netProceeds,
    totalReturn,
    irr: Math.max(0, Math.min(50, irr)),
    em: Math.max(0, em),
    exitCap: cap,
    absIdx,
  };
}

/**
 * Compute IRR for sensitivity analysis grid (exit cap × rent growth)
 * Used by Sensitivity tab heatmap
 */
export function computeSensitivityIRR(
  dealType: DealType,
  rentGrowthAdjustment: number,
  exitCapAdjustment: number,
  baseReturnIRR: number
): number {
  // Simplified sensitivity: adjust base IRR based on cap rate and rent growth changes
  // Each 1% cap rate change ≈ 3% IRR change (assuming ~3yr hold)
  // Each 0.5% rent growth change ≈ 1.5% IRR change
  const capAdj = -exitCapAdjustment * 3; // negative because higher cap = lower IRR
  const rentAdj = rentGrowthAdjustment * 1.5;
  return Math.max(0, Math.min(40, baseReturnIRR + capAdj + rentAdj));
}
