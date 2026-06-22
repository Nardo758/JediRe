# S1 Chat Launch Chain Audit — A2

**Commit:** `fdba9add1` (HEAD → master)
**Date:** 2026-06-22
**READ-ONLY — no code changed.**
**Supersedes:** prior `S1_CHAT_LAUNCH_CHAIN_AUDIT.md` (missing failure-mode section + per-tool labels)

---

## Chain Verdict

**BROKEN-AT-HOP-1 (ingress disconnected from Research Agent pipeline)**

An address entered into the chat surface (`POST /api/chat`) does NOT reach the Research Agent, the UnifiedOrchestrator, or the DealContext assembly pipeline. The production chat ingress (`chat.routes.ts → chat.service.ts`) calls Anthropic SDK directly with a hardcoded tool list that has no relationship to the AgentRuntime or the 24-tool Research Agent registry. The Research Agent runs only via Inngest on `deal.created` events — a separate, asynchronous trigger not connected to the conversational surface. No Telegram or WhatsApp ingress exists in the backend.

Of the 1,020 Research Agent runs recorded (all via Inngest), **861 failed (84%)**, 159 succeeded, and **13 remain permanently stuck in `status='running'`** with the oldest dating from 2026-04-27 (~56 days ago) — confirming the absence of any timeout mechanism.

---

## Hop Table

| # | Node | Label | Evidence | Note |
|---|---|---|---|---|
| 1 | **Ingress — Web chat** | PARTIAL | `chat.routes.ts:8` → `processChat()` `chat.service.ts:205` | Route exists, receives `{ message, conversationId }`, calls Anthropic SDK directly. Does NOT call UnifiedOrchestrator or Research Agent. |
| 1 | **Ingress — Telegram** | ABSENT | `grep -r "Telegram" backend/src/api/rest/` → 0 results | Zero Telegram routes in backend. Only `clawdbot-webhooks.routes.ts` (rent-scraper webhook, unrelated). |
| 1 | **Ingress — WhatsApp/Twilio** | ABSENT | Same grep — 0 results | Spec says "planned, not blocking." Code confirms absent. |
| 2 | **Coordinator / NLU (UnifiedOrchestrator)** | ORPHANED | `unified-orchestrator.ts:128` — `process()` complete; `agent-delegator.ts:90` — `delegate()` complete; neither imported by `chat.routes.ts` | `chat.service.ts` constructs its own inline Anthropic tool list at line 18. The entire orchestrator layer is unreachable from the chat ingress. |
| 2 | **Intent classifier** | ORPHANED | `intent-classifier.ts` exists; called only from `unified-orchestrator.ts:140` | Not reachable via `chat.routes.ts` path. |
| 3 | **Dispatch → Research Agent (Inngest)** | WIRED (disconnected) | `research.inngest.ts:53` — `triggers: [{ event: 'deal.created' }]`; Inngest dev server running | Fires correctly on `deal.created` but this event is never emitted by the chat path. |
| 3 | **Dispatch → Research Agent (direct API)** | WIRED | `POST /api/v1/agents/:agentId/run` registered in `backend/src/api/rest/index.ts` | Manual trigger path is wired but not invoked by chat surface. |
| 4 | **Research Agent tool execution (AgentRuntime)** | PARTIAL | `research.config.ts:120` — 24 tools registered; `AgentRuntime.ts:433` — `outputSchema.parse(finalOutput)` on success | 84% failure rate (861/1,020 runs). Most recent 3 failed runs: `cost_usd = $0.0000` and zero `agent_run_steps` rows — failing before first model call. |
| 5 | **`write_dealcontext`** | WIRED | `write_dealcontext.ts:95-114` — direct DB upsert, ON CONFLICT DO UPDATE | 92 rows verified in `deal_context_fields`. Last write: 2026-04-30. Tool works when reached. |
| 6 | **Analytical agents consume DealContext** | ABSENT | `agent-delegator.ts:256-286` `buildRuntimeInput()` — RESEARCH case returns `{ deal_id, address, property_id }` only; no read from `deal_context_fields` | DealContext is NOT passed to ZONING, SUPPLY, or CASH agents. Each agent re-pulls its own data. The 24h cache short-circuit described in the spec does not exist in code. |
| 7 | **Synthesis** | ORPHANED | `response-synthesizer.ts` called only from `unified-orchestrator.ts:170` | Unreachable via chat ingress. `chat.service.ts` returns Anthropic completions directly. |
| 8 | **Egress — Web** | WIRED | `chat.routes.ts:14` — `res.json(result)` | JSON returned to caller. No streaming. |
| 8 | **Egress — Telegram** | ABSENT | No Telegram send path in codebase | N/A — ingress is also absent. |

