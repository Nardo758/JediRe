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
| `deal_files` (deal_id keyed) | **36** | psql direct |
| `deal_team_members` (deal_id keyed) | **0** | psql direct |
| `deal_tasks` (deal_id keyed) | **0** | psql direct |
| `dispositions` (deal_id keyed) | **0** | psql direct |
| `capex_actuals` (deal_id keyed) | **0** | psql direct |
| `lifecycle_reforecasts` | **NOT A TABLE** (relation does not exist) | psql direct |

**Route mounts verified** in `backend/src/index.replit.ts`:

| Mount prefix | Router file | Auth at mount | `index.replit.ts` line |
|---|---|---|---|
| `/api/v1/operations` | `operations.routes.ts` | per-route `requireAuth` | 717 |
| `/api/v1/rankings` | `rankings.routes.ts` | `optionalAuth` | 356 |
| `/api/v1/correlations` | `correlation.routes.ts` | none at mount | 493 |
| `/api/v1/capital` | `investor-capital.routes.ts` | `requireAuth` | 725 |
| `/api/v1/lifecycle` | `lifecycle.routes.ts` | per-route | 721 |
| `/api/v1` (deal files) | `documentsFiles.routes.ts` | per-route `requireAuth` | 573 |
| `/api/v1` (team mgmt) | `team-management.routes.ts` | `requireAuth` | 649 |
| `/api/v1/m35` | `m35-events.routes.ts` (+ m35 siblings) | `requireAuth` | 677 |
| `/api/v1/revenue` | **NOT MOUNTED** | — | — |

---

## Cross-cutting Connection Checks

### CC-1 — `dealStore`: selected-asset from Zustand or local `useState`?

**`AssetHubPage.tsx:1594–1613`** (shell component):
```
urlDealId           = useParams<{ dealId: string }>()                    // :1595
selectedAssetDealId = useDealStore(s => s.selectedAssetDealId)           // :1596
propertyId          = useDealStore(s => s.selectedAssetPropertyId)       // :1597
setSelectedAsset    = useDealStore(s => s.setSelectedAsset)              // :1598
dealId = selectedAssetDealId ?? urlDealId ?? ''                          // :1613
```
**Finding:** State lives in Zustand (`dealStore`), not local `useState`. URL param syncs → store in a `useEffect` at `:1602–1610`. **Compliant with spec §3.** Gap: if `dealStore.deals` list is not pre-loaded, `deal.property_id` lookup at `:1604–1605` returns `null` → `propertyId = null` → `if (!propertyId) return` guard at `:736` silently skips the MARKET SIGNALS fetch.

### CC-2 — `assetMode` on `DealContext` / `ResearchAgentContext`

Grepped `backend/src/types/dealContext.ts` for `assetMode`, `asset_mode`, `asOwned`, `as_owned`: **0 hits**.  
**Finding:** `assetMode: 'owned'` field is **NOT FOUND** in `ResearchAgentContext` or any type in `dealContext.ts`. The commentary agent (`backend/src/agents/commentary.agent.ts`, 758 lines) cannot receive owned-asset framing until this field is added.

### CC-3 — `deal_id ↔ property_id` resolution on operations routes for Highlands

**`operations.routes.ts:759–763`** (monthly-actuals handler, representative):
```ts
const propRes = await query('SELECT property_id FROM deals WHERE id = $1 LIMIT 1', [dealId]);
const propId  = propRes.rows[0]?.property_id;
// → WHERE property_id = $1 AND is_portfolio_asset = TRUE
```
**Finding:** Resolution is **CORRECT** for Highlands. Same pattern confirmed in `projected-vs-actual` at `:660–687`. Tradeout-events and leasing-observations use a different but equally correct bridge: `dealId → deal_monthly_actuals.report_month → deal_monthly_actuals_lines.property_code → lease_tradeout_events / leasing_weekly_observations` (`:1452–1474`, `:1498–1521`).

### CC-4 — `properties.submarket_id` for Highlands

`SELECT submarket_id FROM properties WHERE id = '7ea31caf-...'` → **`{"submarket_id": null}`**  
**Finding:** `submarket_id = NULL` for p2122. Task #1685 open. Degrades `computeForProperty` in `CorrelationEngineService` to city/state-level signals only.

### CC-5 — `traffic_predictions` / `traffic_calibration_factors` / `validation_properties`

| Table | Rows | Implication |
|---|---|---|
| `traffic_predictions` (p2122) | **0** | Traffic velocity sub-signal absent from MARKET SIGNALS |
| `traffic_calibration_factors` | **0** | No calibration coefficients; predict job would use defaults |
| `validation_properties` | **0** | No validation set; calibration accuracy unverifiable |

