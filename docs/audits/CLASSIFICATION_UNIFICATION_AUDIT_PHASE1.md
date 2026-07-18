# DEAL CLASSIFICATION UNIFICATION — PHASE 1 READ-ONLY AUDIT

**Dispatch:** DISPATCH_CLASSIFICATION_UNIFICATION_AUDIT (Phase 1)
**Audited commit:** `471e8ecdd` (`origin/master`, recorded per dispatch first-command rule)
**Date:** 2026-07-18
**Rules honored:** S1-01 (file:line evidence throughout) · read-only · no fixes applied · ends at the STOP gate.

**Execution limitation (T1.3):** the audit environment has no reachable Postgres (`psql` socket unavailable), so the live `SELECT` against the Bishop/Highlands deal rows could not be run. T1.3 is evidenced from migrations, backfills, and golden fixtures instead, and flagged where fixture and migration disagree. The live-row paste remains owed from a DB-connected checkout.

---

## HEADLINE VERDICT

The suspected state is confirmed and worse than fragmented — it is **triplicated with incompatible vocabularies**:

1. **No `ClassificationContext` exists** (repo-wide grep: zero matches). Nothing threads asset_class + deal_type + sub_strategy + chosen_play together.
2. **`resolveProjectType` exists THREE times with TWO different taxonomies** — a 5-value keyword heuristic in the cashflow agent vs a 3-value alias table duplicated in backend dealContext and frontend.
3. **The frontend/dealContext resolvers collapse `lease_up` AND `value_add` into `existing`** — `lease_up` appears in *no* alias set, so lease-up deals are indistinguishable from stabilized acquisitions across the entire frontend `identity.mode` axis.
4. **The 7.3 sub-strategy taxonomy EXISTS as executable code** (`deal-type-detection.service.ts` — core_plus/value_add/deep_value_add/distressed/lease_up/ground_up) but is **runtime-only, never persisted** to `deals`.
5. **The classification key-space is spelled at least five incompatible ways** (`lease_up` / `lease-up` / `LEASE_UP` / `LEASE_UP_NEW_CONSTRUCTION` / absent), so consumers testing one spelling silently no-op on deals tagged with another — the exact "mechanism correct, trigger not wired" bug class the dispatch targets.
6. **Two epoch-rule violations exist** (stored `financial_models.model_type` never re-derived; M08 cache with a single bust site).

---

## T1 — WHERE CLASSIFICATION LIVES

### T1.1 `resolveProjectType` — three implementations, two taxonomies

**(a) Cashflow agent, 5-value keyword heuristic** — `backend/src/agents/cashflow.config.ts:355-392`

```ts
export type CashflowDealType =
  | 'existing' | 'value-add' | 'lease-up' | 'development' | 'redevelopment';  // :355-360

export function resolveProjectType(dealRow: Record<string, unknown>): CashflowDealType {  // :371
  const category = String(dealRow.deal_category ?? '').toLowerCase();
  const raw      = String(dealRow.project_type ?? dealRow.deal_type ?? dealRow.property_type ?? '').toLowerCase();
  const thesis   = String(dealRow.investment_thesis ?? '').toLowerCase();
  const combined = `${raw} ${category} ${thesis}`;
  if (combined.includes('redevelopment') || combined.includes('conversion')) return 'redevelopment';
  if (combined.includes('development') && !combined.includes('re')) return 'development';
  if (combined.includes('value') || combined.includes('rehab') || combined.includes('renovation')) return 'value-add';
  if (combined.includes('lease') || combined.includes('stabiliz') || combined.includes('delivery')) return 'lease-up';
  // pipeline + year_built ≤ 8yr → 'lease-up'   (:385-389)
  return 'existing';
}
```

Inputs: `deal_category`, `project_type ?? deal_type ?? property_type`, `investment_thesis`, `year_built`. Substring matching over concatenated free text — not deterministic on any single column. Fragility observed (not fixed, per STOP): the `!combined.includes('re')` guard means a development deal whose thesis mentions e.g. "retail" or "recently" fails the development branch and can fall through to value-add via "renovation".

**(b) Backend dealContext, 3-value** — `backend/src/types/dealContext.ts:157-165`: `resolveProjectType(raw) → 'existing' | 'development' | 'redevelopment'`, alias tables at `:130-155`; `value-add`/`value_add`/`stabilized` folded into `existing` (`:132`).

**(c) Frontend, 3-value (duplicate of b)** — `frontend/src/shared/utils/project-type.ts:1,30-41`. Verified directly: `EXISTING_ALIASES` contains `value-add`/`value_add`/`stabilized`; **`lease_up`/`lease-up` appear in NO alias set** and fall to the `return 'existing'` default (line 40). Consumed at `frontend/src/stores/dealStore.ts:44,724`.

### T1.2 Sub-strategy (7.3) — exists as code, not persisted

