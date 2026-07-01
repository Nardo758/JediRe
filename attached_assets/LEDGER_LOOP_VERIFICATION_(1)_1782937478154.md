# DISPATCH — LEDGER LOOP VERIFICATION: does skill-chat spend drive the gate? (READ-ONLY)

**The one question:** the balance gate blocks on `credits_remaining`. Skill-chat metering writes
`cost_usd` / Stripe token-meters and leaves `credits_consumed = 0` ("user pays via JediAIService").
Does real skill-chat spend actually DECREMENT `credits_remaining` — the number the gate reads — or are
these two ledgers that never connect? If they don't connect, the gate passed its test (balance set to
0 by hand) but will NEVER FIRE in production, because nothing drives a real user's balance toward 0.
**Mode:** READ-ONLY. Trace the ledger path + run a live multi-session balance-drop OBSERVATION (no
writes beyond normal metered calls). Fix nothing — a disconnect becomes its own fix dispatch.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Evidence rule (S1-01):** answered by the live balance trajectory across real sessions + the traced
debit path, not by reading the comment.
**Report to:** `docs/audits/LEDGER_LOOP_VERDICT.md`

---

## THE TWO WORLDS (the trace decides which)

- **CONNECTED** — metered skill-chat spend (via createMessage/JediAIService) DOES decrement
  `credits_remaining`. Gate is live; the Phase-2 zero-balance test just didn't happen to show the
  drop because the balance was set to 0 manually. Confirm with a real balance-drop and sign off.
- **DISCONNECTED** — `cost_usd`/Stripe is one ledger (bills the card), `credits_remaining` is a
  separate prepaid balance decremented by something else (or nothing). Skill-chat wired to the Stripe
  ledger; the gate reads the prepaid ledger; nothing joins them. Gate is dead in production. This
  becomes a fix.

---

## PART 1 — TRACE THE DEBIT PATH (static)

1. **From a metered call to the balance.** Start at `meteringAdapter.createMessage()` →
   `settle()` / `reportStripeUsage()`. Follow every write it makes. Does ANY path from a skill-chat
   Sonnet call reach an UPDATE of `user_credit_balances.credits_remaining`? `file:line` the full
   chain, or state definitively that it does not.
2. **What `credits_consumed = 0` means.** Read the line + comment ("user pays via JediAIService").
   Trace `JediAIService`: does IT decrement `credits_remaining` somewhere, on some path skill-chat
   goes through? Or is `credits_remaining` only moved by a different flow (the 5 agents, a
   subscription reset, manual)? `file:line`.
3. **Who decrements `credits_remaining` at all?** Grep every writer:
   ```
   grep -rniE "credits_remaining\s*[-=]|credits_remaining\s*=\s*credits_remaining" backend/src --include=*.ts
   grep -rniE "UPDATE user_credit_balances|credits_remaining" backend/src --include=*.ts | grep -iE "update|set|decrement|-"
   ```
   List every code path that reduces `credits_remaining`. Is skill-chat (or JediAIService on skill-
   chat's behalf) among them? This is the decisive list.

## PART 2 — LIVE BALANCE-DROP OBSERVATION

The static trace can mislead; confirm with the running system.
1. Take a test user with a KNOWN positive `credits_remaining` (e.g. 500). Paste starting balance.
2. Run 2–3 REAL skill-chat sessions (the deep multi-persona path — real Sonnet spend, ~$0.10 each).
3. Re-read `credits_remaining`. Paste after-balance.
4. **The decisive result:**
   - Balance DROPPED by an amount corresponding to the spend → **CONNECTED**. Gate is live.
   - Balance UNCHANGED despite real metered spend → **DISCONNECTED**. The gate reads a number skill-
     chat never moves. Confirm by pasting: `cost_usd` accumulated in `ai_usage_log` for those
     sessions (nonzero) alongside `credits_remaining` (unchanged) — the two ledgers side by side,
     proving they don't talk.

---

## PART 3 — IF DISCONNECTED, NAME THE FIX SHAPE (diagnose only)

If Part 2 shows the ledgers don't connect, state which is the intended fix — do NOT implement:
- **Option X — decrement on spend:** skill-chat metering also decrements `credits_remaining` (convert
  `cost_usd` → credits via the existing rate, debit the prepaid balance). Makes the gate live against
  the ledger it already reads.
- **Option Y — gate on the right ledger:** if `credits_remaining` is genuinely NOT the intended spend
  ledger for skill-chat (Stripe token-metering IS the billing, prepaid credits are a different
  product concept), then the gate is checking the wrong number — it should gate on whatever actually
  represents "can this user spend" (Stripe balance / entitlement / the real spend ledger).
State which fits the credit model. Flag: this determines whether skill-chat is prepaid-credit-billed
or Stripe-usage-billed — a billing-architecture question, likely a human call.

---

## DELIVERABLE

- SHA + Part 1 debit-path trace (does a skill-chat call reach `credits_remaining`? full chain or
  definitive no)
- Part 1.3 list: every writer of `credits_remaining` — is skill-chat among them?
- Part 2 live result: starting balance → 2–3 real sessions → ending balance. CONNECTED / DISCONNECTED,
  with the side-by-side `cost_usd`-nonzero vs `credits_remaining`-unchanged proof if disconnected.
- **Verdict:** is the Phase-2 gate LIVE in production or DEAD (passes manual test, never fires on real
  usage)?
- If DISCONNECTED: Option X vs Y recommendation + the billing-architecture question for the human.

**STOP at the verdict. A disconnect is a billing-architecture decision + fix dispatch, not an
in-place patch. This trace only answers: does real skill-chat spend drive the number the gate reads.**

---

## WHY THIS MATTERS (the through-line)

Phase 2's zero-balance test set the balance to 0 by hand and saw the block. That proves the gate
BLOCKS at 0 — not that real usage ever REACHES 0. If skill-chat spend doesn't decrement
`credits_remaining`, every real user sits at their starting balance forever, the gate never triggers,
and skill-chat is effectively unlimited despite "having" a meter and a gate. This is the difference
between "the enforcement passed its test" and "the enforcement enforces."
