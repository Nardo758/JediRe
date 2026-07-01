# SIBLING_ROUTE_TRIAGE — Verdict

**Dispatch:** /organization + /portfolio live triage (read-only)
**HEAD SHA:** `0390efc82deba54b19cbe22cbb7f5289799d2368`
**Completed:** 2026-06-30
**Mode:** READ-ONLY. No code changes were made.

---

## Verdict Line

**Both `/api/v1/organization*` and `/api/v1/portfolio*` are SAFE.** Every route in both families
returned 401 for unauthenticated requests. Every route in both files has inline `requireAuth` on
the handler. Neither family is OPEN with tenant data.

The structural gap is **missing mount-level `requireAuth`** — both routers are mounted without it
at `routes/index.ts:463` and `routes/index.ts:279`. This is the same fragile pattern as the export
endpoints, but it does not constitute a current hole because every handler has inline per-route
auth. Fix is the structural blanket-auth dispatch (out of scope here).

---

## 1. Route Enumeration

### `/api/v1/organization` — `backend/src/api/rest/organization.routes.ts`

Mount: `app.use('/api/v1/organization', organizationRouter)` — **NO mount-level auth** (`routes/index.ts:463`)

| Method | Path | Inline auth | file:line |
|--------|------|-------------|-----------|
| GET | `/` | `requireAuth` | `organization.routes.ts:26` |
| GET | `/members` | `requireAuth` | `organization.routes.ts:43` |
| POST | `/members/invite` | `requireAuth` | `organization.routes.ts:61` |
| GET | `/deals/:dealId/team` | `requireAuth` | `organization.routes.ts:85` |
| POST | `/deals/:dealId/team` | `requireAuth` | `organization.routes.ts:103` |
| DELETE | `/deals/:dealId/team/:memberId` | `requireAuth` | `organization.routes.ts:127` |
| GET | `/deals/:dealId/handoffs` | `requireAuth` | `organization.routes.ts:146` |
| POST | `/deals/:dealId/handoffs` | `requireAuth` | `organization.routes.ts:160` |
| POST | `/handoffs/:handoffId/complete` | `requireAuth` | `organization.routes.ts:182` |
| GET | `/deals/:dealId/context` | `requireAuth` | `organization.routes.ts:201` |
| POST | `/deals/:dealId/context` | `requireAuth` | `organization.routes.ts:221` |
| PATCH | `/context/:itemId/status` | `requireAuth` | `organization.routes.ts:238` |
| GET | `/deals/:dealId/context/summary` | `requireAuth` | `organization.routes.ts:258` |
| GET | `/my-action-items` | `requireAuth` | `organization.routes.ts:272` |
| POST | `/integrations/docusign/credentials` | `requireAuth` | `organization.routes.ts:294` |
| POST | `/deals/:dealId/envelopes` | `requireAuth` | `organization.routes.ts:312` |
| GET | `/deals/:dealId/envelopes` | `requireAuth` | `organization.routes.ts:332` |
| POST | `/integrations/notarize/credentials` | `requireAuth` | `organization.routes.ts:350` |
| POST | `/deals/:dealId/notarize` | `requireAuth` | `organization.routes.ts:368` |
| POST | `/integrations/plaid/credentials` | `requireAuth` | `organization.routes.ts:392` |
| POST | `/deals/:dealId/verify` | `requireAuth` | `organization.routes.ts:410` |
| GET | `/deals/:dealId/verifications` | `requireAuth` | `organization.routes.ts:430` |

**22 routes. 22/22 inline-gated. 0 gaps.**

---

### `/api/v1/portfolio` — `backend/src/api/rest/portfolio.routes.ts`

Mount: `app.use('/api/v1/portfolio', portfolioRouter)` — **NO mount-level auth** (`routes/index.ts:279`)

| Method | Path | Inline auth | file:line |
|--------|------|-------------|-----------|
| GET | `/metrics` | `requireAuth` | `portfolio.routes.ts:21` |
| GET | `/submarkets` | `requireAuth` | `portfolio.routes.ts:70` |
| GET | `/assets` | `requireAuth` | `portfolio.routes.ts:95` |
| POST | `/assets` | `requireAuth` | `portfolio.routes.ts:188` |
| GET | `/assets/:propertyId/actuals` | `requireAuth` | `portfolio.routes.ts:242` |
| POST | `/assets/:propertyId/actuals` | `requireAuth` | `portfolio.routes.ts:294` |
| GET | `/performance` | `requireAuth` | `portfolio.routes.ts:351` |
| GET | `/performance/contributors` | `requireAuth` | `portfolio.routes.ts:441` |
| GET | `/allocation` | `requireAuth` | `portfolio.routes.ts:484` |
| GET | `/:dealId/summary` | `requireAuth` | `portfolio.routes.ts:534` |
| GET | `/:dealId/financials` | `requireAuth` | `portfolio.routes.ts:676` |
| POST | `/:dealId/agent-report` | `requireAuth` | `portfolio.routes.ts:1001` |
| POST | `/run-correlations` | `requireAuth` | `portfolio.routes.ts:1110` |
| GET | `/correlation-signals` | `requireAuth` | `portfolio.routes.ts:1139` |
| GET | `/:dealId/traffic` | `requireAuth` | `portfolio.routes.ts:1159` |
| GET | `/:dealId/leasing` | `requireAuth` | `portfolio.routes.ts:1205` |