- `backend/src/services/deal-type-detection.service.ts:21-26` — `DealTypeResult { detectedDealType; detectedSubStrategy; confidence; signals }` (M08 v2 Stage 1b).
- Multifamily decision tree emits: `:51` `ground_up_bts`/`mf_bts_ground_up` · `:60` `distressed`/`mf_distressed` (DSCR<1.0 or occ<75%) · `:66` `lease_up`/`mf_lease_up` (occ<90% non-distressed) · `:73` `deep_value_add` (LTL>8% + capgap>$40K/unit) · `:83` `value_add` · `:87-90` core-plus band (LTL 3–8%).
- Canonical key registry: `backend/src/services/debt-advisor/strategy-debt-mapping.json` (`mf_core:5`, `mf_core_plus:24`, `mf_value_add:44`, `mf_deep_value_add:81`, `mf_distressed:98`, `mf_lease_up:115`, `mf_ground_up:132`, plus SFR/retail/office/industrial/hospitality variants).
- Live consumers: `asset-class-detection.service.ts:511,803-815` · `m08-strategies.service.ts:602,803,862-878` · `plan-formulator.service.ts:1333` · `debt-plan-formulator.service.ts:192-238` · frontend `StrategyV2Analysis.tsx:115`, `StrategyDetectionBanner.tsx:50`.
- **Persistence: NONE.** No `sub_strategy`/`detected_sub_strategy` column exists on `deals` in any migration (`backend/src/database/migrations`, `backend/src/db/migrations` searched). `detectedSubStrategy` is computed per-request; only the M08 arbitrage *winner* persists (`strategy_arbitrage.winning_strategy_id`, see T1.5).

### T1.3 Type-ish field census on `deals` (schema-evidenced; live rows not queryable — see limitation)

Note: `backend/src/database/schema.sql` is **0 bytes** and `migrations/002_core_tables.sql` is **0 bytes** — the base `CREATE TABLE deals` is not in the readable migration set; columns below are established via `ALTER TABLE` migrations and INSERT sites.

| Field | Defined | Values | Writers |
|---|---|---|---|
| `deals.deal_type` | `migrations/20260617_deals_deal_type.sql:8-14` | `existing \| value_add \| development \| redevelopment \| lease_up \| stabilized` (canonical, underscore) | `deal-assumptions.routes.ts:1040` (derived from strategy save); backfill `20260618_a2_strategy_deal_type_backfill.sql:12-31`; hotfix `20260402_004_fix_jaguar_deal_type.sql` |
| `deals.project_type` | `deals.service.ts:61,65`; hotfix `20260402_004` | free text (`existing`/`development`/`redevelopment`/aliases) | `DealsService.createDeal` (`deals.service.ts:60-82`); `PATCH /deals/:id` from UI header dropdown |
| `deals.deal_category` | `create-deal.dto.ts:19` | `pipeline`, `portfolio` | `deals.service.ts:77`; `inline-deals.routes.ts:478`; `create_deal_draft.ts:99` |
| `deals.status` | enum `20260715_deal_status_enum.sql:11-22` | `PROSPECT…PASSED` (9 values) | lifecycle transitions + trigger `:71-112`; ⚠ `create_deal_draft.ts:102` still writes legacy free-text `'awaiting_review'`, outside the enum |
| `deals.origin_class` | `20260708_deals_origin_class.sql:6-8` | `platform_underwritten \| owned_import \| archive_import \| NULL` | migration backfill `:21-45`; `inline-deals.routes.ts:478`; `create_deal_draft.ts:102` |
| `deals.strategy` | INSERT at `create_deal_draft.ts:101` | free text — ⚠ value passed is `fields.asset_class` (`:112`): asset class written into a strategy column | `create_deal_draft.ts` |
| `deals.development_type` | `deals.service.ts:63,65` | free text | `deals.service.ts:78` |
| `deals.deal_data` JSONB | `models/deal-capsule-updated.ts:11,376` | `broker_claims.*` incl. `investmentThesis`, `investmentStrategy` | `create_deal_draft.ts:113`; read by `cashflow.config.ts:439-442` |
| `deal_assumptions.investment_strategy_lv` JSONB | `20260508_strategy_fields_lv.sql:21` | `{detected, override, resolved}`; override ∈ `Build-to-Sell \| Flip \| Rental \| Short-Term Rental \| Value-Add \| Redevelopment \| Lease-Up \| Land Hold` | `deal-assumptions.routes.ts:1014-1040` |

Adjacent type-carrying tables: `assumption_snapshots/outcomes.asset_class+deal_type` (`20260420_learning_feedback_loop.sql:22-23,146-147`) · `line_item_benchmarks.deal_type` (`20260420:19` — hyphen spellings `value-add|lease-up`) · `archive_deals.deal_type` (`20260427:8`) · `subject_traffic_history.deal_mode` (M07).

