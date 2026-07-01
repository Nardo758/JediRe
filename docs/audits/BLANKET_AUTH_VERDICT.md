# BLANKET AUTH — Phase 1 Verdict

**Dispatch:** Structural: Blanket auth on /api/v1 + public allowlist
**Phase:** 1 — READ-ONLY enumeration (HARD STOP)
**HEAD SHA:** `0390efc82deba54b19cbe22cbb7f5289799d2368`
**Completed:** 2026-06-30
**Mode:** READ-ONLY. No code changes.

---

## 0. TL;DR

The accidental blanket guard ALREADY EXISTS. `app.use('/api/v1', requireAuth, requireWeb,
documentsFilesRoutes)` at `routes/index.ts:176`, registered inside `mountDealRoutes(app)` at
`index.replit.ts:240`, acts as a de-facto `/api/v1` floor for all routes registered AFTER line 240.
Every unauthenticated request to `/api/v1/*` that isn't handled by an earlier specific-path or
earlier broad mount will hit `requireAuth` in this guard and return 401.

The fix does not need to CREATE a new blanket guard — it needs to make the EXISTING accidental
one intentional, explicit, and correct. The current accidental guard has two problems:
1. **It uses `requireWeb`** — blocking valid API-key and agent callers that have no `web` surface.
2. **It accidentally gates 6 intended-public routes** that were mounted after line 240 (`/ticker`,
   `/time-series`, `/data-macro`, `/driver-analysis`, `/derived-metrics`, `/columns`) — these are
   currently returning 401 for unauthenticated callers despite being designed as public endpoints.

---

## 1. The Accidental Floor — How It Works

Mount registration order in `index.replit.ts`:

```
line 221: app.use('/health', healthRouter)                           — specific, public
line 222: app.use('/api/v1/auth', authLimiter, authRouter)          — specific, public
line 225: mountAdminRoutes(app)                                      — all specific paths, all auth'd
line 234: app.use('/api/v1/supply', requireAuth, supplyRoutes)      — specific path, auth'd
line 236: app.use('/api/v1', dataRouter)                             — BROAD, no requireAuth
line 240: mountDealRoutes(app) ─────────────────────────────────────┐
  routes/index.ts:116: app.use('/api/v1', capsuleSharingRoutes)     │ ← capsule token routes
  routes/index.ts:126: app.use('/api/v1/deals', requireAuth, ...)   │ ← specific paths, auth'd
  ...                                                                 │
  routes/index.ts:176: app.use('/api/v1', requireAuth, requireWeb,  │ ← THE ACCIDENTAL FLOOR
                              documentsFilesRoutes)                  │   (first broad + requireAuth)
  routes/index.ts:177: app.use('/api/v1', requireAuth, requireWeb,  │
                              submarketDocumentsRoutes)              ┘
line 241: app.use('/api/v1', zoningAnalyzeRouter)                    — BROAD, no requireAuth
line 265: app.use('/api/v1', m26TaxRouter)                           — BROAD (inline auth per route)
line 266: app.use('/api/v1', m27CompsRouter)                         — BROAD (inline auth per route)
line 270: app.use('/api/v1', valuationGridRouter)                    — BROAD (inline auth per route)
line 273: app.use('/api/v1', taxCompAnalysisRouter)                  — BROAD, no auth (naked)
line 277: app.use('/api/v1/ticker', validatePublicQuery, tickerRoutes)  ← BROKEN (blocked by :176)
line 281: app.use('/api/v1/time-series', validatePublicQuery, ...)   ← BROKEN (blocked by :176)
line 284: app.use('/api/v1/data-macro', validatePublicQuery, ...)    ← BROKEN (blocked by :176)
line 287: app.use('/api/v1/driver-analysis', validatePublicQuery, .) ← BROKEN (blocked by :176)
line 290: app.use('/api/v1/derived-metrics', validatePublicQuery, .) ← BROKEN (blocked by :176)
line 293: app.use('/api/v1/columns', validatePublicQuery, ...)       ← BROKEN (blocked by :176)
...
```

