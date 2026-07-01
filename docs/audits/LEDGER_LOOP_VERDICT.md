# LEDGER LOOP VERIFICATION — Verdict

**Date:** 2026-07-01  
**Repo SHA:** `ce155c09bca77d5b7dbb38a842543d9f17beccb5`  
**Dispatch:** LEDGER_LOOP_VERIFICATION (read-only)  
**Auditor:** Agent (automated)

---

## Verdict: DISCONNECTED

The balance gate reads `user_credit_balances.credits_remaining`.  
Skill-chat metering (via `MeteringAdapter`) never writes to `user_credit_balances`.  
**The gate passed its Phase-2 zero-balance test. It will never fire on real usage.**  
This is a billing-architecture fix dispatch, not an in-place patch.

---

## Part 1 — Debit-Path Trace

### 1.1 — From `meteringAdapter.createMessage()` to the balance

```
skill-chat.service.ts  →  meteringAdapter.createMessage()          [MeteringAdapter.ts:250-319]
                       →  this.settle()                             [MeteringAdapter.ts:309]
                          ├── this.logUsage()                      [MeteringAdapter.ts:331]
                          │    └── INSERT INTO ai_usage_log
                          │         credits_consumed = 0  ← hardcoded
                          │         cost_usd = actualCost ← non-zero
                          ├── this.reportStripeUsage()             [MeteringAdapter.ts:334]
                          │    └── stripe.billing.meterEvents.create('jedi_input_tokens')
                          │    └── stripe.billing.meterEvents.create('jedi_output_tokens')
                          └── this.reportStripeCost()              [MeteringAdapter.ts:335]
                               └── stripe.billing.meterEvents.create('jedi_ai_cost_usd')
```

**`user_credit_balances` is never touched.** Neither `settle()`, `logUsage()`, `reportStripeUsage()`, nor `reportStripeCost()` contain any `UPDATE user_credit_balances` statement. Confirmed by reading MeteringAdapter.ts lines 280–466 in full.

### 1.2 — What `credits_consumed = 0` means

`MeteringAdapter.ts:458`:
```typescript
0, // credits_consumed: 0 for MeteringAdapter (user pays via JediAIService)
```

The comment refers to the **5 agent-runtime callers** (ResearchAgent, ZoningAgent, SupplyAgent, CashFlowAgent, CommentaryAgent) which go through `JediAIService` — a separate service that DOES call `checkAndDeductCredits()`. The comment does not describe skill-chat's billing path. When Phase 2 wired skill-chat to MeteringAdapter, skill-chat inherited the "no credit deduction" behaviour that was intentional for platform agents but incorrect for user-facing skill-chat.

### 1.3 — Every writer of `credits_remaining`

| Location | Function | What it does | Called by skill-chat? |
|---|---|---|---|
| `aiService.ts:517-586` | `JediAIService.checkAndDeductCredits()` | `UPDATE … SET credits_remaining = credits_remaining - $1` | ❌ No — commentary.agent.ts + extraction-pipeline.ts only |
| `creditService.ts:429-447` | `creditService.reserveCredits()` | Atomic `UPDATE … SET credits_remaining = credits_remaining - $1 WHERE credits_remaining >= $1` | ❌ No — news.service.ts only |
| `creditService.ts:462-469` | `creditService.debitActualCost()` | `UPDATE … SET credits_remaining = credits_remaining - $1` (post-call reconcile) | ❌ No — news.service.ts only |
| `creditService.ts:173-200` | provisioning upsert | Sets credits_remaining on account creation | ❌ Not a deduction |
| `creditService.ts:221-235` | `resetMonthlyCredits()` | Resets to full tier allowance on `invoice.paid` | ❌ Not a deduction |
| `creditService.ts:274-289` | `updateTier()` | Adjusts on tier change | ❌ Not a deduction |

**Skill-chat is not among the decrementers.** Confirmed: `grep -rn "aiService\|JediAIService\|creditService\|checkAndDeduct\|reserveCredits" backend/src/services/skills/` returns zero hits.

---

## Part 2 — Live Balance-Drop Observation

