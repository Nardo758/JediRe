# Asset Hub Architecture Audit

**Scope:** Read-only architecture audit of the owned-asset console (Asset Hub) and every engine,
service, table, and route that a Revenue Management surface would need to consume.  
**Method:** Direct grep + psql verification — every file:line citation is confirmed in the codebase.  
**Property of record:** Highlands at Sweetwater Creek (`property_id = 7ea31caf-f070-43eb-9fd1-fe08f7123701`,
`deal_id = eaabeb9f-830e-44f9-a923-56679ad0329d`) — the sole owned-portfolio asset.

---

## Area 1 — Owned-Asset Console

**Entry page:** `frontend/src/pages/AssetOwnedPage.tsx` — 3,166 lines  
**Route:** `/assets-owned/:dealId/property` → `<AssetOwnedPage />` (`App.tsx:336`)

### Tab structure (`type TabType`, lines 26–32)

```
'overview' | 'performance' | 'comp-set'
'leasing' | 'traffic' | 'revenue'
'investors' | 'lifecycle' | 'exit-timing' | 'refi-monitor'
'ai-learning' | 'events' | 'activity'
'documents' | 'reports' | 'deal-team'
```

Rendered in 5 header groups (`TAB_GROUPS`, lines 2681–2706):

| Group label | Tabs |
|---|---|
| OPERATIONAL | Overview, Performance, Comp Set |
| REVENUE & OPS | Leasing, Traffic, Operations (id=`revenue`) |
| CAPITAL & DEBT | Investors, Lifecycle, Exit Timing, Refi Monitor |
| INTELLIGENCE | AI Learning, Events, Activity |
| ADMIN | Documents, Reports, Deal Team |

### Tab → component mapping (lines 3126–3158)

| Tab id | Renders | Notes |
|---|---|---|
| `overview` | `renderOverview()` | Inline function |
| `performance` | `<PerformanceTab dealId financials />` | External component |
| `comp-set` | `<CompSetTab dealId />` | `GET /api/v1/lifecycle/${dealId}/comp-set` |
| `leasing` | `renderLeasing()` | Inline, lines 2828–2920 |
| `revenue` | `<RevenueMgmtTab dealId deal />` | Inline component, line 540 — 8 sub-tabs |
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

### Key API calls (lines 1861, 2651–2654 and RevenueMgmtTab lines 551–627)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/deals/${dealId}/traffic/forecast-vs-actual?weeks=12` | Forecast vs actual (line 1861) |
| `GET /api/v1/portfolio/${dealId}/leasing?limit=100` | Monthly leasing stats → `setLeaseData` (line 2651) |
| `GET /api/v1/portfolio/${dealId}/traffic` | Weekly traffic → `setTrafficData` (line 2654) |
| `GET /api/v1/operations/${dealId}/rent-roll` | Rent roll snapshot (line 551) |
| `GET /api/v1/operations/${dealId}/other-income` | Other income (line 558) |
| `GET /api/v1/operations/${dealId}/monthly-actuals?limit=24` | Monthly actuals (line 565) |
| `GET /api/v1/operations/${dealId}/projected-vs-actual` | M22 comparison (PerformanceTab) |
| `GET /api/v1/operations/${dealId}/balance-sheet` | Balance sheet (line 459) |

**Data source verdict:** Mostly LIVE via real API routes.  
**Mock/placeholder:** Asset Allocation and Geographic Distribution panels in the Overview sub-view use hardcoded arrays (Class A/B/C splits; Atlanta/Tampa/Charlotte/Raleigh markets).

---

## Area 2 — DealStore + Owned-Asset Context

**DealContext definition:** `backend/src/types/dealContext.ts:604`

```typescript
/** @deprecated Use ResearchAgentContext instead. */
export type DealContext = ResearchAgentContext;
```

