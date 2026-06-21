# S1 Chat Launch Chain Audit

**Commit SHA:** `39f8cfa0d`
**Date:** 2026-06-21
**READ-ONLY — no code changed.**

---

## Chain Verdict

**BROKEN-AT-HOP-3**

The dispatch wiring from ingress to research execution is structurally present, but every
user-triggered Research Agent run since May 2026 fails immediately at 0 tokens / 4 ms with
a Zod schema marshaling crash before any LLM call is made. The last succeeded research run
was 2026-04-30. Hops 4–6 are moot until Hop 3 is fixed. Hops 7–8 (synthesis + egress)
are WIRED and would function if a research result existed.

---

## Hop Table

| Node | Label | Evidence | Note |
|------|-------|----------|------|
| **Hop 1 — Telegram ingress** | WIRED | `index.replit.ts:381-383`: `const messageRouter = new MessageRouter(); app.use('/', messageRouter.createRouter())`. `messageRouter.ts:49-50` mounts `POST /webhooks/telegram` → `handleTelegram()` → `unifiedOrchestrator.process()` at line 199. | Live |
| **Hop 1 — Twilio/WhatsApp ingress** | WIRED | `messageRouter.ts:46-47` mounts `POST /webhooks/twilio` → `handleTwilio()` → `unifiedOrchestrator.process()` at line 116. | Same orchestrator entry point as Telegram |
| **Hop 2 — Intent extraction (NLU)** | WIRED | `unified-orchestrator.ts:140`: `intentClassifier.classify(request.message, {...})`. `intent-classifier.ts:208`: detects `full_analysis` for address messages. `intent-classifier.ts:231-232`: defaults `specialists: ['RESEARCH','ZONING','SUPPLY','CASH']` when `full_analysis` fires with no explicit triggers. `unified-orchestrator.ts:162`: `agentDelegator.delegate({intent, ...})`. | Claude-backed with regex fallback |
| **Hop 2 — AICoordinator (`coordinator.ts`)** | ORPHANED | Zero inbound imports from `unified-orchestrator.ts` or `index.replit.ts`. `unified-orchestrator.ts:5`: "Replaces both AICoordinator and the original orchestrator.service." | Was the active path; replaced without porting DealContext handoff design |
| **Hop 3 — Dispatch → Research** | PARTIAL | `coordinator/dispatch.ts:53-56`: `INTENT_DISPATCH.RESEARCH = { agentId:'research', runtime: researchRuntime }`. `agent-delegator.ts:153-219`: calls `dispatch.runtime.run(input, runCtx)`. Wiring is present. Runtime crashes immediately — see Break List. | |
| **Hop 3 — `deal.created` Inngest trigger** | ORPHANED from chat | `inline-deals.routes.ts:630-631` emits `deal.created` on web-app deal creation; `research.inngest.ts` fires on it. Chat path never emits this event — it uses AgentDelegator direct dispatch only. | Separate trigger path; not chat |
| **Hop 4 — Research tool execution (all tools)** | BROKEN | DB: all 861 user-triggered research runs fail at 0 tokens / 4 ms. Error (3 recent samples): `"Cannot use 'in' operator to search for '_idmap' in undefined"`. No LLM call is made; no tool is invoked. `agent_run_steps` for recent runs: empty. | Blocked by Hop 3 crash |
| **Hop 4 — `fetch_parcel`** | WIRED (unexercised) | `fetch_parcel.ts:108,133`: reads from `platform_api` via internal DB query. Registered at `research.config.ts:79`. | Cannot confirm in production due to Hop 3 crash |
| **Hop 4 — `fetch_costar_metrics`** | PARTIAL (unexercised) | `fetch_costar_metrics.ts:90-132`: Path 1 reads from `/supply/deals/:dealId/supply` (internal). Path 2 reads from `/market/inventory/:city/:state`. Returns explicit stub on double failure (`fetch_costar_metrics.ts:132-139`). Registered at `research.config.ts:80`. | See CoStar watch item below |
| **Hop 4 — `fetch_tax_bill`** | WIRED (unexercised) | Registered at `research.config.ts:81`. No stub/mock pattern in file header. | |
| **Hop 4 — `fetch_comps`** | WIRED (unexercised) | Registered at `research.config.ts:82`. | |
| **Hop 4 — `fetch_ownership`** | WIRED (unexercised) | Registered at `research.config.ts:83`. | |
| **Hop 4 — `write_dealcontext`** | WIRED | `write_dealcontext.ts`: real `INSERT … ON CONFLICT DO UPDATE` into `deal_context_fields`. DB: 2 deals with 45–47 field rows each, `source_label:'agent:research'`, last write 2026-04-30. `agent_run_steps`: tool_result rows for `write_dealcontext` with 19-20 ms duration and real field payloads (`backtest.median_irr_accuracy`, `proximity.school_grade`, `market_events.*`). | Last exercised 2026-04-30 |
| **Hop 4 — `web_search` (Tavily)** | PARTIAL (unexercised) | `web_search.ts:5,111`: declared fallback-only. Registered at `research.config.ts:85`. Requires `TAVILY_API_KEY` env var — not confirmed set. | See Tavily watch item |
| **Hop 4 — `fetch_webpage`** | WIRED (unexercised) | `fetch_webpage.ts:128-131`: real HTTP fetch with scheme enforcement. Registered at `research.config.ts:86`. | |
| **Hop 4 — `fetch_county_records`** | ORPHANED | File exists in `backend/src/agents/tools/` but NOT imported or registered in `research.config.ts`. Spec lists it as a Research tool. | Doc-vs-code gap |
| **Hop 4 — `fetch_rentcast_comps`** | ORPHANED | Same: file exists but not in `research.config.ts`. | Doc-vs-code gap |
| **Hop 4 — `fetch_fred_indicators`** | ABSENT | Name does not exist in `agents/tools/`. Closest file is `fetch_market_trends.ts`, which is also not in the research registry. | Doc-vs-code gap — spec name is wrong |
| **Hop 4 — `fetch_google_places_reviews`** | ABSENT | No file by this name in `backend/src/agents/tools/`. | ABSENT |
| **Hop 5 — `write_dealcontext` DB write** | WIRED | `deal_context_fields` table: 2 deals × 45-47 fields, `source_label:'agent:research'`. `agent_run_steps` confirms real tool invocations with sub-20 ms DB writes and real field paths. | Last exercised 2026-04-30 |
| **Hop 6 — Analytical agents receive pre-assembled DealContext** | ABSENT | `agent-delegator.ts:256` `buildRuntimeInput()` constructs params from intent fields + `getDealFinancialContext()`. No read from `deal_context_fields`. ZONING/SUPPLY/CASH each independently re-query their own data. | Pre-assembled DealContext handoff only existed in the now-ORPHANED `coordinator.ts` |
| **Hop 6 — 24h DealContext cache short-circuit** | ABSENT from chat path | `research.inngest.ts:121-146`: cache exists in the Inngest path (step idempotency on `inngest_event_id`). Zero references to a 24h cache in `unified-orchestrator.ts` or `agent-delegator.ts`. | Only in the Inngest trigger path; not chat |
| **Hop 7 — Synthesis** | WIRED | `unified-orchestrator.ts:170`: `responseSynthesizer.synthesize(intent, delegationResults, {...})`. `response-synthesizer.ts:83`: Claude-backed synthesis. `response-synthesizer.ts:353`: text fallback if Claude fails. | |
| **Hop 8 — Egress — Telegram** | WIRED | `messageRouter.ts:209`: `sendTelegramReply(tgMsg.chat.id, response)` → `messageRouter.ts:283-300` → `sendTelegramText(chatId, ...)`. | |
| **Hop 8 — Egress — Twilio/WhatsApp** | WIRED | `messageRouter.ts:94,126`: `sendTwilioReply(Author, ConversationSid, response.text)` → `messageRouter.ts:135-154`. | |

