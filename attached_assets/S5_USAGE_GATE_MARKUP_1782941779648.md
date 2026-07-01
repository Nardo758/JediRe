# DISPATCH — S5: PERIOD-USAGE GATE + 25% MARKUP + MARGIN CHECK

**Closes the billing arc.** Wires the app-side enforcement + margin onto the live Version 2a Stripe
build. Three things: (1) apply 25% markup to usage reporting so billing exceeds cost, (2) hard-block
at the tier cap (decrement period-usage, reset on cycle, block+upgrade-prompt at zero — closing the
`credits_remaining` ledger disconnect), (3) compute the per-tier MARGIN CHECK from real measured cost.
**Decisions locked:** hard block (no overage). 25% markup, uniform across tiers (confirm if per-tier).
**Repo:** `Nardo758/JediRe.git` — branch `claude/usage-gate-markup`.
**Verification rule (S1-01):** proven LIVE — billed amount = cost × 1.25, gate blocks at cap from
real usage (not a manual set), margin numbers computed from measured cost. Material dollars → live
run required.
**Report to:** `docs/audits/USAGE_GATE_MARKUP_VERDICT.md`

---

## PART A — 25% MARKUP (the margin — do this or billing collects at cost)

The metered price is 1:1 pass-through today. Without markup, you bill exactly what AI costs = zero
margin. This is the revenue half; it is NOT optional.

1. Where usage is reported to Stripe (`jedi_ai_cost_usd` meter event, `MeteringAdapter` /
   `reportStripeCost`), multiply the raw cost by the markup before reporting:
   `billable = raw_cost_usd * (1 + markup)` where markup = 0.25 (from `TIER_CONFIG[tier].aiMarkup`
   if set; if it's 0/dead, set it to 0.25). `file:line`.
2. **Uniform 25%** across tiers unless confirmed per-tier. If TIER_CONFIG already has per-tier
   `aiMarkup`, use those; if empty/zero, set all to 0.25. State what you found.
3. Confirm the markup is applied ONCE (not double-marked if the metered price also has a multiplier —
   Phase 4 built it 1:1, so the markup lives in the app-side report; confirm no double-application).

## PART B — HARD-BLOCK PERIOD-USAGE GATE (the enforcement + ledger fix)

Redefine `credits_remaining` as **period-usage-against-cap**: it decrements on metered spend, resets
each billing cycle, and the gate hard-blocks at zero. This closes the disconnect the Ledger Loop
trace found (skill-chat spend never decremented the balance the gate read).

1. **Decrement on spend.** After each metered call, decrement the user's period-usage balance by the
   markup-adjusted cost converted to credits (via TIER_CONFIG rate). This is the wiring that was
   MISSING — the metered call must now drive `credits_remaining` down. `file:line`. (This makes the
   Phase-2 skill-chat gate actually fire on real usage.)
2. **Hard block at cap.** When period-usage hits the tier cap (Scout 100 / Operator 500 / Principal
   2000 / Institutional −1 = unlimited), BLOCK further metered calls before they fire. Reuse the
   Phase-2 gate (it already blocks at zero + returns upgrade-legible response) — now reading a balance
   real usage actually moves. No overage: blocked means blocked until upgrade or cycle reset.
   `file:line`.
3. **Institutional (-1 = unlimited):** no cap, no block. Confirm the gate treats -1 as unlimited, not
   as "zero, block immediately." (An off-by-sign here blocks your highest tier entirely.)
4. **Cycle reset.** Period-usage resets to the tier's full allowance at the Stripe billing cycle
   boundary (on `invoice.paid` / subscription renewal webhook). `file:line`. Confirm the reset fires
   from the right webhook event (the S1-verified webhook now handles these).
5. **Idempotency:** decrement counted once per call; retries don't double-decrement. Match the agent
   idempotency guard.

## PART C — MARGIN CHECK (the deferred analysis, now computable)

You now have real measured cost. Compute and report, per tier — do NOT change pricing, just surface:
- Real cost to EXHAUST the tier's cap (cap credits × measured cost-per-credit).
- What the customer is billed for that (× 1.25).
- Your AI cost for that (the raw cost).
- **The verdict per tier:** is your AI cost to serve a maxed-out user < the tier's monthly fee?
  - Scout: cost-to-serve-100-credits vs $49
  - Operator: vs $199
  - Principal: vs $2000-credit cost vs $499
  - (Institutional: unlimited — flag that unlimited + real cost = unbounded AI spend; is that
    intended, or does Institutional need a soft cap / contractual limit? This is the one tier where
    "unlimited" is a real exposure.)
- Use the measured skill-chat cost (~$0.10/deep session) + agent-run costs as the cost basis. State
  assumptions.

**This is diagnostic. If a tier's cost-to-serve exceeds its fee, FLAG it — the cap or price needs
adjusting — but do not change pricing in this dispatch. Surface the number; the human decides.**

---

## ACCEPTANCE — live

1. **Markup applied:** fire a real metered call → confirm the amount reported to Stripe = raw_cost ×
   1.25, NOT raw_cost. Paste raw cost + billed amount + the arithmetic.
2. **Balance decrements from real usage:** run real sessions on a test user with known balance →
   `credits_remaining` DROPS by the markup-adjusted amount (the disconnect is closed). Paste
   before/after. (This is the test that FAILED in the Ledger Loop trace — now it must pass.)
3. **Hard block at cap from real usage:** drive a test user to their cap via real usage (not a manual
   set) → next call BLOCKED, upgrade-legible response. Paste. (Real-usage-reaches-cap, not
   hand-set-to-zero — the distinction the Phase-2 test couldn't prove.)
4. **Institutional unlimited:** confirm a -1 user is NOT blocked. Paste.
5. **Cycle reset:** simulate the renewal webhook → period-usage resets to full allowance. Paste.
6. **No double-decrement / double-markup.** Paste.
7. **Margin check computed:** the per-tier cost-to-serve vs fee table. Paste. Flag any tier where
   cost-to-serve > fee.
8. Clean up test users.

---

## DELIVERABLE

- SHA + Part A (markup, `file:line`), Part B (decrement + block + reset, `file:line`), Part C (margin table)
- Live acceptance 1-8
- One-line: usage billed at cost×1.25; period-usage gate hard-blocks at cap from real usage (ledger
  disconnect closed); cycle reset live; margin check → [tiers healthy / tier X flagged]

---

## OUT OF SCOPE / OPEN FLAGS

- `STRIPE_SECRET_KEY` env swap (code fallback works; env still holds pk_ — 30-sec clean-up, flag).
- Institutional $999 placeholder — confirm before first Institutional subscriber.
- Institutional unlimited exposure — if margin check flags it, that's a pricing/contract decision.
- Pricing changes from the margin check — surfaced here, decided by human separately.
- Notarize absorb-vs-cap — still open.
- #2 dev-scenarios + rest of the metering queue — separate (now that the meter→bill→gate chain is
  proven, extending it to other routes is mechanical).

**The two proofs that matter: acceptance #1 (billed = cost × 1.25, margin exists) and #2 (balance
decrements from real usage, the disconnect is closed). Everything else confirms the gate behaves.
Part C is the margin truth you've been deferring — now computed from real numbers.**
