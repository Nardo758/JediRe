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

### F-002 — GPR Floor-Plan Grid (REQUIRED for stabilized deals)

For stabilized/existing deals, GPR must be derived from a per-floor-plan validation grid,
NOT from the broker OM's asserted total GPR figure.

**Required protocol:**

1. **Call \`fetch_unit_mix\`** — per-floor-plan unit_count, in_place_rent, and market_rent
   with any sponsor overrides applied. This is the Tier 1 floor-plan baseline.
   If has_data: false, apply the degenerate single-row grid protocol (see Phase 1).

2. **Call \`fetch_peer_comp_noi_metrics\` (comp_role: "baseline")** — cross-validates
   per-floor-plan market rents against same-vintage/same-class unrenovated comps in the
   submarket. Reconcile any per-floor-plan divergence > 10% and document in evidence.

3. **Build per-floor-plan GPR grid** and populate for each floor plan:
   - proforma.revenue.gpr.unit_mix[floor_plan_id].unit_count
   - proforma.revenue.gpr.unit_mix[floor_plan_id].in_place_rent
   - proforma.revenue.gpr.unit_mix[floor_plan_id].market_rent  (from fetch_unit_mix, cross-checked)
   - proforma.revenue.gpr.unit_mix[floor_plan_id].mark_to_market_gap  (market_rent − in_place_rent)
   - proforma.revenue.gpr.unit_mix[floor_plan_id].source

   Compute:  total_gpr = Σ (unit_count × market_rent × 12)  across all floor plans.

4. **Cross-validate against T-12 GPR** — T-12 is Tier 1 ground truth for current operating
   run rate. If your comp-validated grid differs from T-12 GPR by > 5%, investigate:
   - A positive gap (grid > T-12) may signal mark-to-market opportunity — model as future
     rent growth, not immediate Year 1 GPR.
   - A negative gap (grid < T-12) may signal above-market leases rolling off — model the
     roll-down and flag as risk.

**You are prohibited from:**
- Writing the broker OM's asserted GPR directly to \`revenue.gross_potential_rent\` as the
  primary input without completing this floor-plan validation gate first.
- Skipping \`fetch_unit_mix\` for a stabilized deal. If the tool returns has_data: false,
  you must apply the degenerate-grid protocol — NOT silently fall back to the OM figure.

**Difference from value-add GPR:** No renovation ceiling comp set. No captured premium
computation. The two-comp-set protocol (baseline + renovation_ceiling) is value-add only.
For stabilized deals, comp_role="baseline" and current market rent IS the target.

### Collision Priority for Stabilized Deals
Focus collision detection on: in-place rents vs. broker OM market rents, T-12 vacancy
vs. broker OM stabilized occupancy, T-12 taxes vs. broker OM pro-forma taxes.

### Line-Item Matrix Cross-References (Stabilized Asset Specific)

For stabilized assets, the T-12 is the primary evidence for all non-GPR line items. Apply
the corresponding investigation cells from the LINE-ITEM INVESTIGATION MATRIX with the
following stabilized-deal-specific guidance. There is NO pre-renovation / post-stabilization
regime split — the T-12 reflects the current operating state, and the Pro Forma value should
represent the forward stabilized run rate (normalized from T-12).

**Vacancy (apply matrix cell):**
Use the T-12 trailing 12-month average vacancy rate (NOT a spot-date occupancy snapshot from
the rent roll). Apply the 5% economic vacancy floor. Flag if T-12 vacancy is > 8% — investigate
whether it is structural (management failure, deferred maintenance) or market-driven (submarket
softness). The Pro Forma value is the forward normalized rate after any structural issues are
addressed under new ownership.

**Concessions (apply matrix cell):**
T-12 concessions are the primary input. Apply the one-time/recurring test — a grand opening
or bulk concession event in the T-12 is not representative of forward run rate. Cross-check
the posture assessment: stabilized assets in Defense posture markets should carry ongoing
concessions of 4-6 weeks free; Offense posture supports near-zero concessions.

**Property Tax (apply matrix cell — MANDATORY):**
T-12 taxes reflect the SELLER's pre-acquisition assessed value and must not be used as
the forward Pro Forma value. Always call fetch_tax_intel to compute the post-acquisition
reassessment. Flag the T-12-to-Pro-Forma delta in evidence. This is the highest-impact
systematic error on stabilized deal underwriting.

**Insurance (apply matrix cell):**
Validate T-12 insurance against the jurisdiction benchmark. For FL, TX, CA coastal, and LA:
call fetch_jurisdiction_insurance_forecast — T-12 insurance may pre-date recent market
escalation and will understate forward premiums. Flag the delta. Apply the coverage adequacy
check — below-market premium may indicate underinsurance.

**R&M (apply matrix cell):**
T-12 R&M is the primary input. Apply the one-time/recurring test — HVAC replacements, roof
patching, and other items that should be CapEx but were expensed as repairs must be identified
and excluded from the forward run rate. Cross-check against the vintage-band benchmark.

**Payroll (apply matrix cell):**
If the T-12 reflects self-management, normalize to market-rate third-party management payroll
(typically 20-40% higher than self-managed T-12). Confirm the T-12 is fully-loaded (base
wages + benefits + payroll taxes + workers' comp).

**Management Fee (apply matrix cell):**
If the property is currently self-managed, the forward Pro Forma must reflect market-rate
third-party management fee (4-6% of EGI) regardless of the T-12 management fee. This is the
most common NOI inflation error on self-managed stabilized deals.

**Utilities (apply matrix cell):**
T-12 utilities are the primary input. Verify the metering structure (master-metered vs.
individually metered). If RUBS is in place, confirm gross utilities are shown on the utilities
line and RUBS recovery is shown on the Other Income line — not netted.

**Turnover Cost (apply matrix cell):**
For stabilized assets, T-12 turnover rate (% of units turned in trailing 12 months) is the
primary input. Apply the one-time/recurring test to the per-turn make-ready cost. Cross-check
against the stabilized Class B benchmark (40-55% annual turnover, $1,000-1,800 per turn).
No regime split needed — the Pro Forma value is the current normalized run rate.

**CapEx Reserve (apply matrix cell):**
Use the age-based reserve schedule anchored to the asset vintage and condition. T-12 capital
expenditure actuals are informative but not authoritative — some years have lumpy capex,
others have deferred spending. The forward reserve should reflect the actuarially correct
ongoing replacement need, not the T-12 actuals.

**Marketing (apply matrix cell):**
Apply the one-time/recurring test to T-12 marketing. A repositioning campaign or rebranding
in the T-12 is not representative of steady-state marketing spend. The forward rate should
reflect ongoing ILS platform fees and recurring digital advertising.

**v1.2 Single-Value Output Mandate:**
For ALL non-GPR line items on stabilized deals, produce ONE value per Pro Forma column (the
forward normalized run rate). There is no pre/post renovation split for stabilized assets.
Evidence reasoning should explain the T-12-to-Pro-Forma adjustment for any line item where
the forward value differs materially from the T-12 actuals (e.g., tax step-up, insurance
escalation, self-managed payroll normalization, one-time R&M removal).
`;
