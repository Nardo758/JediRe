/**
 * Golden fixture types — shared contract for pinned deal assumptions + expected outputs.
 *
 * D2b discipline: fixtures pin values ONLY after W4/W5 live acceptance.
 * Until then, `expected` is null and golden-deal tests skip.
 *
 * Discriminated union (Finding N resolution, W5-DISPATCH.md): build_path/synthetic
 * fixtures validate the 12-field proforma/return shape (BuildExpected) produced by
 * running the engine from assumptions. seed_path fixtures validate a narrower,
 * actuals-derived shape (SeedExpected) — they have no acquisition/financing/exit
 * assumptions to produce return metrics from, and must not be forced to fabricate
 * them (Finding K ruling on Highlands).
 *
 * REJECTED alternative: making `expected` a `Partial<BuildExpected>` for seed_path
 * so the test "only asserts fields that are present." That is the partial-pin
 * pattern wearing a type signature — a fixture that silently asserts less over
 * time as fields get deleted is a regression suite that degrades without saying
 * so. Use the discriminated union instead.
 */

import type { ProFormaAssumptions } from '../../financial-model-engine.service';
import type { ModelAssumptions } from '../deterministic-model-runner';
import type { SeedActualsRow } from '../seed-actuals-aggregator';

export type { SeedActualsRow } from '../seed-actuals-aggregator';

/** 12-field proforma/return shape — build_path and synthetic fixtures. */
export interface BuildExpected {
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
}

/**
 * Actuals-derived shape — seed_path fixtures only. No acquisition, financing,
 * or exit assumptions exist for these deals (owned_import origin class), so no
 * return metrics (IRR, DSCR, cap rates, etc.) can be honestly produced.
 */
export interface SeedExpected {
  targetYear: number;
  egiAnnual: number;
  noiMargin: number;
  opexRatio: number;
  /** ISO date of the latest real (non-budget, non-proforma) actuals month. */
  boundary: string;
}

export interface GoldenProvenance {
  captureDate: string; // ISO 8601
  /** Surface that produced the expected values. */
  source: 'live_build' | 'live_build_post_debt_fixes' | 'seed_actuals' | 'synthetic_engine';
  /** Endpoint, route, or engine function that produced the values. */
  buildEndpoint: string;
  /** Hash or version identifier of the input assumptions/snapshot at capture time. */
  inputSnapshot: string;
  /** For seed_path: names the seed endpoint and origin class. For synthetic: names the assumptions hash. */
  bodySource?: string;
  /** Origin class of the deal (e.g. 'owned_import', 'on_platform_underwrite'). */
  originClass?: string;
  /** Path-bound rule compliance: every gate must name the surface its expected values came from. */
  pathBoundRule: boolean;
}

interface GoldenFixtureBase {
  dealId: string;
  dealName: string;
  /** Full deal UUID for provenance and reproducibility (null for synthetic fixtures). */
  dealIdFull: string | null;
}

export interface BuildPathFixture extends GoldenFixtureBase {
  fixtureClass: 'build_path';
  /** Pre-bridge input assumptions — the exact ProFormaAssumptions fed to the engine, captured from a live POST /build with store-sourced body. */
  rawAssumptions: ProFormaAssumptions | null;
  /** Post-runFullModel effective assumptions — what actually produced the output after M11 resize + M14 adjustments + equity reconciliation. Captured for debuggability and reproducibility. */
  effectiveAssumptions: ModelAssumptions | null;
  expected: BuildExpected | null;
  provenance: GoldenProvenance | null;
}

export interface SyntheticFixture extends GoldenFixtureBase {
  fixtureClass: 'synthetic';
  /** Synthetic fixtures hand-craft ModelAssumptions inline in the test; no ProFormaAssumptions envelope. */
  rawAssumptions: null;
  expected: BuildExpected | null;
  provenance: GoldenProvenance | null;
}

export interface SeedPathFixture extends GoldenFixtureBase {
  fixtureClass: 'seed_path';
  /** Seed path has no proforma assumptions — expected values are post-actuals, not post-engine-from-inputs. */
  rawAssumptions: null;
  /** Pinned snapshot of raw deal_monthly_actuals-shaped rows the aggregator is run over. */
  snapshotRows: SeedActualsRow[] | null;
  expected: SeedExpected | null;
  provenance: GoldenProvenance | null;
}

export type GoldenFixture = BuildPathFixture | SyntheticFixture | SeedPathFixture;
