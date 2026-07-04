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
  /** Full deal UUID for provenance and reproducibility (null for synthetic fixtures). */
  dealIdFull: string | null;
  /**
   * Fixture class — determines how the fixture was sourced and what it validates.
   * - `build_path`: rawAssumptions came from a live POST /build with store-sourced body.
   * - `seed_path`: expected values came from the seed/actuals surface (deal-financials endpoint).
   * - `synthetic`: deterministic engine run from hand-crafted assumptions (no DB dependency).
   */
  fixtureClass: 'build_path' | 'seed_path' | 'synthetic';
  /**
   * Pre-bridge input assumptions — the exact ProFormaAssumptions fed to the engine.
   * For build_path: captured from live build endpoint.
   * For seed_path: null (seed values are post-engine, not assumptions).
   * For synthetic: hand-crafted assumptions that produce the degenerate case.
   */
  rawAssumptions: ProFormaAssumptions | null;
  /** Expected outputs — 12-field class shape. */
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
    /** Surface that produced the expected values. */
    source: 'live_build' | 'seed_actuals' | 'synthetic_engine';
    /** Endpoint, route, or engine function that produced the values. */
    buildEndpoint: string;
    /** Hash or version identifier of the input assumptions at capture time. */
    inputSnapshot: string;
    /** For seed_path: names the seed endpoint and origin class. For synthetic: names the assumptions hash. */
    bodySource?: string;
    /** Origin class of the deal (e.g. 'owned_import', 'on_platform_underwrite'). */
    originClass?: string;
    /** Path-bound rule compliance: every gate must name the surface its expected values came from. */
    pathBoundRule: boolean;
  } | null;
}
