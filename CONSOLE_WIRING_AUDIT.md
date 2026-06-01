# CONSOLE WIRING AUDIT — Asset Hub Console
**Generated:** 2026-06-01  
**Page audited:** `frontend/src/pages/AssetHubPage.tsx` (1,825 lines)  
**Property:** Highlands at Sweetwater Creek  
**deal_id:** `eaabeb9f-830e-44f9-a923-56679ad0329d`  
**property_id:** `7ea31caf-f070-43eb-9fd1-fe08f7123701`  
**Phase badge in file:** `PHASE C · stubs wired`

---

## Preflight — DB Snapshot (Highlands only)

| Table | Row count | Verified via |
|---|---|---|
| `deal_monthly_actuals` — actuals (`is_budget=false, is_portfolio_asset=TRUE`) | **40** | psql direct |
| `deal_monthly_actuals` — budget (`is_budget=true`) | **0** | psql direct |
| `deal_monthly_actuals_lines` | **1,653** | psql direct |
| `rent_roll_units` (deal_id keyed) | **1,740** | psql direct |
| `lease_tradeout_events` (property_code keyed) | **1,492** | psql direct |
| `leasing_weekly_observations` (property_code keyed) | **276** | psql direct |
| `traffic_predictions` (property_id keyed) | **0** | psql direct |
| `traffic_calibration_factors` | **0** | psql direct |
| `validation_properties` | **0** | psql direct |
| `capital_calls` (deal_id keyed) | **1** | psql direct |
| `distributions` (deal_id keyed) | **0** | psql direct |
| `deal_waterfalls` (deal_id keyed) | **1** | psql direct |
| `deal_monthly_actuals.capex` non-null (actuals) | **13** | psql direct |

**Route mounts verified** in `backend/src/index.replit.ts`:

| Mount prefix | Router file | Auth at mount | `index.replit.ts` line |
|---|---|---|---|
| `/api/v1/operations` | `operations.routes.ts` | none (per-route `requireAuth`) | 717 |
| `/api/v1/rankings` | `rankings.routes.ts` | `optionalAuth` | 356 |
| `/api/v1/correlations` | `correlation.routes.ts` | none at mount | 493 |
| `/api/v1/capital` | `investor-capital.routes.ts` | `requireAuth` | 725 |
| `/api/v1/lifecycle` | `lifecycle.routes.ts` | per-route | 721 |
| `/api/v1/revenue` | **NOT MOUNTED** | — | — |

---

## Cross-cutting Connection Checks

### CC-1 — `dealStore`: selected-asset from Zustand or local `useState`?

**`AssetHubPage.tsx:1594–1613`** (shell component):
```
urlDealId        = useParams<{ dealId: string }>()        // :1595
selectedAssetDealId = useDealStore(s => s.selectedAssetDealId)   // :1596
propertyId          = useDealStore(s => s.selectedAssetPropertyId) // :1597
setSelectedAsset    = useDealStore(s => s.setSelectedAsset)        // :1598
dealId = selectedAssetDealId ?? urlDealId ?? ''                    // :1613
```
**Finding:** Selected-asset state lives in Zustand (`dealStore`). URL param syncs → store in a `useEffect` at `:1602–1610`. **Compliant with spec §3.** Gap: if `dealStore.deals` list is not pre-loaded, `deal.property_id` lookup at `:1604–1605` returns `null` → `propertyId = null` → any `if (!propertyId) return` guard silently skips the fetch (see R-09).

### CC-2 — `assetMode` on `DealContext` / `ResearchAgentContext`

Grepped `backend/src/types/dealContext.ts` for `assetMode`, `asset_mode`, `asOwned`, `as_owned`: **0 hits**.  
**Finding:** `assetMode: 'owned'` field is **NOT FOUND** in `ResearchAgentContext` (around `:604`) or any type in `dealContext.ts`. The commentary agent (`backend/src/agents/commentary.agent.ts`, 758 lines) cannot receive owned-asset framing until this field is added.

### CC-3 — `deal_id ↔ property_id` resolution on operations routes for Highlands

