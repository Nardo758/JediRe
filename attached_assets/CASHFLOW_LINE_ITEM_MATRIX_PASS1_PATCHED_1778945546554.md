# CASHFLOW AGENT — LINE-ITEM INVESTIGATION MATRIX (Pass 1 Patched)

**Status:** Pass 1 patched — supersedes the original Pass 1 reference cell.
**Changes from original Pass 1:**
- Renovation premium derivation flipped: comp ceiling is the input; sponsor selects positioning percentile, owned-portfolio provides capture rate
- Comparable Filtering Rules split into baseline comparables and renovation ceiling comparables (two distinct comp sets)
- Output Slots Populated expanded to include the per-floor-plan grid (`proforma.revenue.gpr.unit_mix[*]`)
- Investigation Questions tightened around the positioning decision vs the premium derivation
- New "Common Pitfalls" entry on smoothing premium uniformly across floor plans

**Pairs with:** `PRO_FORMA_REGIME_INPUT_UI_SPEC.md` (the floor-plan grid + regime expand UI surface that consumes this cell's output)

---

## INTRODUCTION (unchanged from original Pass 1)

Your job on each line item is not to apply a formula. It is to investigate.

Each cell of this matrix gives you (a) the questions to ask, (b) the sources to consult and what role each plays for this line item in this deal type, (c) the regime-detection logic that determines whether the cell has one number or multiple, (d) the comparable-filtering rules that determine which observations actually inform this line item, (e) the common pitfalls that produce wrong answers if you skip the investigation, and (f) the confidence rules that determine how aggressively to surface the result.

You execute the investigation. You produce a number with evidence. The matrix tells you how to investigate, not what answer to land on.

### Three principles that shape every cell (unchanged)

1. **Regimes are real.** A single number across a hold period frequently smooths over genuinely different operational realities.
2. **Comparables must be filtered, not averaged.** Verify the comparable shares the structural attributes that drive the line item before consuming it.
3. **Source dominance varies by line item and by deal type.** Anchor to the source that has the most signal for this specific question.

### The four sources (unchanged)

- **S1 — Platform analog cohort.** Historical deals matching subject.
- **S2 — Broker OM.** Seller's assertion about this specific property.
- **S3 — Owned-portfolio.** Buyer's actuals on similar assets they operate.
- **S4 — Live market data.** Real-time signals including M05/M07/M11/M35, jurisdiction forecasts, Lease Velocity Engine, comp set TTM, supply pipeline.

---

## CELL SCHEMA (unchanged from original Pass 1)

```
### [LINE ITEM] — [DEAL TYPE]
**The question you're answering:** ...
**Regime Detection** ...
**Source Hierarchy** ...
**Investigation Questions** ...
**Comparable Filtering Rules** ...
**Common Pitfalls** ...
**Confidence Rules** ...
**Output Slots Populated** ...
```

---

## REFERENCE CELL — VALUE-ADD GPR (patched)

### Gross Potential Rent — Acquisition (Value-Add)

**The question you're answering:** What does GPR look like in the stabilized year, decomposed per floor plan (current market rent, post-renovation target rent, premium captured), and how does the aggregate GPR get there from current state through the four Δ components?

**Regime Detection**

Value-add GPR has at minimum two regimes, sometimes three. The regime split applies *per floor plan* — each floor plan has its own pre-renovation rent and post-renovation target rent, and the property aggregate emerges from rolling up across floor plans.

- **Pre-stabilization regime (Y1 through stabilization year minus 1):** Mixed in-place rents on legacy leases, captured renovation premium only on units that have completed renovation per M22 capex_schedule, elevated turnover during heavy reno, some displacement loss. The per-unit walk handles this mechanically.

- **Stabilization year and forward:** All units have cycled through at least one post-renovation lease, retention has normalized at the post-renovation rate, market rent drift continues at submarket rate. This is the Pro Forma column value.

- **Optional third regime — phased renovation rollouts:** Phased rollouts (e.g., 50 units per quarter) create a rolling stabilization pattern. Investigate M22 capex_schedule cadence; model per-cohort if cadence is staged over more than 12 months.

The Pro Forma column shows stabilized year aggregate; the floor-plan grid shows per-floor-plan stabilized rents; the Projections tab shows the pre-stabilization regime year by year.

**Source Hierarchy**

Renovation premium derivation reverses the intuitive sourcing order. The comp set is the input, not a cross-check.

- **Renovation ceiling — S4 (M05 comp set via `fetch_peer_comp_noi_metrics` and `fetch_data_library_comps`).** The ceiling for post-renovation rents is set by what comparable newer or recently-renovated assets in the submarket actually achieve. This is a structural cap — the renovation cannot lift the asset beyond what the market is paying for equivalent product. The agent computes the comp distribution per floor plan (P25/P50/P75 of comp-set rents for matching unit type) and presents this to the sponsor as the achievable range.

- **Positioning decision — sponsor input (via `fetch_operator_stance` or assumption panel input).** The sponsor's job is to pick *where in the comp distribution* this property will land post-renovation. P50 positioning (median) is the typical conservative anchor. P75 requires justification (signature amenity package, location premium, demonstrated execution). Below P50 implies the renovation is undersized relative to the comp set. The platform suggests P50 by default and surfaces the rent implication; sponsor adjusts.

- **Premium derivation — math, not assertion.** Once positioning is chosen, the gross premium is:
  ```
  gross_premium_per_floor_plan = comp_set_rent_at_chosen_percentile - current_market_rent
  ```
  The *captured* premium is:
  ```
  captured_premium = gross_premium × historical_capture_rate
  ```
  Where `historical_capture_rate` comes from S3 — buyer's actual capture on similar repositioning programs. Typical capture rates are 70-90%. New operators, less experienced operators, or operators executing a scope they haven't done before should be at the lower end. Operators with documented track record on similar product can be at the upper end.

- **Per-unit walk mechanics — S2 (rent roll) + S4 (anchor growth rates via `fetch_anchor_growth_rates`).** Rent roll provides per-unit lease end dates and current contract rent. Anchor growth rates provide monthly market drift. These are inputs to the walk; not separate projections.

- **Owned-portfolio anchoring — S3 for retention rate, renewal cap, and capture rate.** Buyer's portfolio (`fetch_owned_asset_actuals`) is the primary source for the per-unit walk's behavioral parameters: how many leases renew, at what cap, and how much of the comp-implied lift the operator captures. When buyer has 2+ comparable Class × vintage × submarket deals, these parameters are owned-portfolio anchored.

- **Stabilized year sanity check — S1 (archive cohort).** After the per-unit walk produces stabilized GPR, cross-check against analog cohort distribution (`fetch_archive_assumption_distribution`). If walk-produced GPR sits at archive P85 or above, the positioning percentile is likely stretched OR the capture rate assumption is too aggressive.

- **Source you do NOT trust here — S2 broker OM stabilized GPR.** Broker typically applies flat annual rent growth which masks retention drag and rent roll burn-off. Use broker as a sanity-check reference, not as a primary input. Also: broker's renovation premium assumption is asserted, not derived from comps in any principled way.

**Investigation Questions**

1. **Renovation scope and cadence:** What is the M22 capex_schedule? Are all units being renovated, or a subset? Over what duration? Phased or parallel? This determines the timing of premium capture and whether a third regime applies.

2. **Comp ceiling per floor plan:** What is the M05 comp set rent distribution for each of the subject's floor plans? Pull P25/P50/P75 for each unit type from comparable newer/renovated assets. This grid is the input to the sponsor's positioning decision.

3. **Sponsor positioning percentile:** Has the sponsor explicitly chosen a positioning percentile, or accepted the platform default of P50? If P75 or above, what justifies the above-median positioning? Signature amenity package? Location premium not captured in comp filtering? Demonstrated execution capability that delivers above-comp performance?

4. **Capture rate evidence:** What is the buyer's documented capture rate on similar repositioning programs (S3)? If buyer has executed 4 prior similar value-adds with capture rates 0.78, 0.84, 0.81, 0.88, the central estimate is ~0.83 and the assumption can be at the upper end. If buyer is first-time at this scope, capture rate should be at archive cohort P25 — execution risk is real and unpriced.

5. **Retention regime shift:** What is the buyer's retention rate on stabilized assets in this class/submarket (S3)? Pre-renovation retention is typically lower (residents leave rather than accept renovation rent); post-renovation retention can be higher (renovated unit + amenity reposition increases stickiness) or lower (rent levels stretching against submarket affordability ceiling). Investigate both directions; do not assume.

6. **In-place lease quality:** What is the rent roll loss-to-lease percentage? What is the lease maturity distribution? Fast maturity = fast access to mark-to-market; slow maturity = slower value release. This determines stabilization year timing.

7. **Floor-plan-specific premium variance:** Does the comp set show different premium percentages across floor plans (e.g., 2BR units capture 18% premium while 1BR units capture 12%)? If so, do not smooth premium uniformly — each floor plan gets its own captured premium based on its own comp set distribution.

8. **Submarket rent growth trajectory:** What is the submarket TTM rent growth (S4 via `fetch_market_trends`)? How does it compare to the cohort hold period mean? If TTM is materially below cohort hold mean, the cohort-implied stabilized rent may be overstating the achievable trajectory. Fine-tune downward.

**Comparable Filtering Rules**

Two distinct comp sets are required for value-add GPR underwriting. They serve different roles.

**Baseline comparables — for establishing current state.** When validating subject's current market rent or current operating performance:
- Asset class match — Class B for Class B; Class C ≠ Class B
- Vintage band — within ±10 years
- Unit count band — within ±50% of subject
- Submarket match — same submarket ideal, or within MSA at similar comp-set positioning
- Condition match — comparable should be in similar physical condition (pre-renovation, similar maintenance posture)
- Hold period stage — any operational stage acceptable for current state validation

**Renovation ceiling comparables — for establishing post-renovation target rent.** When determining what the post-reno rents can reach:
- Asset class match — Class B for Class B
- Vintage band — *newer or recently renovated*. The comparable must represent the product type the renovation is aspiring to be. A 1980 unrenovated comparable does not inform what a 1980 fully-renovated subject can reach. A 1980 fully-renovated comparable does. A 2018 new-build at the same Class B positioning also does.
- Unit count band — within ±50% of subject
- Submarket match — same submarket required (renovation does not cross submarkets)
- Amenity package match — comparable must have an amenity package the renovation is matching. If subject's renovation does not include amenity overhaul, do not use comparables with amenity overhauls.
- Interior condition — comparable must have interior finishes at or near the level the subject renovation will reach. The renovation specs in M22 capex_schedule determine which finish tier the subject will reach; the comparable's finish tier must match.

For owned-portfolio comparables (S3) on renovation premium capture, apply the renovation ceiling comparable filters plus:
- Operator match — comparable must be operated by the same buyer
- Hold period stage — comparable must be at least 36 months post-acquisition (premium capture data only stabilizes after the program completes)
- Renovation scope match — comparable's renovation scope must match subject's scope. Light cosmetic ≠ full interior renovation. Amenity-only ≠ full repositioning.

If filtered comparables produce n < 4 for either set, broaden one dimension at a time (vintage band to ±15 years, then submarket to MSA-class match) and document the broadening with the cohort_match_quality field.

**Common Pitfalls**

1. **Treating sponsor renovation premium assertion as input.** Sponsor asserts a per-unit premium dollar value; agent consumes it as input. This is backwards. The comp ceiling is the input; the sponsor's role is to choose the positioning percentile within the comp distribution. The premium is computed math from positioning × capture rate. An agent that consumes asserted premium has skipped the verification step that makes the underwriting defensible.

2. **Smoothing renovation premium uniformly across floor plans.** If the comp set shows 2BR units capturing 18% premium and 1BR units capturing 12% premium, applying the average 15% to both floor plans understates the 2BR opportunity and overstates the 1BR opportunity. The per-unit walk uses per-floor-plan premiums; the UI surfaces per-floor-plan premiums. Aggregate premium is an emergent number, not an assumption.

3. **Using baseline comparables for renovation ceiling.** Pulling rent from "comparable Westshore Class B 1980-1990 vintage assets" and using that as the post-renovation target is methodologically wrong. Those comparables are in the same pre-renovation state as the subject. They tell you what the subject is worth today, not what it could be worth post-renovation. The renovation ceiling comp set is a different set.

4. **Flat annual rent growth assumption.** Producing GPR via `current_GPR × (1 + annual_growth)^years` smooths over retention drag and rent roll burn-off. The per-unit walk is mandatory; flat growth is a diagnostic output, not an input.

5. **Assuming retention rate is constant across the hold.** Retention shifts during renovation and after stabilization. Modeling a single retention rate across the hold smooths over the regime shift.

6. **Ignoring stickiness vs affordability ceiling tension on retention.** Sponsor often asserts "renovation makes units stickier." This can be true. It is also true that post-renovation rents may push the affordability profile of the tenant base, which reduces retention. Both effects exist; net depends on submarket affordability dynamics. Investigate, do not assume direction.

7. **Capture rate assumption above buyer's track record.** Sponsor assumes 95% capture rate on renovation premium when buyer's track record is 78%. Surface the gap. The capture rate must be defended with evidence — same operator, same scope, similar product, hold period long enough for the program to have completed.

8. **Treating broker stabilized GPR as a comparable.** Broker number is asserted, not derived. Sanity check, not input.

9. **Cohort comparison without filtering for hold period stage.** Archive cohort distribution at "stabilized year" assumes the cohort actually reached stabilization. Filter cohort to deals that completed at least one stabilized year before archive entry; otherwise cohort stabilized GPR is biased downward.

**Confidence Rules**

- **High** confidence requires: renovation ceiling comparables pass filter rules with n ≥ 5 per floor plan, sponsor positioning at P50 or with strong justification for P75+, buyer's owned-portfolio capture rate evidence with n ≥ 2, sponsor execution track record on similar scope, walk-produced stabilized GPR within cohort P25-P75.

- **Medium** confidence: renovation ceiling comparables n = 3-4 per floor plan, sponsor positioning at P60-P75 with moderate justification, buyer capture rate from a single similar deal, or sponsor first-time at this scope at this scale.

- **Low** confidence: renovation ceiling comparables n < 3 per floor plan, sponsor positioning at P75+ without specific justification, no buyer capture rate evidence (default cohort capture rate used), walk-produced stabilized GPR at or above cohort P85.

When confidence is low, attach `confidence_rationale` explaining which conditions failed.

**Output Slots Populated**

Aggregate slots (Pro Forma row level):

- `proforma.revenue.gpr.current_value` — T12 + rent roll cross-validated aggregate
- `proforma.revenue.gpr.proforma_value` — walk-produced stabilized year aggregate
- `proforma.revenue.gpr.delta_market` / `delta_platform` / `delta_operator` / `delta_capex`
- `proforma.revenue.gpr.evidence` — structured per canonical schema
- `proforma.diagnostics.implied_rent_growth_y1` / `_y2_plus`
- `proforma.diagnostics.cohort_comparison_status`

Per-floor-plan grid slots:

- `proforma.revenue.gpr.unit_mix[floor_plan_id].unit_count`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].current_market_rent` (per unit per month)
- `proforma.revenue.gpr.unit_mix[floor_plan_id].comp_ceiling_p25/p50/p75` (per unit per month)
- `proforma.revenue.gpr.unit_mix[floor_plan_id].positioning_percentile` (sponsor input or platform default)
- `proforma.revenue.gpr.unit_mix[floor_plan_id].post_reno_target_rent` (per unit per month — computed from positioning × comp ceiling)
- `proforma.revenue.gpr.unit_mix[floor_plan_id].gross_premium` (target - current_market)
- `proforma.revenue.gpr.unit_mix[floor_plan_id].capture_rate` (from S3 or default)
- `proforma.revenue.gpr.unit_mix[floor_plan_id].captured_premium` (gross × capture)
- `proforma.revenue.gpr.unit_mix[floor_plan_id].evidence` — structured per canonical schema, per floor plan

Per-year projections (feeding Projections tab):

- `proforma.revenue.gpr.year_by_year[y].aggregate` (Y1 through Y_exit)
- `proforma.revenue.gpr.year_by_year[y].unit_mix[floor_plan_id]` (per-floor-plan year-by-year, from the walk)

---

## NOTES ON PASS 1 PATCH

The original Pass 1 reference cell had two structural errors and one missing piece. All three are corrected here:

1. **Sourcing flipped:** Comp ceiling is input, sponsor positioning is decision, premium is computed math. Renovation premium is no longer "sponsor-asserted." Source Hierarchy section rewritten in full.

2. **Comp filtering split:** Baseline comparables (current state) and renovation ceiling comparables (post-reno target state) are now two distinct comp sets with separate filter rules. Comparable Filtering Rules section rewritten.

3. **Floor-plan grid surfaced:** Output Slots Populated now includes the per-floor-plan grid. This is the data shape the UI surface (separate spec) renders. Three new Common Pitfalls (#1, #2, #3) and one new Investigation Question (#7) address the per-floor-plan nature of the underwriting.

The cell schema itself (the 7-slot structure) is unchanged. The shape works; the content needed correction.

Pass 2 (all 56 cells) proceeds from this corrected reference. Most other cells will not have floor-plan grids — only GPR does, per the user's confirmation. The simpler regime expand pattern handles the rest.
