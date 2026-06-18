# JEDI RE — Architecture Documentation

**What this is.** This directory contains the platform's architectural documentation corpus — 60+ documents covering ADRs, subsystem audits, design specifications, and event wiring synthesis. These are not aspirational design docs; they are evidence-based audit trails with file:line references, live DB verification, and consistent classification taxonomies.

**What this is NOT.** A tutorial, a getting-started guide, or a replacement for reading the code. The docs assume familiarity with the platform's module map (F9 is the financial hub, M07 is traffic, etc.).

**How to read this corpus.** Start with the four documents below, in order. Everything else is reference material you reach for when working on a specific subsystem.

---

## Start Here (4 Documents)

| # | Document | Why read it | Length |
|---|---|---|---|
| 1 | **ADR-001 — LayeredValue** (`ADR-001-layered-value.md`) | The core pattern of the platform. Every multi-source deal field is stored as a `LayeredValue<T>` with a resolution chain (override → formula → agent → stored). | 160 lines |
| 2 | **F9 Module Map** (`F9_MODULE_MAP.md`) | The system overview. Every module, engine, storage table, and known gap. | 617 lines |
| 3 | **Cross-Surface Read Consistency** (`cross-surface-read-consistency.md`) | The canonical read convention. Rule 1: `getFieldValue` is the single backend access point. Rule 2: `f9Financials` is the canonical frontend source. | 203 lines |
| 4 | **Architecture Reconciliation** (`ARCHITECTURE_RECONCILIATION.md`) | The corpus state tracker. What's shipped, what's in-flight, what's aspirational, and what's known to diverge from implementation. | 481 lines |

**If you only read one document:** read `F9_MODULE_MAP.md`. It has the inventory of all engines (A, B, C, D), all storage tables, and all 11 known gaps.

---

## Document Categories

### Architectural Decision Records (ADRs) — 4 files
Accepted decisions with real incidents behind them. Read when you need to understand *why* the platform works the way it does.

- `ADR-001-layered-value.md` — LayeredValue<T> provenance model
- `ADR-002-dealstore-event-bus.md` — dealStore as canonical cross-tab event bus
- `ADR-003-cache-stamp-pattern.md` — Cache-stamp + inline-recompute fallback
- `ADR-004-authoritative-signal-fallback.md` — Authoritative signal fallback for stance-derived cached values

### Core Architecture — 6 files
The design documents that define how subsystems work.

- `F9_MODULE_MAP.md` — System overview (engines, tables, gaps)
- `module_wiring_map.md` — 4-layer architecture (Ingestion → Signal → Decision → Presentation)
- `cross-surface-read-consistency.md` — Canonical read paths
- `cross-surface-field-inventory.md` — Field-to-surface mapping with fix status
- `calculations-vs-assumptions.md` — F9 field classification (22 assumptions vs 14 calculations)
- `M09_PROFORMA_SPEC.md` — Current stabilized-bridge-aware Pro Forma spec

### Audit Artifacts — 15+ files (Phase 0 / read-only)
**Warning:** These are forensic inventories, not current-state docs. They document findings at a point in time. Some findings have been fixed; some are still open. Check the `ARCHITECTURE_RECONCILIATION.md` §3 and §7a for current status before treating any finding as current.

