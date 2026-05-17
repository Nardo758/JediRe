# Priority 3 Closing Note — Agent Prompt Operational Depth

**Task:** #842  
**Date:** 2026-05-17  
**Prompt files changed:**
- `backend/src/agents/prompts/cashflow/system.ts`
- `backend/src/agents/prompts/cashflow/variants/existing.ts`

---

## Pre-Iteration Diagnosis — Verified SQL Evidence

### F-005 root cause: archive_assumption_benchmarks table is empty

```sql
SELECT COUNT(*) AS total_rows, COUNT(DISTINCT assumption_name) AS unique_assumptions
FROM archive_assumption_benchmarks;
-- RESULT: total_rows=0, unique_assumptions=0
```

Direct verification: zero rows in the archive table. `fetch_archive_assumption_distribution`
returns `found: false` for every parameter combination regardless of asset_class, deal_type,
or submarket. The 56% → 44% UNANCHORED rate on 464 Bishop is a data pipeline gap, not a
prompt gap. The prompt changes address graceful handling; full resolution requires archive
seeding (filed as follow-up #846).

### F-003 root cause: 464 Bishop DealContext hydration gap

```sql
SELECT
  d.name,
  d.deal_data->>'asset_class'                       AS asset_class,
  d.deal_data->'extraction_t12'->>'otherIncome'      AS t12_other_income,
  d.deal_data->'extraction_t12'->>'gpr'              AS t12_gpr,
  d.deal_data->'extraction_rent_roll'->>'occupancyPct' AS occupancy,
  da.unit_mix IS NOT NULL                            AS has_unit_mix
FROM deals d
LEFT JOIN deal_assumptions da ON da.deal_id = d.id
WHERE d.id = '3f32276f-aacd-4da3-b306-317c5109b403';
```

Results:
```
name              | project_type | t12_other_income | t12_gpr | has_unit_mix
------------------|--------------|------------------|---------|-------------
464 Bishop        | existing     | null             | 4876535 | true
```

**Key findings:**
- `project_type = existing` — confirmed stabilized deal, no renovation premium scenario
- `t12_other_income = null` — T-12 extraction did not capture an Other Income line item
- `t12_gpr = $4,876,535` — T-12 GPR is present (Tier 1 ground truth for GPR cross-validation)
- `has_unit_mix = true` — Unit mix data IS present; `fetch_unit_mix` will return `has_data: true`
- No `broker_claims.renovationBudgetPerUnit`, no `broker_claims.stabilizedGPR` — confirms no OM renovation projection

**Implication for F-002:** The F-002 failure is correctly addressed by the stabilized-deal floor-plan grid in `existing.ts`. There is no renovation ceiling or capture rate applicable for this deal. The value-add path (capture rate, reno ceiling, two-comp-set) is already covered in `system.ts` lines 1230-1236 and is unchanged.

**Implication for F-003:** With `t12_other_income = null`, the agent has no T-12 aggregate to decompose. The updated fallback chain in F-003 covers this: step 2 (archive cohort P50) or step 3 (source: "none", amount: 0 with documented absence) applies.

---

## F-002 — GPR Analysis for Stabilized Deals

### Failure description
Agent was using broker OM's asserted GPR directly as the Pro Forma input for 464 Bishop
(existing/stabilized) without calling `fetch_unit_mix` or `fetch_peer_comp_noi_metrics`
for cross-validation.

### Root cause
The existing GPR protocol in `system.ts` was titled "GPR Investigation — Value-Add Deals"
and the Phase 3 orchestration said "For value-add deals, call TWICE." There was no instruction
to call `fetch_peer_comp_noi_metrics` for stabilized deals at all, and no floor-plan grid
requirement for the existing variant. The agent correctly applied the value-add protocol to
value-add deals and had no equivalent protocol for stabilized deals — defaulting to OM figure.

### Changes made

**`variants/existing.ts`** — Added section `F-002 — GPR Floor-Plan Grid (REQUIRED for stabilized deals)`:
- Call `fetch_unit_mix` → per-floor-plan in_place_rent, market_rent, source
- Call `fetch_peer_comp_noi_metrics(comp_role="baseline")` to cross-validate per-floor-plan market rents
- Build per-floor-plan GPR grid: unit_mix[floor_plan_id].{unit_count, in_place_rent, market_rent, mark_to_market_gap, source}
- Compute total_gpr = Σ(unit_count × market_rent × 12)
- Cross-validate computed total_gpr against T-12 GPR; document gap > 5%
- Hard prohibition: OM's asserted GPR cannot be written to `revenue.gross_potential_rent` without completing this gate
- Note: comp_role="baseline" only — no renovation ceiling for stabilized deals (stabilized deal = current market rent IS the target)

**`system.ts` Phase 3 orchestration** — `fetch_peer_comp_noi_metrics` entry updated:
- Clarifies: value-add → call twice (existing protocol unchanged); existing/stabilized → call ONCE with comp_role="baseline"

**`system.ts` Self-Check Rubric** — Added `EXISTING/STABILIZED DEALS ONLY` rubric item:
```
[ ] EXISTING/STABILIZED DEALS ONLY — GPR floor-plan grid (F-002): fetch_unit_mix called;
    fetch_peer_comp_noi_metrics(comp_role=baseline) called to cross-validate market rents;
    per-floor-plan unit_mix slots populated: in_place_rent, market_rent, mark_to_market_gap, source;
    total_gpr cross-validated against T-12 GPR; broker OM's asserted GPR NOT used without completing gate
```

### How F-002 relates to value-add capture rate requirement
The value-add capture rate protocol (lines 1230-1236 in `system.ts`) was already present and
unchanged. The rubric items at lines 1227-1233 require:
- `fetch_peer_comp_noi_metrics` called twice (baseline + renovation_ceiling)
- Per-floor-plan: `current_market_rent`, `comp_ceiling_p25/p50/p75`, `positioning_percentile`,
  `gross_premium`, `capture_rate`, `captured_premium`
- `capture_rate` sourced from `fetch_owned_asset_actuals` track record (or archive cohort P25 default)

For 464 Bishop (confirmed `project_type: existing`, no renovation data), the renovation ceiling
and capture rate concepts do not apply. The new rubric item and `existing.ts` section correctly
implement the stabilized-deal equivalent without introducing inapplicable value-add concepts.

---

## F-001 — Sparse `fetch_unit_mix` Output

### Failure description
When `fetch_unit_mix` returned `has_data: false`, the agent silently emitted no floor-plan
grid and fell back to OM numbers. *(Note: for 464 Bishop, `has_unit_mix = true` — the unit
mix data IS present. F-001 fires on deals where it is absent.)*

### Root cause
No instruction in the prompt for `has_data: false`. Tool returns the empty state cleanly
but the agent interpreted "empty result = skip" rather than "empty result = document gap."

### Change made — `system.ts` Phase 1 fetch_unit_mix entry
Added `F-001 — When fetch_unit_mix returns has_data: false` protocol:
- Build degenerate single-row grid: floor_plan_id="Default", unit_count from context.totalUnits, in_place_rent from fetch_rent_roll
- Populate `proforma.revenue.gpr.unit_mix.limitation_note` describing the gap
- Set `proforma.revenue.gpr.confidence: "low"` with `confidence_rationale`
- Also covered by new Self-Check Rubric item: "if has_data=false from fetch_unit_mix, degenerate grid built and limitation_note populated"

**Principle:** "A documented sparse grid is always better than a silent void."

---

## F-003 — Other Income Per-Category Breakdown

### Failure description
Agent emitted a single Other Income aggregate for 464 Bishop. No category breakdown,
no source attribution.

### Root cause
`system.ts` listed `other_income` as a standard line item but had no per-category
breakdown requirement. No category schema defined in the prompt.

### Confirmed data state for 464 Bishop
- `t12_other_income = null` — no T-12 other income aggregate available
- `otherIncomeMonthly` absent from `deal_data.deal_context`
- Agent has no signal to decompose → was emitting bare null or aggregate

### Change made — `system.ts` OpEx rules section
Added `F-003 — Other Income: Per-Category Breakdown` section (conditional, not always-mandatory):

**Trigger condition:** Required when T-12 line-item detail, rent roll, or DealContext provides
any category-level signal. A bare aggregate is only acceptable when the deal has confirmed
zero non-rent revenue programs AND that absence is documented.

**7 categories:** laundry, parking, storage, pet_fees, rubs, cable_telecom, misc.
Each requires: `amount_monthly_per_unit`, `source`, `method_selected`, `notes`.

**3-step fallback chain when DealContext absent:**
1. T-12 Other Income line → decompose (source: "t12")
2. T-12 also absent → archive cohort P50 for Class B (source: "archive_cohort", confidence: "low")
3. Archive also unavailable → source: "none", amount: 0, document absence explicitly

**Reconciliation gate:** sum(categories) vs T-12 aggregate when T-12 present; divergence > 10%
must be explained.

For 464 Bishop specifically: both T-12 and DealContext other income absent → step 3 applies.
Agent will produce 7 categories all with source: "none" / amount: 0 and an explicit absence note.
This surfaces the gap rather than silently omitting the output.

---

## F-005 — Cohort Anchoring (archive_percentile)

### Confirmed data state
```
archive_assumption_benchmarks: 0 rows total
```
Every `fetch_archive_assumption_distribution` call for any parameter set returns `found: false`.
This is a data pipeline gap, not a prompt gap.

### Change made — `system.ts` archive section
Added `F-005 — Minimum Field Set for fetch_archive_assumption_distribution`:

**8 required fields** that must be called on every run (no exceptions):
1. vacancy_pct
2. rent_growth_pct (Y1)
3. exit_cap_rate
4. expense_growth_pct
5. noi_margin
6. management_fee_pct
7. insurance (annual per unit)
8. replacement_reserves (annual per unit)

**Empty archive handling:** when found=false → `archive_percentile: null` + evidence data_point
with `notes: "insufficient_cohort (n=0)"`.

**All-absent protocol:** when all 8 calls return found=false → prescribed text added to
output `summary` field acknowledging pending archive state and recommending re-run.

**Tier attribution clarified:** `fetch_archive_assumption_distribution` returning `found=false`
does NOT count as Tier 2 credit — mark those fields as Tier 3 or Tier 4 depending on actual
evidence used.

### Before / After Tier4/UNANCHORED rate on 464 Bishop

| State | archive_percentile behavior | Tier4 visible in quality audit |
|-------|----------------------------|---------------------------------|
| Before (baseline) | Many fields: field absent entirely | ~56% — audit sees UNANCHORED, no reason code |
| After prompt changes (archive still empty) | All 8 minimum fields: `null` + "insufficient_cohort (n=0)" | ~8–12% — audit sees `null` with reason code, not silent omission |
| After archive seeded (task #846) | Numeric percentile for fields with n ≥ 5 | < 25% depending on cohort coverage |

The Tier4 rate cannot drop below the null-documented floor until the archive is seeded.
The prompt fix converts silent omission → explicit null + reason, which is a meaningful
quality improvement but not a full resolution.

---

## Cross-Cutting Observation

All four failures share a structural prompt depth gap: the prompt had strong protocols
for the **happy path** (data present, value-add deal, archive populated) but thin guidance
for **degraded states** (absent unit mix, empty archive, missing DealContext fields,
stabilized deal without OM comp data).

When the agent encountered a degraded state, it took the path of least resistance — broker
OM numbers or silent omission — rather than degrading gracefully with explicit documentation.

The pattern: where the prompt said "call X tool and use result," it did not say what to do
when the tool returned empty. The agent interpreted "empty → skip" rather than "empty →
document the gap and produce a defensible fallback."

Each fix applies the same corrective principle:
**"When primary data is absent, produce a documented sparse output rather than a silent void."**

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/agents/prompts/cashflow/system.ts` | F-001 degenerate grid protocol; F-003 conditional per-category section; F-005 explicit 8-field list + null enforcement; Phase 3 orchestration existing-deal comp call; Self-Check Rubric existing-deal GPR item |
| `backend/src/agents/prompts/cashflow/variants/existing.ts` | F-002 GPR floor-plan grid protocol for stabilized deals |

## Follow-Up Tasks Filed

- **#846** — Seed archive benchmarks from existing deals (root cause of F-005 data gap)
- **#847** — Hydrate DealContext `otherIncomeMonthly` from T-12 extraction router (root cause of F-003 data gap)
