# A3: Unit Economics & Credit-Cost Audit

**Date:** 2026-06-24  
**Auditor:** Orchestrator (multi-agent deep research)  
**Scope:** Credit cost model, AI usage logging, model pricing, platform margin per user action  
**Status:** 🟡 LAUNCH GATE — 4 findings require resolution before commercial launch  

---

## 1. Executive Summary

The credit system has a **fundamental unit-mismatch bug**: two code paths (JediAIService and MeteringAdapter) write different units (flat integer credits vs. actual USD costs) into the same `credits_remaining` column. This corrupts user balances, breaks analytics, and creates both under-charging and over-charging risks.

Additionally, the model-routing table routes **all tiers to DeepSeek** for all agents, eliminating tier-based quality differentiation. The flat credit pricing model is massively profitable for small calls but exposes the platform to **unbounded loss** on large calls (e.g., a deal bible using 1M tokens costs the platform ~$27 but charges the user only 40 credits = $10 at Scout).

### Launch Gate Verdict

| Finding | Severity | Launch Blocker? |
|---------|----------|-----------------|
| A3-F1: Dual-unit credit system | **CRITICAL** | ✅ YES |
| A3-F2: No `cost_usd` column in `ai_usage_log` | **HIGH** | ✅ YES |
| A3-F3: All tiers route to DeepSeek | **MEDIUM** | ⚠️ No (but degrades UX) |
| A3-F4: Unbounded loss on large calls | **HIGH** | ✅ YES |
| A3-F5: Stripe meters use raw tokens | **MEDIUM** | ⚠️ No (but billing inaccuracy) |
| A3-F6: Daily spend cap only on DeepSeek | **LOW** | ⚠️ No |
| A3-F7: Preflight estimate undersized | **MEDIUM** | ⚠️ No |
| A3-F8: No model-family cost differential in Stripe | **LOW** | ⚠️ No |

---

## 2. Findings

### A3-F1: Dual-Unit Credit System — CRITICAL

**Evidence:**

- **JediAIService path** (`backend/src/services/ai/aiService.ts:78-95`):
  ```typescript
  const CREDIT_COSTS: Record<string, number> = {
    research_full_assembly: 3,
    research_single_source: 1,
    // ...
    coordinator_deal_bible: 40,
  };
  ```
  `getCreditCost()` returns flat integer credits (e.g., `40` for a deal bible). `checkAndDeductCredits()` subtracts this integer from `credits_remaining`.

- **MeteringAdapter path** (`backend/src/agents/runtime/MeteringAdapter.ts:40-48`):
  ```typescript
  export function estimateCost(model, inputTokens, outputTokens): number {
    return (inputTokens / 1_000_000) * rates.input +
           (outputTokens / 1_000_000) * rates.output;
  }
  ```
  `reserveCredits()` is called with `preflightEstimate(model)` which returns a **USD value** (e.g., `$0.0027` for 4k DeepSeek input + 4k output). `debitActualCost()` reconciles the delta in USD.

- **Same column, two units:** Both paths write to `user_credit_balances.credits_remaining` (now `NUMERIC(14,6)` per migration `20260427_credit_columns_numeric.sql`).

**Impact:**
- A user on Scout (100 credits) does a `coordinator_deal_bible` via JediAIService → balance drops by 40 credits (integer).
- The same user does a DeepSeek call via MeteringAdapter → balance drops by `$0.0027` (USD).
- The balance is now a mix of integer credits and fractional dollars, making it impossible to reason about.

**Root Cause:** The `creditService` was designed with two different abstractions in mind. JediAIService treats credits as **usage tokens** (flat per-operation). MeteringAdapter treats credits as **dollar proxies** (actual cost). The migration to `NUMERIC(14,6)` papered over the type mismatch but didn't resolve the semantic mismatch.

---

### A3-F2: No `cost_usd` Column in `ai_usage_log` — HIGH

**Evidence:**

- `ai_usage_log` stores `credits_consumed` (`NUMERIC(14,6)`) but has **no `cost_usd` column**.
- When JediAIService logs, `credits_consumed` = integer credits (e.g., `40`).
- When MeteringAdapter logs, `credits_consumed` = actual USD cost (e.g., `0.0027`).
- When DeepSeekMeteringAdapter logs, `credits_consumed` = actual USD cost (e.g., `0.0027`).

