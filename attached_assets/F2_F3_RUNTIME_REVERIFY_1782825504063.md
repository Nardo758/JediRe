# DISPATCH — F2 / F3 LIVE REVERIFY IN REPLIT (READ-ONLY)

**Mode:** READ-ONLY adversarial verification against the RUNNING Replit instance. Prove or disprove
two CLOSED findings at runtime. Change nothing, fix nothing.
**Target:** the running Replit app (backend :4000, DB live), NOT source.
**Verification rule (S1-01):** "confirmed" = pasted live request + live DB query showing the actual
behavior. Code review is NOT acceptance — that's what got this deferred last time. The fixes were
reported CLOSED on `file:line`; this dispatch tests whether the running app behaves as claimed.
**Report to:** `docs/audits/F2_F3_RUNTIME_REVERIFY_VERDICT.md`

---

## WHY THIS RUNS

A9 marked F2 (tier privilege escalation) and F3 (automation_level on upgrade) CLOSED with source
evidence. A prior session deferred runtime reverify ("no live DB") and substituted code review —
the exact inference-for-observation swap S1-01 forbids. Replit has the DB. Run the real test.

Both findings carry security/correctness cost:
- F2: if a forged tier in the request body wins, that's privilege escalation — a user buys Scout,
  sends Principal in the body, gets Principal entitlements.
- F3: if automation_level doesn't rise on upgrade, the event-driven agent pipeline stays dark for
  paying upgraded users — they pay for automation they never receive.

---

## F2 — TIER DERIVES FROM UCB, NOT REQUEST BODY (adversarial)

Claim: `inline-deals.routes.ts:455` sets tier from `balance?.subscriptionTier`, ignoring `req.body`.

**Test:**
1. Identify (or create) a test user with a KNOWN low UCB tier — record their real
   `user_credit_balances.subscription_tier`. Paste it.
2. Send the live deal-create (or whichever route uses line 455) request with a FORGED higher tier
   in the body — e.g. `{"tier":"principal"}` or `{"subscriptionTier":"principal"}` while the user's
   real UCB tier is `scout`. Paste the exact request body sent.
3. Query the resulting row's tier from the live DB. Paste the query + result.

**Pass:** row reflects the user's REAL UCB tier (`scout`), forged body value ignored.
**Fail:** row reflects the forged tier (`principal`) → F2 NOT closed, privilege escalation live →
report LOUD, stop, flag as P0.

Also try the inverse if cheap: forged LOWER tier than real — confirm it can't be used to dodge
metering either. Optional but informative.

---

## F3 — automation_level RISES ON REAL TIER UPGRADE

Claim: `creditService.ts:287` sets `automation_level = config.maxAutomationLevel` on tier update.

**Test:**
1. Take a test user at a low tier. Query and paste their current `automation_level` and tier.
2. Trigger a REAL tier upgrade through the actual upgrade path the app uses (not a direct DB write —
   the point is to prove the pipeline fires). Note the path used.
3. Query `automation_level` and tier again after the upgrade. Paste before + after.

**Pass:** automation_level rises to the new tier's `maxAutomationLevel`.
**Fail:** automation_level stays flat → event-driven agent pipeline dark for upgraded users →
F3 NOT closed → report, flag P0.

If the only available upgrade trigger is a direct tier write (no live upgrade endpoint reachable in
the test env), say so explicitly — a DB-write-then-check proves the trigger logic but NOT that any
real upgrade path invokes it. Distinguish "the handler works when called" from "a real upgrade calls
the handler." Report which you proved.

---

## DELIVERABLE

- Running SHA + DB-live confirmation
- **F2:** CONFIRMED-AT-RUNTIME or FAILED — with pasted forged request body + live DB row tier
- **F3:** CONFIRMED-AT-RUNTIME or FAILED — with pasted before/after automation_level, and an explicit
  note on whether you proved the handler-works or the full-upgrade-path-fires (they're different)
- **Verdict line:** is A9 safe to sign as CLOSED on F2/F3 at runtime, or does either reopen?
- Clean up any test user/rows created, or flag them for cleanup.

**STOP at the verdict. If either FAILS, that's P0 and jumps ahead of A8-F2 push, the LICENSE P1s,
and everything else — a live privilege-escalation or a dark-pipeline-for-payers is the top of the
stack until fixed.**

---

## NOT IN SCOPE

- F5a consolidation design (separate dispatch, depends on the 4-mechanism count already produced)
- F5b product decision (roles vs tiers — human call)
- F1/F4/F6/F2b — ride on existing evidence unless F2/F3 failure implicates them
- A10 license items
