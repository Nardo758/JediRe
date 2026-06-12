# JEDI RE — MASTER SPEC INDEX

**What this is:** the single binding index for "what is every component, how does it work,
what does it output, how is it wired." It does not restate component internals — those live in
leaf specs. It maps **module → authoritative leaf spec → code location → build status**, lists the
cross-cutting subsystems the module registry omits, and carries a *verified* document map so you
never again have to guess which of six docs is authoritative.

**Authority model (proposed — supersedes the prior "three SSOTs" problem):**
- This file = the **index of record**. Start here.
- `jedi_re_module_wiring_blueprint_v2.xlsx` = the **structural spine** (registry, formula engine,
  data contracts, recomputation cascade, document triggers). Machine-readable metadata.
- `docs/architecture/module_wiring_map.md` = the **data-flow narrative** (the 4-layer prose view).
- `docs/architecture/ARCHITECTURE_RECONCILIATION.md` = **demoted** to corrections/commitment log
  only. Its §2 document index is stale (see §C) and is replaced by §A/§B/§C here.

**Last built:** 2026-06-12 · against repo HEAD `8369331`. Build-status column is v2's own claim
unless a code path is named; treat unverified rows as "verify before relying."

---

## §A — MODULE SPINE (M01–M25, M35–M38)

29 registered modules. "Spec" = authoritative leaf doc. "Code" = primary service/agent. "Status"
from v2 registry (Built / Partial / New).

| M## | Module | Surface | Authoritative spec | Primary code | Status |
|---|---|---|---|---|---|
| M01 | Deal Overview | S1 | `docs/architecture/deal-capsule-blueprint.md`, `deal-journey-framework.md` | deal capsule routes | Built |
| M02 | Zoning & Entitlements | S1 | `MAP_AGNOSTIC_ZONING.md`, `MAP_AGNOSTIC_IMPLEMENTATION.md` | `agents/zoning.agent.ts` | Partial |
| M03 | Development Capacity | S1 | `docs/DEVELOPMENT_CAPACITY.md`, `docs/BUILDING_DESIGN_OPTIMIZATION.md` | — | Partial |
| M04 | Supply Pipeline | S1 | *(no dedicated spec — gap)* | `agents/supply.agent.ts` | Partial |
| M05 | Market Analysis | S2 | `docs/architecture/vendor-market-data/overview.md` (+ A–D) | `market-metrics-aggregator.service.ts` | Partial |
| M06 | Demand Signals | S2 | *(no dedicated spec — gap)* | services/demand* | Built |
| M07 | Traffic Intelligence | S2 | `TRAFFIC_ENGINE_CALIBRATION_SPEC.md`, `docs/architecture/traffic_engine_v2_leasing_prediction.md`, `…/PROJECTIONS_TRAFFIC_ENGINE_AUDIT.md`, `…/TRAFFIC_ENGINE_STATE_AUDIT.md` | services/traffic* | **New** |
| M08 | Strategy Arbitrage | S2 | `attached_assets/JEDI_RE_STRATEGY_AWARE_MODULES_*.md`, `docs/architecture/STRATEGY_FIELDS_LV_PATTERN.md` | services/strategy* | Partial |
| M09 | Pro Forma Engine | S3 | `docs/architecture/f9-proforma-spec.md` + `M09_PROFORMA_SPEC.md` + `calculations-vs-assumptions.md` + `PROFORMA_MATH_AUDIT.md` + `F9_MODULE_MAP.md` | services/proforma*, `financials-composer.service.ts` | Partial |
| M10 | Scenario Engine | S3 | `docs/architecture/SCENARIO_MANAGEMENT_SPEC.md` | services/scenario* | Built |
| M11 | Debt Analysis | S3 | `docs/architecture/capital_structure_engine_handoff.md`, `…/CAPITAL_EXIT_SUBSYSTEM_AUDIT.md` | services/capital* | Partial |
| M12 | Exit Analysis | S3 | `docs/architecture/CAPITAL_EXIT_SUBSYSTEM_AUDIT.md` (+ `exit_timing_dashboard.jsx`) | services/exit* | Partial |
| M13 | Due Diligence Tracker | S4 | *(no dedicated spec — gap)* | services/dd* | Partial |
| M14 | Risk Dashboard | S4 | *(no dedicated spec — gap; partial in `DATA_QUALITY_AGENT_SPEC.md`)* | services/risk* | Built |
| M15 | Competition Analysis | S4 | `docs/architecture/comp-profiles-spec.md`, `COMPETITIVE_INTELLIGENCE_ENGINE_SPEC_*.md` | `competitive-set.service.ts`, `comp-query.service.ts` | Partial |
| M16 | Deal Pipeline | S5 | `docs/architecture/deal-journey-framework.md`, `JEDI_RE_DEAL_LIFECYCLE_STATE_MACHINE_*.md` | services/pipeline* | Built |
| M17 | Team & Collaboration | S5 | *(no dedicated spec — gap)* | services/team* | Partial |
| M18 | Documents & Files | S5 | `jedire-patches/DATA_LIBRARY_SCHEMA.md`, `docs/architecture/OM_EXTRACTION_COVERAGE_AUDIT.md`, `OM_TO_KG_TASKS.md` | `dataLibrary.service.ts`, OM parser | Partial |
| M19 | News Intelligence | S6 | `Event_Impact_Engine_Spec.md` (→ M35), `market-event-extraction.service.ts` | services/news* | Partial |
| M20 | Map Intelligence | S6 | `MAP_AGNOSTIC_IMPLEMENTATION.md`, `attached_assets/Map_Agnostic_Architecture_*.md` | services/map* | Partial |
| M21 | AI Chat (Opus) | S6 | `docs/OPUS_INTEGRATION.md`, `CLAUDE.md` (agent layer) | `agents/runtime/`, coordinator | Partial |
| M22 | Portfolio Manager → **Asset Hub** | S6 | `attached_assets/ASSET_HUB_REBUILD_SPEC_*.md`, `REVENUE_MANAGEMENT_ENGINE_SPEC_*.md`, `HIGHLANDS_INGESTION_AND_WIRING_SPEC_*.md` | `revenue-management.service.ts` | Partial |
| M23 | Alerts & Notifications | S6 | `docs/NOTIFICATION_SYSTEM.md`, `docs/NOTIFICATION_INTEGRATION_EXAMPLE.md` | services/notification* | Partial |
| M24 | Settings & Preferences | S6 | *(no dedicated spec — gap)* | — | Partial |
| M25 | JEDI Score Engine | S6 | v2 Formula Engine F01 *(no standalone md — gap)* | services/score* | Built |
| M35 | Event Impact Engine | S2 | `Event_Impact_Engine_Spec.md`, `M35_Calibration_Ledger_Addendum.md` | services/event-impact* | New (specced) |
| M36 | Joint Distribution Engine | S4 Inference | `M36_Joint_Distribution_Engine_Spec.md`, `M36_Macro_Anchored_Mean_Addendum.md`, `M36_PROFORMA_LINE_ITEM_ANCHORS.md` | services/joint-dist* | New (specced) |
| M37 | Cross-Market Analog Engine | S4 Inference | `M37_Cross_Market_Analog_Engine_Spec.md` | services/analog* | New (specced) |
| M38 | Calibration Ledger | S4 Inference | `M35_Calibration_Ledger_Addendum.md` | `calibration-calculator.ts` | New (specced) |