---

## Break List (earliest first)

### #1 — HOP-3 LAUNCH BLOCKER: Research runtime crashes before LLM call
**Severity: P0**

All user-triggered Research Agent runs fail immediately. DB evidence:

```
agent_id | status    | count
---------+-----------+------
research | failed    |   861
research | running   |    13
research | succeeded |   159
```

All 10 most-recent runs (May 2026): `tokens_in: 0, cost_usd: 0.0000, duration_ms: 4-7`.
Error message (confirmed on 3 samples):

```
"Cannot use 'in' operator to search for '_idmap' in undefined"
```

This is a Zod schema marshaling failure inside `AgentRuntime` before the first tool call.
No LLM is invoked. Everything downstream (Hops 4–6) is unreachable.

---

### #2 — HOP-6: Pre-assembled DealContext not forwarded to analytical agents
**Severity: P1**

ZONING, SUPPLY, and CASH agents in the `unified-orchestrator` path receive
`buildRuntimeInput()` output (intent fields + financial context) — not a pre-assembled
DealContext from `deal_context_fields`. Each agent independently re-queries its own data.
No 24h cache short-circuit exists in the unified-orchestrator path. This is architectural
drift from the `coordinator.ts` design (which did this correctly but is now orphaned).

---

### #3 — HOP-3/6: AICoordinator (`coordinator.ts`) is orphaned from the live path
**Severity: P1**

