# Phase 1 Brief

**Date created:** 2026-05-27 (recalibration dispatch)  
**Phase:** Phase 1 — Multifamily-Existing Foundation  
**Prerequisite to Phase 2:** See `PHASE_2_ENTRY_CONDITIONS.md`

---

## 1. Phase 1 Objective

Establish the foundational data architecture and agent pipeline correctness for multifamily-existing (stabilized acquisition, value-add) deals before expanding to development, ground-up, and STR deal types in Phase 2.

Phase 1 has three pillars:

| Pillar | What it achieves |
|---|---|
| **Strategy Canonical Reconciliation** | Single source of truth for deal strategy (investmentStrategy → deal_type); Pattern B routing and tab visibility see the correct deal classification |
| **Mandate Lift v1.3** | Cashflow agent writes pre_renovation / post_stabilization regime values for value-add line items; RegimeExpand surfaces them with correct provenance badges |
| **Agent Self-Validation** | Postprocess guards against epistemologically invalid agent output (confidence inversions, directional violations, delta implausibility) |

---

## 2. Scope Boundaries

**In scope for Phase 1:**
- Multifamily residential: stabilized, value-add, redevelopment
- Cashflow agent (primary analysis agent)
- F9 financial engine (ProFormaSummaryTab, RegimeExpand)
- Strategy canonical field (investmentStrategy → deal_type bridge)
- Mandate lift sub-field protocol for 9 eligible revenue/expense line items
- Directional self-validation (warning-level, 4 checks)

**Out of scope for Phase 1 (Phase 2):**
- Ground-up development deal type (full support)
- STR / Flip / Lease-Up full pattern routing
- Tier 3 F9 enhancements (Decision tab Pre-Reno NOI, Sensitivity tab annotation)
- Sub-field plausibility sigma enrichment
- Operator-facing UI for validation_warnings
- DealTypeKey enum extension ('land_hold', 'str', 'flip')

---

## 3. Success Criteria

| Criterion | Status |
|---|---|
| investmentStrategy saved by operator → deal_type derived and written atomically | ✓ DONE (Task #1233) |
| Land Hold strategy value added to INV_VALID and mapping function | ✓ DONE (Task #1265) |
| Build-to-Sell slug in strategyTriggers | ✓ DONE (Task #1265) |
| proformaTemplateId wired into ProFormaSummaryTab template-aware rendering | ✓ DONE (Task #1355) |
| Mandate v1.3 protocol in all 9 eligible line items in line-item-matrix.ts | ✓ DONE (confirmed 9 instances) |
| Sub-field writeback in cashflow.postprocess.ts | ✓ DONE (lines 555–654) |
| regimeDataByField composition in proforma-adjustment.service.ts | ✓ DONE (lines 4824–4901) |
| RegimeExpand renders populated sub-fields with correct color-coded provenance badges | ✓ DONE (Tier 1 fix shipped) |
| RegimeExpand renders T12 fallback when agent not run | ✓ DONE (pre-existing) |
| Confidence gate: low-confidence post_stabilization rejected at postprocess | ✓ DONE (pre-existing) |
| A1 migration investigation verified and amended | ✓ DONE |
| Strategy investigation verified | ✓ DONE |
| Gap 2 confidence propagation ruling documented (Option 3: Independent) | ✓ DONE |
| 4 directional validation checks added to postprocess (warning-level) | ✓ DONE (current session) |
| Pre-Task #1233 deals: investmentStrategy backfill counts documented | ◐ IN_FLIGHT (current session) |

---

## 4. Architectural Decisions Locked in Phase 1

| Decision | Where documented |
|---|---|
| A1 selected: investmentStrategy is the canonical operator-facing field | `A1_VS_A2_INVESTIGATION.md` §4, `STRATEGY_CANONICAL_DECISION.md` |
| A2-derived bridge implements A1 (Task #1233): investmentStrategy → deal_type atomically | `deal-assumptions.routes.ts` line 942–1055 |
| Gap 2 (confidence propagation): Independent (sub-field confidence does not modify parent LV) | `MANDATE_CONSUMER_WIRING.md §5.3` |
| deal_type remains as a derived internal field; not deprecated from DB schema in Phase 1 | `A1_MIGRATION_IMPLEMENTATION.md` §STEP3 |
| Validation warnings are data-only in Phase 1; operator UI is Phase 2 | `AGENT_SELFVALIDATION_TIER2.md` |

---

## 5. Phase 1 Remaining Work

| Work item | Dispatch | Status |
|---|---|---|
| A1 migration STEP 4 — backfill investmentStrategy for pre-Task #1233 deals | A1_MIGRATION_IMPLEMENTATION | IN_FLIGHT |
| Phase 2 entry condition investigation (EC3, EC4) | PHASE_1_STATUS_RECALIBRATION | OPEN |

---

## 6. Gotchas Surfaced in Phase 1

1. **Three strategy enumerations** (`DealType` 3-value, `DealTypeKey` 6-value, `CashflowDealType` 5-value) operate in different subsystems and are not wired together. Normalization is ad-hoc. Phase 2 should standardize.

2. **RenovationAssumptionsSection dead code (OQ-2):** `dealType === 'value-add'` branch is dead code because the prop receives `DealType` (3-value) which never includes `'value-add'`. Phase 2 follow-on.

3. **investmentStrategy vocabulary gaps:** The 4-value `INV_VALID` from the original investigation has been expanded to 8 values (`['Build-to-Sell', 'Flip', 'Land Hold', 'Lease-Up', 'Redevelopment', 'Rental', 'Short-Term Rental', 'Value-Add']`). The strategy → deal_type mapping handles all 8 with reasonable approximations.

4. **Source string normalization gap (resolved Tier 1):** Tiered source strings like `'tier1:t12'` required a normalization layer in RegimeExpand to display correctly. Always verify source badge rendering when adding new source string formats to the agent output schema.
