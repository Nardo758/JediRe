# Priority 3 Closing Note — Agent Prompt Operational Depth

**Task:** #842  
**Date:** 2026-05-17  
**Prompt files changed:**
- `backend/src/agents/prompts/cashflow/system.ts`
- `backend/src/agents/prompts/cashflow/variants/existing.ts`

---

## Pre-Iteration Diagnosis

### F-005: archive_assumption_benchmarks table is empty

Query result:
```sql
SELECT COUNT(*) AS total_rows, COUNT(DISTINCT assumption_name) AS unique_assumptions
FROM archive_assumption_benchmarks;
-- total_rows: 0, unique_assumptions: 0
```

**Finding:** The table has zero rows. `fetch_archive_assumption_distribution` will return
`found: false` for every call regardless of parameters. The 44% → 56% UNANCHORED rate on
464 Bishop is not a prompt failure — it is a data gap. The archive must be seeded before
cohort anchoring can function for any deal.

**Action taken:** Prompt improved to handle the empty-archive case explicitly (F-005 section
below). Filed as follow-up: seed archive benchmarks from existing deals.

### F-003: `otherIncomeMonthly` absent from 464 Bishop DealContext

Query result:
```
other_income_monthly: null
other_income_sources: null
deal_context_snippet: null
```

The `deal_data.deal_context` key doesn't exist for 464 Bishop. This means the agent has no
`context.extractedData.otherIncomeMonthly` to reference. The T-12 Other Income aggregate IS
present in the extraction, but the per-category breakdown requires either T-12 line-item
detail or DealContext hydration.

**Action taken:** Prompt now explicitly handles absent `otherIncomeMonthly` with a fallback
chain (T-12 detail → archive cohort P50). The DealContext hydration gap is a separate issue.

---

## F-002 — Renovation Premium Analysis (GPR for Existing Deals)

**Failure:** Agent was taking broker OM's asserted stabilized GPR as direct input instead of
building a floor-plan-level comp grid for stabilized/existing deals.

**Root cause:** The two-comp-set GPR protocol in `system.ts` was labeled
`## GPR Investigation — Value-Add Deals` and the orchestration note said "For value-add deals,
call TWICE". For existing/stabilized deals, there was no requirement to call
`fetch_peer_comp_noi_metrics` at all, and no floor-plan-level GPR grid protocol.

**Prompt change — `variants/existing.ts`:**

Added section: `### F-002 — GPR Floor-Plan Grid (REQUIRED for stabilized deals)`

Requirements now:
1. Call `fetch_unit_mix` first for per-floor-plan unit_count, in_place_rent, market_rent
2. Call `fetch_peer_comp_noi_metrics` (comp_role: "baseline") to cross-validate market rents
3. Build per-floor-plan GPR grid populating unit_mix[floor_plan_id].* slots
4. Cross-validate computed total_gpr against T-12 GPR; investigate any gap > 5%

Hard prohibition added: "Writing the broker OM's asserted GPR directly to
`revenue.gross_potential_rent` as the primary input without completing this floor-plan
validation gate first."

Also updated Phase 3 orchestration in `system.ts` to explicitly state: existing/stabilized
deals call `fetch_peer_comp_noi_metrics` ONCE with comp_role='baseline' (not twice;
no renovation ceiling).

---

## F-001 — Sparse `fetch_unit_mix` Output

**Failure:** When `fetch_unit_mix` returned `has_data: false`, agent silently emitted no
floor-plan grid and fell back to broker OM numbers.

**Root cause:** No instruction in the prompt for what to do when `has_data: false`. The
tool returns the empty state cleanly (message: "No unit mix data found...") but the agent
had no protocol for this case.

**Prompt change — `system.ts` Phase 1 section:**

Added `F-001 — When fetch_unit_mix returns has_data: false` block after the fetch_unit_mix
Phase 1 entry:
- Build degenerate single-row grid with floor_plan_id: "Default"
- Populate from property-wide totals (fetch_data_matrix context.totalUnits, fetch_rent_roll avg)
- Populate `proforma.revenue.gpr.unit_mix.limitation_note` documenting the sparsity
- Set `proforma.revenue.gpr.confidence: "low"` with `confidence_rationale`

Key principle added: "A documented sparse grid is always better than a silent void."

---

## F-003 — Other Income Per-Category Breakdown

**Failure:** Agent emitted a single Other Income aggregate (e.g., `revenue.other_income: 8500`).
No per-category breakdown, no source attribution, no method selection.

