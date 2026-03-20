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
| 5 | smoke-test-misc.sh | Module Wiring & Misc | 324 | 106 | 218 | 0 |
| **TOTAL** | | | **1,203** | **571 (47%)** | **632 (53%)** | **0 (0%)** |

**Zero server errors (5xx) across all 1,203 endpoints tested.**

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

**324 endpoints** across dashboard, gmail, microsoft integration, contacts sync, emails (AI actions), email extractions, news, intelligence, orgs/RBAC, context tracker, **full module wiring matrix (all 55 routes)**, trade areas, isochrone, traffic AI, leasing traffic, preferences, AI preferences, property types/strategies, custom strategies, strategies, zoning intelligence/learning/verification/profile, development scenarios, team management, collaboration, notarize, data upload, entitlements, regulatory alerts, municode, scrape, design references, financial model, financial dashboard, visibility, property analytics, traffic data, traffic comps, unit mix, training/calibration/capsules, m22 archive, audit chain, kafka-events, proposals, admin, portfolio, agents, chat, correlations, opportunities, notifications, map configs, grid/rankings, **capital structure (13 endpoints)**, **financial models CRUD (7 endpoints)**, **strategy analyses CRUD (5 endpoints)**, **dd-checklists CRUD (5 endpoints)**, **modules (4 endpoints)**, **module libraries (3 endpoints)**, **strategy definitions (4 endpoints)**, **property metrics (3 endpoints)**, **property scoring (3 endpoints)**, **opus (3 endpoints)**, **data library (4 endpoints)**, **market research (4 endpoints)**, **benchmark timeline (3 endpoints)**, **extractions (6 endpoints)**, **asset news (4 endpoints)**, **asset notes (5 endpoints)**, **note categories (5 endpoints)**, **note replies (5 endpoints)**, **task completion (4 endpoints)**.

| Status | Count | Meaning |
|--------|-------|---------|
| PASS   | 106   | HTTP 200 response |
| SKIP   | 218   | 404 (no collection GET or unmounted), 400 (validation), 401 (auth) |
| FAIL   | 0     | — |

Key module-wiring coverage (all 55 route endpoints):
- Registry: `GET /modules/registry`, `/modules/registry/:id`, `/modules/priority/:priority`, `/modules/build-order`
- Formulas: `GET /formulas`, `/formulas/:id`, `/formulas/module/:moduleId`; `POST /formulas/:id/execute`
- Data Flow: `GET /data-flow/matrix`, `/incoming/:id`, `/outgoing/:id`, `/cascade/:id`, `/readiness/:id`, `/cycles`
- Strategy: `GET /strategy/weights`; `POST /strategy/analyze/:id`, `/strategy/compare`, `/strategy/analyze-with-envelope/:id`
- Orchestrator: `GET /orchestrator/status`, `/orchestrator/pipelines`, `/orchestrator/validate`, `/orchestrator/deal-readiness/:id`; `POST /orchestrator/initialize`, `/orchestrator/execute/:m/:d`, `/orchestrator/cascade/:m/:d`, `/orchestrator/pipeline/:p/:d`, `/orchestrator/p0/:d`
- Wire: `POST /wire/p0`, `/wire/jedi-score`, `/wire/news`, `/wire/risk`, `/wire/strategy`, `/wire/zoning`, `/wire/p1`, `/wire/traffic`, `/wire/traffic/forecast`, `/wire/proforma/sync`, `/wire/proforma/init`, `/wire/scenarios`, `/wire/scenarios/recalculate`, `/wire/competition`, `/wire/debt`, `/wire/exit`, `/wire/portfolio`, `/wire/subscriptions/setup`, `/wire/subscriptions/p1/setup`, `/wire/subscriptions/p2/setup`, `/wire/subscriptions/all/setup`, `/wire/p2`
- Wiring Cap-Structure: `POST /wiring/capital-structure/stack`, `/waterfall`, `/scenarios`, `/rate-analysis`, `/pipeline`, `/subscriptions`

Bug fix: Endpoint `POST /module-wiring/wiring/capital-structure/pipeline` had a JS error when `uses` field was omitted (`Cannot read .total of undefined`). Added null-guard to provide default `uses` object when not supplied.

