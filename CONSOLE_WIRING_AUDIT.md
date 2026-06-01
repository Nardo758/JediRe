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
| `deal_monthly_actuals` — actuals (`is_budget=false, is_portfolio_asset=TRUE`) | **40** | `psql` direct query |
| `deal_monthly_actuals` — budget (`is_budget=true`) | **0** | `psql` direct query |
| `deal_monthly_actuals_lines` | **1,653** | `psql` direct query |
| `rent_roll_units` (deal_id keyed) | **1,740** | `psql` direct query |
| `lease_tradeout_events` (property_code keyed) | **1,492** | `psql` direct query |
| `leasing_weekly_observations` (property_code keyed) | **276** | `psql` direct query |
| `traffic_predictions` (property_id keyed) | **0** | `psql` direct query |
| `traffic_calibration_factors` | **0** | `psql` direct query |
| `validation_properties` | **0** | `psql` direct query |
| `capital_calls` (deal_id keyed) | **1** | `psql` direct query |
| `distributions` (deal_id keyed) | **0** | `psql` direct query |
| `deal_waterfalls` (deal_id keyed) | **1** | `psql` direct query |
| `deal_monthly_actuals.capex` non-null (actuals) | **13** | `psql` direct query |

**Route mounts verified** (`backend/src/index.replit.ts`):

| Mount | Router file | Auth at mount | `index.replit.ts` line |
|---|---|---|---|
| `/api/v1/operations` | `operations.routes.ts` | none at mount | 717 |
| `/api/v1/rankings` | `rankings.routes.ts` | `optionalAuth` | 356 |
| `/api/v1/correlations` | `correlation.routes.ts` | none at mount | 493 |
| `/api/v1/capital` | `investor-capital.routes.ts` | `requireAuth` | 725 |
| `/api/v1/lifecycle` | `lifecycle.routes.ts` | per-route | 721 |
| `/api/v1/revenue` | **NOT MOUNTED** | — | — |

---

## Cross-cutting Connection Checks

### CC-1 — `dealStore`: selected-asset from Zustand or local useState?

**`AssetHubPage.tsx:1594–1613`** (shell component):
```
const { dealId: urlDealId } = useParams<{ dealId: string }>();          // :1595
const selectedAssetDealId = useDealStore(s => s.selectedAssetDealId);   // :1596
const propertyId = useDealStore(s => s.selectedAssetPropertyId);        // :1597
const setSelectedAsset = useDealStore(s => s.setSelectedAsset);         // :1598
...
const dealId = selectedAssetDealId ?? urlDealId ?? '';                   // :1613
```
**Finding:** State lives in Zustand (`dealStore`), not local `useState`. URL param syncs → store in a `useEffect` (`AssetHubPage.tsx:1602–1610`). **Compliant with spec §3.** However: if `dealStore.deals` list is not pre-loaded, `deal.property_id` lookup returns `null` → `propertyId = null` → any `if (!propertyId) return` guard silently skips fetches (`AssetHubPage.tsx:736`).

### CC-2 — `assetMode` on `DealContext` / `ResearchAgentContext`

**`backend/src/types/dealContext.ts`** grep for `assetMode`, `asset_mode`, `asOwned`, `as_owned`: **0 hits**.  
**Finding:** `assetMode: 'owned'` field is **NOT FOUND** in `ResearchAgentContext` or any type in `dealContext.ts`. Commentary agent (`backend/src/agents/commentary.agent.ts`) cannot receive owned-asset context until this field is added.

### CC-3 — `deal_id ↔ property_id` resolution on operations routes for Highlands

**`operations.routes.ts:759–763`** (monthly-actuals handler):
```ts
const propRes = await query('SELECT property_id FROM deals WHERE id = $1 LIMIT 1', [dealId]);
const propId = propRes.rows[0]?.property_id as string | null;
// → then queries: WHERE property_id = $1 AND is_portfolio_asset = TRUE
```
**Finding:** Resolution is **CORRECT** for Highlands — `deal_id` → `property_id` lookup then queries `deal_monthly_actuals` by `property_id + is_portfolio_asset=TRUE`, which is the canonical owned-asset flag. Same pattern confirmed in `projected-vs-actual` handler (`operations.routes.ts:660–687`).

