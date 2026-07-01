# SKILL_CHAT_METERING — Phase 1 Audit Verdict

**Date:** 2026-07-01  
**Status:** PHASE 1 COMPLETE — awaiting billing-model confirmation before Phase 2

---

## 1. Scope

Every `anthropic.messages.create()` call that fires during a skill-chat session, from the
moment `POST /api/v1/deals/:dealId/skills/chat` is received to the moment the handler returns.
Phase 2 will wire all of these through `MeteringAdapter.createMessage()`.

---

## 2. Complete Call Set

### 2.1 Always-fires (every user message)

| # | File | Line | Model | max_tokens | Condition |
|---|---|---|---|---|---|
| A1 | `backend/src/services/skills/skill-chat.service.ts` | 136 | `claude-sonnet-4-5` | 4096 | ALWAYS — orchestrator first turn |
| A2 | `backend/src/services/skills/skill-chat.service.ts` | 185 | `claude-sonnet-4-5` | 4096 | Per tool-use round-trip (0–N per message) |

A1 fires exactly once per `POST /chat`. A2 fires once per tool-use batch until
`stop_reason !== 'tool_use'`. A typical message with two tool calls and a final
response produces A1 + A2 + A2 = 3 orchestrator calls.

### 2.2 Conditional — advisor persona sub-calls

Fires when the orchestrator invokes any `consult_<role>` skill (16 personas registered in
`personas.ts`). Each persona runs its own nested Claude loop.

| # | File | Line | Model | max_tokens | Condition |
|---|---|---|---|---|---|
| B1 | `backend/src/services/skills/skills/personas.ts` | 154 | `claude-sonnet-4-5` | 2048 | ALWAYS once per persona consultation |
| B2 | `backend/src/services/skills/skills/personas.ts` | 192 | `claude-sonnet-4-5` | 2048 | Per tool-use round-trip inside persona (0–5 per consultation; capped by `MAX_PERSONA_TURNS`) |

A single `@CFO` mention in a user message triggers: A1 → A2 (orchestrator calls
`consult_cfo`) → B1 → B2 × N → B1 result returned to orchestrator → A2 (final text).

### 2.3 Conditional — collaboration service sub-calls

Fires when the orchestrator or a persona invokes a collaboration skill. These are registered
by `collaboration-skills.ts` and call into `backend/src/services/agents/collaborations/`.
All 7 call sites use `claude-sonnet-4-5`.

| # | File | Line | Triggering skill | Condition |
|---|---|---|---|---|
| C1 | `cfo-lender.service.ts` | 251 | `analyze_debt_structure` | CONDITIONAL |
| C2 | `asset-manager-cfo.service.ts` | 316 | `report_variance` | CONDITIONAL |
| C3 | `research-acquisitions.service.ts` | 304 | `process_market_signal` | CONDITIONAL |
| C4 | `research-acquisitions.service.ts` | 355 | same as C3 (acquisitions adjustment sub-call) | CONDITIONAL |
| C5 | `leasing-revenue.service.ts` | 312 | `optimize_pricing_strategy` | CONDITIONAL |
| C6 | `compliance-legal.service.ts` | 229 | `generate_protective_provisions` | CONDITIONAL |
| C7 | `tax-cfo.service.ts` | 476 | `calculate_after_tax_returns` | CONDITIONAL |

**Note:** The `get_*` variants of each collaboration skill (`get_debt_recommendation`,
`get_variance_history`, etc.) are database-only reads — they call no LLM.

### 2.4 Out-of-scope clarification

`backend/src/services/chat/messageRouter.ts` lines 149 and 152 contain `.messages.create()`
calls but these are **Twilio Conversations API** calls for SMS/WhatsApp delivery, not
Anthropic. They are not LLM calls and are not in scope.

---

## 3. Call Count Per Session

| Session type | Approximate Sonnet calls |
|---|---|
| Minimal (orchestrator answers directly, no tools) | 1 |
| Typical (orchestrator uses 1–2 data skills, returns text) | 2–3 |
| With one persona consultation (e.g. `@CFO`) | 4–6 |
| With two persona consultations + collaboration skills | 8–12 |
| Theoretical maximum (all paths, max tool loops) | ~20+ |

The dispatch "~7 per session" represents the realistic busy case: orchestrator (2–3 turns) +
one persona consultation (2–3 turns) + one collaboration skill call (1 turn) + orchestrator
final (1 turn).

---

## 4. Attribution Source

### 4.1 User identity

Route: `POST /:dealId/skills/chat` → `requireAuth` → handler.  
`userId = req.user!.userId` at `skill-chat.routes.ts:34`. Always present by the time
`skillChat()` is called.

### 4.2 Deal identity

`dealId` from `req.params.dealId`. Verified against `deals WHERE id=$1 AND user_id=$2`
before the LLM call fires (`skill-chat.routes.ts:44–54`).

### 4.3 Thread through the call chain

`skillChat()` constructs `SkillContext = { dealId, userId, conversationId }` at
`skill-chat.service.ts:91–95` and passes it into every `skillRegistry.execute()` call.
`personas.ts:runPersonaConsultation` and all `collaboration-skills.ts` execute callbacks
receive this same `context` object. All three tiers (A, B, C) have `userId` and `dealId`
available without any new plumbing.

### 4.4 Proposed MeteringMetadata for all tiers

