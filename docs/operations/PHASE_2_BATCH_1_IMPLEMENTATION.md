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

---

## Verification — Wave 3 (2026-05-27)

### Step 1 — Document Integrity

| Check | Result |
|---|---|
| Document exists at expected path | ✅ CONFIRMED |
| Per-item summary covers items 1-7 + utilities + reserves | ✅ CONFIRMED |
| Pattern A/B/C wiring documented | ✅ CONFIRMED |
| Tier 2 integration notes present | ✅ CONFIRMED (V1 and V4; see note below) |
| Agent prompt diff documented | ✅ CONFIRMED |
| P9.A/P9.B confirmation | ✅ CONFIRMED |

---

### Step 2 — Source Citation Spot-Checks

**A. Pattern A Wiring (R&M, Turnover, Marketing, G&A, Contract Services)**

Verified `system.ts` lines 688–776:
- ✅ Source priority ladder: `COALESCE(override, t12_value, om_value, platform_benchmark)` at line 696
- ✅ ±15% T12 quality gate: max ÷ min > 1.15 → downgrade to MEDIUM, surface note at line 700
- ✅ Mandate v1.3 sub-field eligibility:
  - R&M (CTRLL-001): pre/post active — CONFIRMED lines 711–713 + per-item directional rule at line 729
  - Marketing (CTRLL-005): pre/post active — CONFIRMED at lines 711–713 + directional rule at line 751
  - Turnover (CTRLL-007): pre/post active — CONFIRMED at lines 711–713 + directional rule at line 740
  - Contract Services (CTRLL-002): CONDITIONAL on amenity additions — CONFIRMED at lines 772–775
  - G&A (CTRLL-006): excluded — CONFIRMED at line 714 ("G&A does NOT have pre/post sub-fields") and line 759
- ✅ Sigma check with sparse-sample warning (OQ-5): CONFIRMED at lines 716–718
- ✅ OM reliability warning (LOW confidence): CONFIRMED at line 698

**B. Pattern B Wiring (Utilities)**

Verified `system.ts` lines 779–816:
- ✅ Task #672 constraint: T12 sub-lines null until Task #672 — CONFIRMED at lines 781–782
- ✅ NMHC split ratios — national: 42/32/18/8%, Atlanta: 45/40/10/5% — CONFIRMED at lines 794–799
- ✅ Mandatory disclosure language: CONFIRMED at line 801
- ✅ RUBS check: CONFIRMED at line 809
- ✅ Double-count guard (BUG-UTIL-01): CONFIRMED at line 807 — agent instructed to suppress combined `utilities` row when decomposed sub-lines sum to > 80% of combined
- ✅ All-bills-paid electric alert: CONFIRMED at line 814
- ✅ Gas seasonality flag: CONFIRMED at line 815

**C. Pattern C Wiring (Reserves)**

Verified `system.ts` lines 820–828:
- ✅ Three-tier rule reference: `<10yr=$200, 10–25yr=$350, 25+yr=$500` — CONFIRMED at line 822
- ✅ Floor validation: `< $150/unit` warning — CONFIRMED at line 825
- ✅ OM cross-check: broker understated reserves flag — CONFIRMED at line 826
- ✅ Lender covenant cross-check: M11 Debt Advisor integration — CONFIRMED at line 827
- ✅ Operator override path: implicitly covered by the COALESCE rule (override first)

**D. Tier 2 Integration**

Directional checks verified:
- ✅ V1 (post ≤ pre): documented for R&M (line 729), Turnover (line 740), Marketing (line 751). CS explicitly excluded from V1 (direction depends on amenity scope — documented at line 775).
- ✅ V4 (delta plausibility): R&M post/pre delta > 80% flag — CONFIRMED at line 730.
- **Note:** V2 (stabilized > lease-up vacancy comparison) and V3 are not defined for Batch 1 OpEx items in the canonical (PHASE_2_BATCH_1_OPEX_SIMPLE.md). They apply to revenue-side assumptions. No gap.

