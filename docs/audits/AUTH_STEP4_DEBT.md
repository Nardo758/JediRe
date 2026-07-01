# Auth Step 4 Debt — Specific-Path Guard Conversion

**Parent audit:** `docs/audits/BLANKET_AUTH_PHASE2_VERDICT.md`  
**Created:** 2026-07-01  
**Last verified:** 2026-07-01

---

## The Invariant (DO NOT BREAK)

`/api/v1` auth is enforced by two layers working together:

1. **Floor** — `conditionalApiV1Auth` in `backend/src/index.replit.ts` (~line 252, registered before all `mountXxxRoutes` calls). Uses `API_V1_PUBLIC_PREFIXES` (18 entries). For allowlisted paths it sets `res.locals.bypassAuth = true` then calls `next()`. For all other paths it calls `requireAuth` directly.

2. **16 legacy broad guards** — `app.use('/api/v1', requireAuth, router)` mounts spread across `mountZoningRoutes`, `mountDealRoutes`, `mountFinancialRoutes`, `mountPropertyRoutes`, `mountAnalyticsRoutes` (in `backend/src/routes/index.ts`), and one directly in `backend/src/index.replit.ts`. These fire for EVERY `/api/v1/*` request that passes the floor.

**The glue:** `requireAuth` and `requireSurface` (in `backend/src/middleware/auth.ts`) each check `res.locals.bypassAuth === true` at the very top and call `next()` immediately if set. This allows the broad guards to honour the floor's allowlist decision without being converted.

```
RULE: Any middleware that gates /api/v1 MUST check res.locals.bypassAuth first.
      A gate that ignores the flag will 401 the public allowlist routes.
```

**Comment sites (verbatim INVARIANT comment lives at):**
- `backend/src/middleware/auth.ts:62` — `requireAuth` INVARIANT comment (check at line 66)
- `backend/src/middleware/auth.ts:306` — `requireSurface` INVARIANT comment (check at line 310)
- `backend/src/index.replit.ts:239` — floor definition comment block

The symptom of a violation: a market-data, OAuth callback, or share-link route mysteriously starts returning 401 even though it's on the allowlist.

---

## Why Step 4 Is Deferred

The 16 broad guards cannot be safely narrowed from `app.use('/api/v1', requireAuth, router)` to `app.use('/api/v1/deals', requireAuth, router)` without also modifying the router files.

**Root cause:** every affected router defines its routes using the full path from the `/api/v1` root. Example:

```ts
// property-boundary.routes.ts
router.get('/deals/:dealId/boundary', ...)
```

When mounted at `app.use('/api/v1', ...)`, Express preserves `req.path = '/deals/:dealId/boundary'` and the route matches.  
When mounted at `app.use('/api/v1/deals', ...)`, Express strips the `/deals` segment so `req.path = '/:dealId/boundary'` — no match, silent 404.

Correct Step 4 requires both:
1. Remove the top-level prefix from every route definition inside the router file (e.g., `'/deals/:dealId/boundary'` → `'/:dealId/boundary'`)
2. Update the mount point from `/api/v1` to `/api/v1/deals`

---

## All 16 Broad Guards — Exact Locations

### `backend/src/routes/index.ts` (15 guards)

