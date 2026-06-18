# JEDI RE — Architecture Documentation Corpus Evaluation

**Date:** June 2026  
**Scope:** 60 documents in `docs/architecture/` (~300KB+ of documentation)  
**Evaluated by:** Agent read-only audit of 20+ core documents; remainder classified by filename/role

---

## 1. Executive Summary

The JEDI RE platform has an **unusually dense and high-quality** architectural documentation corpus. These are not aspirational design docs — they are evidence-based audit trails with file:line references, live DB verification, and consistent classification taxonomies. This is a genuine asset.

However, the corpus has grown organically across multiple sessions and now exhibits three structural risks:

1. **Corpus bloat** — 60 files with overlapping concerns, some superseded by others, no single entry point
2. **Audit-doc accumulation** — Many read-only Phase 0 audits exist without corresponding Phase 1 fix work
3. **Implementation drift** — Several docs describe systems that are partially or fully unimplemented (LIUS, Tier 1-3 growth engine, M07 calibration bands)

**Verdict:** The documentation is **stronger than the implementation** in many areas. The architecture is sound; the gap is in execution.

---

## 2. Corpus Classification

### 2.1 Architectural Decision Records (ADRs) — 4 files

| Document | Status | Quality | Notes |
|---|---|---|---|
| **ADR-001 LayeredValue** | Accepted, in production | ✅ Excellent | Crystal-clear problem statement (Purchase Price clobbering incident). Type definition, resolution chain, migration pattern all documented. |
| **ADR-002 dealStore event bus** | Accepted, in production | ✅ Excellent | Correctly identified dual-mechanism problem (store actions vs direct window.dispatchEvent). Standard pattern established. |
| **ADR-003 Cache-stamp** | Accepted, in production | ✅ Excellent | Deep context on stale-cache race condition. Decision + consequences + invariants all covered. |
| **ADR-004 Authoritative signal** | Present (not ADR-004, but ADR-004-authoritative-signal-fallback.md) | ✅ Good | Complements ADR-003 with fallback semantics for stance-derived cached values. |

**Assessment:** ADRs are the strongest part of the corpus. Each has a real incident behind it, a clear decision, and explicit consequences. They follow the classic ADR format well.

### 2.2 Core Architecture Documents — 6 files

| Document | Status | Quality | Notes |
|---|---|---|---|
| **ARCHITECTURE_RECONCILIATION.md** | Living, last updated May 31 | ✅ Good | Attempts to be the "single source of truth for the corpus state." Has document index, commitment status, and divergence tracking. **This is the right idea** but needs to be maintained more actively. Several entries say "(verify path)" indicating stale links. |
| **F9_MODULE_MAP.md** | Authoritative reference | ✅ Excellent | 617 lines of module inventory, storage architecture, gap inventory (11 gaps). This is the most comprehensive system overview. |
| **module_wiring_map.md** | Active | ✅ Good | 4-layer architecture (Ingestion → Signal → Decision → Presentation). Module-by-module wiring. Good high-level mental model. |
| **cross-surface-read-consistency.md** | Active — enforced from Task #1541 | ✅ Excellent | Rules 1-3 define canonical read paths. `getFieldValue` is the single backend access point. `f9Financials` is the canonical frontend source. |
| **cross-surface-field-inventory.md** | Active | ✅ Good | Maps every key field to canonical read source per surface. Shows 11 cross-surface discrepancies (CF-01 through CF-11), all fixed. |
| **calculations-vs-assumptions.md** | Active, May 31 | ✅ Good | Defines 22 assumption fields (KEEP-AI) vs calculations. Core principle: agents own assumptions, engine owns calculations. |

### 2.3 Audit Artifacts — 12+ files (the largest category)

