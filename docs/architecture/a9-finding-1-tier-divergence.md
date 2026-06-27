# A9-Finding-1: Tier Divergence — Dual-Table, Dual-Vocabulary Entitlements Bug

**Severity:** Launch-blocking (NULL-denial breaks agent runs for all net-new paying users)
**Status:** ✅ CLOSED — fix verified (S1-01 passed 2026-06-27), column dropped
**Discovered:** 2026-06-27 during login/pipeline verification
**Write-path closure:** 2026-06-27 · SHA `d4d626ebf0713e4c4c2d86f92dd430e20f0f1adc`
**Reader repoint:** 2026-06-27 · ~16 sites across 7 files (see session handoff doc)
**Column dropped:** 2026-06-27 · migration `20260627_drop_users_subscription_tier.sql`

**S1-01 evidence — v2 (2026-06-27, definitive):**

Test design: defeated the `automation_level` confound by seeding User A with `automation_level=2` in UCB.
This forces the agent past both gates to its next step, producing direct observable evidence of admission
(not inference from a downstream block). `users.subscription_tier` column confirmed absent before seeding.

Pre-flight query result (tier-gate SQL against live DB, post-DROP):
```
Deal A (UCB='operator'):  COALESCE tier='operator' ✅
Deal B (no UCB row):      COALESCE tier='scout'    ✅
```

**ADMIT path — Deal A (UCB=`operator`, `automation_level=2`):**
```
19:46:54 [error] column dp.property_type does not exist
  at backend/src/agents/commentary.inngest.ts:110       ← resolve-deal-context step
  at backend/src/agents/supply.inngest.ts:84            ← resolve-deal-context step (payload-tier)
19:46:54 [error] column dp.lot_size_sqft does not exist
  at backend/src/agents/zoning.inngest.ts:85            ← resolve-deal-context step (payload-tier)
19:46:37 [info] CashFlow Agent: no T12 or rent-roll data found — deferring run
  dealId: 00000000-5102-0001-dddd-000000000001          ← reached business logic, past both gates
```
`resolve-deal-context` and business-logic steps are ONLY reachable when `tier-gate` step returns
`allowed:true`. Direct observation — no inference. Schema errors (`dp.property_type`,
`dp.lot_size_sqft`) are pre-existing unrelated issues in `deal_properties`, not caused by this work.

**DENY path — Deal B (no UCB row → COALESCE=`scout`):**
```
19:46:36 [info] CashFlow Agent: tier gate blocked (event-driven not permitted)
  dealId: 00000000-5102-0002-dddd-000000000002          ← tier gate's own deny log ✅
19:46:36 [info] Supply Agent: automation_level gate blocked
  dealId: 00000000-5102-0002-dddd-000000000002          ← scout passes Supply tier gate; auto=1 blocks
19:46:36 [info] Commentary Agent: automation_level gate blocked
  dealId: 00000000-5102-0002-dddd-000000000002          ← scout passes Commentary tier gate; auto=1 blocks
19:46:36 [info] Zoning Agent: automation_level gate blocked
  dealId: 00000000-5102-0002-dddd-000000000002          ← scout passes Zoning tier gate; auto=1 blocks
```
CashFlow tier-gate deny for scout is **direct observation** — tier gate's own log line. For
Commentary/Supply/Zoning, scout is in their ALLOWED_TIERS (only CashFlow event-driven requires
operator+); automation_level blocks at default=1. Both behaviours are correct by design.

**DID NOT APPEAR (confirms no regression):**
- No `"Commentary Agent: tier gate blocked"` for Deal A
- No `"automation_level gate blocked"` for Deal A

UCB is the sole tier source post-DROP. Repoint is correct across both trigger patterns.

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

### 2. Drop the zombie column — no COALESCE needed

Write-path trace confirmed: **`users.subscription_tier` has zero live writers.** Every subscription lifecycle event (created/updated/deleted) writes `user_credit_balances` exclusively via `creditService`. No registration path, no webhook, no automated path writes `users.subscription_tier`. Any value present on existing accounts is a fossil.

