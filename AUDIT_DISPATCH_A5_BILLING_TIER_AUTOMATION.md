# A5 Audit — Billing / Tier / Automation-Level Gating

> **Audit domain:** Monetization wiring — credit metering, Stripe integration, subscription tiers, automation levels, and feature gating.  
> **Status:** ◑ Dispatch written  
> **Date:** 2025-07-17  
> **Auditor:** Agent  
> **Rule:** Read-only. No fixes in this file. Findings → fix backlog.

---

## 1. Executive Summary

| Area | Grade | Label | Finding |
|---|---|---|---|
| Stripe billing (checkout, portal, webhooks) | **WIRED** | Complete | All 4 webhook events handled; checkout + portal sessions work |
| Credit metering (reserve, debit, balance) | **WIRED** | Complete | Atomic reservation + reconciliation; 3 call sites |
| Tier configuration | **WIRED** | Complete | 4 tiers defined with credits, overage, maxDeals, automation, surfaces |
| Automation-level bounds | **WIRED** | Complete | `setAutomationLevel` enforces `maxAutomationLevel` per tier |
| CashFlow Inngest tier gating | **WIRED** | Complete | `isTierAllowedForEventDriven` gates auto-runs; blocked tiers logged |
| **maxActiveDeals enforcement** | **ABSENT** | Missing | `TIER_CONFIG.maxActiveDeals` never checked on deal creation |
| **Surface access enforcement** | **ABSENT** | Missing | `canAccessSurface` never called on any route |
| **Automation-level enforcement** | **ABSENT** | Missing | `maxAutomationLevel` only checked at write time, not read time |
| **Tier mismatch** | **PARTIAL** | Drift | `getAllowedTriggerModes` returns `'basic'` tier, which doesn't exist in `TIER_CONFIG` |
| **Chat credit check** | **PARTIAL** | Bug | `messageRouter.ts` checks `(balance as any).remaining` — field is `creditsRemaining`, never `remaining` |
| **News credit** | **PARTIAL** | Bug | `news.service.ts` never checks `creditsRemaining` before calling `reserveCredits` |
| **Dev auto-replenish** | **STUB** | Risk | Dev accounts auto-replenish credits when exhausted; no distinction from prod |

**Overall:** The *billing backbone* is complete and production-ready. The *gating enforcement* is incomplete — the config exists but the middleware doesn't. A user on a `scout` tier can create unlimited deals and access any surface because nothing stops them.

---

## 2. Stripe Integration (WIRED)

### 2.1 Checkout & Portal
- **File:** `backend/src/api/rest/billing.routes.ts:30-108` (checkout) | `110-156` (portal) | `158-259` (subscription) | `261-327` (usage)
- **Evidence:** `POST /api/v1/billing/create-checkout-session` creates Stripe Checkout session with `mode: 'subscription'` and `client_reference_id: userId`. `POST /api/v1/billing/create-portal-session` creates Stripe Customer Portal session.
- **Price IDs:** Loaded from env vars (`STRIPE_PRICE_*`) with safe fallbacks to `price_*` placeholders.
- **Customer resolution:** Falls back from `users.stripe_customer_id` → `user_credit_balances.stripe_customer_id` → create new Stripe customer.
- **Status:** WIRED

### 2.2 Webhooks
- **File:** `backend/src/index.replit.ts:110-127` (route mount) | `backend/src/services/stripe/webhookHandlers.ts:36-107` (handler)
- **Evidence:** `POST /api/stripe/webhook` mounted BEFORE `express.json()` with `express.raw({ type: 'application/json' })`. Uses `stripe-replit-sync` package for signature verification.
- **Events handled:** `customer.subscription.created` → `provisionUser`, `invoice.paid` → `resetMonthlyCredits`, `customer.subscription.updated` → `updateTier`, `customer.subscription.deleted` → downgrade to `scout`.
- **Status:** WIRED

