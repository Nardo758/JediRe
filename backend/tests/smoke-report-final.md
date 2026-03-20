# JediRe Platform — Full Smoke Test Report
Generated: 2026-03-20

## Executive Summary

| Phase | Area | Tested | PASS | WARN | FAIL |
|-------|------|--------|------|------|------|
| 1 | Core Platform | 279 | 131 | 148 | 0 |
| 2 | Zoning & Property | 141 | 106 | 35 | 0 |
| 3 | Financial & Strategy | 124 | 74 | 50 | 0 |
| 4 | Market Intel & Analytics | 143 | 90 | 53 | 0 |
| 5 | Module Wiring & Misc | 79 | 17 | 62 | 0 |
| **TOTAL** | | **766** | **418 (55%)** | **348 (45%)** | **0 (0%)** |

**Zero server errors (500s) across all 766 endpoints tested.** All warnings are either expected auth failures (401), missing required query params (400), or unmounted routes (404).

---

## Key Findings

### ✅ Healthy (no action needed)
- All endpoints that are fully wired return 200.
- All 401s on authenticated endpoints confirm auth middleware is working correctly.
- All 400s are missing-parameter warnings from test scripts hitting endpoints without required query args — not real bugs.

### ⚠️ Unmounted / Missing Routes (Phase 5 — 62 warnings)
These routes are in the smoke test script but return 404 — they are either not registered in Express or mounted at a different path:

**Auth:**
- `POST /api/v1/auth/refresh` → 404 (path may differ)
- `POST /api/v1/auth/logout` → 404

**Deal sub-routes (wrong mount path):**
- `deal-assumptions`, `deal-context`, `deal-validation`, `deal-comp-sets`
- `proforma`, `competition`, `unit-mix`, `risk`, `scenarios`

**Standalone routes not mounted:**
- `notifications`, `preferences`
- `maps`, `layers`, `events`
- `calibration`, `credibility`
- `cmd-center`, `team`, `property`
- `jedi` (leaderboard, deal-score, methodology)
- `f40` (metrics, performance)
- `building-envelope`, `zoning-capacity`, `zoning-profile`
- `admin`, `agents`, `chat`
- `market-intel` (trends), `demand-intel`
- `gmail`, `contacts-sync`
- `billing`

### ⚠️ Notable Phase 1–4 Warnings
- **deal-timeline routes** (Phase 3) → 404 — deal timeline router likely not mounted
- **cycle-intel** (Phase 3) → 404 for phase/divergence/strategy — no data seeded
- **bench-timeline** (Phase 3) → 400 — requires county/state query params
- **tax-comp** (Phase 3) → 404 — no tax comp analysis seeded for test deal
- **billing** (Phase 5) → 404 — billing routes not mounted

---

## Recommended Follow-up Actions

1. **Audit Express router mounting** in `backend/src/index.ts` — verify all route files listed above are imported and mounted under `/api/v1/`.
2. **Fix auth refresh/logout paths** — confirm correct mount paths for these critical auth flows.
3. **Seed test data** for cycle-intel, tax-comp, and deal-timeline tables so those 404s become 200s.
4. **Phase 5 script refresh** — many Phase 5 test paths appear outdated relative to current route mounts; update script paths to match actual Express mounts.