For any unauthenticated request to `/api/v1/ticker/*`:
1. `app.use('/api/v1', dataRouter)` — runs, no matching route, calls `next()`
2. `app.use('/api/v1', capsuleSharingRoutes)` — runs, no matching route, calls `next()`
3. `app.use('/api/v1', requireAuth, requireWeb, documentsFilesRoutes)` — path `/api/v1` prefix
   matches. `requireAuth` runs → **401**. Request terminated.
4. `app.use('/api/v1/ticker', validatePublicQuery, tickerRoutes)` — **never reached**.

For authenticated users, step 3 calls `next()` (auth passes) → `documentsFilesRoutes` has no
`/ticker` route → calls `next()` → eventually reaches line 277. So public routes work for auth'd
callers. They are broken only for unauthenticated callers.

---

## 2. Complete Route Inventory

### 2a. Routes NOT under /api/v1 (floor is irrelevant)

| Path | Auth | Notes |
|------|------|-------|
| `GET /health` | None | Health check — remains unaffected |
| `POST /api/stripe/webhook` | Stripe signature | `index.replit.ts:183` |
| `POST /webhooks/twilio` | Twilio signature | Mounted at `app.use('/', messageRouter.createRouter())` |
| `POST /webhooks/telegram` | Telegram secret | Mounted at `app.use('/', messageRouter.createRouter())` |
| `POST /api/inngest` | Inngest HMAC | Mounted at `app.use('/api/inngest', serve(...))` |
| `POST /api/training/*` | `requireAuth` at mount | Training routes (not `/api/v1`) |
| `GET /api/kgraph/*` | See routes | KG alias routes at `/api` |

### 2b. /api/v1/auth — MUST-BE-PUBLIC ✅ (currently working, registered before guards)

Registered at line 222 (`app.use('/api/v1/auth', authLimiter, authRouter)`) — BEFORE `mountDealRoutes`
at line 240. Not intercepted by accidental floor. Live test: 200 for unauth ✅

| Path | Notes |
|------|-------|
| `POST /api/v1/auth/login` | Email/password login |
| `GET /api/v1/auth/dev-login` | Dev bootstrap token |
| `POST /api/v1/auth/register` | New user registration |
| All `/api/v1/auth/*` | Registration, refresh, reset, verify |

Floor implementation: keep `/api/v1/auth` BEFORE the floor, or on allowlist.

### 2c. Webhooks under /api/v1 — MUST-BE-PUBLIC (signature-authenticated)

| Path | File | Auth mechanism | Must allowlist |
|------|------|---------------|----------------|
| `POST /api/v1/webhooks/notarize` | `notarize.routes.ts:171` | `x-notarize-signature` / `x-webhook-signature` HMAC | **YES** |
| `POST /api/v1/clawdbot/command` | `clawdbot-webhooks.routes.ts:61` | `validateWebhook` (HMAC, `crypto.timingSafeEqual`) | **YES** |
| `POST /api/v1/clawdbot/query` | `clawdbot-webhooks.routes.ts:1493` | `validateWebhook` (HMAC) | **YES** |

Note: `notarizeRouter` is mounted at `app.use('/api/v1', notarizeRouter)` (`routes/index.ts:303`).
All other `notarize.routes.ts` routes have inline `requireAuth`; only line 171 is the webhook.

### 2d. Token-gated capsule sharing — MUST-BE-PUBLIC (access-token authenticated)

Currently safe because `capsuleSharingRoutes` is mounted at line 116 (`app.use('/api/v1', capsuleSharingRoutes)`) BEFORE the accidental floor at line 176. After Phase 2, this mount must move BEFORE the intentional floor, or all token routes must be on the allowlist.

| Path | Auth |
|------|------|
| `GET /api/v1/shares/:shortcode` | Access token (path param) |
| `GET /api/v1/shares/:shortcode/export/excel` | Access token |
| `GET /api/v1/shares/:shortcode/export/pdf` | Access token |
| `DELETE /api/v1/shares/:shortcode/overlay` | Access token |
| `GET /api/v1/shares/:shortcode/connection` | Access token |
| `POST /api/v1/shares/:shortcode/connect_api` | Access token |
| `POST /api/v1/shares/:shortcode/query` | Access token |
| `DELETE /api/v1/shares/:shortcode/connect_api` | Access token |
| `GET /api/v1/capsule-links/:accessToken/deal-book` | Access token |
| `GET /api/v1/capsule-links/:accessToken/field-divergences` | Access token |
| `GET /api/v1/capsule-links/:accessToken/overlay` | Access token |
| `DELETE /api/v1/capsule-links/:accessToken/overlay` | Access token |
| `GET /api/v1/capsule-links/:accessToken` | Access token |
| `POST /api/v1/capsule-links/:accessToken/connect_api` | Access token |
| `POST /api/v1/capsule-links/:accessToken/query` | Access token |
| `DELETE /api/v1/capsule-links/:accessToken/connect_api` | Access token |
| `GET /api/v1/capsules/:accessToken` | Access token (legacy) |
| `GET /api/v1/deals/:dealId/deal-book` | No auth (intentionally public deal book) |

