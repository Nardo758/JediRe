# CONSOLE WIRING AUDIT — Asset Hub Console
**Generated:** 2026-06-01  
**Page:** `frontend/src/pages/AssetHubPage.tsx` (1,825 lines)  
**Property:** Highlands at Sweetwater Creek  
**deal_id:** `eaabeb9f-830e-44f9-a923-56679ad0329d`  
**property_id:** `7ea31caf-f070-43eb-9fd1-fe08f7123701`  
**Phase tag in file:** `PHASE C · stubs wired`

---

## Part 1 — DB Snapshot (Highlands only)

| Table | Row count | Notes |
|---|---|---|
| `deal_monthly_actuals` (actuals) | **40** | Resolved via `property_id + is_portfolio_asset=TRUE`; is_budget=false |
| `deal_monthly_actuals` (budget) | **0** | is_budget=true — no pro-forma budget rows loaded |
| `deal_monthly_actuals_lines` | **1,653** | GL-level detail lines |
| `lease_tradeout_events` | **1,492** | Keyed by `property_code`; not yet surfaced via route |
| `leasing_weekly_observations` | **276** | Keyed by `property_code`; not yet surfaced via route |
| `rent_roll_units` | **1,740** | deal_id keyed; reachable via GET /operations/:dealId/rent-roll |
| `traffic_predictions` | **0** | Table is empty — traffic predict job never run for p2122 |
| `capital_calls` | **1** | One draft call record |
| `distributions` | **0** | No distributions recorded |
| `deal_waterfalls` | **1** | One waterfall config row exists |
| `key_events` (deal) | — | Not queried in this audit |