### CC-4 — `properties.submarket_id` for Highlands

**psql query:** `SELECT submarket_id FROM properties WHERE id='7ea31caf-...'` → `{"submarket_id": null}`  
**Finding:** `submarket_id = NULL` for p2122. Task #1685 still open. Degrades the correlation engine's submarket-level signals: `computeForProperty` will fall back to city/state-level market data only, producing lower-confidence correlation outputs in MARKET SIGNALS.

### CC-5 — `traffic_predictions` / `traffic_calibration_factors` / `validation_properties` row counts

| Table | Rows | Implication |
|---|---|---|
| `traffic_predictions` (p2122) | **0** | Traffic velocity signal is absent from MARKET SIGNALS |
| `traffic_calibration_factors` | **0** | No calibration coefficients; predict job would use defaults |
| `validation_properties` | **0** | No validation set; calibration cannot be verified |

**Finding:** The traffic prediction pipeline has never been run for p2122. Requires `POST /api/v1/traffic/predict/7ea31caf-f070-43eb-9fd1-fe08f7123701` to populate `traffic_predictions`.

### CC-6 — Render-function fetch bug: old page vs. rebuilt page

**`AssetOwnedPage.tsx:626–629`** (old page, 3,167 lines — still present):
```ts
{!loading && subTab === 'revenue-waterfall' && (() => {
  if (!actualsLoaded) {
    apiClient.get(`/api/v1/operations/${dealId}/monthly-actuals?limit=24`)
      .then(r => { setActuals(...); setActualsLoaded(true); })  // ← fetch inside IIFE render
```
**`AssetHubPage.tsx`** (rebuilt page): All API calls are inside named `useEffect` hooks (e.g. `AssetHubPage.tsx:716–724`, `726–733`, etc.). No render-function fetch present.  
**Finding:** Bug **still present** in `AssetOwnedPage.tsx:626–629` (old page). **NOT present** in `AssetHubPage.tsx`. The rebuild correctly moved all fetches to `useEffect`.

---

## Section A — Connection Matrix

> **VERDICT key:** `CONNECTED` = all 5 steps verified. `BROKEN@N` = fails at step N (see traces below for exact missing link). `NO-BACKEND` = no route or service exists.
>
> **Steps:** [1] FE call in useEffect, keys on deal_id [2] Route defined + mounted [3] Handler queries real table [4] deal_id↔property_id join correct [5] Table has rows for Highlands

