# Auth Step 4 Debt — Specific-Path Guard Conversion

**Parent audit:** `docs/audits/BLANKET_AUTH_PHASE2_VERDICT.md`  
**Created:** 2026-07-01

---

## The Invariant (DO NOT BREAK)

`/api/v1` auth is enforced by two layers working together:

1. **Floor** — `conditionalApiV1Auth` in `backend/src/index.replit.ts` (registered before all `mountXxxRoutes` calls). Uses `API_V1_PUBLIC_PREFIXES` (18 entries). For allowlisted paths it sets `res.locals.bypassAuth = true` then calls `next()`. For all other paths it calls `requireAuth` directly.

2. **~15 legacy broad guards** — `app.use('/api/v1', requireAuth, router)` mounts spread across `mountZoningRoutes`, `mountDealRoutes`, `mountFinancialRoutes`, `mountPropertyRoutes`, `mountAnalyticsRoutes`, and `mountOperationsRoutes` in `backend/src/routes/index.ts`. These fire for EVERY `/api/v1/*` request that passes the floor.

**The glue:** `requireAuth` and `requireSurface` (in `backend/src/middleware/auth.ts`) each check `res.locals.bypassAuth === true` at the very top and call `next()` immediately if set. This allows the broad guards to honour the floor's allowlist decision without being converted.

```
RULE: Any middleware that gates /api/v1 MUST check res.locals.bypassAuth first.
      A gate that ignores the flag will 401 the public allowlist routes.
```

The symptom of a violation: a market-data, OAuth callback, or share-link route mysteriously starts returning 401 even though it's on the allowlist.

---

## Why Step 4 Is Deferred

The 15 broad guards cannot be safely narrowed from `app.use('/api/v1', requireAuth, router)` to `app.use('/api/v1/deals', requireAuth, router)` without also modifying the router files.

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

## Affected Broad Guards (15)

Located in `backend/src/routes/index.ts`:

| Mount function | Router | Current mount | Target mount |
|---|---|---|---|
| `mountZoningRoutes` | `propertyBoundaryRouter` | `/api/v1` | `/api/v1/deals` |
| `mountZoningRoutes` | `siteIntelligenceRouter` | `/api/v1` | `/api/v1/deals` |
| `mountZoningRoutes` | `zoningCapacityRouter` | `/api/v1` | `/api/v1` (multi-prefix: `/deals/`, `/zoning-districts/`, `/municipalities/`) |
| `mountZoningRoutes` | `zoningProfileRouter` | `/api/v1` | `/api/v1/deals` |
| `mountZoningRoutes` | `developmentScenariosRouter` | `/api/v1` | `/api/v1/deals` |
| `mountDealRoutes` | `documentsFilesRoutes` | `/api/v1` | `/api/v1/deals` (all routes: `/deals/:dealId/files`) |
| `mountDealRoutes` | `submarketDocumentsRoutes` | `/api/v1` | `/api/v1/submarkets` |
| `mountDealRoutes` | `teamManagementRouter` | `/api/v1` | `/api/v1/deals` |
| `mountDealRoutes` | `collaborationRouter` | `/api/v1` | `/api/v1/deals` |
| `mountDealRoutes` | `contactsSyncRouter` | `/api/v1` | `/api/v1/contacts` |
| `mountPropertyRoutes` | `buildingEnvelopeRoutes` | `/api/v1` | `/api/v1` (multi-prefix: `/deals/`, `/property-type-configs`) |
| `mountPropertyRoutes` | `propertyProxyRoutes` | `/api/v1` | `/api/v1/properties` |
| `mountFinancialRoutes` | `supplyRoutes` | `/api/v1` | `/api/v1` (multi-prefix: `/deals/`, `/trade-area/`, `/events`, `/competitive/`) |
| `mountFinancialRoutes` | `demandRoutes` | `/api/v1` | `/api/v1` (multi-prefix: `/deals/`, `/trade-area/`, `/submarket/`, `/events`, `/calculate`) |
| `mountAnalyticsRoutes` | `geographicContextRoutes` | `/api/v1` | `/api/v1` (catch-all `/:id/geographic-context`) |

Plus one in `index.replit.ts`:

| Location | Router | Current mount | Target mount |
|---|---|---|---|
| `index.replit.ts:566` | `zoningTriangulationRouter` | `/api/v1` | `/api/v1/parcels` |

**Multi-prefix routers** (marked above) cannot be narrowed without splitting into separate routers or maintaining multiple mount points. They stay at `/api/v1` indefinitely.

---

## When to Do This

Good moments to pick up Step 4 (one router at a time):

- When a router file is being edited for a feature anyway — add the prefix removal as part of that PR
- Before onboarding additional developers (explicit paths are easier to audit)
- During a dedicated auth cleanup sprint

**Do not** touch the `res.locals.bypassAuth` checks in `requireAuth` / `requireSurface` until ALL 15 broad guards have been converted and removed. Removing the flag early breaks the invariant.

---

## How to Convert One Router (Checklist)

1. Find all `router.get/post/put/patch/delete(...)` calls in the router file
2. Remove the top-level prefix (e.g., `/deals` in `/deals/:dealId/boundary` → `/:dealId/boundary`)
3. Update the mount in `routes/index.ts` from `app.use('/api/v1', requireAuth, router)` to `app.use('/api/v1/deals', requireAuth, router)`
4. Run the acceptance test suite (or manually hit the affected routes) to confirm no 404 regressions
5. Decrement the count in this file
6. When count = 0: remove `bypassAuth` checks from `requireAuth` and `requireSurface`, remove the `bypassAuth` setter from the floor middleware
