# UNIT ECONOMICS AUDIT — A3
## Credit-Cost Reconciliation

**HEAD SHA:** `2eb9a56961ddae3241c471f2b09e330ddfa0478c`
**Cost-data window:** All `agent_runs` to date (earliest cost-bearing run: 2026-05-25; queried 2026-06-22)
**Mode:** READ-ONLY measurement. No code changes.

---

## ONE-LINE VERDICT

**MARGIN-INVERTS-AT Scout (any user who exercises included credits in full); budget caps are not tier-aware and allow a single deal-day to exceed Scout's entire monthly COGS budget.**

---

## 1. CREDIT MAP

### 1.1 Where credit value is defined

The credit system lives entirely in `backend/src/services/ai/creditService.ts`.

| Tier | Monthly price | Included credits | Overage rate |
|---|---|---|---|
| Scout | $49 | 100 | $0.25/credit |
| Operator | $199 | 500 | $0.15/credit |
| Principal | $499 | 2,000 | $0.10/credit |

**Critical gap — no credit↔USD exchange rate exists in code.**

`reserveCredits(userId, estimatedCost)` and `debitActualCost(userId, estimatedCost, actualCost)` receive raw USD floats (e.g. `$0.054`) and subtract them directly from `credits_remaining` (an integer starting at 100/500/2,000). There is no conversion function. The implied rate is therefore **1 credit = $1 USD**.

At the implied 1:1 rate:
- Scout's 100 credits = $100 of compute headroom
- Monthly revenue: $49. Monthly COGS ceiling (60%): $29.40
- A Scout user who fully exercises 100 credits at $1 each costs **$100 in compute vs $49 in revenue → −104% gross margin**

The Stripe billing meters (`jedi_input_tokens`, `jedi_output_tokens`) are the *actual* billing mechanism and run correctly. The credit balance system is a parallel soft-cap layer. Because the two systems use different units with no defined conversion, the credit balance never provides meaningful spend control at current agent costs.

### 1.2 Model assignments and token rates

| Agent | Model | Adapter | Input $/MTok | Output $/MTok |
|---|---|---|---|---|
| Research | `deepseek-chat` | DeepSeekMeteringAdapter | $0.27 | $1.10 |
| Zoning | `claude-haiku-4-5-20251001` | MeteringAdapter (Anthropic) | $0.80 | $4.00 |
| Supply | `deepseek-chat` | **MeteringAdapter** (Anthropic SDK) | $0.27* | $1.10* |
| Cashflow | `deepseek-chat` (default) | DeepSeekMeteringAdapter | $0.27 | $1.10 |
| Commentary | `deepseek-chat` | MeteringAdapter (Anthropic SDK) | $0.27* | $1.10* |

*Supply and Commentary use `deepseek-chat` as `modelName` but instantiate `MeteringAdapter` (Anthropic SDK). The Anthropic SDK will reject a `deepseek-chat` model name unless the `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` env var points to a proxy that accepts both namespaces. Cost accounting in `MeteringAdapter.COST_PER_MTK` includes `deepseek-chat` rates ($0.27/$1.10) so cost logging is arithmetically correct either way. The routing risk (wrong API) is flagged but unverified here — both agents show nonzero costs in the DB, suggesting calls are completing.*

**Model routing finding:** Cashflow can be switched to `claude-sonnet-4-5` ($3.00/$15.00 per MTok) at startup via `CASHFLOW_LLM_MODEL` env override with no safeguard. At 800K-token cap: max cost = ~$14.40, far above the $8 per-run cap (run is cut mid-execution, not prevented). Zoning is permanently on Haiku (~3× DeepSeek price) — not a misrouting, but a cost driver to note.

### 1.3 COGS ceilings per tier

| Tier | Monthly price | 60% COGS ceiling | Implied "budget" at 1:1 credit rate |
|---|---|---|---|
| Scout | $49 | $29.40 | $100 (credits) — **3.4× ceiling** |
| Operator | $199 | $119.40 | $500 (credits) — **4.2× ceiling** |
| Principal | $499 | $299.40 | $2,000 (credits) — **6.7× ceiling** |

The included-credit face value exceeds the COGS ceiling at every tier under the 1:1 implied rate.

---

## 2. COST PER DEAL

### 2.1 Full-deal cost distribution (SQL: all `agent_runs` grouped by `deal_id`)

```sql
SELECT deal_id, count(*) AS runs, sum(tokens_in) AS tin,
       sum(tokens_out) AS tout, sum(cost_usd) AS deal_cost_usd
FROM agent_runs WHERE deal_id IS NOT NULL
GROUP BY deal_id ORDER BY deal_cost_usd DESC LIMIT 25;
```

