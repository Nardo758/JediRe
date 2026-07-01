---
name: /api/v1 bypassAuth invariant
description: The two-layer auth floor on /api/v1 and the res.locals.bypassAuth flag that holds it together — must be preserved by any new middleware that gates /api/v1.
---

## The Rule

Any Express middleware that gates `/api/v1` requests MUST check `res.locals.bypassAuth === true` at the top and call `next()` immediately if set.

```ts
// Required pattern for any new /api/v1 gate
if (res.locals.bypassAuth === true) {
  return next(); // §AUTH-FLOOR: honour allowlist decision
}
```

**Why:** The auth floor (`conditionalApiV1Auth` in `index.replit.ts`) sets this flag for allowlisted public paths before calling `next()`. ~15 legacy broad guards (`app.use('/api/v1', requireAuth, router)`) also fire for the same requests. If any guard ignores the flag, it 401s the public allowlist routes.

**Symptom of violation:** a market-data, OAuth callback, or share-link route returns 401 despite being on the allowlist.

## Current Architecture

**Floor** (`backend/src/index.replit.ts`, registered before all `mountXxxRoutes` calls):
- `API_V1_PUBLIC_PREFIXES` — 18-entry allowlist (`/auth`, `/ticker`, `/time-series`, `/data-macro`, `/driver-analysis`, `/derived-metrics`, `/columns`, `/column-catalog`, `/grid-data`, `/column-insights`, `/grid-templates`, `/microsoft/auth/callback`, `/oppgrid`, `/shares`, `/capsule-links`, `/capsules`, `/webhooks`, `/clawdbot`)
- Allowlisted paths: sets `res.locals.bypassAuth = true`, calls `next()`
- All other paths: calls `requireAuth` directly (401 if no token)

**Flag consumers** (`backend/src/middleware/auth.ts`):
- `requireAuth` — bypassAuth check at top of function
- `requireSurface` — bypassAuth check at top of returned middleware

**~15 legacy broad guards** (`backend/src/routes/index.ts`): remain as defense-in-depth; they honour the flag via the `requireAuth` check above.

## Step 4 (Deferred)

The end state is to remove the broad guards and remount routers at specific paths, eliminating the need for the flag. Blocked because all affected router files define routes using the full path from `/api/v1` root — changing the mount prefix alone breaks routes without also editing the router files.

**Do NOT remove the bypassAuth checks from `requireAuth`/`requireSurface` until all 15 broad guards are converted.**

Full debt details: `docs/audits/AUTH_STEP4_DEBT.md`

## How to apply

- Adding a new `/api/v1` middleware (rate limiter, workspace validator, etc.)? Add the bypassAuth check first.
- Adding a new public route? Add its prefix to `API_V1_PUBLIC_PREFIXES` in `index.replit.ts`.
- Editing a router file that has a broad guard? Good time to do Step 4 for that router (see debt doc checklist).