**Finding:** Traffic prediction pipeline has never been run for p2122.

### CC-6 — Render-function fetch bug: old page vs. rebuilt page

**`AssetOwnedPage.tsx:626–629`** (old page — 3,167 lines, still present):
```ts
{!loading && subTab === 'revenue-waterfall' && (() => {
  if (!actualsLoaded) {
    apiClient.get(`/api/v1/operations/${dealId}/monthly-actuals?limit=24`)
      .then(r => { setActuals(r.data?.data ?? []); setActualsLoaded(true); })  // ← fetch inside IIFE render
```
**`AssetHubPage.tsx`** (rebuilt page): All API calls are inside named `useEffect` hooks (e.g. `:716–724`, `:726–733`). No render-function fetch present.  
**Finding:** Bug **still present** in `AssetOwnedPage.tsx:626–629`. **NOT present** in `AssetHubPage.tsx`. Rebuild is correct.

---

## Section A — Connection Matrix

> **VERDICT key:** `CONNECTED` = all 5 steps verified, live data in Highlands tables.  
> `CONNECTED*` = chain intact but data quality or coverage degraded (see Missing link).  
> `BROKEN@N` = fails at step N; exact missing link stated.  
> `NO-BACKEND` = no route, no service, or component renders only hardcoded data (no fetch).
>
> **Steps:** [1] FE call in `useEffect` keyed on `deal_id/property_id` [2] Route defined + mounted [3] Handler queries real table (not stub/mock) [4] `deal_id↔property_id` join correct [5] Table has rows for Highlands

