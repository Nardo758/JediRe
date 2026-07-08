# DISPATCH — Token Leak Remediation, Tranche 1 (Mechanical — no product decisions)

**Arc:** Billing/metering — follows `AUDIT_DISPATCH_TOKEN_CONSUMPTION.md` findings (accepted). Tranche 2 (billable policy, F9 auto-build gating, F9 deterministic derivation) awaits operator decisions — DO NOT implement any of it here.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Standing rule (S1-01):** live proof per item. Several fixes here guard against failures that are hard to trigger — each gets a forced-failure test with pasted output, not a green unit test.
**Sequencing constraint:** T1 and T2 land BEFORE any DeepSeek balance top-up. Operator will not refill until the unmetered path is closed.

## T1 · Meter the F9 build path (accounting only — do not change its triggers or its LLM usage; that's Tranche 2)
Route `financial-model-engine.service.ts` `callLLMForModel()` through the metering adapters (or an equivalent wrapper) so every call writes `ai_usage_log` (tokens, cost_usd, model, deal_id, user_id, org_id, surface='f9_build') and counts against `checkDailySpendCap`. `billable_usd` = 0 for now (policy pending). 
**Proof:** trigger one F9 build; paste the new ledger row.

## T2 · Fix cost_usd computation for all metered paths
Root-cause why 99.86% of deepseek-chat rows logged cost_usd=0 (the last 43 rows compute correctly — diff what changed 2026-06-28 02:00 UTC and confirm the fix covers every write site). 
**Proof:** one call per adapter path; paste rows showing nonzero cost matching COST_PER_MTK math by hand.

## T3 · Historical backfill of cost_usd
One-time UPDATE recomputing cost_usd for the 29,722 zero rows from their stored token counts × COST_PER_MTK. Read-only dry-run first: paste `SUM(new_cost)` (expect ≈ $189.67) and 5 sample rows before/after; STOP for a one-word confirm before executing the UPDATE (it's a 29k-row production write).

## T4 · Circuit breaker on provider failures
On a provider-native 402 (or ≥3 consecutive 5xx) the pipeline SHORT-CIRCUITS the remaining steps for that run and marks the run failed with the provider error surfaced — no more Research-fails→Supply-burns→CashFlow-queues against a dead account. No silent provider fallback: switching providers on failure is a cost decision, not an error handler's. 
**Proof:** with DeepSeek still empty (convenient), trigger one pipeline run; paste logs showing step 1 fails 402 and steps 2–4 never call out.

## T5 · Cap the orchestrator tool loop
`agent-orchestrator.ts:387` `while (stop_reason === 'tool_use')` gets a hard iteration ceiling (align with AgentRuntime's maxStepsPerRun; suggest same value) + a logged, surfaced termination reason when hit. 
**Proof:** forced test hitting the cap; paste the termination log.

## T6 · org_id at write time
Every `ai_usage_log` write site populates org_id (resolve from user/deal via the org-entitlement model — NOT `LIMIT 1`, per the known bug class). 
**Proof:** one call per write site; paste rows with org_id = dd201183-…. Historical backfill of org_id is OUT of this tranche (29k-row write + resolution ambiguity — separate ticket if wanted).

## T7 · Error transparency on the build route
`financial-model.routes.ts:555–558` stops hardcoding 500; upstream provider status (402 etc.) propagates with its real cause. 
**Proof:** trigger against empty DeepSeek; paste the 402 (not 500) response body.

## T8 · Idempotency-Key on frontend build POST
Frontend sends a stable Idempotency-Key (deal + assumption-hash based) on `POST /financial-model/build` so the existing server cache (routes:519–551) dedupes across remounts/refreshes — this narrows the auto-build burn without deciding its fate (Tranche 2). 
**Proof:** two page refreshes; paste logs showing one build, one cache hit.

## T9 · Cap the sentiment cron
`snapshot-sentiment.function.ts` gets a per-run item cap (match event-extraction's MAX_ARTICLES_PER_RUN=50 pattern). 
**Proof:** file:line of the cap + one run's log line showing items ≤ cap.

## OUT OF SCOPE (Tranche 2 — operator decisions pending)
Billable policy per trigger class (billable_usd stays 0 everywhere); removing/gating the F9 auto-build useEffect; F9 deterministic derivation / tri-tab reconciliation; DealContext cache implementation (design first — what's cacheable per the context assembly shape); DeepSeek top-up; org_id historical backfill.

## ACCEPTANCE SUMMARY
Each T-item's proof pasted; plus one end-to-end: trigger a full user analysis run post-fix and paste its complete ledger footprint (every call metered, cost_usd nonzero, org_id populated, surface tagged). **T3 has its own internal STOP.**

**Run T1–T2 first (they gate the top-up), then the rest in any order. Report.**