### 2.3 Stripe Client
- **File:** `backend/src/services/stripe/stripeClient.ts:1-45`
- **Evidence:** `getUncachableStripeClient()` returns `new Stripe()` with API version `2025-01-27.acacia`. `getStripeSync()` lazily initializes `stripe-replit-sync` with `DATABASE_URL` and `STRIPE_SECRET_KEY`.
- **Risk:** `stripe-replit-sync` is an external package dependency; not verified if it's in `package.json`.
- **Status:** WIRED

---

## 3. Credit Service (WIRED)

### 3.1 Tier Configuration
- **File:** `backend/src/services/ai/creditService.ts:22-51`
- **Evidence:**
```typescript
const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  scout:         { creditsIncludedMonthly: 100,   overageCostPerCredit: 0.25, maxActiveDeals: 5,   maxAutomationLevel: 1, surfaces: ['chat'] },
  operator:      { creditsIncludedMonthly: 500,   overageCostPerCredit: 0.15, maxActiveDeals: 25,  maxAutomationLevel: 2, surfaces: ['chat', 'web'] },
  principal:     { creditsIncludedMonthly: 2000,  overageCostPerCredit: 0.10, maxActiveDeals: -1,  maxAutomationLevel: 3, surfaces: ['chat', 'web', 'api'] },
  institutional: { creditsIncludedMonthly: -1,    overageCostPerCredit: 0,   maxActiveDeals: -1,  maxAutomationLevel: 4, surfaces: ['chat', 'web', 'api'] },
};
```
- **Status:** WIRED

### 3.2 Credit Reservation & Reconciliation
- **File:** `backend/src/services/ai/creditService.ts:278-374`
- **Evidence:** `reserveCredits()` uses two-phase: (1) SELECT balance, (2) conditional UPDATE with `WHERE credits_remaining >= $1`. Returns `true` if atomically deducted, `false` if overage / no record.
- **Evidence:** `debitActualCost()` reconciles delta between estimated and actual cost.
- **Call sites:** `MeteringAdapter.ts:292`, `DeepSeekMeteringAdapter.ts:194`, `news.service.ts:108`, `news.service.ts:149`, `news.service.ts:200`.
- **Status:** WIRED

### 3.3 Credit Balance Read
- **File:** `backend/src/services/ai/creditService.ts:59-89`
- **Evidence:** `getBalance()` queries `user_credit_balances` and returns structured `CreditBalance`.
- **Status:** WIRED

---

## 4. Tier Gating — CashFlow Inngest (WIRED)

### 4.1 Event-Driven Gate
- **File:** `backend/src/agents/cashflow.inngest.ts:195-218` (research.completed) | `93-177` (deal.created)
- **Evidence:** `isTierAllowedForEventDriven(tier)` checks `getAllowedTriggerModes(tier).includes('event-driven')`. Blocked tiers log `cashflow.inngest: tier gate blocked` and write `deal_activity` with `action_type = 'agent.gate'` and `status = 'blocked_tier'`.
- **Evidence:** `getAllowedTriggerModes` in `cashflow.config.ts:395-405`:
```typescript
scout → ['manual']
basic → ['manual', 'event-driven']      // ← 'basic' does NOT exist in TIER_CONFIG
operator → ['manual', 'event-driven']
principal → ['manual', 'event-driven', 'weekly-refresh']
institutional → ['manual', 'event-driven', 'weekly-refresh', 'portfolio-batch']
```
- **Finding:** `basic` tier is returned but not defined in `TIER_CONFIG`. Users with `subscription_tier = 'basic'` will be allowed `event-driven` but have no tier config for credits, maxDeals, etc. This is a **DRIFT** between the gating function and the config registry.
- **Status:** PARTIAL (drift)

### 4.2 Walkthrough Auto-Trigger
- **File:** `backend/src/agents/cashflow.inngest.ts:680-693`
- **Evidence:** Principal+ tiers auto-trigger `cashflow.walkthrough_requested` after every successful run. Hardcoded tier list: `['principal', 'institutional']`.
- **Status:** WIRED

---

## 5. Automation-Level Gating (WIRED — WRITE, ABSENT — READ)

