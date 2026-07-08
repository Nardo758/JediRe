# DEAL-CREATION PIPELINE AUDIT

**Date:** 2026-07-08  
**Type:** Read-only audit — no fixes applied  
**Standing rules:** S1-01 file:line evidence throughout; per-hop verdict is WORKS / STUB / MOCK-INTERCEPTED / BROKEN

---

## P1 — Create-Flow Entry Points

### Surface 1 — Chat / Telegram (revenue launch path)

| Item | Finding | File:Line |
|---|---|---|
| Webhook entry | `handleTelegram()` receives Telegram webhook | `backend/src/services/chat/messageRouter.ts:53` |
| Intent routing | `UnifiedOrchestrator` classifies intent via LLM-based `IntentClassifier` | `backend/src/services/orchestrator/unified-orchestrator.ts` |
| Deal-creation action | `dispatchAction()` handles `ocl:<actionId>:<resourceId>` structured callbacks | `backend/src/services/notifications/openclaw-actions.ts:60` |
| Draft tool | `create_deal_draft.ts:48` — agent tool that creates a deal draft; assigns origin `email_intake` | `backend/src/agents/tools/create_deal_draft.ts:48` |
| Min input | Free-text address (regex/LLM extracted), OR `ocl:<actionId>:<resourceId>` structured command | — |
| Origin assigned | `email_intake` / `prospect` — **NOT `platform_underwritten`** | `backend/src/agents/tools/create_deal_draft.ts:48` |

**Verdict:** WORKS for address-in / notification-action path. The "chat creates a `platform_underwritten` deal" claim is **not substantiated** — chat creates `email_intake` / `prospect` origin drafts, which then undergo triage. `platform_underwritten` is a fixture-only concept (see P4).

---

### Surface 2 — Bloomberg Web App

| Item | Finding | File:Line |
|---|---|---|
| REST endpoint | `POST /api/v1/deals` | — |
| Controller | `DealsController.create` | `backend/src/deals/deals.controller.ts:27` |
| Service | `DealsService.create` | `backend/src/deals/deals.service.ts:21` |
| Min inputs | `name` (required), `boundary` (GeoJSON polygon, required), `projectType` (required); `address`, `deal_category`, `description` optional | `backend/src/deals/deals.service.ts:54-81` |
| Tier gate | `can_create_deal($userId)` DB function checked before INSERT | `backend/src/deals/deals.service.ts:23-43` |
| INSERT columns | `user_id, name, boundary, project_type, project_intent, target_units, budget, timeline_start, timeline_end, tier, deal_category, development_type, address, description` | `backend/src/deals/deals.service.ts:59-82` |

**Origin class finding:** `origin_class` is **NOT a column** in the `deals` INSERT. The field exists only in deterministic fixture golden types (`backend/src/services/deterministic/__fixtures__/golden.types.ts:67`, `highlands.golden.ts:166`). There is no live path that stamps `platform_underwritten` into the database on web-create. **This is a gap.** The `deal_archetype` field (`owned_import` vs others) is what the live code branches on (`backend/src/api/rest/proforma.routes.ts:209`).

---

## P2 — Assembly Chain (hop-by-hop verdicts)

### Hop 1: Property Resolution

After the deal INSERT, `autoTriageDeal` is fired async (`deals.service.ts:104`):

```
deals.service.ts:104  →  DealTriageService.triageDeal(dealId)
                               ↓
DealTriageService.ts:76   geocodeAndLookup() → GeocodingService (Census Geocoder)
DealTriageService.ts:79   assignTradeArea()
DealTriageService.ts:84   calculateMetrics() → location/market/property signals (0-50 score)
DealTriageService.ts:91   assignStrategies()
DealTriageService.ts:94   flagRisks()
```

`DealPropertyLinkerService.autoLinkDeal` (`deal-property-linker.service.ts:52`) is the canonical property-linker:
- Exact match on normalized address in `properties`
- Fuzzy match (street number + street name)
- If no match: `createPropertyFromDeal` → `INSERT INTO properties` + `INSERT INTO deal_properties (relationship='subject')`

**Verdict: STUB** — `autoLinkDeal` is NOT called from `deals.service.ts` or `DealTriageService.ts`. The property linker is a standalone service with no clear hook into the web-create path at `POST /api/v1/deals`. The triage path geocodes the address and assigns a trade area, but does not create or link a `properties` row. A fresh web-created deal may have no `deal_properties` linkage until an explicit enrichment run.

**Live-source firing on create:** Only Census Geocoder fires on create (via `GeocodingService` in `DealTriageService`). RentCast, ATTOM, Google Places — **None fire on create.** `PropertyEnrichmentOrchestrator` is called from enrichment scripts and manual triggers only.

### Hop 2: Research Agent / DealContext Assembly

