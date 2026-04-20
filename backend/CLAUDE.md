# JediRE Backend — Architecture Guide

## Overview

JediRE is a Bloomberg Terminal-style real estate intelligence platform. The backend is a Node.js/TypeScript Express API that combines structured market data, AI-powered analysis, and a real-time coordinator. The server entry point is `src/index.replit.ts`.

---

## Agents vs Intents vs Personas

The AI layer has three distinct layers. Understanding the distinction prevents misclassification and guides when to promote a capability to a higher layer.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1 — 5 AgentRuntime Agents  (tool-calling loop, DB row, cost) │
│  research · zoning · supply · cashflow · commentary                  │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2 — 10 Routing Specialists  (intent label → dispatch target) │
│  RESEARCH · ZONING · SUPPLY · CASH (→ agent)                        │
│  DEMAND · COMPS · RISK · DEBT · NEWS · STRATEGY (→ LLM + fragment) │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 3 — 16 Analyst Personas  (voice prefix injected into prompt) │
│  CFO · ACCOUNTANT · MARKETING · DEVELOPER · LEGAL · LENDER          │
│  ACQUISITIONS · ASSET_MANAGER · PROPERTY_MANAGER · LEASING          │
│  FACILITIES · INVESTMENT_ANALYST · ESG · COMPLIANCE · TAX · RESEARCHER│
└─────────────────────────────────────────────────────────────────────┘
```

### Layer 1 — AgentRuntime Agents (5 agents)

Full agentic execution: tool-calling loop, `agent_runs` DB row, budget enforcement, per-deal rate limiting, and a versioned prompt in `agent_prompt_versions`.

| Agent ID    | Config file                  | Inngest trigger                   |
|-------------|------------------------------|-----------------------------------|
| research    | `agents/research.config.ts`  | `agents/research.inngest.ts`      |
| zoning      | `agents/zoning.config.ts`    | `agents/zoning.inngest.ts`        |
| supply      | `agents/supply.config.ts`    | `agents/supply.inngest.ts`        |
| cashflow    | `agents/cashflow.config.ts`  | `agents/cashflow.inngest.ts`      |
| commentary  | `agents/commentary.config.ts`| `agents/commentary.inngest.ts`    |

**Graduation criteria** for promoting a Layer 2 specialist to Layer 1:
1. 30-day usage data shows ≥ 200 calls/month that would benefit from tool access (DB reads, web search, structured output parsing).
2. A dedicated prompt version and schema can be defined independently of the general coordinator prompt.
3. The cost of an agentic loop (token usage + rate limiting overhead) is justified by output quality improvement over a context-fragment approach.

### Layer 2 — Routing Specialists / Intent Labels (10 specialists)

The `AICoordinator` classifies each user question into one of 10 specialist intents. The `INTENT_DISPATCH` table in `src/coordinator/dispatch.ts` routes each intent to either a Layer 1 agent or a context fragment injected into the general LLM handler.

| Specialist | Dispatch type | Target                          |
|------------|---------------|---------------------------------|
| RESEARCH   | agent         | `researchRuntime`               |
| ZONING     | agent         | `zoningRuntime`                 |
| SUPPLY     | agent         | `supplyRuntime`                 |
| CASH       | agent         | `cashflowRuntime`               |
| DEMAND     | fragment      | `demand` context fragment       |
| COMPS      | fragment      | `comps` context fragment        |
| RISK       | fragment      | `risk` context fragment         |
| DEBT       | fragment      | `debt` context fragment         |
| NEWS       | fragment      | `news` context fragment         |
| STRATEGY   | fragment      | `strategy` context fragment     |

These are **not agents** — they are routing labels. Do not add `agent_prompt_versions` rows or `users` service accounts for Layer 2 specialists.

### Layer 3 — Analyst Personas (16 personas)

Persona voice prefixes are injected into the system prompt to shift the analytical perspective. Defined in `src/coordinator/personas/index.ts`.

CFO · Accountant · Marketing · Developer · Legal · Lender · Acquisitions · Asset Manager · Property Manager · Leasing · Facilities · Investment Analyst · ESG · Compliance · Tax · Researcher

Personas are **not agents and not routing specialists**. They change the tone and emphasis of a response, not the data source or tool set used.

---

## Directory Structure

```
backend/
├── src/
│   ├── agents/
│   │   ├── runtime/           # AgentRuntime, MeteringAdapter, BudgetEnforcer, job-queue
│   │   ├── seeds/             # Startup prompt seeding (seedAllAgentPrompts)
│   │   ├── research.config.ts / research.agent.ts / research.inngest.ts
│   │   ├── zoning.*  supply.*  cashflow.*  commentary.*
│   ├── coordinator/
│   │   ├── dispatch.ts        # INTENT_DISPATCH + TASK_TYPE_RUNTIME_MAP (authoritative)
│   │   ├── personas/index.ts  # 16 analyst persona definitions
│   │   └── ...
│   ├── services/
│   │   ├── metricRecommendation.service.ts   # NOT a Layer 1 agent
│   │   ├── orchestrator/                     # UnifiedOrchestrator (chat routing)
│   │   └── ...
│   └── api/rest/
│       ├── agent.routes.ts    # REST task submission → AgentJobQueue
│       ├── admin.routes.ts    # Admin stats, recent-runs, budget-cap smoke test
│       └── ...
├── docs/
│   └── agent-runbook.md       # Ops runbook: rollback, quarantine, debug
└── scripts/
    ├── rollback-prompt.sql    # Prompt rollback helper
    └── test-agent-admin-smoke.sh
```

---

## Startup Sequence

1. `seedAllAgentPrompts()` — idempotent `ON CONFLICT DO NOTHING` seed for all 5 agent prompts, runs before the server listens.
2. Express server binds to `0.0.0.0:4000`.
3. `AgentJobQueue` polling loop starts (5-second interval, `agent_tasks` table).
4. Scheduled pipelines (M28 data ingestion, M35 divergence jobs) register their cron timers.

---

## Key Conventions

- **AgentRuntime** is the only correct mechanism for Layer 1 agent execution. Never call Anthropic SDK directly in Inngest functions or route handlers.
- **Budget enforcement** happens inside `AgentRuntime.run()` via `BudgetEnforcer`. The per-run cap and per-day cap are set in `AgentConfig.budgetCaps`.
- **Prompt rollback** is safe at any time. Deactivating all versions causes AgentRuntime to fall back to a built-in generic prompt — it does not hard-fail.
- **`MetricRecommendationService`** in `src/services/` is a retrieval + ranking service, not an agent. It has no tool-calling loop and no `agent_prompt_versions` row.
- **`INTENT_DISPATCH`** and **`TASK_TYPE_RUNTIME_MAP`** in `coordinator/dispatch.ts` are the single source of truth for routing. Duplicate maps elsewhere should be removed.
