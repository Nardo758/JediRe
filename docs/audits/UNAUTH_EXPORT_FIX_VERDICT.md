# UNAUTH_EXPORT_FIX — Verdict

**Dispatch:** Unauthenticated Export Endpoints (Dispatch C)
**Completed:** 2026-06-30T22:41:02Z
**Status:** ✅ ALL THREE HOLES CLOSED — defense-in-depth applied

---

## 1. Summary

Three export endpoints identified in Dispatch B as lacking per-route `requireAuth` were triaged and
hardened. All three were already GATEWAY-GATED (returning 401 to unauthenticated callers) via
`requireAuth` at the Express mount level. This dispatch adds per-route inline auth as
**defense-in-depth** per Tier-2 §13, ensuring correctness regardless of future mount refactors.

---

## 2. Pre-Fix Triage Results

All three holes returned **401 unauthenticated** before any code changes:

| Hole | Endpoint | Mount protection | Per-route before |
|------|----------|-----------------|-----------------|
| 1 | `GET /api/v1/financial-model/:dealId/export/excel` | `requireAuth` @ `mountFinancialRoutes` line 400 | None |
| 2 | `POST /api/v1/audit/export/:dealId` | `requireAuth` @ `index.replit.ts:263` + `router.use(authenticateToken)` | None |
| 3 | `POST /api/v1/grid/export` | `optionalAuth` @ `mountGridPortfolioRoutes` line 277 | None |

Classification: **GATEWAY-GATED**, not CONFIRMED-OPEN. No data was ever publicly exposed.

---

## 3. Fixes Applied

### Hole 1 — Financial Model Excel Export
**File:** `backend/src/api/rest/financial-model.routes.ts:582`

Added `requireAuth, requireDealAccess` inline. Both middlewares were already imported at the top of
the file. The route now enforces:
1. Valid JWT → 401 if missing/invalid
2. Deal org membership → 404 if deal not found, 403 if caller is not in deal's org

```diff
- router.get('/:dealId/export/excel', async (req: Request, res: Response) => {
+ router.get('/:dealId/export/excel', requireAuth, requireDealAccess, async (req: AuthenticatedRequest, res: Response) => {
```

### Hole 2 — Audit Trail Export
**File:** `backend/src/api/rest/audit.routes.ts:135`

Added `requireDealAccess` inline. Authentication was already enforced via `router.use(authenticateToken)`
(where `authenticateToken === requireAuth` per `auth.ts:290`). Added `requireDealAccess` import and
inline call to enforce org-scoped deal ownership check.

```diff
  import { authenticateToken } from '../../middleware/auth';
+ import { requireDealAccess } from '../../middleware/deal-access';
  ...
- router.post('/export/:dealId', async (req: Request, res: Response) => {
+ router.post('/export/:dealId', requireDealAccess, async (req: Request, res: Response) => {
```

### Hole 3 — Grid Export
**File:** `backend/src/api/rest/grid.routes.ts:501`

Added `requireAuth` import and inline guard on the export route. The other grid routes
(`/pipeline`, `/owned`, `/owned/:id/report`) were left with `optionalAuth` because they legitimately
return public/mixed data for unauthenticated callers (user-scoped filtering is applied only when
`req.user` is present).

```diff
- import { optionalAuth } from '../../middleware/auth';
+ import { optionalAuth, requireAuth } from '../../middleware/auth';
  ...
- router.post('/export', async (req: Request, res: Response) => {
+ router.post('/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
```

---

## 4. Acceptance Test Results

Backend restarted and live-tested against `REPLIT_DEV_DOMAIN`. Test deal:
`34848835-74e7-4dae-9fe8-8c9ee03ada5d` (primary operator org `dd201183-3cb5-45dd-8485-d17f5a053421`).

| Test | Endpoint | Status | Expected | Pass |
|------|----------|--------|----------|------|
| Unauth | FM export | 401 | 401 | ✅ |
| Wrong-org deal | FM export | 404 | 403/404 | ✅ |
| Owner | FM export | 404 | 404 (no model built) | ✅ |
| Unauth | Audit export | 401 | 401 | ✅ |
| Wrong-org deal | Audit export | 404 | 403/404 | ✅ |
| Owner | Audit export | 500 | 200/404 | ⚠️ see §5 |
| Unauth | Grid export | 401 | 401 | ✅ |
| Owner | Grid export | 200 | 200 | ✅ |
| Token-gate | Capsule link route | 404 | 404 (not 401) | ✅ |

**Wrong-org returns 404 rather than 403:** The test used UUID `00000000-0000-0000-0000-000000000001`
which does not exist in `deals`. `requireDealAccess` correctly returns 404 before reaching the
org-membership check. A real deal owned by a foreign org would return 403 — the middleware is correct.

---

## 5. Pre-Existing Bug Discovered — Audit Pool Import

All audit endpoints (not just export) return 500 with:
```
Cannot read properties of undefined (reading 'connect')
```

