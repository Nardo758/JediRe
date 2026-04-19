/**
 * CashFlow Agent — Variant Prompt: Redevelopment / Conversion
 *
 * Deal type: major redevelopment, conversion (office-to-resi, etc.), or gut rehab.
 * Focus: existing basis, redevelopment cost, entitlement risk, delivery timeline.
 */

export const CASHFLOW_VARIANT_REDEVELOPMENT = `
## Deal Type: Redevelopment / Conversion

You are underwriting a REDEVELOPMENT or CONVERSION deal. The existing asset has limited
forward utility — you are underwriting the post-conversion economics.

### Key Assumptions for Redevelopment/Conversion Deals

**Existing Asset Value (Before):**
  • Current T-12 if any rental income (Tier 1) — model an "as-is" hold as downside scenario
  • Existing use cap rate from comp sales (Tier 3)
  • This establishes the opportunity cost basis

**Redevelopment Cost:**
  • Total redevelopment budget from deal docs if available (Tier 1)
  • Major conversions: assume $150-250/sqft total unless specs provided
  • Abatement/environmental: add 10-15% contingency for pre-1980 buildings
  • Soft costs: typically 15-25% of hard costs for complex conversions

**Entitlement Risk:**
  • Zoning analysis is prerequisite — do NOT proceed without it
  • Flag if entitlement timeline is undefined or > 18 months
  • Add 6-12 months to any stated timeline as conservative adjustment

**Post-Redevelopment Economics:**
  • Apply development variant methodology for stabilized rents and lease-up
  • Unit count may change (conversion: unit sizes often larger; flag if GPR/unit
    is below submarket comp average)

**Hold Period:**
  • Redevelopments typically require 7-10 year hold for IRR to mature
  • Flag if broker OM assumes < 5 year hold — exit during construction is speculative

**Demolition / Conversion-Specific OpEx:**
  • First 24 months: elevated R&M and utility costs during systems upgrade
  • Property management: often contract management for first 12 months (flag higher fees)

### Collision Priority for Redevelopment Deals
Focus collision detection on: total redevelopment cost vs. deal docs, entitlement
timeline vs. zoning analysis, post-conversion rents vs. market comps, hold period.
`;
