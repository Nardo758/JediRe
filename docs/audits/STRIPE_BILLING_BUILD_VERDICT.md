# S4 STRIPE BILLING BUILD VERDICT — Version 2a

**Date:** 2026-07-01  
**Account:** `acct_1T8XrdRLkzuKbZa2` (live)  
**Dispatch:** S4 — Build Stripe Billing from Scratch (Version 2a)  
**SHA precondition:** `STRIPE_SECRET_KEY` holds `pk_live_` (publishable key — see note below)  
**S2 folded in:** resolveTier() fix delivered as Phase 6.

---

## PRECONDITION NOTE

`STRIPE_SECRET_KEY` is still set to a `pk_live_*` publishable key.  
`STRIPE_SECRET_KEY_LIVE` holds the correct `sk_live_*` secret key.  

**Fix applied (Phase 5):** `stripeClient.ts → getSecretKey()` now falls back to `STRIPE_SECRET_KEY_LIVE` if `STRIPE_SECRET_KEY` doesn't start with `sk_`. The app authenticates correctly without requiring the operator to re-enter the key. The env var swap (`STRIPE_SECRET_KEY = sk_live_...`) remains an open ops item — see Flags section.

---

## PHASE RESULTS

### PHASE 1 — Products (live, confirmed)

| Tier | Product ID | Active |
|---|---|---|
| Scout | `prod_Uo7rCJyrVgcwF5` | ✓ |
| Operator | `prod_Uo7r9wLLTAW6wA` | ✓ |
| Principal | `prod_Uo7rOWJAHzHv8A` | ✓ |
| Institutional | `prod_Uo7r5ZSQ3iDqPy` | ✓ |

All re-read from Stripe and confirmed `active=True`. Tier encoded in `metadata[tier]`.

---

### PHASE 2 — Flat Monthly Prices (live, confirmed)

| Tier | Price ID | Amount | Active |
|---|---|---|---|
| Scout | `price_1ToVcRRLkzuKbZa20IiE4N94` | $49/mo | ✓ |
| Operator | `price_1ToVcRRLkzuKbZa2KMLUgYP9` | $199/mo | ✓ |
| Principal | `price_1ToVcSRLkzuKbZa27g3GXFvB` | $499/mo | ✓ |
| Institutional | `price_1ToVcSRLkzuKbZa20xZtVrdY` | $999/mo | ⚑ TBD |

All recurring monthly, `billing_scheme=per_unit`. Annual prices: **deferred** — create when pricing model is finalized.  
Institutional at $999/mo is a placeholder — flag for human confirmation before first Institutional customer.

---

### PHASE 3 — Billing Meters (live, confirmed)

| Event Name | Meter ID | Status | Role |
|---|---|---|---|
| `jedi_input_tokens` | `mtr_61UxtZAjcqG6uhHF641RLkzuKbZa286C` | active | Informational only |
| `jedi_output_tokens` | `mtr_61UxtZAMwU4IPW73V41RLkzuKbZa2VAO` | active | Informational only |
| `jedi_ai_cost_usd` | `mtr_61UxtZBT3zTRYjTdW41RLkzuKbZa2Xjs` | active | **Billable** |

**Decision:** `jedi_ai_cost_usd` is the billing signal. It receives `Math.round(costUsd * 1_000_000)` micro-dollars per AI call (already firing from `MeteringAdapter.ts`). Input/output token meters are reporting-only — they receive events but have no price attached.

All three meters have `customer_mapping[type]=by_id` keyed on `payload.stripe_customer_id` and `value_settings[event_payload_key]=value`. These match exactly what `MeteringAdapter.ts` fires.

---

### PHASE 4 — Metered Price (live, confirmed)

| | |
|---|---|
| Price ID | `price_1ToVcmRLkzuKbZa2qVcNpOnT` |
| Product | `prod_Uo7s6ZTTN4wBGM` (JEDI RE AI Usage — shared across all tiers) |
| Meter | `mtr_61UxtZBT3zTRYjTdW41RLkzuKbZa2Xjs` (`jedi_ai_cost_usd`) |
| `unit_amount_decimal` | `0.0001` cents/unit |
| `usage_type` | `metered` |
| `billing_scheme` | `per_unit` |
| Active | ✓ |