`AICoordinator` had the correct design: research → DealContext → parallel analytical agents
receiving the pre-assembled context (`coordinator.ts:327-338`). `unified-orchestrator.ts`
replaced it without porting the DealContext handoff. The replacement works for intent
extraction, synthesis, and egress, but the DealContext assembly-and-forward design is gone
from the chat path.

---

### #4 — HOP-4: Four spec'd Research tools are absent from the registry
**Severity: P2**

`fetch_county_records`, `fetch_rentcast_comps` (files orphaned), `fetch_google_places_reviews`
(file absent), and `fetch_fred_indicators` (name wrong in spec) are not in `research.config.ts`.
These tools cannot be called by the Research Agent even if the Hop-3 crash is fixed.

---

## Live-DB Section

**Query 1 — `deal_context_fields` (pre-assembled DealContext records):**
```
SELECT deal_id, count(*) as field_count, max(updated_at) as last_write
FROM deal_context_fields GROUP BY deal_id ORDER BY last_write DESC LIMIT 5;

 deal_id                              | field_count | last_write
--------------------------------------+-------------+----------------------------
 8aa4c42a-9f1f-47ba-b9d4-9def37b0b323 |          45 | 2026-04-30T00:23:38.704Z
 3f32276f-aacd-4da3-b306-317c5109b403 |          47 | 2026-04-30T00:22:46.262Z
(2 rows)
```
Only 2 deals have DealContext records. Both from April 2026. No records since.

---

**Query 2 — `agent_runs` status distribution:**
```
SELECT agent_id, status, count(*) FROM agent_runs GROUP BY 1,2 ORDER BY 1,2;

 agent_id  |  status   | count
-----------+-----------+-------
 cashflow  | failed    |   127
 cashflow  | running   |   120
 cashflow  | succeeded |   705
 commentary| failed    |    51
 commentary| running   |    30
 commentary| succeeded |  1284
 pipeline  | failed    |    14
 pipeline  | partial   |   667
 pipeline  | running   |   255
 pipeline  | succeeded |    67
 research  | failed    |   861
 research  | running   |    13
 research  | succeeded |   159
 supply    | failed    |    59
 supply    | running   |    34
 supply    | succeeded |   878
(16 rows)
```
Research failure rate: 84% (861/1020 terminal). All other agents have healthy success rates.

---

**Query 3 — `agent_run_steps` for a succeeded research run (deal `8aa4c42a`, 2026-04-30):**

`agent_run_steps` columns: `id, agent_run_id, step_index, step_type, tool_name, payload, tokens_in, tokens_out, duration_ms, created_at`

```json
[
  { "step_type": "prompt",      "tool_name": null,              "tokens_in": 15872, "tokens_out": 457, "duration_ms": null },
  { "step_type": "tool_result", "tool_name": "write_dealcontext","duration_ms": 19,
    "payload": "{\"deal_id\":\"8aa4c42a...\",\"success\":true,\"field_path\":\"backtest.median_irr_accuracy\",...}" },
  { "step_type": "tool_result", "tool_name": "write_dealcontext","duration_ms": 19,
    "payload": "{\"field_path\":\"backtest.outperformance_rate\",...}" },
  { "step_type": "tool_result", "tool_name": "write_dealcontext","duration_ms": 20,
    "payload": "{\"field_path\":\"market_events.upcoming_count\",...}" },
  { "step_type": "tool_result", "tool_name": "write_dealcontext","duration_ms": 19,
    "payload": "{\"field_path\":\"market_events.key_risks\",...}" },
  { "step_type": "tool_result", "tool_name": "write_dealcontext","duration_ms": 19,
    "payload": "{\"field_path\":\"market_events.net_sentiment\",...}" },
  { "step_type": "tool_result", "tool_name": "write_dealcontext","duration_ms": 19,
    "payload": "{\"field_path\":\"market_events.key_opportunities\",...}" },
  { "step_type": "tool_result", "tool_name": "write_dealcontext","duration_ms": 19,
    "payload": "{\"field_path\":\"proximity.school_grade\",...}" }
]
```
Real tool calls with real payloads. The runtime worked correctly in April 2026.
Something introduced the `_idmap` crash between 2026-04-30 and 2026-05-20.

