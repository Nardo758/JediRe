# Phase 2 Entry Conditions

**Date created:** 2026-05-27 (recalibration dispatch)  
**Purpose:** Gate conditions that must be met before Phase 2 work begins. Phase 2 expands deal type coverage (development, STR, Flip, Lease-Up) and adds operator-facing validation UI.

---

## Entry Condition Summary

| EC | Condition | Status | Notes |
|---|---|---|---|
| EC1 | Strategy ↔ deal_type reconciled | **PARTIALLY SATISFIED** | A2-derived bridge live (Task #1233); STEP 4 backfill in flight |
| EC2 | Mandate lifted to v1.3 | **SATISFIED** | All 9 line items, postprocess, composer live; RegimeExpand Tier 1 fix shipped |
| EC3 | Market rent source resolved | **UNKNOWN** | Requires investigation |
| EC4 | F9 module map gaps addressed | **UNKNOWN** | Requires investigation |

---

## EC1 — Strategy ↔ deal_type Reconciled

**Required state:** When an operator saves an `investmentStrategy` value in Deal Terms, the resulting `deal_type` correctly routes Pattern B line items, RegimeExpand visibility, and agent prompt selection.

**Current state:**
- PATCH /assumptions/strategy atomically writes both `investment_strategy_lv` AND derives `deals.deal_type` via `investmentStrategyToDealType()` — LIVE (Task #1233)
- All 8 strategy values map to a `deal_type` — CONFIRMED  
- `proformaTemplateId` drives template-aware rendering in ProFormaSummaryTab — LIVE (Task #1355)
- Pre-Task #1233 deals (investmentStrategy null, deal_type set): backfill IN_FLIGHT  

**Satisfied when:** Backfill complete and counts reported (A1_MIGRATION_IMPLEMENTATION.md).

**Remaining work:** A1 migration STEP 4 backfill script execution and count report.

---

## EC2 — Mandate Lifted to v1.3

**Required state:** The cashflow agent can write pre_renovation / post_stabilization sub-field values for value-add line items. RegimeExpand renders them with correct provenance and confidence badges.

**Current state — FULLY SATISFIED:**
- `line-item-matrix.ts`: 9 `[VALUE-ADD/REDEVELOPMENT] May also write` protocol instances confirmed
- `cashflow.postprocess.ts`: Sub-field writeback (lines 555–654), confidence gate (line 596), Tier 2 directional validation (lines 656–753)
- `proforma-adjustment.service.ts`: `regimeDataByField` composition (lines 4824–4901)
- `RegimeExpand.tsx`: normalizeSource, sourceColor, sourceLabel (Tier 1 fix, 2026-05-27)
- `MANDATE_CONSUMER_WIRING.md §5.3`: Gap 2 (confidence propagation) resolved as Option 3 (Independent)

**Tier 2 directional validation (shipped 2026-05-27):** 4 warning-level checks now fire in postprocess after sub-field writeback. Output accumulates to `output.validation_warnings`.

---

## EC3 — Market Rent Source Resolved

**Required state:** The agent's market rent assumption (GPR / effective rent comps) has a well-defined evidence tier hierarchy for value-add deals. The pre-renovation market rent and post-stabilization market rent (renovation ceiling) are sourced from distinct comp sets with documented provenance.

**Current state — UNKNOWN.** This condition requires a targeted investigation of:
- The dual-comp-set enforcement (baseline + renovation_ceiling) in the cashflow agent
- `value_add_gpr_validation` completeness checks in the postprocess
- Whether the renovation ceiling comp set is reliably populated for value-add deals

**Investigation pointer:** See `PHASE_8_CASHFLOW_AGENT_READINESS.md` and `STRUCTURED_SURVEY.md` for prior context on market rent sourcing gaps.

**Satisfied when:** A dedicated investigation confirms the dual-comp-set enforcement is working and GPR evidence tier hierarchy is correctly implemented for value-add deals.

---

## EC4 — F9 Module Map Gaps Addressed

**Required state:** The F9 financial engine's module map (ProFormaSummaryTab tab routing, RegimeExpand visibility by deal type) correctly handles all Phase 1 deal types without blank or incorrect rendering.

**Current state — UNKNOWN.** See `F9_MODULE_MAP.md` for the prior gap analysis. Specifically:
- Flip template rendering (ctrlRows/nctrlRows filtered via FLIP_CARRY_CTRL — Task #1236)
- Land Hold template rendering (LAND_HOLD_CTRL — Task #1236)
- STR template (no Pattern B rows — correct behavior, but verify no rendering gaps)
- Development template (has Pattern B rows for vacancy, concessions, marketing, turnover)

**Investigation pointer:** Run the agent on a representative deal for each Phase 1 deal type and verify RegimeExpand expand rows, tab visibility, and template-aware row filtering all render without gaps.

**Satisfied when:** A verification pass across all Phase 1 deal types confirms no F9 rendering gaps for the supported templates.

---

## Phase 2 Gate Decision

Phase 2 may begin when:
1. EC1 SATISFIED (backfill complete) — expected: current session
2. EC2 SATISFIED — CONFIRMED
3. EC3 status KNOWN — requires investigation (not blocking if the risk is accepted)
4. EC4 status KNOWN — requires verification pass (not blocking if regressions are monitored)

**Conservative gate:** EC1 + EC2 satisfied before Phase 2 begins. EC3/EC4 can be investigated in Phase 2 Track 0 as pre-conditions for Phase 2 Track 1.
