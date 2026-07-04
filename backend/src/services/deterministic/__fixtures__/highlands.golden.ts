/**
 * Highlands golden fixture — placeholder.
 *
 * TODO (W4/W5): Populate `expected` with verified-correct outputs from the
 * unified deterministic engine after live acceptance. Highlands is the
 * universal regression canary — its values must not drift.
 */

import type { GoldenFixture } from './golden.types';

export const highlandsFixture: GoldenFixture = {
  dealId: 'eaabeb9f',
  dealIdFull: 'eaabeb9f-830e-44f9-a923-56679ad0329d',
  dealName: 'Highlands',
  rawAssumptions: null, // POPULATE from live build capture — ProFormaAssumptions shape
  expected: null,       // PIN AFTER live build capture
  provenance: null,     // POPULATE with capture metadata
};