**Registry gaps (modules with no dedicated behavior spec):** M04, M06, M13, M14, M17, M24, M25.
These run on code + v2 metadata only; their "how it works / output" contract is undocumented.

**Note on numbering:** M26–M34 are absent from the registry. M34 (UI Intelligence Agent) is
deferred per roadmap; M26–M33 were never assigned. Confirm none are orphaned in code.

---

## §B — CROSS-CUTTING SUBSYSTEMS (not in the M## registry)

These span modules and are where most wiring bugs live. None appear in §A because the registry is
module-keyed, not subsystem-keyed.

| Subsystem | Authoritative spec(s) | Code anchor |
|---|---|---|
| Agent Platform / Coordinator (3-layer) | `CLAUDE.md`, `AGENT_PLATFORM_SPEC`, `AGENT_TAXONOMY_ADDENDUM` | `agents/{research,zoning,supply,cashflow,commentary}.agent.ts`, `agents/runtime/` |
| Vendor Market Data (Pieces A–D) | `docs/architecture/vendor-market-data/{overview,piece-a-vendor-abstraction,piece-b-field-reconciliation,piece-c-agent-synthesis,piece-d-divergence-as-quality-signal}.md` | services/intake-sources, integrations |
| Property Plumbing (identity unification) | `docs/architecture/property-plumbing-{implementation-map,field-mapping,phase1-scope,phase1-dispositions,phase2-write-path-inventory,reality-check}.md` | property identity layer |
| Event Bus / Kafka | `docs/EVENT_BUS_ARCHITECTURE.md`, `docs/architecture/{EVENT_PROPAGATION_AUDIT,EVENT_WIRING_SYNTHESIS,CROSS_TAB_EVENT_PATTERN}.md` | Kafka/Inngest topics |
| LayeredValue / provenance | `docs/architecture/ADR-001-layered-value.md`, `STRATEGY_FIELDS_LV_PATTERN.md` | `field-access/get-field-value.service.ts` |
| DealStore message bus | `docs/architecture/ADR-002-dealstore-event-bus.md` | `dealStore.ts` |
| Cache-stamp / freshness | `docs/architecture/ADR-003-cache-stamp-pattern.md` | cache layer |
| Authoritative-signal fallback | `docs/architecture/ADR-004-authoritative-signal-fallback.md` | resolution chain |
| Correlation Engine (30 signals) | `correlation-metrics-engine.jsx`, v2 (`Recomputation Cascade`) | `correlationEngine.service.ts` |
| Data Library / licensing primitive | `jedire-patches/{DATA_LIBRARY_SCHEMA,DATA_ARCHITECTURE,UI_DATA_ARCHITECTURE}.md` | `dataLibrary.service.ts` (`redistribution_restricted`) |
| **Third-party data licensing + scope ("engine + oil")** | **`CORRELATION_TERMINAL_SCOPE_SPEC.md` (NEW — not yet in repo)** | scope_id (to build) |
| Field Reconciliation / cross-surface read | `docs/architecture/cross-surface-read-consistency.md`, `cross-surface-field-inventory.md`, vendor piece-b | resolution chain |

