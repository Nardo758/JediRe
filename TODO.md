# JediRe Comprehensive TODO — Consolidated from All Audits

> **Source audits:** S1 Chat Launch Chain, Plumbing & Invariants, Unit Economics, Public Ingress Security, Asset Hub, Console Wiring, Deal Capsule (Spec + Tab Alignment), ProForma Subsystem, Scheduler, PROJECT_TRACKER
> **Last updated:** 2026-06-21
> **Status:** 7 audits complete (A1–A4). A5–A10 not yet run.

---

## Legend

| Severity | Meaning |
|----------|---------|
| **P0** | Launch-blocking; users cannot proceed correctly without this fix |
| **P1** | Data integrity or functional gap; produces incorrect or incomplete output |
| **P2** | Scalability, architecture debt, or missing feature that degrades experience |
| **P3** | Cleanup, polish, documentation, or mock data replacement |

---

## A1 — S1 CHAT LAUNCH CHAIN (Audit 2026-06-21)

> Report: `S1_CHAT_LAUNCH_CHAIN_AUDIT.md` (BROKEN-AT-HOP-3) — 23-row hop table, 4 live DB queries, 9 doc-vs-code gaps

| ID | What | Severity | Evidence / File |
|----|------|----------|---------------|
| S1-01 | **Research runtime Zod `_idmap` crash** — 861 failures / 159 successes; all runs since May 2026 fail immediately (0 tokens / 4–7 ms) | **P0** | `AgentRuntime.ts` or `research.config.ts` — Zod schema marshaling error before first tool invocation |
| S1-01b | **Root cause:** `fetchInflationContextTool` used `parameters:` instead of `inputSchema:` — **fixed in commit `c4b04adee`** | **P0** | `backend/src/agents/tools/fetch_inflation_context.ts` |
| S1-02 | Pre-assembled `DealContext` not passed to ZONING/SUPPLY/CASH in live path | **P1** | Chat path skips context handoff to downstream agents |
| S1-03 | `AICoordinator` orphaned — `DealContext` handoff design was not ported to unified-orchestrator | **P1** | `orchestrator.service.ts` does not wire AICoordinator context bridge |
| S1-04 | 4 spec'd Research tools absent from `research.config.ts` registry | **P2** | Spec docs list tools not found in registry |
| S1-05 | 24h cache short-circuit absent from chat path (tracks with S1-02) | **P1** | No cache gate on chat-initiated research runs |
| S1-06 | Both spec docs reference wrong Inngest function path | **P3** | Doc fix only — cross-reference mismatch |
| S1-07 | Agent trigger route mismatch between spec and code | **P3** | Doc fix only — route name drift |

**→ Gating fix:** S1-01 was the one to fix first — now resolved. Everything downstream is unblocked.

---

## A2 — PLUMBING & INVARIANTS (Audit 2026-06-21)

> Report: `PLUMBING_AND_INVARIANTS_AUDIT.md` — 12 subsystems checked, 13 invariants checked
> Verdict: FRAGILE at S2, S5, S7, S9

### Launch-Blocking Shortlist

| ID | What | Severity | Evidence / File |
|----|------|----------|---------------|
| S9/I10 | **`scope_id` absent from all three corpus tables** — no licensing barrier today; Lane-B can reach shared corpus with zero mechanical resistance | **P0** | `scope_id` column missing in all corpus tables; `redistribution_restricted` is ad-hoc only |
| S2 | `zoning.completed`, `supply.completed`, `cashflow.completed`, `commentary.completed` all fire into void — no Inngest consumers | **P1** | Inngest event emitted but no function subscribes to completion events |
| S1 | 1272 of 1273 agent audit rows have `agent_run_id = NULL` — walkthrough path never writes the `run_id` | **P1** | `agent_runs` table: 1/1273 rows have FK; all others orphaned |
| I3 | `liveMlillageService.ts:190` serves stale millage silently | **P2** | No freshness check; old millage data served without warning |
| I11 | Every cashflow agent field write mints a version snapshot — excessive versioning | **P2** | `deal_versions` grows on every field edit, no deduplication |
| I1 | `jedi_score` persisted and re-read as truth (no recomputation on read) | **P3** | Score stored as static value, not derived on demand |
| I6 | FL hardcoding in 4 non-ruleset files | **P3** | Florida logic scattered outside `tax/rulesets/FL` |

### Subsystem Status Summary

