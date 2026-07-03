# F9 Factory Impact Audit — READ-ONLY Evidence Map

> **Type:** READ-ONLY impact evaluation. No code, schema, or config changes were made.  
> **Reference:** `AUDIT_DISPATCH_F9_FACTORY_IMPACT.md` (E1–E5).  
> **D2 Coordination:** Evaluated against D2 TARGET state (deterministic-primary, no LLM in build path, monthly resolution added). Where current and target states differ, both are noted.  
> **Standing rule (S1-01):** Every claim carries `file:line` evidence.

---

## Executive Summary

| Metric | Current | Factory Target | Delta |
|---|---|---|---|
| **Built-in tabs** | 11 (10 when Roadmap hidden) | 4 base (CHART / PRO FORMA / ASSUMPTIONS / RETURNS) | **+7 permanent tabs** |
| **Custom tabs** | N (user-generated via Opus) | N (dynamic, summoned) | **≡** |
| **Assumption stores** | 4+ (deal_financial_models, deal_assumptions, deal_underwriting_scenarios, frontend local state) | 1 canonical + overlays | **3+ redundant stores** |
| **Module registry** | Metadata only (25 modules, buildStatus field) | Flag-driven activation → tab/item rendering | **Registry reads; no control** |
| **Exhibit-class candidates** | 0 (assessment exhibit, cost-to-complete, debt-NPV, lender-recovery) | 4+ summoned by situation flags | **Pure future** |

**Headline verdict:** The current F9 surface is a **tab-rich explorer** (11 permanent tabs + custom). The factory contract is a **tab-sparse chassis** (4 base + dynamic summoned). The gap is structural: current tabs are not flagged in; they are hardcoded in the component switch. Assumption storage is fragmented across 3+ tables plus local state, violating the “no value in two places” invariant.

---

## E1 · Current Tab/Surface Inventory

### 1.1 F9 Financial Engine — Built-in Tabs

Rendered at `frontend/src/pages/development/FinancialEnginePage.tsx:2143–2194` via a switch on `activeTab` index.

| # | Tab Label | Component | File | Data Source | Always Rendered? | Factory Verdict |
|---|---|---|---|---|---|---|
| 0 | ⊞ OVERVIEW | `OverviewTab` | `financial-engine/OverviewTab.tsx` | `modelResults` + `f9Financials` + API calls (`/market-research/intelligence`) | **Yes** | **CHASSIS-EQUIVALENT** → RETURNS (summary KPIs) + CHART (cash flow table) |
| 1 | ⊕ CONSOLE | `ConsoleHubTab` | `financial-engine/ConsoleHubTab.tsx` | `assumptions` + `modelResults` + `f9Financials` | **Yes** | **CHASSIS-EQUIVALENT** → ASSUMPTIONS (input surface) |
| 2 | ⋮≡ PROJECTIONS | `ProjectionsHubTab` | `financial-engine/ProjectionsHubTab.tsx` | `f9Financials.projections` + `modelResults` | **Yes** | **CHASSIS-EQUIVALENT** → PRO FORMA (institutional rows) |
| 3 | ✓ VALIDATION | `ValidationGridTab` | `financial-engine/ValidationGridTab.tsx` | `f9Financials` + `evidenceSummary` + `modelResults` | **Yes** | **DYNAMIC-CANDIDATE** — should be summoned when evidence conflicts exist |
| 4 | ◈ CAPITAL | `CapitalHubTab` | `financial-engine/CapitalHubTab.tsx` | `f9Financials.capitalStack` + `modelResults` | **Yes** | **CHASSIS-EQUIVALENT** → PRO FORMA (sources & uses) |
| 5 | % RETURNS | `ReturnsHubTab` | `financial-engine/ReturnsHubTab.tsx` | `modelResults` + `f9Financials.returns` | **Yes** | **CHASSIS-EQUIVALENT** → RETURNS |
| 6 | ⊡ VALUATION | `ValuationGridTab` | `financial-engine/ValuationGridTab.tsx` | `f9Financials` + `assumptions` + API | **Yes** | **DYNAMIC-CANDIDATE** — should be summoned when valuation methods are active |
| 7 | ◐ SCENARIOS | `ScenarioManagementTab` | `components/scenarios/ScenarioManagementTab.tsx` | API (`/versions`) | **Yes** | **DYNAMIC-CANDIDATE** — should be summoned when >1 scenario exists |
| 8 | ⇔ COMPARE | `CompareHubTab` | `financial-engine/CompareHubTab.tsx` | `modelResults` + `f9Financials` + `versions` | **Yes** | **DYNAMIC-CANDIDATE** — should be summoned when comparison is requested |
| 9 | ⊙ GOAL SEEK | `SensitivityTab` | `financial-engine/SensitivityTab.tsx` | `modelResults` + `assumptions` + API (`/sigma/broader-goal-seek`) | **Yes** | **DYNAMIC-CANDIDATE** — should be summoned by goal-seek input |
| 10 | ⊛ ROADMAP | `RoadmapTab` | `financial-engine/RoadmapTab.tsx` | `modelResults` + `f9Financials` | **Conditional** — `isRoadmapEligible` at `FinancialEnginePage.tsx:519–522` | **DYNAMIC-CANDIDATE** — already conditional, but should be summoned by flag not deal-type regex |