| # | Panel | FE call (file:line) | Route mounted (file:line + mount:line) | Handler live (file:line) | Join OK | Rows | VERDICT | Missing link |
|---|---|---|---|---|---|---|---|---|
| R-01 | Hero metric series (occ/rent/NOI/RevPAU) | `GET /operations/:dealId/monthly-actuals?limit=53` · `AssetHubPage.tsx:716–724` · useEffect ✅ | `operations.routes.ts:752` · mount `index.replit.ts:717` | Real: queries `deal_monthly_actuals` via property_id · `operations.routes.ts:766–798` | ✅ deals→property_id lookup at `:759–763` | 40 actuals | **CONNECTED** | — |
| R-02 | LTL + concessions series | No dedicated fetch; rendered flat from `monthlyActuals` state · `AssetHubPage.tsx:831–868` | NOT FOUND | `rent-roll-derivations.service.ts` — NOT FOUND in `backend/src/services/rent-roll/` | NOT FOUND | `rent_roll_units.derived_metrics` JSONB exists; no extraction layer | **BROKEN@3** | `rent-roll-derivations.service.ts` does not exist; no per-month LTL series can be computed or served |
| R-03 | Property COMPARE overlay (per-comp metric time-series) | No fetch in `AssetHubPage.tsx`; comp overlay lines are MOCK per spec | NOT FOUND | NOT FOUND | NOT FOUND | `apartment_market_snapshots` is submarket-aggregate (104 rows), no per-property history | **NO-BACKEND** | No per-property metric time-series feed exists anywhere in the stack |
| R-04 | Asset Overview rail — Market Rent (loss-to-lease) | No fetch; Market Rent shows `'—'` (TODO comment in component) | NOT FOUND | NOT FOUND | NOT FOUND | No per-unit-type comp rent data source | **NO-BACKEND** | Market rent for loss-to-lease requires a per-unit-type comp feed; no route exists |
| R-05 | JEDI SIGNAL chip / REPRICING COURSE | `GET /api/v1/revenue/:dealId/course` · `AssetHubPage.tsx:772–777` · useEffect ✅ | `/api/v1/revenue` NOT MOUNTED in `index.replit.ts`; `revenue.routes.ts` NOT FOUND | NOT FOUND | NOT FOUND | Repricing synthesizer not built | **NO-BACKEND** | `/api/v1/revenue` not mounted; `revenue.routes.ts` does not exist; repricing synthesizer not built |
| R-06 | LEASE ROLL expirations | `GET /operations/:dealId/lease-expirations?months=24` · `AssetHubPage.tsx:726–733` · useEffect ✅ | `operations.routes.ts:302` · mount `index.replit.ts:717` | Real: calls `analyzeLeaseExpirations(dealId, months)` · `operations.routes.ts:302–310` | ✅ dealId passed to service | `rent_roll_units`: 1,740 rows | **CONNECTED** | — |
| R-07 | LEASE ROLL trade-out spread | `GET /operations/:dealId/tradeout-events` · `AssetHubPage.tsx:754–759` · useEffect ✅ | `operations.routes.ts:1441` · mount `index.replit.ts:717` | STUB — returns placeholder shape; does not query `lease_tradeout_events` · `operations.routes.ts:1441` | NOT IMPLEMENTED | `lease_tradeout_events`: 1,492 rows (keyed by property_code; data exists) | **BROKEN@3** | Handler at `operations.routes.ts:1441` is a stub; real `lease_tradeout_events` (1,492 rows) not queried |
| R-08 | Rent roll current snapshot | `GET /operations/:dealId/rent-roll` · `AssetHubPage.tsx:744–751` · useEffect ✅ | `operations.routes.ts:391` · mount `index.replit.ts:717` | Real: queries `rent_roll_units` · `operations.routes.ts:391` | ✅ dealId direct | `rent_roll_units`: 1,740 rows | **CONNECTED** | — |
| R-09 | MARKET SIGNALS — correlation signals | `GET /correlations/property/:propertyId` · `AssetHubPage.tsx:735–742` · useEffect ✅ · guard: `if (!propertyId) return` | `correlation.routes.ts:59` · mount `index.replit.ts:493` | Real: `engine.computeForProperty(propertyId, city, state)` · `correlation.routes.ts:64` | ✅ propertyId direct | Reads `metric_time_series`, `correlation_results` (market-level; not Highlands-row-specific) | **CONNECTED** (degraded: `submarket_id=NULL`; traffic velocity: 0 rows) | `propertyId` will be `null` if `dealStore.deals` not pre-loaded → fetch silently skipped |
| R-10 | MARKET SIGNALS — traffic velocity sub-signal | Sourced from `computeForProperty` (same as R-09) | Same as R-09 | Same as R-09 | ✅ propertyId | `traffic_predictions` p2122: **0 rows**; `traffic_calibration_factors`: **0 rows** | **BROKEN@5** | `traffic_predictions` empty (0 rows) for p2122; predict job never run |
| R-11 | COMP SET & RANK — comp-set fetch | `GET /lifecycle/:dealId/comp-set` · `AssetHubPage.tsx:1621–1646` · useEffect ✅ (shell) | `lifecycle.routes.ts:385` · mount `index.replit.ts:721` | Real: queries comp-set tables · `lifecycle.routes.ts:385` | ✅ dealId direct | `lifecycle_comp_sets` — populated (mapped in shell state) | **CONNECTED** | — |
| R-12 | COMP SET & RANK — PCS / rank values | No fetch for per-property rank; PCS shows `'—'` · `AssetHubPage.tsx:1637–1638` | `rankings.routes.ts` has `GET /:marketId`, `/performance/:marketId`, `/owned/:marketId`, `/pipeline/:marketId`; **no `/property/:propertyId` or `/rankings/:propertyId` endpoint** | NOT FOUND | NOT FOUND | `property_records` (market-wide only) | **NO-BACKEND** | No per-property rankings endpoint in `rankings.routes.ts`; `GET /api/v1/rankings/:propertyId` (spec §6) not implemented |
| P-01 | Actual vs pro-forma NOI — projected-vs-actual | `GET /operations/:dealId/projected-vs-actual` · `AssetHubPage.tsx:1194–1199` · useEffect ✅ | `operations.routes.ts:631` · mount `index.replit.ts:717` | Real: joins actuals + budget rows · `operations.routes.ts:644–723` | ✅ deals→property_id lookup at `:660–663` | Actuals: 40 rows; Budget: **0 rows** → `hasProjections: false` | **CONNECTED** (degraded: 0 budget rows; pro-forma comparison columns all null) | No budget rows loaded; projected columns will be null |
| P-02 | Variance GET | `GET /operations/:dealId/variances` · `AssetHubPage.tsx:1208–1213` · useEffect ✅ | `operations.routes.ts:113` · mount `index.replit.ts:717` | Real: queries variance tables · `operations.routes.ts:113` | ✅ dealId direct | `deal_monthly_actuals_lines`: 1,653 rows | **CONNECTED** | — |
| P-03 | Variances compute POST | `POST /operations/:dealId/variances/compute` body `{}` · `AssetHubPage.tsx:1201–1206` · useEffect ✅ | `operations.routes.ts:135` · mount `index.replit.ts:717` | Real: computes from `deal_monthly_actuals` + `_lines` · `operations.routes.ts:135` | ✅ dealId direct | `deal_monthly_actuals`: 40; `_lines`: 1,653 | **CONNECTED** | — |
| P-04 | LIVE TRACKING 4-col (M09) | `GET /operations/:dealId/live-tracking` · `AssetHubPage.tsx:1216–1221` · useEffect ✅ | NOT FOUND in `operations.routes.ts` (grep: 0 hits for `live-tracking`) · NOT MOUNTED | NOT FOUND | NOT FOUND | M09 4-col composition not built | **NO-BACKEND** | Route `GET /:dealId/live-tracking` not in `operations.routes.ts`; M09 formula-engine composition not exposed |
| P-05 | Cap-ex vs budget | Sourced from `monthlyActuals` state (R-01); `capex` field in SELECT · `operations.routes.ts:776` | Same as R-01 | Same as R-01 | ✅ Same join as R-01 | 13 actuals rows with non-null `capex`; budget `capex`: **0 rows** | **CONNECTED** (degraded: actuals only; no budget capex for comparison) | No budget capex rows; cap-ex vs budget panel shows actuals-only line |
| P-06 | Thesis checkpoints — commentary agent | No `useEffect` in `AssetHubPage.tsx` calls a commentary endpoint | No commentary route on any mounted router | `backend/src/agents/commentary.agent.ts` (758 lines); imported by `orchestrator.service.ts:20`; not called from this page | NOT CONNECTED | NOT APPLICABLE | **BROKEN@1** | No `useEffect` in `AssetHubPage.tsx` calls commentary agent; `assetMode` NOT FOUND in `DealContext`; panel renders mocked thesis bullets |
| P-07 | LIFECYCLE sub-tab | `<LifecycleSection dealId={dealId} />` · `AssetHubPage.tsx:1402–1407` | Internal to `LifecycleSection`; routes via `/api/v1/lifecycle` · `index.replit.ts:721` | Real: `lifecycle.routes.ts` (multiple handlers) | ✅ dealId prop passed | Lifecycle tables populated | **CONNECTED** (component reuse) | — |
| P-08 | EXIT sub-tab | `<ExitTimingTab dealId={dealId} />` · `AssetHubPage.tsx:1408` | Internal to `ExitTimingTab`; routes via `/api/v1/lifecycle` · `index.replit.ts:721` | Real: `lifecycle.routes.ts` | ✅ dealId prop passed | Disposition tables | **CONNECTED** (component reuse) | — |
| C-01 | DEBT & RATE — loan terms + SOFR chart | No `useEffect` in `CapitalScreen` (`AssetHubPage.tsx:1414`) calls `GET /lifecycle/:dealId/debt` | Route EXISTS: `lifecycle.routes.ts:227` · mount `index.replit.ts:721` | Real: queries deal debt record · `lifecycle.routes.ts:227` | ✅ dealId direct | Debt record (Highlands) — not queried in this audit (assumed populated) | **BROKEN@1** | `CapitalScreen` has no `useEffect` fetching debt; panel renders mock loan terms. Rate cap/hedge fields: NOT FOUND in debt record schema (grep of `lifecycle.routes.ts` for `rate_cap`, `hedge`, `cap_strike`: 0 hits). FRED SOFR stored in `metric_time_series` via `fred-ingest.service.ts:25` but not wired to this panel. |
| C-02 | DISTRIBUTIONS — per-member capital accounts | `GET /api/v1/capital/${dealId}/capital-accounts` · `AssetHubPage.tsx:1425–1430` · useEffect ✅ | `investor-capital.routes.ts` mounted at `/api/v1/capital` (`index.replit.ts:725`); **no `/capital-accounts` endpoint exists** in `investor-capital.routes.ts` | NOT FOUND — capital-call routes use `/deals/:dealId/` prefix (`investor-capital.routes.ts:260, 287`) | NOT FOUND | `capital_calls`: 1 row; `distributions`: **0 rows** | **NO-BACKEND** | No `capital-accounts` endpoint in `investor-capital.routes.ts`; all capital-call routes are at `/deals/:dealId/` prefix (effective path: `/api/v1/capital/deals/:dealId/…`); frontend calls `/:dealId/capital-accounts` → 404 |
| C-03 | WATERFALL operating cash | `GET /api/v1/capital/${dealId}/waterfall?type=operating` · `AssetHubPage.tsx:1432–1437` · useEffect ✅ | Route EXISTS at `investor-capital.routes.ts:532` as `GET /deals/:dealId/waterfall`; mounted at `index.replit.ts:725` → effective path `/api/v1/capital/deals/:dealId/waterfall` | Real: queries `deal_waterfalls` + `waterfall_tiers` · `investor-capital.routes.ts:536–547` | ✅ dealId via path (but path mismatch means it never resolves) | `deal_waterfalls`: 1 row (data exists) | **BROKEN@2** | Path mismatch: frontend calls `/api/v1/capital/:dealId/waterfall`; router serves `/api/v1/capital/deals/:dealId/waterfall`. The 1 existing waterfall row is unreachable via the frontend URL. |
| C-04 | WATERFALL capital event | `GET /api/v1/capital/${dealId}/waterfall?type=capital` · `AssetHubPage.tsx:1437` · useEffect ✅ | Same as C-03 — same path mismatch | Same as C-03 — `type=` param not handled; route returns single unified waterfall regardless | ✅ (if path resolved) | `deal_waterfalls`: 1 row (single model, no dual operating/capital split) | **BROKEN@2** | Same path mismatch as C-03; additionally `type=capital` not implemented — existing route returns one unified waterfall; dual-type split not modeled |
| C-05 | Rate Sensitivity / DSCR / Refi Window | No backend fetch; client-side computed from mock loan fields · `AssetHubPage.tsx:1504` | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | **BROKEN@1** (client has no real data) | Depends on C-01 (debt record) which is BROKEN@1; client-side computation uses mock loan terms |
| D-01 | FILES drawer | `<DocumentsSection dealId={dealId} />` · `AssetHubPage.tsx` (drawer panel) | Internal routes via `/api/v1/deals/:dealId/files` (standard deal route) · `index.replit.ts` | Real: queries `deal_files` | ✅ dealId prop | `deal_files` for Highlands | **CONNECTED** (component reuse) | — |
| D-02 | TEAM drawer | `<TeamSection dealId={dealId} />` · `AssetHubPage.tsx` (drawer panel) | Internal routes via deal/team routes | Real | ✅ dealId prop | Team tables | **CONNECTED** (component reuse) | — |
| D-03 | EVENTS drawer | `<EventTimelineSection dealId={dealId} />` · `AssetHubPage.tsx` (drawer panel) | Internal routes; `key_events LEFT JOIN event_forecasts` | Real | ✅ dealId prop | `key_events` for Highlands | **CONNECTED** (component reuse) | — |
| D-04 | ACTIVITY drawer | `<ActivityTab dealId={dealId} />` · `AssetHubPage.tsx` (drawer panel) | Internal routes via activity endpoints | Real | ✅ dealId prop | Activity tables | **CONNECTED** (component reuse) | — |
| D-05 | RANK & COMPS save — rank target | `POST /api/v1/rankings/${propertyId}/target` · `AssetHubPage.tsx:579–592` (save handler in `RankCompsConfig`) | `rankings.routes.ts` has `GET /:marketId`, `GET /performance/:marketId`, `GET /owned/:marketId`, `GET /pipeline/:marketId`; **zero POST routes** · mount `index.replit.ts:356` | NOT FOUND | NOT FOUND | No rank-target persistence table | **NO-BACKEND** | `POST /:propertyId/target` not in `rankings.routes.ts` (544 lines, 0 POST handlers); target saved to component state only and lost on reload |