`ResearchAgentContext` is defined at line 171. The `property_type` union (line 130) includes
`'existing' | 'acquisition' | 'existing_acquisition' | 'stabilized'` but carries no
`is_portfolio_asset`, `ownedAsset`, `assetMode`, or `owned` flag.

**Owned-asset mode:** NOT PRESENT. The type is acquisition-centric (broker OM as ground truth).
No owned-asset selector exists in any Zustand store.

**Frontend:** `AssetOwnedPage` does not import or use `dealStore`. Local React state only.

> **GAP:** `DealContext` has no owned-asset variant. Any AI skill invoked from the Asset Hub
> receives the same context type as a deal-sourcing flow. Revenue Management agents that reason
> from trailing actuals (not forward OM assumptions) cannot be distinguished at the type level.

---

## Area 3 — Rent Roll + Lease Data

### Parsers

- `backend/src/services/rent-roll/rent-roll-parser.service.ts`
- `backend/src/services/document-extraction/parsers/rent-roll-parser.ts`

### Derivation service (`backend/src/services/rent-roll-derivations.service.ts`, 241 lines)

Computes the following from raw `rent_roll_units` rows (lines 54–213):

| Metric | Method | Line |
|---|---|---|
| `signing_velocity_24m` | 24-element monthly histogram, survivor-bias weighted | 54, 94 |
| `expiration_waterfall` | 24-month forward expiration count + pct | 56, 151 |
| `unit_type_breakdown` | Per-type signing velocity, days vacant, concession intensity, renewal rate | 57, 174 |
| `renewal_rate_proxy` | Renewal / recent-leases ratio (snapshot-date-anchored) | 55, 122 |

`loss_to_lease` and `loss_to_lease_pct` are generated columns in the `rent_roll_units` table
(not computed by this service).

All derivations are persisted back to `rent_roll_snapshots.derived_metrics` (JSONB, line 67).

### Lease Velocity Engine (`backend/src/services/lease-velocity-engine.ts`, 375 lines)

- `LeaseVelocityEngine` class at line 334. Three modes:
  `LEASE_UP_NEW_CONSTRUCTION`, `STABILIZED_MAINTENANCE`, `OCCUPANCY_RECOVERY`
- **Scenario engine, NOT live tracking.** Computes monthly leasing cost P&L, concession
  amortization, signing velocity, and stabilization timeline.
- Routes (mounted `index.replit.ts:743`):
  - `POST /api/v1/lease-velocity/run`
  - `POST /api/v1/lease-velocity/scenario`

### Operations routes for rent-roll data (`operations.routes.ts`, mounted `/api/v1/operations` at `index.replit.ts:717`)

| Endpoint | Line |
|---|---|
| `GET /:dealId/lease-expirations` | 302 |
| `GET /:dealId/rent-roll` | 391 |
| `POST /:dealId/rent-roll` | 317 |

**Note:** `GET /operations/:dealId/rent-roll` (line 401) queries `rent_roll_units WHERE deal_id = $1`
— it does NOT join via `property_id`. Highlands data in `rent_roll_units` must carry the correct
`deal_id` for this route to return rows.

### Table population (psql verified)

| Table | Row count | Notes |
|---|---|---|
| `rent_roll_units` | 1,740 | Highlands snapshots |
| `lease_tradeout_events` | 1,492 | 944 new-lease + 548 renewal trade-out events |
| `leasing_weekly_observations` | 276 | Jul 2021–Oct 2026 weekly data |

> **GAP — CRITICAL:** `leasing_weekly_observations` and `lease_tradeout_events` have NO HTTP
> route. The only trade-out reference via API is `inline-deals.routes.ts:2224`, which returns a
> `trade_out_analytics` JSONB blob from `rent_roll_snapshots` — a different table. The 1,492
> `lease_tradeout_events` rows and 276 `leasing_weekly_observations` rows are inaccessible to
> the frontend.

---

## Area 4 — Traffic Engine (M07)

### Service files (confirmed line counts)

