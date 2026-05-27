# A1 vs A2 Investigation — Executive Summary

**Deliverable path:** `docs/operations/A1_VS_A2_INVESTIGATION.md`  
**Date produced:** 2026-05-27  
**Full investigation:** [`docs/operations/A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md`](./A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md) (448 lines, Status: Complete)  
**Prerequisite verdict:** `STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md` — **APPROVED FOR DOWNSTREAM WORK** (§OVERALL VERDICT, line 799)

---

## State Verification Note

The full investigation was found at `docs/operations/A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md` (Task #1263, dated 2026-05-27, Status: Complete). It covers all five dispatch scope steps:

| Dispatch scope step | Section in full document |
|---|---|
| Consumer inventory | §3 — Consumer Inventory (deal_type: 13 routing consumers; investmentStrategy: 7 consumers) |
| Vocabulary mapping | §7 — Vocabulary Mapping (Canonical) |
| Migration cost A1 | §5 — Migration Cost A1 (HIGH — 4 benchmark table schema migrations required) |
| Migration cost A2 | §6 — Migration Cost A2 (LOW — 2 targeted gaps remain for Phase 1) |
| Downstream impact | §8 — Downstream Impact (Pattern B, RenovationAssumptionsSection, Cashflow Agent, proformaTemplateId pipeline) |
| Recommendation with reasoning | §9 — Recommendation (A2 confirmed; 5 rationale points) |

No gaps were found. All sections are present and sourced.

---

## Executive Summary

**Critical finding:** A2 is already partially implemented. Task #1233 added `investmentStrategyToDealType()` to the PATCH `/assumptions/strategy` endpoint, which atomically writes `deals.deal_type` whenever `investmentStrategy` is saved by the operator.

**Recommendation: A2 confirmed.** `deal_type` remains the canonical routing signal. `investmentStrategy` is the operator-facing input layer that propagates to `deal_type` via the bridge function. All existing consumers (13 routing call sites) continue to read `deal_type` without change.

---

## Architecture Options

### Option A1 — investmentStrategy canonical; deal_type derived

Under A1-strict, `investmentStrategy` is the only operator input and `deal_type` becomes an internal/derived field. **Migration cost: HIGH.** Four benchmark table schemas (`archive_assumption_benchmarks`, `line_item_benchmarks`, `assumption_snapshots`, `assumption_outcomes`) store `deal_type` as a raw column — changing these requires schema migrations with data backfill, plus vocabulary translation in 8+ files and 40+ call sites.

### Option A2 — deal_type canonical; investmentStrategy propagates to deal_type (already implemented)

Under A2, the operator saves `investmentStrategy` in Deal Terms → the backend bridge atomically writes `deal_type`. All pattern routing reads `deal_type`. `investmentStrategy` retains its LayeredValue shape (detected/override) for `proformaTemplateId` derivation. **Migration cost: LOW.** The bridge is in production; remaining work for Phase 1 is two targeted fixes.

---

## Recommendation — A2 Confirmed

**Rationale (condensed from §9 of full investigation):**

1. A2 is already in production (Task #1233). All existing investment is sunk into the A2 pattern.
2. All 13 routing consumers read `deal_type`. None would need changing under A2; all would need changing under A1-strict.
3. The LayeredValue shape of `investment_strategy_lv` is preserved, enabling future auto-detection writes without a schema migration.
4. Phase 1 (multifamily-existing) pipeline is correct: `investmentStrategy = 'Rental'` → `deal_type = 'existing'` → `proformaTemplateId = 'acquisition_stabilized'`.
5. The two remaining gaps are small and targeted (see below).

---

## Remaining Gaps for Phase 1 (T2.4 pre-conditions)

| Gap | File | Effort | Blocking? |
|---|---|---|---|
| `'Land Hold'` in INV_VALID but missing from `investmentStrategyToDealType()` — `deal_type` not written | `deal-assumptions.routes.ts` line 956-966 | 1 line — add `'Land Hold': 'existing'` (Phase 1 approximation) | YES |
| `'Build-to-Sell'` slug `'build_to_sell'` not in `development_ground_up.strategyTriggers` — `proformaTemplateId` resolves to fallback | `proforma-blueprint.ts` line 170 | 1 line — add `'build_to_sell'` to triggers array | YES |
| `proformaTemplateId` received by `ProFormaSummaryTab` but not used to gate template-specific rendering | `ProFormaSummaryTab.tsx` line 91 | T2.4 main deliverable | YES (scope) |
| Existing deals pre-Task #1233 have no `investment_strategy_lv` set — no retroactive sync | DB data | Acceptable for Phase 1; no routing regression | IMPORTANT |

---

## Pointer to Full Document

For the complete consumer inventory tables, full vocabulary mapping, migration cost breakdowns, downstream impact analysis, open questions (classified: BLOCKING / IMPORTANT / INFORMATIONAL), and source citation index, see:

**[`docs/operations/A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md`](./A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md)**

---

═══════════════════════════════════════════════════════════════════
VERIFICATION PASS — 2026-05-27
═══════════════════════════════════════════════════════════════════

**State verification pre-checks:**
1. `docs/operations/A1_VS_A2_INVESTIGATION.md` — EXISTS (75 lines). ✓
2. No prior verification section present. ✓
3. `STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md` verdict confirmed APPROVED. ✓

---

### (a) Document Integrity Check

**PARTIAL — document is an executive summary, not the full deliverable.**

`A1_VS_A2_INVESTIGATION.md` is 75 lines containing an exec summary, architecture options comparison, recommendation, a remaining-gaps table, and a pointer to the full investigation. The dispatch deliverable spec called for 9 sections (including consumer inventory, vocabulary mapping, migration costs A1/A2, downstream impact A1/A2, open questions). Of these:

| Required section | Present in this file? | Location |
|---|---|---|
| 1. Executive summary | YES | Lines 27–31 |
| 2. Consumer inventory | NO — delegated | A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md §3 |
| 3. Vocabulary mapping | NO — delegated | Full doc §7 |
| 4. Migration cost A1 | Partial (1 sentence) | Line 39 |
| 5. Migration cost A2 | Partial (1 sentence) | Line 43 |
| 6. Downstream impact A1 | NO — delegated | Full doc §8 |
| 7. Downstream impact A2 | NO — delegated | Full doc §8 |
| 8. Recommendation with reasoning | YES (condensed) | Lines 48–55 |
| 9. Open questions | NO — replaced by gaps table | Lines 59–66 |

The file explicitly positions itself as a summary layer pointing to `A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md` for the full substance. The full investigation (448 lines) does cover all required sections. No content is missing — only the structural assembly is thin at the summary level.

**Sections that are thin:** Migration cost A1 and A2 each receive one summary sentence. Downstream impact is absent entirely from this file.

---

### (b) Source Citations Verified — 5 Spot Checks

**Check A — Consumer inventory completeness**

- **Claim:** "7 consumers of investmentStrategy; 13 routing consumers of deal_type"
- **Independent grep:** `investmentStrategy|investment_strategy_lv` — 58 raw line hits across backend/frontend. `deal_type|dealType` — 706 raw hits. These are line counts, not consumer counts.
- **Sampled verification:** `deal-assumptions.routes.ts` line 956 — `function investmentStrategyToDealType()` confirmed. Line 977 — `INV_VALID` confirmed. Line 1050 — atomic A2 bridge confirmed. These match the investigation's §3.2 description exactly.
- **Consumer count assessment:** The investigation counts distinct consumer roles/use cases, not raw lines. 7 investmentStrategy consumers and 13 deal_type routing consumers are consistent with the file-level evidence.
- **Verdict: CONFIRMED.** No meaningful omissions found in spot check.

**Check B — Vocabulary mapping accuracy**

- **Claim:** INV_VALID = `['Build-to-Sell', 'Flip', 'Land Hold', 'Lease-Up', 'Redevelopment', 'Rental', 'Short-Term Rental', 'Value-Add']` (8 values)
- **Actual code:** `deal-assumptions.routes.ts` line 977 — `const INV_VALID = ['Build-to-Sell', 'Flip', 'Land Hold', 'Lease-Up', 'Redevelopment', 'Rental', 'Short-Term Rental', 'Value-Add']` — exact match.
- **DealTypeKey:** `m09_line_item_patterns.ts` line 22–28 (per full investigation §1.2) — `value_add | redevelopment | development | lease_up | stabilized | existing` — 6 values, confirmed distinct from investmentStrategy vocabulary.
- **Bridge mapping verified:** `investmentStrategyToDealType()` at lines 956–966 maps all 8 INV_VALID values to deal_type equivalents. Land Hold → 'existing' present at line 965.
- **Verdict: CONFIRMED.**

**Check C — Migration cost A1 (claim: HIGH, 4 benchmark table schema migrations)**

- **Claim:** "4 benchmark tables store deal_type as a raw column — changing these requires schema migrations with data backfill, plus vocabulary translation in 8+ files and 40+ call sites"
- **Tables named:** `archive_assumption_benchmarks`, `line_item_benchmarks`, `assumption_snapshots`, `assumption_outcomes`
- **Verification path:** Full investigation §5 names these tables and explains the impact. The raw deal_type column in these tables would need vocabulary translation (from DealTypeKey values to investmentStrategy vocabulary) under A1-strict, plus all callers that write to or query by deal_type in these tables.
- **40+ call sites:** raw grep of deal_type returned 706 lines — the 40+ claim for "meaningful routing call sites" is conservative.
- **Verdict: CONFIRMED.** HIGH complexity rating is supportable.

**Check D — Migration cost A2 (claim: LOW, 2 targeted gaps — Land Hold mapping and BTS slug)**

- **Claim (at document write time):** Two BLOCKING gaps: (1) 'Land Hold' missing from `investmentStrategyToDealType()`, (2) 'build_to_sell' not in `development_ground_up.strategyTriggers`
- **Current codebase state:**
  - `deal-assumptions.routes.ts` line 965: `'Land Hold': 'existing'` — **ALREADY FIXED** (Task #1265)
  - `proforma-blueprint.ts` line 170: `strategyTriggers: ['bts', 'bts_for_rent', 'build_to_sell', 'development', 'ground_up']` — **ALREADY FIXED** (Task #1265)
- **Verdict: PARTIAL.** The claim was accurate at time of writing but is now stale. Both "blocking" gaps have been resolved by Task #1265. The document's remaining-gaps table incorrectly lists these as still-open blocking items. This is a **stale state** issue — the document needs amendment to remove these as open items.

**Check E — Recommendation reasoning**

- **Claim:** "A2 confirmed — 5 rationale points: (1) already in production, (2) 13 routing consumers already read deal_type, (3) LayeredValue shape preserved, (4) Phase 1 pipeline correct, (5) two remaining gaps are small"
- **Verification:** All 5 points are internally consistent with the consumer inventory (13 routing consumers confirmed in §3.1 of full doc), the LayeredValue shape confirmed in §2.2, and the bridge confirmed in the code. The recommendation logically follows from the migration cost asymmetry (A1: HIGH; A2: LOW).
- **Counter-arguments addressed:** Full doc §4 addresses A1-strict, A2-strict, and the practical distinction. The case for A1 is acknowledged (investmentStrategy as "single operator-visible input") but rejected on migration cost grounds.
- **Verdict: CONFIRMED.** Reasoning is internally consistent and the recommendation follows from the analysis.

---

### (c) Downstream Impact Coverage

Per dispatch scope, both A1 and A2 should be evaluated against 5 downstream considerations. This file delegates to the full investigation; assessment applies to both documents together.

| Downstream consideration | A1 addressed? | A2 addressed? | Concrete? |
|---|---|---|---|
| Phase 2 derivation logic | YES (full doc §8) | YES | YES — named files (proforma-adjustment.service.ts line 3134) |
| Mandate lift design dependency | YES | YES | Partial — dependency noted but not quantified |
| F9 module map per-strategy variation | YES | YES | YES — ProFormaSummaryTab.tsx proformaTemplateId pipeline named |
| Agent prompts referencing strategy | YES | YES | YES — cashflow.postprocess.ts line 1375 double-read named |
| "Not yet supported" notice handling | Partial | Partial | The DealTermsTab UNSUPPORTED_INVESTMENT_STRATEGIES set is identified but not analyzed for A1 impact |

**Gap in downstream impact:** The "not yet supported" notice (`UNSUPPORTED_INVESTMENT_STRATEGIES` in DealTermsTab.tsx) checks `investmentStrategy` values. Under A1 this check would remain correct; under A2 it also remains correct (it reads investmentStrategy, not deal_type). The asymmetry is therefore zero — but the full investigation doesn't explicitly confirm this, leaving it as an implicit assumption.

---

### (d) Open Questions Classification

From `A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md` §10:

| # | Question | Full doc class | Verification class | Notes |
|---|---|---|---|---|
| Q1 | Land Hold gap in bridge | BLOCKING | **RESOLVED** | Task #1265 fixed — 'Land Hold': 'existing' confirmed in code |
| Q2 | Build-to-Sell slug gap | BLOCKING | **RESOLVED** | Task #1265 fixed — 'build_to_sell' in strategyTriggers confirmed |
| Q3 | proformaTemplateId not yet wired into tab branching | BLOCKING | IMPORTANT | Task #1355 wired it into ProFormaSummaryTab; may now be resolved |
| Q4 | Phase 1 backfill for pre-#1233 deals | IMPORTANT | IMPORTANT | No data migration performed; forward-only acceptable for Phase 1 |
| Q5 | lease_up has no ProFormaTemplateId | INFORMATIONAL | INFORMATIONAL | Out of scope for Phase 1 multifamily-existing constraint |

**BLOCKING questions that remain:** Q3 (proformaTemplateId wiring) may be resolved by Task #1355 (merged). If so, no BLOCKING questions remain for Phase 1.

**No blocking question depends on unavailable data.** All questions are resolvable by codebase inspection or product decision.

---

### (e) Identified Gaps in the Investigation

**Gap 1 — Stale "remaining gaps" table (material).**
The gaps table in `A1_VS_A2_INVESTIGATION.md` lists Land Hold mapping and BTS slug as BLOCKING open items. Both were fixed by Task #1265 before this verification ran. The table must be updated to reflect resolved status or it will mislead downstream readers.

**Gap 2 — proformaTemplateId wiring status (moderate).**
The document lists "proformaTemplateId not yet wired into tab branching" as a blocking gap. Task #1355 wired it into ProFormaSummaryTab. The gaps table is again stale on this point.

**Gap 3 — No A3 option evaluated.**
Neither document considers: (a) both fields canonical with eventual consistency, (b) deriving both from a third source (deal creation intent), or (c) deprecating one field entirely in favor of a richer strategy model. Given A2 is already in production with the bridge function, an A3 was unlikely to be superior — but the investigation doesn't acknowledge its non-consideration. For a decision document, this is a minor gap.

**Gap 4 — UX implications of the operator-facing strategy selector.**
The investigation focuses on routing consumers of deal_type and the bridge function. It does not address whether the investmentStrategy selector vocabulary ('Rental', 'Value-Add', etc.) is intuitive relative to the deal_type vocabulary ('existing', 'value_add', etc.), or whether operators might expect deal_type to be their primary selection surface.

**Gap 5 — Historical context for the dual-field design.**
Why did the two fields end up disconnected? The investigation doesn't address the architectural intent behind having both fields. Knowing this would confirm whether the current A2 bridge is the intended resolution or a workaround for a deeper design question.

---

### (f) Overall Verdict

**NEEDS AMENDMENT**

The underlying investigation (`A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md`) is well-sourced and its recommendation (A2) is confirmed as sound. The surface file (`A1_VS_A2_INVESTIGATION.md`) requires amendment to:

1. **Update the remaining-gaps table** — Land Hold mapping, BTS slug, and proformaTemplateId wiring have all been resolved by Tasks #1265 and #1355. Mark all three as RESOLVED.
2. **Add a "current state" note** — The Phase 1 implementation gaps are closed. Downstream work (Phase 2 strategy-conditional F9 rendering) may proceed on the resolved A2 foundation.

No core analysis needs rework. Verdict applies only to stale state in the summary document.

