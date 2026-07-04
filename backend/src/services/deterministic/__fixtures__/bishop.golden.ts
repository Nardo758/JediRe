/**
 * Bishop golden fixture — build path.
 *
 * Bishop is the build-path golden: it has a real on-platform underwriting history
 * (deal_assumptions row exists, construct-from-DB body is valid).
 *
 * STATUS: expected values pending live capture in Replit.
 * When captured, populate `expected` + `rawAssumptions` + `provenance` from the
 * live build endpoint output (construct-from-DB body, F-P1-A context).
 *
 * The fixture pins ONLY after the capture script runs end-to-end and the canary
 * gate passes. No hand-populated numbers.
 */

import type { GoldenFixture } from './golden.types';

export const bishopFixture: GoldenFixture = {
  dealId: '3f32276f',
  dealIdFull: '3f42276f-aacd-4da3-b306-317c5109b403',
  dealName: 'Bishop',
  fixtureClass: 'build_path',
  rawAssumptions: null, // CAPTURE from live build — construct-from-DB body
  expected: null,       // PIN AFTER live build capture
  provenance: null,     // CAPTURE with buildEndpoint, commit hash, F-P1-A context
};
