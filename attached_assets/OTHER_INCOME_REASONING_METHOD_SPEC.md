# OTHER INCOME REASONING METHOD SPEC v1.1.1

**Status:** v1.1.1 — Method 4 selection logic + CIE bidirectional integration
**Supersedes:** v1.1

**Changes from v1.1:**
- Added Method 4 to the selection function with deterministic criteria (owned-portfolio match quality + ancillary program match + n ≥ 2 comparables)
- Added DataAvailability fields supporting Method 4 selection
- Clarified Method 4 as a standalone alternative to Method 3, not an overlay
- Rewrote Section 2.5 (Method 5) as the active CIE integration point rather than backward-compat-only
- Rewrote Section 6.3 to specify the bidirectional integration loop
- Each accepted CIE finding now has a documented consumption path in the agent's next reasoning pass
- No changes to Methods 1, 2, or 3

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

**When applicable:**

When the sponsor has directly comparable owned assets that operate the same ancillary program as the subject deal will operate post-stabilization. The criteria are strict:
- 2 or more comparable owned-portfolio assets (n ≥ 2)
- Asset class match (Class A for Class A, etc.)
- Vintage band within ±10 years of subject
- Submarket match or comparable submarket
- The ancillary program structure matches: same fee categories, similar adoption patterns, similar unit composition

When these criteria are met, the sponsor's own actuals are the highest-fidelity projection available. Archive cohort and fee schedule projections are lower fidelity by comparison.

**Inputs:**

- Sponsor's owned-portfolio actuals via `fetch_owned_asset_actuals`
- Per-category revenue at the comparable assets (P25/P50/P75 across the sponsor's comparable portfolio)
- Market adjustment factors: submarket rent index differential between subject and sponsor's comparable assets (to scale fees to subject's market)
- Renovation scope adjustment: if subject is being renovated differently than the sponsor's comparable assets, apply scope-driven adjustments per category

**Derivation:**

For each ancillary category present in the sponsor's owned-portfolio comparable assets:

```
subject_category_revenue =
  sponsor_owned_portfolio_p50_per_category
  × market_adjustment_factor
  × subject_unit_count_ratio
```

Where:
- `sponsor_owned_portfolio_p50_per_category` is the median annual category revenue per unit at the sponsor's comparable assets
- `market_adjustment_factor` scales for rent index differentials between markets
- `subject_unit_count_ratio` scales for property size differences

Sum across categories to produce stabilized year Other Income.

**Output shape:**

- Per-category dollar values
- Aggregate
- Each category's evidence narrative names the specific comparable owned-portfolio assets used as anchor, with attribution
- `source: 'agent_method_4'` per category

**Method 4 is a standalone alternative to Method 3, NOT an overlay.**

When Method 4 is selected, it replaces Method 3's rent-roll-triangulation approach with sponsor-portfolio-anchored projections. The subject's rent roll detail (via `otherIncomeMonthly`) is still consulted for current state, but the *stabilized projection* is sponsor-portfolio-driven, not rent-roll-driven.

When Method 4 is NOT selected (criteria not met), Method 3 applies with owned-portfolio data feeding into Method 3's source hierarchy at lower priority (below rent roll, above archive cohort). This is the standard pattern across all methods.

**Confidence:**

- High when n ≥ 3 comparable owned-portfolio assets with matching ancillary program
- Medium when n = 2 OR ancillary program partial match
- Low when n < 2 (fall back to Method 3)

When confidence drops to low, the agent should switch to Method 3 rather than proceed with weak Method 4.

### 2.5 Method 5 — Competitive Intelligence Engine reference

Method 5 is not a standalone reasoning method. It is the active integration point between Other Income reasoning and the platform-wide Competitive Intelligence Engine (CIE).

**Backward compatibility:**

In v1.0 of this spec, Method 5 was "Archive Cohort Projection" — a standalone method using archive cohort distributions when no other data was available. That standalone usage has been retired. Evidence labels carrying `method: 'method_5'` or `source: 'archive_cohort_projection'` from v1.0-era deals are retained for audit-trail consistency but no new evidence is produced with these labels.

**Active integration with CIE:**

The CIE produces opportunity findings across the revenue domain, including three finding types specifically for Other Income:
- `missing_ancillary_category`: cohort presence ≥ 50%; subject has none
- `underpriced_ancillary_fee`: subject rate < cohort P25
- `low_ancillary_adoption_rate`: subject adoption < cohort P25

