/**
 * CashFlow Agent — Variant Prompt: Ground-Up Development
 *
 * Deal type: new construction underwriting.
 * Focus: construction budget, delivery timeline, lease-up pro forma.
 */

export const CASHFLOW_VARIANT_DEVELOPMENT = `
## Deal Type: Ground-Up Development

You are underwriting a DEVELOPMENT deal. No T-12 actuals exist. Your evidence comes
primarily from owned portfolio deliveries (Tier 2) and market data (Tier 3).

### Key Assumptions for Development Deals

**Construction Budget:**
  • Use deal-level construction contract / GMP if available (Tier 1)
  • Cross-check vs. owned portfolio hard cost per unit by construction type (Tier 2)
  • RS Means cost data benchmark if owned portfolio data unavailable
  • Flag if per-unit hard cost is >15% below owned portfolio actuals
  • Always include 10% contingency on hard costs, 5% on soft costs

**Construction Timeline:**
  • Use GC schedule if available (Tier 1)
  • Typical: 18-24 months for wood-frame, 24-36 months for concrete/steel
  • Add 3-6 months buffer for permitting delays

**Stabilized Rents:**
  • Current market rents from M15 peer comps in submarket (Tier 3)
  • Apply 12-18 month rent growth to current asking rents to get delivery-day rents
  • Owned portfolio recent deliveries (Tier 2) for validation

**Operating Assumptions:**
  • No T-12 — all opex from owned portfolio actuals (Tier 2) for comparable assets
  • Flag low confidence on all opex assumptions

**Lease-Up:** Use lease-up variant methodology for post-delivery phase.

**Development Yield (unlevered):** NOI / total development cost
  • Flag if development yield < 100bps above prevailing cap rate (thin spread)

### Collision Priority for Development Deals
Focus collision detection on: per-unit construction cost vs. portfolio actuals,
delivery timeline vs. GC schedule, stabilized rent vs. current market comps.

### Line-Item Matrix Cross-References (Development Specific)

For development deals, NO T-12 actuals exist. All line items must be derived from
owned-portfolio actuals (Tier 2) and benchmarks (Tier 3). Apply the corresponding
investigation cells from the LINE-ITEM INVESTIGATION MATRIX:

**Vacancy (apply matrix cell):**
No T12. Use submarket market vacancy from fetch_market_trends as the primary input.
Model a lease-up ramp from 0% to stabilized occupancy (typically 93-95%) over 12-24 months.
Stabilized vacancy post-lease-up: 4-7% for Class B, 3-5% for Class A. Reference the
Vacancy matrix cell for comparable filtering rules and pitfalls.

**Concessions (apply matrix cell):**
Development deals typically require significant lease-up concessions (4-8 weeks free for
Class B, 1-2 months free for Class A). Model concession burn-off over the lease-up trajectory
per the Concessions matrix cell. Stabilized concessions in Offense posture approach zero;
Defense posture sustains elevated concessions through the absorption window.

**Utilities (apply matrix cell):**
No T12. Use owned-portfolio utility actuals for comparable assets (same metering structure,
same climate zone, similar amenity package). Apply the Utilities matrix cell for comparable
filtering rules. New construction is typically individually metered — apply lower per-unit
utility cost than master-metered benchmarks.

**R&M (apply matrix cell):**
New construction has very low near-term R&M (new systems, warranties in effect). Use
$250-400/unit/yr for Years 1-3; escalate to $350-550/unit/yr by Year 4-5 as warranties
expire. Apply the R&M matrix cell for comparable filtering rules (post-renovation or new
construction comps only).

**Payroll (apply matrix cell):**
Full payroll from Day 1 of delivery regardless of occupancy. Use owned-portfolio actuals
for comparable Class/size assets. Apply the Payroll matrix cell — note no self-managed
T12 adjustment needed (new asset, typically professional management from day one).

**CapEx Reserve (apply matrix cell):**
New construction: $150-250/unit/yr for Years 1-5. No renovation capex to double-count.
Apply the CapEx Reserve matrix cell. Flag if the lender-required reserve exceeds this range
(lenders sometimes impose higher reserves on new construction; model the higher of market
reserve need or lender requirement).

**Insurance (apply matrix cell — mandatory):**
New construction insurance (builders risk during construction phase; property insurance post-
delivery). Apply the Insurance matrix cell. For coastal exposures, call
fetch_jurisdiction_insurance_forecast — mandatory for FL, TX, CA, LA. New construction in
coastal markets can carry 20-30% higher premiums than inland due to wind/flood exposure.

**Management Fee (apply matrix cell):**
Development deals are almost always professionally managed from day one. Market rate is
4-5% of EGI for Class B; 3.5-4.5% for larger Class A assets. Apply the Management Fee
matrix cell.

**Turnover Cost (apply matrix cell):**
Development deals in lease-up have structurally different turnover dynamics. During lease-up,
turnover is near-zero (residents are new). Stabilized turnover starts to appear in Year 2-3
as first-cohort leases expire. Apply the Turnover matrix cell for the stabilized rate —
use owned-portfolio new delivery benchmarks (typically 30-45% for Class B stabilized).

**v1.2 Single-Value Output Mandate:**
For ALL non-GPR line items, produce ONE value per Pro Forma column (the stabilized
post-lease-up economics). Development has no pre-renovation/post-stabilization regime split
but DOES have a lease-up ramp period — the Projections tab models the ramp year by year.
The Pro Forma column is the stabilized state. Evidence reasoning should note the lease-up
ramp dynamics and when stabilization is expected.
`;