**Bishop / Highlands references found in repo:**
- `migrations/20260708_deals_origin_class.sql:21-27` — `3f32276f-…` (464 Bishop) → `origin_class='archive_import'`; `eaabeb9f-…` (Highlands) → `origin_class='owned_import'`.
- Golden fixtures: `backend/src/services/deterministic/__fixtures__/bishop.golden.ts:150` `originClass: 'on_platform_underwrite'` — ⚠ **contradicts the migration's `archive_import` AND is not a valid enum value**; `:222-223` `dealType: 'existing'`, `dealMode: 'lease_up'`. `highlands.golden.ts:166` `originClass: 'owned_import'` (consistent); no dealType/dealMode keys present.
- **Distinct "type-ish" axes counted: SEVEN** on/around `deals` (`deal_type`, `project_type`, `deal_category`, `origin_class`, `status`, `strategy`, `development_type`) plus `deal_data.broker_claims.investmentStrategy` and `deal_assumptions.investment_strategy_lv`. Import source ≠ deal_type ≠ sub_strategy confirmed as three separate axes: `origin_class` / `deal_type` / (unpersisted) `detectedSubStrategy`.

### T1.4 Unified ClassificationContext — **ABSENT**

Repo-wide grep `ClassificationContext|classificationContext`: zero matches. Existing `*Classification*` types are all domain-local and unrelated: email-lead intake (`classify_as_deal_opportunity.ts:25`), document typing (`document-extraction/types.ts:24`), email routing (`email-classification.service.ts:16-18`), market cycle (`m28.types.ts:306,324`), DQ (`data-quality-agent.service.ts:30`).

### T1.5 `chosen_play` — **ABSENT as a field**; the concept exists in two disconnected layers

- Grep `chosen_play|chosenPlay` repo-wide: zero matches.
- **Operator layer:** `deal_assumptions.investment_strategy_lv.override` — valid plays at `deal-assumptions.routes.ts:969` (`Build-to-Sell/Flip/Land Hold/Lease-Up/Redevelopment/Rental/Short-Term Rental/Value-Add`); mapped to `deals.deal_type` via `investmentStrategyToDealType()` `:948-956` then `UPDATE deals SET deal_type` `:1040`.
- **Algorithmic layer:** `backend/src/db/migrations/139_m08_strategy_arbitrage.sql` — `strategies` seeds BTS(`:55`)/Flip(`:65`)/Rental(`:75`)/STR(`:85`) with `signal_weights` + `property_gates`; winner persists as `strategy_arbitrage.winning_strategy_id` (`:36`).
- Nothing reconciles the two: an operator `Flip` override and an M08 `winning_strategy_id=Rental` can coexist with no arbiter.

---

## T2 — CONSUMER CENSUS

| # | Consumer | Selection point (file:line) | Keyed on | Verdict |
|---|---|---|---|---|
| 1 | **M09 ProForma variant** | `proforma-adjustment.service.ts:3323-3326` → `pickTemplateForStrategy` / `defaultTemplateForDealType` (`proforma/blueprint/index.ts:30,48`) | `investment_strategy_lv.resolved` → fallback `deals.deal_type` | Quasi-shared. 7 templates in `proforma-blueprint.ts:135` (`acquisition_stabilized`, `acquisition_value_add`, `development_ground_up`, `redevelopment`, `flip`, `str_shortterm`, `land_hold`). ⚠ **No lease-up template** — `index.ts:56-57` verified: `case 'lease_up': … return 'acquisition_stabilized'  // Phase 1 approximation`. F9 seeder (`proforma-seeder.service.ts`) has no variant branching. |
| 2 | **Lease Velocity mode** | `lease-velocity-engine.ts:38-49` (`resMode`) | occupancy + building age + capex flag from DealContext, or explicit `inputs.mode` override | **NOT keyed on classification.** Modes present (`lease-velocity-types.ts:6-10`): `LEASE_UP_NEW_CONSTRUCTION`, `STABILIZED_MAINTENANCE`, `OCCUPANCY_RECOVERY`, `V2_PENDING_VALUE_ADD`. ⚠ **`REDEVELOPMENT_ACTIVE` ABSENT** (verified: zero grep hits backend-wide); the 4th declared mode `V2_PENDING_VALUE_ADD` is **never returned** by `resMode` — unreachable. Demo route hardcodes modes per scenario name (`lease-velocity.routes.ts:85-127`). |
| 3 | **Cashflow agent variant** | `cashflow.config.ts:453-471` (`buildCompositePrompt`) — DB lookup on `prompt_versions.prompt_type = 'variant:<type>'` | its own `resolveProjectType` keyword heuristic (T1.1a) | All 5 variant files exist (`agents/prompts/cashflow/variants/{existing,value-add,lease-up,development,redevelopment}.ts`) and are seeded (`cashflow.seed.ts:17-21,42-69`). Local heuristic, disjoint from M09's resolver — same deal can load a `lease-up` cashflow prompt while getting an `acquisition_stabilized` proforma template. |
| 4 | **M11 Debt ruleset** | (a) `debt-plan-formulator.service.ts:192-265` (`detectSubStrategy`) → `strategy-debt-mapping.json`; (b) `rulesets/loan-product.ruleset.ts:82-106` | (a) M08 strategy slug + keyword fallback; (b) user-supplied `lenderType` only (no lenderType → agency, `:85-89`) | Split-brain. IO-from-lease-up is a data attribute of the mapping (`strategy-debt-mapping.json:115-131` — `mf_lease_up: ioMonths 36`, bridge_earnout, `earnoutMilestoneOcc: 0.90`), consumed at `debt-plan-formulator.service.ts:31-38`; no runtime classification gate. |
| 5 | **Traffic / demand lens** | `trafficToProFormaService.ts:410-415,739`; `traffic-module-wiring.ts:395,464` | data availability (`lease_up_weeks_to_95` null ⇒ stabilized) | **ABSENT** — no deal-type lens. Zero `deal_type|projectType` hits in traffic services. |
| 6 | **JEDI weighting** | `jedi-score.service.ts:92-99` | nothing — `WEIGHTS = {demand:.30, supply:.25, momentum:.20, position:.15, risk:.10}` global constants, applied identically at `:123-127` | **ABSENT** — no per-type weighting or framing. |
| 7 | **Strategy arbitrage engine** | `module-wiring/strategy-arbitrage-engine.ts:164-168` | nothing — loops ALL of `STRATEGY_WEIGHTS` (`:78-107`: build_to_sell/flip/rental/str) unconditionally; arbitrage flagged on top-two gap > 15 (`:171-179`) | No context scoping — it *produces* a classification, consumes none. No asset-class or deal-type gating of applicable plays. |
| 8 | **Opportunity engine (universe)** | `opportunity-engine.service.ts:199,219-256` (`determineStrategy`) | its own dimension-score heuristic | Assigns its own 4-label vocabulary (`renovate/rebrand/reposition/acquire`, `:13`) matching **no other module's buckets**. No two-axis distress quadrant (oracle × Triple Trigger). Route (`opportunity-engine.routes.ts`) neither passes nor persists shared classification. |

