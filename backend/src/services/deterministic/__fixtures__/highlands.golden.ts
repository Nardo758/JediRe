/**
 * Highlands golden fixture — seed path.
 *
 * FINDING K RULING (operator-ratified):
 * Highlands is `owned_import` — it entered at Owned/Operate, was never underwritten
 * on-platform, and therefore correctly has NO deal_assumptions row. The absence is
 * not missing data; it's an honest record of a deal that skipped phases A–E.
 *
 * OPTION 1 (hand-creating a deal_assumptions row) is REJECTED — that would fabricate
 * an underwriting that never happened, violating origin-class honesty.
 *
 * RESOLUTION: Highlands' golden role is path-bound to its true surface — the seed
 * path. Authoritative numbers live on the seed/actuals surface:
 *   - NOI margin: 57.17%
 *   - EGI 2025: $6,315,308
 *   - Boundary: 2026-04-01
 *
 * The build-path Highlands golden is NOT CREATED. Bishop alone is the build-path
 * golden (architecturally right: Bishop has real underwriting history).
 *
 * STATUS: expected values pending seed-path capture in Replit.
 * Hit the seed/deal-financials surface and populate the 12-field shape from there.
 * rawAssumptions remains null — seed path validates post-engine values, not inputs.
 */

import type { GoldenFixture } from './golden.types';

export const highlandsFixture: GoldenFixture = {
  dealId: 'eaabeb9f',
  dealIdFull: 'eaabeb9f-830e-44f9-a923-56679ad0329d',
  dealName: 'Highlands',
  fixtureClass: 'seed_path',
  rawAssumptions: null, // Seed path: no ProFormaAssumptions — values are post-engine
  expected: null,       // PIN AFTER seed-path capture (margin 57.17%, EGI $6,315,308 known)
  provenance: null,     // CAPTURE with seed endpoint, origin_class: owned_import
};
