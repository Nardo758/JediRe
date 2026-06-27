# A9-Finding-1: Tier Divergence — Dual-Table, Dual-Vocabulary Entitlements Bug

**Severity:** Launch-blocking (entitlements hole with confirmed fail-open path)
**Status:** Dev unblocked; production fix pending
**Discovered:** 2026-06-27 during login/pipeline verification

---

## What was found

The application maintains **two separate PostgreSQL enum types on two separate tables**, each with a completely different vocabulary, where neither table is aware of the other. Every reader that touches tier data independently decides which table to query, with no shared resolver. The result is that two subsystems can produce opposite entitlement answers for the same user at the same time.

### The two tables

| Table | Column | PG enum type | Valid values |
|---|---|---|---|
| `users` | `subscription_tier` | `subscription_tier` | `free · professional · team · enterprise` |
| `user_credit_balances` | `subscription_tier` | (text / separate enum) | `scout · basic · operator · principal · institutional` |

The vocabularies have **zero overlap**. These were two independent naming conventions that were never reconciled. The divergence is enforced at the database type level — you cannot write `operator` into `users.subscription_tier`; the PG cast will reject it, as confirmed during this investigation.

### The two reader populations

**Group A — billing-canonical readers (read `user_credit_balances`):**
- `middleware/auth.ts:316` — `requireSurface()` / `canAccessSurface()` — **the web/API surface gate**
- `creditService.ts` (all tier checks)
- `aiService.ts:592`
- `settings-ai.routes.ts`
- Fallback: `'scout'`

**Group B — stale readers (read `users.subscription_tier`):**
- `inline-auth.routes.ts` (×4) — populates JWT `plan` field
- `index.legacy.ts` (×2)
- `settings-branding.routes.ts`
- `capsule-sharing.routes.ts`
- `agents/commentary.inngest.ts`
- `agents/supply.inngest.ts`
- `agents/zoning.inngest.ts`
- `agents/research.inngest.ts`
- `cashflow-underwriting.routes.ts`
- Fallback: `'free'`

**Group C — reconciled readers (correct pattern, exists in two places only):**
- `auth.routes.ts:269` — `COALESCE(ucb.subscription_tier, 'scout')`
- `email-intake.function.ts:52` — `COALESCE(ucb.subscription_tier, u.subscription_tier, 'scout')`

Group C is the pattern that should be everywhere and isn't.

---

## The three failure modes

### Mode 1 — TIER_CONFIG crash → HTTP 500 (fail-closed)

`creditService.canAccessSurface()` does:
```typescript
return TIER_CONFIG[tier].surfaces.includes(surface);
```
If a Group A reader ever receives a `users`-vocabulary tier (e.g. `'professional'`), `TIER_CONFIG['professional']` returns `undefined`, and `.surfaces` throws a `TypeError`. `requireSurface()` catches it at line 326 and returns HTTP 500. **Fail-closed, not fail-open — but crashes the request for a legitimate paying user.**

### Mode 2 — Inngest allow-lists accept both vocabularies simultaneously (confirmed fail-open)

The four agent Inngest functions gate runs with hardcoded inclusion arrays that deliberately mix both vocabularies:

```typescript
// commentary.inngest.ts:42, supply.inngest.ts:36, zoning.inngest.ts:37
['operator', 'professional', 'enterprise', 'principal', 'institutional', 'basic']

// research.inngest.ts:42
['operator', 'professional', 'enterprise']
```

These read `users.subscription_tier` directly via SQL. A user with `users.subscription_tier = 'professional'` **is admitted** by every inngest allow-list. If the same user's `user_credit_balances.subscription_tier = 'scout'`, then `requireSurface('web')` **denies** the web surface. **Same user, two subsystems, opposite answers: agent runs granted, web surface denied.** This is the exploit-shaped version — a user gets backend agent execution without corresponding web entitlement.

### Mode 3 — The dev-environment manifestation (confirmed, now unblocked)

The dev user (`m.dixon5030@gmail.com`) had:
- `users.subscription_tier = 'professional'` (valid for that table, set by unknown write path)
- `user_credit_balances.subscription_tier = 'scout'` (stale — billing period also expired 2026-06-17)

`requireSurface('web')` read `user_credit_balances` → `scout` → no web surface → `GET /api/v1/deals` returned 403 → TerminalPage `.catch()` → hardcoded `STATIC_DEALS` displayed → pipeline appeared empty. 464 Bishop and all other real deals invisible.

**Unblocked by:** setting `user_credit_balances.subscription_tier = 'operator'` and renewing the billing period. This masks the bug for one user locally; it does not fix it.

---

## Open sub-questions (required for full severity determination)

### Sub-question 1 — Inngest allow-list enforcement contract

