# AUDIT DISPATCH — LLM Job Cadence Rationalization: Scope Classification + Redundancy Measurement

**Type:** READ-ONLY. No trigger changes, no cadence changes, no cache implementation. Output is a decision matrix for operator review. Hard STOP at end.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Follows:** `AUDIT_DISPATCH_TOKEN_CONSUMPTION.md` (A1 call-site inventory is the input to this audit).
**Principle under test:** an LLM output is a derived artifact of (prompt template version, input data snapshot). A job is over-triggered when trigger frequency > input change frequency. Every finding must be stated in those terms with evidence.

## C0 · Completeness re-sweep (this audit is only as complete as its inventory)
Before C1, re-sweep the repo for LLM call sites BEYOND the A1 inventory, with a wider net than SDK imports:
1. Grep for raw HTTP to provider endpoints (api.anthropic.com, api.deepseek.com, api.openai.com, any base-URL env vars), any OpenAI-SDK construction beyond financial-model-engine, embedding/classification calls, and anything reachable from the Telegram bot / message-router path that does not route through aiService.
2. Paste the delta: call sites found that A1 missed (file:line, trigger, provider) — or an explicit "zero delta" with the grep patterns used. Every delta site enters C1 scope.

## C1 · Input-signature extraction per job
For each LLM job from the A1 inventory PLUS any C0 deltas (Research, Supply, CashFlow, Zoning, Commentary/F3, crons, F9 build — and the AI Coordinator's CONTEXT-ASSEMBLY portion: conversational turns themselves are user-driven and excluded, but the per-turn DealContext/context rebuild is a repetitive job and IS in scope, keyed like any other assembly job):
1. Read the prompt-assembly code and list WHAT DATA actually enters the prompt (file:line where each input is fetched/injected). Not what the job is named — what it consumes.
2. Classify each input: deal-specific (deal's own assumptions/actuals/docs) / parcel-specific / submarket-level / MSA-level / global / time-window (news, events).
3. Assign the job a scope class: DEAL / PARCEL / MARKET / GLOBAL — by its narrowest input. A job whose prompt contains ONLY market-level inputs is MARKET-scoped regardless of being triggered per-deal. If a job mixes (e.g. Commentary = market data + deal name stitched in), report the split: which % of the prompt is market-invariant vs deal-specific, and whether the deal-specific part is substantive analysis or cosmetic templating.
4. For each input, identify its actual refresh cadence in the data layer: which table, what updates it, how often (e.g. apartment_market_snapshots cadence, deal_assumptions mutation events, market_events inserts). Paste evidence (max(updated_at) distributions or the writing job's schedule).

## C2 · Empirical redundancy measurement (the ledger speaks)
Using ai_usage_log (post-T2/T6 rows where possible; historical rows for volume even with cost=0):
1. Per job (agent_id/operation_type): total runs, distinct deals, and — joining deals → submarket/geography — distinct (geography, month) pairs over the ledger's history.
2. **Dedup ratio per job = 1 − distinct(geography, month) / total runs** for MARKET-scoped jobs; **1 − distinct(deal, input-change-events) / total runs** for DEAL-scoped jobs where input-change events are countable (assumption mutations, new actuals rows). Paste the queries and results.
3. Token-weight the ratios: redundant runs × avg tokens per run × current rate = estimated recoverable spend per job. Rank.
4. Output-similarity spot check (evidence the redundancy is real, not theoretical): for one MARKET-scoped job, pull 3 stored outputs generated for different deals in the same submarket within the same month (wherever outputs are persisted — commentary tables, deal_data). Paste excerpts side by side. Near-identical text = confirmed regeneration waste.

## C3 · Proposed cadence per job (report only — DO NOT implement)
For each job, propose: trigger → correct trigger; keyed by → cache/artifact key (the input-signature hash); invalidation → what event genuinely stales it. Constraints to honor in the proposal:
- MARKET-scoped artifacts become one-per-(geography, period) platform artifacts that deals REFERENCE (Lane A/GLOBAL scope semantics), with a thin deal-specific synthesis layer only where C1 shows substantive deal-specific content.
- F3 Commentary specifically: monthly per (submarket, period), persisted as a time series (working name market_commentary_snapshots: geography, period, model/template version, input snapshot hash, output, sentiment extraction) — enabling sentiment-over-time on the deal surface and future CE correlation. Spec the minimal schema in the report; do not migrate.
- DEAL-scoped jobs: trigger on input-hash change (assumption set hash, actuals watermark), never on navigation or redundant events.
- Zoning: per-parcel artifact, invalidated by ruleset-file change only (consistent with the jurisdiction-branching invariant).
- Research/DealContext: cache keyed by input-signature hash — this doubles as the design for the never-built DealContext cache; state the key composition explicitly.
- New-deal UX guardrail: a newly created deal must still get immediate commentary — by referencing the CURRENT month's market artifact (instant, zero-cost), never by waiting for the next cycle. Flag any job where the reference model degrades first-load UX and propose the fallback (generate-if-absent for that (geography, period), once).

## C4 · Decision matrix (the deliverable)
One table: job | scope class | current trigger | input refresh cadence | dedup ratio | est. recoverable spend | proposed cadence | proposed key | invalidation event | UX risk. Ranked by recoverable spend. Everything below the table is appendix evidence.

**STOP. Cadence changes, schema additions, and cache implementations are Tranche 3, sequenced after operator review — trigger cadence is a product-behavior decision, not an optimization detail.**