---

## Per-Tool Labels — Research Agent Registry (24 tools)

> **Note:** `research.config.ts` header comment claims 8 tools registered. Actual registry has **24**. Comment is stale by 16 tools.

| # | Tool | Label | Evidence |
|---|---|---|---|
| 1 | `fetch_parcel` | WIRED | `fetch_parcel.ts:21` → `platformClient.as()` → `GET /properties/:id` or `GET /properties?address=`; graceful 404 path at line 91. |
| 2 | `fetch_costar_metrics` | PARTIAL | `fetch_costar_metrics.ts:81` → `platformClient` → deal supply pipeline → market fallback → stub return on both failures (line 132–139). No `scope_id` gate in tool; CoStar-derived data written to `deal_context_fields` without licensing tag. See Watch Items. |
| 3 | `fetch_tax_bill` | WIRED | `fetch_tax_bill.ts:65` → `platformClient.as()`. Graceful empty return on miss. |
| 4 | `fetch_comps` | WIRED | `fetch_comps.ts:66` → `platformClient.as()`. Graceful empty return on miss. |
| 5 | `fetch_ownership` | WIRED | `fetch_ownership.ts:59` → `platformClient.as()` → deal→property resolution → `/properties/:id/ownership`. Returns `{ available: false }` when no property linked (line 105). |
| 6 | `write_dealcontext` | WIRED | `write_dealcontext.ts:95-114` → direct DB upsert. `deal_id_mismatch` guardrail at line 76. 92 live rows verified. |
| 7 | `web_search` | PARTIAL | `web_search.ts:117` → Tavily API. Degrades to `{ results: [], error: 'search_unavailable' }` when `TAVILY_API_KEY` unset (line 128). `BudgetEnforcer.checkSearchCap` enforces per-run limit. Fallback-by-design — prompt-enforced, not code-enforced ordering. |
| 8 | `fetch_webpage` | WIRED | `fetch_webpage.ts:119` → native `fetch` with 10s timeout, cheerio stripping, SSRF block, domain allowlist. |
| 9 | `write_comp_set` | WIRED | `write_comp_set.ts:261` → `execute: writeCompSet`. |
| 10 | `write_market_comps` | WIRED | `write_market_comps.ts:262` → `execute: writeMarketComps`. |
| 11 | `fetch_data_matrix` | WIRED | `fetch_data_matrix.ts:447` → `execute: async (input) => fetchDataMatrix(input, getPool())`. |
| 12 | `fetch_proximity_context` | WIRED | `fetch_proximity_context.ts:189` → `execute: async (input, _ctx) => fetchProximityContext(input, getPool())`. |
| 13 | `fetch_market_events` | WIRED | `fetch_market_events.ts:221` → `execute: async (input, _ctx) => fetchMarketEvents(input, getPool())`. |
| 14 | `fetch_backtest_context` | WIRED | `fetch_backtest_context.ts:260` → `execute: async (input, _ctx) => fetchBacktestContext(input, getPool())`. |
| 15 | `fetch_data_library_comps` | WIRED | `fetch_data_library_comps.ts` → `execute:` function delegation (confirmed by grep). |
| 16 | `fetch_inflation_context` | WIRED | `fetch_inflation_context.ts:232` → `execute: fetchInflationContext`. |
| 17 | `classify_as_deal_opportunity` | WIRED | `classify_as_deal_opportunity.ts:110` → `execute: classifyAsDealOpportunity`. |
| 18 | `create_deal_draft` | WIRED | `create_deal_draft.ts:182` → `execute: createDealDraft`. |
| 19 | `extract_deal_fields` | WIRED | `extract_deal_fields.ts` → `execute:` function delegation (confirmed by grep). |
| 20 | `score_fit_against_profile` | WIRED | `score_fit_against_profile.ts` → `execute:` function delegation (confirmed by grep). |
| 21 | `ocr_document` | WIRED | `ocr_document.ts:150` → `execute: ocrDocument`. |
| 22 | `compute_envelope` | WIRED | `compute_envelope.ts:52` → inline `execute: async (input) => { ... }`. |
| 23 | `generate_design_massing` | PARTIAL | `generate_design_massing.ts:224` → inline execute with 8+ return branches (lines 123, 163, 174, 185, 199, 274, 320). Several branches appear to return stub/empty massing shapes. Full branch trace not complete. |
| 24 | `fetch_municipal_sale_comps` | WIRED | `fetch_municipal_sale_comps.ts:107` → inline execute. FL county property appraiser APIs (D-COSTAR-4). |