---

**Query 4 — DealContext cache hit evidence:**

10 most-recent research runs (all May 2026):
```
tokens_in: 0, cost_usd: 0.0000, duration_ms: 4-7, status: failed
```
All failures — no succeeded runs exist in the May–June window. Cache-hit verification
is structurally impossible: there are no recent successes to compare against.
The Inngest-path idempotency cache (`research.inngest.ts:121-146`) is present in code but
unexercisable while the runtime crashes at input validation.

---

## Watch-Item Findings

### CoStar Leak
`fetch_costar_metrics` reads from `/supply/deals/:dealId/supply` and
`/market/inventory/:city/:state` — both internal JediRE endpoints, not the CoStar API
directly. Output is returned to the agent in-context only; no write to
`historical_observations` or any shared corpus occurs in this tool.
**VERDICT: No direct CoStar-to-GLOBAL-scope leak in this chain.** If CoStar data enters
JediRE's supply service upstream, that is outside this chain's scope.

### FL Hardcoding
Zero hits for `state === 'FL'` or equivalent in `coordinator.ts`,
`unified-orchestrator.ts`, `agent-delegator.ts`, `messageRouter.ts`, `research.agent.ts`,
`research.inngest.ts`, `research.config.ts`. **CLEAN.**

### Tavily as Primary
`web_search.ts:5`: "Always use structured data tools first — web_search is a fallback."
Tool description (`web_search.ts:111`): "Use ONLY when structured data tools cannot answer."
**CLEAN** — fallback-only by design and by description. Agent system prompt reinforces this.

### dealStore Bypass
The chat surface is pure backend → channel (Telegram/WhatsApp/SMS). No frontend web
components are rendered in this path. **NOT APPLICABLE.**

---

## Doc-vs-Code Gaps

| Gap | Spec claims | Reality |
|-----|-------------|---------|
| Inngest path (Spec 1) | `AGENT_PLATFORM_SPEC.md`: `src/agents/inngest/research.function.ts` | **ABSENT** — path does not exist |
| Inngest path (Spec 2) | `REPLIT_AGENT_IMPLEMENTATION_PROMPT.md`: `src/inngest/functions/research.function.ts` | **ABSENT** — path does not exist |
| Inngest actual path | (not documented in either spec) | `backend/src/agents/research.inngest.ts` — WIRED, registered at `index.replit.ts:237` |
| Active chat orchestrator | Spec/docs treat `coordinator.ts` (AICoordinator) as the active path | ORPHANED — replaced by `unified-orchestrator.ts`; zero inbound callers in live path |
| 24h DealContext cache | Described as "60-70% credit-saving" path on the chat surface | EXISTS in Inngest path only (`research.inngest.ts:121-146`); **ABSENT from unified-orchestrator chat path** |
| `fetch_county_records` | Listed in Agent Platform Spec as a Research tool | File exists in `agents/tools/`, **not in `research.config.ts`** (ORPHANED) |
| `fetch_rentcast_comps` | Listed in spec as a Research tool | File exists in `agents/tools/`, **not in `research.config.ts`** (ORPHANED) |
| `fetch_fred_indicators` | Listed in spec as a Research tool | No file by this name; closest is `fetch_market_trends.ts`, also not registered |
| `fetch_google_places_reviews` | Listed in spec as a Research tool | **ABSENT** — no file by this name in `backend/src/agents/tools/` |
| Agent trigger route | Spec: `/api/agents/research/run` | Not found; actual manual trigger is `POST /api/v1/agents/tasks` (`agent.routes.ts:21`) |