The Inngest allow-lists accept `'professional'` as entitled for agent runs. The question is whether agent runs have any secondary entitlement gate (credit reservation, surface check) that would catch the mismatch before execution completes, or whether a `professional`/`scout`-split user gets full agent execution at no credit cost. If the credit reservation path also reads `user_credit_balances` and checks the balance, the window narrows. If not, it's a free agent execution exploit.

**Trace target:** `creditService.reserveCredits()` — confirm it's called before agent execution and that it reads `user_credit_balances`, not `users`.

### Sub-question 2 — Write path to `users.subscription_tier`

All four registration INSERT paths (`auth.routes.ts:64`, `oauth.ts:70`, `sessionStore.ts:66`, `index.replit.ts:1007`) **omit `subscription_tier` entirely**. New users are born with `users.subscription_tier = NULL`. The value `'professional'` on the dev account arrived via an unknown post-registration path. Candidates: Stripe webhook handler, admin panel update, or manual SQL.

**If registration only ever writes `user_credit_balances`** (via `creditService.provisionUser()`), then every new production user starts with `users.subscription_tier = NULL`. Group B readers fall back to `'free'`. This means every new user is born desynced, and any Group B reader that gates on tier will see `'free'` regardless of what the user actually paid for. That's a recurring production bug, not a one-environment artifact.

**Trace target:** Stripe webhook handler — does it call `creditService.provisionUser()` only, or does it also UPDATE `users.subscription_tier`?

---

## The root cause

No shared `resolveTier(userId)` helper exists. Eight-plus files each inline their own tier query against whichever table the author knew about. The COALESCE pattern in `auth.routes.ts:269` and `email-intake.function.ts:52` proves at least one engineer already knew about the split — the correct fix was implemented in two places and never propagated.

---

## Prescribed fix (not implemented — post-audit gate)

### 1. Create `resolveTier(userId)` with deny-by-default contract

```typescript
// backend/src/services/tier.service.ts
async function resolveTier(userId: string): Promise<SubscriptionTier> {
  const row = await pool.query(
    `SELECT COALESCE(ucb.subscription_tier, 'scout')::text as tier
     FROM users u
     LEFT JOIN user_credit_balances ucb ON ucb.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  const raw = row.rows[0]?.tier ?? 'scout';
  // Unknown tier → lowest privilege. Never a permissive fallback.
  return (raw in TIER_CONFIG) ? raw as SubscriptionTier : 'scout';
}
```

Contract: unknown tier → `'scout'` (lowest privilege). This is the **only sanctioned tier read** — every Group B inline query becomes a call to it.

### 2. Decide canonical vocabulary and kill the legacy enum

TIER_CONFIG vocabulary (`scout · basic · operator · principal · institutional`) is the intended set. Required changes:
- `validation.ts:40` — `z.enum(['basic', 'professional', 'enterprise'])` → update to TIER_CONFIG values
- All four `*.inngest.ts` allow-lists — remove `'professional'` and `'enterprise'`, add missing TIER_CONFIG values consistently
- `users.subscription_tier` — either drop the column (preferred if write path is confirmed dead) or migrate to a new enum matching TIER_CONFIG

### 3. Fix the write path

Once the write path is confirmed, ensure every user creation/upgrade path writes `user_credit_balances` via `creditService.provisionUser()`. If `users.subscription_tier` is retained, add a trigger or application-layer constraint to keep them in sync.

---

## Files implicated

| File | Issue |
|---|---|
| `backend/src/middleware/auth.ts:316` | Correct table, TIER_CONFIG crash on unknown tier |
| `backend/src/api/rest/inline-auth.routes.ts` (×4) | Reads `users` table, emits into JWT `plan` field |
| `backend/src/agents/commentary.inngest.ts:42` | Mixed-vocabulary allow-list, fail-open |
| `backend/src/agents/supply.inngest.ts:36` | Mixed-vocabulary allow-list, fail-open |
| `backend/src/agents/zoning.inngest.ts:37` | Mixed-vocabulary allow-list, fail-open |
| `backend/src/agents/research.inngest.ts:42` | Mixed-vocabulary allow-list, fail-open |
| `backend/src/api/rest/auth.routes.ts:64` | Registration INSERT omits `subscription_tier` |
| `backend/src/auth/oauth.ts:70` | OAuth INSERT omits `subscription_tier` |
| `backend/src/services/ai/creditService.ts:311` | `canAccessSurface` crashes on unknown tier |
| `backend/src/api/rest/auth.routes.ts:269` | ✅ Correct COALESCE pattern — reference implementation |
| `backend/src/functions/email-intake.function.ts:52` | ✅ Correct COALESCE pattern — reference implementation |