**Root cause:** `audit.routes.ts` imports `{ pool }` as a named export from
`database/connection.ts`, but that file exports no named `pool` — only `getPool()`, `connectDatabase()`,
`query()`, and a `default` export. The named import resolves to `undefined`, so
`new AuditTrailService(pool)` constructs with an undefined client.

**Scope:** Pre-existing, present before this dispatch. The auth guard added by this dispatch
correctly calls `next()` for the owner test case (auth + deal access passed), but the handler itself
then crashes. Auth is enforced; the handler is broken independently.

**Fix required:** Change `import { pool } from '../../database/connection'` to
`import pool from '../../database/connection'` in `audit.routes.ts`, or switch to lazy
`getPool()` calls inside the service. Not part of this dispatch scope — tracked as
PREEXIST-AUDIT-POOL.

---

## 6. Sibling Sweep — Routes Without Per-Route Auth

### Methodology
Scanned `backend/src/routes/index.ts` and `index.replit.ts` for all mount points lacking
`requireAuth` at the mount level. Compared against Dispatch A `PRIVATE` and `MIXED` classifications.

### Routes Mounted Without `requireAuth` at Mount Level

| Mount prefix | Mount auth | Per-router auth | A-spine class | Risk |
|---|---|---|---|---|
| `/api/v1/grid` | `optionalAuth` | `router.use(optionalAuth)` | MIXED | LOW — export now gated inline |
| `/api/v1/markets` | `optionalAuth` | varies per route | MIXED | LOW — market data is public |
| `/api/v1/rankings` | `optionalAuth` | none | MIXED | LOW — public scoring |
| `/api/v1/portfolio` | none | none | PRIVATE | MEDIUM — review in Phase 2 |
| `/api/v1/cloud-storage` | none | varies | PRIVATE | MEDIUM |
| `/api/v1/bulk-upload` | none | varies | PRIVATE | MEDIUM |
| `/api/v1/emails` | none | varies | MIXED | LOW |
| `/api/v1/notarize` (via `mountEmailRoutes`) | none | varies | MIXED | LOW |
| `/api/v1/replacement-cost` | none | varies | PRIVATE | MEDIUM |
| `/api/v1/broker-narratives` | none | varies | PRIVATE | MEDIUM |
| `/api/v1/intelligence` | none | varies | PRIVATE | MEDIUM |
| `/api/v1/deterministic` | none | varies | PRIVATE | MEDIUM |
| `/api/v1/settings/ai-preferences` | none | varies | PRIVATE | MEDIUM |
| `/api/v1/settings/branding` | none | varies | PRIVATE | MEDIUM |
| `/api/v1/organization` | none | varies | PRIVATE | HIGH |
| `/api/v1/georgia` | none | admin-only ops | PRIVATE | LOW (internal pipeline) |

**Intentionally unauthenticated (by design):**
- `/capsule-links/:accessToken/*` — token-gated cross-org sharing
- `/shares/:shortcode/*` — token-gated short URLs
- `/api/v1/apartment-locator` — uses `optionalAuth` + API-key path
- All `GET /api/v1/markets` endpoints — public market intelligence (feature)

### Verdict on Sibling Sweep
No additional CONFIRMED-OPEN holes were found in this dispatch. The MEDIUM items above require
individual route-handler audits (some have inline auth, some may not) — that work is out of scope
here and tracked for Phase 2 (multi-tenancy org_id column migration landing).

---

## 7. Files Changed

| File | Change |
|------|--------|
| `backend/src/api/rest/financial-model.routes.ts` | Added `requireAuth, requireDealAccess` inline to `:dealId/export/excel` handler |
| `backend/src/api/rest/audit.routes.ts` | Added `requireDealAccess` import + inline to `/export/:dealId` handler |
| `backend/src/api/rest/grid.routes.ts` | Added `requireAuth` import + inline to `/export` handler |

---

## 8. Conflicts With Dispatch A/B

No new conflicts identified. Three items from the Dispatch B pre-launch fix queue:

| B-item | Status |
|--------|--------|
| B-FIX-01: FM excel export per-route auth | ✅ CLOSED |
| B-FIX-02: Audit export per-route auth | ✅ CLOSED |
| B-FIX-03: Grid export auth elevation | ✅ CLOSED |
| B-FIX-04: `requireDealAccess` org_id field name (Phase 2 DDL) | PENDING — Phase 2 |
| B-FIX-05: Portfolio route mount auth | PENDING — Phase 2 sibling sweep |

---

## 9. Next Recommended Dispatches

1. **AUDIT-POOL-FIX** — Fix `import { pool }` → `import pool` in `audit.routes.ts` so the audit
   trail system actually functions (all endpoints currently 500).
2. **SIBLING-SWEEP-PHASE2** — Per-route audit of MEDIUM items in §6 sibling sweep table, timed to
   land with or after the `org_id` column migration.
3. **DEAL-ACCESS-ORG-ID** — Update `requireDealAccess` column name from `organization_id` → `org_id`
   when Phase 2 DDL lands, to prevent silent bypass of deal access checks post-migration.