---

## T3 — HARDCODE HUNT

### T3.1 Scattered classification conditionals (consolidation candidates)

Full sweep, grouped by module. Format: `file:line | condition | decision gated`.

**Deterministic engine** (`backend/src/services/deterministic/`):
- `deterministic-model-runner.ts:848` | `dealMode==='lease_up' && isY1 && monthsToStabilize>0` | monthly vacancy linear ramp vs flat
- `deterministic-model-runner.ts:1731,1811,1911` | `dealType==='development'||'ground_up'` | INV-10 skip / SOFT-10 suppression / entire Phase-5 dev annual path
- `deterministic-model-runner.ts:1967` | `phaseY<=devLeaseUpYears` | `vacForYear` ramp-average vs `vacancyStab` (Finding AA interim, live)
- `run-full-model.ts:115` | `dealMode==='lease_up' && monthsToStabilize==null` | Finding-Z derivation for B5 IO sizing
- `proforma-assumptions-bridge.ts:257-258,507` | `monthsToStabilize>0` | lease-up profile injection

**Proforma adjustment/projection:**
- `proforma-adjustment.service.ts:2182` | `_slug==='value_add' ? 'renewal_aware' : 'mark_to_market'` | rent-reversion methodology
- `proforma-adjustment.service.ts:4581-4611` | `_isProjDev/_isProjLeaseUp/_needsRamp` (from normalized `deal_type`) | annual occupancy: construction-zero vs absorption vs linear ramp vs full
- `proforma/blueprint/index.ts:51` | `switch(dealType)` | template default
- `proforma/layered-growth/position-adjustment.ts:135,184` | `switch(spec.mode)` | growth position adjustment

**Financial model / capital structure:**
- `financial-model-engine.service.ts:1139` | `b6DealMode==='lease_up'||'development'||'ground_up'` | conflates 3 classes into one ramp branch
- `financial-model-engine.service.ts:1555` | `!dealMode && modelType!=='development'` | fallback assumption injection
- `module-wiring/capital-structure-adapter.ts:573-580` | `dealMode==='lease_up' && monthsToStabilize>0` | IO period from lease-up profile vs LTV tier
- `module-wiring/m07-projections-adapter.ts:383-431,482-483,496-552,641-777,788` | `mode==='STABILIZED'|'LEASE_UP'|'REDEVELOPMENT'` | per-mode occupancy curves (uppercase key space)
- `module-wiring/formula-engine.ts:658` | `switch(strategy)` | formula selection

**State/lifecycle resolvers:**
- `starting-state.service.ts:76,84` | `explicitMode==='LEASE_UP'` / `'STABILIZED' || (hasRentRoll && occ>=0.80)` | starting-state mode
- `stabilized-year-resolver.service.ts:223,249,388,400,424` | `projectType/modelType==='development'(±'redevelopment')` | stabilization-year path, pre-delivery, absorption basis, month floor
- `concession-environment-engine.ts:864` | `projectType==='development' → 'LEASE_UP'` | **local mode re-classification** (also `:258,406,489` mode branches)
- `lease-velocity-engine.ts:83,288,351` | `mode==='LEASE_UP_NEW_CONSTRUCTION'` / `switch(mode)` | velocity branch (third key spelling)