- `PROFORMA_SUBSYSTEM_AUDIT.md` — Top 4 load-bearing findings (LIUS orphaned, parallel engines, per-year overrides, Tier 1-3 engine)
- `PROFORMA_MATH_AUDIT.md` — Revenue line math verification across 2 test deals
- `PROFORMA_SURFACE_AUDIT.md` — Every visible cell in ProFormaSummaryTab
- `F9_DATA_FLOW_AUDIT_PHASE1.md` — 3 flow audits (Unit Mix, Other Income, Projections)
- `F9_TIER1_BLOCKERS_AUDIT.md` — 4 Tier 1 blockers with fix status
- `YEAR1_CONSUMERS_AUDIT.md` — Every consumer of `deal_assumptions.year1`
- `DORMANT_IMPROVEMENTS_AUDIT.md` — 12+ seeder improvements invisible to existing deals
- `EVENT_PROPAGATION_AUDIT.md` — 16 event types × 8 modules (1300 lines)
- `EVENT_WIRING_SYNTHESIS.md` — Consolidated backlog of ~20 wiring fixes
- `CAPITAL_EXIT_SUBSYSTEM_AUDIT.md` — 16 capital/exit findings
- `TRAFFIC_ENGINE_STATE_AUDIT.md` — 14 traffic engine findings
- `OM_EXTRACTION_COVERAGE_AUDIT.md` — OM extraction coverage by field
- `RENT_ROLL_FRAMEWORK_GAP_ANALYSIS.md` — Rent roll framework gaps
- `RENT_ROLL_ANALYTICS_FRAMEWORK.md` — Rent roll analytics framework
- `INPUTS_TAB_SECTION_AUDIT.md` — INPUTS tab field inventory
- `VALIDATION_GRID_AND_SALE_COMPS_INVESTIGATION.md` — Validation grid and sale comps
- `UNIT_MIX_STORAGE_DIVERGENCE.md` — Unit mix storage divergence
- `SHIPPED_WORK_VERIFICATION.md` — Live HTTP probe verification of shipped work
- `P8-state-verification-report.md` — P8 state verification
- `ai-compute-derivation-audit.md` — AI compute derivation audit
- `audit-831-findings.json` — Machine-readable findings

### Specifications & Design Docs — 15+ files
Active specs for in-flight or queued work.

- `M09_PROFORMA_SPEC.md` — Current Pro Forma stabilization work (most current)
- `f9-proforma-spec.md` — Older spec with trajectory math design (partially superseded)
- `SCENARIO_MANAGEMENT_SPEC.md` — Scenario engine
- `OPERATOR_STANCE_PHASE1_SPEC.md` — leasingCostTreatment decision
- `STRATEGY_FIELDS_LV_PATTERN.md` — M08 forward-compatible strategy fields
- `INPUTS_SOURCE_OF_TRUTH.md` — One editable surface per concept
- `DATA_QUALITY_AGENT_SPEC.md` — Data quality agent
- `CROSS_TAB_EVENT_PATTERN.md` — Cross-tab event pattern
- `TODO_F9_DATA_FLOW.md` — Backend blockers with frontend placeholders
- `comp-profiles-spec.md` — Comp profiles
- `capital_structure_engine_handoff.md` — Capital structure handoff
- `deal-journey-framework.md` — Deal journey framework
- `traffic_engine_v2_leasing_prediction.md` — Traffic engine v2 spec
- `gsccca-pt61-feasibility.md` — GSCCCA PT61 feasibility
- `phase8-research-agent-readiness.md` — Research agent readiness
- `valuation-grid-dispatch1-audit.md` — Valuation grid dispatch 1
- `valuation-grid-dispatch2-design.md` — Valuation grid dispatch 2 design

### Vendor Market Data — 5 files
Multi-vendor ingestion, reconciliation, and divergence architecture.

- `vendor-market-data/overview.md` — Overview
- `vendor-market-data/piece-a-vendor-abstraction.md` — Vendor registry abstraction
- `vendor-market-data/piece-b-field-reconciliation.md` — Field-level reconciliation
- `vendor-market-data/piece-c-agent-synthesis.md` — Agent synthesis interface
- `vendor-market-data/piece-d-divergence-as-quality-signal.md` — Divergence as quality signal

### Property Plumbing — 5 files
Property identity unification refactor.

- `property-plumbing-field-mapping.md`
- `property-plumbing-implementation-map.md`
- `property-plumbing-phase1-dispositions.md`
- `property-plumbing-phase1-scope.md`
- `property-plumbing-phase2-write-path-inventory.md`
- `property-plumbing-reality-check.md`

### Other Reference — 5 files