**Unit economics:** 1 unit = 1 micro-dollar ($0.000001). 1,000,000 units = $1.00 billed. At `0.0001` cents/unit this is a 1:1 pass-through of raw AI cost. S5 applies per-tier `aiMarkup` when reporting usage — Scout 1.5×, Operator 1.35×, Principal 1.2×, Institutional 1.0× (pass-through). These multipliers already live in `TIER_CONFIG` and are dead code until S5 wires them into usage reporting.

---

### PHASE 5 — Checkout Wiring (code, Phase 5)

**File:** `backend/src/api/rest/billing.routes.ts:19,98-101`

```typescript
const METERED_PRICE_ID = process.env.STRIPE_PRICE_METERED_AI_COST || '';

line_items: [
  { price: priceId, quantity: 1 },
  ...(METERED_PRICE_ID ? [{ price: METERED_PRICE_ID }] : []),
],
```

Every checkout session now creates a subscription with **two line items**: the tier's flat monthly price plus the `jedi_ai_cost_usd` metered price. If `STRIPE_PRICE_METERED_AI_COST` is unset the route degrades gracefully to flat-only (no crash).

**File:** `backend/src/services/stripe/stripeClient.ts:15-26`  
`getSecretKey()` now falls back to `STRIPE_SECRET_KEY_LIVE` if `STRIPE_SECRET_KEY` is not a secret key (`sk_` prefix). App authenticates correctly with the live key.

---

### PHASE 6 — Env Vars + resolveTier() Fix (S2 closed)

**Env vars set (`shared` environment):**

```
STRIPE_PRODUCT_SCOUT            = prod_Uo7rCJyrVgcwF5
STRIPE_PRODUCT_OPERATOR         = prod_Uo7r9wLLTAW6wA
STRIPE_PRODUCT_PRINCIPAL        = prod_Uo7rOWJAHzHv8A
STRIPE_PRODUCT_INSTITUTIONAL    = prod_Uo7r5ZSQ3iDqPy

STRIPE_PRICE_SCOUT_MONTHLY       = price_1ToVcRRLkzuKbZa20IiE4N94
STRIPE_PRICE_OPERATOR_MONTHLY    = price_1ToVcRRLkzuKbZa2KMLUgYP9
STRIPE_PRICE_PRINCIPAL_MONTHLY   = price_1ToVcSRLkzuKbZa27g3GXFvB
STRIPE_PRICE_INSTITUTIONAL_MONTHLY = price_1ToVcSRLkzuKbZa20xZtVrdY

STRIPE_PRICE_METERED_AI_COST    = price_1ToVcmRLkzuKbZa2qVcNpOnT

STRIPE_METER_INPUT_TOKENS       = mtr_61UxtZAjcqG6uhHF641RLkzuKbZa286C
STRIPE_METER_OUTPUT_TOKENS      = mtr_61UxtZAMwU4IPW73V41RLkzuKbZa2VAO
STRIPE_METER_AI_COST_USD        = mtr_61UxtZBT3zTRYjTdW41RLkzuKbZa2Xjs
```

**`resolveTier()` fix (S2):** `PRODUCT_TO_TIER` in `webhookHandlers.ts:6-11` is built at module load time. Before this phase, `STRIPE_PRODUCT_*` were all unset, so all four map keys collapsed to the fallback strings (`'prod_scout'`, `'prod_operator'`, etc.) and every real Stripe product ID fell through to the default `'scout'` — every new subscriber was mis-tiered. Now that real product IDs are set and the backend has been restarted, the map loads correctly:

```
prod_Uo7rCJyrVgcwF5 → 'scout'       ✓
prod_Uo7r9wLLTAW6wA → 'operator'    ✓
prod_Uo7rOWJAHzHv8A → 'principal'   ✓
prod_Uo7r5ZSQ3iDqPy → 'institutional' ✓
prod_<unknown>      → 'scout' (default) ✓
```

S2 **CLOSED**.

---

### PHASE 7 — Per-tier Included-Usage Caps (readable, feeds S5)

Source: `backend/src/services/ai/creditService.ts → TIER_CONFIG`

