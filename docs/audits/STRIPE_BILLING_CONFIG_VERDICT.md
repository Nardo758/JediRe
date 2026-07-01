# STRIPE BILLING CONFIGURATION TRACE — Verdict

**Date:** 2026-07-01  
**Repo SHA:** `205a0d7af966142284c5c95b680efb97e258fc78`  
**Dispatch:** STRIPE_BILLING_CONFIG_TRACE (read-only)  
**Auditor:** Agent (automated)

---

## Access Path Used

**Code-trace-only. Live Stripe confirmation PENDING.**

The `STRIPE_SECRET_KEY` in the environment is a `sk_live_` key that has **expired** (`api_key_expired`). Every Stripe API call — meters list, prices list, customers list — returned:

```json
{"error":{"message":"Expired API Key provided: sk_live_***...Nl9HTC","type":"api_error","code":"api_key_expired"}}
```

All findings below are from: (1) env var presence/prefix inspection, (2) full code read of `billing.routes.ts`, `creditService.ts`, `webhookHandlers.ts`, `MeteringAdapter.ts`, `DeepSeekMeteringAdapter.ts`. Every "exists in Stripe" claim is **inferred from code references**, not confirmed from live Stripe objects. A refreshed key is required for live confirmation.

---

## 1. Meters

**Code fires three meter event names:**

| Event name | Where fired | Files |
|---|---|---|
| `jedi_input_tokens` | per Sonnet call | `MeteringAdapter.ts:377`, `DeepSeekMeteringAdapter.ts:388` |
| `jedi_output_tokens` | per Sonnet call | `MeteringAdapter.ts:385`, `DeepSeekMeteringAdapter.ts:395` |
| `jedi_ai_cost_usd` | per Sonnet call (micro-dollars) | `MeteringAdapter.ts:423`, `DeepSeekMeteringAdapter.ts:430` |

**Meter objects in Stripe:** UNKNOWN — live query failed (expired key).

**Meter → Price link:** No meter ID is referenced anywhere in code or env. There is no env var like `STRIPE_METER_INPUT_TOKENS` and no code that reads a meter ID and attaches it to a price. Whether the three event names correspond to existing Stripe meter objects with active prices attached **cannot be confirmed from code alone**.

**Live confirmation required:** Renew key → `GET /v1/billing/meters` → for each meter, confirm `status=active` and check if any price references that meter's `id`.

---

## 2. Prices + Products

### Env vars set

| Env var | Value (partial) | Set? |
|---|---|---|
| `STRIPE_PRICE_SCOUT_MONTHLY` | `price_1TPB0HLfOO4b6D…` | ✅ |
| `STRIPE_PRICE_OPERATOR_MONTHLY` | `price_1TPB0HLfOO4b6D…` | ✅ (same prefix as scout — possible copy-paste) |
| `STRIPE_PRICE_PRINCIPAL_MONTHLY` | `price_1TPB0ILfOO4b6D…` | ✅ |
| `STRIPE_PRICE_INSTITUTIONAL_MONTHLY` | — | ❌ NOT SET |
| `STRIPE_PRICE_SCOUT_ANNUAL` | — | ❌ NOT SET |
| `STRIPE_PRICE_OPERATOR_ANNUAL` | — | ❌ NOT SET |
| `STRIPE_PRICE_PRINCIPAL_ANNUAL` | — | ❌ NOT SET |
| `STRIPE_PRODUCT_SCOUT` | — | ❌ NOT SET |
| `STRIPE_PRODUCT_OPERATOR` | — | ❌ NOT SET |
| `STRIPE_PRODUCT_PRINCIPAL` | — | ❌ NOT SET |
| `STRIPE_PRODUCT_INSTITUTIONAL` | — | ❌ NOT SET |
| `STRIPE_WEBHOOK_SECRET` | — | ❌ NOT SET |

### How prices are used (`billing.routes.ts:13–30`, `billing.routes.ts:88–101`)

```typescript
const sessionParams = {
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],  // flat price only
  ...
};
const session = await stripe.checkout.sessions.create(sessionParams);
```

Checkout creates a **flat subscription** with one line item: the tier's monthly price. No metered price item is added, ever.

### Metered prices

**Zero metered price IDs exist anywhere in code or env.** There is no:
- `STRIPE_PRICE_METERED_*` env var
- Any `price_` constant annotated as `usage_type: 'metered'`
- Any code that calls `stripe.prices.create({ recurring: { usage_type: 'metered', meter: '...' } })`
- Any checkout session that adds a metered `line_item` alongside the flat subscription price

**THE DECISIVE FINDING: No metered price exists (by code evidence).** Meter events fire but have no billable price linked to them. Usage accumulates in Stripe meters but nothing converts it to a charge.

---

## 3. Subscriptions

Live Stripe subscription retrieval impossible (expired key).

**What the code creates:** Every `POST /api/v1/billing/create-checkout-session` produces a Stripe Checkout session in `mode: 'subscription'` with exactly one `line_item`: the flat monthly price for the chosen tier. The resulting subscription contains one item — the flat recurring price — and zero metered items.

**Inferred subscription structure for any existing subscriber:** flat recurring price only. No metered price item. No usage billing.

---

## 4. Tier → Stripe Mapping

### App-side: `TIER_CONFIG` (`creditService.ts:26–84`)

