# CASHFLOW AGENT — LINE-ITEM INVESTIGATION MATRIX (Pass 1 v1.2)

**Status:** Pass 1 — schema, introduction, and one reference cell (Value-Add GPR). Corrected to align with UI spec v1.2.
**Changes from earlier patched version:**
- Regime detection slot in non-GPR cells is now informational guidance for the agent's reasoning, not a UI output instruction
- GPR cell retains regime detection because GPR is the only line item with a regime-aware UI surface (the floor-plan grid)
- Non-GPR cells produce a single value (post-stabilization) with regime context in evidence narrative
- Output Slots Populated section updated to reflect single-value output for non-GPR line items

---

## INTRODUCTION

Your job on each line item is not to apply a formula. It is to investigate.

Each cell of this matrix gives you (a) the questions to ask, (b) the sources to consult and what role each plays for this line item in this deal type, (c) the regime-awareness logic that shapes the agent's reasoning, (d) the comparable-filtering rules that determine which observations actually inform this line item, (e) the common pitfalls that produce wrong answers if you skip the investigation, and (f) the confidence rules that determine how aggressively to surface the result.

You execute the investigation. You produce a number with evidence. The matrix tells you how to investigate, not what answer to land on.

### Three principles that shape every cell

**1. Regime awareness shapes reasoning, not always output shape.** A single number across a hold period frequently masks genuinely different operational realities. A value-add property has a *pre-renovation regime* and a *post-stabilization regime* for turnover, R&M, marketing, vacancy. The agent must reason about both regimes when producing the Pro Forma value, but for most line items the output is a single value (the post-stabilization regime, the one that defines the stabilized Pro Forma column). Only GPR has a regime-aware UI surface because the per-floor-plan dimension makes it both useful and necessary. For other line items, regime reasoning lives in the evidence narrative — the agent explains the pre/post difference and why the post-stabilization value is what it is.

**2. Comparables must be filtered, not averaged.** Owned-portfolio actuals on Class B garden-style assets do not inform service contract underwriting on a Class A high-rise with an elevator and a chiller plant. Archive cohort deals without RUBS history do not inform RUBS implementation projections. Before consuming a comparable, verify the comparable shares the structural attributes that drive the line item in question.

**3. Source dominance varies by line item and by deal type.** Property tax in a reassessment jurisdiction has live-data dominance (`fetch_jurisdiction_tax_forecast`). GPR on a value-add has per-unit walk dominance built from rent roll + anchor growth rates + cohort retention. R&M on a stabilized acquisition has owned-portfolio dominance. Each cell names the primary source and explains why.

### The four sources

- **S1 — Platform analog cohort.** Historical deals matching subject; from archive tools.
- **S2 — Broker OM.** Seller's assertion about this specific property.
- **S3 — Owned-portfolio.** Buyer's actuals on similar assets they operate.
- **S4 — Live market data.** Real-time signals: M05/M07/M11/M35, jurisdiction forecasts, Lease Velocity Engine, comp set TTM, supply pipeline.

---

## CELL SCHEMA

```
### [LINE ITEM] — [DEAL TYPE]

**The question you're answering:** [one sentence]

**Regime Awareness**
[For value-add and redevelopment deals, what regimes exist for this line item, and how does that shape the agent's reasoning? For most non-GPR line items, this section explains the pre/post difference and instructs the agent to model the post-stabilization value with that context, including the regime explanation in evidence narrative. For GPR (the one line item with a regime-aware UI), this section also explains the floor-plan grid output structure.]

**Source Hierarchy**
- Primary: [...]
- Secondary: [...]
- Live-data fine-tuning: [...]
- Source you do NOT trust here: [...]

**Investigation Questions**
[Numbered list of specific questions]

**Comparable Filtering Rules**
[Structural attributes that must match]

**Common Pitfalls**
[Named failure modes]

**Confidence Rules**
[When high/medium/low]

**Output Slots Populated**
[Which fields in the field catalog]
```

---

## REFERENCE CELL — VALUE-ADD GPR

GPR is the most complex cell in the matrix and the only line item with a regime-aware UI surface (the floor-plan grid).

### Gross Potential Rent — Acquisition (Value-Add)

**The question you're answering:** What does GPR look like in the stabilized year, decomposed per floor plan (current market rent, post-renovation target rent, premium captured), and how does the aggregate GPR get there from current state through the four Δ components?

**Regime Awareness**

Value-add GPR has at minimum two regimes, sometimes three. The regime split applies *per floor plan* — each floor plan has its own pre-renovation rent and post-renovation target rent, and the property aggregate emerges from rolling up across floor plans.