- `deal-capsule-blueprint.md` — 33-field LayeredValue smoke audit (auto-generated)
- `deal-capsules-table-analysis.md` — Deal capsules table analysis
- `F5-dead-code-delete-list.md` — Dead code verification (3 files confirmed dead, now deleted)
- `a2-abstraction-gap-analysis.md` — Piece A2 Yardi abstraction proof
- `calculations-vs-assumptions.md` — Calculation vs assumption classification (see Core Architecture)

---

## How to Find What You Need

| I want to... | Read this |
|---|---|
| Understand the LayeredValue resolution chain | `ADR-001-layered-value.md` |
| Know which engine reads from which table | `F9_MODULE_MAP.md` §1.2 |
| Check if a cross-surface field discrepancy is fixed | `cross-surface-field-inventory.md` |
| See what architectural work is in-flight | `ARCHITECTURE_RECONCILIATION.md` §3 |
| Find the canonical read path for a field | `cross-surface-read-consistency.md` §2 |
| Understand why two tabs show different numbers | `cross-surface-read-consistency.md` §1 (Problem) |
| Check if an audit finding is still current | `ARCHITECTURE_RECONCILIATION.md` §7a |
| See the event wiring backlog | `EVENT_WIRING_SYNTHESIS.md` |
| Verify whether a shipped feature works live | `SHIPPED_WORK_VERIFICATION.md` |
| Check the vendor market data architecture | `vendor-market-data/overview.md` |
| Understand the Pro Forma math | `PROFORMA_MATH_AUDIT.md` §1 |
| See which fields are assumptions vs calculations | `calculations-vs-assumptions.md` §2 |
| Check if a subsystem has production callers | `PROFORMA_SUBSYSTEM_AUDIT.md` §1 (Top 4) |
| Find the traffic engine spec | `traffic_engine_v2_leasing_prediction.md` |
| See the scenario engine design | `SCENARIO_MANAGEMENT_SPEC.md` |
| Understand the deal completeness framework | `deal-capsule-blueprint.md` + `deal-capsule-vision.md` |
| Check property plumbing progress | `property-plumbing-phase1-scope.md` |
| See the 22 KEEP-AI assumption fields | `calculations-vs-assumptions.md` §3 |
| Check what dead code was deleted | `F5-dead-code-delete-list.md` + git history |
| Find the latest evaluation of this corpus | `EVALUATION_REPORT.md` (this directory) |

---

## Corpus Health

This corpus is actively maintained but has accumulated documents organically. The `ARCHITECTURE_RECONCILIATION.md` tracks which commitments are operational vs in-flight vs aspirational. The `EVALUATION_REPORT.md` provides a structured evaluation of the entire corpus including gaps, drift, and recommendations.

**Key caveats:**
- **Phase 0 audit docs** are point-in-time forensics. Treat them as evidence trails, not current-state references. Check the reconciliation doc for fix status.
- **Some systems are documented but not implemented.** LIUS (21 line schemas, 0 callers), Tier 1-3 growth engine (sophisticated formulas, test-only), and M07 calibration bands (backend placeholder) are all fully documented but have no production callers. See `EVALUATION_REPORT.md` §5 for the full inventory.
- **Engine A vs Engine B divergence** is the most significant architectural debt. Two parallel live engines serve the same deal with no shared contract. See `F9_MODULE_MAP.md` §1.2 and `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-01.

---

## Maintenance Protocol

- **New document created?** Add it to this README under the appropriate category. Add it to `ARCHITECTURE_RECONCILIATION.md` §2.
- **Document corrected or superseded?** Append to `ARCHITECTURE_RECONCILIATION.md` §6. Update the "last revised" date in §2.
- **Audit finding fixed?** Don't edit the audit doc (it's historical). Update `ARCHITECTURE_RECONCILIATION.md` §3 (commitment status) and §7a (divergences).
- **Dead code confirmed?** Delete it, commit with reference to `F5-dead-code-delete-list.md`, and update this README's F5 entry.

---

**Last updated:** 2026-06-18 (dead code deletion, README creation, evaluation report)