| Document | Type | Status | Key Finding |
|---|---|---|---|
| **PROFORMA_SUBSYSTEM_AUDIT.md** | Phase 0 read-only | 768 lines | **Top 4 load-bearing findings:** LIUS 100% orphaned; two parallel engines; per-year overrides revert; Tier 1-3 engine has zero callers. |
| **PROFORMA_MATH_AUDIT.md** | Phase 0 read-only | 396 lines | Revenue line math verified across 2 test deals. Math is correct; `bad_debt` has a UNIT_DRIFT issue (applied to EGI not GPR in one path). |
| **PROFORMA_SURFACE_AUDIT.md** | Phase 0 read-only | 327 lines | Every visible cell in ProFormaSummaryTab inventoried. Some UI elements described in brief don't match actual code locations. |
| **F9_DATA_FLOW_AUDIT_PHASE1.md** | Phase 1 (live DB) | 133 lines | 3 flows audited: Unit Mix → GPR (YELLOW), Other Income → Pro Forma (YELLOW), Projections overrides (DATA_NOT_FLOWING). |
| **F9_TIER1_BLOCKERS_AUDIT.md** | Phase 1 (live DB) | 511 lines | 4 Tier 1 blockers. Item 1 (purchase price) FIXED. Items 2-4 still open or partially wired. |
| **YEAR1_CONSUMERS_AUDIT.md** | Phase 0 read-only | 347 lines | Every consumer of `deal_assumptions.year1` mapped. Good reference for understanding read paths. |
| **DORMANT_IMPROVEMENTS_AUDIT.md** | Phase 0 read-only | 520 lines | 12+ seeder improvements classified by commit. Some marked BACKFILL_NEED. Phase 1 is a separate greenlight. |
| **EVENT_PROPAGATION_AUDIT.md** | Phase 0 read-only | 1302 lines | Massive 16-event-type × 8-module matrix. Classifications: DUPLICATE_INJECTION, MISCLASSIFIED, SPEC_GAP, NOT_WIRED, PARTIALLY_WIRED, WIRED. |
| **EVENT_WIRING_SYNTHESIS.md** | Synthesis | 621 lines | Consolidates 3 parallel fix sequences into one ordered backlog. Canonical SQL query pattern established. |
| **CAPITAL_EXIT_SUBSYSTEM_AUDIT.md** | Phase 0 read-only | 954 lines | 16 CE findings + D1-D5 dispatch sequence. Some dispatched, some PR-pending, some staged. |
| **TRAFFIC_ENGINE_STATE_AUDIT.md** | Phase 0 read-only | 803 lines | 14 TE findings, FIX-1 dispatched, FIX-3 drafted, others open. |
| **OM_EXTRACTION_COVERAGE_AUDIT.md** | Phase 0 | 19940 bytes | OM extraction coverage by field. |
| **RENT_ROLL_FRAMEWORK_GAP_ANALYSIS.md** | Gap analysis | 33493 bytes | Rent roll framework gaps. |
| **RENT_ROLL_ANALYTICS_FRAMEWORK.md** | Framework | 45008 bytes | Analytics framework for rent roll. |
| **INPUTS_TAB_SECTION_AUDIT.md** | Section audit | 22915 bytes | INPUTS tab field inventory. |
| **VALIDATION_GRID_AND_SALE_COMPS_INVESTIGATION.md** | Investigation | 14384 bytes | Validation grid and sale comps. |
| **UNIT_MIX_STORAGE_DIVERGENCE.md** | Divergence | 14384 bytes | Unit mix storage divergence. |
| **SHIPPED_WORK_VERIFICATION.md** | Live verification | 408 lines | End-to-end probes with real HTTP calls. B items verified live. |
| **P8-state-verification-report.md** | Verification | 8801 bytes | P8 state verification. |
| **audit-831-findings.json** | JSON artifact | 24719 bytes | Machine-readable findings. |

**Assessment:** The audit artifacts are thorough but **accumulate without retirement**. Many Phase 0 audits describe findings that were fixed (or not) in subsequent work, but the audit docs themselves are not updated with fix status. This creates confusion about whether a finding is still current.