| Subsystem | Status | Notes |
|-----------|--------|-------|
| S1 (runtime) | PARTIAL | Agent run tracking broken |
| S2 (Inngest consumers) | PARTIAL | Completion events fire into void |
| S3 (LayeredValue) | PARTIAL | Works but 4 tabs leak raw layers |
| S4 (DealStore bus) | PARTIAL | Event propagation incomplete |
| S5 (cache) | PARTIAL | 24h cache missing on chat path |
| S6 (auth-signal fallback) | PARTIAL | Graceful fallback exists but unverified |
| S7 (vendor data) | PARTIAL | CoStar import-only; no live API |
| S8 (vendor data) | PARTIAL | Same as S7 |
| S9 (scope_id) | ABSENT | No licensing gate exists |
| S10 (Data Library licensing primitive) | WIRED | `redistribution_restricted` works |
| S11 (Correlation Engine) | PARTIAL | Per-property path exists, submarket linkage blocked |
| S12 (cross-surface field read) | UNVERIFIED | Needs manual UI test |

---

## A3 — ASSET HUB / CONSOLE WIRING (Audits 2026-06-01)

> Reports: `ASSET_HUB_AUDIT.md`, `CONSOLE_WIRING_AUDIT.md`  
> Property: Highlands at Sweetwater Creek (`deal_id = eaabeb9f…`, `property_id = 7ea31caf…`)  
> Verdict: 15/31 panels CONNECTED, 16/31 broken or missing

### Tier 1 — Wire Now (fix requires ≤2 files, no new service)

| ID | What | Severity | Exact Fix | File:line |
|----|------|----------|-----------|----------|
| AH-1A | **C-03/C-04 Waterfall 404** — 1 valid `deal_waterfalls` row unreachable; path mismatch | **P0** | Add alias `router.get('/:dealId/waterfall', ...)` OR change frontend URL to `/deals/${dealId}/waterfall` | `investor-capital.routes.ts:532` · `AssetHubPage.tsx:1434,1437` |
| AH-1B | **P-06 Commentary agent not called** — thesis panel fully mocked; 758-line agent exists | **P1** | (a) Add `assetMode?: 'owned' \| 'pipeline'` to `ResearchAgentContext`; (b) expose owned-asset commentary endpoint; (c) add `useEffect` in `PerformanceScreen` | `dealContext.ts:~604` · `commentary.agent.ts` · `AssetHubPage.tsx:1184` |
| AH-1C | **C-01 Debt record not fetched** — `CapitalScreen` has no `useEffect`; route exists at `lifecycle.routes.ts:227` | **P1** | Add `useEffect` in `CapitalScreen` fetching `GET /api/v1/lifecycle/${dealId}/debt`; wire SOFR overlay from `metric_time_series` | `AssetHubPage.tsx:1414` · `lifecycle.routes.ts:227` · `fred-ingest.service.ts:25` |
| AH-1D | **`propertyId` silently null** — if `dealStore.deals` not pre-loaded, MARKET SIGNALS fetch skipped | **P1** | Add owned-asset fallback: seed `propertyId` via deals-list fetch or hardcoded constant when `urlDealId` matches Highlands | `AssetHubPage.tsx:1597,1602–1610` |

### Tier 2 — Needs Route (table/data exists, endpoint missing)

| ID | What | Severity | Route to Add | Data Available |
|----|------|----------|-------------|--------------|
| AH-2A | **R-13 Per-property rankings / PCS** — no per-property endpoint; PCS shows `'—'` | **P1** | `GET /api/v1/rankings/property/:propertyId` | `property_records` (market-wide pool) |
| AH-2B | **D-05 Rank target persistence** — `POST /api/v1/rankings/:propertyId/target` absent; target lost on reload | **P1** | `POST /:propertyId/target` + new `asset_rank_targets` table | Requires new schema |

### Tier 3 — Needs Backend (no data/service at required grain)

| ID | What | Severity | What Must Be Built |
|----|------|----------|-------------------|
| AH-3A | **R-05 Repricing synthesizer** — `GET /api/v1/revenue/:dealId/course` → 404 | **P2** | Build repricing synthesizer service; create `revenue.routes.ts`; mount `/api/v1/revenue` in `index.replit.ts` |
| AH-3B | **P-04 Live Tracking 4-col (M09)** — `GET /operations/:dealId/live-tracking` absent | **P2** | Add handler to `operations.routes.ts`; compose M09 4-col from formula-engine |
| AH-3C | **C-02 Capital-accounts per-member** — no endpoint | **P2** | Add `GET /:dealId/capital-accounts` to `investor-capital.routes.ts`; build per-member LP/GP balance model |
| AH-3D | **R-02 LTL/concessions monthly series** — `rent-roll-derivations.service.ts` absent | **P2** | Build `rent-roll-derivations.service.ts`; extract `derived_metrics` JSONB from `rent_roll_units`; expose via operations route |
| AH-3E | **C-01 Rate cap / hedge fields** — debt route exists but schema lacks cap/hedge columns | **P2** | Add `rate_cap_strike`, `hedge_type`, `hedge_expiry` to deal debt table; expose in `GET /lifecycle/:dealId/debt` |
| AH-3F | **R-04 Market rent per unit type** — no comp rent feed | **P2** | Wire per-unit-type comp rent source (RentCast or similar); expose `GET /api/v1/comps/:propertyId/market-rents?byType=true` |
| AH-3G | **P-08 EXIT tab** — `ExitTimingTab.tsx` uses hardcoded constants; `dealId` prop unused | **P2** | Build `GET /lifecycle/:dealId/exit-timing`; wire into `ExitTimingTab.tsx` replacing `ConvergenceChart.tsx` constants |
| AH-3H | **D-04 ACTIVITY drawer** — `ActivityTab.tsx` is a stub ("🚧 Coming Soon") | **P2** | Build activity feed endpoint; rewrite `ActivityTab.tsx` to fetch deal-scoped audit trail |
| AH-3I | **P-07 LIFECYCLE reforecast/history** — `lifecycle_reforecasts` table does NOT EXIST | **P2** | Create `lifecycle_reforecasts` table (migration); implement handler at `lifecycle.routes.ts:212` |