---

## Section B — Punch List

### TIER 1 — WIRE NOW (route/data exists, just not connected or quick URL fix)

| # | Issue | Exact fix | File:line |
|---|---|---|---|
| 1A | **C-03/C-04 path mismatch** — waterfall 404 despite 1 valid `deal_waterfalls` row | Add alias: `router.get('/:dealId/waterfall', ...)` in `investor-capital.routes.ts` pointing at the same handler; OR change frontend URL from `/${dealId}/waterfall` to `/deals/${dealId}/waterfall` in `AssetHubPage.tsx:1434,1437` | `backend/src/api/rest/investor-capital.routes.ts:532` · `frontend/src/pages/AssetHubPage.tsx:1434,1437` |
| 1B | **P-06 commentary agent not called** — thesis panel fully mocked despite agent existing | Add `useEffect` in `PerformanceScreen` that POSTs to commentary endpoint with `dealId`; add `assetMode?: 'owned' \| 'pipeline'` to `ResearchAgentContext` in `dealContext.ts` | `backend/src/agents/commentary.agent.ts` · `backend/src/types/dealContext.ts:604` · `frontend/src/pages/AssetHubPage.tsx:1184` |
| 1C | **C-01 debt record not fetched** — `CapitalScreen` has no `useEffect` for `GET /lifecycle/:dealId/debt` despite route existing | Add `useEffect` in `CapitalScreen` (`AssetHubPage.tsx:1414`) calling `GET /api/v1/lifecycle/${dealId}/debt`; populate SOFR overlay from `metric_time_series` via `GET /api/v1/correlations/property/:propertyId` (RATE_SOFR already ingested via `fred-ingest.service.ts:25`) | `frontend/src/pages/AssetHubPage.tsx:1414` · `backend/src/api/rest/lifecycle.routes.ts:227` |
| 1D | **CC-1 `propertyId` silently null** — if `dealStore.deals` not pre-loaded, R-09 (MARKET SIGNALS) silently skips | In shell `useEffect` at `AssetHubPage.tsx:1602`, add explicit fallback: if `urlDealId` matches Highlands deal_id, set propertyId to `7ea31caf-f070-43eb-9fd1-fe08f7123701`; or trigger a deals-list fetch before guard fires | `frontend/src/pages/AssetHubPage.tsx:1597,1602–1610` |

