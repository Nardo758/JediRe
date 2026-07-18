# DUAL DATA-SOURCE UNIFICATION — PHASE 1 READ-ONLY AUDIT

**Dispatch:** DISPATCH_DATA_SOURCE_UNIFICATION_AUDIT (Phase 1) — companion to the classification audit.
**Audited code:** `471e8ecdd` (`origin/master`). Working-tree HEAD read by agents was `d067d63da`; `git diff --stat 471e8ecdd d067d63da` = one file (`CLASSIFICATION_UNIFICATION_AUDIT_PHASE1.md`, the companion doc). All `file:line` below are byte-identical to `471e8ecdd`.
**Date:** 2026-07-18
**Rules honored:** S1-01 (file:line evidence) · read-only · no fixes applied · ends at STOP. Load-bearing privacy claims spot-verified against source before inclusion.

**Execution limitation:** no reachable Postgres (`psql` socket down), so live-row and view-definition checks could not run. This blocks one finding materially: `v_comp_search`'s DDL is absent from the repo, so whether it firewalls cross-org T12 columns is **unverifiable statically** and is flagged as such, not concluded.

---

## ⚠️ SEVERITY-0 — PRIVACY LEAKS FOUND (surfaced ahead of the gap table; NOT fixed per the hard gate)

The audit's read-only scope forbids fixes, but three of these are live cross-org data-boundary violations, not provenance gaps. They should not wait for Phase 2 sequencing — flagging for an out-of-band ruling.

| # | Leak | Evidence (verified) | Boundary broken |
|---|---|---|---|
| L1 | `GET /portfolio/metrics` aggregates portfolio NOI / occupancy / unit totals across **every org** | `portfolio.routes.ts:22-40` — `requireAuth` only; query `FROM deal_monthly_actuals dma … WHERE dma.is_portfolio_asset = TRUE` with **no org_id / user_id / created_by filter** (verified verbatim) | Rule 4 (S2 never crosses org) |
| L2 | Bulk owned-actuals upload writes to **any** `:propertyId` with no ownership check | `data-upload.routes.ts:71` (`POST /:propertyId/actuals/upload`) — `userId = req.user?.userId \|\| 'system'`, no property/org assertion before `insertActuals` (verified) | Rule 4 (S2 write authorization) |
| L3 | CoStar (S4) commit/delete under any `:dealId`, no deal-org scoping (IDOR) | `costar-upload.routes.ts:114,147,240` — `requireAuth` only, **no `assertDealOrgAccess`** (verified) | S4 firewall (write/delete side) |
| L4 | Manual owned-actuals scoped by `properties.created_by` (user, not org); `created_by IS NULL` rows globally read/writable | `portfolio.routes.ts:295-344,125,251` | Rule 4 (org-scope, not user-scope) |
| L5 | **UNVERIFIABLE / LEAK-RISK:** universe comp surface serves deal-derived T12 columns keyed on public `property_id` | `compQueryEngine.ts:36,99,134-140,205-206`; `comp-query.routes.ts:12,21,30,42` unauthenticated; the join `JOIN properties p ON p.id = cs.property_id` has no deal/org predicate; **`v_comp_search` DDL absent from repo** (verified: zero `CREATE … VIEW v_comp_search` hits) | Rule 4 + the B4b shared-key rule — must be checked against live DB |

L1–L3 verified directly against source this session. L5 cannot be resolved without the live view definition — it is the single most important open item and gates a real integrity question.

---

## HEADLINE VERDICT

The "where did this number come from" axis is **wired only where someone remembered** — exactly the suspected state:

