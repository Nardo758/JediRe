# AUDIT DISPATCH — Unit Economics & Credit-Cost Reconciliation

**Mode:** READ-ONLY measurement. No code changes. This is not a wiring audit — it's a cost
reconciliation. The question is not "does the meter work" (that's the billing-gating audit); it's
**"does the meter read a profit."** You measure actual spend and compare it to what the pricing
model assumes.

**Repo / DB:** `github.com/Nardo758/JediRe.git`. Record `HEAD` SHA + the date of the cost data
window you pull. Cost figures move, so the report is a snapshot, not a standing truth.

---

## WHY THIS GATES LAUNCH

The business is credit-metered at a stated **40% gross margin**. Every other audit verifies the
meter is *wired*. None verify it reads a profit. A fully-wired billing system that meters a loss is
worse than no billing — it loses money faster and looks healthy doing it. If a tier's deal burns
more compute than its credits cover, margin inverts on every active user in that tier.

---

## THE PRICING MODEL (the thing you reconcile against)

| Tier | Price/mo | Credits/mo | Notes |
|---|---|---|---|
| Scout | $49 | 100 | chat only |
| Operator | $199 | 500 | |
| Principal | $499 | 2,000 | auto-research enabled |
| Institutional | custom | — | out of scope for this pass |

Target: **40% gross margin** → COGS ceiling is **60% of price**. Scout's compute budget is ~$29.40/mo,
Operator ~$119.40, Principal ~$299.40 — *before* Stripe fees, infra, and vendor-data amortization.
Those other costs eat into the same 60%, so the LLM+vendor spend ceiling is tighter than those
numbers. Establish the real ceiling in step 1 before judging anything.

---

## STEP 1 — ESTABLISH THE CREDIT → DOLLAR → TOKEN MAP

Before measuring deals, pin down the unit definitions. Cite where each lives in code/config.

1. What is one credit worth in USD? (Find the credit pricing config — `@stripe/token-meter` setup,
   the meter definition, or wherever credit value is set.)
2. What operation consumes a credit, and how many? Is a "deal analysis" a fixed credit charge, or
   pass-through metered token cost converted to credits? This determines whether overage is capped
   or open-ended.
3. What are the per-model token prices in use? Confirm which model each agent calls (memory: Research
   + Commentary on the reasoning-heavy model; Zoning / Supply / Cashflow on the cheaper one). A
   misrouted agent calling the expensive model is a silent margin leak — check the actual model
   string each agent passes, not the spec's claim.

Output: a one-paragraph statement of "1 credit = $X = ~Y tokens at blended rate," with the COGS
ceiling per tier after backing out non-LLM costs.

---

## STEP 2 — MEASURE ACTUAL COST PER DEAL

Use the real telemetry. `agent_runs` carries `tokens_in`, `tokens_out`, `cost_usd` per run;
`agent_run_steps` breaks it down per tool call.

1. Pull the cost of a **full deal analysis** — the set of agent runs a single new deal triggers
   (Research + Zoning + Supply + Cashflow + Coordinator synthesis). Sum `cost_usd` across them.
   ```sql
   SELECT deal_id,
          count(*)                 AS runs,
          sum(tokens_in)           AS tin,
          sum(tokens_out)          AS tout,
          sum(cost_usd)            AS deal_cost_usd
   FROM agent_runs
   WHERE deal_id IS NOT NULL
   GROUP BY deal_id
   ORDER BY deal_cost_usd DESC
   LIMIT 25;
   ```
   Report min / median / p90 / max deal cost. The p90 and max are what matter — a heavy deal, not
   the median, is what blows a tier budget.
2. Convert deal cost to credits using the step-1 map. **How many deals does each tier's monthly
   credit allotment actually buy?** Scout (100 credits), Operator (500), Principal (2,000).
3. Identify the cost drivers from `agent_run_steps`: which agent and which tool dominates spend?
   (Expect Research to dominate; confirm. A runaway `web_search` loop or an agent on the wrong model
   shows up here.)

---

## STEP 3 — VERIFY THE CACHE ACTUALLY SAVES WHAT THE MODEL ASSUMES

The 24h DealContext cache is specced to cut re-run credit cost **60–70%**. The margin math depends
on it. Verify it empirically, not from the spec.

1. Find deals with a follow-up run inside 24h of the first. Compare `cost_usd` of the second run to
   the first.
2. Is the second run's cost actually 30–40% of the first (i.e. 60–70% saved), or did it re-call the
   model at near-full cost? If the cache is a STUB or silently missing (per the chat audit's cache
   check), the entire follow-up-turn margin assumption is wrong.
3. Report the measured savings %. If it's materially below 60%, flag it — the pricing model is built
   on a number that isn't real.

---

## STEP 4 — BUDGET CAP REALITY CHECK

Memory/spec: `maxTokensPerRun` 500k, `maxCostUsdPerRun` $5, `maxStepsPerRun` 30,
`maxCostUsdPerDealPerDay` $20, per-user-per-month via credit balance.

1. Confirm these caps are *enforced*, not just declared (the plumbing audit checks enforcement;
   here, check the *values*). A $5/run cap on a Scout tier whose entire monthly compute budget is
   ~$29 means **6 runs can exhaust a month of margin.** Are the caps sized to the tier, or uniform?
2. `maxCostUsdPerDealPerDay = $20` against Scout's ~$29/mo budget means **one deal worked hard for
   one day can consume two-thirds of the monthly margin.** Flag any cap that exceeds the tier's
   economic headroom.

---

## DELIVERABLE

`UNIT_ECONOMICS_AUDIT.md`:

1. **Header:** SHA, cost-data window, "READ-ONLY measurement."
2. **One-line verdict:** at current measured cost, does each tier clear 40% margin at expected
   usage? PROFITABLE / MARGIN-INVERTS-AT (tier + condition) / UNVERIFIED.
3. **Credit map:** the step-1 statement (1 credit = $X = ~Y tokens; per-tier COGS ceiling).
4. **Cost-per-deal table:** min / median / p90 / max, in USD and credits, + deals-per-tier-allotment.
5. **Cost-driver breakdown:** which agent/tool dominates; any agent on the wrong model.
6. **Cache savings:** measured % vs the 60–70% assumption.
7. **Budget-cap findings:** any cap larger than the tier's economic headroom.
8. **Margin-inversion shortlist:** the specific (tier, usage) combinations where you lose money.

---

## STOP

Report and stop. No pricing changes, no cap changes, no code. This pass tells Leon whether the
numbers hold; Leon decides whether to reprice, re-cap, or re-route models.
