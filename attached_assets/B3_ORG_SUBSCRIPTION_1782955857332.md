# DISPATCH — B3: ORG SUBSCRIPTION (BILLING IDENTITY → ORG, TIER AUTHORITATIVE)

**First of the three-dispatch finish (B3 → B4 → B5). B3 must land before B4** (B4 scopes data by org
and reads the tier; the tier must be org-authoritative first).
**What B3 does:** moves billing identity from user to org. The org pool exists (B2a) but the Stripe
SUBSCRIPTION may still be user-attached — B3 closes that seam. `stripe_customer_id` on
`org_credit_balances` comes due. Tier becomes ORG-authoritative, discharging the B2a denormalization
flag ("sync-on-upgrade required, org authoritative in B3").
**Repo:** `Nardo758/JediRe.git` — branch `claude/b3-org-subscription`.
**Verification rule (S1-01):** proven LIVE — a subscription event resolves to the ORG, updates the
ORG's tier/pool, and the tier reads authoritatively from the org (not the dormant user row).
Billing → live run required.
**Report to:** `docs/audits/B3_ORG_SUBSCRIPTION_VERDICT.md`

---

## PHASE 1 — MAP THE CURRENT BILLING IDENTITY (READ-ONLY, STOP)

**1. Where does the Stripe subscription attach today?** Trace checkout (billing.routes.ts, the S4
   build) → does it create the Stripe customer/subscription against the USER or the ORG? Where is
   `stripe_customer_id` stored — on users, on org_credit_balances (reserved-but-null from B2a), both?
   `file:line`.

**2. The webhook path (S1/S4).** When `customer.subscription.*` fires, `resolveTier()` maps the
   product → tier. But what does it update — the USER's balance/tier or the ORG's? Trace it. If it
   updates a user row, that's the seam: billing events change user-level state while entitlement is
   org-level. `file:line`.

**3. The tier duplication (the B2a flag).** `subscription_tier` lives on BOTH `user_credit_balances`
   (old) and `org_credit_balances` (new). Which does the GATE read today (post-B2a it should be org)?
   Which does the webhook WRITE (still user?)? If the webhook writes user-tier and the gate reads
   org-tier, they can drift — that's the flag to discharge. Confirm the current read/write split.
   `file:line`.

**4. The org↔customer mapping.** For a subscription event to update the right ORG, we need
   Stripe-customer → org. Design it: `org_credit_balances.stripe_customer_id` (the reserved column)
   holds the org's Stripe customer; the webhook resolves customer → org via it. Confirm the reserved
   column exists and design the mapping. For dd201183 (the one real org), what's its current Stripe
   customer (if any)?

**=== STOP: report where billing attaches today (user vs org), what the webhook updates, the current
tier read/write split (the drift risk), and the org↔customer mapping design. Approve before Phase 2. ===**

---

## PHASE 2 — MOVE BILLING IDENTITY TO ORG (after design approved)

1. **Checkout creates the subscription against the ORG.** The Stripe customer is the ORG's (stored in
   `org_credit_balances.stripe_customer_id`), the subscription (flat + metered, from S4) attaches to
   that org customer. `file:line`. For a solo user, the org-of-one's customer = effectively them; for
   Institutional, one org customer for the whole team.

2. **Webhook resolves customer → ORG and updates ORG state.** `customer.subscription.*` →
   resolve `stripe_customer_id` → org → update the ORG's tier + pool (cap, allotment). The webhook
   writes ORG-level tier now, not user. `file:line`.

3. **Tier becomes ORG-authoritative (discharge the flag).** The gate and all tier reads use
   `org_credit_balances.subscription_tier`. The webhook writes it there. `user_credit_balances.
   subscription_tier` becomes deprecated — either stop writing it, or write it as a mirror-for-display
   ONLY with a comment that org is authoritative. State which. The B2a denormalization flag is
   discharged when there is ONE authoritative tier (org) and the user copy is either gone or
   explicitly display-only. `file:line`.

4. **Migrate dd201183.** The one real org gets its Stripe customer set on `org_credit_balances.
   stripe_customer_id` (create/link the customer if needed), so its subscription resolves correctly.
   `file:line`.

5. **provisionUser / signup alignment.** Signup (B2b) creates the org + pool at scout. When that org
   later subscribes, the webhook must upgrade the ORG. Confirm the signup→subscribe→upgrade path is
   org-level end to end (this connects B2b's signup to B3's billing). `file:line`.

---

## ACCEPTANCE — live

1. **Subscription attaches to org:** run a test checkout → the Stripe subscription's customer is the
   ORG's `stripe_customer_id`, and `org_credit_balances` reflects it. Paste.
2. **Webhook updates ORG tier (not user):** fire a `customer.subscription.updated` (e.g. scout→operator
   for a test org) → the ORG's tier + pool cap update to operator; confirm the ORG row changed. Paste
   before/after of `org_credit_balances`.
3. **Tier is org-authoritative:** the gate reads the org tier; confirm changing ONLY the org tier
   (not the user row) changes gate behavior — proving org is the source of truth. Paste.
4. **No drift:** after an upgrade, confirm there's ONE authoritative tier (org); the user copy is
   either not written or explicitly display-only-and-synced. Paste both values + state the policy.
5. **dd201183 resolves:** the real org's subscription events resolve to dd201183 via its
   stripe_customer_id. Paste.
6. **Solo path intact:** a solo user (org-of-one) subscribing → their org upgrades correctly, gate
   behaves as before. Paste (regression guard, like B2a).
7. Idempotency; cleanup test orgs/customers.

---

## DELIVERABLE

- SHA + Phase 1 (billing-attach map, webhook-updates-what, tier read/write split, org↔customer design) → STOP
- Phase 2 (post-approval): subscription→org, webhook→org-tier, tier org-authoritative, dd201183 migrated
- Live acceptance 1-7 (esp. #2 webhook-updates-org and #3 tier-org-authoritative)
- One-line: billing identity now ORG-level; webhook updates org tier + pool; tier authoritative on org
  (B2a denormalization flag discharged); solo path intact; ready for B4 (data scoping)

---

## SEQUENCING — the finish arc

- **B3 (this):** org subscription, tier authoritative. MUST land before B4.
- **B4 (next):** data scoping to org — deals + properties filter by org_id. LARGE — likely splits into
  B4a (deals: ~20 read sites, deals already have org_id) + B4b (properties: the parked org_id column-
  add + 1.06M ArcGIS two-population split + is_market_data flag). Flagged for split when we get there.
- **B5 (last):** Institutional polish — zero-markup-unlimited exposure decision, tier-level behavior.
  Mostly decisions. Depends on B3 + B4.

## OUT OF SCOPE (for B3)

- B4 data scoping (next — B3's tier-authoritative is its prerequisite).
- B5 Institutional polish.
- The properties org_id / market-data work (that's B4b).
- Overage-vs-hard-block revisit — hard-block stands (S5 decision); B5 may revisit for Institutional.

**B3 closes the billing seam: the org pool (B2a) now has an org-level SUBSCRIPTION under it, and the
tier is authoritative in ONE place. The proofs that matter: #2 (webhook updates the org, not a user)
and #3 (tier is org-authoritative — the drift risk from B2a is gone).**
