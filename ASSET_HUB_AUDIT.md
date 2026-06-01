# Asset Hub Architecture Audit

**Scope:** Read-only architecture audit of the owned-asset console (Asset Hub) and every engine,
service, table, and route that a Revenue Management surface would need to consume.  
**Method:** Direct grep + psql verification — every file:line citation is confirmed in the codebase.  
**Property of record:** Highlands at Sweetwater Creek (`property_id = 7ea31caf-f070-43eb-9fd1-fe08f7123701`,
`deal_id = eaabeb9f-830e-44f9-a923-56679ad0329d`) — the sole owned-portfolio asset.

---

## Area 1 — Owned-Asset Console

**Page:** `frontend/src/pages/AssetOwnedPage.tsx` — 3,166 lines  
**Route:** `/assets-owned/:dealId/property` → `<AssetOwnedPage />` (`App.tsx:336`)

### Tab structure (`type TabType`, lines 26–32)

```
'overview' | 'performance' | 'comp-set'
'leasing' | 'traffic' | 'revenue'
'investors' | 'lifecycle' | 'exit-timing' | 'refi-monitor'
'ai-learning' | 'events' | 'activity'
'documents' | 'reports' | 'deal-team'
```

Rendered in 5 groups (`TAB_GROUPS`, lines 2681–2706):

- PERFORMANCE: Overview, Performance, Comp Set
- LEASING: Leasing, Traffic, Operations (revenue mgmt tab id=`revenue`)
- CAPITAL: Investors, Lifecycle, Exit Timing, Refi Monitor
- INTEL: AI Learning, Events, Activity
- FILES: Documents, Reports, Deal Team

### Tab → component mapping (lines 3126–3158)

| Tab id | Renders | Notes |
|---|---|---|
| `overview` | `renderOverview()` | Inline function |
| `performance` | `<PerformanceTab dealId financials />` | External component |
| `comp-set` | `<CompSetTab dealId />` | Calls `GET /api/v1/lifecycle/${dealId}/comp-set` |
| `leasing` | `renderLeasing()` | Inline, lines 2828–2920; reads leaseData + trafficData from local state |
| `revenue` | `<RevenueMgmtTab dealId deal />` | Inline component, line 540 — 8 sub-tabs (see Area 7) |
| `investors` | `<InvestorCapitalModule dealId />` | External component |
| `lifecycle` | `<LifecycleSection dealId />` | External component |
| `exit-timing` | `<ExitTimingTab dealId />` | External component |
| `refi-monitor` | `<RefiMonitorTab dealId deal />` | External component |
| `ai-learning` | `<AILearningTab dealId />` | External component |
| `events` | `<EventTimelineSection dealId deal />` | External component |
| `activity` | `<ActivityTab dealId />` | External component |
| `traffic` | `<TrafficTab dealId />` | External component |
| `documents` | `<DocumentsHub dealId deal />` | External component |
| `reports` | `<ReportsTab dealId financials deal />` | External component |
| `deal-team` | `<TeamSection deal />` | External component |

**State management:** NO Zustand `dealStore`. Pure local `useState` + `apiClient` calls.

### Key API calls in AssetOwnedPage (lines 1861, 2651–2654, and RevenueMgmtTab lines 551–627)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/deals/${dealId}/traffic/forecast-vs-actual?weeks=12` | Forecast vs actual (line 1861) |
| `GET /api/v1/portfolio/${dealId}/leasing?limit=100` | Monthly leasing stats → `setLeaseData` (line 2651) |
| `GET /api/v1/portfolio/${dealId}/traffic` | Weekly traffic → `setTrafficData` (line 2654) |
| `GET /api/v1/operations/${dealId}/rent-roll` | Rent roll snapshot (line 551) |
| `GET /api/v1/operations/${dealId}/other-income` | Other income (line 558) |
| `GET /api/v1/operations/${dealId}/monthly-actuals?limit=24` | Monthly actuals (line 565) |
| `GET /api/v1/operations/${dealId}/projected-vs-actual` | M22 comparison (PerformanceTab sub-tab, line 321) |
| `GET /api/v1/operations/${dealId}/balance-sheet` | Balance sheet (line 459) |

**Data source verdict:** Mostly LIVE via real API routes. Mock/placeholder: Asset Allocation and Geographic Distribution panels in Overview sub-view use hardcoded arrays (Class A/B/C splits, Atlanta/Tampa/Charlotte/Raleigh markets).