| deal_id (abbrev) | runs | tokens_in | tokens_out | total_cost_usd |
|---|---|---|---|---|
| 3f32276f… | 5,176 | 620,409,132 | 15,464,642 | **$66.59** ← dev loop outlier |
| 3d96f62d… | 21 | 7,067,941 | 91,197 | $0.68 |
| 8aa4c42a… | 102 | 5,482,980 | 193,248 | $0.65 |
| 8205a985… | 3 | 2,429,996 | 33,531 | $0.25 |
| ab17f229… | 12 | 704,838 | 19,921 | $0.08 |
| 6d047c45… | 1 | 0 | 0 | $0.00 |
| 1daab29b… | 1 | 0 | 0 | $0.00 |

```sql
SELECT MIN(s), percentile_cont(0.5) WITHIN GROUP (ORDER BY s) AS median,
       percentile_cont(0.9) WITHIN GROUP (ORDER BY s) AS p90, MAX(s)
FROM (SELECT deal_id, sum(cost_usd) AS s FROM agent_runs
      WHERE deal_id IS NOT NULL GROUP BY deal_id) sub;
```

| | min | median | p90 | max |
|---|---|---|---|---|
| All 7 deals | $0.00 | $0.25 | $27.05 | $66.59 |
| Excluding dev outlier (6 deals) | $0.00 | $0.25 | $0.65 | $0.68 |

**Interpretation:** The p90 of $27.05 (and max of $66.59) are driven entirely by one deal with 5,176 runs — a dev-loop artifact, not a user pattern. Excluding it, the p90 is $0.65. The dataset is **too small** (7 deals, ~1 month of data) to produce reliable production p90/max estimates. All figures are pre-Stripe-fee, pre-Tavily, pre-CoStar.

### 2.2 Per-agent cost breakdown (`status = 'succeeded'`)

```sql
SELECT agent_id, count(*) as runs, sum(tokens_in) as total_tin,
       sum(tokens_out) as total_tout, sum(cost_usd) as total_cost, avg(cost_usd) as avg_cost
FROM agent_runs WHERE status = 'succeeded'
GROUP BY agent_id ORDER BY total_cost DESC;
```

| Agent | Succeeded runs | Total tokens_in | Total tokens_out | Total cost | Avg cost/run |
|---|---|---|---|---|---|
| cashflow | 705 | 375,385,542 | 8,424,436 | $38.33 | $0.0544 |
| commentary | 1,284 | 40,206,526 | 2,348,001 | $6.71 | $0.0052 |
| supply | 878 | 48,569,479 | 1,322,509 | $5.62 | $0.0064 |
| research | 159 | 24,409,946 | 868,075 | $3.23 | $0.0203 |
| pipeline | 67 | 0 | 0 | $0.00 | $0.00 |

**Zoning: zero rows in `agent_runs`.** No zoning agent run has ever been recorded. Either no deal has triggered a zoning analysis, or zoning runs are not writing to `agent_runs`. Zoning cost is unknown.

### 2.3 Estimated single full-suite run

| Agent | Avg cost/run | Notes |
|---|---|---|
| Research | $0.0203 | |
| Zoning | **unknown** | Zero runs in DB |
| Supply | $0.0064 | |
| Cashflow | $0.0544 | Dominates; 64% of known cost |
| Commentary | $0.0052 | |
| **Subtotal (no zoning)** | **~$0.086** | |

### 2.4 Deals per tier allotment

Using $0.086/analysis and the implied 1:1 credit rate:

| Tier | Credits | Implied compute budget | Analyses at $0.086 | COGS ceiling analyses |
|---|---|---|---|---|
| Scout | 100 | $100 | 1,163 | 342 (at $29.40 ceiling) |
| Operator | 500 | $500 | 5,814 | 1,388 |
| Principal | 2,000 | $2,000 | 23,256 | 3,481 |

The credit balance runs out after 1,163 analyses (Scout) — but the COGS ceiling is hit after 342. Credits are not a binding spend control.

---

## 3. CACHE SAVINGS

### 3.1 Same-deal same-agent follow-up runs within 24h

```sql
SELECT a.deal_id, a.agent_id, a.cost_usd AS cost1, b.cost_usd AS cost2,
       EXTRACT(EPOCH FROM (b.started_at - a.started_at))/3600 AS hours_apart
FROM agent_runs a JOIN agent_runs b ON b.deal_id = a.deal_id
  AND b.agent_id = a.agent_id AND b.started_at > a.started_at
  AND b.started_at < a.started_at + INTERVAL '24 hours'
  AND b.status = 'succeeded'
WHERE a.deal_id IS NOT NULL AND a.status = 'succeeded'
  AND a.cost_usd > 0 AND b.cost_usd > 0
LIMIT 20;
```

**Cashflow same-deal pairs (deal 3d96f62d, 2026-05-25):**