1. **No source-class stamp exists at ENTRY or STORE.** The S1–S5 taxonomy is materialized only at RESOLVE (proforma-seeder), inferred from which JSONB key/table a value already landed in (`layered-value.ts:8-13,19-52`). Provenance is *reconstructed downstream*, not *born at entry*.
2. **≥4 incompatible `LayeredValue<T>` definitions** coexist (`dealContext.ts:50`, `layered-value.ts:56`, `document-extraction/types.ts:545`, `m08-strategies.service.ts:30`, + a route-local re-declaration + a frontend variant), plus a non-attributed `AssumptionValue` (`proforma-adjustment.service.ts:54-59`). Three disjoint source-tag enums.
3. **The bug class is systemic**, not incidental: dozens of `?? 0.0x` / `|| 0.0x` silent defaults on cap rate, vacancy, growth, LTV, interest, occupancy across engine + routes + frontend recompute. All three named prior instances confirmed live.
4. **Fabrication-as-badge**: the stabilized-potential route's `dominantSource` chips are hand-labeled decoration over hardcoded coefficients (`stabilized-potential.routes.ts:296-432`) — provenance theater.
5. **Provenance under-renders**: `platform`/`computed` values are silently badge-less by design (`primitives/SourceBadge.tsx:99-101`); proforma line items, debt terms, the Demand tab, and the classification banner carry consequential values with no source chip.
6. **The `{detected,override,resolved}` D3 pattern is confined to two strategy axes** and is not generalized to any financial/market field.

Positives worth recording: broker-claim handling is architecturally **collision-first** (segregated `.broker`/`.t12` columns + DQA — clean); M11's loan-term defaults are the **correct labeled-`platform_default`** pattern; archive/flywheel aggregation serves **coefficients not records** (safe); the `inPlaceNOI` computation is the reference implementation of honest-absence.

---

## T1-A — INGESTION TOPOLOGY (write side)

**Core finding: no source-class stamp at ENTRY or STORE.** At write time the only discriminators are (a) which `deal_data.*` key/table the parser routes to, (b) a coarse `source:'platform'` / `source_type:'extraction'` string, (c) `is_restricted`/`redistribution_restricted` for licensed vendors. The tier1/tier4 authority split is materialized only at RESOLVE (`proforma-seeder.service.ts:1158-1159,1397`).

### Ingestion map (one row per path)

| Path | Entry | Parser | Source-class tag at entry | Store | First consumer |
|---|---|---|---|---|---|
| Web deal create | `inline-deals.routes.ts:381` | none | `deals.origin_class` (deal-level, `:478`); data fields **ABSENT** | `deals.*`, `deal_data.purchase_price:545` | proforma fallback chain |
| NestJS deal create | `deals/deals.service.ts:21` | none | **ABSENT** (no origin_class column) | `deals.*` | same |
| Email/chat draft | `create_deal_draft.ts:48` | LLM upstream | `deal_data.source='email_intake':78`; financials **ABSENT** (untagged top-level `:88-91`, NOT broker_claims) | `deals.deal_data` | inbox / underwriting |
| Rent roll (S1) | `inline-deals.routes.ts:1900` | rent-roll-parser | `source:'platform':1549` — **not verified/S1** | `deal_lease_transactions`, `deal_data.extraction_rent_roll` | `proforma-seeder:1159` |
| T-12 (S1) | same | t12-parser | `data_source='extraction':616`; `source:'platform':1457` | `deal_monthly_actuals`, `extraction_t12` | `proforma-seeder:1158` |
| OM (S5) | same | om-parser (LLM) | **`deal_data.broker_claims`:1112** (only real S5 discriminator) | `broker_claims` + `extraction_om`(`source:'platform':1114`) | seeder:1397; collision |
| Weekly leasing | same | leasing-stats-parser | `leasing_data_source='leasing_stats':1886` | `deal_monthly_actuals` | reforecast |
| Box score | same | box-score-parser | `source_type='extraction':782` | `deal_assumptions`, `extraction_box_score_detail` | traffic snapshot |
| Trade-out | same | lto-parser | `source_type='extraction':930` | `deal_lease_transactions` | traffic snapshot |
| Tax bill | same | tax-bill-parser | `source_type='extraction':944` | `deal_assumptions.property_tax_rate`, `properties` | seeder |
| CoStar (S4) | same | costar parser | **`is_restricted=TRUE`** `data-router.ts:185,196` | `costar_market_metrics/submarket_stats` | correlation engine |
| Weekly/BPI/TrialBal/Amort/Mortgage | same | parsers exist `:90-93` | **ABSENT — no `routeExtractionResult` case** (`data-router.ts:278-321`) | none (catalogue only `:549`) | none |
| Owned import (Yardi) | portfolio create `:478` | yardi-matrix-parser | `redistribution_restricted` (vendor) | `deal_monthly_actuals.is_portfolio_asset`, vendor tables | `fetch_owned_asset_actuals` |
| Archive import | `archive-ingestion.service.ts:763` | archive parsers | `source_type='archive':706` | `data_library_assets` (**not deal scope**) | `getArchiveCompStats` |
| Traffic snapshot (platform) | `traffic-analytics.service.ts:715` | — | **ABSENT** (no scope_id/source class) | `deal_traffic_snapshots` | capsule traffic module |
| metric_time_series (platform) | ingestion svcs | — | `scope_id` + `redistribution_restricted` (migration `20260624:63-74`) | `metric_time_series` | correlation engine |
| Chat fact | `skill-chat.service.ts:343` | — | **ABSENT / untracked** (chat log only) | `skill_chat_messages` | not promoted to deal scope |