- **Pre-stabilization regime (Y1 through stabilization year minus 1):** Mixed in-place rents on legacy leases, captured renovation premium only on units that have completed renovation per M22 capex_schedule, elevated turnover during heavy reno, some displacement loss. The per-unit walk handles this mechanically.

- **Stabilization year and forward:** All units have cycled through at least one post-renovation lease, retention has normalized at the post-renovation rate, market rent drift continues at submarket rate. This is the Pro Forma column value.

- **Optional third regime — phased renovation rollouts:** Phased rollouts (e.g., 50 units per quarter) create a rolling stabilization pattern. Investigate M22 capex_schedule cadence; model per-cohort if cadence is staged over more than 12 months.

The Pro Forma column shows stabilized year aggregate; the floor-plan grid shows per-floor-plan stabilized rents AND current rents (the regime-aware UI surface); the Projections tab shows the pre-stabilization regime year by year.

**GPR is the only line item where the regime split produces explicit pre/post UI outputs.** The floor-plan grid renders Current Market and Post-Reno Target side by side per floor plan, plus the renovation cost and yield-on-cost. For other line items (turnover, R&M, etc.), the regime split is the agent's internal reasoning context, not an output dimension.

**Source Hierarchy**

Renovation premium derivation reverses the intuitive sourcing order. The comp set is the input, not a cross-check.

- **Renovation ceiling — S4 (M05 comp set via `fetch_peer_comp_noi_metrics` and `fetch_data_library_comps`).** The ceiling for post-renovation rents is set by what comparable newer or recently-renovated assets in the submarket actually achieve. This is a structural cap — the renovation cannot lift the asset beyond what the market is paying for equivalent product. The agent computes the comp distribution per floor plan (P25/P50/P75 of comp-set rents for matching unit type) and presents this to the sponsor as the achievable range.

- **Positioning decision — sponsor input (via `fetch_operator_stance` or assumption panel input).** The sponsor's job is to pick *where in the comp distribution* this property will land post-renovation. P50 positioning (median) is the typical conservative anchor. P75 requires justification. Below P50 implies the renovation is undersized relative to the comp set. The platform suggests P50 by default and surfaces the rent implication; sponsor adjusts.

- **Premium derivation — math, not assertion.** Once positioning is chosen, the gross premium is:
  ```
  gross_premium_per_floor_plan = comp_set_rent_at_chosen_percentile - current_market_rent
  ```
  The *captured* premium is:
  ```
  captured_premium = gross_premium × historical_capture_rate
  ```
  Where `historical_capture_rate` comes from S3 — buyer's actual capture on similar repositioning programs. Typical capture rates are 70-90%.

- **Per-unit walk mechanics — S2 (rent roll via fetch_unit_mix for per-floor-plan + fetch_rent_roll for property-wide context) + S4 (anchor growth rates via `fetch_anchor_growth_rates`).** `fetch_unit_mix` provides per-floor-plan unit counts and in-place rents; `fetch_rent_roll` provides property-wide rent roll context (occupancy, lease maturity, market rent spread). Anchor growth rates provide monthly market drift. These are inputs to the walk; not separate projections.

  **Important (NEW v1.3):** Per-floor-plan detail is available only via `fetch_unit_mix`, which reads from `deal_assumptions.unit_mix` (canonical) and applies sponsor overrides. `fetch_rent_roll` returns property-wide aggregates only and does NOT provide per-floor-plan data. Agents calling `fetch_rent_roll` and expecting floor-plan breakdown will see undefined fields.

- **Owned-portfolio anchoring — S3 for retention rate, renewal cap, and capture rate.** Buyer's portfolio (`fetch_owned_asset_actuals`) is the primary source for the per-unit walk's behavioral parameters.

- **Stabilized year sanity check — S1 (analog cohort).** After the per-unit walk produces stabilized GPR, cross-check against analog cohort distribution. If walk-produced GPR sits at archive P85 or above, the positioning percentile is likely stretched OR the capture rate is too aggressive.

- **Source you do NOT trust here — S2 broker OM stabilized GPR.** Broker typically applies flat annual rent growth which masks retention drag and rent roll burn-off. Use broker as sanity-check reference, not primary input.

**Investigation Questions**

1. **Renovation scope and cadence:** What is the M22 capex_schedule? Are all units being renovated, or a subset? Over what duration? Phased or parallel?

2. **Comp ceiling per floor plan:** What is the M05 comp set rent distribution for each of the subject's floor plans? Pull P25/P50/P75 for each unit type from comparable newer/renovated assets.

3. **Sponsor positioning percentile:** Has the sponsor explicitly chosen a positioning percentile, or accepted the platform default of P50? If P75 or above, what justifies the above-median positioning?