Known SKIP patterns (expected 404):
- Unmounted route files: extractions, assetNews, assetNotes, noteCategories, noteReplies, task-completion, maps, kafka-events, proposals, map-annotations
- Routes with sub-paths but no collection GET `/` (leasing-traffic, uploads, design-references, traffic-data, traffic-comps, portfolio, agents, correlations, opportunities, orgs)

---

## Bug Fixed During Testing

### DB Trigger Bug — `log_team_member_activity()` (Fixed)

**Symptom:** `POST /api/v1/deals/:id/team/members` returned 500.

**Root Cause:** PostgreSQL trigger `log_team_member_activity()` on `deal_team_members` table referenced `deal_team_activity` columns that don't exist (`user_id`, `user_name`, `title`). Actual schema uses `actor_name`, `details`.

**Fix:** Rewrote trigger function to use correct column names and JSONB `details` field:
```sql
CREATE OR REPLACE FUNCTION log_team_member_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO deal_team_activity (deal_id, actor_name, action, target_type, target_id, details)
    VALUES (NEW.deal_id, NEW.name, 'member_joined', 'member', NEW.id,
            jsonb_build_object('name', NEW.name, 'role', NEW.role, 'action', 'joined'));
  ...
END;
$$ LANGUAGE plpgsql;
```

**Result:** Team member creation now returns 200 with the created member record.

---

## Mount Coverage Summary

Routes mounted in `index.replit.ts` and confirmed responding:

| Prefix | Router | Phase 5 Status |
|--------|--------|----------------|
| `/api/v1/module-wiring` | moduleWiringRouter | ✅ 22 endpoints tested |
| `/api/v1/capital-structure` | capitalStructureRouter | ✅ 13 endpoints tested |
| `/api/v1/financial-models` | financialModelsRouter | ✅ 7 endpoints tested |
| `/api/v1/strategy-analyses` | strategyAnalysesRouter | ✅ 5 endpoints tested |
| `/api/v1/dd-checklists` | ddChecklistsRouter | ✅ 5 endpoints tested |
| `/api/v1/modules` | modulesRouter | ✅ 4 endpoints tested |
| `/api/v1/property-metrics` | createPropertyMetricsRouter | ✅ 3 endpoints tested |
| `/api/v1/property-scoring` | createPropertyScoringRouter | ✅ 3 endpoints tested |
| `/api/v1/opus` | createOpusRoutes | ✅ 3 endpoints tested |
| `/api/v1/data-library` | createDataLibraryRoutes | ✅ 4 endpoints tested |
| `/api/v1/benchmark-timeline` | benchmarkTimelineRouter | ✅ 3 endpoints tested |

### Unmounted Route Files (Identified)

These route files exist in `backend/src/api/rest/` but are **not mounted** in `index.replit.ts`:

| File | Reason |
|------|--------|
| `maps.routes.ts` | Not imported in index |
| `mapAnnotations.routes.ts` | Not imported in index |
| `kafka-events.routes.ts` | Not imported in index |
| `proposals.routes.ts` | Not imported in index |
| `geography.routes.ts` | Not imported in index |
| `credibility.routes.ts` | Not imported in index |
| `demand-intelligence.routes.ts` | Not imported in index |
| `apartment-locator.routes.ts` | Not imported in index |
| `leasingTraffic.routes.ts` (camelCase) | Superseded by kebab-case version |
| `traffic-intelligence.routes.ts` | Not imported in index |

---

## Recommended Follow-up

1. **Mount missing routes** — Wire `maps`, `kafka-events`, `proposals`, and `map-annotations` into `index.replit.ts` to expose these endpoints.
2. **Add collection GET handlers** — Routes that return 404 on `GET /` could be given list endpoints if needed for frontend use.
3. **Seed test data** — Some endpoints skip due to no seeded data (tax-comp analysis, benchmark timeline without county/state). Adding fixtures would convert SKIPs to PASSes.
4. **Strategy definitions** — `GET /strategy-definitions` returns 404; verify router mount is correct.