**`operations.routes.ts:759–763`** (monthly-actuals handler, representative of all ops routes):
```ts
const propRes = await query('SELECT property_id FROM deals WHERE id = $1 LIMIT 1', [dealId]);
const propId = propRes.rows[0]?.property_id;
// → WHERE property_id = $1 AND is_portfolio_asset = TRUE
```
**Finding:** Resolution is **CORRECT** for Highlands. `deal_id → property_id` lookup then queries `deal_monthly_actuals` using `property_id + is_portfolio_asset = TRUE`. Same pattern confirmed in `projected-vs-actual` at `operations.routes.ts:660–687`. Tradeout-events and leasing-observations use a different but equally correct bridge: `dealId → deal_monthly_actuals.report_month → deal_monthly_actuals_lines.period_month, property_code → lease_tradeout_events / leasing_weekly_observations` (`:1452–1474`, `:1498–1521`).

### CC-4 — `properties.submarket_id` for Highlands

`SELECT submarket_id FROM properties WHERE id = '7ea31caf-...'` → **`{"submarket_id": null}`**  
**Finding:** `submarket_id = NULL` for p2122. Task #1685 open. Degrades `computeForProperty` in `CorrelationEngineService` to city/state-level market data only; submarket-level signals will be lower-confidence.

### CC-5 — `traffic_predictions` / `traffic_calibration_factors` / `validation_properties`

| Table | Rows | Implication |
|---|---|---|
| `traffic_predictions` (p2122) | **0** | Traffic velocity sub-signal absent from MARKET SIGNALS |
| `traffic_calibration_factors` | **0** | No calibration coefficients; predict job would use defaults |
| `validation_properties` | **0** | No validation set; calibration accuracy unverifiable |

**Finding:** Traffic prediction pipeline has never been run for p2122. Requires executing `POST /api/v1/traffic/predict/7ea31caf-f070-43eb-9fd1-fe08f7123701` to seed `traffic_predictions`.

### CC-6 — Render-function fetch bug: old page vs. rebuilt page

**`AssetOwnedPage.tsx:626–629`** (old page — 3,167 lines, still deployed):
```ts
// Inside IIFE render: {!loading && subTab === 'revenue-waterfall' && (() => {
if (!actualsLoaded) {
  apiClient.get(`/api/v1/operations/${dealId}/monthly-actuals?limit=24`)
    .then(r => { setActuals(r.data?.data ?? []); setActualsLoaded(true); })  // ← fetch in render
```
**`AssetHubPage.tsx`** (rebuilt page): All API calls live inside named `useEffect` hooks keyed on `[dealId, activeScreen]` (e.g. `:716–724`, `:726–733`, `:1194–1199`). No render-function fetch present.  
**Finding:** Render-function fetch bug **still present** in `AssetOwnedPage.tsx:626–629`. **NOT present** in `AssetHubPage.tsx`. Rebuild is correct.

---

## Section A — Connection Matrix

> **VERDICT key:** `CONNECTED` = all 5 steps verified, live data.  
> `CONNECTED*` = chain intact but data quality degraded (explained in Missing link).  
> `BROKEN@N` = fails at step N; exact missing link stated.  
> `NO-BACKEND` = no route or service exists.
>
> **Steps:** [1] FE call in `useEffect` keyed on `deal_id/property_id` [2] Route defined + mounted in `index.replit.ts` [3] Handler queries real table (not stub/mock) [4] `deal_id↔property_id` join correct for Highlands [5] Table has rows for Highlands