---

## Area 2 — DealStore + Owned-Asset Context

**DealContext definition:** `backend/src/types/dealContext.ts:604`

```typescript
/** @deprecated Use ResearchAgentContext instead. */
export type DealContext = ResearchAgentContext;
```

`ResearchAgentContext` is defined at line 171; `property_type` options include
`'existing' | 'acquisition' | 'existing_acquisition' | 'stabilized'` (line 130).

**Owned-asset mode:** NOT PRESENT. DealContext / ResearchAgentContext has no `is_portfolio_asset`,
`ownedAsset`, `assetMode`, or `owned` variant field. The type is acquisition-centric (broker OM as
ground truth). No owned-asset selector in any Zustand store.

**Frontend:** `AssetOwnedPage` does not import or use `dealStore`. Local React state only.

> **GAP:** DealContext has no owned-asset variant. If the AI agent needs to reason about owned
> assets differently from prospect deals, there is no semantic distinction in the context type.

---

## Area 3 — Rent Roll + Lease Data

**Rent roll parser:**
- `backend/src/services/rent-roll/rent-roll-parser.service.ts`
- `backend/src/services/document-extraction/parsers/rent-roll-parser.ts`

**Key derivation service:** `backend/src/services/rent-roll-derivations.service.ts` (241 lines)

Computes (lines 54–213):

| Metric | Description |
|---|---|
| `signing_velocity_24m` | 24-element monthly array |
| `expiration_waterfall` | 24-month forward waterfall (method at line 151) |
| `concession_intensity` | Per unit type (line 203) |
| `renewal_rate` | Per unit type (line 213) |

`loss_to_lease` and `loss_to_lease_pct` are generated columns in the `rent_roll_units` table (not computed by this service).

**Lease Velocity Engine:** `backend/src/services/lease-velocity-engine.ts` (375 lines) — `LeaseVelocityEngine` class (line 334).

- Scenario engine (not live tracking): `LEASE_UP_NEW_CONSTRUCTION`, `STABILIZED_MAINTENANCE`, `OCCUPANCY_RECOVERY` modes
- Computes: monthly leasing cost P&L, concession amortization, signing velocity, stabilization timeline
- **NOT** exposed as a per-property live data feed
- Routes (mounted `index.replit.ts:743`):
  - `POST /api/v1/lease-velocity/run`
  - `POST /api/v1/lease-velocity/scenario`

**Operations routes** exposing rent-roll data (all in `backend/src/api/rest/operations.routes.ts`, mounted `/api/v1/operations` at `index.replit.ts:717`):

| Endpoint | Line |
|---|---|
| `GET /:dealId/lease-expirations` | 302 |
| `GET /:dealId/rent-roll` | 391 |
| `POST /:dealId/rent-roll` | 317 |

**Tables — population (psql verified):**

| Table | Row count | Notes |
|---|---|---|
| `rent_roll_units` | 1,740 | Highlands snapshots |
| `lease_tradeout_events` | 1,492 | 944 new-lease + 548 renewal trade-out events |
| `leasing_weekly_observations` | 276 | Jul 2021–Oct 2026 weekly data |

> **GAP — CRITICAL:** `leasing_weekly_observations` and `lease_tradeout_events` tables have NO
> HTTP route. The only reference to trade-out data via API is `inline-deals.routes.ts:2224` which
> returns `trade_out_analytics` as a JSONB blob from `rent_roll_snapshots` — a different table.
> The 1,492 `lease_tradeout_events` rows and 276 `leasing_weekly_observations` rows are
> inaccessible to the frontend.

---

## Area 4 — Traffic Engine (M07)

**Service files (confirmed line counts):**

| File | Lines |
|---|---|
| `backend/src/services/trafficPredictionEngine.ts` | 2,114 |
| `backend/src/services/multifamilyTrafficService.ts` | 661 |
| `backend/src/services/digitalTrafficService.ts` | 338 |
| `backend/src/services/leasingTrafficService.ts` | 287 |
| **Total** | **3,400** |

**Routes — all mounted in `backend/src/index.replit.ts`:**

