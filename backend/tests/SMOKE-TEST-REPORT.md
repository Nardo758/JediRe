# JediRe Platform — Full Smoke Test Report

Generated: 2026-03-20  
Backend: http://localhost:4000  
Test IDs: deal=`12eb9e11-3b2d-44d5-9f59-877a76344c18`, user=`6253ba3f-d40d-4597-86ab-270c8397a857`, property=`00175617-4d11-447e-a274-9c3fb828a69d`

---

## Executive Summary

| Phase | Script | Area | Tested | PASS | WARN/SKIP | FAIL |
|-------|--------|------|--------|------|-----------|------|
| 1 | smoke-test-core.sh | Core Platform | 278 | 130 | 148 | 0 |
| 2 | smoke-test-zoning.sh | Zoning, Supply & Property | 196 | 110 | 86 | 0 |
| 3 | smoke-test-financial.sh | Financial & Strategy | 186 | 64 | 122 | 0 |
| 4 | smoke-test-market.sh | Market Intel & Analytics | 219 | 155 | 64 | 0 |
| 5 | smoke-test-misc.sh | Module Wiring & Misc | 385 | 122 | 263 | 0 |
| **TOTAL** | | | **1,264** | **581 (46%)** | **683 (54%)** | **0 (0%)** |

**Zero server errors (5xx) across all 1,264 endpoints tested.**

---

## Phase 1 — Core Platform (`smoke-test-core.sh`)

**278 endpoints** across auth, admin, dashboard, deals, tasks, inbox, news, emails, contacts, billing, JEDI, corporate health, market intelligence, properties, data/supply/demand routes.

| Status | Count | Meaning |
|--------|-------|---------|
| PASS   | 130   | HTTP 200 response |
| WARN   | 148   | 404 (unmounted), 400 (validation), 401 (auth expected) |
| FAIL   | 0     | — |

Key coverage: health checks, auth flows, deal CRUD, task management, dashboard stats, news events, JEDI score/alerts, corporate health, F40 performance metrics.

Known 404 warnings (not mounted in this phase): inbox routes, settings/preferences, LLM routes, AI render, analysis signal routes, building design 3D.

---

## Phase 2 — Zoning, Supply & Property (`smoke-test-zoning.sh`)

**196 endpoints** across zoning intelligence, zoning learning, zoning verification, zoning profile, development scenarios, supply events, demand routes, property analytics, property proxy, building envelope, site intelligence, zoning capacity, zoning triangulation.

| Status | Count | Meaning |
|--------|-------|---------|
| PASS   | 110   | HTTP 200 response |
| WARN   | 86    | 404 (unmounted legacy routes), 400 (validation), 401 (auth) |
| FAIL   | 0     | — |

Key coverage: zoning analyze, development scenarios, supply events, property boundaries, isochrone generation, trade areas, building envelope calculations.

Known 404 warnings: zoning-legacy routes, zoning-comparator, demand-intelligence, apartment-locator (unmounted route files).

---

## Phase 3 — Financial & Strategy (`smoke-test-financial.sh`)

**186 endpoints** across financial modeling, proforma, deal assumptions, capital structure (initial), strategy definitions, deal strategy, metrics catalog, deal comp sets, deal validation, unit mix, competition analysis, m22 archive, audit chain, benchmark timeline.

| Status | Count | Meaning |
|--------|-------|---------|
| PASS   | 64    | HTTP 200 response |
| WARN   | 122   | 400 (missing params/data), 404 (no seeded data), 401 (auth) |
| FAIL   | 0     | — |

Key coverage: financial model compute, deal proforma, scenarios, comp queries, m22-archive snapshots, audit confidence scoring, cycle intelligence.

Known 400 warnings: benchmark-timeline (requires county/state), tax-comp analysis (no data seeded for deal), qwen routes (not mounted).

---

## Phase 4 — Market Intel & Analytics (`smoke-test-market.sh`)

**219 endpoints** across market intelligence (standard + enhanced), supply events, demand, traffic prediction, property scoring, comps (M26/M27), cycle intelligence (M28), corporate health, property analytics, traffic data/comps, visibility, unit mix, training/calibration, capsules, maps, layers, m22 archive, audit, map-configs, portfolio, agents, chat, correlations, opportunities, notifications.