**Strategy/exit/misc services:**
- `exit-strategy.service.ts:193-195` | `dealMode==='development'||'ground_up'||…` | exit path
- `f9-financial-export.service.ts:67,86,243,295` | `dealMode==='value_add'/'lease_up'`; `==='value_add' ? 2 : 0` | export sections + stabilization offset
- `m08-strategies.service.ts:303,376` | `project_type==='development'` | BTS/assemblage eligibility
- `deals.service.ts:990-992,1012` | `development_type==='value-add'||'opportunistic'`; `strategyType==='value-add' ? 85 : 45` | strategy mapping + **hardcoded projected ROI**
- `lius/source-resolver.ts:415-416` | `dealType==='acquisition'/'development'` | evidence-line source
- `loan-quotes/pricing-resolver.ts:264`, `plan-formulator.service.ts:1335`, `development-capacity.service.ts:222`, `valuation/comp-story.service.ts:362`, `agents/deal-structuring.service.ts:348` | `switch(strategy/subStrategy/returnProfile)` | pricing / plan / capacity / narrative / structuring

**Agents:**
- `cashflow.postprocess.ts:1100-1102` | `dealTypeForSynthesis==='value_add'||'value-add'` | **dual spelling inside one condition**
- `cashflow.postprocess.ts:2090` | value-add signal + unit-mix keys | unit-mix synthesis
- `tools/write_underwriting.ts:127` | `projectType==='lease-up'` | hyphen spelling — never matches the canonical underscore `lease_up`

**Backend routes:**
- `deal-context.routes.ts:67-69` | `project_type==='development' ? … : 'existing'` | **collapses lease_up/value_add → 'existing'** in the mode surfaced to the frontend
- `financial-dashboard.routes.ts:261`, `inline-deals.routes.ts:519,2438`, `stabilized-potential.routes.ts:245,512`, `unit-mix-propagation.routes.ts:168`, `deal-context.routes.ts:529,531` | same 3-way (or 2-way) collapse patterns | modelType / persist / unit-mix / Current-column source

**Frontend store/shared:**
- `stores/dealStore.ts:530,533,1662,1665,1956` | `identity.mode==='development'/'redevelopment'` | unit-mix source, `isDevelopment` selector
- `shared/utils/project-type.ts:47-64` | type helpers | tab gating helpers
- `shared/calculations/returns.ts:58-60` | `dealType==='development' ? 2800000 : 3420000` | **hardcoded two-way baseNOI/basis/equity**
- `shared/config/deal-type-visibility.ts:19` | `DealType = 'existing'|'development'|'redevelopment'` | canonical tab-visibility axis has **no lease_up/value_add dimension**

**Frontend pages/components** (spelling census in bold):
- `DealDetailPage.tsx:885,969-970` | badge color/labels
- `FinancialEnginePage.tsx:1149` | `'development' : 'existing'` collapse passed to engine
- `ProFormaTab.tsx:158,735,783-795,1100,1133,1439,1449` | dev-cost vs acquisition sections
- `UnitMixTab.tsx:1929-1932,3176,3275` | `'value-add'` hyphen; `:3176` hardcodes **both** `'lease-up' || 'lease_up'`
- `RenovationAssumptionsSection.tsx:120-121` | `'value_add'` **underscore — differs from UnitMixTab's hyphen**
- `AssumptionsTab.tsx:3554,3638,3683`, `LeasingAssumptionsTab.tsx:655-665`, `M07IntelPanel.tsx:189,837`, `leasing-fields.config.ts:841` | `'STABILIZED'/'VALUE_ADD'/'DEVELOPMENT'` **uppercase key space**
- `OverviewSection.tsx:92,98` | `'Ground-Up'/'Redevelopment'` **Title-Case key space**
- `ExitCapitalModule.tsx:1197` | `dealType==='development' ? 52000000 : 46420000` | **hardcoded total-basis fallback**
- `CompsModule.tsx:279,328,347,677-680`, `TrafficPredictionsTab.tsx:312-409`, `OverviewRouter.tsx:536`, `MarketIntelligencePage.tsx:172,396-397,564,784,805-807`, `F9/StabilizedPotentialView.tsx:121`, `utils/interpretation.utils.ts:176`, `MapPage.tsx:198` | mode/strategy switches

**Key-space fragmentation summary — the same concept is spelled ≥5 incompatible ways:** `lease_up` (deterministic engine) · `lease-up` (`write_underwriting.ts:127`) · `LEASE_UP` (starting-state/m07-adapter/concession) · `LEASE_UP_NEW_CONSTRUCTION` (lease-velocity) · absent entirely (`resolveProjectType` 3-value). Same for `value_add` / `value-add` / `VALUE_ADD` / `Value-Add`. Any consumer testing one spelling silently no-ops on another.

### T3.2 Single-type assumptions