---

## Break List (ordered by chain position)

**1. HOP 1 — Chat ingress does not enter the Research Agent chain. (LAUNCH BLOCKER)**
`chat.routes.ts` → `chat.service.ts` → Anthropic SDK directly. No deal creation, no Inngest trigger, no AgentRuntime call. The entire Research → DealContext → Analytical agent pipeline is bypassed. Everything at HOP 3 and beyond is moot for the chat surface until this is resolved.

**2. HOP 1 — Telegram ingress absent.**
No Telegram webhook or handler exists anywhere in `backend/src/api/rest/`. The spec's claim "Telegram is live" is false.

**3. HOP 2 — UnifiedOrchestrator is orphaned.**
`unified-orchestrator.ts` and `agent-delegator.ts` are complete implementations with no production caller. Dead code relative to the chat surface.

**4. HOP 4 — 84% Research Agent failure rate (861/1,020 runs).**
All recent failures: `cost_usd = $0.0000`, zero `agent_run_steps`. Failing before the first model call. Root cause unresolved (see DB section).

**5. HOP 4 — 13 runs permanently stuck in `status='running'`.**
Oldest: 2026-04-27 (~56 days). No timeout mechanism reaps them. These rows count against the daily cost cap on the day they started.

**6. HOP 6 — DealContext-to-analytical-agent handoff absent.**
`agent-delegator.ts:buildRuntimeInput()` does not read `deal_context_fields`. The 24h cache short-circuit is not implemented.

---

## Live-DB Section

All queries run against the live development database on 2026-06-22.

### Q1 — agent_runs by agent and status

```sql
SELECT agent_id, status, count(*) FROM agent_runs GROUP BY 1,2 ORDER BY 1,2;
```

```
agent_id | status        | count
---------+---------------+-------
research | failed        | 861
research | running       | 13
research | succeeded     | 159
supply   | failed        | 59
supply   | running       | 34
supply   | succeeded     | 878
```

Research Agent: 84% failure rate. 13 stuck-running rows (no timeout mechanism).
Supply Agent: 6% failure rate, 878 succeeded — healthy by comparison.

### Q2 — deal_context_fields count

```sql
SELECT count(*) FROM deal_context_fields;
-- count: 92
```

92 rows. Last write was 2026-04-30 (~8 weeks ago). Research Agent has not successfully written context since.

### Q3 — Steps for most recent failed Research run (`af6f50d2`)

```sql
SELECT tool_name, step_type, created_at FROM agent_run_steps
WHERE agent_run_id = 'af6f50d2-c3d8-4f34-8942-b70ded7c3fe9'
ORDER BY created_at ASC;
-- (0 rows)
```

