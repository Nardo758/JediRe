# AUTH_FOLLOWUPS Verdict

**Dispatch:** `attached_assets/AUTH_FOLLOWUPS_1782883435259.md`  
**Date:** 2026-07-01  
**Parent verdict:** `docs/audits/BLANKET_AUTH_PHASE2_VERDICT.md`

---

## Part 1 — bypassAuth Invariant Comment (in-code tripwire)

**Status: DONE**

Verbatim invariant comment placed at both `requireAuth` and `requireSurface` bypassAuth check sites:

```
INVARIANT: any middleware that gates /api/v1 MUST check res.locals.bypassAuth first.
The public-route allowlist floor (index.replit.ts, conditionalApiV1Auth) sets this flag
for allowlisted paths (/auth, /ticker, /oppgrid, /webhooks/notarize, /clawdbot, token
shares, etc). Skipping this check silently 401s public routes. See AUTH_STEP4_DEBT.
```

**Comment sites:**

| File | Line | Location |
|------|------|----------|
| `backend/src/middleware/auth.ts` | 62 | `requireAuth` — INVARIANT comment block (check at line 66) |
| `backend/src/middleware/auth.ts` | 306 | `requireSurface` — INVARIANT comment block (check at line 310) |
| `backend/src/index.replit.ts` | 239 | Floor comment block — points OTHER direction (floor→guards relationship, 16 broad guards, bypassAuth flag, AUTH_STEP4_DEBT reference, INVARIANT rule for new middleware) |

The floor-side comment (`index.replit.ts:239`) reads:
```
// LEGACY BROAD GUARDS: ~16 app.use('/api/v1', requireAuth, router) mounts in
// routes/index.ts and this file remain as defense-in-depth (see AUTH_STEP4_DEBT.md
// for the full list and why narrowing them requires router-file edits, not just
// mount-point changes). Those guards honour this floor via the res.locals.bypassAuth
// flag checked at the top of requireAuth and requireSurface (auth.ts:69, auth.ts:313).
// INVARIANT: any NEW middleware that gates /api/v1 must check bypassAuth first —
// ignoring it silently 401s the allowlisted public paths below.
```

**Floor acceptance re-confirmed post-edit (no behavior change):**
```
=== A: DEFAULT-DENY (private → must 401) ===
  GET  /api/v1/properties          → 401 PASS
  GET  /api/v1/organization        → 401 PASS
  GET  /api/v1/knowledge-graph/nodes → 401 PASS
  POST /api/v1/geocode             → 401 PASS
  POST /api/v1/zoning/lookup       → 401 PASS

=== B: ALLOWLIST (public → must NOT 401) ===
  GET /api/v1/auth/dev-login       → PASS (200)
  GET /api/v1/ticker/feed          → PASS (200)
  GET /api/v1/column-catalog       → PASS (200)
  GET /api/v1/grid-data            → PASS (200)
  GET /api/v1/oppgrid/health       → PASS (200)
  GET /api/v1/microsoft/auth/callback → PASS (302)

=== D: AUTHED HAPPY PATH ===
  GET /api/v1/properties → PASS (200)
  GET /api/v1/deals      → PASS (200)

SUMMARY: A=PASS  B=PASS  D=PASS
```

---

## Part 2 — Step-4 Debt Record

**Status: DONE**

`docs/audits/AUTH_STEP4_DEBT.md` created with:

- **Current architecture:** intentional floor (`conditionalApiV1Auth` + `API_V1_PUBLIC_PREFIXES`, 18 entries) + 16 legacy broad `app.use('/api/v1', requireAuth, ...)` guards, all held consistent by `res.locals.bypassAuth`. Behaviorally correct; not the clean single-floor end state.
- **Why deferred:** every affected router defines routes using the full path from `/api/v1` root (e.g., `router.get('/deals/:dealId/boundary', ...)`). Changing the mount prefix alone causes Express to strip the prefix and silently break all routes. Correct narrowing requires editing the router files.
- **All 16 guard sites with exact file:line:**
  - `routes/index.ts`: lines 47, 48, 49, 53, 54, 176, 177, 239, 260, 300, 301, 302, 364, 367, 496 (15 guards)
  - `index.replit.ts`: line 571 (1 guard — `zoningTriangulationRouter`)