### The untagged-entry list (birthplaces of every downstream provenance guess)

1. **Web deal-create scalar fields** — `inline-deals.routes.ts:480-548` (`budget`, `target_units`, `purchase_price` carry no LV/tier).
2. **NestJS `DealsService.create()`** — `deals/deals.service.ts:59-82` — no `origin_class`, no source class (a second, divergent create path).
3. **Email/chat draft financials** — `create_deal_draft.ts:88-91` — `noi`/`cap_rate`/`occupancy`/`asking_price` to top-level `deal_data`, untagged (not even `broker_claims`). An OM number arriving by email is *less* provenance-controlled than the same number in an uploaded OM.
4. **S1 capsule extraction blocks** — rent roll/T-12/tax bill all stamped the generic `source:'platform'` (`data-router.ts:1457,1549,1666`), identical to the OM block (`:1114`); no verified/S1 marker at entry.
5. **Unrouted document types** — WEEKLY_REPORT, BPI_FINANCIAL, TRIAL_BALANCE, AMORTIZATION_SCHEDULE, MORTGAGE_STATEMENT parse but write **zero deal-scope rows** (`routeExtractionResult` switch has no case, `data-router.ts:278-321`).
6. **Deal-scoped traffic snapshots** — `traffic-analytics.service.ts:715-751`, no scope_id / source class / restriction flag.
7. **Chat-conveyed user facts** — `skill-chat.service.ts:343-344`; never promoted to deal scope (not S1, not override — untracked). No inbound Telegram/conversational intake path exists.
8. **Archive corpus rows** — `archive-ingestion.service.ts:703-723`, only `source_type='archive'` (corpus, not deal scope).

### F11 surface
F11 = **SETTINGS**, not a dedicated library key (`frontend/src/components/terminal/TerminalChrome.tsx:31,36`). The library face `FilesTab.tsx` renders a filterable file list with per-document `parser_status` (`:246,259`) but **no extracted-field counts, no source class** (the `LibraryFile` interface *carries* `license_restricted`/`source_signal` at `:23-24` but neither is rendered), and **no document→field lineage**. The only lineage data (`deal_data.source_documents[].key_fields`, `data-router.ts:549-591`) is not surfaced. F11 is a file catalogue, not a provenance view.

---

## T1 — READ-SIDE FEED TRACING

Three read paths coexist and share no resolver: **(A)** priority-resolver over a flat multi-source LV (seeder), **(B)** hand-labeled `dominantSource` over hardcoded coefficients (stabilized-potential, traffic), **(C)** raw columns with no attribution (JEDI).

