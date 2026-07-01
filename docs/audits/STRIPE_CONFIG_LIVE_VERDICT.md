# STRIPE CONFIG LIVE TRACE — VERDICT (S3)

**Date:** 2026-07-01
**SHA:** 42435e68a93d36cc01071429fcb4b81f4e40b1ae
**Dispatch:** S3 — live Stripe config re-trace (read-only)
**Mode:** READ-ONLY — no Stripe objects created or modified
**Status:** ✅ COMPLETE — live ground truth established

---

## ACCESS CONFIRMED

```
GET https://api.stripe.com/v1/account
→ 200 OK
  account_id:    acct_1T8XrdRLkzuKbZa2
  business_name: JediRe
  email:         m.dixon5030@gmail.com
  country:       US
```

Key used: `sk_live_51T8XrdRLkzu...` — confirmed live, non-expired. Proceeding.

---

## 1 — METERS

```
GET /v1/billing/meters?limit=20
→ 0 meters found
```

`jedi_input_tokens`, `jedi_output_tokens`, `jedi_ai_cost_usd` — **none registered**.
The code in `MeteringAdapter.reportStripeUsage()` fires these event names, but there
are no meter objects to receive them. Usage events are being silently dropped.

**Gap:** 3 meters must be created (S4).

---

## 2 — PRICES

```
GET /v1/prices?limit=100
→ 0 prices found (total, across all types)
```

**Flat recurring prices:** 0 exist.
**Metered/usage prices:** 0 exist — definitively absent (live-confirmed, not inferred).

### Env price IDs — WRONG ACCOUNT (critical finding)

The 3 price IDs in environment variables resolve against a **different Stripe account**:

| Env var | Value | Live result |
|---|---|---|
| `STRIPE_PRICE_SCOUT_MONTHLY` | `price_1TPB0HLfOO4b6Db2rObDXE7y` | `No such price` |
| `STRIPE_PRICE_OPERATOR_MONTHLY` | `price_1TPB0HLfOO4b6Db2ZR6KOS9K` | `No such price` |
| `STRIPE_PRICE_PRINCIPAL_MONTHLY` | `price_1TPB0ILfOO4b6Db2xIGkiYmC` | `No such price` |

Account mismatch proof — Stripe embeds the account ID in every object ID:
- Price IDs contain account infix: **`LfOO4b6Db2`** (old/different account)
- Current live account infix: **`RLkzuKbZa2`** (`acct_1T8XrdRLkzuKbZa2`)

These prices were created on a previous Stripe account (likely the one tied to the
expired key). They do not exist on the current account and can never resolve.

**Gap:** All 3 flat-tier price IDs must be created fresh on `acct_1T8XrdRLkzuKbZa2`
and env vars updated. Metered prices also needed (S4).

---

## 3 — PRODUCTS

```
GET /v1/products?limit=20&active=true
→ 0 active products
```

No products exist on this account. Scout, Operator, Principal, Institutional — all absent.

**S2 input status: BLOCKED.** S2 needs real product IDs to fix `resolveTier()`. Those
IDs do not exist yet — they cannot be handed to S2 until S4 creates the products first.

**Reordering implication:** S4 must create products+prices *before* S2 can set
`STRIPE_PRODUCT_*` and fix tier resolution. S2 is downstream of S4's product-creation
phase, not parallel to it.

---

## 4 — SUBSCRIPTIONS

```
GET /v1/customers?limit=20&expand[]=data.subscriptions
→ 0 customers
→ 0 subscriptions
```

No customers, no subscription items, no one on a flat price, no one on a metered price.
The account is entirely empty — no billing history of any kind.

---

## 5 — CUSTOMER + PAYMENT METHOD

0 customers → N/A. No payment methods on file for anyone.

---

## 6 — WEBHOOK ENDPOINT (S1 FOLLOW-THROUGH)

```
GET /v1/webhook_endpoints/we_1ToVORRLkzuKbZa29izWH4GT
→ 200 OK
  id:     we_1ToVORRLkzuKbZa29izWH4GT
  url:    https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/stripe/webhook
  status: enabled
  enabled_events: [
    customer.subscription.created,
    customer.subscription.updated,
    customer.subscription.deleted,
    invoice.paid,
    invoice.payment_failed
  ]
```

S1 webhook is registered, enabled, and subscribed to the correct billing events. ✅