**16 routes. 16/16 inline-gated. 0 gaps.**

---

### Incidental routes with "portfolio" in path (other router files)

| Method | Full path | File | Mount-level auth | Inline auth | Notes |
|--------|-----------|------|-----------------|-------------|-------|
| GET | `/api/v1/markets/owners/:ownerName/portfolio` | `market-intelligence-enhanced.routes.ts:274` | `optionalAuth` | None | See §3 below |
| POST | `/api/v1/module-wiring/wire/portfolio` | `module-wiring.routes.ts:598` | `requireAuth` at mount (`routes/index.ts:384`) | None | GATEWAY-GATED |
| GET | `/api/v1/m35/portfolio/events` | `m35-events.routes.ts:217` | `requireAuth` at mount (`routes/index.ts:70`) | None | GATEWAY-GATED |

---

## 2. Live Triage Results — STEP 2

All tests: **unauthenticated**, no `Authorization` header, against running app.

### `/api/v1/organization`

| Test | Status | Classification |
|------|--------|----------------|
| `GET /api/v1/organization` | 401 | INLINE-GATED |
| `GET /api/v1/organization/members` | 401 | INLINE-GATED |
| `GET /api/v1/organization/my-action-items` | 401 | INLINE-GATED |
| `GET /api/v1/organization/deals/{fakeId}/team` | 401 | INLINE-GATED |
| `GET /api/v1/organization/deals/{fakeId}/context` | 401 | INLINE-GATED |
| `GET /api/v1/organization/deals/{fakeId}/handoffs` | 401 | INLINE-GATED |
| `GET /api/v1/organization/deals/{fakeId}/context/summary` | 401 | INLINE-GATED |
| `GET /api/v1/organization/deals/{fakeId}/envelopes` | 401 | INLINE-GATED |
| `GET /api/v1/organization/deals/{fakeId}/verifications` | 401 | INLINE-GATED |

9/9 tested → 401. **No open routes.**

### `/api/v1/portfolio`

| Test | Status | Classification |
|------|--------|----------------|
| `GET /api/v1/portfolio/metrics` | 401 | INLINE-GATED |
| `GET /api/v1/portfolio/submarkets` | 401 | INLINE-GATED |
| `GET /api/v1/portfolio/assets` | 401 | INLINE-GATED |
| `GET /api/v1/portfolio/performance` | 401 | INLINE-GATED |
| `GET /api/v1/portfolio/performance/contributors` | 401 | INLINE-GATED |
| `GET /api/v1/portfolio/allocation` | 401 | INLINE-GATED |
| `GET /api/v1/portfolio/correlation-signals` | 401 | INLINE-GATED |
| `GET /api/v1/portfolio/{fakeId}/summary` | 401 | INLINE-GATED |
| `GET /api/v1/portfolio/{fakeId}/financials` | 401 | INLINE-GATED |
| `GET /api/v1/portfolio/{fakeId}/traffic` | 401 | INLINE-GATED |
| `GET /api/v1/portfolio/{fakeId}/leasing` | 401 | INLINE-GATED |

11/11 tested → 401. **No open routes.**

### Incidental routes

| Test | Status | Classification |
|------|--------|----------------|
| `GET /api/v1/markets/owners/ACME/portfolio` | 401 | ACCIDENTALLY GATED — see §3 |
| `POST /api/v1/module-wiring/wire/portfolio` | 401 | GATEWAY-GATED (mount `requireAuth`) |
| `GET /api/v1/m35/portfolio/events` (tested as `/portfolio/events`) | 401 | GATEWAY-GATED (mount `requireAuth`) |

---

## 3. STEP 3 — Special Finding: Accidental Guard on Market-Enhanced Route

### Route
`GET /api/v1/markets/owners/:ownerName/portfolio` (`market-intelligence-enhanced.routes.ts:274`)

- Mount: `app.use('/api/v1/markets', optionalAuth, createEnhancedMarketIntelligenceRoutes(pool))`
  — **optionalAuth only, not requireAuth**
- Inline: **no auth check whatsoever** in the handler
- Handler: queries `property_records` by `owner_name`, returns address, units, year_built,
  assessed_value, computed signals (`HOLD`/`SELL?`/`SELL`)

