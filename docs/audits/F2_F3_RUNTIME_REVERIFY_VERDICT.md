# F2 / F3 Runtime Reverification Verdict

**Date:** 2026-06-30  
**HEAD SHA at test time:** `0fc7305361a32007b4e4f4c5245c0d7dda428ef6`  
**Dispatch spec:** `attached_assets/F2_F3_RUNTIME_REVERIFY_1782825504063.md`  
**Rule S1-01:** "confirmed" = pasted live request + live DB query. Code review is NOT acceptance.

---

## F2 — Deal tier derives from UCB, not request body

### Claim
`POST /api/v1/deals` ignores any `tier` or `subscriptionTier` field in the request body. Tier is derived server-side from `user_credit_balances.subscription_tier` for the authenticated user.

### Test setup
- **Test user:** `f2a-operator@test.jedi` (user_id: `31720afb-fe3f-421a-9697-096e3fe52565`)
- **UCB tier (pre-test):** `operator`
- **Forged body fields:** `tier: "principal"`, `subscriptionTier: "principal"`
- **JWT:** generated server-side using `JWT_SECRET`, payload `{ userId, email, role: "user", user_type: "human" }` — same shape as production tokens

### Live request
```
POST /api/v1/deals  HTTP/1.1
Authorization: Bearer <jwt-for-31720afb>
Content-Type: application/json

{
  "name": "F2-reverify-1782825866XXX",
  "boundary": { "type": "Point", "coordinates": [-84.3879824, 33.7489954] },
  "projectType": "existing",
  "projectIntent": "existing value-add",
  "targetUnits": 100,
  "budget": 5000000,
  "tier": "principal",
  "subscriptionTier": "principal"
}
```

### Live results
| Observation | Value |
|---|---|
| HTTP status | `201 Created` |
| Response `deal.tier` | `"operator"` |
| `SELECT tier FROM deals WHERE id = 'c92b5746-79a4-4303-8f2a-aba8d5bd4182'` | `"operator"` |
| `user_id` matches test user | `true` |

### Verdict: ✓ PASS

The forged body values `tier: "principal"` and `subscriptionTier: "principal"` were ignored. The DB row received `tier = "operator"` — the value from `user_credit_balances` for the authenticated user, fetched at `inline-deals.routes.ts:387` via `creditService.getBalance(req.user.userId)`.

### Code anchor (confirmed)
- `inline-deals.routes.ts` lines 376–381: `tier` is **not** in the body destructure.
- Line 387: `const balance = await creditService.getBalance(req.user!.userId)` — DB fetch using `req.user.userId` (from verified JWT, not body).
- Line 455: `const userTier = balance?.subscriptionTier ?? 'scout'`
- Line 484: `$10 = userTier` in the INSERT — server-derived only.

### Artifact
Test deal `c92b5746-79a4-4303-8f2a-aba8d5bd4182` archived (not deleted). `archived_at` set 2026-06-30.

---

## F3 — automation_level rises when tier is upgraded via the real upgrade path

### Claim
When `creditService.updateTier(userId, newTier)` is called on an upgrade, `automation_level` is set to `TIER_CONFIG[newTier].maxAutomationLevel`. The real production upgrade path is:

```
Stripe webhook (customer.subscription.updated)
  → webhookHandlers.ts:96
  → creditService.updateTier(userId, newTier)
```

### Test setup
- **Test user:** `f2a-operator@test.jedi` (same as F2)
- **UCB state pre-test:** `subscription_tier = "operator"`, `automation_level = 1`, `credits_remaining = 500`
- **Upgrade applied:** `operator → principal`
- **Expected after:** `automation_level = 3` (principal `maxAutomationLevel = 3` per `TIER_CONFIG`)

### Upgrade path caveat
The Stripe webhook (`customer.subscription.updated`) **cannot be triggered** in the dev environment — no live Stripe endpoint is reachable from this env. The test calls `creditService.updateTier()` directly, which is **the exact same function** that `webhookHandlers.ts:96` calls. This proves:

- ✓ **The handler logic is correct** — `updateTier` correctly applies `automation_level`.
- ✗ **NOT proven** — that a real Stripe event causes the webhook handler to fire. That path (`Stripe → webhookHandlers.ts → updateTier`) is wired at `webhookHandlers.ts:90–98` but was not exercised at runtime due to env constraints.

### Live results

**Before:**
```
SELECT subscription_tier, automation_level FROM user_credit_balances
  WHERE user_id = '31720afb-fe3f-421a-9697-096e3fe52565'
→ subscription_tier: "operator" | automation_level: 1
```

**After `creditService.updateTier(userId, "principal")`:**
```
SELECT subscription_tier, automation_level FROM user_credit_balances
  WHERE user_id = '31720afb-fe3f-421a-9697-096e3fe52565'
→ subscription_tier: "principal" | automation_level: 3
```

**Backend log emitted by service:**
```json
{ "level": "info", "userId": "31720afb-...", "newTier": "principal", "newCreditsRemaining": "500.0000001500" }
```

**Restored after test:**
```
subscription_tier: "operator" | automation_level: 1 | credits_remaining: 500
```

### Verdict: ✓ PASS (handler logic confirmed; Stripe-to-handler wiring not runtime-proven)

`automation_level` rose from `1` → `3` when upgraded to `principal`. The `updateTier` function correctly applies `TIER_CONFIG[newTier].maxAutomationLevel` in a single UPDATE (confirmed at `creditService.ts:274–291`).

### Code anchor (confirmed)
- `creditService.ts:250`: `const config = TIER_CONFIG[newTier]`
- `creditService.ts:287`: `automation_level = config.maxAutomationLevel` in the UPDATE
- `webhookHandlers.ts:96`: `await creditService.updateTier(userId, newTier)` — production wiring

---

## Anomaly flagged: operator UCB shows automation_level = 1 (expected 2)

Both UCB rows with `subscription_tier = 'operator'` in the DB show `automation_level = 1`. Per `TIER_CONFIG`, operator `maxAutomationLevel = 2`. This discrepancy predates this audit and was not introduced by any work in the current session.

**Likely cause:** These users were created or upgraded before `updateTier()` was wired to write `automation_level`, or their UCB rows were seeded manually. A targeted backfill — `UPDATE user_credit_balances SET automation_level = 2 WHERE subscription_tier = 'operator' AND automation_level < 2` — would correct it.

This is **out of scope** for the F2/F3 reverification but is flagged for follow-up.

---

## Summary table

| Check | Verdict | Evidence type |
|---|---|---|
| F2: body `tier` ignored | ✓ PASS | Live HTTP 201 + live `SELECT tier FROM deals` |
| F2: DB tier = UCB value | ✓ PASS | `deals.tier = "operator"` (UCB), not `"principal"` (forged) |
| F3: `updateTier` raises `automation_level` | ✓ PASS | Live before/after `SELECT` from `user_credit_balances` |
| F3: Stripe webhook fires `updateTier` | NOT PROVEN (env limitation) | Stripe webhook not triggerable in dev env |
| Anomaly: operator `automation_level = 1` (expected 2) | FLAGGED | Pre-existing; not introduced in this session |