4. **Capture rate evidence:** What is the buyer's documented capture rate on similar repositioning programs (S3)? If sponsor is first-time at this scope, capture rate should be at archive cohort P25.

5. **Retention regime shift:** What is the buyer's retention rate on stabilized assets in this class/submarket (S3)? Pre-renovation retention is typically lower; post-renovation retention can be higher or lower. Investigate both directions; do not assume.

6. **In-place lease quality:** Examine the rent roll. What is the loss-to-lease percentage? What is the lease maturity distribution?

7. **Floor-plan-specific premium variance:** Does the comp set show different premium percentages across floor plans? If so, do not smooth premium uniformly.

8. **Submarket rent growth trajectory:** What is the submarket TTM rent growth (S4)? How does it compare to the cohort hold period mean?

**Comparable Filtering Rules**

Two distinct comp sets required for value-add GPR underwriting.

**Baseline comparables — for establishing current state.**
- Asset class match
- Vintage band within ±10 years
- Unit count band within ±50%
- Submarket match
- Condition match (similar physical condition)
- Hold period stage: any operational stage acceptable

**Renovation ceiling comparables — for establishing post-renovation target rent.**
- Asset class match
- Vintage band: *newer or recently renovated*. A 1980 unrenovated comparable does not inform what a 1980 fully-renovated subject can reach.
- Unit count band within ±50%
- Submarket match (required)
- Amenity package match (comparable must have amenity package the renovation is matching)
- Interior condition match (comparable's finish tier must match what the subject renovation will reach)

For owned-portfolio comparables (S3) on renovation premium capture:
- Operator match
- Hold period stage: at least 36 months post-acquisition
- Renovation scope match (light cosmetic ≠ full interior renovation)

If filtered comparables produce n < 4 for either set, broaden one dimension at a time and document the broadening with `cohort_match_quality`.

**Common Pitfalls**

1. **Treating sponsor renovation premium assertion as input.** The comp ceiling is the input; sponsor's role is positioning percentile selection.

2. **Smoothing renovation premium uniformly across floor plans.** Per-floor-plan premiums are mandatory; aggregate premium is emergent.

3. **Using baseline comparables for renovation ceiling.** Two distinct comp sets serve two distinct functions.

4. **Flat annual rent growth assumption.** The per-unit walk is mandatory; flat growth is a diagnostic output, not an input.

5. **Assuming retention rate is constant across the hold.** Retention shifts during renovation and after stabilization.

6. **Ignoring stickiness vs affordability ceiling tension on retention.** Both effects exist; investigate, do not assume direction.

7. **Capture rate assumption above buyer's track record.** Must be defended with same-operator, same-scope evidence.

8. **Treating broker stabilized GPR as a comparable.** Sanity check, not input.

9. **Cohort comparison without filtering for hold period stage.** Filter cohort to deals that completed at least one stabilized year before archive entry.

10. **Reading per-floor-plan data from the wrong source.** The legacy `fetch_rent_roll` tool returns property-wide aggregates only — total units, average rent, total monthly income. It does not return per-floor-plan breakdown. Agents that expect floor-plan detail from `fetch_rent_roll` will receive undefined fields and produce smoothed (incorrect) underwriting. Always call `fetch_unit_mix` for per-floor-plan data. This pitfall is the primary source of the Scenario C divergence identified in the unit mix audit: agents calling the wrong tool for floor-plan data silently produced aggregate-smoothed underwriting without any error signal.

**Confidence Rules**

- **High** confidence: renovation ceiling comparables pass filter rules with n ≥ 5 per floor plan, sponsor positioning at P50 or with strong justification for P75+, buyer's owned-portfolio capture rate evidence with n ≥ 2, sponsor execution track record, walk-produced stabilized GPR within cohort P25-P75.

- **Medium** confidence: comparables n = 3-4 per floor plan, sponsor positioning at P60-P75 with moderate justification, buyer capture rate from a single similar deal, or sponsor first-time at this scope at this scale.

- **Low** confidence: comparables n < 3 per floor plan, sponsor positioning at P75+ without specific justification, no buyer capture rate evidence, walk-produced stabilized GPR at or above cohort P85.

When confidence is low, attach `confidence_rationale` explaining which conditions failed.

**Output Slots Populated**

Aggregate slots (Pro Forma row level):

- `proforma.revenue.gpr.current_value` — T12 + rent roll cross-validated aggregate
- `proforma.revenue.gpr.proforma_value` — walk-produced stabilized year aggregate
- `proforma.revenue.gpr.delta_market` / `delta_platform` / `delta_operator` / `delta_capex`
- `proforma.revenue.gpr.evidence` — structured per canonical schema
- `proforma.diagnostics.implied_rent_growth_y1` / `_y2_plus`
- `proforma.diagnostics.cohort_comparison_status`

Per-floor-plan grid slots (regime-aware UI output, GPR only):

- `proforma.revenue.gpr.unit_mix[floor_plan_id].unit_count`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].current_market_rent`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].comp_ceiling_p25/p50/p75`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].positioning_percentile`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].post_reno_target_rent`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].gross_premium`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].capture_rate`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].captured_premium`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].renovation_cost`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].renovation_scope`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].yield_on_cost`
- `proforma.revenue.gpr.unit_mix[floor_plan_id].evidence`

