# F5a ADMIN-AUTH CLASSIFICATION + F2/F3 REVERIFY

**Date:** 2026-06-30  
**SHA:** `2cbea6dce19f32b0ee4708e634bf28b435d1c302` (master)  
**Mode:** READ-ONLY (classification, reverify, report). No fixes applied.  

---

## PART 1 — F5a: Classification of Admin Guards

### The 7 Sites (verified against HEAD)

| # | Site (file:line) | Symbol Name | Definition (file:line) | Mechanism | Failure Mode | Bucket |
|---|---|---|---|---|---|---|
| 1 | `admin.routes.ts:35` | `requireAdmin` | `admin.routes.ts:35` | Checks `req.user.role !== 'admin'` (session-based) | 403 "Admin access required" | **SESSION-ADMIN** |
| 2 | `admin-data-coverage.routes.ts:15` | `requireAdmin` | `admin-data-coverage.routes.ts:15` | Checks `req.user.role !== 'admin'` (async variant, throws AppError) | 403 "Admin access required" | **SESSION-ADMIN** |
| 3 | `dot-admin.routes.ts:12` | `requireAdminAuth` | `dot-admin.routes.ts:12` | Tries API key (`API_KEY_ADMIN`) first; if matched, sets `req.user` as synthetic admin. Falls back to `requireAuth` + `req.user.role !== 'admin'`. | 403 if no match | **HYBRID** (API-KEY → SESSION-ADMIN) |
| 4 | `atlanta-url-discovery.routes.ts:9` | `requireAdminAuth` | `atlanta-url-discovery.routes.ts:9` | Identical to #3 — API key first, then session auth + role check. | 403 if no match | **HYBRID** (API-KEY → SESSION-ADMIN) |
| 5 | `correlation.routes.ts:26` | `requireAdminApiKey` | `correlation.routes.ts:26` | Checks `extractAdminApiKey` against `API_KEY_ADMIN` only. No session fallback. | 401 if no key; 403 if invalid key | **API-KEY** |
| 6 | `admin-api-key.routes.ts:17` | `requireAdminApiKey` | `admin-api-key.routes.ts:17` | Checks `x-api-key` / `Authorization: Bearer` / `?api_key=` against `API_KEY_ADMIN`. No session fallback. | 401 if no key; 403 if invalid key | **API-KEY** |
| 7 | `ingestion.routes.ts:22` | `requireAdmin` | `ingestion.routes.ts:22` | Checks `req.user?.userId` ONLY — **does NOT check role**. | 401 if no userId | **AUTH-ONLY** (misnamed) |

### Distinct Mechanisms: 4