**Custom tabs:** Appended after built-in tabs at `FinancialEnginePage.tsx:2174–2194`. Rendered via `CustomTabRenderer` with Opus-generated payload. Count = N (user-generated). **Verdict: DYNAMIC-CANDIDATE** — already summoned by user input (Opus prompt). Factory-compatible.

### 1.2 Other Surfaces Rendering Proforma/Financial Content

| Surface | File | F9 Content | Verdict |
|---|---|---|---|
| `DealDetailPage` — Pro Forma tab | `DealDetailPage.tsx:178` | Embeds `FinancialEnginePage` as `ProFormaScreen` with `PROFORMA_TABS = [{id:'proforma', label:'Pro Forma', component:FinancialEngineWrapper}]` | **DUPLICATE** — renders the full F9 inside DealDetailPage under a single “Pro Forma” tab |
| `DealDetailPage` — Debt & Capital tab | `DealDetailPage.tsx:196–200` | `DebtCapitalScreen` with `ExitCapitalModule` | **CHASSIS-EQUIVALENT** → RETURNS (exit/debt subset) |
| `DealDetailPage` — Overview screen | `DealDetailPage.tsx:142–157` | `BloombergOverviewSection` + `PeriodicTimelineTrigger` | **CHASSIS-EQUIVALENT** → CHART (high-level summary) |
| `DealDetailPage` — Market screen | `DealDetailPage.tsx:159–166` | `PropertyMarketIntelligencePanel` + `MarketIntelligencePage` | **CHASSIS-EQUIVALENT** → CHART (market context) |
| `DealDetailPage` — Strategy screen | `DealDetailPage.tsx:168–170` | `StrategyArbitragePage` | **DYNAMIC-CANDIDATE** — strategy overlay, should be summoned by flag |

### 1.3 Factory Chassis Mapping

| Factory Base Tab | Current Equivalent(s) | Gap |
|---|---|---|
| **CHART** | OverviewTab (KPIs + cash flow table), BloombergOverviewSection (DealDetailPage) | CHART is split across OVERVIEW and Overview sub-panels; no dedicated chart tab |
| **PRO FORMA** | ProjectionsHubTab, CapitalHubTab, ProFormaScreen (DealDetailPage) | Projections + Capital are separate tabs; factory wants one PRO FORMA with dynamic line items |
| **ASSUMPTIONS** | ConsoleHubTab (input surface), ValuationGridTab (valuation inputs) | Console is overloaded with inputs + unit mix + assumptions; ValuationGrid is separate tab |
| **RETURNS** | ReturnsHubTab, OverviewTab (KPIs), DebtCapitalScreen (DealDetailPage) | Returns data is duplicated across Overview, Returns, and DealDetailPage tabs |
| **dynamic** | Custom tabs (Opus), Roadmap (conditional), Sensitivity (always), Validation (always), Scenarios (always), Compare (always) | 6 of 11 built-in tabs are dynamic-candidates that should be summoned, not permanent |

**Current tab count:** 11 built-in + N custom.  
**Factory tab count:** 4 base + N dynamic.  
**Delta:** 7 permanent tabs that should be dynamic-summoned.

---

## E2 · Assumption Storage & Input-Surface Census

### 2.1 Assumption Value Stores

