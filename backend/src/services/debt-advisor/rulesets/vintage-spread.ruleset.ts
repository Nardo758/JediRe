/**
 * Vintage Spread Ruleset
 *
 * Defines base rate series and spread overlays by lender type for
 * vintage (origination-date) debt-service estimation.
 *
 * All rates are sourced from FRED metric_time_series; spreads are
 * platform estimates (provenanceTag: 'platform_estimate').
 */

export type LenderType = 'agency' | 'bank' | 'cmbs' | 'life_co' | 'bridge' | 'debt_fund';

export const VINTAGE_SPREAD_RULESET = {
  version: '2026-07-03',
  provenanceTag: 'platform_estimate',
  baseSeries: {
    agency: 'RATE_TREASURY_10Y',    // DGS10
    bank: 'RATE_TREASURY_10Y',      // DGS10
    cmbs: 'RATE_TREASURY_10Y',      // DGS10
    life_co: 'RATE_TREASURY_10Y',   // DGS10
    bridge: 'RATE_SOFR',             // SOFR
    debt_fund: 'RATE_SOFR',          // SOFR
  } as Record<LenderType, string>,
  spreadsBps: {
    agency: 170,
    bank: 200,
    cmbs: 220,
    life_co: 160,
    bridge: 350,
    debt_fund: 400,
  } as Record<LenderType, number>,
};