### Tier 4 — Data Population (route + table exist, table empty)

| ID | What | Severity | How to Populate |
|----|------|----------|-----------------|
| AH-4A | `traffic_predictions` = 0 rows (Highlands) | **P1** | Run `POST /api/v1/traffic/predict/7ea31caf-f070-43eb-9fd1-fe08f7123701`; run calibration job for `traffic_calibration_factors` and `validation_properties` |
| AH-4B | `deal_monthly_actuals` budget rows = 0 | **P1** | Load pro-forma budget rows via `POST /api/v1/operations/:dealId/monthly-actuals` with `is_budget=true` for each projection month |
| AH-4C | `deal_team_members` = 0, `deal_tasks` = 0 | **P2** | Add team members via `POST /api/v1/deals/:dealId/team/members`; add tasks via `POST /api/v1/deals/:dealId/team/tasks` |
| AH-4D | `dispositions` = 0, `capex_actuals` = 0 | **P2** | Record disposition notes and capex actuals via lifecycle endpoints if applicable |
| AH-4E | `capital_calls` = 0 (only 1 row), `distributions` = 0 (only 2 seed rows) | **P2** | Seed real capital call history for Highlands; record actual distributions |

### Additional Asset Hub Gaps (from ASSET_HUB_AUDIT.md)

| ID | What | Severity | Notes |
|----|------|----------|-------|
| AH-5A | `DealContext` has no owned-asset variant | **P2** | `dealContext.ts:604` — `DealContext = ResearchAgentContext` is acquisition-centric; no `is_portfolio_asset` or `assetMode` field |
| AH-5B | `leasing_weekly_observations` and `lease_tradeout_events` have no HTTP route | **P2** | 1,768 combined rows of Highlands data inaccessible to frontend; only `portfolio.routes.ts:1184+` reaches partial data |
| AH-5C | Revenue waterfall sub-tab shows empty state despite 53 months of actuals | **P1** | `AssetOwnedPage.tsx:632` — `emptyState` fires when `actuals.length === 0`; verify `operations.routes.ts:752` resolves `deal_id → property_id` correctly |
| AH-5D | Traffic engine tables empty; no prediction ever run | **P2** | 3,400 lines of engine code mounted but `traffic_predictions` = 0, `traffic_calibration_factors` = 0, `validation_properties` = 0 |
| AH-5E | LP/GP waterfall is deal-level splits only; no per-investor capital accounts | **P2** | `formula-engine.ts:1326–1327` — no preferred return tracking, no cumulative distribution ledger, no clawback |
| AH-5F | No LP-letter template, no IC-memo template, no owned-asset quarterly operating report | **P2** | Commentary Agent is market-focused; Excel export is acquisition ProForma only |
| AH-5G | `submarket_id = NULL` for Highlands (`property_id = 7ea31caf…`) | **P2** | Task #1685 open; degrades `CorrelationEngineService` to city/state-level signals only |

---

## A4 — DEAL CAPSULE (F-Key Tabs + Spec Alignment) (Audits 2026-06-18)

> Reports: `DEAL_CAPSULE_SPEC_AUDIT_2026-06-18.md`, `DEAL_CAPSULE_TAB_ALIGNMENT_AUDIT_2026-06-18.md`  
> Verdict: 5 P0 structural bugs, 35 P1 content/mock gaps, 10 P2 polish items across 11 tabs

### Phase 1: Structural Fixes (P0) — Do First