| Status | Count | Meaning |
|--------|-------|---------|
| PASS   | 155   | HTTP 200 response |
| SKIP   | 64    | 404 (no data), 400 (validation), 403 (access restriction) |
| FAIL   | 0     | — |

Key coverage: market intelligence enhanced, supply/demand analytics, cycle phase detection, comp analysis (M26/M27), cycle intelligence schedules (M28), corporate health scoring, visibility analysis.

---

## Phase 5 — Module Wiring & Misc (`smoke-test-misc.sh`)

**385 endpoints** covering all remaining mounted route groups (including 1 security negative-test for forged OAuth state):

- Dashboard, Gmail, Microsoft (inline + full oauth router — 18 endpoints, all 15 from `microsoft.routes.ts` + 3 from `inline-microsoft.routes.ts`), contacts sync, emails (AI actions), email extractions, news, intelligence
- Orgs/RBAC, context tracker, trade areas, isochrone, traffic AI, leasing traffic, preferences, AI preferences
- Property types/strategies, custom strategies, strategies, zoning intelligence/learning/verification/profile
- Development scenarios, team management (**all 12 routes**), collaboration, notarize, data upload, entitlements, regulatory alerts, municode, scrape
- Design references, financial model, financial dashboard, visibility (**all 5 correct routes**)
- Property analytics, traffic data, traffic comps, unit mix, training/calibration/capsules
- M22 archive, audit chain, kafka-events, proposals, admin, portfolio, agents, chat, correlations, opportunities, notifications, map configs, grid/rankings
- **Full module wiring matrix** (all 55 routes: registry, priority, formulas, data-flow, strategy, orchestrator, wire/*, wiring/capital-structure)
- **Capital structure** (13 endpoints), **financial models CRUD** (7 endpoints), **strategy analyses** (5 endpoints), **dd-checklists** (5 endpoints)
- **Modules** (4 endpoints), **module libraries** (**all 7 routes**), **strategy definitions** (4 endpoints)
- **Property metrics** (3 endpoints), **property scoring** (3 endpoints), **opus** (3 endpoints), **data library** (4 endpoints), **market research** (4 endpoints), **benchmark timeline** (3 endpoints)
- **Extractions** (6 endpoints), **asset news** (4 endpoints), **asset notes** (5 endpoints), **note categories** (5 endpoints), **note replies** (5 endpoints), **task completion** (4 endpoints)

| Status | Count | Meaning |
|--------|-------|---------|
| PASS   | 122   | HTTP 200 response |
| SKIP   | 263   | 404 (unmounted/no-collection-GET), 400 (validation), external-creds, 302 (OAuth redirect on forged state) |
| FAIL   | 0     | — |

### Route File Coverage (Phase 5 Additions)

| Route File | Routes | Tested | Method |
|------------|--------|--------|--------|
| `team-management.routes.ts` | 12 | 12 | check_strict/lenient |
| `module-libraries.routes.ts` | 7 | 7 | check_lenient |
| `microsoft.routes.ts` | 15 | 15 | check_optional (5xx=FAIL, 4xx=SKIP) |
| `inline-microsoft.routes.ts` | 3 | 3 | check_strict/lenient |
| `visibility.routes.ts` | 5 | 5 (correct paths) | check_lenient |
| `maps.routes.ts` | 9 | 9 | check_lenient |
| `layers.routes.ts` | 7 | 7 | check_lenient |
| `mapAnnotations.routes.ts` | 6 | 6 | check_lenient |
| `m22-archive.routes.ts` | 11 | 11 | check_lenient |
| `audit.routes.ts` | 11 | 11 | check_lenient |
| `extractions.routes.ts` | 6 | 6 | check_lenient |
| `assetNews.routes.ts` | 5 | 5 | check_lenient |
| `assetNotes.routes.ts` | 7 | 7 | check_lenient |
| `noteCategories.routes.ts` | 6 | 6 (incl. /stats/usage) | check_lenient |
| `noteReplies.routes.ts` | 5 | 5 | check_lenient |
| `task-completion.routes.ts` | 4 | 4 | check_optional (mounted at /api/v1/task-completion) |

### Check Semantics

| Check Type | PASS | SKIP | FAIL |
|------------|------|------|------|
| `check_strict` | 2xx | — | any non-2xx |
| `check_lenient` | 2xx | 400/403/404 | 5xx |
| `check_optional` | 2xx | 4xx / 302 | 5xx (never masked — used for OAuth/external-creds routes where 4xx is expected) |

Key module-wiring coverage (all 55 route endpoints):
- Registry: `GET /modules/registry`, `/modules/registry/:id`, `/modules/priority/:priority`, `/modules/build-order`
- Formulas: `GET /formulas`, `/formulas/:id`, `/formulas/module/:moduleId`; `POST /formulas/:id/execute`
- Data Flow: `GET /data-flow/matrix`, `/incoming/:id`, `/outgoing/:id`, `/cascade/:id`, `/readiness/:id`, `/cycles`
- Strategy: `GET /strategy/weights`; `POST /strategy/analyze/:id`, `/strategy/compare`, `/strategy/analyze-with-envelope/:id`
- Orchestrator: `GET /orchestrator/status`, `/orchestrator/pipelines`, `/orchestrator/validate`, `/orchestrator/deal-readiness/:id`; `POST /orchestrator/initialize`, `/orchestrator/execute/:m/:d`, `/orchestrator/cascade/:m/:d`, `/orchestrator/pipeline/:p/:d`, `/orchestrator/p0/:d`
- Wire: `POST /wire/p0`, `/wire/jedi-score`, `/wire/news`, `/wire/risk`, `/wire/strategy`, `/wire/zoning`, `/wire/p1`, `/wire/traffic`, `/wire/traffic/forecast`, `/wire/proforma/sync`, `/wire/proforma/init`, `/wire/scenarios`, `/wire/scenarios/recalculate`, `/wire/competition`, `/wire/debt`, `/wire/exit`, `/wire/portfolio`, `/wire/subscriptions/setup`, `/wire/subscriptions/p1/setup`, `/wire/subscriptions/p2/setup`, `/wire/subscriptions/all/setup`, `/wire/p2`
- Wiring Cap-Structure: `POST /wiring/capital-structure/stack`, `/waterfall`, `/scenarios`, `/rate-analysis`, `/pipeline`, `/subscriptions`

---

## Bugs Fixed During Testing

### 1. DB Trigger Bug — `log_team_member_activity()` (Migration 113)

**Symptom:** `POST /api/v1/deals/:id/team/members` returned 500.

**Root Cause:** PostgreSQL trigger `log_team_member_activity()` on `deal_team_members` used wrong column names: `activity_type` (should be `action`), `user_id`/`user_name`/`title` (should be `actor_name`, `action`, `target_type`, `details`).

**Fix:** Rewrote trigger to match actual `deal_team_activity` schema (`actor_name`, `action`, `target_type`, `details` as jsonb). Migration persisted in `113_fix_team_member_activity_trigger.sql`.

**Result:** Team member creation now returns 200 with the created member record.

### 2. Code Bug — `wireCapitalStructurePipeline` null-guard

**Symptom:** `POST /wire/capital-structure/pipeline` crashed with `Cannot read properties of undefined (reading 'total')` when `uses` field was omitted.

**Fix:** Added null-guard in `capital-structure-adapter.ts` to provide a default `uses` object when not supplied.

**Result:** Pipeline endpoint handles missing `uses` gracefully.

### 3. Schema Fix — `deal_tasks` INSERT in `team-management.routes.ts`

**Symptom:** `POST /api/v1/deals/:id/team/tasks` returned 500 due to INSERT referencing non-existent columns (`assigned_to_name`, `tags`, `created_by_name`).

**Fix:** Updated INSERT query to use only the columns present in `deal_tasks` table (`deal_id`, `title`, `description`, `assigned_to`, `status`, `priority`, `due_date`).

**Result:** Team task creation now succeeds.

### 4. New Router — `microsoft.routes.ts` Mounted

**Previously:** Only `inline-microsoft.routes.ts` (3 routes) was mounted. The full `microsoft.routes.ts` with 15 email/calendar/OAuth routes was unused.

**Fix:** Added `import microsoftRouter from './api/rest/microsoft.routes'` and `app.use('/api/v1/microsoft', microsoftRouter)` in `index.replit.ts`.

**Result:** All 15 Microsoft Integration routes now routed (tested as `check_optional` since they require real Microsoft OAuth credentials).

---

## Mount Coverage Summary

Routes mounted in `index.replit.ts` and confirmed responding:

| Prefix | Router | Phase 5 Status |
|--------|--------|----------------|
| `/api/v1/microsoft` | inline + full microsoft router | ✅ 19 endpoints tested (incl. 1 forged-state negative test) |
| `/api/v1/module-wiring` | moduleWiringRouter | ✅ 55 endpoints tested (full registry, priority, formulas, data-flow, strategy, orchestrator, wire/*, wiring/capital-structure) |
| `/api/v1/task-completion` | taskCompletionRouter | ✅ 4 endpoints tested (mounted in Phase 5) |
| `/api/v1/capital-structure` | capitalStructureRouter | ✅ 13 endpoints tested |
| `/api/v1/financial-models` | financialModelsRouter | ✅ 7 endpoints tested |
| `/api/v1/strategy-analyses` | strategyAnalysesRouter | ✅ 5 endpoints tested |
| `/api/v1/dd-checklists` | ddChecklistsRouter | ✅ 5 endpoints tested |
| `/api/v1/modules` | modulesRouter | ✅ 4 endpoints tested |
| `/api/v1/module-libraries` | moduleLibrariesRouter | ✅ 7 endpoints tested |
| `/api/v1/property-metrics` | createPropertyMetricsRouter | ✅ 3 endpoints tested |
| `/api/v1/property-scoring` | createPropertyScoringRouter | ✅ 3 endpoints tested |
| `/api/v1/opus` | createOpusRoutes | ✅ 3 endpoints tested |
| `/api/v1/data-library` | createDataLibraryRoutes | ✅ 4 endpoints tested |
| `/api/v1/benchmark-timeline` | benchmarkTimelineRouter | ✅ 3 endpoints tested |

### Unmounted Route Files (Tested as 404 SKIP — not wired in index)

| File | Routes | Smoke Status | Reason |
|------|--------|--------------|--------|
| `maps.routes.ts` | 9 | SKIP (404) | Not mounted in index — 9 routes covered |
| `mapAnnotations.routes.ts` | 6 | SKIP (404) | Not mounted in index — 6 routes covered |
| `layers.routes.ts` | 7 | SKIP (404) | Not mounted in index — 7 routes covered |
| `m22-archive.routes.ts` | 11 | SKIP (404) | Not mounted in index — 11 routes covered |
| `audit.routes.ts` | 11 | SKIP (404) | Not mounted in index — 11 routes covered |
| `extractions.routes.ts` | 6 | SKIP (404) | Not mounted in index — 6 routes covered |
| `assetNews.routes.ts` | 5 | SKIP (404) | Not mounted in index — 5 routes covered |
| `assetNotes.routes.ts` | 7 | SKIP (404) | Not mounted in index — 7 routes covered |
| `noteCategories.routes.ts` | 6 | SKIP (404) | Not mounted in index — 6 routes covered |
| `noteReplies.routes.ts` | 5 | SKIP (404) | Not mounted in index — 5 routes covered |
| `kafka-events.routes.ts` | — | Not tested | Not imported in index |
| `proposals.routes.ts` | — | Not tested | Not imported in index |
| `geography.routes.ts` | — | Not tested | Not imported in index |
| `credibility.routes.ts` | — | Not tested | Not imported in index |
| `demand-intelligence.routes.ts` | — | Not tested | Not imported in index |
| `apartment-locator.routes.ts` | — | Not tested | Not imported in index |
| `traffic-intelligence.routes.ts` | — | Not tested | Not imported in index |

### Intentionally Excluded Files (Out of Scope)

| File | Reason |
|------|--------|
| `map-annotations.example.ts` | **Blueprint/prototype only** — uses Prisma ORM (project uses direct `pg` queries), never mounted in production index, superceded by `mapAnnotations.routes.ts`. Excluded from smoke coverage by design. |

---

## Recommended Follow-up

1. **Mount missing routes** — Wire `maps`, `mapAnnotations`, `layers`, `m22-archive`, `audit`, `kafka-events`, `proposals`, and communication route files into `index.replit.ts`.
2. **Add collection GET handlers** — Routes that return 404 on `GET /` could be given list endpoints for frontend use.
3. **Seed test data** — Some endpoints skip due to no seeded data. Adding fixtures would convert SKIPs to PASSes.
4. **Microsoft OAuth flow** — Connect Microsoft credentials in staging to enable full integration testing of the 15 OAuth-dependent endpoints.
