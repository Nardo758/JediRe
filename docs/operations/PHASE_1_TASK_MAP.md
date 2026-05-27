# Phase 1 Task Map

**Created:** 2026-05-27 (recalibration dispatch)  
**Phase scope:** Multifamily-existing foundation — strategy reconciliation, mandate lift, consumer surface readiness  
**Status notation:** COMPLETE / IN_FLIGHT / BLOCKED / OPEN

---

## Critical Path Overview

```
T1.1 P8 amendment ──► T1.2 Strategy verification ──► T2.1 A1/A2 investigation
                                                             │
                                                             ▼
                                                      T2.3 A1/A2 decision
                                                             │
                       T3.1 Mandate lift design ◄────────────┘
                                │
                                ▼
                       T3.1.5 Mandate v1.3 live
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             T3.2 Consumer wiring    T2.4 A1 migration
             investigation           STEP 4 backfill
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
   Tier 1: RegimeExpand   T3.3 Tier 2
   sourceColor (SHIPPED)  self-validation
                          (IN_FLIGHT)
```

---

## Track 1 — P8 Methodology & Strategy Investigation

### T1.1 — CLAUDE.md P8 Amendment (State-Verification Corollary)
**Status: COMPLETE**  
**Closing ref:** Committed in session 2026-05-26  
Added state-verification pre-execution corollary to P8 rules in CLAUDE.md. All subsequent dispatches include state-verification sections before code execution.

### T1.2 — Verification of Strategy Investigation
**Status: COMPLETE**  
**Closing ref:** `STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md` verification pass APPROVED  
P8 verification pass confirmed the Strategy investigation findings. The finding that PATCH /assumptions/strategy wrote investment_strategy_lv only (not deal_type) was confirmed at the time of investigation (pre-Task #1233).

### T1.3 — STR/Flip/Land Hold "Not Yet Supported" Notice
**Status: COMPLETE**  
**Closing ref:** Committed 2026-05-26  
Added visible "not yet supported" UI notice in DealTermsTab for strategy values that lack full Pattern B routing support in Phase 1 (STR, Flip, Land Hold). Operators see a clear notice rather than silently degraded rendering.

---

## Track 2 — Strategy Canonical Reconciliation

### T2.1 — A1 vs A2 Investigation
**Status: COMPLETE**  
**Closing ref:** `A1_VS_A2_INVESTIGATION.md` (P8 verification APPROVED, amendment applied, lightweight check CLEAN)  
Full investigation of which strategy field should be canonical. Confirmed Task #1233 implements A2-derived bridge. Three previously BLOCKING items resolved by Tasks #1265 and #1355. Vocabulary mapping, consumer inventory, and migration cost analysis all documented.

### T2.2 — A1 vs A2 Decision
**Status: COMPLETE**  
**Closing ref:** `A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md` §10 — Q1, Q3, Q6 RESOLVED  
Decision: A1 committed (investmentStrategy is the canonical operator-facing field; deal_type is derived). Implemented via A2-derived bridge in Task #1233 (which is functionally A1 since investmentStrategy drives deal_type atomically).

### T2.3 — A1 Migration Implementation
**Status: IN_FLIGHT**  
**Closing ref:** `A1_MIGRATION_IMPLEMENTATION.md` (in progress, current session)  
State verification found Task #1233 already implemented STEPS 1-3. Remaining scope: STEP 4 (data backfill) — producing counts report and backfill script for pre-Task #1233 deals where investmentStrategy is null.

---

## Track 3 — Mandate Lift & Consumer Surfaces

### T3.1 — Mandate Lift Design
**Status: COMPLETE**  
**Closing ref:** `MANDATE_LIFT_DESIGN.md` (P8 verification APPROVED)  
Full design for v1.3 Sub-Field Write Protocol — pre_renovation/post_stabilization regime values for 9 eligible line items on value-add/redevelopment deals. Canonical source string table, confidence rules, partial pair handling, and validation requirements all documented.

### T3.1.5 — Mandate v1.3 Implementation
**Status: COMPLETE**  
**Closing ref:** `MANDATE_LIFT_DESIGN.md` §3 — 9 instances confirmed in `line-item-matrix.ts`  
v1.3 prompt protocol live in all 9 eligible line items. Postprocess sub-field writeback implemented in `cashflow.postprocess.ts` lines 555–634. Composer assembles `regimeDataByField` in `proforma-adjustment.service.ts` lines 4824–4901.

### T3.2 — Consumer Wiring Investigation
**Status: COMPLETE**  
**Closing ref:** `MANDATE_CONSUMER_WIRING.md` (P8 verification APPROVED)  
Investigated 3 consumer surfaces: RegimeExpand (Tier 1 bug found), F9 ProForma tabs (READY, no breaks), agent self-validation (partial — 4 checks missing). Gap 2 (confidence propagation) resolved as Option 3 (Independent). Tier 1/2/3 sequencing defined.

### T3.2a — Tier 1: RegimeExpand sourceColor Fix
**Status: COMPLETE (SHIPPED)**  
**Closing ref:** `REGIMEEXPAND_SOURCECOLOR_FIX.md`  
Added `normalizeSource()` + `sourceLabel()` helpers in `RegimeExpand.tsx`. `'tier1:t12'` now renders green T12 badge; `'agent:cashflow'` renders violet AGENT badge. Build clean. No regressions on non-tiered sources.

### T3.2b — Gap 2 Confidence Propagation Ruling
**Status: COMPLETE (no code)**  
**Closing ref:** `MANDATE_CONSUMER_WIRING.md §5.3` — Option 3 (Independent) confirmed  
Sub-field confidence does not modify the parent LayeredValue confidence. The postprocess already implements this correctly (sub-fields stored at separate JSONB keys). Ruling documented; code comment (MANDATE_CONSUMER_WIRING.md §6.2 Dispatch B) deferred to Tier 2.

### T3.3 — Tier 2: Agent Self-Validation Directional Checks
**Status: IN_FLIGHT**  
**Closing ref:** `AGENT_SELFVALIDATION_TIER2.md` (in progress, current session)  
Adding 4 warning-level directional checks to `cashflow.postprocess.ts`: directional consistency, primary value consistency, confidence inversion, delta plausibility. All warning-only — no rejection logic changes.

---

## Track 4 — Phase 2 Pre-Conditions

### T4.1 — Phase 2 Entry Condition Check
**Status: IN_FLIGHT**  
**Closing ref:** `PHASE_2_ENTRY_CONDITIONS.md` (current document created in this session)  
EC2 (Mandate lifted) SATISFIED. EC1 (strategy reconciliation) PARTIALLY SATISFIED. EC3/EC4 status UNKNOWN — need investigation.

---

## Task Count Summary

| Status | Count |
|---|---|
| COMPLETE | 9 |
| IN_FLIGHT | 3 |
| BLOCKED | 0 |
| OPEN | 0 |

---

## Sequence Constraints

1. T3.3 (Tier 2 self-validation) has no prerequisites — fires independently
2. T2.3 (A1 migration STEP 4 backfill) has no blocking prerequisites — can fire independently
3. Tier 3 enhancements (Decision tab, Sensitivity tab, sigma sub-field plausibility) must wait for Tier 2 completion (T3.3)
4. Phase 2 work gates on PHASE_2_ENTRY_CONDITIONS.md — EC1 and EC2 are the key blockers; EC3/EC4 need investigation before the gate can be evaluated