**⚠️ Special case:** `GET /api/v1/deals/:dealId/deal-book` lives under the `/deals` prefix, which
in Phase 2 will be auth-gated at mount. This specific path must be on the allowlist as an exact
pattern, or capsuleSharingRoutes must mount before the floor.

**Recommendation:** Mount capsuleSharingRoutes before the floor (it already is in the accidental
setup). The router's own inline `requireAuth` on write routes handles the auth cases. The
public-facing token routes serve unauthenticated callers correctly.

### 2e. Intended-public market data — MUST-BE-PUBLIC ⚠️ CURRENTLY BROKEN

These 6 route families were designed as public endpoints (using `validatePublicQuery` instead of
`requireAuth`) but are currently 401 for unauthenticated callers due to the accidental floor.
**This is an existing bug that Phase 2 would fix by correctly allowlisting them.**

| Mount | File | Registered | Live unauth status |
|-------|------|-----------|------------------|
| `app.use('/api/v1/ticker', validatePublicQuery, tickerRoutes)` | `ticker.routes.ts` | `index.replit.ts:277` | **401 (broken)** |
| `app.use('/api/v1/time-series', validatePublicQuery, ...)` | `time-series.routes.ts` | `index.replit.ts:281` | **401 (broken)** |
| `app.use('/api/v1/data-macro', validatePublicQuery, ...)` | `data-macro.routes.ts` | `index.replit.ts:284` | **401 (broken)** |
| `app.use('/api/v1/driver-analysis', validatePublicQuery, ...)` | `driver-analysis.routes.ts` | `index.replit.ts:287` | **401 (broken)** |
| `app.use('/api/v1/derived-metrics', validatePublicQuery, ...)` | `derived-metrics.routes.ts` | `index.replit.ts:290` | **401 (broken)** |
| `app.use('/api/v1/columns', validatePublicQuery, ...)` | `column-catalog.routes.ts` | `index.replit.ts:293` | **401 (broken)** |

### 2f. OAuth callback — MUST-BE-PUBLIC ⚠️ CURRENTLY BROKEN

`GET /api/v1/microsoft/auth/callback` (`microsoft.routes.ts:126`) has no inline auth and must be
accessible to Microsoft's OAuth redirect. Live test: **401** — Microsoft's OAuth callback is
currently broken for unauthenticated callers. Must be on allowlist.

### 2g. OppGrid public market intelligence — MUST-BE-PUBLIC

OppGrid is a public market intelligence layer. Write/sync routes use `validateOppGridAuth` (HMAC).
Read routes have no auth — by design (public market signals). Currently 401 due to accidental
floor. Must be on allowlist.

| Path | Inline auth |
|------|------------|
| `GET /api/v1/oppgrid/demand-signals` | None |
| `GET /api/v1/oppgrid/market-economics` | None |
| `GET /api/v1/oppgrid/health` | None |
| `GET /api/v1/oppgrid/cities` | None |
| `GET /api/v1/oppgrid/opportunity-signals` | None |
| `GET /api/v1/oppgrid/growth-trajectory` | None |
| `GET /api/v1/oppgrid/composite-traffic` | None |
| `GET /api/v1/oppgrid/badges` | None |
| `POST /api/v1/oppgrid/score-location` | None |
| `POST /api/v1/oppgrid/sync-*` | `validateOppGridAuth` (HMAC) |

**Note:** The `sync-*` routes use `validateOppGridAuth` — they authenticate by a shared secret in
the request body/header. They are not session-auth'd. They should be on the allowlist (their own
HMAC guard is sufficient). All `/api/v1/oppgrid/*` can be allowlisted as a prefix.

