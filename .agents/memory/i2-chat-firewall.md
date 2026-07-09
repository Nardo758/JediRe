---
name: I2 Chat-Content License Firewall
description: skill_chat_messages firewall design — contains_restricted flag, replay exclusion, lineage check, fail-open behavior
---

## Design

**Strategy:** scope-don't-strip. Live AI response is served unchanged. Firewall applies only at the persistence boundary.

**Lineage check:** `hasDealRestrictedLineage(dealId)` — `SELECT EXISTS(... FROM metric_time_series WHERE deal_id=$1 AND redistribution_restricted=TRUE LIMIT 1)`. Fail-open on error (missed flag = one un-gated replay; false-flag = conversation permanently broken).

**Write path:** `saveConversationMessage` — only `role='assistant'` turns are checked. User turns never flagged. Sets `contains_restricted=TRUE` if lineage check returns true.

**Replay path:** `loadConversationHistory` — `WHERE contains_restricted = FALSE`. Restricted rows are not re-injected into future AI prompts.

**Display path:** frontend GET endpoints have no `contains_restricted` filter — users see full conversation history. Only LLM re-ingestion is the risk.

## Table

`skill_chat_messages` — created 2026-07-08 (April 2026 migration file existed but was never applied to this env). Has `contains_restricted BOOLEAN NOT NULL DEFAULT FALSE` from birth. Partial index on `(deal_id, contains_restricted) WHERE contains_restricted = TRUE`.

## Reader census (complete as of 2026-07-08)

- `skill-chat.service.ts loadConversationHistory` → GATED (replay)
- `skill-chat.routes.ts` GET /conversations → NOT gated (display)
- `skill-chat.routes.ts` GET /conversations/:id → NOT gated (display)
- `agent-orchestrator.ts loadConversationHistory` → reads `agent_conversations`, not `skill_chat_messages`; separate surface
- `opus.service.ts` → reads `opus_messages`; separate surface, separate audit needed
- `sessionStore.ts conversation_history` → `chat_sessions` JSONB; separate surface, separate audit needed

## Rules (LIC-01 + ORB-01)

Both written to CLAUDE.md. LIC-01 = restriction propagates through all derivation tiers. ORB-01 = any schema change narrowing a job's read visibility requires a post-deploy orphan sweep.

**Why:** `sweepAllGeographies()` in `correlationEngine.service.ts:860` is GLOBAL-only — no `deal_id` filter. Deal-scoped correlations go stale between explicit callers and nightly sweep. Proposed fix (not built): add a deal-scoped pass after the GLOBAL loop, iterating deals with `redistribution_restricted=TRUE` rows.
