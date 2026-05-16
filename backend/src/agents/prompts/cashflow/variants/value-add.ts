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

### Line-Item Matrix Cross-References (Value-Add Specific)

The following line items are highest-regime-sensitivity for value-add deals. Apply the
corresponding investigation cell from the LINE-ITEM INVESTIGATION MATRIX for each:

**Vacancy (HIGH PRIORITY — apply matrix cell):**
Apply the Vacancy matrix cell. For value-add, the Pro Forma column shows post-stabilization
economic vacancy (target: 4-7% for stabilized Class B). Do NOT use T12 vacancy directly —
T12 reflects the pre-renovation regime (elevated due to renovation disruption and unit
displacement). The Projections tab models the renovation-period ramp (10-15% economic
vacancy during renovation → normalized stabilized rate). Evidence reasoning must explain the
pre-renovation regime, the renovation-period ramp, and the post-stabilization target.

**Concessions (HIGH PRIORITY — apply matrix cell):**
Apply the Concessions matrix cell. For value-add, the renovated comp set concession level is
the post-renovation target. The subject currently may be running 4-8 weeks free (pre-reno
environment); the stabilized Pro Forma should reflect the concession level of the renovated
tier. Flag if posture is Defense — concessions may remain elevated even post-renovation.

**Turnover Cost (HIGHEST REGIME SENSITIVITY — apply matrix cell with full detail):**
Apply the Turnover matrix cell with its full investigation protocol. This is the single
most regime-sensitive non-GPR line item for value-add deals.
  • Pre-renovation: 50-65% annual turnover; residents leave during renovation disruption
  • Post-stabilization: 30-40% target; renovation stickiness reduces turnover by 10-20pp
  • REQUIRED: analyze the renovation stickiness vs. affordability ceiling tension:
    - Calculate post-renovation rent burden on resident income profile
    - If post-reno rent > 30% of median HH income in submarket → elevated turnover risk
    - If renovation is full interior at $25k+/unit → maximum stickiness
  • Pro Forma column = stabilized (post-renovation) turnover rate × per-turn cost × units
  • Evidence reasoning MUST include regime narrative (pre-reno 50-65%, post-stab 30-40%,
    stickiness analysis, affordability ceiling check)

**R&M (HIGH PRIORITY — apply matrix cell):**
Apply the R&M matrix cell. For value-add, T12 R&M is the PRE-renovation rate and should
NOT be used directly. Post-renovation R&M drops 30-50% vs pre-renovation T12 because
renovated systems (HVAC, appliances, plumbing) have low near-term failure rates. Apply the
one-time/recurring test to T12 R&M before using as any baseline. Pro Forma column =
post-renovation normalized rate.

**CapEx Reserve (apply matrix cell):**
Apply the CapEx Reserve matrix cell. Post-renovation reserve = $150-250/unit/yr (renovated
systems, low near-term capex). Do NOT add renovation budget (tracked in M22 capex_schedule)
to the Pro Forma reserve line — double-counting is a common error on value-add deals.

**Other Income (apply matrix cell):**
Apply the Other Income matrix cell. For value-add, distinguish (a) existing ancillary programs
carried forward and (b) new programs enabled by renovation (RUBS, pet fees, parking
optimization). New programs have implementation lag — model 6-12 months for RUBS maturation.

**v1.2 Single-Value Output Mandate:**
For ALL non-GPR line items above, produce ONE value per Pro Forma column (the post-stabilization
economics). Put the pre-renovation regime narrative in evidence.reasoning. Do NOT output
pre_renovation or post_stabilization sub-fields. The Projections tab carries the year-by-year
trajectory.
`;