| Module · field | READ | Populating WRITE | Resolution order | LWW? |
|---|---|---|---|---|
| M09 Current GPR (seeder) | `proforma-seeder.service.ts:503-510` | T12/rent_roll payload | override→t12→rent_roll→platform (fixed) | No |
| M09 Current GPR (route) | `stabilized-potential.routes.ts:156-176` | `deal_t12_rows` | t12→deal_data→**hardcoded `4_820_000`:250** | silent hardcode |
| M09 market rent growth | `proforma-adjustment.service.ts:1393-1398` (`baseline\|current\|userOverride`, flat cols `:1369-1371`) | `rent_growth_current` UPDATEd by ≥3 writers (platform `:718`, legislative `:1095`, market `:186`) | flat cols, **not an LV** | **YES — last-write-wins** |
| M09 Pro Forma bridge + `dominantSource` | `stabilized-potential.routes.ts:308-335` | **hardcoded coefficients** (`gprDelta*0.18/0.31/0.39/0.12`); source hand-assigned | none — synthetic | **fabricated badge** |
| M09 other income/opex/concessions (route) | `stabilized-potential.routes.ts:264-271` | `×1.48`, `×1.105`, `×0.005` hardcoded multipliers | none | fabricated |
| Demand AADT | `traffic-data-sources.service.ts:36-49` | `adt_counts` (`ingestADTData 'DOT'`) | single source, nearest-station | No |
| Demand funnel | `trafficToProFormaService.ts:816-844` | `traffic_predictions.weekly_walk_ins`, ×conversion | derived; **hardcoded `2.3`:408 / `2.5`:514** fallback | hardcode |
| Demand source tags | `trafficToProFormaService.ts:84-85,462-467` | Traffic Engine v2 | **hand-written free-text strings**, not enum | — |
| M11 quote vs ruleset | `debt-context-assembler.ts:46-57` | `loanProduct` + `loanQuotes` stored **side-by-side, unmerged** | **NO PRECEDENCE DEFINED** (verified: both returned, no merger) | — |
| M11 rate environment | `fetch_debt_assumptions.ts:177-181` | **hardcoded** SOFR 4.85 / 10Y 4.25 ("would ideally come from a rate feed") | owned-avg→hardcode | hardcode |
| JEDI signals | `jedi-score.service.ts:189-193,302-322` | ingest tables | **raw columns, no confidence** (1 best-effort `resolveBoolean:467`) | No |
| Concessions | `concession-environment-engine.ts:320-433` | class default→M05→M04→subject-S2 blend | **weighted Bayesian blend** (genuine order) | No |

**Rule 5 (measured replaces estimate):** NOT satisfied for concessions — subject S2 is *blended* (`finalMonths = yearWeight×subject + (1−yearWeight)×base`, `:362`), dominating only at weight ≥0.5, with divergence surfaced as a collision (`:369-391`). A weighted blend, not a replacement.

---

## T2 — LAYEREDVALUE COVERAGE CENSUS

**≥4 incompatible LV definitions** (source-tags in parens):
1. `dealContext.ts:50` — `{value,source,resolvedFrom,confidence,alertLevel,layers{broker,platform,user}}` (`LayeredValueSource:25-44`)
2. `layered-value.ts:56` — `{value,source,agentRunId,stanceModulated}` + `UnderwritingValue`+`Evidence` (tiered enum `:19-52`)
3. `document-extraction/types.ts:545` — **flat** `{platform,t12,rent_roll,tax_bill,box_score,aged_ar,om,override,agent_confirmed,resolved,resolution}` (per-slot columns)
4. `m08-strategies.service.ts:30` — `{value,layer:'platform'|'user'|'default',sourceRef}` (3-value)
5. `frontend/src/services/archiveProperties.service.ts:9` — frontend variant
6. `stabilized-potential.routes.ts:30` — **route-local re-declaration** (adds box_score/aged_ar/om, drops agent/subject_history)

**Non-LV:** `AssumptionValue` (`proforma-adjustment.service.ts:54-59`) `{baseline,current,userOverride,effective}` — no source, no confidence.