Zero steps. The agent fails before emitting a single step — before any tool call and before any model call. Indicates startup failure: budget pre-flight, DeepSeek API key missing/invalid, or `prompt_versions` seed absent.

### Q4 — DealContext 24h cache hit verification

```sql
SELECT deal_id, field_path, source_label, updated_at
FROM deal_context_fields ORDER BY updated_at DESC LIMIT 5;
```

```
deal_id                              | field_path                       | source_label   | updated_at
-------------------------------------+----------------------------------+----------------+----------------------------
8aa4c42a-9f1f-47ba-b9d4-9def37b0b323 | backtest.median_irr_accuracy    | agent:research | 2026-04-30T00:23:38.704Z
8aa4c42a-9f1f-47ba-b9d4-9def37b0b323 | backtest.outperformance_rate    | agent:research | 2026-04-30T00:23:38.700Z
8aa4c42a-9f1f-47ba-b9d4-9def37b0b323 | market_events.key_opportunities | agent:research | 2026-04-30T00:23:38.700Z
8aa4c42a-9f1f-47ba-b9d4-9def37b0b323 | market_events.net_sentiment     | agent:research | 2026-04-30T00:23:38.700Z
8aa4c42a-9f1f-47ba-b9d4-9def37b0b323 | market_events.upcoming_count    | agent:research | 2026-04-30T00:23:38.700Z
```

**UNVERIFIABLE.** `agent-delegator.ts:buildRuntimeInput()` does not read `deal_context_fields` at all — the cache path does not exist. The question of cache hits is moot.

---

## Watch-Item Findings

### CoStar Leak Check

`fetch_costar_metrics` routes through internal `platformClient` to `/supply/deals/:dealId/supply` then `/supply/msa/:msaId` (`fetch_costar_metrics.ts:90`). It does not call CoStar's API directly. The tool has no `scope_id` check and writes results to `deal_context_fields` with `source_label: 'agent:research'` — no licensing provenance tag. Whether the underlying supply endpoints are CoStar-sourced cannot be determined from tool code alone.

**Verdict: UNVERIFIED.** Scope_id gate is absent at the tool layer. If the supply service is CoStar-backed, CoStar-derived values flow into deal context without any licensing barrier. Needs supply service trace in a future audit (A10 licensing sweep).

### FL Hardcoding

No `if (state === 'FL')` or equivalent jurisdiction branch found in `backend/src/agents/` tool files. Jurisdiction-specific behavior is expressed in prompt text (`cashflow/system.ts:1042`) and routed through dedicated ruleset tools (`fetch_jurisdiction_tax_forecast`, `fetch_jurisdiction_insurance_forecast`) that accept `stateCode` as a parameter.

**Verdict: PASS.**

### Tavily as Primary

`web_search.ts:111` tool description: *"Use ONLY when structured data tools cannot answer the question."* This is a prompt-level instruction to the LLM — not a code gate. The model could call `web_search` first if the system prompt allows it. No code-level enforcement orders structured tools before web search.

**Verdict: PARTIAL** — policy exists in prompt; code does not enforce ordering.

### dealStore Bypass

Chat surface is pure backend → JSON. No React components or frontend state in the chat path.

**Verdict: N/A** — skip per dispatch instructions.

---

## Failure-Mode Findings

### FM-1 — Vendor API failure (partial DealContext written as complete)

**PARTIAL HANDLING**

Each tool degrades gracefully on its own: `fetch_parcel` returns empty row on 404, `fetch_costar_metrics` falls to a stub (line 132–139), `fetch_ownership` returns `{ available: false }`. Tools do not throw — they return empty/partial outputs.

**Gap:** `deal_context_fields` rows carry no "incomplete" or "degraded" flag. A DealContext assembled from stub outputs is indistinguishable from one assembled from live data. Downstream agents reading these rows silently consume partial context as complete. This is the no-silent-stale violation: partial context is consumed as whole.

Evidence: `write_dealcontext.ts:95-114` — ON CONFLICT DO UPDATE with no quality flag column.