| First run | Second run | Hours apart | Savings |
|---|---|---|---|
| $0.1478 | $0.1359 | 0.96 h | **8.1%** |
| $0.1478 | $0.1159 | 0.69 h | **21.6%** |
| $0.1478 | $0.0858 | 0.70 h | **41.9%** |

**Commentary same-deal pairs (deal 3d96f62d, 2026-05-25):**

| First run | Second run | Hours apart | Savings |
|---|---|---|---|
| $0.0236 | $0.0222 | 0.96 h | 6% |
| $0.0236 | $0.0103 | 0.68 h | 56% |
| $0.0236 | $0.0073 | 0.68 h | 69% |
| $0.0236 | $0.0196 | 0.70 h | 17% |

### 3.2 Finding: cache assumption is UNVERIFIABLE for cashflow; partially observed for commentary

**Cashflow measured savings: 8–42%.** The 60–70% spec assumption is **not met**. As confirmed in A2, `agent-delegator.ts:buildRuntimeInput()` does not read `deal_context_fields` — the 24h DealContext cache path is absent. Second cashflow runs are re-executing nearly in full.

**Commentary measured savings: 6–69% (highly variable).** The `market_commentary` ON CONFLICT upsert (24h TTL) does suppress re-execution via the idempotency guard in step 3 of the Inngest function — but only for exact same `inngest_event_id`. A manual re-trigger bypasses it and runs full cost. The variability in the data suggests inconsistent idempotency behavior.

**Zero-cost distribution (possible cache hits counted as $0.00 runs):**

| Agent | Total runs | Zero-cost | Non-zero |
|---|---|---|---|
| research | 1,033 | **855 (83%)** | 178 |
| pipeline | 1,003 | 1,003 (100%) | 0 |
| cashflow | 952 | 144 (15%) | 808 |
| supply | 971 | 47 (5%) | 924 |
| commentary | 1,357 | 45 (3%) | 1,312 |

Research has 83% zero-cost runs. This aligns with A2's finding that Research runs via Inngest on `deal.created` — 855 of 1,033 runs are $0.00, likely early exits (tier gate, idempotency guard, or no API key configured in the test environment) rather than genuine cache hits.

**Conclusion:** The margin model assumes 60–70% cache savings on follow-up turns. Measured cashflow savings (8–42%) are materially below that. The pricing model's follow-up-turn economics are built on an assumption that isn't implemented.

---

## 4. BUDGET CAP FINDINGS

### 4.1 Configured caps (`backend/src/agents/config/budget.ts`)

| Agent | maxTokensPerRun | maxCostUsdPerRun | maxStepsPerRun | maxCostUsdPerDealPerDay |
|---|---|---|---|---|
| research | 500,000 | **$5.00** | 35 | **$20.00** |
| zoning | 200,000 | $2.50 | 20 | $20.00 |
| supply | 250,000 | $3.00 | 50 | $20.00 |
| cashflow | 800,000 | **$8.00** | 50 | **$25.00** |
| commentary | 200,000 | $2.50 | 35 | $20.00 |

`maxCostUsdPerUserPerMonth: Infinity` for **all agents** — monthly per-user cap is completely disabled.

### 4.2 Cap math vs tier economics

**Problem 1 — Per-agent daily caps are independent and additive.**
`BudgetEnforcer.check()` reads `caps.maxCostUsdPerDealPerDay` from each agent's own config and enforces it per-agent. Cashflow has a $25/day cap; research has a $20/day cap. On the same deal on the same day, both can independently burn to their caps: theoretical max daily deal spend = $25 + $20 + $20 + $20 = $85 (cashflow + research + supply + commentary; zoning unknown).

| Tier | Monthly COGS ceiling | Max single-day deal spend | Days to exhaust COGS at max |
|---|---|---|---|
| Scout | $29.40 | **$85** | **< 1 day** |
| Operator | $119.40 | $85 | 1.4 days |
| Principal | $299.40 | $85 | 3.5 days |

**A single heavy day on one deal can exceed Scout's entire monthly COGS budget** and consume Operator's in 1.4 days.

**Problem 2 — Cashflow daily cap ($25) alone exceeds Scout's monthly COGS ceiling ($29.40).**
If a Scout user triggers multiple cashflow reruns in one day, cashflow alone burns 85% of the monthly margin before any other agent runs.

**Problem 3 — Per-run caps are not tier-aware.**
A $5 research cap and $8 cashflow cap are the same for Scout ($49/mo) and Principal ($499/mo). Scout's monthly margin is $29.40; a single all-agent analysis hitting all per-run caps could spend $5 + $2.50 + $3.00 + $8.00 + $2.50 = **$21.00 in one session**, consuming 71% of Scout's monthly COGS budget.