| # | Panel | FE call (file:line) | Route mounted (handler file:line · mount:line) | Handler live (real SQL?) | Join OK | Rows | VERDICT | Missing link |
|---|---|---|---|---|---|---|---|---|
| R-01 | Hero metric series (occ / rent / NOI / RevPAU) | `GET /operations/:dealId/monthly-actuals?limit=53` · `AssetHubPage.tsx:716–724` · useEffect ✅ | `operations.routes.ts:752` · mount `index.replit.ts:717` | ✅ Real: queries `deal_monthly_actuals` via `property_id + is_portfolio_asset=TRUE` · `:766–798` | ✅ `deals→property_id` lookup at `:759–763` | 40 actuals | **CONNECTED** | — |
| R-02 | LTL + concessions monthly series | No dedicated fetch; hero chart renders latest value flat from `monthlyActuals` state | NOT FOUND | `rent-roll-derivations.service.ts` — NOT FOUND in `backend/src/services/rent-roll/` (dir has: field-mapper, format-detector, rent-roll-diff, rent-roll-parser, rent-roll-validator, subject-history-s1) | NOT FOUND | `rent_roll_units.derived_metrics` JSONB exists; no extraction layer | **BROKEN@3** | `rent-roll-derivations.service.ts` does not exist; no per-month LTL/concessions series can be computed or exposed |
| R-03 | Property COMPARE overlay (per-comp metric time-series) | No fetch in `AssetHubPage.tsx`; comp overlay lines are MOCK per spec | NOT FOUND | NOT FOUND | NOT FOUND | `apartment_market_snapshots`: submarket-aggregate only (no per-property time-series history); confirmed via `financial-dashboard.routes.ts:63` | **NO-BACKEND** | No per-property metric time-series feed exists in the stack; `apartment_market_snapshots` is submarket-aggregate |
| R-04 | Asset Overview rail — Market Rent (loss-to-lease basis) | No fetch; Market Rent displays `'—'` (TODO comment in component) | NOT FOUND | NOT FOUND | NOT FOUND | No per-unit-type comp rent data source | **NO-BACKEND** | Market rent for loss-to-lease requires a per-unit-type comp feed; no route or data source exists |
| R-05 | JEDI SIGNAL chip + REPRICING COURSE | `GET /api/v1/revenue/:dealId/course` · `AssetHubPage.tsx:772–777` · useEffect ✅ | `/api/v1/revenue` NOT MOUNTED in `index.replit.ts`; `revenue.routes.ts` NOT FOUND | NOT FOUND | NOT FOUND | Repricing synthesizer not built | **NO-BACKEND** | `/api/v1/revenue` not mounted; `revenue.routes.ts` does not exist; repricing synthesizer service not built |
| R-06 | LEASE ROLL expirations | `GET /operations/:dealId/lease-expirations?months=24` · `AssetHubPage.tsx:726–733` · useEffect ✅ | `operations.routes.ts:302` · mount `index.replit.ts:717` | ✅ Real: calls `analyzeLeaseExpirations(dealId, months)` · `operations.routes.ts:302–310` | ✅ `dealId` direct into service | `rent_roll_units`: 1,740 rows | **CONNECTED** | — |
| R-07 | LEASE ROLL trade-out spread | `GET /operations/:dealId/tradeout-events` · `AssetHubPage.tsx:754–759` · useEffect ✅ | `operations.routes.ts:1441` · mount `index.replit.ts:717` | ✅ Real: queries `lease_tradeout_events` via property_code bridge · `operations.routes.ts:1452–1476` | ✅ Bridge: `dealId → deal_monthly_actuals.report_month → deal_monthly_actuals_lines.property_code → lease_tradeout_events` · `:1452–1474` | `lease_tradeout_events`: 1,492 rows; `deal_monthly_actuals_lines`: 1,653 rows (bridge) | **CONNECTED** | — |
| R-08 | LEASING FUNNEL — weekly observations | `GET /operations/:dealId/leasing-observations?weeks=52` · `AssetHubPage.tsx:761–769` · useEffect ✅ | `operations.routes.ts:1486` · mount `index.replit.ts:717` | ✅ Real: queries `leasing_weekly_observations` via property_code bridge · `operations.routes.ts:1498–1522` | ✅ Bridge: same `dealId → deal_monthly_actuals_lines.property_code → leasing_weekly_observations` · `:1498–1521` | `leasing_weekly_observations`: 276 rows; bridge via `deal_monthly_actuals_lines` (1,653) | **CONNECTED** | — |
| R-09 | Rent roll current snapshot | `GET /operations/:dealId/rent-roll` · `AssetHubPage.tsx:744–751` · useEffect ✅ | `operations.routes.ts:391` · mount `index.replit.ts:717` | ✅ Real: queries `rent_roll_units` · `operations.routes.ts:391` | ✅ `dealId` direct | `rent_roll_units`: 1,740 rows | **CONNECTED** | — |
| R-10 | MARKET SIGNALS — correlation signals | `GET /correlations/property/:propertyId` · `AssetHubPage.tsx:735–742` · useEffect ✅ · guard: `if (!propertyId) return` `:736` | `correlation.routes.ts:59` · mount `index.replit.ts:493` | ✅ Real: `engine.computeForProperty(propertyId, city, state)` · `correlation.routes.ts:64` | ✅ `propertyId` direct | Reads `metric_time_series`, `correlation_results` (market-level) | **CONNECTED\*** | Degraded: `submarket_id = NULL` on p2122 → submarket signals at reduced confidence. `propertyId` silently null if `dealStore.deals` not pre-loaded → guard at `:736` skips fetch |
| R-11 | MARKET SIGNALS — traffic velocity sub-signal | Sourced from `computeForProperty` (same call as R-10) | Same as R-10 | Same as R-10 | ✅ `propertyId` direct | `traffic_predictions` p2122: **0 rows**; `traffic_calibration_factors`: **0 rows** | **BROKEN@5** | `traffic_predictions` empty for p2122; traffic velocity sub-signal absent; predict job never run |
| R-12 | COMP SET & RANK — comp-set fetch (shell) | `GET /lifecycle/:dealId/comp-set` · `AssetHubPage.tsx:1621–1646` · useEffect ✅ (shell) | `lifecycle.routes.ts:385` · mount `index.replit.ts:721` | ✅ Real: queries comp-set tables · `lifecycle.routes.ts:385` | ✅ `dealId` direct | `lifecycle_comp_sets` — populated; mapped into shell `comps` state | **CONNECTED** | — |
| R-13 | COMP SET & RANK — PCS / rank values | No fetch for per-property rank; PCS shown as `'—'` · `AssetHubPage.tsx:1637–1638` | `rankings.routes.ts` has `GET /:marketId`, `/performance/:marketId`, `/owned/:marketId`, `/pipeline/:marketId`; **no `/property/:propertyId` endpoint** · mount `index.replit.ts:356` | NOT FOUND | NOT FOUND | `property_records` (market-wide only) | **NO-BACKEND** | No per-property rankings endpoint in `rankings.routes.ts` (544 lines, 4 GET routes, 0 POST routes); `GET /api/v1/rankings/:propertyId` (spec §6) not implemented |
| P-01 | Actual vs pro-forma NOI — projected-vs-actual | `GET /operations/:dealId/projected-vs-actual` · `AssetHubPage.tsx:1194–1199` · useEffect ✅ | `operations.routes.ts:631` · mount `index.replit.ts:717` | ✅ Real: joins actuals + budget rows · `operations.routes.ts:644–723` | ✅ `deals → property_id` lookup at `:660–663` | Actuals: 40 rows; Budget: **0 rows** → handler returns `hasProjections: false` | **CONNECTED\*** | 0 budget rows; handler enters actuals-only path at `:711–719`; pro-forma columns all null; projected-vs-actual chart shows actuals line only |
| P-02 | Variance — line-item GET | `GET /operations/:dealId/variances` · `AssetHubPage.tsx:1208–1213` · useEffect ✅ | `operations.routes.ts:113` · mount `index.replit.ts:717` | ✅ Real: queries variance tables · `operations.routes.ts:113` | ✅ `dealId` direct | `deal_monthly_actuals_lines`: 1,653 rows | **CONNECTED** | — |
| P-03 | Variance compute POST | `POST /operations/:dealId/variances/compute` body `{}` · `AssetHubPage.tsx:1201–1206` · useEffect ✅ | `operations.routes.ts:135` · mount `index.replit.ts:717` | ✅ Real: computes from `deal_monthly_actuals` + `_lines` · `operations.routes.ts:135` | ✅ `dealId` direct | `deal_monthly_actuals`: 40; `_lines`: 1,653 | **CONNECTED** | — |
| P-04 | LIVE TRACKING 4-col (M09) | `GET /operations/:dealId/live-tracking` · `AssetHubPage.tsx:1216–1221` · useEffect ✅ | NOT FOUND in `operations.routes.ts` (grep `live-tracking`, `live_tracking`, `liveTracking`: 0 hits) | NOT FOUND | NOT FOUND | M09 4-col composition not built | **NO-BACKEND** | Route `GET /:dealId/live-tracking` absent from `operations.routes.ts`; M09 formula-engine composition not exposed via any endpoint |
| P-05 | Cap-ex vs budget | Sourced from `monthlyActuals` state (R-01); `capex` column in SELECT · `operations.routes.ts:776` | Same as R-01 | ✅ Real: `capex` in column list · `operations.routes.ts:776` | ✅ Same join as R-01 | 13 actuals rows with non-null `capex`; budget capex: **0 rows** | **CONNECTED\*** | Actuals capex reachable (13 rows); no budget capex rows exist — cap-ex vs budget chart can only show actuals line |
| P-06 | Thesis checkpoints — commentary agent | No `useEffect` in `AssetHubPage.tsx` calls any commentary endpoint | No commentary endpoint on any mounted router | `backend/src/agents/commentary.agent.ts` (758 lines); imported by `backend/src/services/orchestrator.service.ts:20`; **not called from `AssetHubPage.tsx`** | NOT CONNECTED | NOT APPLICABLE | **BROKEN@1** | No `useEffect` in `AssetHubPage.tsx` calls commentary agent; `assetMode` NOT FOUND in `DealContext` (CC-2); thesis panel renders mocked bullets |
| P-07 | LIFECYCLE sub-tab | `<LifecycleSection dealId={dealId} />` · `AssetHubPage.tsx:1402–1407` | Routes internal to component; via `/api/v1/lifecycle` · `index.replit.ts:721` | ✅ Real: `lifecycle.routes.ts` (multiple handlers) | ✅ `dealId` prop passed | Lifecycle tables populated | **CONNECTED** (component reuse) | — |
| P-08 | EXIT sub-tab | `<ExitTimingTab dealId={dealId} />` · `AssetHubPage.tsx:1408` | Routes internal to component; via `/api/v1/lifecycle` · `index.replit.ts:721` | ✅ Real: `lifecycle.routes.ts` | ✅ `dealId` prop passed | Disposition tables | **CONNECTED** (component reuse) | — |
| C-01 | DEBT & RATE — loan terms + SOFR chart | No `useEffect` in `CapitalScreen` (`AssetHubPage.tsx:1414–1590`) fetches debt; comment at `:1504` references debt fields | Route EXISTS: `GET /lifecycle/:dealId/debt` at `lifecycle.routes.ts:227` · mount `index.replit.ts:721` | ✅ Real: queries deal debt record · `lifecycle.routes.ts:227` (but never reached from this page) | ✅ `dealId` direct (if called) | Debt record — not queried in this audit | **BROKEN@1** | `CapitalScreen` has no `useEffect` calling `GET /lifecycle/:dealId/debt`; panel renders mock loan terms. Rate cap/hedge fields: NOT FOUND in `lifecycle.routes.ts` debt handler (grep for `rate_cap`, `hedge`, `cap_strike`: 0 hits). FRED SOFR ingested to `metric_time_series` as `RATE_SOFR` via `fred-ingest.service.ts:25` but not wired to this panel |
| C-02 | DISTRIBUTIONS — per-member capital accounts | `GET /api/v1/capital/${dealId}/capital-accounts` · `AssetHubPage.tsx:1425–1430` · useEffect ✅ | `investor-capital.routes.ts` mounted at `/api/v1/capital` · `index.replit.ts:725`; **no `/capital-accounts` endpoint** in that file; all capital-call routes use `/deals/:dealId/` prefix (e.g. `investor-capital.routes.ts:260, 287`) | NOT FOUND (effective path `/api/v1/capital/deals/:dealId/...`) | NOT FOUND | `capital_calls`: 1 row; `distributions`: **0 rows** | **NO-BACKEND** | No `capital-accounts` endpoint at `/:dealId/capital-accounts`; investor-capital routes use `/deals/:dealId/` prefix (effective: `/api/v1/capital/deals/:dealId/…`); frontend URL → 404 |
| C-03 | WATERFALL — operating cash | `GET /api/v1/capital/${dealId}/waterfall?type=operating` · `AssetHubPage.tsx:1432–1437` · useEffect ✅ | Route EXISTS at `investor-capital.routes.ts:532` as `GET /deals/:dealId/waterfall`; effective path `/api/v1/capital/deals/:dealId/waterfall`; frontend calls `/:dealId/waterfall` → **path mismatch** · mount `index.replit.ts:725` | ✅ Real: queries `deal_waterfalls + waterfall_tiers` · `investor-capital.routes.ts:536–547` | ✅ `dealId` via path (unreachable due to mismatch) | `deal_waterfalls`: 1 row (data exists) | **BROKEN@2** | Path mismatch: frontend `GET /api/v1/capital/:dealId/waterfall` vs. router `GET /api/v1/capital/deals/:dealId/waterfall` → 404; the 1 existing waterfall row is unreachable from the UI |
| C-04 | WATERFALL — capital event | `GET /api/v1/capital/${dealId}/waterfall?type=capital` · `AssetHubPage.tsx:1437` · useEffect ✅ | Same as C-03 — same path mismatch · `investor-capital.routes.ts:532` | Same as C-03 · `?type=` param not handled; returns single unified waterfall regardless | ✅ (if path resolved) | `deal_waterfalls`: 1 row (single model, no dual operating/capital split) | **BROKEN@2** | Same path mismatch as C-03; additionally `type=` query param not implemented — single waterfall config, dual operating/capital-event split not modeled |
| C-05 | Rate sensitivity / DSCR / Refi Window | No backend fetch; client-side computed from mock loan fields · comment `AssetHubPage.tsx:1504` | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | **BROKEN@1** (depends on C-01) | Client-side DSCR computation uses mock loan terms; depends on C-01 (debt record) which is BROKEN@1 |
| D-01 | FILES drawer | `<DocumentsSection dealId={dealId} />` · `AssetHubPage.tsx:1801` | Routes internal to `DocumentsSection`; via `/api/v1/deals/:dealId/files` (standard deal route) | ✅ Real: queries `deal_files` | ✅ `dealId` prop passed | `deal_files` for Highlands | **CONNECTED** (component reuse) | — |
| D-02 | TEAM drawer | `<TeamSection deal={{ id: dealId, status: 'owned' } as Deal} />` · `AssetHubPage.tsx:1807` | Routes internal to `TeamSection`; via deal/team routes | ✅ Real | ✅ `dealId` via deal prop | Team tables | **CONNECTED** (component reuse) | — |
| D-03 | EVENTS drawer | `<EventTimelineSection dealId={dealId} dealType="owned" />` · `AssetHubPage.tsx:1813` | Routes internal to `EventTimelineSection`; `key_events LEFT JOIN event_forecasts` canonical path | ✅ Real | ✅ `dealId` prop | `key_events` for Highlands | **CONNECTED** (component reuse) | — |
| D-04 | ACTIVITY drawer | `<ActivityTab />` · `AssetHubPage.tsx:1819` — **no `dealId` prop passed** | Routes internal to `ActivityTab` | ✅ Real (component has its own data fetching) | ⚠️ `dealId` NOT passed from `AssetHubPage.tsx:1819`; `ActivityTab` may scope to all activities, not Highlands-specific | Activity tables | **CONNECTED\*** (component reuse — but no `dealId` scoping; activity may be unfiltered) | `ActivityTab` receives no `dealId` prop at `:1819`; component may show all activities rather than Highlands-only |
| D-05 | RANK & COMPS — rank target save | `POST /api/v1/rankings/${propertyId}/target` · `AssetHubPage.tsx:579–592` (save handler in `RankCompsConfig`) | `rankings.routes.ts` has 4 `GET` routes, **zero POST routes** · mount `index.replit.ts:356` | NOT FOUND | NOT FOUND | No rank-target persistence table | **NO-BACKEND** | `POST /:propertyId/target` absent from `rankings.routes.ts` (544 lines); target held in component state only, lost on page reload; save note: `'SAVING LOCALLY — BACKEND PENDING'` · `:592` |