| ID | What | Tab | Severity | Exact Fix | File:line | Status |
|----|------|-----|----------|-----------|----------|--------|
| DC-01 | **Keyboard F-key mapping shifted by one** (F3–F12) | ALL | **P0** | Correct `fKeyMap` to match spec §4.1; remove F12 | `DealDetailPage.tsx:788–799` | **Resolved 2026-06-20** — commit `4fe88cf7d` |
| DC-02 | **F9 Pro Forma has wrong `moduleId`** — `M08` instead of `M09` | F9 | **P0** | Change `moduleId: 'M08'` → `'M09'`, `code: 'M08'` → `'M09'` | `DealDetailPage.tsx:848` | **Resolved 2026-06-20** — commit `4fe88cf7d` |
| DC-03 | **F10 Risk uses `M13` instead of `M14`** | F10 | **P0** | Change `moduleId: 'M13'` → `'M14'`; update `RiskDDPage` to consume M14 variants | `DealDetailPage.tsx:849` · `deal-type-visibility.ts:344–365` | **Resolved 2026-06-20** — commit `4fe88cf7d` |
| DC-04 | **Visibility model is 1D** (`DealType` only), spec requires 2D (use × archetype) | ALL | **P0** | Add `assetUseType` to `Deal` type; validate pairs; update `deal-type-visibility.ts` | `deal-type-visibility.ts` · `Deal` type | **Partially resolved 2026-06-20** — `asset_use_type` + `deal_archetype` columns added to `deal_assumptions` in commit `4fe88cf7d`; two-axis visibility predicates still need wiring |
| DC-05 | **Land-use visibility guard missing** — F6 should hide for Land | F6 | **P0** | Add `use === 'Land'` guard to F6 visibility | `deal-type-visibility.ts` · `DealDetailPage.tsx` | Open |

### Phase 2: Content Hardening (P1) — High Impact

| ID | What | Tab | Severity | Notes |
|----|------|-----|----------|-------|
| DC-06 | Add Investment Thesis card + functional "You" column + deal timeline | F1 | **P1** | No executive narrative; "You" column is UI placeholder |
| DC-07 | Add top-level zoning verdict card + entitlement timeline + risk score | F2 | **P1** | 6 sub-tabs but no summary card |
| DC-08 | Add market signal synthesis (buy/hold/caution) + reduce sub-tab bloat | F3 | **P1** | 8+ sub-tabs with no summary; heavy mock data in program/amenity panels |
| DC-09 | Wire real project data or mark synthetic data with provenance badges | F4 | **P1** | All "projects" are renamed submarket entries; developer names, distances, unit mixes are synthetic |
| DC-10 | Rebuild 21-year trajectories or replace with live data + remove static momentum labels | F8 | **P1** | `ConvergenceChart.tsx` shows empty banner; market momentum is static fiction |
| DC-11 | Add use-specific schemas (Retail NNN, Office MG, Industrial, Land) | F9 | **P1** | Only MF schema exists; Retail/Office/Industrial/Land missing |
| DC-12 | Apply M14 risk weights + add financial stress tests + expand collision analysis | F10 | **P1** | Risk weights hardcoded; no DSCR/debt yield stress tests; collision analysis only 3 metrics |
| DC-13 | Add deal stage tracker + task assignments + IC memo workflow | F11 | **P1** | Tools are live CRUD but missing executive features |
| DC-14 | Add financial tie-in (TDC, equity, returns) to 3D view | F7 | **P1** | No cost/returns tied to massing; no zoning detail panel |
| DC-15 | Add commercial tenant leasing model (TI, downtime, renewal) | F6 | **P1** | Missing for commercial use types |
| DC-16 | Add lease expiration schedule + concession trending + CRM channel attribution | F6 | **P1** | Critical for deal-level underwriting |
| DC-17 | Add comparable strategy overlays + exit timeline by hold period + deal-specific sensitivity | F5 | **P1** | Strategy engine is thin wrapper; missing overlays and sensitivity |
| DC-18 | Add exit-timing real data endpoint; wire `ExitTimingTab.tsx` | F8 | **P1** | `dealId` prop unused; hardcoded constants only |
| DC-19 | Add activity feed backend + rewrite `ActivityTab.tsx` | ALL | **P1** | Currently "🚧 Coming Soon" stub |
| DC-20 | Add rank target persistence (`POST /rankings/:propertyId/target`) | ALL | **P1** | Target held in component state only, lost on reload |

### Phase 3: Polish (P2) — Nice to Have

| ID | What | Tab | Severity | Notes |
|----|------|-----|----------|-------|
| DC-21 | Collapsed/demoted UI for stabilized deals on F2 | F2 | **P2** | F2 should be secondary (collapsed) for stabilized per spec |
| DC-22 | Signal back from F2 → F1, F3 → F9, etc. | ALL | **P2** | Cross-tab data flow not implemented |
| DC-23 | Wire `CapsuleDetailPage` overview to real `year1`/Projections path | F1 | **P2** | `CapsuleDetailPage.tsx` is hardcoded mock |
| DC-24 | Consolidate 2 deal pages → 1 canonical + redirect | ALL | **P2** | `DealDetailPage` (1,779 lines) vs `CapsuleDetailPage` (692 lines) — decision open |
| DC-25 | Mount 6 missing routes or remove dead files | ALL | **P2** | `investor-capital`, `capsule-intelligence`, `demand-intelligence`, `reporting-package`, `zoning-comparator`, `audit` routes unmounted |
| DC-26 | Remove 3 ghost endpoints from UI (`/balance-sheets`, `/roadmap`, `/timeline`) | ALL | **P2** | UI calls return 404 |