**Impact:** The `credits_consumed` column is a **type-unsafe union** of two different units. Any analytics query that sums `credits_consumed` is meaningless. The daily spend cap check (`SELECT COALESCE(SUM(credits_consumed), 0) FROM ai_usage_log WHERE created_at >= CURRENT_DATE`) is summing a mix of integers and dollars, producing a garbage number.

---

### A3-F3: All Tiers Route to DeepSeek — MEDIUM

**Evidence:**

```typescript
// backend/src/services/ai/aiService.ts:25-58
const MODEL_ROUTING: ModelRouting = {
  scout:      { research: 'deepseek-chat', zoning: 'deepseek-chat', ... },
  operator:   { research: 'deepseek-chat', zoning: 'deepseek-chat', ... },
  principal:  { research: 'deepseek-chat', zoning: 'deepseek-chat', ... },
  institutional: { research: 'deepseek-chat', zoning: 'deepseek-chat', ... },
};
```

**Impact:** No quality differentiation between tiers. A Scout user gets the same model as an Institutional user. This eliminates a key upsell incentive and means the `getCreditCost()` Opus multiplier (`base * 2`) is dead code (no tier ever routes to Opus).

---

### A3-F4: Unbounded Loss on Large Calls — HIGH

**Evidence:**

- Flat credit pricing: `coordinator_deal_bible` = 40 credits.
- At Scout overage rate ($0.25/credit), user pays $10.
- Actual cost at DeepSeek rates for 8k tokens (4k in + 4k out): ~$0.0035. Profit: $9.9965.
- **BUT** for a large call (e.g., 1M input + 200k output tokens):
  - DeepSeek cost: (1M × $0.27 + 200k × $1.10) / 1M = **$0.49**
  - Claude Sonnet cost: (1M × $3.00 + 200k × $15.00) / 1M = **$6.00**
  - Claude Opus cost: (1M × $15.00 + 200k × $75.00) / 1M = **$30.00**