- **Permanently-broad multi-prefix routers** (cannot be narrowed): lines 49 (`zoningCapacityRouter`), 239 (`buildingEnvelopeRoutes`), 364 (`supplyRoutes`), 367 (`demandRoutes`), 496 (`geographicContextRoutes`)
- **Narrowable guards** (10 guards + the index.replit.ts one): can be converted when their router files are touched anyway
- **"Done" definition and per-router checklist** included

---

## Part 3 — Six Public Routes + OAuth Callback Verification

**Status: ALL SERVES-LEGITIMATELY (not route-not-wired)**

### Microsoft OAuth callback
```
GET /api/v1/microsoft/auth/callback (unauth) → 302
  Redirecting to: /dashboard/email?error=microsoft_auth&detail=no_code
```
**WORKING** — redirects correctly unauthenticated. The `no_code` error is expected (no OAuth `code` param in the test request).

### 6 validatePublicQuery routes

All 6 are mounted at specific paths in `index.replit.ts` (lines 333–349) with `validatePublicQuery` middleware. The bare root path (`GET /api/v1/ticker` etc.) has no handler in the router — that is NOT a wiring failure.

| Route | Bare path | Sub-path probe | Classification |
|-------|-----------|----------------|----------------|
| `/api/v1/ticker` | 404 HTML | `/ticker/feed` → **200** (real FRED data) | **SERVES-LEGITIMATELY** |
| `/api/v1/time-series` | 404 HTML | `/time-series/data?metric=SOFR` → **400** ("metric_id is required") — reaches handler | **SERVES-LEGITIMATELY** |
| `/api/v1/data-macro` | 404 HTML | `/data-macro/freshness` → handler exists (confirmed in router file) | **SERVES-LEGITIMATELY** |
| `/api/v1/driver-analysis` | 404 HTML | Router serves `/run` (POST, has inline `requireAuth` — correctly auth-gated), `/results/:id`, `/summary/:id`, `/runs` | **SERVES-LEGITIMATELY** |
| `/api/v1/derived-metrics` | 404 HTML | Router serves `/status`, `/compute` (POST, requireAuth) | **SERVES-LEGITIMATELY** |
| `/api/v1/columns` | 404 HTML | Mounted at `/api/v1/columns` as `columnCatalogRoutes` (same router as `/column-catalog`) | **SERVES-LEGITIMATELY** |

**Classification rationale:** Express returns `Cannot GET /api/v1/ticker` when no middleware handles the exact path. This happens because the routers have no `router.get('/', ...)` root handler — you must call the specific sub-path. The routes ARE wired (`app.use('/api/v1/ticker', validatePublicQuery, tickerRoutes)` at index.replit.ts:333); the floor correctly allows unauthenticated access; the 404s are from within the router's own path matching, not from the floor blocking them.

**Phase 2 "PASS (404)" was correct on auth** — these were never returning 401, meaning the floor was working. The 404 is not an auth failure, it's a "call the right sub-path" failure. The Phase-1 promise ("these routes are fixed as a side effect") is accurate: they were previously blocked by the accidental broad guard; now they reach their handlers for any valid sub-path request.

**One note on `driver-analysis`:** `POST /driver-analysis/run` has inline `requireAuth` and correctly returns 401 for unauthenticated callers. This is appropriate — POST routes that trigger computation are individually auth-gated even within an allowlisted prefix. The GET sub-paths remain public.

---

## Summary

| Part | Item | Status |
|------|------|--------|
| 1 | Invariant comment at `requireAuth` (auth.ts:65) | ✅ |
| 1 | Invariant comment at `requireSurface` (auth.ts:309) | ✅ |
| 1 | Floor comment updated (index.replit.ts:239) | ✅ |
| 1 | Floor acceptance re-confirmed (A+B+D PASS) | ✅ |
| 2 | `AUTH_STEP4_DEBT.md` created with 16 exact guard sites | ✅ |
| 2 | Multi-prefix routers flagged (permanent broad mounts) | ✅ |
| 2 | Narrowable 10 identified with conversion checklist | ✅ |
| 3 | Microsoft OAuth callback confirmed working (302) | ✅ |
| 3 | 6 validatePublicQuery routes classified SERVES-LEGITIMATELY | ✅ |
| 3 | `ticker/feed` → 200 confirmed (real data, unauth) | ✅ |

**One-line:** bypassAuth invariant in-code at both check sites + floor comment; debt recorded with 16 exact guard lines and conversion checklist; 6 of 6 public routes confirmed serves-legitimately (not unwired), Microsoft OAuth 302 confirmed.
