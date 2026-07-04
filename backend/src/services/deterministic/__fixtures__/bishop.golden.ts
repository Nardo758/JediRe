/**
 * Bishop golden fixture — placeholder.
 *
 * TODO (W4/W5): Populate `expected` with verified-correct outputs from the
 * unified deterministic engine after live acceptance. Do NOT pin current
 * unproven values — the Excel-parity step (operator workbook as oracle)
 * closes the pin.
 */

import type { GoldenFixture } from './golden.types';

export const bishopFixture: GoldenFixture = {
  dealId: '3f32276f',
  dealIdFull: '3f42276f-aacd-4da3-b306-317c5109b403',
  dealName: 'Bishop',
  rawAssumptions: null, // POPULATE from live build capture — ProFormaAssumptions shape
  expected: null,       // PIN AFTER live build capture
  provenance: null,     // POPULATE with capture metadata
};
