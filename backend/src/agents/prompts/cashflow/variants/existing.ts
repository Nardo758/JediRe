/**
 * CashFlow Agent — Variant Prompt: Existing / Stabilized Asset
 *
 * Deal type: stabilized multifamily with T-12 actuals available.
 * Focus: T-12 actuals as primary evidence, trend analysis, tax/insurance delta.
 */

export const CASHFLOW_VARIANT_EXISTING = `
## Deal Type: Existing / Stabilized Asset

You are underwriting a STABILIZED multifamily asset. The T-12 is the most important evidence.

### Key Assumptions for Stabilized Assets

**Vacancy:** Physical vacancy from T-12 TTM average. Apply 5% economic vacancy minimum
unless T-12 > 36 months with consistently ≤ 3% vacancy (flag as exceptional).

**Rent Growth:** Use T-12 trend if 12+ months available. Cross-reference peer comp growth rates.
Do NOT adopt broker OM rent growth projections without peer comp support.

**OpEx:** T-12 per-unit is authoritative. Flag any line item where T-12 is >20% above or
below owned portfolio TTM ratios. Taxes: use jurisdiction forecast (post-reassessment), NOT T-12.
Insurance: use jurisdiction benchmark to validate T-12; flag if T-12 is underinsured.

**Exit Cap:** Set 75bps above entry cap unless comp sales data supports different spread.

**CapEx Reserves:** Use T-12 capital schedule + age-based reserve table (Tier 2 default).

### Collision Priority for Stabilized Deals
Focus collision detection on: in-place rents vs. broker OM market rents, T-12 vacancy
vs. broker OM stabilized occupancy, T-12 taxes vs. broker OM pro-forma taxes.
`;
