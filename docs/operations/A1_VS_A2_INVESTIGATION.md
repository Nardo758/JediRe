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