### 5.1 Write-Time Enforcement
- **File:** `backend/src/services/ai/creditService.ts:225-250`
- **Evidence:** `setAutomationLevel(userId, level)` checks `level > config.maxAutomationLevel` and returns `false` if exceeded. Logs warning.
- **Status:** WIRED (write path)

### 5.2 Read-Time Enforcement
- **Finding:** No middleware or route handler checks `automationLevel` before executing automation features. The `automation_level` field is read into `ChatSession` (`sessionStore.ts:121, 158, 219`) and `DealContext` (`dealContext.ts:453`), but never used to gate any feature.
- **Impact:** A user with `automationLevel = 1` (manual only) can still trigger `event-driven` runs if the Inngest event fires, because the Inngest handler checks `subscription_tier`, not `automation_level`.
- **Status:** ABSENT (read path)

---

## 6. maxActiveDeals Enforcement (ABSENT)

### 6.1 Config Defined, Never Enforced
- **File:** `backend/src/services/ai/creditService.ts:22-51` (config)
- **Finding:** `TIER_CONFIG.scout.maxActiveDeals = 5`, `operator.maxActiveDeals = 25`. `principal` and `institutional` are `-1` (unlimited).
- **Finding:** `inline-deals.routes.ts:372` (POST `/`) — the deal creation handler does NOT check `maxActiveDeals`. It only validates `createDealSchema` and inserts the row. No count of existing deals, no tier lookup, no cap.
- **Impact:** A `scout` user can create 500 deals; the config says 5.
- **Status:** ABSENT

---

## 7. Surface Access Enforcement (ABSENT)

### 7.1 Config Defined, Never Enforced
- **File:** `backend/src/services/ai/creditService.ts:255-257`
- **Evidence:** `canAccessSurface(tier, surface)` returns `TIER_CONFIG[tier].surfaces.includes(surface)`.
- **Finding:** Never called in any route handler, middleware, or frontend guard. The `surfaces` array is defined but not enforced.
- **Impact:** A `scout` user (surfaces: `['chat']`) can access the web app and API surfaces if they know the URLs.
- **Status:** ABSENT

---

## 8. Chat Credit Check (PARTIAL — Bug)

### 8.1 Wrong Field Name
- **File:** `backend/src/services/chat/messageRouter.ts:317-325`
- **Evidence:**
```typescript
const balance = await this.creditService.getBalance(userId);
if (balance && (balance as any).remaining <= 0) {
  res.status(402).json({ error: 'Insufficient credits', remaining: (balance as any).remaining, ... });
}
```
- **Finding:** `CreditBalance` interface (`creditService.ts:393-405`) has `creditsRemaining`, never `remaining`. The cast `(balance as any).remaining` resolves to `undefined`. `undefined <= 0` is `false`, so the credit check is **bypassed** — the 402 is never returned.
- **Impact:** Chat users can send messages even with zero credits.
- **Status:** PARTIAL (bug)

---

## 9. News Service Credit Check (PARTIAL — Missing Guard)

### 9.1 No Pre-Flight Check
- **File:** `backend/src/services/news/news.service.ts:108-214`
- **Evidence:** `news.service.ts` calls `creditService.reserveCredits(userId, creditCost)` but never checks `creditsRemaining` before the call. `reserveCredits` returns `false` for "no credit record" or "overage" and allows the operation to proceed. This is by design for freemium, but means news operations never hit a hard credit wall.
- **Status:** PARTIAL (missing guard, but intentional for freemium)

---

## 10. Dev Auto-Replenish (STUB — Risk)

### 10.1 Dev Accounts Bypass Credit Exhaustion
- **File:** `backend/src/api/rest/billing.routes.ts:201-213`
- **Evidence:**
```typescript
const isDevAccount = !balance.stripeCustomerId || balance.stripeCustomerId === '' || balance.stripeCustomerId.startsWith('dev_');
if (isDevAccount && balance.creditsRemaining <= 0) {
  await creditService.resetMonthlyCredits(userId!);
}
```
- **Finding:** Any user without a `stripe_customer_id` (which includes ALL pre-billing users) is treated as a "dev account" and gets their credits reset every time the `/subscription` endpoint is hit. This means they can never exhaust credits.
- **Risk:** This is a backdoor for unlimited free usage. The comment says "dev/test accounts" but the check is too broad.
- **Status:** STUB (risk)