1. **SESSION-ADMIN** — checks `req.user.role === 'admin'` (sites #1, #2)
2. **API-KEY** — checks static `API_KEY_ADMIN` env secret, no session (sites #5, #6)
3. **HYBRID** — API key first, then session fallback with role check (sites #3, #4)
4. **AUTH-ONLY** — checks only "is there any authenticated user", not admin role (site #7)

### Critical Mismatches

#### MISMATCH A: `ingestion.routes.ts` — misnamed + orphaned
- **Named** `requireAdmin` but **only checks `req.user?.userId`** (not `role === 'admin'`)
- **Never mounted** in the app — `grep -rn "ingestion.routes"` across all entry files finds only the KG and Georgia ingestion routers, not this file
- **Impact:** Zero runtime risk (dead code), but the name is dangerously misleading for anyone copy-pasting

#### MISMATCH B: `admin.routes.ts:35` — defined but unused
- `requireAdmin` (SESSION-ADMIN) is **defined at line 35** but **never applied to any route** in the file
- All 25+ routes in `admin.routes.ts` use `requireAdminAuth` (HYBRID) instead
- **Impact:** Dead code. If a future route copy-pastes the wrong name, it loses API-key fallback

#### MISMATCH C: `admin.routes.ts` — double-gated at registry + inline
- Registry mount (`routes/index.ts:28`): `app.use('/api/v1/admin', requireAuth, requireRole('admin'), adminRouter)`
- Inline: every route in `admin.routes.ts` also has `requireAdminAuth` (HYBRID)
- For **session-based access**: registry `requireRole('admin')` already enforces role; inline `requireAdminAuth` session fallback is redundant
- For **API-key access**: registry `requireAuth` already handles `API_KEY_ADMIN` via `requireApiKey` (sets `role: 'admin'`); inline `requireAdminAuth` API-key check is redundant
- **Impact:** Not a security flaw, but unnecessary complexity. Every admin route runs 2–3 auth checks when 1 would suffice

#### MISMATCH D: `agent.routes.ts:126` — inline role check, different pattern
- Not one of the 7 named middlewares, but mentioned in prior audit: `if (req.user?.role !== 'admin')` uses optional chaining instead of explicit `!req.user` guard
- Semantically correct (`undefined !== 'admin'` → true → 403), but stylistically inconsistent with the `if (!req.user || req.user.role !== 'admin')` pattern used elsewhere

---

## PART 2 — F2 / F3 Live-Instance Reverify

**STATUS: CANNOT COMPLETE — no live database connection available in this session.**

The session environment does not have `DATABASE_URL` configured, and the codebase's `.env.replit` files do not contain DB credentials. No `psql` or running PostgreSQL instance is accessible.

### What is owed:

#### F2 — tier derives from UCB, not request body
- **Claim:** `inline-deals.routes.ts:455` `const userTier = balance?.subscriptionTier ?? 'scout'` ignores any forged `tier` in the request body.
- **Code review:** `inline-deals.routes.ts:381` destructures `req.body` but does NOT include `tier` in the destructured fields. Line 455 derives `userTier` from `balance` (already fetched from `user_credit_balances` at line ~430). No `req.body.tier` is referenced anywhere in the handler.
- **Verdict:** The code supports the claim. **Runtime verification is deferred** until a live DB is available. The risk is LOW because the body field is simply never read.

#### F3 — automation_level rises on real tier upgrade
- **Claim:** `creditService.ts:287` sets `automation_level = config.maxAutomationLevel` on tier update.
- **Code review:** `creditService.ts:273-291` shows the UPDATE query sets `automation_level = $4` where `$4 = config.maxAutomationLevel`. The `LEAST()` clamp was removed in the prior fix pass. Both upgrade and downgrade directions are handled (upgrade: add credit diff; downgrade: cap at new max).
- **Verdict:** The code supports the claim. **Runtime verification is deferred** until a live DB is available.

### Recommendation
Schedule a re-verify session with `DATABASE_URL` set, or add a CI test that:
1. Creates a deal with a forged `tier` body field and asserts the stored tier matches the user's UCB tier
2. Upgrades a test user's tier and asserts `automation_level` rises to the new max

---

## PART 3 — F5b Open Product Decision

**F5b:** Non-admin roles (`investor`, `developer`, `flipper`, `broker`, `landlord`, `commercial`) are stored in `users.role` and returned in auth responses, but **checked nowhere** in the codebase. `login` defaults to `role || 'user'` which is not even a valid role per the type spec.  
→ **OPEN PRODUCT DECISION:** Does `role` gate any feature, or does `tier` (subscription tier) do all entitlement work? Logged as a known open item; no code change until product decides.

---

## Summary

| Question | Answer |
|---|---|
| Actually distinct admin mechanisms? | **4** (SESSION-ADMIN, API-KEY, HYBRID, AUTH-ONLY) |
| Security-relevant mismatches? | **4** (MISMATCH A–D above) |
| Dead code? | `admin.routes.ts:35` `requireAdmin` (unused); `ingestion.routes.ts` (unmounted) |
| F2 code-verdict? | ✅ Claim supported by source (body field never read) — runtime verify pending |
| F3 code-verdict? | ✅ Claim supported by source (`automation_level = config.maxAutomationLevel`) — runtime verify pending |
| A9 safe to sign? | **Provisionally yes** — F2/F3 hold at code level; runtime proof deferred. F5a is classification only (no security holes, just redundancy + dead code). F5b is a product decision, not a bug. |
| Next step? | **Consolidation design** (separate dispatch) to collapse 4 mechanisms into 1 shared middleware + 1 registry mount. **F2/F3 runtime reverify** when DB is available. **F5b product decision** on whether roles matter. |

---

*END OF REPORT*
