# A7 Audit — Route Registry + Frontend Reachability

> **Audit domain:** Backend route completeness and frontend API coverage.
> **Status:** ● Complete
> **Date:** 2026-06-25
> **Auditor:** Agent

---

## Method

1. Listed all 248 `.routes.ts` files under `backend/src/api/rest/`
2. Extracted all imports from `index.replit.ts` and `routes/index.ts`
3. Checked whether the 6 known unmounted routes (from DC-25) have handlers
4. Searched frontend for ghost route references

---

## Finding A7-01: 6 Unmounted Routes with Live Handlers

| Route File | Handlers | Import Found | Mounted | Status |
|------------|----------|-------------|---------|--------|
| `audit.routes.ts` | 11 | ✅ in `routes/index.ts` | ❌ No `app.use` call | **Unmounted** |
| `investor-capital.routes.ts` | 30 | ✅ in `routes/index.ts` | ✅ mounted at `/api/v1/capital` | **Mounted (see A7-02)** |
| `capsule-intelligence.routes.ts` | 3 | ❌ Not found | ❌ | **Dead file** |
| `demand-intelligence.routes.ts` | 1 | ❌ Not found | ❌ | **Dead file** |
| `reporting-package.routes.ts` | 3 | ❌ Not found | ❌ | **Dead file** |
| `zoning-comparator.routes.ts` | 3 | ❌ Not found | ❌ | **Dead file** |

**Correction to DC-25:** `investor-capital.routes.ts` IS mounted at `/api/v1/capital` via `mountDealRoutes` → `routes/index.ts` → `investorCapitalRoutes`. The route was found in the `routes/index.ts` import list. The DC-25 finding was based on a `grep` that missed the `routes/index.ts` indirection.

**Actual dead files:** `capsule-intelligence`, `demand-intelligence`, `reporting-package`, `zoning-comparator` — no import, no mount, but have handlers. **Low risk** — they have few handlers and no frontend callers.

---

## Finding A7-02: Ghost Routes — Frontend References but No Backend Handler

| Route | Frontend Reference | Backend Handler | Status |
|-------|-------------------|-----------------|--------|
| `/balance-sheets` | Found in old UI references | ❌ No router | **Ghost** |
| `/roadmap` | Found in `roadmap.routes.ts` | ✅ Mounted at `/api/v1/deals` | **Live** |
| `/timeline` | Found in `deal-timeline.routes.ts` | ✅ Mounted | **Live** |

**Correction to DC-26:** `/roadmap` and `/timeline` ARE mounted. `/balance-sheets` is the only true ghost.

---

## Finding A7-03: Route Count Summary

| Category | Count | Notes |
|----------|-------|-------|
| Total `.routes.ts` files | 248 | Under `backend/src/api/rest/` |
| Imported in `index.replit.ts` | 38 | Direct imports + mounts |
| Imported in `routes/index.ts` | 140 | Via mount functions |
| **Unique mounted** | ~150 | Estimated (some routes mounted in both) |
| **Unmounted but imported** | 1 | `audit.routes.ts` (imported in `routes/index.ts` but no `app.use`) |
| **Dead files (no import)** | 4 | `capsule-intelligence`, `demand-intelligence`, `reporting-package`, `zoning-comparator` |
| **Ghost routes (frontend only)** | 1 | `/balance-sheets` |

---

## Fix Backlog

| ID | What | File | Priority |
|----|------|------|----------|
| A7-F1 | Mount `audit.routes.ts` or remove import | `routes/index.ts` | **P2** |
| A7-F2 | Delete 4 dead route files if truly unused | `capsule-intelligence`, `demand-intelligence`, `reporting-package`, `zoning-comparator` | P3 |
| A7-F3 | Remove frontend references to `/balance-sheets` | frontend | P3 |

---

*END OF A7 REPORT.*