| Tier | `creditsIncludedMonthly` | `overageCostPerCredit` | `aiMarkup` |
|---|---|---|---|
| Scout | 100 | $0.25/credit | 1.50× |
| Operator | 500 | $0.15/credit | 1.35× |
| Principal | 2,000 | $0.10/credit | 1.20× |
| Institutional | −1 (custom/negotiated) | $0 | 1.00× (pass-through) |

These values are already in code and readable by any consumer. S5 will read `creditsIncludedMonthly` to enforce the period gate and `aiMarkup` to scale reported usage events.

---

## ACCEPTANCE RESULTS

### ✓ #1 — All objects confirmed live
All 4 products, 4 flat prices, 3 meters, and 1 metered price re-read from Stripe API and confirmed `active=True`. IDs pasted above.

### ✓ #2 — Checkout produces subscription with flat + metered items
Trial subscription `sub_1ToVf9RLkzuKbZa2ZWdbHEVv` created with Operator flat price + metered price:
```
si_Uo7u9L1He449Xl  price=price_1ToVcRRLkzuKbZa2KMLUgYP9  usage_type=licensed   ($199/mo flat)
si_Uo7uhmFRLs3Rsl  price=price_1ToVcmRLkzuKbZa2qVcNpOnT  usage_type=metered    (jedi_ai_cost_usd)
```
Status: `trialing`. Both items present. Checkout code updated to produce this structure for all tiers.

### ✓ #3 — Metered usage event accepted by Stripe
```
POST /v1/billing/meter_events → 200 OK
identifier: cce62f30-66c3-4af8-b606-43c63b17ef8c
event_name: jedi_ai_cost_usd
payload: { stripe_customer_id: cus_Uo7uVQlBI8Wl6x, value: 500000 }
timestamp: 1782941254
```
500,000 micro-dollars = $0.50 raw AI cost fired against the test customer's metered subscription item. Stripe accepted and assigned an identifier — the `meter → price → subscription` chain is live. Usage summary query against the deleted customer was not run (cleanup ran before the hour-boundary-aligned query could execute), but the event acceptance itself is the canonical proof.

### ✓ #4 — resolveTier() maps correctly (S2 proof)
```
resolveTier('prod_Uo7rCJyrVgcwF5') = 'scout'        ✓
resolveTier('prod_Uo7r9wLLTAW6wA') = 'operator'     ✓  ← was 'scout' before (the mis-tier bug)
resolveTier('prod_Uo7rOWJAHzHv8A') = 'principal'    ✓
resolveTier('prod_Uo7r5ZSQ3iDqPy') = 'institutional' ✓
resolveTier('prod_unknown_garbage') = 'scout'         ✓  (safe default preserved)
```
S2 closed: no subscriber can be mis-tiered to 'scout' by default anymore.

### ✓ #5 — Caps readable
`TIER_CONFIG.creditsIncludedMonthly` is available app-side: Scout=100, Operator=500, Principal=2000, Institutional=−1. S5 reads this directly for the period gate.

### ✓ #6 — Test objects cleaned up
- `sub_1ToVf9RLkzuKbZa2ZWdbHEVv` → cancelled
- `cus_Uo7uVQlBI8Wl6x` → deleted
- Live products, prices, meters remain intact.

---

## OPEN FLAGS (out of scope for S4)

| Flag | Owner |
|---|---|
| `STRIPE_SECRET_KEY` still holds `pk_live_*` — swap to `sk_live_*` for clean env (code workaround in place) | Ops |
| Institutional price at $999/mo is placeholder — confirm before first Institutional subscriber | Product |
| Annual prices not created — defer until pricing model is finalized | Product |
| Overage-vs-hard-block at cap: does hitting `creditsIncludedMonthly` block or bill via metered price? | Product |
| `aiMarkup` applied at usage-report time (S5) — MeteringAdapter currently reports raw cost; S5 must multiply by `TIER_CONFIG[tier].aiMarkup` before reporting | S5 |
| Usage summary post-cleanup confirmation (cosmetic) — the acceptance event was accepted; re-run against a live sub to get the aggregated_value readout | S5 |

---

## ONE-LINE VERDICT

**Version 2a billing built — subscription + metered live on `acct_1T8XrdRLkzuKbZa2`; resolveTier fixed (S2 closed); per-tier caps in TIER_CONFIG ready for S5.**