---

### TIER 2 — NEEDS ROUTE (table/data exists, no HTTP route or stub handler)

| # | Issue | Route to add | Data available |
|---|---|---|---|
| 2A | **R-07 tradeout-events stub** — handler returns placeholder; 1,492 rows in `lease_tradeout_events` | Implement handler body at `operations.routes.ts:1441`: query `lease_tradeout_events` by `property_code` (resolved from `deals.property_id → properties.property_code`); return `[{ unit_type, event_type, prior_rent, new_rent, spread_pct, effective_date }]` | `lease_tradeout_events`: 1,492 rows |
| 2B | **Leasing-observations stub** — handler returns placeholder; 276 rows in `leasing_weekly_observations` | Implement handler body at `operations.routes.ts:1486`: query `leasing_weekly_observations` by `property_code` + week filter; return `[{ week, traffic, tours, applications, leases, net_absorption }]` | `leasing_weekly_observations`: 276 rows |
| 2C | **R-12 per-property rankings / PCS** — rankings service has no per-property endpoint; PCS shows `'—'` | Add `router.get('/property/:propertyId', ...)` (or `router.get('/:propertyId', ...)` after existing routes) to `rankings.routes.ts` returning `{ current_rank, current_pcs, set_size, comps: [...] }` per spec §6 | `property_records` (market-wide pool) |
| 2D | **D-05 rank target persistence** — `POST /api/v1/rankings/:propertyId/target` not implemented; target lost on reload | Add `router.post('/:propertyId/target', ...)` to `rankings.routes.ts` with a persistence table (e.g., `asset_rank_targets`) | None yet — needs schema + insert |