| Store | Location / Table | Schema | Fields | Provenance Support | Verdict |
|---|---|---|---|---|---|
| **deal_financial_models** | `financial-model-engine.service.ts:1540–1544` | `assumptions` (JSONB), `results` (JSONB), `assumptions_hash` | Full `ProFormaAssumptions` + `FinancialModelResult` | **Partial** — `_purchasePriceSource`, `_exitCapSource`, `_marketRentSource` extended fields carry provenance | **DUPLICATE-STORE** — same assumptions also in deal_assumptions |
| **deal_assumptions** | `financial-model-engine.service.ts:1936–1968` | `year1` (JSONB), `rent_growth_yr1`, `exit_cap`, `hold_period_years`, `selling_costs_pct`, `per_year_overrides` | Y1 assumptions + overrides | **Partial** — `year1` JSONB has `agent`/`resolved`/`resolution` fields per assumption | **CANONICAL** — intended as single source, but fragmented |
| **deal_underwriting_scenarios** | `financial-model-engine.service.ts:1974–2017` | `year1` (JSONB), `is_active`, `deleted_at` | Active scenario assumptions | **Partial** — same JSONB shape as deal_assumptions.year1 | **DUPLICATE-STORE** — `deal_assumptions` and `deal_underwriting_scenarios` both hold year1; trigger `trg_sync_underwriting_scenario` syncs them |
| **underwriting_evidence** | `financial-model-engine.service.ts:1471–1519` | `field_path`, `value_numeric`, `primary_tier`, `data_points`, `reasoning`, `alternatives`, `collision`, `confidence` | D-MOD-2/3 evidence entries | **Yes** — full provenance trail | **DELTA-COMPATIBLE** — could become overlay on canonical store |
| **ProFormaPeriodicSeed** | `periodic-seeder.service.ts:48–129` | `fields` (Record<string, PeriodicFieldSeries>), `boundary`, `sourceDocs`, `_meta` | Per-month field series with `resolved`, `resolution`, `source` | **Yes** — `resolution` + `source` per period | **CANONICAL** (for periodic data) — but derived from year1 seed, not primary input |
| **Frontend local state** | `FinancialEnginePage.tsx:579–580` | `assumptions` (ModelAssumptions), `modelResults` (ModelResults) | Full assumptions + results in React state | **No** — local state has no provenance | **LOCAL-STATE-LEAK** — acts as transient storage during editing; persists to backend on save/build |
| **f9Financials** (frontend store) | `FinancialEnginePage.tsx:791–806` | `F9DealFinancials` shape from `/api/v1/deals/:id/financials` | Returns, waterfall, capital, projections, valuation | **Partial** — `valuationSnapshot` has `goingInCapT12` etc. | **DUPLICATE-STORE** — computed from assumptions + results, but held as separate state |

### 2.2 Input Surfaces (where user can edit assumptions)

| Surface | File | Fields | Writes To | Provenance? |
|---|---|---|---|---|
| **ConsoleHubTab** | `financial-engine/ConsoleHubTab.tsx` | Full `ModelAssumptions` (dealInfo, acquisition, revenue, expenses, financing, capex, waterfall) | `onAssumptionsChange` → `FinancialEnginePage` local state → `handleBuildModel` → POST `/build` | **No** — local state edits have no provenance tag until persisted |
| **Goal Seek** | `SensitivityTab` + `handleApplyGoalSeekSolved` | purchase_price, exit_cap_rate, rent_growth, hold_period, ltv, interest_rate | POST `/api/v2/sigma/apply-broader-goal-seek` | **No** — backend applies but no provenance stored in assumption record |
| **Version Save** | `handleSaveVersion` | Full snapshot (assumptions + results) | POST `/api/v1/financial-model/:id/versions` | **Partial** — `source: 'user_save'` |
| **DealDetailPage — Unit Mix** | `UnitMixIntelligence` | max_units, unit mix | `useDealStore.setDevelopmentEnvelope` | **No** |
| **DealDetailPage — Zoning** | `ZoningModuleSection` | development_path, selected_envelope | `useZoningModuleStore` | **No** |

### 2.3 “No Value in Two Places” Verdict

| Store Pair | Violation? | Evidence |
|---|---|---|
| `deal_financial_models.assumptions` ↔ `deal_assumptions.year1` | **Yes** — DUPLICATE-STORE | `financial-model-engine.service.ts:1540` writes to `deal_financial_models`; `Batch4/5-Sync` at `line 1936` writes back to `deal_assumptions` |
| `deal_assumptions` ↔ `deal_underwriting_scenarios` | **Yes** — DUPLICATE-STORE | `line 1974` reads active scenario; `trg_sync_underwriting_scenario` syncs scenario → deal_assumptions |
| Frontend `assumptions` state ↔ Backend `deal_financial_models` | **Yes** — LOCAL-STATE-LEAK | `FinancialEnginePage.tsx:579` holds full assumptions in React state; only persisted on explicit build/save |
| `ProFormaPeriodicSeed` ↔ `deal_assumptions.year1` | **Partial** — DELTA-COMPATIBLE | Periodic seed is derived from year1; not an independent source. Could be overlay. |