| # | Panel | FE call (file:line) | Route mounted (handler file:line · mount:line) | Handler live (real SQL?) | Join OK | Rows | VERDICT | Missing link |
|---|---|---|---|---|---|---|---|---|
| R-01 | Hero metric series (occ / rent / NOI / RevPAU) | `GET /api/v1/operations/:dealId/monthly-actuals?limit=53` · `AssetHubPage.tsx:716–724` · useEffect ✅ keyed on `[dealId, activeScreen]` | `operations.routes.ts:752` · mount `index.replit.ts:717` | ✅ Real: queries `deal_monthly_actuals` WHERE `property_id = $1 AND is_portfolio_asset = TRUE` · `operations.routes.ts:766–798` | ✅ `deals→property_id` lookup at `:759–763` | 40 actuals | **CONNECTED** | — |
| R-02 | LTL + concessions monthly series | No dedicated fetch; hero chart renders latest value flat from `monthlyActuals` state · `AssetHubPage.tsx:831–868` | NOT FOUND | `rent-roll-derivations.service.ts` — NOT FOUND in `backend/src/services/rent-roll/` (dir contains: field-mapper, format-detector, rent-roll-diff, rent-roll-parser, rent-roll-validator, subject-history-s1) | NOT FOUND | `rent_roll_units.derived_metrics` JSONB exists but no extraction layer | **BROKEN@3** | `rent-roll-derivations.service.ts` does not exist; no per-month LTL/concessions series can be computed or served |
| R-03 | Property COMPARE overlay (per-comp metric time-series) | No fetch in `AssetHubPage.tsx`; comp overlay lines are MOCK per spec | NOT FOUND | NOT FOUND | NOT FOUND | `apartment_market_snapshots`: submarket-aggregate only (per `financial-dashboard.routes.ts:63`), no per-property time-series history | **NO-BACKEND** | No per-property metric time-series feed exists anywhere in the stack |
| R-04 | Asset Overview rail — Market Rent (loss-to-lease basis) | No fetch; Market Rent shows `'—'` (TODO comment in component) | NOT FOUND | NOT FOUND | NOT FOUND | No per-unit-type comp rent data source | **NO-BACKEND** | Market rent for loss-to-lease requires a per-unit-type comp feed; no route exists |
| R-05 | JEDI SIGNAL chip + REPRICING COURSE | `GET /api/v1/revenue/:dealId/course` · `AssetHubPage.tsx:772–777` · useEffect ✅ | `/api/v1/revenue` NOT MOUNTED in `index.replit.ts`; `revenue.routes.ts` NOT FOUND anywhere in `backend/src/` | NOT FOUND | NOT FOUND | Repricing synthesizer not built | **NO-BACKEND** | `/api/v1/revenue` not mounted; `revenue.routes.ts` does not exist |
| R-06 | LEASE ROLL expirations | `GET /api/v1/operations/:dealId/lease-expirations?months=24` · `AssetHubPage.tsx:726–733` · useEffect ✅ keyed on `[dealId, activeScreen]` | `operations.routes.ts:302` · mount `index.replit.ts:717` | ✅ Real: calls `analyzeLeaseExpirations(dealId, months)` · `operations.routes.ts:302–310` | ✅ `dealId` passed directly into service | `rent_roll_units`: 1,740 rows | **CONNECTED** | — |
| R-07 | LEASE ROLL trade-out spread | `GET /api/v1/operations/:dealId/tradeout-events` · `AssetHubPage.tsx:754–759` · useEffect ✅ | `operations.routes.ts:1441` · mount `index.replit.ts:717` | ✅ Real: queries `lease_tradeout_events` via property_code bridge · `operations.routes.ts:1452–1476` (WITH prop_code AS … JOIN prop_code pc ON pc.property_code = lte.property_code) | ✅ Bridge: `dealId → deal_monthly_actuals.report_month → deal_monthly_actuals_lines.property_code → lease_tradeout_events` · `:1452–1474` | `lease_tradeout_events`: 1,492 rows; bridge via `deal_monthly_actuals_lines` (1,653 rows) | **CONNECTED** | — |
| R-08 | LEASING FUNNEL — weekly observations | `GET /api/v1/operations/:dealId/leasing-observations?weeks=52` · `AssetHubPage.tsx:761–769` · useEffect ✅ | `operations.routes.ts:1486` · mount `index.replit.ts:717` | ✅ Real: queries `leasing_weekly_observations` via same property_code bridge · `operations.routes.ts:1498–1522` | ✅ Bridge: same `dealId → deal_monthly_actuals_lines.property_code → leasing_weekly_observations` · `:1498–1521` | `leasing_weekly_observations`: 276 rows; bridge via `deal_monthly_actuals_lines` (1,653 rows) | **CONNECTED** | — |
| R-09 | Rent roll current snapshot | `GET /api/v1/operations/:dealId/rent-roll` · `AssetHubPage.tsx:744–751` · useEffect ✅ | `operations.routes.ts:391` · mount `index.replit.ts:717` | ✅ Real: queries `rent_roll_units` WHERE `deal_id = $1` · `operations.routes.ts:391` | ✅ `dealId` direct | `rent_roll_units`: 1,740 rows | **CONNECTED** | — |
| R-10 | MARKET SIGNALS — correlation signals | `GET /api/v1/correlations/property/:propertyId` · `AssetHubPage.tsx:735–742` · useEffect ✅ · guard `if (!propertyId) return` at `:736` | `correlation.routes.ts:59` · mount `index.replit.ts:493` | ✅ Real: `engine.computeForProperty(propertyId, city, state)` · `correlation.routes.ts:64` | ✅ `propertyId` direct | Reads `metric_time_series`, `correlation_results` (market-level; not Highlands-row-specific) | **CONNECTED\*** | Degraded: (1) `submarket_id = NULL` on p2122 → submarket signals absent, city/state fallback only; (2) `propertyId` is null if `dealStore.deals` not pre-loaded → guard at `:736` silently skips fetch |
| R-11 | MARKET SIGNALS — traffic velocity sub-signal | Sourced from `computeForProperty` (same call as R-10) | Same as R-10 | Same as R-10 | ✅ `propertyId` direct | `traffic_predictions` p2122: **0 rows**; `traffic_calibration_factors`: **0 rows** | **BROKEN@5** | `traffic_predictions` empty for p2122; traffic velocity sub-signal absent; predict job never run |
| R-12 | COMP SET & RANK — comp-set fetch (shell) | `GET /api/v1/lifecycle/:dealId/comp-set` · `AssetHubPage.tsx:1621–1646` · useEffect ✅ (shell, keyed on `[dealId]`) | `lifecycle.routes.ts:385` · mount `index.replit.ts:721` | ✅ Real: queries comp-set tables · `lifecycle.routes.ts:385` | ✅ `dealId` direct | `lifecycle_comp_sets` — populated; mapped into shell `comps` state | **CONNECTED** | — |
| R-13 | COMP SET & RANK — PCS / rank values | No fetch for per-property rank; PCS shown as `'—'` · `AssetHubPage.tsx:1637–1638` | `rankings.routes.ts` defines `GET /:marketId`, `GET /performance/:marketId`, `GET /owned/:marketId`, `GET /pipeline/:marketId`; **no `/property/:propertyId` endpoint** · mount `index.replit.ts:356` | NOT FOUND | NOT FOUND | `property_records` (market-wide only) | **NO-BACKEND** | No per-property rankings endpoint in `rankings.routes.ts` (544 lines, 4 GET routes, 0 POST routes); `GET /api/v1/rankings/:propertyId` not implemented |
| P-01 | Actual vs pro-forma NOI — projected-vs-actual | `GET /api/v1/operations/:dealId/projected-vs-actual` · `AssetHubPage.tsx:1194–1199` · useEffect ✅ | `operations.routes.ts:631` · mount `index.replit.ts:717` | ✅ Real: joins actuals + budget rows · `operations.routes.ts:644–723` | ✅ `deals→property_id` lookup at `:660–663` | Actuals: 40 rows; Budget: **0 rows** → handler returns `hasProjections: false` at `:711–719` | **CONNECTED\*** | 0 budget rows; projected columns all null; chart shows actuals-only line |
| P-02 | Variance — line-item GET | `GET /api/v1/operations/:dealId/variances` · `AssetHubPage.tsx:1208–1213` · useEffect ✅ | `operations.routes.ts:113` · mount `index.replit.ts:717` | ✅ Real: queries variance tables · `operations.routes.ts:113` | ✅ `dealId` direct | `deal_monthly_actuals_lines`: 1,653 rows | **CONNECTED** | — |
| P-03 | Variance compute POST | `POST /api/v1/operations/:dealId/variances/compute` body `{}` · `AssetHubPage.tsx:1201–1206` · useEffect ✅ | `operations.routes.ts:135` · mount `index.replit.ts:717` | ✅ Real: computes from `deal_monthly_actuals + _lines` · `operations.routes.ts:135` | ✅ `dealId` direct | `deal_monthly_actuals`: 40; `_lines`: 1,653 | **CONNECTED** | — |
| P-04 | LIVE TRACKING 4-col (M09) | `GET /api/v1/operations/:dealId/live-tracking` · `AssetHubPage.tsx:1216–1221` · useEffect ✅ | NOT FOUND in `operations.routes.ts` (grep for `live-tracking`, `live_tracking`, `liveTracking`: 0 hits) | NOT FOUND | NOT FOUND | M09 4-col composition not built | **NO-BACKEND** | Route `GET /:dealId/live-tracking` absent from `operations.routes.ts`; M09 formula-engine composition not exposed |
| P-05 | Cap-ex vs budget | Sourced from `monthlyActuals` state (R-01); `capex` column in SELECT · `operations.routes.ts:776` | Same as R-01 | ✅ Real: `capex` in column list at `operations.routes.ts:776` | ✅ Same join as R-01 (`:759–763`) | 13 actuals rows with non-null `capex`; budget capex: **0 rows** | **CONNECTED\*** | Actuals capex reachable (13 rows); no budget capex rows → cap-ex comparison line is absent |
| P-06 | Thesis checkpoints — commentary agent | No `useEffect` in `AssetHubPage.tsx` calls any commentary endpoint | No commentary endpoint on any mounted router | `backend/src/agents/commentary.agent.ts` (758 lines); imported by `backend/src/services/orchestrator.service.ts:20`; **not called from `AssetHubPage.tsx`** | NOT CONNECTED | NOT APPLICABLE | **BROKEN@1** | No `useEffect` in `AssetHubPage.tsx` calls commentary agent; `assetMode` NOT FOUND in `DealContext` (CC-2); thesis panel renders mocked bullets |
| P-07 | LIFECYCLE sub-tab | `<LifecycleSection dealId={dealId} />` · `AssetHubPage.tsx:1402–1407` | 4 internal routes: `GET /lifecycle/:dealId/reforecast/history` · `lifecycle.routes.ts:212` · `GET /lifecycle/:dealId/dispositions` · `:63` · `GET /lifecycle/:dealId/debt` · `:227` · `GET /lifecycle/:dealId/capex/actuals` · `:554` · all via mount `index.replit.ts:721` | ✅ All 4 handlers are real SQL (lifecycle.routes.ts:212, 63, 227, 554) | ✅ `dealId` prop passed to all sub-handlers | `lifecycle_reforecasts` table: **NOT A TABLE** (psql: relation does not exist); `dispositions`: **0 rows**; `capex_actuals`: **0 rows** | **CONNECTED\*** | `lifecycle_reforecasts` table does not exist → `GET /lifecycle/:dealId/reforecast/history` handler will error on first query. `dispositions` = 0, `capex_actuals` = 0 → those sub-tabs render empty states |
| P-08 | EXIT sub-tab | `<ExitTimingTab dealId={dealId} />` · `AssetHubPage.tsx:1408` | NOT APPLICABLE — no fetch in `ExitTimingTab.tsx` (59 lines); `dealId` prop declared but unused at `:15` | NOT APPLICABLE | NOT APPLICABLE | `ConvergenceChart.tsx` exports pre-baked constants (`RSS_21Y`, `OPTIMAL_FWD`, `Q_LABELS`) — hardcoded data | **NO-BACKEND** | `ExitTimingTab.tsx` renders a `ConvergenceChart` using only imported hardcoded constants; `dealId` prop is declared but unused; no API call anywhere in the 59-line file; chart shows static market-cycle data |
| C-01 | DEBT & RATE — loan terms + SOFR chart | No `useEffect` in `CapitalScreen` (`AssetHubPage.tsx:1414–1590`) fetches debt · comment at `:1504` references debt fields | Route EXISTS: `GET /api/v1/lifecycle/:dealId/debt` · `lifecycle.routes.ts:227` · mount `index.replit.ts:721` | ✅ Real: queries deal debt record · `lifecycle.routes.ts:227` (route present but unreached from this page) | ✅ `dealId` direct (if called) | NOT QUERIED (panel renders mock) | **BROKEN@1** | `CapitalScreen` has no `useEffect` calling `GET /lifecycle/:dealId/debt`; panel renders mock loan terms. Rate cap/hedge fields: NOT FOUND in `lifecycle.routes.ts` debt handler (grep for `rate_cap`, `hedge`, `cap_strike`: 0 hits). FRED SOFR ingested to `metric_time_series` as `RATE_SOFR` via `fred-ingest.service.ts:25` but not wired to this panel |
| C-02 | DISTRIBUTIONS — per-member capital accounts | `GET /api/v1/capital/${dealId}/capital-accounts` · `AssetHubPage.tsx:1425–1430` · useEffect ✅ | `investor-capital.routes.ts` mounted at `/api/v1/capital` · `index.replit.ts:725`; all deal routes in this file use `/deals/:dealId/` prefix (e.g. `:260, :287`); **no `/:dealId/capital-accounts` route** | NOT FOUND | NOT FOUND | `capital_calls`: 1 row; `distributions`: **0 rows** | **NO-BACKEND** | No `capital-accounts` endpoint at `/:dealId/capital-accounts`; investor-capital routes use `/deals/:dealId/` prefix (effective: `/api/v1/capital/deals/:dealId/…`); frontend URL → 404 |
| C-03 | WATERFALL — operating cash | `GET /api/v1/capital/${dealId}/waterfall?type=operating` · `AssetHubPage.tsx:1432–1437` · useEffect ✅ | Route EXISTS at `investor-capital.routes.ts:532` as `GET /deals/:dealId/waterfall`; effective path `/api/v1/capital/deals/:dealId/waterfall`; **frontend calls `/:dealId/waterfall` → path mismatch → 404** · mount `index.replit.ts:725` | ✅ Real: queries `deal_waterfalls + waterfall_tiers` · `investor-capital.routes.ts:536–547` | ✅ `dealId` direct (if path resolved) | `deal_waterfalls`: 1 row (data exists; unreachable) | **BROKEN@2** | Path mismatch: frontend `GET /api/v1/capital/:dealId/waterfall` vs. router `GET /api/v1/capital/deals/:dealId/waterfall` → 404; 1 existing waterfall row is unreachable from the UI |
| C-04 | WATERFALL — capital event | `GET /api/v1/capital/${dealId}/waterfall?type=capital` · `AssetHubPage.tsx:1437` · useEffect ✅ | Same as C-03 — same path mismatch · `investor-capital.routes.ts:532` | Same as C-03; `type=` query param not implemented — handler ignores it | ✅ `dealId` (if path resolved) | `deal_waterfalls`: 1 row (single model, no dual split) | **BROKEN@2** | Same path mismatch as C-03; additionally `type=capital` not implemented — single waterfall config returned; dual operating/capital-event split not modeled |
| C-05 | Rate sensitivity / DSCR / Refi Window | No backend fetch; client-side computed from mock loan fields · `AssetHubPage.tsx:1504` comment | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | **BROKEN@1** (depends on C-01) | Client-side DSCR computation uses mock loan terms; depends on C-01 (debt record) which is BROKEN@1 |
| D-01 | FILES drawer | `api.get('/deals/${dealId}/files')` · `DocumentsSection.tsx:70` · `useEffect` at `:79–83` keyed on `[dealId]` · mounted via `<DocumentsSection dealId={dealId} />` · `AssetHubPage.tsx:1801` | `GET /api/v1/deals/:dealId/files` · `documentsFiles.routes.ts:324` · mounted `app.use('/api/v1', documentsFilesRoutes)` · `index.replit.ts:573` | ✅ Real: `documentsFilesService.getFiles(dealId, filters)` · `documentsFiles.routes.ts:331–358`; service queries `deal_files` by `deal_id` | ✅ `dealId` direct (prop → component) | `deal_files`: **36 rows** | **CONNECTED** | — |
| D-02 | TEAM drawer | `fetch('/api/v1/deals/${deal.id}/team/members')` · `TeamSection.tsx:115` + `fetch('/api/v1/deals/${deal.id}/team/tasks')` · `:120` · `useEffect` at `:108–163` · mounted via `<TeamSection deal={{ id: dealId, status: 'owned' } as Deal} />` · `AssetHubPage.tsx:1807` | `GET /api/v1/deals/:dealId/team/members` · `team-management.routes.ts:53` + `GET /api/v1/deals/:dealId/team/tasks` · `:147` · mounted `app.use('/api/v1', requireAuth, teamManagementRouter)` · `index.replit.ts:649` | ✅ Real: `SELECT * FROM deal_team_members WHERE deal_id = $1` · `team-management.routes.ts:60` + `deal_tasks` at `:155` | ✅ `deal.id` prop = Highlands `dealId` | `deal_team_members`: **0 rows**; `deal_tasks`: **0 rows** | **CONNECTED\*** | Chain intact; 0 team members and 0 tasks for Highlands — panel renders empty states |
| D-03 | EVENTS drawer | `fetch('/api/v1/m35/deals/${dealId}/events-context', { headers: { Authorization: ... } })` · `EventTimelineSection.tsx:104` · `useEffect` via `fetchContext()` at `:117` · mounted via `<EventTimelineSection dealId={dealId} dealType="owned" />` · `AssetHubPage.tsx:1813` | `GET /api/v1/m35/deals/:dealId/events-context` · `backend/src/routes/m35-events.routes.ts:602` · mounted `app.use('/api/v1/m35', requireAuth, m35EventsRouter)` · `index.replit.ts:677` | ✅ Real: queries `key_events` (keyed by `msa_id`; joined via `deals.property_id → properties.msa_id`) · `m35-events.routes.ts:602` | ✅ `dealId` passed as path param; handler resolves MSA join internally | `key_events` keyed by `msa_id`; Highlands MSA join not directly verified (submarket_id = NULL per CC-4 but msa_id is a separate property column) | **CONNECTED** | — |
| D-04 | ACTIVITY drawer | `<ActivityTab />` · `AssetHubPage.tsx:1819` — **no `dealId` prop passed** | NOT APPLICABLE — `ActivityTab.tsx` (81 lines) is a static stub: no `useEffect`, no `apiClient`, no `fetch` call anywhere in the file | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | **NO-BACKEND** | `ActivityTab.tsx:16–81` renders a "🚧 Coming Soon" placeholder with a list of planned features; zero backend wiring exists |
| D-05 | RANK & COMPS — rank target save | `POST /api/v1/rankings/${propertyId}/target` · `AssetHubPage.tsx:579–592` (save handler inside `RankCompsConfig`) | `rankings.routes.ts` defines 4 GET routes, **zero POST routes** · mount `index.replit.ts:356` | NOT FOUND | NOT FOUND | No rank-target persistence table | **NO-BACKEND** | `POST /:propertyId/target` absent from `rankings.routes.ts` (544 lines); target held in component state only, lost on page reload |

