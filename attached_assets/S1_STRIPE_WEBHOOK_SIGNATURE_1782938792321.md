# DISPATCH — S1: STRIPE WEBHOOK SIGNATURE VERIFICATION (SECURITY)

**Severity:** live, exploitable, on the money path. `STRIPE_WEBHOOK_SECRET` is unset, so Stripe
webhook signature verification is bypassed. Anyone who can reach the webhook endpoint can FORGE a
subscription event (fake "subscription created, tier: principal") and provision a paid tier without
paying. Same class as the unauthenticated endpoints already closed — but a forgeable WRITE to billing/
entitlement state. Fix first; independent of the metered-billing build and the key renewal.
**Repo:** `Nardo758/JediRe.git` — branch `claude/fix-stripe-webhook-signature`.
**Verification rule (S1-01):** proven by live HTTP — an unsigned/wrongly-signed webhook is REJECTED,
a correctly-signed one is accepted — not by reading the verification code.
**Report to:** `docs/audits/STRIPE_WEBHOOK_SIGNATURE_VERDICT.md`

---

## STEP 1 — TRIAGE THE CURRENT STATE (READ-ONLY)

1. **Find the Stripe webhook handler.** `file:line` of the route that receives Stripe events
   (`/api/stripe/webhook` or wherever). Confirm what it does on receipt — does it call
   `stripe.webhooks.constructEvent(body, sig, secret)` (the verification path), or does it parse the
   body directly / skip verification when the secret is absent?
   ```
   grep -rniE "constructEvent|webhooksecret|stripe.webhooks|STRIPE_WEBHOOK_SECRET" backend/src --include=*.ts
   ```
2. **Confirm the bypass.** Is there a code path where, if `STRIPE_WEBHOOK_SECRET` is unset/empty,
   the handler processes the event ANYWAY (no verification)? That's the hole. `file:line`. Or does it
   already call constructEvent and simply fail because the secret env var is missing (safer — broken
   but not forgeable)? Distinguish these two: **bypassed** (processes unsigned) vs **broken-closed**
   (rejects everything because secret missing). The fix differs.
3. **Confirm raw-body handling.** `constructEvent` needs the RAW request body, not parsed JSON. Check
   whether the webhook route uses `express.raw()` / preserves the raw body. A common bug: verification
   is coded but fails because body-parser already consumed the raw body. `file:line`.

Report: is it BYPASSED (forgeable — urgent), BROKEN-CLOSED (rejects all — webhooks dead but safe), or
already-correct-but-secret-missing (just needs the env var). This determines the fix.

## STEP 2 — FIX

**The env secret (you/ops):** `STRIPE_WEBHOOK_SECRET` must be set to the signing secret from the
Stripe dashboard (the `whsec_...` for this endpoint). NOTE: this comes from Stripe and may require the
renewed key / dashboard access — if the value isn't available in this environment, the CODE fix still
lands (enforce verification, fail-closed when secret missing) and the secret value is flagged as an
ops task. State clearly which half is code vs ops.

**The code (this dispatch):**
1. Ensure the handler calls `stripe.webhooks.constructEvent(rawBody, sig, secret)` and REJECTS
   (400/401) on signature failure. `file:line`.
2. **Fail CLOSED, not open:** if `STRIPE_WEBHOOK_SECRET` is unset/empty, the handler must REJECT all
   webhooks (500/misconfig error), NOT process them unverified. The current bypass (process-when-
   secret-absent, if that's what Step 1 found) is the exact hole — invert it. A missing secret should
   break webhooks safely, never wave them through.
3. Confirm `express.raw()` (or equivalent raw-body capture) is on the webhook route so verification
   has the bytes it needs.

Do NOT bundle the tier-mapping fix (S2) or metered billing (S4) here — this dispatch only closes the
forgeable-event hole.

## STEP 3 — ACCEPTANCE (live HTTP)

1. **Forged/unsigned event rejected:** POST a fake subscription event to the webhook with no
   signature (or a wrong one) → 400/401, and confirm NO entitlement change occurred (no tier
   provisioned, no DB write). Paste status + proof nothing was written.
2. **Correctly-signed event accepted:** if the real secret is available, send a properly-signed test
   event (Stripe CLI `stripe trigger` or a signed payload) → processed. Paste. If the secret is NOT
   yet available (ops task pending), confirm instead that the handler FAILS CLOSED (rejects, doesn't
   process) and flag that the signed-path test is pending the secret.
3. **Fail-closed proven:** with the secret unset, a webhook is REJECTED, not processed. Paste — this
   is the core security proof: missing secret must never mean open door.

---

## DELIVERABLE

- SHA + Step 1 triage (BYPASSED / BROKEN-CLOSED / secret-missing-only), `file:line`
- Code fix: constructEvent enforced, fail-closed on missing secret, raw body confirmed
- Which half is code (done here) vs ops (set the whsec_ secret — flag if pending)
- Acceptance: forged rejected + nothing written; fail-closed proven; signed-path accepted or flagged-
  pending-secret
- One-line: webhook signature verification enforced + fail-closed; forgeable-event hole closed;
  whsec_ secret [set / pending ops]

---

## OUT OF SCOPE

- S2 tier product mapping (needs renewed-key Stripe access for real product IDs — next, after you
  renew).
- S3 live config re-trace, S4 metered billing, S5 usage gate — sequenced after key renewal.
- The other webhooks (Twilio/Telegram/Notarize/Clawdbot) — this is the STRIPE webhook specifically;
  if Step 1 finds another billing-relevant webhook also unverified, flag it, same severity.

**Core security proof: a missing secret must FAIL CLOSED (reject), never process unverified. If Step 1
finds the handler processes events when the secret is absent, that inversion IS the fix.**