| Tier | Credits/month | Overage $/credit | Monthly fee | Markup |
|---|---|---|---|---|
| scout / basic | 100 | $0.25 | $49 | 1.50× |
| operator | 500 | $0.15 | $97 | 1.35× |
| principal | 2,000 | $0.10 | $197 | 1.20× |
| institutional | custom | $0 | custom | 1.00× (pass-through) |

`overageCostPerCredit` and `aiMarkup` / `calculateBillable()` (`creditService.ts:102–106`) are **defined but never called** from `MeteringAdapter` or any skill-chat path. The markup is app-side dead code in the current billing flow.

### Webhook → tier resolution (`webhookHandlers.ts:6–14`)

```typescript
const PRODUCT_TO_TIER: Record<string, SubscriptionTier> = {
  [process.env.STRIPE_PRODUCT_SCOUT || 'prod_scout']: 'scout',
  [process.env.STRIPE_PRODUCT_OPERATOR || 'prod_operator']: 'operator',
  ...
};
```

All four `STRIPE_PRODUCT_*` env vars are unset. The map keys become the literal strings `'prod_scout'`, `'prod_operator'`, `'prod_principal'`, `'prod_institutional'`. Any real Stripe product ID arriving in a webhook (`prod_1TPB…`) will not match any key → `resolveTier()` returns `'scout'` for every subscription event. **Webhook tier resolution is broken for all tiers above scout.**

### Per-tier included-usage in Stripe

Not encoded in Stripe. The `creditsIncludedMonthly` values live only in app-side `TIER_CONFIG`. No Stripe product metadata, metered price tiers, or subscription item quantities encode these allowances on the Stripe side. The app-side credit ledger (`user_credit_balances`) is the only place the included allowance exists.

---

## 5. Customer + Payment Method

Live customer query impossible (expired key).

**Code path:** On checkout, `billing.routes.ts:77–86` creates a Stripe customer if none exists, stores the `stripe_customer_id` in `users.stripe_customer_id`. The `invoice.paid` webhook calls `creditService.resetMonthlyCredits()`, which resets `credits_remaining` to the tier's monthly allowance.

However, `STRIPE_WEBHOOK_SECRET` is **not set**. The webhook handler at `services/stripe/stripeClient.ts:89–92` registers for four events, but with no webhook secret the Stripe signature verification step will fail or be bypassed. **Webhook delivery to the app cannot be confirmed as functional in the current env config.**

---

## Gap List — What Version 2a Needs That Isn't There

| # | Gap | Type | Evidence |
|---|---|---|---|
| G1 | Stripe API key expired | **Blocking — live confirmation impossible** | `api_key_expired` on every API call |
| G2 | No metered price exists (linked to any meter) | **Billing architecture gap** | Zero metered price IDs in code or env; checkout adds flat price only |
| G3 | No metered price item in subscriptions | **Billing architecture gap** | `line_items` is single flat price; no code path adds a metered item |
| G4 | Stripe meters not confirmed (cannot list) | **Blocked by G1** | Cannot confirm `jedi_input_tokens` etc. are registered Stripe meter objects |
| G5 | `STRIPE_PRODUCT_*` env vars unset → tier resolution broken | **Config gap** | All four vars missing; every webhook maps to 'scout' |
| G6 | `STRIPE_WEBHOOK_SECRET` not set → webhook signature unverified | **Config / security gap** | Var absent from env |
| G7 | Annual price IDs not configured | **Config gap (partial)** | Only monthly prices for 3 tiers |
| G8 | Institutional monthly price not configured | **Config gap** | `STRIPE_PRICE_INSTITUTIONAL_MONTHLY` unset |
| G9 | `calculateBillable()` / markup logic defined but never invoked | **App-side dead code** | `creditService.ts:102–106`; MeteringAdapter logs raw `cost_usd`, not billable |
| G10 | Per-tier included-usage cap not in Stripe (app-side only) | **Architecture gap** | Stripe has no knowledge of 100/500/2000 credit tiers |

---

## One-Line Verdict

**SUBSCRIPTION-ONLY (flat fee, no usage billing at all) — based on code evidence.**

Three flat monthly prices exist for scout/operator/principal. Meter events fire to three event names. No metered price is linked to any meter. No metered item is added to any subscription. Usage reports to Stripe meters; nothing converts that usage to a charge. **This is the same "report to a ledger nothing reads" pattern as the credits_remaining disconnect** — the billing chain has two open ends: (1) meter events → no billable price, and (2) skill-chat spend → no credits_remaining debit.

---

## Sequenced Next Steps (from gap list, each needs approval)

| Step | What | Depends on |
|---|---|---|
| S0 | Renew Stripe API key; re-run this trace live to confirm meters/prices/subscriptions | — |
| S1 | Create Stripe meters for `jedi_input_tokens`, `jedi_output_tokens`, `jedi_ai_cost_usd` (if not already) | S0 |
| S2 | Create metered prices for each meter, one per tier (or a shared price with per-tier caps) | S1 |
| S3 | Update checkout to attach the metered price item alongside the flat subscription price | S2 |
| S4 | Set `STRIPE_PRODUCT_*` env vars so webhook tier resolution works | S0 |
| S5 | Set `STRIPE_WEBHOOK_SECRET` | — |
| S6 | Decide: app-side period-usage gate (credits_remaining decrement) or gate-on-Stripe-entitlement | S2, S3 — this is the billing-architecture human call from the Ledger Loop verdict |

**Stop here. This trace establishes the gap list. Each step above is a separate approved dispatch.**
