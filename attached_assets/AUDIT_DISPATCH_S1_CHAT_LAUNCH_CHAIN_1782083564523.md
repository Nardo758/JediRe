# AUDIT DISPATCH — Surface 1 (Chat) Launch Chain

**Mode:** READ-ONLY. You produce a wiring report. You write zero code, run zero migrations,
fix nothing. Any fix you identify goes in the report as a finding, not a commit.

**Scope:** ONE chain only — the conversational (Surface 1) launch path, ingress to synthesis.
Do not wander into Surface 2 (Bloomberg web app), M07 traffic, M22 post-close, or the doc-layer
cleanup. If you find rot outside this chain, log it in a `OUT_OF_SCOPE_NOTES.md` and move on.

**Repo:** `github.com/Nardo758/JediRe.git`. Audit against current `HEAD` — record the commit SHA
at the top of your report.

---

## CARDINAL RULE — read this twice

The spec docs (`AGENT_PLATFORM_SPEC.md`, `REPLIT_AGENT_IMPLEMENTATION_PROMPT.md`,
`AGENT_TASK_INVENTORY.md`, the Master Spec Index, the v2 wiring blueprint) describe what
**should** exist. They are NOT evidence that it does. Neither is:

- `BUILD_STATUS.md`, module-registry `buildStatus` metadata, or any status column in a spec
- a passing unit test (a green test proves the function works, NOT that production calls it)
- a prior agent's self-report

The ONLY acceptable evidence for a status claim is **(a) a code path you can name `file:line`,
traced from caller to callee, or (b) a live DB query result you ran and pasted.** Every row in
your report carries one or the other. A row with a doc citation as its only evidence is rejected.

This is the forceReseed / S1-01 trap. We have been burned by green tests over an unwired
production path before. Trace the actual call graph; do not infer it from file existence.

---

## THE CHAIN — trace these hops in order

Audit the path a user address takes from a chat message to a synthesized reply. Eight hops:

1. **Ingress** — chat message arrives. Telegram is live; WhatsApp-via-Twilio is planned.
   Find the webhook/handler that receives an inbound message and where it hands off.
2. **Coordinator / NLU** — intent + address extraction. Runs in the user's session, executes on
   behalf of the current user, has NO service account. Find where the message becomes a structured
   intent and a deal context (new deal vs existing).
3. **Dispatch → Research Agent** — Coordinator triggers research. Find the trigger: is it the
   Inngest `deal.created` event, a direct `POST /api/agents/research/run` call, or both? Confirm
   which one the chat path actually fires.
4. **Research Agent tool execution** — `src/agents/research.agent.ts` instantiates `AgentRuntime`
   and runs its tools. Confirm the tool registry is real and each tool reaches a live source, not a
   stub or mock fixture.
5. **`write_dealcontext`** — the ONE documented direct-to-service write exception. Confirm it
   writes a real DealContext record and that the record is what downstream agents read.
6. **Analytical agents consume DealContext** — `zoning.agent.ts`, `supply.agent.ts`,
   `cashflow.agent.ts`. Confirm each receives the **pre-assembled** DealContext package rather than
   re-pulling its own data. Confirm the 24h DealContext cache hit path exists and short-circuits a
   re-run (the 60–70% credit-saving path).
7. **Synthesis** — Coordinator collects agent outputs and produces the chat reply. Find where
   agent outputs are gathered and turned into user-facing text.
8. **Egress** — synthesized reply returns to the originating channel (Telegram/WhatsApp).

For each hop, the question is binary and evidence-backed: **does data actually flow from the
previous hop into this one in the running code path, or does it dead-end at a mock/stub/orphan?**

---

## CODE ANCHORS — start here, don't grep blind

- `backend/src/api/rest/index.ts` — ALL route registration is mounted here. Confirm the agent
  routes (`/api/agents/research/run`, `/api/agents/runs/:runId`, `/api/agents/runs/:runId/steps`,
  `/api/deals/:dealId/agent-runs`) are actually registered, not just authored.
- `src/agents/runtime/` — `AgentRuntime.ts`, `ToolRegistry.ts`, `BudgetEnforcer.ts`,
  `MeteringAdapter.ts`. Confirm the runtime is instantiated and called, not dead.
- `src/agents/research.agent.ts` + `src/agents/tools/*` — confirm each Research tool
  (`fetch_parcel`, `fetch_costar_metrics`, `fetch_county_records`, `fetch_rentcast_comps`,
  `fetch_fred_indicators`, `fetch_google_places_reviews`, `web_search`, `write_dealcontext`, etc.)
  resolves to a live integration. Label every tool individually.