**Test user:** `f2a-operator@test.jedi` (user_id `31720afb-fe3f-421a-9697-096e3fe52565`)  
**Executed:** 2026-07-01T18:19–18:24Z (real Anthropic API, logged to ai_usage_log)

### Starting balance

```
credits_remaining = 500.000000
updated_at        = 2026-06-30 13:24:50.268189+00  (unchanged since setup)
```

### Sessions fired (real Sonnet spend)

| Session | Sonnet calls | input_tokens | output_tokens | cost_usd |
|---|---|---|---|---|
| conv_1782929974735_9nalpn | 3 | 21,691 | 1,956 | $0.094413 |
| conv_1782930196455_y35zu6 | 6 | 26,856 | 1,847 | $0.108273 |
| **Total** | **9** | **48,547** | **3,803** | **$0.202686** |

Session 2 covered the deep path: orchestrator (A1) → CFO persona sub-loop (B1/B2/B3/B4) → orchestrator synthesis (A2).

### Ending balance

```
credits_remaining = 500.000000
```

### Side-by-side proof

| Ledger | Before | After | Delta |
|---|---|---|---|
| `ai_usage_log.cost_usd` (Stripe-metered) | $0.000 | **$0.202686** | **+$0.202686** |
| `user_credit_balances.credits_remaining` | 500.000 | **500.000** | **$0.000** |

**Result: DISCONNECTED.** $0.202686 of real Sonnet spend accumulated across 9 calls. The balance the gate reads did not move by a single cent.

---

## Part 3 — Fix Shape (diagnosis only — do not implement)

### The two options

**Option X — Decrement on spend (make the gate live against the ledger it already reads)**

After `meteringAdapter.createMessage()` completes, convert `cost_usd` → credits via the existing per-credit rate and call `creditService.debitActualCost(userId, 0, creditsOwed)`. The gate already reads `user_credit_balances.credits_remaining`; this option makes real skill-chat spend drive that number toward zero. Fits the prepaid-credit billing model.

**Option Y — Gate on the right ledger (skill-chat is Stripe-metered, not prepaid-credit-billed)**

If the intent is that skill-chat is a Stripe usage-billed surface (pay-per-token via meter events, not prepaid credits), then `credits_remaining` is the wrong gate. The gate should check Stripe subscription status, a payment method entitlement, or an operator-defined per-session spend cap — not a prepaid credit balance that skill-chat never touches by design. This requires choosing a different "can this user spend?" signal that Stripe metering actually drives.

### The billing-architecture question (human call)

MeteringAdapter sends the same Stripe meter events as JediAIService (`jedi_input_tokens`, `jedi_output_tokens`, `jedi_ai_cost_usd`). JediAIService ALSO decrements `credits_remaining`. When Phase 2 wired skill-chat to MeteringAdapter (instead of JediAIService), it inherited only the Stripe-metering half — the credit-deduction half was dropped.

**The question:** Is skill-chat a prepaid-credit surface (users buy credits, spend them, gate enforces depletion) or a Stripe usage-metered surface (metered to Stripe, no prepaid ledger)? The current architecture has it set up as the former (gate reads credits) but wired as the latter (MeteringAdapter, no credit deduction). One of these is wrong. Option X fixes the wiring to match the gate. Option Y changes the gate to match the wiring.

This is a product billing-architecture decision, not a code decision.

---

## Summary

| Question | Answer |
|---|---|
| Does a skill-chat Sonnet call reach `credits_remaining`? | **No.** Zero code paths from `meteringAdapter.createMessage()` touch `user_credit_balances`. |
| Is skill-chat among the decrementers? | **No.** The only `credits_remaining` decrementers are `JediAIService.checkAndDeductCredits()` (agents) and `creditService.reserveCredits/debitActualCost()` (news service). |
| Is the Phase-2 gate live in production? | **No.** The zero-balance test proved the gate BLOCKS at 0. Nothing in the skill-chat path drives a real user's balance toward 0. Gate is structurally dead. |
| Live proof | 9 real Sonnet calls, $0.202686 `cost_usd`, `credits_remaining` unchanged at 500. |
| Fix | Option X (wire deduction to match the gate) or Option Y (wire the gate to match the billing) — billing-architecture decision required before implementation. |