**Root cause:** The system prompt listed `other_income` in the standard line items but had no
per-category breakdown requirement. The `CASHFLOW_VARIANT_EXISTING` line-item matrix cell
referenced "apply matrix cell" but the matrix cell for Other Income didn't mandate breakdown.

**Prompt change — `system.ts` OpEx rules section:**

Added `### F-003 — Other Income: Per-Category Breakdown (MANDATORY on every run)` immediately
after the standard line items block.

Required categories: laundry, parking, storage, pet_fees, rubs, cable_telecom, misc.

Each category must have: `amount_monthly_per_unit`, `source` (rent_roll | t12 | archive_cohort
| fee_schedule_projection | none), `method_selected`, `notes`.

Absent DealContext handling:
1. T-12 Other Income line → decompose into estimated categories (source: "t12")
2. No T-12 → archive cohort P50 for Class B ($40–$80/unit/month total, confidence: "low")
3. Never emit a single aggregate without category attribution

Reconciliation gate: sum(categories) vs T-12 other_income aggregate; divergence > 10%
must be explained in `revenue.other_income.reconciliation_note`.

---

## F-005 — Cohort Anchoring (archive_percentile)

**Failure:** 56% of major assumptions on 464 Bishop had Tier4/UNANCHORED in quality audit.
`archive_percentile` was missing entirely for many fields.

**Root cause (primary — data gap):** `archive_assumption_benchmarks` table is empty.
Every `fetch_archive_assumption_distribution` call returns `found: false`. This cannot be
fixed by prompt changes alone. The data pipeline to seed the archive must be built.

**Root cause (secondary — prompt gap):** The existing MANDATORY language didn't specify
*which* fields must have `archive_percentile` populated, leaving room for partial compliance.
When all archive calls return found=false, there was no instruction on how to report this
in the run summary.

**Prompt change — `system.ts` archive section:**

Added `### F-005 — Minimum Field Set for fetch_archive_assumption_distribution (REQUIRED)`:

8 minimum fields (vacancy_pct, rent_growth_pct, exit_cap_rate, expense_growth_pct,
noi_margin, management_fee_pct, insurance, replacement_reserves) must be called on every run.

When found=false (empty archive): write `archive_percentile: null` + evidence data_point with
`notes: "insufficient_cohort (n=0)"`. When ALL 8 return found=false: add prescribed text to
the output `summary` field acknowledging the pending archive state. Tier2 attribution rule
clarified: archive tools returning found=false do not count as Tier 2 data points.

---

## Before / After Tier4 Rate on 464 Bishop

| State | Tier4/UNANCHORED rate | Source |
|---|---|---|
| Before this task (F-005 baseline) | ~56% of major assumptions | Agent run diagnostic |
| After prompt changes (archive still empty) | Expected: ~8% (fields with archive_percentile=null explicitly documented vs. silently missing) | archive_percentile: null + reason now mandatory |
| After archive seeding (future task) | Expected: < 25% | Will depend on cohort coverage |

The Tier4 rate cannot drop below the null-documented rate until the archive is seeded.
The prompt fix changes silent omission → explicit null + reason, which is a meaningful
quality improvement but not a full resolution.

---

## Cross-Cutting Observation

The four failures are NOT independent — they share a structural prompt depth issue:
the prompt had excellent protocols for the **happy path** (data present, value-add deal,
archive populated) but thin guidance for **degraded states** (absent unit mix, empty archive,
missing DealContext fields). When the agent encountered a degraded state, it silently took
the path of least resistance — broker OM numbers — rather than degrading gracefully with
explicit documentation.

The pattern: where the prompt said "call X tool and use result", it did not say what to do
when the tool returned empty. The agent interpreted "empty → skip" instead of "empty → document
the gap and produce a defensible fallback."

The fixes in this task each follow the same corrective principle:
"When primary data is absent, produce a documented sparse output rather than a silent void."
This makes degraded states visible to operators and surfaceable in the quality audit rather
than silently contaminating the confidence and tier distributions.

---

## Files Changed

| File | Change |
|---|---|
| `backend/src/agents/prompts/cashflow/system.ts` | F-001 sparse unit mix protocol; F-003 Other Income per-category; F-005 explicit field list + null enforcement; Phase 3 orchestration existing-deal comp call |
| `backend/src/agents/prompts/cashflow/variants/existing.ts` | F-002 GPR floor-plan grid protocol for stabilized deals |

## Data Gaps Filed as Follow-Ups

- **Archive seeding**: `archive_assumption_benchmarks` is empty — F-005 cannot fully resolve
  until seeded (matches existing task "Seed archive benchmarks from existing deals")
- **DealContext hydration**: `otherIncomeMonthly` absent for 464 Bishop — filed as follow-up