The three source-tag enums are **not aligned** (`tier1:t12` vs bare `t12`; `owned_asset`/S2 only in #2; `box_score`/`aged_ar`/`om` only in #3 + route copy).

**Per-module LV-vs-raw:**

| Module | LV (attributed) | Raw / non-LV |
|---|---|---|
| M09 seeder | ~11 `LayeredValue<number>` (FIELD_PRIORITIES `:365-377`) | derived subtotals |
| M09 stabilized-potential route | 0 real (dominantSource hand-labeled) | all 10 line items synthetic |
| M09 adjustment assumptions | 0 | 5 `AssumptionValue` (rentGrowth, vacancy, opexGrowth, exitCap, absorption) |
| Debt (M11) | 0 (plain struct + `provenance:string`) | loanProduct + loanQuotes unmerged |
| Traffic | 0 (free-text source) | all funnel/AADT raw |
| JEDI/M25 | 0 (1 best-effort boolean) | all signals raw |
| Concessions | 0 LV (weight blend) | blended |
| Strategy | 2 three-slot LV | — |

**Consequential non-LV candidates:** `rent_growth`/`vacancy`/`opex_growth`/`exit_cap`/`absorption` (flat, `_current` is LWW); loan quote terms vs ruleset; rate environment (hardcoded); all JEDI signals; stabilized-potential line items; traffic funnel/occupancy/AADT.

**`{detected,override,resolved}` spread:** confined to `investment_strategy_lv` + `exit_strategy_lv` (`20260508_strategy_fields_lv.sql:21-22`); even there stored shape is 2-slot (`resolved` computed at read, `proforma-adjustment.service.ts:3308-3317`). `valuation_override_lv` is a plain LV. Total `*_lv` columns: 3. **Not generalized to any financial/market field.**

---

## T3 — FABRICATION / SILENT-DEFAULT HUNT

Systemic. Representative highest-severity sites (full enumeration in agent transcript):

**Named prior instances — verdicts:**

| Instance | Verdict | Evidence |
|---|---|---|
| M11 hardcoding loan terms | **REFUTED (now correct pattern)** | `rulesets/loan-product.ruleset.ts` — terms carry `provenanceTag:'platform_default'` + per-resolution provenance ("no lenderType provided"). Labeled-default done right. |
| Lease-up occ pinned to stabilized | **FIXED** | `deterministic-model-runner.ts:1955-1967` — Finding-AA replaced the endpoint-pin with ramp year-average. |
| `?? 12` stabilization | **CONFIRMED PRESENT** | canonical `stabilized-year-resolver.service.ts:412`; + `deterministic-model-runner.ts:1733,1913`, `lease-velocity-engine.ts:113,155,283`, `m07-projections-adapter.ts:466,580,723` |
| `\|\| 'acquisition'` at read | **CONFIRMED PRESENT** | `financial-models.routes.ts:634` (`model.model_type \|\| 'acquisition'`) — also cross-listed in the classification audit |
| `returns.ts:58` hardcoded NOI/basis/equity | **CONFIRMED PRESENT, verbatim** | `frontend/src/shared/calculations/returns.ts:58-61` (`baseNOI = dealType==='development' ? 2800000 : 3420000`, etc.) consumed live by `ExitCapitalModule.tsx:1161,1949` + `SensitivityTab.tsx:58,185` |

**Silent-default hotspots (should be sourced, not defaulted):**
- Deterministic bridge — `proforma-assumptions-bridge.ts:433,437,248-264` (`interestRate ?? 0.065`, `exitCap ?? 0.065`, `stabilizedOccupancy ?? 0.93`, `turnover ?? 0.50`); `deterministic-model-runner.ts:1890` (`basePropertyTax ?? purchasePrice*0.012`), `:2060` (`occupancyAtClose ?? 1.0` — S1 fact silently 100%).
- Request boundary — `deterministic-model.routes.ts:42-60` defaults the entire assumption block; `sigma-full.routes.ts:214-218`, `financial-dashboard.routes.ts:108,112,244` (`ltv ?? 0.65`, debt terms → S5).
- Proforma templates/generation — `proforma-template.service.ts:61-70` (full default block), `proforma-generator.service.ts:116-117,306-313`.
- Agent collaborations fabricate NOI — `asset-manager-cfo.service.ts:169` (`noi = purchase_price * (cap_rate || 0.06)`), `tax-cfo.service.ts:233`, `deal-structuring.service.ts:177`.
- Frontend recompute mirrors backend defaults — `FinancialEnginePage.tsx:912-1287`, `assumptionBridge.ts:45-70` (`noiAtAcquisition ?? purchasePrice*(capRate ?? 0.0575)` — NOI from defaulted cap), `FinancialDashboard.tsx:113-153`.
- Hardcoded exit/ROI — `deals.service.ts:1012-1013` (`ROI = value-add ? 85 : 45`, exit `43500000` — a leaked mock literal), `OverviewTab.tsx:119` (`noi ?? 2800000`).

**S3-fabricating-S1:** reference-correct pattern is `inPlaceNOI` (`deterministic-model-runner.ts:2058-2071` — computed from S1 inputs only, emitted as provenance-tagged evidence, absent-not-defaulted). Two MED exceptions: `occupancyAtClose ?? 1.0` (`:2060`) and synthesized occupied/vacant counts from `stabilizedOccupancy ?? 0.93` (`financial-model.routes.ts:394-395`).

**S5-without-collision:** substantially CLEAN (segregated `.broker` columns + DQA, `proforma-adjustment.service.ts:2609-2788`, `data-quality-agent.service.ts:431-472`). Three exceptions read a broker/asking value straight into a path without a co-located collision: `fetch_assumptions.ts:90` (askingPrice → agent context), `training/suggestion-generator.ts:54` + `pattern-extractor.ts:50` (broker_rent → training signal).

---

## T4 — PRIVACY BOUNDARY (detail; leaks surfaced in Severity-0 above)

**(a) S1/S2 ingestion org-scoping:**

| Route | Class | Verdict |
|---|---|---|
| `m07-calibration.routes.ts:133` rent-roll | S1 | ENFORCED (`assertDealOrgAccess`) |
| `financial-documents.routes.ts:39,115,224` T12/BS/capex/debt | S1/S2 | ENFORCED fail-closed — but two bugs (missing `query` import `:3`; deny branch returns truthy Response `:18`, no early-return). Direction is deny/500, not leak. |
| `debt-advisor.routes.ts:83,131` loan quotes | S2 | ENFORCED (`hasDealAccess` via org_members) |
| `portfolio.routes.ts:295-307` owned actuals | S2 | **LEAK-RISK** — user-scoped (`created_by`), NULL-owner globally visible (L4) |
| `data-upload.routes.ts:71` bulk actuals | S2 | **LEAK-RISK** — no ownership check (L2) |
| `portfolio.routes.ts:22` `/metrics` | S2 | **LEAK** — cross-org aggregate (L1) |
| `costar-upload.routes.ts:147` commit | S4 | **LEAK-RISK** — IDOR (L3) |

Consistency note: manual/bulk actuals insert `deal_id = NULL` (`portfolio.routes.ts:325`), so they're invisible to the B4b `deal_id`-JOIN scoping and are read by bare `property_id` — the exact shared-key path B4b warns against.

**(b) Universe/comp = S3 only?** `opportunity-engine.service.ts:305,332` reads platform tables — CLEAN. But `compQueryEngine.ts` / `comp-query.service.ts` read `v_comp_search` which exposes deal-derived `t12_avg_rent`/`t12_total_noi`/`t12_avg_occupancy` (`compQueryEngine.ts:36,99,134-140`), joined on public `property_id` with no deal/org predicate (`:205-206`), via **unauthenticated** routes (`comp-query.routes.ts:12-42`). **`v_comp_search` DDL is absent from the repo** (verified). **LEAK-RISK / UNVERIFIABLE (L5)** — the firewall, if any, is inside the view; must be checked against live DB.

**(c) S4 restricted rows:** the `source != 'costar_upload' OR deal_id = <subject>` predicate (migration `20260621`) is correctly enforced on guarded comp reads (`compSet.service.ts:188`, `comp-cascade.service.ts:137`, `valuation-grid.service.ts:1176+`, `market-intelligence.routes.ts:690`, `supply.routes.ts:889`). Metric-lineage firewalls (I1/I2/X2/J1) present (`correlationEngine.service.ts:431-533`, `skill-chat.service.ts:282`). Gaps: `v_comp_search` doesn't apply the predicate (L5); CoStar ingest/delete route lacks deal-org scoping (L3).

**(d) Flywheel/archive:** `archive-benchmark-aggregator.ts:312-339,703-741` outputs P10–P90 **coefficients only, never records**, drops buckets at `n<3`. Training corpus sanitized (`training.routes.ts:24-37`, LIC-01). **SAFE.** Minor: k-floor is `n≥3` with no org-diversity requirement on narrow buckets — weak anonymization, still coefficient-shaped.

---

## T5 — PROVENANCE RENDERING CENSUS

**Three parallel, divergent badge systems:** `primitives/SourceBadge.tsx` (canonical — but returns `null` for `platform`/`computed`/`engine:cashflow`, `:99-101,114-115`), `financial-engine/SourceBadge.tsx:6-43` (separate taxonomy + `Not Provided`), `ui/DataSourceBadge.tsx:13-75` (third taxonomy).

**Contract vs actual:** T12-verified → partial (no "verified" state) · OWNED → yes · PLATFORM → **no (silent null)** · BROKER⚠ → partial (no ⚠ glyph) · AGENT → yes.

| Surface | Provenance rendered? | file:line |
|---|---|---|
| M09 module-wired fields (hold period, rent growth) | Partial (`ModuleSourceBadge`) | `ProFormaTab.tsx:1183,1624,1918` |
| M09 mutable operating line items (OpEx, revenue, `custom_opex_*`, concessions) | **No** | `ProFormaTab.tsx:686-692` |
| Deal Terms | Yes | `DealTermsTab.tsx:654,1389-1550` |
| M11 Debt terms (both DebtTabs) | **No** (`provenanceChain`/`brokerClaims` in payload, never chipped) | `financial-engine/DebtTab.tsx:70`; `deal/sections/DebtTab.tsx:1162,1171` |
| Demand tab | **No** (grep: zero matches) | `terminal/tabs/DemandTab.tsx` |
| Classification banner | **No source chip** (confidence + signals only) | `StrategyDetectionBanner.tsx:73-228` |

**No-provenance consequential values:** proforma operating line items · all debt terms · all Demand-tab metrics · deal classification (confidence only) · every `platform`-sourced value platform-wide (silent null) · **no S4/restricted indicator exists in any badge taxonomy** — CoStar-derived comps render unmarked.

---

## T6 — THE GAP TABLE

`module.field-group | target source order | actual (file:line) | provenance rendered? | gap class`

| Module.field-group | Target order | Actual | Prov rendered? | Gap class |
|---|---|---|---|---|
| M09.current-column (GPR/rents) | S1(t12/rr)→S3 | seeder fixed-priority `proforma-seeder:503`; **route hardcodes `4_820_000` `stabilized-potential:250`** | line items No | silent-default (route) |
| M09.market-growth/expense | S3 baseline, user override wins | flat cols, `rent_growth_current` LWW `proforma-adjustment:1393,718,1095` | partial | wrong-order (LWW) |
| M09.proforma-bridge | resolved from layers | hardcoded coefficients + hand-labeled `dominantSource` `stabilized-potential:308-335` | fabricated badge | silent-default |
| M09.line-item provenance | badge per mutable field | none on operating rows `ProFormaTab:686` | No | missing |
| Demand.funnel/AADT/occupancy | S1(weekly/box)→S3 | derived + hardcoded `2.3`/`2.5` `trafficToProFormaService:408,514`; free-text source | No | silent-default + missing |
| Demand.provenance | tier-stamped estimate() chain | Demand tab renders none | No | missing |
| M11.quote-vs-ruleset | S1 quote → S3 ruleset default | **no precedence** `debt-context-assembler:46-57`; rate env hardcoded `fetch_debt_assumptions:177` | No | missing (no resolver) + silent-default |
| Classification.confidence | confidence = f(source class) | detection confidence not tied to input source class; banner shows no source | No | missing |
| JEDI/M25.inputs | resolved LVs + confidence | raw columns, no confidence `jedi-score:189` | No | wrong-order (raw) |
| Risk/M14.flags | source-class-aware | (not separately traced; consumes same raw signals) | No | missing |
| Comps/CI/universe | S3 only | opportunity-engine CLEAN; **`v_comp_search` serves T12 cols unauth `compQueryEngine:36,205`** | No | **leak-risk (L5)** |
| S4 restricted → universe | firewalled | predicate enforced on guarded reads; absent on `v_comp_search`; ingest route un-scoped | No S4 badge | leak-risk (L3,L5) |
| Turn/concessions | measured replaces prior (rule 5) | weighted blend, not replacement `concession-environment-engine:362` | No | wrong-order (blend≠replace) |
| Ingestion.source-class-at-entry | stamp at ENTRY | **ABSENT** — reconstructed at resolve `layered-value.ts:8-13` | n/a | missing (root) |
| S1/S2.org-scoping | never cross org | rent-roll/T12/quotes ENFORCED; **portfolio/metrics + bulk-upload LEAK** `portfolio.routes:22`, `data-upload:71` | n/a | **leak (L1,L2,L4)** |
| Flywheel/archive | coefficients not records | coefficients only, sanitized `archive-benchmark-aggregator:312` | n/a | OK (weak-k note) |
| Broker(S5).collision | every divergence = CollisionReport | segregated `.broker` cols + DQA `proforma-adjustment:2609` | BROKER partial | OK (3 read-site exceptions) |
| LayeredValue.definition | one canonical LV | **≥4 incompatible defs** `dealContext:50`/`layered-value:56`/`document-extraction/types:545`/`m08:30` | n/a | missing (root) |
| {detected,override,resolved} | generalized D3 seam | 2 strategy axes only `20260508:21-22` | n/a | missing (not generalized) |

---

## RULINGS NEEDED FROM LEON

**Out-of-band (do not wait for Phase 2 sequencing):**
- R0 — L1–L4 privacy leaks: authorize an immediate scoped fix dispatch (add org-scoping to `portfolio.routes.ts:22`, `data-upload.routes.ts:71`, `costar-upload.routes.ts`, and org-scope the owned-actuals reads)? These are live cross-org boundary violations.
- R0b — L5: run the `v_comp_search` DDL against the live DB to resolve whether the universe comp surface leaks cross-org T12. This is the one finding the audit could not close.

**Phase 2 (merge with classification waves — shared modules):**
1. One canonical `LayeredValue<T>` + one source-class enum (S1–S5), or a documented adapter between the ≥4. Which is the source of truth?
2. Source-class stamp at ENTRY (birth) vs continued resolve-time reconstruction — which is the target?
3. Convert `rent_growth`/`vacancy`/`exit_cap`/etc. from flat LWW `AssumptionValue` to attributed LVs? (fixes the last-write-wins on `rent_growth_current`.)
4. Debt: define quote→ruleset precedence in `debt-context-assembler` (S1 quote wins, S3 ruleset fills).
5. Provenance rendering: render `platform` (drop the silent null), add BROKER⚠ + an S4/restricted marker, chip proforma line items + debt terms + Demand tab + classification banner.
6. Silent-default policy: honest-absence (`null` + tier-stamped estimate) vs the current `?? 0.0x` defaults — apply the `inPlaceNOI` reference pattern engine-wide?

---

**STOP.** Phase 1 ends here per the hard gate. Nothing was created, consolidated, or fixed — including the Severity-0 leaks, which are surfaced for an out-of-band ruling, not patched. Phase 2 sequencing merges with the classification Phase 2 waves: one touch per shared module, both axes ("what deal is this" + "where did this number come from") fixed together.