### FM-2 — Agent run error (partial DealContext + run status)

**HANDLED (with caveat)**

`AgentRuntime.ts:452-461` — catch block sets `status = 'failed'` or `'budget_exceeded'`. Caught exceptions never leave a run in `running`.

**Caveat:** 13 confirmed stuck `running` rows from April 2026. These represent a kill-path the catch block cannot handle — a process-level crash or Inngest worker restart that killed the step before the catch fired. The DB row stays `running` permanently.

### FM-3 — Inngest retry double-charge

**HANDLED for succeeded runs / GAP for failed runs**

`research.inngest.ts:122-148` — idempotency guard checks for prior `status='succeeded'` run keyed on `inngest_event_id`. If found, returns cached output — no re-billing.

**Gap:** Guard only checks `status='succeeded'`. A run that fails on all 3 retry attempts executes AgentRuntime three times, creating three `agent_runs` rows. Currently all recent failures accrue `cost_usd = $0.0000` (failing before model call), so financial impact is zero in practice — but the structural exposure exists for any failure mode that accrues cost before crashing.

### FM-4 — LLM / Tavily failure mid-run

**HANDLED**

- DeepSeek API failure: AgentRuntime catch → `status='failed'`. Inngest retries up to 3×.
- Tavily unavailable: `web_search.ts:128` returns `{ results: [], error: 'search_unavailable' }` without throwing.
- Chat surface: `chat.routes.ts:22-26` catches all errors, returns `{ error: 'Failed to process message. Please try again.' }`. No stack trace exposure.

`unified-orchestrator.ts:235` returns `"I ran into an issue: ${error.message}"` — but the orchestrator is orphaned from the chat surface, so this message path is currently unreachable.

### FM-5 — Timeout

**UNHANDLED — LAUNCH BLOCKER**

No timeout mechanism exists in `AgentRuntime.ts`, `research.inngest.ts`, or `BudgetEnforcer.ts`. No `timeoutMs`, `AbortSignal`, or `cancelOn` anywhere in the Research Agent execution path.

Evidence: 13 `agent_runs` rows with `status='running'` dating from 2026-04-27 to 2026-04-28. As of 2026-06-22, these are ~55–56 days old and will never transition.

**User impact:** Silence. No timeout message. No credit refund. Run remains `running` indefinitely with no cleanup path.

### FM-6 — Concurrency

**HANDLED for Inngest / UNVERIFIED for direct API**

- Inngest path: `research.inngest.ts:59-62` — `concurrency: { limit: 1, key: 'event.data.dealId' }`. Per-deal execution is serialized.
- Direct API path: `AgentRuntime.ts:319` uses `dealRunStartLimiter.acquire(ctx.dealId)` — in-process per-deal rate limiter (max 3 starts/60s window).
- Separate deals on same submarket: no shared mutable state (all writes are deal-scoped to `deal_context_fields(deal_id, field_path)`). No write collision risk.

---

## Doc-vs-Code Gaps

| Spec claim | Reality |
|---|---|
| `research.config.ts` header: "Tools registered: …" (8 tools) | Actual registry: **24 tools**. Comment stale by 16 tools. |
| Dispatch doc: Inngest at `src/agents/inngest/research.function.ts` OR `src/inngest/functions/research.function.ts` | Actual path: `backend/src/agents/research.inngest.ts`. Both spec paths are ghost references. |
| Spec: "DealContext 24h cache short-circuits re-run (60–70% credit saving)" | No cache path exists. `agent-delegator.ts:buildRuntimeInput()` does not read `deal_context_fields`. **ABSENT.** |
| Spec: "Telegram is live" | Zero Telegram routes in `backend/src/api/rest/`. **ABSENT.** |
| `research.inngest.ts` comment line 36–40: "basic → blocked (manual trigger only)" | `ALLOWED_TIERS` array at line 41–47 includes `'basic'`. Comment contradicts code. |
| Spec: agents run tools against live sources | 84% of Research runs fail with zero steps — agent is not reaching tools at all in most cases. |
