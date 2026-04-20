# JediRE Agent Platform — Operations Runbook

Last updated: 2026-04-20
Platform: Agent Runtime Phases 1–5

---

## Overview

JediRE has five AI agents that run via the AgentRuntime loop (Claude + structured tools):

| Agent | Trigger | Tier Gate |
|-------|---------|-----------|
| Research | `deal.created` (auto), manual | Principal+ (professional/enterprise) |
| Zoning | `deal.created` (auto), manual | Principal+ |
| Supply | `deal.created` (auto), manual | Principal+ |
| CashFlow | `research.completed` (auto), manual | Operator+ (any non-basic tier) |
| Commentary | manual only | any authenticated user |

All runs are recorded in `agent_runs` with full step-level detail in `agent_run_steps`.

---

## 1. Debugging a Failed Agent Run

### Step 1 — Find the run

```sql
-- Recent failed runs
SELECT id, agent_id, deal_id, status, error, started_at, duration_ms
FROM agent_runs
WHERE status IN ('failed', 'budget_exceeded', 'aborted')
ORDER BY started_at DESC
LIMIT 20;
```

### Step 2 — Read the error field

The `error` column in `agent_runs` contains the exception message and stack trace that caused the failure.

Common errors:
- `BudgetExceededError` — the run hit the per-run or per-deal-per-day cost cap (see §3)
- `AnthropicError: rate_limit_exceeded` — Anthropic API rate limit; the run will retry via Inngest
- `Tool execution failed` — one of the agent tools (fetch_parcel, write_zoning_analysis, etc.) threw; check step log
- `No active prompt version found` — `prompt_versions` has no `active = true` row for this agent; re-run seed

### Step 3 — Inspect step-level detail

```sql
-- All steps for a specific run
SELECT step_index, step_type, tool_name, duration_ms,
       jsonb_pretty(payload) AS payload
FROM agent_run_steps
WHERE agent_run_id = '<run_id>'
ORDER BY step_index ASC;
```

Steps have `step_type` of either `model_call` or `tool_call`. Look for the last `tool_call` before the failure — the `payload` column shows the tool input and (if present) error output.

### Step 4 — Check the audit log

```sql
SELECT action, metadata, created_at
FROM audit_log
WHERE agent_run_id = '<run_id>';
```

### Admin API

GET `/api/v1/admin/agents/recent-runs?agent_id=cashflow&limit=50` — filtered run table.
GET `/api/v1/admin/agents/stats` — per-agent success rate, p50/p99 latency, costs.

---

## 2. Rolling Back a Prompt

If a new prompt version causes quality regressions or runtime errors, roll back using the following procedure.

### Step 1 — Identify versions

```sql
SELECT id, agent_id, version, prompt_type, active, created_at
FROM prompt_versions
WHERE agent_id = 'cashflow'   -- replace with target agent
ORDER BY created_at DESC;
```

Note the `id` of the version to restore (e.g. `cashflow-v3-core`).

### Step 2 — Run the rollback script

```bash
psql $DATABASE_URL -f backend/scripts/rollback-prompt.sql
```

Edit the script to set `<AGENT_ID>` and `<ROLLBACK_VERSION_ID>` before running.  
The script is transactional — both UPDATE statements succeed or neither does.

### Step 3 — Verify

```sql
SELECT id, version, prompt_type, active
FROM prompt_versions
WHERE agent_id = 'cashflow'
ORDER BY active DESC, created_at DESC;
```

The rollback version should show `active = true`. All subsequent agent runs for that agent will load the restored prompt.

### Re-seeding

To restore the latest prompt versions (e.g. after a bad rollback), restart the server — startup seeding (`seedAllAgentPrompts`) runs automatically and will re-activate the current canonical versions.

---

## 3. Quarantining a Misbehaving Agent

Use this when an agent is consistently failing, generating bad outputs, or consuming excessive budget.

### Option A — Disable Inngest auto-trigger (preferred)

The fastest quarantine is to comment out or delete the `createFunction` export in the agent's Inngest file and restart the server. The agent can still be triggered manually via `POST /api/v1/agents/<agentId>/run` for controlled testing.

Agents and their Inngest files:
- Research: `backend/src/agents/research.inngest.ts`
- Zoning: `backend/src/agents/zoning.inngest.ts`
- Supply: `backend/src/agents/supply.inngest.ts`
- CashFlow: `backend/src/agents/cashflow.inngest.ts`
- Commentary: `backend/src/agents/commentary.inngest.ts`