---

### TIER 3 — NEEDS BACKEND (no data/service at required grain)

| # | Issue | What must be built |
|---|---|---|
| 3A | **R-05 repricing synthesizer** — `GET /api/v1/revenue/:dealId/course` → 404 (no mount, no file) | Build repricing synthesizer service; create `revenue.routes.ts`; add `app.use('/api/v1/revenue', ...)` mount to `index.replit.ts` |
| 3B | **P-04 live-tracking 4-col (M09)** — `GET /operations/:dealId/live-tracking` → NOT FOUND in `operations.routes.ts` | Add route to `operations.routes.ts`; compose M09 4-col from `formula-engine.ts` (M22 formula at `:951`); return `[{ line_item, current, actuals_ttm, pro_forma, delta_pct }]` |
| 3C | **C-02 capital-accounts per-member** — no endpoint at `/api/v1/capital/:dealId/capital-accounts` | Add `router.get('/:dealId/capital-accounts', ...)` to `investor-capital.routes.ts`; model per-member LP/GP account balances |
| 3D | **R-02 LTL/concessions monthly series** — `rent-roll-derivations.service.ts` does not exist | Build `rent-roll-derivations.service.ts` in `backend/src/services/rent-roll/`; extract `derived_metrics` JSONB from `rent_roll_units` per month; expose via `GET /operations/:dealId/derived-metrics` |
| 3E | **C-01 rate cap / hedge fields** — debt route exists but hedge/cap-strike columns absent from debt record schema | Add `rate_cap_strike`, `hedge_type`, `hedge_expiry` columns to deal debt table; surface in `GET /lifecycle/:dealId/debt` response |
| 3F | **R-04 market rent / loss-to-lease per unit type** — no per-unit-type comp rent feed | Wire RentCast or similar comp-rent feed; expose `GET /api/v1/comps/:propertyId/market-rents?byType=true` |