| File | Lines |
|---|---|
| `backend/src/services/trafficPredictionEngine.ts` | 2,114 |
| `backend/src/services/multifamilyTrafficService.ts` | 661 |
| `backend/src/services/digitalTrafficService.ts` | 338 |
| `backend/src/services/leasingTrafficService.ts` | 287 |
| **Total** | **3,400** |

### Routes (all mounted in `backend/src/index.replit.ts`)

| Mount path | Router file | Line | Scope |
|---|---|---|---|
| `/api/v1/traffic` | `trafficPrediction.routes.ts` | 589 | predict, intelligence, validation, calibration |
| `/api/v1/traffic-ai` | `traffic-ai.routes.ts` | 528 | AI-generated traffic narrative |
| `/api/v1/traffic-data` | `traffic-data.routes.ts` | 686 | Raw data import/export |
| `/api/v1/traffic-comps` | `traffic-comps.routes.ts` | 687 | Comp benchmarking |
| `/api/v1/leasing-traffic` | `leasing-traffic.routes.ts` | 591 | Leasing funnel traffic |
| `/api/v1/portfolio/:dealId/traffic` | `portfolio.routes.ts:1141` | — | Reads `leasing_weekly_observations` |

### Table population (psql verified)

| Table | Row count | Notes |
|---|---|---|
| `traffic_predictions` | **0** | Engine not run for any property |
| `traffic_calibration_factors` | **0** | Migration added a column to an empty table |
| `validation_properties` | **0** | Empty |

**M07 output consumed by:** `m07-projections-adapter.ts` feeds occupancy projections into the
ProForma. The Asset Hub Traffic tab reads `GET /api/v1/portfolio/${dealId}/traffic`
(`portfolio.routes.ts:1141`), which queries `leasing_weekly_observations` — live for Highlands
(276 rows). The `traffic_predictions` ML output table is unused because no predictions have been
generated.

> **GAP:** Traffic engine code is fully built (3,400 lines) and routes are mounted, but all
> prediction/calibration tables are empty. The Asset Hub Traffic tab shows observed weekly data
> (`leasing_weekly_observations`) rather than ML predictions. No prediction has been run for any
> property. Forward rent/traffic signal requires running
> `POST /api/v1/traffic/predict/:propertyId`.

---

## Area 5 — Correlation Engine

### Files

- `backend/src/services/correlationEngine.service.ts` — MSA/submarket grain; per-property
  execution path begins at line 211
- `backend/src/services/portfolio-correlation.service.ts` — per-property binding layer

### Grain

The portfolio correlation service (lines 18–21) operates at property grain:

- **Input:** `deal_monthly_actuals WHERE is_portfolio_asset = TRUE`
- **Writes to:** `metric_time_series` with `geography_type = 'property'`
- **Cross-writes to:** `metric_correlations` for the property's submarket — **only if
  `properties.submarket_id` is set** (code comment: *"see task #1685 for mass-linking"*)

`correlationEngine.service.ts` per-property path (line 211+) receives `apartment_market_snapshots`
+ `metric_time_series` + `deal_monthly_actuals` as inputs. Primarily computes COR-01 through
COR-20+ signals.

### Routes (`correlation.routes.ts`, mounted `/api/v1/correlations` at `index.replit.ts:493`)

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

Portfolio-specific routes in `portfolio.routes.ts`:
- `POST /run-correlations` (line 1092) — triggers portfolio-correlation service
- `GET /correlation-signals` (line 1121) — reads cached signals

### Table population (psql verified)

| Table | Row count | Notes |
|---|---|---|
| `portfolio_correlation_coefficients` | 7 | |
| `portfolio_correlation_signals` | 30 | |
| `historical_observations` (parcel `p2122`) | 64 | Jul 2021–Oct 2026, `geography_level='property'` |