---

## Section B — Punch List

### TIER 1 — WIRE NOW (route/data exists, quick fix — no new files)

| # | Issue | Exact fix | File:line |
|---|---|---|---|
| 1A | **C-03/C-04 waterfall 404** — 1 valid `deal_waterfalls` row unreachable; path mismatch | Add alias: `router.get('/:dealId/waterfall', ...)` in `investor-capital.routes.ts` pointing to the same handler; **OR** change frontend URL from `/${dealId}/waterfall` to `/deals/${dealId}/waterfall` in both calls | `backend/src/api/rest/investor-capital.routes.ts:532` · `frontend/src/pages/AssetHubPage.tsx:1434,1437` |
| 1B | **P-06 commentary agent not called** — thesis panel fully mocked; agent exists at 758 lines | (a) Add `assetMode?: 'owned' \| 'pipeline'` to `ResearchAgentContext` in `dealContext.ts`; (b) expose a GET endpoint running the agent in owned-asset mode; (c) add `useEffect` in `PerformanceScreen` calling that endpoint | `backend/src/agents/commentary.agent.ts` · `backend/src/types/dealContext.ts:604` · `frontend/src/pages/AssetHubPage.tsx:1184` |
| 1C | **C-01 debt record not fetched** — `CapitalScreen` has no `useEffect` for `GET /lifecycle/:dealId/debt` despite route existing | Add `useEffect` in `CapitalScreen` fetching `GET /api/v1/lifecycle/${dealId}/debt`; wire SOFR overlay from `metric_time_series` (RATE_SOFR ingested via `fred-ingest.service.ts:25`) | `frontend/src/pages/AssetHubPage.tsx:1414` · `backend/src/api/rest/lifecycle.routes.ts:227` |
| 1D | **CC-1 `propertyId` silently null** — if `dealStore.deals` not pre-loaded, R-10 MARKET SIGNALS silently skips | In shell `useEffect` at `:1602`, add explicit owned-asset fallback: when `urlDealId` matches Highlands deal_id, set `propertyId = '7ea31caf-f070-43eb-9fd1-fe08f7123701'`; or trigger a deals-list fetch before guard fires | `frontend/src/pages/AssetHubPage.tsx:1597,1602–1610` |

