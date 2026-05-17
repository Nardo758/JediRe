# OTHER INCOME REASONING METHOD SPEC v1.1

**Status:** v1.1 — post unit mix audit source precision update
**Supersedes:** v1.0

**Changes from v1.0:**
- Added source reference in Sub-step 3a: otherIncomeMonthly is the canonical input after PR 1 hydration fix
- Added Sub-step 3 fallback subsection: Method 3 hybrid with archive cohort when otherIncomeMonthly is sparse
- Section 6.3 added: Competitive Intelligence Engine replaces Method 5 as the platform-wide opportunity detection engine
- Acceptance criteria items 10–11 added: fallback works, accepted CIE findings flow into Method 3 breakdown
- Agent prompt addition: source discipline for per-category detail
- No changes to Methods 1, 2, or selection logic

---

## 1. OVERVIEW

Other Income includes all non-GPR revenue line items: ancillary fees, RUBS (Ratio Utility Billing System) income, pet fees, parking, storage, laundry, package lockers, cable/internet bulk billing, late fees, and other ancillary sources.

This spec defines how the cashflow agent selects and applies a reasoning method for the Other Income line in the proforma. The agent's job is not to apply a formula but to investigate — determine which method is appropriate, source the inputs for that method, and produce a per-category breakdown with evidence.

**Output shape:** The agent produces a single aggregate `LayeredValue<number>` for the Other Income proforma row (rendered as Single-Value per UI spec v1.3), with a per-category breakdown table in the evidence narrative. The math engine (proFormaMathEngine.ts v1.1) reconciles the per-category breakdown against the T-12 aggregate using the source residual convention where applicable.

---

## 2. METHOD SELECTION HIERARCHY

Five methods are defined, ordered from most to least data-rich. The agent selects the highest method for which sufficient inputs exist.

### 2.1 Method 1 — Fee Schedule Projection

**When used:** New development, redevelopment (no existing operating history), or when the sponsor is introducing an ancillary program that does not exist at the subject property.

**Logic:** For each category the sponsor intends to offer, project revenue as:
```
annual_revenue_per_category = fee × adoption_rate × applicable_units × 12
```
Where:
- `fee` comes from sponsor's fee schedule or market survey of comparable properties
- `adoption_rate` comes from S3 owned-portfolio on similar programs, or archive cohort P50 if no owned-portfolio data
- `applicable_units` is the count of units eligible for the program

Aggregate across all categories for the total Other Income projection.

**Source discipline:** Every adoption rate must be traceable to a documented source (owned-portfolio actuals or archive cohort). Do not invent adoption rates.

### 2.2 Method 2 — Aggregate T-12 Trend

**When used:** Stabilized acquisitions where the rent roll provides a T-12 aggregate for Other Income but no per-category breakdown.

**Logic:** Take the T-12 aggregate as the current state. Project forward at the submarket ancillary income growth rate from S4. No per-category breakdown produced — evidence narrative acknowledges the aggregate-only sourcing.

**Limitation:** This method cannot evaluate whether individual categories are underpriced, over-reliant on a single source, or missing entirely. It is appropriate when the operator intends to maintain the existing program unchanged.

### 2.3 Method 3 — Rent Roll Actuals with Category Projection

**When used:** When the rent roll provides per-category ancillary income detail (either via T-12 extraction or via `fetch_data_matrix.extractedData.rentRoll.otherIncomeMonthly`).

**Sub-step 3a: Establish current state from rent roll.** For each ancillary category present in the rent roll, sum the actual collections per unit per month × 12 to produce current annual revenue per category.

**Source (NEW v1.1):** Per-category ancillary detail is sourced from `fetch_data_matrix.extractedData.rentRoll.otherIncomeMonthly` after the hydration fix in PR 1 of the unit mix audit (Item 4). When `otherIncomeMonthly` is populated with per-category breakdown, Method 3 has its primary input. When it is null or sparse, see fallback path below.