These findings are durable artifacts the sponsor reviews and accepts, declines, or defers.

**Consumption path — accepted CIE findings flow into the agent's reasoning:**

When the agent runs Other Income reasoning, it reads existing CIE findings from DealContext:

```typescript
const ciFindings = dealContext.ci_findings
  .filter(f => f.domain === 'revenue')
  .filter(f => f.sponsor_state === 'accepted')
  .filter(f =>
    f.finding_type === 'missing_ancillary_category' ||
    f.finding_type === 'underpriced_ancillary_fee' ||
    f.finding_type === 'low_ancillary_adoption_rate'
  );
```

For each accepted finding, the agent incorporates the recommended change into its projection:

- **Accepted `missing_ancillary_category`** → adds the category to the stabilized year per-category breakdown using Method 1 logic (fee schedule × adoption × applicable units). The category appears in the Pro Forma even though it's not in the current rent roll.

- **Accepted `underpriced_ancillary_fee`** → adjusts the category's rate to the cohort P50 (or sponsor's chosen positioning) in the stabilized year projection. The current rate is preserved in pre-stabilization year(s); the adjustment phases in.

- **Accepted `low_ancillary_adoption_rate`** → adjusts the category's adoption rate to cohort P50 in the stabilized year projection. Same phase-in pattern as rate adjustments.

Findings in `sponsor_state: 'unreviewed'` or `'deferred'` do NOT feed the projection but are referenced in the evidence narrative as opportunities the sponsor has not yet acted on.

Findings in `sponsor_state: 'declined'` are excluded entirely.

**This is the feedback loop:**

The agent produces the projection (Methods 1–4). CIE compares the projection against cohort and surfaces findings. The sponsor reviews findings and decides. Accepted findings flow back into the agent's next projection. Each cycle progressively closes the gap between the subject deal's underwriting and the comparable cohort's realized achievement.

**Method 5 is not selected via the selection function.** It is *always active* when CIE findings exist. The selection function returns Method 1–4 for the projection method; Method 5's findings are incorporated regardless of which projection method is selected.

See `COMPETITIVE_INTELLIGENCE_ENGINE_SPEC.md` for full CIE coverage including the universal finding shape, severity classification, and sponsor interaction model.

---

## 3. METHOD SELECTION

### 3.1 Selection function

```typescript
function selectOtherIncomeMethod(
  dealContext: DealContext,
  dataAvailability: DataAvailability,
): 'method_1' | 'method_2' | 'method_3' | 'method_4' {

  // Pre-stabilization deals — no operating history
  const isPreStabilization = dealContext.classification === 'development' ||
                              dealContext.classification === 'lease_up' ||
                              (dealContext.classification === 'redevelopment' &&
                               dealContext.scope === 'full_repositioning');

  if (isPreStabilization) {
    // Method 4 takes priority over Method 1 when sponsor has directly comparable
    // owned assets with the same ancillary program
    if (hasDirectlyComparableOwnedPortfolio(dataAvailability)) {
      return 'method_4';
    }
    return 'method_1';
  }

  // Stabilized acquisition with no operational lift — T-12 is sufficient
  const isStabilizedNoLift = dealContext.classification === 'acquisition_stabilized' &&
                              !dealContext.strategy.includes_other_income_lift;

  if (isStabilizedNoLift && dataAvailability.t12_quality === 'high') {
    return 'method_2';
  }

  // Value-add and stabilized-with-lift deals
  // Method 4 wins when sponsor has directly comparable owned assets
  if (hasDirectlyComparableOwnedPortfolio(dataAvailability)) {
    return 'method_4';
  }

  // Default: rent roll triangulation
  return 'method_3';
}

function hasDirectlyComparableOwnedPortfolio(
  dataAvailability: DataAvailability,
): boolean {
  return (
    dataAvailability.owned_portfolio_match_quality === 'high' &&
    dataAvailability.owned_portfolio_has_ancillary_program === true &&
    dataAvailability.owned_portfolio_comparable_count >= 2
  );
}
```

**DataAvailability interface** (relevant fields):

```typescript
interface DataAvailability {
  // Existing fields
  t12_present: boolean;
  t12_quality: 'high' | 'medium' | 'low' | 'absent';
  rent_roll_ancillary_detail: boolean;

  // NEW for Method 4 selection
  owned_portfolio_match_quality: 'high' | 'medium' | 'low' | 'absent';
  owned_portfolio_has_ancillary_program: boolean;
  owned_portfolio_comparable_count: number;
}
```