### Deal Capsule Spec Gaps (from SPEC_AUDIT)

| ID | What | Severity | Notes | Status |
|----|------|----------|-------|--------|
| DC-27 | **`deal_capsules` table has no CREATE TABLE migration** | **P0** | Sharing layer references non-existent table; FKs will fail | **Resolved 2026-06-20** — migration `20260619_deal_capsules.sql` added in commit `4fe88cf7d` |
| DC-28 | **`scope_id` column does not exist** | **P0** | Lane A/B scope guard cannot be enforced (same as A2-S9/I10) | **Partially resolved 2026-06-20** — `scope_id` added to `deal_assumptions` in commit `4fe88cf7d`; corpus tables still need it |
| DC-29 | Extraction pipeline does NOT set `scope_id` or `redistribution_restricted` at ingest | **P0** | Licensed/user data may leak into shared corpus | Open |
| DC-30 | **NOI formula bug (CF-01):** `getFieldValues` forces `egi - total_opex`, ignores OM-extracted `year1.noi.om` | **P0** | Cascades into IRR, cap rate, S&U, returns, valuation grid, sensitivity | Open |
| DC-31 | `FIELD_PRIORITIES` is a global constant, not per-field spec-defined walks | **P1** | `agent` layer not in priority map; some fields may resolve incorrectly | Open |
| DC-32 | Per-year overrides (`per_year_overrides`) never consumed by Projections | **P1** | Year 3 payroll edits save to DB but are discarded on next fetch (same as PF-02) | Open |
| DC-33 | 4 tabs leak LayeredValue raw layers (`AssumptionsTab`, `OverviewTab`, `DealTermsTab`, `SourcesUsesTab`) | **P1** | UI shows `.platform`/`.broker` instead of `.resolved` | Open |
| DC-34 | Rent Comp Grid does not union platform + user-uploaded CoStar | **P1** | User CoStar comps invisible in comparison grid | Open |
| DC-35 | Expense/other-income comps not wired to Pro Forma assumptions | **P1** | Data Library archive mined by agents but not fed into Pro Forma | Open |
| DC-36 | `stabilization_marker` consumption by Projections not verified | **P1** | If Projections derives its own stabilization, Y_S and terminus diverge | Open |
| DC-37 | AES-256-GCM encryption not implemented | **P2** | `api_key_encrypted` is TEXT; no encryption algorithm specified | Open |
| DC-38 | Shortcode URL (`/c/:code`) not implemented | **P2** | `access_token` used instead of dedicated shortcode | Open |
| DC-39 | Stripe margin not verified | **P2** | `platform_margin_usd` exists but Stripe integration not verified | Open |
| DC-40 | 13 empty tables on 464 Bishop — silently blank surfaces | **P2** | Add "not configured" UI states or seed defaults | Open |
| DC-41 | Purchase price in 3 locations with no documented precedence | **P2** | `deals.deal_data`, `deal_assumptions.land_cost`, `deal_context_fields` — same field, no canonical resolution | Open |
| DC-42 | `proforma_templates` never applied to deals | **P2** | CRUD exists but no route applies template to `deal_assumptions.year1` | Open |

---

## A5 — PROFORMA / F9 FINANCIAL ENGINE (Audit 2026-05-15)

> Report: `docs/architecture/PROFORMA_SUBSYSTEM_AUDIT.md` — Engine A (F9) sole production engine since 2026-06-18

