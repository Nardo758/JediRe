# SPEC TEXT UPDATES — POST UNIT MIX AUDIT

**Purpose:** Concrete text changes to three existing specs in response to the unit mix audit. All changes are surgical — section-level patches, not rewrites. Apply after PR 1 (data plumbing) ships.

**Affected specs:**
1. `PRO_FORMA_REGIME_INPUT_UI_SPEC.md` (v1.2 → v1.3)
2. `OTHER_INCOME_REASONING_METHOD_SPEC.md` (v1.0 → v1.1)
3. `CASHFLOW_LINE_ITEM_MATRIX_PASS1_PATCHED.md` (v1.2 → v1.3)

---

## UPDATE 1 — UI Spec v1.2 → v1.3

### Section 5.1 (Floor-Plan Grid data shape) — add agent input source clarification

**Current text:**

> The UI consumes the agent's output per the field catalog. Pattern A requires the per-floor-plan grid output slots from the patched Pass 1 reference cell, extended with cost and yield-on-cost fields:

**Replace with:**

> The UI consumes the agent's output per the field catalog. Pattern A requires the per-floor-plan grid output slots from the patched Pass 1 reference cell, extended with cost and yield-on-cost fields.
>
> **Agent input source (NEW v1.3):** The agent populates `proforma.revenue.gpr.unit_mix[]` by calling `fetch_unit_mix` (canonical per-floor-plan source) for unit counts, current market rents, in-place rents, and floor plan groupings. The agent calls `fetch_peer_comp_noi_metrics` and `fetch_data_library_comps` for comp ceiling data per floor plan. The agent calls `fetch_owned_asset_actuals` for historical capture rates. The composite output is the `unit_mix[]` array consumed by the UI.
>
> **Important:** `fetch_unit_mix` is the only canonical source for per-floor-plan unit data. The legacy `fetch_rent_roll` returns property-wide aggregates only and does not provide per-floor-plan detail. The agent must call `fetch_unit_mix` for any floor-plan-grid output.

### Section 7 (Integration with existing M09) — add data flow note

**Add as item 8 in Section 7:**

> 8. **Source-of-truth coordination.** The Floor-Plan Grid reads from `deal_assumptions.unit_mix` (with overrides applied via `unit_mix_overrides`). The agent reads from the same canonical source via `fetch_unit_mix`. Sponsor overrides in the Unit Mix tab flow to the agent on the next run. This single-source-of-truth pattern was established in PR 1 of the data plumbing audit (Item 1: create fetch_unit_mix tool).

### Changelog (Section 12) — add v1.3 entry

```
**v1.3 (current)**
- Added agent input source clarification in Section 5.1: agent populates unit_mix[] via fetch_unit_mix (canonical), fetch_peer_comp_noi_metrics + fetch_data_library_comps (comp ceiling), and fetch_owned_asset_actuals (capture rates)
- Added Section 7 item 8: source-of-truth coordination between Floor-Plan Grid, Unit Mix tab, and agent
- No structural changes to the grid; only source reference precision
```

---

## UPDATE 2 — Other Income Reasoning Method Spec v1.0 → v1.1

### Section 2.3 (Method 3) — add Sub-step 3a source reference

**Current text in Sub-step 3a:**

> Sub-step 3a: Establish current state from rent roll. For each ancillary category present in the rent roll, sum the actual collections per unit per month × 12 to produce current annual revenue per category.

**Replace with:**

> Sub-step 3a: Establish current state from rent roll. For each ancillary category present in the rent roll, sum the actual collections per unit per month × 12 to produce current annual revenue per category.
>
> **Source (NEW v1.1):** Per-category ancillary detail is sourced from `fetch_data_matrix.extractedData.rentRoll.otherIncomeMonthly` after the hydration fix in PR 1 of the unit mix audit (Item 4). When `otherIncomeMonthly` is populated with per-category breakdown, Method 3 has its primary input. When it is null or sparse, see fallback path below.

### Section 2.3 (Method 3) — add fallback path subsection

**Insert as new subsection after Sub-step 3d:**