### 3.2 Deal-type defaults

| Deal Type | Default Method | Method 4 Override Condition |
|---|---|---|
| Acquisition (value-add) | Method 3 | Sponsor has 2+ directly comparable owned-portfolio assets with the same ancillary program |
| Acquisition (stabilized, no lift) | Method 2 | Same as above |
| Acquisition (stabilized, with lift) | Method 3 | Same as above |
| Development | Method 1 | Same as above |
| Redevelopment (full repositioning) | Method 1 | Same as above |
| Redevelopment (partial) | Method 3 | Same as above |
| Lease-up | Method 1 | Same as above |

The Method 4 override applies across all deal types when the owned-portfolio criteria are met. Method 4 takes priority because the sponsor's own actuals are higher fidelity than archive cohort or fee schedule projections.

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

### 6.3 With Competitive Intelligence Engine — bidirectional integration

The CIE is the platform-wide opportunity detection engine. For Other Income, CIE produces three finding types covering categories the agent's underwriting might miss or underprice.

**Bidirectional integration:**

1. **Agent → CIE:** The agent's stated Pro Forma value (via Methods 1–4) flows into CIE's comparison. CIE compares the projection against archive cohort distribution and produces findings where the agent's projection is structurally below cohort norm.

2. **CIE → Agent:** Sponsor-accepted CIE findings flow into the agent's next Other Income reasoning pass via Method 5 (the CIE reference). The agent's next projection incorporates the accepted findings.

This is a feedback loop. Each agent run + CIE pass progressively closes the gap between the subject deal's underwriting and the comparable cohort's realized achievement. The platform learns the deal's value-creation envelope over time.

**Method 5 is the consumption side of the loop.** CIE produces findings; Method 5 (referenced from whichever projection method is active) consumes accepted findings. The two specs together describe the complete loop — this spec covers the agent's consumption pattern; the CIE spec covers the production pattern.

See `COMPETITIVE_INTELLIGENCE_ENGINE_SPEC.md` for full CIE coverage.

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

**v1.1.1 (current)**
- Added Method 4 to the selection function with deterministic criteria (owned-portfolio match quality + ancillary program match + n ≥ 2 comparables)
- Added `DataAvailability` fields supporting Method 4 selection: `owned_portfolio_match_quality`, `owned_portfolio_has_ancillary_program`, `owned_portfolio_comparable_count`
- Section 3 restructured: pseudocode decision tree replaced with typed `selectOtherIncomeMethod()` function and `hasDirectlyComparableOwnedPortfolio()` helper; Section 3.2 deal-type defaults table added with Method 4 override condition column
- Clarified Method 4 (Section 2.4) as a standalone alternative to Method 3, not an overlay; "typically combined with Method 3" language removed; explicit "NOT an overlay" statement added; full criteria, derivation formula, output shape, and confidence tiers added
- Rewrote Section 2.5 (Method 5) as the active CIE integration point: backward-compat note for v1.0 labels, three CIE finding types, `ciFindings` filter snippet, per-finding-type consumption paths, unreviewed/deferred/declined handling, feedback loop summary
- Rewrote Section 6.3 to specify bidirectional integration (Agent→CIE and CIE→Agent); "Method 5 is the consumption side of the loop" clarification added
- No changes to Methods 1, 2, or 3

**v1.1 (archival)**
- Added source reference in Sub-step 3a: `otherIncomeMonthly` is the canonical input after the hydration fix in PR 1 of the unit mix audit (Item 4)
- Added Sub-step 3 fallback subsection: Method 3 hybrid with archive cohort when `otherIncomeMonthly` is sparse (< 3 categories) or null
- Section 6.3 added: Competitive Intelligence Engine supersedes Method 5 as the platform-wide opportunity detection engine; Method 5 retained as a reference alias
- Acceptance criteria items 10–11 added: sparse fallback works; accepted CIE findings flow into Method 3 breakdown
- Section 7 agent prompt: added source discipline note for per-category detail (`fetch_data_matrix.extractedData.rentRoll.otherIncomeMonthly`)
- No changes to Methods 1, 2, or 4; no changes to method selection decision tree

**v1.0 (archival)**
- Initial spec — five methods specced (Method 5 was archive cohort projection, now superseded by CIE in v1.1)
- Sections 1–10 established: overview, method selection, per-category sourcing, comparable filtering, integration, agent prompt, pitfalls, acceptance criteria