**A COALESCE resolver is wrong here.** A resolver that prefers `user_credit_balances` and falls back to `users.subscription_tier` is just ceremony around a permanently stale value. The correct action is narrower:

- **Drop** `users.subscription_tier` column (after verifying no migration or view blocks the DROP)
- **Repoint** all Group B readers directly at `user_credit_balances.subscription_tier` — no helper needed, it's a single-table read
- All four `*.inngest.ts` allow-lists must be rewritten to query `user_credit_balances` instead of `users`; remove `'professional'` and `'enterprise'` from the vocabulary arrays

Also update:
- `validation.ts:40` — `z.enum(['basic', 'professional', 'enterprise'])` → canonical TIER_CONFIG values
- `deal_capsules.recipient_tier DEFAULT 'free'` — fourth zombie-tier surface (see below)

### 3. The write path is already correct — no change needed

`creditService.provisionUser()` is the sole writer. It is called correctly by `webhookHandlers.ts` on every `customer.subscription.created` event. Registration does not need to be changed — new users correctly start with no `user_credit_balances` row until they subscribe. The NULL-denial bug (below) is caused by inngest reading the wrong table, not by a missing write.

---

## Fourth zombie-tier surface — `capsule-sharing.routes.ts:133-144`

**Correction from earlier draft:** `deal_capsules.recipient_tier DEFAULT 'free'` is migration-DDL-only from the stale `20260619_deal_capsules.sql` migration, which was baselined without being applied. The live `deal_capsules` table has 15 columns and no `recipient_tier` column — confirmed against the live DB. That entry was wrong and is retracted.

**The actual fourth surface** is a live reader in `capsule-sharing.routes.ts`:

```sql
-- capsule-sharing.routes.ts:133-144
SELECT dc.id, dc.property_address, ...,
       COALESCE(u.subscription_tier, 'free') AS subscription_tier
FROM deal_capsules dc
JOIN users u ON u.id = dc.user_id
WHERE dc.id = $1 AND dc.user_id = $2 LIMIT 1
```

Then at line 188:
```typescript
const senderTier: string = capsuleRow.subscription_tier ?? 'free';
const canRemoveAttribution = ['enterprise'].includes(senderTier);
```

This reads `users.subscription_tier` (the zombie column) via a JOIN to gate whether the sender can suppress attribution branding on external shares. Two consequences:

1. **Drop-time breakage:** When `users.subscription_tier` is dropped, PostgreSQL will throw `column u.subscription_tier does not exist` on every capsule share attempt. The column drop requires this JOIN to be repointed to `user_credit_balances.subscription_tier` first.
2. **Current silent miscalibration:** The zombie column defaults `'free'` today. `canRemoveAttribution` evaluates `['enterprise'].includes('free')` → always `false` for every user regardless of their actual billing tier. This means no paying user can currently suppress attribution branding even if they are entitled to.

**Updated four zombie-tier surfaces for the fix pass:**
1. `users.subscription_tier` column (the core — zombie, zero live writers)
2. 4 inngest allow-lists (`commentary/supply/zoning/research.inngest.ts`) — mixed-vocabulary, fail-open; NULL-denial for new paying users
3. `validation.ts:40` — `z.enum(['basic','professional','enterprise'])` in Zod schema
4. `capsule-sharing.routes.ts:133-144` — live JOIN on zombie column; breaks on DROP, currently misrates every sender as non-enterprise

---

## Write-path closure appendix

*Appended 2026-06-27 · SHA `d4d626ebf0713e4c4c2d86f92dd430e20f0f1adc`*

### Stripe product → tier map

`webhookHandlers.ts:6-11` — **canonical vocabulary only:**
```typescript
const PRODUCT_TO_TIER: Record<string, SubscriptionTier> = {
  [process.env.STRIPE_PRODUCT_SCOUT         || 'prod_scout']:         'scout',
  [process.env.STRIPE_PRODUCT_OPERATOR      || 'prod_operator']:      'operator',
  [process.env.STRIPE_PRODUCT_PRINCIPAL     || 'prod_principal']:     'principal',
  [process.env.STRIPE_PRODUCT_INSTITUTIONAL || 'prod_institutional']: 'institutional',
};
```
`free`, `professional`, `team`, `enterprise` do not appear in this map.