1. **`inferModelType` is a stub that THROWS** — `model-type-inference.service.ts:1-3` (verified: `throw new Error('Model type inference service not yet implemented')`), called at `financial-models.routes.ts:329,511`. The compute path throws unless `modelTypeOverride` is supplied.
2. **Read path silently defaults to acquisition** — `financial-models.routes.ts:634`: `model.model_type || 'acquisition'`.
3. **Frontend + `deal-context.routes.ts:67-69` collapse `lease_up`/`value_add` → `existing`** (T1.1c) — so the backend's `dealMode==='lease_up'` ramp mechanics have no frontend-visible counterpart.
4. **Finding-AA residual state:** the dev linear-ramp interim is live at `deterministic-model-runner.ts:1955-1969` (`vacForYear` = ramp year-average) and `:855-856` (monthly). ⚠ **Trigger mismatch:** the Phase-5 dev branch gates on `dealType` (`:1911`) while the monthly ramp gates on `dealMode` (`:848`) — two different fields; a lease-up-on-existing deal gets the monthly ramp but not the annual dev path, and the monthly builder for dev deals "uses acquisition-model vacancy logic … no knowledge of the dev construction phase" (documented in-code at `:1725-1730`, INV-10 skipped instead at `:1738`).
5. **`?? 12` monthsToStabilize placeholders, all live:** `deterministic-model-runner.ts:1733,1913` · `run-full-model.ts:129` (with WARN) · `m07-projections-adapter.ts:466,580,723` · `financial-model-engine.service.ts:1155-1157` · `stabilized-year-resolver.service.ts:412`.
6. **Hardcoded financial constants keyed on a binary dev/existing split:** `shared/calculations/returns.ts:58-60`, `ExitCapitalModule.tsx:1197`, `deals.service.ts:1012` (ROI `85 : 45`).

### T3.3 Epoch-rule violators (cached type-dependent decisions)

| # | Cache | Evidence | Epoch verdict |
|---|---|---|---|
| 1 | `financial_models.model_type` persisted column | written `financial-models.routes.ts:372,393,405`; read `:634` with `\|\| 'acquisition'` default; only re-derivation source (`inferModelType`) throws | **VIOLATION** — survives reclassification indefinitely |
| 2 | M08 `analysisCache` | `m08-strategies.service.ts:170-175` (15-min TTL Map); bust wired at ONE site only (`deal-context.routes.ts:313-314`) | **MEDIUM RISK** — reclassification via any other path serves stale classification-derived analysis up to 15 min |
| 3 | `subject_traffic_history.deal_mode` stored | mode-mismatch rejection guard present (consumed `concession-environment-engine.ts:272,284,489`; resolver degrades to PLATFORM) | Compliant, guard-dependent |
| 4 | Frontend `dealStore` | no `persist(`/`createJSONStorage`/`partialize` in `dealStore.ts` (verified zero matches); `identity.mode` re-derived per hydrate (`:723-733`) | Clean |

---

## T4 — UI CENSUS

**Three parallel classification signals feed different UI surfaces** — the central UI finding:
1. `project_type` → `getDealType()`/`resolveProjectType()` 3-value → tab visibility, F-keys, header badge.
2. `deals.deal_type` (6-value) → F9 Pattern-B routing fallback.
3. `investment_strategy_lv` + derived `proformaTemplateId` (7 templates) → F9 template-aware rendering.

| Surface | Evidence | Reads | Note |
|---|---|---|---|
| Deal header badge + dropdown | `DealDetailPage.tsx:963-977` (badge), `:349` (`DealTypeBadge` dropdown), `:524` (`handleDealTypeChange` → `PATCH /deals/:id {project_type}`) | shared `useDealType()` (`dealStore.ts:1960`) — 3-value | classification badge EXISTS but only at 3-value grain; no sub-strategy |
| F-key screens (F1–F11) | `DealDetailPage.tsx:851-866` — 12 screens filtered by `config.isModuleVisible` from `getDealTypeConfig({projectType, assetUseType})` | shared 3-value classification | F5 STRATEGY + F6 TRAFFIC exist; classification-driven visibility works, but only on the 3-value axis |
| F5 Strategy (M08) | `StrategyArbitragePage.tsx:41`; `StrategyV2Analysis.tsx` 4-cell summary (`:167`) + `SubStrategyComparison` dynamic N-column (`StrategySubStrategyComparison.tsx:6,28`); detection gate `requiresUserConfirmation && !userConfirmed` | shared M08 v2 analysis (`useStrategyAnalysisV2` → `GET /deals/:id/strategies`) | the "4-column" view is data-driven N-column; DEPTH ORDER (CLASSIFIER→ARBITRAGE→COURSE) partially present — CLASSIFIER banner + ARBITRAGE exist, COURSE (State 2) absent |
| Legacy `DealStrategy.tsx` | `components/deal/DealStrategy.tsx:10,37` | `/analysis/latest` output only | NOT the strategy view; reads no classification |
| Property/terminal cards | `BloombergPropertyCard.tsx:9` — `strategyScore?` numeric only | — | **classification badge ABSENT on cards** (target-map M01 card cell) |
| Agent CRM DealCard | `agent/deals/DealCard.tsx:11,64-70` | `deal.dealType` = brokerage side (`buyer/seller/…`) | unrelated taxonomy sharing the name `dealType` |
| Proforma variant rendering | `ProFormaSummaryTab.tsx:1141-1176` (templateId → effective dealType switch; flip/land_hold OPEX filtering), `:2102,2259,2539` `isPatternB(field, dealType)`; `F9/StabilizedPotentialView.tsx:20`; `RenovationAssumptionsSection.tsx:120` | mix of `proformaTemplateId`, raw `deal_type`, `dealType` prop | variant scaffolding rich; ⚠ `regimeDataByField` never populated by backend (`docs/operations/STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md:369`) — bridge view renders placeholder dashes |
| User overrides (THREE, unsynced) | (1) header dropdown → `deals.project_type`; (2) `DealTermsTab.tsx:1177-1188` → `PATCH /assumptions/strategy` → `investment_strategy_lv` (+`deals.deal_type` via route `:1040`); (3) M08 `DetectionBanner` confirm/override/adjust → `PATCH /deals/:id/detection-confirmation` (`dealStore.ts:652,660-677`) | three different write targets | no single seam; the three selectors can disagree; #2's Task #1265 comment (`DealTermsTab.tsx:103`) claims it is "canonical" — uncodified |
| Chassis 5-tab (CHART·DEMAND·PRO FORMA·ASSUMPTIONS·RETURNS) | pieces exist separately (`terminal/tabs/DemandTab.tsx`, F9 `AssumptionsTab/ReturnsTab/ProFormaSummaryTab/ProjectionsTab`) | terminal tabs: market data, not classification | **ABSENT as a unified classification-keyed strip**; `getDealNav()` (`deal-type-visibility.ts:598`) exists but `DealDetailPage` uses its own hardcoded list instead |