---

## §C — VERIFIED DOCUMENT MAP (repairs Reconciliation §2)

**Stale paths in `ARCHITECTURE_RECONCILIATION.md` §2 — corrected:**

| §2 claimed path | Reality | Correct path |
|---|---|---|
| `…/property-plumbing/refactor.md` | wrong | `docs/architecture/property-plumbing-implementation-map.md` (+ phase docs) |
| `…/deal-capsule-vision.md` | wrong | `docs/architecture/deal-capsule-blueprint.md` |
| `…/strategy-aware-modules.md` | wrong | `docs/architecture/STRATEGY_FIELDS_LV_PATTERN.md` (+ `attached_assets/JEDI_RE_STRATEGY_AWARE_MODULES_*.md`) |
| `…/fkey-triage.md` | missing | not in `docs/architecture/` — locate or retire |
| `…/master-plan.md` | wrong | `attached_assets/JEDI_RE_MASTER_PLAN_FOR_REPLIT_*.md` |
| `…/verification-protocol.md` | wrong | `docs/architecture/P8-state-verification-report.md` + `SHIPPED_WORK_VERIFICATION.md` |
| `…/backtest-harness-spec.md` | wrong | `attached_assets/JEDI_RE_BACKTEST_HARNESS_SPEC_*.md` |

**Hollow files that read as canonical but aren't:**
- `TECHNICAL_ARCHITECTURE.md` — 25-line stub ("would go here"). Either fill or delete + redirect here.
- `docs/BACKEND_ARCHITECTURE.md` — **0 bytes.** Fill from `backend/PROJECT_OVERVIEW.md` + §A/§B or delete.
- `docs/AGENT_ARCHITECTURE.md` — **0 bytes.** Fill from `CLAUDE.md` agent layer or delete.

**Competing "single source of truth" declarations to reconcile:** `module_wiring_map.md`,
`jedi_re_module_wiring_blueprint_v2.xlsx`, and `ARCHITECTURE_RECONCILIATION.md` each claim it.
Authority model at the top of this file resolves the conflict — apply it to their headers.

**Known duplicates (pick one, archive the rest):** `ARCHITECTURE_RECONCILIATION` (×2),
`PIECE_A/B/C/D` (×2 each), `OTHER_INCOME_SPEC_PATCH` (×4), `PRO_FORMA_REGIME_INPUT_UI_SPEC` (×2),
`UNIT_MIX_BUILD_APPROVAL` (×2), `Map_Agnostic_Architecture` (×2).

---

## §D — OPEN DIMENSIONAL GAPS (no doc closes these)

1. **Third-party data use-vs-sell + scope** — only in the new `CORRELATION_TERMINAL_SCOPE_SPEC.md`;
   not integrated, not in any index but this one. (`Piece A` covers *platform* vendor license
   posture only, not user-passthrough.)
2. **Derived-data taint** — no doc states a restricted leaf taints downstream computed outputs.
3. **Surface mapping** — no doc maps each module to chat vs Bloomberg Terminal, or defines parity.
4. **Credit/tier gating** — the 4-tier credit model + automation levels 1–4 aren't wired to any
   module or agent in the registry.
5. **Behavior specs for §A registry gaps** — M04, M06, M13, M14, M17, M24, M25.

---

## §E — MAINTENANCE PROTOCOL (so it doesn't re-fragment)

- New component → add a row to §A or §B **and** the v2 registry in the same PR. A spec with no
  index row is considered non-existent.
- One authoritative doc per concept. New doc that supersedes an old one: delete or archive the old
  one, don't leave both.
- No new file may claim "single source of truth." There is one index (this file) and typed spines
  it points to.
- Path changes update §A/§B here, not a parallel index.
- `ARCHITECTURE_RECONCILIATION.md` keeps only the corrections log (§6) and commitment status (§3);
  its document index (§2) is retired in favor of §A–§C here.