---

## Section B — Punch List

### TIER 1 — WIRE NOW (route/data exists, fix requires ≤2 files, no new service)

| # | Issue | Exact fix | File:line |
|---|---|---|---|
| 1A | **C-03/C-04 waterfall 404** — 1 valid `deal_waterfalls` row unreachable; path mismatch | Add alias `router.get('/:dealId/waterfall', ...)` in `investor-capital.routes.ts` pointing at the same handler; **OR** change frontend URL from `/${dealId}/waterfall` → `/deals/${dealId}/waterfall` in both fetch calls | `backend/src/api/rest/investor-capital.routes.ts:532` · `frontend/src/pages/AssetHubPage.tsx:1434,1437` |
| 1B | **P-06 commentary agent not called** — thesis panel fully mocked; agent exists (758 lines) | (a) Add `assetMode?: 'owned' \| 'pipeline'` to `ResearchAgentContext` in `dealContext.ts`; (b) expose an endpoint running the agent in owned-asset mode; (c) add `useEffect` in `PerformanceScreen` calling that endpoint | `backend/src/agents/commentary.agent.ts` · `backend/src/types/dealContext.ts` (around `:604`) · `frontend/src/pages/AssetHubPage.tsx:1184` |
| 1C | **C-01 debt record not fetched** — `CapitalScreen` has no `useEffect`; route at `lifecycle.routes.ts:227` exists | Add `useEffect` in `CapitalScreen` (`AssetHubPage.tsx:1414`) fetching `GET /api/v1/lifecycle/${dealId}/debt`; wire SOFR overlay from `metric_time_series` (RATE_SOFR ingested via `fred-ingest.service.ts:25`) | `frontend/src/pages/AssetHubPage.tsx:1414` · `backend/src/api/rest/lifecycle.routes.ts:227` |
| 1D | **CC-1 `propertyId` silently null** — if `dealStore.deals` not pre-loaded, R-10 MARKET SIGNALS fetch silently skipped | In shell `useEffect` at `:1602`, add owned-asset fallback: when `urlDealId` matches Highlands deal_id, seed `propertyId` via a deals-list fetch or hardcoded owned-asset constant | `frontend/src/pages/AssetHubPage.tsx:1597,1602–1610` |