### 2.4 Strategy Representation (BTS/Flip/Rental/STR)

**Current state:** No evidence of separate assumption copies for strategies. The `resolvedDealType` at `FinancialEnginePage.tsx:542` maps to `'existing' | 'development' | 'redevelopment' | 'lease_up' | 'ground_up' | 'value_add'`. Strategy overlays (BTS/Flip/Rental/STR) are **not represented as separate assumption sets**. They are either:
- Hardcoded logic in `StrategyArbitragePage` (if it exists — not verified in this audit), or
- Computed variants (e.g., `leaseVelocity` treatment changes returns without changing assumptions), or
- **Not yet implemented** — the `DealType` enum in `dealContext.types` does not include BTS/Flip/Rental/STR.

**Verdict:** Strategy overlays are **future** — no migration, no greenfield yet. The `dealType` field today is structural (`existing` vs `development`), not strategic.

---

## E3 · Module & Conditional-Rendering Reality

### 3.1 Module Registry — What It Actually Controls

`backend/src/services/module-wiring/module-registry.ts` (927 lines) defines `MODULE_REGISTRY: Record<ModuleId, ModuleDefinition>` with 25+ modules (M01–M29).

Each module definition has: `id, name, stage, category, purpose, hasAgent, outputs, feedsInto, receivesFrom, formulas, buildStatus, priority, uiLocation`.

**What it controls today:**
- **Metadata only.** The registry is a typed catalogue of modules, their dependencies, and their build status. It is used for:
  - `evaluatePipeline()` in `financial-model-engine.service.ts:1349` — checks which stages are satisfied
  - `ASSUMPTION_MODULE_MAPPINGS` in `assumption-module-mapping.config.ts:65` — maps 10 assumption fields to authoritative/supporting modules
  - Data-flow routing in `data-flow-router.ts` — defines which module outputs feed which inputs

**What it does NOT control:**
- **No UI rendering.** The `uiLocation` field (e.g., `"F9 Overview Tab"`, `"F9 Capital Hub Tab"`) is a string comment, not a programmatic flag. No component reads `MODULE_REGISTRY` to decide whether to render.
- **No conditional tab rendering.** `FinancialEnginePage.tsx` hardcodes the 11-tab switch; no module buildStatus is checked before rendering a tab.
- **No flag-driven module activation.** The D-MOD pipeline (`evaluatePipeline`, `enforceStageGates`) checks stage completion but does not gate tab rendering.

**Evidence:** `module-registry.ts:83` — `uiLocation: string` is a metadata field, not a render directive. `FinancialEnginePage.tsx:2143–2194` — tab switch is a static `if (activeTab === N)` chain with no registry lookup.

### 3.2 Exhibit-Class Candidates — Existing Footprint vs. Pure Future

| Exhibit Class | Existing Code/Schema? | Evidence |
|---|---|---|
| **Assessment exhibit** | **None** | No component, table, or route named "assessment" or "exhibit" in the codebase. |
| **Cost-to-complete** | **Partial** — `RoadmapTab` (value-add/redevelopment) shows renovation timeline + costs | `RoadmapTab.tsx` — exists, but is a static tab, not a summoned exhibit. |
| **Debt-NPV** | **None** | No dedicated debt-NPV component or route. Debt metrics are in `CapitalHubTab` and `ReturnsHubTab`. |
| **Lender-recovery** | **None** | No lender-recovery or workout analysis component. |
| **ExitCapitalModule** | **Partial** — `ExitCapitalModule` in `DealDetailPage.tsx:77` | Renders exit/debt analysis but is a static tab, not summoned by flag. |

**Verdict:** All exhibit-class candidates are **pure future** except `RoadmapTab` and `ExitCapitalModule`, which exist as static tabs but are not summoned by situation flags.

### 3.3 Situation Flags — Does §3.2 Taxonomy Exist?

**Current state:** No evidence of a §3.2-style situation flag taxonomy in `DealContext` or `dealStore`.

