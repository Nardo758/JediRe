# provisionUser Automation Level Fix — Verdict

**Date:** 2026-06-30  
**HEAD SHA:** `ac9d379828fe494e1459fc014e4380e5cd38ae58` (pre-fix); fix applied in this dispatch  
**Dispatch spec:** `attached_assets/PROVISION_AUTOMATION_FIX_1782833365241.md`  
**Evidence rule (S1-01):** done = new subscriber provisioned through the live `.created` path lands at the correct automation_level, proven by live DB query.

---

## THE FIX

### Problem
`creditService.ts:193` hardcoded `automation_level = 1` in both arms of the UPSERT inside `provisionUser()`, regardless of the tier argument. Every new subscriber above scout was under-entitled from day one.

### Both arms edited — `creditService.ts`

**INSERT VALUES arm** (`$4` positional parameter, line 193):

```typescript
// BEFORE
1, // start at Level 1 automation

// AFTER
config.maxAutomationLevel, // derive from tier config, not hardcoded
```

**ON CONFLICT DO UPDATE arm** (line 182):

```typescript
automation_level = $4,
```

Both arms share `$4`. Changing line 193 fixes both simultaneously — the INSERT writes `config.maxAutomationLevel` and the conflict-update writes the same value. No separate edit was needed for the conflict arm; both were already wired to `$4`.

`config` was already in scope at line 167: `const config = TIER_CONFIG[tier]`.

**`updateTier()` (line 287) was not touched** — it was already correct.

---

## ACCEPTANCE — LIVE PER-TIER QUERIES

All four acceptance checks run through `creditService.provisionUser()` — the exact function called by `webhookHandlers.ts:69` on `customer.subscription.created`. No raw SQL inserts used.

### 1. Operator (maxAutomationLevel = 2) — expect 2

```
SELECT user_id, subscription_tier, automation_level
FROM user_credit_balances WHERE user_id = 'aaaa0001-0000-0000-0000-000000000001';

user_id                              | subscription_tier | automation_level
aaaa0001-0000-0000-0000-000000000001 | operator          | 2
```

**→ PASS**

### 2. Principal (maxAutomationLevel = 3) — expect 3

```
SELECT user_id, subscription_tier, automation_level
FROM user_credit_balances WHERE user_id = 'aaaa0001-0000-0000-0000-000000000002';

user_id                              | subscription_tier | automation_level
aaaa0001-0000-0000-0000-000000000002 | principal         | 3
```

**→ PASS**

### 3. Scout (maxAutomationLevel = 1) — expect 1 (fix must not break the correct tier)

```
SELECT user_id, subscription_tier, automation_level
FROM user_credit_balances WHERE user_id = 'aaaa0001-0000-0000-0000-000000000003';

user_id                              | subscription_tier | automation_level
aaaa0001-0000-0000-0000-000000000003 | scout             | 1
```

**→ PASS**

### 4. UPSERT conflict arm — re-provision existing operator row as principal

Confirms the ON CONFLICT DO UPDATE arm raises automation_level correctly, and does not reset it to 1.

```
BEFORE (operator row, automation_level = 2):
user_id                              | subscription_tier | automation_level
aaaa0001-0000-0000-0000-000000000001 | operator          | 2

provisionUser(userId, stripeCustomerId, 'principal')  ← second call, triggers conflict path

AFTER:
SELECT user_id, subscription_tier, automation_level
FROM user_credit_balances WHERE user_id = 'aaaa0001-0000-0000-0000-000000000001';

user_id                              | subscription_tier | automation_level
aaaa0001-0000-0000-0000-000000000001 | principal         | 3
```

automation_level rose 2 → 3. Conflict arm is fixed.

**→ PASS**

---

## CLEANUP

All four test user rows deleted from `user_credit_balances` and `users`. No test data remains.  
Test IDs used (safe to grep for):
- `aaaa0001-0000-0000-0000-000000000001`
- `aaaa0001-0000-0000-0000-000000000002`
- `aaaa0001-0000-0000-0000-000000000003`

---

## F3 STATUS UPDATE

| Path | Status |
|---|---|
| Upgrade path — `updateTier()` on `customer.subscription.updated` | **CONFIRMED** (F2/F3 reverify, prior dispatch) |
| Initial provisioning — `provisionUser()` on `customer.subscription.created` | **FIXED + ACCEPTED** (this dispatch) |
| Stripe `.updated` → handler wiring (real Stripe event fires `updateTier`) | **UNVERIFIED** (Stripe test event not triggerable in dev env; separate dispatch required) |

F3 is **not fully closed** until the Stripe wiring item is verified.

---

## NEXT DISPATCH (out of scope here)

**Backfill** — existing under-provisioned UCB rows (all tiers above scout provisioned before this fix). The affected population is wider than the two operator rows identified in the trace: any subscriber at operator, principal, or institutional who was provisioned via `.created` and never subsequently triggered `.updated`. Scoping and execution require a separate human-approved dispatch.

Order: fix (this dispatch ✓) → backfill (next dispatch, separate approval).