**Verdict: STUB.** The full Research Agent / DealContext assembly does NOT run on `POST /api/v1/deals`. `autoTriageDeal` calls `DealTriageService` (geocode + score + trade area + strategies + risks — a lightweight 0-50 scoring pass). DealContext (`frontend/src/stores/dealContext.types.ts:72-112`) is a frontend type; the canonical "Research Agent connects to ALL platform APIs" claim is not implemented in the create path.

APIs that DO fire on create: Census Geocoder only.  
APIs that do NOT fire on create: RentCast, ATTOM, Google Places, ArcGIS county GIS, FRED, any submarket/MSA feed.

### Hop 3: `deal_assumptions` Seeding / Year1 Blob

**Verdict: DEFERRED.** `deal_assumptions` is NOT seeded at `POST /api/v1/deals`. Seeding via `ProformaAdjustmentService.initializeProForma` is triggered on the first `GET /api/v1/proforma/:dealId` request (`backend/src/api/rest/proforma.routes.ts:170-223`). The year1 blob is built by Engine C (financial model engine) on the first explicit build — not on create.

Fields that populate on first proforma GET: `rent_growth`, `vacancy`, `opex_growth`, `exit_cap`, `absorption` from `getMarketBaseline()` (submarket/MSA data); `strategy` defaults to `rental`.

Fields that stay null until first build: all computed underwriting outputs.

### Hop 4: Capsule / Deal Details Render

**Verdict: MOCK-SHADOWED (partial).** See P3 below.

A fresh deal renders Deal Details from the seeded `deal_assumptions` fields (available after first GET to proforma route). The year1 blob is only built after the first model build. Pre-build, the proforma returns `modelNotBuilt: true` for `owned_import` deals (`proforma.routes.ts:209-210`). For other archetypes, `initializeProForma` runs with market baseline defaults — these are real API-sourced values, not fabricated underwriting.

---

## P3 — Mock-Data Interception Sweep

**`frontend/src/data/` directory** — 20+ mock files:

```
capitalStructureMockData.ts   enhancedOverviewMockData.ts   marketMockData.ts
financialMockData.ts          enhancedStrategyMockData.ts   supplyMockData.ts
overviewMockData.ts           debtMockData.ts               timelineMockData.ts
documentsMockData.ts          strategyMockData.ts           teamMockData.ts
competitionMockData.ts        notesMockData.ts              filesMockData.ts
dueDiligenceMockData.ts       projectManagementMockData.ts  investmentStrategyMockData.ts
```

**Active imports in render-path components:**

| Component | Import | Shadow status |
|---|---|---|
| `OverviewSection.tsx:19` | `enhancedOverviewMockData` | Imports; tries live API first; `dataSource` state set to `'live'` on success. Mock shapes used for type structure. **PARTIAL SHADOW** — live wins if API succeeds, mock shows if API fails/slow. |
| `BloombergOverviewSection.tsx:8` | `enhancedOverviewMockData` | Same pattern as OverviewSection. **PARTIAL SHADOW** |
| `DebtTab.tsx:21` | `capitalStructureMockData` | `defaultCapitalStack.layers` is the initial `useState` value (`DebtTab.tsx:72`). Live API overlays if fetch succeeds. If fetch fails silently, mock data is rendered permanently. **MOCK-INTERCEPTED** on fetch failure. |
| `CapitalStructureSection.tsx:36` | `capitalStructureMockData` | Same `defaultCapitalStack` initial-state pattern. **MOCK-INTERCEPTED** on fetch failure. |
| `DebtSection.legacy.tsx:25` | `debtMockData` | Legacy file — not in main render path. **INERT** |
| `TIMELINE_INTEGRATION_TEST.tsx:20` | `timelineMockData` | Test/development file — not in production path. **INERT** |

**Money finding:** `DebtTab` and `CapitalStructureSection` use mock data as `useState` initial values, not as explicit fallbacks. If the live API call fails silently (no error thrown), the component renders mock capital structure data permanently. A new deal's Debt/Capital tabs can show mock data to the operator with no visible indication.

---

## P4 — Origin-Class + Lane Integrity

### `origin_class` as a live field

**Finding: GAP.** `origin_class` / `platform_underwritten` is not a real DB column in the `deals` INSERT path. The concept exists only in:
- `backend/src/services/deterministic/__fixtures__/golden.types.ts:67` — fixture type declaration
- `backend/src/services/deterministic/__fixtures__/highlands.golden.ts:166` — `originClass: 'owned_import'` in golden test fixture

The live code branches on `deal_archetype` (`owned_import` detected at `proforma.routes.ts:209`), not `origin_class`. Architectural descriptions of `platform_underwritten` as a lane designator have no live DB backing.

### Actuals contamination