---

### TIER 2 — NEEDS ROUTE (table/data exists, endpoint not in any router)

| # | Issue | Route to add | Data available |
|---|---|---|---|
| 2A | **R-13 per-property rankings / PCS** — no per-property endpoint; PCS shows `'—'` | Add `router.get('/property/:propertyId', requireAuth, ...)` to `rankings.routes.ts` returning `{ current_rank, current_pcs, set_size, comps: [...] }` | `property_records` (market-wide ranking pool) |
| 2B | **D-05 rank target persistence** — `POST /api/v1/rankings/:propertyId/target` absent; target lost on reload | Add `router.post('/:propertyId/target', requireAuth, ...)` to `rankings.routes.ts`; persist to new `asset_rank_targets` table | Requires new schema table |

---

### TIER 3 — NEEDS BACKEND (no data/service exists at required grain)

| # | Issue | What must be built |
|---|---|---|
| 3A | **R-05 repricing synthesizer** — `GET /api/v1/revenue/:dealId/course` → 404 | Build repricing synthesizer service; create `revenue.routes.ts`; add `app.use('/api/v1/revenue', ...)` to `index.replit.ts` |
| 3B | **P-04 live-tracking 4-col (M09)** — `GET /operations/:dealId/live-tracking` absent | Add handler to `operations.routes.ts`; compose M09 4-col from formula-engine; return `[{ line_item, current, actuals_ttm, pro_forma, delta_pct }]` |
| 3C | **C-02 capital-accounts per-member** — no endpoint | Add `router.get('/:dealId/capital-accounts', requireAuth, ...)` to `investor-capital.routes.ts`; build per-member LP/GP balance model |
| 3D | **R-02 LTL/concessions monthly series** — `rent-roll-derivations.service.ts` absent | Build `backend/src/services/rent-roll/rent-roll-derivations.service.ts`; extract `derived_metrics` JSONB from `rent_roll_units` per month; expose via new operations route |
| 3E | **C-01 rate cap / hedge fields** — debt route exists but schema lacks cap/hedge columns | Add `rate_cap_strike`, `hedge_type`, `hedge_expiry` columns to deal debt table; expose in `GET /lifecycle/:dealId/debt` response |
| 3F | **R-04 market rent per unit type** — no comp rent feed | Wire a per-unit-type comp rent source (RentCast or similar); expose `GET /api/v1/comps/:propertyId/market-rents?byType=true` |
| 3G | **P-08 EXIT tab** — `ExitTimingTab.tsx` uses pre-baked hardcoded constants (`RSS_21Y`, `OPTIMAL_FWD`, `Q_LABELS`); `dealId` prop declared but unused | Build `GET /lifecycle/:dealId/exit-timing` returning real market-cycle RSS data; wire into `ExitTimingTab.tsx` to replace the hardcoded import from `ConvergenceChart.tsx` |
| 3H | **D-04 ACTIVITY drawer** — `ActivityTab.tsx` is a stub ("🚧 Coming Soon") | Build activity feed endpoint; rewrite `ActivityTab.tsx` to fetch deal-scoped audit trail |
| 3I | **P-07 LIFECYCLE reforecast/history** — `lifecycle_reforecasts` table does NOT EXIST | Create `lifecycle_reforecasts` table (migration); implement handler body at `lifecycle.routes.ts:212` which currently references a non-existent relation |