> **Sub-step 3 fallback — Method 3 hybrid with Method 1 or Method 5 archive cohort.**
>
> When the subject's `otherIncomeMonthly` is sparse (fewer than 3 categories itemized) or null entirely, Method 3 falls back as follows:
>
> 1. For categories present in `otherIncomeMonthly`: Method 3 standard logic applies
> 2. For categories not present in `otherIncomeMonthly` but in cohort norm: source from Method 5 (Competitive Intelligence Engine, see separate spec) which queries archive cohort for similar deals' per-category values
> 3. For new categories sponsor is introducing: Method 1 logic applies (fee schedule × adoption × applicable units)
>
> The output remains a per-category breakdown with each category carrying its source label in evidence narrative (`rent_roll`, `archive_cohort`, `fee_schedule_projection`). The math engine's hierarchical handling reconciles the aggregate against T-12 unchanged.

### Section 6 (Integration) — replace 6.2 reference

**Current text in Section 6:**

> ### 6.2 With Source Residual Convention v1.1
> Other Income is one of the four domains specced in Appendix B of the source residual convention...

**Replace with:**

> ### 6.2 With Source Residual Convention v1.1
> Other Income is one of the four domains specced in Appendix B of the source residual convention. When the agent emits a method that produces partial breakdown (e.g., Method 3 where T-12 has categories the rent roll doesn't capture), the platform may compute residuals per the convention.
>
> Method 1 typically doesn't produce residuals (no source total to residualize against).
> Method 2 doesn't produce residuals (aggregate-only, no breakdown to reconcile).
> Method 3 may produce Pattern A or Pattern B residuals if the sponsor's plan covers categories the rent roll doesn't.
>
> ### 6.3 With Competitive Intelligence Engine (NEW v1.1)
> Method 5 of this spec is superseded by the platform-wide Competitive Intelligence Engine. The CIE produces opportunity findings for Other Income (missing categories, underpriced fees, low adoption rates) as part of its revenue domain. See `COMPETITIVE_INTELLIGENCE_ENGINE_SPEC.md` for full coverage.
>
> Within this Other Income spec, Method 5 is now a *reference* to CIE, not a separate method. The agent's Other Income reasoning consumes CIE findings when relevant (e.g., a CIE "missing RUBS" finding that the sponsor has accepted appears as a category in Method 3's per-category breakdown for the stabilized year).

### Section 9 (Acceptance criteria) — update item 9

**Current item 9:**

> 9. On a development test deal, Method 1 is selected with adoption rates traceable to owned-portfolio or archive

**Replace with:**

> 9. On a development test deal, Method 1 is selected with adoption rates traceable to owned-portfolio or archive cohort
> 10. (NEW) When `otherIncomeMonthly` is sparse, Method 3 fallback correctly hybrid with archive cohort per-category data (via CIE) and produces a complete per-category breakdown
> 11. (NEW) Method 5 reference to CIE: when CIE produces an Other Income opportunity finding that the sponsor accepts, the accepted category appears in Method 3's per-category breakdown on the next agent run

### Section 7 (Agent prompt updates) — add Section A.5 sub-section

**Add to the existing prompt update text:**

> **Source for per-category rent roll detail (NEW v1.1):** When using Method 3, source per-category ancillary detail from `fetch_data_matrix.extractedData.rentRoll.otherIncomeMonthly`. When this is sparse or null, fall back to CIE-sourced cohort data for missing categories. Do not invent per-category values — every category in your output must trace to a documented source.

### Changelog (Section 10 — new) — add v1.1 entry

Add a new Section 12 (Changelog) at the end of the document:

```
## 12. CHANGELOG

**v1.1 (current)**
- Added source reference in Sub-step 3a: otherIncomeMonthly is the canonical input
- Added Sub-step 3 fallback subsection: Method 3 hybrid with archive cohort when otherIncomeMonthly is sparse
- Section 6.3 added: Competitive Intelligence Engine replaces Method 5 as the platform-wide opportunity detection engine
- Acceptance criteria items 10-11 added: fallback works, accepted CIE findings flow into Method 3 breakdown
- Agent prompt addition: source discipline for per-category detail
- No changes to Methods 1, 2, or selection logic

**v1.0 (archival)**
- Initial spec — five methods specced (Method 5 was archive cohort projection, now superseded by CIE)
```

---

## UPDATE 3 — Line-Item Investigation Matrix Pass 1 Patched v1.2 → v1.3

### Source Hierarchy section (Value-Add GPR cell) — update internal source references

**Current text:**