### Why it returned 401
In Express, `app.use('/api/v1', requireAuth, router)` runs `requireAuth` for **all** paths starting
with `/api/v1`, not just paths that the sub-router matches. `mountPropertyRoutes(app, pool)` at
`index.replit.ts:301` (immediately before `mountGridPortfolioRoutes` at line 302) registers:

```ts
// routes/index.ts:239
app.use('/api/v1', requireAuth, buildingEnvelopeRoutes);
// routes/index.ts:260
app.use('/api/v1', requireAuth, propertyProxyRoutes);
```

A `GET /api/v1/markets/owners/ACME/portfolio` request hits `requireAuth` in these broad
path-prefix mounts before ever reaching the markets router. With no JWT, `requireAuth` returns 401.
The markets router is **never reached**.

### Data classification if guard is removed
`property_records` columns returned: `address`, `units`, `year_built`, `assessed_value`,
`price_per_unit` (computed), `hold_years` (computed), signal. These are **public assessor records**
— the same data published by county tax assessors. Classification: **OPEN-PUBLIC** (not PRIVATE
tenant data). Severity if exposed: LOW — no org IDs, deal IDs, user-specific data, or financial
model data. Assessor data is public record.

### Risk posture
This route is **currently safe** only because of accidental upstream protection. It has:
- No inline auth
- Only `optionalAuth` at its own mount

If `buildingEnvelopeRoutes` or `propertyProxyRoutes` are extracted to specific-path mounts (e.g.
`/api/v1/building-envelope`), the accidental guard disappears and this route becomes OPEN-PUBLIC.
The appropriate fix is adding inline `optionalAuth`-style filtering or, if the data is truly public,
documenting it as intentionally public. It does NOT warrant emergency fix.

---

## 4. Structural Gap Summary (both families)

Both `/api/v1/organization` and `/api/v1/portfolio` are mounted without `requireAuth` at the
mount level. This is the same "mount-only fragility" pattern noted in Dispatch B/C:

| Router file | Mount | Mount auth | All handlers inline-gated |
|-------------|-------|------------|--------------------------|
| `organization.routes.ts` | `routes/index.ts:463` | ❌ none | ✅ yes (22/22) |
| `portfolio.routes.ts` | `routes/index.ts:279` | ❌ none | ✅ yes (16/16) |

**Current posture: safe.** A new route added to either file that forgets inline `requireAuth`
would be immediately OPEN with full tenant data (org membership lists, portfolio assets, actuals).
This is the primary driver for the structural blanket-auth fix.

The gating layer for both: **inline `requireAuth` on every handler.** Not mount-level.

---

## 5. Open Items (not in scope, flagged for follow-on)

| ID | Description | Severity |
|----|-------------|----------|
| STRUCTURAL-BLANKET-AUTH | Add mount-level `requireAuth` to `/api/v1/organization` and `/api/v1/portfolio` mounts (and all other PRIVATE-serving mounts lacking it). Closes the "new route = instant hole" structural gap. | MEDIUM — no current hole, structural risk only |
| MARKET-ENHANCED-INLINE-AUTH | Add explicit inline auth to `/owners/:ownerName/portfolio` handler (currently depends on accidental upstream guard). Treat as `optionalAuth` (public data is fine unauth) or document as intentionally public. | LOW |
| PREEXIST-AUDIT-POOL | `audit.routes.ts` `import { pool }` resolves to `undefined` — all audit endpoints 500. | HIGH (functionality, not security) |
| DEAL-ACCESS-ORG-ID | `requireDealAccess` reads `organization_id` column; Phase 2 DDL renames to `org_id`. Update before migration lands. | MEDIUM — Phase 2 timing |

---

## 6. Summary

| Family | Routes | All 401 unauth | Auth layer | Tenant data risk |
|--------|--------|---------------|------------|-----------------|
| `/api/v1/organization*` | 22 | ✅ yes | Inline `requireAuth` per-handler | **NONE** currently |
| `/api/v1/portfolio*` | 16 | ✅ yes | Inline `requireAuth` per-handler | **NONE** currently |
| `/api/v1/markets/owners/:name/portfolio` | 1 | ✅ yes | Accidental upstream broad mount | **NONE** currently (public data if exposed) |
| `/api/v1/module-wiring/wire/portfolio` | 1 | ✅ yes | Mount-level `requireAuth` | **NONE** |
| `/api/v1/m35/portfolio/events` | 1 | ✅ yes | Mount-level `requireAuth` | **NONE** |

**No OPEN-PRIVATE routes found. No emergency fix dispatch required.** The next action from this
triage is the structural blanket-auth fix (STRUCTURAL-BLANKET-AUTH above), which is a hardening
measure, not an active security incident.