- `src/agents/tools/write_dealcontext.ts` — verify the direct-to-service write.
- `src/agents/{zoning,supply,cashflow}.agent.ts` + their prompt/output-schema files.
- The Inngest function file — **path discrepancy to resolve:** `AGENT_PLATFORM_SPEC.md` says
  `src/agents/inngest/research.function.ts`; `REPLIT_AGENT_IMPLEMENTATION_PROMPT.md` says
  `src/inngest/functions/research.function.ts`. Find which one exists (if either), report the real
  path, and flag the other as a stale doc reference.
- Telegram ingress handler (live) and any Twilio/WhatsApp handler (confirm present-but-stubbed vs
  absent — do not assume; the spec says "planned, not blocking").
- `prompt_versions`, `agent_runs`, `agent_run_steps` tables — these are the runtime's accounting
  spine; if they're empty or the code never writes them, the runtime isn't actually executing.

---

## LABELS — assign exactly one per node, with evidence

- **WIRED** — live caller → live callee → live source/sink. Cite `file:line` for the call and,
  where it terminates in the DB, a query result.
- **PARTIAL** — path exists but degrades, branches to a fallback, or only one of several inputs is
  live. Name precisely what's live and what isn't.
- **STUB** — function/route exists, returns hardcoded/empty/placeholder output. Cite the line.
- **MOCK** — path terminates in a `frontend/src/data/*MockData` file or equivalent fixture instead
  of live data. Name the mock file. (There are ~25 of these; any in this chain is a launch blocker.)
- **ORPHANED** — code exists and may even be correct, but nothing in the live path calls it. Cite
  the absence (no inbound references).
- **ABSENT** — does not exist. The spec calls for it; the code doesn't have it.

---

## LIVE-DB VERIFICATION — required, not optional

Run these against the live DB and paste raw output into the report. If you cannot reach the live
DB, say so explicitly and mark every DB-terminal node UNVERIFIED — do not infer from schema files.

1. Pick one real deal that has gone through the chat path (or the closest available). Confirm a
   `deal_context` record exists for it and is non-empty. Paste the row shape.
2. `SELECT agent_id, status, count(*) FROM agent_runs GROUP BY 1,2;` — confirms agents actually
   execute and with what success rate. An empty table = the runtime has never run in production.
3. For one recent `research` run: pull its `agent_run_steps` and confirm the step trace shows real
   tool calls with real payloads, not a single empty output step.
4. Confirm the DealContext cache path: find a deal with two runs inside 24h and verify the second
   did NOT re-call Claude (check token/cost columns on the second run, or the cache-hit log).

---

## SPECIFIC WATCH ITEMS

- **CoStar leak check (high stakes).** `fetch_costar_metrics` / `fetch_costar_pipeline` appear in
  the Research/Supply tool lists. CoStar data must not flow into the JediRE shared corpus (Myers
  holds that subscription; it is a separate entity). For any CoStar-sourced tool that is WIRED:
  trace where its output lands and report the `scope_id`. If CoStar-derived values are written to
  `GLOBAL`/Lane A scope (the shared, redistributable corpus), flag it RED as a licensing-leak
  finding regardless of its wiring health. WIRED-but-leaking is worse than ABSENT here.
- **`if (state === 'FL')` check.** Per ground rules, no jurisdiction branching outside ruleset
  files. The chat surface serves FL + Atlanta + Dallas. Grep the chain for hardcoded state logic
  outside `src/services/{tax,insurance}/rulesets/`. Report any hit `file:line`.
- **Tavily as primary.** Web search must be fallback-only, never primary. If any chain node reaches
  Tavily before exhausting structured tools, flag it.
- **`dealStore` bypass (frontend egress only, if the chat surface renders any web component).** No
  direct imports between module components; `dealStore` is the sole message bus. Out of scope if
  the chat surface is pure backend → channel; note and skip if so.

---

## DELIVERABLE

A single `S1_CHAT_LAUNCH_CHAIN_AUDIT.md` containing:

1. **Header:** commit SHA, date, "READ-ONLY — no code changed."
2. **Chain verdict (one line):** does an address entered in chat produce a synthesized,
   live-data-backed reply end to end? GREEN / BROKEN-AT-HOP-N / UNVERIFIED.
3. **Hop table:** one row per hop (1–8) and per Research tool. Columns: Node | Label | Evidence
   (`file:line` or query result) | Note. No row without evidence.
4. **Break list:** every node that is not WIRED, ordered by how early it breaks the chain. The
   earliest break is the launch blocker; everything downstream of it is moot until it's fixed.
5. **Live-DB section:** the four query outputs, pasted raw.
6. **Watch-item findings:** CoStar leak, FL hardcoding, Tavily, dealStore.
7. **Doc-vs-code gaps:** every place a spec claimed something the code doesn't have (start with the
   Inngest path discrepancy).

---

## STOP

Produce the report and stop. Do NOT propose or write fixes in the same pass. Do NOT start a fix
dispatch. Wait for Leon to review the chain verdict and choose what gets the first fix.