> **GAP:** Highlands (`property_id = 7ea31caf`) has `submarket_id = NULL`. Cross-metric
> correlations are NOT written to `metric_correlations` for the F4 submarket feed. The 30
> per-property COR signals are market-level only; no submarket linkage exists until
> `properties.submarket_id` is populated (see Task #1685).

---

## Area 6 — Market Comp / Rent Trend / Concession Feed

### CoStar integration

Upload/parse pipeline only — **no live API pull.**

| File | Role |
|---|---|
| `backend/src/api/rest/costar-upload.routes.ts` | File upload endpoint |
| `backend/src/services/valuation/costar-comp-upload.service.ts` | Processes uploaded CoStar exports |
| `backend/src/services/document-extraction/parsers/costar-submarket-parser.ts` | Parses CoStar submarket exports |
| `backend/src/services/document-extraction/vendor-registry/costar.vendor.ts` | Vendor registry declaration |
| `backend/src/agents/tools/fetch_costar_metrics.ts` | Agent tool (reads stored data) |
| `backend/src/agents/tools/fetch_costar_pipeline.ts` | Agent tool (reads stored data) |

### Provider registry

`backend/src/services/property-enrichment/rent-data/provider-registry.ts:8` — `ApartmentsComProvider`
is registered. CoStar live API is commented out (line 28: `// new CoStarAPIProvider()`).

### `apartment_market_snapshots` table

104 rows — populated. Used by:
- `f40-performance-score.service.ts:78` (submarket rent benchmarking)
- `correlationEngine.service.ts` (COR signal inputs)
- `concessions_prevalence` field consumed at `f40-performance-score.service.ts:257`

Contains aggregate `avg_rent` and `concessions_prevalence` — **no per-unit-type breakdown.**

### What IS wired to the frontend

- `GET /api/v1/correlations/property/:propertyId` returns COR signals including rent trend comparisons
- `f40-performance-score.service.ts` uses snapshot data for JEDI Score concession component

Neither surface exposes per-unit-type market rent to the Asset Hub leasing or revenue tabs.

> **GAP:** No live submarket rent-by-unit-type data feed. No RentCast API client exists in the
> codebase. CoStar is import-only. Concession prevalence is in `apartment_market_snapshots` but
> not piped to the Asset Hub Leasing or Revenue tabs. The Leasing tab's Loss-to-Lease metric
> (`AssetOwnedPage.tsx:2872`) shows `—` unless market rent is available at the
> `leasing_weekly_observations` level.

---

## Area 7 — M22 Post-Close / Actual-vs-Underwritten

### `deal_monthly_actuals` table

68 columns. Schema source: `backend/src/database/migrations/20260421_deal_monthly_actuals.sql`.

Three DB triggers auto-compute derived fields on insert/update:
- `trg_actuals_derived` → `fn_calculate_actuals_derived()`
- `trg_deal_monthly_actuals_fill_derived` → `deal_monthly_actuals_fill_derived()`
- `trg_deal_monthly_actuals_m22` → `deal_monthly_actuals_m22_fill_derived()`

### Population (psql verified)

| Property | Rows | Date range | Flag |
|---|---|---|---|
| Highlands (`7ea31caf`) | **53** | Dec 2021–Apr 2026 | `is_portfolio_asset=true` |
| Legacy property 1 (`656fe704`) | 24 | Aug 2017–Dec 2026 | — |
| Legacy property 2 (`fa526821`) | 12 | Mar 2025–Feb 2026 | — |

`deal_monthly_actuals_lines` (GL-level): **1,653 rows**. Schema: `property_code`, `period_month`,
`account_label`, `gl_range`, `amount`, `books`, `source_file`. Unique on
`(property_code, period_month, account_label)`.

### Routes (`operations.routes.ts`, mounted `/api/v1/operations`)

| Endpoint | Line | Purpose |
|---|---|---|
| `GET /:dealId/projected-vs-actual` | 631 | M22 comparison — the primary PvA endpoint |
| `GET /:dealId/monthly-actuals` | 752 | List actuals |
| `POST /:dealId/monthly-actuals` | 840 | Upsert actuals (M22 Tier-2 write path) |
| `POST /:dealId/actuals` | 220 | Alternative write path (older `operations_actuals` table) |
| `POST /:dealId/variances/compute` | 135 | Compute variances |
| `GET /:dealId/variances` | 113 | Read variances |

Upload flow: `POST /api/v1/reporting-package/upload` (`reporting-package.routes.ts:99`) —
multi-file upload + extraction pipeline. Variance endpoint at line 351.

### RevenueMgmtTab sub-tabs (`AssetOwnedPage.tsx:541, 591–598`)

| Sub-tab id | Label | Data source |
|---|---|---|
| `revenue-waterfall` | REVENUE | `GET /operations/:dealId/monthly-actuals?limit=24` |
| `rent-roll` | RENT ROLL | `GET /operations/:dealId/rent-roll` |
| `other-income` | OTHER INCOME | `GET /operations/:dealId/other-income` |
| `expenses` | EXPENSES | `GET /operations/:dealId/monthly-actuals?limit=24` |
| `variance` | BUDGET VS ACTUAL | (inline, no additional fetch) |
| `recommendations` | AI RECOMMENDATIONS | `<OperationsIntelligenceSection>` |
| `lease-expirations` | LEASE EXPIRATIONS | `GET /operations/:dealId/lease-expirations` |
| `balance-sheet` | BALANCE SHEET | `GET /operations/:dealId/balance-sheet` |

### M09 4-column panel status

`formula-engine.ts:951` defines an M22 formula for portfolio NOI/variance. The `PerformanceTab`
(line 3127) renders `projected-vs-actual` data. However, **no canonical M09 `CURRENT | ACTUALS TTM | PRO FORMA | Δ` 4-column live tracking component exists** in `AssetOwnedPage`.

> **GAP:** The revenue-waterfall sub-tab shows `emptyState('💰', 'NO REVENUE DATA', ...)` when
> `actuals.length === 0` (`AssetOwnedPage.tsx:624`). The `RevenueMgmtTab` triggers the
> `monthly-actuals` fetch only when `subTab === 'expenses'` (line 563) and lazily when
> `subTab === 'revenue-waterfall'` (line 626–629). The query at `operations.routes.ts:752` joins
> on `deal_id`, and Highlands actuals have `deal_id` set — but the join path needs verification
> since the canonical ownership flag is `is_portfolio_asset = TRUE` on `property_id`, not
> `deal_id`.

---

## Area 8 — Waterfall / Distributions

### Waterfall engine

`backend/src/services/module-wiring/formula-engine.ts:1300–1358` — computes:
- `tier_distribution` (line 1318)
- `gp_distribution` / `lp_distribution` (lines 1326–1327) as `distributable_amount × split`
- `lp_cash_on_cash` (line 1338)

These are **deal-level LP/GP percentage splits**, NOT per-member capital accounts.

### Routes (`investor-capital.routes.ts`, mounted `/api/v1/capital` at `index.replit.ts:725`)

| Endpoint group | Methods |
|---|---|
| `/investors` | GET, POST |
| `/investors/:investorId` | GET, PATCH, DELETE |
| `/deals/:dealId/investments` | GET, POST, PATCH, DELETE |
| `/deals/:dealId/capital-calls` | GET, POST |
| `/deals/:dealId/capital-calls/:callId/send` | POST (line 344) |
| `/deals/:dealId/capital-calls/:callId/items/:itemId/pay` | POST (line 360) |
| `/deals/:dealId/distributions` | GET, POST |

### Table population (psql verified)

| Table | Row count |
|---|---|
| `deal_waterfalls` | 1 |
| `deal_waterfall_tiers` | 1 |
| `capital_calls` | **0** |
| `distributions` | 2 |

**Frontend:** `<InvestorCapitalModule dealId />` renders at `activeTab === 'investors'`
(`AssetOwnedPage.tsx:3132`) — live component, reads from `/api/v1/capital`.

**Dual-waterfall:** NOT modeled. Only one waterfall structure exists. No operating-cash-flow
waterfall separate from a capital-event waterfall. No per-member capital account tracking.

> **GAP:** Waterfall engine computes deal-level LP/GP splits only. Per-investor capital accounts,
> cumulative preferred return tracking, and clawback logic are not implemented.
> Highlands has 0 capital calls and 2 distributions (likely seed data).
> `InvestorCapitalModule` is a live component but has no real data to render.

---

## Area 9 — Reports

### Commentary Agent (`backend/src/agents/commentary.agent.ts`, 758 lines)

- `CommentaryAgent.execute(input: CommentaryInput): Promise<CommentaryResult>` (line 78)
- Outputs (lines 128–132): `marketNarrative`, `investmentThesis`, `signalCommentary`,
  `riskOpportunity`, `peerContext`, `supplyNarrative`
- AI path: `jediAI.generate()` (Claude); falls back to rule-based generation
- Results cached in DB
- **Scope:** Market/deal-level narrative — NOT LP letters or IC memos

### Reporting package routes (`reporting-package.routes.ts`)

| Endpoint | Line |
|---|---|
| `POST /upload` | 99 (multi-file upload + extraction) |
| `GET /history` | 319 |
| `GET /variance` | 351 |

### Excel export (`backend/src/services/excel-export.service.ts`, 498 lines)

Sheets produced: Summary Page, Input, Property CF, Underwriting Analysis, Sensitivity Analysis,
Capex, Waterfall. This is the **F9 ProForma acquisition underwriting exporter** — not an
owned-asset operating report.

### What can be composed today

| Capability | Available |
|---|---|
| Commentary Agent — market/deal narrative | ✓ |
| Excel ProForma export — acquisition underwriting | ✓ |
| Variance report via `GET /api/v1/reporting-package/variance` | ✓ |

> **GAP:** No LP-letter template. No IC-memo template. No owned-asset quarterly operating report.
> Excel export is acquisition-oriented. Commentary Agent is market-focused, not
> asset-performance-focused. `ReportsTab` (`AssetOwnedPage.tsx:3155`) renders an external
> component whose scope was not fully audited here.

---

## Summary Classification Table

| Capability | Status | Blocker |
|---|---|---|
| Positions roll-up (units, occupancy, NOI) | **WIRED — live** | None. `deal_monthly_actuals` has 53 rows for Highlands; served via `GET /api/v1/operations/:dealId/monthly-actuals` |
| Revenue position (EGI → NOI waterfall) | **CODE-EXISTS-UNWIRED** | `RevenueMgmtTab` shows empty state when `actuals.length === 0` (line 624). Monthly-actuals fetch is lazy and the query join path (`deal_id` vs `property_id`) needs verification |
| Expiration exposure (24-month waterfall) | **CODE-EXISTS-UNWIRED** | `rent-roll-derivations.service.ts:151` computes it; `GET /operations/:dealId/lease-expirations` serves it; but `leasing_weekly_observations` (276 rows) and `lease_tradeout_events` (1,492 rows) have NO HTTP route |
| Comp/concession feed (market rents by unit type) | **MOCK-ONLY** | No live rent-by-unit-type API. CoStar is import-only. `apartment_market_snapshots` has 104 rows but no per-unit-type breakdown |
| Forward signal (traffic prediction) | **CODE-EXISTS-UNWIRED** | Engine is 3,400 lines with routes mounted; `traffic_predictions` table is empty (0 rows); no prediction has ever been generated |
| Performance/variance (actual vs pro forma) | **WIRED — live** | `GET /api/v1/operations/:dealId/projected-vs-actual` is live; `PerformanceTab` renders it |
| Distributions (LP/GP waterfall, capital accounts) | **CODE-EXISTS-UNWIRED** | `investor-capital.routes.ts` fully mounted; `InvestorCapitalModule` renders; 0 capital calls, 2 distributions, no per-member capital accounts |
| Reports (LP letter, IC memo, operating report) | **NOT BUILT** | Commentary Agent is market/acquisition-oriented; Excel export is acquisition ProForma only |

---

## Top 5 Blockers to Revenue Management

### Rank 1 — `leasing_weekly_observations` and `lease_tradeout_events` have no HTTP route

**Evidence:** Full search of `backend/src/api/rest/` — zero files reference either table name.
The tables hold 276 + 1,492 rows of Highlands data. The Leasing tab (`AssetOwnedPage.tsx:2651`)
calls `GET /api/v1/portfolio/${dealId}/leasing` (`portfolio.routes.ts:1184+`), which does read
`leasing_weekly_observations` for monthly stats — but the raw weekly-observation rows and the
full `lease_tradeout_events` detail (trade-out premium/discount per lease event) are not surfaced.
**Fix:** Add `GET /api/v1/operations/:dealId/leasing-observations` and
`GET /api/v1/operations/:dealId/tradeout-events` routes in `operations.routes.ts`.

### Rank 2 — Revenue waterfall sub-tab shows empty state despite 53 months of actuals

**Evidence:** `AssetOwnedPage.tsx:624` — `emptyState('💰', 'NO REVENUE DATA', ...)` fires when
`actuals.length === 0`. The `RevenueMgmtTab` triggers the `monthly-actuals` fetch only when
`subTab === 'expenses'` (line 563) and lazily fires a side-effectful fetch inside the render
function when `subTab === 'revenue-waterfall'` (lines 626–629 — this is a side effect inside JSX,
not in a `useEffect`, so it may not re-trigger). The query at `operations.routes.ts:752` joins on
`deal_id`, and Highlands actuals have `deal_id` set — but the canonical ownership flag is
`is_portfolio_asset = TRUE` keyed on `property_id`. **Fix:** (1) Move the revenue-waterfall
actuals fetch into the existing `useEffect` alongside the other sub-tab fetches; (2) verify that
`operations.routes.ts:752` resolves the `deal_id → property_id` path correctly.

### Rank 3 — Traffic engine tables empty; no prediction has ever been run

**Evidence:** psql confirms `traffic_predictions`: 0 rows, `traffic_calibration_factors`: 0 rows,
`validation_properties`: 0 rows. The engine is 3,400 lines and all routes are mounted
(`index.replit.ts:589`). The Asset Hub Traffic tab shows observed `leasing_weekly_observations`
data only — not ML predictions. The forward rent/occupancy signal requires calling
`POST /api/v1/traffic/predict/:propertyId` for Highlands (`7ea31caf`).

### Rank 4 — No owned-asset variant in `DealContext`; AI agents cannot distinguish owned from prospect

**Evidence:** `backend/src/types/dealContext.ts:604` — `DealContext = ResearchAgentContext`, which
is acquisition-centric with no `is_portfolio_asset` or `assetMode` field. Any AI skill called
from the Asset Hub receives the same context type as a deal-sourcing flow. Revenue Management
needs agents that reason from actuals (trailing) rather than OM assumptions (forward).
**Fix:** Extend `ResearchAgentContext` with an optional `assetMode: 'acquisition' | 'owned'` flag
and populate it when the context is assembled for an Asset Hub request.

### Rank 5 — LP/GP waterfall is deal-level splits only; no per-investor capital accounts

**Evidence:** `formula-engine.ts:1326–1327` — `gp_distribution` / `lp_distribution` computed as
`distributable_amount × split`. No per-member preferred return tracking, no cumulative
distribution ledger, no clawback logic. `capital_calls`: 0 rows; `distributions`: 2 rows (seed
data). `InvestorCapitalModule` is a live component but has no real investor data to render for
Highlands.

---

*Audit completed 2026-06-01. All file:line citations verified by direct grep/psql.*