- User still pays only 40 credits = $10 (Scout) or $4 (Principal).
- **Platform loses $20 per Opus call** if the user is on Principal, or **loses $26 per Opus call** if on Scout (but Scout is capped at 100 credits, so they'd hit the wall first).

**Impact:** The flat credit model is a **loss leader** for any call that exceeds the token budget implicit in the credit price. Since the platform has no runtime token budget enforcement (only a pre-flight estimate of 4k tokens), a single large call can wipe out the margin from 50+ small calls.

---

### A3-F5: Stripe Meters Use Raw Tokens — MEDIUM

**Evidence:**

```typescript
// backend/src/services/ai/aiService.ts:565-579
await stripe.billing.meterEvents.create({
  event_name: 'jedi_input_tokens',
  payload: { stripe_customer_id: context.stripeCustomerId, value: String(usage.input_tokens) },
});
await stripe.billing.meterEvents.create({
  event_name: 'jedi_output_tokens',
  payload: { stripe_customer_id: context.stripeCustomerId, value: String(usage.output_tokens) },
});
```

**Impact:** Stripe billing meters receive raw token counts, not cost-weighted tokens. Since DeepSeek is ~30× cheaper than Claude Sonnet for input and ~14× cheaper for output, a user billed by raw tokens on DeepSeek pays the same as a user on Claude Sonnet for the same token count, but the platform's cost is vastly different. This creates either **over-charging** (DeepSeek users subsidize Claude users) or **under-charging** (Claude users get a hidden discount).

---

### A3-F6: Daily Spend Cap Only on DeepSeek — LOW

**Evidence:**

```typescript
// backend/src/agents/runtime/DeepSeekMeteringAdapter.ts:160-176
async checkDailySpendCap() {
  const capUsd = parseFloat(process.env.DEEPSEEK_DAILY_SPEND_CAP_USD || '20');
  const result = await query(`SELECT COALESCE(SUM(credits_consumed), 0)::float AS today_spend FROM ai_usage_log WHERE created_at >= CURRENT_DATE`);
  // ...
}
```

**Impact:** The daily cap is on the cheapest model only. Claude calls via `MeteringAdapter` or `JediAIService` have no cap. Also, the cap check reads `ai_usage_log.credits_consumed` which is a mix of USD and integer credits (A3-F2), so the cap threshold is unreliable.

---

### A3-F7: Preflight Estimate Undersized — MEDIUM

**Evidence:**

```typescript
// backend/src/agents/runtime/MeteringAdapter.ts:51-52
function preflightEstimate(model: string): number {
  return estimateCost(model, 4_096, 4_096);
}
```

**Impact:** The pre-flight estimate assumes 4k input + 4k output for **all** operations. A `coordinator_deal_bible` or `research_full_assembly` typically uses 16k–32k tokens. If the actual cost exceeds the estimate, `debitActualCost()` charges the delta, but:
1. The user may not have enough credits for the delta (credit wall breach).
2. The estimate is so small that `reserveCredits()` often returns `false` (overage), bypassing the pre-flight check entirely.

---

### A3-F8: No Model-Family Cost Differential in Stripe — LOW

**Evidence:** Stripe meters only have `jedi_input_tokens` and `jedi_output_tokens`. There is no `jedi_input_tokens_deepseek` or `jedi_input_tokens_claude` meter.

**Impact:** Stripe cannot bill different rates for different models. If the platform ever wants to pass through model costs directly, it needs per-model meter events.

---

## 3. Unit Economics Analysis

### Credit Pricing Model

| Tier | Monthly Credits | Overage / Credit | Subscription Price (inferred) |
|------|-----------------|------------------|-------------------------------|
| Scout | 100 | $0.25 | ~$25–$49/mo |
| Operator | 500 | $0.15 | ~$49–$97/mo |
| Principal | 2000 | $0.10 | ~$97–$197/mo |
| Institutional | ∞ | $0.00 | Custom |

*Note: Subscription prices are inferred from frontend UI (`$49` for Market Research Pro, `$97` for Jedi Core). Exact prices are configured in Stripe products, not in code.*

### Margin per Operation (Flat Credits vs. Actual Cost)

| Operation | Flat Credits | Scout Cost | DeepSeek Actual (8k) | DeepSeek Actual (32k) | DeepSeek Actual (128k) | Claude Sonnet Actual (32k) | Claude Opus Actual (32k) |
|-----------|-------------|------------|----------------------|-----------------------|------------------------|---------------------------|--------------------------|
| research_single_source | 1 | $0.25 | $0.0035 | $0.014 | $0.056 | $0.144 | $0.72 |
| research_full_assembly | 3 | $0.75 | $0.0035 | $0.014 | $0.056 | $0.144 | $0.72 |
| coordinator_chat_response | 2 | $0.50 | $0.0035 | $0.014 | $0.056 | $0.144 | $0.72 |
| cashflow_analysis | 5 | $1.25 | $0.0035 | $0.014 | $0.056 | $0.144 | $0.72 |
| coordinator_deal_bible | 40 | $10.00 | $0.0035 | $0.014 | $0.056 | $0.144 | $0.72 |

**Key insight:** For small calls (≤8k tokens), the platform has a **~95–99% gross margin**. But the margin is **unbounded negative** for large calls because the user pays a flat fee regardless of token count. The platform is effectively offering **unlimited token calls** at a fixed price, which is a classic SaaS trap.

### Break-Even Token Volume per Operation

At Scout overage ($0.25/credit), the break-even point for a 40-credit operation:

| Model | Break-Even Tokens (in+out) | Platform Loses Money Above |
|-------|---------------------------|--------------------------|
| DeepSeek | ~14.5M tokens | 14.5M tokens |
| Claude Sonnet | ~1.3M tokens | 1.3M tokens |
| Claude Opus | ~260k tokens | 260k tokens |

Since there is **no runtime token limit**, a single malicious or buggy prompt can generate 200k+ tokens, pushing the platform into a loss.

---

## 4. Recommended Fixes

### Fix A3-F1: Unify the Credit Unit

**Option A (Recommended): Convert everything to USD-proxy credits**
- Define `1 credit = $0.01` (or another fixed conversion).
- Update `CREDIT_COSTS` to return USD values instead of integer credits.
- Remove the flat credit model entirely; all operations use actual cost estimates.
- **Pros:** Accurate billing, no loss on large calls, consistent analytics.
- **Cons:** User-facing pricing becomes unpredictable (users prefer flat fees).

**Option B: Keep flat credits but add a token budget per operation**
- Each operation in `CREDIT_COSTS` gets a `maxTokens` budget.
- If actual tokens exceed the budget, the call is truncated or the user is charged overage.
- **Pros:** Predictable user pricing.
- **Cons:** Complex to implement; may degrade user experience.

**Option C (Hybrid): Flat credits for user-facing billing, USD reconciliation in background**
- User sees integer credits deducted.
- Platform tracks actual USD cost in a separate `cost_usd` column.
- Monthly reconciliation: if the user's actual cost exceeds their subscription value, charge overage.
- **Pros:** Best UX + accurate platform economics.
- **Cons:** Most complex to implement; requires new billing logic.

### Fix A3-F2: Add `cost_usd` Column to `ai_usage_log`

```sql
ALTER TABLE ai_usage_log ADD COLUMN cost_usd NUMERIC(14,6) DEFAULT 0;
```
- Update all `logUsage` methods to write both `credits_consumed` (user-facing) and `cost_usd` (platform cost).
- Update the daily spend cap to read `SUM(cost_usd)` instead of `SUM(credits_consumed)`.

### Fix A3-F3: Restore Tier-Based Model Routing

- Update `MODEL_ROUTING` so that higher tiers get better models:
  ```typescript
  scout:     { research: 'deepseek-chat', ... },
  operator:  { research: 'claude-sonnet-4-5', ... },
  principal: { research: 'claude-sonnet-4-5', ... },
  institutional: { research: 'claude-opus-4-5', ... },
  ```
- This also makes the `getCreditCost()` Opus multiplier meaningful.

### Fix A3-F4: Add Token Budget Enforcement

- Add `maxTokens` to `CREDIT_COSTS` or as a per-operation config.
- In `JediAIService.generate()`, pass `max_tokens` based on the operation's budget.
- In `MeteringAdapter.createMessage()`, enforce the same budget.
- For streaming, abort the stream if the token count exceeds the budget.

### Fix A3-F5: Weighted Stripe Meter Events

- Report weighted tokens to Stripe instead of raw tokens:
  ```typescript
  const weightedInput = inputTokens * (modelInputCost / baseInputCost);
  const weightedOutput = outputTokens * (modelOutputCost / baseOutputCost);
  ```
- Or create separate meter events per model family (`jedi_input_tokens_claude`, `jedi_input_tokens_deepseek`).

### Fix A3-F6: Extend Daily Spend Cap to All Models

- Move the daily spend cap check into `JediAIService` or a shared `CostGuard` service.
- Read from `SUM(cost_usd)` instead of `SUM(credits_consumed)`.
- Apply the cap to all model calls, not just DeepSeek.

### Fix A3-F7: Per-Operation Preflight Estimates

- Replace the global `4_096 + 4_096` estimate with per-operation estimates:
  ```typescript
  const OPERATION_ESTIMATES: Record<string, { input: number; output: number }> = {
    research_single_source: { input: 2_000, output: 1_000 },
    coordinator_deal_bible: { input: 16_000, output: 8_000 },
  };
  ```

### Fix A3-F8: Per-Model Stripe Meters (Optional)

- Create separate meter events for each model family if Stripe billing needs to differentiate.

---

## 5. Fix Priority & Effort

| Fix | Priority | Effort | Launch Blocker? |
|-----|----------|--------|-----------------|
| A3-F1: Unify credit unit | P0 | Medium (2–3 days) | ✅ YES |
| A3-F2: Add `cost_usd` column | P0 | Small (1 day) | ✅ YES |
| A3-F4: Token budget enforcement | P0 | Medium (2–3 days) | ✅ YES |
| A3-F3: Tier-based model routing | P1 | Small (1 day) | ⚠️ No |
| A3-F5: Weighted Stripe meters | P1 | Small (1 day) | ⚠️ No |
| A3-F6: Extend daily spend cap | P1 | Small (1 day) | ⚠️ No |
| A3-F7: Per-operation estimates | P2 | Small (1 day) | ⚠️ No |
| A3-F8: Per-model Stripe meters | P2 | Small (1 day) | ⚠️ No |

---

## 6. Conclusion

The credit system is **structurally unsound** for launch. The dual-unit problem (A3-F1) corrupts user balances and makes the platform's economics un-auditable. The flat credit model (A3-F4) exposes the platform to unbounded losses on large calls. The missing `cost_usd` column (A3-F2) means the platform cannot accurately measure its own costs.

**Recommendation:** Do not launch without resolving A3-F1, A3-F2, and A3-F4. The fixes are medium-effort and can be completed in 1–2 engineering days.

---

*Audit completed: 2026-06-24T20:58:00-0400*