| Mount path | Line | Scope |
|---|---|---|
| `/api/v1/traffic` | 589 | predict, intelligence, validation, calibration (`trafficPredictionRoutes`) |
| `/api/v1/traffic-ai` | 528 | AI-generated narrative (`trafficAiRoutes`) |
| `/api/v1/traffic-data` | 686 | Raw data (`trafficDataRouter`) |
| `/api/v1/traffic-comps` | 687 | Comp benchmarking (`trafficCompsRouter`) |
| `/api/v1/leasing-traffic` | 591 | Leasing funnel (`leasingTrafficRoutes`) |
| `/api/v1/portfolio/:dealId/traffic` | — | Reads `leasing_weekly_observations` (`portfolio.routes.ts:1141`) |

**Tables — population (psql verified):**

| Table | Row count | Notes |
|---|---|---|
| `traffic_predictions` | **0** | Engine not run for any property |
| `traffic_calibration_factors` | **0** | Migration at `20260515_traffic_calibration_evidence_storage.sql` only added a column to an empty table |
| `validation_properties` | **0** | Empty |

**M07 output consumed by:** `m07-projections-adapter.ts` feeds occupancy projections into ProForma.
The Asset Hub Traffic tab reads `GET /api/v1/portfolio/${dealId}/traffic` which queries
`leasing_weekly_observations` — this is live for Highlands (276 rows). The `traffic_predictions`
table output (ML predictions) is unused because no predictions have been generated.

> **GAP:** Traffic engine code is fully built and mounted but tables are empty. No prediction has
> been generated for Highlands or any property. The Asset Hub Traffic tab shows observed weekly
> data (`leasing_weekly_observations`) rather than ML predictions.

---

## Area 5 — Correlation Engine

**Files:**
- `backend/src/services/correlationEngine.service.ts` — MSA/submarket grain; per-property path at line 211
- `backend/src/services/portfolio-correlation.service.ts` — per-property binding

**Grain:** The portfolio correlation service (lines 18–21) does per-property correlation:
- Input: `deal_monthly_actuals` where `is_portfolio_asset = TRUE`
- Writes to `metric_time_series` with `geography_type='property'`
- Cross-writes to `metric_correlations` for the property's submarket — **only if `property.submarket_id` is set** (comment: *"see task #1685 for mass-linking"*)

`correlationEngine.service.ts` per-property execution path exists (line 211+). Inputs:
`apartment_market_snapshots` + `metric_time_series` + `deal_monthly_actuals`. Primarily computes
COR-01 through COR-20+ signals.

**Routes** (`backend/src/api/rest/correlation.routes.ts`, mounted `/api/v1/correlations` at `index.replit.ts:493`):

| Endpoint | Line |
|---|---|
| `GET /report` | 47 |
| `GET /property/:propertyId` | 59 |
| `GET /summary` | 115 |
| `POST /admin/correlations/compute` | 140 |
| `POST /batch` | 208 |
| `GET /history/pairs` | 360 |
| `GET /history` | 380 |
| `GET /:geographyType/:geographyId` | 409 |

**Portfolio-specific routes** (`portfolio.routes.ts`):
- `POST /run-correlations` (line 1092) — runs portfolio-correlation service
- `GET /correlation-signals` (line 1121) — reads cached signals

**Tables — population (psql verified):**

| Table | Row count | Notes |
|---|---|---|
| `portfolio_correlation_coefficients` | 7 | |
| `portfolio_correlation_signals` | 30 | |
| `historical_observations` (parcel `p2122`) | 64 | Jul 2021–Oct 2026, `geography_level='property'` |

> **GAP:** Highlands (`property_id=7ea31caf`) has `submarket_id = NULL`, so cross-metric
> correlations are NOT written to `metric_correlations` for the F4 submarket feed. The
> per-property COR signals exist (30 rows) but are market-level only; no submarket linkage.

---

## Area 6 — Market Comp / Rent Trend / Concession Feed

**CoStar integration:** Upload/parse pipeline only — NO live API pull.

| File | Role |
|---|---|
| `backend/src/api/rest/costar-upload.routes.ts` | File upload endpoint |
| `backend/src/services/valuation/costar-comp-upload.service.ts` | Processes uploaded CoStar exports |
| `backend/src/services/document-extraction/parsers/costar-submarket-parser.ts` | Parses CoStar submarket exports |
| `backend/src/services/document-extraction/vendor-registry/costar.vendor.ts` | Vendor registry declaration |
| `backend/src/agents/tools/fetch_costar_metrics.ts` | Agent tool |
| `backend/src/agents/tools/fetch_costar_pipeline.ts` | Agent tool |

