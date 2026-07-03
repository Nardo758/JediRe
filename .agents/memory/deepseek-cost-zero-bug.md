---
name: DeepSeek metered cost_usd historically logged as zero
description: ai_usage_log shows 99.86% of deepseek-chat rows with cost_usd=0 despite real token volume; internal $/day cap was blind to real spend for most of the system's life.
---

`ai_usage_log` rows for `model='deepseek-chat'`: 29,722 of 29,765 rows (99.86%) have `cost_usd = 0` exactly, covering 639.5M input / 15.4M output tokens that were never priced. Only the most recent ~43 rows (first seen 2026-06-28 02:00 UTC) have correctly nonzero `cost_usd` matching the `COST_PER_MTK` table in `DeepSeekMeteringAdapter.ts`.

**Why this matters:** `checkDailySpendCap()` in `DeepSeekMeteringAdapter.ts` sums `cost_usd` to enforce `DEEPSEEK_DAILY_SPEND_CAP_USD` (default $20/day). Because `cost_usd` was 0 for nearly all historical calls, this cap could not have meaningfully throttled real spend for most of the system's operating life — real DeepSeek-side token consumption continued while the internal ledger reported near-zero cost. This is consistent with DeepSeek account balance depleting externally (`402 Insufficient Balance`, seen for deal `eaabeb9f-...` on 2026-07-02) while the internal cap never tripped.

**How to apply:** Before trusting `ai_usage_log.cost_usd` (or any spend-cap logic keyed off it) for DeepSeek rows, verify against raw `input_tokens`/`output_tokens` × current `COST_PER_MTK` rates rather than trusting stored `cost_usd` at face value for historical data predating 2026-06-28. Also note `org_id` is populated in only 1 of 29,870 rows total — org-level cost aggregation from this table is not currently viable.