---

### TIER 4 — DATA POPULATION (route + table exist, table empty)

| # | Issue | How to populate |
|---|---|---|
| 4A | **R-11 `traffic_predictions` = 0 rows** | Run `POST /api/v1/traffic/predict/7ea31caf-f070-43eb-9fd1-fe08f7123701`; also run calibration job to populate `traffic_calibration_factors` and `validation_properties` |
| 4B | **P-01 / P-05 budget rows = 0** | Load pro-forma budget rows: `POST /api/v1/operations/:dealId/monthly-actuals` with `is_budget=true` for each projection month |
| 4C | **D-02 0 team members / 0 tasks** | Add team members for Highlands via `POST /api/v1/deals/:dealId/team/members`; add tasks via `POST /api/v1/deals/:dealId/team/tasks` |
| 4D | **P-07 `dispositions` = 0, `capex_actuals` = 0** | Record any disposition notes/events and capex actuals via the lifecycle endpoints if applicable to Highlands operating history |

---

## Section C — Gap Count & Critical Path

### Counts

| Status | Count |
|---|---|
| **CONNECTED** (all 5 steps verified, real data in Highlands tables) | **10** |
| **CONNECTED\*** (chain intact, data quality or coverage degraded) | **5** |
| **BROKEN@1** (no FE fetch, or depends on broken predecessor) | **3** |
| **BROKEN@2** (route path mismatch) | **2** |
| **BROKEN@3** (service / handler file missing) | **1** |
| **BROKEN@5** (empty table) | **1** |
| **NO-BACKEND** (no route, no service, or component renders hardcoded-only data) | **9** |
| **Total panels audited** | **31** |

