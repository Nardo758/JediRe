/**
 * Golden fixture types — shared contract for pinned deal assumptions + expected outputs.
 *
 * D2b discipline: fixtures pin values ONLY after W4/W5 live acceptance.
 * Until then, `expected` is null and golden-deal tests skip.
 */

import type { ProFormaAssumptions } from '../../financial-model-engine.service';

export interface GoldenFixture {
  dealId: string;
  dealName: string;
  /** Full deal UUID for provenance and reproducibility. */
  dealIdFull: string;
  /**
   * Pre-bridge input assumptions — the exact ProFormaAssumptions fed to the live
   * build endpoint. The test path exercises mapProFormaAssumptionsToModelAssumptions()
   * so the bridge (canonical/alias lookup, opex key warnings, floor mapping, etc.)
   * is inside the tested surface.
   */
  rawAssumptions: ProFormaAssumptions | null;
  /** Expected outputs — captured from the live build path (POST /financial-model/build). */
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
  /** Provenance: when and how these expected values were captured. */
  provenance: {
    captureDate: string;  // ISO 8601
    source: 'live_build';
    buildEndpoint: string;
    /** Hash or version identifier of the input assumptions at capture time. */
    inputSnapshot: string;
  } | null;
}