> - **Per-unit walk mechanics — S2 (rent roll) + S4 (anchor growth rates via `fetch_anchor_growth_rates`).** Rent roll provides per-unit lease end dates and current contract rent. Anchor growth rates provide monthly market drift. These are inputs to the walk; not separate projections.

**Replace with:**

> - **Per-unit walk mechanics — S2 (rent roll via fetch_unit_mix for per-floor-plan + fetch_rent_roll for property-wide context) + S4 (anchor growth rates via `fetch_anchor_growth_rates`).** `fetch_unit_mix` provides per-floor-plan unit counts and in-place rents; `fetch_rent_roll` provides property-wide rent roll context (occupancy, lease maturity, market rent spread). Anchor growth rates provide monthly market drift. These are inputs to the walk; not separate projections.
>
> **Important (NEW v1.3):** Per-floor-plan detail is available only via `fetch_unit_mix`, which reads from `deal_assumptions.unit_mix` (canonical) and applies sponsor overrides. `fetch_rent_roll` returns property-wide aggregates only and does NOT provide per-floor-plan data. Agents calling `fetch_rent_roll` and expecting floor-plan breakdown will see undefined fields.

### Output Slots Populated section — clarify source for unit_mix grid

**Add at the end of the "Per-floor-plan grid slots" subsection:**

> **Source for unit_mix[] grid (NEW v1.3):** The agent assembles each `UnitMixEntry` by combining outputs from multiple tools:
> - Unit count, floor plan label, current market rent: from `fetch_unit_mix`
> - Comp ceiling P25/P50/P75: from `fetch_peer_comp_noi_metrics` and `fetch_data_library_comps`
> - Capture rate baseline: from `fetch_owned_asset_actuals` (if available) or platform default
> - Renovation cost per unit: from `fetch_data_matrix.extractedData.capex.capex_schedule` (or sponsor-provided M22 schedule)
> - Renovation scope: from M22 capex_schedule scope descriptor
>
> The agent's job is to assemble these into the `unit_mix[]` array per floor plan. Failure modes include: emitting unit_mix without calling fetch_unit_mix (per-floor-plan data unavailable), using fetch_rent_roll for per-floor-plan data (returns property aggregate only), or smoothing capture rates uniformly across floor plans (use S3 owned-portfolio per-floor-plan when available).

### Common Pitfalls section — add new pitfall

**Add as Common Pitfall #10:**

> 10. **Reading per-floor-plan data from the wrong source.** The legacy `fetch_rent_roll` tool returns property-wide aggregates only — total units, average rent, total monthly income. It does not return per-floor-plan breakdown. Agents that expect floor-plan detail from `fetch_rent_roll` will receive undefined fields and produce smoothed (incorrect) underwriting. Always call `fetch_unit_mix` for per-floor-plan data. This pitfall is the primary source of the Scenario C divergence diagnosed in the unit mix audit.

### Changelog notes section — append v1.3 update

**Append to the Notes section:**

> **v1.3 update (current):** Source references in the Value-Add GPR cell updated post unit mix audit. The cell now distinguishes `fetch_unit_mix` (canonical per-floor-plan source) from `fetch_rent_roll` (property-wide aggregates only). New Common Pitfall #10 codifies the source-confusion failure mode. No changes to investigation questions, comparable filtering rules, confidence rules, or matrix structure.

---

## APPLICATION ORDER

These updates should be applied **after PR 1 of the unit mix audit ships** (when `fetch_unit_mix` exists, `floorPlanMix` is hydrated, and `otherIncomeMonthly` is mapped). Applying them before would create references to tools and fields that don't exist in production.

Suggested order:
1. PR 1 ships (data plumbing fixes in production)
2. Apply UI Spec v1.3 update (1 patch)
3. Apply Other Income Method Spec v1.1 update (2-3 patches)
4. Apply Line-Item Matrix v1.3 update (3 patches)
5. PR 2 ships (agent prompt updates referencing the new specs)

All five steps are mechanical. No structural rework. Estimated: 30 minutes of editing + PR review.

---

## NO STRUCTURAL CHANGES

Every update in this document is **text precision** — clarifying which tool sources which field, adding fallback paths, updating cross-references. The specs' architectures (three patterns, three methods, cell schema) are unchanged.

The unit mix audit didn't break the specs. It surfaced that the specs were referencing data plumbing that didn't fully exist. PR 1 builds the plumbing; these updates make the references precise.
