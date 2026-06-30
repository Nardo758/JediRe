# VERDICT — Fix Unauthenticated Property Endpoint (inline-data.routes.ts)

**Date:** 2026-06-30  
**Status:** CLOSED — routes removed, confirmed 401 unauthenticated

---

## Triage Verdict: HIGH

`GET /api/v1/properties` was confirmed reachable unauthenticated (HTTP 200) and was
returning **tenant-linked property rows** — including at least one record with a live
`deal_id`, `acquisition_price`, and `created_by` (the f2a-operator user ID). Full
`properties` table columns were exposed with no authentication gate.

`GET /api/v1/markets` was also confirmed reachable unauthenticated (HTTP 200),
returning data from the `supply_metrics` table. It returned empty results in the
live environment but the query was unconstrained and ungated.

Both routes were in `backend/src/api/rest/inline-data.routes.ts` (the `dataRouter`
file), mounted without `requireAuth`.

---

## Root Cause

`dataRouter` is mounted at `app.use('/api/v1', dataRouter)` (index.replit.ts:236).
Three of its four route handlers lacked `requireAuth`:

| Route | Handler auth | Effective auth | Status |
|---|---|---|---|
| `GET /supply/:market` | None | Gated — `app.use('/api/v1/supply', requireAuth, supplyRoutes)` at line 234 intercepts all `/api/v1/supply/*` paths before dataRouter fires | Incidentally protected |
| `GET /markets` | **None** | **None** — `GET /api/v1/markets` path not covered by any upstream guard | **Open — REMOVED** |
| `GET /properties` | **None** | **None** — `GET /api/v1/properties` path not covered by any upstream guard | **Open — REMOVED** |
| `GET /alerts` | `requireAuth` ✓ | Explicitly protected | OK |

The `/properties` route had a secondary impact: it was mounted at line 236 (before
the authenticated `property.routes.ts` list handler), so it also **shadowed** the
legitimate authenticated list endpoint. Removing it restores that endpoint's auth gate.

---

## Live HTTP Evidence — Before Fix

```
GET /api/v1/properties (no token)
→ HTTP 200
→ Body: { "success": true, "count": 5, "data": [ ... ] }
  Row 1: id=5948f2f2, deal_id=c92b5746-79a4-4303-8f2a-aba8d5bd4182,
          acquisition_price="5000000.00", created_by=31720afb-fe3f-421a-...
  Rows 2–5: apartment_locator_ai enriched Nashville properties

GET /api/v1/markets (no token)
→ HTTP 200
→ Body: { "success": true, "data": [] }
```

---

## Fix Applied

**File:** `backend/src/api/rest/inline-data.routes.ts`  
**Action:** Removed `router.get('/markets', ...)` and `router.get('/properties', ...)`
(lines 35–71 in the pre-fix file). Both were confirmed DEAD — zero callers found
across `frontend/src` and `backend/src`. The only reference was a static documentation
string in `ApiDocsPage.tsx:20` (not an API call).

---

## Live HTTP Evidence — After Fix

```
GET /api/v1/properties (no token)
→ HTTP 401  {"error":"Unauthorized","message":"No authentication token provided"}

GET /api/v1/markets (no token)
→ HTTP 401  {"error":"Unauthorized","message":"No authentication token provided"}

GET /api/v1/supply/properties (no token)
→ HTTP 401  (unchanged — was already gated by upstream supplyRoutes mount)
```

---

## Sibling Routes Checked

Per dispatch instruction, all routes in the same file were inspected:

- `GET /supply/:market` — no inline `requireAuth`, but **incidentally gated** by the
  `app.use('/api/v1/supply', requireAuth, supplyRoutes)` mount at index.replit.ts:234,
  which intercepts ALL `/api/v1/supply/*` paths before dataRouter fires. This route
  effectively never receives an unauthenticated request. Recommend adding explicit
  `requireAuth` in a future cleanup pass for clarity, but it is not an open hole.
- `GET /alerts` — has explicit `requireAuth`. OK.

No other routes in inline-data.routes.ts are open unauthenticated.

---

## Out of Scope (Track-2)

- `is_market_data` column DDL + property read-scoping (separate dispatch).
- `property.routes.ts:357` dead-column verify (separate check).
- The other 5 MIXED property-read sites from the classification audit — none were
  found to lack `requireAuth`; they are scoping issues (Track-2), not open-auth holes.