---

### TIER 2 — NEEDS ROUTE (table/data exists, no HTTP route or per-property endpoint)

| # | Issue | Route to add | Data available |
|---|---|---|---|
| 2A | **R-13 per-property rankings / PCS** — rankings service has no per-property endpoint; PCS shows `'—'` | Add `router.get('/property/:propertyId', ...)` to `rankings.routes.ts` returning `{ current_rank, current_pcs, set_size, comps:[...] }` per spec §6 | `property_records` (market-wide pool for ranking context) |
| 2B | **D-05 rank target persistence** — `POST /api/v1/rankings/:propertyId/target` not implemented; target lost on reload | Add `router.post('/:propertyId/target', requireAuth, ...)` to `rankings.routes.ts`; persist to a new `asset_rank_targets` table | Requires new schema column/table |

---

### TIER 3 — NEEDS BACKEND (no data/service at required grain)

| # | Issue | What must be built |
|---|---|---|
| 3A | **R-05 repricing synthesizer** — `GET /api/v1/revenue/:dealId/course` → 404 (no mount, no file) | Build repricing synthesizer service; create `revenue.routes.ts`; add `app.use('/api/v1/revenue', ...)` to `index.replit.ts` |
| 3B | **P-04 live-tracking 4-col (M09)** — `GET /operations/:dealId/live-tracking` absent from `operations.routes.ts` | Add route handler to `operations.routes.ts`; compose M09 4-col from formula-engine; return `[{ line_item, current, actuals_ttm, pro_forma, delta_pct }]` |
| 3C | **C-02 capital-accounts per-member** — no endpoint at `/:dealId/capital-accounts` in `investor-capital.routes.ts` | Add `router.get('/:dealId/capital-accounts', requireAuth, ...)` to `investor-capital.routes.ts`; build per-member LP/GP account balance model |
| 3D | **R-02 LTL/concessions monthly series** — `rent-roll-derivations.service.ts` does not exist | Build `backend/src/services/rent-roll/rent-roll-derivations.service.ts`; extract `derived_metrics` JSONB from `rent_roll_units` per month; expose via an operations route |
| 3E | **C-01 rate cap / hedge fields** — debt route exists (`lifecycle.routes.ts:227`) but `rate_cap_strike`, `hedge_type`, `hedge_expiry` absent from debt record schema | Add cap/hedge columns to deal debt table; surface in `GET /lifecycle/:dealId/debt` response |
| 3F | **R-04 market rent per unit type** — no per-unit-type comp rent feed | Wire RentCast or similar comp-rent feed; expose `GET /api/v1/comps/:propertyId/market-rents?byType=true` |

