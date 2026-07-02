# DISPATCH — S3: LIVE STRIPE CONFIG RE-TRACE (READ-ONLY)

**Why:** the original config trace ran against an expired key → all findings were CODE-INFERENCE, not
confirmed. The working `sk_live_` key is now in place. Re-run against LIVE Stripe to establish ground
truth before building metered billing (S4) or fixing tier mapping (S2). This trace's output HANDS S2
its inputs (real product IDs) and confirms the S4 gap list against reality.
**Mode:** READ-ONLY. Query live Stripe, report actual state, STOP. Configure nothing.
**Precondition:** confirm the app's Stripe API calls now authenticate. Make one live call
(`GET /v1/account` or list prices) → if it returns 200 (not `api_key_expired`), proceed. If it still
fails, STOP — the `STRIPE_SECRET_KEY` swap didn't take; report that.
**Repo + Stripe:** `Nardo758/JediRe.git` @ HEAD (record SHA) + live Stripe (via MCP connector or API).
**Evidence rule (S1-01):** every claim carries the actual Stripe API object returned — this is the
LIVE confirmation the inference-based trace couldn't give.
**Report to:** `docs/audits/STRIPE_CONFIG_LIVE_VERDICT.md`

---

## CONFIRM ACCESS FIRST

```
# one live call to prove the key works
GET https://api.stripe.com/v1/account   (or GET /v1/prices?limit=1)
```
200 → proceed. `api_key_expired` / 401 → STOP, the secret swap isn't live, report it. Do not
fall back to code-inference this time — the whole point is live confirmation.

---

## THE LIVE TRACE — confirm or correct every inference

**1. METERS — do the 3 event names have registered meters?**
   List Stripe billing meters. For `jedi_input_tokens`, `jedi_output_tokens`, `jedi_ai_cost_usd`:
   does each exist as a registered meter object? ACTIVE? The code fires these events — but do the
   METERS exist to receive them, and is anything billing against them? Paste the meter objects (or
   confirm absent).

**2. PRICES — the decisive question, now answerable live.**
   List all prices + products. Classify:
   - **Recurring flat (the tier fees):** confirm the 3 env price IDs (SCOUT/OPERATOR/PRINCIPAL
     monthly) resolve to real active prices. Note: the trace flagged SCOUT and OPERATOR env values
     share a prefix — CONFIRM they're actually distinct prices (or a copy-paste bug). Paste each.
   - **Metered (usage):** does ANY metered/usage-type price exist? This is the load-bearing answer
     the expired key couldn't give. Paste it if it exists, or confirm definitively absent.
   - Institutional monthly, annual prices — exist in Stripe even if not in env? (The env was missing
     them; Stripe may have them.)

**3. PRODUCTS — the S2 inputs.**
   List products. Map each to its tier (scout/operator/principal/institutional). **Capture the real
   product IDs** — these are exactly what S2 needs to set `STRIPE_PRODUCT_*` so `resolveTier()` stops
   defaulting to scout. Paste product ID → tier mapping. This is S2's input, confirmed live.

**4. SUBSCRIPTIONS — what the real customer actually has.**
   Retrieve the real customer's subscription(s) (Leon / org dd201183, and any others). Show
   subscription_items: flat price only, or flat + metered? Is anyone currently on a metered price?
   Paste. This confirms whether usage billing is live for ANY customer.

**5. CUSTOMER + PAYMENT METHOD.**
   Real customer: default payment method on file? (Required for any usage billing to charge.) Paste.

**6. WEBHOOK ENDPOINT (S1 follow-through).**
   Confirm the webhook endpoint created in S1 (`we_1ToVOR...`) is registered, points at the right
   URL, and is subscribed to the needed events (`customer.subscription.*`, `invoice.*`). Paste the
   endpoint's enabled_events. (A webhook that verifies signatures but isn't subscribed to the right
   events is silently incomplete.)

---

## DELIVERABLE — live ground truth + the resolved gap list

- SHA + access-confirmed (the 200 proof)
- Meters: exist live? active? billing-linked?
- Prices: flat tiers confirmed (+ the SCOUT/OPERATOR duplicate-prefix resolved); metered price
  EXISTS or DEFINITIVELY ABSENT (live-confirmed, not inferred)
- **Products → tier map with real product IDs** (S2's inputs, ready to use)
- Subscriptions: what the real customer has; anyone on metered?
- Payment method on file?
- Webhook endpoint: registered + subscribed to the right events?
- **THE LIVE VERDICT:** ALREADY-TRUE (metered price exists, attached, card on file) / HALF-BUILT
  (meters or prices partial) / SUBSCRIPTION-ONLY (flat only, confirmed live) — this REPLACES the
  inference-based verdict
- **Resolved gap list for S4:** exactly what Stripe objects must be created vs already exist, now
  that it's confirmed not guessed
- One-line: live Stripe state, and whether the S4 metered-billing build is as large as inferred or
  smaller (some pieces may already exist)

**STOP at the report. This is confirmation, not construction. Its outputs feed S2 (product IDs) and
S4 (confirmed gap list). Each of those is a separate approved dispatch.**

---

## OUT OF SCOPE

- S2 tier-mapping fix (this HANDS it the product IDs; the fix is next).
- S4 metered billing build (this CONFIRMS its gap list; the build follows).
- Configuring/creating any Stripe object.
