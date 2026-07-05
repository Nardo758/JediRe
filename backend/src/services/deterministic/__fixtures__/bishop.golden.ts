/**
 * Bishop golden fixture — build path.
 *
 * Bishop is the build-path golden: it has a real on-platform underwriting history
 * (deal_assumptions row exists, construct-from-DB body is valid).
 *
 * STATUS: NOT PINNED. See Finding M in W5-DISPATCH.md.
 *
 * A pin attempt on 2026-07-05 (post Finding K/K-2/L fixes) was reverted because
 * `runWithBridge()` in golden-deals.test.ts calls
 * `mapProFormaAssumptionsToModelAssumptions()` + a single-pass `runModel()`
 * (from `deterministic-model-runner.ts`) directly — it never runs the M11
 * debt-optimizer / M14 DSCR-floor two-pass orchestration that Finding L's fix
 * lives in (that cycle only exists inside `financial-model-engine.service.ts`'s
 * build orchestration, which the live `POST /build` endpoint calls).
 *
 * Consequence: values captured from the live `/build` endpoint (post-M11/M14 —
 * e.g. Bishop's $21,024,006 loan, 1.04 DSCR) can never match what this
 * bridge-only harness produces (pre-M11 — the raw $39,000,000 requested loan,
 * ~0.67 DSCR), no matter how `rawAssumptions` is shaped. This is not a mapping/
 * shape bug — it is a structural gap between what this test path exercises and
 * what the live endpoint (and Finding L) actually does.
 *
 * Do not pin `expected` here until one of the following happens:
 *   (a) `runWithBridge()` is redesigned to call the same build orchestration
 *       function financial-model-engine.service.ts uses (so it exercises the
 *       M11/M14 cycle), or
 *   (b) A deliberate decision is made that this fixture validates ONLY the
 *       bridge + single-pass `runModel()` path (pre-M11/M14), in which case
 *       `expected` must be captured from that same path — not from the live
 *       `/build` endpoint — and the fixture doc/tests must say so explicitly
 *       so nobody mistakes it for end-to-end build-path validation.
 *
 * The pin ONLY after the capture script runs end-to-end AND the correct
 * validation path (matching what actually produced the expected values) is
 * confirmed. No hand-populated numbers.
 */

import type { GoldenFixture } from './golden.types';

export const bishopFixture: GoldenFixture = {
  dealId: '3f32276f',
  dealIdFull: '3f32276f-aacd-4da3-b306-317c5109b403',
  dealName: 'Bishop',
  fixtureClass: 'build_path',
  rawAssumptions: null, // CAPTURE from live build — construct-from-DB body
  expected: null,       // PIN AFTER live build capture AND harness path resolved (see Finding M)
  provenance: null,     // CAPTURE with buildEndpoint, commit hash, F-P1-A context
};