`DealContext` type (from `dealContext.types`) is imported in `DealDetailPage.tsx:54` but its contents were not read in this audit. The `DealType` type in `deal-type-visibility.ts` (imported at `DealDetailPage.tsx:59`) is structural (`existing`, `development`, `redevelopment`, `lease_up`, `ground_up`, `value_add`), not situational.

`FinancialEnginePage.tsx` uses `isRoadmapEligible` (deal-type regex) for conditional rendering, not a situation flag. `DealDetailPage.tsx` uses `isOwnedDeal` (status check) for conditional tab rendering.

**Verdict:** Situation flags are **not yet implemented**. The closest approximation is `isRoadmapEligible` (deal-type regex) and `isOwnedDeal` (status check), which are ad-hoc, not a taxonomy.

---

## E4 · Blast Radius & Migration Shape

### 4.1 Gap-by-Gap Classification

| Gap | Classification | Migration Cost | Sequencing | Risk Note |
|---|---|---|---|---|
| 11 built-in tabs → 4 base | **STRUCTURAL** | **L** | After D2 (deterministic-primary) | Tab consolidation requires frontend refactoring; OverviewTab, ProjectionsHubTab, CapitalHubTab, ReturnsHubTab must merge into 4 base tabs. ConsoleHubTab is the ASSUMPTIONS input surface. |
| 6 dynamic-candidate tabs should be summoned | **CLEAN MIGRATION** | **M** | After D2 + assumption-store consolidation | VALIDATION, VALUATION, SCENARIOS, COMPARE, GOAL SEEK, ROADMAP are already independent components; wiring them to flags is mechanical. |
| Custom tabs (Opus) → dynamic | **CONFORMS** | **S** | None | Already user-summoned via Opus. Factory-compatible. |
| Assumption stores: 3+ → 1 + overlays | **STRUCTURAL** | **L** | Before tab consolidation | `deal_financial_models`, `deal_assumptions`, `deal_underwriting_scenarios` all hold assumptions. Consolidating into one canonical store with overlay tables (evidence, periodic, scenarios) is schema migration. |
| Frontend local state leak | **CLEAN MIGRATION** | **M** | Parallel to store consolidation | `FinancialEnginePage.tsx` local `assumptions` state should be a reference to canonical store, not an independent copy. |
| Module registry → tab rendering | **STRUCTURAL** | **M** | After tab consolidation | `MODULE_REGISTRY.uiLocation` needs to become a programmatic render directive. Components need to read registry + flags. |
| Exhibit-class candidates (4) | **STRUCTURAL** | **L** | After module registry wiring | Greenfield components + flag taxonomy. Depends on §3.2 situation flags existing. |
| Strategy overlays (BTS/Flip/Rental/STR) | **STRUCTURAL** | **L** | After assumption-store consolidation | Requires new `dealType` values or a strategy overlay table. No current representation. |
| Provenance on user inputs | **CLEAN MIGRATION** | **M** | Parallel to store consolidation | ConsoleHubTab edits and goal-seek applies should write provenance to `underwriting_evidence` or assumption overlay. |
| `PeriodicTimelineTrigger` at top-level | **CLEAN MIGRATION** | **S** | None | Already a shared component; should be summoned when periodic data exists. |

### 4.2 Ordering Constraints (Against D2–D6/S-Chain)