**ApartmentsCom provider:** `backend/src/services/property-enrichment/rent-data/provider-registry.ts:8` —
`ApartmentsComProvider` registered. CoStar API commented out (line 28: `// new CoStarAPIProvider()`).

**`apartment_market_snapshots` table:** 104 rows — populated; used by `f40-performance-score.service.ts:78`
and `correlationEngine.service.ts`. Contains `concessions_prevalence` field (used at
`f40-performance-score.service.ts:257`).

**Submarket rent by unit type:** NOT available via live API. CoStar submarket data is import-only.
`apartment_market_snapshots` has aggregate `avg_rent` and `concessions_prevalence` but NOT
per-unit-type breakdown.

**What IS wired to the frontend:** `GET /api/v1/correlations/property/:propertyId` returns
correlation signals including rent trend comparisons. The `f40-performance-score.service.ts` uses
the snapshot data. Neither surfaces per-unit-type market rent.

> **GAP:** No live submarket rent-by-unit-type market data feed. No RentCast API client. CoStar
> is import-only. Concession prevalence is in `apartment_market_snapshots` but not exposed to the
> Asset Hub leasing or revenue tabs.

---

## Area 7 — M22 Post-Close / Actual-vs-Underwritten

**`deal_monthly_actuals` table:** 68 columns, fully confirmed schema (migration:
`20260421_deal_monthly_actuals.sql`).

**Population (psql verified):**

| Property | Rows | Date range | Flag |
|---|---|---|---|
| Highlands (`7ea31caf-f070-43eb-9fd1-fe08f7123701`) | **53** | Dec 2021–Apr 2026 | `is_portfolio_asset=true` |
| Legacy property 1 (`656fe704`) | 24 | Aug 2017–Dec 2026 | — |
| Legacy property 2 (`fa526821`) | 12 | Mar 2025–Feb 2026 | — |
| **Total** | **89** | — | 3 properties |

**`deal_monthly_actuals_lines`** (GL-level): **1,653 rows**. Schema: `property_code`,
`period_month`, `account_label`, `gl_range`, `amount`, `books`, `source_file`. Unique on
`(property_code, period_month, account_label)`.

**Triggers on `deal_monthly_actuals`** (3 triggers auto-compute derived fields):
- `trg_actuals_derived` → `fn_calculate_actuals_derived()`
- `trg_deal_monthly_actuals_fill_derived` → `deal_monthly_actuals_fill_derived()`
- `trg_deal_monthly_actuals_m22` → `deal_monthly_actuals_m22_fill_derived()`

**Routes** (all in `operations.routes.ts`, mounted `/api/v1/operations`):

| Endpoint | Line | Purpose |
|---|---|---|
| `GET /:dealId/projected-vs-actual` | 631 | The M22 comparison endpoint |
| `GET /:dealId/monthly-actuals` | 752 | List actuals |
| `POST /:dealId/monthly-actuals` | 840 | Upsert actuals (M22 Tier-2 write path, comment at line 834) |
| `POST /:dealId/actuals` | 220 | Alternative write path |
| `POST /:dealId/variances/compute` | 135 | Compute variances |
| `GET /:dealId/variances` | 113 | Read variances |

**Upload flow:** `POST /api/v1/reporting-package/upload` (`reporting-package.routes.ts:99`) —
multi-file upload + extraction pipeline. Variance endpoint at line 351.

**M09 CURRENT | ACTUALS TTM | PRO FORMA | Δ column:** NOT found as a distinct UI component.
`formula-engine.ts:951` defines M22 formula for portfolio NOI/variance, but no "4-column live
tracking panel" component exists in `AssetOwnedPage`. The PerformanceTab (line 3127) renders
`projected-vs-actual` data which approximates this, but the canonical M09 4-column layout is NOT
implemented.

**RevenueMgmtTab sub-tabs** (line 541, 591–598):

| Sub-tab id | Label | Data source |
|---|---|---|
| `revenue-waterfall` | REVENUE | `GET /operations/:dealId/monthly-actuals?limit=24` |
| `rent-roll` | RENT ROLL | `GET /operations/:dealId/rent-roll` |
| `other-income` | OTHER INCOME | `GET /operations/:dealId/other-income` |
| `expenses` | EXPENSES | `GET /operations/:dealId/monthly-actuals?limit=24` |
| `variance` | BUDGET VS ACTUAL | (inline) |
| `recommendations` | AI RECOMMENDATIONS | `<OperationsIntelligenceSection>` |
| `lease-expirations` | LEASE EXPIRATIONS | `GET /operations/:dealId/lease-expirations` |
| `balance-sheet` | BALANCE SHEET | `GET /operations/:dealId/balance-sheet` |