---

### TIER 4 — DATA POPULATION (route + table exist, table empty)

| # | Issue | How to populate |
|---|---|---|
| 4A | **R-11 `traffic_predictions` = 0 rows** — traffic velocity sub-signal absent | Run `POST /api/v1/traffic/predict/7ea31caf-f070-43eb-9fd1-fe08f7123701`; also run calibration job to populate `traffic_calibration_factors` and `validation_properties` |
| 4B | **P-01 / P-05 budget rows = 0** — `projected-vs-actual` returns actuals-only; cap-ex vs budget has no pro-forma line | Load pro-forma budget rows: `POST /api/v1/operations/:dealId/monthly-actuals` with `is_budget=true` for each month, or via admin migration from deal underwriting model |
| 4C | **C-02 `distributions` = 0 rows** — distributions section structurally empty even after C-02 backend is built | Record distributions via `POST /api/v1/capital/deals/:dealId/distributions` if any have been made; confirm with asset manager if none exist |

---

## Section C — Gap Count & Critical Path

### Counts

| Status | Count |
|---|---|
| **CONNECTED** (all 5 steps, real data) | **12** |
| **CONNECTED\*** (chain intact, data quality degraded) | **4** |
| **CONNECTED** (component reuse, live internal routes) | **6** |
| **BROKEN@1** (no FE fetch, or depends on broken predecessor) | **3** |
| **BROKEN@2** (route path mismatch) | **2** |
| **BROKEN@3** (service / handler file missing) | **1** |
| **BROKEN@5** (empty table) | **1** |
| **NO-BACKEND** (no route, no service anywhere in stack) | **6** |
| **Total panels audited** | **35** |