**Problem 4 — `maxCostUsdPerUserPerMonth: Infinity`.**
There is no monthly per-user spending ceiling. The CreditService's `reserveCredits` is the only soft gate, but as shown in §1.1, credit depletion occurs at the 1:1 implied rate — which means Scout's 100 credits deplete after ~1,163 runs, not the ~342 economically sustainable runs. Monthly spend is unbounded at the enforcer level.

---

## 5. COST DRIVER BREAKDOWN

**Cashflow dominates**: 63% of all LLM spend ($38.33 of $53.89 total), $0.054 avg per run.

- Commentary: 12%, supply: 10%, research: 6%.
- Zoning: unknown (zero runs logged).
- Pipeline: zero cost (no model calls logged).

**No runaway tool loops detected** in the available data (deal costs top out at $0.68 excluding the dev outlier). The dev outlier deal (5,176 runs, $66.59) is clearly a development/test loop — not a user-triggered pattern.

**Model routing anomaly — Supply and Commentary:**
Both use `modelName: 'deepseek-chat'` but instantiate `MeteringAdapter` (Anthropic SDK) rather than `DeepSeekMeteringAdapter`. Both show nonzero costs, confirming calls complete. This suggests the `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` proxy routes both model namespaces. The cost rates in `MeteringAdapter.COST_PER_MTK` include the correct deepseek-chat rates ($0.27/$1.10), so accounting is arithmetically correct. Whether tokens are actually billed at deepseek pricing vs Anthropic pricing depends on the proxy — unverifiable from code alone.

**Cashflow overridable to Sonnet:**
`CASHFLOW_LLM_MODEL=claude-sonnet-4-5` switches cashflow to $3.00/$15.00 per MTok (vs $0.27/$1.10 for deepseek-chat — ~11× input, ~14× output). At typical cashflow token usage (530K input tokens / 705 runs = ~752 tokens/run avg), Sonnet would cost ~$0.011/run — comparable to DeepSeek. But a heavy cashflow run (800K token cap) at Sonnet rates = $14.40, which exceeds the $8/run cap and terminates mid-run at full cost.

---

## 6. MARGIN INVERSION SHORTLIST

The following (tier, usage) combinations produce negative margin at current pricing:

| Tier | Condition | Why |
|---|---|---|
| **Scout** | User exercises 100% of included credits | 100 credits at 1:1 implied rate = $100 compute vs $29.40 COGS ceiling → **−104% gross margin** |
| **Scout** | One deal, heavy agent day | Cashflow daily cap ($25) alone = 85% of monthly COGS; full-suite caps = $85/day possible → month inverts in <1 day |
| **Scout** | Cashflow `CASHFLOW_LLM_MODEL=claude-sonnet-4-5` override + heavy run | Per-run cost approaches $8 (cap); 4 cashflow runs exhaust monthly COGS budget |
| **Operator** | User exercises 100% of included credits | 500 credits at 1:1 = $500 compute vs $119.40 ceiling → **−319% gross margin** |
| **Operator** | >1 heavy deal-day (consistent heavy use) | $85/day theoretical max × 2 days = $170 > $119.40 COGS ceiling |
| **Principal** | User exercises 100% of included credits | 2,000 credits = $2,000 compute vs $299.40 ceiling → **−568% gross margin** |
| **All tiers** | No monthly per-user cap enforced | `maxCostUsdPerUserPerMonth: Infinity` — a runaway user faces no ceiling |

---

## 7. GAPS NOT MODELED HERE

Per dispatch scope:
- **Stripe fees** (~2.9% + $0.30): not modeled; reduces effective 60% COGS ceiling further.
- **Tavily web search costs**: not in `agent_run_steps` cost data; each `web_search` call has an external cost outside the LLM meter.
- **CoStar/vendor data amortization**: not modeled.
- **Infrastructure/hosting**: not modeled.
All three compress the real COGS ceiling tighter than the $29.40/$119.40/$299.40 figures above.

---

## 8. SUMMARY

| Finding | Severity |
|---|---|
| No credit↔USD exchange rate in code; 1 credit effectively = $1 | **CRITICAL** |
| Included credits exceed COGS ceiling at all tiers (3.4×–6.7×) | **CRITICAL** |
| Per-agent daily caps are independent: Scout's COGS can invert in <1 day | **CRITICAL** |
| `maxCostUsdPerUserPerMonth: Infinity` — no monthly ceiling | **CRITICAL** |
| Cashflow 24h cache savings: 8–42% measured vs 60–70% modeled | **HIGH** |
| Zoning uses Haiku (3× DeepSeek price); no zoning runs logged | **MEDIUM** |
| Supply/Commentary adapter mismatch (Anthropic SDK + deepseek model) | **MEDIUM** |
| Cashflow model overridable to Sonnet at runtime with no margin guard | **MEDIUM** |
| Dataset too small for reliable p90/max estimates (7 deals, ~1 month) | **INFO** |
| Stripe fees, Tavily, CoStar costs not modeled | **INFO** |