---

## T5 — THE GAP TABLE

One row per target-map cell. Gap classes: **missing** · **hardcoded-local** · **wired-but-wrong-key** · **OK**.

| Module | Target behavior | Actual (file:line or ABSENT) | Gap class |
|---|---|---|---|
| **Root: ClassificationContext** | one object: asset_class + deal_type + sub_strategy + chosen_play + provenance + confidence, derived once | ABSENT (zero grep matches); 3× `resolveProjectType` (2 taxonomies) + runtime-only `deal-type-detection.service.ts` | **missing** |
| Root: 7.1 asset_class | field in context | `asset-class-detection.service.ts` runtime detection; `deals.strategy` receives asset_class by bug (`create_deal_draft.ts:101,112`) | hardcoded-local |
| Root: 7.2 deal_type | canonical, derived-not-stored | `deals.deal_type` (6-val) + `deals.project_type` (free text) + 3 resolvers; frontend/context resolvers collapse `lease_up`,`value_add`→`existing` (`project-type.ts:3-41`, `deal-context.routes.ts:67-69`) | wired-but-wrong-key |
| Root: 7.3 sub_strategy | 6-value, oracle-scored | EXISTS as code (`deal-type-detection.service.ts:51-90`) but runtime-only, never persisted, disconnected from `deals.deal_type` | hardcoded-local |
| Root: chosen_play (M08) | `bts/flip/rental/str/null` until arbitrage accepted | ABSENT as field; split: `investment_strategy_lv.override` vs `strategy_arbitrage.winning_strategy_id` (139_m08:36), unreconciled | wired-but-wrong-key |
| Root: provenance (D3) | LayeredValue, user override wins | `investment_strategy_lv {detected, override, resolved}` (`20260508:21`) — pattern present for strategy only; deal_type/project_type have no provenance | OK (partial — strategy axis only) |
| Root: epoch rule | reclassification re-derives all consumers | `financial_models.model_type` never re-derived (routes `:372,634`; `inferModelType` throws); M08 cache single bust site (`m08-strategies:170`, `deal-context.routes:313`) | wired-but-wrong-key (2 violators) |
| **M01 card/header UI** | classification badge on header + cards | header badge OK at 3-value grain (`DealDetailPage.tsx:963`); property cards ABSENT (`BloombergPropertyCard.tsx:9` score only) | missing (cards) / OK-partial (header) |
| **M25 JEDI** INFO+MATH | sub_strategy + deal_type; per-type bridge framing + weights | `jedi-score.service.ts:92-99` global constant weights, no classification read | **missing** |
| **M08 Strategy (F5)** | context scopes APPLICABLE plays; CLASSIFIER→ARBITRAGE→COURSE | scores all 4 unconditionally (`strategy-arbitrage-engine.ts:164`); UI has CLASSIFIER banner + ARBITRAGE (`StrategyArbitragePage.tsx`); COURSE (State 2) ABSENT | hardcoded-local (no scoping); missing (COURSE) |
| **M09 ProForma** INFO+MATH | deal_type+sub_strategy select variant; per-variant Current-column source, Δ-set, stabilization trigger | 7 templates keyed on `investment_strategy_lv`→`deal_type` (`proforma-adjustment:3323`); no lease_up template (`blueprint/index.ts:56-57`); Current-column $0-for-dev wired (`stabilized-potential.routes.ts:245,512`) | wired-but-wrong-key (dual resolvers vs cashflow); missing (lease-up variant) |
| **M09 UI** | bridge view vs single-column vs no-Current vs reduced-capacity | template-aware rendering exists (`ProFormaSummaryTab.tsx:1141-1176`); bridge/regime data never populated (investigation doc `:369`) | OK-partial (scaffold live, data missing) |
| **Lease Velocity** | mode from deal_type+sub_strategy; 4 modes | keyed on occupancy/age/capex (`lease-velocity-engine.ts:38-49`), not classification; `REDEVELOPMENT_ACTIVE` ABSENT; `V2_PENDING_VALUE_ADD` unreachable | hardcoded-local + missing (4th mode) |
| **Demand Oracle / DemandContext** | sub_strategy selects lens (race/fill/infer) | no deal-type lens in traffic services (`trafficToProFormaService.ts:410-415` — data-availability switch); DemandContext ABSENT | **missing** |
| **M11 Debt** | ruleset applicability from classification; IO only when lease-up; sizing NOI basis per type | dual system: M08-slug-driven `debt-plan-formulator:192` (connected) vs user-only `loan-product.ruleset.ts:82` (not); IO is mapping data (`strategy-debt-mapping.json:115-131`), no classification gate | wired-but-wrong-key (split-brain) |
| **Cashflow Agent** | context selects variant prompt | 5 variants exist+seeded (`cashflow.seed.ts:42-69`); keyed on own keyword heuristic (`cashflow.config.ts:371-392`) disjoint from M09's resolver | wired-but-wrong-key |
| **S1/M14 Risk** | risk-weight profile per classification | no classification-keyed risk profile found in sweep (searches: risk services in T2/T3 greps) | **missing** |
| **CI / Opportunity engine** | classifies the UNIVERSE; two-axis distress = quadrant × Triple Trigger | own 4-label heuristic (`opportunity-engine.service.ts:219-256`), vocabulary matches nothing else; no quadrant × Triple-Trigger intersection | hardcoded-local |
| **Chassis (F-P2)** | summoned tabs per classification; ribbon zones; 5-tab core | F-key visibility works at 3-value grain (`DealDetailPage.tsx:866` + `deal-type-visibility.ts`); FLIP·S / NOTE-PURCHASE·S summons ABSENT; unified 5-tab chassis ABSENT (pieces scattered) | OK-partial (visibility) / missing (summons, chassis) |
| **Turn cohorts / concessions** | posture priors per sub_strategy | `concession-environment-engine.ts:864` locally re-classifies (`projectType==='development'→'LEASE_UP'`) | hardcoded-local |

