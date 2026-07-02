# AUDIT DISPATCH — LLM Token Consumption: Who Is Spending, From Where, and Is It Metered

**Type:** READ-ONLY audit. No code changes, no config changes, no top-ups. Hard STOP at the end — findings before fixes.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Trigger:** DeepSeek account exhausted (402 Insufficient Balance), surfaced by a mere page load of Highlands' F9 during screenshotting. Operator needs the consumption map.
**Standing rule (S1-01):** every claim backed by pasted rows, log lines, or code traces (file:line). "Probably the agents" is not a finding.

## A1 · Inventory every LLM call site
1. Enumerate ALL code paths that call any LLM provider (Anthropic, DeepSeek, others): grep the clients/SDKs, list each call site with file:line, which provider(s) it can route to, and what triggers it (HTTP request, page-load-driven fetch, cron, queue/Inngest job, agent loop, webhook).
2. For each site: is the call gated by cache, by user action, or does it fire unconditionally on a route/page load? **Specifically trace the Highlands F9 "model build" that 402'd during a screenshot — what exact frontend fetch → backend path → LLM call fired from a page view, and is there any cache in front of it?** Paste the chain.
3. Identify retry behavior per site: on 4xx/5xx (esp. 402), does anything retry? Max attempts, backoff, and whether a provider fallback exists (402 on DeepSeek → silently re-run on Anthropic?). Paste the retry config or its absence.

## A2 · Where is usage recorded, and what does it say
1. Enumerate the usage/ledger tables (token-meter events, credit ledger, any provider-usage log). Paste schemas.
2. Aggregate the last 30 days (or all available): tokens/calls/cost grouped by (a) provider, (b) call site/feature, (c) deal, (d) org/user, (e) day. Paste the top-10 in each grouping. If attribution columns don't exist (no caller tag on ledger rows), report that as a finding — unattributable spend is itself the defect.
3. Time-series: daily call counts per provider for the last 30 days. Any spikes? Correlate spike dates with known events (dispatch runs, cron additions, the M35 nightly classifier wiring, this week's heavy F9 navigation).

## A3 · The DeepSeek metering question (billing-arc critical)
1. Trace how a DeepSeek call is metered: does `@stripe/token-meter` (which wraps `@anthropic-ai/sdk`) see DeepSeek traffic at all? If DeepSeek rides a separate client, show whether ANY usage event / credit deduction is written per DeepSeek call. Paste the code path or its absence.
2. If unmetered: quantify the leak — count of DeepSeek calls in logs vs. credit deductions recorded for the same period.
3. Confirm which tiers/users can select DeepSeek and whether TIER_CONFIG markup applies to it anywhere.

## A4 · Background consumers
1. List every cron/Inngest/scheduled job that can reach an LLM (M35 nightly classifier, correlation runs, anything). For each: schedule, last 10 run timestamps, calls per run. Paste.
2. Agent orchestration: does any coordinator/agent loop have an unbounded or high iteration ceiling? Paste the loop bounds.
3. DealContext 24h cache: is it actually hit? Paste hit/miss counts or, if not instrumented, the code proving the cache is consulted before assembly calls.

## A5 · Report
Findings table: consumer → trigger → provider → est. share of spend → metered? (Y/N) → runaway risk (page-load / retry / cron / loop). Rank by spend. Flag the single largest consumer and the single worst unmetered path. **STOP. Remediation (caching, gating page-load builds, metering DeepSeek, retry caps) is the next dispatch, sequenced after operator review — several fixes touch the billing arc and are product decisions.**