| ID | What | Severity | Effort | Notes |
|----|------|----------|--------|-------|
| PF-01 | ~~Dual-engine architecture~~ | — | — | **Resolved 2026-06-18** — Engine B deleted |
| PF-02 | **Per-year overrides never consumed** by `getDealFinancials` projections loop | **P0** | M | `payroll:yr2`, `gpr:yr2`, etc. saved to DB but discarded on next fetch (same as DC-32) |
| PF-03 | **Bad debt display uses GPR not EGI** — overstates by ~35% | **P0** | S | `proforma-adjustment.service.ts:1964` — display row uses GPR multiplier instead of EGI deduction |
| PF-04 | No transaction boundary between `proforma_assumptions` and `deal_assumptions` writers | **P1** | M | 5 writers for `*_current`; 2 writers for `year1`; no shared transaction |
| PF-05 | Whole-pct / decimal convention split in `proforma_assumptions` | **P1** | S | `3.000` = 3% in `proforma_assumptions`; `0.03` = 3% everywhere else |
| PF-06 | **All 21 LIUS lines bypassed** — silent fallback | **P1** | L | `runLIUSEngine` has zero production callers; no telemetry on bypass |
| PF-07 | **Tier 1–3 layered growth engine never wired** — test only | **P1** | L | `proforma-projection.service.ts`, `rent-growth.ts`, `opex-growth.ts`, `revenue-formulas.ts` — zero production callers |
| PF-08 | Unit mix GPR flag has no UI toggle | **P1** | S | `da:use_unit_mix_for_gpr` not settable from any UI |
| PF-09 | Other income stale-cache — 12× inflation if seeded from monthly total | **P1** | S | `other_income_per_unit.resolved` stored as annual but source may be monthly (Bishop: 904.14 vs ~$75/unit) |
| PF-10 | `landscaping` phantom row | **P2** | S | In `CTRL_ORDER` display list but absent from seeder `OPEX_FIELDS` |
| PF-11 | No UI for LP/GP split (90/10 hardcoded) | **P2** | S | `wf:lpShare`/`wf:gpShare` only via raw API PATCH |
| PF-12 | ProForma templates never applied to deals | **P2** | M | `proforma_templates` CRUD exists but no application route |
| PF-13 | Concessions hardcoded zero in LLM bridge | **P2** | S | `proforma-assumptions-bridge.ts:241`: `const concessions = 0` |
| PF-14 | `deal_assumptions` scalar columns are dead weight | **P3** | S | ~15 columns written at creation, never read by live engine |
| PF-15 | Traffic projection all-null stub | **P3** | L | `buildTrafficProjection()` returns all-null struct |
| PF-16 | ~~OperatorStance concession modulation missing in Engine A~~ | — | — | **Resolved 2026-06-18** — now runs via `applyStanceToFinancials` |
| PF-D1 | Development `dealMode` defaults to `'existing'` | **P2** | S | `proforma-assumptions-bridge.ts:387`: `dealType: a.modelType || 'existing'` |
| PF-MD-1 | `capitalStructureMockData` actively rendered in DebtTab | **P3** | S | `DebtTab.tsx:21` imports mock data; lock-vs-float, spread analysis, rate forecast, debt products all hardcoded |

---

## A6 — SCHEDULER / CRON CONSOLIDATION (Audit 2025-06-10)

> Report: `SCHEDULER_AUDIT_REPORT.md` — 4 scheduling mechanisms, 3 critical overlaps, ET/UTC timezone drift

### Immediate (This Week)

| ID | What | Severity | Notes |
|----|------|----------|-------|
| SCH-01 | Disable Inngest `trafficCalibrationCron` | **P1** | node-cron daily already running; redundant weekly Inngest job |
| SCH-02 | Disable node-cron apartment locator sync in `m28-scheduler.service.ts` | **P1** | Inngest `syncAllMetros()` already covers Atlanta |
| SCH-03 | Disable node-cron Georgia county ingestion in `m28-scheduler.service.ts` | **P1** | Superseded by Inngest Sunday ArcGIS + Monday enrichment |

### Short-Term (Next 2 Weeks)

| ID | What | Severity | Notes |
|----|------|----------|-------|
| SCH-04 | Audit `sweepAllGeographies()` vs `computeTimeSeriesCorrelations()` — check same-table write | **P1** | Weekly sweep may conflict with daily rolling compute |
| SCH-05 | Standardize all cron expressions to UTC | **P2** | Remove `timezone: 'America/New_York'` from node-cron; convert to UTC equivalents |
| SCH-06 | Add `source_url` UNIQUE constraint to `news_article_cache` | **P2** | Prevents duplicate articles from overlapping news ingest jobs |

### Medium-Term (Next Month)

| ID | What | Severity | Notes |
|----|------|----------|-------|
| SCH-07 | Migrate remaining node-cron jobs to Inngest where durability matters | **P2** | M35 backtest, property discovery; keep simple refreshes in node-cron |
| SCH-08 | Add scheduler registry dashboard endpoint (`GET /api/v1/admin/schedulers`) | **P2** | Lists all active cron jobs, last run, next fire time — sourced from Inngest API + node-cron state |

---

## A7 — M36 Σ ENGINE / M37 ANALOG / M38 CALIBRATION (From PROJECT_TRACKER)

> Stream status: M36-A ✅ Complete, M36-B ✅ Complete, M36-C Goal-Seeking UI 📋 Next, M37–M38 ⏸ Not Started