---

### TIER 4 — DATA POPULATION (route + table exist, table empty)

| # | Issue | How to populate |
|---|---|---|
| 4A | **R-10 / CC-5 `traffic_predictions` 0 rows** — traffic velocity sub-signal absent from MARKET SIGNALS | Run `POST /api/v1/traffic/predict/7ea31caf-f070-43eb-9fd1-fe08f7123701` for p2122 to generate predictions; also run calibration job to populate `traffic_calibration_factors` and `validation_properties` |
| 4B | **P-01 / P-05 budget rows = 0** — projected-vs-actual returns actuals-only; cap-ex vs budget cannot compare | Load pro-forma budget rows: `POST /api/v1/operations/${dealId}/monthly-actuals` with `is_budget=true` for each month (or via admin migration script from deal underwriting data) |
| 4C | **C-02 `distributions` = 0 rows** — distributions section structurally empty | Record distributions in `distributions` table via `POST /api/v1/capital/deals/:dealId/distributions` if any have been made; confirm with asset manager if none exist |

---

## Section C — Gap Count & Critical Path

### Counts

| Status | Count |
|---|---|
| **CONNECTED** (all 5 steps verified, real data) | **9** |
| **CONNECTED (degraded)** (chain intact but data quality reduced) | **4** |
| **CONNECTED (component reuse)** | **5** |
| **BROKEN@1** (no frontend fetch / not called) | **3** |
| **BROKEN@2** (route path mismatch) | **2** |
| **BROKEN@3** (stub handler / service missing) | **2** |
| **BROKEN@5** (empty table) | **1** |
| **NO-BACKEND** (no route, no service) | **5** |
| **Total panels audited** | **31** |