---

## CROSS-CUTTING FINDINGS (each backed by rows above)

1. **Five-way key-space fragmentation** is the single largest defect class — it converts every future classification-dependent feature into a probable silent no-op (`write_underwriting.ts:127` `'lease-up'` already never matches canonical `lease_up`).
2. **The lease_up erasure**: frontend + deal-context route collapse lease_up→existing, so the platform's most classification-sensitive deal state (the absorption engine's core case) is invisible to the UI mode axis, the tab-visibility config, and every frontend consumer.
3. **Dual-resolver drift is live**: M09 (strategy-LV → template) and Cashflow (keyword heuristic → prompt variant) can classify the same deal differently today — apparent inconsistency between proforma output and agent commentary is structurally possible (P9.A failure shape).
4. **The trigger-mismatch instance of the dispatch's named bug class**: monthly ramp gates on `dealMode`, annual dev path gates on `dealType` (`deterministic-model-runner.ts:848` vs `:1911`) — mechanism correct, triggers on different fields.
5. **Fixture/migration contradiction**: Bishop golden fixture `originClass: 'on_platform_underwrite'` (`bishop.golden.ts:150`) vs migration `archive_import` (`20260708:21-27`) — and the fixture value isn't in the enum.

## RULINGS NEEDED FROM LEON (Phase 2 sequencing input — no work started)

1. Which write target is canonical for the classification root: `deals.deal_type` (A2 wire), `investment_strategy_lv` (Task #1265 claims canonical), or a new `ClassificationContext`?
2. Canonical spelling ruling (underscore lowercase assumed; confirm) + whether the 3-value frontend axis expands to carry sub_strategy or reads a separate field.
3. Epoch mechanics: is `financial_models.model_type` reclassification-invalidated, or dropped in favor of derive-at-read?
4. Whether M08 `winning_strategy_id` and `investment_strategy_lv.override` reconcile through one seam (D3 pattern: algorithm proposes, user override wins).
5. Lease Velocity: does mode derive from classification (target map) or stay occupancy-derived with classification as prior? (Current occupancy-derivation is arguably *more* honest than the target map — flagging, not deciding.)

---

**STOP.** Phase 1 ends here per the hard gate. Nothing was created, consolidated, or fixed. Phase 2 awaits per-gap dispatches.