1. **D2 (deterministic-primary, monthly resolution)** — No dependency on this audit. Can proceed in parallel. D2's monthly output is consumed by the periodic seed, which is relevant to the PRO FORMA tab but not blocking.
2. **Assumption-store consolidation (P1)** — Must precede tab consolidation (E4.1, gap #3). If tabs merge before stores consolidate, the merged tabs will still read from fragmented stores.
3. **Tab consolidation (P2)** — Must precede module registry → tab rendering (gap #6). The registry needs to point to the new consolidated tabs.
4. **Situation flag taxonomy (P3)** — Must precede exhibit-class candidates (gap #7) and dynamic tab summoning (gap #2). Without flags, nothing can summon dynamic tabs.
5. **Strategy overlay (P4)** — Can follow assumption-store consolidation. No hard dependency on D2–D6.

---

## E5 · Impact Table

| Current Element | Factory Verdict | Gap Class | Migration Cost | Sequencing Constraint | Risk Note |
|---|---|---|---|---|---|
| `OverviewTab` (F9 tab 0) | CHASSIS-EQUIVALENT → RETURNS + CHART | STRUCTURAL | L | After D2 | Merges KPIs (Returns) + cash flow table (Chart) |
| `ConsoleHubTab` (F9 tab 1) | CHASSIS-EQUIVALENT → ASSUMPTIONS | STRUCTURAL | L | After D2 | Becomes the ASSUMPTIONS input surface; unit mix moves to sub-panel |
| `ProjectionsHubTab` (F9 tab 2) | CHASSIS-EQUIVALENT → PRO FORMA | STRUCTURAL | L | After D2 | Institutional rows become PRO FORMA base content |
| `ValidationGridTab` (F9 tab 3) | DYNAMIC-CANDIDATE | CLEAN MIGRATION | M | After P2 (tab consolidation) | Summoned when evidence conflicts exist |
| `CapitalHubTab` (F9 tab 4) | CHASSIS-EQUIVALENT → PRO FORMA | STRUCTURAL | L | After D2 | S&U + debt metrics merge into PRO FORMA |
| `ReturnsHubTab` (F9 tab 5) | CHASSIS-EQUIVALENT → RETURNS | STRUCTURAL | L | After D2 | Waterfall + LP/GP returns merge into RETURNS |
| `ValuationGridTab` (F9 tab 6) | DYNAMIC-CANDIDATE | CLEAN MIGRATION | M | After P2 | Summoned when valuation methods are active |
| `ScenarioManagementTab` (F9 tab 7) | DYNAMIC-CANDIDATE | CLEAN MIGRATION | M | After P2 | Summoned when >1 scenario exists |
| `CompareHubTab` (F9 tab 8) | DYNAMIC-CANDIDATE | CLEAN MIGRATION | M | After P2 | Summoned when comparison is requested |
| `SensitivityTab` (F9 tab 9) | DYNAMIC-CANDIDATE | CLEAN MIGRATION | M | After P2 | Summoned by goal-seek input |
| `RoadmapTab` (F9 tab 10) | DYNAMIC-CANDIDATE | CLEAN MIGRATION | M | After P3 (flags) | Already conditional; should be flag-summoned not deal-type-regex |
| `CustomTabRenderer` (custom tabs) | DYNAMIC-CANDIDATE | CONFORMS | S | None | Already user-summoned via Opus |
| `DealDetailPage` — Pro Forma screen | DUPLICATE | STRUCTURAL | L | After P2 | Embeds full F9; should embed factory chassis instead |
| `DealDetailPage` — Debt & Capital | CHASSIS-EQUIVALENT → RETURNS | STRUCTURAL | M | After P2 | Exit/debt subset should render inside RETURNS tab |
| `deal_financial_models.assumptions` | DUPLICATE-STORE | STRUCTURAL | L | Before P2 | Consolidate into `deal_assumptions` (canonical) |
| `deal_underwriting_scenarios` | DUPLICATE-STORE | STRUCTURAL | L | Before P2 | Scenario table should become overlay on canonical store |
| `underwriting_evidence` | DELTA-COMPATIBLE | CLEAN MIGRATION | M | After P1 | Already has provenance; can become overlay |
| `ProFormaPeriodicSeed` | CANONICAL (periodic) | CLEAN MIGRATION | M | After D2 | Derived from year1; should be overlay or derived view |
| Frontend `assumptions` state | LOCAL-STATE-LEAK | CLEAN MIGRATION | M | After P1 | Should be reactive reference to canonical store |
| `MODULE_REGISTRY` | Metadata only | STRUCTURAL | M | After P2 | Needs to drive tab/item rendering, not just metadata |
| `data-flow-router` | Backend only | CLEAN MIGRATION | M | After P2 | Needs to expose flags to frontend for tab summoning |
| Assessment exhibit | Pure future | STRUCTURAL | L | After P3 | New component + flag |
| Cost-to-complete | Partial (Roadmap) | STRUCTURAL | L | After P3 | Roadmap refactor into summoned exhibit |
| Debt-NPV | None | STRUCTURAL | L | After P3 | New component + flag |
| Lender-recovery | None | STRUCTURAL | L | After P3 | New component + flag |
| Strategy overlays (BTS/Flip/Rental/STR) | None | STRUCTURAL | L | After P1 | New schema + UI |
| Situation flag taxonomy | None | STRUCTURAL | L | Before P2 | Required for all dynamic summoning |
| User input provenance | None | CLEAN MIGRATION | M | After P1 | Wire ConsoleHubTab + goal-seek to evidence table |

---

## STOP

This is a read-only evidence map. No code, schema, or configuration changes were made. Spec ratification and migration dispatches are operator decisions on this evidence.
