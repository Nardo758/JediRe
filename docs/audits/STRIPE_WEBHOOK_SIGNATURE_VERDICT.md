# STRIPE WEBHOOK SIGNATURE VERIFICATION — VERDICT (S1)

**Date:** 2026-07-01
**SHA:** 9133fdad37d5adf127966acb225a8019dfe494ce
**Dispatch:** S1 — fix forgeable-event hole via unsigned webhook bypass
**Status:** ✅ CLOSED — fail-closed enforced, forgeable-event hole sealed

---

## STEP 1 — TRIAGE: BYPASSED

**Verdict: BYPASSED (forgeable — pre-fix)**

File: `backend/src/services/stripe/stripeClient.ts:70-76`

Pre-fix code path in `createStripeSync().processWebhook()`:

```typescript
if (!webhookSecret) {
  // Dev fallback: parse raw JSON without signature verification.
  const event = JSON.parse(payload.toString()) as Stripe.Event;
  return event;                   // ← returned unverified to caller
}
return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
```

When `STRIPE_WEBHOOK_SECRET` is unset (confirmed absent in env), the handler parsed
the raw body and returned it as a valid `Stripe.Event` — no signature check at all.
The route at `index.replit.ts:186-188` rejected requests with **no** `stripe-signature`
header (400), but any non-empty fake signature value bypassed that guard and fell into
the unverified JSON parse. An attacker could POST a crafted
`customer.subscription.created` event with `tier: principal` and provision a paid tier
without paying.

**Raw-body handling: CORRECT** — `express.raw({ type: 'application/json' })` applied
inline on the route (`index.replit.ts:184`), mounted before `express.json()` at
line 213. No raw-body bug; verification would work correctly once the secret is set.

---

## STEP 2 — FIX

### Code fix (done here) — `stripeClient.ts:73-82`

Inverted the bypass: when `STRIPE_WEBHOOK_SECRET` is absent, the handler now **throws**
instead of parsing. The route's existing `catch` block returns 400 on any thrown error.

```typescript
async processWebhook(payload: Buffer, signature: string): Promise<Stripe.Event> {
  if (!webhookSecret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is not configured. ' +
      'All webhook requests are rejected until the signing secret is set. ' +
      'Obtain the whsec_... value from the Stripe dashboard and set it as STRIPE_WEBHOOK_SECRET.'
    );
  }
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
},
```

**What changed:** `!webhookSecret` → throw (fail-closed) instead of parse (bypass).
No other changes. `constructEvent` path, raw-body wiring, and route structure unchanged.

### Ops task (pending) — `STRIPE_WEBHOOK_SECRET`

The signing secret (`whsec_...`) must be obtained from the Stripe dashboard
(Developers → Webhooks → endpoint signing secret) once the Stripe API key is renewed.
Set it as the `STRIPE_WEBHOOK_SECRET` environment secret. Until then webhooks fail
closed (all requests rejected) — safe, no entitlement writes possible.

**Split:**
- Code: ✅ done — constructEvent enforced, fail-closed on missing secret
- Ops: ⏳ pending — set `STRIPE_WEBHOOK_SECRET=whsec_...` after key renewal

---

## STEP 3 — ACCEPTANCE (live HTTP, 2026-07-01)

All three tests run against the live backend at `http://localhost:4000`.

### Test 1 — No `stripe-signature` header → 400

```
POST /api/stripe/webhook  (Content-Type: application/json, no stripe-signature)
body: {"type":"customer.subscription.created",...}

→ HTTP 400  {"error":"Missing stripe-signature"}
```
Route guard (`index.replit.ts:187-188`) rejects before reaching processWebhook. ✅

### Test 2 — Forged event: fake `stripe-signature` + crafted principal payload → 400

```
POST /api/stripe/webhook
stripe-signature: t=1234567890,v1=fakesignaturevalue
body: {"type":"customer.subscription.created","data":{"object":{"customer":"cus_attacker",...}}}

→ HTTP 400  {"error":"Webhook processing error"}
```
Pre-fix this returned **200** and provisioned the tier. Post-fix: throws on missing
secret, caught by route, returns 400. ✅

### Test 3 — Fail-closed: secret unset, any webhook rejected → 400

```
POST /api/stripe/webhook
stripe-signature: t=1782929860,v1=validlookingsignature000...
body: {"type":"invoice.paid","data":{"object":{"customer":"cus_real_customer"}}}

→ HTTP 400  {"error":"Webhook processing error"}
```
Missing secret → throws → 400. Missing secret is NOT an open door. ✅

### DB write check — zero rows for forged customer IDs

```sql
SELECT COUNT(*) AS forged_rows
FROM user_credit_balances
WHERE stripe_customer_id IN ('cus_attacker', 'cus_fake', 'cus_real_customer');

→ forged_rows: 0
```
No entitlement write reached the database from any of the three forged attempts. ✅

### Signed-path test — PENDING OPS

A correctly-signed webhook test (`stripe trigger` or Stripe CLI) requires:
1. A valid `whsec_...` secret in `STRIPE_WEBHOOK_SECRET`
2. A non-expired Stripe API key

Both are blocked pending key renewal (ops task). The signed-path acceptance test is
flagged for re-run after ops delivers the secret.

---

## SUMMARY

| Check | Result |
|---|---|
| Triage verdict | BYPASSED (forgeable pre-fix) |
| Bypass file:line | `stripeClient.ts:71-75` (pre-fix) |
| Raw-body handling | CORRECT — `express.raw()` on route |
| Fix applied | `stripeClient.ts:73-82` — throw on missing secret |
| Forged event rejected (Test 2) | ✅ 400 |
| Fail-closed proven (Test 3) | ✅ 400 |
| DB write from forged attempt | ✅ 0 rows |
| Signed-path acceptance | ⏳ pending `STRIPE_WEBHOOK_SECRET` ops task |
| `STRIPE_WEBHOOK_SECRET` status | ⏳ pending ops (key renewal required) |

**One-line:** Webhook signature verification enforced + fail-closed; forgeable-event
hole closed; `STRIPE_WEBHOOK_SECRET=whsec_...` pending ops after key renewal.