### Writer table (exhaustive)

| file:line | table | column | vocab | value source |
|---|---|---|---|---|
| `creditService.ts:160-167` (provisionUser) | `user_credit_balances` | `subscription_tier` | canonical | `PRODUCT_TO_TIER[productId]` |
| `creditService.ts:257-259` (updateTier) | `user_credit_balances` | `subscription_tier` | canonical | same |
| `webhookHandlers.ts:74` | `users` | `stripe_customer_id` only | n/a | Stripe customerId (not a tier write) |
| `auth.routes.ts:64` | `users` | *(omits subscription_tier)* | — | registration INSERT |
| `oauth.ts:70` | `users` | *(omits subscription_tier)* | — | OAuth INSERT |
| `sessionStore.ts:66` | `users` | *(omits subscription_tier)* | — | session INSERT |
| `index.replit.ts:1007` | `users` | *(omits subscription_tier)* | — | seed INSERT |

**`users.subscription_tier` has zero writers in the current codebase.**

### Q3 verdict — confirmed

*Q3: Does the subscription path write `users.subscription_tier` WITHOUT `user_credit_balances`?*

**NO** — but the actual finding is more severe. The subscription path writes `user_credit_balances` only and never touches `users.subscription_tier` at all. The two consequences:

**Consequence A — NULL-denial (launch-blocking):** New Stripe subscriber → `users.subscription_tier = NULL` → inngest `WHERE subscription_tier = ANY('{operator,professional,...}')` → NULL matches nothing → agent runs denied for a paying customer. The chat surface *is* the agent path. This breaks the first real customer.

**Consequence B — Downgrade leak (real, lower urgency):** Fossil accounts with `users.subscription_tier = 'professional'` → Stripe downgrade → `user_credit_balances` drops to `scout` → `requireSurface` denies web surface → but inngest still sees `'professional'` → agent runs continue. Blast radius: only accounts carrying a non-NULL fossil value — a shrinking population as the column is never written again. The column drop incidentally closes this.

**Invisible in dev testing:** The dev account carries the fossil `'professional'` value, which passes every inngest allow-list check. Agents appear to work in the founder's environment. The NULL-denial breaks only new accounts — exactly the users who will never appear in internal testing.

---

## Files implicated

| File | Issue |
|---|---|
| `backend/src/middleware/auth.ts:316` | Correct table; TIER_CONFIG crashes on unknown tier → HTTP 500 |
| `backend/src/api/rest/inline-auth.routes.ts` (×4) | Reads `users` table, emits stale tier into JWT `plan` field |
| `backend/src/agents/commentary.inngest.ts:42` | Mixed-vocabulary allow-list, reads `users`, fail-open on downgrade |
| `backend/src/agents/supply.inngest.ts:36` | Same |
| `backend/src/agents/zoning.inngest.ts:37` | Same |
| `backend/src/agents/research.inngest.ts:42` | Same; NULL-denial blocks new paying users from agent runs |
| `backend/src/api/rest/auth.routes.ts:64` | Registration INSERT omits `subscription_tier` (by design — correct) |
| `backend/src/auth/oauth.ts:70` | OAuth INSERT omits `subscription_tier` (by design — correct) |
| `backend/src/services/ai/creditService.ts:311` | `canAccessSurface` crashes on unknown tier |
| `backend/src/api/rest/capsule-sharing.routes.ts:133-144` | Live JOIN on `users.subscription_tier` — breaks on DROP; currently misrates all senders as non-enterprise |
| `backend/src/api/rest/auth.routes.ts:269` | ✅ Correct single-table read — reference implementation |
| `backend/src/functions/email-intake.function.ts:52` | ✅ Correct COALESCE pattern — reference implementation |
| `backend/src/services/stripe/webhookHandlers.ts` | ✅ Correct — canonical vocab only, writes `user_credit_balances` |
| `backend/src/services/ai/creditService.ts` (provisionUser, updateTier) | ✅ Correct sole writer of subscription tier |
