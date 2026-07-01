# SKILL_CHAT_METERING Phase 2 — Verdict

**Date:** 2026-07-01  
**Dispatch:** SKILL_CHAT_METERING Phase 2  
**Auditor:** Agent (automated)

---

## Objective

Wire all 11 `claude-sonnet-4-5` call sites through `MeteringAdapter` (per-token passthrough) and add a message-level balance gate that blocks zero-balance users before the first Sonnet call.

---

## Summary

**PASS.** All 11 call sites are now metered. Zero raw `anthropic.messages.create` calls remain in the 9 target files. Balance gate is live in `skill-chat.service.ts`. All 7 S1-01 acceptance tests confirmed live against real Anthropic API calls.

**Bonus fix (discovered during live testing):** `personas.ts` line 139 had a hard `!process.env.ANTHROPIC_API_KEY` guard that prevented B1/B2 from reaching the MeteringAdapter in any environment where only `AI_INTEGRATIONS_ANTHROPIC_API_KEY` is set. Updated to `!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY` — matching the dual-key check MeteringAdapter already uses.

---

## Call-Site Inventory

| ID | File | Method | Old | New | Status |
|----|------|---------|-----|-----|--------|
| A1 | `skill-chat.service.ts` | initial message | `anthropic.messages.create` | `meteringAdapter.createMessage` | ✅ SWAPPED |
| A2 | `skill-chat.service.ts` | tool loop continuation | `anthropic.messages.create` | `meteringAdapter.createMessage` | ✅ SWAPPED |
| B1 | `skills/personas.ts` | persona initial call | `anthropic.messages.create` | `meteringAdapter.createMessage` | ✅ SWAPPED |
| B2 | `skills/personas.ts` | persona tool loop | `anthropic.messages.create` | `meteringAdapter.createMessage` | ✅ SWAPPED |
| C1 | `collaborations/cfo-lender.service.ts` | `getAIRecommendations` | `anthropic.messages.create` | `meteringAdapter.createMessage` | ✅ SWAPPED |
| C2 | `collaborations/asset-manager-cfo.service.ts` | `getAIAnalysis` | `anthropic.messages.create` | `meteringAdapter.createMessage` | ✅ SWAPPED |
| C3 | `collaborations/research-acquisitions.service.ts` | `getAIRecommendations` | `anthropic.messages.create` | `meteringAdapter.createMessage` | ✅ SWAPPED |
| C4 | `collaborations/research-acquisitions.service.ts` | `getBatchAIRecommendations` | `anthropic.messages.create` | `meteringAdapter.createMessage` | ✅ SWAPPED |
| C5 | `collaborations/leasing-revenue.service.ts` | `getAIRecommendations` | `anthropic.messages.create` | `meteringAdapter.createMessage` | ✅ SWAPPED |
| C6 | `collaborations/compliance-legal.service.ts` | `getAIRecommendations` | `anthropic.messages.create` | `meteringAdapter.createMessage` | ✅ SWAPPED |
| C7 | `collaborations/tax-cfo.service.ts` | `getAIAnalysis` | `anthropic.messages.create` | `meteringAdapter.createMessage` | ✅ SWAPPED |

**Total swapped: 11 / 11**

---

## Balance Gate (Part B)

Added to `skill-chat.service.ts` at the top of the `skillChat()` try-block, before any Sonnet call or history load.

**Logic:**
1. Query `user_credit_balances.credits_remaining` for the requesting user.
2. If `credits_remaining <= 0`:
   - Log a `skill_chat:blocked` row to `ai_usage_log` (best-effort, swallowed on error).
   - Return early with `{ blocked: true, blockReason: { reason: 'out_of_credits', credits_remaining, upgrade_url: '/terminal/settings?tab=subscription' } }`.
3. If positive: construct `MeteringMetadata` shared by both A1 and A2 within the same message.

**Design decisions:**
- Check fires ONCE per message, not between tool-use turns — bounded overshoot accepted (user runs the whole message, blocked on next).
- `ChatResponse` interface extended with `blocked?: boolean` and `blockReason?` — callers (REST route) can read the flag and return HTTP 402/200+blocked to the client.
- `ON CONFLICT DO NOTHING` on the blocked-attempt log row is best-effort; primary DB errors are silently swallowed so they never block the response path.

---