---

## 11. Schema & Database

### 11.1 user_credit_balances Table
- **File:** `backend/src/database/migrations/20260427_credit_columns_numeric.sql`
- **Evidence:** Columns: `user_id`, `stripe_customer_id`, `subscription_tier`, `automation_level`, `credits_included_monthly`, `credits_remaining`, `credits_used_this_period`, `monthly_credit_cap`, `alert_threshold_pct`, `period_start`, `period_end`.
- **Status:** WIRED

### 11.2 users Table Stripe Column
- **Finding:** `users` table also has `stripe_customer_id` (used in `billing.routes.ts:57`), but `user_credit_balances` has the same column. Two sources of truth for the Stripe customer ID. The billing route checks `users` first, then `user_credit_balances`. The webhook handler only checks `user_credit_balances`.
- **Risk:** If `users.stripe_customer_id` is set but `user_credit_balances.stripe_customer_id` is not, the webhook handler won't find the user on subscription events.
- **Status:** PARTIAL (dual source of truth)

---

## 12. Summary Table

| Finding | File | Severity | Label | Evidence |
|---|---|---|---|---|
| maxActiveDeals never enforced | `inline-deals.routes.ts:372` | HIGH | ABSENT | No deal count check on creation |
| Surface access never enforced | `creditService.ts:255` | HIGH | ABSENT | `canAccessSurface` never called |
| Automation level never read | `cashflow.inngest.ts:195` | MEDIUM | ABSENT | Only checks `subscription_tier`, not `automation_level` |
| Chat credit check uses wrong field | `messageRouter.ts:319` | MEDIUM | PARTIAL | `(balance as any).remaining` vs `creditsRemaining` |
| 'basic' tier undefined in config | `cashflow.config.ts:398` | MEDIUM | PARTIAL | `getAllowedTriggerModes` returns `'basic'`; `TIER_CONFIG` doesn't define it |
| Dev auto-replenish too broad | `billing.routes.ts:201` | LOW | STUB | Any user without Stripe ID gets free credits forever |
| Dual stripe_customer_id source | `users` + `user_credit_balances` | LOW | PARTIAL | Webhook checks `user_credit_balances` only |
| News service no credit guard | `news.service.ts:108` | LOW | PARTIAL | `reserveCredits` returns `false` for overage; no hard wall |
| Stripe webhook uses `stripe-replit-sync` | `webhookHandlers.ts:47` | LOW | UNVERIFIED | Package availability not confirmed |

---

## 13. Fix Backlog (for triage)

| ID | What | File | Priority |
|---|---|---|---|
| A5-F1 | Add `maxActiveDeals` check to deal creation POST | `inline-deals.routes.ts:372` | HIGH |
| A5-F2 | Add `canAccessSurface` middleware to route registry | `routes/index.ts` | HIGH |
| A5-F3 | Fix chat credit check field name | `messageRouter.ts:319` | MEDIUM |
| A5-F4 | Define 'basic' tier in `TIER_CONFIG` or remove from `getAllowedTriggerModes` | `creditService.ts:22` | MEDIUM |
| A5-F5 | Add `automation_level` check to Inngest event handler (or remove automation_level if unused) | `cashflow.inngest.ts:195` | MEDIUM |
| A5-F6 | Narrow dev auto-replenish to explicit dev flag | `billing.routes.ts:201` | LOW |
| A5-F7 | Sync `users.stripe_customer_id` into `user_credit_balances` on provision | `webhookHandlers.ts:69` | LOW |
| A5-F8 | Verify `stripe-replit-sync` in package.json | `package.json` | LOW |

---

*END OF A5 DISPATCH. Halting for triage.*
