# Phase 2 Batch 1 — OpEx Implementation Closing Note

**Date:** 2026-05-27  
**Source dispatch:** PHASE_2_BATCH_1_OPEX_SIMPLE.md (10 assumptions, 3 patterns)  
**Session:** Phase 2 Tax + OpEx combined session

---

## What Was Implemented

A comprehensive `## OpEx Derivation Protocol — Batch 1 (Phase 2)` section was added to `backend/src/agents/prompts/cashflow/system.ts`, inserted before `## Tax Math`. This section provides the cashflow agent with explicit per-assumption derivation rules for all 10 Batch 1 OpEx items.

### Coverage by Pattern

| Pattern | Items | Protocol Elements |
|---|---|---|
| **Pattern A** — CTRLL Standard | R&M (CTRLL-001), Turnover (CTRLL-007), Marketing (CTRLL-005), G&A (CTRLL-006), Contract Services (CTRLL-002) | Source priority (override → T12 → OM → benchmark), T12 quality gate (±15% variance), confidence mapping, Mandate v1.3 sub-field rules (pre/post), sigma check protocol, per-item watch-outs |
| **Pattern B** — NCTRL Utilities | Water/Sewer (NCTRL-001), Electric (NCTRL-002), Gas/Fuel (NCTRL-003), Trash-as-utility | T12 infrastructure constraint (combined only until Task #672), NMHC split ratios (national + Atlanta), mandatory disclosure language, RUBS check, double-count guard (BUG-UTIL-01), confidence = MEDIUM for all split-ratio derived values |
| **Pattern C** — Capital Reserves | Replacement Reserves (CAPEX-001) | References existing three-tier rule in §Replacement Reserves (line 459), adds validation rules (floors, OM cross-check, lender requirement interaction) |

---

## Assumption Details

### R&M (CTRLL-001)
- Primary source: T12 actuals. Watch for one-time capital items misclassified as R&M.
- Mandate v1.3: ACTIVE. Pre/post sub-fields when value-add. Directional rule: post ≤ pre.
- Vintage factor: pre-1980 assets run 1.5–2× R&M of post-2000 assets.

### Turnover (CTRLL-007)
- T12 lumpy — use rolling 12-month sum when 3-month trailing max/min > 2×.
- Mandate v1.3: ACTIVE. Directional rule: post ≤ pre (exception: income bracket repositioning may temporarily increase churn).

### Marketing (CTRLL-005)
- Near-zero marketing on high-occupancy assets is NOT an error.
- Mandate v1.3: ACTIVE. Directional rule: post ≤ pre.

### G&A (CTRLL-006)
- NO Mandate v1.3 sub-fields — single-value derivation only.
- One-time exclusion filter required (eviction legal fees, audit costs).

### Contract Services (CTRLL-002)
- Trash routing resolved (OQ-1): "Trash Removal" label → contractServices; "Valet Trash" → utilities combined.
- Mandate v1.3: CONDITIONAL ACTIVE — sub-field writeback only when qualifying amenities added (pool, elevator, parking structure). Interior-only renovation: no sub-fields.

### Water/Sewer (NCTRL-001) + Electric (NCTRL-002) + Gas/Fuel (NCTRL-003)
- T12 sub-lines null until Task #672. NMHC split ratios applied to combined `utilities`.
- Electric: all-bills-paid alert surfaced when ABPP detected.
- Gas: seasonality flag when T12 is partial-year.
- Mandatory disclosure on every split-ratio derived value.

### Replacement Reserves (CAPEX-001)
- Three-tier age rule already in system.ts at line 459 — confirmed aligned per OQ-2.
- New validation rules added: floor warning, OM cross-check, lender covenant cross-check.

---

## Files Modified

| File | Change |
|---|---|
| `backend/src/agents/prompts/cashflow/system.ts` | New section `## OpEx Derivation Protocol — Batch 1 (Phase 2)` inserted before `## Tax Math`. Covers Pattern A (5 items), Pattern B (4 utility items), Pattern C reference + expanded validation. |

---

## Unchanged (Per Dispatch Rules)

- LIUS yaml files (`backend/src/services/lius/lines/opex/*.yaml`) — documentation/metadata only; not executable logic; not touched
- `f9-financial-export.service.ts:172` hardcode — separate cleanup dispatch; not touched
- `taxService.ts` — Tax module math unchanged
- Mandate v1.3 logic — not touched

---

## Open Items Carried Forward

| Item | Status | Next Action |
|---|---|---|
| Task #672 — T12 sub-line parsing | **DEFERRED** | Sub-line `water_sewer`, `electric`, `gas_fuel` not parseable until Task #672 ships. NMHC interim split ratios documented in Pattern B. |
| BUG-01 — `line_item_benchmarks` platform slots null | **ACKNOWLEDGED** | Sigma checks reference benchmarks; OQ-5 flag documents "limited sample" warning. No derivation changes until table is populated. |
| BUG-UTIL-01 — utilities double-count guard | **DOCUMENTED IN PROMPT** | Double-count guard logic described in Pattern B. Enforcement at `proforma-adjustment.service.ts` is a Batch 2 cleanup item. |
| `f9-financial-export.service.ts:172` hardcode | **DEFERRED** | Export-path fallback ($350/unit) not aligned with three-tier canonical. Separate cleanup dispatch. |

---

## Verification

- system.ts OpEx section reads cleanly before §Tax Math — insertion point confirmed at line 691
- Pattern A source priority table matches PHASE_2_BATCH_1_OPEX_SIMPLE.md §2 verbatim
- Pattern B NMHC ratios match: national (42/32/18/8%), Atlanta (45/40/10/5%)
- Pattern C references the existing `### Replacement Reserves` three-tier rule; no duplication
- Mandate v1.3 sub-field eligibility correctly documented: R&M ✓, Marketing ✓, Turnover ✓, Contract Services (CONDITIONAL) ✓, G&A ✗