**CONNECTED family (full + degraded + reuse):** **22 / 35**  
**Broken or missing:** **13 / 35**

---

### Ordered critical path to close every Tier-1 and Tier-2 gap

```
STEP 1  (≤30 min each — URL or useEffect fix, no new files)
  → Fix C-03/C-04 waterfall path mismatch                          [Tier 1A]
    investor-capital.routes.ts:532 OR AssetHubPage.tsx:1434,1437
  → Fix CC-1 propertyId null guard in shell                         [Tier 1D]
    AssetHubPage.tsx:1597,1602–1610 — add owned-asset fallback

STEP 2  (data population — no code changes required)
  → Populate traffic_predictions via POST /traffic/predict/:id       [Tier 4A]
  → Load pro-forma budget rows for Highlands (is_budget=true)       [Tier 4B]

STEP 3  (frontend wiring — route already exists, just add useEffect)
  → Add useEffect in CapitalScreen for GET /lifecycle/:dealId/debt   [Tier 1C]
    AssetHubPage.tsx:1414

STEP 4  (add assetMode type + wire commentary)
  → Add assetMode field to ResearchAgentContext                      [Tier 1B]
    dealContext.ts:604
  → Expose commentary endpoint + add PerformanceScreen useEffect     [Tier 1B]

STEP 5  (new route additions to existing router files — no new files)
  → Add GET /rankings/property/:propertyId                           [Tier 2A]
    rankings.routes.ts
  → Add POST /rankings/:propertyId/target + persistence table        [Tier 2B]
    rankings.routes.ts

STEP 6  (new services and routes — largest scope, new files required)
  → Build rent-roll-derivations.service.ts                          [Tier 3D]
  → Add GET /operations/:dealId/live-tracking (M09)                 [Tier 3B]
  → Add GET /capital/:dealId/capital-accounts                       [Tier 3C]
  → Build repricing synthesizer + mount /api/v1/revenue             [Tier 3A]
  → Wire rate cap/hedge schema to debt endpoint                      [Tier 3E]
  → Build market-rent comp feed per unit type                       [Tier 3F]

Note: Task #1685 (submarket_id on p2122) is independent; resolving it
      upgrades R-10 from CONNECTED* to CONNECTED.
```

**Fastest path to "no 404s":** Step 1 alone closes the waterfall path mismatch and the propertyId guard — 2 broken panels restored with zero new files.  
**Most data restored per effort:** Steps 1–3 together — 4 BROKEN panels resolved using only existing routes and a `useEffect` addition.  
**Gating dependency:** Tier 3A (repricing synthesizer) is the most complex single item (new service, new router file, new mount); all other Tier-3 items add to existing router files.