**Source for unit_mix[] grid (NEW v1.3):** The agent assembles each `UnitMixEntry` by combining outputs from multiple tools:
- Unit count, floor plan label, current market rent: from `fetch_unit_mix`
- Comp ceiling P25/P50/P75: from `fetch_peer_comp_noi_metrics` and `fetch_data_library_comps`
- Capture rate baseline: from `fetch_owned_asset_actuals` (if available) or platform default
- Renovation cost per unit: from `fetch_data_matrix.extractedData.capex.capex_schedule` (or sponsor-provided M22 schedule)
- Renovation scope: from M22 capex_schedule scope descriptor

The agent's job is to assemble these into the `unit_mix[]` array per floor plan. Failure modes include: emitting unit_mix without calling fetch_unit_mix (per-floor-plan data unavailable), using fetch_rent_roll for per-floor-plan data (returns property aggregate only), or smoothing capture rates uniformly across floor plans (use S3 owned-portfolio per-floor-plan when available).

Per-year projections (feeding Projections tab):

- `proforma.revenue.gpr.year_by_year[y].aggregate` (Y1 through Y_exit)
- `proforma.revenue.gpr.year_by_year[y].unit_mix[floor_plan_id]` (per-floor-plan year-by-year from the walk)

---

## NOTES ON v1.3 UPDATE

**v1.3 update (current):** Source references in the Value-Add GPR cell updated post unit mix audit. The cell now distinguishes `fetch_unit_mix` (canonical per-floor-plan source) from `fetch_rent_roll` (property-wide aggregates only). The per-unit walk mechanics bullet in the Source Hierarchy section explicitly names both tools and explains the role of each. A new "Source for unit_mix[] grid" subsection in Output Slots Populated names which tool contributes each field of the `UnitMixEntry`. New Common Pitfall #10 codifies the source-confusion failure mode — agents reading per-floor-plan data from `fetch_rent_roll` instead of `fetch_unit_mix` will produce smoothed (incorrect) underwriting without any error signal. No changes to investigation questions, comparable filtering rules, confidence rules, or matrix structure.

## NOTES ON v1.2 ALIGNMENT

The UI spec v1.2 confirms that **only GPR has a regime-aware UI surface (the floor-plan grid)**. All other line items render as Single-Value cells, even those where the agent's reasoning is regime-aware.

What this means for the matrix authoring (Pass 2):

- **GPR cells across all four deal types** retain the full regime detection treatment with explicit pre/post output structure. The floor-plan grid IS the regime-aware UI.

- **All non-GPR cells** have a "Regime Awareness" section (renamed from "Regime Detection") that explains the agent's internal reasoning about regimes but instructs it to produce a single value (the post-stabilization Pro Forma value). The regime context lives in evidence narrative.

Example, Turnover-Value-Add Pass 2 will look like:

> **Regime Awareness**
> Value-add turnover has two regimes: pre-renovation elevated turnover (typically 50-65% during heavy reno; residents leave rather than accept renovation rent) and post-stabilization improved turnover (typically 30-40%, 5-10pp below pre-acquisition baseline because renovation increases unit stickiness — IF rents don't push the affordability ceiling). The agent must reason about both regimes when producing the post-stabilization Pro Forma value.
>
> The single Pro Forma value reflects post-stabilization turnover (the Y_stabilized rate). The evidence narrative explains the pre-renovation regime and the regime shift, providing context for sponsors who want to understand the rationale. Pre-renovation turnover values are surfaced in the Projections tab year-by-year trajectory, not as a separate Pro Forma input.
>
> **Output Slots Populated**
> - `proforma.opex.turnover.value_numeric` — single value, post-stabilization rate
> - `proforma.opex.turnover.evidence` — structured per canonical schema, with regime context narrative
> - (no pre_renovation or post_stabilization sub-fields)

This is cleaner. The agent retains intellectual depth (regime-aware reasoning); the UI stays focused (single value per non-GPR field); the Projections tab carries the pre-stabilization regime visibility year by year.

Pass 2 (all 56 cells) proceeds from this corrected reference. Each non-GPR cell follows the simplified output pattern. The GPR cells across all four deal types retain the floor-plan grid output.