**Note for production:** when you deploy, a second endpoint must be created pointing at
the production URL (e.g. `jedi-re.replit.app/api/stripe/webhook`) with a separate
`whsec_` secret stored in the production environment.

---

## LIVE VERDICT: BLANK SLATE

**Not SUBSCRIPTION-ONLY. Not HALF-BUILT. BLANK SLATE.**

The current Stripe account (`acct_1T8XrdRLkzuKbZa2`) has:
- 0 products
- 0 prices (flat or metered)
- 0 billing meters
- 0 customers
- 0 subscriptions
- 1 webhook endpoint (created in S1)

All env price IDs point at a dead account. The previous inference-based verdict of
"SUBSCRIPTION-ONLY" was wrong — that was the old account. The new account is empty.

---

## RESOLVED GAP LIST FOR S4 (confirmed, not inferred)

Everything must be created from scratch on `acct_1T8XrdRLkzuKbZa2`:

### Phase A — Products + flat prices (unblocks S2)
| Object | Action |
|---|---|
| Product: JEDI RE Scout | CREATE → capture `prod_...` ID |
| Product: JEDI RE Operator | CREATE → capture `prod_...` ID |
| Product: JEDI RE Principal | CREATE → capture `prod_...` ID |
| Product: JEDI RE Institutional | CREATE → capture `prod_...` ID |
| Price: Scout monthly flat | CREATE → update `STRIPE_PRICE_SCOUT_MONTHLY` |
| Price: Operator monthly flat | CREATE → update `STRIPE_PRICE_OPERATOR_MONTHLY` |
| Price: Principal monthly flat | CREATE → update `STRIPE_PRICE_PRINCIPAL_MONTHLY` |

### Phase B — Meters + metered prices (enables usage billing)
| Object | Action |
|---|---|
| Meter: `jedi_input_tokens` | CREATE → capture meter ID |
| Meter: `jedi_output_tokens` | CREATE → capture meter ID |
| Meter: `jedi_ai_cost_usd` | CREATE → capture meter ID |
| Metered price per meter | CREATE × 3, linked to meters + products |

### Phase C — Env var updates
| Env var | Action |
|---|---|
| `STRIPE_PRICE_SCOUT_MONTHLY` | UPDATE to new price ID |
| `STRIPE_PRICE_OPERATOR_MONTHLY` | UPDATE to new price ID |
| `STRIPE_PRICE_PRINCIPAL_MONTHLY` | UPDATE to new price ID |
| `STRIPE_PRODUCT_SCOUT` | CREATE (was unset) |
| `STRIPE_PRODUCT_OPERATOR` | CREATE (was unset) |
| `STRIPE_PRODUCT_PRINCIPAL` | CREATE (was unset) |
| `STRIPE_SECRET_KEY` | UPDATE from `pk_live_...` → `sk_live_...` |

### Phase D — Production webhook
| Object | Action |
|---|---|
| Webhook endpoint: prod URL | CREATE when app is deployed |
| `STRIPE_WEBHOOK_SECRET` (prod) | SET in production environment |

---

## SUMMARY TABLE

| Item | Live Finding |
|---|---|
| API access | ✅ 200 OK — `acct_1T8XrdRLkzuKbZa2` |
| Billing meters | ❌ 0 — none registered |
| Flat tier prices | ❌ 0 — none on this account |
| Metered prices | ❌ 0 — definitively absent (live-confirmed) |
| Products | ❌ 0 — none on this account |
| Env price IDs | ❌ Wrong account — `LfOO4b6Db2` ≠ `RLkzuKbZa2` |
| Customers | ❌ 0 |
| Subscriptions | ❌ 0 |
| Payment methods | ❌ N/A (no customers) |
| Webhook endpoint | ✅ `we_1ToVOR...` enabled, correct events |
| S2 product IDs ready | ❌ BLOCKED — products must be created by S4 first |

**S4 scope vs inference:** The inference-based trace guessed SUBSCRIPTION-ONLY (flat
prices exist, no metered). Live reality is BLANK SLATE — S4 is larger than inferred.
All Stripe objects must be created, not just the metered layer on top of existing flat prices.

**One-line:** Blank-slate Stripe account confirmed live — 0 products, 0 prices, 0 meters,
0 customers; env price IDs are dead (wrong account); S4 must build everything from scratch;
S2 is downstream of S4's product-creation phase.