**Sub-step 3b: Evaluate adoption and pricing against cohort.** For each category found in 3a, compare the per-unit collection rate against the archive cohort for similar assets. Flag categories where the subject is collecting below P25 of cohort (underpriced or low adoption) or above P75 (high adoption — validate it's sustainable).

**Sub-step 3c: Identify missing categories.** Pull the cohort's Other Income category profile for comparable assets. Categories that appear in ≥ 60% of cohort deals but are absent from the subject's rent roll are "missing categories." Flag these as potential upside if the renovation scope or operational program supports introducing them.

**Sub-step 3d: Produce the proforma projection.** For each category:
- Existing categories: project forward at the sponsor's intended program (fee increases, adoption changes per business plan) or at cohort growth rate if no business plan input
- Missing categories the sponsor intends to introduce: use Method 1 logic for the new program
- Categories the sponsor intends to eliminate: exclude from projection

Aggregate to produce the total Other Income proforma value.

**Sub-step 3 fallback — Method 3 hybrid with Method 1 or Method 5 archive cohort.**

When the subject's `otherIncomeMonthly` is sparse (fewer than 3 categories itemized) or null entirely, Method 3 falls back as follows:

1. For categories present in `otherIncomeMonthly`: Method 3 standard logic applies
2. For categories not present in `otherIncomeMonthly` but in cohort norm: source from Method 5 (Competitive Intelligence Engine, see Section 6.3) which queries archive cohort for similar deals' per-category values
3. For new categories sponsor is introducing: Method 1 logic applies (fee schedule × adoption × applicable units)

The output remains a per-category breakdown with each category carrying its source label in evidence narrative (`rent_roll`, `archive_cohort`, `fee_schedule_projection`). The math engine's hierarchical handling reconciles the aggregate against T-12 unchanged.

### 2.4 Method 4 — Owned-Portfolio Analog

**When used:** Sponsor has directly comparable owned assets with the same ancillary program profile (same operator, similar vintage/class/submarket, similar renovation scope if value-add).

**Logic:** Use the sponsor's actuals from comparable owned assets as the per-category starting point, adjusted for market differences (submarket fee level index) and the subject's renovation scope (if the program will be enhanced).

This method is typically combined with Method 3 — owned-portfolio data fills gaps where the subject's rent roll is thin.

### 2.5 Method 5 — Archive Cohort Projection (superseded by CIE)

Method 5 is now a reference to the Competitive Intelligence Engine. See Section 6.3. The agent's Other Income reasoning consumes CIE findings rather than running a separate archive cohort projection. The method name is retained for backward compatibility in evidence labels.

---

## 3. METHOD SELECTION DECISION TREE

```
Does the subject have a T-12 rent roll with per-category Other Income detail?
  Yes → Does otherIncomeMonthly have ≥ 3 categories populated?
          Yes → Method 3 (full)
          No  → Method 3 with fallback (hybrid with CIE/archive cohort for missing categories)
  No  → Does the sponsor have directly comparable owned assets with similar program?
          Yes → Method 4 (+ Method 1 for any new categories)
          No  → Is this a development / redevelopment deal, or is the sponsor introducing new programs?
                  Yes → Method 1
                  No  → Method 2 (aggregate T-12 trend only — acknowledge limitation in evidence)
```

---

## 4. PER-CATEGORY SOURCE HIERARCHY

For each ancillary category, the agent applies this sourcing priority:

1. **Subject rent roll actuals** (`fetch_data_matrix.extractedData.rentRoll.otherIncomeMonthly`) — Tier 1
2. **Sponsor-owned portfolio actuals** (`fetch_owned_asset_actuals`) — Tier 1 where directly comparable
3. **CIE archive cohort per-category data** (via CIE Other Income findings) — Tier 2
4. **Market survey / sponsor fee schedule** — Tier 2 for Method 1 projections
5. **Platform benchmark** (asset class × submarket × vintage) — Tier 3 fallback

---

## 5. COMPARABLE FILTERING RULES

When sourcing cohort data for adoption rates, per-category fee levels, or growth rates:

- Asset class match (multifamily garden ≠ high-rise)
- Vintage band within ±10 years (or post-renovation condition equivalent)
- Unit count band within ±40%
- Submarket match preferred; metro match minimum
- For RUBS: geographic match required (utility inclusion norms vary significantly by metro)
- For parking: density/transit score match (parking income varies with walkability)

If filtered cohort produces n < 4, broaden one dimension at a time and document with `cohort_match_quality`.

---

## 6. INTEGRATION

### 6.1 With F9 Pro Forma / Math Engine

Other Income produces a single `LayeredValue<number>` consumed by the F9 proforma as the Other Income row. The math engine applies the hierarchical breakdown internally for reconciliation purposes. The UI renders the aggregate via the Single-Value pattern (per UI spec v1.3 Section 3); the per-category breakdown is accessible by expanding the evidence panel on the Other Income row.

### 6.2 With Source Residual Convention v1.1

Other Income is one of the four domains specced in Appendix B of the source residual convention. When the agent emits a method that produces partial breakdown (e.g., Method 3 where T-12 has categories the rent roll doesn't capture), the platform may compute residuals per the convention.

Method 1 typically doesn't produce residuals (no source total to residualize against).
Method 2 doesn't produce residuals (aggregate-only, no breakdown to reconcile).
Method 3 may produce Pattern A or Pattern B residuals if the sponsor's plan covers categories the rent roll doesn't.

### 6.3 With Competitive Intelligence Engine (NEW v1.1)

Method 5 of this spec is superseded by the platform-wide Competitive Intelligence Engine. The CIE produces opportunity findings for Other Income (missing categories, underpriced fees, low adoption rates) as part of its revenue domain. See `COMPETITIVE_INTELLIGENCE_ENGINE_SPEC.md` for full coverage.

Within this Other Income spec, Method 5 is now a *reference* to CIE, not a separate method. The agent's Other Income reasoning consumes CIE findings when relevant (e.g., a CIE "missing RUBS" finding that the sponsor has accepted appears as a category in Method 3's per-category breakdown for the stabilized year).

---

## 7. AGENT PROMPT UPDATES

The cashflow agent system prompt includes the following guidance for Other Income:

**Method selection:** Run the decision tree in Section 3 before selecting a method. State your selected method and why in the evidence narrative.

**Per-category requirement:** Methods 1, 3, and 4 must produce a per-category breakdown. Method 2 is aggregate-only and must acknowledge this limitation explicitly. Aggregate-only output from a deal that has category detail available is a quality failure.

**Source for per-category rent roll detail (NEW v1.1):** When using Method 3, source per-category ancillary detail from `fetch_data_matrix.extractedData.rentRoll.otherIncomeMonthly`. When this is sparse or null, fall back to CIE-sourced cohort data for missing categories. Do not invent per-category values — every category in your output must trace to a documented source.

**CIE integration:** When CIE has produced an Other Income opportunity finding (e.g., "RUBS not implemented — cohort P50 adds $48/unit/mo"), and the sponsor has accepted the finding, include the accepted category in your Method 3 projection with source label `cie_accepted_finding`.

**Aggregate reconciliation:** After producing the per-category breakdown, cross-check your aggregate against the T-12 aggregate. If your projection exceeds T-12 by more than 15%, explain the delta (new programs, fee increases, adoption improvement). If it's below T-12, explain the reduction.

---

## 8. COMMON PITFALLS

1. **Using Method 2 when per-category data is available.** If `otherIncomeMonthly` is populated, Method 3 is required. Method 2 is aggregate-only and cannot evaluate program quality.

2. **Inventing adoption rates.** Every adoption rate must trace to S3 (owned-portfolio) or archive cohort. Platform defaults are Tier 3 — use them only when both S3 and cohort data are absent.

3. **Treating T-12 aggregate as the ceiling.** T-12 reflects the existing program. A sponsor improving the ancillary program legitimately projects above T-12 — but the delta must be traced to specific category improvements with defensible adoption and fee assumptions.

4. **Ignoring missing categories.** Always run Sub-step 3c (missing category identification) when using Method 3. Skipping this step means the agent cannot surface CIE-identified revenue upside.

5. **Per-unit rates that ignore unit eligibility.** Parking income only applies to units with parking access. RUBS only applies to units covered by the billing structure. Always apply applicable_unit counts, not total unit count.

6. **Growth rate uniformity across categories.** Ancillary fee categories grow at different rates. Pet fees are more stable. RUBS tracks utility cost trends. Parking tracks submarket parking demand. Do not apply a single flat growth rate to all categories.

---

## 9. ACCEPTANCE CRITERIA

1. On a stabilized deal with a full T-12 rent roll, Method 3 is selected and a per-category breakdown is produced
2. On a development deal with no operating history, Method 1 is selected with fee schedule × adoption rate × applicable units per category
3. When `otherIncomeMonthly` is null, Method 3 fallback produces a hybrid breakdown with source labels (`rent_roll`, `archive_cohort`, `fee_schedule_projection`) per category
4. Missing categories (present in ≥ 60% of cohort but absent from subject) are identified and flagged
5. The aggregate projection reconciles against T-12 with an explicit delta explanation when deviation exceeds 15%
6. Per-category breakdown appears in evidence narrative regardless of method selected (except Method 2 aggregate-only)
7. CIE-accepted Other Income findings appear as categories in Method 3 projection with `cie_accepted_finding` source label
8. Comparable filtering rules are applied before consuming cohort adoption rates; n < 4 triggers cohort broadening with documented `cohort_match_quality`
9. On a development test deal, Method 1 is selected with adoption rates traceable to owned-portfolio or archive cohort
10. (NEW) When `otherIncomeMonthly` is sparse, Method 3 fallback correctly hybrids with archive cohort per-category data (via CIE) and produces a complete per-category breakdown
11. (NEW) Method 5 reference to CIE: when CIE produces an Other Income opportunity finding that the sponsor accepts, the accepted category appears in Method 3's per-category breakdown on the next agent run

---

## 10. OPEN QUESTIONS

### Q1: RUBS implementation threshold
What submarket utility cost level justifies introducing RUBS when it is not present? Defer to CIE opportunity scoring — if CIE surfaces it as a finding, the threshold is met.

### Q2: Cable/internet bulk billing treatment
Some sponsors negotiate bulk agreements that produce Other Income. This is a contract-dependent projection (not rent-roll-sourced) — treat as Method 1 with sponsor contract terms as primary input.

### Q3: Per-category growth rate sources
Parking and storage demand track differently than fee income. Future version: per-category growth rate library keyed by metro × category.

---

## 11. CHANGELOG

**v1.1 (current)**
- Added source reference in Sub-step 3a: `otherIncomeMonthly` is the canonical input after the hydration fix in PR 1 of the unit mix audit (Item 4)
- Added Sub-step 3 fallback subsection: Method 3 hybrid with archive cohort when `otherIncomeMonthly` is sparse (< 3 categories) or null
- Section 6.3 added: Competitive Intelligence Engine supersedes Method 5 as the platform-wide opportunity detection engine; Method 5 retained as a reference alias
- Acceptance criteria items 10–11 added: sparse fallback works; accepted CIE findings flow into Method 3 breakdown
- Section 7 agent prompt: added source discipline note for per-category detail (`fetch_data_matrix.extractedData.rentRoll.otherIncomeMonthly`)
- No changes to Methods 1, 2, or 4; no changes to method selection decision tree

**v1.0 (archival)**
- Initial spec — five methods specced (Method 5 was archive cohort projection, now superseded by CIE in v1.1)
- Sections 1–10 established: overview, method selection, per-category sourcing, comparable filtering, integration, agent prompt, pitfalls, acceptance criteria
