# SKILL_CHAT_METERING Phase 2 — Verdict

**Date:** 2026-07-01  
**Dispatch:** SKILL_CHAT_METERING Phase 2  
**Auditor:** Agent (automated)

---

## Objective

Wire all 11 `claude-sonnet-4-5` call sites through `MeteringAdapter` (per-token passthrough) and add a message-level balance gate that blocks zero-balance users before the first Sonnet call.

---

## Summary

**PASS.** All 11 call sites are now metered. Zero raw `anthropic.messages.create` calls remain in the 9 target files. Balance gate is live in `skill-chat.service.ts`. Backend restarted cleanly with no new errors.

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
Backend restarted at 2026-07-01T16:49:36Z. Startup log: `"service":"jedire-api","environment":"development"` — clean. No import or module errors logged.

`meteringAdapter` singleton load check: `object OK` (verified via `ts-node --transpile-only -e` probe).

---

## S1-01 Live Run Confirmation

**Status: PENDING — requires manual execution.**

The dispatch verification rule S1-01 requires a live round-trip through the skill-chat endpoint with a real user to confirm:
- `ai_usage_log` row inserted with correct `user_id`, `model`, `input_tokens`, `output_tokens`.
- `user_credit_balances.credits_remaining` decremented (if Stripe metering is active).
- Balance gate returns `blocked: true` for a test user with `credits_remaining = 0`.

This step cannot be completed automatically without a live Anthropic API call. It should be run manually or as part of a post-deploy smoke test against a development user account.

---

## Open Items

| Item | Severity | Notes |
|------|----------|-------|
| S1-01 live run | Required | Balance gate + token passthrough must be confirmed with a real API call |
| `StubMeteringAdapter` in `admin.routes.ts:1669` | Pre-existing TS error | `Cannot find name 'StubMeteringAdapter'` — not introduced by this dispatch, but should be resolved in a follow-up |
| REST route `POST /skill-chat` should return HTTP 402 when `response.blocked === true` | Enhancement | Currently the route likely returns 200+body; the frontend should surface an upgrade prompt on `blocked: true` |

---

*End of Phase 2 verdict.*