## MeteringAdapter Changes (supporting fixes)

| Change | Reason |
|--------|--------|
| `MessageParams.system` made optional (`system?: string`) | Collaboration services send user-only messages (no system prompt) |
| `tool_choice` type corrected to `Anthropic.MessageCreateParams['tool_choice']` | Was `{ type: 'function'; function: { name: string } }` — wrong shape for Claude API |
| `tool_choice` now passed through in `createMessage()` | Was silently dropped; needed by skill-chat's `forcedSkillId` feature |
| `system` spread conditionally in API call | Prevents `system: undefined` from being serialized to the wire |

---

## Collaboration Service Changes

Each of the 6 collaboration services received:

1. **Removed:** `import Anthropic from '@anthropic-ai/sdk'` and `const anthropic = new Anthropic({...})` module-level client.
2. **Added:** `import { meteringAdapter }` and `import type { MeteringMetadata }` from `../../../agents/runtime/`.
3. **Private method signature:** `userId: string, dealId?: string` parameters added.
4. **Inside method:** `MeteringMetadata` constructed from `userId`/`dealId`, passed to `meteringAdapter.createMessage()`.
5. **Public caller:** updated to pass `userId` and `dealId` from the already-available destructured locals.

`research-acquisitions.service.ts` had two LLM call sites (`getAIRecommendations` + `getBatchAIRecommendations`); both were wired. Note: research-acquisitions signals have no `dealId`, so `deal_id` is omitted from those metadata objects (field is optional on `MeteringMetadata`).

---

## Verification

### Static verification
```
grep -rn "anthropic\.messages\.create|new Anthropic(" \
  backend/src/services/skills/skill-chat.service.ts \
  backend/src/services/skills/skills/personas.ts \
  backend/src/services/agents/collaborations/ \
  backend/src/agents/runtime/MeteringAdapter.ts
```
Result: Only 2 hits in `MeteringAdapter.ts` itself (the constructor and the internal `.messages.create` call that the adapter wraps). Zero hits in any of the 9 target files.

```
grep -rn "meteringAdapter\.createMessage" \
  backend/src/services/skills/ \
  backend/src/services/agents/collaborations/
```
Result: **11 hits** — matches the 11-call inventory above.

### TypeScript check
```
cd backend && npx tsc --noEmit --skipLibCheck 2>&1 | grep -E \
  "skill-chat|personas|cfo-lender|asset-manager|research-acqui|leasing-revenue|compliance-legal|tax-cfo|MeteringAdapter"
```
Result: **Zero errors** in all 9 touched files. All pre-existing errors are in unrelated files.

### Runtime
Backend restarted at 2026-07-01T18:22:29Z. Startup log: `"service":"jedire-api","environment":"development"` — clean. No import or module errors logged.

`meteringAdapter` singleton load check: `object OK` (verified via `ts-node --transpile-only -e` probe).

---

## S1-01 Live Run Confirmation — COMPLETE ✅

**Test user:** `f2a-operator@test.jedi` (user_id `31720afb-fe3f-421a-9697-096e3fe52565`)  
**Test deal:** `c92b5746-79a4-4303-8f2a-aba8d5bd4182`  
**Executed:** 2026-07-01T18:18–18:24Z

---

### Acceptance #1 — Deep-session debit ✅

Two live sessions fired against real Anthropic API.

**Session 1** (`conv_1782929974735_9nalpn`) — orchestrator only, 3 Sonnet calls:

| Call | input_tokens | output_tokens | cost_usd |
|------|-------------|---------------|----------|
| A1 (orchestrator initial) | 6,283 | 221 | $0.022164 |
| A2 (tool-loop continuation) | 7,604 | 73 | $0.023907 |
| A3 (final synthesis) | 7,804 | 1,662 | $0.048342 |
| **Session 1 total** | **21,691** | **1,956** | **$0.094413** |

**Session 2** (`conv_1782930196455_y35zu6`) — orchestrator + CFO persona sub-loop (A1 → B1/B2/B3/B4 → A2), 6 Sonnet calls:

| Call | input_tokens | output_tokens | cost_usd |
|------|-------------|---------------|----------|
| A1 (orchestrator initial) | 6,281 | 47 | $0.019548 |
| B1 (CFO persona initial) | 1,933 | 239 | $0.009384 |
| B2 (CFO persona tool-loop) | 3,442 | 290 | $0.014676 |
| B3 (CFO persona tool-loop) | 3,838 | 92 | $0.012894 |
| B4 (CFO persona synthesis) | 4,123 | 604 | $0.021429 |
| A2 (orchestrator synthesis) | 7,239 | 575 | $0.030342 |
| **Session 2 total** | **26,856** | **1,847** | **$0.108273** |

**Combined totals — 9 Sonnet calls:**  
Input: 48,547 tokens | Output: 3,803 tokens | **Total cost: $0.202686**

Before Phase 2: $0.000 (no metering). After Phase 2: $0.202686. Delta = material dollars. **S1-01 arithmetic confirmed.**

---

### Acceptance #2 — Zero-balance block ✅

`user_credit_balances.credits_remaining` set to `0`. Fired:
```
POST /api/v1/deals/c92b5746.../skills/chat  {"message":"What is the cap rate..."}
```
Response (HTTP 200):
```json
{
  "success": true,
  "blocked": true,
  "blockReason": {
    "reason": "out_of_credits",
    "credits_remaining": 0,
    "upgrade_url": "/terminal/settings?tab=subscription"
  },
  "skillCalls": []
}
```
Zero Sonnet calls fired. Zero `cost_usd` incurred. Gate fired before any API call.

---

### Acceptance #3 — Bounded overshoot ✅

Gate fires **once per message, before the first Sonnet call** — not between tool-use turns. Maximum theoretical overshoot = the token cost of one complete session (worst case: $0.10–$0.50 for a deep multi-tool run). In practice: zero dollars overshoot when balance is at exactly 0 (gate blocks immediately). Once the external credit manager (Stripe/JediAIService) reconciles and writes `credits_remaining = 0`, the next message is blocked. No mid-session interruption is possible by design.

Verified: at `credits_remaining = 0.05` (above gate threshold), gate decision = **WOULD_PASS** and session proceeds. At `credits_remaining = 0`, gate decision = **WOULD_BLOCK** (confirmed by Acceptance #2).

---

### Acceptance #4 — Blocked attempt logged ✅

`ai_usage_log` row written on block:

| column | value |
|--------|-------|
| operation_type | `skill_chat:blocked` |
| model | `none` |
| input_tokens | `0` |
| output_tokens | `0` |
| cost_usd | `$0.000000` |
| deal_id | `c92b5746-79a4-4303-8f2a-aba8d5bd4182` |
| user_id | `31720afb-fe3f-421a-9697-096e3fe52565` |

Row is suitable for demand-signal analytics (identify users near upgrade threshold).

---

### Acceptance #5 — No double-debit ✅

Each `meteringAdapter.createMessage()` call produces exactly one `ai_usage_log` row. Calls within a session are sequential (tool-use loop, not concurrent). Session 1 → 3 rows, Session 2 → 6 rows. No duplicates. Verified by per-`operation_type` aggregation:

| conversation | row_count | total_input | total_output | total_cost_usd |
|-------------|-----------|-------------|--------------|----------------|
| conv_…9nalpn (Session 1) | 3 | 21,691 | 1,956 | $0.094413 |
| conv_…y35zu6 (Session 2) | 6 | 26,856 | 1,847 | $0.108273 |

---

### Acceptance #6 — Attribution ✅

Every `ai_usage_log` row (10/10 including the blocked demand-signal) carries:
- `user_id = 31720afb-fe3f-421a-9697-096e3fe52565` ✅
- `deal_id = c92b5746-79a4-4303-8f2a-aba8d5bd4182` ✅
- `model = claude-sonnet-4-5` (or `none` for blocked) ✅

---

### Acceptance #7 — Cleanup ✅

`user_credit_balances.credits_remaining` restored to `500.000000` for `f2a-operator@test.jedi`. No test state left in the system.

---

## Open Items

| Item | Severity | Notes |
|------|----------|-------|
| `StubMeteringAdapter` in `admin.routes.ts:1669` | Pre-existing TS error | `Cannot find name 'StubMeteringAdapter'` — not introduced by this dispatch |
| REST route returns HTTP 200+body on `blocked:true` | Enhancement | Frontend should surface an upgrade prompt on `blocked: true`; REST route could optionally return HTTP 402 |

---

*End of Phase 2 verdict.*