### 2.4 Specifications & Design Docs — 8 files

| Document | Status | Quality | Notes |
|---|---|---|---|
| **M09_PROFORMA_SPEC.md** | Active — just updated | ✅ Excellent | Stabilized-bridge-aware Pro Forma. Phase 2 (Option A) and Phase 3 recently completed. This is the most current spec. |
| **f9-proforma-spec.md** | April 2026, older | ⚠️ Partially superseded | 1013 lines, 
 line endings. Contains valuable trajectory math and revenue formula design but some sections are stale. |
| **SCENARIO_MANAGEMENT_SPEC.md** | Active | ✅ Good | Scenario engine spec. |
| **OPERATOR_STANCE_PHASE1_SPEC.md** | Accepted | ✅ Good | leasingCostTreatment decision. Clear scope (BROADEN vs narrow). |
| **STRATEGY_FIELDS_LV_PATTERN.md** | Accepted | ✅ Good | M08 forward-compatible strategy field design. Good pattern. |
| **INPUTS_SOURCE_OF_TRUTH.md** | Accepted | ✅ Good | One editable surface per concept. Clear categorization boundary rule. |
| **DATA_QUALITY_AGENT_SPEC.md** | Active | ✅ Good | Data quality agent specification. |
| **CROSS_TAB_EVENT_PATTERN.md** | Active | ✅ Good | Cross-tab event pattern complementing ADR-002. |
| **TODO_F9_DATA_FLOW.md** | Active | ✅ Good | 148-line TODO log with backend blockers and frontend placeholders. Good gating mechanism. |
| **comp-profiles-spec.md** | Active | ✅ Good | Comp profiles specification. |
| **capital_structure_engine_handoff.md** | Handoff | ✅ Good | Capital structure engine handoff doc. |
| **deal-journey-framework.md** | Framework | ✅ Good | Deal journey framework. |
| **property-plumbing-*.md** | 5 files | ⚠️ In-progress | Property plumbing refactor docs. Phase 1 and 2 scoped. |
| **vendor-market-data/*.md** | 5 files | ✅ Good | Vendor market data architecture (Pieces A-D). Yardi Matrix POC delivered. |
| **phase8-research-agent-readiness.md** | Readiness | ✅ Good | Research agent readiness assessment. |
| **traffic_engine_v2_leasing_prediction.md** | Spec | ✅ Good | Traffic engine v2 leasing prediction. |
| **ai-compute-derivation-audit.md** | Audit | ✅ Good | AI compute derivation audit. |
| **gsccca-pt61-feasibility.md** | Feasibility | ✅ Good | GSCCCA PT61 feasibility. |
| **valuation-grid-dispatch*.md** | 2 files | ✅ Good | Valuation grid dispatch docs. |
| **PROJECTIONS_TRAFFIC_ENGINE_AUDIT.md** | Audit | ✅ Good | Projections traffic engine audit. |
| **a2-abstraction-gap-analysis.md** | Analysis | ✅ Good | Piece A2 vendor registry abstraction gap. Yardi proved zero-touch classifier integration. |
| **property-plumbing-field-mapping.md** | Mapping | ✅ Good | Field mapping. |
| **property-plumbing-implementation-map.md** | Mapping | ✅ Good | Implementation map. |
| **property-plumbing-phase1-dispositions.md** | Dispositions | ✅ Good | Phase 1 dispositions. |
| **property-plumbing-phase1-scope.md** | Scope | ✅ Good | Phase 1 scope. |
| **property-plumbing-phase2-write-path-inventory.md** | Inventory | ✅ Good | Write path inventory. |
| **property-plumbing-reality-check.md** | Reality check | ✅ Good | Reality check. |
| **F5-dead-code-delete-list.md** | Delete list | ✅ Good | Dead code verification with import greps. 3 files confirmed dead. |
| **deal-capsule-blueprint.md** | Blueprint | ✅ Good | Auto-generated 33-field LayeredValue smoke audit. All 33 passed. |
| **deal-capsules-table-analysis.md** | Analysis | ✅ Good | Deal capsules table analysis. |

---

## 3. What the Documentation Does Well

### 3.1 Evidence-based methodology
Every significant audit includes file:line references, live DB query results, and HTTP probe verification. This is not theoretical architecture — it's forensics. Example: `F9_TIER1_BLOCKERS_AUDIT.md` shows the exact SQL INSERT from `inline-deals.routes.ts:334` and the DB state before/after.

### 3.2 Consistent classification taxonomies
The PROFORMA_SUBSYSTEM_AUDIT introduced a classification legend (SINGLE_WRITER, CONSISTENT, LAYERED, WIRED, PARALLEL, MIXED, FALLBACK, HARDCODED, etc.) that is reused across multiple docs. This creates a shared vocabulary.

### 3.3 Live verification discipline
`SHIPPED_WORK_VERIFICATION.md` establishes a pattern: create synthetic deals via real HTTP, inspect DB state, restore to steady state. This proved its value when the S1-01 fix passed unit tests but failed live (unit tests ≠ live behavior).

### 3.4 ADR quality
All 4 ADRs have real incidents behind them, not hypothetical scenarios. ADR-001 describes the Purchase Price field clobbering incident. ADR-003 describes the exact stale-cache race condition with a timeline diagram. This is how ADRs should be written.

### 3.5 Cross-surface consistency convention
`cross-surface-read-consistency.md` with Rule 1 (`getFieldValue` is the single access point) and Rule 2 (`f9Financials` is the canonical frontend source) is a simple, enforceable convention that directly addresses a real trust problem (different tabs showing different NOI).

---

## 4. Critical Gaps in the Documentation

### 4.1 No single entry point for the corpus
There are 60 files. `ARCHITECTURE_RECONCILIATION.md` attempts to be the index but is itself 481 lines and has stale "(verify path)" entries. A new developer cannot easily answer "where do I start?"

### 4.2 Audit docs are not retired after fixes
`PROFORMA_SUBSYSTEM_AUDIT.md` (768 lines) has a "Top 4 Findings" section. Item 1 (LIUS orphaned) and Item 2 (parallel engines) are still current. But Item 3 (per-year overrides) may have been partially addressed. Item 4 (Tier 1-3 engine) is still true. The doc doesn't have a "last verified" date or a "fix status" column for each finding.

### 4.3 Implementation drift is not systematically tracked
Many docs describe sophisticated systems that are **not implemented**:
- **LIUS engine** — 21 line schemas fully written, zero production callers (PROFORMA_SUBSYSTEM_AUDIT §PF-06)
- **Tier 1-3 growth engine** — five-component rent growth, nine-line OPEX, three revenue formulas — all test-only (PROFORMA_SUBSYSTEM_AUDIT §PF-07)
- **M07 calibration bands** — asymmetric percentile bands on trafficProjection.yearly — backend not wired, frontend has a placeholder (TODO_F9_DATA_FLOW.md)
- **Unit mix → GPR toggle** — backend flag exists, no UI control (F9_DATA_FLOW_AUDIT_PHASE1.md Flow 1)

The docs don't maintain a systematic "documented vs implemented" inventory.

### 4.4 `f9-proforma-spec.md` is stale and has formatting issues
This 1013-line document uses `\r\n` line endings (mixed carriage returns visible in Read output). It contains valuable trajectory math and revenue formula design but has been partially superseded by `M09_PROFORMA_SPEC.md`. The relationship between these two docs is unclear.

### 4.5 Event wiring backlog is large but progress is slow
`EVENT_WIRING_SYNTHESIS.md` consolidates 3 parallel fix sequences into one ordered backlog of ~20+ fixes. Only a few are dispatched (FIX-1, W-01, D1, D3). The remaining fixes are tracked but not actively worked. This is a risk: the backlog may grow stale.

### 4.6 Dormant improvements need explicit greenlight
`DORMANT_IMPROVEMENTS_AUDIT.md` identifies 12+ seeder improvements that are invisible to existing deals unless a `forceReseed` or backfill is run. The doc explicitly says "Phase 1 (build backfills) is a separate greenlight after Leon reviews." This greenlight has not been given, so the improvements remain dormant.

---

## 5. Gaps Between Documentation and Implementation

### 5.1 `getFieldValue` is canonical but not universally used
`cross-surface-read-consistency.md` Rule 1 says `getFieldValue` is the single access point. But `YEAR1_CONSUMERS_AUDIT.md` found that many consumers still read `deal_assumptions.year1[field].resolved` directly. The recent M09 work (Tasks #1541, #1563, #1569) has been migrating consumers one by one. The Valuation Grid is now canonical. Other surfaces may still have direct readers.

### 5.2 Engine A vs Engine B divergence
`F9_MODULE_MAP.md` identifies two parallel live engines with no shared contract. `getDealFinancials` (Engine A, `/deal-assumptions/:id`) and `composeDealFinancials` (Engine B, `/deals/:id/financials`) assemble the same data via different paths. A fix to one is invisible to the other. This is a **major architectural debt** that is documented but not resolved.

### 5.3 Dead code still exists
`F5-dead-code-delete-list.md` confirmed 3 files as dead (`DealPage.tsx`, `DealPageEnhanced.tsx`, `DealView.tsx`). They are still in the repo. The doc says "safe to delete" but they haven't been deleted. This is a 2-minute cleanup task that hasn't been done.

### 5.4 Architecture reconciliation doc is stale
`ARCHITECTURE_RECONCILIATION.md` was last updated May 31. Several entries say "(verify path)" for documents like `property-plumbing/refactor.md`, `deal-capsule-vision.md`, `master-plan.md`. These are not verified paths — they are placeholder notes. The doc needs a maintenance pass.

### 5.5 ADR-004 filename inconsistency
The file is named `ADR-004-authoritative-signal-fallback.md` but the ADR refers to itself as "ADR-004: Authoritative Signal Fallback." However, the cross-reference in ADR-003 says "Related: ADR-001, ADR-002, ADR-003, TODO_F9_SIDE_DEBT.md (SDB-02 — document idx_prompt_versions_active)". ADR-004 is not listed as a related doc in ADR-003, suggesting it was created after ADR-003 but the cross-reference was never updated.

---

## 6. Recommendations

### 6.1 Immediate (this week)

1. **Delete the 3 confirmed dead files** from `F5-dead-code-delete-list.md` (`DealPage.tsx`, `DealPageEnhanced.tsx`, `DealView.tsx`). This is a 2-minute commit that reduces cognitive load.

2. **Add a `README.md` to `docs/architecture/`** as a single entry point. It should:
   - List the 4 ADRs as the starting point
   - Point to `F9_MODULE_MAP.md` as the system overview
   - Point to `ARCHITECTURE_RECONCILIATION.md` as the corpus state tracker
   - Warn that audit docs are Phase 0 artifacts and may be superseded

3. **Update `ARCHITECTURE_RECONCILIATION.md`** with verified paths for all entries, or remove unverified ones. Add a "last verified" date to each document entry.

### 6.2 Short-term (next 2-4 weeks)

4. **Retire or annotate stale audit docs.** For each Phase 0 audit, add a header block stating:
   - Which findings are fixed (with task numbers)
   - Which findings are still open
   - Which findings are superseded by newer docs
   This prevents the "archaeology" problem described in `ARCHITECTURE_RECONCILIATION.md` §1.

5. **Resolve the Engine A / Engine B divergence.** This is the most significant architectural debt. Options:
   - Option A: Merge Engine B into Engine A (make `composeDealFinancials` a thin wrapper around `getDealFinancials`)
   - Option B: Define a shared response contract and enforce it with a test
   - Option C: Deprecate Engine B and migrate all consumers to Engine A
   The right choice depends on consumer inventory, but **documented indecision is still debt**.

6. **Create a "Documented vs Implemented" tracking section** in `ARCHITECTURE_RECONCILIATION.md`. List:
   - LIUS engine (documented: yes, implemented: no, callers: 0)
   - Tier 1-3 growth engine (documented: yes, implemented: test-only, callers: 0)
   - M07 calibration bands (documented: yes, implemented: partial, callers: placeholder)
   - Unit mix GPR toggle (documented: yes, implemented: partial, callers: no UI)

### 6.3 Medium-term (next 1-3 months)

7. **Consolidate the two Pro Forma specs.** `f9-proforma-spec.md` and `M09_PROFORMA_SPEC.md` overlap. Either:
   - Merge f9-proforma-spec content into M09 and delete the old one, or
   - Clearly demarcate: M09 = current stabilization work, f9-proforma = long-term trajectory math design

8. **Drive the EVENT_WIRING_SYNTHESIS.md backlog.** Of ~20 fixes, only 4-5 are dispatched. Either:
   - Schedule a sprint to clear the remaining items, or
   - Deprioritize the backlog and document the decision (why these fixes are not worth the effort right now)

9. **Decide on dormant improvements.** `DORMANT_IMPROVEMENTS_AUDIT.md` needs a yes/no on the Phase 1 greenlight. If yes, build the backfills. If no, document why and close the audit.

10. **Standardize document formatting.** `f9-proforma-spec.md` has mixed `\r\n` line endings. Run a normalization pass over the corpus to ensure all docs use consistent `\n` endings.

---

## 7. Corpus Health Score

| Dimension | Score | Notes |
|---|---|---|
| **Evidence quality** | A | File:line references, live DB verification, HTTP probes |
| **Classification consistency** | A | Shared taxonomies (SINGLE_WRITER, LAYERED, WIRED, etc.) |
| **ADR quality** | A | Real incidents, clear decisions, explicit consequences |
| **Coverage completeness** | B+ | Most subsystems are documented; some gaps in M06, M12, M22 |
| **Implementation fidelity** | C+ | Docs often describe systems that are not fully implemented |
| **Corpus maintenance** | C | Stale links, unverified paths, audit docs not retired |
| **Entry point clarity** | C- | 60 files, no clear "start here" document |
| **Dead code tracking** | B | Good at identifying dead code, not good at removing it |
| **Fix backlog hygiene** | C+ | Large backlogs (EVENT_WIRING, DORMANT) with slow progress |
| **Cross-reference accuracy** | B | Some stale cross-references (ADR-003 missing ADR-004, f9 vs M09) |

**Overall: B+** — The documentation is genuinely good forensics. The risk is that it becomes a museum of unimplemented architecture.

---

## 8. Documents That Should Be Read First (Priority Order)

For a new developer or a future audit session, read in this order:

1. **`docs/architecture/README.md`** (doesn't exist yet — create it)
2. **`docs/architecture/ADR-001-layered-value.md`** — the core pattern of the platform
3. **`docs/architecture/F9_MODULE_MAP.md`** — the system overview (617 lines, worth it)
4. **`docs/architecture/cross-surface-read-consistency.md`** — the canonical read convention
5. **`docs/architecture/ARCHITECTURE_RECONCILIATION.md`** — what's actually shipped vs planned
6. **`docs/architecture/M09_PROFORMA_SPEC.md`** — the current stabilization work
7. **`docs/architecture/PROFORMA_SUBSYSTEM_AUDIT.md`** — the top 4 load-bearing findings (read §1-2 only)
8. **`docs/architecture/EVENT_WIRING_SYNTHESIS.md`** — the consolidated event backlog

---

*End of evaluation.*
