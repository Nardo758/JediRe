# B3 Org Subscription — Verdict Audit

**Date:** 2026-07-02  
**Scope:** Move billing identity from user → org. Tier becomes ORG-authoritative.  
**Status:** COMPLETE ✅

---

## Acceptance Tests

| # | Test | Result |
|---|------|--------|
| 1 | Checkout creates/resolves Stripe customer at **org** level (`org_credit_balances.stripe_customer_id`) | ✅ `billing.routes.ts` — `resolveOrgForUser` → `org_credit_balances` first |
| 2 | Webhook updates **org** tier on `customer.subscription.updated/deleted` | ✅ `webhookHandlers.ts` — `findOrgByStripeCustomer` (primary), `findOrgOwner` (fallback) |
| 3 | Tier gate (`requireSurface`) reads org-authoritative tier | ✅ `creditService.getBalance()` overlays `org_credit_balances.subscription_tier` via `effective_subscription_tier` |
| 4 | **Grep clean** — no `ucb.subscription_tier` as primary/sole source in any gate | ✅ All remaining `ucb.subscription_tier` refs are COALESCE fallbacks with org as primary |
| 5 | Pre-B3 (user-only) Stripe customers still handled | ✅ `webhookHandlers.ts` user-indirect fallback path kept |
| 6 | Leon's Stripe customer linked to org row | ✅ `UPDATE org_credit_balances SET stripe_customer_id = 'cus_UNxXv4CuLNKJla' WHERE org_id = 'dd201183-...'` — applied |
| 7 | `user_credit_balances.subscription_tier` kept as display mirror (not dropped) | ✅ Mirror write preserved in `updateOrgTier` (dual-write) |

---

## Files Changed (GAP 1 — Billing Routes & Webhooks)

| File | Change |
|------|--------|
| `backend/src/api/rest/billing.routes.ts` | Checkout resolves org via `resolveOrgForUser`; creates/links Stripe customer on `org_credit_balances.stripe_customer_id` |
| `backend/src/services/stripe/webhookHandlers.ts` | Added `findOrgByStripeCustomer` (PRIMARY path); org-direct resolution for all 4 events; user-indirect kept as fallback |

## Files Changed (GAP 2 — Tier Gate SQL Reads)

| File | Change |
|------|--------|
| `backend/src/services/ai/creditService.ts` | `getBalance()` overlays `effective_subscription_tier` from org via JOIN |
| `backend/src/services/ai/orgCreditService.ts` | Added `getUserOrgTier(userId)` helper |
| `backend/src/api/rest/settings-ai.routes.ts` | 5 `ucb.subscription_tier` reads → org subquery |
| `backend/src/agents/runtime/MeteringAdapter.ts` | 2 reads → org-preferred COALESCE (stripe_customer_id + tier) |
| `backend/src/services/ai/aiService.ts` | `getUserTier()` → org subquery |
| `backend/src/services/chat/sessionStore.ts` | 3 reads → org subquery |
| `backend/src/api/rest/cashflow-underwriting.routes.ts` | 3 reads → org subquery |
| `backend/src/api/rest/capsule-sharing.routes.ts` | 4 reads → org subquery (removed dead `ucb` JOIN) |
| `backend/src/api/rest/settings-branding.routes.ts` | 2 reads → org subquery (removed dead `ucb` JOIN) |
| `backend/src/agents/cashflow.inngest.ts` | 2 reads → org subquery (removed dead `ucb` JOIN) |
| `backend/src/agents/commentary.inngest.ts` | 1 read → org subquery (removed dead `ucb` JOIN) |
| `backend/src/inngest/functions/email-intake.function.ts` | 1 read → org subquery |
| `backend/src/api/rest/inline-auth.routes.ts` | 3 reads → org subquery (GROUP BY fixed: `ucb.subscription_tier` → `u.default_org_id`) |

## Migration Applied

```sql
-- Step 5: Link pre-B3 Stripe customer to org row for Leon (dd201183)
UPDATE org_credit_balances
SET stripe_customer_id = 'cus_UNxXv4CuLNKJla'
WHERE org_id = 'dd201183-3cb5-45dd-8485-d17f5a053421';
-- Result: UPDATE 1
```

---

## Resolution Pattern

**Standard org-tier overlay (when `u` alias in scope):**
```sql
COALESCE(
  (SELECT ocb.subscription_tier FROM org_credit_balances ocb WHERE ocb.org_id = u.default_org_id),
  'scout'
) AS tier
```

**`creditService.getBalance()` overlay (user_id only in scope):**
```sql
COALESCE(
  (SELECT ocb.subscription_tier FROM users uu
   JOIN org_credit_balances ocb ON ocb.org_id = uu.default_org_id
   WHERE uu.id = ucb.user_id),
  ucb.subscription_tier
) AS effective_subscription_tier
```

---

## Invariants Preserved

- `user_credit_balances.subscription_tier` — kept as display mirror; dual-written by `updateOrgTier`; never used as a gate decision in any B3 path
- Pre-B3 Stripe customers (user-level `stripe_customer_id`) — still handled via fallback in webhook and checkout
- `org_credit_balances` — single source of truth for tier, Stripe customer, and credit pool
- `users.default_org_id` — bridge between user identity and org billing identity

---

## What's NOT in B3 (deferred to B4/B5)

- Seat-based billing (multiple users per org, each with a seat charge)
- Org-level credit pool sharing across members (currently pool is sized for the owner)
- Admin UI for org subscription management