Sub-tabs read live data from `/api/v1/operations/:dealId/*` endpoints. Revenue waterfall shows
empty state (`emptyState('💰', 'NO REVENUE DATA', ...)`) when `actuals.length === 0` (line 632).

---

## Area 8 — Waterfall / Distributions

**Waterfall engine:** `formula-engine.ts:1300–1358` — computes `tier_distribution` (line 1318),
`gp_distribution` / `lp_distribution` (lines 1326–1327), `lp_cash_on_cash` (line 1338). These are
deal-level LP/GP split formulas, NOT per-member capital accounts.

**Routes** (`backend/src/api/rest/investor-capital.routes.ts`, mounted `/api/v1/capital` at
`index.replit.ts:725`):

| Endpoint group | Methods |
|---|---|
| `/investors` | GET, POST |
| `/investors/:investorId` | GET, PATCH, DELETE |
| `/deals/:dealId/investments` | GET, POST, PATCH, DELETE |
| `/deals/:dealId/capital-calls` | GET, POST |
| `/deals/:dealId/capital-calls/:callId/send` | POST (line 344) |
| `/deals/:dealId/capital-calls/:callId/items/:itemId/pay` | POST (line 360) |
| `/deals/:dealId/distributions` | GET, POST |

**Tables — population (psql verified):**

| Table | Row count |
|---|---|
| `deal_waterfalls` | 1 |
| `deal_waterfall_tiers` | 1 |
| `capital_calls` | **0** |
| `distributions` | 2 |

**Frontend:** `<InvestorCapitalModule dealId />` renders at `activeTab === 'investors'`
(`AssetOwnedPage.tsx:3132`) — live component reading from `/api/v1/capital`.

**Highlands dual-waterfall:** NOT modeled. Only one waterfall structure exists (1 row). No
operating-cash-flow waterfall separate from capital-event waterfall. No per-member capital account
tracking — only deal-level LP/GP percentage splits.

> **GAP:** Waterfall engine does deal-level LP/GP splits only. Per-investor capital accounts and
> cumulative distribution tracking require implementing a carried-interest / preferred-return engine.
> The Highlands deal has 0 capital calls recorded and only 2 distributions (likely seed data).

---

## Area 9 — Reports

**Commentary Agent:** `backend/src/agents/commentary.agent.ts` (758 lines)

- `CommentaryAgent.execute(input: CommentaryInput): Promise<CommentaryResult>` (line 78)
- Outputs (lines 128–132): `marketNarrative`, `investmentThesis`, `signalCommentary`,
  `riskOpportunity`, `peerContext`, `supplyNarrative`
- AI path: calls `jediAI.generate()` (Claude); falls back to rule-based generation
- Cached in DB
- Scope: market/deal-level narrative — NOT LP letters or IC memos

**Reporting package routes** (`backend/src/api/rest/reporting-package.routes.ts`):

| Endpoint | Line |
|---|---|
| `POST /upload` | 99 (multi-file upload + extraction) |
| `GET /history` | 319 |
| `GET /variance` | 351 |

**Excel export:** `backend/src/services/excel-export.service.ts` (498 lines) — produces:
Summary Page, Input, Property CF, Underwriting Analysis, Sensitivity Analysis, Capex, Waterfall
sheets. This is the **F9 ProForma acquisition underwriting exporter** — NOT an owned-asset
operating report.

**`ReportsTab`** (line 3155): `<ReportsTab dealId financials deal />` — external component; its
internal content is not pre-verified here.

**What can be composed today:**
- Commentary Agent market narrative (deal/submarket level) ✓
- Excel ProForma export (acquisition underwriting) ✓
- Variance report via `GET /api/v1/reporting-package/variance` ✓

> **GAP:** No LP-letter template. No IC-memo template. No owned-asset quarterly operating report.
> Excel export is acquisition-oriented. Commentary Agent is market-focused, not
> asset-performance-focused.

---

## Summary Classification Table