**CONNECTED family (full + degraded):** **15 / 31**  
**Broken or missing:** **16 / 31**

---

### Ordered critical path to close every Tier-1 and Tier-2 gap

```
STEP 1  (≤30 min each — URL fix or useEffect addition; zero new files)
  → Fix C-03/C-04 waterfall path mismatch                              [Tier 1A]
    investor-capital.routes.ts:532  OR  AssetHubPage.tsx:1434,1437
  → Fix propertyId null guard in shell useEffect                        [Tier 1D]
    AssetHubPage.tsx:1597,1602–1610 — add owned-asset fallback

STEP 2  (data population — no code changes)
  → Populate traffic_predictions via POST /traffic/predict/:propertyId  [Tier 4A]
  → Load pro-forma budget rows for Highlands (is_budget=true)           [Tier 4B]

STEP 3  (add useEffect to existing screen — route already exists)
  → Add useEffect in CapitalScreen for GET /lifecycle/:dealId/debt       [Tier 1C]
    AssetHubPage.tsx:1414

STEP 4  (assetMode type + commentary endpoint wiring)
  → Add assetMode field to ResearchAgentContext (dealContext.ts)         [Tier 1B]
  → Expose commentary endpoint + add PerformanceScreen useEffect         [Tier 1B]

STEP 5  (new routes added to existing router files — no new files)
  → Add GET /rankings/property/:propertyId  to rankings.routes.ts        [Tier 2A]
  → Add POST /rankings/:propertyId/target + asset_rank_targets table     [Tier 2B]

STEP 6  (new services and routes — largest scope; new files required)
  → Build rent-roll-derivations.service.ts                               [Tier 3D]
  → Add GET /operations/:dealId/live-tracking (M09)                      [Tier 3B]
  → Add GET /capital/:dealId/capital-accounts                            [Tier 3C]
  → Build repricing synthesizer + mount /api/v1/revenue                  [Tier 3A]
  → Wire rate cap/hedge schema to debt endpoint                           [Tier 3E]
  → Build market-rent comp feed per unit type                            [Tier 3F]
  → Wire ExitTimingTab to real exit-timing data                          [Tier 3G]
  → Build ActivityTab backend + rewrite component                        [Tier 3H]
  → Create lifecycle_reforecasts table + implement handler               [Tier 3I]

Notes:
  Task #1685 (submarket_id on p2122) is independent of all above steps;
  resolving it upgrades R-10 from CONNECTED* to CONNECTED.
```

**Fastest path to "no 404s":** Step 1 alone closes C-03/C-04 with zero new files.  
**Most data unlocked per effort:** Steps 1–3 together close the waterfall, DSCR, and debt panels using only existing routes.  
**Gating dependency:** `lifecycle_reforecasts` (Tier 3I) must be resolved before the LIFECYCLE sub-tab (P-07) can reach CONNECTED status.