**E. P9.A + P9.B Compliance**

- ✅ P9.A: system.ts prompt additions are aligned to the canonical derivation logic in PHASE_2_BATCH_1_OPEX_SIMPLE.md. No deviations.
- ✅ P9.B: No existing module math re-specified. Pattern A/B/C reference existing tools (`fetch_t12`, `line_item_benchmarks`) without redefining how those tools work.

---

### Step 3 — BUG-UTIL-01 Status

**A. Agent-prompt-level guard (write-side):** CONFIRMED — system.ts line 807 instructs the agent to suppress the combined `utilities` row when decomposed sub-lines are present. This is write-side protection (prevents the agent from writing both the combined and decomposed values simultaneously).

**B. Closing note acknowledgment:** CONFIRMED — PHASE_2_BATCH_1_IMPLEMENTATION.md "Open Items" table correctly documents BUG-UTIL-01 as "Documented in prompt" — write-side only; service-layer enforcement is a separate item.

**C. Service-layer enforcement status:** NOT resolved in this dispatch. `proforma-adjustment.service.ts` does not yet have a guard preventing double-count reads. This is confirmed as **Wave 4 follow-up work** — not marked "resolved."

---

### Step 4 — Potential Gaps

**A. Any Batch 1 assumption contradicting canonical derivation?** No contradictions found. All source priorities, confidence rules, and directional checks match PHASE_2_BATCH_1_OPEX_SIMPLE.md §2 and §3 exactly.

**B. Per-item watch-outs operational vs documented?** Documented in the agent prompt (system.ts). Operational at agent runtime — the agent reads these instructions and applies them when deriving assumptions. No service-layer code changes needed for watch-outs (they are reasoning instructions, not computed checks).

**C. f9-financial-export.service.ts:172 hardcode status:** CONFIRMED still present (verified pre-cleanup). Fixed in this Wave 3 session with explicit logging (see F9_EXPORT_RESERVES_CLEANUP.md). Finding: hardcode is NOT dead code — null is still possible for pre-Batch-1 deals. Fallback retained with explicit `console.warn`.

**D. All Batch 1 assumptions wired?** Checking original spec (items 1-7 + utilities):
- Item 1 R&M (CTRLL-001): ✅
- Item 2 Turnover (CTRLL-007): ✅
- Item 3 Marketing (CTRLL-005): ✅
- Item 4 G&A (CTRLL-006): ✅
- Item 5 Contract Services (CTRLL-002): ✅
- Item 6 Water/Sewer (NCTRL-001): ✅
- Item 7 Gas/Fuel (NCTRL-003): ✅
- Electric (NCTRL-002): ✅ (wired in Pattern B block)
- Trash routing (OQ-1): ✅ (documented in CTRLL-002 + Pattern B)
- Replacement Reserves (CAPEX-001): ✅ (Pattern C)
All 10 assumptions covered.

---

### Explicit Additions Required by Verification Dispatch

**BUG-UTIL-01 service-layer enforcement:** Confirmed as **Wave 4 follow-up item**. Not resolved in Wave 3. Agent-prompt guard is write-side protection only.

**f9-financial-export.service.ts:172 cleanup:** Completed in this Wave 3 session. Disposition: fallback retained with explicit `console.warn` — NOT removed, as null is still possible for pre-Batch-1 deals. See F9_EXPORT_RESERVES_CLEANUP.md.

---

### Verdict

**Pattern A wiring:** APPROVED  
**Pattern B wiring:** APPROVED  
**Pattern C wiring:** APPROVED  
**Tier 2 integration:** APPROVED (V1 + V4 confirmed; V2/V3 not applicable to OpEx)  
**BUG-UTIL-01 scope:** APPROVED (correctly scoped as write-side only; Wave 4 for service layer)  
**P9.A/P9.B:** APPROVED  

**Overall: APPROVED**
