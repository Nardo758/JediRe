/**
 * Distress Threshold Ruleset
 *
 * Lender-minimum DSCR and market-max LTV thresholds by lender type,
 * plus buffer and horizon parameters for cashflow-distress detection.
 */

import type { LenderType } from './vintage-spread.ruleset';

export const DISTRESS_THRESHOLD_RULESET = {
  version: '2026-07-03',
  provenanceTag: 'platform_estimate',
  lenderMinDscr: {
    agency: 1.25,
    bank: 1.25,
    bridge: 1.10,
    cmbs: 1.30,
    life_co: 1.35,
  } as Record<LenderType, number>,
  marketLtvMax: {
    agency: 0.75,
    bank: 0.65,
    bridge: 0.80,
    cmbs: 0.70,
    life_co: 0.65,
  } as Record<LenderType, number>,
  thinDscrBuffer: 0.05,
  ioShockMonthsAhead: 12,
};
