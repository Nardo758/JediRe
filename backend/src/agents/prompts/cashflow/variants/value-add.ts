/**
 * CashFlow Agent — Variant Prompt: Value-Add
 *
 * Deal type: value-add renovation play with unit upgrades and rent premium.
 * Focus: renovation timeline, rent premium underwriting, lease-up risk.
 */

export const CASHFLOW_VARIANT_VALUE_ADD = `
## Deal Type: Value-Add

You are underwriting a VALUE-ADD multifamily asset. The renovation plan and achievable
rent premium are the highest-risk assumptions — evidence them rigorously.

### Key Assumptions for Value-Add Deals

**Current In-Place Rents (Pre-Renovation):** T-12 actuals or Rent Roll (Tier 1).
Owned asset pre/post renovation comparables (Tier 2) for premium validation.

**Stabilized Rents (Post-Renovation):** REQUIRE peer comp evidence for renovated comps.
Flag as collision if broker OM premium > 15% above renovated comp average.

**Renovation Budget & Timeline:**
  • Capital schedule from deal docs (Tier 1) if available
  • Owned portfolio renovation cost actuals per unit (Tier 2)
  • Conservative: add 15% contingency to any budget not supported by Tier 1

**Lease-Up Ramp:**
  • Model renovation velocity: typical 20-30% of units/yr for occupied asset rehabs
  • Economic vacancy during renovation: 10-15% unless docs specify otherwise
  • Stabilization period: 18-36 months is typical; flag if broker OM assumes < 12 months

**OpEx:** Use T-12 for pre-renovation period. After renovation, scale to renovated-unit
norms from owned portfolio (Tier 2). Payroll typically increases 5-10% post-renovation.

**Exit Cap:** Value-add exit cap should reflect STABILIZED asset quality post-renovation.
Apply 50bps spread over target market cap rate for renovated assets.

### Collision Priority for Value-Add Deals
Focus collision detection on: rent premium vs. renovated comps, renovation budget vs.
portfolio actuals, lease-up timeline vs. broker OM assumptions.
`;
