# Cash Flow Agent Diagnostic — 464 Bishop
**Run:** 808e0016 · 2026-05-17 15:53 UTC · Prompt: cashflow-v8.0-core · Agent: 3.2.0

---

## Headline Finding

The agent emitted a structurally thin underwriting (23 fields, 56% unanchored) by accepting broker OM aggregates for both GPR and Other Income without per-floor-plan comp ceiling computation or per-category rent roll analysis — the two core value-add reasoning steps the recent PR1/PR2 infrastructure was built to enable.

---

## Critical Findings (5)

- **[F-001 / Category F]** No per-floor-plan `unit_mix` grid emitted. GPR ($4.9M) accepted as broker OM aggregate. Despite `fetch_unit_mix` being registered and referenced at 15+ prompt locations, no `comp_ceiling`, `positioning_percentile`, or `yield_on_cost` was computed per floor plan. *Likely root cause: 464 Bishop has a single "Default" floor plan row with no per-plan detail — data gap.* **Fix:** seed per-floor-plan data from rent roll; add postprocess validation for missing unit_mix on value-add runs.

- **[F-002 / Category E]** Renovation premium sourced from broker OM directly. Common Pitfall #1 in the line-item matrix committed: sponsor's asserted stabilized rent treated as comp ceiling input. No `fetch_peer_comp_noi_metrics` (comp_role=renovation_ceiling) evidence in output. `data_points[]` is empty. **Fix:** add Pitfall #1 enforcement to prompt; require `comp_ceiling_source: 'renovation_comp_set'` in per-floor-plan output.

- **[F-003 / Category J]** Other Income at $341,907 (3× P90 benchmark) accepted from broker OM with no per-category breakdown. Method 3 (Rent Roll Actuals with Category Projection) not applied despite T12 and rent roll being available. No `otherIncomeMonthly` consultation. Math engine resolved Other Income via `platform_fallback` (value=0) — it never received category data. **Root cause:** PR2 Edit 2 (Method 3 / otherIncomeMonthly instruction) absent from cashflow-v8.0-core. **Fix:** apply PR2 Edit 2 to system.ts.

- **[F-004 / Category H]** ALL 23 evidence fields emitted as strings — 0 clean. Postprocess normalizer coerced all 23. `data_points[]` is empty for every field after coercion. Evidence drawer will show narrative text only; no structured sourcing table. **Fix:** reinforce evidence JSON format in prompt with a concrete example.

- **[F-005 / Category B]** 13 of 23 fields (56%) at tier4/UNANCHORED. `archive_percentile: null` for all fields. No `cohort_n`. Growth assumptions (rent 3%, expense 3%, exit cap 5%) have no cohort baseline. **Fix:** verify Phase 2 analog baseline tools return data for Atlanta West Midtown; if sparse, document broadening path and populate `cohort_baseline` in evidence fields.

---

## Major Findings (5)

- **[F-006 / Category C]** No per-year posture fields (`proforma.posture.yN`) in output. Posture framework absent from this run. M08, M35, and OperatorStance consumers receive no signal.

- **[F-007 / Category I]** d=2.69 Heroic. Agent response to d > 2.0: "management fee structure — review assumptions for internal consistency." No named market evidence per top_stretch_variable. Result not in structured output key. Also: management_fee at 2.6% of EGI is industry-standard — sigma prior may be miscalibrated.

- **[F-008 / Category D]** Vacancy flat at 5% OM assumption. 464 Bishop is in lease-up at 80.2% occupancy. Y1 vacancy should reflect the absorption trajectory (~19.8% current → stabilized 5%), not the stabilized target. Y1 NOI overstated by ~$177K.

- **[F-009 / Category H]** `other_income` write-back maps to `other_income_per_unit` (line 364, postprocess). Agent emits $341,907 annual; year1 stores { agent: 341907 } in a per-unit-per-month field. **One-line fix:** change to `other_income_dollars`. Same bug class as the management_fee / vacancy / bad_debt fixes in Task #824 — Other Income was not included.

- **[F-010 / Category H]** Insurance agent value ($125,280 from jurisdiction_forecast, tier1) is null in year1; resolved at $46,400 (broker OM underinsured). Stale OM-sourced override blocks the agent's correct value. $79K/year gap flows invisibly to all projections ($1.58M valuation impact at 5% exit cap).

---

## Math Integrity Status

**Pass — with caveat.** `was_corrected: false`. The math engine correctly identified Other Income has no breakdown data and resolved via `platform_fallback`. This is not a math engine failure — the engine is working as designed. The "pass" is vacuous for Other Income because it was never fed category data to reconcile. No subtotal arithmetic errors detected across the 23 fields it did receive.

---

## M36 Status

**Called. d=2.69 Heroic. Functional but needs tuning.**

M36 `evaluate_plausibility` was invoked and returned a result (good — the tool is wired). The d-score and band appear in the run summary. Three M36 ticket items:

1. **Persist plausibility_result** as a structured top-level output key (not just summary text)
2. **Improve d > 2.0 prompt response**: require named market evidence per top_stretch_variable, not a generic structural note
3. **Review management_fee prior**: 2.6% EGI producing Heroic suggests the Phase A prior mean may be below industry standard (3-4% for multifamily). If miscalibrated, Heroic scores will be routine, causing alert fatigue.

**M36 ticket scope: MODERATE.** The tool is functional. Calibration and output persistence are the gaps.

---

## Downstream Priorities

**Ticket A (agent write-back values silently erased): HIGH.** Two confirmed active failures: F-009 (one-line fix, ship_blocker) and F-010 (override source classification, major). Both on this single deal.

**Ticket B (guardrail for cross-deal writes): MEDIUM.** Not directly observed, but F-010's OM-as-override contamination is structurally related — overrides set by the seeder from OM extraction are indistinguishable from deliberate operator overrides. Investigate `override_source` tagging as part of Ticket B scope.

**Ticket C (wire goal-seek tool): LOW.** No findings in this diagnostic relate to goal-seek.

**CIE Phase 1 finding type priorities:**
1. `underpriced_ancillary_fee` — would have blocked F-003's 3× P90 Other Income acceptance
2. `missing_ancillary_category` — EV charging, pet spa, package lockers not broken out
3. `low_ancillary_adoption_rate` — parking/EV in transit-proximate Atlanta submarket

---

## Confidence Assessment

**Not suitable for LP decision in current state.**

Five of the seven most important inputs for a $65M value-add deal are either missing or inadequately sourced: (1) per-floor-plan rent validation, (2) renovation premium derivation, (3) Other Income per-category breakdown, (4) per-year posture/risk classification, and (5) cohort anchoring on growth assumptions. What the agent did correctly: jurisdiction tax forecast ($754K, GA reassessment applied), insurance benchmark ($125K — correct but silently suppressed in year1), M36 plausibility call, collision detection (3 severe). The bones are there. The muscle is missing.

**Five of the 13 findings are one-line or single-prompt-edit fixes.** This is not a structural problem — it is a prompt instruction gap (PR2 Edit 2 not applied) compounded by a data gap (464 Bishop's single Default floor plan) and two known write-back bugs (F-009, F-010).