| Line | Router | Mount function | Target prefix (after Step 4) |
|------|--------|----------------|------------------------------|
| 47 | `propertyBoundaryRouter` | `mountZoningRoutes` | `/api/v1/deals` |
| 48 | `siteIntelligenceRouter` | `mountZoningRoutes` | `/api/v1/deals` |
| 49 | `zoningCapacityRouter` | `mountZoningRoutes` | `/api/v1` (multi-prefix: `/deals/`, `/zoning-districts/`, `/municipalities/`) |
| 53 | `zoningProfileRouter` | `mountZoningRoutes` | `/api/v1/deals` |
| 54 | `developmentScenariosRouter` | `mountZoningRoutes` | `/api/v1/deals` |
| 176 | `documentsFilesRoutes` | `mountDealRoutes` | `/api/v1/deals` (also has `requireWeb`) |
| 177 | `submarketDocumentsRoutes` | `mountDealRoutes` | `/api/v1/submarkets` (also has `requireWeb`) |
| 239 | `buildingEnvelopeRoutes` | `mountPropertyRoutes` | `/api/v1` (multi-prefix: `/deals/`, `/property-type-configs`) |
| 260 | `propertyProxyRoutes` | `mountPropertyRoutes` | `/api/v1/properties` |
| 300 | `teamManagementRouter` | `mountDealRoutes` | `/api/v1/deals` |
| 301 | `collaborationRouter` | `mountDealRoutes` | `/api/v1/deals` |
| 302 | `contactsSyncRouter` | `mountDealRoutes` | `/api/v1/contacts` |
| 364 | `supplyRoutes` | `mountFinancialRoutes` | `/api/v1` (multi-prefix: `/deals/`, `/trade-area/`, `/events`, `/competitive/`) |
| 367 | `demandRoutes` | `mountFinancialRoutes` | `/api/v1` (multi-prefix: `/deals/`, `/trade-area/`, `/submarket/`, `/events`, `/calculate`) |
| 496 | `geographicContextRoutes` | `mountAnalyticsRoutes` | `/api/v1` (catch-all `/:id/geographic-context`) |

### `backend/src/index.replit.ts` (1 guard)

| Line | Router | Target prefix (after Step 4) |
|------|--------|------------------------------|
| 571 | `zoningTriangulationRouter` | `/api/v1/parcels` |

**Multi-prefix routers** (lines 49, 239, 364, 367, 496) cannot be narrowed without splitting into separate routers or maintaining multiple mount points. These will stay at `/api/v1` permanently and their `requireAuth` will forever rely on `bypassAuth`.

---

## What "Done" (Step 4 Complete) Looks Like

- The 10 narrowable guards (lines 47, 48, 53, 54, 176, 177, 260, 300, 301, 302, 571) converted: router files edited to remove top-level prefix, mount points updated.
- The 6 permanently-broad guards (lines 49, 239, 364, 367, 496, and any future multi-prefix routers) remain — accepted as intentional broad mounts, not accidents.
- `res.locals.bypassAuth` checks in `requireAuth` and `requireSurface` remain (still needed for the 6 permanent broad guards).
- `bypassAuth` setter in the floor (`index.replit.ts:285`) remains.
- End state: ONE explicit floor + allowlist as the primary, readable auth mechanism. The 6 permanent broad guards are explicitly documented as such, not accidents.

---

## Residual Risk While Deferred

The `bypassAuth` flag is a hidden invariant. A developer adding a new `/api/v1` gate middleware that doesn't check the flag re-introduces the silent-401 bug for public routes. This is:
- **Acceptable** — the floor still works, only public routes would break
- **Documented** — comment at both check sites in auth.ts, in this file, and in memory
- **Detectable** — Phase 2 acceptance tests (test B) catch it within minutes

**Trigger to do the narrowable 10:** next time those router files are edited for another feature reason, or before scaling the engineering team past 2–3 developers.

---

## Per-Router Conversion Checklist

For each of the 10 narrowable guards:

1. Open the router file
2. Find all `router.get/post/put/patch/delete(path, ...)` calls
3. Remove the first path segment from each (e.g., `'/deals/:dealId/boundary'` → `'/:dealId/boundary'`)
4. Update the mount in `routes/index.ts` or `index.replit.ts` from `app.use('/api/v1', requireAuth, router)` to `app.use('/api/v1/<prefix>', requireAuth, router)`
5. Restart the backend
6. Hit the affected routes manually (or run the test suite) to confirm no 404 regressions
7. Cross off the row in the table above

When all 10 narrowable guards are converted, the `bypassAuth` setter can be removed from the floor ONLY IF the 6 permanent broad guards are also removed (split into separate routers) — otherwise keep the flag.