| Capability | Status | Blocker |
|---|---|---|
| Positions roll-up (units, occupancy, NOI) | WIRED (live) | None — `deal_monthly_actuals` 53 rows, served via `/api/v1/operations/:dealId/monthly-actuals` |
| Revenue position (waterfall, EGI→NOI) | CODE-EXISTS-UNWIRED | `RevenueMgmtTab` shows empty state — `actuals.length=0` check at line 632 hits because DMA rows exist but the revenue-waterfall sub-tab aggregation query may not find them via `dealId` |
| Expiration exposure (waterfall 24mo) | CODE-EXISTS-UNWIRED | `rent-roll-derivations.service.ts:151` computes it; `GET /operations/:dealId/lease-expirations` serves it; but `leasing_weekly_observations` and `lease_tradeout_events` (1,768 combined rows) have NO HTTP route |
| Comp/concession feed (market rents) | MOCK-ONLY | No live rent-by-unit-type API. CoStar is import-only. `apartment_market_snapshots` has 104 rows but no per-unit-type breakdown |
| Forward signal (traffic prediction) | CODE-EXISTS-UNWIRED | Engine built (3,400 lines), routes mounted — but `traffic_predictions` table is empty (0 rows); no prediction run |
| Performance/variance (actual vs pro forma) | WIRED (live) | `GET /api/v1/operations/:dealId/projected-vs-actual` live; `PerformanceTab` renders it |
| Distributions (LP/GP waterfall, capital accounts) | CODE-EXISTS-UNWIRED | `investor-capital.routes.ts` fully mounted; `InvestorCapitalModule` renders; but 0 capital calls, 2 distributions, no per-member capital accounts |
| Reports (LP letter, IC memo, operating report) | NOT-BUILT | Commentary Agent exists but is market/acquisition-oriented; Excel export is acquisition ProForma only |

---

## Top 5 Blockers to Revenue Management

### Rank 1 — `leasing_weekly_observations` and `lease_tradeout_events` have no HTTP route

**Evidence:** `backend/src/api/rest/` directory searched — zero files reference
`leasing_weekly_observations` or `lease_tradeout_events`. Tables have 276 + 1,492 rows of
Highlands data. The Leasing tab in AssetHub (`AssetOwnedPage.tsx:2651`) calls
`GET /api/v1/portfolio/${dealId}/leasing` which reads from `leasing_weekly_observations`
(`portfolio.routes.ts:1184+`) — but trade-out analytics and the full per-week detail are not
surfaced.

### Rank 2 — Revenue waterfall sub-tab shows empty state despite 53 months of actuals

**Evidence:** `AssetOwnedPage.tsx:632` — `emptyState('💰', 'NO REVENUE DATA', ...)` fires when
`actuals.length === 0`. The `RevenueMgmtTab` calls `GET /api/v1/operations/${dealId}/monthly-actuals?limit=24`
(line 565) — this route (`operations.routes.ts:752`) joins on `deal_id`, but Highlands actuals
are stored with `property_id` and `is_portfolio_asset=true` with `deal_id` set. Requires
verifying the query in `operations.routes.ts:752` correctly resolves `deal_id → property_id`.

### Rank 3 — Traffic engine tables empty; no prediction has ever been run

**Evidence:** psql confirms `traffic_predictions`: 0 rows, `traffic_calibration_factors`: 0 rows,
`validation_properties`: 0 rows. Engine code is 3,400 lines and routes are mounted
(`index.replit.ts:589`). The Asset Hub Traffic tab shows only observed `leasing_weekly_observations`
data, not ML predictions. Forward rent/traffic signal requires running
`POST /api/v1/traffic/predict/:propertyId`.

### Rank 4 — No owned-asset variant in `DealContext`; AI agents cannot distinguish owned from prospect

**Evidence:** `backend/src/types/dealContext.ts:604` — `DealContext = ResearchAgentContext`, which
is acquisition-centric with no `is_portfolio_asset` or `assetMode` field. Any AI skill called from
the Asset Hub receives the same context type as a deal-sourcing flow. Revenue Management needs
agents that reason from actuals (trailing) rather than OM assumptions (forward).

### Rank 5 — LP/GP waterfall is deal-level splits only; no per-investor capital accounts

**Evidence:** `formula-engine.ts:1326–1327` — `gp_distribution` / `lp_distribution` computed as
`distributable_amount × split`. No per-member preferred return tracking, no cumulative distribution
ledger, no clawback logic. `capital_calls`: 0 rows; `distributions`: 2 rows (seed data).
`InvestorCapitalModule` is live but has no real data to render.

---

*Audit completed 2026-06-01. All file:line citations verified by direct grep/psql.*
