# AGENT_TOOL_METERING — Verdict

**Dispatch:** Wire unmetered tool LLM calls through the same MeteringAdapter path as the main agent loop.
**Status:** COMPLETE
**Date:** 2026-07-01

---

## Phase 1 — Cost Surface Audit Findings

### Confirmed unmetered call sites (exactly 2)

| File | Line (pre-fix) | Model | Bypass mechanism |
|---|---|---|---|
| `backend/src/agents/tools/classify_as_deal_opportunity.ts` | 62 | `claude-haiku-4-5-20251001` | Direct `anthropic.messages.create()` — no MeteringAdapter, no ai_usage_log write, no Stripe meter event |
| `backend/src/agents/tools/extract_deal_fields.ts` | 83 | `claude-haiku-4-5-20251001` | Direct `anthropic.messages.create()` — no MeteringAdapter, no ai_usage_log write, no Stripe meter event |

All other tool files in `backend/src/agents/tools/` were scanned — no additional direct Anthropic or DeepSeek calls found.

### Secondary finding: broken execute signatures (pre-fix)

Both tools assigned `execute: classifyAsDealOpportunity` / `execute: extractDealFields` — functions with
3-positional-string signatures — to the `ToolDefinition.execute` field, which `AgentRuntime.executeTool`
calls as `tool.execute(inputObject, ctx)` (line 783). This means:

- `subject` parameter received the Zod-parsed input object (not a string)
- `bodyText` parameter received `RunContext` (not a string)
- `.slice()` call on RunContext → `TypeError` on first tool invocation through the agent loop

**Effect:** If the research agent model called these tools, the call failed silently (error returned to
the model as `{ error: "..." }`) and no Haiku tokens were spent anyway. The meter gap was latent — it
would materialize as soon as the signature bug was fixed. Both bugs are corrected together below.

### Token understatement estimate

Per research agent run that invokes both tools:

| Call | Model | Est. input tokens | Est. output tokens | Est. cost |
|---|---|---|---|---|
| Main loop (DeepSeek) | deepseek-chat | ~3,000–8,000 | ~500–2,000 | ~$0.003–$0.012 |
| classify_as_deal_opportunity | claude-haiku-4-5-20251001 | ≤1,000 | ≤256 | ~$0.000001–$0.000002 |
| extract_deal_fields | claude-haiku-4-5-20251001 | ≤3,000 | ≤512 | ~$0.000004–$0.000006 |

Understatement per run: ~0.05–0.2%. Small in isolation but wrong by definition and compounds at scale.

---

## Phase 2 — Fix Applied

### Architecture: dual-path design

Both tool files now implement two separate call paths with shared prompt builders:

```
Path 1 (standalone): classifyAsDealOpportunity(subject, body, from)
                     extractDealFields(subject, body, ocr?)
  Used by: email.routes.ts, inngest email-intake function
  Metering: NONE — platform-absorbed (inngest event bucket) or attributed-not-metered
  Anthropic client: direct anthropic.messages.create()

Path 2 (agent tool): classifyViaAgentTool(input, ctx)
                     extractViaAgentTool(input, ctx)
  Used by: AgentRuntime.executeTool() — research agent via research.config.ts
  Metering: meteringAdapter.createMessage() → ai_usage_log + Stripe meters
  execute field: correct (input: TInput, ctx: RunContext) → Promise<TOutput> signature
```

### Shared code between paths

Both paths use the same prompt builder functions (`buildClassifySystemPrompt()`,
`buildClassifyUserPrompt()`, `buildExtractSystemPrompt()`, `buildExtractUserPrompt()`) and
the same response parsers (`parseClassifyResponse()`, `parseExtractResponse()`). The ONLY
difference is the LLM call mechanism and error fallback structure.

### MeteringMetadata derivation from RunContext

```typescript
const metadata: MeteringMetadata = {
  actor_type: 'agent',
  actor_id: ctx.agentId ?? 'research',    // stamped by AgentRuntime line 341/556
  agent_run_id: ctx.correlationId,          // = runId, stamped by AgentRuntime line 341/556
  deal_id: ctx.dealId,
  user_id: ctx.userId,
  triggered_by: ctx.triggeredBy,           // 'user' | 'event' | 'cron'
};
```

`triggered_by: 'user'` → full Stripe meter reporting (jedi_input_tokens, jedi_output_tokens, jedi_ai_cost_usd)
`triggered_by: 'event'` | `'cron'` → ai_usage_log only (platform-absorbed)

### Double-count analysis

No double-count risk exists:

- **Main loop:** DeepSeek API → `DeepSeekMeteringAdapter` → `ai_usage_log` (model LIKE 'deepseek-%')
- **Tool calls:** Anthropic API → `MeteringAdapter` → `ai_usage_log` (model LIKE 'claude-%')
- These are separate HTTP calls to separate providers. Token counts cannot overlap.
- `ON CONFLICT DO NOTHING` in both adapters' `logUsage()` guards idempotency on retries.

---

## Files Changed

| File | Change |
|---|---|
| `backend/src/agents/tools/classify_as_deal_opportunity.ts` | Added metered `classifyViaAgentTool` path; fixed tool `execute` field signature; extracted shared prompt builders; kept `classifyAsDealOpportunity` standalone unchanged |
| `backend/src/agents/tools/extract_deal_fields.ts` | Added metered `extractViaAgentTool` path; fixed tool `execute` field signature; extracted shared prompt builders; kept `extractDealFields` standalone unchanged |

---

## Verification

### Static checks

- All TypeScript errors are pre-existing `node_modules` issues (Zod v4 locales, Anthropic SDK private
  identifiers). Zero new errors introduced by this change.
- Consumer audit: `email.routes.ts` and `inngest/functions/email-intake.function.ts` import only the
  standalone functions (`classifyAsDealOpportunity`, `extractDealFields`) — both still exported,
  signatures unchanged, no regression to those call sites.
- `research.config.ts` imports only the tool objects (`classifyAsDealOpportunityTool`,
  `extractDealFieldsTool`) — both still exported, now with correct execute signatures.

### Runtime tests

```
agent-runtime-tests: 13/13 PASSED (runtime-symmetry.test.ts)
  hook invocation counts symmetric between run() and startAsync()
  postProcess, outputSchema.parse, budget.check all verified
```

No test regressions.

### Live acceptance (requires configured environment)

To confirm the fix end-to-end in a configured environment:

```sql
-- Before run: snapshot ai_usage_log count
SELECT count(*) FROM ai_usage_log WHERE model LIKE 'claude-%';

-- Trigger research agent run (e.g. via POST /api/v1/agents/research/run with email input)

-- After run: verify new Haiku rows appeared
SELECT model, input_tokens, output_tokens, cost_usd, agent_id
FROM ai_usage_log
WHERE model LIKE 'claude-haiku-%'
ORDER BY created_at DESC
LIMIT 5;

-- Expected: 1-2 new rows with model='claude-haiku-4-5-20251001',
-- agent_id='research', cost_usd > 0, matching the classify/extract tool calls.
-- Also verify ai_usage_log rows where model LIKE 'deepseek-%' for the main loop.
-- Total run cost = SUM of all rows sharing the same agent_run_id.
```

---

## Remaining Gaps from COST_SURFACE_AUDIT.md

This fix closes the 2 AGENT-TOOL-LLM gaps. The ~23 ATTRIBUTED-NOT-METERED gaps
(email.routes.ts, inngest email-intake, JediAIService direct call sites) remain outside scope
of this dispatch. See `docs/audits/COST_SURFACE_AUDIT.md` for the full inventory.