**Submarket linkage:** `properties.submarket_id = NULL` for p2122 (Task #1685 open).  
**Budget rows:** 0 — `projected-vs-actual` will return actuals-only mode (`hasProjections: false`).  
**Capex in actuals:** 13 rows with non-null `capex`; no budget capex for comparison.

---

## Part 2 — Route Mount Index

| Mount path | Router file | Auth at mount | index.replit.ts line |
|---|---|---|---|
| `/api/v1/operations` | `operations.routes.ts` | None (per-route `requireAuth`) | 717 |
| `/api/v1/rankings` | `rankings.routes.ts` | `optionalAuth` | 356 |
| `/api/v1/correlations` | `correlation.routes.ts` | None (per-route varies) | 493 |
| `/api/v1/capital` | `investor-capital.routes.ts` | `requireAuth` | 725 |
| `/api/v1/lifecycle` | `lifecycle.routes.ts` | (per-route) | 721 |
| `/api/v1/revenue` | **— NOT MOUNTED —** | — | — |
| `/api/v1/capital-structure` | `capital-structure.routes.ts` | `requireAuth` | 658 |

> `revenue.routes.ts` **does not exist**. No `/api/v1/revenue` mount is registered.

---

## Part 3 — 5-Step Connection Trace (All Panels)

Each trace follows: **(1) UI component → (2) apiClient call → (3) Express mount → (4) Handler → (5) Data source**

---

### SCREEN: REVENUE

---

#### R-01 · Monthly-Actuals Hero (occ / rent / NOI / RevPAU)

| Step | Detail |
|---|---|
| 1. UI Component | `RevenueScreen` useEffect `[dealId, activeScreen]` — `AssetHubPage.tsx:716–724` |
| 2. apiClient call | `GET /api/v1/operations/${dealId}/monthly-actuals?limit=53` |
| 3. Express mount | `app.use('/api/v1/operations', operationsRouter)` — `index.replit.ts:717` |
| 4. Handler | `router.get('/:dealId/monthly-actuals', requireAuth, ...)` — `operations.routes.ts:752` |
| 5. Data source | `deal_monthly_actuals` via `property_id + is_portfolio_asset=TRUE` — **40 rows** |

**Status: ✅ WIRED** — Full chain intact. 40 actuals rows will be returned.

---

#### R-02 · LTL / Concessions Monthly Series

| Step | Detail |
|---|---|
| 1. UI Component | `RevenueScreen` hero chart — `AssetHubPage.tsx:831–868` (rendered flat from last actuals) |
| 2. apiClient call | None — rendered as flat latest-value from `monthlyActuals` state |
| 3. Express mount | Would require `rent-roll-derivations.service.ts` → no route exposes it |
| 4. Handler | **SERVICE DOES NOT EXIST** — `backend/src/services/rent-roll/rent-roll-derivations.service.ts` not found |
| 5. Data source | `rent_roll_units.derived_metrics` JSONB — exists in table but no extraction layer |

**Status: ❌ SERVICE MISSING** — Per-month LTL/concessions series cannot be served. UI renders latest value flat with `// TODO(data)`.

---

#### R-03 · Lease Expirations — LEASE ROLL

| Step | Detail |
|---|---|
| 1. UI Component | `RevenueScreen` useEffect `[dealId, activeScreen]` — `AssetHubPage.tsx:726–733` |
| 2. apiClient call | `GET /api/v1/operations/${dealId}/lease-expirations?months=24` |
| 3. Express mount | `app.use('/api/v1/operations', operationsRouter)` — `index.replit.ts:717` |
| 4. Handler | `router.get('/:dealId/lease-expirations', requireAuth, ...)` — `operations.routes.ts:302` |
| 5. Data source | `analyzeLeaseExpirations(dealId)` — derived from `rent_roll_units` (1,740 rows) |

**Status: ✅ WIRED** — Full chain intact. `rent_roll_units` has 1,740 rows; expiration analysis will compute.

---

#### R-04 · Correlation Signals — MARKET SIGNALS

| Step | Detail |
|---|---|
| 1. UI Component | `RevenueScreen` useEffect `[propertyId, activeScreen]` — `AssetHubPage.tsx:735–742` |
| 2. apiClient call | `GET /api/v1/correlations/property/${propertyId}` |
| 3. Express mount | `app.use('/api/v1/correlations', correlationRouter)` — `index.replit.ts:493` |
| 4. Handler | `router.get('/property/:propertyId', ...)` — `correlation.routes.ts:59` |
| 5. Data source | `CorrelationEngineService.computeForProperty(propertyId, city, state)` |

**Status: ✅ WIRED (degraded)** — Chain intact; however `properties.submarket_id = NULL` for p2122 (Task #1685) means submarket-level signals use a fallback and are lower confidence.

---

#### R-05 · Traffic Velocity (MARKET SIGNALS sub-signal)

| Step | Detail |
|---|---|
| 1. UI Component | Embedded within correlation signals panel — `AssetHubPage.tsx:1077–1143` |
| 2. apiClient call | Sourced from `traffic_predictions` via `computeForProperty` |
| 3. Express mount | `/api/v1/correlations` — same as R-04 |
| 4. Handler | `CorrelationEngineService.computeForProperty` reads `traffic_predictions` |
| 5. Data source | `traffic_predictions` — **0 rows** for p2122 |

**Status: ❌ EMPTY TABLE** — `traffic_predictions` has 0 rows. Traffic velocity signal will be absent or synthetic. Requires running `POST /api/v1/traffic/predict/:propertyId` first.

---

#### R-06 · Tradeout Events — LEASE ROLL spread column

| Step | Detail |
|---|---|
| 1. UI Component | `RevenueScreen` useEffect `[dealId, activeScreen]` — `AssetHubPage.tsx:754–759` |
| 2. apiClient call | `GET /api/v1/operations/${dealId}/tradeout-events` |
| 3. Express mount | `app.use('/api/v1/operations', operationsRouter)` — `index.replit.ts:717` |
| 4. Handler | Stub added Task #1701 — `operations.routes.ts:1441` |
| 5. Data source | `lease_tradeout_events` — **1,492 rows** exist but handler is a stub (returns placeholder shape) |

**Status: ⚠️ STUB** — Route exists and responds (no 404). Real 1,492 rows exist in `lease_tradeout_events` but the handler does not yet query them. UI renders stub data with amber badge.

---

#### R-07 · Leasing Weekly Observations — LEASING FUNNEL

| Step | Detail |
|---|---|
| 1. UI Component | `RevenueScreen` useEffect `[dealId, activeScreen]` — `AssetHubPage.tsx:761–769` |
| 2. apiClient call | `GET /api/v1/operations/${dealId}/leasing-observations?weeks=52` |
| 3. Express mount | `app.use('/api/v1/operations', operationsRouter)` — `index.replit.ts:717` |
| 4. Handler | Stub added Task #1701 — `operations.routes.ts:1486` |
| 5. Data source | `leasing_weekly_observations` — **276 rows** exist but handler is a stub |

**Status: ⚠️ STUB** — Route exists (no 404). 276 real rows exist in `leasing_weekly_observations` but handler returns placeholder. UI renders stub with amber badge.

---

#### R-08 · Repricing Course — JEDI SIGNAL + REPRICING COURSE panel

| Step | Detail |
|---|---|
| 1. UI Component | `RevenueScreen` useEffect `[dealId, activeScreen]` — `AssetHubPage.tsx:771–777` |
| 2. apiClient call | `GET /api/v1/revenue/${dealId}/course` |
| 3. Express mount | **NO MOUNT** — `/api/v1/revenue` not registered in `index.replit.ts` |
| 4. Handler | `revenue.routes.ts` does not exist |
| 5. Data source | Repricing synthesizer — not built |

**Status: ❌ NEW-BACKEND** — 404 on every call. UI catches error and renders stub placeholder. No `/api/v1/revenue` mount, no file, no synthesizer service.

---

#### R-09 · Rent Roll Current Snapshot

| Step | Detail |
|---|---|
| 1. UI Component | `RevenueScreen` useEffect `[dealId, activeScreen]` — `AssetHubPage.tsx:744–751` |
| 2. apiClient call | `GET /api/v1/operations/${dealId}/rent-roll` |
| 3. Express mount | `app.use('/api/v1/operations', operationsRouter)` — `index.replit.ts:717` |
| 4. Handler | `router.get('/:dealId/rent-roll', requireAuth, ...)` — `operations.routes.ts:391` |
| 5. Data source | `rent_roll_units` — **1,740 rows** |

**Status: ✅ WIRED** — Full chain intact.

---

#### R-10 · Comp Set (Shell + Drawer seed)

| Step | Detail |
|---|---|
| 1. UI Component | Shell `AssetHubPage` useEffect `[dealId]` — `AssetHubPage.tsx:1621–1646` |
| 2. apiClient call | `GET /api/v1/lifecycle/${dealId}/comp-set` |
| 3. Express mount | `app.use('/api/v1/lifecycle', lifecycleRouter)` — `index.replit.ts:721` |
| 4. Handler | `router.get('/:dealId/comp-set', requireAuth, ...)` — `lifecycle.routes.ts:385` |
| 5. Data source | `lifecycle_comp_sets` / comp records joined to `properties` |

**Status: ✅ WIRED** — Full chain intact. Populates both the drawer editor and the COMP SET & RANK leaderboard.

---

#### R-11 · Rankings / PCS (COMP SET & RANK leaderboard)

| Step | Detail |
|---|---|
| 1. UI Component | `RevenueScreen` — `AssetHubPage.tsx:1077–1143` (uses `comps` state from comp-set fetch) |
| 2. apiClient call | No dedicated per-property ranking fetch; PCS shown as `'—'` (`AssetHubPage.tsx:1637–1638`) |
| 3. Express mount | `/api/v1/rankings` has `GET /:marketId` — market-scoped, not property-scoped |
| 4. Handler | `rankings.routes.ts:121` — `GET /:marketId` returns top-30 by market; no `/property/:propertyId` |
| 5. Data source | `property_records` (market-wide, not owned-asset specific) |

**Status: ⚠️ UNWIRED** — Rankings service has no per-property endpoint. PCS/rank values show `'—'`. `GET /api/v1/rankings/:propertyId` spec (§6) does not exist in `rankings.routes.ts`.

---

### SCREEN: PERFORMANCE

---

#### P-01 · Projected vs Actual — Tracking Hero

| Step | Detail |
|---|---|
| 1. UI Component | `PerformanceScreen` useEffect `[dealId, activeScreen]` — `AssetHubPage.tsx:1194–1199` |
| 2. apiClient call | `GET /api/v1/operations/${dealId}/projected-vs-actual` |
| 3. Express mount | `app.use('/api/v1/operations', operationsRouter)` — `index.replit.ts:717` |
| 4. Handler | `router.get('/:dealId/projected-vs-actual', requireAuth, ...)` — `operations.routes.ts:631` |
| 5. Data source | `deal_monthly_actuals` — actuals: 40 rows; budget: **0 rows** |

**Status: ✅ WIRED (actuals-only)** — Chain intact. Returns `hasProjections: false` because no budget rows exist. Pro-forma comparison columns will be null; chart shows actuals line only.

---

#### P-02 · Variances GET — Line-item variance panel

| Step | Detail |
|---|---|
| 1. UI Component | `PerformanceScreen` useEffect `[dealId, activeScreen]` — `AssetHubPage.tsx:1208–1213` |
| 2. apiClient call | `GET /api/v1/operations/${dealId}/variances` |
| 3. Express mount | `app.use('/api/v1/operations', operationsRouter)` — `index.replit.ts:717` |
| 4. Handler | `router.get('/:dealId/variances', ...)` — `operations.routes.ts:113` |
| 5. Data source | `deal_monthly_actuals_lines` — **1,653 rows** |

**Status: ✅ WIRED** — Full chain intact.

---

#### P-03 · Variances Compute POST — Refresh trigger

| Step | Detail |
|---|---|
| 1. UI Component | `PerformanceScreen` useEffect `[dealId, activeScreen]` — `AssetHubPage.tsx:1201–1206` |
| 2. apiClient call | `POST /api/v1/operations/${dealId}/variances/compute` with `{}` body |
| 3. Express mount | `app.use('/api/v1/operations', operationsRouter)` — `index.replit.ts:717` |
| 4. Handler | `router.post('/:dealId/variances/compute', ...)` — `operations.routes.ts:135` |
| 5. Data source | Computes from `deal_monthly_actuals` + `deal_monthly_actuals_lines` |

**Status: ✅ WIRED** — Full chain intact. Fires on sub-tab mount.

---

#### P-04 · Live Tracking 4-col (M09)

| Step | Detail |
|---|---|
| 1. UI Component | `PerformanceScreen` useEffect `[dealId, activeScreen]` — `AssetHubPage.tsx:1216–1221` |
| 2. apiClient call | `GET /api/v1/operations/${dealId}/live-tracking` |
| 3. Express mount | `app.use('/api/v1/operations', operationsRouter)` — `index.replit.ts:717` |
| 4. Handler | **DOES NOT EXIST** — no `live-tracking` route in `operations.routes.ts` |
| 5. Data source | M09 4-col formula engine composition — not built |

**Status: ❌ NEW-BACKEND stub** — 404 on every call. UI catches error and renders stub 4-col table with amber badge. `// TODO(backend: M09 4-col endpoint)` at `AssetHubPage.tsx:1191`.

---

#### P-05 · Cap-ex vs Budget

| Step | Detail |
|---|---|
| 1. UI Component | Sourced from monthly-actuals state (R-01) — `AssetHubPage.tsx` (PERFORMANCE sub) |
| 2. apiClient call | Reuses monthly-actuals payload (`capex` field) |
| 3. Express mount | Same as R-01 |
| 4. Handler | `operations.routes.ts:752` — `capex` column included in SELECT |
| 5. Data source | `deal_monthly_actuals.capex` — **13 actuals rows** with non-null capex; **0 budget rows** |

**Status: ⚠️ MOCK (partial)** — Actuals capex is reachable via monthly-actuals but no budget capex exists for comparison. UI renders actual-only capex line and mocks budget line.

---

#### P-06 · Thesis Checkpoints (AI Commentary)

| Step | Detail |
|---|---|
| 1. UI Component | Not called from `AssetHubPage.tsx` — commentary output not wired to any useEffect |
| 2. apiClient call | None |
| 3. Express mount | No dedicated commentary endpoint for owned-asset context |
| 4. Handler | `CommentaryAgent` at `backend/src/agents/commentary.agent.ts` — imported in `orchestrator.service.ts:20` |
| 5. Data source | Market/acquisition commentary — `assetMode: 'owned'` field absent from `DealContext` (type: `ResearchAgentContext`) |

**Status: ⚠️ UNWIRED** — Commentary agent exists but is not called from this page. No `assetMode` field on `DealContext` (confirmed: zero grep hits in `backend/src/types/`). UI renders mocked thesis bullets.

---

#### P-07 · LIFECYCLE Sub-tab

| Step | Detail |
|---|---|
| 1. UI Component | `<LifecycleSection dealId={dealId} />` — `AssetHubPage.tsx:1402–1407` |
| 2. apiClient call | Internal to `LifecycleSection` component |
| 3. Express mount | `/api/v1/lifecycle` |
| 4. Handler | `lifecycle.routes.ts` (multiple routes) |
| 5. Data source | Lifecycle tables |

**Status: ✅ WIRED** — Component reuse; existing `LifecycleSection` is mounted with `dealId` prop.

---

#### P-08 · EXIT Sub-tab

| Step | Detail |
|---|---|
| 1. UI Component | `<ExitTimingTab dealId={dealId} />` — `AssetHubPage.tsx:1408` |
| 2. apiClient call | Internal to `ExitTimingTab` |
| 3. Express mount | `/api/v1/lifecycle` |
| 4. Handler | `lifecycle.routes.ts` |
| 5. Data source | Disposition / exit tables |

**Status: ✅ WIRED** — Component reuse; `ExitTimingTab` mounted with `dealId`.

---

### SCREEN: CAPITAL

---

#### C-01 · Capital Accounts (per-member)

| Step | Detail |
|---|---|
| 1. UI Component | `CapitalScreen` useEffect `[dealId]` — `AssetHubPage.tsx:1425–1430` |
| 2. apiClient call | `GET /api/v1/capital/${dealId}/capital-accounts` |
| 3. Express mount | `app.use('/api/v1/capital', requireAuth, investorCapitalRoutes)` — `index.replit.ts:725` |
| 4. Handler | **DOES NOT EXIST** — `investor-capital.routes.ts` has no `/capital-accounts` endpoint; all capital-call routes use `/deals/:dealId/` prefix |
| 5. Data source | `capital_calls`: 1 row; `distributions`: 0 rows — no per-member account model |

**Status: ❌ NEW-BACKEND stub** — 404 on every call. No `/capital-accounts` endpoint exists anywhere. `investor-capital.routes.ts` endpoint for capital calls is at `GET /deals/:dealId/capital-calls` (path mismatch). UI renders stub table with amber badge.

---

#### C-02 · Waterfall — Operating Cash

| Step | Detail |
|---|---|
| 1. UI Component | `CapitalScreen` useEffect `[dealId]` — `AssetHubPage.tsx:1432–1437` |
| 2. apiClient call | `GET /api/v1/capital/${dealId}/waterfall?type=operating` |
| 3. Express mount | `app.use('/api/v1/capital', requireAuth, investorCapitalRoutes)` — `index.replit.ts:725` |
| 4. Handler | `investor-capital.routes.ts:532` has `GET /deals/:dealId/waterfall` — **path mismatch**: frontend sends `/:dealId/waterfall`, router is `/deals/:dealId/waterfall` |
| 5. Data source | `deal_waterfalls`: 1 row; `waterfall_tiers` joined — data exists |

**Status: ❌ PATH MISMATCH** — Frontend URL resolves to `GET /api/v1/capital/:dealId/waterfall`. Mounted router expects `GET /api/v1/capital/deals/:dealId/waterfall`. 404 on every call. Underlying data (1 waterfall row) is reachable via the correct path but frontend never hits it. `type=` query param not implemented in the handler. UI renders stub with amber badge.

---

#### C-03 · Waterfall — Capital Event

| Step | Detail |
|---|---|
| 1. UI Component | `CapitalScreen` useEffect `[dealId]` — `AssetHubPage.tsx:1437` |
| 2. apiClient call | `GET /api/v1/capital/${dealId}/waterfall?type=capital` |
| 3. Express mount | Same as C-02 |
| 4. Handler | Same as C-02 — same path mismatch; `type=capital` not handled |
| 5. Data source | Same `deal_waterfalls` row — single waterfall model, no dual-type split |

**Status: ❌ PATH MISMATCH + NEW-BACKEND** — Same path mismatch as C-02. Additionally, the existing route returns one unified waterfall config; dual operating/capital-event split does not exist. UI renders stub.

---

#### C-04 · Debt & Rate hero (SOFR / all-in / hedge)

| Step | Detail |
|---|---|
| 1. UI Component | `CapitalScreen` — no `useEffect` calls a debt endpoint |
| 2. apiClient call | None |
| 3. Express mount | `GET /api/v1/lifecycle/:dealId/debt` — `lifecycle.routes.ts:227` — exists but not called |
| 4. Handler | `lifecycle.routes.ts:227` |
| 5. Data source | Deal debt record + FRED SOFR series |

**Status: ⚠️ UNWIRED** — Debt route exists in `lifecycle.routes.ts` but `CapitalScreen` does not call it. Debt & Rate panel renders mocked loan terms. `// TODO(data: rate cap / hedge)` noted in component. `AssetHubPage.tsx:1504` shows: "once `GET /api/v1/capital/:dealId/capital-accounts` returns hedge fields".

---

#### C-05 · Rate Sensitivity / DSCR / Refi Window

| Step | Detail |
|---|---|
| 1. UI Component | `CapitalScreen` — client-side computed from wired debt fields | 
| 2. apiClient call | None — computed in-component |
| 3–5. | No backend path |

**Status: ⚠️ MOCK** — Computed client-side from stub loan data. No backend dependency beyond C-04 (debt record).

---

#### C-06 · Distributions

| Step | Detail |
|---|---|
| 1. UI Component | Folded under C-01 capital-accounts stub |
| 2. apiClient call | `GET /api/v1/capital/${dealId}/capital-accounts` (bundles distributions) |
| 3. Express mount | See C-01 |
| 4. Handler | Real distributions route: `GET /api/v1/capital/deals/:dealId/distributions` — `investor-capital.routes.ts:401` — path mismatch + 0 rows |
| 5. Data source | `distributions` — **0 rows** for Highlands |

**Status: ❌ NEW-BACKEND stub + EMPTY DATA** — Path mismatch (same pattern as C-02) and zero distribution rows. UI renders stub.

---

### DRAWERS

---

#### D-01 · FILES Drawer

| Step | Detail |
|---|---|
| 1. UI Component | `<DocumentsSection dealId={dealId} />` — `AssetHubPage.tsx` (drawer panel) |
| 2–5. | Internal to `DocumentsSection`; uses `/api/v1/deals/:dealId/files` |

**Status: ✅ WIRED** — Component reuse.

---

#### D-02 · TEAM Drawer

| Step | Detail |
|---|---|
| 1. UI Component | `<TeamSection dealId={dealId} />` — drawer panel |
| 2–5. | Internal to `TeamSection` |

**Status: ✅ WIRED** — Component reuse.

---

#### D-03 · EVENTS Drawer

| Step | Detail |
|---|---|
| 1. UI Component | `<EventTimelineSection dealId={dealId} />` — drawer panel |
| 2–5. | Internal to `EventTimelineSection`; joins `key_events LEFT JOIN event_forecasts` |

**Status: ✅ WIRED** — Component reuse.

---

#### D-04 · ACTIVITY Drawer

| Step | Detail |
|---|---|
| 1. UI Component | `<ActivityTab dealId={dealId} />` — drawer panel |
| 2–5. | Internal to `ActivityTab` |

**Status: ✅ WIRED** — Component reuse.

---

#### D-05 · RANK & COMPS Drawer — Save Target

| Step | Detail |
|---|---|
| 1. UI Component | `RankCompsConfig` save handler — `AssetHubPage.tsx:579–592` |
| 2. apiClient call | `POST /api/v1/rankings/${propertyId}/target` |
| 3. Express mount | `app.use('/api/v1/rankings', optionalAuth, rankingsRouter)` — `index.replit.ts:356` |
| 4. Handler | **DOES NOT EXIST** — `rankings.routes.ts` has `GET /:marketId`, `GET /performance/:marketId`, `GET /owned/:marketId`, `GET /pipeline/:marketId`; **no POST route at all** |
| 5. Data source | No rank-target persistence table |

**Status: ❌ NEW-BACKEND stub** — POST call is caught in a try/catch; save note shows `'SAVING LOCALLY — BACKEND PENDING'`. Target is held in component state only and lost on page reload.

---

### SHELL

---

#### S-01 · Shell — dealId / propertyId Resolution

| Step | Detail |
|---|---|
| 1. UI Component | `AssetHubPage` default export — `AssetHubPage.tsx:1594–1613` |
| 2. Source | `useParams<{ dealId: string }>()` → `urlDealId` |
| 3. Store sync | `useDealStore(s => s.selectedAssetDealId)` and `useDealStore(s => s.selectedAssetPropertyId)` |
| 4. Resolution | `dealId = selectedAssetDealId ?? urlDealId ?? ''` — useEffect syncs URL → store, resolves `property_id` from `deals` list |
| 5. propertyId gap | If `deals` list in store is empty (not pre-loaded), `deal.property_id` lookup returns `null` → `propertyId = null` → correlation call skipped (R-04 guard: `if (!propertyId) return`) |

**Status: ⚠️ PARTIAL** — dealId resolves correctly from URL params. propertyId depends on `dealStore.deals` being populated; if the store hasn't loaded the deals list, `propertyId` stays `null` and MARKET SIGNALS fetch is skipped silently.

---

## Part 4 — Connection Matrix

| # | Panel | Screen | UI calls | Route exists? | Handler exists? | Data rows | Status |
|---|---|---|---|---|---|---|---|
| R-01 | Monthly-actuals hero | REVENUE | `/operations/:dealId/monthly-actuals` | ✅ | ✅ | 40 | **WIRED** |
| R-02 | LTL/concessions series | REVENUE | (none) | — | ❌ svc missing | — | **SERVICE MISSING** |
| R-03 | Lease expirations | REVENUE | `/operations/:dealId/lease-expirations` | ✅ | ✅ | 1,740 (rru) | **WIRED** |
| R-04 | Correlation signals | REVENUE | `/correlations/property/:propertyId` | ✅ | ✅ | — | **WIRED (degraded)** |
| R-05 | Traffic velocity | REVENUE | (via R-04) | ✅ | ✅ | 0 tp rows | **EMPTY TABLE** |
| R-06 | Tradeout events | REVENUE | `/operations/:dealId/tradeout-events` | ✅ (stub) | ⚠️ stub | 1,492 lte | **STUB** |
| R-07 | Leasing observations | REVENUE | `/operations/:dealId/leasing-observations` | ✅ (stub) | ⚠️ stub | 276 lwo | **STUB** |
| R-08 | Repricing course | REVENUE | `/revenue/:dealId/course` | ❌ no mount | ❌ | — | **NEW-BACKEND** |
| R-09 | Rent roll snapshot | REVENUE | `/operations/:dealId/rent-roll` | ✅ | ✅ | 1,740 rru | **WIRED** |
| R-10 | Comp-set (shell) | REVENUE/SHELL | `/lifecycle/:dealId/comp-set` | ✅ | ✅ | — | **WIRED** |
| R-11 | Rankings / PCS | REVENUE | (none — shows `—`) | ⚠️ market only | ⚠️ no /property | — | **UNWIRED** |
| P-01 | Projected vs actual | PERFORMANCE | `/operations/:dealId/projected-vs-actual` | ✅ | ✅ | 40/0 budget | **WIRED (actuals-only)** |
| P-02 | Variances GET | PERFORMANCE | `/operations/:dealId/variances` | ✅ | ✅ | 1,653 dmal | **WIRED** |
| P-03 | Variances compute | PERFORMANCE | `/operations/:dealId/variances/compute` | ✅ | ✅ | — | **WIRED** |
| P-04 | Live tracking 4-col | PERFORMANCE | `/operations/:dealId/live-tracking` | ❌ | ❌ | — | **NEW-BACKEND** |
| P-05 | Capex vs budget | PERFORMANCE | (from monthly-actuals) | ✅ | ✅ | 13/0 budget | **MOCK (no budget)** |
| P-06 | Thesis checkpoints | PERFORMANCE | (none called) | — | ⚠️ agent exists | — | **UNWIRED** |
| P-07 | LIFECYCLE sub-tab | PERFORMANCE | (internal to component) | ✅ | ✅ | — | **WIRED** |
| P-08 | EXIT sub-tab | PERFORMANCE | (internal to component) | ✅ | ✅ | — | **WIRED** |
| C-01 | Capital accounts | CAPITAL | `/capital/:dealId/capital-accounts` | ❌ | ❌ path mismatch | 1 cc / 0 dist | **NEW-BACKEND** |
| C-02 | Waterfall operating | CAPITAL | `/capital/:dealId/waterfall?type=operating` | ❌ path | ⚠️ wrong path | 1 wf | **PATH MISMATCH** |
| C-03 | Waterfall capital | CAPITAL | `/capital/:dealId/waterfall?type=capital` | ❌ path | ⚠️ wrong path | — | **PATH MISMATCH** |
| C-04 | Debt & Rate | CAPITAL | (not called) | ✅ lifecycle | ✅ not called | — | **UNWIRED** |
| C-05 | Rate sensitivity | CAPITAL | (client-side) | — | — | — | **MOCK** |
| C-06 | Distributions | CAPITAL | (via C-01) | ❌ path mismatch | ⚠️ wrong path | 0 rows | **NEW-BACKEND + EMPTY** |
| D-01 | FILES drawer | DRAWER | (internal) | ✅ | ✅ | — | **WIRED** |
| D-02 | TEAM drawer | DRAWER | (internal) | ✅ | ✅ | — | **WIRED** |
| D-03 | EVENTS drawer | DRAWER | (internal) | ✅ | ✅ | — | **WIRED** |
| D-04 | ACTIVITY drawer | DRAWER | (internal) | ✅ | ✅ | — | **WIRED** |
| D-05 | Rank target save | DRAWER | `/rankings/:propertyId/target` POST | ❌ | ❌ | — | **NEW-BACKEND** |
| S-01 | Shell ID resolution | SHELL | useParams + dealStore | ✅ | ✅ | — | **PARTIAL** |

---

## Part 5 — Tiered Punch List

### Tier 1 — Critical: live data expected, user sees error or silence

| ID | Issue | Impact | Fix required |
|---|---|---|---|
| T1-A | `traffic_predictions` = 0 rows | MARKET SIGNALS traffic velocity is absent/synthetic | Run `POST /api/v1/traffic/predict/7ea31caf…` for p2122 to populate table |
| T1-B | `deal_monthly_actuals` budget rows = 0 | PERFORMANCE tracking shows no pro-forma line; `hasProjections: false`; all delta columns null | Load proforma budget rows via `POST /operations/:dealId/monthly-actuals` with `is_budget=true` |
| T1-C | C-02/C-03 path mismatch: frontend calls `GET /api/v1/capital/:dealId/waterfall`, server serves `GET /api/v1/capital/deals/:dealId/waterfall` | Waterfall panels always 404; underlying data (1 wf row) is unreachable from the UI | Either (a) update frontend URL to `/capital/deals/${dealId}/waterfall` or (b) add alias route in `investor-capital.routes.ts` |
| T1-D | `propertyId` silently null when `dealStore.deals` not pre-loaded | MARKET SIGNALS fetch guard fires `return`, panel stays empty with no error | Pre-load the Highlands property_id in the shell effect or hard-code fallback for owned-asset route |

---

### Tier 2 — Data gaps: routes wired, underlying data absent or degraded

| ID | Issue | Impact | Fix required |
|---|---|---|---|
| T2-A | `properties.submarket_id = NULL` for p2122 | Correlation signals lack submarket context; Task #1685 | Populate `submarket_id` (Task #1685) |
| T2-B | `rent-roll-derivations.service.ts` does not exist | LTL and concessions monthly series cannot be computed or exposed | Build the derivations service (extracts `derived_metrics` JSONB per month) and wire a GET route |
| T2-C | Capex has 13 actuals rows but 0 budget rows | Capex-vs-budget chart shows only one line; variance is unmeasurable | Load capex budget into `deal_monthly_actuals` budget rows or source from capex schedule |
| T2-D | `distributions` = 0 rows | Distributions section is structurally empty even after path mismatch is fixed | Record distributions or confirm none have been made |
| T2-E | Commentary agent not called from `AssetHubPage` | Thesis checkpoints panel is fully mocked; no AI narrative | Wire `CommentaryAgent` call from `PerformanceScreen`; add `assetMode: 'owned'` to `DealContext` |

---

### Tier 3 — Stubs with real data behind them: route exists but handler is placeholder

| ID | Panel | Real rows | Handler status | Work to promote |
|---|---|---|---|---|
| T3-A | R-06 Tradeout events | 1,492 in `lease_tradeout_events` | Stub at `operations.routes.ts:1441` | Implement handler: query `lease_tradeout_events` by `property_id`, return per-spec shape |
| T3-B | R-07 Leasing observations | 276 in `leasing_weekly_observations` | Stub at `operations.routes.ts:1486` | Implement handler: query `leasing_weekly_observations` by `property_id` + week filter |

---

### Tier 4 — New backend required: no route, no service

| ID | Panel | §6 Contract endpoint | Work scope |
|---|---|---|---|
| T4-A | R-08 Repricing course | `GET /api/v1/revenue/:dealId/course` | Build repricing synthesizer service + route + mount `/api/v1/revenue` |
| T4-B | P-04 Live tracking 4-col | `GET /api/v1/operations/:dealId/live-tracking` | M09 composition in `formula-engine.ts`; add route to `operations.routes.ts` |
| T4-C | C-01 Capital accounts | `GET /api/v1/capital/:dealId/capital-accounts` | Per-member account model; add route to `investor-capital.routes.ts` |
| T4-D | C-03 Dual waterfall (capital type) | `GET /api/v1/capital/:dealId/waterfall?type=capital` | Dual-type split on existing waterfall model |
| T4-E | D-05 Rank target save | `POST /api/v1/rankings/:propertyId/target` | Add POST route to `rankings.routes.ts` + persistence table |
| T4-F | R-11 Per-property rankings | `GET /api/v1/rankings/:propertyId` | Add per-property endpoint to `rankings.routes.ts` (spec §6) |
| T4-G | DealContext assetMode | `assetMode: 'owned'` field | Add field to `ResearchAgentContext` type + propagate to commentary agent |

---

## Part 6 — Gap Count & Critical Path

### Summary counts

| Category | Count |
|---|---|
| ✅ WIRED (full chain, live data) | 10 |
| ✅ WIRED (component reuse) | 5 |
| ⚠️ WIRED but degraded (actuals-only / submarket null) | 2 |
| ⚠️ STUB (route exists, handler is placeholder, real data behind it) | 2 |
| ⚠️ UNWIRED (route exists, not called / path mismatch) | 4 |
| ⚠️ MOCK (no backend path; client-side or placeholder) | 2 |
| ❌ SERVICE MISSING (file does not exist) | 1 |
| ❌ NEW-BACKEND (no route, no service) | 4 |
| ❌ PATH MISMATCH (route exists at wrong URL) | 2 |
| ❌ EMPTY TABLE (route + handler exist, 0 rows) | 1 |
| **Total panels audited** | **33** |

### Critical path to "all panels show real data"

The blockers are ordered by dependency:

```
Step 1 (unblock MARKET SIGNALS traffic velocity):
  → Run POST /api/v1/traffic/predict/7ea31caf… for p2122   [T1-A]

Step 2 (unblock PERFORMANCE projected-vs-actual comparison):
  → Load pro-forma budget rows (is_budget=true) for Highlands  [T1-B]

Step 3 (fix CAPITAL waterfall + distributions reaching the UI):
  → Fix path mismatch: frontend URL /:dealId/waterfall → /deals/:dealId/waterfall
    OR add alias route to investor-capital.routes.ts           [T1-C]
  → Fix propertyId null-guard or pre-load in shell             [T1-D]

Step 4 (populate submarket context):
  → Complete Task #1685 (set submarket_id on p2122)            [T2-A]

Step 5 (promote stubs to real data — cheapest backend work):
  → Implement tradeout-events handler (1,492 rows waiting)     [T3-A]
  → Implement leasing-observations handler (276 rows waiting)  [T3-B]

Step 6 (add missing derivations layer):
  → Build rent-roll-derivations.service.ts for LTL/concessions [T2-B]
  → Wire commentary agent call + assetMode to DealContext      [T2-E] + [T4-G]
  → Wire debt record fetch in CapitalScreen                    [C-04]

Step 7 (net-new backend — largest scope):
  → POST /api/v1/rankings/:propertyId/target + persistence      [T4-E]
  → GET /api/v1/rankings/:propertyId (per-property PCS)        [T4-F]
  → GET /api/v1/operations/:dealId/live-tracking (M09)         [T4-B]
  → GET /api/v1/capital/:dealId/capital-accounts               [T4-C]
  → GET /api/v1/capital/:dealId/waterfall?type= (dual)         [T4-D]
  → GET /api/v1/revenue/:dealId/course (synthesizer)           [T4-A]
```

**Fastest ROI (steps 1–5):** Steps 1–5 require no new service files — only data loads, one URL fix, and two handler implementations. They would promote 8 panels from stub/empty/mismatch to real data.

**Gating dependency:** Step 7 (T4-A — repricing course) is the most complex; it requires a new service, a new route file, and a new mount. All other Tier 4 items can be added to existing route files.