### 2h. Grid templates — MUST-BE-PUBLIC (partial)

`app.use('/api/v1/grid-templates', optionalAuth, gridTemplatesRoutes)` (`index.replit.ts:299`).
Uses `optionalAuth` — serves data for both auth'd and unauth'd callers (user-specific data for
auth'd, public templates for unauth). Must stay on allowlist so `optionalAuth` can operate.

### 2i. Agent status endpoint — check needed

`app.use('/api/v1/agents/status', createAgentStatusRoutes(pool))` (`index.replit.ts:308`) — no
auth at mount. Verify inline auth. Currently 401 due to accidental floor. If agent status is
public-readable, allowlist it; if private, let the floor gate it.

### 2j. Currently MUST-BE-AUTHED (all others)

All other `/api/v1/*` routes are private and should be gated by the floor. This includes all
families confirmed in the sibling sweeps:
- `/api/v1/deals/*`, `/api/v1/organization/*`, `/api/v1/portfolio/*`
- `/api/v1/properties/*`, `/api/v1/financial-model/*`, `/api/v1/audit/*`
- `/api/v1/grid/export` (fixed in Dispatch C), and all other grid routes except public data
- `/api/v1/billing/*`, `/api/v1/markets/*` (optional but private when user present)
- All routes with `router.use(requireAuth)` or per-handler `requireAuth`

---

## 3. Webhook Inventory (Exhaustive)

| Webhook | Path | Mount | Auth mechanism | Under /api/v1? | Floor risk |
|---------|------|-------|----------------|----------------|-----------|
| Stripe | `POST /api/stripe/webhook` | `index.replit.ts:183` | `stripe.webhooks.constructEvent` | **NO** | None — not under /api/v1 |
| Twilio | `POST /webhooks/twilio` | `app.use('/', messageRouter.createRouter())` | `verifyTwilioSignature` | **NO** | None |
| Telegram | `POST /webhooks/telegram` | `app.use('/', messageRouter.createRouter())` | `verifyTelegramSecret` | **NO** | None |
| Inngest | `POST /api/inngest` | `app.use('/api/inngest', serve(...))` | Inngest HMAC | **NO** | None |
| Notarize | `POST /api/v1/webhooks/notarize` | `app.use('/api/v1', notarizeRouter)` | `x-notarize-signature` HMAC | **YES** | **MUST ALLOWLIST** |
| Clawdbot command | `POST /api/v1/clawdbot/command` | `app.use('/api/v1/clawdbot', clawdbotWebhooksRouter)` | `validateWebhook` HMAC | **YES** | **MUST ALLOWLIST** |
| Clawdbot query | `POST /api/v1/clawdbot/query` | `app.use('/api/v1/clawdbot', clawdbotWebhooksRouter)` | `validateWebhook` HMAC | **YES** | **MUST ALLOWLIST** |

**4 of 7 webhooks are NOT under `/api/v1` and need no allowlist entry.** Only 3 are at risk.
The Notarize and Clawdbot webhooks each authenticate by their own signature/HMAC — the session
`requireAuth` must not run before them.

---

## 4. Routes With Naked Handlers (No Inline Auth)

These routes currently have no inline `requireAuth`. They are protected TODAY by the accidental
floor. After Phase 2, they remain protected by the INTENTIONAL floor. No allowlist entry needed
unless they are legitimately public.

| Router | Naked routes | Mounted at | Classification | Allowlist? |
|--------|-------------|-----------|----------------|-----------|
| `tax-comp-analysis.routes.ts` | 3 routes (`/deals/:dealId/tax/comp-analysis`) | `app.use('/api/v1', taxCompAnalysisRouter)` | PRIVATE (deal data) | NO |
| `deterministic-model.routes.ts` | 1 route (`/`) | `app.use('/api/v1/deterministic', deterministicModelRouter)` | PRIVATE | NO |
| `knowledge-graph.routes.ts` | All routes | `app.use('/api/v1/knowledge-graph', ...)` | PRIVATE (except maybe `/search`) | NO (floor protects) |
| `scheduled-refresh.routes.ts` | All routes (`/run`, `/stats`, `/stale`, `/refresh/:nodeType`) | `app.use('/api/v1/scheduled-refresh', ...)` | PRIVATE (internal ops) | NO |
| `analogs.routes.ts` | All routes (`/forecast/*`, `/similarity`, `/pool/stats`) | `app.use('/api/v1/analogs', ...)` | PRIVATE | NO |
| `lease-velocity.routes.ts` | All routes (`/run`, `/scenario`) | `app.use('/api/v1/lease-velocity', ...)` | PRIVATE | NO |
| `data-matrix.routes.ts` | `GET /layers` | `app.use('/api/v1/data-matrix', ...)` | MIXED (review) | NO |
| `inline-zoning-analyze.routes.ts` | All routes (`/geocode`, `/zoning/lookup`, `/zoning/districts/:muni`, `/analyze`) | `app.use('/api/v1', zoningAnalyzeRouter)` | PUBLIC UTILITY (no tenant data) | CONFIRM |
| `georgia-ingestion.routes.ts` | 25+ routes | `app.use('/api/v1/georgia', georgiaIngestionRouter)` | PRIVATE (internal pipeline) | NO |
| `oppgrid.routes.ts` (GET routes) | 9 GET + 1 POST (score-location) | `app.use('/api/v1/oppgrid', oppgridRouter)` | PUBLIC MARKET DATA | **YES** |
| `inline-data.routes.ts` `GET /supply/:market` | 1 route | `app.use('/api/v1', dataRouter)` | MIXED (intercepted by specific `/api/v1/supply` mount at line 234 anyway) | NO |

**Requires confirmation before allowlist:** `/api/v1/zoning/lookup`, `/api/v1/geocode`,
`/api/v1/zoning/districts/*`, `/api/v1/analyze` — these are public utility routes with no tenant
data (geocoding, public zoning lookups). They call third-party geocoding APIs and should be
rate-limited if allowlisted. Decision: allowlist them or leave them requiring auth (they're
currently 401 unauth, same as Phase 2 would leave them, so no change either way — but an explicit
decision is needed).

---

## 5. Proposed Implementation

### 5a. Floor mechanism

Add a single `conditionalAuth` middleware at `index.replit.ts`, registered BEFORE
`app.use('/api/v1', dataRouter)` at line 236. It checks the path against the allowlist and either
bypasses (for public paths) or calls `requireAuth` (for everything else):

```ts
// index.replit.ts — insert at line ~233, before dataRouter
const API_V1_PUBLIC_PREFIXES = [
  '/auth',             // /api/v1/auth/* — login, register, dev-login
  '/ticker',           // /api/v1/ticker/* — public market tickers
  '/time-series',      // /api/v1/time-series/* — public time-series data
  '/data-macro',       // /api/v1/data-macro/* — public macro indicators
  '/driver-analysis',  // /api/v1/driver-analysis/* — public demand drivers
  '/derived-metrics',  // /api/v1/derived-metrics/* — public derived metrics
  '/columns',          // /api/v1/columns/* — public column catalog
  '/oppgrid',          // /api/v1/oppgrid/* — public market intelligence
  '/grid-templates',   // /api/v1/grid-templates — optionalAuth (public templates)
  '/clawdbot',         // /api/v1/clawdbot/* — HMAC webhook, no session auth
  '/webhooks',         // /api/v1/webhooks/* — signature-verified webhooks (notarize)
  '/microsoft/auth/callback', // OAuth callback — Microsoft must reach this unauthenticated
  '/shares',           // /api/v1/shares/* — token-gated capsule exports
  '/capsule-links',    // /api/v1/capsule-links/* — token-gated capsule data
  '/capsules',         // /api/v1/capsules/* — token-gated (legacy)
] as const;

// OPTIONAL ADDITIONS (pending decision):
//   '/zoning/lookup', '/geocode', '/zoning/districts', '/analyze'
//   — public utility routes. Currently 401 unauth, same behavior without allowlisting.
//   Allowlist only if confirmed that unauthenticated geocoding/zoning lookup is intended.

function conditionalApiV1Auth(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
) {
  const path = req.path; // path relative to /api/v1 mount
  for (const prefix of API_V1_PUBLIC_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + '/')) {
      return next();
    }
  }
  return requireAuth(req, res, next);
}

app.use('/api/v1', conditionalApiV1Auth);
```

**Note on `/deals/:dealId/deal-book`:** This public capsule route lives under `/deals` which is
NOT on the allowlist. Recommendation: keep `app.use('/api/v1', capsuleSharingRoutes)` at
`routes/index.ts:116` — mounted BEFORE the floor call at `index.replit.ts:233`, or add
`/deals/:dealId/deal-book` as an exact-match pattern in the allowlist. Preferred: move
capsuleSharingRoutes to a mount BEFORE the floor registration in `index.replit.ts`.

### 5b. Accidental guards to remove after Phase 2

Once the intentional floor exists, these broad-prefix guards become redundant and should be
converted to specific-path mounts. **Do not remove before Phase 2 lands** — they're load-bearing
until the intentional floor is in place.

| Current broad mount | Location | Convert to |
|--------------------|----------|-----------|
| `app.use('/api/v1', requireAuth, requireWeb, documentsFilesRoutes)` | `routes/index.ts:176` | `app.use('/api/v1/deals', requireAuth, requireWeb, documentsFilesRoutes)` |
| `app.use('/api/v1', requireAuth, requireWeb, submarketDocumentsRoutes)` | `routes/index.ts:177` | `app.use('/api/v1/deals', requireAuth, requireWeb, submarketDocumentsRoutes)` |
| `app.use('/api/v1', requireAuth, buildingEnvelopeRoutes)` | `routes/index.ts:239` | `app.use('/api/v1/building-envelope', requireAuth, buildingEnvelopeRoutes)` |
| `app.use('/api/v1', requireAuth, propertyProxyRoutes)` | `routes/index.ts:260` | `app.use('/api/v1/properties', requireAuth, propertyProxyRoutes)` |
| `app.use('/api/v1', requireAuth, teamManagementRouter)` | `routes/index.ts:300` | `app.use('/api/v1/team', requireAuth, teamManagementRouter)` |
| `app.use('/api/v1', requireAuth, collaborationRouter)` | `routes/index.ts:301` | `app.use('/api/v1/collaboration', requireAuth, collaborationRouter)` |
| `app.use('/api/v1', requireAuth, contactsSyncRouter)` | `routes/index.ts:302` | `app.use('/api/v1/contacts', requireAuth, contactsSyncRouter)` |
| `app.use('/api/v1', requireAuth, supplyRoutes)` | `routes/index.ts:364` | `app.use('/api/v1/supply', requireAuth, supplyRoutes)` |
| `app.use('/api/v1', requireAuth, demandRoutes)` | `routes/index.ts:367` | `app.use('/api/v1/demand', requireAuth, demandRoutes)` |
| `app.use('/api/v1', requireAuth, geographicContextRoutes)` | `routes/index.ts:496` | `app.use('/api/v1/geographic-context', requireAuth, geographicContextRoutes)` |
| `app.use('/api/v1', requireAuth, propertyBoundaryRouter)` | `routes/index.ts:47` | `app.use('/api/v1/property-boundary', requireAuth, propertyBoundaryRouter)` |
| `app.use('/api/v1', requireAuth, siteIntelligenceRouter)` | `routes/index.ts:48` | `app.use('/api/v1/site-intelligence', requireAuth, siteIntelligenceRouter)` |
| `app.use('/api/v1', requireAuth, zoningCapacityRouter)` | `routes/index.ts:49` | `app.use('/api/v1/zoning-capacity', requireAuth, zoningCapacityRouter)` |
| `app.use('/api/v1', requireAuth, zoningProfileRouter)` | `routes/index.ts:53` | `app.use('/api/v1/zoning-profile', requireAuth, zoningProfileRouter)` |
| `app.use('/api/v1', requireAuth, developmentScenariosRouter)` | `routes/index.ts:54` | `app.use('/api/v1/development-scenarios', requireAuth, developmentScenariosRouter)` |
| `app.use('/api/v1', requireAuth, zoningTriangulationRouter)` | `index.replit.ts:515` | `app.use('/api/v1/zoning-triangulation', requireAuth, zoningTriangulationRouter)` |

**⚠️ CONFIRM actual paths before renaming** — each router's internal routes start relative to the
mount prefix. If `buildingEnvelopeRoutes` uses `router.get('/building-envelope/:dealId', ...)` it
would double the prefix. Verify with `grep -n "router\.(get\|post" backend/src/api/rest/<file>`
before renaming any mount. The specific path chosen must match what the router declares internally.

### 5c. requireWeb removal on the floor

The accidental floor uses `requireWeb` — this blocks API-key callers, agent surface callers, and
any non-web client from ALL `/api/v1` routes. The intentional floor should use ONLY `requireAuth`
at the floor level. Specific routes that need surface enforcement retain their existing inline
`requireSurface('web')` guards. The floor is an identity check only, not a surface check.

---

## 6. Pre-Phase-2 Confirmation Checklist

Before Phase 2 runs, the following items need an explicit decision:

| # | Item | Decision needed |
|---|------|----------------|
| C1 | `/api/v1/zoning/lookup`, `/api/v1/geocode`, `/api/v1/zoning/districts/*`, `/api/v1/analyze` | Allowlist (public utility, no auth) OR leave requiring auth? Currently 401 unauth — no change if not allowlisted. |
| C2 | `/api/v1/agents/status` | Public health/status endpoint or private? Allowlist if public. |
| C3 | `GET /api/v1/deals/:dealId/deal-book` | Confirm mount-before-floor approach (move capsuleSharingRoutes mount to before floor registration in index.replit.ts) |
| C4 | Specific-path renames for broad guards (§5b) | Verify each router's internal paths before renaming mount prefixes |
| C5 | `requireWeb` on the floor | Confirm: floor uses `requireAuth` only, not `requireAuth + requireWeb` |

---

## 7. Phase 2 Acceptance Test Plan (write here, execute only on approval)

1. **Default-deny proof:** `GET /api/v1/properties` (no token) → 401 from INTENTIONAL floor
   (not accidental). Body includes a `source: 'conditionalApiV1Auth'` field for traceability.
2. **Allowlist proof — auth routes:** `GET /api/v1/auth/dev-login` → 200 (no token needed)
3. **Allowlist proof — public market data (PREVIOUSLY BROKEN):**
   - `GET /api/v1/ticker?limit=5` → 200 (was 401 before fix)
   - `GET /api/v1/columns?limit=5` → 200 (was 401 before fix)
4. **Allowlist proof — oppgrid:** `GET /api/v1/oppgrid/cities` → 200
5. **Allowlist proof — capsule token route:**
   `GET /api/v1/capsule-links/fakeinvalidtoken/deal-book` → 404 (not 401)
6. **Webhook proof (CRITICAL):**
   - `POST /api/v1/webhooks/notarize` with no session token → NOT 401 (should reach handler → 401
     only if signature invalid, not from session auth)
   - `POST /api/v1/clawdbot/command` with no session token → NOT 401 from session auth
   - `POST /api/stripe/webhook` (unchanged, not under /api/v1) — confirm still receives Stripe events
7. **Microsoft OAuth:** `GET /api/v1/microsoft/auth/callback` → NOT 401 from floor (was broken)
8. **Authed route still works:** `GET /api/v1/organization` with valid JWT → 401 removed,
   route reaches handler (will get 200 or same response as before)
9. **Accidental-guard routes now gated by INTENTIONAL floor:** Routes that were accidentally
   protected (e.g., `GET /api/v1/markets/owners/TEST/portfolio`) → still 401, but now from the
   intentional floor, not mount-order coincidence

---

## 8. HARD STOP

**Phase 1 is complete. Do not proceed to Phase 2 without explicit approval of the allowlist.**

The allowlist contains **17 public prefixes + 1 special-case path (`/deals/:dealId/deal-book`)**.
Items C1–C5 above require decisions before implementation.

The BROKEN ITEMS (§2e, §2f) are bugs introduced by the existing accidental floor that Phase 2 will
fix as a side effect of correctly positioning the allowlist BEFORE the floor.

Summary:
- **7 webhooks total** — 4 outside `/api/v1` (safe), 3 inside (`notarize`, `clawdbot/command`,
  `clawdbot/query`) — all must be on allowlist
- **17 allowlist prefix entries** (see §5a)
- **16 broad-prefix accidental guards to convert** to specific-path mounts after Phase 2
- **6 intended-public routes currently broken** (ticker, time-series, etc.) — Phase 2 fixes them
- **1 OAuth callback currently broken** (Microsoft) — Phase 2 fixes it