**No fabricated actuals on web-create.** The INSERT does not touch `deal_monthly_actuals`. AutoTriage does not write actuals. `deal_assumptions` seeding (on first proforma GET) uses market baselines only — no fabricated underwriting outputs. **WORKS** (honest absence respected).

### Lane B (uploads) boundary

Upload data is deal-scoped via `dealId` parameter in the upload handler (`inline-deals.routes.ts:1854`). Platform/market data (submarket, MSA) is global. **WORKS** — no cross-contamination on create.

### `modelNotBuilt` honest-absence

`owned_import` deals: explicit `modelNotBuilt: true` at `proforma.routes.ts:209-210`.  
Other archetypes: `initializeProForma` runs to provide market-baseline defaults, but `computed` results are null until first build. **WORKS** — no auto-fabricated model.

---

## P5 — D3 Readiness Flag (agent_confirmed write-path)

D3's agent will write `agent_confirmed` values into the overlay seam. Three readiness issues for fresh web-created deals:

### Issue 1 — No `deal_assumptions` row pre-first-proforma-GET

The overlay read path (`resolveLayeredValue`) reads from `deal_assumptions.year1`. For a fresh deal that has never had a proforma GET, no `deal_assumptions` row exists. Agent writes to `deal_underwriting_overlays` will land successfully, but the read path resolves from a null year1 blob — agent_confirmed values are **staged but invisible to the model** until the first build seeds year1.

**D3 blocker (severity: medium):** D3 must either (a) guarantee a proforma GET has occurred before writing agent values, or (b) the write path must create a minimal deal_assumptions row if none exists.

### Issue 2 — No `deal_underwriting_scenarios` row pre-first-build

`writeAgentFieldToActiveScenario()` (`underwriting-scenarios.service.ts:431`) requires an active scenario. Fresh web-created deals have no `deal_underwriting_scenarios` rows until the first build fires. The service returns `false` and falls through to the `deal_assumptions.year1` direct-write fallback — but that row also doesn't exist pre-build (see Issue 1).

**D3 blocker (severity: medium):** For any fresh platform-created deal, `writeAgentFieldToActiveScenario` will silently return false and the direct-write fallback will also fail (no row). Agent writes are fully lost pre-build on fresh deals.

### Issue 3 — `origin_class` absent from DB

D3 logic that branches on `origin_class: 'platform_underwritten'` will find no such column. Branch must use `deal_archetype` or `deal_category` instead.

---

## FINDINGS LIST

| # | Surface | Finding | Verdict |
|---|---|---|---|
| F-1 | Surface 1 | Chat/Telegram creates `email_intake` / `prospect` origin, not `platform_underwritten` | STUB |
| F-2 | Surface 2 | `origin_class` is not a DB column — fixture concept only | BROKEN (concept) |
| F-3 | Both | Property linker (`autoLinkDeal`) not called from web-create path | STUB |
| F-4 | Both | Research Agent / DealContext assembly does not run on create; only Census geocode fires | STUB |
| F-5 | Both | `deal_assumptions` not seeded on create — deferred to first proforma GET | DEFERRED |
| F-6 | Both | Year1 blob not built until first explicit model build | WORKS (honest absence) |
| F-7 | Surface 2 | `DebtTab` and `CapitalStructureSection` mock data as initial useState — silent shadow on fetch failure | MOCK-INTERCEPTED |
| F-8 | Surface 2 | `OverviewSection`, `BloombergOverviewSection` import mock shapes; live overlays on success | PARTIAL SHADOW |
| F-9 | Both | No fabricated actuals on create; `modelNotBuilt` honored | WORKS |
| F-10 | D3 | Agent writes are staged-but-invisible pre-first-build (no deal_assumptions/scenarios rows) | D3 BLOCKER |

---

## RULINGS / BUILD-NEEDED LIST

| Item | Cost |
|---|---|
| **Five-minute confirm:** Verify `deal_archetype` column is the live branch point in proforma route (confirmed: `proforma.routes.ts:209`) | Done |
| **Five-minute confirm:** Verify no actuals written on create (confirmed: no `deal_monthly_actuals` INSERT in create path) | Done |
| **Build arc:** Wire `DealPropertyLinkerService.autoLinkDeal` into the `autoTriageDeal` chain so fresh web-created deals get a `properties` row | Medium |
| **Build arc:** Stamp `deal_category` / archetype as the live lane designator; retire `origin_class` from architecture descriptions or add the column | Small |
| **Build arc (D3):** Ensure `deal_assumptions` row + active scenario exist before D3 agent writes; or make `writeAgentFieldToActiveScenario` create them | Required for D3 |
| **Build arc:** `DebtTab` / `CapitalStructureSection` — replace mock initial state with `null` + loading skeleton; fail explicitly if live fetch errors | Medium |