### Option B — Raise the daily deal cost cap to $0

Set `maxCostUsdPerDealPerDay: 0` in the agent's runtime config. `BudgetEnforcer.check()` will immediately throw `BudgetExceededError` on every new run attempt, halting the agent without changing code.

### Option C — Deactivate the prompt

```sql
UPDATE prompt_versions
SET active = false
WHERE agent_id = 'cashflow';
```

With no active prompt, AgentRuntime will throw `No active prompt version found` before making any model call. This prevents token spend while you investigate.

---

## 4. Interpreting the Admin Stats Dashboard

The `/admin` → **Agents** tab fetches from `GET /api/v1/admin/agents/stats`.

| Column | Meaning |
|--------|---------|
| `total_runs` | All-time run count for this agent |
| `runs_last_30d` | Runs in the past 30 days |
| `runs_last_1d` | Runs in the past 24 hours |
| `success_rate_pct` | % of all-time runs with `status = 'succeeded'` |
| `p50_duration_ms` | Median run duration across all statuses |
| `p99_duration_ms` | 99th-percentile run duration (watch for LLM timeout outliers) |
| `total_cost_usd` | Cumulative Claude API cost for this agent |
| `cost_usd_30d` | Cost in the past 30 days |
| `active_prompts` | Active `prompt_versions` rows (one per `prompt_type`) |

### Healthy baseline targets (approximate)

| Agent | p50 duration | Success rate |
|-------|-------------|--------------|
| Research | 60–120 s | > 85% |
| Zoning | 30–90 s | > 90% |
| Supply | 30–60 s | > 90% |
| CashFlow | 90–180 s | > 80% |
| Commentary | 20–60 s | > 90% |

If `success_rate_pct` drops below 70% or `p99_duration_ms` exceeds 5 min, investigate using the step-level debug procedure in §1.

---

## 5. Tier Gating Reference

### Auto-trigger tiers (Inngest functions)

| Tier string | Research | Zoning | Supply | CashFlow |
|-------------|----------|--------|--------|----------|
| `basic` | blocked | blocked | blocked | blocked |
| `operator` | blocked | blocked | blocked | allowed |
| `professional` | allowed | allowed | allowed | allowed |
| `enterprise` | allowed | allowed | allowed | allowed |

CashFlow uses `getAllowedTriggerModes(tier)` from `cashflow.config.ts`:
- `operator`+ → `event-driven` mode allowed
- `basic` → manual-only

### Manual trigger (all tiers)

Any authenticated user can manually trigger any agent via `POST /api/v1/agents/:agentId/run`. Tier gating only controls automatic Inngest-triggered runs.

---

## 6. Budget Cap Configuration

Budget caps are set per-agent in each agent's runtime config (e.g. `cashflow.config.ts`, `research.config.ts`):

```ts
budgetCaps: {
  maxCostUsdPerRun: 0.50,      // hard per-run cap
  maxCostUsdPerDealPerDay: 2.00 // daily cap across all agents for a deal
}
```

BudgetEnforcer checks:
1. Pre-flight: daily deal spend vs. `maxCostUsdPerDealPerDay`
2. Intra-loop: accumulated run cost vs. `maxCostUsdPerRun` (checked before each model call)
3. Search cap: web_search call count vs. `AGENT_SEARCH_CONFIG[agentId].maxSearchesPerRun`

To verify enforcement is working: `GET /api/v1/admin/agents/test-budget-cap` (dev/staging only).

---

## 7. Concurrency Rate Limiting

`MeteringAdapter` enforces a per-deal concurrency cap of **3 simultaneous model calls** per deal. Additional calls are queued (not rejected) and proceed as slots free up. Queued calls time out after 30 s and throw an error that is logged but does not set `budget_exceeded` status.

This prevents thundering-herd bursts when multiple Inngest functions fire simultaneously on a single deal (e.g., after `deal.created` triggers Research + Zoning + Supply in parallel).

---

## 8. Nightly Archive Aggregation

The CashFlow archive feedback loop runs nightly at 02:00 UTC (Inngest cron):
- Aggregates closed deal underwriting assumptions into `archive_assumption_benchmarks`
- Two-level aggregation: per-deal median → per-bucket median
- ON CONFLICT DO UPDATE for idempotent nightly upserts
- Operator+ users see P10-P90 percentile context in the EvidencePanel