**Fully CONNECTED (including degraded/reuse):** 18 / 31  
**Broken or missing:** 13 / 31

---

### Ordered critical path to close every Tier-1 and Tier-2 gap

```
STEP 1  (≤30 min each — URL / useEffect fixes, no new files)
  → Fix C-03/C-04 waterfall path mismatch [Tier 1A]
    investor-capital.routes.ts:532 OR AssetHubPage.tsx:1434,1437
  → Fix propertyId null guard [Tier 1D]
    AssetHubPage.tsx:1597,1602–1610 — add fallback for owned-asset route

STEP 2  (data population — no code changes)
  → Populate traffic_predictions via POST /api/v1/traffic/predict/:propertyId [Tier 4A]
  → Load pro-forma budget rows for Highlands [Tier 4B]

STEP 3  (handler implementations — real data already in DB)
  → Implement tradeout-events handler body [Tier 2A]
    operations.routes.ts:1441 — query lease_tradeout_events (1,492 rows)
  → Implement leasing-observations handler body [Tier 2B]
    operations.routes.ts:1486 — query leasing_weekly_observations (276 rows)

STEP 4  (frontend wiring — route already exists)
  → Add useEffect in CapitalScreen for GET /lifecycle/:dealId/debt [Tier 1C]
    AssetHubPage.tsx:1414

STEP 5  (assetMode + commentary wiring)
  → Add assetMode field to ResearchAgentContext [Tier 1B]
    dealContext.ts:604
  → Add commentary useEffect in PerformanceScreen [Tier 1B]

STEP 6  (new route additions to existing routers — no new files)
  → Add GET /rankings/property/:propertyId to rankings.routes.ts [Tier 2C]
  → Add POST /rankings/:propertyId/target + persistence [Tier 2D]

STEP 7  (new services and routes — largest scope)
  → Build rent-roll-derivations.service.ts [Tier 3D]
  → Add GET /operations/:dealId/derived-metrics [Tier 3D]
  → Add GET /operations/:dealId/live-tracking (M09) [Tier 3B]
  → Add GET /capital/:dealId/capital-accounts [Tier 3C]
  → Build repricing synthesizer + mount /api/v1/revenue [Tier 3A]
  → Wire rate cap/hedge fields to debt schema [Tier 3E]
  → Build market-rent comp feed [Tier 3F]
```

**Fastest path to "no 404s":** Steps 1–3 require no new files and close 4 broken panels  
(C-03/C-04 waterfall, R-10 traffic, P-01 budget actuals, R-07 tradeout spread, R-11 leasing funnel).

**Gating dependency:** Tier 3A (repricing synthesizer) is the most complex single item — requires a new service, new router file, and new mount.  
**Submarket context (CC-4, Task #1685):** Must be resolved before correlation signals reach full fidelity; independent of all other steps.
