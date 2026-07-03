/**
 * Golden fixture types — shared contract for pinned deal assumptions + expected outputs.
 *
 * D2b discipline: fixtures pin values ONLY after W4/W5 live acceptance.
 * Until then, `expected` is null and golden-deal tests skip.
 */

import type { ModelAssumptions } from '../deterministic-model-runner';

export interface GoldenFixture {
  dealId: string;
  dealName: string;
  assumptions: ModelAssumptions;
  /** Expected outputs — populated after W4/W5 live acceptance verifies correctness. */
  expected: {
    noiYear1: number;
    egiYear1: number;
    irr: number;
    equityMultiple: number;
    dscrY1: number;
    cashOnCashY1: number;
    goingInCapRate: number;
    exitCapRate: number;
    yieldOnCost: number;
    totalEquity: number;
    totalDebt: number;
    netProceeds: number;
  } | null;
}