| ID | What | Severity | Status | Notes |
|----|------|----------|--------|-------|
| M36-C | **Goal-Seeking UI** — frontend widget, bundle selector, "Apply" button | **P1** | IN PROGRESS | Backend solver complete; needs React UI |
| M36-C2 | Wire goal-seeking "Apply" payload to ProForma assumptions | **P1** | PENDING | `applyStanceToFinancials` or override path |
| M37-A | M37 Similarity Service — schema, migrations, computation, analog ranking | **P2** | NOT STARTED | 3-session build; blocked by M36-C |
| M37-B | M37 Forward Mode — `POST /api/analogs/forecast/forward` | **P2** | NOT STARTED | 2 sessions |
| M37-C | M37 Backward + Counterfactual | **P2** | NOT STARTED | 2 sessions |
| M37-D | M37 Agent Integration | **P2** | NOT STARTED | 3 sessions |
| M38-A | M38 Schema + Ingestion — `predictions`, `realizations`, `pairings`, `reliability_stats` | **P2** | NOT STARTED | 2 sessions; blocked by M37-D |
| M38-B | M38 Realization Streams — M22 actuals → `realizations` pipeline | **P2** | NOT STARTED | 2 sessions |
| M38-C | M38 Pairing + Reliability | **P2** | NOT STARTED | 2 sessions |
| M38-D | M38 Drift Detection | **P2** | NOT STARTED | 2 sessions |
| M38-E | M38 Consumer Integration — Cashflow Agent CalibrationProfile, UI confidence badges | **P2** | NOT STARTED | 3 sessions |

---

## A8 — PUBLIC INGRESS SECURITY (Audit 2026-06-21)

> Report: `PUBLIC_INGRESS_SECURITY_AUDIT.md` — Summary from `Audit files.txt`

| ID | What | Severity | Notes |
|----|------|----------|-------|
| SEC-01 | *(Details from full report)* | TBD | Report not in repo; summary only available in `Audit files.txt` |
| SEC-02 | *(Details from full report)* | TBD | Report not in repo; summary only available in `Audit files.txt` |

> **Note:** The full `PUBLIC_INGRESS_SECURITY_AUDIT.md` was not found in the repo. Only the summary from `Audit files.txt` is available. Recommend writing the full report to repo root and expanding this section.

---

## A9 — UNIT ECONOMICS & CREDIT COST (Audit 2026-06-21)

> Report: `UNIT_ECONOMICS_AUDIT.md` — Summary from `Audit files.txt`

| ID | What | Severity | Notes |
|----|------|----------|-------|
| UE-01 | *(Details from full report)* | TBD | Report not in repo; summary only available in `Audit files.txt` |

> **Note:** The full `UNIT_ECONOMICS_AUDIT.md` was not found in the repo. Only the summary from `Audit files.txt` is available. Recommend writing the full report to repo root and expanding this section.

---

## B — EXISTING TODO ITEMS (From Prior TODO.md)

> These items were in the previously committed TODO.md and remain open.

### Traffic / M07

| ID | What | Severity | Notes |
|----|------|----------|-------|
| T-01 | **Veraset cell-phone / mobility data activation** — code-complete, blocked by vendor deal | **P2** | Set `VERASET_API_KEY`, `POST /api/v1/veraset/:msaId/activate`, nightly cron begins populating `mobility_visits_monthly` |
| T-02 | **M07 calibration confidence bands on `trafficProjection.yearly`** — surface P10/P25/P75/P90 on `F9TrafficYear` | **P1** | Schema extension needed on `F9TrafficYear` in `types.ts`; frontend placeholder already in `TrafficFunnelPanel` |

### F9 / Proforma (Additional)

| ID | What | Severity | Notes |
|----|------|----------|-------|
| F-01 | **Unit-mix-as-GPR-source feature flag activation** — `da:use_unit_mix_for_gpr` exists but not set on existing deals | **P1** | Reconcile deals where `sum(unit_mix[].count × rent × 12)` diverges from `gprDecomposition.resolvedAnnual`; add UI toggle in `UnitMixTab` |
| F-02 | **LP-GP split user-facing write path** — no UI dial; defaults 90/10 | **P1** | Decide canonical surface (F9 Capital vs Deal Terms §4); add LP-GP split row wired to `PATCH /financials/override` |
| F-03 | **Ancillary breakdown → `other_income_per_unit` rollup verification** — unknown whether all ancillary buckets roll up correctly | **P1** | Pick deal with known parking/RUBS data; compare raw extraction vs. `other_income_per_unit × totalUnits × 12`; include `other_income_user_lines` in validation |
| F-04 | **Post-fix: audit Claude narratives generated pre-pct-unit-break fix** — 861 failed runs may have persisted bad narratives | **P2** | Check if `deals.ai_narrative` is written; if yes, regenerate for deals where `last_viewed_at > 2026-04-01 AND last_ai_narrative_at < fix_deploy_timestamp` |
| F-05 | **Post-fix: LP deliverable audit — pre-fix Excel exports had 100× understated gross-sale-value** | **P2** | `f9-financial-export.service.ts:220` computed `exitNoi / 5.5` instead of `exitNoi / 0.055`; check export audit log for any LP deliverables sent pre-fix |
| F-06 | **Post-fix: audit for dormant seeder improvements not propagated to existing deals** | **P2** | Grep `proforma-seeder.service.ts` for write-time logic; cross-reference against task history before `forceReseed` existed |

### Deal Creation / Inline Deals