```typescript
const meteringMeta: MeteringMetadata = {
  actor_type: 'human',
  actor_id: userId,          // req.user.userId — from requireAuth
  user_id: userId,           // required by reportStripeUsage() for Stripe customer lookup
  deal_id: dealId,           // req.params.dealId — enables per-deal concurrency slot
  triggered_by: 'user',      // user initiated → Stripe token meters fire
  agent_run_id: convId,      // conversationId — stable per session; doubles as idempotency key
};
```

All three tiers can use identical metadata because `SkillContext` carries `userId`, `dealId`,
and `conversationId` throughout.

---

## 5. How MeteringAdapter Billing Actually Works

Reading `MeteringAdapter.createMessage()` (lines 272–319):

1. Acquires deal concurrency slot (queues if deal is at cap).
2. Calls `this.anthropic.messages.create()` — actual API call.
3. Computes `actualCost = estimateCost(model, input_tokens, output_tokens)`.
4. Calls `settle()` which:
   - Inserts a row into `ai_usage_log`.
   - Calls `reportStripeUsage()` → fires Stripe billing meter events
     (`jedi_input_tokens` + `jedi_output_tokens`) keyed to the user's Stripe customer ID,
     looked up from `user_credit_balances WHERE user_id = $1`.
   - Calls `reportStripeCost()` for cost analytics.

**There is no pre-flight credit reservation.** The docstring mentions reservation but the
`createMessage()` implementation does not implement it. Billing is post-call: tokens are
reported to Stripe immediately after the API call returns.

**Implication:** wiring skill-chat through MeteringAdapter is sufficient for Stripe metering.
No additional reservation gate is needed for Phase 2 (consistent with how agent tools are
currently billed).

---

## 6. Billing Model Options & Recommendation

### Option A — Per-token passthrough ✅ RECOMMENDED

Replace each `anthropic.messages.create()` call with `meteringAdapter.createMessage()`.
Actual tokens for every call (A1, A2, B1, B2 × N, C1–C7) flow through `settle()` →
Stripe meters.

**Pros:**
- Revenue scales linearly with actual API cost — no flat-fee underwriting risk.
- Consistent with how the 5 existing agent tools are billed.
- `jedi_input_tokens`/`jedi_output_tokens` meter names are already configured in Stripe.
- Zero schema or credit-balance changes needed.
- Multi-turn sessions (deep persona loops) are billed accurately; cheap 1-turn sessions
  are cheap to the user.

**Cons:**
- Token billing is variable/unpredictable from the user's perspective (though this is
  standard for AI products).

### Option B — Per-message flat credit debit

Debit a fixed credit amount (e.g. 10 credits) once at the start of `skillChat()`,
regardless of how many internal Sonnet calls fire.

**Pros:** Simpler accounting; predictable user cost.

**Cons:**
- Undercharges deep 10-turn sessions; overcharges 1-turn sessions.
- Requires choosing a flat rate that won't be wrong for all session depths.
- Does not use the existing Stripe token meters — would require a separate credits debit
  path not currently wired for this surface.
- Persona and collaboration calls are the most expensive and most variable — flat rate
  can't absorb that spread.

### Option C — Per-session flat credit debit

Same as B but debit once when the conversation is first created (not per message).

**Cons:** Everything in B, plus users paying once then sending 50 messages in one session.

---

## 7. Phase 2 Wiring Plan (pending confirmation)

Once billing model is confirmed, Phase 2 will:

1. **`skill-chat.service.ts`** — replace `anthropic.messages.create()` at lines 136 and 185
   with `meteringAdapter.createMessage()`. Construct `MeteringMetadata` from `request.userId`,
   `request.dealId`, `convId`.

2. **`personas.ts`** — replace `anthropic.messages.create()` at lines 154 and 192 with
   `meteringAdapter.createMessage()`. Pass `MeteringMetadata` constructed from `SkillContext`
   into `runPersonaConsultation()`.

3. **`cfo-lender.service.ts`, `asset-manager-cfo.service.ts`, `research-acquisitions.service.ts`,
   `leasing-revenue.service.ts`, `compliance-legal.service.ts`, `tax-cfo.service.ts`** —
   replace each `anthropic.messages.create()` (7 call sites, C1–C7) with
   `meteringAdapter.createMessage()`. Each service's LLM-calling method will accept an
   optional `MeteringMetadata` argument (passed in from the skill execute callback via
   `SkillContext`).

No route changes, no schema migrations, and no Stripe meter configuration changes are
needed. The `jedi_input_tokens` + `jedi_output_tokens` meters are already live.

---

## 8. Files Touched in Phase 2

| File | Change |
|---|---|
| `backend/src/services/skills/skill-chat.service.ts` | Lines 136, 185: swap to `meteringAdapter.createMessage()` |
| `backend/src/services/skills/skills/personas.ts` | Lines 154, 192: swap to `meteringAdapter.createMessage()` |
| `backend/src/services/agents/collaborations/cfo-lender.service.ts` | Line 251 |
| `backend/src/services/agents/collaborations/asset-manager-cfo.service.ts` | Line 316 |
| `backend/src/services/agents/collaborations/research-acquisitions.service.ts` | Lines 304, 355 |
| `backend/src/services/agents/collaborations/leasing-revenue.service.ts` | Line 312 |
| `backend/src/services/agents/collaborations/compliance-legal.service.ts` | Line 229 |
| `backend/src/services/agents/collaborations/tax-cfo.service.ts` | Line 476 |

**Total call sites:** 11 across 8 files. All use `claude-sonnet-4-5`.

---

*Phase 1 COMPLETE. Awaiting human confirmation of billing model before Phase 2 proceeds.*