| ID | What | Severity | Notes |
|----|------|----------|-------|
| D-01 | **Deal creation one-sided writer** — `POST /` writes `budget` to `deals.budget` only, not `deal_data.purchase_price` | **P1** | `inline-deals.routes.ts:334-358`; fix: merge `deal_data = deal_data || jsonb_build_object('purchase_price', budget)` when `budget` non-null |
| D-02 | **Deal update one-sided writer** — `PATCH /:id` writes `budget` to `deals.budget` only, not `deal_data.purchase_price` | **P1** | `inline-deals.routes.ts:510-554`; fix: when `budget` in PATCH body, also merge into `deal_data.purchase_price` |

### Agent Infrastructure

| ID | What | Severity | Notes |
|----|------|----------|-------|
| A-01 | **Consolidate agent seeders to shared `upsertAgentPrompt` helper** — all 5 seeders hand-write deactivate-then-insert pattern | **P2** | `backend/src/agents/seeds/`; extract `upsertAgentPrompt` to `_helpers.ts` with correct order (deactivate first, then insert) |
| A-02 | **Document `idx_prompt_versions_active` as load-bearing in migration** — partial unique index prevents dual-active prompts | **P2** | Add comment to migration explaining load-bearing role; reference in ADR-003 |

### Operator Stance

| ID | What | Severity | Notes |
|----|------|----------|-------|
| O-01 | **Frontend types mirror gap** — `frontend/src/types/operator-stance.ts` should exist but doesn't | **P2** | `frontend/src/stores/dealContext.types.ts:751+` has mirror; `StanceTab.tsx` imports from there; low risk today |

### Deal Journey (F9 Header)

| ID | What | Severity | Notes |
|----|------|----------|-------|
| J-01 | **Deal Journey pending phases** — M36 aggressiveness dial, M07 confidence bands, M35 event path, M38 calibration | **P2** | Phase 1 LOCKED; Phase 2+ scope per `deal-journey-framework.md` |

---

## A10 — CROSS-CUTTING INFRASTRUCTURE

| ID | What | Severity | Notes |
|----|------|----------|-------|
| INF-01 | Write missing audit reports to repo root: `S1_CHAT_LAUNCH_CHAIN_AUDIT.md`, `PLUMBING_AND_INVARIANTS_AUDIT.md`, `UNIT_ECONOMICS_AUDIT.md`, `PUBLIC_INGRESS_SECURITY_AUDIT.md` | **P1** | These were generated but not committed; `Audit files.txt` is the only snapshot |
| INF-02 | Create `docs/audits/AUDIT_PROGRAM_INDEX.md` as canonical index | **P2** | Track all audits (A1–A10) with links to dispatch files and reports |
| INF-03 | Ensure all commits are pushed to local then to GitHub | **P1** | Per user preference: "i need the updates to be pushed to local then to github" |

---

## Quick Reference — Top 15 by Severity

| Rank | ID | What | Domain | Status |
|------|----|------|--------|--------|
| 1 | S1-01 | Research runtime Zod `_idmap` crash (861 failures, 0 tokens) | S1 Chat Launch | **Fixed 2026-06-21** — commit `c4b04adee` |
| 2 | S9/I10 | `scope_id` absent — no licensing barrier | Plumbing | Open |
| 3 | DC-01 | Keyboard F-key mapping shifted (F3–F12) | Deal Capsule | **Fixed 2026-06-20** — commit `4fe88cf7d` |
| 4 | DC-02 | F9 wrong `moduleId` (M08→M09) | Deal Capsule | **Fixed 2026-06-20** — commit `4fe88cf7d` |
| 5 | DC-03 | F10 wrong module (M13→M14) | Deal Capsule | **Fixed 2026-06-20** — commit `4fe88cf7d` |
| 6 | DC-04 | Visibility model 1D instead of 2D (use × archetype) | Deal Capsule | Partially fixed — columns added, predicates unwired |
| 7 | DC-05 | Land-use visibility guard missing (F6 should hide for Land) | Deal Capsule | Open |
| 8 | DC-27 | `deal_capsules` table missing CREATE TABLE | Deal Capsule | **Fixed 2026-06-20** — commit `4fe88cf7d` |
| 9 | DC-28 | `scope_id` missing from corpus tables | Deal Capsule | Partially fixed — added to `deal_assumptions` only |
| 10 | DC-30 | NOI formula bug (CF-01) — forces `egi - total_opex` | Deal Capsule | Open |
| 11 | PF-02 | Per-year overrides never consumed | ProForma | Open |
| 12 | PF-03 | Bad debt display uses GPR not EGI | ProForma | Open |
| 13 | AH-1A | Waterfall 404 — path mismatch | Asset Hub | Open |
| 14 | SCH-01 | Inngest `trafficCalibrationCron` redundant with node-cron | Scheduler | Open |
| 15 | SCH-02 | node-cron apartment locator sync duplicates Inngest | Scheduler | Open |

---

*End of comprehensive TODO. This file should be updated after each fix session. Mark items done with ✅ and date.*
